import { html, str, api, on, $, money, fdate, L, opts, qs, today, addDays, formModal, attempt } from '../ui.js';
import { topbar } from '../app.js';

export async function openInterventionForm(values = {}, onSaved) {
  const [props, users] = await Promise.all([api.get('/properties'), api.get('/users')]);
  const isNew = !values.id;
  const checklist = values.checklist ? (() => { try { return JSON.parse(values.checklist).join('\n'); } catch { return ''; } })() : '';
  formModal({
    title: isNew ? 'Nouvelle intervention' : `Intervention – ${values.title}`, wide: true,
    values: { ...values, checklist_text: checklist },
    specs: [
      { name: 'type', label: 'Type', type: 'select', options: opts(L.intType), default: 'menage', required: true },
      { name: 'property_id', label: 'Logement', type: 'select', required: true, options: [['', '— Choisir —'], ...props.map((p) => [p.id, p.name])] },
      { name: 'title', label: 'Intitulé', full: true, placeholder: 'Laissez vide pour un intitulé automatique' },
      { name: 'scheduled_date', label: 'Date', type: 'date', required: true, default: today() },
      { name: 'scheduled_time', label: 'Heure', type: 'time' },
      { name: 'duration_min', label: 'Durée prévue (min)', type: 'number', default: 60 },
      { name: 'assigned_to', label: 'Intervenant', type: 'select', options: [['', '— Non assignée —'], ...users.filter((u) => u.active).map((u) => [u.id, `${u.name} (${L.role[u.role]})`])] },
      { name: 'status', label: 'Statut', type: 'select', options: opts(L.intStatus), default: 'a_faire' },
      { name: 'billable_amount', label: 'Montant refacturable au propriétaire (€ HT)', type: 'money', default: 0, help: 'Repris dans le relevé mensuel du propriétaire' },
      { name: 'checklist_text', label: 'Check-list (une tâche par ligne)', type: 'textarea', full: true, rows: 4 },
      { name: 'notes', label: 'Consignes pour l\'intervenant', type: 'textarea', full: true, rows: 2 },
      { name: 'report', label: 'Compte rendu', type: 'textarea', full: true, rows: 2 },
    ],
    onDelete: isNew ? null : async () => { await api.del(`/interventions/${values.id}`); onSaved?.(); },
    onSubmit: async (d) => {
      d.checklist = d.checklist_text ? d.checklist_text.split('\n').map((s) => s.trim()).filter(Boolean) : null;
      delete d.checklist_text;
      d.property_id = Number(d.property_id);
      d.assigned_to = d.assigned_to ? Number(d.assigned_to) : null;
      if (values.booking_id) d.booking_id = values.booking_id;
      if (!d.title) delete d.title;
      const r = isNew ? await api.post('/interventions', d) : await api.put(`/interventions/${values.id}`, d);
      onSaved?.(r);
    },
  });
}

export default async function interventions(el, { query }) {
  const [users, props] = await Promise.all([api.get('/users'), api.get('/properties')]);
  const f = { from: query.date || today(), to: query.date ? query.date : addDays(today(), 7), status: '', assigned_to: '', type: '', property_id: '' };
  el.innerHTML = str(html`
    ${topbar('Interventions & planning', html`<button class="primary" data-new>+ Intervention</button>`)}
    <div class="filters">
      <label class="small muted">Du <input type="date" data-f="from" value="${f.from}"></label>
      <label class="small muted">au <input type="date" data-f="to" value="${f.to}"></label>
      <select data-f="assigned_to"><option value="">Tous les intervenants</option><option value="none">Non assignées</option>${users.map((u) => html`<option value="${u.id}">${u.name}</option>`)}</select>
      <select data-f="type"><option value="">Tous types</option>${opts(L.intType).map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>
      <select data-f="status"><option value="">Tous statuts</option>${opts(L.intStatus).map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>
      <select data-f="property_id"><option value="">Tous logements</option>${props.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select>
    </div>
    <div id="list"></div>`);

  async function load() {
    const rows = await api.get(`/interventions${qs(f)}`);
    const byDay = new Map();
    for (const r of rows) byDay.set(r.scheduled_date, [...(byDay.get(r.scheduled_date) || []), r]);
    const userOpts = (sel) => html`<option value="">— Non assignée —</option>${users.filter((u) => u.active).map((u) => html`<option value="${u.id}" ${String(u.id) === String(sel ?? '') ? 'selected' : ''}>${u.name}</option>`)}`;
    $('#list', el).innerHTML = str(rows.length ? [...byDay.entries()].map(([day, list]) => html`
      <div class="card" style="padding:12px 0 4px"><h3 style="padding:0 16px">${fdate(day, { weekday: 'long', day: 'numeric', month: 'long' })} <span class="muted small">· ${list.length} intervention(s) · ${Math.round(list.reduce((s, i) => s + i.duration_min, 0) / 6) / 10} h</span></h3>
      <div class="table-wrap"><table class="t">${list.map((i) => html`<tr>
        <td style="width:62px" class="bold">${i.scheduled_time || '—'}</td>
        <td><span title="${L.intType[i.type][0]}">${L.intType[i.type][1]}</span> <a href="#" data-edit="${i.id}" class="bold">${i.title}</a>
          <div class="small muted"><span class="dot" style="background:${i.property_color}"></span> ${i.property_name}${i.property_city ? ` · ${i.property_city}` : ''}${i.booking_id ? html` · <a href="#/reservations/${i.booking_id}">réservation</a>` : ''}${i.billable_amount ? ` · ${money(i.billable_amount)}` : ''}</div></td>
        <td style="width:200px"><select class="sm" data-assign="${i.id}" style="${i.assigned_to ? '' : 'border-color:var(--err)'}">${userOpts(i.assigned_to)}</select></td>
        <td style="width:150px"><select data-status="${i.id}">${opts(L.intStatus).map(([v, l]) => html`<option value="${v}" ${v === i.status ? 'selected' : ''}>${l}</option>`)}</select></td>
      </tr>`)}</table></div></div>`) : html`<div class="card empty">Aucune intervention sur cette période</div>`);
  }

  on(el, 'change', '[data-f]', (e, i) => { f[i.dataset.f] = i.value; load(); });
  on(el, 'change', '[data-assign]', async (e, s) => { await attempt(() => api.put(`/interventions/${s.dataset.assign}`, { assigned_to: s.value ? Number(s.value) : null }), 'Intervenant assigné'); load(); });
  on(el, 'change', '[data-status]', async (e, s) => { await attempt(() => api.put(`/interventions/${s.dataset.status}`, { status: s.value }), 'Statut mis à jour'); });
  on(el, 'click', '[data-edit]', async (e, a) => { e.preventDefault(); openInterventionForm(await api.get(`/interventions/${a.dataset.edit}`), load); });
  on(el, 'click', '[data-new]', () => openInterventionForm({}, load));
  await load();
}

