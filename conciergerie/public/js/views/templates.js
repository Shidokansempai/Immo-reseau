import { html, str, api, on, $, L, opts, formModal, attempt } from '../ui.js';
import { topbar } from '../app.js';

const ORDER = Object.keys(L.trigger);

function when(t) {
  const n = t.offset_days;
  const d = {
    booking_confirmed: 'Dès la réservation',
    before_checkin: `${n || 1} jour(s) avant l'arrivée à ${t.send_time}`,
    checkin_day: `Le jour de l'arrivée à ${t.send_time}`,
    during_stay: `${n || 1} jour(s) après l'arrivée à ${t.send_time}`,
    before_checkout: `${n || 1} jour(s) avant le départ à ${t.send_time}`,
    checkout_day: `Le jour du départ à ${t.send_time}`,
    after_checkout: `${n || 1} jour(s) après le départ à ${t.send_time}`,
    manual: 'Envoi manuel depuis la messagerie',
  };
  return d[t.trigger];
}

export default async function templatesView(el) {
  const vars = await api.get('/templates/variables');

  function edit(t = {}) {
    const m = formModal({
      title: t.id ? `Message type – ${t.name}` : 'Nouveau message type', wide: true, values: t,
      specs: [
        { name: 'name', label: 'Nom', required: true, full: true },
        { name: 'trigger', label: 'Déclencheur', type: 'select', options: opts(L.trigger), default: 'manual' },
        { name: 'offset_days', label: 'Décalage (jours)', type: 'number', default: 1, help: 'Pour J-x / J+x' },
        { name: 'send_time', label: 'Heure d\'envoi (heure de La Réunion)', type: 'time', default: '10:00' },
        { name: 'channel', label: 'Canal', type: 'select', options: opts(L.channel), default: 'email' },
        { name: 'language', label: 'Langue', type: 'select', options: [['fr', 'Français'], ['en', 'English'], ['de', 'Deutsch']], default: 'fr', help: 'Envoyé aux voyageurs de cette langue (sinon version française)' },
        { name: 'active', label: 'Actif (envoi automatique)', type: 'checkbox', default: 1 },
        { name: 'subject', label: 'Objet', full: true },
        { name: 'body', label: 'Message', type: 'textarea', rows: 14, full: true, required: true },
      ],
      extra: html`<div style="margin-top:12px"><div class="small muted bold">Cliquez sur une variable pour l'insérer :</div>
        <div class="row" style="gap:6px;margin-top:6px">${Object.entries(vars).map(([k, d]) => html`<button type="button" class="sm" data-var="${k}" title="${d}">{{${k}}}</button>`)}</div>
        <div class="row" style="margin-top:10px"><button type="button" class="sm" data-preview>👁 Aperçu avec un exemple</button></div>
        <div id="pv" class="card" style="background:#f9fafb;margin-top:10px;display:none"></div></div>`,
      onDelete: t.id ? async () => { await api.del(`/templates/${t.id}`); load(); } : null,
      onSubmit: async (d) => {
        d.offset_days = d.offset_days || 0;
        if (t.id) await api.put(`/templates/${t.id}`, d); else await api.post('/templates', d);
        load();
      },
    });
    const body = $('[name=body]', m.el);
    let last = body;
    for (const f of [body, $('[name=subject]', m.el)]) f.addEventListener('focus', () => { last = f; });
    on(m.el, 'click', '[data-var]', (e, b) => {
      const v = `{{${b.dataset.var}}}`;
      const s = last.selectionStart ?? last.value.length;
      last.value = last.value.slice(0, s) + v + last.value.slice(last.selectionEnd ?? s);
      last.focus(); last.selectionStart = last.selectionEnd = s + v.length;
    });
    on(m.el, 'click', '[data-preview]', async () => {
      const p = await attempt(() => api.post('/templates/preview', { subject: $('[name=subject]', m.el).value, body: body.value }));
      const pv = $('#pv', m.el);
      pv.style.display = 'block';
      pv.innerHTML = str(html`<div class="bold">${p.subject}</div><pre class="body" style="margin-top:8px">${p.body}</pre>`);
    });
  }

  async function load() {
    const list = (await api.get('/templates')).sort((a, b) => ORDER.indexOf(a.trigger) - ORDER.indexOf(b.trigger) || a.offset_days - b.offset_days || a.sort_order - b.sort_order);
    const auto = list.filter((t) => t.trigger !== 'manual');
    const manual = list.filter((t) => t.trigger === 'manual');
    const row = (t) => html`<tr class="click" data-id="${t.id}">
      <td><div class="bold">${t.name}</div><div class="small muted">${t.subject || ''}</div></td>
      <td class="small">${when(t)}</td><td class="small">${L.channel[t.channel]}</td><td><span class="tag">${t.language.toUpperCase()}</span></td>
      <td><label class="check" data-stop><input type="checkbox" data-toggle="${t.id}" ${t.active ? 'checked' : ''}> ${t.active ? 'Actif' : 'Inactif'}</label></td>
      <td class="r"><button class="sm ghost" data-dup="${t.id}" title="Dupliquer">⧉</button></td></tr>`;
    $('#list', el).innerHTML = str(html`
      <div class="card"><h2>⚙️ Parcours automatique du voyageur</h2>
        <p class="small muted" style="margin-top:-6px">Ces messages sont programmés automatiquement à chaque nouvelle réservation (avec un e-mail ou un téléphone voyageur) et recalculés si les dates changent.</p>
        <div class="table-wrap"><table class="t">${auto.map(row)}</table></div></div>
      <div class="card"><h2>📝 Messages types (envoi manuel)</h2><div class="table-wrap"><table class="t">${manual.length ? manual.map(row) : html`<tr><td class="empty">Aucun</td></tr>`}</table></div></div>`);
    el._list = list;
  }

  el.innerHTML = str(html`${topbar('Messages types', html`<button class="primary" data-new>+ Nouveau message type</button>`)}<div id="list"></div>`);
  on(el, 'click', '[data-new]', () => edit());
  on(el, 'click', 'tr[data-id]', (e, tr) => { if (e.target.closest('[data-stop],[data-dup]')) return; edit(el._list.find((t) => t.id === Number(tr.dataset.id))); });
  on(el, 'change', '[data-toggle]', async (e, c) => { await attempt(() => api.put(`/templates/${c.dataset.toggle}`, { active: c.checked ? 1 : 0 }), c.checked ? 'Activé' : 'Désactivé'); load(); });
  on(el, 'click', '[data-dup]', async (e, b) => {
    const t = el._list.find((x) => x.id === Number(b.dataset.dup));
    const { id, org_id, created_at, ...rest } = t;
    await attempt(() => api.post('/templates', { ...rest, name: `${t.name} (copie)`, active: 0 }), 'Dupliqué');
    load();
  });
  await load();
}
