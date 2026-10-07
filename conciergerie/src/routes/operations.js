'use strict';
// Interventions (planning terrain) and pointage (time tracking).
const express = require('express');
const { HttpError, pick, findOwned, assertRef } = require('./crud');
const { isDay, localToUtc, addDays } = require('../lib/dates');

const I_FIELDS = ['property_id', 'booking_id', 'type', 'title', 'scheduled_date', 'scheduled_time', 'duration_min',
  'assigned_to', 'status', 'billable_amount', 'checklist', 'notes', 'report'];
const TYPES = ['checkin', 'checkout', 'menage', 'linge', 'maintenance', 'inspection', 'autre'];
const STATUSES = ['a_faire', 'en_cours', 'terminee', 'annulee'];

const I_SELECT = `
  SELECT i.*, p.name AS property_name, p.address AS property_address, p.city AS property_city, p.keybox_code,
         p.color AS property_color, u.name AS assignee_name, u.color AS assignee_color,
         g.first_name, g.last_name, g.phone AS guest_phone, b.adults, b.children, b.arrival_time
  FROM interventions i JOIN properties p ON p.id = i.property_id
  LEFT JOIN users u ON u.id = i.assigned_to
  LEFT JOIN bookings b ON b.id = i.booking_id LEFT JOIN guests g ON g.id = b.guest_id`;

function hoursBetween(a, b) {
  return Math.max(0, (new Date(b) - new Date(a)) / 3600000);
}

