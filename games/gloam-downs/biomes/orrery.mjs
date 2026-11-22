// The Orrery Isles: the third place of the Gilt Lattice. In deep night you stand on a floating isle of marble. Below, a sea of amber
// grid lines runs out to hills, and the grid climbs the hills too. Wire solids stand on the grid. Six more isles float at different
// heights, joined by bridges and floating blocks. The last isle hangs inside a great armillary sphere of gold rings, and the beacon
// burns at its centre, where an orrery puts the sun.
//
// Sources (see openspec/changes/add-gloam-downs-renaissance/design.md): the armillary sphere (horizon ring, meridian ring, equator,
// the ecliptic band tilted 23.4°, the tropics and the polar circles); Leonardo's solid-edge polyhedra for Pacioli (the wire solids on
// the grid); the floor grid of digital art that runs to the horizon (dabs along each line, a darker tone and wider spacing far away,
// after Ben Golus and Inigo Quilez); voxel breakup as a dissolve (a noise value against a threshold that moves down the column, with a
// lit rim at the cut); sfumato (the sky bands, with dithered edges). All forms here are our own.
import { yawAx } from '../lib/props.mjs';
import { lib, tile } from '../lib/common.mjs';

const SEA = -4;
/* The isles. c: the centre [x, z]; r: the radius of the top; top: the floor's height; depth: from the bottom of the top slab to the tip
   of the rock under it. The start isle stands high, so the follow camera at the start sees the summit and the sphere under its eye
   line (the start camera looks 0.3 down, and the top of its view is only about 2° over the level) */
const I = {
  I0: { c: [0, 26], r: 5, top: 9.5, depth: 6.4 },
  I1: { c: [-10, 14], r: 4.5, top: 6.5, depth: 5.6 },
  I2: { c: [6, 6], r: 5, top: 5.0, depth: 5.2 },
  I3: { c: [-7.15, -3.1], r: 4, top: 7.5, depth: 5.0 },
  I4: { c: [9, -10], r: 4.5, top: 9.0, depth: 5.6 },
  I5: { c: [0, -24], r: 7, top: 11.0, depth: 5.4 },
  I6: { c: [-18, 2], r: 2.5, top: 5.5, depth: 4.0 }
};
// the armillary sphere round the summit isle: its centre and radius. The isle's floor is near its middle, and the beacon is at its centre
const ARM = { c: [0, 11.5, -24], R: 8 };
// the stepping cubes from I2 to I3: 1.2 m cubes, 0.5 apart, three south along x = 3 and three west along z = -2.5
const CUBE = { s: 1.2, gap: 0.5 };
const START = [0, 23.4];

const V3 = {
  add: (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k]
};
// a frame whose second axis is n (Ink Studio's torus, lathe and band take their axis as the frame's second row)
const frameFor = n => {
  n = V3.norm(n);
  const t = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], U = V3.norm(V3.cross(t, n));
  return [U, n, V3.cross(U, n)];
};
// turn v about the unit axis k by angle a (Rodrigues)
const rot = (v, k, a) => {
  const c = Math.cos(a), s = Math.sin(a), d = v[0] * k[0] + v[1] * k[1] + v[2] * k[2], x = V3.cross(k, v);
  return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)];
};

// the regular and semi-regular solids as unit vertex lists and edges (shortest vertex pairs)
const SOLIDS = (() => {
  const phi = (1 + Math.sqrt(5)) / 2, V = {}, E = {};
  const perms = v => {
    const out = [];
    for (const p of [[0, 1, 2], [1, 2, 0], [2, 0, 1]]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const q = [v[p[0]] * sx, v[p[1]] * sy, v[p[2]] * sz];
      if (!out.some(o => Math.hypot(o[0] - q[0], o[1] - q[1], o[2] - q[2]) < 1e-6)) out.push(q);
    }
    return out;
  };
  V.cube = perms([1, 1, 1]);
  V.icosahedron = perms([0, 1, phi]);
  V.dodecahedron = [...perms([1, 1, 1]), ...perms([0, 1 / phi, phi])];
  V.rhombicuboctahedron = perms([1, 1, 1 + Math.SQRT2]);
  for (const k of Object.keys(V)) {
    const vs = V[k], r = Math.hypot(...vs[0]);
    let m = Infinity;
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) m = Math.min(m, Math.hypot(vs[i][0] - vs[j][0], vs[i][1] - vs[j][1], vs[i][2] - vs[j][2]));
    E[k] = [];
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++)
      if (Math.hypot(vs[i][0] - vs[j][0], vs[i][1] - vs[j][1], vs[i][2] - vs[j][2]) < m * 1.01) E[k].push([i, j]);
    V[k] = vs.map(v => v.map(c => c / r));
  }
  return { V, E };
})();
/* a solid's vertices, turned so that one vertex (or the middle of one edge, edge: true) points straight down, then turned about y by
   yaw, scaled by r and set down with its lowest point at y0 */
function standing(kind, c, r, y0, { edge = false, yaw = 0 } = {}) {
  const vs = SOLIDS.V[kind];
  let low = vs[0];
  if (edge) { const [i, j] = SOLIDS.E[kind][0]; low = V3.norm([(vs[i][0] + vs[j][0]) / 2, (vs[i][1] + vs[j][1]) / 2, (vs[i][2] + vs[j][2]) / 2]); }
  const to = [0, -1, 0], ax = V3.cross(low, to), s = Math.hypot(...ax), a = Math.atan2(s, low[0] * to[0] + low[1] * to[1] + low[2] * to[2]);
  const k = s > 1e-9 ? V3.scale(ax, 1 / s) : [1, 0, 0];
  const P = vs.map(v => rot(rot(v, k, a), [0, 1, 0], yaw).map(q => q * r));
  const lo = Math.min(...P.map(p => p[1]));
  return P.map(p => [c[0] + p[0], y0 + p[1] - lo, c[1] + p[2]]);
}

