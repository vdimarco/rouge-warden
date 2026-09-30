// js/story/world/gen.worker.js : builds Sedona off the main thread (a module worker; no three.js here).
// From the fixed seed it makes the 401 x 401 heightfield (5 m cells), the surface-type grid (8 m), the two
// road masks (1024^2: the lane markings' field, and the ground's: asphalt, lots and sidewalks), the paper-map
// shading, the flora scatter per 100 m cell, and terrain tiles with skirts and the hero rocks at three
// levels of detail. Messages: {init:{seed}} -> 'progress' ... 'init' {heights, types, mask, ground, map, ...};
// {tile:{i,j,lod}} -> 'tile' {arrays}. Buffers are transferred. The same functions run in Node for tests.
import { simplex, fbm, clamp, lerp, smooth } from '../../core/noise.js';
import { CREEK, POOLS, WASH, WASH_HW, PADS, BUILDINGS, KAZOOS, CAIRNS, STRIPS } from './places.js';
import { buildNetwork, project, at, LOTS, smoothLine, STREET_TREES } from './roads.js';
import { FORMATIONS, buildFormation } from './rocks.js';

export const N = 400, CELL = 5, HALF = 1000, W = N + 1;
export const TGRID = 250, TCELL = 8; // surface types
export const MASK = 1024, MPX = 2000 / MASK; // road mask texels (1.95 m)
export const MAP = 1024;
export const TILES = 5, TILE_CELLS = 80;
export const TYPES = ['asphalt', 'dirt', 'rock', 'sand', 'water', 'scrub'];
const T = Object.fromEntries(TYPES.map((t, i) => [t, i]));
export const GRADE = { asphalt: 0.08, dirt: 0.125 }; // the profile limits (the test allows 9% and 14%)

/* ------------------------------------------------------------------ helpers */
const gx = (i) => i * CELL - HALF;
const hypot = (a, b, c = 0) => Math.sqrt(a * a + b * b + c * c); // (Math.hypot is slow)
// uniform Catmull-Rom through control points [x, z, ...attrs]; attrs interpolate linearly
function densify(ctrl, step = 4) {
  const out = [], P = (i) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), n = Math.max(1, Math.ceil(hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const o = { x: cr(p0[0], p1[0], p2[0], p3[0]), z: cr(p0[1], p1[1], p2[1], p3[1]), a: [] };
      for (let m = 2; m < p1.length; m++) o.a.push(p1[m] + (p2[m] - p1[m]) * t);
      out.push(o);
    }
  }
  const e = ctrl[ctrl.length - 1]; out.push({ x: e[0], z: e[1], a: e.slice(2) });
  return out;
}
// For every grid vertex within maxD of the line: the distance, the nearest sample's attributes (interpolated
// along the segment) and the side (+1 right of the direction of travel). Brute force per segment bbox.
// cell sets the grid spacing (5 m: the height grid; 20 m: a coarse field read back with sampleField).
function lineField(line, maxD, nAttr, cell = CELL) {
  const n = Math.round(2000 / cell), w = n + 1, D = new Float32Array(w * w).fill(Infinity), A = new Float32Array(w * w * Math.max(1, nAttr)), S = new Int8Array(w * w), max2 = maxD * maxD;
  for (let s = 0; s < line.length - 1; s++) {
    const a = line[s], b = line[s + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - maxD + HALF) / cell)), i1 = Math.min(n, Math.ceil((Math.max(a.x, b.x) + maxD + HALF) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - maxD + HALF) / cell)), j1 = Math.min(n, Math.ceil((Math.max(a.z, b.z) + maxD + HALF) / cell));
    for (let j = j0; j <= j1; j++) {
      const z = j * cell - HALF;
      for (let i = i0; i <= i1; i++) {
        const x = i * cell - HALF, k = j * w + i;
        let t = ((x - a.x) * dx + (z - a.z) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - a.x - dx * t, ez = z - a.z - dz * t, d2 = ex * ex + ez * ez;
        if (d2 >= max2) continue;
        const d = Math.sqrt(d2);
        if (d < D[k]) {
          D[k] = d; S[k] = (x - a.x) * dz - (z - a.z) * dx > 0 ? -1 : 1;
          for (let m = 0; m < nAttr; m++) A[k * nAttr + m] = a.a[m] + (b.a[m] - a.a[m]) * t;
        }
      }
    }
  }
  return { D, A, S, cell, w, nAttr };
}
// a coarse field at (x,z): the distance bilinear (Infinity past its reach), the attributes and side nearest
function sampleField(F, x, z, out) {
  const fi = clamp((x + HALF) / F.cell, 0, F.w - 1.001), fj = clamp((z + HALF) / F.cell, 0, F.w - 1.001), i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, k = j * F.w + i;
  const d00 = F.D[k], d10 = F.D[k + 1], d01 = F.D[k + F.w], d11 = F.D[k + F.w + 1];
  out.d = (d00 === Infinity || d10 === Infinity || d01 === Infinity || d11 === Infinity) ? Math.min(d00, d10, d01, d11) : (d00 * (1 - u) + d10 * u) * (1 - v) + (d01 * (1 - u) + d11 * u) * v;
  const kn = (j + (v > 0.5 ? 1 : 0)) * F.w + i + (u > 0.5 ? 1 : 0);
  for (let m = 0; m < F.nAttr; m++) out.a[m] = F.A[kn * F.nAttr + m];
  out.side = F.S[kn];
  return out;
}
// terraces: flat benches with steep risers, like Sedona's sandstone layers
function terrace(t, n) { const q = clamp(t, 0, 1) * n, k = Math.floor(q), f = q - k; return (k + smooth(0.3, 1, f)) / n; }

/* ------------------------------------------------------------------ the recipe */
// Regional ground: an inverse-distance blend of spot heights, so town, roads and the canyon sit where the
// story needs them (the bridge deck is 62 m; the wash under it about 31 m).
const ANCHORS = [
  [-980, 170, 42], [-800, 150, 40], [-620, 160, 38], [-470, 140, 37], [-300, 115, 36], [-150, 70, 34], [60, 40, 32], [180, -60, 35], [318, -160, 40],
  [150, 150, 30], [182, 330, 28], [236, 520, 25], [240, 700, 23], [200, 950, 21], [-150, 250, 34], [-40, 420, 24], [-60, 150, 32],
  [-700, -150, 46], [-760, -440, 54], [-880, -630, 62], [-420, -120, 44], [-200, -150, 42], [60, -200, 46],
  [-40, 540, 21], [-250, 520, 16], [-500, 560, 18], [-750, 600, 22], [-600, 350, 34], [-400, 350, 30], [0, 700, 26], [-300, 800, 30], [500, 950, 34],
  [330, 100, 48], [520, 60, 64], [700, 66, 82], [890, 60, 96], [600, 250, 60], [400, 300, 40], [700, -150, 90],
  [430, -500, 64], [455, -620, 60], [500, -700, 54], [497, -800, 50], [566, -1000, 58], [815, -760, 64], [760, -620, 90],
];
// Butte stamps: top height (absolute), top radii, base radii, rotation, terrace count
const STAMPS = [
  { id: 'airport_mesa', x: -236, z: 312, top: 57, rx: 88, rz: 56, Rx: 128, Rz: 94, rot: 0.7, n: 2 },
  { id: 'bell_rock', x: 300, z: 700, top: 84, rx: 24, rz: 22, Rx: 80, Rz: 74, rot: 0, n: 3, pow: 0.75 },
  { id: 'courthouse', x: 466, z: 764, top: 112, rx: 50, rz: 28, Rx: 94, Rz: 66, rot: 0.3, n: 3 },
  { id: 'cathedral', x: -182, z: 640, top: 84, rx: 52, rz: 34, Rx: 106, Rz: 82, rot: 0.3, n: 3 },
  { id: 'coffee_pot', x: -560, z: -262, top: 104, rx: 38, rz: 30, Rx: 88, Rz: 76, rot: 0.8, n: 3 },
  { id: 'capitol', x: -350, z: -430, top: 150, rx: 94, rz: 64, Rx: 178, Rz: 132, rot: 1.2, n: 4 },
  { id: 'snoopy', x: 422, z: -40, top: 74, rx: 60, rz: 14, Rx: 100, Rz: 46, rot: -0.3, n: 3 },
  { id: 'chapel', x: 382, z: 426, top: 62, rx: 20, rz: 14, Rx: 58, Rz: 46, rot: 0.4, n: 2 },
  { id: 'sugarloaf', x: -60, z: -300, top: 74, rx: 28, rz: 22, Rx: 66, Rz: 60, rot: 0.2, n: 3 },
  { id: 'lee', x: -470, z: 430, top: 70, rx: 38, rz: 24, Rx: 84, Rz: 68, rot: -0.4, n: 3 },
  { id: 'twin', x: 640, z: 470, top: 86, rx: 42, rz: 30, Rx: 94, Rz: 78, rot: -0.8, n: 3 },
  { id: 'ship', x: -20, z: 820, top: 66, rx: 42, rz: 20, Rx: 88, Rz: 62, rot: 0.9, n: 3 },
  { id: 'wild', x: -700, z: 470, top: 82, rx: 36, rz: 32, Rx: 92, Rz: 84, rot: 0.1, n: 3 },
  { id: 'mitten', x: -300, z: -700, top: 150, rx: 64, rz: 44, Rx: 132, Rz: 102, rot: 0.5, n: 4 },
  { id: 'steamboat', x: 520, z: -228, top: 96, rx: 32, rz: 24, Rx: 72, Rz: 58, rot: -0.4, n: 3 },
  { id: 'rim_e', x: 740, z: -330, top: 130, rx: 92, rz: 72, Rx: 172, Rz: 142, rot: 0.2, n: 4 },
];

