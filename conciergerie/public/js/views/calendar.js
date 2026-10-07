import { html, str, api, on, guestName, L, today, addDays, qs } from '../ui.js';
import { topbar } from '../app.js';
import { openBookingForm } from './booking.js';

const CELL = 44;
const SOURCE_COLORS = { airbnb: '#e11d48', booking: '#1d4ed8', abritel: '#7c3aed', direct: '#2c3a1e', gites_de_france: '#65a30d', ical: '#6b7280' };

export default async function calendar(el, { go, query }) {
  let from = query.from || addDays(today(), -3);
  let span = Number(query.days) || 28;
  let colorBy = 'source';

  async function render() {
    const to = addDays(from, span - 1);
    const d = await api.get(`/calendar${qs({ from, to })}`);
    const days = Array.from({ length: span }, (_, i) => addDays(from, i));
    const t = today();
    const idx = (s) => days.indexOf(s);

    const head = days.map((s) => {
      const dt = new Date(`${s}T12:00:00Z`);
      const we = [0, 6].includes(dt.getUTCDay());
      return html`<div class="cal-head ${we ? 'we' : ''} ${s === t ? 'today' : ''}">${dt.toLocaleDateString('fr-FR', { weekday: 'narrow', timeZone: 'UTC' })}<br><b>${dt.getUTCDate()}</b>${dt.getUTCDate() === 1 || s === from ? html`<br>${dt.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' })}` : ''}</div>`;
    });

    const rows = d.properties.map((p, r) => {
      const row = r + 2;
      const cells = days.map((s, i) => {
        const dt = new Date(`${s}T12:00:00Z`);
        const we = [0, 6].includes(dt.getUTCDay());
        const ints = d.interventions.filter((x) => x.property_id === p.id && x.scheduled_date === s);
        return html`<div class="cal-cell ${we ? 'we' : ''} ${s === t ? 'today' : ''}" style="grid-row:${row};grid-column:${i + 2};display:flex;align-items:flex-end;justify-content:center"
          data-day="${s}" data-prop="${p.id}">${ints.length ? html`<span class="small" title="${ints.map((x) => `${x.title}${x.assignee_name ? ' – ' + x.assignee_name : ' – non assignée'}`).join('\n')}">${ints.map((x) => L.intType[x.type][1])}</span>` : ''}</div>`;
      });
      const bars = d.bookings.filter((b) => b.property_id === p.id).map((b) => {
        const startIn = idx(b.checkin_date) >= 0;
        const endIn = idx(b.checkout_date) >= 0;
        const s = startIn ? idx(b.checkin_date) : (b.checkin_date < from ? 0 : -1);
        const e = endIn ? idx(b.checkout_date) : (b.checkout_date > days[days.length - 1] ? span - 1 : -1);
        if (s < 0 || e < 0) return '';
        const color = b.status === 'blocked' ? '#9ca3af' : (colorBy === 'source' ? (SOURCE_COLORS[b.source] || '#2c3a1e') : p.color);
        const label = b.status === 'blocked' ? 'Indisponible' : guestName(b);
        return html`<div class="cal-bar ${b.status === 'blocked' ? 'blocked' : ''}" data-booking="${b.id}" title="${label} – ${b.checkin_date} → ${b.checkout_date}"
          style="grid-row:${row};grid-column:${s + 2} / ${e + 3};background:${color};align-self:start;margin-top:6px;height:30px;
          margin-left:${startIn ? CELL / 2 : 0}px;margin-right:${endIn ? CELL / 2 : 0}px">${label}${b.status !== 'blocked' ? html`<small>${(b.adults || 0) + (b.children || 0)} pers. · ${L.source[b.source] || b.source}</small>` : ''}</div>`;
      });
      return html`<div class="cal-prop" style="grid-row:${row};grid-column:1;min-height:62px"><span class="dot" style="background:${p.color}"></span><span>${p.name}<br><span class="small muted" style="font-weight:400">${p.city || ''}</span></span></div>${cells}${bars}`;
    });

    el.innerHTML = str(html`
      ${topbar('Calendrier', html`
        <button data-nav="-7">‹ Semaine</button><button data-nav="0">Aujourd'hui</button><button data-nav="7">Semaine ›</button>
        <select data-span>${[14, 28, 42, 60].map((n) => html`<option value="${n}" ${n === span ? 'selected' : ''}>${n} jours</option>`)}</select>
        <select data-color><option value="source" ${colorBy === 'source' ? 'selected' : ''}>Couleur : canal</option><option value="property" ${colorBy === 'property' ? 'selected' : ''}>Couleur : logement</option></select>
        <button class="primary" data-new>+ Réservation</button>`)}
      <div class="card cal" style="padding:0">
        ${d.properties.length ? html`<div class="cal-grid" style="grid-template-columns:210px repeat(${span}, ${CELL}px)">
          <div class="cal-head" style="grid-column:1;position:sticky;left:0;z-index:3;text-align:left;padding-left:10px">Logement</div>${head}${rows}</div>`
        : html`<div class="empty">Ajoutez d'abord un <a href="#/logements">logement</a>.</div>`}
      </div>
      <div class="row small muted">${Object.entries(SOURCE_COLORS).map(([k, c]) => html`<span class="row" style="gap:4px"><span class="dot" style="background:${c}"></span>${L.source[k]}</span>`)}
        <span>· 🔑 accueil · 🚪 sortie · 🧹 ménage · 🔧 maintenance — cliquez sur une case vide pour créer une réservation</span></div>`);
  }

  on(el, 'click', '[data-nav]', (e, b) => { const n = Number(b.dataset.nav); from = n === 0 ? addDays(today(), -3) : addDays(from, n); render(); });
  on(el, 'change', '[data-span]', (e, s) => { span = Number(s.value); render(); });
  on(el, 'change', '[data-color]', (e, s) => { colorBy = s.value; render(); });
  on(el, 'click', '[data-booking]', (e, b) => go(`/reservations/${b.dataset.booking}`));
  on(el, 'click', '[data-new]', () => openBookingForm({}, render));
  on(el, 'click', '.cal-cell', (e, c) => openBookingForm({ property_id: Number(c.dataset.prop), checkin_date: c.dataset.day, checkout_date: addDays(c.dataset.day, 2) }, render));
  await render();
}
