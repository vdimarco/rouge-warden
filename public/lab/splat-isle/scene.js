// Splat Isle's world, written as shapes. Five small islands lie on a calm sea; each is a ground of soft hills, things
// that stand on it, and the one person who lives there. Every object is one or more parts; a part is a set of distance
// shapes (or a scatter of points) that the painter in sdf.js turns into brush strokes with the light baked in.
// build() paints one island; figure() paints a person; world() paints the sea and the clouds.
import { rng, prepare, field, bounds, paint, scatter, bake, Grid } from './sdf.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };
export const SEA = -0.9;
// The islands, where they lie on the sea (metres, from Home Isle), and what grows there.
export const ISLANDS = {
  home: { id: 'home', name: 'Home Isle', radius: 5.4, at: [0, 0], grass: [[0.36, 0.62, 0.24], [0.6, 0.72, 0.28]], seed: 11 },
  orchard: { id: 'orchard', name: 'Orchard Isle', radius: 4.8, at: [-25, -13], grass: [[0.42, 0.6, 0.2], [0.72, 0.74, 0.3]], seed: 23 },
  bell: { id: 'bell', name: 'Bell Isle', radius: 4.3, at: [5, -29], grass: [[0.34, 0.55, 0.32], [0.55, 0.66, 0.4]], seed: 37 },
  wreck: { id: 'wreck', name: 'Wreck Isle', radius: 4.5, at: [28, -8], grass: [[0.62, 0.6, 0.36], [0.82, 0.76, 0.5]], sand: true, seed: 41 },
  light: { id: 'light', name: 'Lantern Isle', radius: 4.1, at: [19, 21], grass: [[0.3, 0.52, 0.3], [0.5, 0.62, 0.36]], seed: 53 },
};
export const ORDER = ['home', 'orchard', 'bell', 'wreck', 'light'];

/* ---------------- materials ---------------- */
const M = {
  wall: { color: [0.93, 0.86, 0.72] }, roof: { color: [0.78, 0.28, 0.22], jitter: 0.1 }, door: { color: [0.42, 0.24, 0.14] }, chimney: { color: [0.55, 0.5, 0.48] },
  window: { color: [1.0, 0.85, 0.45], glow: true }, bark: { color: [0.45, 0.31, 0.2] },
  leaf: { paint: (x, y, z, nx, ny, nz, r) => mix([0.18, 0.46, 0.2], [0.42, 0.66, 0.24], clamp(0.3 + 0.42 * ny + r() * 0.35, 0, 1)), jitter: 0.08 },
  stone: { paint: (x, y, z, nx, ny) => mix([0.47, 0.46, 0.48], [0.64, 0.62, 0.6], clamp(0.3 + 0.5 * ny + 0.3 * noise(x * 4, z * 4 + y * 4), 0, 1)) },
  tower: { paint: (x, y) => (Math.floor(y / 0.42) % 2 === 0 ? [0.95, 0.93, 0.88] : [0.82, 0.2, 0.2]) }, cap: { color: [0.3, 0.32, 0.38] },
  lamp: { color: [1.0, 0.92, 0.55], glow: true }, lampDark: { color: [0.32, 0.34, 0.4] },
  wood: { paint: (x, y, z) => mix([0.52, 0.35, 0.2], [0.7, 0.5, 0.3], 0.5 + 0.5 * Math.sin((x + z) * 18 + y * 3)) },
  plank: { paint: (x, y, z) => mix([0.55, 0.38, 0.22], [0.74, 0.55, 0.33], (Math.floor(y * 9) % 2) * 0.7) },
  hoop: { color: [0.28, 0.26, 0.26] }, clay: { paint: (x, y, z, nx, ny) => mix([0.72, 0.38, 0.24], [0.86, 0.54, 0.34], clamp(0.4 + 0.4 * ny, 0, 1)) },
  claydark: { color: [0.5, 0.25, 0.16] }, thorn: { paint: (x, y, z, nx, ny, nz, r) => mix([0.16, 0.24, 0.16], [0.3, 0.38, 0.2], r()), jitter: 0.06 },
  spike: { color: [0.52, 0.22, 0.3] }, crystal: { paint: (x, y, z, nx, ny, nz, r) => mix([0.4, 0.8, 0.95], [0.75, 0.95, 1.0], r()), glow: true, alpha: 0.85 },
  mushstem: { color: [0.92, 0.88, 0.78] }, mushcap: { paint: (x, y, z) => (noise(x * 14, z * 14 + y * 10) > 0.72 ? [0.98, 0.96, 0.9] : [0.82, 0.18, 0.18]) },
  hay: { paint: (x, y, z) => mix([0.86, 0.72, 0.32], [0.96, 0.86, 0.5], 0.5 + 0.5 * Math.sin(x * 30 + z * 30)), jitter: 0.1 },
  marble: { paint: (x, y, z, nx, ny) => mix([0.78, 0.76, 0.74], [0.92, 0.9, 0.88], clamp(0.5 + 0.5 * ny, 0, 1)) }, moss: { color: [0.36, 0.5, 0.26] },
  water: { color: [0.3, 0.55, 0.78] }, brass: { color: [0.86, 0.66, 0.28] }, sail: { color: [0.94, 0.9, 0.82] }, hull: { color: [0.36, 0.24, 0.16] }, hullRed: { color: [0.62, 0.2, 0.18] },
  fruit: { color: [0.92, 0.24, 0.2] }, bloomLeaf: { color: [0.3, 0.58, 0.28] }, bloom: { color: [1.0, 0.62, 0.5], glow: true }, stem: { color: [0.28, 0.5, 0.24] },
  cloud: { paint: (x, y, z, nx, ny) => mix([0.86, 0.84, 0.92], [1, 1, 1], clamp(0.5 + 0.5 * ny, 0, 1)), alpha: 0.8 },
};

