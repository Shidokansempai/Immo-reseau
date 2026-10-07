import { html, str, api, on, money, fdate, fday, fdatetime, guestName, nights, L, tag, opts, formModal, attempt, confirmDialog, toast, today } from '../ui.js';
import { topbar } from '../app.js';
import { openComposer } from './messages.js';

/** Booking create/edit form (with inline guest). */
export async function openBookingForm(values = {}, onSaved) {
  const props = await api.get('/properties');
  const isNew = !values.id;
  const g = values.guest || {};
  const specs = [
    { type: 'section', label: 'Séjour' },
    { name: 'property_id', label: 'Logement', type: 'select', required: true, options: [['', '— Choisir —'], ...props.filter((p) => p.active || p.id === values.property_id).map((p) => [p.id, `${p.name}`])] },
    { name: 'source', label: 'Canal', type: 'select', options: opts(L.source), default: 'direct' },
    { name: 'checkin_date', label: 'Arrivée', type: 'date', required: true, default: today() },
    { name: 'checkout_date', label: 'Départ', type: 'date', required: true, default: today(2) },
    { name: 'arrival_time', label: 'Heure d\'arrivée prévue', type: 'time' },
    { name: 'status', label: 'Statut', type: 'select', options: opts(L.bookingStatus), default: 'confirmed' },
    { name: 'adults', label: 'Adultes', type: 'number', default: 2 },
    { name: 'children', label: 'Enfants', type: 'number', default: 0 },
    { name: 'total_amount', label: 'Montant total payé (€)', type: 'money', default: 0 },
    { name: 'cleaning_fee', label: 'dont frais de ménage (€)', type: 'money', help: 'Vide = tarif du logement' },
    { name: 'platform_fee', label: 'Commission plateforme (€)', type: 'money', default: 0 },
    { name: 'tourist_tax', label: 'Taxe de séjour (€)', type: 'money', default: 0 },
    { name: 'external_ref', label: 'Référence plateforme', placeholder: 'HMXXXXXXX' },
    { name: 'notes', label: 'Notes internes', type: 'textarea', full: true, rows: 2 },
    { type: 'section', label: 'Voyageur' },
    { name: 'g_first_name', label: 'Prénom', default: g.first_name },
    { name: 'g_last_name', label: 'Nom', default: g.last_name },
    { name: 'g_email', label: 'E-mail', type: 'email', default: g.email },
    { name: 'g_phone', label: 'Téléphone', type: 'tel', default: g.phone, placeholder: '0692 …' },
    { name: 'g_language', label: 'Langue des messages', type: 'select', options: [['fr', 'Français'], ['en', 'English'], ['de', 'Deutsch']], default: g.language || 'fr' },
    { name: 'force', label: 'Forcer même en cas de chevauchement', type: 'checkbox' },
  ];
  formModal({
    title: isNew ? 'Nouvelle réservation' : `Réservation #${values.id}`, specs, values, wide: true,
    onSubmit: async (d) => {
      const guest = {};
      for (const k of Object.keys(d)) if (k.startsWith('g_')) { guest[k.slice(2)] = d[k]; delete d[k]; }
      d.property_id = Number(d.property_id);
      if (d.cleaning_fee == null) delete d.cleaning_fee;
      d.force = Boolean(d.force);
      if (guest.first_name || guest.email) d.guest = guest;
      const saved = isNew ? await api.post('/bookings', d) : await api.put(`/bookings/${values.id}`, d);
      onSaved?.(saved);
    },
  });
}