export default {
  id: 'orrery',
  name: 'The Orrery Isles',
  sub: 'Isles of marble hang over the grid, under a sphere of gold rings',
  hint: 'Cross the isles to the sphere. Light the beacon.',
  seed: 71,
  run: false,
  set: 'lattice',
  palette: [
    ['sky', [0x02040c]],
    ['skyband', [0x06101e, 0x0c1c32, 0x16304a, 0x234866]],
    ['fog', [0x0a1626]],
    ['ink', [0x010206]],
    ['shade', [0x03050a]],
    ['rock', [0x0e0d12, 0x1d1a20, 0x302a30, 0x4a4046]],
    ['marble', [0x1a1e2a, 0x2e3446, 0x4c5468, 0x767e94]],
    ['turf', [0x081010, 0x0f1c1a, 0x182a26]],
    ['gold', [0x3a2410, 0x74501e, 0xc08a34, 0xf0c862]],
    ['grid', [0x2a1806, 0x5a3410, 0x9a5c1a]],
    ['star', [0x7a86b8, 0xb8c4f0]]
  ],
  // high cold moonlight from behind the start: the isle tops are lit and their undersides are dark
  light: { sun: [0.4, 0.75, 0.5], amb: 0.12, sky: 0.2, sunK: 0.45, shK: 6 },
  fog: { color: 'fog', far: 96, start: 0.45, max: 0.85 },
  dither: 0.45,
  outline: 0.5,
  // the march starts 18 over the ground, over the highest isle (the grid sea is at -4)
  walk: { half: 34, opts: { above: 18 } },
  hills: {
    base: SEA,
    bumps: [
      [36, 0, 14, 12], [33, 22, 14, 10], [24, 36, 14, 9], [0, 39, 14, 11], [-24, 35, 14, 10], [-35, 18, 14, 12],
      [-37, -6, 14, 10], [-32, -26, 14, 13], [-14, -38, 14, 11], [10, -39, 14, 14], [30, -30, 14, 12], [38, -12, 14, 10]
    ],
    fbm: { amp: 0.3, freq: 1 / 9, oct: 3 },
    warp: { amp: 4, freq: 1 / 26 },
    far: { amp: 9, start: 46, end: 80 },
    flats: [{ at: [0, 0], box: [27, 27], blend: 8, y: SEA }],
    box: [-112, 112, -112, 112]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
    const mb = ramp('marble'), rk = ramp('rock'), gd = ramp('gold'), gr = ramp('grid'), tf = ramp('turf'), sk = ramp('skyband'), st = ramp('star');
    // a broad tone wander and a fine grain; marble gets thin cool veins
    const grain = (k = 1) => (x, y, z) => k * (0.1 * (B.n3(x * 0.5, z * 0.5, y * 0.3 + 3) - 0.5) + 0.08 * (B.n3(x * 2.8, y * 2.8, z * 2.8) - 0.5));
    const veins = (k = 1) => {
      const g = grain(k);
      return (x, y, z) => g(x, y, z) - (Math.abs(B.n3(x * 0.9 + y * 0.4, z * 0.9, y * 0.7) - 0.5) < 0.035 ? 0.12 * k : 0);
    };
    const marble = { r: mb, g: [mb[2]], mod: veins(0.9) };
    const gold = { r: gd, g: [gd[1]] };
    const wire = { r: [gr[2]], em: true }; // the wire solids glow amber: light drawn in the air where the solid form is missing
    const far = { r: [mb[0], mb[1]], mod: grain(0.4) };

    /* ---- the ground: the grid sea, dark turf at its first step; the hills round it in the turf ramp ---- */
    {
      const seaR = (x, y, z) => (y < SEA + 0.25 ? [tf[0], tf[0], tf[1]] : null);
      const near = { r: tf, mod: grain(1.1), rf: seaR };
      const mid = { r: tf, mod: grain(1.2), fat: 0.85, rf: seaR }, out = { r: tf.slice(0, 2), mod: grain(1.3), fat: 0.95 };
      const N = [-34, 34, -34, 34], M = [-64, 64, -64, 64], F = [-110, 110, -110, 110];
      tile(S, h, near, { x0: N[0], x1: N[1], z0: N[2], z1: N[3], res: 0.5 });
      const ring = (o, i, res, mat) => {
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: o[2], z1: i[2], res });
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: i[3], z1: o[3], res });
        tile(S, h, mat, { x0: o[0], x1: i[0], z0: i[2], z1: i[3], res });
        tile(S, h, mat, { x0: i[1], x1: o[1], z0: i[2], z1: i[3], res });
      };
      ring(M, N, 1.1, mid);
      ring(F, M, 2.4, out);
    }

    /* ---- props of this place ---- */
    // a gold fire bowl on a short marble foot; returns the fire's place
    const bowl = (x, z, y, { s = 0.7, lit = true, foot = 0.7 } = {}) => {
      S.lathe([x, y - 0.05, z], foot + 0.05, t => 0.2 + 0.1 * (1 - t), marble, { res: 0.09 });
      S.box([x, y + 0.05, z], [0.32, 0.08, 0.32], marble, { rd: 0.02, res: 0.09 });
      const b = S.ball([x, y + foot + 0.18, z], [0.48, 0.28, 0.48], gold, { hold: true });
      const in_ = S.ball([x, y + foot + 0.34, z], [0.4, 0.26, 0.4], gold, { hold: true });
      S.join('cut', b, in_, { res: 0.085 });
      const p = [x, y + foot + 0.22, z];
      if (lit) ctx.fire(p, s, { k: 0.75, r: 4.2 });
      return p;
    };
    // a wire solid: one tube for each edge and a knot at each vertex, from standing()
    const wireSolid = (kind, P, { mat = wire, thick = 0.12, res = 0.14 } = {}) => {
      for (const [i, j] of SOLIDS.E[kind]) S.tube([P[i], P[j]], thick, thick, mat, { res });
      for (const p of P) S.ball(p, thick * 1.7, mat, { res: 0.11 });
    };
    /* An isle: one turned outline. A flat top of marble paving, a moulded rim, and under it a cone of rock in ledges whose radius falls
       toward a point. The cone stops at a cut, and the rest of it hangs below as loose blocks (voxelTip). Returns the cut */
    const isle = (Q, { cut = 0.28, res = 0.2 } = {}) => {
      const { c: [cx, cz], r, top, depth } = Q, y0 = top - 0.6, tip = y0 - depth;
      const rc = t => r * 0.93 * Math.pow(Math.max(0, t), 0.62);
      const yCut = tip + depth * cut, rCut = rc(cut);
      const pts = [[0, yCut], [rCut, yCut]];
      /* the rock in ledges, as an upside-down stepped pyramid: a straight face up, then a shelf out under the next ledge. The radius
         never falls going up, so a line straight down leaves the rock once (the walk map reads one gap under the isle) */
      const n = Math.max(4, Math.round(depth / 0.8));
      let rp = rCut;
      for (let k = 1; k < n; k++) {
        const t = cut + (1 - cut) * (k / n), y = tip + depth * t, w = 0.92 + 0.12 * B.n3(cx * 0.3 + k, cz * 0.3, 2.2);
        const rn = Math.min(r * 0.92, Math.max(rp + 0.12, rc(t) * w));
        pts.push([rp, y], [rn, y]);
        rp = rn;
      }
      pts.push([rp, y0 - 0.2], [r * 0.94, y0 - 0.2]);
      pts.push([r * 0.94, y0], [r, y0], [r + 0.15, y0 + 0.14], [r + 0.15, y0 + 0.3], [r, y0 + 0.4], [r, top], [0, top]);
      const paving = (x, y, z) => {
        if (y < y0 - 0.05) return null;
        if (y < top - 0.06) return y > y0 + 0.12 && y < y0 + 0.34 ? gd.slice(0, 3) : mb.slice(0, 3);
        const rr = Math.hypot(x - cx, z - cz), a = Math.atan2(z - cz, x - cx), ring = Math.floor(rr / 1.15);
        // the bands are wider than one splat step (0.17 to 0.215), so a ring does not break into dashes
        if (rr < 0.55 || Math.abs(rr - r * 0.6) < 0.12) return gd.slice(1, 4);
        // eight gold rays from the ring to the rim, as the lines of a drawn pavement
        if (rr > r * 0.6 && rr < r - 0.35) { const k = a / (Math.PI / 4); if (Math.abs(k - Math.round(k)) * (Math.PI / 4) * rr < 0.1) return gd.slice(1, 3); }
        const nSec = Math.max(6, Math.round((Math.PI * 2 * (ring + 0.5) * 1.15) / 1.3)), sec = Math.floor(((a / (Math.PI * 2)) + 1) * nSec);
        return (ring + sec) % 2 ? mb.slice(1) : mb.slice(0, 3);
      };
      const rock = (x, y, z) => grain(1.4)(x, y, z) + 0.1 * (B.n3(x * 0.25, y * 1.4, z * 0.25) - 0.5);
      S.revolve([pts], [cx, 0, cz], { r: rk, g: [mb[2]], mod: rock, rf: paving }, { res });
      return { yCut, rCut, ledges: pts.slice(2, -7).filter((p, i) => i % 2 === 1) };
    };
    /* the loose blocks under an isle's cut: a column of 0.6 m cubes on a grid. A block is gone where its noise is under a threshold that
       rises down the column (a dissolve, as in the sources); the blocks that stay drift apart, more with depth. None hangs lower than
       2.0 over the grid sea. In ctx.later: they do not block the feet. A lit amber rim marks the cut */
    const voxelTip = (Q, { yCut, rCut, ledges }) => {
      const [cx, cz] = Q.c, s = 0.6, floor = SEA + 2.0;
      const nL = Math.max(2, Math.min(7, Math.floor((yCut - floor) / s)));
      const blocks = [];
      for (let j = 0; j < nL; j++) {
        const f = j / Math.max(1, nL - 1), rj = Math.max(0.42, rCut * (1 - (j + 0.6) / (nL + 1.2)));
        const m = Math.ceil(rj / s);
        for (let i = -m; i <= m; i++) for (let k = -m; k <= m; k++) {
          const ox = (i + (m % 2 ? 0 : 0.5)) * s, oz = (k + (m % 2 ? 0 : 0.5)) * s;
          if (Math.hypot(ox, oz) > rj + 0.1) continue;
          const nz = B.n3(cx * 0.7 + i * 1.3, cz * 0.7 + k * 1.3, j * 1.7 + 4);
          if (nz < 0.22 + 0.42 * f) continue;
          const sink = j * (0.08 + 0.18 * f) + (nz - 0.5) * 0.3, out = 1 + 0.6 * f;
          const y = Math.max(floor + s * 0.45, yCut - s * (j + 0.5) - sink);
          blocks.push({ x: cx + ox * out, y, z: cz + oz * out, yaw: (nz - 0.5) * 0.5 * f, sc: 0.94 - 0.18 * f, edge: nz > 0.8 });
        }
      }
      ctx.later(() => {
        // the blocks are the rock's own stuff, a step lighter, so they read against the dark underside and the grid
        for (const b of blocks) S.box([b.x, b.y, b.z], [0.3 * b.sc, 0.3 * b.sc, 0.3 * b.sc], { r: [rk[1], rk[2], rk[3], mb[2]], mod: grain(1) }, { ax: yawAx(b.yaw), rd: 0.02, res: 0.2 });
      });
      ctx.glow(({ B }) => {
        const n = Math.max(8, Math.round(rCut * 9));
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; B.iso(cx + Math.cos(a) * (rCut + 0.04), yCut - 0.03, cz + Math.sin(a) * (rCut + 0.04), 0.07, B.P[gr[2]], 3, { em: true, nd: true }); }
        for (const b of blocks) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.iso(b.x + dx * 0.3 * b.sc, b.y - 0.3 * b.sc, b.z + dz * 0.3 * b.sc, 0.06, B.P[gr[2]], 3, { em: true, nd: true });
        // a faint amber line along the outer edge of every other ledge: the rock reads as layers of a stepped, digital form
        ledges.forEach(([lr, ly], i) => {
          if (i % 2) return;
          const n = Math.round((Math.PI * 2 * lr) / 0.42);
          for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; B.iso(cx + Math.cos(a) * (lr + 0.03), ly - 0.02, cz + Math.sin(a) * (lr + 0.03), 0.05, B.P[i % 4 ? gr[1] : gr[2]], 3, { em: true, nd: true }); }
        });
      });
    };

    /* A bridge from isle A to isle B: one solid, the stepped deck on top (level over each isle's edge, then steps of `rise` over the
       open span) and an arched underside, thick at the ends and thin in the middle. A low curb runs along each side over the span.
       Returns the two ends, for the lamps */
    const bridge = (A, Bq, { width = 2.2, rise = 0.3, curb = 0.25 } = {}) => {
      const [ax, az] = A.c, [bx, bz] = Bq.c, d = Math.hypot(bx - ax, bz - az), U = [(bx - ax) / d, 0, (bz - az) / d], Wv = [-U[2], 0, U[0]];
      const t0 = A.r - 1.0, t1 = d - Bq.r + 1.0, s0 = A.r + 0.25, s1 = d - Bq.r - 0.25;
      const ya = A.top, yb = Bq.top, n = Math.max(1, Math.round(Math.abs(yb - ya) / rise)), run = (s1 - s0) / n;
      const lev = k => ya + (yb - ya) * (k / n), e = k => s0 + (k + 0.5) * run;
      const topLine = [[t0, lev(0)]];
      for (let k = 0; k < n; k++) topLine.push([e(k), lev(k)], [e(k), lev(k + 1)]);
      topLine.push([t1, lev(n)]);
      const bottom = [];
      for (let i = 12; i >= 0; i--) {
        const t = t0 + (t1 - t0) * (i / 12), u = (t - t0) / (t1 - t0), line = ya + (yb - ya) * u - Math.max(0, rise * 0.5);
        bottom.push([t, line - 0.42 - 1.6 * Math.pow(1 - Math.sin(Math.PI * u), 1.6)]);
      }
      const joints = (x, y, z) => {
        const along = (x - ax) * U[0] + (z - az) * U[2];
        return veins(0.8)(x, y, z) + ((along / 0.75) % 1 < 0.07 ? -0.1 : 0);
      };
      S.extrude([[...topLine, ...bottom]], [ax, 0, az], width, { ...marble, mod: joints }, { ax: [U, [0, 1, 0], Wv], res: 0.19 });
      // the curbs: the deck's line raised by `curb`, 0.22 wide, over the open span only
      if (curb > 0) {
        const cl = topLine.filter(([t]) => t >= s0 - 0.5 && t <= s1 + 0.5);
        cl.unshift([s0 - 0.5, lev(0)]);
        cl.push([s1 + 0.5, lev(n)]);
        const line = cl.map(([t, y]) => [t, y + curb]), under = cl.slice().reverse().map(([t, y]) => [t, y - 0.2]);
        for (const sd of [-1, 1]) {
          const o = width / 2 - 0.11;
          S.extrude([[...line, ...under]], [ax + Wv[0] * o * sd, 0, az + Wv[2] * o * sd], 0.22, { r: mb.slice(1), g: [mb[2]], mod: grain(0.7) }, { ax: [U, [0, 1, 0], Wv], res: 0.16 });
        }
      }
      const at = (t, w) => [ax + U[0] * t + Wv[0] * w, az + U[2] * t + Wv[2] * w];
      // the deck's height at t along the bridge (the step it is on)
      const deck = t => lev(Math.max(0, Math.min(n, Math.round((t - s0) / run))));
      return { at, s0, s1, ya, yb, width, U, Wv, deck };
    };

    /* A spiral stair from the grid sea up to an isle: wedge steps round a newel, `rise` each, 18 to a turn (so a step is 7 m over the one
       a turn below it). The lowest steps are solid to the ground; the rest float. The head step points at `to` */
    const spiralStair = (c, ro, y0, y1, to, { rise = 0.4, ri = 0.42 } = {}) => {
      const n = Math.round((y1 - y0) / rise), dr = (y1 - y0) / n, da = (Math.PI * 2) / 18, aHead = Math.atan2(to[1] - c[1], to[0] - c[0]);
      const line = [];
      for (let i = 0; i < n; i++) {
        const a = aHead - (n - 1 - i) * da, yt = y0 + (i + 1) * dr, solid = yt < SEA + 2.4, yb = solid ? SEA - 0.3 : yt - 0.42;
        const ol = [];
        const a0 = a - da * 0.5 - 0.05, a1 = a + da * 0.5 + 0.05;
        ol.push([Math.cos(a0) * ri, Math.sin(a0) * ri], [Math.cos(a1) * ri, Math.sin(a1) * ri]);
        for (let k = 0; k <= 4; k++) { const b = a1 + (a0 - a1) * (k / 4); ol.push([Math.cos(b) * ro, Math.sin(b) * ro]); }
        const tread = (x, y, z) => (y > yt - 0.05 ? mb.slice(1) : null);
        S.extrude([ol], [c[0], (yt + yb) / 2, c[1]], yt - yb, { ...marble, rf: tread }, { ax: [[1, 0, 0], [0, 0, 1], [0, 1, 0]], rd: 0.02, res: 0.16 });
        const rm = (ri + ro) / 2;
        line.push([c[0] + Math.cos(a) * rm, c[1] + Math.sin(a) * rm]);
      }
      // the newel: a marble column with a gold cap over the head step
      S.lathe([c[0], SEA - 0.3, c[1]], y1 + 1.1 - SEA + 0.3, t => ri * (1.02 - 0.06 * t), marble, { res: 0.12 });
      S.ball([c[0], y1 + 1.25, c[1]], 0.32, gold, { res: 0.07 });
      ctx.stair(line, ro - ri);
    };
    // a straight flight from a to b ([x, z]), from ya to yb: one solid, the stepped outline pushed out to the width, its foot under the ground
    // arches: [[t along the flight, spring height over the foot, radius], ...] are cut through the solid across its width
    const steps = (a, b, { width, rise = 0.4, ya, yb, mat = marble, res = 0.2, arches = [] }) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), U = [dx / len, 0, dz / len], Wv = [-U[2], 0, U[0]];
      const n = Math.max(2, Math.ceil(Math.abs(yb - ya) / rise - 1e-6)), run = len / n, out = [[0, ya]];
      for (let i = 0; i < n; i++) { const y = ya + (yb - ya) * ((i + 1) / n); out.push([i * run, y], [(i + 1) * run, y]); }
      for (let i = n; i >= 0; i--) {
        const t = Math.min(len, i * run), x = a[0] + U[0] * t, z = a[1] + U[2] * t, w2 = width / 2;
        const g = Math.min(h(x, z), h(x + Wv[0] * w2, z + Wv[2] * w2), h(x - Wv[0] * w2, z - Wv[2] * w2));
        out.push([t, Math.min(g, ya + (yb - ya) * (i / n)) - 0.45]);
      }
      // the treads are a step lighter, with a gold line along the nose of each step, so the long flight reads as steps from afar
      const tread = (x, y, z) => {
        const along = (x - a[0]) * U[0] + (z - a[1]) * U[2], k = Math.floor(along / run), yt = ya + (yb - ya) * ((k + 1) / n);
        if (Math.abs(y - yt) >= 0.06) return null;
        return along - k * run < 0.1 ? gd.slice(1, 3) : mb.slice(1);
      };
      const body = S.extrude([out], [a[0], 0, a[1]], width, { ...mat, rf: tread }, { ax: [U, [0, 1, 0], Wv], res, hold: arches.length > 0 });
      if (arches.length) {
        const holes = [];
        for (const [t, spring, rad] of arches) {
          const x = a[0] + U[0] * t, z = a[1] + U[2] * t, y = ya + spring;
          holes.push(S.lathe([x - Wv[0] * (width / 2 + 0.4), y, z - Wv[2] * (width / 2 + 0.4)], width + 0.8, rad, mat, { ax: [U, Wv, [0, 1, 0]], hold: true }));
          holes.push(S.box([x, (ya - 0.6 + y) / 2, z], [rad, (y - ya + 0.6) / 2, width / 2 + 0.4], mat, { ax: [U, [0, 1, 0], Wv], hold: true }));
        }
        S.join('cut', body, holes, { res, inner: mb.slice(0, 3) });
      }
      ctx.stair([a, b], width);
    };
    // a balustrade along an arc of radius R round c, on floor y, from angle a0 to a1: a plinth, vase balusters, a rail, in pieces
    const vase = t => (t < 0.1 ? 1 : t > 0.88 ? 0.85 : 0.42 + 0.6 * Math.exp(-(((t - 0.36) / 0.19) ** 2)));
    const balustrade = (c, R, y, a0, a1, { hgt = 0.85 } = {}) => {
      const L = R * (a1 - a0), np = Math.max(1, Math.round(L / 1.4)), nb = Math.max(2, Math.round(L / 0.46));
      for (let i = 0; i < np; i++) {
        const a = a0 + (a1 - a0) * ((i + 0.5) / np), len = R * (a1 - a0) / np, x = c[0] + Math.cos(a) * R, z = c[1] + Math.sin(a) * R;
        const yaw = -a; // yawAx(-a) lays the box's long (z) axis along the tangent [-sin a, 0, cos a]
        S.box([x, y + 0.08, z], [0.2, 0.1, len / 2 + 0.03], marble, { ax: yawAx(yaw), rd: 0.03, res: 0.13 });
        S.box([x, y + hgt - 0.07, z], [0.19, 0.08, len / 2 + 0.05], marble, { ax: yawAx(yaw), rd: 0.03, res: 0.13 });
      }
      for (let i = 0; i < nb; i++) {
        const a = a0 + (a1 - a0) * ((i + 0.5) / nb);
        S.lathe([c[0] + Math.cos(a) * R, y + 0.17, c[1] + Math.sin(a) * R], hgt - 0.3, u => 0.12 * vase(u), marble, { res: 0.1 });
      }
    };

    /* ---- the isles, and the loose blocks under them ---- */
    for (const Q of Object.values(I)) voxelTip(Q, isle(Q, { res: Q === I.I0 ? 0.17 : 0.215 }));

    /* ---- the ways between the isles ---- */
    const b01 = bridge(I.I0, I.I1, { width: 2.2, rise: 0.3 });
    const b12 = bridge(I.I1, I.I2, { width: 2.2, rise: 0.3 });
    const b16 = bridge(I.I1, I.I6, { width: 2.0, rise: 0.3 });
    const b34 = bridge(I.I3, I.I4, { width: 2.2, rise: 0.3 });
    const b45 = bridge(I.I4, I.I5, { width: 2.4, rise: 0.4 });
    // the lamps: a gold bowl beside the mouth of each bridge, eight in all
    {
      const lampAt = (b, t, side, y) => { const p = b.at(t, side * (b.width / 2 + 0.75)); bowl(p[0], p[1], y); };
      lampAt(b01, b01.s0 - 0.9, 1, b01.ya);
      lampAt(b01, b01.s1 + 0.9, -1, b01.yb);
      lampAt(b12, b12.s1 + 0.9, 1, b12.yb);
      lampAt(b16, b16.s1 + 0.9, 1, b16.yb);
      lampAt(b34, b34.s0 - 0.9, -1, b34.ya);
      lampAt(b34, b34.s1 + 0.9, 1, b34.yb);
      lampAt(b45, b45.s1 + 0.9, -1, b45.yb);
      lampAt(b45, b45.s1 + 0.9, 1, b45.yb);
    }
    // the stepping cubes from I2 to I3: they rise in seven even steps from I2's floor to I3's
    const cubes = [];
    {
      const { s, gap } = CUBE, sp = s + gap, rise = (I.I3.top - I.I2.top) / 7;
      const z1 = I.I2.c[1] - Math.sqrt(I.I2.r ** 2 - (3 - I.I2.c[0]) ** 2) - gap - s / 2;
      const at = [[3, z1], [3, z1 - sp], [3, z1 - 2 * sp], [3 - sp, z1 - 2 * sp], [3 - 2 * sp, z1 - 2 * sp], [3 - 3 * sp, z1 - 2 * sp]];
      at.forEach(([x, z], k) => {
        const top = I.I2.top + rise * (k + 1);
        cubes.push([x, top, z]);
        const face = (px, y, pz) => (y > top - 0.05 ? mb.slice(1) : Math.abs(y - (top - s * 0.5)) < 0.05 ? gd.slice(1, 3) : null);
        S.box([x, top - s / 2, z], [s / 2, s / 2, s / 2], { ...marble, rf: face }, { rd: 0.03, res: 0.12 });
      });
      // a lit amber dot at each top corner: the cubes read as blocks of the grid lifted into the air
      ctx.glow(({ B }) => { for (const [x, y, z] of cubes) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.iso(x + a * s * 0.5, y + 0.02, z + b * s * 0.5, 0.06, B.P[gr[2]], 3, { em: true, nd: true }); });
    }
    // the ways back up from the grid sea: a spiral stair to I1 and a straight stair to I2
    {
      const dir = [-0.95, 0.31], l = Math.hypot(...dir), D = 7.25, c = [I.I1.c[0] + dir[0] / l * D, I.I1.c[1] + dir[1] / l * D];
      spiralStair(c, 2.85, SEA, I.I1.top, I.I1.c, { rise: 0.4 });
      const hx = I.I2.c[0] + I.I2.r - 0.4;
      steps([hx + 9.7, I.I2.c[1]], [hx, I.I2.c[1]], { width: 2.4, rise: 0.4, ya: SEA, yb: I.I2.top, res: 0.22, arches: [[4.35, 1.6, 1.05], [7.25, 3.2, 1.05]] });
    }

    /* ---- the start isle: a balustrade along the south half of the rim, broken for the bridge to I1. The start is 2.6 m from that
       rim and faces it, so without it the first step forward drops the lamplighter 13 m to the grid sea. A jump still clears it.
       The north half stays open (the budget) ---- */
    {
      const R = I.I0.r - 0.25, aOut = Math.atan2(I.I1.c[1] - I.I0.c[1], I.I1.c[0] - I.I0.c[0]), half = 0.52;
      balustrade(I.I0.c, R, I.I0.top, aOut + half, 0.35);
      balustrade(I.I0.c, R, I.I0.top, -Math.PI - 0.35, aOut - half);
    }

    /* ---- the summit: a ring balustrade broken for the stair bridge, a round plinth of two steps, a gold bowl for the beacon ---- */
    {
      const [sx, sz] = I.I5.c, y = I.I5.top, aIn = Math.atan2(I.I4.c[1] - sz, I.I4.c[0] - sx), half = Math.asin(1.75 / 6.45);
      balustrade(I.I5.c, 6.45, y, aIn + half, aIn + Math.PI * 2 - half);
      const rose = (x, yy, z) => {
        if (yy < y + 0.35) return null;
        const r = Math.hypot(x - sx, z - sz), a = Math.atan2(z - sz, x - sx), sec = Math.floor((a / (Math.PI * 2)) * 16 + 16);
        if (yy > y + 0.75) return r < 0.9 ? gd.slice(1, 4) : sec % 2 ? mb.slice(1) : mb.slice(0, 3);
        return mb.slice(1);
      };
      S.revolve([[[0, y - 0.3], [2.9, y - 0.3], [2.9, y + 0.4], [2.2, y + 0.4], [2.2, y + 0.8], [0, y + 0.8]]], [sx, 0, sz], { ...marble, rf: rose }, { res: 0.13 });
      S.torus([sx, y + 0.8, sz], 2.2, 0.06, gold, { res: 0.08 });
      // the beacon's bowl: a low gold dish on a short foot
      S.lathe([sx, y + 0.75, sz], 0.18, t => 0.34 - 0.08 * t, gold, { res: 0.08 });
      const dish = S.ball([sx, y + 1.05, sz], [0.62, 0.2, 0.62], gold, { hold: true }), hol = S.ball([sx, y + 1.16, sz], [0.54, 0.18, 0.54], gold, { hold: true });
      S.join('cut', dish, hol, { res: 0.07 });
      ctx.beacon([sx, y + 1.0, sz], 1.7);
    }

    /* ---- the armillary sphere round the summit, in ctx.later. The polar axis leans 38° toward the north-west; the meridian holds
       it; the equator, the two tropics and the two polar circles stand square to it; the ecliptic band leans 23.4° from the equator,
       with gold ticks along it; the horizon ring lies level through the centre. The beacon burns at the centre as the orrery's sun ---- */
    {
      const C = ARM.c, R = ARM.R, tube = 0.24, deg = Math.PI / 180, eps = 23.44 * deg;
      const hz = V3.norm([-0.42, 0, -0.91]), up = [0, 1, 0], A = V3.norm(V3.add(V3.scale(up, Math.cos(38 * deg)), hz, Math.sin(38 * deg)));
      const m = V3.norm(V3.cross(up, hz)); // the meridian's normal: level, square to the plane of the axis
      const E = V3.norm(rot(A, m, eps));
      /* where a ring would cross the stair bridge in the lamplighter's way (within its width and 0.5 more, from 0.4 under the deck to
         2.1 over it), the ring stops in a gold knob, and its two ends lift a little apart: a gap in the gold, as the set's breaks */
      const inWay = p => {
        const b = b45, t = (p[0] - I.I4.c[0]) * b.U[0] + (p[2] - I.I4.c[1]) * b.U[2], w = (p[0] - I.I4.c[0]) * b.Wv[0] + (p[2] - I.I4.c[1]) * b.Wv[2];
        if (t < b.s0 - 1.2 || t > b.s1 + 1.5 || Math.abs(w) > b.width / 2 + 0.5) return false;
        const y = b.deck(t);
        return p[1] > y - 0.4 && p[1] < y + 2.1;
      };
      // a ring as a list of arcs: [centre, axis, radius] -> arcs of points, split where the ring is in the way
      const arcs = (c, n, r, k = 0.3) => {
        const [U, , W] = frameFor(n), cnt = Math.ceil((Math.PI * 2 * r) / k), pts = [];
        for (let i = 0; i < cnt; i++) { const a = (i / cnt) * Math.PI * 2; pts.push(V3.add(V3.add(c, U, Math.cos(a) * r), W, Math.sin(a) * r)); }
        const free = pts.map(p => !inWay(p));
        if (free.every(Boolean)) return [[...pts, pts[0]]];
        const s0 = free.indexOf(false), out = [];
        let run = [];
        for (let j = 1; j <= cnt; j++) {
          const i = (s0 + j) % cnt;
          if (free[i]) run.push(pts[i]);
          else if (run.length) { out.push(run); run = []; }
        }
        if (run.length) out.push(run);
        return out.filter(a => a.length > 1);
      };
      // the rings: [centre, axis, radius, tube]
      const rings = [[C, m, R + 0.05, tube * 1.15], [C, A, R, tube]];
      for (const sg of [-1, 1]) {
        rings.push([V3.add(C, A, sg * R * Math.sin(eps)), A, R * Math.cos(eps), tube * 0.8]);
        rings.push([V3.add(C, A, sg * R * Math.cos(eps)), A, R * Math.sin(eps), tube * 0.8]);
      }
      /* a faceted band: short flat boxes round a circle (the horizon ring and the ecliptic), each square to its radius, so the band
         reads as cut facets, as in the perspective studies; the boxes in the way are left out */
      const facets = (c, n, r, hr, hy, k = 0.8) => {
        const [U, , W] = frameFor(n), N = Math.round((Math.PI * 2 * r) / k), out = [];
        for (let i = 0; i < N; i++) {
          const a = ((i + 0.5) / N) * Math.PI * 2, rd = V3.add(V3.scale(U, Math.cos(a)), W, Math.sin(a)), tg = V3.cross(n, rd), p = V3.add(c, rd, r);
          if (inWay(p) || inWay(V3.add(p, tg, k / 2)) || inWay(V3.add(p, tg, -k / 2))) continue;
          out.push({ p, rd, tg, h: [hr, hy, (Math.PI * r) / N + 0.02] });
        }
        return out;
      };
      const horizon = facets(C, up, R + 0.35, 0.34, 0.08), ecl = facets(C, E, R - 0.02, 0.1, 0.34);
      const ringArcs = rings.map(([c, n, r, t]) => ({ t, list: arcs(c, n, r) }));
      // a gilded line along the outer face of each ring and band: the gold leaf catches the light, so the sphere reads from the start
      ctx.glow(({ B }) => {
        const dot = (p, col) => B.iso(p[0], p[1], p[2], 0.075, B.P[col], 3, { em: true, nd: true });
        rings.forEach(([c, n, r, t]) => { for (const a of arcs(c, n, r + t * 0.9, 0.32)) for (const p of a) dot(p, gd[2]); });
        for (const f of horizon) for (const s of [-0.5, 0, 0.5]) dot(V3.add(V3.add(f.p, f.rd, f.h[0] + 0.02), f.tg, s * f.h[2] * 1.4), gd[2]);
        for (const f of ecl) dot(V3.add(f.p, f.rd, f.h[0] + 0.03), gd[1]);
      });
      ctx.later(() => {
        for (const { t, list } of ringArcs) for (const a of list) {
          S.tube(a, t, t, gold, { res: 0.24 });
          const closed = a.length > 2 && a[0] === a[a.length - 1];
          if (!closed) for (const e of [a[0], a[a.length - 1]]) S.ball(e, t * 1.9, gold, { res: 0.1 });
        }
        for (const f of horizon) S.box(f.p, f.h, gold, { ax: [f.rd, up, f.tg], rd: 0.02, res: 0.24 });
        for (const f of ecl) S.box(f.p, f.h, gold, { ax: [f.rd, E, f.tg], rd: 0.02, res: 0.22 });
        // the ticks: 36 small boxes on the ecliptic's outer face, every third one longer
        const [Ue, , We] = frameFor(E);
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2, rd = V3.add(V3.scale(Ue, Math.cos(a)), We, Math.sin(a)), tg = V3.cross(E, rd), long = i % 3 === 0, p = V3.add(C, rd, R + 0.14);
          if (!inWay(p)) S.box(p, [0.07, long ? 0.3 : 0.16, 0.09], { r: [gd[2], gd[3]] }, { ax: [rd, E, tg], res: 0.07 });
        }
        // the polar axis: two rods from the poles toward the centre (they stop short of the beacon and of the isle), with gold knobs
        S.tube([V3.add(C, A, R + 1.3), V3.add(C, A, 3.0)], 0.14, 0.14, gold, { res: 0.12 });
        S.tube([V3.add(C, A, -(R + 1.3)), V3.add(C, A, -(R - 0.6))], 0.14, 0.14, gold, { res: 0.12 });
        for (const sg of [-1, 1]) S.ball(V3.add(C, A, sg * (R + 1.4)), 0.42, gold, { res: 0.09 });
      });
    }

    /* ---- the wire solids on the grid sea, standing on a vertex or an edge (in ctx.later, so the lamplighter walks through them) ---- */
    ctx.later(() => {
      wireSolid('dodecahedron', standing('dodecahedron', [12, 16], 2.5, SEA, { yaw: 0.4 }));
      wireSolid('icosahedron', standing('icosahedron', [-16, -12], 2.2, SEA, { yaw: 1.1 }));
      wireSolid('rhombicuboctahedron', standing('rhombicuboctahedron', [16, -22], 2.0, SEA, { yaw: 0.3 }));
      wireSolid('cube', standing('cube', [-20, 22], 1.8, SEA, { edge: true, yaw: 0.7 }));
    });

    /* ---- far isles in the fog ---- */
    for (const [a, d, y, r] of [[-0.55, 72, 14, 5], [0.7, 84, 22, 6.5], [-1.9, 66, 8, 4], [2.3, 78, 18, 5.5]]) {
      const x = Math.sin(a) * d, z = -Math.cos(a) * d;
      S.revolve([[[0, y - r * 1.2], [r * 0.35, y - r * 0.8], [r * 0.7, y - r * 0.4], [r, y - 0.4], [r, y], [0, y]]], [x, 0, z], far, { res: 0.5 });
    }

    /* ---- the start, the wisps ---- */
    // the start stands near the north rim of the first isle, so the follow camera looks over the edge to the grid sea and the isles
    ctx.spawn([START[0], I.I0.top + 0.13, START[1]], Math.PI);
    ctx.wisp([12, SEA + 1.1, 13]); // on the grid sea beside the dodecahedron
    ctx.wisp([cubes[3][0], cubes[3][1] + 1.1, cubes[3][2]]); // over the fourth stepping cube
    ctx.wisp([I.I6.c[0], I.I6.top + 1.1, I.I6.c[1]]); // on the side isle
    {
      // on a stack of two marble cubes on I4: too high to touch from the isle's floor
      const [x, z] = [I.I4.c[0] + 1.6, I.I4.c[1] - 2.4], y = I.I4.top;
      S.box([x, y + 0.2, z], [0.62, 0.25, 0.62], marble, { rd: 0.03, res: 0.11 });
      S.box([x + 0.15, y + 0.67, z - 0.1], [0.42, 0.22, 0.42], { ...marble, rf: (px, py) => (py > y + 0.85 ? gd.slice(1, 4) : null) }, { rd: 0.03, res: 0.1 });
      ctx.wisp([x + 0.15, y + 0.9 + 1.2, z - 0.1]);
    }
    ctx.wisp([-14, SEA + 1.1, -20]); // on the grid sea in the far west, under the summit

    /* ---- what glows: the grid, the sky, the stars and their lines, the great wire icosahedron, motes ---- */
    const eye = [START[0], I.I0.top + 0.13 + 1 + 9 * Math.sin(0.3), START[1] + 9 * Math.cos(0.3)];
    ctx.glow(({ B }) => {
      // grid lines: dabs along each line on the ground, laid along the slope. Far away the spacing doubles and the tone falls a step
      const dab = (x, z, dir, len, w) => {
        const y = h(x, z), e = 0.3, dy = dir[0] ? (h(x + e, z) - h(x - e, z)) / (2 * e) : (h(x, z + e) - h(x, z - e)) / (2 * e);
        const d = V3.norm([dir[0], dy, dir[2]]), dist = Math.hypot(x - eye[0], z - eye[2]);
        const c = dist < 40 ? gr[2] : dist < 62 ? gr[1] : gr[0];
        B.axial(x, y + 0.08, z, d, len, w + dist * 0.0016, B.P[c], 3, { em: true, nd: true });
      };
      const lines = (lo, hi, step, gap, len, w, skip) => {
        for (let x = Math.ceil(lo / step) * step; x <= hi + 1e-6; x += step) for (let z = lo; z <= hi + 1e-6; z += gap) if (!skip(x, z)) dab(x, z, [0, 0, 1], len, w);
        for (let z = Math.ceil(lo / step) * step; z <= hi + 1e-6; z += step) for (let x = lo; x <= hi + 1e-6; x += gap) if (!skip(x, z)) dab(x, z, [1, 0, 0], len, w);
      };
      // the sea and its first slopes: every 2 m
      lines(-34, 34, 2, 0.45, 0.36, 0.05, () => false);
      // the hills out to 60: every 4 m. The dabs overlap, so each line reads whole up the slope and not as loose sticks
      lines(-60, 60, 4, 0.7, 0.78, 0.07, (x, z) => Math.max(Math.abs(x), Math.abs(z)) <= 34);

      // four sfumato bands of cold blue, the lowest and lightest at the horizon. Each band edge is broken by scattered dabs of both tones
      const dk = ramp('sky')[0], edges = [0.0, 0.035, 0.075, 0.13], tones = [sk[3], sk[2], sk[1], sk[0], dk];
      const toneAt = e => { let i = 0; while (i < edges.length && e > edges[i]) i++; return i; };
      B.sky(d => tones[toneAt(d[1])], 230);
      const dir = (a, e) => [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
      for (let i = 0; i < 260; i++) for (let j = 0; j < 12; j++) {
        const a = (i / 260) * Math.PI * 2 + B.rr(-0.01, 0.01), e = -0.05 + j * 0.017 + B.rr(-0.009, 0.009), p = dir(a, e), R = 182;
        let k = toneAt(Math.sin(e) + eye[1] / 230);
        const ee = Math.sin(e) + eye[1] / 230, lo = k ? edges[k - 1] : -1, hi = k < edges.length ? edges[k] : 2, f = (ee - lo) / (hi - lo);
        if (f < 0.35 && k > 0 && B.rr(0, 1) < 0.5 - f) k--; else if (f > 0.65 && k < edges.length && B.rr(0, 1) < f - 0.5) k++;
        B.iso(eye[0] + p[0] * R, eye[1] + p[1] * R, eye[2] + p[2] * R, 3.0, B.P[tones[k]], 2.0, { em: true, nd: true });
      }
      // 120 stars; some are joined by faint lines into figures of our own, so the sky reads as a diagram
      const stars = [];
      for (let i = 0; i < 120; i++) {
        const a = B.rr(0, Math.PI * 2), e = B.rr(0.08, 1.3), r = 195, p = [Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r];
        stars.push(p);
        B.iso(p[0], p[1], p[2], B.rr(0.25, 0.5), B.P[B.pick([st[0], st[0], st[1]])], 3, { em: true, nd: true });
      }
      for (let i = 0; i < 120; i += 4) {
        const p = stars[i];
        let best = -1, bd = 1e9;
        for (let j = 0; j < 120; j++) { if (j === i) continue; const d = Math.hypot(p[0] - stars[j][0], p[1] - stars[j][1], p[2] - stars[j][2]); if (d < bd) { bd = d; best = j; } }
        if (bd > 60) continue;
        const q = stars[best], n = Math.ceil(bd / 2.2);
        for (let k = 1; k < n; k++) { const t = k / n; B.iso(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t, 0.22, B.P[sk[3]], 2.2, { em: true, nd: true }); }
      }
      // the great wire icosahedron, far off in the north-west sky
      {
        const a = -0.62, e = 0.16, D = 160, cen = V3.add(eye, dir(a, e), D), r = 30;
        const vs = SOLIDS.V.icosahedron.map(v => rot(rot(v, [1, 0, 0], 0.5), [0, 1, 0], 0.3)).map(v => V3.add(cen, v, r));
        for (const [i, j] of SOLIDS.E.icosahedron) {
          const p = vs[i], q = vs[j], L = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), n = Math.ceil(L / 1.1);
          for (let k = 0; k <= n; k++) { const t = k / n; B.iso(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t, 0.75, B.P[sk[3]], 2.6, { em: true, nd: true }); }
        }
        // small knots: a big pale disc at the frame's edge reads as a moon, and this sky has none
        for (const p of vs) B.iso(p[0], p[1], p[2], 0.85, B.P[st[0]], 3, { em: true, nd: true });
      }
      // amber motes over the grid sea
      lib.motes(B, 90, [-26, 26, SEA + 0.3, SEA + 4, -28, 24], [gr[1], gr[2]], 0.04);
    });
  }
};
