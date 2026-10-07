'use strict';
// Runs the real API routes inside the browser and answers fetch('/api/...').
const { Router } = require('express');
const { open } = require('../src/db');
const { authenticate } = require('../src/auth');
const { seed } = require('../src/seed');
const { sendDueMessages } = require('../src/lib/scheduler');

const DB_KEY = 'sakura-palm-demo-db';
const TOKEN_KEY = 'sakura-palm-demo-token';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
let memoryToken = null;

function loadBytes() {
  const b64 = store.get(DB_KEY);
  if (!b64) return null;
  try { return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); } catch { return null; }
}

function save() {
  const bytes = globalThis.__demoDb.export();
  globalThis.__demoDb.exec('PRAGMA foreign_keys = ON');
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  store.set(DB_KEY, btoa(s));
}

function start() {
  globalThis.__demoDbBytes = loadBytes();
  const fresh = !globalThis.__demoDbBytes;
  const db = open(':memory:');
  if (fresh) { seed(db); save(); }

  const api = Router();
  api.use('/auth', require('../src/routes/auth')(db, { allowSignup: true }));
  const authed = Router();
  authed.use(authenticate(db));
  authed.use('/bookings', require('../src/routes/bookings')(db));
  authed.use('/invoices', require('../src/routes/invoices')(db));
  authed.use(require('../src/routes/operations')(db));
  authed.use(require('../src/routes/messaging')(db));
  authed.use(require('../src/routes/core')(db));
  api.use(authed);

  async function handle(method, url, body) {
    const req = {
      method, path: url.pathname.slice(4) || '/', query: Object.fromEntries(url.searchParams), body: body || {},
      headers: { authorization: (store.get(TOKEN_KEY) || memoryToken) ? `Bearer ${store.get(TOKEN_KEY) || memoryToken}` : '' }, ip: 'demo', params: {},
    };
    const res = {
      statusCode: 200, headers: {}, body: '', finished: false,
      status(c) { this.statusCode = c; return this; },
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
      type(t) { this.headers['content-type'] = t === 'html' ? 'text/html; charset=utf-8' : t; return this; },
      json(o) { this.headers['content-type'] = 'application/json'; this.body = JSON.stringify(o); this.finished = true; return this; },
      send(s) { this.headers['content-type'] = this.headers['content-type'] || 'text/html; charset=utf-8'; this.body = String(s); this.finished = true; return this; },
    };
    await api(req, res, (err) => {
      if (!err) return res.status(404).json({ error: 'Route inconnue' });
      let status = err.status || 500;
      let message = err.message;
      if (/CHECK constraint|FOREIGN KEY|NOT NULL constraint/.test(message || '')) { status = 400; message = 'Valeur invalide ou manquante'; }
      if (status >= 500) { console.error(err); message = 'Erreur interne'; }
      return res.status(status).json({ error: message });
    });
    if (method !== 'GET') save();
    return res;
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const method = (init.method || 'GET').toUpperCase();
    let body;
    try { body = init.body ? JSON.parse(init.body) : undefined; } catch { body = undefined; }
    const res = await handle(method, url, body);
    if (res.statusCode < 400 && /\/api\/auth\/(login|register)$/.test(url.pathname)) {
      const { token } = JSON.parse(res.body);
      memoryToken = token;
      store.set(TOKEN_KEY, token);
    }
    if (url.pathname === '/api/auth/logout') { memoryToken = null; store.del(TOKEN_KEY); }
    return new Response(res.body, { status: res.statusCode, headers: { 'content-type': res.headers['content-type'] || 'text/plain' } });
  };

  setInterval(() => sendDueMessages(db).then((n) => { if (n) save(); }).catch(console.error), 30000);
  setTimeout(() => sendDueMessages(db).then(save).catch(console.error), 1500);
}

function reset() {
  store.del(DB_KEY);
  store.del(TOKEN_KEY);
  location.hash = '#/login';
  location.reload();
}

module.exports = { start, reset };
