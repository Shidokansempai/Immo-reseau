import { html, str, api, on, $, fields, readForm, attempt } from '../ui.js';
import { topbar } from '../app.js';

export default async function settingsView(el) {
  const s = await api.get('/settings');
  el.innerHTML = str(html`${topbar('Paramètres')}
    <form id="org" onsubmit="return false">
      <div class="card"><h2>🏢 Entreprise</h2>${fields([
        { name: 'name', label: 'Nom commercial', required: true },
        { name: 'legal_form', label: 'Forme juridique', placeholder: 'SAS, EURL, EI…' },
        { name: 'siret', label: 'SIRET' },
        { name: 'vat_number', label: 'N° TVA intracommunautaire' },
        { name: 'address', label: 'Adresse', type: 'textarea', rows: 2, full: true },
        { name: 'email', label: 'E-mail de contact (réponses voyageurs)', type: 'email' },
        { name: 'phone', label: 'Téléphone' },
        { name: 'website', label: 'Site web' },
        { name: 'tz_offset', label: 'Fuseau horaire', type: 'select', options: [['+04:00', 'La Réunion / Maurice (UTC+4)'], ['+03:00', 'Mayotte (UTC+3)'], ['+01:00', 'Métropole hiver (UTC+1)'], ['+02:00', 'Métropole été (UTC+2)'], ['-04:00', 'Antilles (UTC-4)']] },
      ], s)}</div>
      <div class="card"><h2>🧾 Facturation</h2>${fields([
        { name: 'vat_rate', label: 'Taux de TVA par défaut (%)', type: 'number', step: '0.1', help: 'La Réunion : 8,5 % (normal) · 2,1 % (réduit) · 0 % si franchise en base' },
        { name: 'payment_terms_days', label: 'Délai de paiement (jours)', type: 'number' },
        { name: 'invoice_prefix', label: 'Préfixe des factures' },
        { name: 'next_invoice_number', label: 'Prochain numéro', type: 'number', help: 'Numérotation continue obligatoire' },
        { name: 'iban', label: 'IBAN (affiché sur les factures)', full: true },
        { name: 'invoice_footer', label: 'Pied de facture (mentions légales)', type: 'textarea', rows: 2, full: true },
      ], s)}</div>
      <div class="card"><h2>✉️ Envoi des e-mails (SMTP)</h2>
        <p class="small muted" style="margin-top:-6px">Sans SMTP, les messages sont enregistrés en « simulation » dans l'historique. Compatible Gmail / Google Workspace (mot de passe d'application), OVH, Brevo, Office 365…
        ${s.smtp_env ? ' Un SMTP global est déjà configuré sur le serveur.' : ''}</p>
        ${fields([
          { name: 'smtp_host', label: 'Serveur', placeholder: 'smtp.gmail.com' },
          { name: 'smtp_port', label: 'Port', type: 'number', placeholder: '587' },
          { name: 'smtp_user', label: 'Utilisateur' },
          { name: 'smtp_pass', label: 'Mot de passe', type: 'password' },
          { name: 'smtp_from', label: 'Adresse d\'expédition', type: 'email' },
          { name: 'smtp_secure', label: 'Connexion SSL directe (port 465)', type: 'checkbox' },
        ], s)}
        <div class="row" style="margin-top:12px"><input type="email" data-test-to placeholder="Adresse de test" style="max-width:280px"><button type="button" data-test>Envoyer un e-mail de test</button></div>
      </div>
      <div class="row"><button class="primary lg" data-save>Enregistrer les paramètres</button></div>
    </form>
    <div class="card" style="margin-top:16px"><h2>🔒 Mon mot de passe</h2><form id="pw" onsubmit="return false" class="row">
      <input type="password" name="current" placeholder="Mot de passe actuel" style="max-width:220px"><input type="password" name="password" placeholder="Nouveau (8 caractères min.)" style="max-width:240px">
      <button data-pw>Changer</button></form></div>`);

  on(el, 'click', '[data-save]', async () => {
    const form = $('#org', el);
    if (!form.reportValidity()) return;
    await attempt(() => api.put('/settings', readForm(form)), 'Paramètres enregistrés');
  });
  on(el, 'click', '[data-test]', async () => {
    await attempt(() => api.put('/settings', readForm($('#org', el))));
    await attempt(() => api.post('/settings/test-email', { to: $('[data-test-to]', el).value || undefined }), 'E-mail de test envoyé ✅');
  });
  on(el, 'click', '[data-pw]', async () => {
    const f = $('#pw', el);
    await attempt(() => api.post('/auth/password', { current: f.current.value, password: f.password.value }), 'Mot de passe modifié');
    f.reset();
  });
}
