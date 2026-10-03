// Small helpers that every place map shares: a seeded random, smooth noise, and a few shapes.
// Pure and deterministic, so every copy of a map (the game, the 3D world, node tests) is the same.

// a small seeded random, so every copy of the map is the same
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// smooth 2D value noise, about -1..1
function hash(ix, iz) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

// how far a point is from a capsule {ax, az, bx, bz, r}: below 0 is inside it
export function capsule(x, z, c) {
  const dx = c.bx - c.ax, dz = c.bz - c.az, l2 = dx * dx + dz * dz;
  const t = clamp(((x - c.ax) * dx + (z - c.az) * dz) / l2, 0, 1);
  return Math.hypot(x - c.ax - dx * t, z - c.az - dz * t) - c.r;
}
// is a point inside a box {x0, x1, z0, z1} (grown by pad), and how far inside it is (below 0 is outside)
export const boxIn = (x, z, b, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
export const boxInset = (x, z, b) => Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);

// an empty list for places that have no snags, shared so it costs nothing
export const NONE = Object.freeze([]);
// a coarse grid over the snags (stumps, log posts), so "which snags are near this point" is cheap.
// Each snag goes in its own cell and the 8 cells around it, so a look-up finds every snag within one cell (6 m).
export function snagGrid(list, cell = 6) {
  const key = (i, j) => (i + 4096) * 8192 + (j + 4096);
  const m = new Map();
  for (const s of list) {
    const i0 = Math.floor(s.x / cell), j0 = Math.floor(s.z / cell);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const k = key(i, j);
      const at = m.get(k);
      if (at) at.push(s); else m.set(k, [s]);
    }
  }
  return (x, z) => m.get(key(Math.floor(x / cell), Math.floor(z / cell))) || NONE;
}
