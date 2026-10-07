import { html, str, api, on, $, formModal, today, addDays, toast } from '../ui.js';
import { topbar } from '../app.js';

/** Dialog generating the monthly owner statement invoice. */
export function ownerStatementDialog(owners, preset = {}, go) {
  const prevMonth = addDays(`${today().slice(0, 8)}01`, -1);
  formModal({
    title: 'Relevé de gestion propriétaire', submitLabel: 'Générer la facture',
    values: { owner_id: preset.owner_id, period_start: `${prevMonth.slice(0, 8)}01`, period_end: prevMonth },
    specs: [
      { name: 'owner_id', label: 'Propriétaire', type: 'select', required: true, full: true, options: [['', '— Choisir —'], ...owners.map((o) => [o.id, o.name])] },
      { name: 'period_start', label: 'Du', type: 'date', required: true },
      { name: 'period_end', label: 'Au', type: 'date', required: true },
    ],
    extra: html`<p class="small muted">Inclut : commission de gestion sur les séjours terminés dans la période, forfaits ménage et interventions refacturables terminées. La facture est créée en brouillon pour relecture.</p>`,
    onSubmit: async (d) => {
      const inv = await api.post('/invoices/owner-statement', { ...d, owner_id: Number(d.owner_id) });
      toast(`${inv.summary.bookings} séjour(s) – revenus nets ${inv.summary.rental_income.toFixed(2)} €`);
      go(`/factures?id=${inv.id}`);
    },
  });
}

export default async function ownersView(el, { go }) {
  const edit = (o = {}) => formModal({
    title: o.id ? o.name : 'Nouveau propriétaire', values: o,
    specs: [
      { name: 'name', label: 'Nom / Raison sociale', required: true, full: true },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'phone', label: 'Téléphone', type: 'tel' },
      { name: 'address', label: 'Adresse de facturation', type: 'textarea', full: true, rows: 2 },
      { name: 'iban', label: 'IBAN (reversement des loyers)', full: true },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 },
    ],
    onDelete: o.id ? async () => { await api.del(`/owners/${o.id}`); load(); } : null,
    onSubmit: async (d) => { if (o.id) await api.put(`/owners/${o.id}`, d); else await api.post('/owners', d); load(); },
  });

  async function load() {
    const [owners, props] = await Promise.all([api.get('/owners'), api.get('/properties')]);
    el._list = owners;
    $('#list', el).innerHTML = str(owners.length ? html`<table class="t"><thead><tr><th>Propriétaire</th><th>Contact</th><th>Logements</th><th></th></tr></thead><tbody>
      ${owners.map((o) => {
        const mine = props.filter((p) => p.owner_id === o.id);
        return html`<tr><td class="bold"><a href="#" data-edit="${o.id}">${o.name}</a></td><td class="small">${o.email || ''}<br>${o.phone || ''}</td>
          <td class="small">${mine.length ? mine.map((p) => html`<div><span class="dot" style="background:${p.color}"></span> ${p.name}</div>`) : html`<span class="muted">—</span>`}</td>
          <td class="r"><button class="sm" data-statement="${o.id}">🧾 Relevé mensuel</button></td></tr>`;
      })}</tbody></table>` : html`<div class="empty">Aucun propriétaire</div>`);
  }

  el.innerHTML = str(html`${topbar('Propriétaires', html`<button class="primary" data-new>+ Nouveau propriétaire</button>`)}<div class="card table-wrap" style="padding:0" id="list"></div>`);
  on(el, 'click', '[data-new]', () => edit());
  on(el, 'click', '[data-edit]', (e, a) => { e.preventDefault(); edit(el._list.find((o) => o.id === Number(a.dataset.edit))); });
  on(el, 'click', '[data-statement]', (e, b) => ownerStatementDialog(el._list, { owner_id: Number(b.dataset.statement) }, go));
  await load();
}
