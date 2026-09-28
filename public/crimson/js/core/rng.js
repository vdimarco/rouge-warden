// js/core/rng.js : seeded streams; ?seed=N or a fresh seed per page. fx and audio keep Math.random.
export function mulberry32(a) { return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const q = new URLSearchParams(location.search).get('seed');
let base = q != null ? (+q >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
const streams = new Map();
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function seed(n) { base = n >>> 0; for (const s of streams.values()) s.reset(); }
export function rng(name) { let s = streams.get(name); if (!s) { let f; s = { reset() { f = mulberry32(base ^ hash(name)); }, next: () => f() }; s.reset(); streams.set(name, s); } return s.next; }
export const seedValue = () => base;