/* ---------------- the ground ---------------- */
// A wide drum with soft hills on top and a taper below the sea. Sandy islands are pale; others are grass on rock.
export function ground(isl) {
  const r = isl.radius, rand = rng(isl.seed), [g1, g2] = isl.grass, ROCK = [0.5, 0.45, 0.42], ROCK2 = [0.66, 0.58, 0.5], DIRT = [0.6, 0.45, 0.3];
  const mat = { paint: (x, y, z, nx, ny) => {
    if (ny > 0.55) { const t = noise(x * 0.9 + isl.seed, z * 0.9); return mix(mix(g1, g2, t * 0.8), DIRT, clamp(noise(x * 2.3, z * 2.3) - 0.62, 0, 0.4) * 1.5); }
    return mix(ROCK, ROCK2, (0.5 + 0.5 * Math.sin(y * 9 + noise(x, z) * 3)) * 0.7); } };
  const shapes = [{ type: 'cylinder', size: [2.2, r], at: [0, -1.1, 0], mat }, { type: 'cone', size: [1.6, r * 0.62, r], at: [0, -3.0, 0], k: 0.6, mat }];
  for (let i = 0; i < 3; i++) { const a = rand() * Math.PI * 2, d = r * (0.25 + rand() * 0.4); shapes.push({ type: 'ellipsoid', size: [r * (0.35 + rand() * 0.2), 0.45 + rand() * 0.3, r * (0.35 + rand() * 0.2)], at: [Math.cos(a) * d, -0.4, Math.sin(a) * d], k: 1.1, mat }); }
  const f = field(shapes.map(prepare));
  const heightAt = (x, z) => { let y = 3; for (let i = 0; i < 80; i++) { const d = f(x, y, z); if (d < 0.002) break; y -= Math.max(d, 0.01); } return y; };
  return { shapes, heightAt, mat };
}

