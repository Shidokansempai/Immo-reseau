'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  legal_form TEXT,
  siret TEXT,
  vat_number TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  iban TEXT,
  vat_rate REAL NOT NULL DEFAULT 8.5,
  invoice_prefix TEXT NOT NULL DEFAULT 'FA',
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  payment_terms_days INTEGER NOT NULL DEFAULT 15,
  invoice_footer TEXT,
  tz_offset TEXT NOT NULL DEFAULT '+04:00',
  smtp_host TEXT, smtp_port INTEGER, smtp_secure INTEGER DEFAULT 0,
  smtp_user TEXT, smtp_pass TEXT, smtp_from TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','manager','agent')),
  phone TEXT,
  hourly_rate REAL NOT NULL DEFAULT 0,
  color TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT, phone TEXT, address TEXT, iban TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id INTEGER REFERENCES owners(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Appartement',
  address TEXT, city TEXT,
  capacity INTEGER DEFAULT 2, bedrooms INTEGER DEFAULT 1,
  wifi_name TEXT, wifi_password TEXT, keybox_code TEXT,
  checkin_time TEXT NOT NULL DEFAULT '16:00',
  checkout_time TEXT NOT NULL DEFAULT '10:00',
  access_instructions TEXT, house_rules TEXT, parking_info TEXT,
  cleaning_fee REAL NOT NULL DEFAULT 0,
  cleaning_duration_min INTEGER NOT NULL DEFAULT 120,
  cleaning_cost REAL NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 20,
  auto_checkin INTEGER NOT NULL DEFAULT 1,
  auto_checkout INTEGER NOT NULL DEFAULT 1,
  auto_cleaning INTEGER NOT NULL DEFAULT 1,
  ical_url TEXT,
  ical_token TEXT,
  ical_last_sync TEXT,
  color TEXT DEFAULT '#5fa090',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT, phone TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'direct',
  external_ref TEXT,
  ical_uid TEXT,
  checkin_date TEXT NOT NULL,
  checkout_date TEXT NOT NULL,
  arrival_time TEXT,
  adults INTEGER DEFAULT 1, children INTEGER DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  cleaning_fee REAL NOT NULL DEFAULT 0,
  platform_fee REAL NOT NULL DEFAULT 0,
  tourist_tax REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed','checked_in','checked_out','cancelled','blocked')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (checkout_date > checkin_date)
);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(org_id, checkin_date, checkout_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_ical ON bookings(property_id, ical_uid) WHERE ical_uid IS NOT NULL;

CREATE TABLE IF NOT EXISTS interventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('checkin','checkout','menage','linge','maintenance','inspection','autre')),
  title TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT,
  duration_min INTEGER NOT NULL DEFAULT 60,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'a_faire' CHECK (status IN ('a_faire','en_cours','terminee','annulee')),
  billable_amount REAL NOT NULL DEFAULT 0,
  auto INTEGER NOT NULL DEFAULT 0,
  checklist TEXT,
  notes TEXT,
  report TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_interventions_date ON interventions(org_id, scheduled_date);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intervention_id INTEGER REFERENCES interventions(id) ON DELETE SET NULL,
  clock_in TEXT NOT NULL,
  clock_out TEXT,
  lat_in REAL, lng_in REAL, lat_out REAL, lng_out REAL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_time_user ON time_entries(org_id, user_id, clock_in);

CREATE TABLE IF NOT EXISTS message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger IN ('booking_confirmed','before_checkin','checkin_day','during_stay','before_checkout','checkout_day','after_checkout','manual')),
  offset_days INTEGER NOT NULL DEFAULT 0,
  send_time TEXT NOT NULL DEFAULT '10:00',
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms','whatsapp')),
  language TEXT NOT NULL DEFAULT 'fr',
  subject TEXT,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  template_id INTEGER REFERENCES message_templates(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'out' CHECK (direction IN ('out','in')),
  channel TEXT NOT NULL DEFAULT 'email',
  recipient TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sent','simulated','failed','cancelled','received')),
  scheduled_at TEXT,
  sent_at TEXT,
  error TEXT,
  read INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_sched ON messages(status, scheduled_at);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number TEXT,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('owner','guest','other')),
  owner_id INTEGER REFERENCES owners(id) ON DELETE SET NULL,
  guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_email TEXT,
  issue_date TEXT NOT NULL,
  due_date TEXT,
  period_start TEXT, period_end TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','cancelled')),
  total_ht REAL NOT NULL DEFAULT 0,
  total_vat REAL NOT NULL DEFAULT 0,
  total_ttc REAL NOT NULL DEFAULT 0,
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_number ON invoices(org_id, number) WHERE number IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  vat_rate REAL NOT NULL DEFAULT 0,
  total_ht REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
`;

/** Converts JS values into types accepted by node:sqlite. */
function clean(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === '') return null;
  return v;
}

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);

  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = db.prepare(sql); cache.set(sql, s); }
    return s;
  };

  return {
    raw: db,
    get: (sql, ...p) => stmt(sql).get(...p.map(clean)),
    all: (sql, ...p) => stmt(sql).all(...p.map(clean)),
    run: (sql, ...p) => stmt(sql).run(...p.map(clean)),
    /** Inserts `data` into `table` and returns the new id. */
    insert(table, data) {
      const keys = Object.keys(data);
      const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
      return Number(stmt(sql).run(...keys.map((k) => clean(data[k]))).lastInsertRowid);
    },
    /** Updates columns of a row scoped by `where` (object of equality conditions). */
    update(table, data, where) {
      const keys = Object.keys(data);
      if (!keys.length) return 0;
      const wk = Object.keys(where);
      const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${wk.map((k) => `${k} = ?`).join(' AND ')}`;
      return Number(stmt(sql).run(...keys.map((k) => clean(data[k])), ...wk.map((k) => clean(where[k]))).changes);
    },
    tx(fn) {
      db.exec('BEGIN');
      try { const r = fn(); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    close: () => db.close(),
  };
}

module.exports = { open, clean };
