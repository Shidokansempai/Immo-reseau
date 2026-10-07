'use strict';
const { diffDays, frLong, frShort } = require('./dates');

/** Variables available in message templates, with a description for the UI. */
const VARIABLES = {
  prenom: 'Prénom du voyageur',
  nom: 'Nom du voyageur',
  logement: 'Nom du logement',
  adresse: 'Adresse complète du logement',
  ville: 'Commune du logement',
  date_arrivee: 'Date d\'arrivée (ex : vendredi 9 octobre 2026)',
  date_depart: 'Date de départ',
  date_arrivee_courte: 'Date d\'arrivée (jj/mm/aaaa)',
  date_depart_courte: 'Date de départ (jj/mm/aaaa)',
  heure_arrivee: 'Heure d\'arrivée à partir de',
  heure_depart: 'Heure de départ au plus tard',
  nuits: 'Nombre de nuits',
  voyageurs: 'Nombre de voyageurs',
  code_boite: 'Code de la boîte à clés',
  wifi_nom: 'Nom du réseau Wi-Fi',
  wifi_mdp: 'Mot de passe Wi-Fi',
  instructions_acces: 'Instructions d\'accès',
  reglement: 'Règlement intérieur',
  parking: 'Informations parking',
  montant: 'Montant total du séjour',
  reference: 'Référence de réservation',
  conciergerie: 'Nom de la conciergerie',
  conciergerie_tel: 'Téléphone de la conciergerie',
  conciergerie_email: 'E-mail de la conciergerie',
};

function money(n) {
  return `${Number(n || 0).toFixed(2).replace('.', ',')} €`;
}

/** Builds the variable map for a booking context. */
function buildContext({ booking = {}, guest = {}, property = {}, org = {} }) {
  const nights = booking.checkin_date && booking.checkout_date ? diffDays(booking.checkin_date, booking.checkout_date) : '';
  return {
    prenom: guest.first_name || '',
    nom: guest.last_name || '',
    logement: property.name || '',
    adresse: [property.address, property.city].filter(Boolean).join(', '),
    ville: property.city || '',
    date_arrivee: frLong(booking.checkin_date),
    date_depart: frLong(booking.checkout_date),
    date_arrivee_courte: frShort(booking.checkin_date),
    date_depart_courte: frShort(booking.checkout_date),
    heure_arrivee: booking.arrival_time || property.checkin_time || '',
    heure_depart: property.checkout_time || '',
    nuits: nights,
    voyageurs: (Number(booking.adults) || 0) + (Number(booking.children) || 0) || '',
    code_boite: property.keybox_code || '',
    wifi_nom: property.wifi_name || '',
    wifi_mdp: property.wifi_password || '',
    instructions_acces: property.access_instructions || '',
    reglement: property.house_rules || '',
    parking: property.parking_info || '',
    montant: booking.total_amount != null ? money(booking.total_amount) : '',
    reference: booking.external_ref || (booking.id ? `R${String(booking.id).padStart(5, '0')}` : ''),
    conciergerie: org.name || '',
    conciergerie_tel: org.phone || '',
    conciergerie_email: org.email || '',
  };
}

/** Replaces {{variable}} placeholders. Unknown variables are left untouched. */
function render(text, ctx) {
  if (!text) return '';
  return String(text).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key) => {
    const k = key.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ctx, k) ? String(ctx[k] ?? '') : m;
  });
}

module.exports = { VARIABLES, buildContext, render, money };
