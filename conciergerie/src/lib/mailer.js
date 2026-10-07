'use strict';
const nodemailer = require('nodemailer');

const transports = new Map();

/** SMTP settings of the organisation, falling back to environment variables. */
function smtpConfig(org) {
  const host = org.smtp_host || process.env.SMTP_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(org.smtp_port || process.env.SMTP_PORT || 587),
    secure: Boolean(org.smtp_host ? org.smtp_secure : process.env.SMTP_SECURE === 'true'),
    auth: (org.smtp_user || process.env.SMTP_USER)
      ? { user: org.smtp_user || process.env.SMTP_USER, pass: org.smtp_pass || process.env.SMTP_PASS }
      : undefined,
    from: org.smtp_from || process.env.SMTP_FROM || org.email,
  };
}

function transportFor(cfg) {
  const key = JSON.stringify(cfg);
  if (!transports.has(key)) {
    const { from, ...opts } = cfg;
    transports.set(key, nodemailer.createTransport(opts));
  }
  return transports.get(key);
}

function toHtml(text) {
  const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2937">${esc.replace(/\n/g, '<br>')}</div>`;
}

/**
 * Sends a message. Returns {status:'sent'} or {status:'simulated'} when no
 * provider is configured for the channel (the message is kept in the outbox),
 * and throws on delivery errors.
 */
async function deliver(org, message) {
  if (message.channel !== 'email') {
    // SMS / WhatsApp: plug a provider (Twilio, Brevo, OVH SMS...) here.
    return { status: 'simulated', info: `Canal ${message.channel} non connecté : message à envoyer manuellement` };
  }
  if (!message.recipient) throw new Error('Aucune adresse e-mail pour ce voyageur');
  const cfg = smtpConfig(org);
  if (!cfg) return { status: 'simulated', info: 'Aucun serveur SMTP configuré (mode simulation)' };
  await transportFor(cfg).sendMail({
    from: cfg.from ? `"${org.name}" <${cfg.from}>` : undefined,
    to: message.recipient,
    replyTo: org.email || undefined,
    subject: message.subject || org.name,
    text: message.body,
    html: toHtml(message.body),
  });
  return { status: 'sent' };
}

module.exports = { deliver, smtpConfig };
