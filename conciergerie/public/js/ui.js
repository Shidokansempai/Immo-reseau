// UI helpers: safe HTML templating, API calls, modals, forms and formatters.

const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: String(s ?? '') });

export function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function val(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(val).join('');
  if (typeof v === 'object' && RAW in v) return v[RAW];
  return esc(v);
}

/** Tagged template: interpolations are escaped unless wrapped with raw() or nested html``. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += val(v) + strings[i + 1]; });
  return raw(out);
}
export const str = (h) => (h && typeof h === 'object' && RAW in h ? h[RAW] : val(h));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Delegated event binding: on(root, 'click', '[data-x]', (e, el) => ...) */
export function on(root, type, selector, fn) {
  root.addEventListener(type, (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) fn(e, el);
  });
}

// ---------- API ----------
export async function api(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    location.hash = '#/login';
    throw new Error('Session expirée, reconnectez-vous');
  }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || `Erreur ${res.status}`);
  return data;
}
api.get = (p) => api('GET', p);
api.post = (p, b = {}) => api('POST', p, b);
api.put = (p, b) => api('PUT', p, b);
api.del = (p) => api('DELETE', p);

export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== '' && v != null) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ---------- Toasts & modals ----------
export function toast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = `toast${isErr ? ' err' : ''}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), isErr ? 6000 : 3500);
}

/** Runs an async action and reports errors with a toast. */
export async function attempt(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    return r;
  } catch (e) {
    toast(e.message, true);
    throw e;
  }
}

export function modal({ title, body, wide = false, actions = [], onClose }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = str(html`<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <header><h2 style="margin:0">${title}</h2><button class="ghost" data-close aria-label="Fermer">✕</button></header>
    <div class="content">${body}</div>
    ${actions.length ? html`<footer>${actions.map((a, i) => html`<button class="${a.cls || ''}" data-act="${i}">${a.label}</button>`)}</footer>` : ''}
  </div>`);
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  on(bg, 'click', '[data-close]', close);
  on(bg, 'click', '[data-act]', async (e, el) => {
    const a = actions[Number(el.dataset.act)];
    el.disabled = true;
    try { if ((await a.onClick?.(bg, close)) !== false && !a.keepOpen) close(); }
    catch (err) { if (err && err.message) toast(err.message, true); }
    finally { el.disabled = false; }
  });
  $('#modal-root').append(bg);
  setTimeout(() => $('input:not([type=hidden]),select,textarea', bg)?.focus(), 30);
  return { el: bg, close };
}

/** Shows an HTML document served by the API (e.g. a printable invoice) in a modal. */
export async function showDocument(path, title) {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin' });
  const text = await res.text();
  if (!res.ok) throw new Error('Document indisponible');
  modal({ title, wide: true, body: html`<iframe class="doc-frame" title="${title}" srcdoc="${text}"></iframe>` });
}

/** Downloads a file served by the API. */
export async function download(path, filename) {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Téléchargement impossible');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob());
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function confirmDialog(message, label = 'Confirmer', cls = 'primary') {
  return new Promise((resolve) => {
    modal({ title: 'Confirmation', body: html`<p>${message}</p>`, onClose: () => resolve(false), actions: [
      { label: 'Annuler', onClick: () => resolve(false) },
      { label, cls, onClick: () => resolve(true) },
    ] });
  });
}

// ---------- Forms ----------
/**
 * Field spec: {name, label, type, options:[[value,label]], full, required, step, placeholder, help, rows}
 */
export function fields(specs, values = {}) {
  return html`<div class="form-grid">${specs.map((f) => {
    if (f.type === 'section') return html`<div class="full" style="margin-top:6px"><h3 style="margin:0;color:var(--brand)">${f.label}</h3></div>`;
    const v = values[f.name] ?? f.default ?? '';
    const common = html`name="${f.name}" data-type="${f.type || 'text'}" ${raw(f.required ? 'required' : '')} placeholder="${f.placeholder || ''}"`;
    let input;
    if (f.type === 'select') {
      input = html`<select ${common}>${(f.options || []).map(([ov, ol]) => html`<option value="${ov}" ${raw(String(ov) === String(v ?? '') ? 'selected' : '')}>${ol}</option>`)}</select>`;
    } else if (f.type === 'textarea') {
      input = html`<textarea ${common} rows="${f.rows || 4}">${v}</textarea>`;
    } else if (f.type === 'checkbox') {
      return html`<label class="check ${f.full ? 'full' : ''}"><input type="checkbox" name="${f.name}" data-type="checkbox" ${raw(v && v !== '0' ? 'checked' : '')}> ${f.label}</label>`;
    } else {
      input = html`<input type="${f.type === 'money' ? 'number' : (f.type || 'text')}" ${common} value="${v}" ${raw(f.step || f.type === 'money' ? `step="${f.step || '0.01'}"` : '')}>`;
    }
    return html`<label class="f ${f.full ? 'full' : ''}">${f.label}${f.required ? ' *' : ''}${input}${f.help ? html`<span class="small muted" style="font-weight:400">${f.help}</span>` : ''}</label>`;
  })}</div>`;
}

/** Reads named inputs of a container into an object with typed values. */
export function readForm(root) {
  const out = {};
  for (const el of $$('[name]', root)) {
    const t = el.dataset.type;
    if (t === 'checkbox') out[el.name] = el.checked ? 1 : 0;
    else if (t === 'number' || t === 'money') out[el.name] = el.value === '' ? null : Number(el.value);
    else if (t === 'ref') out[el.name] = el.value === '' ? null : Number(el.value);
    else out[el.name] = el.value.trim() === '' ? null : el.value;
  }
  return out;
}

/** Opens a form in a modal; resolves after a successful onSubmit. */
export function formModal({ title, specs, values = {}, submitLabel = 'Enregistrer', onSubmit, wide, extra, onDelete }) {
  const actions = [];
  if (onDelete) actions.push({ label: 'Supprimer', cls: 'danger', onClick: async () => {
    if (!(await confirmDialog('Supprimer définitivement cet élément ?', 'Supprimer', 'danger'))) return false;
    await attempt(onDelete, 'Supprimé');
  } });
  actions.push({ label: 'Annuler' });
  actions.push({ label: submitLabel, cls: 'primary', onClick: async (el) => {
    const form = $('form', el);
    if (!form.reportValidity()) return false;
    await attempt(() => onSubmit(readForm(form), el), 'Enregistré');
  } });
  return modal({ title, wide, body: html`<form onsubmit="return false">${fields(specs, values)}${extra || ''}</form>`, actions });
}

// ---------- Formatters ----------
const TZ = 'Indian/Reunion';
export const money = (n) => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
export function fdate(s, opts = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (!s) return '';
  const d = s.length === 10 ? new Date(`${s}T12:00:00Z`) : new Date(s);
  return d.toLocaleDateString('fr-FR', { timeZone: s.length === 10 ? 'UTC' : TZ, ...opts });
}
export const fday = (s) => fdate(s, { weekday: 'short', day: 'numeric', month: 'short' });
export const fdatetime = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
export const ftime = (iso) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '');
export function hours(h) {
  if (h == null) return '—';
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

/** Today's date in La Réunion as YYYY-MM-DD. */
export function today(offsetDays = 0) {
  const d = new Date(Date.now() + 4 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}
export function addDays(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const nights = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
export const guestName = (o) => [o.first_name, o.last_name].filter(Boolean).join(' ') || '—';

// ---------- Labels ----------
export const L = {
  bookingStatus: { confirmed: ['Confirmée', 'info'], checked_in: ['En séjour', 'ok'], checked_out: ['Terminée', ''], cancelled: ['Annulée', 'err'], blocked: ['Bloquée', 'warn'] },
  source: { direct: 'Direct', airbnb: 'Airbnb', booking: 'Booking.com', abritel: 'Abritel / Vrbo', gites_de_france: 'Gîtes de France', ical: 'iCal', autre: 'Autre' },
  intType: { checkin: ['Accueil', '🔑'], checkout: ['Sortie', '🚪'], menage: ['Ménage', '🧹'], linge: ['Linge', '🧺'], maintenance: ['Maintenance', '🔧'], inspection: ['Contrôle', '🔍'], autre: ['Autre', '📌'] },
  intStatus: { a_faire: ['À faire', 'warn'], en_cours: ['En cours', 'info'], terminee: ['Terminée', 'ok'], annulee: ['Annulée', ''] },
  msgStatus: { draft: ['Brouillon', ''], scheduled: ['Programmé', 'warn'], sent: ['Envoyé', 'ok'], simulated: ['Simulé', 'info'], failed: ['Échec', 'err'], cancelled: ['Annulé', ''], received: ['Reçu', 'brand'] },
  trigger: {
    booking_confirmed: 'À la confirmation', before_checkin: 'Avant l\'arrivée (J-x)', checkin_day: 'Jour de l\'arrivée',
    during_stay: 'Pendant le séjour (J+x)', before_checkout: 'Avant le départ (J-x)', checkout_day: 'Jour du départ',
    after_checkout: 'Après le départ (J+x)', manual: 'Manuel (message type)',
  },
  channel: { email: '✉️ E-mail', sms: '📱 SMS', whatsapp: '💬 WhatsApp' },
  invStatus: { draft: ['Brouillon', ''], issued: ['Émise', 'warn'], paid: ['Payée', 'ok'], cancelled: ['Annulée', 'err'] },
  invKind: { owner: 'Propriétaire', guest: 'Voyageur', other: 'Autre' },
  role: { admin: 'Administrateur', manager: 'Gestionnaire', agent: 'Agent de terrain' },
};
export const tag = (map, key) => {
  const [label, cls] = map[key] || [key, ''];
  return html`<span class="tag ${cls}">${label}</span>`;
};
export const opts = (map) => Object.entries(map).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]);
