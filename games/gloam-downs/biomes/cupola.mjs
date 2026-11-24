// The Broken Cupola: the second place of the Gilt Lattice. At night you stand on a fallen piece of a lantern, high on the south hill.
// Across a valley of fallen coffers a red dome of eight sails stands on an octagonal drum, with white marble ribs where the sails meet.
// Its south-west sail is broken out in blocks, and the blocks float up and away in a magenta cloud. A thin magenta wire shows the shape
// of the missing sail, and through the break you see the gold rosettes of the coffers inside. A stair climbs the marble rib on the south
// side of the dome, the east edge of the break, to the lantern on top, where the beacon waits.
//
// Sources (see openspec/changes/add-gloam-downs-renaissance/design.md):
// - Brunelleschi's dome in Florence: eight sails, two shells with a gap between them, white ribs at the corners, a pointed profile
//   (the arch is struck from centres at 4/5 of the span), herringbone brick and a lantern on top. Size, break, stair and colours are ours.
// - The Pantheon's coffers: square coffers in rows that get smaller toward the top.
// - The ideal-city panels: the far skyline of domes and towers. It is much too small for the dome: the scale is impossible.
// - Inigo Quilez, "Distance functions" and "Domain repetition": the dome, the ribs, the coffers and the break are each one solid with its
//   own distance, and the coffers and the blocks of the break repeat by folding space into cells, so the cost does not grow with the count.
// - The dissolve shaders (Godot Shaders, gamedev.net): a cell is cut where its noise passes a threshold, the cut cells drift away, and
//   the edge of the cut gets a rim of emissive dots.
// - Mercury's hg_sdf: the engrave join cuts the ring on the start slab.
// - Ben Golus and Inigo Quilez on grids: the grid on the drum floor is dabs on the ground, darker away from the centre.
// All forms here are our own.
import { yawAx } from '../lib/props.mjs';
import { lib, tile } from '../lib/common.mjs';

/* ---------------- the dome's numbers ---------------- */
const C = [0, -12]; // the centre of the drum and the dome
const YG = 1.5; // the ground round the drum and the floor inside it
const YF = 5.0; // the top of the drum, the foot of the dome
const YR = 13.0; // the lantern ring
const A0 = 10.0; // the outer apothem of the dome at its foot (circumradius 10.8)
const DRUM = { out: 12.0, in: 9.3 }; // apothems of the drum wall
const SHELL = { out: 0.7, gap: 1.4, inner: 0.9 }; // thickness of the outer shell, the gap, the inner shell
// the pointed profile: an arch whose radius is 4/5 of the span, from a centre on the far side of the axis (the "quinto acuto")
const RHO = 1.6 * A0, XC = A0 - RHO;
const T22 = Math.tan(Math.PI / 8), C22 = Math.cos(Math.PI / 8);
const SV = (YR - YF) / Math.sqrt(RHO * RHO - (2.2 - XC) ** 2); // the profile is set to reach the ring (apothem 2.2) at YR
const DEG = Math.PI / 180;
const dir = th => [Math.sin(th), -Math.cos(th)]; // azimuth: from north (-z), clockwise
// the outer apothem of the sails at height y, and its slope
function apo(y) {
  const Y = Math.max(0, Math.min(YR, y) - YF) / SV;
  return XC + Math.sqrt(Math.max(1e-6, RHO * RHO - Y * Y));
}
function apoD(y) {
  if (y <= YF) return 0;
  const Y = (Math.min(YR, y) - YF) / SV;
  return -(Y / SV) / Math.sqrt(Math.max(1e-6, RHO * RHO - Y * Y));
}
const sec = y => Math.sqrt(1 + apoD(y) ** 2);
// the eight faces: normal n (outward) and tangent t of face k, at azimuth 22.5 + 45k; the corners (the ribs) are at 45k, so a rib
// stands due south, toward the start
const NX = [], NZ = [], TX = [], TZ = [];
for (let k = 0; k < 8; k++) {
  const [nx, nz] = dir((22.5 + k * 45) * DEG), [tx, tz] = dir((22.5 + k * 45 + 90) * DEG);
  NX.push(nx); NZ.push(nz); TX.push(tx); TZ.push(tz);
}
// the octagonal distance of (x, z) from the axis: the largest of the eight face projections, and the face that gives it
const oct = (x, z) => {
  const dx = x - C[0], dz = z - C[1];
  let m = -1e9, k = 0;
  for (let i = 0; i < 8; i++) { const d = dx * NX[i] + dz * NZ[i]; if (d > m) { m = d; k = i; } }
  return { m, k, t: dx * TX[k] + dz * TZ[k] };
};
// the signed distance from the outer surface of the sails, along the surface normal (first order)
const sailF = (m, y) => (m - apo(y)) / sec(y);
// a point on face k: apothem u, lateral t, height y
const onFace = (k, u, t, y) => [C[0] + NX[k] * u + TX[k] * t, y, C[1] + NZ[k] * u + TZ[k] * t];
// the outward normal of the sail surface on face k at height y
const sailN = (k, y) => { const s = sec(y), d = apoD(y); return [NX[k] / s, -d / s, NZ[k] / s]; };

/* ---------------- the break: cells of 1 m on the south-west sail (face 4, at 202.5 degrees, between the ribs at 180 and 225) ---------------- */
const BK = 4;
const CI0 = -7, CI1 = 6, CJ0 = -1, CJ1 = 7; // cell i covers t in [i, i + 1]; cell j covers y in [YF + j, YF + j + 1]
const hash = (i, j, s = 0) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
function makeMask(fn) {
  const M = new Uint8Array((CI1 - CI0 + 1) * (CJ1 - CJ0 + 1));
  for (let j = CJ0; j <= CJ1; j++) for (let i = CI0; i <= CI1; i++) M[(j - CJ0) * (CI1 - CI0 + 1) + i - CI0] = fn(i + 0.5, YF + j + 0.5, i, j) ? 1 : 0;
  const at = (i, j) => (i < CI0 || i > CI1 || j < CJ0 || j > CJ1 ? 0 : M[(j - CJ0) * (CI1 - CI0 + 1) + i - CI0]);
  return at;
}
// the outer shell: a ragged hole from the foot to y 11, and open over the gallery beside the east rib of the break
const MO = makeMask((tc, yc, i, j) => {
  if (yc > 11) return false;
  const hw = apo(yc) * T22;
  if (Math.abs(tc) > hw - 0.25) return false; // keep the sail's edge under the ribs
  if (tc > -4.2 && tc < 0.6 && yc > 7 && yc < 10.9) return true; // over the gallery
  const e = (tc / (hw * 0.98)) ** 2 + ((yc - 7.4) / 3.7) ** 2;
  return e + 0.6 * (hash(i, j) - 0.5) < 0.86;
});
// the inner shell: a smaller hole high up, and open at the gallery's inner edge
const MI = makeMask((tc, yc, i, j) => {
  if (yc > 10.6 || yc < 6.6) return false;
  if (tc > -3.8 && tc < 0.6 && yc > 7.2 && yc < 10.3) return true;
  const e = (tc / 2.4) ** 2 + ((yc - 8.7) / 1.8) ** 2;
  return e + 0.5 * (hash(i, j, 3) - 0.5) < 0.8;
});
// the distance from a point (t, y) in face 5 to the cut cells of a mask (they run through the wall along the face normal)
function cutDist(mask, t, y) {
  const i0 = Math.floor(t), j0 = Math.floor(y - YF);
  let best = Infinity;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const i = i0 + di, j = j0 + dj;
    if (!mask(i, j)) continue;
    const qx = Math.max(i - t, t - i - 1), qy = Math.max(YF + j - y, y - YF - j - 1);
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
    if (d < best) best = d;
  }
  if (best === Infinity) best = Math.min(t - (i0 - 1), i0 + 2 - t, y - YF - (j0 - 1), j0 + 2 - (y - YF));
  return best;
}

