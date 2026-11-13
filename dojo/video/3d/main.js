// Kickboxing du lundi — scène 3D animée style anime (toon shading + contours).
// Fighter Academy Karaté. Rendu image par image via window.renderFrame(t).
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

const VERSION = new URLSearchParams(location.search).get('v') || 'adults';
const CFG = {
  adults: {
    scale: 1.0, head: 1.0, accent: '#e0182d', glove: 0xd9162b,
    torso: 0x2a2d36, sleeve: null, legs: null, belt: 0xd9162b, shorts: 0x15161c, hair: 0x14141a,
    cap: 'LUNDI SOIR. LE DOJO T\'ATTEND.',
    aud: 'ADOS & ADULTES', words: ['CARDIO', 'TECHNIQUE', 'MENTAL D\'ACIER'],
    hook: 'PRÊT À TOUT DONNER ?',
  },
  kids: {
    scale: 0.7, head: 1.38, accent: '#ffce20', glove: 0xffc21a,
    torso: 0xf2f2ee, sleeve: 0xf2f2ee, legs: 0xf2f2ee, belt: 0xffc21a, shorts: null, hair: 0x2a1a10,
    cap: 'LUNDI, C\'EST KICKBOXING !',
    aud: 'ENFANTS', words: ['COURAGE', 'RESPECT', 'CONFIANCE'],
    hook: 'VIENS ESSAYER !',
  },
}[VERSION];

export const DURATION = 20;
const HITS = [ // t, type, amplitude du sac
  [3.8, 'L', 0.05], [4.5, 'R', 0.08], [5.5, 'L', 0.05], [5.9, 'R', 0.08],
  [8.0, 'K', 0.34], [11.7, 'L', 0.04], [13.2, 'L', 0.04], [13.55, 'R', 0.07],
];
const KICK_T = 8.0, FREEZE_END = 9.5;

// ------------------------------------------------------------------ utilitaires
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, s, d) => clamp((t - s) / d);
const eOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const eIO = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const eBack = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
const UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ rendu
await document.fonts.load('100px Anton'); await document.fonts.load('60px Bebas');
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1080, 1920, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const effect = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.03, 0.03, 0.05] });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1420);
scene.fog = new THREE.Fog(0x1a1420, 7, 15);
const camera = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.1, 50);

const grad = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra });
const noOutline = (m) => { m.userData.outlineParameters = { visible: false }; return m; };

