'use strict';
// Builds a single self-contained HTML page of the app (frontend + API + SQLite
// running in the browser) for online testing: node demo/build.js
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const dataUri = (f) => `data:image/png;base64,${fs.readFileSync(path.join(root, 'public/img', f)).toString('base64')}`;
const ASSETS = { '/img/logo.png': dataUri('logo.png'), '/img/logo-256.png': dataUri('logo-256.png') };
const shim = (f) => path.join(__dirname, 'shims', f);

const plugin = {
  name: 'demo',
  setup(b) {
    const map = {
      express: shim('express.js'), 'node:sqlite': shim('sqlite.js'), 'node:crypto': shim('crypto.js'),
      'node:path': shim('empty.js'), 'node:fs': shim('empty.js'), fs: shim('empty.js'), path: shim('empty.js'), crypto: shim('empty.js'), nodemailer: shim('empty.js'),
    };
    b.onResolve({ filter: /^(express|node:sqlite|node:crypto|node:path|node:fs|fs|path|crypto|nodemailer)$/ }, (a) => ({ path: map[a.path] }));
    b.onResolve({ filter: /(^\.\/mailer|\/lib\/mailer)$/ }, () => ({ path: shim('mailer.js') }));
    b.onLoad({ filter: /(public\/js\/.*|src\/routes\/invoices)\.js$/ }, (a) => {
      let s = fs.readFileSync(a.path, 'utf8');
      for (const [k, v] of Object.entries(ASSETS)) s = s.split(k).join(v);
      return { contents: s, loader: 'js' };
    });
  },
};

(async () => {
  const out = await esbuild.build({
    entryPoints: [path.join(__dirname, 'entry.js')], bundle: true, write: false, format: 'iife',
    platform: 'browser', target: 'es2020', minify: true, plugins: [plugin], logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
  });
  const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = fs.readFileSync(path.join(root, 'public/css/app.css'), 'utf8');
  const html = `<title>Sakura Palm Conciergerie</title>
<meta name="theme-color" content="#2c3a1e">
<link rel="icon" type="image/png" href="${dataUri('favicon.png')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap">
<style>
${css}
:root { color-scheme: light; }
html, body { background: var(--bg); color: var(--text); }
.demo-banner { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(10px + env(safe-area-inset-bottom, 0px)); z-index: 70; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center;
  background: var(--palm); color: #f3ead8; border: 1px solid var(--gold); border-radius: 99px; padding: 6px 8px 6px 16px; font-size: 12px; box-shadow: 0 6px 18px rgba(0,0,0,.18); max-width: calc(100% - 32px); }
@media (max-width: 600px) { .demo-banner .long { display: none; } .demo-banner { left: auto; right: 12px; transform: none; } }
.demo-banner button { background: var(--gold); border-color: var(--gold); color: var(--palm-d); padding: 4px 12px; font-size: 12px; border-radius: 99px; }
</style>
<div id="app"><div class="boot">Chargement de Sakura Palm Conciergerie…</div></div>
<div id="modal-root"></div>
<div id="toasts"></div>
<script>
${js}
</script>
`;
  const dist = path.join(__dirname, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'sakura-palm-conciergerie.html'), html);
  console.log(`demo/dist/sakura-palm-conciergerie.html (${(html.length / 1024 / 1024).toFixed(2)} Mo)`);
})().catch((e) => { console.error(e); process.exit(1); });