export function generate(seed = 51, progress = () => {}) {
  const t0 = Date.now(), ms = {};
  const nA = simplex(seed), nB = simplex(seed + 7), nC = simplex(seed + 13);
  const H = new Float32Array(W * W), rockK = new Float32Array(W * W);
  const net = buildNetwork();

  // the creek and the wash as dense lines with their attributes
  const creek = densify(CREEK, 4); // a: [water level, half width]
  const wash = densify(WASH, 4); // a: [floor]
  // near fields on the 5 m grid; the wide ones on a 20 m grid
  const CF = lineField(creek, 60, 2), CC = lineField(creek.filter((p, i) => i % 2 === 0), 440, 2, 20), WF = lineField(wash, 120, 1);
  const fr9 = net.byId.fr9, fr9Line = fr9.line.map((p, i) => ({ x: p.x, z: p.z, a: [lerp(50, 64, fr9.cum[i] / fr9.len)] }));
  const FF = lineField(fr9Line, 400, 1, 20);
  const dryLine = net.byId.drycreek.line.map((p) => ({ x: p.x, z: p.z, a: [] })), DF = lineField(dryLine, 200, 0, 20);
  const cq = { d: 0, a: [0, 0], side: 0 }, fq = { d: 0, a: [0], side: 0 }, dq = { d: 0, a: [], side: 0 };
  ms.fields = Date.now() - t0;
  const { mask, ground, lotIds } = roadMask(net);
  ms.mask = Date.now() - t0 - ms.fields;
  progress(0.1);
  // the regional ground on a coarse 20 m grid (it is smooth), read back bilinearly
  const CG = 101, REG = new Float32Array(CG * CG);
  for (let j = 0; j < CG; j++) for (let i = 0; i < CG; i++) {
    const x = i * 20 - HALF, z = j * 20 - HALF;
    let sw = 0, sh = 0;
    for (const a of ANCHORS) { const d2 = (x - a[0]) ** 2 + (z - a[1]) ** 2, w = 1 / (d2 + 3600); sw += w * w; sh += w * w * a[2]; }
    REG[j * CG + i] = sh / sw;
  }
  const regional = (i, j) => { const fi = i / 4, fj = j / 4, a = Math.min(CG - 2, fi | 0), b = Math.min(CG - 2, fj | 0), u = fi - a, v = fj - b; return (REG[b * CG + a] * (1 - u) + REG[b * CG + a + 1] * u) * (1 - v) + (REG[(b + 1) * CG + a] * (1 - u) + REG[(b + 1) * CG + a + 1] * u) * v; };

  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = gx(i), z = gx(j), k = j * W + i;
    // regional ground
    let h = regional(i, j) + fbm(nA, x / 300, z / 300, 4) * 7 + fbm(nB, x / 70, z / 70, 3) * 2.2;
    // a warp so the big masses have ragged, natural edges
    const wx = x + fbm(nC, x / 260, z / 260, 3) * 110, wz = z + fbm(nC, x / 260 + 9, z / 260 - 4, 3) * 110;
    // Oak Creek Canyon: a floor that climbs away from the creek, then terraced red walls
    const canyon = smooth(-170, -330, z) * smooth(230, 330, x);
    if (canyon > 0) {
      sampleField(CC, x, z, cq);
      const near = CF.D[k] < Infinity, far = cq.d === Infinity;
      const d = near ? CF.D[k] : far ? 440 : cq.d, wl = near ? CF.A[k * 2] : far ? 36 : cq.a[0], hw = near ? CF.A[k * 2 + 1] : far ? 6 : cq.a[1], west = near ? CF.S[k] > 0 : far ? x < 520 : cq.side > 0;
      const floor = wl + 1.5 + Math.min(40, Math.max(0, d - hw - (west ? 6 : 40)) * (west ? 0.3 : 0.36));
      const dw = d - (west ? 175 : 115);
      const wall = dw > 0 ? terrace(dw / 110, 5) * (100 + fbm(nC, x / 160, z / 160, 3) * 50) : 0;
      h = lerp(h, floor + wall, canyon);
    }
    // the north-west rim and Boynton, cut by Dry Creek; the world's edge is a wall of mountains
    let m = smooth(-460, -690, wz) * (1 - smooth(150, 330, wx)) + smooth(-560, -760, wx) * smooth(-40, -300, wz) * 0.75;
    if (m > 0 && sampleField(DF, x, z, dq).d < Infinity) m *= smooth(55, 150, dq.d);
    m *= smooth(70, 150, hypot(x + 880, z + 630));
    // (the three highways leave through passes in the rim)
    const pass = Math.min(hypot(x + 1010, z - 172), hypot(x - 180, z - 1010), hypot(x - 566, z + 1010));
    const e = Math.max(-wx, wx, -wz), rim = (smooth(860, 1000, e) + 0.45 * smooth(880, 1010, wz)) * smooth(70, 220, pass);
    h += terrace(clamp(m, 0, 1), 4) * (90 + fbm(nB, x / 200, z / 200, 3) * 50) + terrace(clamp(rim, 0, 1), 3) * (80 + fbm(nC, x / 90, z / 90, 3) * 50);
    // buttes
    for (const s of STAMPS) {
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz > (Math.max(s.Rx, s.Rz) * 1.25) ** 2) continue;
      const c = Math.cos(s.rot), sn = Math.sin(s.rot), lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      const wob = 1 + fbm(nA, x / 90 + s.x, z / 90, 3) * 0.16, R = hypot(lx / s.Rx, lz / s.Rz) * wob; if (R >= 1) continue;
      // along a ray from the centre the top edge sits at a fixed fraction k of the base edge:
      // t is 0 at the base edge and 1 at the top edge
      const ang = Math.atan2(lz, lx), ca = Math.cos(ang), sa = Math.sin(ang), kk = hypot(ca / s.Rx, sa / s.Rz) / hypot(ca / s.rx, sa / s.rz);
      const t = clamp((1 - R) / Math.max(0.05, 1 - kk), 0, 1);
      // a talus apron, then terraced cliff bands up to the cap
      const tp = Math.pow(t, s.pow || 0.9), shape = 0.2 * smooth(0, 0.4, tp) + 0.8 * terrace(smooth(0.32, 0.98, tp), s.n);
      const y = lerp(h, s.top + fbm(nB, x / 30, z / 30, 2) * 3, shape);
      if (y > h) { h = y; rockK[k] = Math.max(rockK[k], shape > 0.97 ? 0.7 : 0.9); }
    }
    // Wilson Canyon: the sandy wash under the bridge, with steep walls
    if (WF.D[k] < Infinity) {
      const d = WF.D[k], fl = WF.A[k];
      const cut = fl + Math.pow(smooth(WASH_HW, WASH_HW + 42, d), 1.3) * 48 + Math.max(0, d - WASH_HW - 42) * 3 + (d < WASH_HW ? fbm(nA, x / 12, z / 12, 2) * 0.4 : 0);
      h = Math.min(h, cut);
    }
    // Forest Road 9 runs up a side valley to the ranch basin; the ridge above it looks down into the yard
    if (sampleField(FF, x, z, fq).d < Infinity) h = Math.min(h, fq.a[0] + Math.pow(smooth(30, 150, fq.d + fbm(nB, x / 50, z / 50, 2) * 30), 1.2) * 95 + Math.max(0, fq.d - 150) * 1.5);
    { const d = hypot(x - 815, z + 760) + fbm(nA, x / 40, z / 40, 2) * 16; h = Math.min(h, 64 + Math.pow(smooth(70, 150, d), 1.3) * 60 + Math.max(0, d - 150) * 1.5); }
    H[k] = h;
  }
  progress(0.3);
  // pads: lots and yards (before the creek, so no pad fills its channel)
  for (const p of PADS) {
    const py = p.y ?? heightAt(H, p.x, p.z);
    forNear(p.x, p.z, p.r + p.f, (k, d) => { H[k] = lerp(H[k], py, smooth(p.r + p.f, p.r, d)); });
  }
  // Oak Creek's channel and the Slide Rock pools
  for (let k = 0; k < W * W; k++) {
    const d = CF.D[k]; if (d > 60) continue;
    const wl = CF.A[k * 2], hw = CF.A[k * 2 + 1];
    const ch = d < hw ? wl - 1.3 * (1 - (d / hw) ** 2) - 0.1 : wl + 0.25 + (d - hw) * 0.55;
    if (ch < H[k]) H[k] = ch;
  }
  for (const [px, pz, r, depth] of POOLS) for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const d = hypot(gx(i) - px, gx(j) - pz); if (d > r + 4) continue;
    const k = j * W + i, wl = CF.A[k * 2];
    if (d < r) H[k] = Math.min(H[k], wl - depth * (1 - (d / r) ** 2) - 0.2);
  }
  progress(0.4);
  ms.heights = Date.now() - t0;

  // roads: profiles graded to the limits, then the ground cut and filled to them
  const profiles = gradeRoads(net, H, CF);
  // Keep the entire turnout flat after road grading. A coarse canyon cell
  // must not protrude through the asphalt at the lot's rotated corners.
  const turnout = LOTS.find((l) => l.x === 396 && l.z === -585);
  const turnoutY = heightAt(H, turnout.x, turnout.z);
  forNear(turnout.x, turnout.z, 48, (k, d, x, z) => {
    const edge = lotDist(turnout, x, z);
    if (edge < 18) H[k] = lerp(H[k], turnoutY, smooth(18, 6, edge));
  });
  progress(0.5);
  // buildings stand on flat pads at the height of their front
  for (const b of BUILDINGS) {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), fx = b.x + s * b.d / 2, fz = b.z + c * b.d / 2; // front middle
    const py = heightAt(H, fx, fz), R = hypot(b.w, b.d) / 2 + 3;
    forNear(b.x, b.z, R + 8, (k, d, x, z) => {
      const lx = (x - b.x) * c - (z - b.z) * s, lz = (x - b.x) * s + (z - b.z) * c;
      const out = Math.max(Math.abs(lx) - b.w / 2 - 2.5, Math.abs(lz) - b.d / 2 - (lz > 0 ? 4.5 : 2.5), 0); // (more room in front: porches, boardwalks)
      // (not on a road or a lot, nor within a grid cell of a sidewalk: those keep the street's grade)
      if (out < 8 && roadEdge(ground, x, z) > 0.5 && walkAt(ground, maskIndex(x, z)) > CELL + 0.5) H[k] = lerp(H[k], py, smooth(8, 0, out));
    });
  }
  ms.roads = Date.now() - t0 - ms.heights;

  // surface types and the vertex look
  progress(0.62);
  const types = new Uint8Array(TGRID * TGRID);
  for (let j = 0; j < TGRID; j++) for (let i = 0; i < TGRID; i++) {
    const x = (i + 0.5) * TCELL - HALF, z = (j + 0.5) * TCELL - HALF;
    types[j * TGRID + i] = classify(x, z);
  }
  function classify(x, z) {
    const gi = clamp(Math.round((x + HALF) / CELL), 0, N), gj = clamp(Math.round((z + HALF) / CELL), 0, N), k = gj * W + gi;
    const cd = CF.D[k], hw = CF.A[k * 2 + 1], wl = CF.A[k * 2];
    if (cd < hw - 0.5 && heightAt(H, x, z) < wl) return T.water;
    if (POOLS.some(([px, pz, r]) => hypot(x - px, z - pz) < r - 1)) return T.water;
    if (LOTS.some((l) => !l.apron && lotDist(l, x, z) < 0)) return T.dirt; // (an apron keeps the ground's type: the masks pave it)
    if (WF.D[k] < WASH_HW || cd < hw + 5) return T.sand;
    const ny = normalY(H, x, z);
    if (ny < 0.8 || rockK[k] > 0.6) return T.rock;
    return T.scrub;
  }
  // per-vertex soil colour and rock factor (the shader draws strata on the rock)
  const col = new Uint8Array(W * W * 3), rock = new Uint8Array(W * W);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * W + i, x = gx(i), z = gx(j), ny = normalYk(H, i, j);
    const v = fbm(nC, x / 60, z / 60, 3), v2 = nA(x / 11, z / 11);
    // red Sedona dirt, patchy blue-green scrub, pale sand in washes, grey stones in the creek
    // (colours are authored in display sRGB and stored linear, as three.js treats vertex colours)
    const dk = smooth(0.2, 0.7, fbm(nA, x / 140 + 7, z / 140, 3) + 0.5);
    let r = 0.64 + v * 0.06 - dk * 0.1, g = 0.31 + v * 0.03 - dk * 0.06, b = 0.19 - dk * 0.03;
    const scrub = smooth(0.0, 0.5, fbm(nB, x / 45 + 3, z / 45, 3) + 0.3) * smooth(0.7, 0.9, ny);
    r = lerp(r, 0.43, scrub * 0.68); g = lerp(g, 0.4, scrub * 0.68); b = lerp(b, 0.33, scrub * 0.68);
    const cd = CF.D[k], hw = CF.A[k * 2 + 1];
    const sand = Math.max(WF.D[k] < Infinity ? smooth(WASH_HW + 4, WASH_HW - 2, WF.D[k]) : 0, cd < Infinity ? smooth(hw + 9, hw + 2, cd) : 0);
    r = lerp(r, 0.76, sand); g = lerp(g, 0.62, sand); b = lerp(b, 0.47, sand);
    if (cd < hw + 1) { const st = smooth(hw + 1, hw - 1, cd); r = lerp(r, 0.42, st); g = lerp(g, 0.39, st); b = lerp(b, 0.36, st); }
    const lum = 1 + v2 * 0.05;
    col[k * 3] = Math.pow(clamp(r * lum, 0, 1), 2.2) * 255 + 0.5; col[k * 3 + 1] = Math.pow(clamp(g * lum, 0, 1), 2.2) * 255 + 0.5; col[k * 3 + 2] = Math.pow(clamp(b * lum, 0, 1), 2.2) * 255 + 0.5;
    rock[k] = clamp(Math.max(smooth(0.8, 0.58, ny), rockK[k] * smooth(0.55, 0.8, ny) * 0.6, rockK[k] * smooth(0.9, 0.7, ny)), 0, 1) * 255;
  }
  progress(0.7);
  const map = paintMap(H, types, CF, WF);
  progress(0.8);

  // rocks: every formation's geometry at two levels, grouped by tile
  const rocks = FORMATIONS.map((f) => { const gy = heightAt(H, f.x, f.z); return { f, lo: buildFormation(f, gy, 1), hi: buildFormation(f, gy, 0) }; });
  const rockColliders = rocks.flatMap((r) => r.hi.colliders);
  const scatter = scatterFlora(seed, H, types, mask, ground, lotIds, net, CF, rockK, rocks);
  progress(0.9);
  ms.total = Date.now() - t0;
  const ctx = { H, col, rock, rocks, net };
  return {
    H, types, mask, ground, lotIds, map, scatter, rockColliders, ctx, ms, profiles,
    creek: creek.map((p) => [p.x, p.z, p.a[0], p.a[1]]), wash: wash.map((p) => [p.x, p.z, p.a[0]]),
    bridges: net.roads.flatMap((r) => r.spans.map((sp) => { const a = at(r, sp.s0), b = at(r, sp.s1); return { id: sp.id, road: r.id, ax: a.x, az: a.z, bx: b.x, bz: b.z, y: sp.y, width: r.width, rails: true }; })),
  };
}