// ------------------------------------------------------------------ dojo
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
{
  // tatami
  const tat = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#b9b27a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${90 + Math.random() * 50},40,0.10)`; g.fillRect(Math.random() * w, Math.random() * h, 60, 2); }
    g.strokeStyle = '#2b2a1c'; g.lineWidth = 16;
    g.strokeRect(0, 0, w / 2, h); g.strokeRect(w / 2, 0, w / 2, h / 2); g.strokeRect(w / 2, h / 2, w / 2, h / 2);
  });
  tat.wrapS = tat.wrapT = THREE.RepeatWrapping; tat.repeat.set(5, 5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), noOutline(toon(0xffffff, { map: tat })));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const wallTex = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#5a3d2a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.12})`; g.fillRect(x, 0, 60, h); g.fillStyle = '#2a1a10'; g.fillRect(x + 60, 0, 4, h); }
    g.fillStyle = '#2a1a10'; g.fillRect(0, h - 60, w, 60); g.fillRect(0, 0, w, 30);
  });
  wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(3, 1);
  const shoji = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#fff3d6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a2416'; g.lineWidth = 10;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); }
    for (let i = 0; i <= 5; i++) { g.beginPath(); g.moveTo(0, i * h / 5); g.lineTo(w, i * h / 5); g.stroke(); }
    g.lineWidth = 26; g.strokeRect(0, 0, w, h);
  });
  const banner = canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#f4efe0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8101e'; g.beginPath(); g.arc(w / 2, 210, 120, 0, 7); g.fill();
    g.fillStyle = '#111'; g.textAlign = 'center'; g.font = '110px Anton';
    ['FIGHTER', 'ACADEMY', 'KARATÉ'].forEach((s, i) => g.fillText(s, w / 2, 520 + i * 150));
    g.lineWidth = 14; g.strokeStyle = '#111'; g.strokeRect(7, 7, w - 14, h - 14);
  });
  const wallMat = noOutline(toon(0xffffff, { map: wallTex }));
  const mkWall = (x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.2), wallMat); m.position.set(x, 2.1, z); m.rotation.y = ry; scene.add(m); };
  mkWall(0, -4, 0); mkWall(0, 5.5, Math.PI); mkWall(5, 0, -Math.PI / 2); mkWall(-6, 0, Math.PI / 2);
  const shojiMat = noOutline(new THREE.MeshBasicMaterial({ map: shoji }));
  for (const x of [-3.6, -1.2, 3.4]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.4), shojiMat); m.position.set(x, 1.75, -3.98); scene.add(m); }
  for (const z of [-2.2, 0.6, 3.2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.4), shojiMat); m.position.set(-5.98, 1.75, z); m.rotation.y = Math.PI / 2; scene.add(m); }
  const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), noOutline(new THREE.MeshBasicMaterial({ map: banner })));
  bn.position.set(1.1, 2.3, -3.97); scene.add(bn);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), noOutline(toon(0x2a1c14)));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.2; scene.add(ceil);
  for (const z of [-2.5, 0, 2.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 0.25), toon(0x3a2416)); b.position.set(-0.5, 3.6, z); scene.add(b); }

  scene.add(new THREE.HemisphereLight(0xfff0dd, 0x40352c, 1.5));
  const key = new THREE.DirectionalLight(0xfff2dc, 2.4);
  key.position.set(-3.5, 6, 4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 16 });
  key.shadow.bias = -0.0005;
  scene.add(key);
}

// sac de frappe
const bag = new THREE.Group(); bag.position.set(1.2, 3.6, 0); scene.add(bag);
{
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.85), toon(0x777777)); chain.position.y = -0.925; bag.add(chain);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.15, 28), toon(0x1c1c22)); body.position.y = -2.45; body.castShadow = true; bag.add(body);
  for (const y of [-1.95, -2.95]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.09, 28), toon(0xc8101e)); r.position.y = y; bag.add(r); }
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, 7, 0, Math.PI / 2), toon(0x1c1c22)); top.position.y = -1.875; top.scale.y = 0.5; bag.add(top);
}
function bagTau(t, h) { // temps écoulé depuis l'impact, avec ralenti pendant le « bullet time »
  if (h !== KICK_T) return t - h;
  if (t < KICK_T) return -1;
  const slow = 0.12;
  return t < FREEZE_END ? (t - KICK_T) * slow : (FREEZE_END - KICK_T) * slow + (t - FREEZE_END);
}
function bagAngle(t) {
  let a = 0;
  for (const [h, , amp] of HITS) { const tau = bagTau(t, h); if (tau > 0) a += amp * Math.sin(3.4 * tau) * Math.exp(-0.8 * tau); }
  return a;
}

