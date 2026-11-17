// Splat Isle's island, written as shapes. Each object is one or more parts; a part is a set of distance shapes (or a
// scatter of points) that the painter turns into splats. The goat's legs, head and tail are parts of their own, each
// round a joint, so the page can swing them and the splats follow. build() paints every part and bakes its light.
import { rng, prepare, field, bounds, paint, scatter, bake, Grid } from './sdf.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
// Value noise in the ground plane: soft patches of colour.
const noise = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };
export const ISLAND = { radius: 6.2, path: 4.15, water: -0.9 };

const GRASS = [0.36, 0.62, 0.24], GRASS2 = [0.6, 0.72, 0.28], DIRT = [0.62, 0.46, 0.3], ROCK = [0.5, 0.45, 0.42], ROCK2 = [0.66, 0.58, 0.5];
const mats = {
  ground: { paint: (x, y, z, nx, ny, nz) => {
    if (ny > 0.55) { const r = Math.hypot(x, z), path = Math.exp(-((r - ISLAND.path) ** 2) / 0.08) * (0.55 + 0.45 * noise(x * 2.1, z * 2.1)); return mix(mix(GRASS, GRASS2, noise(x * 0.9, z * 0.9) * 0.8), DIRT, clamp(path, 0, 0.85)); }
    const band = 0.5 + 0.5 * Math.sin(y * 9 + noise(x, z) * 3); return mix(ROCK, ROCK2, band * 0.7); } },
  wall: { color: [0.93, 0.86, 0.72] }, roof: { color: [0.78, 0.28, 0.22], jitter: 0.1 }, door: { color: [0.42, 0.24, 0.14] }, chimney: { color: [0.55, 0.5, 0.48] },
  window: { color: [1.0, 0.85, 0.45], glow: true },
  bark: { color: [0.45, 0.31, 0.2] }, leaf: { paint: (x, y, z, nx, ny, nz, r) => mix([0.18, 0.46, 0.2], [0.42, 0.66, 0.24], clamp(0.3 + 0.7 * ny * 0.6 + r() * 0.35, 0, 1)), jitter: 0.08 },
  stone: { paint: (x, y, z, nx, ny) => mix([0.47, 0.46, 0.48], [0.62, 0.6, 0.58], clamp(0.3 + 0.5 * ny + 0.3 * noise(x * 4, z * 4 + y * 4), 0, 1)) },
  tower: { paint: (x, y) => (Math.floor(y / 0.42) % 2 === 0 ? [0.95, 0.93, 0.88] : [0.82, 0.2, 0.2]) }, cap: { color: [0.3, 0.32, 0.38] }, lamp: { color: [1.0, 0.92, 0.55], glow: true },
  goat: { color: [0.93, 0.9, 0.84], jitter: 0.05 }, hoof: { color: [0.3, 0.26, 0.24] }, horn: { color: [0.66, 0.6, 0.5] }, nose: { color: [0.75, 0.55, 0.52] },
  cloud: { paint: (x, y, z, nx, ny) => mix([0.86, 0.84, 0.92], [1, 1, 1], clamp(0.5 + 0.5 * ny, 0, 1)), alpha: 0.8 },
  water: { paint: (x, y, z, nx, ny, nz, r) => mix([0.12, 0.36, 0.62], [0.3, 0.62, 0.8], clamp(noise(x * 1.3, z * 1.3) * 0.8 + (r() < 0.04 ? 0.6 : 0), 0, 1)), alpha: 0.95 },
  flower: null,
};
const FLOWERS = [[0.98, 0.84, 0.3], [0.96, 0.5, 0.62], [0.98, 0.98, 0.94], [0.62, 0.5, 0.96]];

// The ground: a wide flat drum with soft hills on top and a taper below the water line.
const groundShapes = [
  { type: 'cylinder', size: [2.2, ISLAND.radius], at: [0, -1.1, 0], mat: mats.ground },
  { type: 'ellipsoid', size: [3.2, 0.75, 2.6], at: [2.2, -0.42, 2.0], k: 1.2, mat: mats.ground },
  { type: 'ellipsoid', size: [2.6, 0.62, 3.0], at: [-3.0, -0.4, 1.6], k: 1.2, mat: mats.ground },
  { type: 'ellipsoid', size: [2.4, 0.5, 2.2], at: [0.6, -0.33, -3.2], k: 1.0, mat: mats.ground },
  { type: 'cone', size: [1.6, 3.8, ISLAND.radius], at: [0, -3.0, 0], k: 0.6, mat: mats.ground },
];
const groundField = field(groundShapes.map(prepare));
// The height of the ground at (x, z): march down from above.
export function heightAt(x, z) { let y = 3; for (let i = 0; i < 80; i++) { const d = groundField(x, y, z); if (d < 0.002) break; y -= Math.max(d, 0.01); } return y; }

