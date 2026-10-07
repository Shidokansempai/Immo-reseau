'use strict';
const { deliver } = require('./mailer');
const ical = require('./ical');
const { onBookingChanged } = require('./automation');

/** Sends every scheduled message whose time has come. */
async function sendDueMessages(db, now = new Date()) {
  const due = db.all(`
    SELECT m.* FROM messages m LEFT JOIN bookings b ON b.id = m.booking_id
    WHERE m.status = 'scheduled' AND m.scheduled_at <= ?
      AND (b.id IS NULL OR b.status NOT IN ('cancelled'))
    ORDER BY m.scheduled_at LIMIT 50`, now.toISOString());
  let sent = 0;
  for (const m of due) {
    const org = db.get('SELECT * FROM organizations WHERE id = ?', m.org_id);
    try {
      const r = await deliver(org, m);
      db.update('messages', { status: r.status, sent_at: new Date().toISOString(), error: r.info || null }, { id: m.id });
      sent++;
    } catch (e) {
      db.update('messages', { status: 'failed', error: String(e.message || e).slice(0, 500) }, { id: m.id });
    }
  }
  return sent;
}

/** Imports the reservations of an external iCal feed (Airbnb, Booking...). */
async function syncPropertyCalendar(db, property, fetchImpl = fetch) {
  if (!property.ical_url) return { created: 0, updated: 0, cancelled: 0 };
  const res = await fetchImpl(property.ical_url, { headers: { 'User-Agent': 'SakuraPalmConciergerie/1.0' } });
  if (!res.ok) throw new Error(`Calendrier inaccessible (HTTP ${res.status})`);
  const events = ical.parse(await res.text());
  const source = ical.detectSource(property.ical_url);
  const stats = { created: 0, updated: 0, cancelled: 0 };
  const seen = new Set();
  const changed = [];

  db.tx(() => {
    for (const ev of events) {
      if (!ev.uid || !(ev.end > ev.start)) continue;
      seen.add(ev.uid);
      const status = ical.isBlock(ev) ? 'blocked' : 'confirmed';
      const ref = /reservations\/details\/([A-Z0-9]+)/i.exec(ev.description || '')?.[1] || null;
      const ex = db.get('SELECT * FROM bookings WHERE property_id = ? AND ical_uid = ?', property.id, ev.uid);
      if (!ex) {
        const id = db.insert('bookings', {
          org_id: property.org_id, property_id: property.id, source, ical_uid: ev.uid, external_ref: ref,
          checkin_date: ev.start, checkout_date: ev.end, status, notes: ev.summary || null,
        });
        changed.push(id); stats.created++;
      } else if (ex.checkin_date !== ev.start || ex.checkout_date !== ev.end || (ex.status === 'cancelled')) {
        db.update('bookings', { checkin_date: ev.start, checkout_date: ev.end, status: ex.status === 'cancelled' ? status : ex.status }, { id: ex.id });
        changed.push(ex.id); stats.updated++;
      }
    }
    // Reservations removed from the feed have been cancelled on the platform.
    const today = new Date().toISOString().slice(0, 10);
    for (const b of db.all("SELECT id, ical_uid FROM bookings WHERE property_id = ? AND ical_uid IS NOT NULL AND status IN ('confirmed','blocked') AND checkout_date >= ?", property.id, today)) {
      if (!seen.has(b.ical_uid)) {
        db.update('bookings', { status: 'cancelled' }, { id: b.id });
        changed.push(b.id); stats.cancelled++;
      }
    }
    db.update('properties', { ical_last_sync: new Date().toISOString() }, { id: property.id });
  });
  for (const id of changed) onBookingChanged(db, id);
  return stats;
}

async function syncAllCalendars(db) {
  for (const p of db.all("SELECT * FROM properties WHERE active = 1 AND ical_url IS NOT NULL AND ical_url != ''")) {
    try { await syncPropertyCalendar(db, p); }
    catch (e) { console.warn(`[ical] ${p.name}: ${e.message}`); }
  }
}

function start(db, { messageEveryMs = 60_000, icalEveryMs = 3_600_000 } = {}) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await sendDueMessages(db); } catch (e) { console.error('[scheduler]', e); } finally { busy = false; }
  };
  const t1 = setInterval(tick, messageEveryMs);
  const t2 = setInterval(() => syncAllCalendars(db).catch((e) => console.error('[ical]', e)), icalEveryMs);
  setTimeout(tick, 2000);
  return () => { clearInterval(t1); clearInterval(t2); };
}

module.exports = { start, sendDueMessages, syncPropertyCalendar, syncAllCalendars };
