import { html, str, api, on, $, fdate, guestName, formModal, qs } from '../ui.js';
import { topbar } from '../app.js';

export default async function guestsView(el) {
  let q = '';
  const edit = (g = {}) => formModal({
    title: g.id ? guestName(g) : 'Nouveau voyageur', values: g,
    specs: [
      { name: 'first_name', label: 'Prénom', required: true },
      { name: 'last_name', label: 'Nom' },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'phone', label: 'Téléphone', type: 'tel' },
      { name: 'language', label: 'Langue', type: 'select', options: [['fr', 'Français'], ['en', 'English'], ['de', 'Deutsch']], default: 'fr' },
      { name: 'notes', label: 'Notes (préférences, allergies, VIP…)', type: 'textarea', full: true, rows: 3 },
    ],
    onDelete: g.id ? async () => { await api.del(`/guests/${g.id}`); load(); } : null,
    onSubmit: async (d) => { if (g.id) await api.put(`/guests/${g.id}`, d); else await api.post('/guests', d); load(); },
  });

  async function load() {
    const list = await api.get(`/guests${qs({ q })}`);
    el._list = list;
    $('#list', el).innerHTML = str(list.length ? html`<table class="t"><thead><tr><th>Voyageur</th><th>E-mail</th><th>Téléphone</th><th>Langue</th><th>Créé le</th></tr></thead><tbody>
      ${list.map((g) => html`<tr class="click" data-id="${g.id}"><td class="bold">${guestName(g)}</td><td>${g.email || ''}</td><td>${g.phone || ''}</td><td><span class="tag">${g.language}</span></td><td class="small muted">${fdate(g.created_at)}</td></tr>`)}
      </tbody></table>` : html`<div class="empty">Aucun voyageur</div>`);
  }

  el.innerHTML = str(html`${topbar('Voyageurs', html`<button class="primary" data-new>+ Nouveau voyageur</button>`)}
    <div class="filters"><input type="search" data-q placeholder="Rechercher nom, e-mail, téléphone…" style="min-width:280px"></div>
    <div class="card table-wrap" style="padding:0" id="list"></div>`);
  let timer;
  on(el, 'input', '[data-q]', (e, i) => { q = i.value; clearTimeout(timer); timer = setTimeout(load, 250); });
  on(el, 'click', '[data-new]', () => edit());
  on(el, 'click', 'tr[data-id]', (e, tr) => edit(el._list.find((g) => g.id === Number(tr.dataset.id))));
  await load();
}
