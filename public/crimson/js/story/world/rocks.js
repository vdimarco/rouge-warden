// js/story/world/rocks.js : the hero rock formations of Sedona: spires, hoodoos and caps that the 5 m
// heightfield cannot hold. A port of the arena's rockColumn/formation (js/world.js) as plain arrays with a
// seeded rng, so the terrain worker builds them into its tiles (no three.js here). Two levels of detail.
// Each formation also gives circle colliders at the base of its columns.

function mulberry(a) { return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
}
function fbm(x, y, o = 3) { let v = 0, a = 0.5; for (let i = 0; i < o; i++) { v += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return v; }

// kind: spire | hoodoo | bell | block | pot | fins. s: scale. The twelve hero formations sit at landmarks.
export const FORMATIONS = Object.freeze([
  { id: 'cathedral', kind: 'fins', x: -182, z: 640, s: 1.6, seed: 11, yaw: 0.3 },
  { id: 'coffee_pot', kind: 'pot', x: -560, z: -262, s: 1.25, seed: 12, yaw: 0.8 },
  { id: 'bell_rock', kind: 'bell', x: 300, z: 700, s: 1.35, seed: 13, yaw: 0 },
  { id: 'courthouse', kind: 'block', x: 466, z: 764, s: 1.5, seed: 14, yaw: 0.3 },
  { id: 'capitol', kind: 'fins', x: -350, z: -420, s: 1.4, seed: 15, yaw: 1.2 },
  { id: 'snoopy', kind: 'hoodoo', x: 422, z: -40, s: 1.2, seed: 16, yaw: -0.3 },
  { id: 'chapel', kind: 'spire', x: 382, z: 426, s: 1.1, seed: 17, yaw: 0.4 },
  { id: 'wilson', kind: 'hoodoo', x: 368, z: -560, s: 0.9, seed: 18, yaw: 0.9 },
  { id: 'boynton', kind: 'spire', x: -912, z: -690, s: 1.2, seed: 19, yaw: 0.2 },
  { id: 'steamboat', kind: 'block', x: 520, z: -228, s: 1.1, seed: 20, yaw: -0.4 },
  { id: 'mesa_edge', kind: 'hoodoo', x: -310, z: 270, s: 0.8, seed: 21, yaw: 2.1 },
  { id: 'twin', kind: 'fins', x: 640, z: 470, s: 1.1, seed: 22, yaw: -0.8 },
]);

// A rough column: ring by ring with a noisy radius, tapering from r0 at the base to r1 at the top, capped.
function column(out, r0, r1, h, sides, rough, R, cx, cy, cz, lod) {
  const rings = Math.max(3, Math.round(h / (lod ? 9 : 4))), ns = lod ? Math.max(5, Math.round(sides * 0.6)) : sides, seed = R() * 100;
  const base = out.pos.length / 3;
  for (let k = 0; k <= rings; k++) {
    const y = h * k / rings, t = k / rings;
    // strata ledges: the radius steps in at a few heights
    const ledge = 1 - 0.07 * Math.floor(t * 4 + fbm(seed, t * 3, 2) * 0.8) / 4;
    for (let i = 0; i < ns; i++) {
      const a = i / ns * Math.PI * 2;
      const k2 = (1 + (fbm(a * 2 + seed, y * 0.08, 3) - 0.5) * rough + Math.sin(y * 0.9 + seed) * 0.04) * ledge;
      const r = (r0 + (r1 - r0) * Math.pow(t, 0.9)) * k2;
      out.pos.push(cx + Math.sin(a) * r, cy + y, cz + Math.cos(a) * r);
    }
  }
  for (let k = 0; k < rings; k++) for (let i = 0; i < ns; i++) {
    const a = base + k * ns + i, b = base + k * ns + (i + 1) % ns, c = a + ns, d = b + ns;
    out.idx.push(a, b, d, a, d, c);
  }
  // a domed cap
  const top = base + rings * ns, cap = out.pos.length / 3;
  out.pos.push(cx, cy + h + r1 * 0.35, cz);
  for (let i = 0; i < ns; i++) out.idx.push(top + i, top + (i + 1) % ns, cap);
}

// Build one formation at ground height gy: {pos, idx, colliders:[{x,z,r}]}
export function buildFormation(f, gy, lod = 0) {
  const R = mulberry(f.seed * 7777), s = f.s, out = { pos: [], idx: [], colliders: [] };
  const cy = Math.cos(f.yaw), sy = Math.sin(f.yaw);
  const put = (lx, lz, r0, r1, h, sides, rough, dy = -3) => {
    const x = f.x + lx * cy + lz * sy, z = f.z - lx * sy + lz * cy;
    column(out, r0, r1, h, sides, rough, R, x, gy + dy, z, lod);
    out.colliders.push({ x, z, r: r0 * 0.92 });
  };
  const rnd = (a, b) => a + R() * (b - a);
  if (f.kind === 'spire') {
    put(0, 0, 9 * s, 4 * s, 26 * s, 10, 0.35);
    put(0, 0, 4.5 * s, 1.5 * s, 58 * s, 8, 0.45);
    put(rnd(6, 9) * s, rnd(-3, 3) * s, 3.2 * s, 1.1 * s, 38 * s, 7, 0.5);
  } else if (f.kind === 'hoodoo') {
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + rnd(-0.3, 0.3), r = rnd(6, 16) * s; put(Math.sin(a) * r, Math.cos(a) * r, rnd(3, 5) * s, rnd(2.2, 3.4) * s, rnd(16, 30) * s, 8, 0.55); }
    put(0, 0, 10 * s, 7 * s, 12 * s, 10, 0.3);
  } else if (f.kind === 'fins') {
    // a ragged base and a crown of tapering spires, taller toward the middle
    put(0, 0, 24 * s, 19 * s, 14 * s, 12, 0.35, -6);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + rnd(-0.3, 0.3), r = rnd(5, 15) * s; put(Math.sin(a) * r, Math.cos(a) * r, rnd(4, 6.5) * s, rnd(0.7, 1.4) * s, (48 - r / s * 1.4 + rnd(-6, 6)) * s, 7, 0.55, 6 * s); }
  } else if (f.kind === 'bell') {
    // the heightfield holds the bell; the mesh adds its pointed top
    put(0, 0, 6 * s, 1.2 * s, 14 * s, 9, 0.3, -3);
  } else if (f.kind === 'block') {
    // a cliff-walled block on the butte's flat top, with two towers
    put(0, 0, 14 * s, 12.5 * s, 14 * s, 10, 0.25, -4);
    put(-7 * s, 3 * s, 6.5 * s, 4.5 * s, 18 * s, 8, 0.35, 9 * s);
    put(7 * s, -3 * s, 4.5 * s, 2 * s, 15 * s, 7, 0.4, 9 * s);
  } else if (f.kind === 'pot') {
    put(0, 0, 16 * s, 14 * s, 10 * s, 12, 0.3, -3);
    put(4 * s, 0, 8 * s, 6.5 * s, 20 * s, 9, 0.3, 6 * s);
    put(9 * s, 0, 3 * s, 2 * s, 12 * s, 7, 0.4, 24 * s);
  }
  return out;
}
