import { html, str, raw, api, on, $, $$, money, fdate, L, tag, opts, qs, modal, attempt, confirmDialog, fields, readForm, today, toast } from '../ui.js';
import { topbar } from '../app.js';
import { ownerStatementDialog } from './owners.js';

export default async function invoicesView(el, { query, me, go }) {
  const f = { status: '', kind: '' };
  const owners = await api.get('/owners');

  function lineRow(l = {}, vat = me.org.vat_rate) {
    return html`<tr data-line>
      <td><input data-l="description" value="${l.description || ''}" placeholder="Désignation"></td>
      <td style="width:80px"><input data-l="quantity" type="number" step="0.01" value="${l.quantity ?? 1}"></td>
      <td style="width:120px"><input data-l="unit_price" type="number" step="0.01" value="${l.unit_price ?? 0}"></td>
      <td style="width:90px"><input data-l="vat_rate" type="number" step="0.1" value="${l.vat_rate ?? vat}"></td>
      <td style="width:110px" class="r" data-total>${money((l.quantity ?? 1) * (l.unit_price ?? 0))}</td>
      <td style="width:36px"><button type="button" class="sm ghost danger" data-rm>✕</button></td></tr>`;
  }

  function readLines(root) {
    return $$('[data-line]', root).map((tr) => Object.fromEntries($$('[data-l]', tr).map((i) => [i.dataset.l, i.type === 'number' ? Number(i.value) : i.value])))
      .filter((l) => l.description || l.unit_price);
  }

  function recompute(root) {
    let ht = 0; let vat = 0;
    for (const tr of $$('[data-line]', root)) {
      const g = (k) => Number($(`[data-l=${k}]`, tr).value) || 0;
      const t = Math.round(g('quantity') * g('unit_price') * 100) / 100;
      $('[data-total]', tr).textContent = money(t);
      ht += t; vat += Math.round(t * g('vat_rate')) / 100;
    }
    $('[data-sum]', root).innerHTML = str(html`Total HT <b>${money(ht)}</b> · TVA <b>${money(vat)}</b> · Total TTC <b>${money(ht + vat)}</b>`);
  }

  async function open(id) {
    const inv = id ? await api.get(`/invoices/${id}`) : { kind: 'other', status: 'draft', issue_date: today(), lines: [] };
    const draft = inv.status === 'draft';
    const head = [
      { name: 'client_name', label: 'Client', required: true },
      { name: 'client_email', label: 'E-mail client', type: 'email' },
      { name: 'client_address', label: 'Adresse client', type: 'textarea', rows: 2, full: true },
      { name: 'kind', label: 'Type', type: 'select', options: opts(L.invKind) },
      { name: 'owner_id', label: 'Propriétaire lié', type: 'select', options: [['', '—'], ...owners.map((o) => [o.id, o.name])] },
      { name: 'issue_date', label: 'Date', type: 'date', required: true },
      { name: 'due_date', label: 'Échéance', type: 'date', help: 'Vide = délai par défaut' },
      { name: 'notes', label: 'Mentions / notes', type: 'textarea', rows: 2, full: true },
    ];
    const actions = [];
    if (id && draft) actions.push({ label: 'Supprimer', cls: 'danger', onClick: async () => { if (!(await confirmDialog('Supprimer ce brouillon ?', 'Supprimer', 'danger'))) return false; await api.del(`/invoices/${id}`); load(); } });
    if (id) actions.push({ label: '🖨️ Imprimer / PDF', keepOpen: true, onClick: () => { window.open(`/api/invoices/${id}/print`, '_blank'); } });
    if (inv.status === 'issued' || inv.status === 'paid') actions.push({ label: '✉️ Envoyer', keepOpen: true, onClick: async () => { const r = await attempt(() => api.post(`/invoices/${id}/email`)); toast(r.status === 'sent' ? 'Facture envoyée' : r.info); } });
    if (inv.status === 'issued') actions.push({ label: '💶 Marquer payée', cls: 'primary', onClick: async () => { await attempt(() => api.post(`/invoices/${id}/pay`), 'Facture payée'); load(); } });
    if (inv.status === 'issued' || inv.status === 'paid') actions.push({ label: 'Annuler la facture', cls: 'danger', onClick: async () => { if (!(await confirmDialog('Annuler cette facture ? (elle reste numérotée, pensez à émettre un avoir si besoin)', 'Annuler la facture', 'danger'))) return false; await api.post(`/invoices/${id}/cancel`); load(); } });
    if (draft) {
      const save = async (m) => {
        const form = $('form', m);
        if (!form.reportValidity()) throw new Error('Formulaire incomplet');
        const d = readForm(form);
        d.owner_id = d.owner_id ? Number(d.owner_id) : null;
        d.lines = readLines(m);
        return id ? api.put(`/invoices/${id}`, d) : api.post('/invoices', d);
      };
      actions.push({ label: 'Enregistrer le brouillon', onClick: async (m) => { await attempt(() => save(m), 'Brouillon enregistré'); load(); } });
      actions.push({ label: '✅ Émettre (numéroter)', cls: 'primary', onClick: async (m) => {
        const saved = await attempt(() => save(m));
        await attempt(() => api.post(`/invoices/${saved.id}/issue`), 'Facture émise');
        load();
      } });
    }

    const m = modal({
      wide: true,
      title: html`${inv.number ? `Facture ${inv.number}` : (id ? 'Facture – brouillon' : 'Nouvelle facture')} ${tag(L.invStatus, inv.status)}`,
      body: html`<form onsubmit="return false">${fields(head, inv)}</form>
        ${inv.period_start ? html`<p class="small muted">Période : ${fdate(inv.period_start)} → ${fdate(inv.period_end)}</p>` : ''}
        <h3 style="margin-top:16px">Lignes</h3>
        <div class="table-wrap"><table class="t"><thead><tr><th>Désignation</th><th>Qté</th><th>PU HT</th><th>TVA %</th><th class="r">Total HT</th><th></th></tr></thead>
        <tbody data-lines>${(inv.lines.length ? inv.lines : [{}]).map((l) => lineRow(l))}</tbody></table></div>
        ${draft ? html`<button type="button" class="sm" data-add style="margin-top:8px">+ Ligne</button>` : ''}
        <p class="r" data-sum style="text-align:right;margin-top:12px"></p>
        <p class="small muted">TVA La Réunion : taux normal 8,5 %, réduit 2,1 %. Les locations meublées de tourisme sans prestations para-hôtelières sont exonérées (0 %).</p>`,
      actions,
    });
    if (!draft) for (const i of $$('input,select,textarea', m.el)) i.disabled = true;
    else {
      on(m.el, 'click', '[data-add]', () => { $('[data-lines]', m.el).insertAdjacentHTML('beforeend', str(lineRow())); recompute(m.el); });
      on(m.el, 'click', '[data-rm]', (e, b) => { b.closest('tr').remove(); recompute(m.el); });
      on(m.el, 'input', '[data-l]', () => recompute(m.el));
    }
    recompute(m.el);
  }

  async function load() {
    const rows = await api.get(`/invoices${qs(f)}`);
    const sum = (s) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.total_ttc, 0);
    $('#sum', el).innerHTML = str(html`<div class="kpi"><div class="l">Brouillons</div><div class="v">${money(sum('draft'))}</div></div>
      <div class="kpi"><div class="l">À encaisser</div><div class="v">${money(sum('issued'))}</div><div class="small" style="color:var(--err)">${rows.filter((r) => r.overdue).length} en retard</div></div>
      <div class="kpi"><div class="l">Encaissé</div><div class="v">${money(sum('paid'))}</div></div>`);
    $('#list', el).innerHTML = str(rows.length ? html`<table class="t"><thead><tr><th>N°</th><th>Client</th><th>Type</th><th>Date</th><th>Échéance</th><th class="r">HT</th><th class="r">TTC</th><th>Statut</th></tr></thead><tbody>
      ${rows.map((i) => html`<tr class="click" data-id="${i.id}"><td class="bold">${i.number || html`<span class="muted">Brouillon</span>`}</td><td>${i.client_name}</td><td>${L.invKind[i.kind]}</td>
        <td>${fdate(i.issue_date)}</td><td>${fdate(i.due_date)} ${i.overdue ? raw('<span class="tag err">Retard</span>') : ''}</td><td class="r">${money(i.total_ht)}</td><td class="r bold">${money(i.total_ttc)}</td><td>${tag(L.invStatus, i.status)}</td></tr>`)}
      </tbody></table>` : html`<div class="empty">Aucune facture</div>`);
  }

  el.innerHTML = str(html`${topbar('Facturation', html`<button data-statement>🧾 Relevé propriétaire</button><button class="primary" data-new>+ Facture libre</button>`)}
    <div class="grid g3" id="sum" style="margin-bottom:16px"></div>
    <div class="filters"><select data-f="status"><option value="">Tous statuts</option>${opts(L.invStatus).map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>
      <select data-f="kind"><option value="">Tous types</option>${opts(L.invKind).map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select></div>
    <div class="card table-wrap" style="padding:0" id="list"></div>`);
  on(el, 'change', '[data-f]', (e, s) => { f[s.dataset.f] = s.value; load(); });
  on(el, 'click', 'tr[data-id]', (e, tr) => open(Number(tr.dataset.id)));
  on(el, 'click', '[data-new]', () => open(null));
  on(el, 'click', '[data-statement]', () => ownerStatementDialog(owners, {}, (p) => { go(p); }));
  await load();
  if (query.id) open(Number(query.id));
}