// the exact height of the terrain triangles (the wild World.height split: u > v)
export function heightAt(H, x, z) {
  const fx = clamp((x + HALF) / CELL, 0, N - 0.0001), fz = clamp((z + HALF) / CELL, 0, N - 0.0001);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
  const h00 = H[j * W + i], h10 = H[j * W + i + 1], h01 = H[(j + 1) * W + i], h11 = H[(j + 1) * W + i + 1];
  return u > v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
}
function normalY(H, x, z) { const e = 2.5, a = heightAt(H, x - e, z) - heightAt(H, x + e, z), b = heightAt(H, x, z - e) - heightAt(H, x, z + e); return 2 * e / hypot(a, 2 * e, b); }
function normalYk(H, i, j) { const a = H[j * W + Math.max(0, i - 1)] - H[j * W + Math.min(N, i + 1)], b = H[Math.max(0, j - 1) * W + i] - H[Math.min(N, j + 1) * W + i]; return 2 * CELL / hypot(a, 2 * CELL, b); }
function forNear(x, z, r, fn) {
  const i0 = Math.max(0, Math.floor((x - r + HALF) / CELL)), i1 = Math.min(N, Math.ceil((x + r + HALF) / CELL));
  const j0 = Math.max(0, Math.floor((z - r + HALF) / CELL)), j1 = Math.min(N, Math.ceil((z + r + HALF) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const px = gx(i), pz = gx(j), d = hypot(px - x, pz - z); if (d <= r) fn(j * W + i, d, px, pz); }
}
function lotDist(l, x, z) { const c = Math.cos(l.yaw), s = Math.sin(l.yaw), lx = (x - l.x) * c - (z - l.z) * s, lz = (x - l.x) * s + (z - l.z) * c; const qx = Math.abs(lx) - l.w / 2, qz = Math.abs(lz) - l.d / 2; return hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0); }

