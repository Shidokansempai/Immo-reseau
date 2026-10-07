// Demo entry: boots sql.js, the in-browser API, then the regular frontend.
import initSqlJs from 'sql.js/dist/sql-asm-memory-growth.js';
import { start, reset } from './backend.js';

function banner() {
  const el = document.createElement('div');
  el.className = 'demo-banner';
  el.innerHTML = '<span>Version de test<span class="long"> · données enregistrées dans ce navigateur · e-mails simulés</span></span><button type="button">Réinitialiser</button>';
  const btn = el.querySelector('button');
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) return reset();
    btn.dataset.armed = '1';
    btn.textContent = 'Confirmer la remise à zéro';
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Réinitialiser'; }, 4000);
  });
  document.body.append(el);
}

(async () => {
  globalThis.__SQL = await initSqlJs();
  start();
  banner();
  await import('../public/js/app.js');
})().catch((e) => {
  document.getElementById('app').innerHTML = `<div class="boot">Impossible de démarrer la démo : ${String(e.message || e)}</div>`;
  console.error(e);
});
