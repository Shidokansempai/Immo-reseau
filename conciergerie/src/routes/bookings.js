'use strict';
const express = require('express');
const { HttpError, pick, findOwned, assertRef } = require('./crud');
const { isDay } = require('../lib/dates');
const { onBookingChanged } = require('../lib/automation');

const FIELDS = ['property_id', 'guest_id', 'source', 'external_ref', 'checkin_date', 'checkout_date', 'arrival_time',
  'adults', 'children', 'total_amount', 'cleaning_fee', 'platform_fee', 'tourist_tax', 'status', 'notes'];
const GUEST_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'language', 'notes'];
const STATUSES = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'blocked'];

const SELECT = `
  SELECT b.*, p.name AS property_name, p.color AS property_color, p.city AS property_city,
         g.first_name, g.last_name, g.email AS guest_email, g.phone AS guest_phone, g.language AS guest_language
  FROM bookings b JOIN properties p ON p.id = b.property_id LEFT JOIN guests g ON g.id = b.guest_id`;

module.exports = function bookingRoutes(db) {
  const r = express.Router();

  function overlap(orgId, propertyId, start, end, excludeId = 0) {
    return db.get(`SELECT id, checkin_date, checkout_date FROM bookings
      WHERE org_id = ? AND property_id = ? AND id != ? AND status != 'cancelled'
        AND checkin_date < ? AND checkout_date > ?`, orgId, propertyId, excludeId, end, start);
  }

  /** Validates booking data; creates the guest when given inline. */
  function prepare(req, data, existing) {
    const merged = { ...(existing || {}), ...data };
    if (!merged.property_id) throw new HttpError(400, 'Logement obligatoire');
    assertRef(db, 'properties', merged.property_id, req.orgId);
    if (!isDay(merged.checkin_date) || !isDay(merged.checkout_date)) throw new HttpError(400, 'Dates d\'arrivée et de départ obligatoires');
    if (merged.checkout_date <= merged.checkin_date) throw new HttpError(400, 'La date de départ doit être après la date d\'arrivée');
    if (merged.status && !STATUSES.includes(merged.status)) throw new HttpError(400, 'Statut invalide');
    if (merged.status !== 'cancelled' && !req.body.force) {
      const o = overlap(req.orgId, merged.property_id, merged.checkin_date, merged.checkout_date, existing?.id);
      if (o) throw new HttpError(409, `Chevauchement avec la réservation #${o.id} (${o.checkin_date} → ${o.checkout_date}). Cochez « forcer » pour enregistrer quand même.`);
    }
    const g = req.body.guest;
    if (g && (g.first_name || g.email)) {
      const guestData = pick(g, GUEST_FIELDS);
      if (!guestData.first_name) guestData.first_name = String(g.email).split('@')[0];
      if (merged.guest_id) {
        assertRef(db, 'guests', merged.guest_id, req.orgId);
        db.update('guests', guestData, { id: merged.guest_id, org_id: req.orgId });
      } else {
        data.guest_id = db.insert('guests', { ...guestData, org_id: req.orgId });
      }
    } else if ('guest_id' in data) {
      assertRef(db, 'guests', data.guest_id, req.orgId);
    }
  }

  r.get('/', (req, res) => {
    const where = ['b.org_id = ?'];
    const params = [req.orgId];
    if (req.query.from) { where.push('b.checkout_date >= ?'); params.push(req.query.from); }
    if (req.query.to) { where.push('b.checkin_date <= ?'); params.push(req.query.to); }
    if (req.query.property_id) { where.push('b.property_id = ?'); params.push(Number(req.query.property_id)); }
    if (req.query.status) { where.push('b.status = ?'); params.push(req.query.status); }
    if (req.query.q) {
      where.push('(g.first_name LIKE ? OR g.last_name LIKE ? OR g.email LIKE ? OR b.external_ref LIKE ? OR p.name LIKE ?)');
      for (let i = 0; i < 5; i++) params.push(`%${req.query.q}%`);
    }
    res.json(db.all(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY b.checkin_date DESC LIMIT 500`, ...params));
  });

  r.get('/:id', (req, res) => {
    const b = findOwned(db, 'bookings', req.params.id, req.orgId);
    res.json({
      ...db.get(`${SELECT} WHERE b.id = ?`, b.id),
      guest: b.guest_id ? db.get('SELECT * FROM guests WHERE id = ?', b.guest_id) : null,
      property: db.get('SELECT * FROM properties WHERE id = ?', b.property_id),
      interventions: db.all(`SELECT i.*, u.name AS assignee_name FROM interventions i LEFT JOIN users u ON u.id = i.assigned_to
        WHERE i.booking_id = ? ORDER BY i.scheduled_date, i.scheduled_time`, b.id),
      messages: db.all('SELECT * FROM messages WHERE booking_id = ? ORDER BY COALESCE(sent_at, scheduled_at, created_at)', b.id),
      invoices: db.all('SELECT id, number, status, total_ttc FROM invoices WHERE booking_id = ?', b.id),
    });
  });

  r.post('/', (req, res) => {
    if (req.user.role === 'agent') throw new HttpError(403, 'Accès réservé');
    const data = pick(req.body, FIELDS);
    const id = db.tx(() => {
      prepare(req, data, null);
      if (data.cleaning_fee == null) {
        const p = db.get('SELECT cleaning_fee FROM properties WHERE id = ?', data.property_id);
        data.cleaning_fee = p.cleaning_fee;
      }
      return db.insert('bookings', { ...data, org_id: req.orgId });
    });
    onBookingChanged(db, id);
    res.status(201).json(db.get(`${SELECT} WHERE b.id = ?`, id));
  });

  r.put('/:id', (req, res) => {
    if (req.user.role === 'agent') throw new HttpError(403, 'Accès réservé');
    const b = findOwned(db, 'bookings', req.params.id, req.orgId);
    const data = pick(req.body, FIELDS);
    db.tx(() => {
      prepare(req, data, b);
      db.update('bookings', data, { id: b.id });
    });
    onBookingChanged(db, b.id);
    res.json(db.get(`${SELECT} WHERE b.id = ?`, b.id));
  });

  r.post('/:id/status', (req, res) => {
    const b = findOwned(db, 'bookings', req.params.id, req.orgId);
    const status = req.body.status;
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Statut invalide');
    if (req.user.role === 'agent' && !['checked_in', 'checked_out'].includes(status)) throw new HttpError(403, 'Accès réservé');
    db.update('bookings', { status }, { id: b.id });
    if (status === 'cancelled') {
      db.run("UPDATE messages SET status = 'cancelled' WHERE booking_id = ? AND status = 'scheduled'", b.id);
    }
    onBookingChanged(db, b.id);
    res.json(db.get(`${SELECT} WHERE b.id = ?`, b.id));
  });

  r.delete('/:id', (req, res) => {
    if (req.user.role === 'agent') throw new HttpError(403, 'Accès réservé');
    const b = findOwned(db, 'bookings', req.params.id, req.orgId);
    db.run('DELETE FROM bookings WHERE id = ?', b.id);
    res.json({ ok: true });
  });

  return r;
};
