// Small tools the lab toys share: a seeded random, integer hashes, the date at the cottage, and a byte codec
// (varints in base64url) for share links. No DOM here, so the Node tests import it too.
// Everything in this file uses integer math only, so it gives the same numbers in every browser.

const TE = new TextEncoder(), TD = new TextDecoder();

// the same seeded random as public/fish/js/audio.js
export function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// FNV-1a over a string or bytes, as an unsigned 32-bit number
export function fnv1a(data, h = 0x811c9dc5) {
  const b = typeof data === "string" ? TE.encode(data) : data;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// a hash of a lattice point and a seed, 0..2^32-1
export function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
// the same, as 0..1 (a power-of-two divide, so it is exact)
export const hash01 = (x, y, seed) => hash2(x, y, seed) / 4294967296;

// The date at the cottage in Ontario, as YYYY-MM-DD. The whole crew gets the same day, and it turns over at
// midnight there, not at midnight in London.
export function cottageDay(d = new Date()) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" });
    const p = {};
    for (const x of f.formatToParts(d)) p[x.type] = x.value;
    if (p.year && p.month && p.day) return `${p.year}-${p.month}-${p.day}`;
  } catch (e) { /* no time zone data: fall through */ }
  return d.toISOString().slice(0, 10);
}
export const daySeed = (toy, day = cottageDay()) => fnv1a(toy + ":" + day);

/* ---------------- bytes for links ---------------- */
export class Writer {
  constructor() { this.a = []; }
  u8(v) { this.a.push(v & 255); return this; }
  u32(v) { v >>>= 0; for (let i = 0; i < 4; i++) { this.a.push(v & 255); v >>>= 8; } return this; }
  // unsigned LEB128: 7 bits a byte, the top bit says "more follows"
  uvar(v) {
    v = Math.max(0, Math.floor(v));
    while (v >= 128) { this.a.push((v % 128) | 128); v = Math.floor(v / 128); }
    this.a.push(v);
    return this;
  }
  // zigzag: small negative numbers stay small
  svar(v) { v = Math.round(v); return this.uvar(v < 0 ? -2 * v - 1 : 2 * v); }
  str(s, max = 32) {
    const b = TE.encode(String(s || "")).slice(0, max);
    this.uvar(b.length);
    for (const x of b) this.a.push(x);
    return this;
  }
  bytes() { return Uint8Array.from(this.a); }
}
// Reads what Writer wrote. A short or broken input never throws: it sets bad, and the caller gives up.
export class Reader {
  constructor(b) { this.b = b || new Uint8Array(0); this.i = 0; this.bad = false; }
  get done() { return this.i >= this.b.length; }
  u8() { if (this.i >= this.b.length) { this.bad = true; return 0; } return this.b[this.i++]; }
  u32() { let v = 0; for (let i = 0; i < 4; i++) v += this.u8() * 2 ** (8 * i); return v >>> 0; }
  uvar() {
    let v = 0, m = 1;
    for (let k = 0; k < 7; k++) {
      const x = this.u8();
      v += (x & 127) * m;
      if (!(x & 128)) return v;
      m *= 128;
    }
    this.bad = true;
    return 0;
  }
  svar() { const u = this.uvar(); return u % 2 ? -(u + 1) / 2 : u / 2; }
  str(max = 32) {
    const n = this.uvar();
    if (n > max || this.i + n > this.b.length) { this.bad = true; return ""; }
    const s = TD.decode(this.b.subarray(this.i, this.i + n));
    this.i += n;
    return s;
  }
}

export function toB64u(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// null for anything that is not clean base64url
export function fromB64u(str) {
  if (typeof str !== "string" || !/^[A-Za-z0-9_-]*$/.test(str) || str.length % 4 === 1) return null;
  try {
    const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4));
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  } catch (e) { return null; }
}

// read "#a=1&b=2" (or "?a=1&b=2") into an object
export function hashParams(h) {
  const out = {};
  for (const part of String(h || "").replace(/^[#?]/, "").split("&")) {
    if (!part) continue;
    const i = part.indexOf("=");
    const k = i < 0 ? part : part.slice(0, i), v = i < 0 ? "" : part.slice(i + 1);
    try { out[decodeURIComponent(k)] = decodeURIComponent(v); } catch (e) { /* a broken escape: skip it */ }
  }
  return out;
}