/* ------------------------------------------------------------------ roads */
// Each road's profile: sampled every 5 m from the ground, smoothed, pinned at junctions and bridges, and
// held under the grade limit (forward and backward passes). Then the ground within the road and its flat
// shoulders takes the profile, and cut and fill slopes blend it into the land around.
function gradeRoads(net, H, CF) {
  const out = {}, WIDE = new Map(net.roads.map((r) => [r, walkWidths(net, r)]));
  for (const r of net.roads) {
    const n = Math.max(2, Math.round(r.len / 5) + 1), ds = r.len / (n - 1), y = new Float32Array(n), pin = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const p = at(r, i * ds); y[i] = heightAt(H, p.x, p.z); }
    // smooth over about 40 m, twice
    for (let pass = 0; pass < 2; pass++) { const c = Float32Array.from(y); for (let i = 0; i < n; i++) { let s = 0, w = 0; for (let k = -4; k <= 4; k++) { const m = r.closed ? (i + k + n - 1) % (n - 1) : clamp(i + k, 0, n - 1); s += c[m]; w++; } y[i] = s / w; } }
    if (r.closed) { let s = 0; for (let i = 0; i < n; i++) s += y[i]; y.fill(s / n); pin.fill(1); }
    // junctions: an end that joins an earlier road takes that road's height there
    // (level across the other road's flat surface, which the ground pass lays over this road's first meters)
    for (const j of net.joins) {
      if (j.road === r && out[j.other.id]) {
        // (level across the other road's flat, which its sidewalks may widen there)
        const o = out[j.other.id], io = clamp(Math.round(j.os / o.ds), 0, o.y.length - 1), Wo = WIDE.get(j.other), v = o.y[io];
        const ext = Math.ceil((Math.max(j.other.hw + (j.other.flat || 0) + 1.5, Wo.w[0][io], Wo.w[1][io]) + 1.5) / ds);
        for (let m = 0; m <= ext; m++) { const i = j.end ? n - 1 - m : m; if (i >= 0 && i < n) { y[i] = v; pin[i] = 1; } }
      }
      if (j.other === r && out[j.road.id]) { const o = out[j.road.id], v = o.y[j.end ? o.y.length - 1 : 0], i = clamp(Math.round(j.os / ds), 0, n - 1); y[i] = v; pin[i] = 1; }
    }
    // bridge decks are flat: the given height, or above the creek and level with the approach
    for (const sp of r.spans) {
      const i0 = Math.max(0, Math.floor(sp.s0 / ds)), i1 = Math.min(n - 1, Math.ceil(sp.s1 / ds));
      let v = sp.y;
      if (v == null) {
        // above the creek and level with the approaches, but reachable from the pinned junctions
        const pa = at(r, sp.s0), pb = at(r, sp.s1);
        v = Math.max((y[i0] + y[i1]) / 2, creekLevelNear(CF, (pa.x + pb.x) / 2, (pa.z + pb.z) / 2) + 4.5);
        for (let i = 0; i < n; i++) if (pin[i]) { const gap = Math.max(0, i0 - i, i - i1) * ds * (r.surface === 'dirt' ? GRADE.dirt : GRADE.asphalt) * 0.97; v = clamp(v, y[i] - gap, y[i] + gap); }
        sp.y = v;
      }
      for (let i = i0; i <= i1; i++) { y[i] = v; pin[i] = 1; }
    }
    // hold the grade: clamp into the envelope the pins allow, then forward and backward passes
    const g = (r.surface === 'dirt' ? GRADE.dirt : GRADE.asphalt) * ds;
    const U = new Float32Array(n).fill(Infinity), L = new Float32Array(n).fill(-Infinity);
    for (let i = 0, last = -1; i < n; i++) { if (pin[i]) last = i; if (last >= 0) { U[i] = Math.min(U[i], y[last] + g * (i - last)); L[i] = Math.max(L[i], y[last] - g * (i - last)); } }
    for (let i = n - 1, last = -1; i >= 0; i--) { if (pin[i]) last = i; if (last >= 0) { U[i] = Math.min(U[i], y[last] + g * (last - i)); L[i] = Math.max(L[i], y[last] - g * (last - i)); } }
    for (let i = 0; i < n; i++) if (!pin[i]) y[i] = L[i] > U[i] ? (L[i] + U[i]) / 2 : clamp(y[i], L[i], U[i]);
    for (let i = 1; i < n; i++) if (!pin[i]) y[i] = clamp(y[i], y[i - 1] - g, y[i - 1] + g);
    for (let i = n - 2; i >= 0; i--) if (!pin[i]) y[i] = clamp(y[i], y[i + 1] - g, y[i + 1] + g);
    out[r.id] = { y, ds, n };
  }
  // write the ground in two passes: every road's cut and fill slopes, then every road's flat surface (wide
  // roads last, so a highway keeps its own surface where a side road joins it; the side road was pinned
  // level across it)
  const order = [...net.roads].sort((a, b) => a.width - b.width || a.idx - b.idx);
  for (const pass of [0, 1]) for (const r of order) {
    // the flat reaches hw + flat + 1.5 m each side, and out past the road's sidewalks and aprons where it has them
    const P = out[r.id], Wd = WIDE.get(r), flat = Wd.max, reach = pass ? flat : flat + 40;
    const nt = band(r, reach);
    for (let q = 0; q < nt; q++) {
      const k = TOUCH[q], d = BD[k], s = BS[k];
      BD[k] = Infinity;
      // the ground under a bridge keeps its shape
      if (r.spans.some((sp) => s > sp.s0 + 1 && s < sp.s1 - 1)) continue;
      const sc = clamp(s, 0, r.len), f = sc / P.ds, i0 = clamp(Math.floor(f), 0, P.n - 1), i1 = Math.min(P.n - 1, i0 + 1), yr = P.y[i0] + (P.y[i1] - P.y[i0]) * (f - i0);
      const ws = Wd.w[BSG[k] > 0 ? 1 : 0], flatHere = ws[i0] + (ws[i1] - ws[i0]) * (f - i0);
      // past a road's end only the cut and fill apply
      const endGap = r.closed ? 0 : Math.max(0, -s, s - r.len);
      const side = endGap > 0 ? Math.sqrt(Math.max(0, d * d - endGap * endGap)) : d;
      const dd = Math.max(side - flatHere, 0) + Math.max(0, endGap - 4);
      if (dd <= 0) { if (pass) H[k] = yr; }
      else if (!pass) H[k] = clamp(H[k], yr - 0.55 * dd, yr + 0.75 * dd);
    }
  }
  return out;
}
// the grid vertices within reach of a road: distance in BD, arc length in BS (beyond an end the arc length
// runs negative or past the length) and side in BSG (+1 right of travel); their indices in TOUCH. The caller
// resets BD.
const BD = new Float32Array(W * W).fill(Infinity), BS = new Float32Array(W * W), BSG = new Int8Array(W * W), TOUCH = new Int32Array(W * W);
function band(r, reach) {
  let nt = 0;
  const last = r.line.length - 2;
  for (let s = 0; s <= last; s++) {
    const a = r.line[s], b = r.line[s + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1, Ls = Math.sqrt(L2);
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach + HALF) / CELL)), i1 = Math.min(N, Math.ceil((Math.max(a.x, b.x) + reach + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - reach + HALF) / CELL)), j1 = Math.min(N, Math.ceil((Math.max(a.z, b.z) + reach + HALF) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = gx(i), z = gx(j), t = ((x - a.x) * dx + (z - a.z) * dz) / L2, tc = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = hypot(x - a.x - dx * tc, z - a.z - dz * tc), k = j * W + i;
      if (d >= reach || d >= BD[k]) continue;
      if (BD[k] === Infinity) TOUCH[nt++] = k;
      BS[k] = !r.closed && ((s === 0 && t < 0) || (s === last && t > 1)) ? r.cum[s] + Ls * t : r.cum[s] + Ls * tc;
      BSG[k] = (x - a.x) * dz - (z - a.z) * dx > 0 ? -1 : 1;
      BD[k] = d;
    }
  }
  return nt;
}
// How far from a road's centreline its flat reaches on each side, per profile sample (w[0] left of travel,
// w[1] right; max the widest): hw + flat + 1.5 m, and out a grid cell past the outer edge of any sidewalk along it
// (its own, or a shop strip's that fronts it, with the parking apron between), so a walk lies level with the
// street instead of across a hillside. The widening tapers off over a few meters past a walk's ends.
function walkWidths(net, r) {
  const n = Math.max(2, Math.round(r.len / 5) + 1), ds = r.len / (n - 1), base = r.hw + (r.flat || 0) + 1.5;
  const w = [new Float32Array(n).fill(base), new Float32Array(n).fill(base)];
  for (const wk of net.walks) {
    if (wk.road === r) { for (let i = 0; i < n; i++) if (i * ds > wk.s0 - 2 && i * ds < wk.s1 + 2) for (const a of w) a[i] = Math.max(a[i], r.hw + wk.to + CELL); }
    else if (wk.segs) for (const sg of wk.segs) {
      if (sg.road !== r) continue;
      const nx = -sg.dz * (sg.side || 1), nz = sg.dx * (sg.side || 1);
      for (let i = 0; i < n; i++) {
        const p = at(r, i * ds), ex = p.x - sg.ax, ez = p.z - sg.az, u = ex * sg.dx + ez * sg.dz;
        if (u < -2 || u > sg.len + 2) continue;
        const l = ex * nx + ez * nz, mid = (sg.from + sg.to) / 2 - l; // the road point across the walk's frame
        const side = (nx * mid) * Math.cos(p.yaw) - (nz * mid) * Math.sin(p.yaw) > 0 ? 0 : 1; // (band()'s sign)
        w[side][i] = Math.max(w[side][i], sg.to - l + CELL);
      }
    }
  }
  for (const a of w) { for (let i = 1; i < n; i++) a[i] = Math.max(a[i], a[i - 1] - 0.6 * ds); for (let i = n - 2; i >= 0; i--) a[i] = Math.max(a[i], a[i + 1] - 0.6 * ds); }
  let max = base; for (const a of w) for (let i = 0; i < n; i++) max = Math.max(max, a[i]);
  return { w, ds, n, max };
}
function creekLevelNear(CF, x, z) { const i = clamp(Math.round((x + HALF) / CELL), 0, N), j = clamp(Math.round((z + HALF) / CELL), 0, N), k = j * W + i; return CF.D[k] < Infinity ? CF.A[k * 2] : -Infinity; }