function cottage(x, z, turn) {
  const y = heightAt(x, z), c = Math.cos(turn), s = Math.sin(turn), at = (dx, dy, dz) => [x + dx * c + dz * s, y + dy, z - dx * s + dz * c], rot = r => [r[0] || 0, (r[1] || 0) + turn, r[2] || 0];
  const shapes = [
    { type: 'box', size: [1.1, 0.8, 0.9, 0.04], at: at(0, 0.78, 0), rot: rot([]), mat: mats.wall },
    { type: 'box', size: [0.86, 0.86, 1.08, 0.05], at: at(0, 1.62, 0), rot: rot([0, 0, Math.PI / 4]), mat: mats.roof },
    { type: 'box', size: [0.13, 0.4, 0.13], at: at(0.55, 2.05, -0.35), rot: rot([]), mat: mats.chimney },
    { type: 'box', size: [0.24, 0.42, 0.08], at: at(0, 0.42, 0.9), rot: rot([]), cut: true, mat: mats.door },
    { type: 'box', size: [0.2, 0.16, 0.06], at: at(-0.62, 0.95, 0.9), rot: rot([]), cut: true, mat: mats.window },
    { type: 'box', size: [0.06, 0.16, 0.18], at: at(1.1, 0.95, 0.2), rot: rot([]), cut: true, mat: mats.window },
  ];
  return { id: 'cottage', label: 'Cottage', parts: [{ name: 'cottage', shapes, stroke: { size: 1 } }], center: [x, y + 1.1, z], radius: 1.7 };
}
function lighthouse(x, z) {
  const y = heightAt(x, z) - 0.05;
  const shapes = [
    { type: 'cone', size: [3.0, 0.62, 0.4], at: [x, y + 1.5, z], mat: mats.tower },
    { type: 'cylinder', size: [0.12, 0.62], at: [x, y + 3.06, z], k: 0.04, mat: mats.cap },
    { type: 'cylinder', size: [0.5, 0.32], at: [x, y + 3.36, z], mat: mats.lamp },
    { type: 'cone', size: [0.5, 0.46, 0.02], at: [x, y + 3.86, z], mat: mats.cap },
    { type: 'box', size: [0.12, 0.26, 0.05], at: [x, y + 0.36, z + 0.6], cut: true, mat: mats.door },
  ];
  return { id: 'lighthouse', label: 'Lighthouse', parts: [{ name: 'lighthouse', shapes, stroke: { along: [0, 1, 0], stretch: 1.4 } }], center: [x, y + 2, z], radius: 2.1 };
}
function tree(id, x, z, rand) {
  const y = heightAt(x, z) - 0.05, h = 1.3 + rand() * 0.8, w = 0.85 + rand() * 0.35, lean = (rand() - 0.5) * 0.25;
  const shapes = [{ type: 'capsule', size: [h, 0.12], at: [x, y + h / 2, z], rot: [lean, 0, lean * 0.5], mat: mats.bark }];
  const blobs = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < blobs; i++) { const a = rand() * Math.PI * 2, r = i ? w * 0.55 : 0; shapes.push({ type: 'sphere', size: [w * (i ? 0.62 + rand() * 0.2 : 0.85)], at: [x + Math.cos(a) * r, y + h + 0.25 + (i ? rand() * 0.45 : 0.3), z + Math.sin(a) * r], k: 0.35, mat: mats.leaf }); }
  return { id, label: 'Tree', parts: [{ name: id, shapes, stroke: { size: 1.15 } }], center: [x, y + h, z], radius: w + 0.6 };
}
function rock(id, x, z, rand) {
  const y = heightAt(x, z), s = 0.3 + rand() * 0.45;
  const shapes = [{ type: 'ellipsoid', size: [s * 1.3, s * 0.75, s], at: [x, y + s * 0.3, z], rot: [rand() * 0.4, rand() * 3, rand() * 0.3], mat: mats.stone }, { type: 'ellipsoid', size: [s * 0.7, s * 0.6, s * 0.7], at: [x + s * 0.6, y + s * 0.2, z + s * 0.3], k: 0.18, mat: mats.stone }];
  return { id, label: 'Rock', parts: [{ name: id, shapes }], center: [x, y + s * 0.3, z], radius: s * 1.6 };
}
// The goat faces +x. Each leg, the head and the tail turn about their own joint; the page moves the whole goat.
function goat() {
  const legs = [[0.27, 0.13], [0.27, -0.13], [-0.25, 0.13], [-0.25, -0.13]].map(([lx, lz], i) => ({
    name: 'goat-leg' + i, pivot: [lx, -0.1, lz], shapes: [{ type: 'capsule', size: [0.3, 0.055], at: [0, -0.2, 0], mat: mats.goat }, { type: 'cylinder', size: [0.07, 0.065], at: [0, -0.37, 0], k: 0.03, mat: mats.hoof }], stroke: { along: [0, 1, 0] } }));
  const head = { name: 'goat-head', pivot: [0.36, 0.12, 0], shapes: [
    { type: 'ellipsoid', size: [0.17, 0.11, 0.1], at: [0.12, 0.06, 0], rot: [0, 0, -0.5], mat: mats.goat },
    { type: 'ellipsoid', size: [0.06, 0.05, 0.06], at: [0.25, -0.02, 0], k: 0.04, mat: mats.nose },
    { type: 'capsule', size: [0.16, 0.025], at: [0.04, 0.2, 0.05], rot: [0.3, 0, 0.7], mat: mats.horn },
    { type: 'capsule', size: [0.16, 0.025], at: [0.04, 0.2, -0.05], rot: [-0.3, 0, 0.7], mat: mats.horn },
    { type: 'ellipsoid', size: [0.08, 0.03, 0.04], at: [0.04, 0.09, 0.12], rot: [0.6, 0, 0], k: 0.02, mat: mats.goat },
    { type: 'ellipsoid', size: [0.08, 0.03, 0.04], at: [0.04, 0.09, -0.12], rot: [-0.6, 0, 0], k: 0.02, mat: mats.goat },
    { type: 'capsule', size: [0.08, 0.025], at: [0.19, -0.12, 0], mat: mats.goat },
  ] };
  const body = { name: 'goat-body', pivot: [0, 0, 0], shapes: [{ type: 'ellipsoid', size: [0.42, 0.24, 0.22], at: [0, 0, 0], mat: mats.goat }, { type: 'capsule', size: [0.16, 0.1], at: [0.3, 0.1, 0], rot: [0, 0, -0.9], k: 0.08, mat: mats.goat }] };
  const tail = { name: 'goat-tail', pivot: [-0.4, 0.1, 0], shapes: [{ type: 'ellipsoid', size: [0.07, 0.04, 0.04], at: [-0.04, 0.03, 0], rot: [0, 0, 0.6], mat: mats.goat }] };
  for (const p of [body, head, tail, ...legs]) p.density = 5;
  return { id: 'goat', label: 'Goat', rig: true, parts: [body, head, tail, ...legs], center: [0, 0, 0], radius: 1.0 };
}
function cloud(id, x, y, z, rand) {
  const shapes = []; const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) shapes.push({ type: 'sphere', size: [0.55 + rand() * 0.45], at: [(i - n / 2) * 0.6 + rand() * 0.3, rand() * 0.35, (rand() - 0.5) * 0.7], k: 0.5, mat: mats.cloud });
  return { id, label: 'Cloud', cloud: true, parts: [{ name: id, pivot: [x, y, z], shapes, stroke: { size: 1.4 }, density: 0.5 }], center: [x, y, z], radius: 2.2 };
}
// Scatters: flowers on the grass, and the sea round the island.
function flowers(rand) {
  return { name: 'flowers', density: 1, stroke: { size: 0.9, stretch: 1 }, points: (r) => {
    const out = []; for (let i = 0; i < 900; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (ISLAND.radius - 0.5), x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(d - ISLAND.path) < 0.5) continue; const y = heightAt(x, z); out.push([x, y + 0.04, z, 0, 1, 0, { color: FLOWERS[Math.floor(r() * FLOWERS.length)], jitter: 0.05 }]); } return out; } };
}
function sea() {
  return { name: 'sea', pivot: [0, ISLAND.water, 0], density: 0.18, stroke: { size: 1.3, along: [1, 0, 0.3], stretch: 1.9 }, points: (r, density) => {
    const out = [], n = Math.round(Math.PI * (17 * 17 - 5.5 * 5.5) * density * 0.18); for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(5.5 * 5.5 + r() * (17 * 17 - 5.5 * 5.5)); out.push([Math.cos(a) * d, 0, Math.sin(a) * d, 0, 1, 0, mats.water]); } return out; } };
}

