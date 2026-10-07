// Mobile-first view for field agents: today's jobs, access codes, checklist, clock in/out.
import { html, str, raw, api, on, $, fdate, guestName, L, tag, qs, today, addDays, attempt } from '../ui.js';
import { topbar } from '../app.js';
import { renderClock, clockIn, clockOutDialog } from './time.js';

const store = {
  get(id) { try { return JSON.parse(localStorage.getItem(`chk-${id}`) || '[]'); } catch { return []; } },
  set(id, v) { try { localStorage.setItem(`chk-${id}`, JSON.stringify(v)); } catch { /* private mode */ } },
};

export default async function agentView(el, { me }) {
  let showAll = false;
  async function load() {
    el.innerHTML = str(html`${topbar(`Bonjour ${me.user.name.split(' ')[0]} 👋`)}<div id="clock"></div><div id="jobs"></div>`);
    const current = await renderClock($('#clock', el), load);
    const jobs = await api.get(`/interventions${qs({ from: showAll ? addDays(today(), -7) : today(), to: addDays(today(), showAll ? 14 : 2), mine: 1 })}`);
    const open = jobs.filter((j) => showAll || ['a_faire', 'en_cours'].includes(j.status) || j.scheduled_date === today());
    const card = (j) => {
      let items = [];
      try { items = JSON.parse(j.checklist || '[]'); } catch { /* ignore */ }
      const done = store.get(j.id);
      const active = current && current.intervention_id === j.id;
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([j.property_address, j.property_city, 'La Réunion'].filter(Boolean).join(', '))}`;
      return html`<div class="card job" style="border-left-color:${j.property_color}">
        <div class="row between"><div class="bold">${L.intType[j.type][1]} ${j.title}</div>${tag(L.intStatus, j.status)}</div>
        <div class="small" style="margin-top:4px">📅 ${j.scheduled_date === today() ? 'Aujourd\'hui' : fdate(j.scheduled_date, { weekday: 'long', day: 'numeric', month: 'short' })} ${j.scheduled_time ? `à ${j.scheduled_time}` : ''} · ⏳ ${j.duration_min} min</div>
        <div class="small">🏠 ${j.property_name} – <a href="${mapUrl}" target="_blank" rel="noopener">${j.property_address || ''} ${j.property_city || ''} 🧭</a></div>
        ${j.keybox_code ? html`<div class="small">🔑 Boîte à clés : <b>${j.keybox_code}</b></div>` : ''}
        ${j.first_name ? html`<div class="small">👤 ${guestName(j)} ${j.adults ? `· ${j.adults + (j.children || 0)} pers.` : ''} ${j.arrival_time ? `· arrivée ${j.arrival_time}` : ''} ${j.guest_phone ? html`· <a href="tel:${j.guest_phone}">📞 ${j.guest_phone}</a>` : ''}</div>` : ''}
        ${j.notes ? html`<div class="small" style="background:var(--warn-l);padding:6px 8px;border-radius:6px;margin-top:6px">📝 ${j.notes}</div>` : ''}
        ${items.length && j.status !== 'terminee' ? html`<div class="checklist" style="margin-top:8px">${items.map((it, k) => html`<label><input type="checkbox" data-chk="${j.id}" data-k="${k}" ${done.includes(k) ? raw('checked') : ''}> ${it}</label>`)}</div>` : ''}
        ${j.report ? html`<div class="small muted" style="margin-top:6px">Compte rendu : ${j.report}</div>` : ''}
        <div class="acts">
          ${j.status !== 'terminee' && j.status !== 'annulee' ? (active
            ? html`<button class="primary" data-finish>✅ Terminer & pointer la sortie</button>`
            : html`<button class="primary" data-start="${j.id}" ${current ? raw('disabled title="Terminez d\'abord le pointage en cours"') : ''}>▶ Démarrer (pointer)</button>`) : ''}
          ${j.status !== 'terminee' && !active ? html`<button data-done="${j.id}">Marquer terminée</button>` : ''}
        </div>
      </div>`;
    };
    $('#jobs', el).innerHTML = str(html`
      <div class="row between" style="margin:6px 0 10px"><h2 style="margin:0">Mes interventions</h2>
        <label class="check small"><input type="checkbox" data-all ${showAll ? raw('checked') : ''}> Voir aussi passées / à venir</label></div>
      ${open.length ? open.map(card) : html`<div class="card empty">Aucune intervention prévue. Profitez-en ☀️</div>`}`);
    $('[data-finish]', el)?.addEventListener('click', () => clockOutDialog(current, load));
  }

  on(el, 'change', '[data-all]', (e, c) => { showAll = c.checked; load(); });
  on(el, 'change', '[data-chk]', (e, c) => {
    const id = Number(c.dataset.chk); const k = Number(c.dataset.k);
    const done = new Set(store.get(id));
    if (c.checked) done.add(k); else done.delete(k);
    store.set(id, [...done]);
  });
  on(el, 'click', '[data-start]', async (e, b) => { await clockIn(Number(b.dataset.start)); load(); });
  on(el, 'click', '[data-done]', async (e, b) => { await attempt(() => api.put(`/interventions/${b.dataset.done}`, { status: 'terminee' }), 'Intervention terminée'); load(); });
  await load();
}
