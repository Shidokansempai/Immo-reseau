// Rend la scène 3D image par image (Chromium headless) et encode en MP4.
// Usage : node render.mjs <kids|adults> [t1 t2 ...]   (temps = aperçus JPEG)
import { createRequire } from 'module';
import { spawn, execFileSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');           // dojo/video (pour /fonts)
const version = process.argv[2] || 'adults';
const previews = process.argv.slice(3).map(Number);
const FPS = 30, DURATION = 20;
const OUT = path.join(ROOT, `lundi-kickboxing-3d-${version === 'kids' ? 'enfants' : 'ados-adultes'}.mp4`);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ttf': 'font/ttf' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.goto(`http://127.0.0.1:${port}/3d/index.html?v=${version}`);
await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
const shot = async (t) => { await page.evaluate((t) => window.renderFrame(t), t); return page.screenshot({ type: 'jpeg', quality: 93 }); };

if (previews.length) {
  for (const t of previews) fs.writeFileSync(path.join(ROOT, `_preview_3d_${version}_${t.toFixed(2).padStart(5, '0')}.jpg`), await shot(t));
} else {
  const wav = OUT + '.wav';
  execFileSync('python3', [path.join(HERE, 'audio.py'), wav, version]);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', String(FPS), '-i', '-', '-i', wav,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', '-shortest', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = DURATION * FPS;
  for (let i = 0; i < total; i++) {
    const buf = await shot(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 100 === 0) console.log(version, `${i}/${total}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  fs.unlinkSync(wav);
  console.log('OK ->', OUT);
}
await browser.close();
server.close();