/* ---------------- things ---------------- */
// Each maker returns an object: { id, kind, label, parts, center, radius, solid (a footprint the keeper walks round),
// hits (taps to break), again ('pop' comes back at once, 'dawn' at the next dawn, 'never' stays broken), loot, use, talk }.
const thing = (o) => ({ hits: 0, again: 'pop', solid: 0, ...o });
function cottage(c, id, x, z, turn) {
  const y = c.h(x, z), cs = Math.cos(turn), sn = Math.sin(turn), at = (dx, dy, dz) => [x + dx * cs + dz * sn, y + dy, z - dx * sn + dz * cs], rot = r => [r[0] || 0, (r[1] || 0) + turn, r[2] || 0];
  return thing({ id, kind: 'cottage', label: 'Cottage', solid: 1.3, parts: [{ name: id, shapes: [
    { type: 'box', size: [1.1, 0.8, 0.9, 0.04], at: at(0, 0.78, 0), rot: rot([]), mat: M.wall },
    { type: 'box', size: [0.86, 0.86, 1.08, 0.05], at: at(0, 1.62, 0), rot: rot([0, 0, Math.PI / 4]), mat: M.roof },
    { type: 'box', size: [0.13, 0.4, 0.13], at: at(0.55, 2.05, -0.35), rot: rot([]), mat: M.chimney },
    { type: 'box', size: [0.24, 0.42, 0.08], at: at(0, 0.42, 0.9), rot: rot([]), cut: true, mat: M.door },
    { type: 'box', size: [0.2, 0.16, 0.06], at: at(-0.62, 0.95, 0.9), rot: rot([]), cut: true, mat: M.window },
    { type: 'box', size: [0.06, 0.16, 0.18], at: at(1.1, 0.95, 0.2), rot: rot([]), cut: true, mat: M.window }] }], center: [x, y + 1.1, z], radius: 1.7 });
}
function lighthouse(c, id, x, z) {
  const y = c.h(x, z) - 0.05;
  return thing({ id, kind: 'lighthouse', label: 'Lighthouse', solid: 0.75, parts: [{ name: id, stroke: { along: [0, 1, 0], stretch: 1.4 }, shapes: [
    { type: 'cone', size: [3.0, 0.62, 0.4], at: [x, y + 1.5, z], mat: M.tower }, { type: 'cylinder', size: [0.12, 0.62], at: [x, y + 3.06, z], k: 0.04, mat: M.cap },
    { type: 'cylinder', size: [0.5, 0.32], at: [x, y + 3.36, z], mat: M.lamp }, { type: 'cone', size: [0.5, 0.46, 0.02], at: [x, y + 3.86, z], mat: M.cap },
    { type: 'box', size: [0.12, 0.26, 0.05], at: [x, y + 0.36, z + 0.6], cut: true, mat: M.door }] }], center: [x, y + 2, z], radius: 2.1, lamp: [x, y + 3.36, z] });
}
function tree(c, id, x, z, fruit = false) {
  const r = c.rand, y = c.h(x, z) - 0.05, h = 1.3 + r() * 0.8, w = 0.85 + r() * 0.35, lean = (r() - 0.5) * 0.25;
  const shapes = [{ type: 'capsule', size: [h, 0.12], at: [x, y + h / 2, z], rot: [lean, 0, lean * 0.5], mat: M.bark }], n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = i ? w * 0.55 : 0; shapes.push({ type: 'sphere', size: [w * (i ? 0.62 + r() * 0.2 : 0.85)], at: [x + Math.cos(a) * d, y + h + 0.25 + (i ? r() * 0.45 : 0.3), z + Math.sin(a) * d], k: 0.35, mat: M.leaf }); }
  if (fruit) for (let i = 0; i < 6; i++) { const a = r() * Math.PI * 2, e = r() * 0.6; shapes.push({ type: 'sphere', size: [0.09], at: [x + Math.cos(a) * w * 0.85, y + h + 0.1 + e, z + Math.sin(a) * w * 0.85], mat: M.fruit }); }
  return thing({ id, kind: 'tree', label: fruit ? 'Fruit tree' : 'Tree', solid: 0.3, parts: [{ name: id, shapes, stroke: { size: 1.15 } }], center: [x, y + h, z], radius: w + 0.6 });
}
function rock(c, id, x, z) {
  const r = c.rand, y = c.h(x, z), s = 0.3 + r() * 0.4;
  return thing({ id, kind: 'rock', label: 'Rock', solid: s, parts: [{ name: id, shapes: [{ type: 'ellipsoid', size: [s * 1.3, s * 0.75, s], at: [x, y + s * 0.3, z], rot: [r() * 0.4, r() * 3, r() * 0.3], mat: M.stone }, { type: 'ellipsoid', size: [s * 0.7, s * 0.6, s * 0.7], at: [x + s * 0.6, y + s * 0.2, z + s * 0.3], k: 0.18, mat: M.stone }] }], center: [x, y + s * 0.3, z], radius: s * 1.6 });
}
function crate(c, id, x, z, loot) {
  const y = c.h(x, z), s = 0.3 + c.rand() * 0.06, t = c.rand() * 3;
  return thing({ id, kind: 'crate', label: 'Crate', hits: 1, again: loot ? 'never' : 'dawn', loot, solid: s, parts: [{ name: id, shapes: [{ type: 'box', size: [s, s, s, 0.03], at: [x, y + s, z], rot: [0, t, 0], mat: M.plank }, { type: 'box', size: [s * 0.25, s * 1.02, s * 1.02], at: [x, y + s, z], rot: [0, t, 0], k: 0.01, mat: M.wood }] }], center: [x, y + s, z], radius: s * 1.6 });
}
function barrel(c, id, x, z, loot) {
  const y = c.h(x, z);
  return thing({ id, kind: 'barrel', label: 'Barrel', hits: 1, again: loot ? 'never' : 'dawn', loot, solid: 0.32, parts: [{ name: id, stroke: { along: [0, 1, 0] }, shapes: [{ type: 'cylinder', size: [0.8, 0.28], at: [x, y + 0.4, z], mat: M.wood }, { type: 'ellipsoid', size: [0.32, 0.36, 0.32], at: [x, y + 0.4, z], k: 0.08, mat: M.wood }, { type: 'torus', size: [0.31, 0.022], at: [x, y + 0.18, z], k: 0.01, mat: M.hoop }, { type: 'torus', size: [0.31, 0.022], at: [x, y + 0.62, z], k: 0.01, mat: M.hoop }] }], center: [x, y + 0.4, z], radius: 0.55 });
}
function pot(c, id, x, z, loot) {
  const y = c.h(x, z), s = 0.8 + c.rand() * 0.4;
  return thing({ id, kind: 'pot', label: 'Clay pot', hits: 1, again: 'dawn', loot, solid: 0.25 * s, parts: [{ name: id, shapes: [{ type: 'ellipsoid', size: [0.24 * s, 0.26 * s, 0.24 * s], at: [x, y + 0.24 * s, z], mat: M.clay }, { type: 'cylinder', size: [0.16 * s, 0.11 * s], at: [x, y + 0.5 * s, z], k: 0.04, mat: M.clay }, { type: 'torus', size: [0.12 * s, 0.025], at: [x, y + 0.58 * s, z], k: 0.02, mat: M.claydark }] }], center: [x, y + 0.3 * s, z], radius: 0.4 * s });
}
function thornbush(c, id, x, z, size = 1, opts = {}) {
  const r = c.rand, y = c.h(x, z), shapes = [];
  for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = r() * 0.25 * size; shapes.push({ type: 'sphere', size: [(0.28 + r() * 0.12) * size], at: [x + Math.cos(a) * d, y + 0.25 * size + r() * 0.15 * size, z + Math.sin(a) * d], k: 0.15 * size, mat: M.thorn }); }
  for (let i = 0; i < 7; i++) { const a = r() * 6.28, b = 0.3 + r() * 0.9; shapes.push({ type: 'capsule', size: [0.32 * size, 0.025], at: [x + Math.cos(a) * 0.32 * size, y + 0.3 * size + r() * 0.2 * size, z + Math.sin(a) * 0.32 * size], rot: [Math.sin(a) * b, 0, -Math.cos(a) * b], k: 0.03, mat: M.spike }); }
  return thing({ id, kind: 'thornbush', label: opts.label || 'Thornbush', hits: opts.hits || 1, again: opts.again || 'never', solid: 0.35 * size, parts: [{ name: id, shapes }], center: [x, y + 0.3 * size, z], radius: 0.6 * size, ...opts.extra });
}
function thorntree(c, id, x, z) {
  const r = c.rand, y = c.h(x, z) - 0.05, shapes = [{ type: 'capsule', size: [1.6, 0.17], at: [x, y + 0.8, z], rot: [0.12, 0, -0.1], mat: M.thorn }];
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + r(), b = 0.7 + r() * 0.4; shapes.push({ type: 'capsule', size: [0.9, 0.07], at: [x + Math.cos(a) * 0.35, y + 1.5 + r() * 0.3, z + Math.sin(a) * 0.35], rot: [Math.sin(a) * b, 0, -Math.cos(a) * b], k: 0.08, mat: M.thorn }); }
  for (let i = 0; i < 9; i++) { const a = r() * 6.28, b = 0.5 + r() * 0.8; shapes.push({ type: 'capsule', size: [0.3, 0.025], at: [x + Math.cos(a) * 0.5, y + 1.0 + r() * 1.0, z + Math.sin(a) * 0.5], rot: [Math.sin(a) * b, 0, -Math.cos(a) * b], k: 0.03, mat: M.spike }); }
  return thing({ id, kind: 'thorntree', label: 'Thorn tree', hits: 3, again: 'never', solid: 0.3, parts: [{ name: id, shapes }], center: [x, y + 1.2, z], radius: 1.1 });
}
function stonewall(c, id, x, z, turn, loot) {
  const y = c.h(x, z), shapes = [], cs = Math.cos(turn), sn = Math.sin(turn);
  for (let i = -2; i <= 2; i++) for (let j = 0; j < 2; j++) { const dx = i * 0.42 + (j % 2) * 0.2, h = y + 0.2 + j * 0.36; shapes.push({ type: 'box', size: [0.2, 0.16, 0.18, 0.05], at: [x + dx * cs, h, z - dx * sn], rot: [c.rand() * 0.1, turn + c.rand() * 0.2, 0], k: 0.04, mat: j && c.rand() < 0.3 ? M.moss : M.stone }); }
  return thing({ id, kind: 'stonewall', label: 'Old stone wall', hits: 2, again: 'never', loot, solid: 0.9, parts: [{ name: id, shapes }], center: [x, y + 0.4, z], radius: 1.2 });
}
function crystals(c, id, x, z) {
  const r = c.rand, y = c.h(x, z), shapes = [];
  for (let i = 0; i < 5; i++) { const a = r() * 6.28, b = 0.2 + r() * 0.4, h = 0.4 + r() * 0.5; shapes.push({ type: 'cone', size: [h, 0.09, 0.01], at: [x + Math.cos(a) * 0.15, y + h / 2, z + Math.sin(a) * 0.15], rot: [Math.sin(a) * b, 0, -Math.cos(a) * b], mat: M.crystal }); }
  return thing({ id, kind: 'crystal', label: 'Crystals', hits: 1, again: 'pop', solid: 0.25, parts: [{ name: id, shapes }], center: [x, y + 0.35, z], radius: 0.6 });
}
function mushroom(c, id, x, z) {
  const y = c.h(x, z), s = 0.7 + c.rand() * 0.6;
  return thing({ id, kind: 'mushroom', label: 'Mushroom', hits: 1, again: 'pop', parts: [{ name: id, shapes: [{ type: 'cylinder', size: [0.34 * s, 0.07 * s], at: [x, y + 0.17 * s, z], mat: M.mushstem }, { type: 'ellipsoid', size: [0.24 * s, 0.13 * s, 0.24 * s], at: [x, y + 0.36 * s, z], k: 0.03, mat: M.mushcap }] }], center: [x, y + 0.25 * s, z], radius: 0.35 * s });
}
function fence(c, id, x, z, turn) {
  const y = c.h(x, z), shapes = [], cs = Math.cos(turn), sn = Math.sin(turn);
  for (let i = -1; i <= 1; i++) { const dx = i * 0.6; shapes.push({ type: 'capsule', size: [0.55, 0.04], at: [x + dx * cs, y + 0.3, z - dx * sn], mat: M.wood }); }
  for (const h of [0.22, 0.44]) shapes.push({ type: 'box', size: [0.66, 0.03, 0.025], at: [x, y + h, z], rot: [0, turn, 0], k: 0.02, mat: M.wood });
  return thing({ id, kind: 'fence', label: 'Fence', hits: 1, again: 'dawn', solid: 0, parts: [{ name: id, shapes, stroke: { along: [0, 1, 0] } }], center: [x, y + 0.3, z], radius: 0.8 });
}
function haybale(c, id, x, z) {
  const y = c.h(x, z), t = c.rand() * 3;
  return thing({ id, kind: 'hay', label: 'Hay bale', hits: 1, again: 'dawn', solid: 0.4, parts: [{ name: id, shapes: [{ type: 'cylinder', size: [0.7, 0.32, 0.04], at: [x, y + 0.32, z], rot: [Math.PI / 2, t, 0], mat: M.hay }] }], center: [x, y + 0.32, z], radius: 0.55 });
}
function statue(c, id, x, z) {
  const y = c.h(x, z);
  return thing({ id, kind: 'statue', label: 'Stone statue', hits: 2, again: 'pop', solid: 0.35, parts: [{ name: id, shapes: [
    { type: 'box', size: [0.3, 0.2, 0.3, 0.03], at: [x, y + 0.2, z], mat: M.marble }, { type: 'cone', size: [0.8, 0.2, 0.12], at: [x, y + 0.8, z], k: 0.04, mat: M.marble },
    { type: 'sphere', size: [0.14], at: [x, y + 1.32, z], k: 0.05, mat: M.marble }, { type: 'cone', size: [0.24, 0.16, 0.0], at: [x, y + 1.52, z], k: 0.02, mat: M.moss }] }], center: [x, y + 0.75, z], radius: 0.7 });
}
function well(c, id, x, z) {
  const y = c.h(x, z);
  return thing({ id, kind: 'well', label: 'Well', use: 'well', solid: 0.6, parts: [{ name: id, shapes: [
    { type: 'cylinder', size: [0.5, 0.45], at: [x, y + 0.25, z], mat: M.stone }, { type: 'cylinder', size: [0.6, 0.34], at: [x, y + 0.35, z], cut: true, mat: M.stone },
    { type: 'cylinder', size: [0.04, 0.34], at: [x, y + 0.12, z], mat: M.water },
    { type: 'capsule', size: [1.0, 0.04], at: [x - 0.4, y + 0.75, z], mat: M.wood }, { type: 'capsule', size: [1.0, 0.04], at: [x + 0.4, y + 0.75, z], mat: M.wood },
    { type: 'box', size: [0.52, 0.04, 0.4, 0.01], at: [x - 0.24, y + 1.32, z], rot: [0, 0, 0.6], mat: M.roof }, { type: 'box', size: [0.52, 0.04, 0.4, 0.01], at: [x + 0.24, y + 1.32, z], rot: [0, 0, -0.6], mat: M.roof }] }], center: [x, y + 0.6, z], radius: 0.8 });
}
function belltower(c, id, x, z) {
  const y = c.h(x, z) - 0.05;
  return thing({ id, kind: 'tower', label: 'Bell tower', use: 'bell', solid: 0.7, parts: [{ name: id, stroke: { along: [0, 1, 0] }, shapes: [
    { type: 'box', size: [0.55, 1.2, 0.55, 0.04], at: [x, y + 1.2, z], mat: M.stone }, { type: 'box', size: [0.4, 0.4, 0.62], at: [x, y + 2.2, z], cut: true, mat: M.stone },
    { type: 'box', size: [0.62, 0.4, 0.4], at: [x, y + 2.2, z], cut: true, mat: M.stone }, { type: 'cone', size: [0.8, 0.62, 0.02], at: [x, y + 2.85, z], k: 0.02, mat: M.roof },
    { type: 'cone', size: [0.36, 0.22, 0.1], at: [x, y + 2.2, z], mat: M.brass }, { type: 'torus', size: [0.21, 0.025], at: [x, y + 2.03, z], k: 0.01, mat: M.brass }] }], center: [x, y + 1.4, z], radius: 1.4, bell: [x, y + 2.2, z] });
}
function wreck(c, id, x, z, turn) {
  const y = c.h(x, z) - 0.15;
  return thing({ id, kind: 'wreck', label: 'Old wreck', solid: 1.1, parts: [{ name: id, shapes: [
    { type: 'ellipsoid', size: [1.6, 0.6, 0.6], at: [x, y + 0.2, z], rot: [0.35, turn, 0.15], mat: M.hullRed }, { type: 'box', size: [2, 0.6, 1], at: [x, y + 0.75, z], rot: [0.35, turn, 0.15], cut: true, mat: M.wood },
    { type: 'capsule', size: [1.2, 0.05], at: [x, y + 0.7, z], rot: [0.5, turn, 0.5], mat: M.wood }] }], center: [x, y + 0.4, z], radius: 1.7 });
}
function bloom(c, id, x, z) {
  const y = c.h(x, z);
  return thing({ id, kind: 'bloom', label: 'Lantern-bloom', use: 'bloom', parts: [{ name: id, shapes: [
    { type: 'capsule', size: [0.5, 0.025], at: [x, y + 0.25, z], rot: [0.08, 0, 0.05], mat: M.stem }, { type: 'ellipsoid', size: [0.16, 0.025, 0.07], at: [x + 0.1, y + 0.18, z], rot: [0, 0, 0.5], k: 0.02, mat: M.bloomLeaf },
    { type: 'ellipsoid', size: [0.16, 0.025, 0.07], at: [x - 0.1, y + 0.26, z], rot: [0, 0, -0.5], k: 0.02, mat: M.bloomLeaf }, { type: 'ellipsoid', size: [0.11, 0.15, 0.11], at: [x, y + 0.6, z], k: 0.03, mat: M.bloom }] }], center: [x, y + 0.45, z], radius: 0.45 });
}
function sprout(c, id, x, z) { return thornbush(c, id, x, z, 0.45, { label: 'Thorn sprout', again: 'never' }); }
// The dock and the keeper's little boat, at the island's edge, pointing out to sea.
function dock(c, id, isl, a) {
  const r = isl.radius, ca = Math.cos(a), sa = Math.sin(a), at = d => [ca * d, 0, sa * d], shapes = [];
  for (let d = r - 0.6; d < r + 1.7; d += 0.32) { const p = at(d); shapes.push({ type: 'box', size: [0.14, 0.03, 0.42, 0.01], at: [p[0], 0.04, p[2]], rot: [0, -a, 0], k: 0.01, mat: M.plank }); }
  for (const d of [r + 0.3, r + 1.5]) for (const s of [-0.38, 0.38]) shapes.push({ type: 'cylinder', size: [1.1, 0.05], at: [ca * d - sa * s, -0.55, sa * d + ca * s], mat: M.wood });
  const b = at(r + 2.4), boat = [{ type: 'ellipsoid', size: [0.75, 0.22, 0.3], at: [b[0], SEA + 0.05, b[2]], rot: [0, -a + Math.PI / 2, 0], mat: M.hull }, { type: 'box', size: [0.8, 0.2, 0.4], at: [b[0], SEA + 0.25, b[2]], rot: [0, -a + Math.PI / 2, 0], cut: true, mat: M.wood },
    { type: 'capsule', size: [1.1, 0.025], at: [b[0], SEA + 0.6, b[2]], mat: M.wood }, { type: 'box', size: [0.02, 0.35, 0.22], at: [b[0] + sa * 0.12, SEA + 0.7, b[2] - ca * 0.12], rot: [0, -a, 0], mat: M.sail }];
  return thing({ id, kind: 'dock', label: 'Boat', use: 'sail', solid: 0, parts: [{ name: id, shapes: [...shapes, ...boat] }], center: [b[0], SEA + 0.4, b[2]], radius: 1.4, near: at(r + 1.3) });
}

