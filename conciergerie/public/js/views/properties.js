import { html, str, api, on, $, money, formModal, attempt, toast, fdatetime } from '../ui.js';
import { topbar } from '../app.js';

export default async function propertiesView(el) {
  async function edit(p = {}) {
    const owners = await api.get('/owners');
    const m = formModal({
      title: p.id ? p.name : 'Nouveau logement', wide: true, values: p,
      specs: [
        { type: 'section', label: 'Logement' },
        { name: 'name', label: 'Nom', required: true },
        { name: 'type', label: 'Type', type: 'select', options: ['Appartement', 'Studio', 'Maison', 'Villa', 'Case créole', 'Gîte', 'Bungalow', 'Chambre d\'hôtes'].map((x) => [x, x]), default: 'Appartement' },
        { name: 'owner_id', label: 'Propriétaire', type: 'select', options: [['', '— Aucun —'], ...owners.map((o) => [o.id, o.name])] },
        { name: 'color', label: 'Couleur (calendrier)', type: 'color', default: '#5fa090' },
        { name: 'address', label: 'Adresse', full: true },
        { name: 'city', label: 'Commune', placeholder: 'Saint-Gilles-les-Bains' },
        { name: 'capacity', label: 'Capacité (pers.)', type: 'number', default: 2 },
        { name: 'bedrooms', label: 'Chambres', type: 'number', default: 1 },
        { name: 'active', label: 'Logement actif', type: 'checkbox', default: 1 },
        { type: 'section', label: 'Accueil & accès (utilisés dans les messages)' },
        { name: 'checkin_time', label: 'Arrivée à partir de', type: 'time', default: '16:00' },
        { name: 'checkout_time', label: 'Départ avant', type: 'time', default: '10:00' },
        { name: 'keybox_code', label: 'Code boîte à clés' },
        { name: 'parking_info', label: 'Parking' },
        { name: 'wifi_name', label: 'Wi-Fi (réseau)' },
        { name: 'wifi_password', label: 'Wi-Fi (mot de passe)' },
        { name: 'access_instructions', label: 'Instructions d\'accès', type: 'textarea', full: true, rows: 3 },
        { name: 'house_rules', label: 'Règlement intérieur', type: 'textarea', full: true, rows: 2 },
        { type: 'section', label: 'Gestion & tarifs' },
        { name: 'commission_rate', label: 'Commission de gestion (%)', type: 'number', step: '0.1', default: 20 },
        { name: 'cleaning_fee', label: 'Frais de ménage facturés (€ TTC)', type: 'money', default: 0 },
        { name: 'cleaning_duration_min', label: 'Durée du ménage (min)', type: 'number', default: 120 },
        { name: 'cleaning_cost', label: 'Coût interne du ménage (€)', type: 'money', default: 0 },
        { name: 'auto_checkin', label: 'Créer automatiquement l\'accueil', type: 'checkbox', default: 1 },
        { name: 'auto_checkout', label: 'Créer automatiquement l\'état des lieux de sortie', type: 'checkbox', default: 1 },
        { name: 'auto_cleaning', label: 'Créer automatiquement le ménage', type: 'checkbox', default: 1 },
        { type: 'section', label: 'Synchronisation calendrier' },
        { name: 'ical_url', label: 'URL iCal à importer (Airbnb, Booking, Abritel…)', full: true, placeholder: 'https://www.airbnb.fr/calendar/ical/....ics' },
      ],
      extra: p.ical_token ? html`<div class="card" style="background:#f9fafb;margin-top:12px"><div class="small bold">Lien iCal d'export (à coller dans Airbnb / Booking pour bloquer vos réservations directes) :</div>
        <div class="row" style="margin-top:6px"><input readonly value="${location.origin}/ical/${p.ical_token}.ics" data-ical><button type="button" class="sm" data-copy>Copier</button></div>
        ${p.ical_last_sync ? html`<div class="small muted" style="margin-top:6px">Dernier import : ${fdatetime(p.ical_last_sync)}</div>` : ''}</div>` : '',
      onDelete: p.id ? async () => { await api.del(`/properties/${p.id}`); load(); } : null,
      onSubmit: async (d) => {
        d.owner_id = d.owner_id ? Number(d.owner_id) : null;
        if (p.id) await api.put(`/properties/${p.id}`, d); else await api.post('/properties', d);
        load();
      },
    });
    $('[data-copy]', m.el)?.addEventListener('click', () => {
      const i = $('[data-ical]', m.el);
      i.select();
      navigator.clipboard?.writeText(i.value);
      toast('Lien copié');
    });
  }

  async function load() {
    const list = await api.get('/properties');
    const owners = Object.fromEntries((await api.get('/owners')).map((o) => [o.id, o.name]));
    el._list = list;
    $('#list', el).innerHTML = str(list.length ? html`<div class="grid g3">${list.map((p) => html`<div class="card" style="border-top:4px solid ${p.color};${p.active ? '' : 'opacity:.6'}">
      <div class="row between"><h3 style="margin:0">${p.name}</h3><span class="tag">${p.type || ''}</span></div>
      <div class="small muted">${[p.address, p.city].filter(Boolean).join(', ')}</div>
      <div class="small" style="margin-top:8px">👥 ${p.capacity} pers. · 🛏 ${p.bedrooms} ch. · 🕓 ${p.checkin_time} / ${p.checkout_time}</div>
      <div class="small">👤 ${owners[p.owner_id] || html`<span class="muted">Sans propriétaire</span>`} · Commission ${p.commission_rate} % · Ménage ${money(p.cleaning_fee)}</div>
      <div class="small">🔑 ${p.keybox_code || '—'} · 📶 ${p.wifi_name || '—'}</div>
      <div class="row" style="margin-top:10px"><button class="sm" data-edit="${p.id}">✏️ Modifier</button>
        <a class="btn sm" href="#/calendrier">📅</a>
        ${p.ical_url ? html`<button class="sm" data-sync="${p.id}">↻ Importer iCal</button>` : ''}</div></div>`)}</div>`
      : html`<div class="card empty">Aucun logement. Commencez par en ajouter un !</div>`);
  }

  el.innerHTML = str(html`${topbar('Logements', html`<button class="primary" data-new>+ Nouveau logement</button>`)}<div id="list"></div>`);
  on(el, 'click', '[data-new]', () => edit());
  on(el, 'click', '[data-edit]', (e, b) => edit(el._list.find((p) => p.id === Number(b.dataset.edit))));
  on(el, 'click', '[data-sync]', async (e, b) => {
    b.disabled = true;
    try {
      const r = await attempt(() => api.post(`/properties/${b.dataset.sync}/ical-sync`));
      toast(`Import terminé : ${r.created} nouvelle(s), ${r.updated} modifiée(s), ${r.cancelled} annulée(s)`);
    } finally { b.disabled = false; }
  });
  await load();
}
