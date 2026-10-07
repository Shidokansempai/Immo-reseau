'use strict';
// Automatic side effects of a booking: field interventions (accueil, état des
// lieux de sortie, ménage) and scheduled guest messages built from templates.
const { addDays, localToUtc, today } = require('./dates');
const { buildContext, render } = require('./templates');

/** Day + time on which a template must be sent for a given booking. */
function templateSendDay(tpl, booking) {
  const off = Number(tpl.offset_days) || 0;
  switch (tpl.trigger) {
    case 'booking_confirmed': return null; // immediately
    case 'before_checkin': return addDays(booking.checkin_date, -Math.abs(off || 1));
    case 'checkin_day': return booking.checkin_date;
    case 'during_stay': return addDays(booking.checkin_date, Math.max(1, off || 1));
    case 'before_checkout': return addDays(booking.checkout_date, -Math.abs(off || 1));
    case 'checkout_day': return booking.checkout_date;
    case 'after_checkout': return addDays(booking.checkout_date, Math.max(1, off || 1));
    default: return undefined; // manual templates are never scheduled
  }
}

function loadBookingContext(db, bookingId) {
  const booking = db.get('SELECT * FROM bookings WHERE id = ?', bookingId);
  if (!booking) return null;
  const property = db.get('SELECT * FROM properties WHERE id = ?', booking.property_id) || {};
  const guest = booking.guest_id ? db.get('SELECT * FROM guests WHERE id = ?', booking.guest_id) || {} : {};
  const org = db.get('SELECT * FROM organizations WHERE id = ?', booking.org_id) || {};
  return { booking, property, guest, org };
}

/**
 * (Re)builds the scheduled messages of a booking. Messages already sent are
 * kept; pending scheduled ones are replaced so that date changes are honoured.
 */
function scheduleMessages(db, bookingId, now = new Date()) {
  const c = loadBookingContext(db, bookingId);
  if (!c) return 0;
  const { booking, guest, org } = c;
  db.run("DELETE FROM messages WHERE booking_id = ? AND status = 'scheduled' AND template_id IS NOT NULL", bookingId);
  if (['cancelled', 'blocked'].includes(booking.status) || !booking.guest_id) return 0;

  const already = new Set(db.all(
    "SELECT template_id FROM messages WHERE booking_id = ? AND template_id IS NOT NULL AND status IN ('sent','simulated')",
    bookingId,
  ).map((r) => r.template_id));
  const templates = db.all(
    "SELECT * FROM message_templates WHERE org_id = ? AND active = 1 AND trigger != 'manual' AND language IN (?, 'fr') ORDER BY sort_order, id",
    booking.org_id, guest.language || 'fr',
  );
  // One template per trigger: prefer the guest's language over French.
  const chosen = new Map();
  for (const t of templates) {
    const key = `${t.trigger}:${t.offset_days}`;
    const prev = chosen.get(key);
    if (!prev || (prev.language === 'fr' && t.language === (guest.language || 'fr'))) chosen.set(key, t);
  }

  const ctx = buildContext(c);
  let count = 0;
  for (const tpl of chosen.values()) {
    if (already.has(tpl.id)) continue;
    const day = templateSendDay(tpl, booking);
    if (day === undefined) continue;
    let when = day === null ? now.toISOString() : localToUtc(day, tpl.send_time, org.tz_offset || '+04:00');
    // A message whose moment has passed is sent right away, but only while it
    // is still relevant (e.g. no "welcome" message once the guest has left).
    if (new Date(when) <= now) {
      const relevantUntil = {
        booking_confirmed: booking.checkin_date,
        before_checkin: booking.checkin_date,
        checkin_day: booking.checkin_date,
        after_checkout: addDays(booking.checkout_date, 3),
      }[tpl.trigger] || booking.checkout_date;
      if (relevantUntil < today(org.tz_offset || '+04:00', now)) continue;
      when = now.toISOString();
    }
    db.insert('messages', {
      org_id: booking.org_id,
      booking_id: booking.id,
      guest_id: booking.guest_id,
      template_id: tpl.id,
      direction: 'out',
      channel: tpl.channel,
      recipient: tpl.channel === 'email' ? guest.email : guest.phone,
      subject: render(tpl.subject, ctx),
      body: render(tpl.body, ctx),
      status: 'scheduled',
      scheduled_at: when,
    });
    count++;
  }
  return count;
}

/** Creates/updates the automatic interventions of a booking. */
function syncInterventions(db, bookingId) {
  const c = loadBookingContext(db, bookingId);
  if (!c) return;
  const { booking, property, guest } = c;
  const active = !['cancelled', 'blocked'].includes(booking.status);
  const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ') || 'voyageur';

  const wanted = [];
  if (active && property.auto_checkin) {
    wanted.push({ type: 'checkin', title: `Accueil ${guestName}`, scheduled_date: booking.checkin_date,
      scheduled_time: booking.arrival_time || property.checkin_time, duration_min: 45,
      checklist: JSON.stringify(['Logement prêt et aéré', 'Remise des clés / vérification boîte à clés', 'Présentation du logement', 'Explication Wi-Fi et équipements', 'Relevé compteurs']) });
  }
  if (active && property.auto_checkout) {
    wanted.push({ type: 'checkout', title: `État des lieux de sortie ${guestName}`, scheduled_date: booking.checkout_date,
      scheduled_time: property.checkout_time, duration_min: 30,
      checklist: JSON.stringify(['Récupération des clés', 'Vérification casse / dégâts', 'Inventaire', 'Photos du logement']) });
  }
  if (active && property.auto_cleaning) {
    wanted.push({ type: 'menage', title: `Ménage après départ ${guestName}`, scheduled_date: booking.checkout_date,
      scheduled_time: property.checkout_time, duration_min: property.cleaning_duration_min || 120,
      billable_amount: property.cleaning_fee || 0,
      checklist: JSON.stringify(['Changement draps et serviettes', 'Cuisine et vaisselle', 'Salle de bain / WC', 'Sols et poussières', 'Poubelles', 'Réassort consommables (café, savon, papier)', 'Photos de fin de ménage']) });
  }

  const existing = db.all("SELECT * FROM interventions WHERE booking_id = ? AND auto = 1", bookingId);
  for (const ex of existing) {
    const w = wanted.find((x) => x.type === ex.type);
    if (!w) {
      if (ex.status === 'a_faire') db.update('interventions', { status: 'annulee' }, { id: ex.id });
      continue;
    }
    if (ex.status === 'a_faire' || ex.status === 'annulee') {
      db.update('interventions', {
        title: w.title, scheduled_date: w.scheduled_date, scheduled_time: w.scheduled_time,
        status: 'a_faire', property_id: booking.property_id,
      }, { id: ex.id });
    }
  }
  for (const w of wanted) {
    if (existing.some((ex) => ex.type === w.type)) continue;
    db.insert('interventions', {
      org_id: booking.org_id, property_id: booking.property_id, booking_id: booking.id, auto: 1, ...w,
    });
  }
}

function onBookingChanged(db, bookingId, now = new Date()) {
  db.tx(() => {
    syncInterventions(db, bookingId);
    scheduleMessages(db, bookingId, now);
  });
}

module.exports = { templateSendDay, scheduleMessages, syncInterventions, onBookingChanged, loadBookingContext };
