'use strict';
// Owners, properties, guests, team, calendar, dashboard and settings.
const crypto = require('node:crypto');
const express = require('express');
const { crudRouter, HttpError, pick, findOwned } = require('./crud');
const { hashPassword } = require('../auth');
const { today, addDays, diffDays, isDay } = require('../lib/dates');
const { syncPropertyCalendar } = require('../lib/scheduler');
const { deliver, smtpConfig } = require('../lib/mailer');

const PROPERTY_FIELDS = ['owner_id', 'name', 'type', 'address', 'city', 'capacity', 'bedrooms', 'wifi_name', 'wifi_password',
  'keybox_code', 'checkin_time', 'checkout_time', 'access_instructions', 'house_rules', 'parking_info', 'cleaning_fee',
  'cleaning_duration_min', 'cleaning_cost', 'commission_rate', 'auto_checkin', 'auto_checkout', 'auto_cleaning', 'ical_url', 'color', 'active'];

const ORG_FIELDS = ['name', 'legal_form', 'siret', 'vat_number', 'address', 'email', 'phone', 'website', 'iban', 'vat_rate',
  'invoice_prefix', 'next_invoice_number', 'payment_terms_days', 'invoice_footer', 'tz_offset',
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from'];

module.exports = function coreRoutes(db) {
  const r = express.Router();
  const staffOnly = (req, res, next) => (req.user.role === 'agent' ? res.status(403).json({ error: 'Accès réservé' }) : next());
  const adminOnly = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Réservé aux administrateurs' }));

  r.use('/owners', staffOnly, crudRouter(db, {
    table: 'owners', fields: ['name', 'email', 'phone', 'address', 'iban', 'notes'], required: ['name'],
    orderBy: 'name', search: ['name', 'email', 'phone'],
  }));

  r.use('/guests', staffOnly, crudRouter(db, {
    table: 'guests', fields: ['first_name', 'last_name', 'email', 'phone', 'language', 'notes'], required: ['first_name'],
    orderBy: 'id DESC', search: ['first_name', 'last_name', 'email', 'phone'],
  }));

  // Agents need the list of properties (access codes) for their interventions.
  r.post('/properties/:id/ical-sync', staffOnly, async (req, res) => {
    const p = findOwned(db, 'properties', req.params.id, req.orgId);
    if (!p.ical_url) throw new HttpError(400, 'Aucune URL iCal configurée pour ce logement');
    try {
      res.json(await syncPropertyCalendar(db, p));
    } catch (e) {
      throw new HttpError(502, `Synchronisation impossible : ${e.message}`);
    }
  });
  r.post('/properties/:id/ical-token', staffOnly, (req, res) => {
    const p = findOwned(db, 'properties', req.params.id, req.orgId);
    const token = crypto.randomBytes(18).toString('base64url');
    db.update('properties', { ical_token: token }, { id: p.id });
    res.json({ ical_token: token });
  });
  r.use('/properties', crudRouter(db, {
    table: 'properties', fields: PROPERTY_FIELDS, required: ['name'], orderBy: 'active DESC, name',
    refs: { owner_id: 'owners' }, search: ['name', 'city', 'address'],
    defaults: () => ({ ical_token: crypto.randomBytes(18).toString('base64url') }),
    validate(d) {
      for (const f of ['checkin_time', 'checkout_time']) if (f in d && !/^\d{2}:\d{2}$/.test(d[f] || '')) throw new HttpError(400, 'Heure invalide (HH:MM)');
      if ('commission_rate' in d && (d.commission_rate < 0 || d.commission_rate > 100)) throw new HttpError(400, 'Commission entre 0 et 100 %');
      if (d.ical_url && !/^https?:\/\//i.test(d.ical_url)) throw new HttpError(400, 'URL iCal invalide');
    },
  }));

  // ---------- Team ----------
  r.get('/users', (req, res) => {
    res.json(db.all('SELECT id, name, email, role, phone, hourly_rate, color, active, created_at FROM users WHERE org_id = ? ORDER BY active DESC, name', req.orgId));
  });
  r.post('/users', adminOnly, (req, res) => {
    const d = pick(req.body, ['name', 'email', 'role', 'phone', 'hourly_rate', 'color', 'password']);
    if (!d.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) throw new HttpError(400, 'Nom et e-mail valides requis');
    if (String(d.password || '').length < 8) throw new HttpError(400, 'Mot de passe : 8 caractères minimum');
    if (!['admin', 'manager', 'agent'].includes(d.role || 'agent')) throw new HttpError(400, 'Rôle invalide');
    if (db.get('SELECT id FROM users WHERE email = ?', d.email)) throw new HttpError(409, 'E-mail déjà utilisé');
    const { password, ...rest } = d;
    const id = db.insert('users', { ...rest, role: d.role || 'agent', org_id: req.orgId, password_hash: hashPassword(password) });
    res.status(201).json(db.get('SELECT id, name, email, role, phone, hourly_rate, color, active FROM users WHERE id = ?', id));
  });
  r.put('/users/:id', adminOnly, (req, res) => {
    const u = findOwned(db, 'users', req.params.id, req.orgId);
    const d = pick(req.body, ['name', 'email', 'role', 'phone', 'hourly_rate', 'color', 'active', 'password']);
    if ('role' in d && !['admin', 'manager', 'agent'].includes(d.role)) throw new HttpError(400, 'Rôle invalide');
    if (u.id === req.user.id && (d.role && d.role !== 'admin' || d.active === 0 || d.active === false)) throw new HttpError(400, 'Vous ne pouvez pas retirer vos propres droits');
    if (d.email && db.get('SELECT id FROM users WHERE email = ? AND id != ?', d.email, u.id)) throw new HttpError(409, 'E-mail déjà utilisé');
    if (d.password) {
      if (String(d.password).length < 8) throw new HttpError(400, 'Mot de passe : 8 caractères minimum');
      d.password_hash = hashPassword(d.password);
      db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
    }
    delete d.password;
    if (d.active === 0 || d.active === false) db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
    db.update('users', d, { id: u.id });
    res.json(db.get('SELECT id, name, email, role, phone, hourly_rate, color, active FROM users WHERE id = ?', u.id));
  });

  // ---------- Calendar ----------
  r.get('/calendar', staffOnly, (req, res) => {
    const tz = db.get('SELECT tz_offset FROM organizations WHERE id = ?', req.orgId).tz_offset;
    const from = isDay(req.query.from) ? req.query.from : today(tz);
    const to = isDay(req.query.to) ? req.query.to : addDays(from, 30);
    res.json({
      from, to,
      properties: db.all('SELECT id, name, city, color FROM properties WHERE org_id = ? AND active = 1 ORDER BY name', req.orgId),
      bookings: db.all(`SELECT b.id, b.property_id, b.checkin_date, b.checkout_date, b.status, b.source, b.adults, b.children,
          g.first_name, g.last_name FROM bookings b LEFT JOIN guests g ON g.id = b.guest_id
        WHERE b.org_id = ? AND b.status != 'cancelled' AND b.checkout_date >= ? AND b.checkin_date <= ?`, req.orgId, from, to),
      interventions: db.all(`SELECT i.id, i.property_id, i.type, i.title, i.scheduled_date, i.scheduled_time, i.status, u.name AS assignee_name
        FROM interventions i LEFT JOIN users u ON u.id = i.assigned_to
        WHERE i.org_id = ? AND i.status != 'annulee' AND i.scheduled_date BETWEEN ? AND ?`, req.orgId, from, to),
    });
  });

  // ---------- Dashboard ----------
  r.get('/dashboard', staffOnly, (req, res) => {
    const o = req.orgId;
    const tz = db.get('SELECT tz_offset FROM organizations WHERE id = ?', o).tz_offset;
    const t = today(tz);
    const monthStart = `${t.slice(0, 8)}01`;
    const nextMonth = addDays(`${t.slice(0, 8)}28`, 4).slice(0, 8) + '01';
    const monthEnd = addDays(nextMonth, -1);
    const daysInMonth = diffDays(monthStart, nextMonth);

    const activeProps = db.get('SELECT COUNT(*) AS n FROM properties WHERE org_id = ? AND active = 1', o).n;
    // Booked nights inside the current month (clipped to the month).
    const nights = db.get(`SELECT COALESCE(SUM(julianday(MIN(checkout_date, ?)) - julianday(MAX(checkin_date, ?))), 0) AS n
      FROM bookings WHERE org_id = ? AND status IN ('confirmed','checked_in','checked_out') AND checkin_date < ? AND checkout_date > ?`,
    nextMonth, monthStart, o, nextMonth, monthStart).n;
    const revenue = db.get(`SELECT COALESCE(SUM(total_amount), 0) AS n FROM bookings WHERE org_id = ? AND status IN ('confirmed','checked_in','checked_out')
      AND checkin_date BETWEEN ? AND ?`, o, monthStart, monthEnd).n;
    const commission = db.get(`SELECT COALESCE(SUM((b.total_amount - b.cleaning_fee - b.platform_fee - b.tourist_tax) * p.commission_rate / 100), 0) AS n
      FROM bookings b JOIN properties p ON p.id = b.property_id WHERE b.org_id = ? AND b.status IN ('confirmed','checked_in','checked_out')
      AND b.checkout_date BETWEEN ? AND ?`, o, monthStart, monthEnd).n;
    const unpaid = db.get("SELECT COUNT(*) AS n, COALESCE(SUM(total_ttc), 0) AS total FROM invoices WHERE org_id = ? AND status = 'issued'", o);

    const bookingSel = `SELECT b.id, b.checkin_date, b.checkout_date, b.status, b.adults, b.children, b.arrival_time, b.source,
      p.name AS property_name, p.checkin_time, p.checkout_time, g.first_name, g.last_name, g.phone
      FROM bookings b JOIN properties p ON p.id = b.property_id LEFT JOIN guests g ON g.id = b.guest_id`;
    res.json({
      today: t,
      kpi: {
        properties: activeProps,
        occupancy: activeProps ? Math.round((nights / (activeProps * daysInMonth)) * 100) : 0,
        revenue_month: Math.round(revenue * 100) / 100,
        commission_month: Math.round(commission * 100) / 100,
        unpaid_count: unpaid.n, unpaid_total: unpaid.total,
        in_house: db.get("SELECT COUNT(*) AS n FROM bookings WHERE org_id = ? AND status IN ('confirmed','checked_in') AND checkin_date <= ? AND checkout_date > ?", o, t, t).n,
        unread: db.get("SELECT COUNT(*) AS n FROM messages WHERE org_id = ? AND direction = 'in' AND read = 0", o).n,
        failed_messages: db.get("SELECT COUNT(*) AS n FROM messages WHERE org_id = ? AND status = 'failed'", o).n,
      },
      arrivals: db.all(`${bookingSel} WHERE b.org_id = ? AND b.status NOT IN ('cancelled','blocked') AND b.checkin_date BETWEEN ? AND ? ORDER BY b.checkin_date, p.name`, o, t, addDays(t, 1)),
      departures: db.all(`${bookingSel} WHERE b.org_id = ? AND b.status NOT IN ('cancelled','blocked') AND b.checkout_date BETWEEN ? AND ? ORDER BY b.checkout_date, p.name`, o, t, addDays(t, 1)),
      interventions: db.all(`SELECT i.*, p.name AS property_name, u.name AS assignee_name FROM interventions i
        JOIN properties p ON p.id = i.property_id LEFT JOIN users u ON u.id = i.assigned_to
        WHERE i.org_id = ? AND i.status IN ('a_faire','en_cours') AND i.scheduled_date <= ? ORDER BY i.scheduled_date, i.scheduled_time LIMIT 30`, o, addDays(t, 1)),
      unassigned: db.get("SELECT COUNT(*) AS n FROM interventions WHERE org_id = ? AND status = 'a_faire' AND assigned_to IS NULL AND scheduled_date >= ?", o, t).n,
      upcoming_messages: db.all(`SELECT m.id, m.subject, m.scheduled_at, m.channel, g.first_name, g.last_name FROM messages m LEFT JOIN guests g ON g.id = m.guest_id
        WHERE m.org_id = ? AND m.status = 'scheduled' ORDER BY m.scheduled_at LIMIT 8`, o),
      on_duty: db.all(`SELECT u.name, t.clock_in, i.title FROM time_entries t JOIN users u ON u.id = t.user_id LEFT JOIN interventions i ON i.id = t.intervention_id
        WHERE t.org_id = ? AND t.clock_out IS NULL`, o),
    });
  });

  // ---------- Settings ----------
  r.get('/settings', adminOnly, (req, res) => {
    const o = db.get('SELECT * FROM organizations WHERE id = ?', req.orgId);
    res.json({ ...o, smtp_pass: o.smtp_pass ? '••••••••' : null, smtp_env: Boolean(process.env.SMTP_HOST) });
  });
  r.put('/settings', adminOnly, (req, res) => {
    const d = pick(req.body, ORG_FIELDS);
    if (d.smtp_pass === '••••••••') delete d.smtp_pass;
    if ('name' in d && !String(d.name || '').trim()) throw new HttpError(400, 'Nom obligatoire');
    if ('tz_offset' in d && !/^[+-]\d{2}:\d{2}$/.test(d.tz_offset || '')) throw new HttpError(400, 'Fuseau invalide (ex : +04:00)');
    if ('vat_rate' in d && (Number(d.vat_rate) < 0 || Number(d.vat_rate) > 30)) throw new HttpError(400, 'Taux de TVA invalide');
    db.update('organizations', d, { id: req.orgId });
    res.json({ ok: true });
  });
  r.post('/settings/test-email', adminOnly, async (req, res) => {
    const o = db.get('SELECT * FROM organizations WHERE id = ?', req.orgId);
    if (!smtpConfig(o)) throw new HttpError(400, 'Aucun serveur SMTP configuré');
    try {
      await deliver(o, { channel: 'email', recipient: req.body.to || req.user.email, subject: 'Test d\'envoi – conciergerie', body: 'La configuration e-mail fonctionne 👍' });
    } catch (e) {
      throw new HttpError(502, `Échec SMTP : ${e.message}`);
    }
    res.json({ ok: true });
  });

  return r;
};