export default async function bookingView(el, { params, go }) {
  const load = async () => {
    const b = await api.get(`/bookings/${params.id}`);
    const p = b.property;
    const n = nights(b.checkin_date, b.checkout_date);
    const net = b.total_amount - b.cleaning_fee - b.platform_fee - b.tourist_tax;
    const commission = net * p.commission_rate / 100;
    const actions = html`
      ${b.status === 'confirmed' ? html`<button data-status="checked_in">✅ Voyageur arrivé</button>` : ''}
      ${b.status === 'checked_in' ? html`<button data-status="checked_out">🚪 Voyageur parti</button>` : ''}
      <button data-msg>💬 Message</button><button data-edit>✏️ Modifier</button>
      ${b.status !== 'cancelled' ? html`<button class="danger" data-status="cancelled">Annuler</button>` : html`<button data-status="confirmed">Réactiver</button>`}`;
    el.innerHTML = str(html`
      ${topbar(html`<a href="#/reservations" class="muted">Réservations</a> › ${guestName(b)}`, actions)}
      <div class="grid g3">
        <div class="card" style="grid-column:span 2">
          <div class="row between"><h2 style="margin:0">${p.name}</h2><div class="row">${tag(L.bookingStatus, b.status)}<span class="tag">${L.source[b.source] || b.source}</span></div></div>
          <div class="grid g3" style="margin-top:14px">
            <div><div class="small muted">Arrivée</div><div class="bold">${fdate(b.checkin_date, { weekday: 'long', day: 'numeric', month: 'long' })}</div><div class="small">à partir de ${b.arrival_time || p.checkin_time}</div></div>
            <div><div class="small muted">Départ</div><div class="bold">${fdate(b.checkout_date, { weekday: 'long', day: 'numeric', month: 'long' })}</div><div class="small">avant ${p.checkout_time}</div></div>
            <div><div class="small muted">Séjour</div><div class="bold">${n} nuit(s)</div><div class="small">${b.adults} adulte(s), ${b.children} enfant(s)</div></div>
          </div>
          ${b.notes ? html`<p class="small" style="background:#f9fafb;padding:8px 10px;border-radius:8px">📝 ${b.notes}</p>` : ''}
          ${b.external_ref ? html`<p class="small muted">Réf. : ${b.external_ref}</p>` : ''}
        </div>
        <div class="card"><h3>Voyageur</h3>${b.guest ? html`<div class="bold">${guestName(b.guest)}</div>
          <div class="small">${b.guest.email ? html`<a href="mailto:${b.guest.email}">${b.guest.email}</a>` : html`<span class="muted">Pas d'e-mail</span>`}</div>
          <div class="small">${b.guest.phone ? html`<a href="tel:${b.guest.phone}">${b.guest.phone}</a> · <a href="https://wa.me/${b.guest.phone.replace(/\D/g, '').replace(/^0/, '262')}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>
          <div class="small muted">Langue : ${b.guest.language}</div>` : html`<div class="muted">Aucun voyageur (blocage / import iCal) – <a href="#" data-edit>compléter</a></div>`}
        </div>
      </div>
      <div class="grid g3">
        <div class="card"><h3>💶 Finances</h3>
          <table class="t"><tr><td>Montant total</td><td class="r bold">${money(b.total_amount)}</td></tr>
          <tr><td>Ménage</td><td class="r">${money(b.cleaning_fee)}</td></tr><tr><td>Plateforme</td><td class="r">− ${money(b.platform_fee)}</td></tr>
          <tr><td>Taxe de séjour</td><td class="r">${money(b.tourist_tax)}</td></tr><tr><td>Loyer net</td><td class="r">${money(net)}</td></tr>
          <tr><td>Commission (${p.commission_rate} %)</td><td class="r bold">${money(commission)}</td></tr></table>
          <div class="row" style="margin-top:10px"><button class="sm" data-invoice>🧾 Facture voyageur</button>
          ${b.invoices.map((i) => html`<a class="tag" href="#/factures?id=${i.id}">${i.number || 'Brouillon'} · ${money(i.total_ttc)}</a>`)}</div>
        </div>
        <div class="card" style="grid-column:span 2"><div class="row between"><h3>🧹 Interventions</h3><button class="sm" data-new-int>+ Ajouter</button></div>
          ${b.interventions.length ? html`<table class="t">${b.interventions.map((i) => html`<tr>
            <td>${L.intType[i.type][1]} ${i.title}</td><td>${fday(i.scheduled_date)} ${i.scheduled_time || ''}</td>
            <td>${i.assignee_name || html`<span style="color:var(--err)">Non assignée</span>`}</td><td>${tag(L.intStatus, i.status)}</td></tr>`)}</table>` : html`<div class="empty">Aucune intervention</div>`}
        </div>
      </div>
      <div class="card"><div class="row between"><h3>✉️ Messages au voyageur</h3><div class="row"><button class="sm" data-resched>↻ Recalculer les envois auto</button><a class="btn sm" href="#/messagerie/${b.id}">Ouvrir la conversation</a></div></div>
        ${b.messages.length ? html`<table class="t">${b.messages.map((m) => html`<tr>
          <td style="width:30px">${m.direction === 'in' ? '📥' : '📤'}</td>
          <td><div class="bold">${m.subject || (m.direction === 'in' ? 'Message reçu' : '(sans objet)')}</div><div class="small muted">${m.body.slice(0, 110)}${m.body.length > 110 ? '…' : ''}</div></td>
          <td class="small">${L.channel[m.channel]}</td><td class="small">${fdatetime(m.sent_at || m.scheduled_at || m.created_at)}</td>
          <td>${tag(L.msgStatus, m.status)}</td>
          <td class="r">${m.status === 'scheduled' ? html`<button class="sm" data-send="${m.id}">Envoyer</button> <button class="sm ghost" data-cancel="${m.id}">✕</button>` : ''}
            ${m.status === 'failed' ? html`<button class="sm" data-send="${m.id}" title="${m.error}">Réessayer</button>` : ''}</td></tr>`)}</table>` : html`<div class="empty">Aucun message</div>`}
      </div>`);
    return b;
  };
  let b = await load();

  on(el, 'click', '[data-edit]', (e) => { e.preventDefault(); openBookingForm(b, async () => { b = await load(); }); });
  on(el, 'click', '[data-status]', async (e, btn) => {
    const s = btn.dataset.status;
    if (s === 'cancelled' && !(await confirmDialog('Annuler cette réservation ? Les messages programmés et interventions à faire seront annulés.', 'Annuler la réservation', 'danger'))) return;
    await attempt(() => api.post(`/bookings/${b.id}/status`, { status: s }), 'Statut mis à jour');
    b = await load();
  });
  on(el, 'click', '[data-msg]', () => openComposer(b.id, async () => { b = await load(); }));
  on(el, 'click', '[data-send]', async (e, btn) => { await attempt(() => api.post(`/messages/${btn.dataset.send}/send-now`), 'Message traité'); b = await load(); });
  on(el, 'click', '[data-cancel]', async (e, btn) => { await attempt(() => api.post(`/messages/${btn.dataset.cancel}/cancel`), 'Envoi annulé'); b = await load(); });
  on(el, 'click', '[data-resched]', async () => { const r = await attempt(() => api.post(`/messages/reschedule/${b.id}`)); toast(`${r.scheduled} message(s) programmé(s)`); b = await load(); });
  on(el, 'click', '[data-invoice]', async () => { const inv = await attempt(() => api.post(`/invoices/from-booking/${b.id}`), 'Brouillon de facture créé'); go(`/factures?id=${inv.id}`); });
  on(el, 'click', '[data-new-int]', async () => {
    const { openInterventionForm } = await import('./interventions.js');
    openInterventionForm({ property_id: b.property_id, booking_id: b.id, scheduled_date: b.checkin_date }, async () => { b = await load(); });
  });
}
