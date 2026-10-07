import { html, str, api, on, $, fdate, fdatetime, ftime, hours, money, qs, today, modal, attempt, formModal, L, raw } from '../ui.js';
import { topbar } from '../app.js';

/** Best-effort geolocation (resolves to {} when refused/unavailable). */
export function position() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve({}), { timeout: 6000, maximumAge: 60000 });
  });
}

export async function clockIn(interventionId = null) {
  const pos = await position();
  return attempt(() => api.post('/time/clock-in', { intervention_id: interventionId, ...pos }), 'Pointage d\'arrivée enregistré');
}

/** Clock-out dialog: optional report and completion of the linked intervention. */
export function clockOutDialog(current, onDone) {
  modal({
    title: 'Fin de pointage',
    body: html`<form onsubmit="return false" style="display:grid;gap:12px">
      <div>Début : <b>${fdatetime(current.clock_in)}</b>${current.intervention_title ? html` · ${current.intervention_title}` : ''}</div>
      ${current.intervention_id ? html`<label class="check"><input type="checkbox" name="complete" checked> Marquer l'intervention comme terminée</label>
        <label class="f">Compte rendu<textarea name="report" rows="3" placeholder="RAS / casse / manque de consommables…"></textarea></label>` : ''}
      <label class="f">Note<textarea name="notes" rows="2"></textarea></label></form>`,
    actions: [{ label: 'Annuler' }, { label: '⏹ Terminer le pointage', cls: 'primary', onClick: async (el) => {
      const form = $('form', el);
      const pos = await position();
      await attempt(() => api.post('/time/clock-out', {
        complete: Boolean(form.complete?.checked), report: form.report?.value || null, notes: form.notes.value || null, ...pos,
      }), 'Pointage terminé');
      onDone?.();
    } }],
  });
}