// ------------------------------------------------------------------ personnage (cinématique inverse)
const S = CFG.scale;
const fig = new THREE.Group(); fig.scale.setScalar(S); fig.position.x = (1 - S) * 1.0; scene.add(fig);
const skin = toon(0xf0b98d), M = {
  torso: toon(CFG.torso), sleeve: CFG.sleeve ? toon(CFG.sleeve) : skin, legs: CFG.legs ? toon(CFG.legs) : skin,
  glove: toon(CFG.glove), belt: toon(CFG.belt), hair: toon(CFG.hair), dark: toon(0x15161c),
};
const L = { ua: 0.29, fa: 0.25, th: 0.44, sh: 0.44, spine: 0.5, shW: 0.2, hipW: 0.105 };
function limb(r, len, mat) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat); m.castShadow = true; fig.add(m); return m; }
function place(m, a, b) { m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); }
function ik(a, target, l1, l2, pole) {
  const dir = target.clone().sub(a); const d = clamp(dir.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3); dir.normalize();
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return [a.clone().add(dir.clone().multiplyScalar(x)).add(perp.multiplyScalar(h)), a.clone().add(dir.multiplyScalar(d))];
}
const P = {};
for (const s of ['L', 'R']) {
  P['ua' + s] = limb(0.064, L.ua, M.sleeve); P['fa' + s] = limb(0.054, L.fa, skin);
  P['de' + s] = limb(0.082, 0.02, M.sleeve);
  P['th' + s] = limb(0.096, L.th, M.legs); P['sh' + s] = limb(0.07, L.sh, M.legs);
  if (CFG.shorts) P['so' + s] = limb(0.112, 0.3, toon(CFG.shorts));
  const g = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), M.glove); g.scale.set(1.2, 1, 1); g.castShadow = true; fig.add(g); P['gl' + s] = g;
  const cuff = limb(0.058, 0.05, toon(0xf4f4f4)); P['cu' + s] = cuff;
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), CFG.legs ? skin : skin); f.scale.set(1.7, 0.7, 0.9); f.castShadow = true; fig.add(f); P['ft' + s] = f;
}
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.27, 8, 20), M.torso); torso.castShadow = true; torso.matrixAutoUpdate = false; fig.add(torso);
const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.175, 20, 14), CFG.shorts ? toon(CFG.shorts) : M.legs); pelvis.matrixAutoUpdate = false; pelvis.castShadow = true; fig.add(pelvis);
const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.065, 24), M.belt); belt.matrixAutoUpdate = false; fig.add(belt);
const neckM = limb(0.045, 0.08, skin);
const head = new THREE.Group(); head.matrixAutoUpdate = false; fig.add(head);
{
  const hs = CFG.head;
  const sk = new THREE.Mesh(new THREE.SphereGeometry(0.115, 28, 20), skin); sk.scale.set(1, 1.1, 0.95); sk.castShadow = true; head.add(sk);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.124, 24, 18), M.hair); hair.position.set(-0.03, 0.03, 0); hair.scale.set(1, 1.05, 1); head.add(hair);
  const spikes = [[0.07, 0.115, 0, -1.0], [0.05, 0.12, 0.06, -0.8], [0.05, 0.12, -0.06, -0.8], [0.0, 0.14, 0.03, -0.2], [0.0, 0.14, -0.04, 0.1],
    [-0.07, 0.12, 0.05, 0.6], [-0.07, 0.12, -0.05, 0.6], [-0.12, 0.06, 0, 1.2], [0.085, 0.09, 0.05, -1.3], [0.085, 0.09, -0.05, -1.3]];
  for (const [x, y, z, rz] of spikes) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), M.hair); c.position.set(x, y, z); c.rotation.z = rz; c.rotation.x = z * 6; head.add(c); }
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), noOutline(new THREE.MeshBasicMaterial({ color: 0x15100c }))); eye.scale.set(0.4, 1.15, 0.8); eye.position.set(0.105, 0.0, 0.046 * s); head.add(eye);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff }))); hl.position.set(0.114, 0.01, 0.05 * s); head.add(hl);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.055), noOutline(new THREE.MeshBasicMaterial({ color: 0x15100c }))); brow.position.set(0.108, 0.04, 0.046 * s); brow.rotation.x = -0.4 * s; head.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.008, 0.035), noOutline(new THREE.MeshBasicMaterial({ color: 0x5a2018 }))); mouth.position.set(0.108, -0.06, 0); head.add(mouth);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.117, 0.014, 8, 32), M.belt); band.rotation.x = Math.PI / 2; band.position.y = 0.045; band.scale.set(1, 0.97, 1); head.add(band);
  head.userData.s = hs;
}

