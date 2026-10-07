'use strict';
// Demo build: messages are never really sent.
async function deliver(org, message) {
  if (message.channel !== 'email') return { status: 'simulated', info: `Démo : ${message.channel} non connecté, message à envoyer manuellement` };
  if (!message.recipient) throw new Error('Aucune adresse e-mail pour ce voyageur');
  return { status: 'simulated', info: 'Version de démonstration : aucun e-mail réellement envoyé' };
}
module.exports = { deliver, smtpConfig: () => null };