/* ---------------- people ---------------- */
// A person is a robe, a head and a hat, painted round a point on the ground; the page moves it as a whole.
export const PEOPLE = {
  keeper: { robe: [0.24, 0.36, 0.62], hat: 'hood', hatColor: [0.2, 0.3, 0.55], skin: [0.98, 0.82, 0.68], height: 0.95, lantern: true },
  gardener: { robe: [0.5, 0.62, 0.3], hat: 'brim', hatColor: [0.86, 0.74, 0.42], skin: [0.86, 0.64, 0.48], height: 1.15 },
  bellringer: { robe: [0.52, 0.3, 0.46], hat: 'cone', hatColor: [0.34, 0.2, 0.32], skin: [0.95, 0.8, 0.7], height: 1.2 },
  fisher: { robe: [0.86, 0.66, 0.24], hat: 'brim', hatColor: [0.92, 0.84, 0.3], skin: [0.8, 0.58, 0.44], height: 1.2 },
  lampkeeper: { robe: [0.24, 0.26, 0.34], hat: 'cone', hatColor: [0.6, 0.18, 0.18], skin: [0.94, 0.78, 0.66], height: 1.25 },
};
export function figure(kind, { density = 500, rand = rng(7), size = 1 } = {}) {
  const p = PEOPLE[kind], h = p.height, s = h / 1.2, shapes = [
    { type: 'cone', size: [0.75 * s, 0.3 * s, 0.13 * s], at: [0, 0.375 * s, 0], mat: { color: p.robe } },
    { type: 'sphere', size: [0.19 * s], at: [0, 0.92 * s, 0], k: 0.04, mat: { color: p.skin } },
    { type: 'capsule', size: [0.32 * s, 0.05 * s], at: [0.2 * s, 0.55 * s, 0], rot: [0, 0, 0.45], k: 0.05, mat: { color: p.robe } },
    { type: 'capsule', size: [0.32 * s, 0.05 * s], at: [-0.2 * s, 0.55 * s, 0], rot: [0, 0, -0.45], k: 0.05, mat: { color: p.robe } },
    { type: 'sphere', size: [0.03 * s], at: [0.07 * s, 0.95 * s, 0.17 * s], mat: { color: [0.12, 0.1, 0.12] } }, { type: 'sphere', size: [0.03 * s], at: [-0.07 * s, 0.95 * s, 0.17 * s], mat: { color: [0.12, 0.1, 0.12] } },
  ];
  if (p.hat === 'hood') shapes.push({ type: 'sphere', size: [0.22 * s], at: [0, 0.97 * s, -0.05 * s], k: 0.02, mat: { color: p.hatColor } }, { type: 'sphere', size: [0.2 * s], at: [0, 0.93 * s, 0.1 * s], cut: true, mat: { color: p.hatColor } });
  if (p.hat === 'brim') shapes.push({ type: 'cylinder', size: [0.03 * s, 0.32 * s], at: [0, 1.08 * s, 0], mat: { color: p.hatColor } }, { type: 'cylinder', size: [0.14 * s, 0.17 * s], at: [0, 1.15 * s, 0], k: 0.01, mat: { color: p.hatColor } });
  if (p.hat === 'cone') shapes.push({ type: 'cone', size: [0.4 * s, 0.2 * s, 0.01], at: [0, 1.25 * s, 0], k: 0.02, mat: { color: p.hatColor } });
  if (p.lantern) shapes.push({ type: 'capsule', size: [0.12 * s, 0.012], at: [0.32 * s, 0.4 * s, 0.05 * s], mat: { color: [0.3, 0.26, 0.24] } }, { type: 'sphere', size: [0.07 * s], at: [0.32 * s, 0.28 * s, 0.05 * s], mat: { color: [1, 0.85, 0.45], glow: true } });
  const part = { name: kind, shapes, density: 6, stroke: { size: 0.9 } }, splats = paint(part, { density: density * 6, rand, size, shell: 0.02 }); bake(splats, {});
  return split({ name: kind, pivot: [0, 0, 0], splats, shapes });
}

