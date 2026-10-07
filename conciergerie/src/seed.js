'use strict';
// Creates a demo organisation with realistic data for La Réunion.
// Usage: npm run seed   (login: admin@demo.re / demo1234)
const path = require('node:path');
const { open } = require('./db');
const { hashPassword } = require('./auth');
const { createDefaultTemplates } = require('./defaults');
const { onBookingChanged } = require('./lib/automation');
const { addDays, today } = require('./lib/dates');

function seed(db, now = new Date()) {
  if (db.get('SELECT id FROM users WHERE email = ?', 'admin@demo.re')) {
    console.log('Données de démonstration déjà présentes.');
    return null;
  }
  const t = today('+04:00', now);
  const orgId = db.insert('organizations', {
    name: 'Sakura Palm Conciergerie', legal_form: 'SAS', siret: '123 456 789 00012', address: '25 rue du Général de Gaulle\n97430 Le Tampon',
    email: 'contact@sakurapalm-conciergerie.re', phone: '0262 00 00 00', iban: 'FR76 0000 0000 0000 0000 0000 000', vat_rate: 8.5,
    invoice_footer: 'Sakura Palm Conciergerie by Guestadom – Sud & Ouest de La Réunion – « Le geste avant la demande. »',
  });
  createDefaultTemplates(db, orgId);

  const pw = hashPassword('demo1234');
  const admin = db.insert('users', { org_id: orgId, name: 'Jules (Admin)', email: 'admin@demo.re', password_hash: pw, role: 'admin', color: '#c49e5c' });
  db.insert('users', { org_id: orgId, name: 'Sandrine Hoarau', email: 'manager@demo.re', password_hash: pw, role: 'manager', phone: '0692 11 22 33', color: '#7c3aed' });
  const a1 = db.insert('users', { org_id: orgId, name: 'Nathalie Grondin', email: 'agent@demo.re', password_hash: pw, role: 'agent', phone: '0692 44 55 66', hourly_rate: 13.5, color: '#db2777' });
  const a2 = db.insert('users', { org_id: orgId, name: 'Kévin Payet', email: 'agent2@demo.re', password_hash: pw, role: 'agent', phone: '0693 77 88 99', hourly_rate: 13, color: '#ea580c' });

  const o1 = db.insert('owners', { org_id: orgId, name: 'M. et Mme Técher', email: 'techer@example.re', phone: '0692 10 20 30', address: '4 chemin des Lilas\n97410 Saint-Pierre' });
  const o2 = db.insert('owners', { org_id: orgId, name: 'SCI Lagon Bleu', email: 'sci.lagonbleu@example.re', phone: '0262 33 44 55', address: '18 rue de la Plage\n97434 Saint-Gilles-les-Bains' });
  const o3 = db.insert('owners', { org_id: orgId, name: 'Mme Christine Fontaine', email: 'c.fontaine@example.fr', phone: '06 12 34 56 78', address: '12 avenue Foch\n75016 Paris' });

  const props = [
    { owner_id: o2, name: 'Villa Lagon – Saint-Gilles', type: 'Villa', address: '12 rue des Filaos', city: 'Saint-Gilles-les-Bains', capacity: 6, bedrooms: 3, cleaning_fee: 90, cleaning_duration_min: 180, commission_rate: 20, keybox_code: '1974', wifi_name: 'VillaLagon', wifi_password: 'soleil974', color: '#0891b2', access_instructions: 'Portail bleu : bip dans la boîte à clés, à gauche de la porte d\'entrée.', parking_info: '2 places dans la cour', house_rules: 'Non-fumeur, pas de fête, piscine non surveillée.' },
    { owner_id: o2, name: 'T2 Ermitage – vue mer', type: 'Appartement', address: '3 allée des Coraux, Rés. Les Brisants', city: 'Saint-Gilles-les-Bains', capacity: 4, bedrooms: 1, cleaning_fee: 55, commission_rate: 20, keybox_code: '2580', wifi_name: 'Ermitage-T2', wifi_password: 'lagon2024', color: '#16a34a', access_instructions: 'Bâtiment B, 2e étage, porte gauche.', parking_info: 'Place n°12 au sous-sol' },
    { owner_id: o1, name: 'Case créole – Saint-Pierre', type: 'Maison', address: '27 rue Marius et Ary Leblond', city: 'Saint-Pierre', capacity: 5, bedrooms: 2, cleaning_fee: 70, commission_rate: 18, keybox_code: '0974', wifi_name: 'CaseCreole', wifi_password: 'kreol974', color: '#ca8a04', parking_info: 'Stationnement dans la rue (gratuit le dimanche)' },
    { owner_id: o1, name: 'Studio Plaine des Cafres', type: 'Studio', address: '15 chemin Notre-Dame de la Paix', city: 'Le Tampon', capacity: 2, bedrooms: 0, cleaning_fee: 40, commission_rate: 20, keybox_code: '1121', wifi_name: 'Studio-PDC', wifi_password: 'volcan2632', color: '#9333ea', house_rules: 'Il fait frais le soir : couvertures dans le placard.' },
    { owner_id: o3, name: 'Gîte des Hauts – Cilaos', type: 'Gîte', address: '8 rue du Père Boiteau', city: 'Cilaos', capacity: 8, bedrooms: 4, cleaning_fee: 110, cleaning_duration_min: 210, commission_rate: 22, keybox_code: '3069', wifi_name: 'Gite-Cilaos', wifi_password: 'piton3070', color: '#dc2626', access_instructions: 'Route de Cilaos : prévoir 1h30 depuis Saint-Louis (400 virages !).' },
  ].map((p) => db.insert('properties', { org_id: orgId, checkin_time: '16:00', checkout_time: '10:00', ical_token: `demo${Math.random().toString(36).slice(2, 12)}`, ...p }));

  const guests = [
    ['Marie', 'Dupont', 'fr'], ['Thomas', 'Martin', 'fr'], ['Sophie', 'Bernard', 'fr'], ['John', 'Smith', 'en'],
    ['Laura', 'Rivière', 'fr'], ['Pierre', 'Lebon', 'fr'], ['Emma', 'Schneider', 'en'], ['Julien', 'Moreau', 'fr'],
    ['Camille', 'Robert', 'fr'], ['Nicolas', 'Petit', 'fr'],
  ].map(([f, l, lang], i) => db.insert('guests', { org_id: orgId, first_name: f, last_name: l, language: lang, email: `${f.toLowerCase()}.${l.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@example.com`, phone: `06 ${String(10 + i)} 00 00 ${String(10 + i)}` }));

  const B = [
    // [property, guest, checkin offset, nights, amount, source, adults, children]
    [0, 0, -12, 5, 1150, 'airbnb', 4, 2], [1, 1, -9, 4, 420, 'booking', 2, 0], [2, 2, -6, 3, 330, 'direct', 2, 1],
    [0, 3, -3, 5, 1290, 'airbnb', 5, 0], [1, 4, -1, 3, 360, 'direct', 2, 0], [3, 5, 0, 2, 150, 'booking', 2, 0],
    [4, 6, 0, 4, 780, 'abritel', 6, 2], [2, 7, 1, 6, 620, 'airbnb', 3, 1], [3, 8, 4, 3, 210, 'direct', 1, 0],
    [1, 9, 5, 7, 840, 'airbnb', 2, 2], [0, 1, 6, 7, 1750, 'direct', 6, 0], [4, 2, 10, 3, 590, 'booking', 4, 0],
  ];
  const bookingIds = B.map(([pi, gi, off, nights, amount, source, adults, children]) => {
    const prop = db.get('SELECT cleaning_fee FROM properties WHERE id = ?', props[pi]);
    const checkin = addDays(t, off);
    const checkout = addDays(checkin, nights);
    const status = checkout <= t ? 'checked_out' : (checkin < t ? 'checked_in' : 'confirmed');
    return db.insert('bookings', {
      org_id: orgId, property_id: props[pi], guest_id: guests[gi], source, checkin_date: checkin, checkout_date: checkout,
      adults, children, total_amount: amount, cleaning_fee: prop.cleaning_fee, platform_fee: source === 'direct' ? 0 : Math.round(amount * 0.03),
      tourist_tax: Math.round(adults * nights * 1.2 * 100) / 100, status, external_ref: source === 'airbnb' ? `HM${Math.random().toString(36).slice(2, 10).toUpperCase()}` : null,
    });
  });
  db.insert('bookings', { org_id: orgId, property_id: props[3], source: 'direct', checkin_date: addDays(t, 14), checkout_date: addDays(t, 17), status: 'blocked', notes: 'Travaux peinture' });

  for (const id of bookingIds) onBookingChanged(db, id, now);

  // Assign interventions and close the past ones.
  const ints = db.all('SELECT * FROM interventions WHERE org_id = ? ORDER BY scheduled_date', orgId);
  ints.forEach((i, idx) => {
    const assignee = i.scheduled_date > addDays(t, 3) && idx % 3 === 0 ? null : (idx % 2 ? a1 : a2);
    const done = i.scheduled_date < t;
    db.update('interventions', { assigned_to: assignee, status: done ? 'terminee' : 'a_faire', completed_at: done ? new Date(`${i.scheduled_date}T12:00:00+04:00`).toISOString() : null }, { id: i.id });
    if (done && assignee) {
      const start = new Date(`${i.scheduled_date}T${i.scheduled_time || '10:00'}:00+04:00`);
      db.insert('time_entries', { org_id: orgId, user_id: assignee, intervention_id: i.id, clock_in: start.toISOString(), clock_out: new Date(start.getTime() + i.duration_min * 60000 + (idx % 4) * 600000).toISOString() });
    }
  });
  db.insert('interventions', { org_id: orgId, property_id: props[4], type: 'maintenance', title: 'Réparation chauffe-eau solaire', scheduled_date: addDays(t, -4), scheduled_time: '09:00', duration_min: 90, assigned_to: a2, status: 'terminee', billable_amount: 85, report: 'Purge et remplacement du joint. OK.' });
  db.insert('interventions', { org_id: orgId, property_id: props[0], type: 'inspection', title: 'Contrôle piscine + jardin', scheduled_date: addDays(t, 2), scheduled_time: '08:30', duration_min: 60, assigned_to: a1 });

  // Mark messages that should already be out as delivered (simulation).
  db.run("UPDATE messages SET status = 'simulated', sent_at = scheduled_at, error = 'Données de démonstration' WHERE org_id = ? AND status = 'scheduled' AND scheduled_at <= ?", orgId, now.toISOString());
  const current = bookingIds[3];
  const g = db.get('SELECT guest_id FROM bookings WHERE id = ?', current);
  db.insert('messages', { org_id: orgId, booking_id: current, guest_id: g.guest_id, direction: 'in', channel: 'whatsapp', status: 'received', read: 0, sent_at: new Date(now.getTime() - 3600000).toISOString(), body: 'Hello! The pool looks great but we cannot find the beach towels. Could you help? Thanks, John' });
  db.insert('messages', { org_id: orgId, booking_id: bookingIds[4], guest_id: guests[4], direction: 'in', channel: 'email', status: 'received', read: 0, sent_at: new Date(now.getTime() - 7200000).toISOString(), body: 'Bonjour, serait-il possible de partir à 12h au lieu de 10h le jour du départ ? Merci beaucoup, Laura' });

  console.log(`Démo créée (organisation #${orgId}). Connexion : admin@demo.re / demo1234 – agent : agent@demo.re / demo1234`);
  return { orgId, admin };
}

if (require.main === module) {
  const db = open(process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'conciergerie.db'));
  seed(db);
  db.close();
}

module.exports = { seed };
