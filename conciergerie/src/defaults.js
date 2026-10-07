'use strict';
// Default message templates created for every new organisation.

const TEMPLATES = [
  {
    name: 'Confirmation de réservation', trigger: 'booking_confirmed', offset_days: 0, send_time: '09:00', sort_order: 1,
    subject: 'Votre séjour à {{logement}} est confirmé ✅',
    body: `Bonjour {{prenom}},

Merci pour votre réservation ! Votre séjour à {{logement}} ({{ville}}) est confirmé :

• Arrivée : {{date_arrivee}} à partir de {{heure_arrivee}}
• Départ : {{date_depart}} avant {{heure_depart}}
• {{nuits}} nuit(s) – {{voyageurs}} voyageur(s)

Quelques jours avant votre arrivée, nous vous enverrons toutes les informations d'accès.
Une question d'ici là ? Répondez simplement à ce message ou appelez-nous au {{conciergerie_tel}}.

À très bientôt à La Réunion !
L'équipe {{conciergerie}}`,
  },
  {
    name: 'Instructions d\'arrivée (J-2)', trigger: 'before_checkin', offset_days: 2, send_time: '10:00', sort_order: 2,
    subject: 'Votre arrivée à {{logement}} : toutes les infos pratiques 🔑',
    body: `Bonjour {{prenom}},

Votre arrivée approche ! Voici tout ce qu'il faut savoir pour le {{date_arrivee}} :

📍 Adresse : {{adresse}}
🕓 Arrivée à partir de {{heure_arrivee}}
🔑 Boîte à clés – code : {{code_boite}}
{{instructions_acces}}

🚗 Parking : {{parking}}
📶 Wi-Fi : {{wifi_nom}} – mot de passe : {{wifi_mdp}}

Pensez à nous indiquer votre heure d'arrivée estimée en répondant à ce message.
Bonne route !
L'équipe {{conciergerie}}`,
  },
  {
    name: 'Message de bienvenue (jour J)', trigger: 'checkin_day', offset_days: 0, send_time: '17:30', sort_order: 3,
    subject: 'Bienvenue à {{logement}} 🌺',
    body: `Bonjour {{prenom}},

Bienvenue chez vous pour les prochains jours ! Nous espérons que l'installation s'est bien passée.

Petit rappel :
📶 Wi-Fi : {{wifi_nom}} / {{wifi_mdp}}
📋 Règlement : {{reglement}}

Nos bons plans du moment : un lever de soleil au Piton de la Fournaise, une baignade au lagon de l'Hermitage, un carry au feu de bois dans les Hauts… n'hésitez pas à nous demander nos adresses !

Nous restons joignables au {{conciergerie_tel}} pour tout besoin.
Excellent séjour,
L'équipe {{conciergerie}}`,
  },
  {
    name: 'Comment se passe le séjour ? (J+1)', trigger: 'during_stay', offset_days: 1, send_time: '11:00', sort_order: 4,
    subject: 'Tout se passe bien à {{logement}} ?',
    body: `Bonjour {{prenom}},

Nous voulions simplement prendre de vos nouvelles : tout se passe bien dans le logement ?
S'il manque quoi que ce soit ou si quelque chose ne fonctionne pas, dites-le-nous : nous intervenons rapidement.

Bonne journée sous le soleil réunionnais ☀️
L'équipe {{conciergerie}}`,
  },
  {
    name: 'Préparation du départ (veille)', trigger: 'before_checkout', offset_days: 1, send_time: '18:00', sort_order: 5,
    subject: 'Votre départ demain – quelques informations',
    body: `Bonjour {{prenom}},

Votre séjour touche déjà à sa fin. Pour le départ du {{date_depart}} avant {{heure_depart}} :

✔️ Laisser les clés dans la boîte à clés (code {{code_boite}})
✔️ Fermer fenêtres, volets et portes
✔️ Éteindre la climatisation et les lumières
✔️ Déposer les poubelles dans les conteneurs prévus
✔️ Laisser la vaisselle propre

Besoin d'un départ tardif ? Demandez-nous, nous ferons notre possible.
Merci et bon retour !
L'équipe {{conciergerie}}`,
  },
  {
    name: 'Remerciement et avis (après départ)', trigger: 'after_checkout', offset_days: 1, send_time: '10:00', sort_order: 6,
    subject: 'Merci pour votre séjour à {{logement}} 🙏',
    body: `Bonjour {{prenom}},

Merci d'avoir séjourné à {{logement}} ! Nous espérons que vous garderez un beau souvenir de La Réunion.

Votre avis compte énormément pour nous : quelques mots sur la plateforme de réservation nous aident beaucoup.
Et pour votre prochain séjour, réservez en direct en nous contactant au {{conciergerie_tel}} ou à {{conciergerie_email}}.

À bientôt,
L'équipe {{conciergerie}}`,
  },
  {
    name: 'Welcome message (English)', trigger: 'checkin_day', offset_days: 0, send_time: '17:30', language: 'en', sort_order: 7,
    subject: 'Welcome to {{logement}} 🌺',
    body: `Hello {{prenom}},

Welcome! We hope you have settled in comfortably.

📶 Wi-Fi: {{wifi_nom}} / {{wifi_mdp}}
🕙 Check-out: {{date_depart}} before {{heure_depart}}

Feel free to contact us at {{conciergerie_tel}} if you need anything.
Enjoy Reunion Island!
{{conciergerie}} team`,
  },
  {
    name: 'Relance : heure d\'arrivée', trigger: 'manual', offset_days: 0, send_time: '10:00', sort_order: 8,
    subject: 'Votre heure d\'arrivée à {{logement}}',
    body: `Bonjour {{prenom}},

Afin d'organiser au mieux votre accueil le {{date_arrivee}}, pourriez-vous nous indiquer votre heure d'arrivée approximative ?

Merci et à très vite,
L'équipe {{conciergerie}}`,
  },
  {
    name: 'Objet oublié', trigger: 'manual', offset_days: 0, send_time: '10:00', sort_order: 9,
    subject: 'Objet retrouvé après votre séjour',
    body: `Bonjour {{prenom}},

Lors du ménage de {{logement}}, notre équipe a retrouvé un objet qui pourrait vous appartenir.
Dites-nous si vous souhaitez que nous vous le renvoyions (frais de port à votre charge).

Bien cordialement,
L'équipe {{conciergerie}}`,
  },
];

function createDefaultTemplates(db, orgId) {
  for (const t of TEMPLATES) {
    db.insert('message_templates', { language: 'fr', channel: 'email', active: 1, ...t, org_id: orgId });
  }
}

module.exports = { TEMPLATES, createDefaultTemplates };