module.exports = function operationsRoutes(db) {
  const r = express.Router();
  const isAgent = (req) => req.user.role === 'agent';

  function loadIntervention(req) {
    const i = findOwned(db, 'interventions', req.params.id, req.orgId);
    if (isAgent(req) && i.assigned_to !== req.user.id) throw new HttpError(403, 'Intervention non assignée à vous');
    return i;
  }

  // ---------- Interventions ----------
  r.get('/interventions', (req, res) => {
    const where = ['i.org_id = ?'];
    const params = [req.orgId];
    if (req.query.from) { where.push('i.scheduled_date >= ?'); params.push(req.query.from); }
    if (req.query.to) { where.push('i.scheduled_date <= ?'); params.push(req.query.to); }
    if (req.query.status) { where.push('i.status = ?'); params.push(req.query.status); }
    if (req.query.type) { where.push('i.type = ?'); params.push(req.query.type); }
    if (req.query.property_id) { where.push('i.property_id = ?'); params.push(Number(req.query.property_id)); }
    if (isAgent(req) || req.query.mine) { where.push('i.assigned_to = ?'); params.push(req.user.id); }
    else if (req.query.assigned_to === 'none') where.push('i.assigned_to IS NULL');
    else if (req.query.assigned_to) { where.push('i.assigned_to = ?'); params.push(Number(req.query.assigned_to)); }
    res.json(db.all(`${I_SELECT} WHERE ${where.join(' AND ')} ORDER BY i.scheduled_date, i.scheduled_time, i.id LIMIT 1000`, ...params));
  });

  r.get('/interventions/:id', (req, res) => {
    const i = loadIntervention(req);
    res.json({ ...db.get(`${I_SELECT} WHERE i.id = ?`, i.id), time_entries: db.all(
      'SELECT t.*, u.name AS user_name FROM time_entries t JOIN users u ON u.id = t.user_id WHERE t.intervention_id = ? ORDER BY t.clock_in', i.id) });
  });

  function validateIntervention(req, data, creating) {
    if (creating && !data.property_id) throw new HttpError(400, 'Logement obligatoire');
    if ('property_id' in data) assertRef(db, 'properties', data.property_id, req.orgId);
    if ('booking_id' in data) assertRef(db, 'bookings', data.booking_id, req.orgId);
    if ('assigned_to' in data && data.assigned_to) {
      if (!db.get('SELECT id FROM users WHERE id = ? AND org_id = ?', Number(data.assigned_to), req.orgId)) throw new HttpError(400, 'Intervenant inconnu');
    }
    if ((creating || 'type' in data) && !TYPES.includes(data.type)) throw new HttpError(400, 'Type d\'intervention invalide');
    if ((creating || 'scheduled_date' in data) && !isDay(data.scheduled_date)) throw new HttpError(400, 'Date invalide');
    if ('status' in data && !STATUSES.includes(data.status)) throw new HttpError(400, 'Statut invalide');
    if (Array.isArray(data.checklist)) data.checklist = JSON.stringify(data.checklist);
    if (creating && !data.title) data.title = { checkin: 'Accueil voyageur', checkout: 'État des lieux de sortie', menage: 'Ménage', linge: 'Gestion du linge', maintenance: 'Maintenance', inspection: 'Contrôle qualité', autre: 'Intervention' }[data.type];
  }

  r.post('/interventions', (req, res) => {
    if (isAgent(req)) throw new HttpError(403, 'Accès réservé');
    const data = pick(req.body, I_FIELDS);
    validateIntervention(req, data, true);
    const id = db.insert('interventions', { ...data, org_id: req.orgId, auto: 0 });
    res.status(201).json(db.get(`${I_SELECT} WHERE i.id = ?`, id));
  });

  r.put('/interventions/:id', (req, res) => {
    const i = loadIntervention(req);
    // Field agents may only update the report / checklist / status of their own jobs.
    const data = pick(req.body, isAgent(req) ? ['status', 'report', 'checklist', 'notes'] : I_FIELDS);
    validateIntervention(req, data, false);
    if (data.status === 'terminee' && i.status !== 'terminee') data.completed_at = new Date().toISOString();
    db.update('interventions', data, { id: i.id });
    res.json(db.get(`${I_SELECT} WHERE i.id = ?`, i.id));
  });

  r.delete('/interventions/:id', (req, res) => {
    if (isAgent(req)) throw new HttpError(403, 'Accès réservé');
    const i = loadIntervention(req);
    db.run('DELETE FROM interventions WHERE id = ?', i.id);
    res.json({ ok: true });
  });

  // ---------- Pointage ----------
  const openEntry = (userId) => db.get(`SELECT t.*, i.title AS intervention_title, p.name AS property_name
    FROM time_entries t LEFT JOIN interventions i ON i.id = t.intervention_id LEFT JOIN properties p ON p.id = i.property_id
    WHERE t.user_id = ? AND t.clock_out IS NULL ORDER BY t.clock_in DESC LIMIT 1`, userId);

  r.get('/time/current', (req, res) => res.json(openEntry(req.user.id) || null));

  r.post('/time/clock-in', (req, res) => {
    if (openEntry(req.user.id)) throw new HttpError(409, 'Vous avez déjà un pointage en cours');
    let interventionId = req.body.intervention_id || null;
    if (interventionId) {
      req.params.id = interventionId;
      const i = loadIntervention(req);
      interventionId = i.id;
      if (i.status === 'a_faire') db.update('interventions', { status: 'en_cours' }, { id: i.id });
      if (!i.assigned_to) db.update('interventions', { assigned_to: req.user.id }, { id: i.id });
    }
    const id = db.insert('time_entries', {
      org_id: req.orgId, user_id: req.user.id, intervention_id: interventionId, clock_in: new Date().toISOString(),
      lat_in: Number.isFinite(req.body.lat) ? req.body.lat : null, lng_in: Number.isFinite(req.body.lng) ? req.body.lng : null,
      notes: req.body.notes || null,
    });
    res.status(201).json(db.get('SELECT * FROM time_entries WHERE id = ?', id));
  });

  r.post('/time/clock-out', (req, res) => {
    const e = openEntry(req.user.id);
    if (!e) throw new HttpError(409, 'Aucun pointage en cours');
    db.update('time_entries', {
      clock_out: new Date().toISOString(),
      lat_out: Number.isFinite(req.body.lat) ? req.body.lat : null, lng_out: Number.isFinite(req.body.lng) ? req.body.lng : null,
      notes: [e.notes, req.body.notes].filter(Boolean).join('\n') || null,
    }, { id: e.id });
    if (e.intervention_id && req.body.complete) {
      db.update('interventions', { status: 'terminee', completed_at: new Date().toISOString(), report: req.body.report || null }, { id: e.intervention_id });
    }
    res.json(db.get('SELECT * FROM time_entries WHERE id = ?', e.id));
  });

  function timeQuery(req) {
    const where = ['t.org_id = ?'];
    const params = [req.orgId];
    const tz = db.get('SELECT tz_offset FROM organizations WHERE id = ?', req.orgId).tz_offset;
    if (isDay(req.query.from)) { where.push('t.clock_in >= ?'); params.push(localToUtc(req.query.from, '00:00', tz)); }
    if (isDay(req.query.to)) { where.push('t.clock_in < ?'); params.push(localToUtc(addDays(req.query.to, 1), '00:00', tz)); }
    if (isAgent(req)) { where.push('t.user_id = ?'); params.push(req.user.id); }
    else if (req.query.user_id) { where.push('t.user_id = ?'); params.push(Number(req.query.user_id)); }
    return db.all(`SELECT t.*, u.name AS user_name, u.hourly_rate, i.title AS intervention_title, i.type AS intervention_type, p.name AS property_name
      FROM time_entries t JOIN users u ON u.id = t.user_id LEFT JOIN interventions i ON i.id = t.intervention_id
      LEFT JOIN properties p ON p.id = i.property_id WHERE ${where.join(' AND ')} ORDER BY t.clock_in DESC LIMIT 2000`, ...params)
      .map((t) => ({ ...t, hours: t.clock_out ? Math.round(hoursBetween(t.clock_in, t.clock_out) * 100) / 100 : null }));
  }

  r.get('/time', (req, res) => res.json(timeQuery(req)));

  r.get('/time/report', (req, res) => {
    const by = new Map();
    for (const t of timeQuery(req)) {
      const row = by.get(t.user_id) || { user_id: t.user_id, user_name: t.user_name, hourly_rate: t.hourly_rate, hours: 0, entries: 0, interventions: new Set() };
      row.hours += t.hours || 0; row.entries++;
      if (t.intervention_id) row.interventions.add(t.intervention_id);
      by.set(t.user_id, row);
    }
    res.json([...by.values()].map((r) => ({ ...r, interventions: r.interventions.size, hours: Math.round(r.hours * 100) / 100, cost: Math.round(r.hours * r.hourly_rate * 100) / 100 })));
  });

  r.get('/time/export.csv', (req, res) => {
    const rows = timeQuery(req);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Indian/Reunion' }) : '');
    const lines = ['Intervenant;Début;Fin;Heures;Intervention;Logement;Notes'];
    for (const t of rows) lines.push([t.user_name, fmt(t.clock_in), fmt(t.clock_out), String(t.hours ?? '').replace('.', ','), t.intervention_title, t.property_name, t.notes].map(esc).join(';'));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pointages.csv"');
    res.send('﻿' + lines.join('\r\n'));
  });

  r.put('/time/:id', (req, res) => {
    if (isAgent(req)) throw new HttpError(403, 'Accès réservé');
    const t = findOwned(db, 'time_entries', req.params.id, req.orgId);
    const data = pick(req.body, ['clock_in', 'clock_out', 'notes', 'intervention_id']);
    for (const k of ['clock_in', 'clock_out']) {
      if (data[k] && Number.isNaN(new Date(data[k]).getTime())) throw new HttpError(400, 'Horodatage invalide');
      if (data[k]) data[k] = new Date(data[k]).toISOString();
    }
    const cin = data.clock_in || t.clock_in; const cout = 'clock_out' in data ? data.clock_out : t.clock_out;
    if (cout && cout < cin) throw new HttpError(400, 'La fin doit être après le début');
    if ('intervention_id' in data) assertRef(db, 'interventions', data.intervention_id, req.orgId);
    db.update('time_entries', data, { id: t.id });
    res.json(db.get('SELECT * FROM time_entries WHERE id = ?', t.id));
  });

  r.post('/time', (req, res) => {
    if (isAgent(req)) throw new HttpError(403, 'Accès réservé');
    const { user_id, clock_in, clock_out, notes, intervention_id } = req.body || {};
    if (!db.get('SELECT id FROM users WHERE id = ? AND org_id = ?', Number(user_id), req.orgId)) throw new HttpError(400, 'Intervenant inconnu');
    if (!clock_in || Number.isNaN(new Date(clock_in).getTime())) throw new HttpError(400, 'Début invalide');
    if (clock_out && new Date(clock_out) < new Date(clock_in)) throw new HttpError(400, 'La fin doit être après le début');
    assertRef(db, 'interventions', intervention_id, req.orgId);
    const id = db.insert('time_entries', { org_id: req.orgId, user_id: Number(user_id), intervention_id, notes,
      clock_in: new Date(clock_in).toISOString(), clock_out: clock_out ? new Date(clock_out).toISOString() : null });
    res.status(201).json(db.get('SELECT * FROM time_entries WHERE id = ?', id));
  });

  r.delete('/time/:id', (req, res) => {
    if (isAgent(req)) throw new HttpError(403, 'Accès réservé');
    const t = findOwned(db, 'time_entries', req.params.id, req.orgId);
    db.run('DELETE FROM time_entries WHERE id = ?', t.id);
    res.json({ ok: true });
  });

  return r;
};
