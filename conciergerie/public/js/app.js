import { html, str, api, $, on, toast, L } from './ui.js';

const NAV = [
  { sep: 'Pilotage' },
  { path: '/', label: 'Tableau de bord', icon: '📊', roles: ['admin', 'manager'] },
  { path: '/calendrier', label: 'Calendrier', icon: '📅', roles: ['admin', 'manager'] },
  { path: '/reservations', label: 'Réservations', icon: '🧳', roles: ['admin', 'manager'] },
  { path: '/messagerie', label: 'Messagerie', icon: '💬', roles: ['admin', 'manager'], badge: 'unread' },
  { sep: 'Terrain' },
  { path: '/mes-interventions', label: 'Mes interventions', icon: '📋', roles: ['agent'] },
  { path: '/interventions', label: 'Interventions', icon: '🧹', roles: ['admin', 'manager'] },
  { path: '/pointage', label: 'Pointage', icon: '⏱️', roles: ['admin', 'manager', 'agent'] },
  { sep: 'Gestion', roles: ['admin', 'manager'] },
  { path: '/logements', label: 'Logements', icon: '🏠', roles: ['admin', 'manager'] },
  { path: '/proprietaires', label: 'Propriétaires', icon: '👤', roles: ['admin', 'manager'] },
  { path: '/voyageurs', label: 'Voyageurs', icon: '🌍', roles: ['admin', 'manager'] },
  { path: '/factures', label: 'Facturation', icon: '🧾', roles: ['admin', 'manager'] },
  { path: '/modeles', label: 'Messages types', icon: '✉️', roles: ['admin', 'manager'] },
  { sep: 'Administration', roles: ['admin'] },
  { path: '/equipe', label: 'Équipe', icon: '👥', roles: ['admin'] },
  { path: '/parametres', label: 'Paramètres', icon: '⚙️', roles: ['admin'] },
];

const ROUTES = [
  ['/', () => import('./views/dashboard.js')],
  ['/calendrier', () => import('./views/calendar.js')],
  ['/reservations', () => import('./views/bookings.js')],
  ['/reservations/:id', () => import('./views/booking.js')],
  ['/messagerie', () => import('./views/messages.js')],
  ['/messagerie/:id', () => import('./views/messages.js')],
  ['/interventions', () => import('./views/interventions.js')],
  ['/mes-interventions', () => import('./views/agent.js')],
  ['/pointage', () => import('./views/time.js')],
  ['/logements', () => import('./views/properties.js')],
  ['/proprietaires', () => import('./views/owners.js')],
  ['/voyageurs', () => import('./views/guests.js')],
  ['/factures', () => import('./views/invoices.js')],
  ['/modeles', () => import('./views/templates.js')],
  ['/equipe', () => import('./views/team.js')],
  ['/parametres', () => import('./views/settings.js')],
];

const state = { me: null, badges: {} };

function match(path) {
  for (const [pattern, loader] of ROUTES) {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    const m = re.exec(path);
    if (m) return { loader, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export function go(path) { location.hash = `#${path}`; }

function layout() {
  const { user, org } = state.me;
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  // Drop section titles that have no visible item after them.
  const nav = items.filter((n, i) => !n.sep || (items[i + 1] && !items[i + 1].sep));
  return html`<div class="layout">
    <aside class="side" id="side">
      <div class="logo">🌴<div>${org.name}<small>Conciergerie · La Réunion</small></div></div>
      <nav class="nav">${nav.map((n) => (n.sep ? html`<div class="sep">${n.sep}</div>`
        : html`<a href="#${n.path}" data-path="${n.path}"><span>${n.icon}</span>${n.label}${n.badge ? html`<span class="badge" data-badge="${n.badge}" hidden></span>` : ''}</a>`))}</nav>
      <div class="user-box">${user.name}<br><span style="color:#8fc3cf">${L.role[user.role]}</span><br>
        <button class="sm" data-logout>Se déconnecter</button></div>
    </aside>
    <main class="main" id="view"></main>
  </div>`;
}

async function refreshBadges() {
  if (!state.me || state.me.user.role === 'agent') return;
  try {
    const d = await api.get('/dashboard');
    const el = document.querySelector('[data-badge=unread]');
    if (el) { el.textContent = d.kpi.unread; el.hidden = !d.kpi.unread; }
  } catch { /* ignore */ }
}

async function render() {
  const path = location.hash.slice(1) || '/';
  if (path === '/login' || path === '/inscription') {
    state.me = null;
    const { renderAuth } = await import('./views/auth.js');
    return renderAuth($('#app'), path === '/inscription', boot);
  }
  if (!state.me) return boot();

  const isAgent = state.me.user.role === 'agent';
  if (isAgent && !['/mes-interventions', '/pointage'].includes(path.split('?')[0])) return go('/mes-interventions');
  if (!$('#view')) {
    $('#app').innerHTML = str(layout());
    refreshBadges();
  }
  const base = path.split('?')[0];
  for (const a of document.querySelectorAll('.nav a')) {
    const p = a.dataset.path;
    a.classList.toggle('active', p === base || (p !== '/' && base.startsWith(`${p}/`)));
  }
  const m = match(base);
  // Fresh container on each navigation so view-level listeners never pile up.
  const view = document.createElement('main');
  view.className = 'main';
  view.id = 'view';
  $('#view').replaceWith(view);
  if (!m) { view.innerHTML = '<div class="empty">Page introuvable</div>'; return; }
  view.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const mod = await m.loader();
    const query = Object.fromEntries(new URLSearchParams(path.split('?')[1] || ''));
    await mod.default(view, { me: state.me, params: m.params, query, go, refreshBadges });
  } catch (e) {
    console.error(e);
    view.innerHTML = str(html`<div class="card"><h2>Oups</h2><p class="muted">${e.message}</p></div>`);
  }
}

/** Top bar shared by views (title + actions + mobile menu button). */
export function topbar(title, actions = '') {
  return html`<div class="topbar"><div class="row"><button class="burger ghost" onclick="document.getElementById('side').classList.toggle('open')">☰</button><h1>${title}</h1></div><div class="actions">${actions}</div></div>`;
}

async function boot() {
  try {
    state.me = await api.get('/auth/me');
  } catch {
    state.me = null;
    if (!['#/login', '#/inscription'].includes(location.hash)) location.hash = '#/login';
    return render();
  }
  if (['#/login', '#/inscription', ''].includes(location.hash)) {
    location.hash = state.me.user.role === 'agent' ? '#/mes-interventions' : '#/';
  }
  $('#app').innerHTML = '';
  return render();
}

on(document, 'click', '[data-logout]', async () => { await api.post('/auth/logout').catch(() => {}); state.me = null; go('/login'); });
on(document, 'click', '.nav a', () => $('#side')?.classList.remove('open'));
setInterval(refreshBadges, 60000);
window.addEventListener('hashchange', render);
window.addEventListener('unhandledrejection', (e) => { if (e.reason?.message && !e.reason.handled) console.warn(e.reason); });
boot().catch((e) => toast(e.message, true));