// Where things stand. The goat walks a ring path, so nothing stands on it.
function layout(seed) {
  const rand = rng(seed * 7919 + 13), objects = [], taken = [];
  const free = (x, z, r) => Math.hypot(x, z) < ISLAND.radius - 0.7 && Math.abs(Math.hypot(x, z) - ISLAND.path) > r + 0.45 && taken.every(t => Math.hypot(t[0] - x, t[1] - z) > t[2] + r);
  const ca = rand() * Math.PI * 2, cx = Math.cos(ca) * 1.2, cz = Math.sin(ca) * 1.2; objects.push(cottage(cx, cz, rand() * Math.PI * 2)); taken.push([cx, cz, 1.7]);
  // the lighthouse stands on the far side from the sun (the sun is at 0.87 rad in the ground plane), so the first view sees past it
  const la = 0.87 + Math.PI + (rand() - 0.5) * 1.2, lx = Math.cos(la) * 5.35, lz = Math.sin(la) * 5.35; objects.push(lighthouse(lx, lz)); taken.push([lx, lz, 0.9]);
  for (let i = 0, tries = 0; i < 5 && tries < 400; tries++) { const a = rand() * Math.PI * 2, d = 1.8 + rand() * 3.9, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 0.9)) continue; objects.push(tree('tree' + i, x, z, rand)); taken.push([x, z, 0.9]); i++; }
  for (let i = 0, tries = 0; i < 5 && tries < 400; tries++) { const a = rand() * Math.PI * 2, d = 1.5 + rand() * 4.4, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 0.5)) continue; objects.push(rock('rock' + i, x, z, rand)); taken.push([x, z, 0.5]); i++; }
  for (let i = 0; i < 3; i++) { const a = rand() * Math.PI * 2, d = 4 + rand() * 6; objects.push(cloud('cloud' + i, Math.cos(a) * d, 5.2 + rand() * 1.4, Math.sin(a) * d, rand)); }
  objects.push(goat());
  objects.unshift({ id: 'island', label: 'Island', fixed: true, parts: [{ name: 'ground', shapes: groundShapes, clip: { lo: [null, ISLAND.water - 0.12, null] }, density: 0.6, stroke: { size: 1.1 } }, flowers(rand), sea()], center: [0, -0.4, 0], radius: 6.5 });
  return objects;
}

