'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db');
const { render, buildContext } = require('../src/lib/templates');
const { computeTotals } = require('../src/lib/invoicing');
const ical = require('../src/lib/ical');
const { localToUtc, today, addDays, frLong } = require('../src/lib/dates');
const { onBookingChanged, templateSendDay } = require('../src/lib/automation');
const { createDefaultTemplates } = require('../src/defaults');

test('dates: Réunion offset and helpers', () => {
  assert.equal(localToUtc('2026-10-07', '10:00', '+04:00'), '2026-10-07T06:00:00.000Z');
  assert.equal(today('+04:00', new Date('2026-10-07T21:30:00Z')), '2026-10-08');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(frLong('2026-10-09'), 'vendredi 9 octobre 2026');
});

test('templates: variables are rendered, unknown ones kept', () => {
  const ctx = buildContext({
    booking: { id: 7, checkin_date: '2026-10-09', checkout_date: '2026-10-12', adults: 2, children: 1 },
    guest: { first_name: 'Marie' }, property: { name: 'Villa Lagon', keybox_code: '1974', checkin_time: '16:00' }, org: { name: 'Kaz' },
  });
  assert.equal(render('Bonjour {{prenom}}, code {{ code_boite }}, {{nuits}} nuits, {{inconnu}}', ctx), 'Bonjour Marie, code 1974, 3 nuits, {{inconnu}}');
  assert.equal(ctx.voyageurs, 3);
  assert.equal(ctx.reference, 'R00007');
});

test('invoicing: totals with mixed VAT rates', () => {
  const t = computeTotals([
    { description: 'Commission', quantity: 1, unit_price: 100, vat_rate: 8.5 },
    { description: 'Hébergement', quantity: 3, unit_price: 50, vat_rate: 0 },
  ]);
  assert.equal(t.total_ht, 250);
  assert.equal(t.total_vat, 8.5);
  assert.equal(t.total_ttc, 258.5);
});

test('ical: parse Airbnb feed and build export', () => {
  const feed = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261010\r\nDTEND;VALUE=DATE:20261015\r\nUID:abc@airbnb.com\r\nSUMMARY:Reserved\r\nDESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC123\\nPhone: 0000\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261020\r\nDTEND;VALUE=DATE:20261022\r\nUID:blk@airbnb.com\r\nSUMMARY:Airbnb (Not available)\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const ev = ical.parse(feed);
  assert.equal(ev.length, 2);
  assert.deepEqual([ev[0].start, ev[0].end, ev[0].uid], ['2026-10-10', '2026-10-15', 'abc@airbnb.com']);
  assert.equal(ical.isBlock(ev[1]), true);
  assert.equal(ical.detectSource('https://www.airbnb.fr/calendar/ical/1.ics'), 'airbnb');
  const out = ical.build({ property: { name: 'X' }, bookings: [{ id: 1, checkin_date: '2026-10-10', checkout_date: '2026-10-12', status: 'confirmed' }] });
  assert.match(out, /DTSTART;VALUE=DATE:20261010/);
});

test('automation: booking creates interventions and scheduled messages', () => {
  const db = open(':memory:');
  const orgId = db.insert('organizations', { name: 'Test' });
  createDefaultTemplates(db, orgId);
  const pid = db.insert('properties', { org_id: orgId, name: 'Case', cleaning_fee: 50 });
  const gid = db.insert('guests', { org_id: orgId, first_name: 'Ana', email: 'ana@example.com' });
  const bid = db.insert('bookings', { org_id: orgId, property_id: pid, guest_id: gid, checkin_date: '2026-11-10', checkout_date: '2026-11-15' });
  const now = new Date('2026-10-01T08:00:00Z');
  onBookingChanged(db, bid, now);

  const ints = db.all('SELECT type, scheduled_date FROM interventions WHERE booking_id = ? ORDER BY type', bid);
  assert.deepEqual(ints.map((i) => i.type), ['checkin', 'checkout', 'menage']);
  const msgs = db.all("SELECT subject, scheduled_at FROM messages WHERE booking_id = ? AND status = 'scheduled' ORDER BY scheduled_at", bid);
  assert.equal(msgs.length, 6); // 6 automatic French templates
  assert.equal(msgs[1].scheduled_at, '2026-11-08T06:00:00.000Z'); // J-2 at 10:00 Réunion
  assert.match(msgs[2].subject, /Bienvenue à Case/);

  // Date change re-schedules, cancellation cancels pending interventions.
  db.update('bookings', { checkin_date: '2026-11-12' }, { id: bid });
  onBookingChanged(db, bid, now);
  assert.equal(db.get("SELECT scheduled_date FROM interventions WHERE booking_id = ? AND type = 'checkin'", bid).scheduled_date, '2026-11-12');
  db.update('bookings', { status: 'cancelled' }, { id: bid });
  onBookingChanged(db, bid, now);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM interventions WHERE booking_id = ? AND status = 'a_faire'", bid).n, 0);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM messages WHERE booking_id = ? AND status = 'scheduled'", bid).n, 0);
  db.close();
});

test('automation: past welcome messages are not sent after the stay', () => {
  assert.equal(templateSendDay({ trigger: 'before_checkin', offset_days: 3 }, { checkin_date: '2026-10-10' }), '2026-10-07');
  assert.equal(templateSendDay({ trigger: 'manual' }, {}), undefined);
  const db = open(':memory:');
  const orgId = db.insert('organizations', { name: 'Test' });
  createDefaultTemplates(db, orgId);
  const pid = db.insert('properties', { org_id: orgId, name: 'Case' });
  const gid = db.insert('guests', { org_id: orgId, first_name: 'Ana', email: 'a@b.c' });
  const bid = db.insert('bookings', { org_id: orgId, property_id: pid, guest_id: gid, checkin_date: '2026-09-01', checkout_date: '2026-09-05' });
  onBookingChanged(db, bid, new Date('2026-10-01T08:00:00Z'));
  assert.equal(db.get('SELECT COUNT(*) AS n FROM messages WHERE booking_id = ?', bid).n, 0);
  db.close();
});
