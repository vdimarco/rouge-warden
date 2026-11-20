// The Bell Knoll: a bronze bell tower on a round knoll at a blood-red dusk. You stand on the lip of a hill to the south and look down
// across a low vale at the knoll. It climbs in two grass terraces to a stepped stone plinth, and on the plinth stands an octagonal tower
// with an open belfry, one huge bell in it, a parapet and a plain slate roof. The sun sits level with the bell, a little left of the
// tower: the belfry's arch opens on its hot heart, so the bell hangs black in it, and the tower stands black against the rest. Giant
// bronze cogs lie half sunk in the slopes: one stands like a gate on the path up, one great spoked wheel rises out of the knoll's west
// side, and one lies tilted on the east hill so its rim makes a path. A fallen cracked bell lies at the knoll's foot, a broken clock face
// lies on the west hill, a small bell lies tipped by the start with a fire in its mouth, the crown of a buried bell and a fallen pendulum
// frame wait out on the flanks, and pendulum frames and rusted chains stand about. Maroon sky, violet shadow, rust-brown grass, dark old
// bronze worn to brass, and fire.
//
// The follow camera looks down at a low pitch, so the top of its first picture is a little under its eye (the page: start + 4.0, and
// half a degree down). Anything higher is cut off. The beacon must stand 2 above the start, so the spire can rise only about 1.3 over
// the beacon's bowl. So the start stands high on a hill whose lip falls away at your feet, the spire is kept squat enough that its
// finial and the sun's top edge sit just inside the page's first picture, and the beacon is raised on a stepped altar at its foot.
import { rocks, shrubs, yawAx } from '../lib/props.mjs';
import { lib, polyDist, tile } from '../lib/common.mjs';

// heights
const YS = 6.9; // the start
const T1 = 2.3, T2 = 3.6; // the knoll's two grass terraces
const F = YS - 2.4; // the stone terrace round the spire
const START = [0, 27];
const C = [-1, -9]; // the spire
const AP = { step: 6.4, deck: 5.9, drum: 2.2 }; // apothems of the plinth's lower step, the terrace, the spire's drum
const R1 = 12.4, R2 = 9.0; // radii of the grass terraces
// the walked line: down off the start hill, across the vale, up the south-east slope through the cog gate, round the first terrace.
// It starts just behind you, so the ground under the first picture is grass and not a slab of path.
const PATH = [[0, 28.4], [0, 27], [-0.4, 22.5], [0.2, 18], [1.2, 14], [1.6, 10], [3.0, 6.8], [5.0, 4.0], [6.5, 1.4], [8.2, -1.6], [9.6, -5.2], [10.2, -9]];
// round the second terrace from the east stair to the plinth stair
const PATH2 = [[6.4, -9], [5.4, -4.4], [2.4, -1.8], [-1.6, -1.2], [-4.6, -2.6]];
// a side path east from the vale to the tilted cog on the east hill
const SPUR = [[2.2, 9.2], [5.4, 8.8], [7.2, 7.0]];
const GATE = [6.5, 1.4]; // the cog gate
const WHEEL = [-9.8, 0.4]; // the great wheel on the knoll's west side
const EAST = [16.2, 0.2]; // the lookout on the east hill
const CLOCK = [-13.5, 8.5]; // the clock face on the west hill
const FALLEN = [-5.0, 6.6]; // the fallen bell at the knoll's foot, under the spire as the start sees it
// the start camera's eye (preview: 9 back, pitch 0.3), to hang the sun by the spire
const EYE = [START[0], YS + 1 + 9 * Math.sin(0.3), START[1] + 9 * Math.cos(0.3)];

