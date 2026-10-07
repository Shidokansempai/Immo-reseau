'use strict';
const path = require('node:path');
const fs = require('node:fs');

// Minimal .env loader (no dependency).
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { open } = require('./db');
const { createApp } = require('./app');
const scheduler = require('./lib/scheduler');

const dbFile = process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'conciergerie.db');
const db = open(dbFile);
const app = createApp(db, {
  secureCookies: process.env.COOKIE_SECURE === 'true',
  allowSignup: process.env.ALLOW_SIGNUP !== 'false',
});
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Conciergerie démarrée sur http://localhost:${port} (base : ${dbFile})`);
  scheduler.start(db);
});
