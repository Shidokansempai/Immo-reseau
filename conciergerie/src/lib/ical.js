'use strict';
// Minimal iCalendar (RFC 5545) support: import of Airbnb / Booking.com /
// Abritel calendars and export of a property's calendar.

function unfold(text) {
  return String(text).replace(/\r?\n[ \t]/g, '');
}

function unescape(v) {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

function escape(v) {
  return String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/** 'YYYYMMDD' or 'YYYYMMDDTHHMMSSZ' -> 'YYYY-MM-DD' */
function icalDate(v) {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Parses VEVENTs: returns [{uid, start, end, summary, description}] */
function parse(text) {
  const events = [];
  let cur = null;
  for (const line of unfold(text).split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.start && cur.end) events.push(cur);
      cur = null; continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx).split(';')[0].toUpperCase();
    const value = line.slice(idx + 1);
    if (name === 'UID') cur.uid = value.trim();
    else if (name === 'DTSTART') cur.start = icalDate(value);
    else if (name === 'DTEND') cur.end = icalDate(value);
    else if (name === 'SUMMARY') cur.summary = unescape(value);
    else if (name === 'DESCRIPTION') cur.description = unescape(value);
  }
  return events;
}

function detectSource(url = '') {
  const u = url.toLowerCase();
  if (u.includes('airbnb')) return 'airbnb';
  if (u.includes('booking.com')) return 'booking';
  if (u.includes('abritel') || u.includes('vrbo') || u.includes('homeaway')) return 'abritel';
  if (u.includes('gites-de-france') || u.includes('gdf')) return 'gites_de_france';
  return 'ical';
}

/** Airbnb/Booking mark owner blocks as "Not available" / "CLOSED". */
function isBlock(ev) {
  return /not available|blocked|closed|indisponible|unavailable/i.test(ev.summary || '');
}

function stamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Builds an .ics feed for a property. */
function build({ property, bookings, orgName }) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${escape(orgName || 'Conciergerie')}//Sakura Palm Conciergerie//FR`,
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escape(property.name)}`,
  ];
  for (const b of bookings) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:sakurapalm-${b.id}@conciergerie`,
      `DTSTAMP:${stamp()}`,
      `DTSTART;VALUE=DATE:${b.checkin_date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${b.checkout_date.replace(/-/g, '')}`,
      `SUMMARY:${b.status === 'blocked' ? 'Indisponible' : 'Réservé'}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

module.exports = { parse, build, detectSource, isBlock };
