'use strict';
const crypto = require('node:crypto');

const SESSION_DAYS = 30;
const COOKIE = 'kaz_session';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = String(stored || '').split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.insert('sessions', { token, user_id: userId, expires_at: expires });
  return { token, expires };
}

function setSessionCookie(res, token, secure) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Express middleware: loads req.user / req.org from the session cookie or Bearer token. */
function authenticate(db) {
  return (req, res, next) => {
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    const token = bearer || parseCookies(req.headers.cookie)[COOKIE];
    if (!token) return res.status(401).json({ error: 'Non authentifié' });
    const row = db.get(`
      SELECT u.id, u.org_id, u.name, u.email, u.role, u.phone, u.active, s.expires_at
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`, token);
    if (!row || !row.active || row.expires_at < new Date().toISOString()) {
      return res.status(401).json({ error: 'Session expirée' });
    }
    req.user = row;
    req.orgId = row.org_id;
    req.token = token;
    next();
  };
}

/** Restricts a route to some roles. */
function requireRole(...roles) {
  return (req, res, next) => (roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Accès réservé' }));
}

module.exports = { hashPassword, verifyPassword, createSession, setSessionCookie, clearSessionCookie, authenticate, requireRole, parseCookies };