// poses : positions clés (repère du personnage, face à +X, droite = +Z)
const POSES = {
  guard: { pel: [0, 0.9, 0], neck: [0.06, 0.5, 0], sh: [-0.5, 0, 0.87], hip: [-0.35, 0, 0.94], hL: [0.36, 1.42, -0.1], hR: [0.2, 1.36, 0.13], fL: [0.28, 0.07, -0.14], fR: [-0.3, 0.07, 0.2], kR: [1, 0, 0.3] },
  jab: { pel: [0.05, 0.9, 0], neck: [0.1, 0.49, 0], sh: [-0.8, 0, 0.6], hip: [-0.4, 0, 0.92], hL: [0.9, 1.44, -0.02], hR: [0.2, 1.36, 0.12], fL: [0.33, 0.07, -0.14], fR: [-0.3, 0.07, 0.2], kR: [1, 0, 0.3] },
  cross: { pel: [0.1, 0.88, 0], neck: [0.14, 0.48, -0.02], sh: [0.6, 0, 0.8], hip: [0.25, 0, 0.97], hL: [0.24, 1.38, -0.14], hR: [0.92, 1.4, 0.02], fL: [0.3, 0.07, -0.14], fR: [-0.28, 0.12, 0.2], kR: [1, 0, 0.1] },
  chamber: { pel: [0.06, 0.96, -0.02], neck: [-0.1, 0.48, -0.06], sh: [0.3, 0, 0.95], hip: [0.6, 0.25, 0.75], hL: [0.3, 1.42, -0.12], hR: [0.0, 1.15, 0.3], fL: [0.22, 0.07, -0.1], fR: [0.15, 0.85, 0.42], kR: [0.8, 0.7, 0.6] },
  kick: { pel: [0.1, 0.98, 0], neck: [-0.27, 0.41, -0.1], sh: [0.75, 0.1, 0.65], hip: [0.85, 0.35, 0.2], hL: [0.02, 1.4, -0.16], hR: [-0.3, 0.98, 0.34], fL: [0.2, 0.07, -0.08], fR: [0.93, 1.47, 0.0], kR: [0.3, 1, 0.4] },
  victory: { pel: [0, 0.97, 0], neck: [0.0, 0.52, 0], sh: [-0.82, 0, 0.57], hip: [-0.75, 0, 0.66], hL: [0.3, 1.12, -0.3], hR: [-0.1, 2.02, 0.3], fL: [0.08, 0.07, -0.16], fR: [-0.08, 0.07, 0.16], kR: [1, 0, 0.3] },
};
const TL = [[0, 'guard'], [3.55, 'guard'], [3.8, 'jab'], [4.05, 'guard'], [4.25, 'guard'], [4.5, 'cross'], [4.85, 'guard'],
  [5.3, 'guard'], [5.5, 'jab'], [5.72, 'guard'], [5.9, 'cross'], [6.25, 'guard'], [7.3, 'guard'], [7.72, 'chamber'], [8.0, 'kick'],
  [9.5, 'kick'], [9.9, 'chamber'], [10.35, 'guard'], [11.5, 'guard'], [11.7, 'jab'], [11.95, 'guard'], [13.0, 'guard'], [13.2, 'jab'],
  [13.38, 'guard'], [13.55, 'cross'], [13.9, 'guard'], [15.1, 'guard'], [15.7, 'victory'], [99, 'victory']];
