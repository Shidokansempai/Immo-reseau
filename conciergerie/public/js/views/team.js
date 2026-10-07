import { html, str, api, on, $, money, L, opts, formModal } from '../ui.js';
import { topbar } from '../app.js';

export default async function teamView(el) {
  const edit = (u = {}) => formModal({
    title: u.id ? u.name : 'Nouveau membre', values: u,
    specs: [
      { name: 'name', label: 'Nom', required: true },
      { name: 'email', label: 'E-mail (identifiant)', type: 'email', required: true },
      { name: 'role', label: 'Rôle', type: 'select', options: opts(L.role), default: 'agent', help: 'Agent : accès mobile à ses interventions et au pointage uniquement' },
      { name: 'phone', label: 'Téléphone', type: 'tel' },
      { name: 'hourly_rate', label: 'Taux horaire (€)', type: 'money', default: 0 },
      { name: 'color', label: 'Couleur', type: 'color', default: '#0e7490' },
      { name: 'password', label: u.id ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe', type: 'password', required: !u.id },
      ...(u.id ? [{ name: 'active', label: 'Compte actif', type: 'checkbox' }] : []),
    ],
    onSubmit: async (d) => {
      if (!d.password) delete d.password;
      if (u.id) await api.put(`/users/${u.id}`, d); else await api.post('/users', d);
      load();
    },
  });

  async function load() {
    const users = await api.get('/users');
    el._list = users;
    $('#list', el).innerHTML = str(html`<table class="t"><thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Téléphone</th><th class="r">Taux horaire</th><th>Statut</th></tr></thead><tbody>
      ${users.map((u) => html`<tr class="click" data-id="${u.id}"><td class="bold"><span class="dot" style="background:${u.color || '#999'}"></span> ${u.name}</td><td>${u.email}</td>
        <td>${L.role[u.role]}</td><td>${u.phone || ''}</td><td class="r">${money(u.hourly_rate)}</td><td>${u.active ? html`<span class="tag ok">Actif</span>` : html`<span class="tag">Désactivé</span>`}</td></tr>`)}
      </tbody></table>`);
  }

  el.innerHTML = str(html`${topbar('Équipe', html`<button class="primary" data-new>+ Ajouter un membre</button>`)}
    <div class="card table-wrap" style="padding:0" id="list"></div>
    <p class="small muted">Les agents de terrain se connectent depuis leur smartphone : ils voient leurs interventions du jour (adresse, code d'accès, check-list) et pointent leur arrivée / départ (avec géolocalisation si autorisée).</p>`);
  on(el, 'click', '[data-new]', () => edit());
  on(el, 'click', 'tr[data-id]', (e, tr) => edit(el._list.find((u) => u.id === Number(tr.dataset.id))));
  await load();
}
