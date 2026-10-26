'use strict';
// Hourly cleaning ratio: real time clocked on each cleaning (ménage) compared
// with the planned duration and with the amount billed for it.

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const minutesBetween = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 60000);

/**
 * Summary of one cleaning. A cleaning still clocked in is "running": its
 * ratio is only final once the last entry is closed.
 */
function summarize(i, entries, now = new Date()) {
  const amount = Number(i.billable_amount) || Number(i.cleaning_fee) || 0;
  let minutes = 0; let labour = 0; let runningSince = null; let elapsed = 0;
  const agents = new Set();
  for (const e of entries) {
    agents.add(e.user_name);
    if (e.clock_out) {
      const m = minutesBetween(e.clock_in, e.clock_out);
      minutes += m;
      labour += (m / 60) * (Number(e.hourly_rate) || 0);
    } else {
      runningSince = !runningSince || e.clock_in < runningSince ? e.clock_in : runningSince;
      elapsed += minutesBetween(e.clock_in, now);
    }
  }
  const running = Boolean(runningSince);
  const hours = minutes / 60;
  const done = !running && minutes > 0;
  return {
    id: i.id, title: i.title, scheduled_date: i.scheduled_date, status: i.status,
    property_id: i.property_id, property_name: i.property_name, agents: [...agents],
    planned_min: Number(i.duration_min) || 0,
    amount: round(amount),
    running, running_since: runningSince, elapsed_min: Math.round(minutes + elapsed),
    actual_min: done ? Math.round(minutes) : null,
    deviation_min: done ? Math.round(minutes - (Number(i.duration_min) || 0)) : null,
    ratio: done && hours > 0 ? round(amount / hours) : null,
    labour_cost: done ? round(labour) : null,
    margin: done ? round(amount - labour) : null,
  };
}

function loadEntries(db, ids) {
  if (!ids.length) return new Map();
  const rows = db.all(`SELECT t.*, u.name AS user_name, u.hourly_rate FROM time_entries t JOIN users u ON u.id = t.user_id
    WHERE t.intervention_id IN (${ids.map(() => '?').join(',')}) ORDER BY t.clock_in`, ...ids);
  const map = new Map();
  for (const r of rows) map.set(r.intervention_id, [...(map.get(r.intervention_id) || []), r]);
  return map;
}

const SELECT = `SELECT i.*, p.name AS property_name, p.cleaning_fee FROM interventions i JOIN properties p ON p.id = i.property_id`;

function interventionSummary(db, interventionId, now = new Date()) {
  const i = db.get(`${SELECT} WHERE i.id = ?`, interventionId);
  if (!i || i.type !== 'menage') return null;
  return summarize(i, loadEntries(db, [i.id]).get(i.id) || [], now);
}

function aggregate(items, key, label) {
  const map = new Map();
  for (const it of items.filter((x) => x.actual_min != null)) {
    for (const k of key(it)) {
      const g = map.get(k) || { name: label(it, k), count: 0, minutes: 0, planned: 0, amount: 0, labour: 0 };
      g.count++; g.minutes += it.actual_min; g.planned += it.planned_min; g.amount += it.amount; g.labour += it.labour_cost;
      map.set(k, g);
    }
  }
  return [...map.values()].map((g) => ({
    name: g.name, count: g.count,
    avg_min: Math.round(g.minutes / g.count), avg_planned_min: Math.round(g.planned / g.count),
    ratio: g.minutes ? round(g.amount / (g.minutes / 60)) : null,
    labour_cost: round(g.labour), margin: round(g.amount - g.labour),
  })).sort((a, b) => (b.ratio || 0) - (a.ratio || 0));
}

/** Cleaning statistics over a period of scheduled dates. */
function cleaningStats(db, orgId, from, to, now = new Date()) {
  const list = db.all(`${SELECT} WHERE i.org_id = ? AND i.type = 'menage' AND i.status != 'annulee'
    AND i.scheduled_date BETWEEN ? AND ? ORDER BY i.scheduled_date DESC, i.scheduled_time DESC`, orgId, from, to);
  const entries = loadEntries(db, list.map((i) => i.id));
  const items = list.map((i) => summarize(i, entries.get(i.id) || [], now)).filter((x) => x.running || x.actual_min != null);
  const done = items.filter((x) => x.actual_min != null);
  const sum = (k) => done.reduce((s, x) => s + x[k], 0);
  const minutes = sum('actual_min');
  return {
    from, to,
    running: items.filter((x) => x.running),
    items: done,
    totals: {
      count: done.length,
      avg_min: done.length ? Math.round(minutes / done.length) : null,
      avg_planned_min: done.length ? Math.round(sum('planned_min') / done.length) : null,
      ratio: minutes ? round(sum('amount') / (minutes / 60)) : null,
      amount: round(sum('amount')), labour_cost: round(sum('labour_cost')), margin: round(sum('amount') - sum('labour_cost')),
    },
    by_property: aggregate(done, (x) => [x.property_id], (x) => x.property_name),
    by_agent: aggregate(done, (x) => x.agents, (x, k) => k),
  };
}

module.exports = { cleaningStats, interventionSummary, summarize };
