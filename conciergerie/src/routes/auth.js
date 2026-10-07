'use strict';
const express = require('express');
const { hashPassword, verifyPassword, createSession, setSessionCookie, clearSessionCookie, authenticate } = require('../auth');
const { createDefaultTemplates } = require('../defaults');
const { HttpError } = require('./crud');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = function authRoutes(db, { secureCookies = false, allowSignup = true } = {}) {
  const r = express.Router();
  const attempts = new Map(); // naive brute-force protection per IP

  r.post('/register', (req, res) => {
    if (!allowSignup) throw new HttpError(403, 'Inscriptions fermées');
    const { org_name, name, email, password } = req.body || {};
    if (!org_name || !name || !EMAIL_RE.test(email || '')) throw new HttpError(400, 'Nom de la conciergerie, nom et e-mail valides requis');
    if (String(password || '').length < 8) throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères');
    if (db.get('SELECT id FROM users WHERE email = ?', email)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail');
    const userId = db.tx(() => {
      const orgId = db.insert('organizations', { name: org_name, email });
      createDefaultTemplates(db, orgId);
      return db.insert('users', { org_id: orgId, name, email, password_hash: hashPassword(password), role: 'admin' });
    });
    const s = createSession(db, userId);
    setSessionCookie(res, s.token, secureCookies);
    res.status(201).json({ ok: true, token: s.token });
  });

  r.post('/login', (req, res) => {
    const ip = req.ip;
    const a = attempts.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - a.t > 15 * 60000) { a.n = 0; a.t = Date.now(); }
    if (a.n >= 10) throw new HttpError(429, 'Trop de tentatives, réessayez dans 15 minutes');
    const { email, password } = req.body || {};
    const user = db.get('SELECT * FROM users WHERE email = ?', email || '');
    if (!user || !user.active || !verifyPassword(password || '', user.password_hash)) {
      a.n++; attempts.set(ip, a);
      throw new HttpError(401, 'E-mail ou mot de passe incorrect');
    }
    attempts.delete(ip);
    db.run('DELETE FROM sessions WHERE expires_at < ?', new Date().toISOString());
    const s = createSession(db, user.id);
    setSessionCookie(res, s.token, secureCookies);
    res.json({ ok: true, token: s.token });
  });

  r.post('/logout', authenticate(db), (req, res) => {
    db.run('DELETE FROM sessions WHERE token = ?', req.token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  r.get('/me', authenticate(db), (req, res) => {
    const org = db.get('SELECT id, name, vat_rate, tz_offset FROM organizations WHERE id = ?', req.orgId);
    const { expires_at, ...user } = req.user;
    res.json({ user, org });
  });

  r.post('/password', authenticate(db), (req, res) => {
    const { current, password } = req.body || {};
    const u = db.get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
    if (!verifyPassword(current || '', u.password_hash)) throw new HttpError(400, 'Mot de passe actuel incorrect');
    if (String(password || '').length < 8) throw new HttpError(400, 'Au moins 8 caractères');
    db.update('users', { password_hash: hashPassword(password) }, { id: req.user.id });
    db.run('DELETE FROM sessions WHERE user_id = ? AND token != ?', req.user.id, req.token);
    res.json({ ok: true });
  });

  return r;
};
