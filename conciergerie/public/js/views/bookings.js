import { html, str, api, on, $, money, fdate, guestName, nights, L, tag, opts, qs, today } from '../ui.js';
import { topbar } from '../app.js';
import { openBookingForm } from './booking.js';

export default async function bookings(el, { go }) {
  const props = await api.get('/properties');
  const f = { q: '', status: '', property_id: '', from: today(-30), to: '' };
  el.innerHTML = str(html`
    ${topbar('Réservations', html`<button class="primary" data-new>+ Nouvelle réservation</button>`)}
    <div class="filters">
      <input type="search" placeholder="Rechercher voyageur, référence…" data-f="q" style="min-width:240px">
      <select data-f="property_id"><option value="">Tous les logements</option>${props.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select>
      <select data-f="status"><option value="">Tous les statuts</option>${opts(L.bookingStatus).map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>
      <label class="small muted">Depuis <input type="date" data-f="from" value="${f.from}"></label>
    </div>
    <div class="card table-wrap" style="padding:0" id="list"></div>`);

  async function load() {
    const rows = await api.get(`/bookings${qs(f)}`);
    $('#list', el).innerHTML = str(rows.length ? html`<table class="t"><thead><tr><th>Voyageur</th><th>Logement</th><th>Arrivée</th><th>Départ</th><th>Nuits</th><th>Canal</th><th class="r">Montant</th><th>Statut</th></tr></thead><tbody>
      ${rows.map((b) => html`<tr class="click" data-id="${b.id}"><td class="bold">${b.status === 'blocked' ? html`<span class="muted">Blocage</span>` : guestName(b)}</td>
        <td><span class="dot" style="background:${b.property_color}"></span> ${b.property_name}</td><td>${fdate(b.checkin_date)}</td><td>${fdate(b.checkout_date)}</td>
        <td>${nights(b.checkin_date, b.checkout_date)}</td><td>${L.source[b.source] || b.source}</td><td class="r">${money(b.total_amount)}</td><td>${tag(L.bookingStatus, b.status)}</td></tr>`)}
      </tbody></table>` : html`<div class="empty">Aucune réservation</div>`);
  }
  let timer;
  on(el, 'input', '[data-f]', (e, i) => { f[i.dataset.f] = i.value; clearTimeout(timer); timer = setTimeout(load, 250); });
  on(el, 'click', 'tr[data-id]', (e, tr) => go(`/reservations/${tr.dataset.id}`));
  on(el, 'click', '[data-new]', () => openBookingForm({}, (b) => go(`/reservations/${b.id}`)));
  await load();
}
