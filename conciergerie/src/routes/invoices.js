'use strict';
const express = require('express');
const { HttpError, pick, findOwned, assertRef } = require('./crud');
const { isDay, today, frShort, diffDays } = require('../lib/dates');
const inv = require('../lib/invoicing');
const { deliver } = require('../lib/mailer');

const FIELDS = ['kind', 'owner_id', 'guest_id', 'booking_id', 'client_name', 'client_address', 'client_email',
  'issue_date', 'due_date', 'period_start', 'period_end', 'notes'];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (n) => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

function invoiceHtml(org, invoice, lines, totals) {
  const title = invoice.number ? `Facture ${invoice.number}` : 'Facture (brouillon)';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:40px;font-size:13px}
.top{display:flex;justify-content:space-between;gap:40px}.org h1{margin:0 0 6px;font-size:24px;color:#2c3a1e;font-family:Georgia,serif}.org img{width:96px;height:96px;border-radius:50%;margin-bottom:8px}
.box{border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;min-width:260px}
h2{font-size:20px;margin:32px 0 4px}table{width:100%;border-collapse:collapse;margin-top:20px}
th{background:#2c3a1e;color:#fff;text-align:left;padding:8px}td{padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
.r{text-align:right;white-space:nowrap}.tot{margin-left:auto;width:320px;margin-top:16px}.tot td{border:none;padding:4px 8px}
.tot tr.g td{font-weight:bold;font-size:16px;border-top:2px solid #c49e5c}.muted{color:#6b7280}.foot{margin-top:40px;font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:10px}
.draft{color:#b91c1c;font-weight:bold}.paid{color:#15803d;font-weight:bold}
@media print{body{padding:0}.noprint{display:none}}
</style></head><body>
<div class="noprint" style="text-align:right;margin-bottom:20px"><button onclick="print()" style="padding:8px 16px;font-size:14px;cursor:pointer">🖨️ Imprimer / PDF</button></div>
<div class="top"><div class="org"><img src="/img/logo-256.png" alt=""><h1>${esc(org.name)}</h1>
<div>${esc(org.address || '').replace(/\n/g, '<br>')}</div><div>${esc(org.phone || '')} ${org.email ? '– ' + esc(org.email) : ''}</div>
${org.siret ? `<div class="muted">SIRET ${esc(org.siret)}${org.legal_form ? ' – ' + esc(org.legal_form) : ''}</div>` : ''}
${org.vat_number ? `<div class="muted">TVA intracom. ${esc(org.vat_number)}</div>` : ''}</div>
<div class="box"><strong>${esc(invoice.client_name)}</strong><br>${esc(invoice.client_address || '').replace(/\n/g, '<br>')}${invoice.client_email ? '<br>' + esc(invoice.client_email) : ''}</div></div>
<h2>${esc(title)} ${invoice.status === 'draft' ? '<span class="draft">– BROUILLON</span>' : ''}${invoice.status === 'paid' ? '<span class="paid">– ACQUITTÉE</span>' : ''}${invoice.status === 'cancelled' ? '<span class="draft">– ANNULÉE</span>' : ''}</h2>
<div>Date : ${frShort(invoice.issue_date)}${invoice.due_date ? ` – Échéance : ${frShort(invoice.due_date)}` : ''}</div>
${invoice.period_start ? `<div>Période : du ${frShort(invoice.period_start)} au ${frShort(invoice.period_end)}</div>` : ''}
<table><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">PU HT</th><th class="r">TVA</th><th class="r">Total HT</th></tr></thead><tbody>
${lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="r">${l.quantity}</td><td class="r">${eur(l.unit_price)}</td><td class="r">${l.vat_rate} %</td><td class="r">${eur(l.total_ht)}</td></tr>`).join('')}
</tbody></table>
<table class="tot"><tr><td>Total HT</td><td class="r">${eur(totals.total_ht)}</td></tr>
${totals.vatDetail.map((v) => `<tr><td>TVA ${v.rate} % sur ${eur(v.base)}</td><td class="r">${eur(v.vat)}</td></tr>`).join('')}
<tr class="g"><td>Total TTC</td><td class="r">${eur(totals.total_ttc)}</td></tr></table>
${invoice.notes ? `<p>${esc(invoice.notes).replace(/\n/g, '<br>')}</p>` : ''}
<div class="foot">${org.iban ? `Règlement par virement – IBAN : ${esc(org.iban)}<br>` : ''}
En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.
${org.invoice_footer ? '<br>' + esc(org.invoice_footer) : ''}</div>
</body></html>`;
}

module.exports = function invoiceRoutes(db) {
  const r = express.Router();
  r.use((req, res, next) => (req.user.role === 'agent' ? res.status(403).json({ error: 'Accès réservé' }) : next()));

  const org = (req) => db.get('SELECT * FROM organizations WHERE id = ?', req.orgId);
  const full = (id) => {
    const i = db.get('SELECT * FROM invoices WHERE id = ?', id);
    const lines = db.all('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY sort_order, id', id);
    return { ...i, lines, totals: inv.computeTotals(lines) };
  };

  r.get('/', (req, res) => {
    const where = ['org_id = ?'];
    const params = [req.orgId];
    if (req.query.status) { where.push('status = ?'); params.push(req.query.status); }
    if (req.query.kind) { where.push('kind = ?'); params.push(req.query.kind); }
    if (req.query.owner_id) { where.push('owner_id = ?'); params.push(Number(req.query.owner_id)); }
    const rows = db.all(`SELECT * FROM invoices WHERE ${where.join(' AND ')} ORDER BY issue_date DESC, id DESC LIMIT 500`, ...params);
    const t = today();
    res.json(rows.map((x) => ({ ...x, overdue: x.status === 'issued' && x.due_date && x.due_date < t })));
  });

  r.get('/:id', (req, res) => res.json(full(findOwned(db, 'invoices', req.params.id, req.orgId).id)));

  function validate(req, data) {
    for (const [f, t] of [['owner_id', 'owners'], ['guest_id', 'guests'], ['booking_id', 'bookings']]) if (f in data) assertRef(db, t, data[f], req.orgId);
    for (const f of ['issue_date', 'due_date', 'period_start', 'period_end']) if (data[f] && !isDay(data[f])) throw new HttpError(400, `Date invalide : ${f}`);
    if (Array.isArray(req.body.lines) && req.body.lines.length > 200) throw new HttpError(400, 'Trop de lignes');
  }

  r.post('/', (req, res) => {
    const data = pick(req.body, FIELDS);
    if (!data.client_name) throw new HttpError(400, 'Client obligatoire');
    validate(req, data);
    const o = org(req);
    data.issue_date = data.issue_date || today(o.tz_offset);
    data.due_date = data.due_date || inv.dueDate(data.issue_date, o.payment_terms_days);
    const id = db.tx(() => {
      const id = db.insert('invoices', { ...data, org_id: req.orgId, status: 'draft' });
      inv.saveLines(db, id, req.body.lines || []);
      return id;
    });
    res.status(201).json(full(id));
  });

  r.put('/:id', (req, res) => {
    const i = findOwned(db, 'invoices', req.params.id, req.orgId);
    if (i.status !== 'draft') throw new HttpError(400, 'Une facture émise ne peut plus être modifiée (créez un avoir)');
    const data = pick(req.body, FIELDS);
    validate(req, data);
    db.tx(() => {
      db.update('invoices', data, { id: i.id });
      if (Array.isArray(req.body.lines)) inv.saveLines(db, i.id, req.body.lines);
    });
    res.json(full(i.id));
  });

  r.delete('/:id', (req, res) => {
    const i = findOwned(db, 'invoices', req.params.id, req.orgId);
    if (i.status !== 'draft') throw new HttpError(400, 'Seuls les brouillons peuvent être supprimés');
    db.run('DELETE FROM invoices WHERE id = ?', i.id);
    res.json({ ok: true });
  });

  r.post('/:id/issue', (req, res) => {
    const i = findOwned(db, 'invoices', req.params.id, req.orgId);
    if (i.status !== 'draft') throw new HttpError(400, 'Facture déjà émise');
    if (!db.get('SELECT id FROM invoice_lines WHERE invoice_id = ?', i.id)) throw new HttpError(400, 'La facture ne contient aucune ligne');
    db.tx(() => {
      inv.assignNumber(db, req.orgId, i.id, i.issue_date);
      db.update('invoices', { status: 'issued' }, { id: i.id });
    });
    res.json(full(i.id));
  });

  r.post('/:id/pay', (req, res) => {
    const i = findOwned(db, 'invoices', req.params.id, req.orgId);
    if (i.status !== 'issued') throw new HttpError(400, 'Seule une facture émise peut être marquée payée');
    db.update('invoices', { status: 'paid', paid_at: req.body.paid_at || today() }, { id: i.id });
    res.json(full(i.id));
  });

  r.post('/:id/cancel', (req, res) => {
    const i = findOwned(db, 'invoices', req.params.id, req.orgId);
    if (i.status === 'draft') throw new HttpError(400, 'Supprimez simplement le brouillon');
    db.update('invoices', { status: 'cancelled' }, { id: i.id });
    res.json(full(i.id));
  });

  r.get('/:id/print', (req, res) => {
    const i = full(findOwned(db, 'invoices', req.params.id, req.orgId).id);
    res.type('html').send(invoiceHtml(org(req), i, i.lines, i.totals));
  });

  r.post('/:id/email', async (req, res) => {
    const i = full(findOwned(db, 'invoices', req.params.id, req.orgId).id);
    if (i.status === 'draft') throw new HttpError(400, 'Émettez la facture avant de l\'envoyer');
    if (!i.client_email) throw new HttpError(400, 'Aucune adresse e-mail client');
    const o = org(req);
    const body = `Bonjour,\n\nVeuillez trouver ci-dessous le détail de la facture ${i.number} d'un montant de ${eur(i.total_ttc)} TTC, à régler avant le ${frShort(i.due_date)}.\n\n${i.lines.map((l) => `- ${l.description} : ${eur(l.total_ht)} HT`).join('\n')}\n\nTotal HT : ${eur(i.total_ht)}\nTVA : ${eur(i.total_vat)}\nTotal TTC : ${eur(i.total_ttc)}\n${o.iban ? `\nIBAN : ${o.iban}\n` : ''}\nCordialement,\n${o.name}`;
    const out = await deliver(o, { channel: 'email', recipient: i.client_email, subject: `Facture ${i.number} – ${o.name}`, body });
    res.json({ ok: true, status: out.status, info: out.info || null });
  });

  /** Monthly owner statement: commissions + cleaning + services. */
  r.post('/owner-statement', (req, res) => {
    const { owner_id, period_start, period_end } = req.body || {};
    const owner = findOwned(db, 'owners', owner_id, req.orgId);
    if (!isDay(period_start) || !isDay(period_end) || diffDays(period_start, period_end) < 0) throw new HttpError(400, 'Période invalide');
    const o = org(req);
    const { lines, summary } = inv.ownerStatementLines(db, req.orgId, owner.id, period_start, period_end, o.vat_rate);
    if (!lines.length) throw new HttpError(400, 'Aucune prestation à facturer sur cette période');
    const issue = today(o.tz_offset);
    const id = db.tx(() => {
      const id = db.insert('invoices', {
        org_id: req.orgId, kind: 'owner', owner_id: owner.id, client_name: owner.name, client_address: owner.address,
        client_email: owner.email, issue_date: issue, due_date: inv.dueDate(issue, o.payment_terms_days),
        period_start, period_end, status: 'draft',
        notes: `Relevé de gestion : ${summary.bookings} séjour(s), revenus locatifs nets ${eur(summary.rental_income)}.`,
      });
      inv.saveLines(db, id, lines);
      return id;
    });
    res.status(201).json({ ...full(id), summary });
  });

  /** Guest invoice for a direct booking. */
  r.post('/from-booking/:bookingId', (req, res) => {
    const b = findOwned(db, 'bookings', req.params.bookingId, req.orgId);
    const g = b.guest_id ? db.get('SELECT * FROM guests WHERE id = ?', b.guest_id) : null;
    const p = db.get('SELECT * FROM properties WHERE id = ?', b.property_id);
    const o = org(req);
    const nights = diffDays(b.checkin_date, b.checkout_date);
    const rent = inv.round2(b.total_amount - b.cleaning_fee - b.tourist_tax);
    // Furnished tourist rentals: VAT exempt unless para-hotel services are provided (art. 261 D-4° CGI).
    const lines = [{ description: `Hébergement ${p.name} – ${nights} nuit(s) du ${frShort(b.checkin_date)} au ${frShort(b.checkout_date)}`, quantity: nights || 1, unit_price: inv.round2(rent / (nights || 1)), vat_rate: 0 }];
    if (b.cleaning_fee > 0) lines.push({ description: 'Frais de ménage', quantity: 1, unit_price: inv.round2(b.cleaning_fee / (1 + o.vat_rate / 100)), vat_rate: o.vat_rate });
    if (b.tourist_tax > 0) lines.push({ description: 'Taxe de séjour', quantity: 1, unit_price: b.tourist_tax, vat_rate: 0 });
    const issue = today(o.tz_offset);
    const id = db.tx(() => {
      const id = db.insert('invoices', {
        org_id: req.orgId, kind: 'guest', guest_id: b.guest_id, booking_id: b.id,
        client_name: g ? [g.first_name, g.last_name].filter(Boolean).join(' ') : 'Client', client_email: g?.email,
        issue_date: issue, due_date: issue, period_start: b.checkin_date, period_end: b.checkout_date, status: 'draft',
      });
      inv.saveLines(db, id, lines);
      return id;
    });
    res.status(201).json(full(id));
  });

  return r;
};

module.exports.invoiceHtml = invoiceHtml;
