'use strict';
// Printable welcome card (A5, recto/verso) left in the accommodation.
const QRCode = require('qrcode');
const { frLong, diffDays } = require('./dates');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

/** Wi-Fi QR code (scan = automatic connection) as inline SVG. */
function wifiQr(ssid, password) {
  const q = (v) => String(v).replace(/([\\;,:"])/g, '\\$1');
  const text = `WIFI:T:${password ? 'WPA' : 'nopass'};S:${q(ssid)};${password ? `P:${q(password)};` : ''};`;
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 4} ${n + 4}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="QR code Wi-Fi"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#2c3a1e"/></svg>`;
}

const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function enLong(s) {
  if (!s) return '';
  const d = new Date(`${s}T12:00:00Z`);
  return `${EN_DAYS[d.getUTCDay()]} ${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const TEXT = {
  fr: {
    lang: 'fr', colon: ' :', welcome: 'Bienvenue', home: 'Bienvenue chez vous',
    stay: (a, b, n) => `Du ${a} au ${b} · ${n} nuit${n > 1 ? 's' : ''}`,
    intro: 'Tout a été préparé avant votre arrivée, pour que vous n\'ayez rien à demander. Installez-vous : pendant votre séjour, cette maison est la vôtre.',
    sign: 'L\'équipe Sakura Palm', wifi: 'Wi-Fi', network: 'Réseau', password: 'Mot de passe', scan: 'Scannez pour vous connecter',
    times: 'Horaires', arrival: 'Arrivée à partir de', departure: 'Départ avant',
    leaving: 'Le jour du départ', leaveList: ['Laisser les clés à l\'endroit convenu', 'Fermer fenêtres et volets', 'Éteindre climatisation et lumières', 'Sortir les poubelles', 'Laisser la vaisselle propre'],
    good: 'Bon à savoir', parking: 'Parking', contact: 'Une question, un besoin ?', contactText: 'Écrivez-nous ou appelez-nous, nous répondons vite.',
    emergency: 'Urgences', emergencyList: '112 urgences · 15 SAMU · 17 police · 18 pompiers',
    region: 'Sud & Ouest de La Réunion', print: 'Imprimer (A5 recto-verso)',
    discover: 'À découvrir', discoverList: ['Le lagon de l\'Hermitage, pour nager avec les poissons', 'Le marché forain de Saint-Pierre, le samedi matin', 'Le lever du soleil au Piton de la Fournaise', 'Le Cap Méchant et la côte sauvage du Sud'],
  },
  en: {
    lang: 'en', colon: ':', welcome: 'Welcome', home: 'Welcome home',
    stay: (a, b, n) => `${a} to ${b} · ${n} night${n > 1 ? 's' : ''}`,
    intro: 'Everything was prepared before you arrived, so that you would not need to ask for anything. Settle in: for the length of your stay, this home is yours.',
    sign: 'The Sakura Palm team', wifi: 'Wi-Fi', network: 'Network', password: 'Password', scan: 'Scan to connect',
    times: 'Times', arrival: 'Check-in from', departure: 'Check-out before',
    leaving: 'On departure day', leaveList: ['Leave the keys where agreed', 'Close windows and shutters', 'Switch off air conditioning and lights', 'Take out the rubbish', 'Leave the dishes clean'],
    good: 'Good to know', parking: 'Parking', contact: 'A question, a need?', contactText: 'Message or call us, we answer quickly.',
    emergency: 'Emergencies', emergencyList: '112 emergency · 15 ambulance · 17 police · 18 fire',
    region: 'South & West of Reunion Island', print: 'Print (A5, both sides)',
    discover: 'Worth discovering', discoverList: ['The Hermitage lagoon, to swim with the fish', 'Saint-Pierre street market, on Saturday morning', 'Sunrise at Piton de la Fournaise volcano', 'Cap Méchant and the wild south coast'],
  },
};

const PETAL = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3c7 6 11 13 8 21-2 6-6 9-8 13-2-4-6-7-8-13C9 16 13 9 20 3z" fill="#f0c4cf"/><path d="M20 8c2 8 2 18 0 27" stroke="#e5a3b4" stroke-width=".8" fill="none"/></svg>';

/**
 * ctx: { property, org, booking?, guest? } — without booking the card is generic.
 */
function welcomeCardHtml({ property, org, booking, guest }) {
  const t = TEXT[guest && guest.language === 'en' ? 'en' : 'fr'];
  const name = guest && guest.first_name;
  const fmt = t.lang === 'en' ? enLong : frLong;
  const nights = booking ? diffDays(booking.checkin_date, booking.checkout_date) : 0;
  const stay = booking ? t.stay(fmt(booking.checkin_date).replace(/ \d{4}$/, ''), fmt(booking.checkout_date).replace(/ \d{4}$/, ''), nights) : '';
  const qr = property.wifi_name ? wifiQr(property.wifi_name, property.wifi_password) : '';
  const extras = [
    property.house_rules && `<p>${nl2br(property.house_rules)}</p>`,
    property.parking_info && `<p><b>${t.parking}${t.colon}</b> ${esc(property.parking_info)}</p>`,
  ].filter(Boolean).join('');

  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><title>${esc(`${t.welcome} – ${property.name}`)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500&display=swap">
<style>
:root { --palm:#2c3a1e; --gold:#c49e5c; --gold-d:#9e783e; --rose:#a9504a; --sakura:#e9b9c7; --cream:#f8f2e8; --ink:#33362a; --muted:#7a7466;
  --serif:"Cormorant Garamond",Georgia,serif; --caps:"Cinzel",Georgia,serif; --sans:"Jost","Helvetica Neue",Arial,sans-serif; }
@page { size: A5; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #e9e3d8; color: var(--ink); font-family: var(--sans); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.bar { display: flex; justify-content: center; padding: 14px; }
.bar button { font: 500 14px var(--sans); background: var(--palm); color: #fff; border: 0; border-radius: 99px; padding: 9px 20px; cursor: pointer; }
.sheets { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; padding: 0 16px 32px; }
.page { width: 148mm; height: 210mm; background: var(--cream); position: relative; overflow: hidden; box-shadow: 0 10px 30px rgba(44,58,30,.18);
  padding: 13mm 12mm; display: flex; flex-direction: column; }
.page::before { content: ""; position: absolute; inset: 5mm; border: .5mm solid var(--gold); pointer-events: none; }
.page::after { content: ""; position: absolute; inset: 6.4mm; border: .2mm solid rgba(196,158,92,.55); pointer-events: none; }
.petal { position: absolute; width: 9mm; opacity: .85; }
.petal.a { top: 12mm; left: 11mm; transform: rotate(-25deg); } .petal.b { top: 34mm; right: 12mm; width: 7mm; transform: rotate(40deg); }
.petal.c { bottom: 26mm; left: 14mm; width: 6mm; transform: rotate(110deg); } .petal.d { bottom: 14mm; right: 16mm; transform: rotate(-70deg); }
/* Recto */
.recto { align-items: center; text-align: center; justify-content: center; }
.logo { width: 46mm; height: 46mm; border-radius: 50%; box-shadow: 0 2mm 6mm rgba(44,58,30,.18); }
.hello { font: 500 34pt/1 var(--serif); color: var(--palm); margin: 8mm 0 0; letter-spacing: .01em; }
.guest { font: italic 500 22pt/1.1 var(--serif); color: var(--rose); margin: 2mm 0 0; }
.place { font: 500 10pt var(--caps); letter-spacing: .14em; color: var(--gold-d); margin: 4mm 0 0; text-transform: uppercase; }
.stay { font: 400 9.5pt var(--sans); color: var(--muted); margin: 2mm 0 0; }
.rule { display: flex; align-items: center; gap: 3mm; color: var(--gold-d); font-size: 10pt; margin: 6mm 0 5mm; }
.rule::before, .rule::after { content: ""; width: 16mm; height: .3mm; background: var(--gold); }
.intro { font: italic 500 13pt/1.45 var(--serif); color: var(--ink); max-width: 100mm; margin: 0; text-wrap: balance; }
.sign { font: 500 11pt var(--serif); color: var(--palm); margin: 6mm 0 0; }
.motto { font: 500 7.5pt var(--caps); letter-spacing: .2em; color: var(--gold-d); margin-top: auto; padding-top: 6mm; }
/* Verso */
.verso { gap: 4.5mm; }
.verso h2 { font: 600 8pt var(--caps); letter-spacing: .18em; color: var(--gold-d); margin: 0 0 1.6mm; text-transform: uppercase; }
.wifi { display: grid; grid-template-columns: 1fr 30mm; gap: 5mm; align-items: center; background: #fffdf8; border: .3mm solid rgba(196,158,92,.6); border-radius: 3mm; padding: 4mm 5mm; }
.wifi dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 1.2mm 3mm; font-size: 9.5pt; }
.wifi dt { color: var(--muted); } .wifi dd { margin: 0; font-weight: 500; color: var(--palm); word-break: break-all; }
.wifi .qr svg { width: 30mm; height: 30mm; display: block; } .wifi .qr small { display: block; text-align: center; font-size: 6.5pt; color: var(--muted); margin-top: 1mm; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
.times p { margin: 0 0 1mm; font-size: 9pt; } .times b { font: 600 13pt var(--serif); color: var(--palm); }
ul { margin: 0; padding: 0; list-style: none; font-size: 8.6pt; line-height: 1.5; }
li::before { content: "✿"; color: var(--sakura); margin-right: 1.6mm; font-size: 7pt; }
.good p { margin: 0 0 1mm; font-size: 8.6pt; line-height: 1.45; }
.contact { margin-top: auto; text-align: center; border-top: .3mm solid rgba(196,158,92,.6); padding-top: 4mm; }
.contact .big { font: 600 15pt var(--serif); color: var(--palm); margin: 1mm 0 0; }
.contact p { margin: 0; font-size: 8.6pt; color: var(--muted); }
.sos { font-size: 7.5pt; color: var(--muted); text-align: center; margin-top: 2mm; }
@media print { html, body { background: none; } .bar { display: none; } .sheets { display: block; padding: 0; } .page { box-shadow: none; page-break-after: always; break-after: page; } }
</style></head><body>
<div class="bar"><button type="button" onclick="print()">${t.print}</button></div>
<div class="sheets">
<section class="page recto">
  <span class="petal a">${PETAL}</span><span class="petal b">${PETAL}</span><span class="petal c">${PETAL}</span><span class="petal d">${PETAL}</span>
  <img class="logo" src="/img/logo.png" alt="${esc(org.name)}">
  <p class="hello">${name ? t.welcome : t.home}</p>
  ${name ? `<p class="guest">${esc(name)}</p>` : ''}
  <p class="place">${esc(property.name)}</p>
  ${stay ? `<p class="stay">${esc(stay)}</p>` : ''}
  <div class="rule">おもてなし</div>
  <p class="intro">${t.intro}</p>
  <p class="sign">${t.sign}</p>
  <div class="motto">${esc(t.region)}</div>
</section>
<section class="page verso">
  <span class="petal b">${PETAL}</span><span class="petal c">${PETAL}</span>
  ${property.wifi_name ? `<div class="wifi"><div><h2>${t.wifi}</h2><dl><dt>${t.network}</dt><dd>${esc(property.wifi_name)}</dd>${property.wifi_password ? `<dt>${t.password}</dt><dd>${esc(property.wifi_password)}</dd>` : ''}</dl></div>
    <div class="qr">${qr}<small>${t.scan}</small></div></div>` : ''}
  <div class="cols">
    <div class="times"><h2>${t.times}</h2><p>${t.arrival}<br><b>${esc((booking && booking.arrival_time) || property.checkin_time)}</b></p><p>${t.departure}<br><b>${esc(property.checkout_time)}</b></p></div>
    <div><h2>${t.leaving}</h2><ul>${t.leaveList.map((x) => `<li>${x}</li>`).join('')}</ul></div>
  </div>
  ${extras ? `<div class="good"><h2>${t.good}</h2>${extras}</div>` : ''}
  <div><h2>${t.discover}</h2><ul>${t.discoverList.map((x) => `<li>${x}</li>`).join('')}</ul></div>
  <div class="contact"><h2>${t.contact}</h2><p>${t.contactText}</p>
    ${org.phone ? `<p class="big">${esc(org.phone)}</p>` : ''}${org.email ? `<p>${esc(org.email)}</p>` : ''}
    <p class="sos"><b>${t.emergency}${t.colon}</b> ${t.emergencyList}</p></div>
</section>
</div></body></html>`;
}

module.exports = { welcomeCardHtml, wifiQr };