// The two road masks (MASK^2 texels of 1.95 m; the terrain shader reads both bilinear, and the ids nearest).
// Each texel belongs to the road whose edge it is deepest inside, or nearest outside (so a side road never
// paints over a highway), out to 16 m.
//   roads (bytes):  R the signed distance to that road's centreline over -8..8 m (the lane markings), G its
//           index (0 none), B and A its dash phase as sin and cos of 2 pi s / 12 (so it filters smoothly; the
//           walks' joints and the parking stalls use it too).
//   ground (half floats, so an edge sits within millimetres: bytes would wave it by +-3 cm): R meters past the
//           nearest road edge (min over every road: the asphalt itself, continuous through junctions and ends),
//           G the signed distance to the nearest lot's edge (negative inside), B and A the nearest sidewalk's
//           inner (kerb side) and outer edges and ends, as signed distances (the walk is where both are
//           negative; kept apart because one distance to a 3 m band creases down its middle, and the filter
//           would bend both edges toward the crease). Far is FAR.
//   lots (bytes): the nearest lot's index + 1 (0 none).
export const DIST = 8, enc = (d) => Math.round((clamp(d, -DIST, DIST) / DIST * 0.5 + 0.5) * 255), dec = (b) => (b / 255 * 2 - 1) * DIST;
export const FAR = 32;
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer), EXP2 = Array.from({ length: 32 }, (_, e) => Math.pow(2, e - 15));
export function toHalf(v) {
  f32[0] = v; const x = u32[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
  if (e <= 0) return s; // (under 6e-5: zero)
  if (e >= 31) return s | 0x7c00;
  return s | ((e << 10) + ((m + 0x1000) >>> 13)); // rounded (a carry steps the exponent, as it should)
}
export function fromHalf(h) { const e = (h >>> 10) & 0x1f, v = e ? (1 + (h & 0x3ff) / 1024) * EXP2[e] : (h & 0x3ff) * 5.960464477539063e-8; return h & 0x8000 ? -v : v; }
const gnd = (d) => toHalf(clamp(d, -FAR, FAR));
function roadMask(net) {
  const M = new Uint8Array(MASK * MASK * 4), G = new Uint16Array(MASK * MASK * 4).fill(gnd(FAR)), LID = new Uint8Array(MASK * MASK), REACH = 16, best = new Float32Array(MASK * MASK).fill(REACH);
  for (let k = 0; k < MASK * MASK; k++) { M[k * 4] = 255; M[k * 4 + 2] = 128; M[k * 4 + 3] = 128; }
  const box = (x0, z0, x1, z1, f) => {
    const i0 = Math.max(0, Math.floor((x0 + HALF) / MPX)), i1 = Math.min(MASK - 1, Math.ceil((x1 + HALF) / MPX));
    const j0 = Math.max(0, Math.floor((z0 + HALF) / MPX)), j1 = Math.min(MASK - 1, Math.ceil((z1 + HALF) / MPX));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) f((i + 0.5) * MPX - HALF, (j + 0.5) * MPX - HALF, j * MASK + i);
  };
  // (9 m past the edge, as far as the grass and flora look; 16 m for a street with sidewalks, whose joints and
  // stalls read its phase)
  const walked = new Set(net.walks.flatMap((w) => (w.road ? [w.road] : w.segs.map((sg) => sg.road))));
  for (const r of net.roads) for (let s = 0; s < r.line.length - 1; s++) {
    const a = r.line[s], b = r.line[s + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1, L = Math.sqrt(L2), R = r.hw + (walked.has(r) ? REACH : 9);
    box(Math.min(a.x, b.x) - R, Math.min(a.z, b.z) - R, Math.max(a.x, b.x) + R, Math.max(a.z, b.z) + R, (x, z, k) => {
      const t = ((x - a.x) * dx + (z - a.z) * dz) / L2, tc = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = hypot(x - a.x - dx * tc, z - a.z - dz * tc);
      if (d - r.hw < best[k]) {
        best[k] = d - r.hw;
        const side = (x - a.x) * dz - (z - a.z) * dx > 0 ? -1 : 1, ph = (r.cum[s] + L * tc) / 12 * Math.PI * 2;
        M[k * 4] = enc(d * side); M[k * 4 + 1] = r.idx;
        M[k * 4 + 2] = Math.round((Math.sin(ph) * 0.5 + 0.5) * 255); M[k * 4 + 3] = Math.round((Math.cos(ph) * 0.5 + 0.5) * 255);
        G[k * 4] = gnd(d - r.hw);
      }
    });
  }
  // lots and aprons: the one whose edge is nearest (or deepest inside) out to 8 m
  const bestL = new Float32Array(MASK * MASK).fill(DIST);
  LOTS.forEach((l, li) => {
    const rr = hypot(l.w, l.d) / 2 + DIST;
    box(l.x - rr, l.z - rr, l.x + rr, l.z + rr, (x, z, k) => {
      const d = lotDist(l, x, z);
      if (d < bestL[k]) { bestL[k] = d; LID[k] = li + 1; G[k * 4 + 1] = gnd(d); }
    });
  });
  // sidewalks: per texel the walk it is deepest inside (or nearest), as its inner and outer distances
  const bestW = new Float32Array(MASK * MASK).fill(DIST), put = (k, wi, wo) => { const v = Math.max(wi, wo); if (v < bestW[k]) { bestW[k] = v; G[k * 4 + 2] = gnd(wi); G[k * 4 + 3] = gnd(wo); } };
  const nd = new Float32Array(MASK * MASK).fill(Infinity), ns = new Float32Array(MASK * MASK), touched = [];
  for (const w of net.walks) {
    if (w.road) {
      // the nearest point of the whole road (so the band is a true offset of it), then the band and the ends
      const r = w.road, R = r.hw + w.to + DIST;
      for (let s = 0; s < r.line.length - 1; s++) {
        if (r.cum[s + 1] < w.s0 - R || r.cum[s] > w.s1 + R) continue;
        const a = r.line[s], b = r.line[s + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1, L = Math.sqrt(L2);
        box(Math.min(a.x, b.x) - R, Math.min(a.z, b.z) - R, Math.max(a.x, b.x) + R, Math.max(a.z, b.z) + R, (x, z, k) => {
          const t = ((x - a.x) * dx + (z - a.z) * dz) / L2, tc = t < 0 ? 0 : t > 1 ? 1 : t, d = hypot(x - a.x - dx * tc, z - a.z - dz * tc);
          if (d < nd[k]) { if (nd[k] === Infinity) touched.push(k); nd[k] = d; ns[k] = r.cum[s] + L * tc; }
        });
      }
      for (const k of touched) { const e = nd[k] - r.hw; put(k, w.from - e, Math.max(e - w.to, w.s0 - ns[k], ns[k] - w.s1)); nd[k] = Infinity; }
      touched.length = 0;
    } else for (const sg of w.segs) {
      const R = Math.max(Math.abs(sg.from), Math.abs(sg.to)) + DIST;
      box(Math.min(sg.ax, sg.bx) - R, Math.min(sg.az, sg.bz) - R, Math.max(sg.ax, sg.bx) + R, Math.max(sg.az, sg.bz) + R, (x, z, k) => { lineWalkDist(sg, x, z, WD); put(k, WD[0], WD[1]); });
    }
  }
  return { mask: M, ground: G, lotIds: LID };
}
const WD = [0, 0];
// A line walk segment at (x,z): out[0] the signed distance past its inner edge (from m to its side; side 0:
// either side), out[1] past its outer edge (to m) or its square ends 0.5 m past its points (so neighbouring
// segments meet without a notch). The walk is where both are negative.
export function lineWalkDist(sg, x, z, out = [0, 0]) {
  const ex = x - sg.ax, ez = z - sg.az, u = ex * sg.dx + ez * sg.dz;
  let l = ez * sg.dx - ex * sg.dz; // + to the right of travel (places.js row() side +1)
  l = sg.side ? l * sg.side : Math.abs(l);
  out[0] = sg.from - l; out[1] = Math.max(l - sg.to, -0.5 - u, u - sg.len - 0.5);
  return out;
}
// meters outside the nearest road's asphalt or lot, from the ground mask (negative on the road or inside a lot;
// Infinity past the mask's reach)
export const maskIndex = (x, z) => (clamp(Math.floor((z + HALF) / MPX), 0, MASK - 1) * MASK + clamp(Math.floor((x + HALF) / MPX), 0, MASK - 1)) * 4;
export function roadEdge(ground, x, z) {
  const mk = maskIndex(x, z), d = Math.min(fromHalf(ground[mk]), fromHalf(ground[mk + 1]));
  return d >= REACH_EDGE ? Infinity : d;
}
const REACH_EDGE = 8; // (as the old mask: past 8 m no road or lot counts)
// the signed distance to the nearest sidewalk at a ground texel (index mk = texel * 4): negative on it
export const walkAt = (ground, mk) => Math.max(fromHalf(ground[mk + 2]), fromHalf(ground[mk + 3]));

/* ------------------------------------------------------------------ the paper map */
// Watercolour ground with hill shading from the upper left, contour lines every 10 m (stronger every 50 m),
// red rock washed in on the cliffs, and blue water. Roads and labels are drawn on the main thread.
function paintMap(H, types, CF, WF) {
  const out = new Uint8Array(MAP * MAP * 4), px = 2000 / MAP;
  const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  const hs = new Float32Array(MAP * MAP), fs = { d: 0, a: [0, 0], side: 0 };
  for (let j = 0; j < MAP; j++) for (let i = 0; i < MAP; i++) hs[j * MAP + i] = heightAt(H, (i + 0.5) * px - HALF, (j + 0.5) * px - HALF);
  for (let j = 0; j < MAP; j++) for (let i = 0; i < MAP; i++) {
    const k = j * MAP + i, h = hs[k], x = (i + 0.5) * px - HALF, z = (j + 0.5) * px - HALF;
    const hl = hs[j * MAP + Math.max(0, i - 1)], hr = hs[j * MAP + Math.min(MAP - 1, i + 1)], hu = hs[Math.max(0, j - 1) * MAP + i], hd = hs[Math.min(MAP - 1, j + 1) * MAP + i];
    const nx = (hl - hr) / (2 * px), nz = (hu - hd) / (2 * px), len = hypot(nx, 1, nz);
    const light = (-nx * 0.55 - nz * 0.55 + 0.45) / len;
    const t = types[clamp(Math.floor((z + HALF) / TCELL), 0, TGRID - 1) * TGRID + clamp(Math.floor((x + HALF) / TCELL), 0, TGRID - 1)];
    // paper, warmed by the red ground; cliffs washed red
    let r = 0.93, g = 0.86, b = 0.72;
    const rk = smooth(0.2, 0.6, hypot(nx, nz)) + (t === T.rock ? 0.3 : 0);
    r = lerp(r, 0.8, clamp(rk, 0, 1) * 0.8); g = lerp(g, 0.5, clamp(rk, 0, 1) * 0.8); b = lerp(b, 0.38, clamp(rk, 0, 1) * 0.8);
    if (t === T.scrub) { r -= 0.04; g -= 0.01; b -= 0.02; }
    if (t === T.sand) { r = lerp(r, 0.95, 0.4); g = lerp(g, 0.88, 0.4); b = lerp(b, 0.7, 0.4); }
    if (light > 0.62) { const w = Math.min(0.3, (light - 0.62) * 1.2); r = lerp(r, 1, w); g = lerp(g, 0.96, w); b = lerp(b, 0.84, w); }
    else { const w = Math.min(0.42, (0.62 - light) * 1.1); r = lerp(r, 0.42, w); g = lerp(g, 0.4, w); b = lerp(b, 0.5, w); }
    // contours; on the steep walls (the canyon's terraces) only every 50 m, so they do not pile into bands
    const c50 = Math.floor(h / 50) !== Math.floor(hl / 50) || Math.floor(h / 50) !== Math.floor(hu / 50);
    if (c50 || ((Math.floor(h / 10) !== Math.floor(hl / 10) || Math.floor(h / 10) !== Math.floor(hu / 10)) && hypot(nx, nz) < 0.9)) { const m = c50 ? 0.7 : 0.86; r *= m; g *= m; b *= m; }
    // water: the creek from its own line (half width, soft edge: no stair steps from the type grid), pools
    // from the types
    let wk = t === T.water ? 1 : 0;
    if (CF) {
      sampleField(CF, x, z, fs);
      if (fs.d < 60) {
        const hw = fs.a[1] || 0, pool = t === T.water && POOLS.some(([qx, qz, qr]) => hypot(x - qx, z - qz) < qr);
        wk = pool ? 1 : hw > 0.5 && h < fs.a[0] + 0.3 ? clamp((hw - 0.5 - fs.d) / px + 0.5, 0, 1) : 0;
      }
    }
    if (wk > 0) { r = lerp(r, 0.45, wk); g = lerp(g, 0.62, wk); b = lerp(b, 0.72, wk); }
    const grain = 0.97 + hash(i, j) * 0.05 + hash(i >> 3, j >> 3) * 0.04;
    out[k * 4] = clamp(r * grain, 0, 1) * 255; out[k * 4 + 1] = clamp(g * grain, 0, 1) * 255; out[k * 4 + 2] = clamp(b * grain, 0, 1) * 255; out[k * 4 + 3] = 255;
  }
  return out;
}

/* ------------------------------------------------------------------ flora */
// Per 100 m cell: [species, x, y, z, scale, yaw] for every plant. 0 juniper, 1 cottonwood, 2 cactus or agave,
// 3 boulder. Nothing grows on roads, lots, pads, buildings, water or steep rock.
export const SPECIES = ['juniper', 'cottonwood', 'cactus', 'boulder'];
// The strips' shops (STRIP_FOOT) and where they stood before the strips had sidewalks (LEGACY_STRIP_FOOT: 20 m
// back in West Sedona, where they still stand, 13 m in the Village, and the Village's north chords from x 230):
// the flora scatter keeps clear of the old footprints as it always did, and of the new ones without drawing on the
// random stream.
const LEGACY_STRIPS = [20, 20, 20, 20, [230, 800, 13], 13, [230, 800, 13], 13];
const STRIP_FOOT = new Set(), LEGACY_STRIP_FOOT = [];
STRIPS.forEach((st, k) => {
  const chord = (a, b, side) => { const L = hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L; return { a, L, dx, dz, rx: -dz * side, rz: dx * side }; };
  const C = chord(st.a, st.b, st.side), old = LEGACY_STRIPS[k], O = chord(Array.isArray(old) ? [old[0], old[1]] : st.a, st.b, st.side), oldSet = Array.isArray(old) ? old[2] : old;
  for (const b of BUILDINGS) {
    if (b.district !== st.district) continue;
    const ex = b.x - C.a[0], ez = b.z - C.a[1], u = ex * C.dx + ez * C.dz, l = ex * C.rx + ez * C.rz;
    if (u < 0 || u > C.L || Math.abs(l - st.setback - b.d / 2) > 0.2) continue;
    STRIP_FOOT.add(b);
    const t = (Math.floor(u / C.L * st.n) + 0.5) / st.n, r1 = (v) => Math.round(v * 10) / 10;
    LEGACY_STRIP_FOOT.push({ x: r1(O.a[0] + O.dx * O.L * t + O.rx * (oldSet + b.d / 2)), z: r1(O.a[1] + O.dz * O.L * t + O.rz * (oldSet + b.d / 2)), w: b.w + (O.L - C.L) / st.n, d: b.d, yaw: Math.atan2(-O.rx, -O.rz) });
  }
});
// Uptown's main street before it was straightened along the storefronts, and the old road mask (bytes: the
// signed distance to the winning road's centreline or lot's edge, and its id, lots 100 +) in a box round it, as
// the flora scatter saw them.
const LEGACY_A89U = [[73, 27], [120, -8], [225, -88], [318, -160]], LEGACY_BOX = [50, -185, 345, 52];
function legacyUptownMask(net) {
  const [x0, z0, x1, z1] = LEGACY_BOX, i0 = Math.floor((x0 + HALF) / MPX), j0 = Math.floor((z0 + HALF) / MPX), ni = Math.ceil((x1 + HALF) / MPX) - i0 + 1, nj = Math.ceil((z1 + HALF) / MPX) - j0 + 1;
  const M = new Uint8Array(ni * nj * 2), best = new Float32Array(ni * nj).fill(9), R = 8, enc8 = (d) => Math.round((clamp(d, -R, R) / R * 0.5 + 0.5) * 255);
  M.fill(255);
  for (let k = 0; k < ni * nj; k++) M[k * 2 + 1] = 0;
  const each = (bx0, bz0, bx1, bz1, f) => {
    const a0 = Math.max(i0, Math.floor((bx0 + HALF) / MPX)), a1 = Math.min(i0 + ni - 1, Math.ceil((bx1 + HALF) / MPX)), b0 = Math.max(j0, Math.floor((bz0 + HALF) / MPX)), b1 = Math.min(j0 + nj - 1, Math.ceil((bz1 + HALF) / MPX));
    for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) f((i + 0.5) * MPX - HALF, (j + 0.5) * MPX - HALF, (j - j0) * ni + (i - i0));
  };
  const oldLine = smoothLine(LEGACY_A89U);
  for (const r of net.roads) {
    const line = r.id === 'a89u' ? oldLine : r.line;
    for (let s = 0; s < line.length - 1; s++) {
      const a = line[s], b = line[s + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
      each(Math.min(a.x, b.x) - R, Math.min(a.z, b.z) - R, Math.max(a.x, b.x) + R, Math.max(a.z, b.z) + R, (x, z, k) => {
        const t = ((x - a.x) * dx + (z - a.z) * dz) / L2, tc = t < 0 ? 0 : t > 1 ? 1 : t, d = hypot(x - a.x - dx * tc, z - a.z - dz * tc);
        if (d - r.hw < best[k]) { best[k] = d - r.hw; M[k * 2] = enc8(d * ((x - a.x) * dz - (z - a.z) * dx > 0 ? -1 : 1)); M[k * 2 + 1] = r.idx; }
      });
    }
  }
  LOTS.forEach((l, li) => {
    if (l.apron) return;
    const rr = hypot(l.w, l.d) / 2 + R;
    each(l.x - rr, l.z - rr, l.x + rr, l.z + rr, (x, z, k) => {
      const d = lotDist(l, x, z); if (d > 2) return;
      const rid = M[k * 2 + 1]; if (rid && rid < 100 && best[k] < 0.3) return;
      M[k * 2] = enc8(d); M[k * 2 + 1] = 100 + li; best[k] = Math.min(best[k], Math.max(0, d));
    });
  });
  // blocked as it was (on or within 2.5 m of a road, within 2 m of a lot), or undefined outside the box
  return (x, z) => {
    const i = Math.floor((x + HALF) / MPX) - i0, j = Math.floor((z + HALF) / MPX) - j0;
    if (i < 0 || j < 0 || i >= ni || j >= nj) return undefined;
    const k = j * ni + i, id = M[k * 2 + 1], d = (M[k * 2] / 255 * 2 - 1) * R;
    if (!id) return false;
    return id >= 100 ? Math.abs(d) < 2 || M[k * 2] < 128 : Math.abs(d) < net.roads[id - 1].hw + 2.5;
  };
}
// blocked() answers 1 (no plant) or 2 (no plant, but its scale and yaw are still drawn): the sidewalks, the
// strips' parking aprons and their shops answer 2, so the random stream, and every plant away from them, stays
// as it was before they came (a plant turned away draws nothing, so one more or less would reseat every plant
// after it). The roads and the old lots are read as the byte mask always gave them, for the same reason.
function scatterFlora(seed, H, types, mask, ground, lotIds, net, CF, rockK, rocks) {
  const cells = [], all = [];
  let a = (seed * 2654435761) >>> 0;
  const R = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const oldUptown = legacyUptownMask(net);
  const inFoot = (b, x, z, m) => { const c = Math.cos(b.yaw), s = Math.sin(b.yaw), lx = (x - b.x) * c - (z - b.z) * s, lz = (x - b.x) * s + (z - b.z) * c; return Math.abs(lx) < b.w / 2 + m && Math.abs(lz) < b.d / 2 + m; };
  const blocked = (x, z) => {
    // not on or beside a road (2.5 m), a lot (2 m) or a sidewalk (1.5 m)
    const mi = clamp(Math.floor((x + HALF) / MPX), 0, MASK - 1), mj = clamp(Math.floor((z + HALF) / MPX), 0, MASK - 1), mk = (mj * MASK + mi) * 4;
    const id = mask[mk + 1], lot = LOTS[lotIds[mk >> 2] - 1], lotD = fromHalf(ground[mk + 1]), was = oldUptown(x, z);
    if (was === true) return 1;
    if (was === undefined) {
      if (lot && !lot.apron && lotD <= 2 && dec(enc(lotD)) < 2) return 1;
      if (id && Math.abs(dec(mask[mk])) < net.roads[id - 1].hw + 2.5) return 1;
    }
    for (const b of LEGACY_STRIP_FOOT) if (Math.abs(x - b.x) < 30 && Math.abs(z - b.z) < 30 && inFoot(b, x, z, 3)) return 1;
    let late = walkAt(ground, mk) < 1.5 || fromHalf(ground[mk]) < 2.5 || lotD < 2;
    for (const b of BUILDINGS) {
      // (a storefront moved back for its porch keeps the plants clear of where it stood, as the random stream saw it)
      if (b.was && Math.abs(x - b.was[0]) < 30 && Math.abs(z - b.was[1]) < 30 && inFoot({ ...b, x: b.was[0], z: b.was[1] }, x, z, 3)) return 1;
      if (Math.abs(x - b.x) > 30 || Math.abs(z - b.z) > 30 || !inFoot(b, x, z, 3)) continue;
      if (!STRIP_FOOT.has(b) && !b.was) return 1;
      late = true;
    }
    for (const p of PADS) if (hypot(x - p.x, z - p.z) < p.r) return 1;
    for (const k of KAZOOS) if (hypot(x - k.x, z - k.z) < 2.5) return 1;
    for (const c of Object.values(CAIRNS)) if (hypot(x - c.x, z - c.z) < 5) return 1;
    for (const f of rocks) for (const c of f.hi.colliders) if (hypot(x - c.x, z - c.z) < c.r + 2) return 1;
    return late ? 2 : 0;
  };
  // the street trees (roads.js STREET_TREES), planted in their cells after the scatter (they take nothing from it)
  const planted = new Map();
  for (const [x, z, sc, yaw] of STREET_TREES) { const c = clamp(Math.floor((z + HALF) / 100), 0, 19) * 20 + clamp(Math.floor((x + HALF) / 100), 0, 19); if (!planted.has(c)) planted.set(c, []); planted.get(c).push(1, x, heightAt(H, x, z), z, sc, yaw); }
  for (let cj = 0; cj < 20; cj++) for (let ci = 0; ci < 20; ci++) {
    const list = [];
    for (let gz = 0; gz < 100; gz += 5) for (let gxx = 0; gxx < 100; gxx += 5) {
      const x = ci * 100 - HALF + gxx + R() * 5, z = cj * 100 - HALF + gz + R() * 5;
      if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) continue;
      const t = types[clamp(Math.floor((z + HALF) / TCELL), 0, TGRID - 1) * TGRID + clamp(Math.floor((x + HALF) / TCELL), 0, TGRID - 1)];
      if (t === T.water || t === T.asphalt) continue;
      const i = clamp(Math.round((x + HALF) / CELL), 0, N), j = clamp(Math.round((z + HALF) / CELL), 0, N), k = j * W + i;
      const ny = normalY(H, x, z), cd = CF.D[k], hw = CF.A[k * 2 + 1];
      const u = R();
      let sp = -1;
      const scrubK = t === T.scrub ? 1 : t === T.rock ? (ny > 0.72 ? 0.3 : 0) : t === T.sand ? 0.08 : 0.05;
      const clump = fbm(simplexCache(seed), x / 70, z / 70, 2) * 0.5 + 0.5;
      if (cd > hw + 3 && cd < hw + 26 && u < 0.2) sp = 1;
      else if (u < 0.19 * scrubK * (0.35 + clump * 1.3)) sp = 0;
      else if (u > 0.985 && (t === T.scrub || t === T.sand)) sp = 2;
      else if (u > 0.97 && u <= 0.985 && (rockK[k] > 0.2 || ny < 0.9 || t === T.scrub)) sp = 3;
      const bl = sp < 0 ? 1 : blocked(x, z);
      if (bl === 1) continue;
      if (sp === 1 && cd < hw + 3) continue;
      const sc = sp === 1 ? 0.9 + R() * 0.7 : sp === 3 ? 0.5 + R() * 1.4 : 0.65 + R() * 0.75, yaw = R() * Math.PI * 2;
      if (!bl) list.push(sp, x, heightAt(H, x, z), z, sc, yaw);
    }
    if (planted.has(cj * 20 + ci)) list.push(...planted.get(cj * 20 + ci));
    cells.push(all.length / 6, list.length / 6);
    all.push(...list);
  }
  return { data: Float32Array.from(all), cells: Int32Array.from(cells) };
}
const simplexMemo = new Map();
function simplexCache(seed) { let s = simplexMemo.get(seed); if (!s) simplexMemo.set(seed, (s = simplex(seed + 99))); return s; }

/* ------------------------------------------------------------------ tiles */
// One tile at a level of detail: the grid (5, 10 or 20 m cells), 8 m skirts on its edges, and the rocks
// whose centre falls in it. Returns transferable arrays and the bounds.
export function buildTile(ctx, ti, tj, lod) {
  const { H, col, rock, rocks } = ctx;
  // Preserve the turnout and canyon approaches even in establishing shots.
  const nearBridge = ti === 3 && tj === 1;
  const step = nearBridge ? [0.5, 1, 2][lod] : [1, 2, 4][lod], n = TILE_CELLS / step, i0 = ti * TILE_CELLS, j0 = tj * TILE_CELLS, nv = (n + 1) * (n + 1);
  const mine = rocks.filter((r) => Math.floor((r.f.x + HALF) / 400) === ti && Math.floor((r.f.z + HALF) / 400) === tj).map((r) => (lod === 0 ? r.hi : r.lo));
  let rv = 0, ri = 0; for (const m of mine) { rv += m.pos.length / 3; ri += m.idx.length; }
  const total = nv + 4 * (n + 1) + rv;
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), cl = new Uint8Array(total * 3), rk = new Uint8Array(total);
  const idx = total > 65535 ? new Uint32Array(n * n * 6 + 4 * n * 6 + ri) : new Uint16Array(n * n * 6 + 4 * n * 6 + ri);
  let minY = Infinity, maxY = -Infinity;
  const hAt = (i, j) => heightAt(H, gx(clamp(i, 0, N)), gx(clamp(j, 0, N)));
  const sample = (arr, i, j, stride = 1, channel = 0) => {
    const a = Math.floor(i), b = Math.floor(j), u = i - a, v = j - b;
    const get = (x, z) => arr[(clamp(z, 0, N) * W + clamp(x, 0, N)) * stride + channel];
    return lerp(lerp(get(a, b), get(a + 1, b), u), lerp(get(a, b + 1), get(a + 1, b + 1), u), v);
  };
  for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++) {
    const i = i0 + a * step, j = j0 + b * step, v = b * (n + 1) + a, h = hAt(i, j);
    pos[v * 3] = gx(i); pos[v * 3 + 1] = h; pos[v * 3 + 2] = gx(j);
    const nx = hAt(i - step, j) - hAt(i + step, j), nz = hAt(i, j - step) - hAt(i, j + step), ny = 2 * step * CELL, l = hypot(nx, ny, nz);
    nrm[v * 3] = nx / l; nrm[v * 3 + 1] = ny / l; nrm[v * 3 + 2] = nz / l;
    for (let c = 0; c < 3; c++) cl[v * 3 + c] = sample(col, i, j, 3, c);
    rk[v] = sample(rock, i, j);
    if (h < minY) minY = h; if (h > maxY) maxY = h;
  }
  let t = 0;
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const p = b * (n + 1) + a, q = p + 1, d = p + n + 1, e = d + 1;
    idx[t++] = p; idx[t++] = d; idx[t++] = e; idx[t++] = p; idx[t++] = e; idx[t++] = q;
  }
  // skirts: a copy of each edge row 8 m lower, facing out
  const drop = lod === 2 ? 14 : 8;
  let v = nv;
  const edges = [
    Array.from({ length: n + 1 }, (_, a) => a), // north row (j0), left to right
    Array.from({ length: n + 1 }, (_, b) => b * (n + 1) + n), // east column
    Array.from({ length: n + 1 }, (_, a) => n * (n + 1) + (n - a)), // south row, right to left
    Array.from({ length: n + 1 }, (_, b) => (n - b) * (n + 1)), // west column
  ];
  for (const e of edges) {
    const base = v;
    for (const src of e) {
      pos[v * 3] = pos[src * 3]; pos[v * 3 + 1] = pos[src * 3 + 1] - drop; pos[v * 3 + 2] = pos[src * 3 + 2];
      nrm[v * 3] = nrm[src * 3]; nrm[v * 3 + 1] = nrm[src * 3 + 1]; nrm[v * 3 + 2] = nrm[src * 3 + 2];
      cl[v * 3] = cl[src * 3]; cl[v * 3 + 1] = cl[src * 3 + 1]; cl[v * 3 + 2] = cl[src * 3 + 2]; rk[v] = rk[src]; v++;
    }
    for (let m = 0; m < n; m++) { const a = e[m], b = e[m + 1], c = base + m, d = base + m + 1; idx[t++] = a; idx[t++] = b; idx[t++] = d; idx[t++] = a; idx[t++] = d; idx[t++] = c; }
  }
  minY -= drop;
  // rocks, with smooth normals from their faces
  for (const m of mine) {
    const base = v, cnt = m.pos.length / 3, acc = new Float32Array(cnt * 3);
    for (let q = 0; q < m.idx.length; q += 3) {
      const A = m.idx[q], Bq = m.idx[q + 1], C = m.idx[q + 2];
      const ax = m.pos[A * 3], ay = m.pos[A * 3 + 1], az = m.pos[A * 3 + 2];
      const ux = m.pos[Bq * 3] - ax, uy = m.pos[Bq * 3 + 1] - ay, uz = m.pos[Bq * 3 + 2] - az, wx = m.pos[C * 3] - ax, wy = m.pos[C * 3 + 1] - ay, wz = m.pos[C * 3 + 2] - az;
      const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
      for (const id of [A, Bq, C]) { acc[id * 3] += fx; acc[id * 3 + 1] += fy; acc[id * 3 + 2] += fz; }
      idx[t++] = base + A; idx[t++] = base + Bq; idx[t++] = base + C;
    }
    for (let q = 0; q < cnt; q++) {
      const l = hypot(acc[q * 3], acc[q * 3 + 1], acc[q * 3 + 2]) || 1;
      pos[v * 3] = m.pos[q * 3]; pos[v * 3 + 1] = m.pos[q * 3 + 1]; pos[v * 3 + 2] = m.pos[q * 3 + 2];
      nrm[v * 3] = acc[q * 3] / l; nrm[v * 3 + 1] = acc[q * 3 + 1] / l; nrm[v * 3 + 2] = acc[q * 3 + 2] / l;
      cl[v * 3] = 90; cl[v * 3 + 1] = 20; cl[v * 3 + 2] = 8; rk[v] = 255;
      if (m.pos[q * 3 + 1] > maxY) maxY = m.pos[q * 3 + 1];
      v++;
    }
  }
  const x0 = gx(i0), z0 = gx(j0), sz = TILE_CELLS * CELL;
  let bx0 = x0, bx1 = x0 + sz, bz0 = z0, bz1 = z0 + sz;
  for (let q = nv + 4 * (n + 1); q < v; q++) { bx0 = Math.min(bx0, pos[q * 3]); bx1 = Math.max(bx1, pos[q * 3]); bz0 = Math.min(bz0, pos[q * 3 + 2]); bz1 = Math.max(bz1, pos[q * 3 + 2]); }
  return { i: ti, j: tj, lod, pos, nrm, col: cl, rock: rk, idx, box: [bx0, minY, bz0, bx1, maxY, bz1] };
}
export const tileTransfer = (t) => [t.pos.buffer, t.nrm.buffer, t.col.buffer, t.rock.buffer, t.idx.buffer];

