// Ahead of the Light: the world. A tube of space 30 m across that runs home through eight sectors, with stars in it
// to dodge and spectral rings to fly through. Pure functions of the distance d and a seed, so the view, the flight,
// the bots and the tests all read the same sky. Forward is +d; x is across and y is up, both from the tube's middle.

export const SECTOR_LEN = 2400;
export const SECTORS = Object.freeze([
  { id: 'web', name: 'THE COSMIC WEB' },
  { id: 'coma', name: 'COMA' },
  { id: 'virgo', name: 'VIRGO' },
  { id: 'local', name: 'THE LOCAL GROUP' },
  { id: 'milkyway', name: 'THE MILKY WAY' },
  { id: 'orion', name: 'THE ORION ARM' },
  { id: 'sun', name: "THE SUN'S STARS" },
  { id: 'earth', name: 'EARTH' },
]);
export const COURSE_LEN = SECTOR_LEN * SECTORS.length;
export const TUBE = 15;            // the tube's radius: the edge of where you can fly
export const SHIP_R = 1.1;
export const RING_EVERY = 170;
export const RING_R = 4.2;
export const CELL = 16;            // one slice of the tube; each holds a few stars

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// A 2D integer hash to [0, 1).
export function hash2(i, j, seed = 1) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const sectorAt = (d) => clamp(Math.floor(d / SECTOR_LEN), 0, SECTORS.length - 1);
export const hardAt = (d) => clamp(d / COURSE_LEN, 0, 1);

// The kinds of star, by size and colour on the spectrum (0 red .. 1 violet).
export const KINDS = Object.freeze([
  { id: 'dwarf', r: [0.9, 1.6], hue: 0.08 },
  { id: 'sun', r: [1.6, 2.6], hue: 0.3 },
  { id: 'blue', r: [2.2, 3.4], hue: 0.78 },
  { id: 'giant', r: [3.4, 5.2], hue: 0.02 },
]);

export function createWorld(seed = 1) {
  // The ring in slot i, or null: one about every RING_EVERY m from 300 m on, inside the tube.
  function ring(i) {
    if (i < 2) return null;
    const d = i * RING_EVERY + 40 * (hash2(i, 21, seed) - 0.5);
    if (d >= COURSE_LEN - 100) return null;
    const a = hash2(i, 22, seed) * Math.PI * 2, r = (TUBE - RING_R - 2) * Math.sqrt(hash2(i, 23, seed));
    return { i, d, x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  // The stars in slice c (CELL m long): fewer at the start, more by Earth, none in the first 200 m, and none where
  // they would block a ring.
  function stars(c) {
    if (c * CELL < 200) return [];
    const d0 = c * CELL, hard = hardAt(d0);
    const n = Math.floor(hash2(c, 1, seed) * (1.4 + 2.6 * hard) + 0.3 + 0.4 * hard);
    const out = [];
    const g0 = Math.floor(d0 / RING_EVERY);
    const near = [ring(g0 - 1), ring(g0), ring(g0 + 1), ring(g0 + 2)].filter(Boolean);
    for (let k = 0; k < n; k++) {
      const kp = hash2(c, 10 + k, seed);
      const kind = KINDS[kp < 0.4 ? 0 : kp < 0.72 ? 1 : kp < 0.9 + 0.04 * hard ? 2 : 3];
      const r = kind.r[0] + (kind.r[1] - kind.r[0]) * hash2(c, 20 + k, seed);
      const a = hash2(c, 30 + k, seed) * Math.PI * 2, rad = (TUBE + 2) * Math.sqrt(hash2(c, 40 + k, seed));
      const s = { c, k, d: d0 + CELL * hash2(c, 50 + k, seed), x: Math.cos(a) * rad, y: Math.sin(a) * rad, r, kind: kind.id, hue: kind.hue };
      if (near.some((g) => Math.abs(g.d - s.d) < s.r + 14 && Math.hypot(g.x - s.x, g.y - s.y) < s.r + RING_R + 2.5)) continue;
      out.push(s);
    }
    return out;
  }
  // Every star between d0 and d1.
  function starsBetween(d0, d1) {
    const out = [];
    for (let c = Math.floor(d0 / CELL); c <= Math.floor(d1 / CELL); c++) for (const s of stars(c)) if (s.d >= d0 && s.d < d1) out.push(s);
    return out;
  }
  return { seed, ring, stars, starsBetween };
}
