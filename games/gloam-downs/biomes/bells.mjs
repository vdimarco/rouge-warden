// The Bell Knoll: a bronze bell tower on a round knoll at a blood-red dusk. You stand on a hill to the south and look across a low vale
// at the knoll. It climbs in two grass terraces to a stepped stone plinth, and on the plinth stands an octagonal spire with an open belfry
// and one huge bell in it. The sun is going down right behind the belfry, so the bell hangs black in a red disc. Giant bronze cogs lie
// half sunk in the slopes: one stands like a gate on the path up, one great spoked wheel rises out of the knoll's west side, and one lies
// tilted on the east hill so its rim makes a path. A fallen cracked bell lies in the vale, a broken clock face lies on the west hill,
// and pendulum frames and rusted chains stand about. Maroon sky, violet shadow, rust-brown grass, bronze, and fire.
//
// The follow camera looks down at a low pitch, so the top of its first picture is about level with its eye. Anything higher is cut off.
// So the knoll's terrace sits a little under the start, the spire is kept short enough to fit, and the beacon stands on a raised dais
// at the spire's foot, so it is still more than 2 above the start.
import { rocks, shrubs, yawAx } from '../lib/props.mjs';
import { lib, polyDist, tile } from '../lib/common.mjs';

// heights
const YS = 6.0; // the start
const T1 = 2.3, T2 = 3.6; // the knoll's two grass terraces
const F = YS - 1.5; // the stone terrace round the spire
const START = [0, 27];
const C = [-1, -9]; // the spire
const AP = { step: 6.1, deck: 5.3, drum: 2.2 }; // apothems of the plinth's lower step, the terrace, the spire's drum
const R1 = 12.4, R2 = 9.0; // radii of the grass terraces
// the walked line: down off the start hill, across the vale, up the south-east slope through the cog gate, round the first terrace
const PATH = [[0, 34], [0, 27], [-0.4, 22.5], [0.2, 18], [1.2, 14], [1.6, 10], [3.0, 6.8], [5.0, 4.0], [6.5, 1.4], [8.2, -1.6], [9.6, -5.2], [10.2, -9]];
// round the second terrace from the east stair to the plinth stair
const PATH2 = [[6.4, -9], [5.4, -4.4], [2.4, -1.8], [-1.6, -1.2], [-4.6, -2.6]];
// a side path east from the vale to the tilted cog on the east hill
const SPUR = [[2.2, 9.2], [5.4, 8.8], [7.2, 7.0]];
const GATE = [6.5, 1.4]; // the cog gate
const WHEEL = [-9.8, 0.4]; // the great wheel on the knoll's west side
const EAST = [16.2, 0.2]; // the lookout on the east hill
const CLOCK = [-13.5, 8.5]; // the clock face on the west hill
const FALLEN = [-5.0, 6.6]; // the fallen bell at the knoll's foot, under the spire as the start sees it
// the start camera's eye (preview: 9 back, pitch 0.3), to hang the sun right behind the belfry
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
    ['bronze', [0x1c1208, 0x3a2810, 0x664818, 0x987024, 0xc89a38, 0xeac466]],
    ['verd', [0x141c1a, 0x22302b]],
    ['rust', [0x1a0a07, 0x3a1709, 0x5c2a12]]
  ],
  // the key light is a low red sun from the north-west, so the faces turned to it go red and the rest stays violet; the sun you see
  // hangs due north behind the belfry (the light is set for form, not to match it exactly)
  light: { sun: [-0.55, 0.3, -0.78], amb: 0.11, sky: 0.15, sunK: 0.55, shK: 7 },
  fog: { color: 'fog', far: 72, start: 0.5, max: 0.88 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 34 },
  hills: {
    base: 0.6,
    bumps: [
      [0, 33, 13, 5.6], // the start's hill
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
    pits: [[0, 12, 9, 0.6]], // the vale
    flats: [
      { at: START, r: 2.4, blend: 4, y: YS },
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
    const stone = { r: st, s: [st[2], lit[0], lit[1], lit[2]], g: warmStone, mod: laid(0.8) };
    const rough = { r: st, s: [st[2], lit[0], lit[1], lit[2]], g: warmStone, mod: grit(0.9) };
    const dark = { r: st.slice(0, 3), mod: grit(0.6) };
    const far = { r: st.slice(0, 2), mod: grit(0.5) };
    // bronze: dark in shadow, brass where the sun catches it, green-crusted in patches
    const bronzeG = [br[0], br[1], br[3], fire[2], fire[3], fire[4]];
    const crust = s => (x, y, z) => (B.n3(x * s + 2, y * s, z * s + 5) > 0.66 ? verd : null);
    // grime on old bronze: a soft tone wander, a fine grain, and small dark pits
    const grime = (x, y, z) => 0.55 * (0.16 * (B.n3(x * 0.7, y * 0.7, z * 0.7 + 3) - 0.5) + 0.14 * (B.n3(x * 3, y * 3, z * 3) - 0.5)) - (B.n3(x * 2.4 + 4, y * 2.4, z * 2.4) > 0.72 ? 0.1 : 0);
    // (faces turned up, the tops of teeth and the walked rims, are worn brighter)
    const bronze = { r: br.slice(0, 4), s: br.slice(2, 6), g: bronzeG, mod: grime, top: { min: 0.85, r: br.slice(1, 5), s: br.slice(2, 6), g: bronzeG, mod: grime } };
    // the cog you walk on: its whole face is turned up, so only a little brighter than plain bronze
    const walked = { r: br.slice(0, 4), s: br.slice(1, 5), g: bronzeG, mod: grime, top: { min: 0.85, r: br.slice(0, 4), s: br.slice(1, 4), g: bronzeG, mod: grit(0.8) } };
    const bell = { r: br.slice(0, 4), s: br.slice(1, 6), g: bronzeG, mod: grit(0.35) };
    const oldBell = { ...bell, rf: crust(1.1) };
    const iron = { r: rust, g: [rust[0], rust[1], rust[2], fire[1], fire[2], fire[3]], mod: grit(0.4) };
    const enamel = { r: [st[3], st[3], st[4]], s: [st[3], lit[1], lit[2]], g: warmStone, mod: grit(0.6) };
    const black = { r: [rust[0], br[0]], g: [rust[0], rust[1], fire[1]] };
    const grassM = { r: grass.slice(0, 4), s: [grass[2], lit[0], lit[1]], mod: grit(1) };

    /* ---- the ground: a fine rectangle over the play area, then strips coarser each time out ---- */
    {
      // worn flagstones on the paths, set stones on the terraces close round the spire
      const onPath = (x, z) => Math.min(polyDist(x, z, PATH) - 0.1, polyDist(x, z, PATH2) - 0.2, polyDist(x, z, SPUR) - 0.25) + 0.7 * (B.n3(x * 1.1, z * 1.1, 4) - 0.5) < 1.0;
      const flags = (x, y, z) => grit(0.8)(x, y, z) + ((Math.floor(x / 0.9) + Math.floor(z / 0.9)) % 2 ? -0.06 : 0.04);
      const g1 = grit(1);
      const near = {
        r: grass, s: [grass[2], grass[3], lit[0], lit[1]], g: [grass[1], grass[2], rust[2], fire[1], fire[2], fire[3]],
        mod: (x, y, z) => (onPath(x, z) ? flags(x, y, z) : g1(x, y, z)),
        rf: (x, y, z) => (onPath(x, z) ? st.slice(0, 4) : null)
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
      ring(Fr, M, 1.5, out);
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
      const outer = S.lathe(m, H, t => R * bellR(t), mat, { ax, maxRadius: R, hold: true });
      const cuts = [];
      if (hollow) cuts.push(S.lathe(add(m, up, -0.05), H * 0.8, t => Math.max(0.05, R * bellR(Math.max(0, (t * H * 0.8 - 0.05) / H)) - R * 0.13), mat, { ax, maxRadius: R, hold: true }));
      if (crack) {
        // a slanted split up from the lip, and a bite out of the lip beside it
        const a = crack.a, side = add([0, 0, 0], U, Math.cos(a)), sd = add(side, W, Math.sin(a));
        const p = add(add(m, sd, R * 0.92), up, H * 0.28), Y = norm(add(up, cross(up, sd), 0.35));
        cuts.push(S.box(p, [0.07, H * 0.32, R * 0.3], mat, { ax: [cross(Y, sd), Y, sd], hold: true }));
        cuts.push(S.ball(add(add(m, sd, R * 0.95), cross(up, sd), R * 0.32), R * 0.3, mat, { hold: true }));
      }
      S.join('cut', outer, cuts, { res, inner: br.slice(0, 2) });
      // a bead round the lip and a band at the shoulder
      S.torus(add(m, up, H * 0.05), R * 0.95, R * 0.06, mat, { ax, res: res * 0.9 });
      S.torus(add(m, up, H * 0.83), R * 0.53, R * 0.045, mat, { ax, res: res * 0.9 });
      // the crown loop
      S.torus(add(m, up, H + R * 0.12), R * 0.2, R * 0.07, mat, { ax: [U, W, up].map(v => v), res: res * 0.8 });
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
    post(C[0] + 10.4, C[1] - 1.7);

    /* ---- the plinth and the spire ---- */
    const [cx, cz] = C;
    {
      // two stepped stone tiers: the lower step, then the terrace the spire stands on
      oct(cx, cz, AP.step, T2 - 1.4, F - 0.6, stone, { res: 0.16 });
      oct(cx, cz, AP.deck, F - 1.2, F, stone, { res: 0.16 });
      // the stair up the plinth from the second terrace, on the south-west
      const dir = norm([-0.42, 0, 0.9]);
      stair([cx + dir[0] * 7.5, cz + dir[2] * 7.5], [cx + dir[0] * 4.6, cz + dir[2] * 4.6], { width: 2.3, ya: T2, yb: F, rise: 0.3 });
      // the drum: solid, too tall to jump onto
      oct(cx, cz, AP.drum, F - 0.4, F + 1.6, stone, { res: 0.12 });
      oct(cx, cz, AP.drum + 0.18, F + 1.45, F + 1.75, rough, { res: 0.1 });
      // the belfry: an octagon cut through by two arched passages, north-south and east-west, leaving four fat corner piers
      const yb = F + 1.75, spring = F + 2.9, ar = 1.3, ytop = F + 4.45;
      const body = oct(cx, cz, AP.drum, yb, ytop, stone, { hold: true });
      const holes = [];
      for (const along of ['z', 'x']) {
        const hx = along === 'x' ? 3 : ar, hz = along === 'z' ? 3 : ar;
        holes.push(S.box([cx, (yb - 0.2 + spring) / 2, cz], [hx, (spring - yb + 0.2) / 2, hz], dark, { hold: true }));
        const e = along === 'x' ? [3, 0, 0] : [0, 0, 3];
        holes.push(S.tube([[cx - e[0], spring, cz - e[2]], [cx + e[0], spring, cz + e[2]]], ar, ar, dark, { hold: true }));
      }
      S.join('cut', body, holes, { res: 0.11, inner: st.slice(0, 2) });
      // a cornice, two stepped roofs, a squat cap and a bronze finial
      oct(cx, cz, AP.drum + 0.36, ytop - 0.05, ytop + 0.32, rough, { res: 0.11 });
      oct(cx, cz, 1.6, ytop + 0.3, ytop + 0.75, stone, { res: 0.11 });
      oct(cx, cz, 1.0, ytop + 0.7, ytop + 1.05, stone, { res: 0.1 });
      S.lathe([cx, ytop + 1.0, cz], 0.45, t => 0.62 * (1 - t) + 0.08, rough, { res: 0.09 });
      S.ball([cx, ytop + 1.55, cz], 0.18, bronze, { res: 0.06 });
      // the bell, its headstock on a beam across the east-west passage, and its clapper
      S.box([cx, F + 4.12, cz], [AP.drum - 0.1, 0.17, 0.2], bronze, { rd: 0.04, res: 0.08 });
      bellAt([cx, F + 2.15, cz], [0, 1, 0], 0.86, 1.72, { hollow: true, res: 0.07 });
      S.ball([cx, F + 2.05, cz], 0.2, iron, { res: 0.05 });
      // the beacon: a fire bowl on a stone post on a raised dais, at the terrace's south-east corner
      const bd = [cx + 4.1 * Math.cos(0.35), cz + 4.1 * Math.sin(0.35)];
      oct(bd[0], bd[1], 1.25, F - 0.3, F + 0.42, rough, { res: 0.1 });
      oct(bd[0], bd[1], 1.05, F + 0.38, F + 0.84, rough, { res: 0.1 });
      oct(bd[0], bd[1], 0.85, F + 0.8, F + 1.25, rough, { res: 0.1 });
      oct(bd[0], bd[1], 0.3, F + 1.2, F + 2.6, stone, { res: 0.08 });
      ctx.beacon(bowl(bd[0], bd[1], { y: F + 2.6, lit: false }), 1.7);
      // a fire bowl on the terrace's south-west corner, the beacon's partner
      bowl(cx - 3.1, cz + 3.1, { y: F, s: 0.9 });
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
      // lean the cog to the slope: its normal from the hill's own fall, a little straighter
      const e = 1.5, gx = (h(c[0] + e, c[2]) - h(c[0] - e, c[2])) / (2 * e), gz = (h(c[0], c[2] + e) - h(c[0], c[2] - e)) / (2 * e);
      const n = norm([-gx * 0.85, 1, -gz * 0.85]);
      c[1] = h(c[0], c[2]) + 0.15;
      cog(c, frameW(n), { R: 4.7, Ri: 2.9, n: 14, th: 0.6, tw: 0.5, skip: [6] }, { depth: 1.0, res: 0.14, mat: walked });
    }

    /* ---- the fallen bell in the vale: on its side, cracked, its mouth turned to the path ---- */
    {
      const [fx, fz] = FALLEN, gy = h(fx, fz), R = 1.75, H = 3.3;
      const up = norm([-0.6, 0.06, -0.8]); // from the mouth to the crown: the mouth is turned three-quarters to the start
      const m = [fx + 0.9, gy + R * 0.82, fz + 1.2];
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

    /* ---- chains from the spire's cornice down to stakes on the terraces, east and west ---- */
    ctx.later(() => {
      for (const s of [-1, 1]) {
        const top = [cx + s * (AP.drum + 0.3), F + 4.4, cz - 0.9], sx = cx + s * 7.6, sz = cz - 6.2, sy = h(sx, sz);
        chain(top, [sx, sy + 0.6, sz], { sag: 1.6 });
      }
    });
    for (const s of [-1, 1]) {
      const sx = cx + s * 7.6, sz = cz - 6.2, sy = h(sx, sz);
      S.tube([[sx, sy - 0.3, sz], [sx, sy + 0.8, sz]], 0.2, 0.14, iron, { res: 0.06 });
    }

    /* ---- the start: a stone stub and a half-buried cog at the brow ---- */
    {
      const sx = 3.4, sz = 23.8, sy = h(sx, sz);
      oct(sx, sz, 0.5, sy - 0.4, sy + 0.75, dark, { res: 0.1 });
      S.box([sx + 0.2, sy + 0.85, sz - 0.1], [0.42, 0.14, 0.38], dark, { ax: yawAx(0.4), rd: 0.04, res: 0.08 });
      ctx.later(() => chain([sx + 0.2, sy + 0.9, sz - 0.1], [sx + 1.4, h(sx + 1.4, sz - 4.5) + 0.2, sz - 4.5], { sag: 0.5 }));
      const cg = [-3.4, h(-3.4, 23.2) - 0.7, 23.2];
      cog(cg, frameW(norm([0.6, 0, 1])), { R: 1.7, Ri: 0.9, n: 8, th: 0.45, tw: 0.55, skip: [] }, { depth: 0.6, res: 0.1 });
      // a low ring of iron in the grass with a fire in it: warm light by the start that does not block the view
      const fx = 1.9, fz = 25.4, fy = h(fx, fz);
      S.torus([fx, fy + 0.08, fz], 0.62, 0.16, iron, { res: 0.06 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; S.ball([fx + Math.cos(a) * 0.62, fy + 0.2, fz + Math.sin(a) * 0.62], [0.2, 0.14, 0.2], rough, { res: 0.06 }); }
      ctx.fire([fx, fy + 0.18, fz], 0.7, { k: 0.7, r: 3.6 });
    }

    /* ---- braziers and fire posts along the way ---- */
    post(10.9, -3.8);
    post(-5.6, -2.2);
    bowl(-1, -20.5, { s: 0.9 });
    bowl(8.8, -22.4, { s: 0.85 });

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
    farTower(42, -46, 1.3, 4.0);
    S.extrude(gearLoops({ R: 7, Ri: 5.6, n: 16, th: 1.1, tw: 0.5, skip: [3, 4, 11] }), [44, h(44, -6) - 1.5, -6], 1.6, far, { ax: frameW(norm([-1, 0, 0.6])), res: 0.32 });

    /* ---- the start, the wisps ---- */
    ctx.spawn([START[0], h(START[0], START[1]), START[1]], Math.PI);
    ctx.wisp([CLOCK[0], h(CLOCK[0], CLOCK[1]) + 1.6, CLOCK[1]]); // over the clock's hub
    ctx.wisp([EAST[0] + 1.6, h(EAST[0] + 1.6, EAST[1] + 1.6) + 1.1, EAST[1] + 1.6]); // at the lookout on the east hill
    ctx.wisp([WHEEL[0] + 1.5, h(WHEEL[0] + 1.5, WHEEL[1] - 1.5) + 1.1, WHEEL[1] - 1.5]); // behind the great wheel
    ctx.wisp([cx, h(cx, cz - 9.6) + 1.1, cz - 9.6]); // on the first terrace behind the spire

    /* ---- the sky: near-black overhead, a maroon to blood-red band low down, the sun behind the belfry, cloud bars, ash ---- */
    ctx.glow(({ B }) => {
      const sk = ramp('skyband'), dk = ramp('sky')[0], fg = ramp('fog')[0];
      const dir = (a, e) => [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
      const at = (a, e, R) => { const d = dir(a, e); return [EYE[0] + d[0] * R, EYE[1] + d[1] * R, EYE[2] + d[2] * R]; };
      // as the start eye sees it: the bell's bearing and height
      const bell = [C[0], F + 3.0, C[1]], dx = bell[0] - EYE[0], dz = bell[2] - EYE[2], hd = Math.hypot(dx, dz);
      const az = Math.atan2(dx, -dz), el = Math.atan2(bell[1] - EYE[1], hd) - 0.006;
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
      // the sun: a big disc laid flat to the eye, a dull red rim and a hotter middle
      const D = 180, rm = D * 0.1, u = dir(az, el), M = [EYE[0] + u[0] * D, EYE[1] + u[1] * D, EYE[2] + u[2] * D];
      const rt = norm([-u[2], 0, u[0]]), upv = cross(rt, u);
      // (its hottest middle sits right behind the bell, so the bell reads black)
      const sp = rm * 0.08;
      for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
        const a = (i + (j % 2) * 0.5) * sp, b = j * sp * 0.87, q = (a * a + b * b) / (rm * rm);
        if (q > 0.96) continue;
        B.iso(M[0] + rt[0] * a + upv[0] * b, M[1] + rt[1] * a + upv[1] * b, M[2] + rt[2] * a + upv[2] * b, sp * 0.62, B.P[q < 0.1 ? fire[3] : q < 0.7 ? fire[2] : fire[1]], 3, { em: true, nd: true });
      }
      // a soft glow round it
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2, p = add(add(M, rt, Math.cos(a) * rm * 1.5), upv, Math.sin(a) * rm * 1.2);
        B.iso(p[0] + u[0] * 6, p[1] + u[1] * 6, p[2] + u[2] * 6, rm * 0.7, B.P[sk[3]], 0.35, { em: true, nd: true });
      }
      // dark cloud bars across its lower half
      for (const [off, len, th] of [[-0.42, 1.7, 0.07], [-0.66, 2.3, 0.06], [-0.14, 1.1, 0.045]]) {
        const c = add(add(M, upv, off * rm), u, -8);
        for (let k = -2; k <= 2; k++) B.axial(...add(c, rt, k * rm * len * 0.4), rt, rm * len * 0.32, rm * th, B.P[sk[1]], 1, { em: true, nd: true });
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
