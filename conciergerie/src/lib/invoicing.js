'use strict';
const { addDays, frShort, today } = require('./dates');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Computes line totals and invoice totals (VAT grouped by rate). */
function computeTotals(lines) {
  let ht = 0;
  const vatByRate = {};
  const out = lines.map((l, i) => {
    const total = round2((Number(l.quantity) || 0) * (Number(l.unit_price) || 0));
    ht += total;
    const rate = Number(l.vat_rate) || 0;
    vatByRate[rate] = (vatByRate[rate] || 0) + total;
    return { ...l, quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0, vat_rate: rate, total_ht: total, sort_order: i };
  });
  const vatDetail = Object.entries(vatByRate).map(([rate, base]) => ({ rate: Number(rate), base: round2(base), vat: round2(base * Number(rate) / 100) }));
  const vat = round2(vatDetail.reduce((s, v) => s + v.vat, 0));
  return { lines: out, total_ht: round2(ht), total_vat: vat, total_ttc: round2(ht + vat), vatDetail };
}

/** Replaces the lines of an invoice and refreshes its totals. */
function saveLines(db, invoiceId, lines) {
  const t = computeTotals(lines || []);
  db.run('DELETE FROM invoice_lines WHERE invoice_id = ?', invoiceId);
  for (const l of t.lines) {
    db.insert('invoice_lines', {
      invoice_id: invoiceId, description: String(l.description || '').trim() || 'Prestation',
      quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate, total_ht: l.total_ht, sort_order: l.sort_order,
    });
  }
  db.update('invoices', { total_ht: t.total_ht, total_vat: t.total_vat, total_ttc: t.total_ttc }, { id: invoiceId });
  return t;
}

/** Assigns the next legal sequential number (only when the invoice is issued). */
function assignNumber(db, orgId, invoiceId, issueDate) {
  const inv = db.get('SELECT number FROM invoices WHERE id = ?', invoiceId);
  if (inv && inv.number) return inv.number;
  const org = db.get('SELECT invoice_prefix, next_invoice_number FROM organizations WHERE id = ?', orgId);
  const year = (issueDate || today()).slice(0, 4);
  const number = `${org.invoice_prefix}-${year}-${String(org.next_invoice_number).padStart(4, '0')}`;
  db.run('UPDATE organizations SET next_invoice_number = next_invoice_number + 1 WHERE id = ?', orgId);
  db.update('invoices', { number }, { id: invoiceId });
  return number;
}

/**
 * Builds the lines of a monthly owner statement: management commission on
 * the rental income of the stays that ended in the period, cleaning
 * packages and billable interventions (maintenance, linge...).
 */
function ownerStatementLines(db, orgId, ownerId, start, end, vatRate) {
  const bookings = db.all(`
    SELECT b.*, p.name AS property_name, p.commission_rate, g.first_name, g.last_name
    FROM bookings b JOIN properties p ON p.id = b.property_id
    LEFT JOIN guests g ON g.id = b.guest_id
    WHERE b.org_id = ? AND p.owner_id = ? AND b.status NOT IN ('cancelled','blocked')
      AND b.checkout_date BETWEEN ? AND ?
    ORDER BY b.checkin_date`, orgId, ownerId, start, end);

  const lines = [];
  const summary = { rental_income: 0, commission: 0, cleaning: 0, services: 0, bookings: bookings.length };
  for (const b of bookings) {
    const rent = round2(Number(b.total_amount) - Number(b.cleaning_fee) - Number(b.platform_fee) - Number(b.tourist_tax));
    const commission = round2(rent * Number(b.commission_rate) / 100);
    summary.rental_income += rent;
    summary.commission += commission;
    lines.push({
      description: `Commission de gestion ${b.commission_rate}% – ${b.property_name} – séjour ${[b.first_name, b.last_name].filter(Boolean).join(' ') || ''} du ${frShort(b.checkin_date)} au ${frShort(b.checkout_date)} (loyer net ${rent.toFixed(2)} €)`,
      quantity: 1, unit_price: commission, vat_rate: vatRate,
    });
    if (Number(b.cleaning_fee) > 0) {
      summary.cleaning += Number(b.cleaning_fee);
      lines.push({ description: `Forfait ménage – ${b.property_name} – départ du ${frShort(b.checkout_date)}`, quantity: 1, unit_price: round2(b.cleaning_fee / (1 + vatRate / 100)), vat_rate: vatRate });
    }
  }

  const services = db.all(`
    SELECT i.*, p.name AS property_name FROM interventions i JOIN properties p ON p.id = i.property_id
    WHERE i.org_id = ? AND p.owner_id = ? AND i.status = 'terminee' AND i.billable_amount > 0
      AND i.type NOT IN ('menage') AND i.scheduled_date BETWEEN ? AND ?
    ORDER BY i.scheduled_date`, orgId, ownerId, start, end);
  for (const s of services) {
    summary.services += Number(s.billable_amount);
    lines.push({ description: `${s.title} – ${s.property_name} – ${frShort(s.scheduled_date)}`, quantity: 1, unit_price: s.billable_amount, vat_rate: vatRate });
  }
  for (const k of Object.keys(summary)) summary[k] = round2(summary[k]);
  return { lines, summary };
}

function dueDate(issueDate, days) {
  return addDays(issueDate, Number(days) || 0);
}

module.exports = { computeTotals, saveLines, assignNumber, ownerStatementLines, dueDate, round2 };
