'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db');
const { createApp } = require('../src/app');
const { sendDueMessages } = require('../src/lib/scheduler');

let server; let base; let db;

test.before(async () => {
  delete process.env.SMTP_HOST;
  db = open(':memory:');
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.close(); db.close(); });

function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() };
  };
  return { get: (p) => call('GET', p), post: (p, b = {}) => call('POST', p, b), put: (p, b) => call('PUT', p, b), del: (p) => call('DELETE', p) };
}

const future = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test('full workflow: signup → property → booking → operations → billing', async () => {
  const a = client();
  assert.equal((await a.get('/api/dashboard')).status, 401);
  const reg = await a.post('/api/auth/register', { org_name: 'Conciergerie Test', name: 'Admin', email: 'admin@test.re', password: 'motdepasse' });
  assert.equal(reg.status, 201);
  assert.equal((await a.get('/api/templates')).body.length, 9);

  const owner = (await a.post('/api/owners', { name: 'SCI Test', email: 'sci@test.re' })).body;
  const prop = (await a.post('/api/properties', { name: 'Villa', owner_id: owner.id, cleaning_fee: 80, commission_rate: 20, keybox_code: '4242' })).body;
  assert.ok(prop.ical_token);

  const b = await a.post('/api/bookings', {
    property_id: prop.id, checkin_date: future(10), checkout_date: future(14), total_amount: 1000, platform_fee: 30,
    guest: { first_name: 'Léa', last_name: 'Hoarau', email: 'lea@example.com', language: 'fr' },
  });
  assert.equal(b.status, 201, JSON.stringify(b.body));
  assert.equal(b.body.cleaning_fee, 80);

  // Overlap is refused unless forced.
  const clash = await a.post('/api/bookings', { property_id: prop.id, checkin_date: future(12), checkout_date: future(16) });
  assert.equal(clash.status, 409);

  const detail = (await a.get(`/api/bookings/${b.body.id}`)).body;
  assert.equal(detail.interventions.length, 3);
  assert.ok(detail.messages.some((m) => m.status === 'scheduled' && m.body.includes('4242')));

  // The confirmation is due right away: the scheduler "sends" it (simulation mode without SMTP).
  await sendDueMessages(db);
  const after = (await a.get(`/api/bookings/${b.body.id}`)).body;
  assert.ok(after.messages.some((m) => m.status === 'simulated' && /confirmé/.test(m.subject)));

  // Manual message from a template with variables.
  const tpl = (await a.get('/api/templates')).body.find((t) => t.trigger === 'manual');
  const sent = await a.post('/api/messages', { booking_id: b.body.id, template_id: tpl.id });
  assert.equal(sent.status, 201);
  assert.match(sent.body.body, /Léa/);
  const inbound = await a.post('/api/messages/inbound', { booking_id: b.body.id, body: 'Merci !' });
  assert.equal(inbound.status, 201);
  assert.equal((await a.get('/api/dashboard')).body.kpi.unread, 1);

  // Field agent: sees only own interventions, can clock in/out.
  const agent = (await a.post('/api/users', { name: 'Agent', email: 'agent@test.re', password: 'motdepasse', role: 'agent', hourly_rate: 14 })).body;
  const menage = detail.interventions.find((i) => i.type === 'menage');
  await a.put(`/api/interventions/${menage.id}`, { assigned_to: agent.id });
  const g = client();
  await g.post('/api/auth/login', { email: 'agent@test.re', password: 'motdepasse' });
  assert.equal((await g.get('/api/interventions')).body.length, 1);
  assert.equal((await g.get('/api/invoices')).status, 403);
  assert.equal((await g.post('/api/bookings', {})).status, 403);
  const other = detail.interventions.find((i) => i.type === 'checkin');
  assert.equal((await g.put(`/api/interventions/${other.id}`, { status: 'terminee' })).status, 403);
  assert.equal((await g.post('/api/time/clock-in', { intervention_id: menage.id })).status, 201);
  assert.equal((await g.post('/api/time/clock-in', {})).status, 409);
  const out = await g.post('/api/time/clock-out', { complete: true, report: 'RAS' });
  assert.equal(out.status, 200);
  assert.equal((await a.get(`/api/interventions/${menage.id}`)).body.status, 'terminee');
  assert.equal((await a.get('/api/time/report')).body[0].user_name, 'Agent');
  assert.match((await a.get('/api/time/export.csv')).body, /Intervenant;Début/);

  // Owner statement for the stay period, then issue → sequential number.
  const st = await a.post('/api/invoices/owner-statement', { owner_id: owner.id, period_start: future(0), period_end: future(30) });
  assert.equal(st.status, 201, JSON.stringify(st.body));
  // Net rent = 1000 - 80 cleaning - 30 platform = 890 → 20 % = 178 HT
  assert.equal(st.body.lines[0].unit_price, 178);
  const issued = await a.post(`/api/invoices/${st.body.id}/issue`);
  assert.match(issued.body.number, /^FA-\d{4}-0001$/);
  assert.equal((await a.put(`/api/invoices/${st.body.id}`, { notes: 'x' })).status, 400);
  assert.equal((await a.post(`/api/invoices/${st.body.id}/pay`)).body.status, 'paid');
  const html = await a.get(`/api/invoices/${st.body.id}/print`);
  assert.match(html.body, /ACQUITTÉE/);

  // Public iCal export.
  const ics = await fetch(`${base}/ical/${prop.ical_token}.ics`).then((r) => r.text());
  assert.match(ics, /BEGIN:VEVENT/);

  // Cancelling stops scheduled messages.
  await a.post(`/api/bookings/${b.body.id}/status`, { status: 'cancelled' });
  const cancelled = (await a.get(`/api/bookings/${b.body.id}`)).body;
  assert.ok(!cancelled.messages.some((m) => m.status === 'scheduled'));
});

test('organisations are isolated from each other', async () => {
  const a = client();
  await a.post('/api/auth/register', { org_name: 'Org A', name: 'A', email: 'a@iso.re', password: 'motdepasse' });
  const prop = (await a.post('/api/properties', { name: 'Secret' })).body;
  const b = client();
  await b.post('/api/auth/register', { org_name: 'Org B', name: 'B', email: 'b@iso.re', password: 'motdepasse' });
  assert.equal((await b.get(`/api/properties/${prop.id}`)).status, 404);
  assert.equal((await b.post('/api/bookings', { property_id: prop.id, checkin_date: future(1), checkout_date: future(2) })).status, 404);
  assert.ok(!(await b.get('/api/properties')).body.some((p) => p.id === prop.id));
});

test('login errors and validation', async () => {
  const c = client();
  assert.equal((await c.post('/api/auth/login', { email: 'nobody@x.re', password: 'x' })).status, 401);
  assert.equal((await c.post('/api/auth/register', { org_name: 'X', name: 'X', email: 'bad', password: 'motdepasse' })).status, 400);
  await c.post('/api/auth/register', { org_name: 'V', name: 'V', email: 'v@val.re', password: 'motdepasse' });
  const p = (await c.post('/api/properties', { name: 'P' })).body;
  assert.equal((await c.post('/api/bookings', { property_id: p.id, checkin_date: future(5), checkout_date: future(3) })).status, 400);
  assert.equal((await c.post('/api/properties', { name: 'Q', checkin_time: '25h' })).status, 400);
});
