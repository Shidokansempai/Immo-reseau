'use strict';
const path = require('node:path');
const express = require('express');
const { authenticate } = require('./auth');
const ical = require('./lib/ical');

function createApp(db, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxy ?? 1);
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.get('/health', (req, res) => res.json({ ok: true }));

  // Public iCal export, to paste into Airbnb / Booking.com to block dates.
  app.get('/ical/:token.ics', (req, res) => {
    const p = db.get('SELECT * FROM properties WHERE ical_token = ?', req.params.token);
    if (!p) return res.status(404).send('Calendrier introuvable');
    const org = db.get('SELECT name FROM organizations WHERE id = ?', p.org_id);
    // Imported platform bookings are not re-exported to avoid feedback loops.
    const bookings = db.all(`SELECT * FROM bookings WHERE property_id = ? AND status != 'cancelled'
      AND checkout_date >= date('now', '-30 day') AND ical_uid IS NULL ORDER BY checkin_date`, p.id);
    res.type('text/calendar; charset=utf-8').send(ical.build({ property: p, bookings, orgName: org.name }));
  });

  app.use('/api/auth', require('./routes/auth')(db, options));
  const api = express.Router();
  api.use(authenticate(db));
  api.use('/bookings', require('./routes/bookings')(db));
  api.use('/invoices', require('./routes/invoices')(db));
  api.use(require('./routes/operations')(db));
  api.use(require('./routes/messaging')(db));
  api.use(require('./routes/core')(db));
  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    let message = err.message;
    if (/CHECK constraint|FOREIGN KEY|NOT NULL constraint/.test(message || '')) { status = 400; message = 'Valeur invalide ou manquante'; }
    if (status >= 500) { console.error(err); message = 'Erreur interne'; }
    res.status(status).json({ error: message });
  });
  return app;
}

module.exports = { createApp };