/* ---------------- the goat ---------------- */
const GOAT = { color: [0.93, 0.9, 0.84], jitter: 0.05 }, HOOF = { color: [0.3, 0.26, 0.24] }, HORN = { color: [0.66, 0.6, 0.5] }, NOSE = { color: [0.75, 0.55, 0.52] };
export function goat({ density = 500, rand = rng(5) } = {}) {
  const legs = [[0.27, 0.13], [0.27, -0.13], [-0.25, 0.13], [-0.25, -0.13]].map(([lx, lz], i) => ({ name: 'goat-leg' + i, pivot: [lx, -0.1, lz], stroke: { along: [0, 1, 0] }, shapes: [{ type: 'capsule', size: [0.3, 0.055], at: [0, -0.2, 0], mat: GOAT }, { type: 'cylinder', size: [0.07, 0.065], at: [0, -0.37, 0], k: 0.03, mat: HOOF }] }));
  const head = { name: 'goat-head', pivot: [0.36, 0.12, 0], shapes: [
    { type: 'ellipsoid', size: [0.17, 0.11, 0.1], at: [0.12, 0.06, 0], rot: [0, 0, -0.5], mat: GOAT }, { type: 'ellipsoid', size: [0.06, 0.05, 0.06], at: [0.25, -0.02, 0], k: 0.04, mat: NOSE },
    { type: 'capsule', size: [0.16, 0.025], at: [0.04, 0.2, 0.05], rot: [0.3, 0, 0.7], mat: HORN }, { type: 'capsule', size: [0.16, 0.025], at: [0.04, 0.2, -0.05], rot: [-0.3, 0, 0.7], mat: HORN },
    { type: 'ellipsoid', size: [0.08, 0.03, 0.04], at: [0.04, 0.09, 0.12], rot: [0.6, 0, 0], k: 0.02, mat: GOAT }, { type: 'ellipsoid', size: [0.08, 0.03, 0.04], at: [0.04, 0.09, -0.12], rot: [-0.6, 0, 0], k: 0.02, mat: GOAT },
    { type: 'capsule', size: [0.08, 0.025], at: [0.19, -0.12, 0], mat: GOAT }] };
  const body = { name: 'goat-body', pivot: [0, 0, 0], shapes: [{ type: 'ellipsoid', size: [0.42, 0.24, 0.22], at: [0, 0, 0], mat: GOAT }, { type: 'capsule', size: [0.16, 0.1], at: [0.3, 0.1, 0], rot: [0, 0, -0.9], k: 0.08, mat: GOAT }] };
  const tail = { name: 'goat-tail', pivot: [-0.4, 0.1, 0], shapes: [{ type: 'ellipsoid', size: [0.07, 0.04, 0.04], at: [-0.04, 0.03, 0], rot: [0, 0, 0.6], mat: GOAT }] };
  return [body, head, tail, ...legs].flatMap(p => { const splats = paint(p, { density: density * 5, rand, shell: 0.02 }); bake(splats, {}); return split({ name: p.name, pivot: p.pivot, splats, shapes: p.shapes }); });
}