function poseAt(t) {
  let i = 0; while (i < TL.length - 2 && t > TL[i + 1][0]) i++;
  const [t0, a] = TL[i], [t1, b] = TL[i + 1]; const k = eIO((t - t0) / (t1 - t0));
  const out = {}; for (const key in POSES.guard) out[key] = POSES[a][key].map((v, j) => lerp(v, POSES[b][key][j], k));
  out.guardness = (a === 'guard' ? 1 - k : 0) + (b === 'guard' ? k : 0);
  out.turn = (a === 'victory' ? 1 - k : 0) + (b === 'victory' ? k : 0);
  return out;
}
function setBasis(obj, fwd, up, pos, sx = 1, sy = 1, sz = 1) {
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  const f = new THREE.Vector3().crossVectors(up, right).normalize();
  obj.matrix.makeBasis(f, up.clone().normalize(), right).scale(new THREE.Vector3(sx, sy, sz)).setPosition(pos);
}
function updateFigure(t) {
  const p = poseAt(t);
  const bob = Math.sin(t * 9.5) * 0.018 * p.guardness;
  const pel = V3(p.pel); pel.y += bob;
  const neck = pel.clone().add(V3(p.neck));
  const spine = neck.clone().sub(pel).normalize();
  const shAx = V3(p.sh).normalize(), hipAx = V3(p.hip).normalize();
  const sh = { R: neck.clone().addScaledVector(shAx, L.shW).addScaledVector(spine, -0.05), L: neck.clone().addScaledVector(shAx, -L.shW).addScaledVector(spine, -0.05) };
  const hp = { R: pel.clone().addScaledVector(hipAx, L.hipW), L: pel.clone().addScaledVector(hipAx, -L.hipW) };
  const hands = { L: V3(p.hL), R: V3(p.hR) }, feet = { L: V3(p.fL), R: V3(p.fR) };
  hands.L.y += bob * 1.5 * p.guardness; hands.R.y += bob * 1.5;
  for (const s of ['L', 'R']) {
    const sign = s === 'R' ? 1 : -1;
    const [el, hd] = ik(sh[s], hands[s], L.ua, L.fa + 0.06, new THREE.Vector3(-0.25, -1, 0).addScaledVector(shAx, 0.55 * sign));
    place(P['ua' + s], sh[s], el); place(P['fa' + s], el, hd);
    place(P['de' + s], sh[s].clone().addScaledVector(shAx, -0.02 * sign), sh[s].clone().lerp(el, 0.12));
    const fdir = hd.clone().sub(el).normalize();
    P['gl' + s].position.copy(hd).addScaledVector(fdir, 0.03); P['gl' + s].quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), fdir);
    place(P['cu' + s], hd.clone().addScaledVector(fdir, -0.11), hd.clone().addScaledVector(fdir, -0.06));
    const pole = s === 'R' ? V3(p.kR) : new THREE.Vector3(1, 0, -0.3);
    const [kn, an] = ik(hp[s], feet[s], L.th, L.sh, pole);
    place(P['th' + s], hp[s], kn); place(P['sh' + s], kn, an);
    if (P['so' + s]) place(P['so' + s], hp[s].clone().addScaledVector(kn.clone().sub(hp[s]).normalize(), -0.06), hp[s].clone().addScaledVector(kn.clone().sub(hp[s]).normalize(), 0.27));
    const ft = P['ft' + s];
    let d = an.y > 0.3 ? an.clone().sub(kn).normalize() : new THREE.Vector3(1, 0, s === 'R' ? 0.7 : -0.1).normalize();
    ft.position.copy(an).addScaledVector(d, 0.07); if (an.y <= 0.3) ft.position.y = an.y - 0.025;
    ft.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
  }
  const fwdT = new THREE.Vector3().crossVectors(spine, shAx).normalize();
  setBasis(torso, fwdT, spine, pel.clone().lerp(neck, 0.56), 0.9, 1, 1.42);
  const fwdP = new THREE.Vector3().crossVectors(UP, hipAx).normalize();
  setBasis(pelvis, fwdP, spine.clone().lerp(UP, 0.5).normalize(), pel, 0.85, 0.8, 1.1);
  setBasis(belt, fwdP, spine.clone().lerp(UP, 0.3).normalize(), pel.clone().addScaledVector(spine, 0.12), 0.84, 1, 1.12);
  const hUp = spine.clone().lerp(UP, 0.6).normalize();
  const hc = neck.clone().addScaledVector(hUp, 0.17 + 0.03 * (CFG.head - 1) * 4);
  place(neckM, neck.clone().addScaledVector(spine, -0.02), hc);
  // regard : vers le sac, puis vers la caméra en pose finale
  const look = new THREE.Vector3(1, 0, 0).lerp(new THREE.Vector3(0.57, -0.03, 0.82), p.turn).normalize();
  const hs = head.userData.s; setBasis(head, look, hUp, hc, hs, hs, hs);
  return { hands, feet };
}