/* ---------------- the coffers: five rows on the inner face of the inner shell ---------------- */
const FIN = -(SHELL.out + SHELL.gap + SHELL.inner); // the inner face of the inner shell, as a distance from the outer surface
const FIB = -(SHELL.out + SHELL.gap); // its back
const apoIn = y => apo(y) + FIN * sec(y); // the inner face's apothem at height y
const YB = 4.4; // the foot of the inner shell
let YI = YF;
while (apoIn(YI + 0.02) > 1.4 && YI < YR) YI += 0.02; // the top of the inner shell: an open ring at apothem 1.4
// the inner face's length up its profile, so the coffers are square on the surface
const ST = [];
for (let y = YB; y <= YI + 0.02; y += 0.02) {
  const s = ST.length ? ST[ST.length - 1][1] + Math.hypot(0.02, apoIn(y) - apoIn(y - 0.02)) : 0;
  ST.push([y, s]);
}
const sOf = y => { const k = Math.max(0, Math.min(ST.length - 1, (y - YB) / 0.02)), i = Math.floor(k), f = k - i; return i + 1 < ST.length ? ST[i][1] + (ST[i + 1][1] - ST[i][1]) * f : ST[i][1]; };
const yOf = s => { let lo = 0, hi = ST.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ST[m][1] < s) lo = m; else hi = m; } const a = ST[lo], b = ST[hi]; return a[0] + (b[0] - a[0]) * ((s - a[1]) / (b[1] - a[1] || 1)); };
const COFFER = { sizes: [2.0, 1.7, 1.4, 1.1, 0.8], gap: 0.34, depth: 0.25 };
const ROWS = [];
{
  let s = sOf(5.4);
  for (const size of COFFER.sizes) {
    const sc = s + size / 2, yc = yOf(sc), w = 2 * apoIn(yc) * T22 - 0.3, pitch = size + COFFER.gap, n = Math.floor(w / pitch);
    if (n >= 1 && apoIn(yc) > 1.6) ROWS.push({ size, sc, yc, n, pitch });
    s += size + COFFER.gap;
  }
}
// the coffer under (face k, t, s): its centre and half size
function cofferAt(t, s) {
  for (const r of ROWS) {
    if (Math.abs(s - r.sc) > r.size / 2 + COFFER.gap / 2) continue;
    const c = Math.max(0, Math.min(r.n - 1, Math.round(t / r.pitch + (r.n - 1) / 2)));
    return { tc: (c - (r.n - 1) / 2) * r.pitch, sc: r.sc, hs: r.size / 2, row: r };
  }
  return null;
}

/* ---------------- the rib stair, on the rib at 180 degrees (the east edge of the break) ---------------- */
const SR = 180 * DEG; // the corner of the stair rib
const RIB = { half: 0.8, proud: 0.38, deep: 1.5 };
const qTop = y => apo(y) / C22 + RIB.proud; // the radius of the rib's top along its corner, at height y
const ribY = q => { // the height of the rib's top at radius q (q under the foot's radius: the foot)
  if (q >= qTop(YF)) return YF;
  let lo = YF, hi = YR;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (qTop(m) > q) lo = m; else hi = m; }
  return (lo + hi) / 2;
};
const STEP = { n: 20, rise: (YR - YF) / 20, depth: 0.5, landing: 8 };
const SE = []; // the edges of the treads: step i spans radius SE[i + 1]..SE[i] with its top at YF + rise * i
{
  SE[STEP.n + 1] = 2.7;
  for (let i = STEP.n; i >= 1; i--) SE[i] = Math.max(SE[i + 1] + STEP.depth, qTop(YF + STEP.rise * (i - 1)) + 0.08);
}
const YL = YF + STEP.rise * STEP.landing; // the landing, and the gallery into the break

// where the start camera's eye is (preview: 9 back, pitch 0.3)
const START = [0, 27.5], YS = 11.6;
const EYE_UP = 1 + 9 * Math.sin(0.3), EYE_BACK = 9 * Math.cos(0.3);
// the walked line from the start to the drum's door, and the branch to the ramp on the east face
const PATH = [[0, 21.6], [0.7, 15.5], [-0.5, 10], [1.4, 4.8], [4.4, 0.0]];
const BRANCH = [[1.4, 4.8], [8, 2.2], [13.2, -3.2], [14.6, -9.6]];
const RAMP = { face: 1, u: DRUM.out + 1.1, t0: 6.6, t1: -4.2, width: 2.2, rise: 0.35 };