/* ---------------- the sea and the sky ---------------- */
export function world({ density = 400, rand = rng(3) } = {}) {
  const SEACOL = { paint: (x, y, z, nx, ny, nz, rr) => mix([0.12, 0.36, 0.62], [0.32, 0.64, 0.82], clamp(noise(x * 1.1, z * 1.1) * 0.8 + (rr() < 0.04 ? 0.6 : 0), 0, 1)), alpha: 0.95 };
  const n = Math.round(70000 * Math.min(1, density / 520)), sea = { name: 'sea', density: 0.6, stroke: { size: 1.5, along: [1, 0, 0.3], stretch: 1.9 }, points: r => {
    const out = []; for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, e = 1.5 + 68 * r() ** 1.7; out.push([Math.cos(a) * e, 0, Math.sin(a) * e, 0, 1, 0, SEACOL]); } return out; } };
  const seaSplats = scatter(sea, { density: 60, rand }); bake(seaSplats, {});
  // far strokes grow with distance, so the sea stays closed out to the horizon
  for (let i = 0; i < seaSplats.count; i++) { const d = Math.hypot(seaSplats.pos[i * 3], seaSplats.pos[i * 3 + 2]), k = 0.8 + d / 7; seaSplats.scale[i * 3] *= k; seaSplats.scale[i * 3 + 1] *= k; }
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const shapes = [], n = 4 + Math.floor(rand() * 3); for (let k = 0; k < n; k++) shapes.push({ type: 'sphere', size: [0.6 + rand() * 0.5], at: [(k - n / 2) * 0.65 + rand() * 0.3, rand() * 0.4, (rand() - 0.5) * 0.7], k: 0.5, mat: M.cloud });
    const a = rand() * Math.PI * 2, d = 7 + rand() * 22, splats = paint({ shapes, stroke: { size: 1.4 } }, { density: density * 0.45, rand }); bake(splats, {});
    clouds.push({ name: 'cloud' + i, pivot: [Math.cos(a) * d, 5.5 + rand() * 2, Math.sin(a) * d], splats, shapes });
  }
  return { sea: { name: 'sea', pivot: [0, SEA, 0], splats: seaSplats, shapes: null }, clouds };
}