// ------------------------------------------------------------------ impacts 3D
const starTex = canvasTex(512, 512, (g, w) => {
  g.translate(w / 2, w / 2); g.fillStyle = '#fff'; g.strokeStyle = '#0a0a0e'; g.lineWidth = 14; g.lineJoin = 'miter';
  g.beginPath(); const n = 14;
  for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, r = i % 2 ? 95 : 190 + ((i * 37) % 50); g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.stroke(); g.fill();
});
const stars = HITS.map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, depthTest: false, transparent: true })); s.visible = false; s.renderOrder = 10; scene.add(s); return s; });
const hitPos = (type) => new THREE.Vector3(1.0, (type === 'K' ? 1.47 : 1.42) * S, 0.0);

// ------------------------------------------------------------------ caméra
const piv = new THREE.Vector3(1.0, 0, 0);
const CS = S < 1 ? 0.8 : 1;
const sc = (a) => piv.clone().add(V3(a).sub(piv).multiplyScalar(CS));
const orbit = (deg, r, h) => { const a = deg * Math.PI / 180; return [0.6 + r * Math.cos(a), h, r * Math.sin(a)]; };
function camAt(t) {
  let p, l;
  if (t < 3) { const k = eOut(t / 3); p = V3([3.4, 0.35, 3.4]).lerp(V3([2.3, 0.7, 2.7]), k); l = V3([0.3, 1.1, 0]); }
  else if (t < 6.5) { const k = eOut((t - 3) / 3.5); p = V3([0.5, 1.2, 3.6]).lerp(V3([0.6, 1.25, 3.0]), k); l = V3([0.55, 1.12, 0]); }
  else if (t < 10.5) {
    const k1 = eIO(prog(t, 6.5, 1.5)), k2 = eIO(prog(t, KICK_T, 1.6)), k3 = prog(t, 9.6, 0.9);
    p = V3(orbit(30 + 8 * k1 + 30 * k2 + 4 * k3, 3.5 + 0.5 * k2, 0.5 + 0.9 * k2)); l = V3([0.62, 1.15, 0]);
  }
  else if (t < 15) { const k = (t - 10.5) / 4.5; p = V3(orbit(62 + 30 * k, 3.3, 1.2)); l = V3([0.45, 1.02, 0]); }
  else { const k = eOut((t - 15) / 5); p = V3([2.5, 0.6, 3.6]).lerp(V3([2.2, 0.75, 3.2]), k); l = V3([0.1, 1.55, 0]); }
  return [sc(p.toArray()), sc(l.toArray())];
}
const CUTS = [3, 6.5, 10.5, 15];