/* ------------------------------------------------------------------ the worker */
const inWorker = typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof document === 'undefined' && typeof WorkerGlobalScope !== 'undefined';
if (inWorker) {
  let ctx = null;
  self.onmessage = (ev) => {
    const m = ev.data;
    try {
      if (m.init) {
        const t0 = performance.now();
        const g = generate(m.init.seed ?? 51, (p) => self.postMessage({ type: 'progress', p }));
        ctx = g.ctx;
        const tiles = [];
        for (let j = 0; j < TILES; j++) for (let i = 0; i < TILES; i++) tiles.push(buildTile(ctx, i, j, 2));
        const H = Float32Array.from(g.H); // the worker keeps its own copy for tiles
        const msg = { type: 'init', heights: H, types: g.types, mask: g.mask, ground: g.ground, lotIds: g.lotIds, map: g.map, scatter: g.scatter, rockColliders: g.rockColliders, creek: g.creek, wash: g.wash, bridges: g.bridges, tiles, ms: { ...g.ms, worker: performance.now() - t0 } };
        self.postMessage(msg, [H.buffer, g.types.buffer, g.mask.buffer, g.ground.buffer, g.lotIds.buffer, g.map.buffer, g.scatter.data.buffer, g.scatter.cells.buffer, ...tiles.flatMap(tileTransfer)]);
      } else if (m.tile && ctx) {
        const t = buildTile(ctx, m.tile.i, m.tile.j, m.tile.lod);
        self.postMessage({ type: 'tile', tile: t, req: m.tile.req }, tileTransfer(t));
      }
    } catch (e) { self.postMessage({ type: 'error', message: String(e && e.stack || e) }); }
  };
}