let ticker;
/** Renders the clock widget into `box`. */
export async function renderClock(box, onChange) {
  const current = await api.get('/time/current');
  clearInterval(ticker);
  box.innerHTML = str(html`<div class="card clock">
    ${current ? html`<div class="muted">En poste depuis ${ftime(current.clock_in)}${current.intervention_title ? html` · ${current.intervention_title} (${current.property_name})` : ''}</div>
      <div class="time" data-elapsed>--:--:--</div><button class="primary lg" data-out>⏹ Pointer la sortie</button>`
    : html`<div class="muted">Vous n'êtes pas en poste</div><div class="time">${new Date().toLocaleTimeString('fr-FR', { timeZone: 'Indian/Reunion', hour: '2-digit', minute: '2-digit' })}</div>
      <button class="primary lg" data-in>▶ Pointer l'arrivée</button>`}
  </div>`);
  if (current) {
    const tick = () => {
      const s = Math.floor((Date.now() - new Date(current.clock_in)) / 1000);
      const elt = $('[data-elapsed]', box);
      if (!elt) return clearInterval(ticker);
      elt.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
    };
    tick(); ticker = setInterval(tick, 1000);
    $('[data-out]', box).onclick = () => clockOutDialog(current, onChange);
  } else {
    $('[data-in]', box).onclick = async () => { await clockIn(); onChange?.(); };
  }
  return current;
}

export default async function timeView(el, { me }) {
  const isAgent = me.user.role === 'agent';
  const users = isAgent ? [] : await api.get('/users');
  const monthStart = `${today().slice(0, 8)}01`;
  const f = { from: monthStart, to: today(), user_id: '' };

  el.innerHTML = str(html`
    ${topbar('Pointage', isAgent ? '' : html`<button data-add>+ Saisie manuelle</button><a class="btn" data-csv href="#">⬇ Export CSV</a>`)}
    <div class="grid ${isAgent ? '' : 'g2'}"><div id="clock"></div>
      ${isAgent ? '' : html`<div class="card"><h2>Synthèse par intervenant</h2><div id="report"></div></div>`}</div>
    <div class="filters">
      <label class="small muted">Du <input type="date" data-f="from" value="${f.from}"></label>
      <label class="small muted">au <input type="date" data-f="to" value="${f.to}"></label>
      ${isAgent ? '' : html`<select data-f="user_id"><option value="">Toute l'équipe</option>${users.map((u) => html`<option value="${u.id}">${u.name}</option>`)}</select>`}
    </div>
    <div class="card table-wrap" style="padding:0" id="entries"></div>`);

  async function load() {
    await renderClock($('#clock', el), load);
    const [entries, report] = await Promise.all([api.get(`/time${qs(f)}`), isAgent ? null : api.get(`/time/report${qs(f)}`)]);
    const total = entries.reduce((s, e) => s + (e.hours || 0), 0);
    $('#entries', el).innerHTML = str(entries.length ? html`<table class="t"><thead><tr>${isAgent ? '' : raw('<th>Intervenant</th>')}<th>Date</th><th>Arrivée</th><th>Sortie</th><th>Durée</th><th>Intervention</th><th>GPS</th>${isAgent ? '' : raw('<th></th>')}</tr></thead><tbody>
      ${entries.map((t) => html`<tr>${isAgent ? '' : html`<td class="bold">${t.user_name}</td>`}<td>${fdate(t.clock_in)}</td><td>${ftime(t.clock_in)}</td>
        <td>${t.clock_out ? ftime(t.clock_out) : html`<span class="tag ok">En cours</span>`}</td><td class="bold">${hours(t.hours)}</td>
        <td>${t.intervention_title ? html`${L.intType[t.intervention_type]?.[1] || ''} ${t.intervention_title}<div class="small muted">${t.property_name}</div>` : html`<span class="muted">—</span>`}${t.notes ? html`<div class="small muted">📝 ${t.notes}</div>` : ''}</td>
        <td>${t.lat_in ? html`<a target="_blank" rel="noopener" href="https://maps.google.com/?q=${t.lat_in},${t.lng_in}">📍</a>` : ''}</td>
        ${isAgent ? '' : html`<td class="r"><button class="sm ghost" data-edit="${t.id}">✏️</button></td>`}</tr>`)}
      <tr><td colspan="${isAgent ? 3 : 4}" class="r bold">Total</td><td class="bold">${hours(total)}</td><td colspan="3"></td></tr></tbody></table>` : html`<div class="empty">Aucun pointage sur la période</div>`);
    if (report) {
      $('#report', el).innerHTML = str(report.length ? html`<table class="t"><thead><tr><th>Intervenant</th><th class="r">Heures</th><th class="r">Interv.</th><th class="r">Coût</th></tr></thead>
        ${report.map((r) => html`<tr><td>${r.user_name}</td><td class="r bold">${hours(r.hours)}</td><td class="r">${r.interventions}</td><td class="r">${money(r.cost)}</td></tr>`)}</table>` : html`<div class="empty">Aucune donnée</div>`);
    }
    el._entries = entries;
  }

  on(el, 'change', '[data-f]', (e, i) => { f[i.dataset.f] = i.value; load(); });
  on(el, 'click', '[data-csv]', (e) => { e.preventDefault(); location.href = `/api/time/export.csv${qs(f)}`; });
  const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() + 4 * 3600000).toISOString().slice(0, 16) : '');
  const fromLocal = (v) => (v ? `${v}:00+04:00` : null);
  const entryForm = (t = {}) => formModal({
    title: t.id ? 'Modifier le pointage' : 'Saisie manuelle',
    values: { ...t, clock_in: toLocal(t.clock_in || new Date().toISOString()), clock_out: toLocal(t.clock_out) },
    specs: [
      ...(t.id ? [] : [{ name: 'user_id', label: 'Intervenant', type: 'select', required: true, options: users.map((u) => [u.id, u.name]) }]),
      { name: 'clock_in', label: 'Début', type: 'datetime-local', required: true },
      { name: 'clock_out', label: 'Fin', type: 'datetime-local' },
      { name: 'notes', label: 'Note', type: 'textarea', full: true, rows: 2 },
    ],
    onDelete: t.id ? async () => { await api.del(`/time/${t.id}`); load(); } : null,
    onSubmit: async (d) => {
      d.clock_in = fromLocal(d.clock_in); d.clock_out = fromLocal(d.clock_out);
      if (t.id) await api.put(`/time/${t.id}`, d); else await api.post('/time', { ...d, user_id: Number(d.user_id) });
      load();
    },
  });
  on(el, 'click', '[data-add]', () => entryForm());
  on(el, 'click', '[data-edit]', (e, b) => entryForm(el._entries.find((t) => t.id === Number(b.dataset.edit))));
  await load();
}