// ------------------------------------------------------------------ habillage 2D (textes, lignes de vitesse)
const ui = document.getElementById('ui'), fx = document.getElementById('fx').getContext('2d');
const mk = (cls, html, css) => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; Object.assign(e.style, css); ui.appendChild(e); return e; };
const A = CFG.accent;
const E = {
  cap: mk('box', CFG.cap, { top: '210px', fontSize: '64px', background: '#f6f3ea', color: '#0a0a0e', boxShadow: `14px 14px 0 ${A}` }),
  words: [['JAB !', 3.8, 620, 420, -8, '#fff'], ['CROSS !', 4.5, 600, 330, 7, A], ['JAB !', 5.5, 640, 420, -6, '#fff'], ['CROSS !', 5.9, 600, 330, 8, A]]
    .map(([s, t0, x, y, r, c]) => ({ t0, r, e: mk('t', s, { top: y + 'px', left: (x - 540) + 'px', fontSize: '190px', color: c }) })),
  kick: mk('t', 'HIGH KICK !', { top: '230px', fontSize: '210px', color: A }),
  title: mk('t', 'KICKBOXING', { top: '150px', fontSize: '210px' }),
  aud: mk('box', CFG.aud, { top: '400px', fontSize: '96px', background: A, color: A === '#ffce20' ? '#0a0a0e' : '#fff' }),
  w: CFG.words.map((s, i) => mk('t', s, { top: (1400 + i * 150) + 'px', fontSize: '120px', color: i === 1 ? A : '#fff', webkitTextStroke: '12px #0a0a0e' })),
  hook: mk('t', CFG.hook, { top: '130px', fontSize: '120px', webkitTextStroke: '12px #0a0a0e' }),
  lundi: mk('t', 'LUNDI', { top: '250px', fontSize: '330px', color: A }),
  cta: mk('box', 'RÉSERVE TON COURS D\'ESSAI', { top: '1470px', fontSize: '74px', background: A, color: A === '#ffce20' ? '#0a0a0e' : '#fff' }),
  info: mk('t b', 'Infos & inscriptions en message privé', { top: '1650px', fontSize: '62px' }),
  foot: mk('t b', 'FIGHTER ACADEMY KARATÉ · LE TAMPON', { top: '1760px', fontSize: '60px', color: '#ffce20' }),
  osu: mk('t', 'OSU !', { top: '1180px', left: '300px', fontSize: '150px' }),
};
function show(e, o, s = 1, rot = 0, dx = 0) {
  e.style.opacity = o;
  if (e.classList.contains('box')) { e.style.left = (540 - e.offsetWidth / 2) + 'px'; }
  e.style.transform = `translateX(${dx}px) rotate(${rot}deg) scale(${s})`;
}
const win = (t, a, b, fin = 0.08, fout = 0.2) => (t < a || t > b) ? 0 : Math.min(clamp((t - a) / fin), clamp((b - t) / fout));
const popS = (t, t0, d = 0.3) => 1 + 0.7 * (1 - eBack(prog(t, t0, d)));
function updateUI(t) {
  show(E.cap, win(t, 0.5, 2.9, 0.15), eBack(prog(t, 0.5, 0.35)), -2);
  for (const w of E.words) show(w.e, win(t, w.t0, w.t0 + 0.62, 0.03, 0.12), popS(t, w.t0), w.r);
  show(E.kick, win(t, KICK_T + 0.05, 10.3, 0.04), popS(t, KICK_T + 0.05, 0.35), -6);
  show(E.title, win(t, 10.7, 14.9, 0.1), popS(t, 10.7, 0.35), -3);
  show(E.aud, win(t, 11.1, 14.9, 0.1), eBack(prog(t, 11.1, 0.35)), -3);
  E.w.forEach((e, i) => show(e, win(t, 11.9 + i * 0.45, 14.9, 0.05), popS(t, 11.9 + i * 0.45), [-3, 2, -2][i]));
  show(E.hook, win(t, 15.3, 99, 0.1), popS(t, 15.3), -3);
  show(E.lundi, win(t, 15.8, 99, 0.04), popS(t, 15.8, 0.35), -5);
  show(E.cta, win(t, 16.6, 99, 0.1), eBack(prog(t, 16.6, 0.4)), 0);
  show(E.info, eOut(prog(t, 17.1, 0.4)));
  show(E.foot, eOut(prog(t, 17.4, 0.4)));
  show(E.osu, win(t, 17.9, 99, 0.04), popS(t, 17.9), 9);
  document.getElementById('shade').style.opacity = Math.max(win(t, 10.6, 14.95, 0.3, 0.05), prog(t, 15.2, 0.4));
  let fl = 0; for (const c of CUTS) if (t >= c && t - c < 0.13) fl = 0.85 * (1 - (t - c) / 0.13);
  if (t >= KICK_T && t - KICK_T < 0.1) fl = 0.9 * (1 - (t - KICK_T) / 0.1);
  document.getElementById('flash').style.opacity = fl;
  document.getElementById('black').style.opacity = Math.max(1 - t / 0.4, prog(t, DURATION - 0.6, 0.6));
}
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function speedLines(cx, cy, alpha, frame, r0 = 380) {
  fx.clearRect(0, 0, 1080, 1920); if (alpha <= 0.01) return;
  seed = 1 + (frame >> 1) * 7919; fx.fillStyle = `rgba(255,255,255,${0.75 * alpha})`;
  for (let i = 0; i < 80; i++) {
    const a = rnd() * 6.283, ri = r0 + rnd() * 320, w = 0.004 + rnd() * 0.013, R = 2400;
    fx.beginPath(); fx.moveTo(cx + ri * Math.cos(a), cy + ri * Math.sin(a));
    fx.lineTo(cx + R * Math.cos(a - w), cy + R * Math.sin(a - w)); fx.lineTo(cx + R * Math.cos(a + w), cy + R * Math.sin(a + w)); fx.fill();
  }
}

