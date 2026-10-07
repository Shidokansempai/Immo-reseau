'use strict';
// Small subset of node:crypto for the demo build. Passwords use a simple
// salted hash: fine for a demo stored in the visitor's own browser only.
class Bytes extends Uint8Array {
  toString(enc) {
    if (enc === 'hex') return [...this].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (enc === 'base64url') return btoa(String.fromCharCode(...this)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return String.fromCharCode(...this);
  }
}
const fromHex = (h) => Bytes.from(String(h).match(/../g) || [], (x) => parseInt(x, 16));
globalThis.Buffer = globalThis.Buffer || { from: (v, enc) => (enc === 'hex' ? fromHex(v) : Bytes.from(v)) };

function randomBytes(n) { return Bytes.from(globalThis.crypto.getRandomValues(new Uint8Array(n))); }

function scryptSync(password, salt, len) {
  const input = `${password}|${[...salt].join(',')}`;
  const out = new Bytes(len);
  let h1 = 0xdeadbeef; let h2 = 0x41c6ce57;
  for (let round = 0; round < 2000; round++) {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i) + round;
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
  }
  for (let i = 0; i < len; i++) {
    h1 = Math.imul(h1 ^ (h2 >>> 15), 2246822507) ^ i; h2 = Math.imul(h2 ^ (h1 >>> 13), 3266489909) ^ i;
    out[i] = (h1 ^ h2) & 255;
  }
  return out;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

module.exports = { randomBytes, scryptSync, timingSafeEqual };