export default {
  id: 'cupola',
  name: 'The Broken Cupola',
  sub: 'A ribbed dome split open on the hill, its coffers full of light',
  hint: 'Climb the marble rib to the lantern. Light the beacon.',
  seed: 67,
  run: false,
  set: 'lattice',
  palette: [
    ['sky', [0x05020a]],
    ['skyband', [0x140818, 0x2a0e2c, 0x4a1640, 0x761f4e]],
    ['fog', [0x1e0c22]],
    ['ink', [0x050207]],
    ['shade', [0x07030a]],
    ['brick', [0x1c0a0a, 0x3a1612, 0x5e2618, 0x8a3c22]],
    ['rib', [0x1e1a26, 0x3a3446, 0x5e5670, 0x8c84a0]],
    ['lapis', [0x0a0c26, 0x141a44, 0x22306a]],
    ['gold', [0x3a2410, 0x74501e, 0xc08a34, 0xf0c862]],
    ['neon', [0x4a1240, 0x8a2070, 0xc43a90]],
    ['turf', [0x0e0b14, 0x1a1420, 0x261c2c, 0x342638]]
  ],
  // cool moonlight from the south-east, so the ribs and the stair beside the break read against the sails. The moon you see is low
  // in the north-east: the light is set for form, not to match it
  light: { sun: [0.55, 0.5, 0.65], amb: 0.1, sky: 0.16, sunK: 0.48, shK: 7 },
  fog: { color: 'fog', far: 76, start: 0.5, max: 0.88 },
  dither: 0.5,
  outline: 0.45,
  // the walk map starts its march 18 over the ground, so it finds the lantern floor
  walk: { half: 34, opts: { above: 18 } },
  hills: {
    base: 1.0,
    bumps: [
      [0, 29.5, 12, 9.4], // the start's hill
      [-22, -6, 13, 4], [22, 8, 12, 3.5], [-18, 18, 10, 3], // rolling turf round the drum
      [-14, 34, 10, 4], [14, 33, 10, 4.5], // the south rim either side of the start
      [-44, -30, 20, 5], [44, -28, 20, 6] // far hills
    ],
    fbm: { amp: 0.55, freq: 1 / 11, oct: 3 },
    warp: { amp: 3, freq: 1 / 22 },
    far: { amp: 8, start: 38, end: 64 },
    // the land falls north of the dome, so the dome and the lantern stand against the sky
    pits: [[0, -50, 28, 7], [0, -90, 50, 12]],
    flats: [
      { at: C, r: 15.2, blend: 4, y: YG }, // round the drum, and its floor
      { at: [0, 9.5], box: [8.5, 6.5], blend: 5, y: 1.0 } // the valley
    ],
    paths: [{ pts: PATH, w: 2.4, depth: 0.08 }, { pts: BRANCH, w: 2.2, depth: 0.08 }],
    box: [-112, 112, -112, 112]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
    const tf = ramp('turf'), br = ramp('brick'), rb = ramp('rib'), lp = ramp('lapis'), gd = ramp('gold'), ne = ramp('neon');
    const ink = ramp('ink')[0];
    // a broad tone wander and a fine grain
    const grain = (k = 1) => (x, y, z) => k * (0.12 * (B.n3(x * 0.5, z * 0.5, y * 0.3 + 3) - 0.5) + 0.1 * (B.n3(x * 2.7, y * 2.7, z * 2.7) - 0.5));
    // marble: grain and thin cool veins
    const veins = (k = 1) => { const g = grain(k); return (x, y, z) => g(x, y, z) - (Math.abs(B.n3(x * 0.8 + y * 0.5, z * 0.8, y * 0.6) - 0.5) < 0.03 ? 0.14 * k : 0); };
    // laid marble: veins and joints between courses
    const coursed = (ch = 0.62, k = 0.8) => {
      const g = veins(k);
      return (x, y, z) => { const c = y / ch, f = c - Math.floor(c), u = ((x + z) / 1.3 + Math.floor(c) * 0.5) % 1; return g(x, y, z) + (f < 0.08 || (u + 1) % 1 < 0.05 ? -0.14 : 0); };
    };
    // the dome's tiles: courses that follow the height, each tile its own tone
    const tiles = (x, y, z) => {
      const c = y / 0.3, row = Math.floor(c), f = c - row, a = Math.atan2(x - C[0], z - C[1]) * 16 + row * 0.5, u = a - Math.floor(a);
      return 0.07 * (hash(Math.floor(a), row, 7) - 0.5) + 0.05 * (B.n3(x * 2.4, y * 2.4, z * 2.4) - 0.5) + (f < 0.14 || u < 0.07 ? -0.1 : 0.03);
    };
    // herringbone brick: blocks of 0.5 by 0.25, turned +45 or -45 degrees by row, with dark joints
    const herring = (x, z) => {
      const row = Math.floor(x / 0.62), sgn = row % 2 ? 1 : -1, SQ = Math.SQRT1_2;
      const p = (x + sgn * z) * SQ, q = (z - sgn * x) * SQ, bi = Math.floor(p / 0.5), qq = q + (bi % 2) * 0.125, bj = Math.floor(qq / 0.25);
      const fp = p / 0.5 - bi, fq = qq / 0.25 - bj, fr = x / 0.62 - row;
      if (fp < 0.1 || fq < 0.16 || fr < 0.05) return -0.3;
      return 0.22 * (hash(bi, bj, row) - 0.5);
    };
    const warmBrick = [br[1], br[2], ramp('fire')[1], ramp('fire')[2], ramp('fire')[3], ramp('fire')[4]];
    const marble = { r: rb, g: [rb[2]], mod: veins(0.9) };
    const drumM = { r: rb.slice(0, 4), g: [rb[1]], mod: coursed(0.62, 0.8) };
    const gold = { r: gd, g: [gd[2]] };
    const neon = { r: ne, em: true };
    const brickM = { r: br, g: warmBrick, mod: (x, y, z) => herring(x + z * 0.3, z - x * 0.3) * 0.8 + grain(0.6)(x, y, z) };
    const lapis = { r: lp, g: [lp[2]] };
    const far = { r: [ink, tf[0]], mod: grain(0.3) };

    /* ---- the ground: turf, the herringbone path, the marble floor of the drum ---- */
    {
      const onPath = (x, z) => h.pathDist(x, z) + 0.25 * (B.n3(x * 1.3, z * 1.3, 4) - 0.5) < 0.0;
      const inDrum = (x, z) => oct(x, z).m < DRUM.in + 0.2;
      const floorM = { r: rb.slice(0, 3), g: [rb[1]] };
      const near = {
        r: tf, g: [tf[1], tf[2], br[1], ramp('fire')[1], ramp('fire')[2], ramp('fire')[3]],
        mod: (x, y, z) => (onPath(x, z) ? herring(x, z) : inDrum(x, z) ? ((Math.floor(x / 1.5) + Math.floor(z / 1.5)) % 2 ? -0.1 : 0.1) + grain(0.4)(x, y, z) : grain(1.1)(x, y, z)),
        rf: (x, y, z) => (onPath(x, z) ? br.slice(0, 3) : inDrum(x, z) ? floorM.r : tf)
      };
      const mid = { r: tf, mod: grain(1.2), fat: 0.85 }, out = { r: tf, mod: grain(1.4), fat: 0.95 };
      const N = [-24, 24, -30, 38], M = [-56, 56, -56, 56], F = [-108, 108, -108, 108];
      tile(S, h, near, { x0: N[0], x1: N[1], z0: N[2], z1: N[3], res: 0.36 });
      const ring = (o, i, res, mat) => {
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: o[2], z1: i[2], res });
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: i[3], z1: o[3], res });
        tile(S, h, mat, { x0: o[0], x1: i[0], z0: i[2], z1: i[3], res });
        tile(S, h, mat, { x0: i[1], x1: o[1], z0: i[2], z1: i[3], res });
      };
      ring(M, N, 0.7, mid);
      ring(F, M, 2.0, out);
    }

    /* ---- small props ---- */
    // a gold fire bowl on a short stem; returns the top of the bowl
    const bowl = (x, y0, z, { s = 0.8, lit = true, k = 0.7, r = 4.2 } = {}) => {
      S.lathe([x, y0, z], 0.5, [0.26, 0.14], gold, { res: 0.07 });
      const b = S.ball([x, y0 + 0.72, z], [0.5, 0.28, 0.5], gold, { hold: true });
      const in_ = S.ball([x, y0 + 0.88, z], [0.42, 0.26, 0.42], gold, { hold: true });
      S.join('cut', b, in_, { res: 0.07 });
      if (lit) ctx.fire([x, y0 + 0.78, z], s, { k, r });
      return [x, y0 + 0.8, z];
    };
    // a column: a plinth, a shaft with entasis, a capital
    const column = (x, y0, z, { hgt = 3, r = 0.3, mat = marble, res = 0.08 } = {}) => {
      S.box([x, y0 + 0.12, z], [r * 1.45, 0.14, r * 1.45], mat, { rd: 0.03, res });
      S.lathe([x, y0 + 0.24, z], hgt - 0.52, t => r * (1 - 0.14 * t * t), mat, { res });
      S.lathe([x, y0 + hgt - 0.3, z], 0.14, [r * 0.95, r * 1.35], mat, { res });
      S.box([x, y0 + hgt - 0.08, z], [r * 1.5, 0.08, r * 1.5], mat, { rd: 0.02, res });
    };
    // a run of blocks from a to b with tops from ya to yb, each a step (for the stairs check: ctx.stair)
    const flight = (a, b, ya, yb, { width = 2.2, rise = 0.35, mat = drumM, low, record = true } = {}) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
      const n = Math.max(2, Math.ceil(Math.abs(yb - ya) / rise)), half = len / n / 2 + 0.04;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, top = ya + (yb - ya) * ((i + 1) / n);
        const lo = low ?? Math.min(h(x, z), top) - 0.5;
        S.box([x, (top + lo) / 2, z], [width / 2, (top - lo) / 2, half], mat, { ax: yawAx(yaw), rd: 0.05, res: 0.12 });
      }
      if (record) ctx.stair([a, b], width);
    };
    const octLoop = (ap, rot = 0) => [...Array(8)].map((_, k) => { const th = (45 * k) * DEG + rot, R = ap / C22; return [R * Math.sin(th), -R * Math.cos(th)]; });
    const FLAT = [[1, 0, 0], [0, 0, 1], [0, 1, 0]]; // an outline laid flat: x and z, pushed up y

    /* ---- the drum: an octagon with a round window in each face, a door in the south-south-east face, a cornice and corner pilasters ---- */
    {
      const wall = S.extrude([octLoop(DRUM.out), octLoop(DRUM.in)], [C[0], (0 + YF) / 2, C[1]], YF, drumM, { ax: FLAT, hold: true });
      const holes = [];
      for (let k = 0; k < 8; k++) {
        if (k === 1 || k === 3) continue; // the ramp covers the east-north-east face; the south-south-east face has the door
        const a = onFace(k, DRUM.in - 0.5, 0, 3.3), b = onFace(k, DRUM.out + 0.5, 0, 3.3);
        holes.push(S.tube([a, b], 0.82, 0.82, drumM, { hold: true }));
      }
      // the door: a box with a round head, 2.4 wide and 3.0 high
      const um = (DRUM.in + DRUM.out) / 2, F3 = [[TX[3], 0, TZ[3]], [0, 1, 0], [NX[3], 0, NZ[3]]];
      holes.push(S.box(onFace(3, um, 0, (0.5 + 3.3) / 2), [1.2, (3.3 - 0.5) / 2, 2.2], drumM, { hold: true, ax: F3 }));
      holes.push(S.tube([onFace(3, um - 2.2, 0, 3.3), onFace(3, um + 2.2, 0, 3.3)], 1.2, 1.2, drumM, { hold: true }));
      S.join('cut', wall, holes, { res: 0.21, inner: rb.slice(0, 2) });
      // the cornice: a band that stands proud round the top, so the drum's top edge reads heavy
      S.extrude([octLoop(DRUM.out + 0.35), octLoop(DRUM.out - 0.2)], [C[0], YF - 0.22, C[1]], 0.44, marble, { ax: FLAT, res: 0.17 });
      // a plinth band round the foot
      S.extrude([octLoop(DRUM.out + 0.3), octLoop(DRUM.out - 0.2)], [C[0], YG + 0.05, C[1]], 0.6, drumM, { ax: FLAT, res: 0.2 });
      // pilasters at the corners
      for (let k = 0; k < 8; k++) {
        const th = (45 * k) * DEG, [cx, cz] = dir(th), R = DRUM.out / C22 + 0.05;
        S.box([C[0] + cx * R, (YG + YF - 0.4) / 2, C[1] + cz * R], [0.55, (YF - 0.4 - YG) / 2, 0.4], marble, { ax: yawAx(th), rd: 0.05, res: 0.13 });
      }
      // fire bowls on corbels out of four faces of the drum's top
      for (const k of [0, 2, 4, 6]) {
        const p = onFace(k, DRUM.out + 0.55, 0, YF - 0.45), yaw = (22.5 + k * 45) * DEG;
        S.box(p, [0.5, 0.25, 0.55], marble, { ax: yawAx(Math.PI - yaw), rd: 0.05, res: 0.1 });
        bowl(p[0], YF - 0.2, p[2], { s: 0.75, k: 0.75, r: 4.6 });
      }
      // a frieze of round dark windows reads from far away; inside, two bowls light the coffers
      bowl(-4.4, YG, C[1] - 3.6, { s: 0.8, k: 0.9, r: 6 });
      bowl(4.6, YG, C[1] + 2.6, { s: 0.8, k: 0.9, r: 6 });
    }

    /* ---- the ramp: blocks up the east-north-east face of the drum, from the ground to the drum's top ---- */
    {
      const a = onFace(RAMP.face, RAMP.u, RAMP.t0, 0), b = onFace(RAMP.face, RAMP.u, RAMP.t1, 0);
      flight([a[0], a[2]], [b[0], b[2]], h(a[0], a[2]) + 0.05, YF, { width: RAMP.width, rise: RAMP.rise, mat: drumM });
    }

    /* ---- the outer shell: the eight sails, 0.7 thick, cut by the break ---- */
    const sideOf = k => [3, 4, 5].includes(k); // the faces whose back is seen through the break
    const outerSd = (x, y, z) => {
      const o = oct(x, z), f = sailF(o.m, y);
      let d = Math.max(Math.abs(f + SHELL.out / 2) - SHELL.out / 2, y - YR, YF - 0.4 - y);
      if (o.k === BK) d = Math.max(d, -cutDist(MO, o.t, y));
      return d;
    };
    // rows up the sail of face k: y from y0 to y1 at the surface's own spacing, the apothem at each row from fn(y)
    const rows = (k, y0, y1, res, fn, emit) => {
      for (let y = y0, r = 0; y < y1; y += res / sec(y) * 0.9, r++) {
        const u = fn(y), hw = Math.max(0, u * T22);
        for (let t = -hw + ((r % 2) * 0.5 + 0.25) * res; t < hw; t += res) emit(onFace(k, u, t, y), t, y);
      }
    };
    // the faces of the cut cells, across the shell from f0 to f1 (the cells' sides, where a cut cell meets one that is not cut)
    const cutFaces = (mask, f0, f1, res, emit) => {
      for (let j = CJ0; j <= CJ1; j++) for (let i = CI0; i <= CI1; i++) {
        if (!mask(i, j)) continue;
        const sides = [[i - 1, j, 'L'], [i + 1, j, 'R'], [i, j - 1, 'D'], [i, j + 1, 'U']];
        for (const [ii, jj, s] of sides) {
          if (mask(ii, jj)) continue;
          for (let a = res / 2; a < 1; a += res) for (let fz = f0; fz <= f1; fz += res) {
            const t = s === 'L' ? i : s === 'R' ? i + 1 : i + a, y = s === 'D' ? YF + j : s === 'U' ? YF + j + 1 : YF + j + a;
            const n = sailN(BK, y), base = onFace(BK, apo(y), t, y);
            emit(base[0] + n[0] * fz, base[1] + n[1] * fz, base[2] + n[2] * fz);
          }
        }
      }
    };
    const tileM = { r: br, g: warmBrick, mod: tiles, rf: (x, y, z) => { const o = oct(x, z); return o.k === BK && cutDist(MO, o.t, y) < 0.08 ? br.slice(0, 3) : null; } };
    S.add({
      bc: [C[0], (YF + YR) / 2, C[1]], br: Math.hypot(A0 / C22 + 1, (YR - YF) / 2 + 1),
      sd: outerSd,
      sample(f) {
        const res = this.res;
        for (let k = 0; k < 8; k++) {
          rows(k, YF - 0.3, YR, res, apo, p => f(p[0], p[1], p[2]));
          if (sideOf(k)) rows(k, YF - 0.3, YR - 1, res * 1.3, y => apo(y) - SHELL.out * sec(y), p => f(p[0], p[1], p[2]));
        }
        cutFaces(MO, -SHELL.out, 0, res, f);
      }
    }, tileM, { res: 0.16 });

    /* ---- the ribs: eight bands of white marble at the corners, 2.4 wide, 0.5 proud ---- */
    const ribSd = k => {
      const th = (45 * k) * DEG, [cx, cz] = dir(th), [sx, sz] = dir(th + Math.PI / 2);
      return (x, y, z) => {
        const dx = x - C[0], dz = z - C[1], q = dx * cx + dz * cz, s = dx * sx + dz * sz, yy = Math.min(YR, Math.max(YF, y));
        const g = Math.sqrt(1 + (apoD(yy) / C22) ** 2), qt = qTop(yy);
        return Math.max((q - qt) / g, Math.abs(s) - RIB.half, qt - RIB.deep - q, y - YR - 0.05, YF - 0.3 - y);
      };
    };
    for (let k = 0; k < 8; k++) {
      const th = (45 * k) * DEG, [cx, cz] = dir(th), [sx, sz] = dir(th + Math.PI / 2);
      S.add({
        bc: [C[0] + cx * 6, (YF + YR) / 2, C[1] + cz * 6], br: 9,
        sd: ribSd(k),
        sample(f) {
          const res = this.res;
          for (let y = YF - 0.2; y < YR; y += res / Math.sqrt(1 + (apoD(y) / C22) ** 2) * 0.9) {
            const qt = qTop(y);
            for (let s = -RIB.half + res / 2; s < RIB.half; s += res) f(C[0] + cx * qt + sx * s, y, C[1] + cz * qt + sz * s);
            for (const s of [-RIB.half, RIB.half]) for (let q = qt - 0.9; q <= qt; q += res) f(C[0] + cx * q + sx * s, y, C[1] + cz * q + sz * s);
          }
        }
      }, marble, { res: 0.15 });
    }

    /* ---- the rib stair, 20 steps of 0.4: the dome rises straight from the drum, so the first seven climb west along the drum's top on
       the south-south-east face, against the sail; a landing at the corner (step 8) turns west into the break, onto a floor across the gap
       between the shells; steps 9 to 20 climb the rib's top to the lantern ring ---- */
    {
      const [cx, cz] = dir(SR), [sx, sz] = dir(SR + Math.PI / 2), ax = [[sx, 0, sz], [0, 1, 0], [cx, 0, cz]];
      const at = (q, s, y) => [C[0] + cx * q + sx * s, y, C[1] + cz * q + sz * s];
      const stepM = { r: rb, g: [rb[2]], mod: coursed(0.4, 0.7) };
      const F4 = [[TX[3], 0, TZ[3]], [0, 1, 0], [NX[3], 0, NZ[3]]], TL = 3.0;
      for (let i = 1; i < STEP.landing; i++) {
        const top = YF + STEP.rise * i, ta = TL - (STEP.landing - i) * 0.5, tb = TL - (STEP.landing - 1 - i) * 0.5 + 0.05;
        const ui = apo(top) - 0.15, uo = DRUM.out, lo = YF - 0.3;
        S.box(onFace(3, (ui + uo) / 2, (ta + tb) / 2, (top + lo) / 2), [(tb - ta) / 2, (top - lo) / 2, (uo - ui) / 2], stepM, { ax: F4, rd: 0.04, res: 0.13 });
      }
      // the landing: a pier at the corner, its top at step 8
      {
        const q0 = 10.2, q1 = DRUM.out / C22 - 0.5, s0 = -1.1, s1 = 1.9, lo = YF - 0.3;
        S.box(at((q0 + q1) / 2, (s0 + s1) / 2, (YL + lo) / 2), [(s1 - s0) / 2, (YL - lo) / 2, (q1 - q0) / 2], stepM, { ax, rd: 0.05, res: 0.14 });
      }
      for (let i = STEP.landing + 1; i <= STEP.n; i++) {
        const top = YF + STEP.rise * i, q0 = SE[i + 1] - 0.1, q1 = SE[i];
        const lo = Math.max(YF - 0.3, ribY(q1) - 1.1);
        S.box(at((q0 + q1) / 2, 0, (top + lo) / 2), [1.0, (top - lo) / 2, (q1 - q0) / 2], stepM, { ax, rd: 0.04, res: 0.12 });
      }
      const foot = onFace(3, (apo(YF) + DRUM.out) / 2, TL - (STEP.landing - 1) * 0.5 - 0.3, YF), mid = at(11.4, -0.3, YL);
      ctx.stair([[foot[0], foot[2]], [mid[0], mid[2]], [C[0] + cx * (SE[STEP.n + 1] + 0.2), C[1] + cz * (SE[STEP.n + 1] + 0.2)]], 1.9);
      // the gallery floor: across the gap between the shells in the break, from the landing 4 m west, on the inner shell's back
      const uo = 10.3, ui = apo(YL) + FIB * sec(YL) - 0.1, hw = apo(YL) * T22;
      const t0 = -hw - 0.6, t1 = -hw + 4.4;
      S.box(onFace(BK, (uo + ui) / 2, (t0 + t1) / 2, YL - 0.16), [(t1 - t0) / 2, 0.16, (uo - ui) / 2], stepM, { ax: [[TX[BK], 0, TZ[BK]], [0, 1, 0], [NX[BK], 0, NZ[BK]]], rd: 0.04, res: 0.13 });
      // corbels under it, so it reads as built
      for (const t of [t0 + 2.2, t1 - 0.6]) S.box(onFace(BK, apo(YL) - 0.2, t, YL - 0.62), [0.3, 0.3, 0.45], marble, { ax: [[TX[BK], 0, TZ[BK]], [0, 1, 0], [NX[BK], 0, NZ[BK]]], rd: 0.04, res: 0.09 });
      // a fire bowl at the foot of the stair, on a corbel out of the south-south-east face
      const p = onFace(3, DRUM.out + 0.55, TL - STEP.landing * 0.5 - 0.6, YF - 0.45);
      S.box(p, [0.5, 0.25, 0.55], marble, { rd: 0.05, res: 0.1 });
      bowl(p[0], YF - 0.2, p[2], { s: 0.75, k: 0.75, r: 4.6 });
    }

    /* ---- the lantern on the ring: a marble floor, eight columns, a ribbed cap and a gold ball; the beacon in a gold bowl ---- */
    {
      const LH = 2.5; // the columns' height
      const cx = C[0], cz = C[1];
      S.lathe([cx, YR - 0.5, cz], 0.5, [3.0, 2.9], marble, { res: 0.13 });
      for (let k = 0; k < 8; k++) {
        const [x, z] = dir((22.5 + k * 45) * DEG);
        column(cx + x * 2.4, YR, cz + z * 2.4, { hgt: LH, r: 0.26, res: 0.1 });
      }
      S.lathe([cx, YR + LH, cz], 0.36, [2.85, 2.85], marble, { res: 0.13 });
      S.lathe([cx, YR + LH + 0.36, cz], 0.8, t => 2.5 * (1 - t) ** 1.4 + 0.3, { r: br, g: warmBrick, mod: tiles }, { res: 0.12 });
      for (let k = 0; k < 8; k++) {
        const th = (45 * k) * DEG, [x, z] = dir(th);
        S.tube([[cx + x * 2.55, YR + LH + 0.4, cz + z * 2.55], [cx + x * 1.3, YR + LH + 0.85, cz + z * 1.3], [cx + x * 0.3, YR + LH + 1.15, cz + z * 0.3]], 0.13, 0.08, marble, { res: 0.08 });
      }
      S.ball([cx, YR + LH + 1.45, cz], 0.36, gold, { res: 0.06 });
      S.lathe([cx, YR, cz], 0.3, [0.34, 0.26], gold, { res: 0.06 });
      const b = S.ball([cx, YR + 0.56, cz], [0.55, 0.28, 0.55], gold, { hold: true });
      const in_ = S.ball([cx, YR + 0.72, cz], [0.46, 0.26, 0.46], gold, { hold: true });
      S.join('cut', b, in_, { res: 0.06 });
      ctx.beacon([cx, YR + 0.8, cz], 1.6);
    }

    /* ---- the start: a fallen piece of the lantern, a flat octagon on the hill, with a ring cut in its top (the engrave join), and
       blocks down its north side to the path ---- */
    {
      const [x0, z0] = START, gy = h(x0, z0);
      // the top is a lantern floor of inlaid stone: sixteen sectors of lapis and dark marble, a gold band on the ring, a gold star in
      // the centre. The sides are the dark steps of the marble, so the slab does not fill the foreground with flat light grey
      const slabM = {
        ...drumM,
        rf: (x, y, z) => {
          if (y < YS - 0.1) return rb.slice(0, 3);
          const dx = x - x0, dz = z - z0, r = Math.hypot(dx, dz), a = Math.atan2(dx, dz) + Math.PI;
          if (r > 2.02 && r < 2.42) return gd.slice(0, 3);
          if (r < 0.62 * (1 - 0.35 * Math.abs(Math.cos(a * 4)))) return gd.slice(0, 3);
          if (r < 2.02 && r > 0.75) return Math.floor(a / (Math.PI / 8)) % 2 ? lp : rb.slice(0, 3);
          return null;
        }
      };
      const slab = S.extrude([octLoop(3.2 * C22, 0.2)], [x0, (YS + gy - 1.2) / 2, z0], YS - gy + 1.2, slabM, { ax: FLAT, hold: true, rd: 0.06 });
      const ring = S.torus([x0, YS, z0], 2.2, 0.01, slabM, { hold: true });
      S.join('engrave', slab, ring, { r: 0.16, res: 0.15 });
      // a column stump and a fallen drum of a column on the slab, toward the back
      column(x0 + 2.0, YS, z0 + 1.1, { hgt: 1.3, r: 0.34, res: 0.09 });
      S.tube([[x0 - 2.2, YS + 0.36, z0 + 1.4], [x0 - 0.9, YS + 0.36, z0 + 2.2]], 0.36, 0.34, marble, { res: 0.09 });
      // the blocks down the north side: each 0.45 lower, until the hill
      let top = YS - 0.45, z = z0 - 3.0;
      for (let i = 0; i < 8 && top > h(x0, z - 0.4) + 0.15; i++, top -= 0.45, z -= 0.85) {
        const lo = h(x0, z) - 0.5;
        S.box([x0 + 0.1 * Math.sin(i * 1.7), (top + lo) / 2, z], [1.25 - 0.04 * i, (top - lo) / 2, 0.5], drumM, { ax: yawAx(0.06 * Math.sin(i * 2.3)), rd: 0.05, res: 0.12 });
      }
      bowl(x0 + 2.2, YS, z0 - 1.6, { s: 0.75, k: 0.8, r: 4.4 });
      ctx.spawn([x0, YS + 0.02, z0], Math.PI);
    }

    /* ---- the valley: fallen coffers (square frames), fallen tiles, a fallen capital, a broken loggia ---- */
    {
      // a fallen coffer: a square frame 1.6 m, tilted and half in the ground, lapis with a gold boss
      const coffer = (x, z, yaw, tilt, sink = 0.35) => {
        const y = h(x, z) - sink, A = yawAx(yaw), R = [[1, 0, 0], [0, Math.cos(tilt), Math.sin(tilt)], [0, -Math.sin(tilt), Math.cos(tilt)]];
        const ax = R.map(r => [0, 1, 2].map(c => r[0] * A[0][c] + r[1] * A[1][c] + r[2] * A[2][c]));
        const P = (a, b, c) => [x + ax[0][0] * a + ax[1][0] * b + ax[2][0] * c, y + ax[0][1] * a + ax[1][1] * b + ax[2][1] * c, z + ax[0][2] * a + ax[1][2] * b + ax[2][2] * c];
        for (const [a, c, hx, hz] of [[0, 0.66, 0.8, 0.14], [0, -0.66, 0.8, 0.14], [0.66, 0, 0.14, 0.52], [-0.66, 0, 0.14, 0.52]])
          S.box(P(a, 0.18, c), [hx, 0.18, hz], lapis, { ax, rd: 0.03, res: 0.1 });
        S.box(P(0, 0.03, 0), [0.56, 0.05, 0.56], { r: lp.slice(0, 2) }, { ax, res: 0.12 });
        ctx.glow(() => { const p = P(0, 0.12, 0); B.iso(p[0], p[1], p[2], 0.1, B.P[gd[3]], 3, { em: true, nd: true }); B.iso(p[0], p[1], p[2], 0.2, B.P[gd[1]], 1.2, { em: true, nd: true }); });
      };
      for (const [x, z, yaw, tilt] of [[-4.6, 14.2, 0.4, 0.35], [4.2, 15.6, -0.3, -0.28], [-3.4, 7.2, 1.1, 0.5], [3.6, 5.6, 0.2, -0.2], [-7.4, 11, -0.5, 0.25], [8.6, 13.2, 0.8, 0.4], [-6.4, 3.6, 0.3, -0.45]])
        coffer(x, z, yaw, tilt);
      // fallen tiles from the dome, thin slabs scattered off the path
      for (let i = 0; i < 16; i++) {
        const a = B.rr(0, Math.PI * 2), r = B.rr(2.2, 8.5), x = Math.cos(a) * r * 1.1, z = 10 + Math.sin(a) * r * 0.8;
        if (h.pathDist(x, z) < 0.6) continue;
        S.box([x, h(x, z) + 0.02, z], [B.rr(0.35, 0.55), 0.08, B.rr(0.25, 0.4)], { r: br.slice(0, 3), mod: tiles }, { ax: yawAx(B.rr(0, 3)), rd: 0.02, res: 0.12 });
      }
      // the fallen capital: a wide marble block on its side, reached by two fallen blocks, each 0.45 higher
      {
        const [x, z] = [6, 10], g = h(x, z), top = g + 1.35;
        S.box([x, (top + g - 0.4) / 2, z], [0.9, (top - g + 0.4) / 2, 0.9], marble, { ax: yawAx(0.3), rd: 0.12, res: 0.1 });
        S.lathe([x, top, z], 0.22, [0.85, 0.55], marble, { ax: yawAx(0.3), res: 0.09 });
        for (const [dx, k] of [[-2.0, 1], [-1.2, 2]]) {
          const bx = x + dx, by = h(bx, z) + 0.45 * k;
          S.box([bx, (by + h(bx, z) - 0.4) / 2, z + 0.1], [0.42, (by - h(bx, z) + 0.4) / 2, 0.6], drumM, { ax: yawAx(0.1 * k), rd: 0.05, res: 0.1 });
        }
        ctx.wisp([x, h(x, z) + 2.2, z]);
      }
      // a broken loggia west of the path: two columns and the fragment of a round arch between them
      {
        const x = -5.6, z = 17.4, g = h(x, z) - 0.1;
        column(x - 1.6, g, z, { hgt: 3.2, r: 0.3 });
        column(x + 1.6, g, z - 0.3, { hgt: 2.4, r: 0.3 });
        S.box([x - 1.0, g + 3.4, z], [0.9, 0.22, 0.36], marble, { ax: yawAx(0.1), rd: 0.05, res: 0.1 });
        S.box([x + 2.6, h(x + 2.6, z + 1) + 0.25, z + 1], [0.32, 0.32, 1.2], marble, { ax: yawAx(0.7), rd: 0.08, res: 0.1 });
      }
      // three floating tiles west of the path, each 0.45 higher, with gaps of 0.75: a wisp over the last
      {
        const z = 8;
        let top = h(-10.5, z) + 0.45;
        for (const x of [-10.5, -12.25, -14.0]) {
          S.box([x, top - 0.14, z], [0.5, 0.14, 0.55], { r: br.slice(1), mod: tiles }, { rd: 0.03, res: 0.09 });
          ctx.glow(() => { for (let a = 0; a < 12; a++) { const u = (a / 12) * Math.PI * 2; B.iso(x + Math.cos(u) * 0.55, top - 0.3, z + Math.sin(u) * 0.6, 0.045, B.P[ne[1]], 3, { em: true, nd: true }); } });
          if (x > -14) top += 0.45;
        }
        ctx.wisp([-14.0, top + 1.6, z]);
      }
    }

    /* ---- the far skyline of an ideal city: small domes, towers and a campanile, black on the fog, much too small for the dome ---- */
    {
      const at = (az, r) => { const [x, z] = dir(az * DEG); return [x * r, z * r]; };
      const domeAt = (az, r, R) => {
        const [x, z] = at(az, r), g = h(x, z);
        S.box([x, g + R * 0.5, z], [R * 1.1, R * 0.9, R * 1.1], far, { res: 0.3 });
        S.lathe([x, g + R * 1.3, z], R * 1.2, t => R * Math.sqrt(Math.max(0, 1 - t * t)) + 0.1, far, { res: 0.3 });
      };
      const towerAt = (az, r, w, tall) => {
        const [x, z] = at(az, r), g = h(x, z);
        S.box([x, g + tall / 2, z], [w, tall / 2 + 0.5, w], far, { res: 0.3 });
        S.lathe([x, g + tall + 0.5, z], w * 2.2, [w * 1.1, 0.1], far, { res: 0.3 });
      };
      domeAt(22, 78, 1.6); towerAt(27, 76, 0.5, 4.5); domeAt(32, 82, 1.1); towerAt(37, 78, 0.4, 3); towerAt(17, 84, 0.6, 7); domeAt(43, 76, 0.9);
      domeAt(-24, 80, 1.4); towerAt(-29, 77, 0.45, 4); towerAt(-19, 86, 0.6, 7.5); domeAt(-34, 82, 1.0); towerAt(-39, 76, 0.4, 2.8);
    }

    /* ---- what does not block the feet: the inner shell (and its coffers), and the floating blocks ---- */
    ctx.later(() => {
      // the inner shell, 0.9 thick, 1.4 inside the outer; coffers cut into its inner face; a smaller hole of the break
      const innerSd = (x, y, z) => {
        const o = oct(x, z), f = sailF(o.m, y);
        let d = Math.max(Math.abs(f - (FIB + FIN) / 2) - SHELL.inner / 2, y - YI, YB - y);
        if (o.k === BK) d = Math.max(d, -cutDist(MI, o.t, y));
        const c = cofferAt(o.t, sOf(y));
        if (c) d = Math.max(d, -Math.max(Math.abs(o.t - c.tc) - c.hs, Math.abs(sOf(y) - c.sc) - c.hs, FIN + COFFER.depth - f));
        return d;
      };
      const inner = {
        r: rb.slice(0, 3), g: [rb[1]], mod: veins(0.6),
        rf: (x, y, z) => {
          const o = oct(x, z), f = sailF(o.m, y);
          if (f > FIN + COFFER.depth - 0.06 && f < FIB - 0.2) { const c = cofferAt(o.t, sOf(y)); if (c && Math.abs(o.t - c.tc) < c.hs - 0.04 && Math.abs(sOf(y) - c.sc) < c.hs - 0.04) return lp; }
          return null;
        }
      };
      const inFace = y => apo(y) + FIN * sec(y), back = y => apo(y) + FIB * sec(y);
      S.add({
        bc: [C[0], (YB + YI) / 2, C[1]], br: Math.hypot(A0 / C22, (YI - YB) / 2 + 1),
        sd: innerSd,
        sample(f) {
          const res = this.res;
          for (let k = 0; k < 8; k++) {
            rows(k, YB, YI, res, inFace, (p, t, y) => { const c = cofferAt(t, sOf(y)); if (!c || Math.abs(t - c.tc) > c.hs || Math.abs(sOf(y) - c.sc) > c.hs) f(p[0], p[1], p[2]); });
            if (sideOf(k)) rows(k, YB, YI, res * 1.2, back, p => f(p[0], p[1], p[2]));
            // the coffers: the back of each recess and its four sides
            for (const r of ROWS) for (let c = 0; c < r.n; c++) {
              const tc = (c - (r.n - 1) / 2) * r.pitch, hs = r.size / 2;
              for (let a = -hs + res / 2; a < hs; a += res) for (let b = -hs + res / 2; b < hs; b += res) {
                const y = yOf(r.sc + b), n = sailN(k, y), p = onFace(k, inFace(y), tc + a, y), dd = COFFER.depth;
                f(p[0] + n[0] * dd, p[1] + n[1] * dd, p[2] + n[2] * dd);
                if (Math.abs(a) > hs - res || Math.abs(b) > hs - res) f(p[0] + n[0] * dd * 0.5, p[1] + n[1] * dd * 0.5, p[2] + n[2] * dd * 0.5);
              }
            }
          }
          cutFaces(MI, FIN, FIB, res, f);
          // the foot: its underside
          for (let k = 0; k < 8; k++) for (let fz = FIN; fz <= FIB; fz += res) {
            const n = sailN(k, YB), u = apo(YB), hw = (u + fz) * T22;
            for (let t = -hw; t < hw; t += res) { const p = onFace(k, u + fz, t, YB); f(p[0], p[1], p[2]); }
          }
        }
      }, inner, { res: 0.2 });

      // the floating blocks: the cut cells of the sail, drifting up and out along its normal, more with height, smaller far away
      const cells = [];
      for (let j = CJ0; j <= CJ1; j++) for (let i = CI0; i <= CI1; i++) if (MO(i, j)) cells.push([i + 0.5, YF + j + 0.5]);
      const out = [NX[BK], 0, NZ[BK]], side = [TX[BK], 0, TZ[BK]];
      // the drift: out along the sail and round toward the west, so from the start the cloud streams away to the left of the hole
      const drift = B.norm([out[0] + side[0] * 0.6, 0, out[2] + side[2] * 0.6]);
      const rot = (ax, a) => { // a rotation matrix (rows) about the unit axis ax by a
        const [x, y, z] = ax, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
        return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
      };
      const blocks = [];
      // the cells on the hole's edge: their blocks have only just lifted
      const edge = cells.filter(([tc, yc]) => { const i = Math.floor(tc), j = Math.floor(yc - YF); return (!MO(i - 1, j) || !MO(i + 1, j) || !MO(i, j + 1)) && !(tc > -4.6 && tc < 1.2 && yc > 6.5); });
      const N = 124;
      for (let b = 0; b < N; b++) {
        const near = b < 14, src = near ? edge : cells, [tc, yc] = src[Math.floor(B.rr(0, src.length))], hf = (yc - YF) / 6;
        // s: how far along the drift, 0 at the sail, 1 at the far end of the cloud (14 m out, 9 m up); more drift from higher cells
        const s = near ? B.rr(0.0, 0.05) : Math.min(1, 0.16 + 0.84 * B.rr(0, 1) ** 0.9 * (0.8 + 0.3 * hf));
        const base = onFace(BK, apo(yc) - 0.35 * sec(yc), tc, yc);
        const d = near ? B.rr(0.5, 1.3) : 3.2 + 10.8 * s, up = near ? B.rr(0.1, 0.5) : 9 * s ** 1.1, sp = near ? 0.1 : 0.3 + 2.6 * s;
        const D = near ? out : drift, L = near ? side : [-drift[2], 0, drift[0]];
        const p = [base[0] + D[0] * d + L[0] * B.rr(-1, 1) * sp, base[1] + up + B.rr(-0.5, 0.5) * sp, base[2] + D[2] * d + L[2] * B.rr(-1, 1) * sp];
        const size = near ? 0.92 : 0.9 * (1 - 0.6 * s) * B.rr(0.8, 1.1);
        const axv = B.norm([B.rr(-1, 1), B.rr(-1, 1), B.rr(-1, 1)]), R = near ? rot(axv, B.rr(0.1, 0.3)) : rot(axv, B.rr(0, 1) * (0.3 + 2.4 * s));
        // far out, a block is only its edges: the stone turns into a wire cube as it drifts (drawn in the glow below)
        const wire = !near && s > 0.55;
        blocks.push({ p, size, R, s, wire });
        if (wire) continue;
        const glowB = !near && b % 13 === 5; // a few small blocks are pure light: the pixels of the dissolve
        const sz = glowB ? size * 0.45 : size;
        S.box(p, [sz / 2, sz / 2, sz * 0.36], glowB ? neon : { r: br.slice(1), g: warmBrick, mod: tiles }, { ax: R, rd: 0.03, res: Math.max(0.12, 0.16 * size + 0.04) });
      }
      ctx.cloud = blocks;
    });

    /* ---- the start, the wisps ---- */
    ctx.wisp([-3, YG + 1.1, -10]); // inside the drum, under the break
    ctx.wisp([-12.0, YF + 1.1, -12]); // on the drum's top, west side
    {
      // at the end of the gallery between the shells
      ctx.wisp([-4, YL + 1.1, -6]);
    }

    /* ---- what glows: the rim of the break, the ghost of the missing sail, the coffers' rosettes, the grid on the drum floor, the wire
       icosahedron over the start, the sky ---- */
    ctx.glow(({ B }) => {
      const dab = (p, s, c, a = 3) => B.iso(p[0], p[1], p[2], s, B.P[c], a, { em: true, nd: true });
      // the rim: dots along each edge where a cut cell of the outer shell meets one that is not cut
      for (let j = CJ0; j <= CJ1; j++) for (let i = CI0; i <= CI1; i++) {
        if (!MO(i, j)) continue;
        for (const [ii, jj, s] of [[i - 1, j, 'L'], [i + 1, j, 'R'], [i, j - 1, 'D'], [i, j + 1, 'U']]) {
          if (MO(ii, jj)) continue;
          const y0 = YF + j;
          if (s === 'D' && y0 < YF + 0.1) continue;
          for (let a = 0.1; a < 1; a += 0.2) {
            const t = s === 'L' ? i : s === 'R' ? i + 1 : i + a, y = s === 'D' ? y0 : s === 'U' ? y0 + 1 : y0 + a;
            if (Math.abs(t) > apo(y) * T22 - 0.3) continue;
            const p = onFace(BK, apo(y) + 0.06, t, y);
            dab(p, 0.07, ne[2]);
          }
        }
      }
      // a soft magenta light inside the break, so the hole reads from the start as a glow, not as a dark gap
      for (let j = CJ0; j <= CJ1; j++) for (let i = CI0; i <= CI1; i++) {
        if (!MO(i, j) || (i + j) % 2) continue;
        const y = YF + j + 0.5, p = onFace(BK, apo(y) - 1.4 * sec(y), i + 0.5, y);
        dab(p, 0.55, ne[0], 0.35);
      }
      // the ghost sail: five meridians and four parallels of the missing sail, where it is cut
      for (let m = 0; m < 5; m++) for (let y = YF + 0.3; y < 11; y += 0.14) {
        const hw = apo(y) * T22, t = -hw + (m + 1) * (2 * hw) / 6;
        const o = Math.floor(t), j = Math.floor(y - YF);
        if (!MO(o, j)) continue;
        dab(onFace(BK, apo(y), t, y), 0.045, ne[1]);
      }
      for (const y of [6.2, 7.6, 9.0, 10.3]) {
        const hw = apo(y) * T22;
        for (let t = -hw; t < hw; t += 0.14) { if (!MO(Math.floor(t), Math.floor(y - YF))) continue; dab(onFace(BK, apo(y), t, y), 0.045, ne[1]); }
      }
      // the rosettes: a gold dot in the centre of every coffer
      for (let k = 0; k < 8; k++) for (const r of ROWS) for (let c = 0; c < r.n; c++) {
        const tc = (c - (r.n - 1) / 2) * r.pitch, y = r.yc, n = sailN(k, y), p = onFace(k, apo(y) + FIN * sec(y), tc, y);
        // near the mouth of the recess, so its back does not cut the dot into a crescent
        const q = [p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03];
        dab(q, 0.06 * r.size, gd[3]);
        dab(q, 0.1 * r.size, gd[2], 1.2);
      }
      // the grid on the drum floor: magenta lines every 1.5 m, darker away from the centre
      // (the dots sit 0.1 over the floor, so the ground's splats do not cut them into dashes)
      for (let g = -6; g <= 6; g++) for (let v = -9.3; v <= 9.3; v += 0.11) for (const [x, z] of [[g * 1.5, v], [v, g * 1.5]]) {
        const X = C[0] + x, Z = C[1] + z, m = oct(X, Z).m;
        if (m > DRUM.in - 0.3) continue;
        dab([X, YG + 0.1, Z], 0.05, m < 5 ? ne[2] : m < 7.5 ? ne[1] : ne[0], 2.5);
      }
      // the wire icosahedron that floats over the start: the edges of the solid, drawn in dots (Leonardo's solid edges)
      {
        const phi = (1 + Math.sqrt(5)) / 2, V = [], R = 0.95, c = [7.0, YS + 1.2, START[1] - 6.2]; // right of the dome, under the moon
        for (const a of [-1, 1]) for (const b of [-1, 1]) V.push([0, a, b * phi], [a, b * phi, 0], [b * phi, 0, a]);
        const sc = R / Math.hypot(1, phi), tw = 0.5;
        const P = V.map(([x, y, z]) => [c[0] + (x * Math.cos(tw) + z * Math.sin(tw)) * sc, c[1] + y * sc, c[2] + (-x * Math.sin(tw) + z * Math.cos(tw)) * sc]);
        for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) {
          if (Math.abs(Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1], V[a][2] - V[b][2]) - 2) > 0.01) continue;
          for (let t = 0; t <= 1; t += 0.1) dab([P[a][0] + (P[b][0] - P[a][0]) * t, P[a][1] + (P[b][1] - P[a][1]) * t, P[a][2] + (P[b][2] - P[a][2]) * t], 0.03, ne[2], 2.4);
        }
        for (const p of P) dab(p, 0.06, gd[3]);
      }
      // the floating blocks: wire edges on the far ones, magenta corners on the middle ones; motes round the cloud
      for (const bl of ctx.cloud || []) {
        const e = bl.size / 2, at = v => [bl.p[0] + bl.R[0][0] * v[0] + bl.R[0][1] * v[1] + bl.R[0][2] * v[2], bl.p[1] + bl.R[1][0] * v[0] + bl.R[1][1] * v[1] + bl.R[1][2] * v[2], bl.p[2] + bl.R[2][0] * v[0] + bl.R[2][1] * v[1] + bl.R[2][2] * v[2]];
        if (bl.wire) {
          // the twelve edges of the box: from each corner, along each axis where the corner is on the low side
          const E = [e, e, e * 0.72], c = bl.s > 0.8 ? ne[0] : ne[1]; // darker as they go, so the far end fades into the sky
          for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) for (let ax = 0; ax < 3; ax++) {
            const v0 = [sx * E[0], sy * E[1], sz * E[2]];
            if (v0[ax] > 0) continue;
            const n = Math.max(3, Math.ceil((2 * E[ax]) / 0.11));
            for (let i = 0; i <= n; i++) { const v = v0.slice(); v[ax] += (2 * E[ax] * i) / n; dab(at(v), 0.028, c, 2.4); }
          }
          continue;
        }
        if (bl.s < 0.2) continue;
        for (const [a, b] of [[1, 1], [-1, 1]]) {
          const v = [a * e, b * e, e * 0.72];
          dab(at(v), 0.035, ne[2], 2.4);
        }
      }
      {
        const far = (ctx.cloud || []).filter(b => b.s > 0.3), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
        for (const b of far) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b.p[i]); hi[i] = Math.max(hi[i], b.p[i]); }
        if (far.length) lib.motes(B, 40, [lo[0] - 1, hi[0] + 1, lo[1] - 1, hi[1] + 1, lo[2] - 1, hi[2] + 1], [ne[0], ne[1]], 0.025);
      }

      /* the sky: four bands of plum to magenta, the lowest in the north behind the dome, soft edges (sfumato); a pale moon low in the
         north-east with a magenta halo; stars */
      const sk = ramp('skyband'), dk = ramp('sky')[0], rbm = ramp('rib');
      const eye = [START[0], YS + EYE_UP, START[1] + EYE_BACK];
      const band = (d, jit) => {
        const nf = Math.max(0, -d[2]), v = d[1] - 0.07 * nf + jit;
        return v < 0.02 && nf > 0.35 ? sk[3] : v < 0.08 ? sk[2] : v < 0.17 ? sk[1] : v < 0.3 ? sk[0] : dk;
      };
      B.sky(d => band(d, 0), 230);
      const dirv = (a, e) => [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
      // close rows of soft splats near the horizon, each with a jittered band, so the steps dither into each other
      for (let i = -60; i <= 60; i++) for (let j = 0; j < 14; j++) {
        const a = i * 0.033 + B.rr(-0.01, 0.01), e = -0.06 + j * 0.022 + B.rr(-0.006, 0.006), d = dirv(a, e), R = 180;
        const c = band(d, B.rr(-0.028, 0.028));
        if (c === dk) continue;
        B.iso(eye[0] + d[0] * R, eye[1] + d[1] * R, eye[2] + d[2] * R, 4.4, B.P[c], 2.0, { em: true, nd: true });
      }
      // the moon, its seas, and a soft halo of magenta round it
      {
        const az = 23 * DEG, el = -0.6 * DEG, mr = 1.9 * DEG, D = 170, rm = D * Math.tan(mr), u = dirv(az, el);
        const M = [eye[0] + u[0] * D, eye[1] + u[1] * D, eye[2] + u[2] * D];
        for (let i = -26; i <= 26; i++) for (let j = -16; j <= 16; j++) {
          const a = az + i * 0.012, e = el + j * 0.012, dm = Math.hypot((a - az) * Math.cos(el), e - el) / mr;
          if (dm < 1.15 || dm > 4.2) continue;
          const c = dm < 2.0 ? ne[0] : dm < 3.0 ? sk[3] : sk[2];
          if (dm > 3.0 && B.rr(0, 1) < 0.5) continue;
          const p = dirv(a, e), R = 176;
          B.iso(eye[0] + p[0] * R, eye[1] + p[1] * R, eye[2] + p[2] * R, 2.4, B.P[c], 2.0, { em: true, nd: true });
        }
        const rt = B.norm([-u[2], 0, u[0]]), up = [rt[1] * u[2] - rt[2] * u[1], rt[2] * u[0] - rt[0] * u[2], rt[0] * u[1] - rt[1] * u[0]];
        const sp = rm * 0.16;
        for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
          const a = (i + (j % 2) * 0.5) * sp, b = j * sp * 0.87;
          if (a * a + b * b > rm * rm * 0.92) continue;
          const sea = B.n3(a / rm * 1.7 + 2, b / rm * 1.7 + 5, 3) > 0.57 || (a - rm * 0.25) ** 2 + (b + rm * 0.2) ** 2 < (rm * 0.3) ** 2;
          B.iso(M[0] + rt[0] * a + up[0] * b, M[1] + rt[1] * a + up[1] * b, M[2] + rt[2] * a + up[2] * b, sp * 0.6, B.P[sea ? rbm[2] : rbm[3]], 3, { em: true, nd: true });
        }
      }
      for (let i = 0; i < 60; i++) {
        const a = B.rr(0, Math.PI * 2), e = B.rr(0.22, 1.25), r = 195;
        B.iso(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, B.rr(0.25, 0.45), B.P[B.pick([sk[3], rbm[3], ne[1]])], 3, { em: true, nd: true });
      }
      lib.motes(B, 40, [-20, 20, 1, 8, -6, 22], [sk[2], sk[3]], 0.03);
    });
  }
};
