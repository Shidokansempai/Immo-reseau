'use strict';
const express = require('express');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Keeps only whitelisted fields present in body. */
function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body && Object.prototype.hasOwnProperty.call(body, f)) out[f] = body[f];
  return out;
}

function intId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Identifiant invalide');
  return n;
}

/** Fetches a row of the current organisation or throws 404. */
function findOwned(db, table, id, orgId) {
  const row = db.get(`SELECT * FROM ${table} WHERE id = ? AND org_id = ?`, intId(id), orgId);
  if (!row) throw new HttpError(404, 'Élément introuvable');
  return row;
}

/** Checks that a referenced id belongs to the organisation (or is empty). */
function assertRef(db, table, id, orgId) {
  if (id === null || id === undefined || id === '') return;
  findOwned(db, table, id, orgId);
}

/**
 * Generic CRUD router for an organisation-scoped table.
 * opts: { table, fields, required, orderBy, refs: {field: table}, search: [cols], afterSave, writeRoles }
 */
function crudRouter(db, opts) {
  const r = express.Router();
  const { table, fields, required = [], orderBy = 'id DESC', refs = {}, search = [], writeRoles = ['admin', 'manager'] } = opts;
  const canWrite = (req) => {
    if (!writeRoles.includes(req.user.role)) throw new HttpError(403, 'Accès réservé');
  };
  const validate = (req, data, creating) => {
    for (const f of required) {
      if (creating || f in data) {
        if (data[f] === undefined || data[f] === null || String(data[f]).trim() === '') throw new HttpError(400, `Champ obligatoire : ${f}`);
      }
    }
    for (const [f, t] of Object.entries(refs)) if (f in data) assertRef(db, t, data[f], req.orgId);
    if (opts.validate) opts.validate(data, creating, req);
  };

  r.get('/', (req, res) => {
    let sql = `SELECT * FROM ${table} WHERE org_id = ?`;
    const params = [req.orgId];
    if (req.query.q && search.length) {
      sql += ` AND (${search.map((c) => `${c} LIKE ?`).join(' OR ')})`;
      for (let i = 0; i < search.length; i++) params.push(`%${req.query.q}%`);
    }
    res.json(db.all(`${sql} ORDER BY ${orderBy} LIMIT 1000`, ...params));
  });

  r.get('/:id', (req, res) => res.json(findOwned(db, table, req.params.id, req.orgId)));

  r.post('/', (req, res) => {
    canWrite(req);
    const data = pick(req.body, fields);
    if (opts.defaults) Object.assign(data, opts.defaults(data, req));
    validate(req, data, true);
    const id = db.insert(table, { ...data, org_id: req.orgId });
    if (opts.afterSave) opts.afterSave(id, req);
    res.status(201).json(db.get(`SELECT * FROM ${table} WHERE id = ?`, id));
  });

  r.put('/:id', (req, res) => {
    canWrite(req);
    const row = findOwned(db, table, req.params.id, req.orgId);
    const data = pick(req.body, fields);
    validate(req, data, false);
    db.update(table, data, { id: row.id });
    if (opts.afterSave) opts.afterSave(row.id, req);
    res.json(db.get(`SELECT * FROM ${table} WHERE id = ?`, row.id));
  });

  r.delete('/:id', (req, res) => {
    canWrite(req);
    const row = findOwned(db, table, req.params.id, req.orgId);
    db.run(`DELETE FROM ${table} WHERE id = ?`, row.id);
    res.json({ ok: true });
  });

  return r;
}

module.exports = { crudRouter, HttpError, pick, findOwned, assertRef, intId };