/* ---------------- small vector helpers ---------------- */
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
// a frame [U, V, W] whose W is the given direction and whose V is as near up as it can be (for S.extrude: the outline lies in U, V)
const frameW = w => {
  const W = norm(w), up = Math.abs(W[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
  const U = norm(cross(up, W)), V = cross(W, U);
  return [U, V, W];
};
// a frame whose second axis is the given direction (for S.lathe and S.torus, whose axis is the frame's y)
const frameY = b => {
  const B = norm(b), ref = Math.abs(B[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const A = norm(cross(B, ref)), Cc = cross(A, B);
  return [A, B, Cc];
};
const FLAT = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]; // an outline laid flat on the ground, extruded up
const octLoop = (ap, rot = 0) => {
  const rc = ap / Math.cos(Math.PI / 8), L = [];
  for (let k = 0; k < 8; k++) { const a = rot + Math.PI / 8 + (k * Math.PI) / 4; L.push([Math.cos(a) * rc, Math.sin(a) * rc]); }
  return L;
};
// a cog's outline: square teeth round a rim, then a hole, or windows between spokes. In the outline's own plane (u, v).
function gearLoops({ R, Ri, n, th, tw = 0.5, spokes = 0, hub = 1, sw = 0.7, skip = [] }) {
  const pt = (r, a) => [Math.cos(a) * r, Math.sin(a) * r], P = (Math.PI * 2) / n, out = [];
  for (let k = 0; k < n; k++) {
    const a = k * P, hr = (P * tw) / 2;
    if (skip.includes(k)) out.push(pt(R, a - hr), pt(R, a + hr));
    else out.push(pt(R, a - hr), pt(R + th, a - hr * 0.72), pt(R + th, a + hr * 0.72), pt(R, a + hr));
    for (let s = 1; s < 3; s++) out.push(pt(R, a + hr + ((P - 2 * hr) * s) / 3));
  }
  const loops = [out];
  if (!spokes) {
    const m = Math.max(16, Math.round(Ri * 6)), hole = [];
    for (let i = 0; i < m; i++) hole.push(pt(Ri, (i / m) * Math.PI * 2));
    loops.push(hole);
  } else {
    const Q = (Math.PI * 2) / spokes, d = r => Math.asin(Math.min(0.9, sw / 2 / r));
    for (let j = 0; j < spokes; j++) {
      const a1 = j * Q + Q * 0.25, a2 = a1 + Q, w = [], m = 8;
      for (let i = 0; i <= m; i++) w.push(pt(Ri, a1 + d(Ri) + ((a2 - a1 - 2 * d(Ri)) * i) / m));
      for (let i = 0; i <= 3; i++) w.push(pt(hub, a2 - d(hub) - ((a2 - a1 - 2 * d(hub)) * i) / 3));
      loops.push(w);
    }
  }
  return loops;
}
// a bell's outline: radius (as a part of the mouth's) from the mouth (t 0) to the crown (t 1). A wide lip, a waist, a round crown.
const bellR = t => (t <= 0.86 ? 0.52 + 0.48 * Math.pow(1 - t / 0.86, 2.4) : 0.52 * Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)));

export default {
  id: 'bells',
  name: 'The Bell Knoll',
  sub: 'A bronze bell on a hill of sunk cogs, at a blood-red dusk',
  hint: 'Climb the knoll to the bell. Light the beacon.',
  seed: 31,
  palette: [
    ['sky', [0x07030a]],
    ['skyband', [0x15060e, 0x2c0a12, 0x521117, 0x84201a]],
    ['fog', [0x250b13]],
    ['ink', [0x040205]],
    ['shade', [0x060308]],
    ['grass', [0x0a0505, 0x150a08, 0x21100b, 0x2f170e, 0x41200f]],
    ['stone', [0x0b0811, 0x17111e, 0x251b2f, 0x382a43, 0x4f3c59]],
    ['lit', [0x45171a, 0x702521, 0x9c3b29]],
    // bronze: a dark old-bronze umber in its shadow (darker and less red than the grass, so a cog stands off the hill as a shape), copper
    // where light reaches it, brass only at the top
    ['bronze', [0x130d0b, 0x2a1e0e, 0x6a4419, 0x9e6224, 0xcc9238, 0xf0c868]],
    ['verd', [0x141c1a, 0x22302b]],
    ['rust', [0x1a0a07, 0x3a1709, 0x5c2a12]]
  ],
  // the key light is a low red sun from the north-west, so the faces turned to it go red and the rest stays violet; the sun you see
  // sits a little west of north, by the spire (the light is set for form, not to match it exactly)
  light: { sun: [-0.55, 0.3, -0.78], amb: 0.11, sky: 0.15, sunK: 0.55, shK: 7 },
  fog: { color: 'fog', far: 72, start: 0.5, max: 0.88 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 34 },
  hills: {
    base: 0.6,
    bumps: [
      [0, 33, 13, 6.3], // the start's hill
      [C[0], C[1], 16, 2.6], // the knoll
      [19, 1, 11, 3.6], // the east hill
      [-19, 7, 11, 3.0], // the west hill
      [-22, -10, 9, 2.4], [23, -13, 9, 2.6], // rolls either side of the knoll
      [-15, 26, 10, 3.0], [17, 25, 10, 3.4], // either side of the start
      [-12, -27, 8, 1.6], [13, -26, 8, 1.4], // low rolls behind the knoll
      [-50, -22, 22, 7], [52, -16, 22, 8], // far hills either side
      [0, -90, 64, -16] // the land falls away north, so the spire and the sun stand against the sky
    ],
    fbm: { amp: 0.45, freq: 1 / 11, oct: 3 },
    warp: { amp: 2.5, freq: 1 / 22 },
    far: { amp: 9, start: 40, end: 66 },
    // the vale; and a deep valley north of the knoll, so the land behind the spire drops below its plinth and the sun shows whole
    pits: [[0, 12, 9, 0.6], [0, -95, 50, 16]],
    flats: [
      // the start's hilltop: it runs back behind you, and its lip is at your feet, so the first picture looks down into the vale
      { at: [0, 30.8], box: [2.9, 3.6], blend: 7, y: YS },
      { at: C, r: R1, blend: 2.6, y: T1 },
      { at: C, r: R2, blend: 0.9, y: T2 },
      { at: EAST, r: 2.6, blend: 3, lift: 0.1 }
    ],
    paths: [{ pts: PATH, w: 2.2, depth: 0.12 }, { pts: PATH2, w: 2.0, depth: 0.06 }, { pts: SPUR, w: 2.0, depth: 0.1 }],
    box: [-112, 112, -112, 112]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
    const grass = ramp('grass'), st = ramp('stone'), lit = ramp('lit'), br = ramp('bronze'), verd = ramp('verd'), rust = ramp('rust'), fire = ramp('fire');
    // rough surfaces: a broad tone wander and a fine grain
    const grit = (k = 1) => (x, y, z) => k * (0.16 * (B.n3(x * 0.45, z * 0.45, y * 0.3 + 3) - 0.5) + 0.14 * (B.n3(x * 2.6, y * 2.6, z * 2.6) - 0.5));
    // laid stone: grit, and dark mortar between courses and between blocks
    const laid = (k = 0.8, ch = 0.55) => {
      const g = grit(k);
      return (x, y, z) => {
        const c = y / ch, row = Math.floor(c), f = c - row, u = ((x + z) / 1.05 + row * 0.5) % 1;
        return g(x, y, z) + (f < 0.12 || (u + 1) % 1 < 0.07 ? -0.15 : 0);
      };
    };
    // lamp light: from cold violet through rust brown to orange, so a fire makes a warm pool, not a red smear
    const warmStone = [st[1], rust[1], rust[2], fire[1], fire[2], fire[3]];
    // worn flagstones on flat tops: dark joints, each slab its own tone, and the grit; one step darker than the faces, so the sky's fill
    // on the tops does not wash the summit pale
    const flags = (k = 1, w = 1.1) => {
      const g = grit(k);
      return (x, y, z) => {
        const u = x / w, i = Math.floor(u), v = z / w + (i % 2) * 0.5, j = Math.floor(v);
        return g(x, y, z) + (u - i < 0.07 || v - j < 0.07 ? -0.2 : 0.18 * (B.n3(i * 3.1, 7, j * 2.7) - 0.5));
      };
    };
    const worn = { min: 0.8, r: st.slice(0, 4), g: warmStone, mod: flags(1) };
    const stone = { r: st, s: [st[2], lit[0], lit[1], lit[2]], g: warmStone, mod: laid(0.8), top: worn };
    const rough = { r: st, s: [st[2], lit[0], lit[1], lit[2]], g: warmStone, mod: grit(0.9), top: worn };
    const dark = { r: st.slice(0, 3), mod: grit(0.6) };
    const far = { r: st.slice(0, 2), mod: grit(0.5) };
    // bronze: dark in shadow, brass where the sun catches it; old fallen bells are green-crusted in patches
    // lamp light on bronze: through its own copper to orange, stopping short of the fire's yellow, so a lit cog glows and does not blaze
    const bronzeG = [br[0], br[1], br[2], br[3], fire[2], fire[3]];
    const crust = s => (x, y, z) => (B.n3(x * s + 2, y * s, z * s + 5) > 0.7 ? verd : null);
    // grime on old bronze: a fine grain and a few small dark pits
    // (no broad tone wander, and pits no bigger than a hand: on big cast faces larger blots read as camouflage, not grime)
    const grime = (x, y, z) => 0.6 * 0.14 * (B.n3(x * 3, y * 3, z * 3) - 0.5) - (B.n3(x * 6 + 4, y * 6, z * 6) > 0.84 ? 0.12 : 0);
    // bronze in its own shadow is one dark old-bronze tone, darker only in pits and creases: the sun is behind the knoll, so from the
    // start a big cog is a dark shape against the dusk, not a blotchy orange slab. The faces the low sun reaches (its west rims, the tops
    // of its teeth) catch brass, and fire warms the rest.
    const shBr = [br[0], br[1], br[1], br[2]];
    // (faces turned up, the tops of teeth and the walked rims, are worn brighter)
    const bronze = { r: shBr, s: br.slice(2, 6), g: bronzeG, mod: grime, top: { min: 0.85, r: br.slice(1, 5), s: br.slice(2, 6), g: bronzeG, mod: grime } };
    // the cog you walk on: its whole face is turned up, so only a little brighter than plain bronze
    const walked = { r: shBr, s: br.slice(1, 5), g: bronzeG, mod: grime, top: { min: 0.85, r: br.slice(0, 4), s: br.slice(1, 4), g: bronzeG, mod: grime } };
    const bell = { r: shBr, s: br.slice(1, 6), g: bronzeG, mod: grit(0.35) };
    const oldBell = { ...bell, rf: crust(1.1) };
    const iron = { r: rust, g: [rust[0], rust[1], rust[2], fire[1], fire[2], fire[3]], mod: grit(0.4) };
    const enamel = { r: [st[3], st[3], st[4]], s: [st[3], lit[1], lit[2]], g: warmStone, mod: grit(0.6) };
    const black = { r: [rust[0], br[0]], g: [rust[0], rust[1], fire[1]] };
    const grassM = { r: grass.slice(0, 4), s: [grass[2], lit[0], lit[1]], mod: grit(1) };

    /* ---- the ground: a fine rectangle over the play area, then strips coarser each time out ---- */
    {
      // the paths: old flagstones in staggered rows, dark violet with black joints, a few sunk to mud and a few gone to grass. Kept a step
      // under the grass's top tone, so the way reads as worn stone and not as a pale stream running down the hill
      const onPath = (x, z) => Math.min(polyDist(x, z, PATH) - 0.1, polyDist(x, z, PATH2) - 0.2, polyDist(x, z, SPUR) - 0.25) + 0.7 * (B.n3(x * 1.1, z * 1.1, 4) - 0.5) < 1.0;
      const flag = (x, z) => {
        const row = Math.floor(z / 0.7), u = x / 0.85 + row * 0.37, i = Math.floor(u), v = z / 0.7 - row;
        return { joint: u - i < 0.1 || v < 0.12, k: B.n3(i * 3.1, 7, row * 2.7) };
      };
      const slab = [st[0], st[1], st[1], st[2]], pale = [st[0], st[1], st[2], st[2]], mud = [grass[1], grass[2], rust[1], rust[1]], joint = [ramp('ink')[0], st[0], st[0]];
      const g1 = grit(1), g8 = grit(0.8);
      const near = {
        r: grass, s: [grass[2], grass[3], lit[0], lit[1]], g: [grass[1], grass[2], rust[2], fire[1], fire[2], fire[3]],
        mod: (x, y, z) => { if (!onPath(x, z)) return g1(x, y, z); const f = flag(x, z); return g8(x, y, z) + (f.joint ? 0 : 0.22 * (f.k - 0.5)); },
        rf: (x, y, z) => {
          if (!onPath(x, z)) return null;
          const f = flag(x, z);
          return f.joint ? joint : f.k < 0.24 ? null : f.k < 0.33 ? mud : f.k > 0.76 ? pale : slab;
        }
      };
      const mid = { r: grass, s: [grass[2], lit[0]], mod: grit(1.2), fat: 0.62 }, out = { r: grass.slice(0, 4), mod: grit(1.4), fat: 0.8 };
      const N = [-24, 24, -30, 31], M = [-56, 56, -56, 56], Fr = [-108, 108, -108, 108];
      tile(S, h, near, { x0: N[0], x1: N[1], z0: N[2], z1: N[3], res: 0.32 });
      const ring = (o, i, res, mat) => {
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: o[2], z1: i[2], res });
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: i[3], z1: o[3], res });
        tile(S, h, mat, { x0: o[0], x1: i[0], z0: i[2], z1: i[3], res });
        tile(S, h, mat, { x0: i[1], x1: o[1], z0: i[2], z1: i[3], res });
      };
      ring(M, N, 0.7, mid);
      ring(Fr, M, 1.7, out); // (past the fog's full depth: only the far hills' outline, so coarse)
    }

    /* ---- small props of this place ---- */
    // an octagonal stone block, its flat faces to the four winds: centre (x, z), apothem, bottom and top
    const oct = (x, z, ap, y0, y1, mat, o = {}) => S.extrude([octLoop(ap, o.rot || 0)], [x, (y0 + y1) / 2, z], y1 - y0, mat, { ax: FLAT, res: o.res || 0.14, hold: o.hold });
    // an iron fire bowl on three fat legs; returns the top of the bowl
    const bowl = (x, z, { y, s = 0.9, lit: on = true, k = 0.65, r } = {}) => {
      const y0 = y ?? h(x, z) - 0.05;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        S.tube([[x + Math.cos(a) * 0.45, y0, z + Math.sin(a) * 0.45], [x + Math.cos(a) * 0.2, y0 + 0.72, z + Math.sin(a) * 0.2]], 0.07, 0.06, iron, { res: 0.07 });
      }
      const b = S.ball([x, y0 + 0.95, z], [0.52, 0.3, 0.52], iron, { hold: true });
      const in_ = S.ball([x, y0 + 1.12, z], [0.43, 0.27, 0.43], iron, { hold: true });
      S.join('cut', b, in_, { res: 0.08 });
      if (on) ctx.fire([x, y0 + 1.0, z], s, { k, r });
      return [x, y0 + 1.0, z];
    };
    // a bronze fire post: a fat stone stub with a bronze cup and a flame on top
    const post = (x, z, { hgt = 1.4, s = 0.75 } = {}) => {
      const y0 = h(x, z) - 0.3;
      oct(x, z, 0.34, y0, y0 + hgt, rough, { res: 0.09 });
      S.ball([x, y0 + hgt + 0.08, z], [0.36, 0.16, 0.36], bronze, { res: 0.07 });
      ctx.fire([x, y0 + hgt + 0.2, z], s, { k: 0.6, r: 3.4 });
    };
    // a run of stone steps from a to b, each `rise` high, as blocks set into the slope
    const stair = (a, b, { width = 2.4, rise = 0.3, mat = rough, ya, yb } = {}) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
      ya = ya ?? h(a[0], a[1]); yb = yb ?? h(b[0], b[1]);
      const n = Math.max(2, Math.ceil(Math.abs(yb - ya) / rise)), half = len / n / 2 + 0.04;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, top = ya + (yb - ya) * ((i + 1) / n);
        const low = Math.min(h(x, z), top) - 0.5;
        S.box([x, (top + low) / 2, z], [width / 2, (top - low) / 2, half], mat, { ax: yawAx(yaw), rd: 0.06, res: 0.12 });
      }
    };
    // a cog: an outline (gearLoops) extruded `depth` thick along the frame's W, centred at c; and a hub boss through its middle
    const cog = (c, ax, g, { depth = 1.2, mat = bronze, res = 0.14, boss = true } = {}) => {
      S.extrude(gearLoops(g), c, depth, mat, { ax, res });
      if (boss && g.spokes) {
        const W = ax[2], bd = depth * 1.5;
        S.lathe(add(c, W, -bd / 2), bd, g.hub * 1.05, mat, { ax: frameY(W), res: res * 0.85 });
        S.lathe(add(c, W, -bd / 2 - 0.25), bd + 0.5, g.hub * 0.42, iron, { ax: frameY(W), res: res * 0.7 });
      }
    };
    // a bell along an axis: mouth centre m, `up` from the mouth to the crown, mouth radius R, height H; a crack and a chip if asked
    const bellAt = (m, up, R, H, { mat = bell, hollow = true, crack = null, res = 0.1 } = {}) => {
      const ax = frameY(up), U = ax[0], W = ax[2];
      const solid = !hollow && !crack;
      const outer = S.lathe(m, H, t => R * bellR(t), mat, solid ? { ax, maxRadius: R, res } : { ax, maxRadius: R, hold: true });
      const cuts = [];
      if (hollow) cuts.push(S.lathe(add(m, up, -0.05), H * 0.8, t => Math.max(0.05, R * bellR(Math.max(0, (t * H * 0.8 - 0.05) / H)) - R * 0.13), mat, { ax, maxRadius: R, hold: true }));
      if (crack) {
        // a slanted split up from the lip, and a bite out of the lip beside it
        const a = crack.a, side = add([0, 0, 0], U, Math.cos(a)), sd = add(side, W, Math.sin(a));
        const p = add(add(m, sd, R * 0.92), up, H * 0.28), Y = norm(add(up, cross(up, sd), 0.35));
        cuts.push(S.box(p, [0.07, H * 0.32, R * 0.3], mat, { ax: [cross(Y, sd), Y, sd], hold: true }));
        cuts.push(S.ball(add(add(m, sd, R * 0.95), cross(up, sd), R * 0.32), R * 0.3, mat, { hold: true }));
      }
      if (!solid) S.join('cut', outer, cuts, { res, inner: br.slice(0, 2) });
      // a bead round the lip and a band at the shoulder
      S.torus(add(m, up, H * 0.05), R * 0.95, R * 0.06, mat, { ax, res: res * 0.9 });
      S.torus(add(m, up, H * 0.83), R * 0.53, R * 0.045, mat, { ax, res: res * 0.9 });
      // the crown loop
      S.torus(add(m, up, H + R * 0.12), R * 0.2, R * 0.07, mat, { ax: [U, W, up], res: res * 0.8 });
    };
    // a chain from a to b, sagging `sag` below the straight line: chunky round links, every other one turned a quarter
    const chain = (a, b, { sag = 0.8, link = 0.26, wire = 0.07 } = {}) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(2, Math.round(L / (link * 1.7)));
      const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
      for (let i = 0; i <= n; i++) {
        const t = i / n, p = at(t), q = at(Math.min(1, t + 0.01)), o = at(Math.max(0, t - 0.01)), d = norm([q[0] - o[0], q[1] - o[1], q[2] - o[2]]);
        // a link is a ring whose plane holds the chain's direction; turn the plane a quarter for every other link
        const side = norm(cross(d, [0, 1, 0])), up = cross(side, d), nrm = i % 2 ? up : side;
        S.torus(p, link, wire, iron, { ax: frameY(nrm), res: 0.08 });
      }
    };
    // a pendulum frame: two fat stone posts, a beam, and a bronze bob hung on a rod, stopped part way through its swing
    const pendulum = (x, z, yaw, { span = 4.6, hgt = 5.2, swing = 0.32, rod = 2.5 } = {}) => {
      const ex = Math.cos(yaw), ez = -Math.sin(yaw), y0 = Math.min(h(x - ex * span / 2, z - ez * span / 2), h(x + ex * span / 2, z + ez * span / 2)) - 0.4;
      for (const s of [-1, 1]) {
        const px = x + ex * s * span / 2, pz = z + ez * s * span / 2;
        oct(px, pz, 0.55, y0 - 0.2, y0 + 0.9, rough, { res: 0.11 });
        oct(px, pz, 0.42, y0, y0 + hgt, stone, { res: 0.12 });
        S.box([px, y0 + hgt + 0.18, pz], [0.6, 0.2, 0.6], rough, { ax: yawAx(yaw), rd: 0.05, res: 0.11 });
      }
      S.box([x, y0 + hgt - 0.25, z], [span / 2 + 0.3, 0.26, 0.3], bronze, { ax: yawAx(yaw), rd: 0.06, res: 0.11 });
      const top = [x, y0 + hgt - 0.5, z], d = [ex * Math.sin(swing), -Math.cos(swing), ez * Math.sin(swing)], end = add(top, d, rod);
      S.tube([top, end], 0.09, 0.09, iron, { res: 0.07 });
      // the bob: a fat bronze lens facing along the frame's normal
      S.ball(add(end, d, 0.55), [0.95, 0.95, 0.32], bronze, { ax: [[ex, 0, ez], [0, 1, 0], [Math.sin(yaw), 0, Math.cos(yaw)]], res: 0.09 });
      return end;
    };

    /* ---- the knoll: stone edges on the terraces' south faces, so they read as steps from the start ---- */
    const edgeRing = (r, top, from, to, { tall = 1.3, gap = [] } = {}) => {
      // octagon sides (16 of them: chunkier than a circle, rounder than eight) from angle `from` to `to` (0 is east, z grows south)
      const n = 16, rc = r / Math.cos(Math.PI / n);
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
        const ang = ((am - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (ang > ((to - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) || gap.includes(k)) continue;
        const x0 = C[0] + Math.cos(a0) * rc, z0 = C[1] + Math.sin(a0) * rc, x1 = C[0] + Math.cos(a1) * rc, z1 = C[1] + Math.sin(a1) * rc;
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0), low = Math.min(h(mx + Math.cos(am) * 1.2, mz + Math.sin(am) * 1.2), top - tall) - 0.4;
        const hi = top + (B.rr(0, 1) < 0.3 ? 0.35 : 0.12);
        S.box([mx, (low + hi) / 2, mz], [len / 2 + 0.05, (hi - low) / 2, 0.45], stone, { ax: yawAx(Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2), rd: 0.08, res: 0.14 });
      }
    };
    // the segment of a 16-sided ring that holds a point: where a path or stair crosses, the edge is left open
    const seg = (x, z) => Math.floor(((Math.atan2(z - C[1], x - C[0]) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 8));
    edgeRing(R1 + 0.2, T1, 0.15, Math.PI - 0.15, { gap: [seg(GATE[0], GATE[1]), seg(8.2, -1.6)] });
    edgeRing(R2 + 0.15, T2, 0.1, Math.PI - 0.1, { gap: [0, 15] });
    // the stair from the first terrace up to the second, on the east side
    stair([C[0] + 10.4, C[1]], [C[0] + 8.0, C[1]], { width: 2.4, ya: T1, yb: T2 });
    post(C[0] + 10.4, C[1] + 1.7);

    /* ---- the plinth and the spire ---- */
    const [cx, cz] = C;
    {
      // two stepped stone tiers: the lower step, then the terrace the spire stands on
      oct(cx, cz, AP.step, T2 - 1.4, F - 0.6, stone, { res: 0.16 });
      oct(cx, cz, AP.deck, F - 1.2, F, stone, { res: 0.16 });
      // the deck is old: blocks fallen from the cornice lie about its rim, some split, some tipped
      for (const [a, r, w, t, tilt] of [[2.3, 4.6, 0.55, 0.32, 0.25], [2.75, 5.2, 0.42, 0.28, -0.4], [-2.2, 4.4, 0.6, 0.3, 0.15], [-1.0, 5.1, 0.5, 0.34, 0.5],
        [-2.65, 5.3, 0.38, 0.26, -0.3], [0.05, 5.25, 0.45, 0.3, 0.35]]) {
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        S.box([x, F + t * 0.7, z], [w, t, w * 0.8], rough, { ax: [[Math.cos(a), Math.sin(tilt) * 0.5, -Math.sin(a)], [-Math.sin(tilt) * 0.5, 1, 0], [Math.sin(a), 0, Math.cos(a)]].map(norm), rd: 0.05, res: 0.1 });
      }
      // the stair up the plinth from the second terrace, on the south-west
      const dir = norm([-0.42, 0, 0.9]);
      stair([cx + dir[0] * 8.1, cz + dir[2] * 8.1], [cx + dir[0] * 5.3, cz + dir[2] * 5.3], { width: 2.3, ya: T2, yb: F, rise: 0.3 });
      // the drum: solid, too tall to jump onto from the terrace
      oct(cx, cz, AP.drum, F - 0.4, F + 1.6, stone, { res: 0.12 });
      oct(cx, cz, AP.drum + 0.18, F + 1.45, F + 1.75, rough, { res: 0.14 }); // (a thin band: its caps are hidden, so coarse is enough)
      // the belfry: an octagon cut through by two arched passages, north-south and east-west, leaving four fat corner piers
      const yb = F + 1.75, spring = F + 2.75, ar = 1.15, ytop = F + 4.1;
      const body = oct(cx, cz, AP.drum, yb, ytop, stone, { hold: true });
      const holes = [];
      for (const along of ['z', 'x']) {
        const hx = along === 'x' ? 3 : ar, hz = along === 'z' ? 3 : ar;
        holes.push(S.box([cx, (yb - 0.2 + spring) / 2, cz], [hx, (spring - yb + 0.2) / 2, hz], dark, { hold: true }));
        const e = along === 'x' ? [3, 0, 0] : [0, 0, 3];
        holes.push(S.tube([[cx - e[0], spring, cz - e[2]], [cx + e[0], spring, cz + e[2]]], ar, ar, dark, { hold: true }));
      }
      S.join('cut', body, holes, { res: 0.13, inner: st.slice(0, 2) });
      // a cornice, then one eight-sided pyramid roof of dark slate with a bronze finial. One plain steep roof and not stacked slabs, so
      // against the sun the outline reads as a bell tower and not as a stone lantern. (All low: the page's first picture ends at about
      // 10.4 here, just over the finial.)
      oct(cx, cz, AP.drum + 0.36, ytop - 0.05, ytop + 0.3, rough, { res: 0.13 });
      const ry = ytop + 0.26, rA = 1.9, rH = 1.12, sl = Math.hypot(rA, rH), planes = [{ n: [0, -1, 0], d: 0 }];
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; planes.push({ n: [(Math.cos(a) * rH) / sl, rA / sl, (Math.sin(a) * rH) / sl], d: (rA * rH) / sl }); }
      // slate in courses: a dark line every 0.24 up the roof
      const g6 = grit(0.6), slate = { r: st.slice(0, 3), s: [st[1], lit[0], lit[1]], g: warmStone, mod: (x, y, z) => g6(x, y, z) + ((y - ry) % 0.24 < 0.05 ? -0.14 : 0) };
      S.poly([cx, ry, cz], planes, slate, { res: 0.1 });
      // a parapet of fat merlons round the cornice, one to each face: from the start their teeth answer the cogs' against the sun
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, rr = AP.drum + 0.12;
        S.box([cx + Math.cos(a) * rr, ytop + 0.5, cz + Math.sin(a) * rr], [0.2, 0.24, 0.42], rough, { ax: yawAx(Math.PI / 2 - a), rd: 0.05, res: 0.09 });
      }
      S.tube([[cx, ry + rH - 0.25, cz], [cx, ry + rH + 0.2, cz]], 0.07, 0.04, iron, { res: 0.05 });
      S.ball([cx, ry + rH + 0.08, cz], 0.14, bronze, { res: 0.05 });
      // the bell, its headstock on a beam across the east-west passage, and its clapper
      S.box([cx, F + 3.93, cz], [AP.drum - 0.1, 0.16, 0.2], bronze, { rd: 0.04, res: 0.08 });
      bellAt([cx, F + 2.05, cz], [0, 1, 0], 0.86, 1.66, { hollow: true, res: 0.085 });
      S.ball([cx, F + 1.95, cz], 0.2, iron, { res: 0.05 });
      // the beacon: a fire bowl on a stone post on a stepped altar, on the terrace east of south, so the start sees it beside the belfry.
      // The altar's top is 2.5 under the bowl (the reach), and the post lifts the bowl to 2.1 over the start.
      const ba = 0.5, bd = [cx + 4.3 * Math.cos(ba), cz + 4.3 * Math.sin(ba)];
      [[1.55, 0.4], [1.33, 0.8], [1.12, 1.2], [0.93, 1.6], [0.76, 2.0]].forEach(([ap, top], i) =>
        oct(bd[0], bd[1], ap, F - 0.3 + (i ? top - 0.5 : 0), F + top, i % 2 ? stone : rough, { res: 0.1, rot: 0.2 }));
      oct(bd[0], bd[1], 0.28, F + 1.9, F + 3.5, stone, { res: 0.08, rot: 0.2 });
      oct(bd[0], bd[1], 0.4, F + 3.3, F + 3.5, rough, { res: 0.07, rot: 0.2 });
      ctx.beacon(bowl(bd[0], bd[1], { y: F + 3.5, lit: false }), 1.7);
      // a fire bowl on the terrace's south-west corner, the beacon's partner
      bowl(cx - 3.3, cz + 3.3, { y: F, s: 0.9 });
    }

    /* ---- the cog gate on the path up the south-east slope ---- */
    {
      const d = norm([8.2 - 5.0, 0, -1.6 - 4.0]), ax = frameW(d), gy = h(GATE[0], GATE[1]);
      cog([GATE[0], gy - 0.5, GATE[1]], ax, { R: 4.0, Ri: 3.05, n: 14, th: 0.65, tw: 0.5, skip: [4] }, { depth: 1.3, res: 0.13 });
      post(GATE[0] - 3.2, GATE[1] + 2.1);
    }

    /* ---- the great wheel rising from the knoll's west side, facing the start ---- */
    {
      const toEye = norm([EYE[0] - WHEEL[0], 0, EYE[2] - WHEEL[1]]), ax = frameW(toEye), gy = h(WHEEL[0], WHEEL[1]);
      cog([WHEEL[0], gy - 1.3, WHEEL[1]], ax, { R: 5.6, Ri: 4.6, n: 18, th: 0.75, tw: 0.5, spokes: 4, hub: 1.0, sw: 0.75, skip: [2, 3] }, { depth: 1.2, res: 0.14 });
      // a chain hangs from the top of its rim, broken off
      ctx.later(() => chain(add([WHEEL[0], gy - 1.3 + 6.0, WHEEL[1]], ax[0], 1.2), add([WHEEL[0], gy + 0.2, WHEEL[1]], ax[0], 3.6), { sag: 0.4 }));
    }

    /* ---- the tilted cog on the east hill: its rim is the path up ---- */
    {
      const c = [11.6, 0, 4.4];
      // lean the cog to the slope (its normal from the hill's own fall), and tip it back toward the start, so from there it reads as a
      // toothed ring and not a lump of bronze in the grass
      const e = 1.5, gx = (h(c[0] + e, c[2]) - h(c[0] - e, c[2])) / (2 * e), gz = (h(c[0], c[2] + e) - h(c[0], c[2] - e)) / (2 * e);
      const n = norm([-gx * 0.85 - 0.22, 1, -gz * 0.85 + 0.55]);
      c[1] = h(c[0], c[2]) + 0.3;
      // (darker than the gate's bronze: the gate on the path is the one to read first)
      const dim = { ...walked, r: br.slice(0, 3), s: br.slice(0, 3), top: { ...walked.top, r: br.slice(0, 3), s: br.slice(1, 3) } };
      cog(c, frameW(n), { R: 4.6, Ri: 2.8, n: 12, th: 0.75, tw: 0.5, skip: [5] }, { depth: 1.0, res: 0.14, mat: dim });
    }

    /* ---- the fallen bell at the knoll's foot: on its side, cracked, its mouth turned to the path ---- */
    {
      const [fx, fz] = FALLEN, gy = h(fx, fz), R = 1.75, H = 3.3;
      const up = norm([-0.94, 0.06, -0.34]); // from the mouth to the crown: side-on to the start, so its outline reads, the mouth turned a little to the path
      const m = [fx + 1.5, gy + R * 0.82, fz + 0.55];
      bellAt(m, up, R, H, { crack: { a: 2.2 }, res: 0.1, mat: oldBell });
      // a wisp a metre inside the mouth, a metre over the bell's inner floor
      const w = add(m, up, 0.95), floor = w[1] - (R * bellR(0.95 / H) - R * 0.13);
      ctx.wisp([w[0], floor + 1.0, w[2]]);
      // a broken headstock lies by its crown
      S.box([fx - 2.6, gy + 0.25, fz - 1.5], [1.1, 0.25, 0.3], bronze, { ax: yawAx(0.7), rd: 0.05, res: 0.09 });
      bowl(FALLEN[0] + 2.7, FALLEN[1] - 0.4, { s: 0.85 }); // beside its mouth, so the fire lights the inside
    }

    /* ---- the broken clock face on the west hill ---- */
    {
      const [qx, qz] = CLOCK, gy = h(qx, qz), Rc = 3.6;
      // the face leans back into the hill, turned to the east and the start
      const n = norm([0.45, 0.9, 0.78]), ax = frameW(n), U = ax[0], V = ax[1];
      const c = [qx, gy + 0.2, qz];
      // two halves split along a jagged crack; the lower half has slid a little down the hill
      const half = (side, drop) => {
        const L = [];
        for (let i = 0; i <= 12; i++) { const a = side * (Math.PI / 2) - Math.PI / 2 + (i / 12) * Math.PI; L.push([Math.cos(a) * Rc, Math.sin(a) * Rc]); }
        for (const [u, v] of [[0.4, -1.8], [-0.3, -0.6], [0.35, 0.5], [-0.25, 1.6]].map(p => [p[0] * side, p[1] * side])) L.push([u, v]);
        const cc = add(c, [0, -drop, 0]);
        S.extrude([L], cc, 0.45, enamel, { ax, res: 0.13 });
        return cc;
      };
      half(1, 0);
      half(-1, 0.35);
      // a fat bronze rim round each half, black hour bars, and two black hands, one bent up off the face
      const arc = (side, drop) => {
        const pts = [];
        for (let i = 0; i <= 10; i++) { const a = side * (Math.PI / 2) - Math.PI / 2 + 0.08 + (i / 10) * (Math.PI - 0.16); pts.push(add(add(add(c, [0, -drop, 0]), U, Math.cos(a) * Rc), V, Math.sin(a) * Rc)); }
        S.tube(pts.map(q => add(q, n, 0.18)), 0.26, 0.26, bronze, { res: 0.09 });
      };
      arc(1, 0);
      arc(-1, 0.35);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, rad = add(add([0, 0, 0], U, Math.cos(a)), V, Math.sin(a)), tan = add(add([0, 0, 0], U, -Math.sin(a)), V, Math.cos(a));
        const p = add(add(c, rad, Rc * 0.74), [0, Math.cos(a) < -0.1 ? -0.35 : 0, 0]), big = k % 3 === 0;
        S.box(add(p, n, 0.24), [big ? 0.2 : 0.13, big ? 0.55 : 0.36, 0.06], black, { ax: [tan, rad, n], res: 0.06 });
      }
      const ctr = add(c, n, 0.3);
      S.tube([ctr, add(add(add(ctr, V, 2.6), U, 0.5), n, 0.1)], 0.16, 0.07, black, { res: 0.06 });
      S.tube([ctr, add(ctr, U, 1.3), add(add(add(ctr, U, 1.8), V, -0.5), n, 0.7)], 0.15, 0.08, black, { res: 0.06 });
      S.lathe(add(c, n, 0.1), 0.4, 0.38, bronze, { ax: frameY(n), res: 0.07 });
      post(qx + 4.2, qz - 2.0);
    }

    /* ---- pendulum frames: one on the east hill's top, black against the band from the start; one behind the knoll ---- */
    pendulum(EAST[0], EAST[1] - 0.4, -0.47, { swing: 0.34, hgt: 4.4, rod: 2.0 });
    bowl(EAST[0] - 0.9, EAST[1] + 1.5, { s: 0.9, k: 0.8 }); // close by the bob, so the fire lights it
    pendulum(6.0, -24, -0.5, { swing: -0.3, hgt: 4.6, rod: 2.0 });

    /* ---- chains from the spire's cornice down to stakes on the first terrace, north-east and north-west ---- */
    ctx.later(() => {
      for (const s of [-1, 1]) {
        const top = [cx + s * (AP.drum + 0.3), F + 4.3, cz - 0.9], sx = cx + s * 7.6, sz = cz - 6.2, sy = h(sx, sz);
        chain(top, [sx, sy + 0.6, sz], { sag: 1.6 });
      }
    });
    for (const s of [-1, 1]) {
      const sx = cx + s * 7.6, sz = cz - 6.2, sy = h(sx, sz);
      S.tube([[sx, sy - 0.3, sz], [sx, sy + 0.8, sz]], 0.2, 0.14, iron, { res: 0.06 });
    }

    /* ---- the start, at the lip: on the left a small bell fallen on its side with a fire in its mouth (a hearth: its glow warms the head of
       the path), and on the right a drum of an older spire, its chain down the slope. Both low, so the vale reads over them. ---- */
    {
      // the hearth: the bell's crown to the west, its mouth to the path and a little to you
      const bx = -1.9, bz = 27.4, by = h(bx, bz), R = 0.5, H = 0.95, up = norm([-0.93, 0.12, -0.35]);
      const m = [bx + 0.5, by + R * 0.8, bz + 0.2];
      bellAt(m, up, R, H, { mat: oldBell, res: 0.07 });
      ctx.fire(add(add(m, up, 0.3), [0, -R * 0.45, 0]), 0.36, { k: 0.45, r: 2.4 });
      // a drum of an older spire, fallen on its side on the right lip, a chain from it down the slope
      const sx = 3.1, sz = 26.6, sy = h(sx, sz), lay = frameW(norm([1, 0, -0.45]));
      S.extrude([octLoop(0.46, 0.2)], [sx, sy + 0.18, sz], 1.0, { ...stone, r: st.slice(0, 4) }, { ax: lay, res: 0.09 });
      ctx.later(() => chain([sx - 0.2, sy + 0.62, sz - 0.2], [sx + 0.8, h(sx + 0.8, sz - 3.8) + 0.2, sz - 3.8], { sag: 0.25 }));
    }

    /* ---- braziers and fire posts along the way ---- */
    bowl(-1, -20.5, { s: 0.9 });
    bowl(8.8, -22.4, { s: 0.85 });

    /* ---- the bell graveyard on the south-west hill: small bells sunk in the grass at odd angles, one stood mouth-down ---- */
    {
      const list = [[-16.2, 24.6, 1.05, [0.3, 0.45, -0.8]], [-12.2, 22.4, 0.85, [-0.75, 0.35, 0.45]], [-13.0, 27.8, 0.95, [-0.2, 0.55, 0.85]]];
      for (const [x, z, R, d] of list) {
        const up = norm(d), gy = h(x, z);
        // (hollow: a bell on its side reads by its black mouth, not by its outline)
        bellAt([x - up[0] * R * 0.9, gy - up[1] * R * 0.9 + R * 0.25, z - up[2] * R * 0.9], up, R, R * 1.9, { mat: oldBell, res: 0.09 });
      }
      // the big one, stood on its mouth: low enough to jump onto
      const bx = -15.6, bz = 19.4, by = h(bx, bz) - 0.25;
      bellAt([bx, by, bz], [0, 1, 0], 1.3, 2.1, { mat: oldBell, hollow: false, res: 0.1 });
      post(-11.2, 19.6, { hgt: 1.2, s: 0.7 });
    }

    /* ---- the south-east hill: a lone pendulum post with its bob, and the fallen cap of an older spire, to climb on ---- */
    {
      const px = 15.2, pz = 22.0, py = h(px, pz) - 0.3;
      oct(px, pz, 0.5, py, py + 4.2, stone, { res: 0.12 });
      S.box([px + 0.9, py + 4.0, pz], [1.3, 0.22, 0.24], bronze, { rd: 0.05, res: 0.1 });
      S.tube([[px + 1.9, py + 3.8, pz], [px + 2.25, py + 2.3, pz + 0.1]], 0.07, 0.07, iron, { res: 0.07 });
      S.ball([px + 2.35, py + 1.8, pz + 0.12], [0.6, 0.6, 0.22], bronze, { ax: yawAx(0.2), res: 0.08 });
      // the cap: a stepped octagonal roof lying on its side, its finial ball in the grass
      // (each tier is an octagon stood upright and extruded along the ground, so the cap's own up runs along the grass)
      const cx2 = 19.4, cz2 = 18.6, cy = h(cx2, cz2), lay = frameW(norm([0.3, 0, -1]));
      for (const [ap, a0, a1] of [[1.7, -0.2, 0.7], [1.15, 0.65, 1.3], [0.7, 1.25, 1.8]])
        S.extrude([octLoop(ap)], add([cx2, cy + 1.2, cz2], lay[2], (a0 + a1) / 2), a1 - a0, rough, { ax: lay, res: 0.12 });
      S.ball(add([cx2, cy + 0.65, cz2], lay[2], 2.4), 0.55, bronze, { res: 0.08 });
      post(17.2, 15.6, { hgt: 1.2, s: 0.7 });
    }

    /* ---- the north-west: a cog lying flat like a millstone, half sunk, with a fire bowl on its hub; climb it for the wisp ---- */
    {
      const mx = -13.5, mz = -20.5, my = h(mx, mz) + 0.1;
      // (only the toothed outline: no hole in a millstone)
      S.extrude(gearLoops({ R: 3.0, Ri: 0, n: 12, th: 0.5, tw: 0.5, spokes: 0 }).slice(0, 1), [mx, my, mz], 1.0, walked, { ax: FLAT, res: 0.14 });
      S.lathe([mx, my + 0.4, mz], 0.5, 0.75, walked, { res: 0.09 });
      bowl(mx + 1.6, mz - 0.9, { y: my + 0.5, s: 0.8 });
      ctx.wisp([mx - 0.6, my + 0.5 + 1.1, mz + 0.5]);
    }

    /* ---- the flanks: something to walk out to on each roll beside the knoll, with a fire to see it by ---- */
    {
      // west: the crown of a great bell buried mouth-down in the hilltop, its shoulder band and its loop above the grass
      const [wx, wz] = [-23, -11], gy = h(wx, wz);
      // (narrow under the grass, where nobody sees it, so its hidden floor costs little)
      S.lathe([wx, gy - 1.3, wz], 2.7, t => (t < 0.3 ? 1.9 + 3.3 * t : 2.9 * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.2))) + 0.05), oldBell, { res: 0.13 });
      S.torus([wx, gy + 0.05, wz], 2.75, 0.2, bell, { res: 0.11 });
      S.torus([wx, gy + 1.35 + 0.95, wz], 0.95, 0.3, bell, { ax: frameY([0.8, 0, 0.6]), res: 0.1 });
      bowl(wx + 3.6, wz + 2.0, { s: 0.85 });
      // east: a pendulum frame that has come down: one post still stands, its beam has slid to the grass, the bob lies where it fell
      const [ex, ez] = [24.5, -12.5], ey = h(ex, ez) - 0.3;
      oct(ex, ez, 0.42, ey, ey + 3.6, stone, { res: 0.12 });
      S.box([ex, ey + 3.78, ez], [0.6, 0.2, 0.6], rough, { rd: 0.05, res: 0.11 });
      const lay = frameW(norm([0.25, 0, 1]));
      S.extrude([octLoop(0.42)], [ex + 1.0, h(ex + 1.0, ez + 2.6) + 0.25, ez + 2.6], 3.4, stone, { ax: lay, res: 0.12 });
      S.box([ex - 0.6, ey + 2.1, ez + 0.7], [0.26, 2.3, 0.3], bronze, { ax: [[1, 0, 0], norm([0.35, 0.94, 0.0]), cross([1, 0, 0], norm([0.35, 0.94, 0]))].map(norm), rd: 0.06, res: 0.11 });
      S.ball([ex - 2.2, h(ex - 2.2, ez + 1.6) + 0.45, ez + 1.6], [0.95, 0.32, 0.95], bronze, { ax: frameY(norm([1.1, 1, 0.3])), res: 0.1 });
      post(ex + 1.6, ez - 1.6, { hgt: 1.2, s: 0.7 });
    }

    /* ---- rocks and shrubs ---- */
    rocks(ctx, [[-3.6, 19.5, 0.6], [3.8, 17.6, 0.5], [-6.5, 12, 0.8], [5.2, 9.5, 0.6], [12, 14, 1.0], [-10, 16, 0.9], [-16, -3, 1.2], [15, -8, 1.1],
      [-20, 18, 1.1], [21, 15, 1.2], [-7, -22, 0.9], [14, -18, 1.0], [24, -2, 1.1]], { mat: rough, seed: 5 });
    shrubs(ctx, [[-2.5, 21, 0.5], [3.6, 20.2, 0.55], [-5, 15, 0.6], [4.5, 13, 0.5], [-9.5, 3.5, 0.6], [10.5, 5.5, 0.6], [-14, -6, 0.7], [16.5, -5, 0.6],
      [-6, -18, 0.6], [5.5, -18.5, 0.6], [20, 9, 0.6], [-18, 14, 0.6]], { mat: grassM });

    /* ---- far bell towers and a far cog, black against the band ---- */
    // each a smaller echo of the spire: a stepped mound, a squat drum, a wider cornice and a cap
    const farTower = (x, z, ap, tall) => {
      const gy = Math.min(h(x, z), h(x + ap * 2, z), h(x - ap * 2, z));
      oct(x, z, ap * 2.2, gy - 1, gy + 0.9, far, { res: 0.34 });
      oct(x, z, ap * 1.5, gy, gy + 1.8, far, { res: 0.34 });
      oct(x, z, ap, gy + 1, gy + tall, far, { res: 0.32 });
      oct(x, z, ap * 1.25, gy + tall, gy + tall + 0.5, far, { res: 0.3 });
      S.lathe([x, gy + tall + 0.45, z], ap * 1.1, t => ap * 0.9 * (1 - t) + 0.12, far, { res: 0.3 });
    };
    farTower(-40, -44, 1.5, 4.6);
    farTower(30, -60, 1.3, 4.0);
    S.extrude(gearLoops({ R: 7, Ri: 5.6, n: 16, th: 1.1, tw: 0.5, skip: [3, 4, 11] }), [44, h(44, -6) - 1.5, -6], 1.6, far, { ax: frameW(norm([-1, 0, 0.6])), res: 0.32 });

    /* ---- the start, the wisps ---- */
    ctx.spawn([START[0], h(START[0], START[1]), START[1]], Math.PI);
    // the combat run's foe zones (lib/zones.mjs): they add nothing to the scenery, only to the JSON
    ctx.zone('B1'); ctx.zone('B2'); ctx.zone('B3'); ctx.zone('B4');
    ctx.wisp([CLOCK[0], h(CLOCK[0], CLOCK[1]) + 1.6, CLOCK[1]]); // over the clock's hub
    ctx.wisp([EAST[0] + 1.6, h(EAST[0] + 1.6, EAST[1] + 1.6) + 1.1, EAST[1] + 1.6]); // at the lookout on the east hill
    ctx.wisp([WHEEL[0] + 1.5, h(WHEEL[0] + 1.5, WHEEL[1] - 1.5) + 1.1, WHEEL[1] - 1.5]); // behind the great wheel

    /* ---- the sky: near-black overhead, a maroon to blood-red band low down, the sun behind the belfry, cloud bars, ash ---- */
    ctx.glow(({ B }) => {
      const sk = ramp('skyband'), dk = ramp('sky')[0], fg = ramp('fog')[0];
      const dir = (a, e) => [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
      const at = (a, e, R) => { const d = dir(a, e); return [EYE[0] + d[0] * R, EYE[1] + d[1] * R, EYE[2] + d[2] * R]; };
      // as the start eye sees it: the spire's bearing. The sky the first picture shows is a short band, from just under level (the page's
      // top edge) down to the knoll at about -0.13. A disc much bigger than that band reads as fire round the tower, not a sun; so the sun
      // is a whole disc inside the band, level with the bell and a little left of the spire. The belfry's arch opens on its hot heart, so
      // the bell hangs black in it, and a fat crescent of it shows past the tower's left shoulder.
      const dx = C[0] - EYE[0], dz = C[1] - EYE[2], hd = Math.hypot(dx, dz);
      const sunR = 0.062, az = Math.atan2(dx, -dz) - 0.034, el = Math.atan2(F + 2.9 - EYE[1], hd) + 0.006;
      // the dome, drawn behind everything
      const n = 340, ga = Math.PI * (3 - Math.sqrt(5)), rad = 230;
      for (let k = 0; k < n; k++) {
        const y = 1 - (2 * (k + 0.5)) / n, r = Math.sqrt(1 - y * y), a = k * ga, d = [Math.cos(a) * r, y, Math.sin(a) * r];
        const c = d[1] < -0.02 ? fg : d[1] < 0.12 ? sk[1] : d[1] < 0.3 ? sk[0] : dk;
        B.iso(EYE[0] + d[0] * rad, EYE[1] + d[1] * rad, EYE[2] + d[2] * rad, rad * 0.17, B.P[c], 0.85, { em: true, nd: true, bk: true });
      }
      // the band: rings of long low splats round the horizon, reddest toward the sun
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * Math.PI * 2, w = Math.cos(a - az) + B.rr(-0.12, 0.12), R = 205;
        const rows = w > 0.55 ? [[-0.1, sk[2]], [-0.07, sk[3]], [-0.04, sk[3]], [-0.012, sk[3]], [0.018, sk[2]], [0.05, sk[2]], [0.09, sk[1]]]
          : w > -0.1 ? [[-0.1, sk[1]], [-0.06, sk[2]], [-0.025, sk[2]], [0.01, sk[2]], [0.05, sk[1]], [0.09, sk[1]]]
          : [[-0.08, sk[1]], [-0.03, sk[1]], [0.02, sk[1]], [0.07, sk[0]]];
        for (const [e, c] of rows) {
          const p = at(a + B.rr(-0.01, 0.01), e + B.rr(-0.004, 0.004), R);
          B.axial(p[0], p[1], p[2], [Math.cos(a), 0, Math.sin(a)], 6.5, 3.6, B.P[c], 0.8, { em: true, nd: true });
        }
      }
      // the sun: a disc laid flat to the eye
      const D = 180, rm = D * Math.tan(sunR), u = dir(az, el), M = [EYE[0] + u[0] * D, EYE[1] + u[1] * D, EYE[2] + u[2] * D];
      const rt = norm([-u[2], 0, u[0]]), upv = cross(rt, u);
      // (a hot orange middle, orange-red, and a blood-red rim)
      const sp = rm * 0.08;
      for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
        const a = (i + (j % 2) * 0.5) * sp, b = j * sp * 0.87, q = (a * a + b * b) / (rm * rm);
        if (q > 0.96) continue;
        B.iso(M[0] + rt[0] * a + upv[0] * b, M[1] + rt[1] * a + upv[1] * b, M[2] + rt[2] * a + upv[2] * b, sp * 0.62, B.P[q < 0.3 ? fire[3] : q < 0.8 ? fire[2] : fire[1]], 3, { em: true, nd: true });
      }
      // a soft glow round it, a little wider than tall
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2, p = add(add(M, rt, Math.cos(a) * rm * 1.9 + rm * 0.3), upv, Math.sin(a) * rm * 1.1);
        B.iso(p[0] + u[0] * 6, p[1] + u[1] * 6, p[2] + u[2] * 6, rm * 0.9, B.P[sk[3]], 0.35, { em: true, nd: true });
      }
      // two ragged bars of cloud across it, running off to the left: each a run of short dark puffs, thick in the middle and torn thin at
      // the ends, a little up and down, with a gap or two (straight even bars read as a fault in the picture, not as cloud)
      for (const [off, x0, x1, th] of [[0.36, -2.4, 0.3, 0.085], [-0.34, -3.0, -0.1, 0.07]]) {
        const c = add(add(M, upv, off * rm), u, -8), n = 16, seg = ((x1 - x0) * rm) / n;
        for (let k = 0; k <= n; k++) {
          const f = k / n;
          if (k > 1 && k < n - 1 && B.rr(0, 1) < 0.14) continue;
          const t = Math.pow(Math.sin(Math.PI * f), 0.6) * B.rr(0.65, 1.15), dy = B.rr(-0.3, 0.3) * th * rm + Math.sin(f * 5 + off * 9) * th * rm * 0.5;
          B.axial(...add(add(c, rt, x0 * rm + seg * k), upv, dy), rt, seg * B.rr(0.7, 1.0), Math.max(0.25, th * rm * t), B.P[sk[1]], 1, { em: true, nd: true });
        }
      }
      // long dark streaks of cloud higher up, the low ones lit red from under near the sun
      for (let i = 0; i < 26; i++) {
        const a = az + B.rr(-1.6, 1.6), e = B.rr(0.06, 0.26), R = 200, p = at(a, e, R), near = Math.cos(a - az) > 0.8 && e < 0.13;
        B.axial(p[0], p[1], p[2], [Math.cos(a), 0, Math.sin(a)], B.rr(12, 22), B.rr(1.2, 2.4), B.P[near ? sk[2] : sk[B.pick([0, 0, 1])]], 0.85, { em: true, nd: true });
      }
      // a few dim stars, high up only
      for (let i = 0; i < 40; i++) {
        const p = at(B.rr(0, Math.PI * 2), B.rr(0.4, 1.3), 220);
        B.iso(p[0], p[1], p[2], B.rr(0.3, 0.5), B.P[B.pick([sk[3], st[4]])], 3, { em: true, nd: true });
      }
      // ash and sparks on the wind
      lib.motes(B, 60, [-26, 26, -1, 9, -30, 30], [sk[3], lit[1]], 0.03);
    });
  }
};