// Paint and light the whole island. quality.density is splats per square metre; onProgress(fraction) is called
// between parts, and the build yields there so the page can draw its loading bar.
export async function build(seed = 1, { density = 420, cell = 0.16, size = 1, onProgress = () => {}, yieldTo = () => new Promise(r => setTimeout(r, 0)) } = {}) {
  const objects = layout(seed), rand = rng(seed);
  // The shadow grid: every solid, still part of the island (not the goat, the clouds or the sea), in world space.
  const solid = [];
  for (const o of objects) if (!o.rig && !o.cloud) for (const p of o.parts) if (p.shapes) { const sh = p.shapes.map(prepare); solid.push({ f: field(sh), ...bounds(sh) }); }
  const boxDist = (b, x, y, z) => Math.hypot(Math.max(b.lo[0] - x, x - b.hi[0], 0), Math.max(b.lo[1] - y, y - b.hi[1], 0), Math.max(b.lo[2] - z, z - b.hi[2], 0));
  const world = (x, y, z) => { let d = Infinity; for (const s of solid) { if (boxDist(s, x, y, z) > d) continue; d = Math.min(d, s.f(x, y, z)); } return d; };
  const grid = new Grid([-7.4, -1.3, -7.4], [7.4, 4.6, 7.4], cell, world), sdf = (x, y, z) => grid.at(x, y, z);
  await yieldTo(); onProgress(0.15);
  const parts = []; let done = 0, total = objects.reduce((n, o) => n + o.parts.length, 0);
  for (const o of objects) {
    const root = o.rig ? [0, heightAt(ISLAND.path, 0) + 0.5, 0] : [0, 0, 0];
    for (const p of o.parts) {
      const pivot = p.pivot || [0, 0, 0], opts = { density: density * (p.density || 1), rand, size };
      const splats = p.points ? scatter(p, opts) : paint(p, opts);
      // a goat part is painted round its joint; its light is baked as it stands at the start, with no cast shadow
      bake(splats, { sdf: o.rig || o.cloud ? null : sdf, at: [root[0] + (o.rig ? pivot[0] : 0), root[1] + (o.rig ? pivot[1] : 0), root[2] + (o.rig ? pivot[2] : 0)], shadows: !o.rig && !o.cloud });
      parts.push({ name: p.name, object: o.id, pivot, splats, shapes: p.shapes || null });
      done++; onProgress(0.15 + 0.85 * done / total); await yieldTo();
    }
  }
  return { objects: objects.map(o => ({ id: o.id, label: o.label, center: o.center, radius: o.radius, rig: !!o.rig, cloud: !!o.cloud, fixed: !!o.fixed, parts: o.parts.map(p => p.name) })), parts, count: parts.reduce((n, p) => n + p.splats.count, 0), heightAt };
}
