import { html, str, api, $, readForm, toast } from '../ui.js';

export function renderAuth(root, signup, onDone) {
  root.innerHTML = str(html`<div class="auth"><div class="card">
    <h1>🌴 Kaz Conciergerie</h1>
    <p class="muted" style="margin-top:0">${signup ? 'Créez l\'espace de votre conciergerie' : 'Gestion de conciergerie & locations saisonnières'}</p>
    <form id="f" style="display:grid;gap:12px;margin-top:18px">
      ${signup ? html`
        <label class="f">Nom de la conciergerie<input name="org_name" required placeholder="Ma Conciergerie 974"></label>
        <label class="f">Votre nom<input name="name" required></label>` : ''}
      <label class="f">E-mail<input name="email" type="email" required autocomplete="username"></label>
      <label class="f">Mot de passe<input name="password" type="password" required minlength="${signup ? 8 : 1}" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
      <button class="primary lg" type="submit">${signup ? 'Créer mon compte' : 'Se connecter'}</button>
    </form>
    <p class="small" style="text-align:center;margin-top:16px">
      ${signup ? html`Déjà un compte ? <a href="#/login">Se connecter</a>` : html`Nouvelle conciergerie ? <a href="#/inscription">Créer un compte</a>`}
    </p>
    ${signup ? '' : html`<p class="small muted" style="text-align:center">Démo : admin@demo.re / demo1234 · agent@demo.re / demo1234</p>`}
  </div></div>`);
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    try {
      await api.post(signup ? '/auth/register' : '/auth/login', readForm(e.target));
      location.hash = '';
      await onDone();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
}
