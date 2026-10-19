// Ahead of the Light: the world. A canyon that winds toward Earth through eight sectors, with spires on its floor
// and orange gates in its air. Pure functions of (x, d) and a seed, so the renderer, the flight model, the bots and
// the tests all read the same ground. Forward is +d (the view's -z); x is across; y is up. Units are metres.

export const SECTOR_LEN = 2400;
export const SECTORS = Object.freeze([
  { id: 'web', name: 'THE COSMIC WEB', hue: [0.25, 0.85, 0.95] },
  { id: 'coma', name: 'COMA', hue: [0.35, 0.95, 0.85] },
  { id: 'virgo', name: 'VIRGO', hue: [0.45, 0.75, 1.0] },
  { id: 'local', name: 'THE LOCAL GROUP', hue: [0.55, 0.65, 1.0] },
  { id: 'milkyway', name: 'THE MILKY WAY', hue: [0.75, 0.6, 1.0] },
  { id: 'orion', name: 'THE ORION ARM', hue: [0.95, 0.55, 0.85] },
  { id: 'sun', name: "THE SUN'S STARS", hue: [1.0, 0.75, 0.5] },
  { id: 'earth', name: 'EARTH', hue: [0.4, 0.8, 1.0] },
]);
export const COURSE_LEN = SECTOR_LEN * SECTORS.length;
export const CEILING = 64;         // above this the burst's light reaches you
export const GATE_EVERY = 170;
export const GATE_R = 7.5;
const SPIRE_CELL = 60;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (t) => t * t * (3 - 2 * t);

// A 2D integer hash to [0, 1).
export function hash2(i, j, seed = 1) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Value noise with a smooth fade, and three octaves of it.
function vnoise(x, y, seed) {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = smooth(x - i), fy = smooth(y - j);
  const a = hash2(i, j, seed), b = hash2(i + 1, j, seed), c = hash2(i, j + 1, seed), d = hash2(i + 1, j + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, seed) {
  return vnoise(x, y, seed) * 0.57 + vnoise(x * 2.1, y * 2.1, seed + 7) * 0.29 + vnoise(x * 4.3, y * 4.3, seed + 13) * 0.14;
}

export const sectorAt = (d) => clamp(Math.floor(d / SECTOR_LEN), 0, SECTORS.length - 1);
// How hard the course is at d: 0 at the start, 1 at Earth.
export const hardAt = (d) => clamp(d / COURSE_LEN, 0, 1);

export function createWorld(seed = 1) {
  const ph = [hash2(1, 2, seed) * 6.28, hash2(3, 4, seed) * 6.28, hash2(5, 6, seed) * 6.28];

  // The canyon's middle and its half width at d.
  function centre(d) {
    // the bends tighten toward Earth; the steepest is about 0.4 m across per metre ahead
    const k = 0.55 + 0.45 * hardAt(d);
    return k * (52 * Math.sin(d / 330 + ph[0]) + 22 * Math.sin(d / 141 + ph[1]) + 6 * Math.sin(d / 61 + ph[2]));
  }
  function halfWidth(d) {
    const open = d < 200 ? 1.4 - 0.4 * (d / 200) : 1;
    return open * (40 + 12 * Math.sin(d / 420 + ph[1])) * (1 - 0.28 * hardAt(d));
  }
  // The open floor's height, without spires.
  function floor(x, d) {
    return 14 * fbm(x * 0.025, d * 0.025, seed) - 7 + 5 * fbm(x * 0.09, d * 0.09, seed + 5);
  }
  // A spire in the cell at index c: { x, d, r, h } or null.
  function spire(c) {
    if (c < 3) return null;
    const d0 = c * SPIRE_CELL;
    const p = 0.25 + 0.55 * hardAt(d0);
    if (hash2(c, 11, seed) > p) return null;
    const d = d0 + SPIRE_CELL * (0.2 + 0.6 * hash2(c, 12, seed));
    const w = halfWidth(d);
    return { x: centre(d) + (hash2(c, 13, seed) - 0.5) * 1.5 * w, d, r: 6 + 5 * hash2(c, 14, seed),
      h: 18 + 30 * hash2(c, 15, seed) };
  }
  // The ground's height at (x, d): the floor, the walls and the spires.
  function height(x, d) {
    const w = halfWidth(d);
    const u = Math.abs(x - centre(d)) / w;
    let y = floor(x, d);
    // the walls: slopes about 1.5 m up per metre across, rough, to about 80 m and on into hills beyond
    if (u > 0.78) {
      const t = (u - 0.78) * w;
      const rough = 0.7 + 0.6 * fbm(x * 0.018 + 40, d * 0.018, seed + 3);
      y += rough * (t < 55 ? t * 1.45 : 80 + (t - 55) * 0.35) + 12 * fbm(x * 0.05, d * 0.05, seed + 9) * Math.min(1, t / 20);
    }
    const c = Math.floor(d / SPIRE_CELL);
    for (let k = c - 1; k <= c + 1; k++) {
      const s = spire(k);
      if (!s) continue;
      const r = Math.hypot(x - s.x, d - s.d);
      if (r < s.r) y = Math.max(y, floor(x, d) + s.h * (1 - (r / s.r) ** 2));
    }
    return y;
  }
  // The gates: one about every GATE_EVERY metres, in the open air over the canyon floor, from 300 m on.
  function gate(i) {
    if (i < 2) return null;
    const d = i * GATE_EVERY + 40 * (hash2(i, 21, seed) - 0.5);
    if (d >= COURSE_LEN - 100) return null;
    const w = halfWidth(d);
    let x = centre(d) + (hash2(i, 22, seed) - 0.5) * 0.9 * w;
    // keep a gate out of a spire
    const c = Math.floor(d / SPIRE_CELL);
    for (let k = c - 1; k <= c + 1; k++) {
      const s = spire(k);
      if (s && Math.hypot(x - s.x, d - s.d) < s.r + GATE_R + 2) x = s.x + (x >= s.x ? 1 : -1) * (s.r + GATE_R + 3);
    }
    let ground = -1e9;
    for (let dx = -GATE_R; dx <= GATE_R; dx += GATE_R / 2) ground = Math.max(ground, height(x + dx, d));
    const y = Math.max(ground + GATE_R + 3, 6 + 22 * hash2(i, 23, seed));
    return { i, x, y: Math.min(y, CEILING - GATE_R - 2), d };
  }
  return { seed, centre, halfWidth, floor, height, spire, gate };
}
