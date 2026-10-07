'use strict';
// Dates are stored as 'YYYY-MM-DD' strings (local calendar day of the
// organisation) and timestamps as UTC ISO strings.

const DAY = 86400000;

function parseDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtDay(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(s, n) {
  return fmtDay(new Date(parseDay(s).getTime() + n * DAY));
}

function diffDays(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / DAY);
}

function isDay(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDay(s).getTime());
}

/** Local date + 'HH:MM' in a fixed UTC offset ('+04:00' for La Réunion) -> UTC ISO. */
function localToUtc(day, time = '00:00', offset = '+04:00') {
  return new Date(`${day}T${time.length === 5 ? time : '00:00'}:00${offset}`).toISOString();
}

/** Today's calendar day in the given offset. */
function today(offset = '+04:00', now = new Date()) {
  const sign = offset[0] === '-' ? -1 : 1;
  const [h, m] = offset.slice(1).split(':').map(Number);
  return fmtDay(new Date(now.getTime() + sign * (h * 60 + m) * 60000));
}

const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** '2026-10-07' -> 'mercredi 7 octobre 2026' */
function frLong(s) {
  if (!isDay(s)) return s || '';
  const d = parseDay(s);
  return `${FR_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${FR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** '2026-10-07' -> '07/10/2026' */
function frShort(s) {
  if (!isDay(s)) return s || '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

module.exports = { addDays, diffDays, isDay, localToUtc, today, frLong, frShort, parseDay, fmtDay };