/* ---------------- one island ---------------- */
// What stands where on each island. state tells which things are broken or done, so they stay that way.
function layout(isl, c, state) {
  const out = [], taken = [], r = isl.radius, r0 = r, rand = c.rand;
  const free = (x, z, rad) => Math.hypot(x, z) < r - 0.55 - rad * 0.4 && taken.every(t => Math.hypot(t[0] - x, t[1] - z) > t[2] + rad);
  const put = (o, x, z, rad) => { out.push(o); taken.push([x, z, rad]); return o; };
  const spot = (rad, min = 0.4, max = r - 0.8) => { for (let i = 0; i < 300; i++) { const a = rand() * Math.PI * 2, d = min + rand() * (max - min), x = Math.cos(a) * d, z = Math.sin(a) * d; if (free(x, z, rad)) return [x, z]; } return null; };
  const at = (make, x, z, rad, ...args) => put(make(c, ...args.slice(0, 1), x, z, ...args.slice(1)), x, z, rad);
  // the dock: toward the sea between this island and Home Isle
  const da = isl.id === 'home' ? 0.9 : Math.atan2(-isl.at[1], -isl.at[0]);
  out.push(dock(c, 'dock', isl, da)); taken.push([Math.cos(da) * (r - 0.4), Math.sin(da) * (r - 0.4), 1.0]);
  const start = [Math.cos(da) * (r - 1.4), Math.sin(da) * (r - 1.4)]; taken.push([...start, 0.5]);
  const person = (kind, x, z) => { put({ id: kind, kind: 'person', person: kind, label: { gardener: 'Gardener', bellringer: 'Bellringer', fisher: 'Fisher', lampkeeper: 'Lamp keeper' }[kind], talk: kind, parts: [], solid: 0.3, center: [x, c.h(x, z) + 0.6, z], radius: 0.7, ground: [x, c.h(x, z), z] }, x, z, 0.6); };
  const n = (id, rad, make, ...args) => { const p = spot(rad); if (!p) return; const o = make(c, id, p[0], p[1], ...args); put(o, p[0], p[1], rad); };
  if (isl.id === 'home') {
    at((cc, id, x, z, t) => cottage(cc, id, x, z, t), -0.6, -1.2, 1.6, 'cottage', 0.4);
    at((cc, id, x, z) => well(cc, id, x, z), 1.9, -1.9, 0.8, 'well');
    at((cc, id, x, z) => bloom(cc, id, x, z), 0.6, 0.9, 0.5, 'bloom');
    for (let i = 0; i < 3; i++) n('tree' + i, 0.9, tree);
    for (let i = 0; i < 3; i++) n('rock' + i, 0.5, rock);
    n('fence0', 0.7, fence, rand() * 3); n('hay0', 0.6, haybale); n('pot0', 0.4, pot, 'shell'); n('mush0', 0.35, mushroom); n('mush1', 0.35, mushroom);
    // sprouts: [id, the day it came up]. Each finds its own open spot, from a seed of its id, so it stays put.
    for (const [sid, born] of state.sprouts || []) { const big = (state.day || 0) - (born || 0) >= 2, r = rng([...sid].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)), rad = big ? 0.6 : 0.3;
      for (let i = 0; i < 200; i++) { const a = r() * Math.PI * 2, d = 1 + r() * (r0 - 1.8), x = Math.cos(a) * d, z = Math.sin(a) * d; if (free(x, z, rad)) { put(big ? thorntree(c, sid, x, z) : sprout(c, sid, x, z), x, z, rad); break; } } }
  } else if (isl.id === 'orchard') {
    person('gardener', 0.2, 0.3);
    for (let i = 0; i < 4; i++) n('fruit' + i, 0.95, tree, true);
    for (let i = 0; i < 4; i++) n('thorn' + i, 0.6, thornbush);
    n('thorntree', 1.0, thorntree);
    n('wall', 1.1, stonewall, rand() * 3, 'stone');
    n('hay0', 0.6, haybale); n('fence0', 0.7, fence, rand() * 3); n('pot0', 0.4, pot, 'shell');
  } else if (isl.id === 'bell') {
    at((cc, id, x, z) => belltower(cc, id, x, z), 0, 0, 1.2, 'tower');
    person('bellringer', 1.4, 0.9);
    n('statue0', 0.6, statue); n('statue1', 0.6, statue);
    for (let i = 0; i < 3; i++) n('crate' + i, 0.45, crate, i === 0 ? 'shell' : null);
    n('pot0', 0.4, pot, 'shell'); n('pot1', 0.4, pot); n('tree0', 0.9, tree); n('rock0', 0.5, rock);
  } else if (isl.id === 'wreck') {
    at((cc, id, x, z, t) => wreck(cc, id, x, z, t), -1.2, 1.1, 1.5, 'wreck', 0.6);
    person('fisher', 1.0, -0.6);
    const rope = Math.floor(rand() * 4); for (let i = 0; i < 4; i++) n('crate' + i, 0.45, crate, i === rope ? 'rope' : (i === (rope + 2) % 4 ? 'shell' : null));
    for (let i = 0; i < 3; i++) n('barrel' + i, 0.45, barrel, i === 1 ? 'shell' : null);
    n('rock0', 0.5, rock); n('rock1', 0.5, rock); n('crys0', 0.4, crystals);
  } else if (isl.id === 'light') {
    at((cc, id, x, z) => lighthouse(cc, id, x, z), 0.4, -0.6, 1.0, 'lighthouse');
    person('lampkeeper', -1.2, 0.4);
    for (let i = 0; i < 3; i++) n('crys' + i, 0.4, crystals);
    n('statue0', 0.6, statue); n('rock0', 0.5, rock); n('mush0', 0.35, mushroom); n('mush1', 0.35, mushroom); n('barrel0', 0.45, barrel, 'shell');
  }
  return { objects: out, start, dockAngle: da, free, sprouts: out.filter(o => o.id.startsWith('sprout')).map(o => o.id) };
}