// ------------------------------------------------------------------ image
window.renderFrame = (t) => {
  updateFigure(t);
  bag.rotation.z = bagAngle(t); bag.rotation.x = bagAngle(t) * 0.15;
  const [cp, cl] = camAt(t);
  let lines = 0, lp = null;
  HITS.forEach(([h, type, amp], i) => {
    const d = t - h, st = stars[i], hp = hitPos(type), long = type === 'K';
    const life = long ? 0.5 : 0.22, lineLife = long ? FREEZE_END - KICK_T + 0.2 : 0.3;
    st.visible = d >= 0 && d < life;
    if (st.visible) {
      const k = d / life, sz = (long ? 0.95 : 0.6) * S * (0.5 + 0.6 * eOut(prog(d, 0, 0.12)) + (long ? 0.15 * k : 0));
      st.position.copy(hp).lerp(cp, 0.12); st.scale.setScalar(sz); st.material.opacity = long ? 1 - prog(d, life - 0.25, 0.25) : 1 - k * k;
      st.material.rotation = i * 0.7 + (long ? 0 : d * 2);
    }
    if (d >= -0.06 && d < lineLife) { const v = long ? Math.max(0.4, 1 - d / 0.4) * (1 - prog(d, lineLife - 0.3, 0.3)) : (1 - Math.max(0, d) / 0.3) * (amp > 0.045 ? 0.8 : 0.5); if (v > lines) { lines = v; lp = hp; } }
    if (d >= 0 && d < 0.3) { const a = (1 - d / 0.3) * (long ? 0.09 : 0.025) * (amp > 0.045 || long ? 1 : 0.6); cp.x += Math.sin(t * 173) * a; cp.y += Math.cos(t * 149) * a; }
  });
  camera.position.copy(cp); camera.lookAt(cl);
  camera.fov = t >= KICK_T && t < 10.5 ? 42 - 5 * eOut(prog(t, KICK_T, 0.15)) * (1 - prog(t, 9.6, 0.9)) : 42; camera.updateProjectionMatrix();
  effect.render(scene, camera);
  if (lp) { const v = lp.clone().project(camera); speedLines((v.x + 1) * 540, (1 - v.y) * 960, lines, Math.round(t * 30), t >= KICK_T && t < 10 ? 430 : 330); } else speedLines(0, 0, 0, 0);
  updateUI(t);
};
await document.fonts.ready;
window.renderFrame(0);
window.READY = true;
