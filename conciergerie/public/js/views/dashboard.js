import { html, str, api, money, fday, fdatetime, guestName, L, tag } from '../ui.js';
import { topbar } from '../app.js';
import { openBookingForm } from './booking.js';

export default async function dashboard(el, { go }) {
  const d = await api.get('/dashboard');
  const k = d.kpi;
  const tomorrow = (s) => (s === d.today ? 'Aujourd\'hui' : 'Demain');
  const bookingRow = (b, kind) => html`<a class="list-item" href="#/reservations/${b.id}">
    <span class="tag ${b[kind] === d.today ? 'brand' : ''}">${tomorrow(b[kind])}</span>
    <div class="grow"><div class="bold">${guestName(b)}</div><div class="small muted">${b.property_name} · ${(b.adults || 0) + (b.children || 0)} pers. · ${L.source[b.source] || b.source}</div></div>
    <span class="small">${kind === 'checkin_date' ? (b.arrival_time || b.checkin_time) : b.checkout_time}</span></a>`;

  el.innerHTML = str(html`
    ${topbar('Tableau de bord', html`<button class="primary" data-new>+ Réservation</button>`)}
    <div class="grid g4" style="margin-bottom:16px">
      <div class="kpi"><div class="l">Taux d'occupation (mois)</div><div class="v">${k.occupancy} %</div><div class="small muted">${k.properties} logement(s) actif(s)</div></div>
      <div class="kpi"><div class="l">CA réservations (mois)</div><div class="v">${money(k.revenue_month)}</div><div class="small muted">Commissions : ${money(k.commission_month)}</div></div>
      <div class="kpi"><div class="l">Voyageurs en séjour</div><div class="v">${k.in_house}</div><div class="small muted">${k.unread ? html`<a href="#/messagerie">${k.unread} message(s) non lu(s)</a>` : 'Aucun message non lu'}</div></div>
      <div class="kpi"><div class="l">Factures en attente</div><div class="v">${money(k.unpaid_total)}</div><div class="small muted">${k.unpaid_count} facture(s) émise(s)</div></div>
    </div>
    ${k.failed_messages ? html`<div class="card" style="background:var(--err-l)">⚠️ ${k.failed_messages} message(s) en échec d'envoi – <a href="#/messagerie?status=failed">voir</a></div>` : ''}
    <div class="grid g2">
      <div class="card"><h2>🛬 Arrivées (aujourd'hui & demain)</h2>${d.arrivals.length ? d.arrivals.map((b) => bookingRow(b, 'checkin_date')) : html`<div class="empty">Aucune arrivée</div>`}</div>
      <div class="card"><h2>🛫 Départs (aujourd'hui & demain)</h2>${d.departures.length ? d.departures.map((b) => bookingRow(b, 'checkout_date')) : html`<div class="empty">Aucun départ</div>`}</div>
      <div class="card"><div class="row between"><h2>🧹 Interventions à traiter</h2>${d.unassigned ? html`<span class="tag err">${d.unassigned} non assignée(s)</span>` : ''}</div>
        ${d.interventions.length ? d.interventions.map((i) => html`<a class="list-item" href="#/interventions?date=${i.scheduled_date}">
          <span>${L.intType[i.type][1]}</span><div class="grow"><div class="bold">${i.title}</div><div class="small muted">${i.property_name} · ${fday(i.scheduled_date)} ${i.scheduled_time || ''}</div></div>
          <div style="text-align:right">${tag(L.intStatus, i.status)}<div class="small ${i.assignee_name ? 'muted' : ''}" style="${i.assignee_name ? '' : 'color:var(--err)'}">${i.assignee_name || 'Non assignée'}</div></div></a>`) : html`<div class="empty">Rien à faire 🎉</div>`}
      </div>
      <div class="card"><h2>⏱️ Équipe en poste</h2>
        ${d.on_duty.length ? d.on_duty.map((t) => html`<div class="list-item"><span class="dot" style="background:var(--ok)"></span><div class="grow bold">${t.name}</div><span class="small muted">${t.title || 'Hors intervention'} · depuis ${fdatetime(t.clock_in)}</span></div>`) : html`<div class="empty">Personne n'a pointé</div>`}
        <h2 style="margin-top:18px">✉️ Prochains messages automatiques</h2>
        ${d.upcoming_messages.length ? d.upcoming_messages.map((m) => html`<div class="list-item"><span class="small muted" style="width:92px">${fdatetime(m.scheduled_at)}</span><div class="grow"><div>${m.subject || '(sans objet)'}</div><div class="small muted">${guestName(m)} · ${L.channel[m.channel]}</div></div></div>`) : html`<div class="empty">Aucun message programmé</div>`}
      </div>
    </div>`);
  el.querySelector('[data-new]').addEventListener('click', () => openBookingForm({}, (b) => go(`/reservations/${b.id}`)));
}