// Paint one island. density is strokes per square metre; far paints a quick, sparse copy of the big things for the
// horizon. Broken things that are gone (per state.broken) are left out. Each part's light is baked with a soft shadow
// from every solid thing on the island, through a grid of distances.
export async function build(id, { density = 520, cell = 0.14, far = false, state = {}, onProgress = () => {}, yieldTo = () => new Promise(r => setTimeout(r, 0)) } = {}) {
  const isl = ISLANDS[id], g = ground(isl), rand = rng(isl.seed * 31 + 7), c = { h: g.heightAt, rand };
  const lay = layout(isl, c, state), gone = state.broken || {};
  let objects = lay.objects.filter(o => !gone[o.id]);
  if (far) objects = objects.filter(o => ['cottage', 'lighthouse', 'tree', 'tower', 'wreck', 'dock'].includes(o.kind));
  const groundObj = { id: 'ground', kind: 'ground', label: isl.name, fixed: true, parts: [{ name: 'ground', shapes: g.shapes, clip: { lo: [null, SEA - 0.12, null] }, density: far ? 1 : 0.62, stroke: { size: 1.1 } }], center: [0, -0.4, 0], radius: isl.radius + 1 };
  // grass: short upright strokes on the open ground, which give the top its texture
  if (!far) groundObj.parts.push({ name: 'grass', density: 0.3, stroke: { size: 0.55, along: [0, 1, 0], stretch: 2.2 }, points: (r) => {
    const out = [], [g1, g2] = isl.grass, n = Math.round(Math.PI * isl.radius * isl.radius * density * 0.22);
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (isl.radius - 0.35), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!lay.free(x, z, 0) && r() < 0.8) continue; const y = g.heightAt(x, z); out.push([x, y + 0.035, z, (r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3, { color: mix(g1, g2, r() * 0.9).map(v => v * 1.08), jitter: 0.08 }]); }
    return out; } });
  objects = [groundObj, ...objects];
  // the shadow grid: the ground and every solid thing
  const solid = []; for (const o of objects) for (const p of o.parts) if (p.shapes) { const sh = p.shapes.map(prepare); solid.push({ f: field(sh), ...bounds(sh) }); }
  const boxDist = (b, x, y, z) => Math.hypot(Math.max(b.lo[0] - x, x - b.hi[0], 0), Math.max(b.lo[1] - y, y - b.hi[1], 0), Math.max(b.lo[2] - z, z - b.hi[2], 0));
  const sdf0 = (x, y, z) => { let d = Infinity; for (const s of solid) { if (boxDist(s, x, y, z) > d) continue; d = Math.min(d, s.f(x, y, z)); } return d; };
  const R = isl.radius + 1.8, grid = new Grid([-R, -1.3, -R], [R, 4.6, R], far ? cell * 2.5 : cell, sdf0), sdf = (x, y, z) => grid.at(x, y, z);
  await yieldTo(); onProgress(0.15);
  const parts = [], total = objects.reduce((n, o) => n + o.parts.length, 0); let done = 0;
  for (const o of objects) {
    for (const p of o.parts) {
      const opts = { density: density * (p.density || 1), rand };
      const splats = p.points ? scatter(p, opts) : paint(p, opts);
      bake(splats, { sdf, shadows: !far });
      parts.push(...split({ name: p.name, object: o.id, pivot: [0, 0, 0], splats, shapes: p.shapes || null }));
      done++; onProgress(0.15 + 0.85 * done / total); await yieldTo();
    }
  }
  const meta = objects.map(({ parts: ps, ...rest }) => ({ ...rest, parts: ps.map(p => p.name) }));
  return { island: isl, objects: meta, parts: parts.map(p => ({ ...p, object: p.object })), count: parts.reduce((n, p) => n + p.splats.count, 0), heightAt: g.heightAt, start: lay.start, dockAngle: lay.dockAngle, sprouts: lay.sprouts };
}
// A part whose strokes include lamps becomes two parts: the lamp strokes, which keep their glow at night, and the rest.
export function split(part) {
  const sp = part.splats; let lit = 0; for (let i = 0; i < sp.count; i++) lit += sp.glow[i];
  if (!lit || lit === sp.count) return [{ ...part, glow: lit === sp.count && lit > 0 }];
  const take = want => { const idx = []; for (let i = 0; i < sp.count; i++) if (!!sp.glow[i] === want) idx.push(i); const pick = (arr, k) => { const out = new arr.constructor(idx.length * k); idx.forEach((s, j) => { for (let q = 0; q < k; q++) out[j * k + q] = arr[s * k + q]; }); return out; };
    return { count: idx.length, pos: pick(sp.pos, 3), nrm: pick(sp.nrm, 3), scale: pick(sp.scale, 3), quat: pick(sp.quat, 4), albedo: pick(sp.albedo, 3), color: pick(sp.color, 3), alpha: pick(sp.alpha, 1), glow: pick(sp.glow, 1) }; };
  return [{ ...part, splats: take(false), glow: false }, { ...part, name: part.name + ':glow', splats: take(true), glow: true, shapes: null }];
}
// The names of the thorn sprouts that come up on Home Isle at a dawn; build() finds each one a spot.
export const sproutSpots = (day, count) => Array.from({ length: count }, (_, i) => `sprout-${day}-${i}`);
