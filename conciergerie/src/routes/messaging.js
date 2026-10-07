'use strict';
// Guest messaging: templates, conversation threads, outbox and scheduling.
const express = require('express');
const { HttpError, pick, findOwned, crudRouter } = require('./crud');
const { VARIABLES, buildContext, render } = require('../lib/templates');
const { loadBookingContext, scheduleMessages } = require('../lib/automation');
const { deliver } = require('../lib/mailer');

const TRIGGERS = ['booking_confirmed', 'before_checkin', 'checkin_day', 'during_stay', 'before_checkout', 'checkout_day', 'after_checkout', 'manual'];
const CHANNELS = ['email', 'sms', 'whatsapp'];

const M_SELECT = `
  SELECT m.*, g.first_name, g.last_name, b.checkin_date, b.checkout_date, b.status AS booking_status,
         p.name AS property_name, t.name AS template_name
  FROM messages m LEFT JOIN guests g ON g.id = m.guest_id LEFT JOIN bookings b ON b.id = m.booking_id
  LEFT JOIN properties p ON p.id = b.property_id LEFT JOIN message_templates t ON t.id = m.template_id`;

module.exports = function messagingRoutes(db) {
  const r = express.Router();
  const staffOnly = (req) => { if (req.user.role === 'agent') throw new HttpError(403, 'Accès réservé'); };

  // ---------- Templates ----------
  r.get('/templates/variables', (req, res) => res.json(VARIABLES));

  r.post('/templates/preview', (req, res) => {
    staffOnly(req);
    let { subject, body } = req.body || {};
    if (req.body.template_id) {
      const t = findOwned(db, 'message_templates', req.body.template_id, req.orgId);
      subject = subject ?? t.subject; body = body ?? t.body;
    }
    let ctx;
    if (req.body.booking_id) {
      findOwned(db, 'bookings', req.body.booking_id, req.orgId);
      ctx = buildContext(loadBookingContext(db, Number(req.body.booking_id)));
    } else {
      // Sample data so a template can be previewed without a booking.
      ctx = buildContext({
        booking: { id: 42, checkin_date: '2026-12-18', checkout_date: '2026-12-23', adults: 2, children: 1, total_amount: 650 },
        guest: { first_name: 'Marie', last_name: 'Payet' },
        property: { name: 'Villa Lagon', address: '12 rue des Filaos', city: 'Saint-Gilles-les-Bains', checkin_time: '16:00', checkout_time: '10:00', keybox_code: '1974', wifi_name: 'VillaLagon', wifi_password: 'soleil974', access_instructions: 'Portail bleu, boîte à clés à gauche de la porte.', parking_info: 'Place n°3 dans la cour', house_rules: 'Non-fumeur, pas de fête.' },
        org: db.get('SELECT * FROM organizations WHERE id = ?', req.orgId),
      });
    }
    res.json({ subject: render(subject, ctx), body: render(body, ctx) });
  });

  r.use('/templates', (req, res, next) => { staffOnly(req); next(); }, crudRouter(db, {
    table: 'message_templates',
    fields: ['name', 'trigger', 'offset_days', 'send_time', 'channel', 'language', 'subject', 'body', 'active', 'sort_order'],
    required: ['name', 'body'],
    orderBy: 'sort_order, id',
    validate(d) {
      if ('trigger' in d && !TRIGGERS.includes(d.trigger)) throw new HttpError(400, 'Déclencheur invalide');
      if ('channel' in d && !CHANNELS.includes(d.channel)) throw new HttpError(400, 'Canal invalide');
      if ('send_time' in d && !/^\d{2}:\d{2}$/.test(d.send_time || '')) throw new HttpError(400, 'Heure d\'envoi invalide (HH:MM)');
    },
  }));

  // ---------- Messages ----------
  r.get('/messages', (req, res) => {
    staffOnly(req);
    const where = ['m.org_id = ?'];
    const params = [req.orgId];
    if (req.query.status) { where.push('m.status = ?'); params.push(req.query.status); }
    if (req.query.booking_id) { where.push('m.booking_id = ?'); params.push(Number(req.query.booking_id)); }
    if (req.query.direction) { where.push('m.direction = ?'); params.push(req.query.direction); }
    const order = req.query.status === 'scheduled' ? 'm.scheduled_at ASC' : 'COALESCE(m.sent_at, m.scheduled_at, m.created_at) DESC';
    res.json(db.all(`${M_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 500`, ...params));
  });

  /** Conversations: one row per booking with the last message. */
  r.get('/messages/threads', (req, res) => {
    staffOnly(req);
    res.json(db.all(`
      SELECT b.id AS booking_id, b.checkin_date, b.checkout_date, b.status AS booking_status, p.name AS property_name,
             g.first_name, g.last_name, g.email, g.phone,
             (SELECT body FROM messages WHERE booking_id = b.id AND status NOT IN ('scheduled','cancelled','draft') ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1) AS last_body,
             (SELECT COALESCE(sent_at, created_at) FROM messages WHERE booking_id = b.id AND status NOT IN ('scheduled','cancelled','draft') ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1) AS last_at,
             (SELECT COUNT(*) FROM messages WHERE booking_id = b.id AND direction = 'in' AND read = 0) AS unread,
             (SELECT COUNT(*) FROM messages WHERE booking_id = b.id AND status = 'scheduled') AS scheduled
      FROM bookings b JOIN properties p ON p.id = b.property_id JOIN guests g ON g.id = b.guest_id
      WHERE b.org_id = ? AND b.status != 'blocked' AND b.checkout_date >= date('now', '-60 day')
      ORDER BY unread DESC, COALESCE(last_at, b.checkin_date) DESC LIMIT 300`, req.orgId));
  });

  /** Sends (or schedules) a manual message for a booking. */
  r.post('/messages', async (req, res) => {
    staffOnly(req);
    const data = pick(req.body, ['booking_id', 'template_id', 'channel', 'subject', 'body', 'scheduled_at', 'recipient']);
    if (!data.booking_id) throw new HttpError(400, 'Réservation obligatoire');
    findOwned(db, 'bookings', data.booking_id, req.orgId);
    const c = loadBookingContext(db, Number(data.booking_id));
    if (!c.booking.guest_id) throw new HttpError(400, 'Aucun voyageur rattaché à cette réservation');
    let { subject, body } = data;
    if (data.template_id) {
      const t = findOwned(db, 'message_templates', data.template_id, req.orgId);
      subject = subject || t.subject; body = body || t.body; data.channel = data.channel || t.channel;
    }
    if (!body || !String(body).trim()) throw new HttpError(400, 'Message vide');
    const channel = CHANNELS.includes(data.channel) ? data.channel : 'email';
    const ctx = buildContext(c);
    const msg = {
      org_id: req.orgId, booking_id: c.booking.id, guest_id: c.booking.guest_id, template_id: data.template_id || null,
      direction: 'out', channel, recipient: data.recipient || (channel === 'email' ? c.guest.email : c.guest.phone),
      subject: render(subject, ctx), body: render(body, ctx), created_by: req.user.id,
    };
    if (data.scheduled_at && new Date(data.scheduled_at) > new Date()) {
      const id = db.insert('messages', { ...msg, status: 'scheduled', scheduled_at: new Date(data.scheduled_at).toISOString() });
      return res.status(201).json(db.get(`${M_SELECT} WHERE m.id = ?`, id));
    }
    const id = db.insert('messages', { ...msg, status: 'draft' });
    await sendNow(id, req.orgId);
    res.status(201).json(db.get(`${M_SELECT} WHERE m.id = ?`, id));
  });

  async function sendNow(id, orgId) {
    const m = db.get('SELECT * FROM messages WHERE id = ?', id);
    const org = db.get('SELECT * FROM organizations WHERE id = ?', orgId);
    try {
      const out = await deliver(org, m);
      db.update('messages', { status: out.status, sent_at: new Date().toISOString(), error: out.info || null }, { id });
    } catch (e) {
      db.update('messages', { status: 'failed', error: String(e.message || e).slice(0, 500) }, { id });
    }
  }

  /** Records a message received from a guest (copied from Airbnb, WhatsApp, phone...). */
  r.post('/messages/inbound', (req, res) => {
    staffOnly(req);
    const { booking_id, body, channel = 'email' } = req.body || {};
    const b = findOwned(db, 'bookings', booking_id, req.orgId);
    if (!body || !String(body).trim()) throw new HttpError(400, 'Message vide');
    const id = db.insert('messages', { org_id: req.orgId, booking_id: b.id, guest_id: b.guest_id, direction: 'in',
      channel: CHANNELS.includes(channel) ? channel : 'email', body, status: 'received', sent_at: new Date().toISOString(), read: 0, created_by: req.user.id });
    res.status(201).json(db.get(`${M_SELECT} WHERE m.id = ?`, id));
  });

  r.post('/messages/mark-read', (req, res) => {
    staffOnly(req);
    findOwned(db, 'bookings', req.body.booking_id, req.orgId);
    db.run('UPDATE messages SET read = 1 WHERE booking_id = ? AND org_id = ?', Number(req.body.booking_id), req.orgId);
    res.json({ ok: true });
  });

  r.post('/messages/:id/send-now', async (req, res) => {
    staffOnly(req);
    const m = findOwned(db, 'messages', req.params.id, req.orgId);
    if (!['scheduled', 'failed', 'draft'].includes(m.status)) throw new HttpError(400, 'Ce message a déjà été envoyé');
    if (m.recipient == null && m.guest_id) {
      const g = db.get('SELECT email, phone FROM guests WHERE id = ?', m.guest_id);
      db.update('messages', { recipient: m.channel === 'email' ? g.email : g.phone }, { id: m.id });
    }
    await sendNow(m.id, req.orgId);
    res.json(db.get(`${M_SELECT} WHERE m.id = ?`, m.id));
  });

  r.put('/messages/:id', (req, res) => {
    staffOnly(req);
    const m = findOwned(db, 'messages', req.params.id, req.orgId);
    if (!['scheduled', 'draft', 'failed'].includes(m.status)) throw new HttpError(400, 'Message déjà envoyé');
    const data = pick(req.body, ['subject', 'body', 'scheduled_at', 'recipient']);
    if (data.scheduled_at) data.scheduled_at = new Date(data.scheduled_at).toISOString();
    db.update('messages', data, { id: m.id });
    res.json(db.get(`${M_SELECT} WHERE m.id = ?`, m.id));
  });

  r.post('/messages/:id/cancel', (req, res) => {
    staffOnly(req);
    const m = findOwned(db, 'messages', req.params.id, req.orgId);
    if (m.status !== 'scheduled') throw new HttpError(400, 'Seuls les messages programmés peuvent être annulés');
    db.update('messages', { status: 'cancelled' }, { id: m.id });
    res.json({ ok: true });
  });

  /** Rebuilds the automatic schedule of a booking (after template changes). */
  r.post('/messages/reschedule/:bookingId', (req, res) => {
    staffOnly(req);
    const b = findOwned(db, 'bookings', req.params.bookingId, req.orgId);
    res.json({ scheduled: scheduleMessages(db, b.id) });
  });

  return r;
};
