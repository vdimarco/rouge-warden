// The Vanishing Piazza: the first place of the Gilt Lattice. You stand on a marble belvedere at the south end of a long square at
// dusk. Two arcades run north and close in, and each bay is smaller than the one before, so the square looks much longer than it is.
// At the far end a round temple with a dome of gold wire stands on a stepped podium, and a low gold sun with a punched halo sits beside
// it. The checkered floor thins out into a lit cyan grid toward the podium, and loose tiles rise out of the floor at its edges.
//
// Sources (see openspec/changes/add-gloam-downs-renaissance/design.md): the cube bay of the Ospedale degli Innocenti (column height
// equals the bay's spacing and depth); the ideal-city panels (a paved square whose lines meet at a round building); forced perspective
// as in Borromini's gallery at Palazzo Spada (the bays shrink and the lines close in); Leonardo's solid-edge polyhedra for Pacioli (the
// wire solids); Piero della Francesca's mazzocchio (the faceted ring); sfumato (the sky bands); and the floor grid of digital art that
// runs to a vanishing point (grid lines drawn as dabs, with wider spacing and a darker tone far away, after Ben Golus and Inigo Quilez).
// All forms here are our own.
import { yawAx } from '../lib/props.mjs';
import { lib, tile } from '../lib/common.mjs';

// heights of the levels
const Y = { start: 5.0, square: 0, pit: -1.2, t1: 1.6, t2: 3.2, t3: 4.4, floor: 5.2 };
const START = [0, 25.6];
const BZ = 23.7; // the belvedere's north edge
const TX = 6.4; // the stair of lifted tiles east of the square
// the podium: the front face of each terrace (z), and the temple's centre
const T1Z = -10.6, T2Z = -15.6, T3Z = -20.6;
const TC = [0, -27.6];
// the arcades: from z 18 north, nine bays, the first 5.0, each 0.92 of the one before; the inner line closes in from x 12.5 to 7.5
const ARC = { z0: 18, n: 9, first: 5.0, shrink: 0.92, xa: 12.5, xb: 7.5, wire: 2 };
// where the start camera's eye is (preview: 9 back, pitch 0.3)
const EYE_UP = 1 + 9 * Math.sin(0.3), EYE_BACK = 9 * Math.cos(0.3);

// the bays of one arcade: side -1 (west) or 1 (east). Each bay: its two inner corners, its spacing s, its direction d and outward n
function bays(side) {
  const { z0, n, first, shrink, xa, xb } = ARC;
  const s = [...Array(n)].map((_, i) => first * shrink ** i), L = s.reduce((a, b) => a + b, 0);
  const at = z => [side * (xa + (xb - xa) * (z0 - z) / L), z];
  const out = [];
  let z = z0;
  for (let i = 0; i < n; i++) {
    const a = at(z), b = at(z - s[i]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], nv = [side * -d[1], side * d[0]];
    out.push({ i, a, b, s: s[i], len, d, n: nv, yaw: Math.atan2(d[0], d[1]), hc: [first * shrink ** i, first * shrink ** (i + 1)] });
    z -= s[i];
  }
  return out;
}
// the parts of a bay's height: the arch springs from the lower column's top, the crown, the top of the wall, the roof
function bayLevels(b) {
  const rc = 0.075 * b.s, spring = b.hc[1] + 0.14 * rc, ra = b.len / 2 - rc * 1.05;
  const crown = spring + ra, top = crown + 0.1 * b.s, roof = top + 0.13 * b.s;
  return { rc, spring, ra, crown, top, roof };
}
// x of the arcade's inner line at z (inside the square), and of its outer line
const innerX = z => ARC.xa + (ARC.xb - ARC.xa) * (ARC.z0 - z) / 32.98;
const outerX = z => innerX(z) + ARC.first * Math.max(0.47, 1 - 0.0161 * (ARC.z0 - z));

export default {
  id: 'piazza',
  name: 'The Vanishing Piazza',
  sub: 'A marble square whose arcades run to one point of gold',
  hint: 'Walk to the round temple. Light the beacon.',
  seed: 61,
  run: false,
  set: 'lattice',
  palette: [
    ['sky', [0x07061a]],
    ['skyband', [0x120c2a, 0x241640, 0x3e1f52, 0x6a2c5c, 0x9a4458]],
    ['fog', [0x2a1e3c]],
    ['ink', [0x05040c]],
    ['shade', [0x08060f]],
    ['marble', [0x1a1826, 0x2e2b3e, 0x4a4560, 0x6e6884, 0x8c86a0]],
    ['verde', [0x0b1614, 0x16261f, 0x24392c]],
    ['gold', [0x3a2410, 0x74501e, 0xc08a34, 0xf0c862]],
    ['grid', [0x0e2a44, 0x1c5a86, 0x3c9ad0]],
    ['turf', [0x0a0c12, 0x141a20, 0x1f2a2a]],
    ['sun', [0xc8763a, 0xf2c66a]]
  ],
  // the key light is the dusk afterglow from the west, over the left shoulder at the start. The sun you see sits low in the north
  // beside the temple: the light is set for form, not to match it
  light: { sun: [-0.7, 0.35, 0.45], amb: 0.13, sky: 0.18, sunK: 0.5, shK: 7 },
  fog: { color: 'fog', far: 84, start: 0.5, max: 0.86 },
  dither: 0.45,
  outline: 0.42,
  walk: { half: 34 },
  hills: {
    base: 0,
    bumps: [
      [24, 6, 12, 3.5], [-24, 6, 12, 3.5], [22, -14, 11, 4.5], [-22, -14, 11, 4.5],
      [0, -26, 15, 3.4], // the podium's hill, under the terraces (the terraces are solid)
      [0, 38, 16, 6], [-12, 32, 10, 4], [12, 32, 10, 4], // the hill behind the belvedere
      [-40, -36, 18, 5], [40, -34, 18, 6],
      [0, -96, 72, -12] // the land falls away north, so the temple stands against the sky
    ],
    fbm: { amp: 0.6, freq: 1 / 11, oct: 3 },
    warp: { amp: 3, freq: 1 / 22 },
    far: { amp: 7, start: 40, end: 66 },
    flats: [
      { at: [0, 1.5], box: [17.5, 16.5], blend: 3, y: Y.square }, // the square and the floors of the arcades
      { at: [-6, -6], box: [3, 3], blend: 1.5, y: Y.pit }, // the sunken grid: its sides are ramps
      { at: [0, 32.6], box: [10, 3.0], blend: 4, y: Y.start - 0.3 } // the turf round the back of the belvedere
    ],
    box: [-112, 112, -112, 112]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
    const mb = ramp('marble'), vd = ramp('verde'), gd = ramp('gold'), gr = ramp('grid'), tf = ramp('turf');
    // a broad tone wander and a fine grain; marble gets thin cool veins
    const grain = (k = 1) => (x, y, z) => k * (0.1 * (B.n3(x * 0.5, z * 0.5, y * 0.3 + 3) - 0.5) + 0.08 * (B.n3(x * 2.8, y * 2.8, z * 2.8) - 0.5));
    const veins = (k = 1) => {
      const g = grain(k);
      return (x, y, z) => g(x, y, z) - (Math.abs(B.n3(x * 0.9 + y * 0.4, z * 0.9, y * 0.7) - 0.5) < 0.035 ? 0.12 * k : 0);
    };
    // laid marble: veins, and fine joints between courses
    const coursed = (ch = 0.7, k = 0.8) => {
      const g = veins(k);
      return (x, y, z) => {
        const c = y / ch, f = c - Math.floor(c), u = ((x + z) / 1.4 + Math.floor(c) * 0.5) % 1;
        return g(x, y, z) + (f < 0.07 || (u + 1) % 1 < 0.04 ? -0.1 : 0);
      };
    };
    const marble = { r: mb, g: [mb[2]], mod: veins(0.9) };
    const wallM = { r: mb.slice(0, 4), g: [mb[1]], mod: coursed(0.75, 0.8) };
    const dark = { r: mb.slice(0, 2), mod: grain(0.6) };
    const gold = { r: gd, g: [gd[1]] };
    const wire = { r: [gd[2]], em: true }; // the wire glows: gold light drawn in the air, where the solid form is missing
    const far = { r: [mb[0], mb[1]], mod: grain(0.4) };

    /* ---- the ground: the checkered square, the grid that the floor thins into, marble on the belvedere, dark turf round it ---- */
    const tileKept = (x, z) => {
      if (z > 4) return true;
      const ix = Math.floor(x / 2), iz = Math.floor(z / 2), t = Math.min(1, (4 - (iz * 2 + 1)) / 18);
      return B.n3(ix * 0.71 + 0.3, iz * 0.71 + 0.6, 5.5) > t * 1.05 - 0.02;
    };
    const inSquare = (x, z) => z < 18.6 && z > -16 && Math.abs(x) < outerX(Math.min(18, Math.max(-15, z))) + 0.3;
    const floorRamp = (x, y, z) => {
      if (inSquare(x, z) && Math.abs(y) < 0.35) {
        if (!tileKept(x, z)) return tf;
        return (Math.floor(x / 2) + Math.floor(z / 2)) % 2 === 0 ? mb.slice(1) : vd;
      }
      if (y < Y.pit + 0.5 && Math.abs(x + 6) < 4.5 && Math.abs(z + 6) < 4.5) return [tf[0], tf[0], tf[1]];
      return tf;
    };
    {
      const near = { r: tf, g: [mb[2]], mod: grain(1.1), rf: floorRamp };
      const mid = { r: tf, mod: grain(1.2), fat: 0.85 }, out = { r: tf.slice(0, 2), mod: grain(1.3), fat: 0.95 };
      const N = [-22, 22, -34, 37], M = [-56, 56, -56, 56], F = [-108, 108, -108, 108];
      const Q = [-18, 18, -34, 31]; // the square, the podium and the belvedere at 0.32; the rest of the near rectangle at 0.45
      tile(S, h, near, { x0: Q[0], x1: Q[1], z0: Q[2], z1: Q[3], res: 0.32 });
      tile(S, h, near, { x0: N[0], x1: Q[0], z0: N[2], z1: N[3], res: 0.45 });
      tile(S, h, near, { x0: Q[1], x1: N[1], z0: N[2], z1: N[3], res: 0.45 });
      tile(S, h, near, { x0: Q[0], x1: Q[1], z0: Q[3], z1: N[3], res: 0.45 });
      const ring = (o, i, res, mat) => {
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: o[2], z1: i[2], res });
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: i[3], z1: o[3], res });
        tile(S, h, mat, { x0: o[0], x1: i[0], z0: i[2], z1: i[3], res });
        tile(S, h, mat, { x0: i[1], x1: o[1], z0: i[2], z1: i[3], res });
      };
      ring(M, N, 0.9, mid);
      ring(F, M, 2.0, out);
    }

    /* ---- props of this place ---- */
    // a column: square plinth, a round base, a shaft with entasis, a cushion capital and a square abacus. Returns its top
    const column = (x, z, { hgt, r, y = 0, mat = marble, yaw = 0, res = 0.11 }) => {
      const ph = r * 0.9;
      S.box([x, y + ph / 2 - 0.2, z], [r * 1.4, ph / 2 + 0.2, r * 1.4], mat, { ax: yawAx(yaw), rd: 0.04, res });
      S.torus([x, y + ph + r * 0.12, z], r * 1.08, r * 0.2, mat, { res });
      const sh = hgt - ph - r * 0.7;
      S.lathe([x, y + ph, z], sh, t => r * (1 - 0.12 * t * t), mat, { res });
      S.ball([x, y + ph + sh + r * 0.1, z], [r * 1.25, r * 0.42, r * 1.25], mat, { res });
      S.box([x, y + hgt - r * 0.14, z], [r * 1.38, r * 0.14, r * 1.38], mat, { ax: yawAx(yaw), rd: 0.02, res });
      return y + hgt;
    };
    // a vase baluster profile: a foot, a full belly low down, a thin neck, a cap
    const vase = t => (t < 0.1 ? 1 : t > 0.88 ? 0.85 : 0.42 + 0.6 * Math.exp(-(((t - 0.36) / 0.19) ** 2)));
    // a balustrade from a to b ([x, z]) on floor y: a plinth, vase balusters every 0.35, a rail
    const balustrade = (a, b, { y, hgt = 0.85, mat = marble }) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      S.box([c[0], y + 0.08, c[1]], [0.2, 0.1, len / 2], mat, { ax: yawAx(yaw), rd: 0.03, res: 0.09 });
      S.box([c[0], y + hgt - 0.07, c[1]], [0.19, 0.08, len / 2 + 0.05], mat, { ax: yawAx(yaw), rd: 0.03, res: 0.09 });
      const n = Math.max(2, Math.round(len / 0.35));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        S.lathe([a[0] + dx * t, y + 0.17, a[1] + dz * t], hgt - 0.3, u => 0.12 * vase(u), mat, { res: 0.065 });
      }
    };
    // a run of marble steps from a to b ([x, z]), from ya to yb, each `rise` high: one solid, the stepped outline pushed out to the
    // stair's width, its foot under the ground (a box for each step would draw the hidden fronts and backs of every step)
    const steps = (a, b, { width, rise = 0.35, ya, yb, mat = marble, res = 0.12 }) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), U = [dx / len, 0, dz / len], Wv = [-U[2], 0, U[0]];
      const n = Math.max(2, Math.ceil(Math.abs(yb - ya) / rise - 1e-6)), run = len / n, out = [[0, ya]];
      for (let i = 0; i < n; i++) { const y = ya + (yb - ya) * ((i + 1) / n); out.push([i * run, y], [(i + 1) * run, y]); }
      for (let i = n; i >= 0; i--) {
        const t = Math.min(len, i * run), x = a[0] + U[0] * t, z = a[1] + U[2] * t, w2 = width / 2;
        const g = Math.min(h(x, z), h(x + Wv[0] * w2, z + Wv[2] * w2), h(x - Wv[0] * w2, z - Wv[2] * w2));
        out.push([t, Math.min(g, ya + (yb - ya) * (i / n)) - 0.45]);
      }
      S.extrude([out], [a[0], 0, a[1]], width, mat, { ax: [U, [0, 1, 0], Wv], res });
      ctx.stair([a, b], width);
    };
    // a gold fire bowl on a short marble foot; returns the fire's place
    const bowl = (x, z, y, { s = 0.7, lit = true, foot = 0.7 } = {}) => {
      S.lathe([x, y, z], foot, t => 0.2 + 0.1 * (1 - t), marble, { res: 0.09 });
      S.box([x, y + 0.05, z], [0.32, 0.08, 0.32], marble, { rd: 0.02, res: 0.09 });
      const b = S.ball([x, y + foot + 0.18, z], [0.48, 0.28, 0.48], gold, { hold: true });
      const in_ = S.ball([x, y + foot + 0.34, z], [0.4, 0.26, 0.4], gold, { hold: true });
      S.join('cut', b, in_, { res: 0.085 });
      const p = [x, y + foot + 0.22, z];
      if (lit) ctx.fire(p, s, { k: 0.7, r: 3.6 });
      return p;
    };
    // a wire solid: one gold tube for each edge. kind: cube | octahedron | icosahedron | dodecahedron | rhombicuboctahedron
    const SOLIDS = (() => {
      const phi = (1 + Math.sqrt(5)) / 2, V = {}, E = {};
      const perms = (v, even) => {
        const out = [], idx = even ? [[0, 1, 2], [1, 2, 0], [2, 0, 1]] : [[0, 1, 2], [1, 2, 0], [2, 0, 1], [1, 0, 2], [0, 2, 1], [2, 1, 0]];
        for (const p of idx) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          const q = [v[p[0]] * sx, v[p[1]] * sy, v[p[2]] * sz];
          if (!out.some(o => Math.hypot(o[0] - q[0], o[1] - q[1], o[2] - q[2]) < 1e-6)) out.push(q);
        }
        return out;
      };
      V.cube = perms([1, 1, 1], true);
      V.octahedron = perms([1, 0, 0], true);
      V.icosahedron = perms([0, 1, phi], true);
      V.dodecahedron = [...perms([1, 1, 1], true), ...perms([0, 1 / phi, phi], true)];
      V.rhombicuboctahedron = perms([1, 1, 1 + Math.SQRT2], true);
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
    const wireSolid = (kind, c, r, { mat = wire, thick = 0.045, yaw = 0, tilt = 0, res = 0.075 } = {}) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
      const P = SOLIDS.V[kind].map(([x, y, z]) => {
        const y1 = y * ct - z * st, z1 = y * st + z * ct; // tilt about x, then turn about y
        return [c[0] + r * (x * cy + z1 * sy), c[1] + r * y1, c[2] + r * (-x * sy + z1 * cy)];
      });
      for (const [i, j] of SOLIDS.E[kind]) S.tube([P[i], P[j]], thick, thick, mat, { res });
      for (const p of P) S.ball(p, thick * 1.2, mat, { res: 0.08 }); // small joints: big ones made the far solids read as lumps
    };
    // a faceted ring (the mazzocchio of the perspective studies): n short boxes round a circle of radius R, each turned square to it
    const mazzocchio = (c, R, r, n, mat) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = c[0] + Math.cos(a) * R, z = c[2] + Math.sin(a) * R;
        // the facets roll in and out in turn about the ring's line, so the ring reads as cut faces, not a smooth hoop
        const t = i % 2 ? 0.5 : -0.5, U = [Math.cos(a), 0, Math.sin(a)], V = [0, 1, 0], Wt = [-Math.sin(a), 0, Math.cos(a)];
        const U2 = [U[0] * Math.cos(t) + V[0] * Math.sin(t), U[1] * Math.cos(t) + V[1] * Math.sin(t), U[2] * Math.cos(t) + V[2] * Math.sin(t)];
        const V2 = [-U[0] * Math.sin(t) + V[0] * Math.cos(t), -U[1] * Math.sin(t) + V[1] * Math.cos(t), -U[2] * Math.sin(t) + V[2] * Math.cos(t)];
        S.box([x, c[1], z], [r, r, Math.PI * R / n + 0.03], mat, { ax: [U2, V2, Wt], rd: 0.03, res: 0.12 });
      }
    };

    /* ---- the belvedere: a marble terrace you start on, a balustrade along its north edge, broken for the stair, two gold fire bowls.
       Gold lines inlaid in its floor run to the temple, as the lines of an ideal-city pavement run to their one point ---- */
    {
      const bx = START[0], x0 = bx - 6.3, x1 = bx + 6.3, zf = BZ, zb = BZ + 6.7;
      const lo = Math.min(h(x0, zf), h(x1, zf), h(bx, zf)) - 0.6;
      // few, wide, unbroken lines: thin lines at this spacing broke into loose dashes on screen
      const inlay = (x, y, z) => {
        if (y < Y.start - 0.05) return null;
        const u = (x - TC[0]) * (zf - TC[1]) / (z - TC[1]), k = u / 2.6 - Math.round(u / 2.6);
        if (Math.abs(k) < 0.05) return gd.slice(1, 3);
        // a pavement of marble lozenges in two tones
        return (Math.floor((x + z) / 1.6) + Math.floor((x - z) / 1.6)) % 2 ? mb.slice(1, 4) : mb.slice(0, 3);
      };
      // the floor gets a calm tone wander only: the veins and course joints of the walls made it a blotchy field from the start camera
      const wallMod = wallM.mod, calm = (x, y, z) => (y > Y.start - 0.05 ? 0.05 * (B.n3(x * 0.35, z * 0.35, 7.5) - 0.5) : wallMod(x, y, z));
      S.box([bx, (lo + Y.start) / 2, (zf + zb) / 2], [6.3, (Y.start - lo) / 2, (zb - zf) / 2], { ...wallM, mod: calm, rf: inlay }, { rd: 0.05, res: 0.15 });
      // a cornice along the top of the north face
      S.box([bx, Y.start - 0.12, zf + 0.05], [6.45, 0.14, 0.2], marble, { rd: 0.03, res: 0.1 });
      balustrade([x0 + 0.25, zf + 0.25], [-2.7, zf + 0.25], { y: Y.start });
      balustrade([2.7, zf + 0.25], [x1 - 0.25, zf + 0.25], { y: Y.start });
      for (const s of [-1, 1]) {
        S.box([s * 5.6, Y.start + 0.5, zf + 0.25], [0.32, 0.5, 0.32], marble, { rd: 0.03, res: 0.09 });
        bowl(s * 5.6, zf + 0.25, Y.start + 1.0, { s: 0.7, foot: 0.25 });
      }
      // the grand stair down to the square
      steps([bx, 18.4], [bx, zf + 0.05], { width: 5, rise: 0.35, ya: Y.square, yb: Y.start, res: 0.15 });
    }

    /* ---- the arcades ---- */
    const W = bays(-1), E = bays(1);
    const arcade = (list, side) => {
      for (const b of list) {
        const L = bayLevels(b), wireBay = b.i >= ARC.n - ARC.wire, far = 1 + 0.09 * b.i; // farther bays draw coarser: the same dabs on screen
        const m = [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2], ax = yawAx(b.yaw);
        const at = (u, v) => [m[0] + b.n[0] * u + b.d[0] * v, m[1] + b.n[1] * u + b.d[1] * v]; // u out from the inner line, v along it
        if (wireBay) {
          ctx.later(() => {
            const t = 0.07, o = { res: 0.14 };
            const P = (u, v, y) => { const q = at(u, v); return [q[0], y, q[1]]; };
            for (const u of [0, b.s]) {
              for (const v of [-b.len / 2, b.len / 2]) S.tube([P(u, v, 0), P(u, v, L.top)], t, t, wire, o);
              const arc = [];
              for (let k = 0; k <= 10; k++) { const a = Math.PI * k / 10; arc.push(P(u, -Math.cos(a) * L.ra, L.spring + Math.sin(a) * L.ra)); }
              S.tube(arc, t, t, wire, o);
              S.tube([P(u, -b.len / 2, L.top), P(u, b.len / 2, L.top)], t, t, wire, o);
            }
            for (const v of [-b.len / 2, b.len / 2]) for (const y of [L.top, L.roof]) S.tube([P(0, v, y), P(b.s, v, y)], t, t, wire, o);
            S.tube([P(0, -b.len / 2, L.roof), P(0, b.len / 2, L.roof)], t, t, wire, o);
            S.tube([P(b.s, -b.len / 2, L.roof), P(b.s, b.len / 2, L.roof)], t, t, wire, o);
          });
          continue;
        }
        // the inner column at this bay's start (and the one at its end, if the next bay is wire)
        column(b.a[0], b.a[1], { hgt: b.hc[0], r: L.rc, yaw: b.yaw, res: 0.12 * far });
        if (b.i === ARC.n - ARC.wire - 1) column(b.b[0], b.b[1], { hgt: b.hc[1], r: L.rc, yaw: b.yaw, res: 0.12 * far });
        // the arch wall: a wall on the column line from the spring to the top, cut by a round arch
        {
          const c = at(0, 0), hy = (L.top - L.spring + 0.1) / 2, tw = L.rc * 1.7;
          const wall = S.box([c[0], L.spring - 0.1 + hy, c[1]], [tw / 2, hy, b.len / 2 + L.rc * 0.4], wallM, { ax, hold: true });
          const base = at(-tw, 0);
          const hole = S.lathe([base[0], L.spring, base[1]], tw * 2, L.ra, dark, { ax: [[0, 1, 0], [b.n[0], 0, b.n[1]], [b.d[0], 0, b.d[1]]], hold: true });
          S.join('cut', wall, hole, { res: 0.15 * far, inner: mb.slice(0, 3) });
        }
        // the roof and the back wall. In the last solid bay their far part breaks into blocks, and the blocks lift and drift away
        // (the set's signature): a block is cut where its noise is over a threshold that falls along the break, as in a dissolve
        const brk = b.i === ARC.n - ARC.wire - 1, vEnd = brk ? -b.len * 0.1 : b.len / 2 + 0.03, v0 = -b.len / 2 - 0.03;
        const roofHy = (L.roof - L.top) / 2, frieze = (x, y, z) => (Math.abs(y - (L.top + roofHy)) < roofHy * 0.28 ? gd.slice(1, 3) : null);
        {
          const c = at(b.s / 2 - 0.1, (v0 + vEnd) / 2);
          S.box([c[0], L.top + roofHy, c[1]], [b.s / 2 + 0.12, roofHy, (vEnd - v0) / 2], { ...marble, rf: frieze }, { ax, rd: 0.03, res: 0.19 * far });
          const f = at(-0.2, (v0 + vEnd) / 2);
          S.box([f[0], L.roof - 0.06, f[1]], [0.24, 0.1, (vEnd - v0) / 2 + 0.01], marble, { ax, rd: 0.03, res: 0.13 * far });
        }
        const wallTop = brk ? L.top - 2.2 : L.top;
        {
          const c = at(b.s - 0.2, (v0 + b.len / 2 + 0.03) / 2), y0 = Math.min(h(c[0], c[1]), 0) - 0.4;
          if (brk) {
            const c2 = at(b.s - 0.2, (v0 + vEnd) / 2);
            S.box([c2[0], (wallTop + L.top) / 2, c2[1]], [0.2, (L.top - wallTop) / 2, (vEnd - v0) / 2], wallM, { ax, res: 0.22 * far });
          }
          S.box([c[0], (y0 + wallTop) / 2, c[1]], [0.2, (wallTop - y0) / 2, b.len / 2 + 0.03], wallM, { ax, res: 0.22 * far });
        }
        if (brk) {
          const cell = 0.72, span = b.len / 2 - vEnd, nv = Math.max(2, Math.round(span / cell)), cv = span / nv;
          const cells = [];
          // the roof's cells (across the depth), then the wall top's cells (up its height)
          const nu = Math.max(3, Math.round(b.s / cell)), cu = (b.s + 0.24) / nu;
          for (let j = 0; j < nv; j++) for (let k = 0; k < nu; k++) cells.push({ u: -0.22 + (k + 0.5) * cu, v: vEnd + (j + 0.5) * cv, y: L.top + roofHy, hu: cu / 2, hv: cv / 2, hy: roofHy, m: marble });
          const ny = Math.max(2, Math.round((L.top - wallTop) / cell)), cy = (L.top - wallTop) / ny;
          for (let j = 0; j < nv; j++) for (let k = 0; k < ny; k++) cells.push({ u: b.s - 0.2, v: vEnd + (j + 0.5) * cv, y: wallTop + (k + 0.5) * cy, hu: 0.2, hv: cv / 2, hy: cy / 2, m: wallM });
          for (const q of cells) {
            const f = (q.v - vEnd) / span, n = B.n3(q.u * 1.7 + side * 3, q.v * 1.7, q.y * 1.3), thr = 0.78 - 0.62 * f;
            const p = at(q.u, q.v);
            if (n < thr) { S.box([p[0], q.y, p[1]], [q.hu, q.hy, q.hv], q.m, { ax, rd: 0.02, res: 0.14 }); continue; }
            // the blocks drift out over the arcade's back and a little back along it as they rise. Up and north, the east ones hung
            // over the sun's disc from the start as dark specks
            const k = n - thr + 0.25, lift = 0.6 + 6.5 * k * (0.35 + f), dv = -1.4 * k * (0.5 + f), du = 1.0 * k + 3.8 * k * f, sc = 0.9 - 0.35 * k;
            const p2 = at(q.u + du, q.v + dv), roll = (n - 0.5) * 1.2;
            const ax2 = [[Math.cos(roll), Math.sin(roll), 0], [-Math.sin(roll), Math.cos(roll), 0], [0, 0, 1]].map(r => [r[0] * ax[0][0] + r[1] * ax[1][0] + r[2] * ax[2][0], r[0] * ax[0][1] + r[1] * ax[1][1] + r[2] * ax[2][1], r[0] * ax[0][2] + r[1] * ax[1][2] + r[2] * ax[2][2]]);
            ctx.later(() => S.box([p2[0], q.y + lift, p2[1]], [q.hu * sc, Math.max(q.hy, 0.2) * sc, q.hv * sc], q.m, { ax: ax2, rd: 0.02, res: 0.14 }));
            // a lit cyan rim where the block came away
            ctx.glow(({ B }) => { for (const [a1, a2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const r = at(q.u + a1 * q.hu, q.v + a2 * q.hv); B.iso(r[0], q.y + q.hy * a1 * a2, r[1], 0.07, B.P[gr[2]], 3, { em: true, nd: true }); } });
          }
        }
      }
    };
    arcade(W, -1);
    arcade(E, 1);

    /* ---- the east roof walk: a stair of blocks up to the first bay's roof at the south end, and a parapet at the end of the sixth bay ---- */
    {
      const b0 = E[0], L0 = bayLevels(b0);
      steps([b0.a[0] + b0.s + 3.6, b0.a[1] + 1.0], [b0.a[0] + 0.9, b0.a[1] + 1.0], { width: 2.2, rise: 0.4, ya: Y.square, yb: L0.roof, mat: wallM, res: 0.18 });
      const b5 = E[5], L5 = bayLevels(b5), m = [b5.b[0] + b5.n[0] * b5.s / 2, b5.b[1] + b5.n[1] * b5.s / 2];
      S.box([m[0], L5.roof + 0.35, m[1]], [b5.s / 2 + 0.1, 0.35, 0.18], wallM, { ax: yawAx(b5.yaw), rd: 0.03, res: 0.1 });
    }

    /* ---- the podium: two marble terraces with a stair in front of each, then a round terrace and a drum of three steps ---- */
    const paved = y => ({ ...wallM, rf: (x, yy, z) => (yy > y - 0.05 ? ((Math.floor(x / 1.5) + Math.floor(z / 1.5)) % 2 ? mb.slice(1, 4) : mb.slice(2)) : null) });
    const terrace = (zf, zb, y, half) => {
      S.box([0, (y - 1.4) / 2, (zf + zb) / 2], [half, (y + 1.4) / 2, (zf - zb) / 2], paved(y), { rd: 0.05, res: 0.19 });
      S.box([0, y - 0.1, zf + 0.06], [half + 0.06, 0.12, 0.16], marble, { rd: 0.03, res: 0.11 });
    };
    terrace(T1Z, T2Z - 0.6, Y.t1, 6.6);
    terrace(T2Z, T3Z - 0.6, Y.t2, 5.4);
    steps([0, T1Z + 2.8], [0, T1Z + 0.05], { width: 3.2, ya: Y.square, yb: Y.t1 });
    steps([0, T2Z + 2.8], [0, T2Z + 0.05], { width: 3.2, ya: Y.t1, yb: Y.t2 });
    steps([0, T3Z + 2.8], [0, T3Z + 0.05], { width: 3.2, ya: Y.t2, yb: Y.t3 });
    // the round terrace and the drum, one turned outline. The temple floor is a rose of marble and verde
    {
      const R3 = T3Z - TC[1], [tx, tz] = TC; // so its front is at T3Z
      const rose = (x, y, z) => {
        if (y < Y.t3 - 0.05) return null;
        const r = Math.hypot(x - tx, z - tz), a = Math.atan2(z - tz, x - tx), sec = Math.floor((a / (Math.PI * 2)) * 24 + 24);
        if (y > Y.floor - 0.05) return r < 1.3 ? mb.slice(2) : r < 1.6 ? gd.slice(1, 3) : Math.floor(r / 1.2) % 2 ? (sec % 2 ? vd : mb.slice(1, 4)) : (sec % 2 ? mb.slice(1, 4) : vd);
        return sec % 2 ? mb.slice(1, 4) : mb.slice(2);
      };
      S.revolve([[[-0.5, -1.2], [R3, -1.2], [R3, Y.t3], [6.0, Y.t3], [6.0, Y.t3 + 0.267], [5.6, Y.t3 + 0.267], [5.6, Y.t3 + 0.533], [5.2, Y.t3 + 0.533], [5.2, Y.floor], [-0.5, Y.floor]]],
        [tx, 0, tz], { ...wallM, rf: rose }, { res: 0.19 });
      S.torus([tx, Y.t3 - 0.1, tz], R3 + 0.04, 0.13, marble, { res: 0.11 });
    }
    // gold fire bowls on the podium's four corners
    for (const [x, z, y] of [[-6.0, T1Z - 0.6, Y.t1], [6.0, T1Z - 0.6, Y.t1], [-4.8, T2Z - 0.6, Y.t2], [4.8, T2Z - 0.6, Y.t2]]) bowl(x, z, y, { s: 0.7 });

    /* ---- the temple: twelve columns, a ring entablature with a gold frieze, a dome of gold wire, a gold mazzocchio, a round altar ---- */
    {
      // columns 3.5 high and a dome 4.6 high, so the whole dome is under the top of a landscape window's start view
      const [tx, tz] = TC, R = 4.6, ch = 3.5, rc = 0.34, n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / n;
        column(tx + Math.cos(a) * R, tz + Math.sin(a) * R, { hgt: ch, r: rc, y: Y.floor, yaw: -a, res: 0.14 });
      }
      // the entablature: one turned profile (architrave, frieze, cornice); the frieze is gold, in panels of two tones
      const ye = Y.floor + ch;
      const frieze = (x, y, z) => {
        if (y < ye + 0.5 || y > ye + 0.92) return null;
        const a = Math.atan2(z - tz, x - tx);
        return Math.floor((a / (Math.PI * 2)) * 36 + 36) % 2 ? gd.slice(1, 3) : gd.slice(2);
      };
      S.revolve([[[R - 0.42, 0], [R + 0.42, 0], [R + 0.42, 0.5], [R + 0.34, 0.5], [R + 0.34, 0.92], [R + 0.62, 0.92], [R + 0.62, 1.14],
        [R - 0.55, 1.14], [R - 0.55, 0.92], [R - 0.34, 0.92], [R - 0.34, 0.5], [R - 0.42, 0.5]]], [tx, ye, tz], { ...marble, rf: frieze }, { res: 0.15 });
      const yd = ye + 1.14, DR = R + 0.1, DH = 4.6;
      ctx.later(() => {
        // the dome of gold wire: twelve pointed meridians, three rings, a lantern. Each meridian is the pointed fifth of Brunelleschi's
        // dome: an arc whose radius is 4/5 of the span, struck from a centre on the far side of the axis, scaled to the height DH
        const Rc = 1.6 * DR, th1 = Math.acos(0.6 / 1.6), ky = DH / (Rc * Math.sin(th1));
        const meridian = a => {
          const pts = [];
          for (let k = 0; k <= 12; k++) {
            const th = (k / 12) * th1, x = Math.max(0.55, -0.6 * DR + Rc * Math.cos(th)), y = Rc * Math.sin(th) * ky;
            pts.push([tx + Math.cos(a) * x, yd + y, tz + Math.sin(a) * x]);
          }
          return pts;
        };
        for (let i = 0; i < 12; i++) S.tube(meridian((i / 12) * Math.PI * 2 + Math.PI / 12), 0.08, 0.08, wire, { res: 0.09 });
        for (const k of [3, 6, 9]) {
          const p = meridian(0)[k], r = Math.hypot(p[0] - tx, p[2] - tz);
          S.torus([tx, p[1], tz], r, 0.07, wire, { res: 0.09 });
        }
        const top = meridian(0)[12];
        S.torus([tx, top[1], tz], 0.62, 0.09, wire, { res: 0.07 });
        S.lathe([tx, top[1], tz], 0.9, t => 0.42 * (1 - t * 0.6), wire, { res: 0.07 });
        S.ball([tx, top[1] + 1.15, tz], 0.24, wire, { res: 0.06 });
      });
      mazzocchio([tx, yd + 0.15, tz], DR + 0.15, 0.2, 24, gold);
      // the altar, and the beacon's bowl on it
      // a tall altar like a candlestick: a wide foot, a waisted shaft, a gold dish (tall, so the beacon stands 2 m over the start)
      S.lathe([tx, Y.floor - 0.2, tz], 2.15, t => (t < 0.18 ? 0.72 : t > 0.86 ? 0.55 : 0.36 + 0.1 * Math.cos(t * 9)), marble, { res: 0.09 });
      S.lathe([tx, Y.floor + 1.95, tz], 0.15, 0.8, gold, { res: 0.08 });
      ctx.beacon([tx, Y.floor + 2.1, tz], 1.7);
    }

    /* ---- the wire solids, floating over plinths down the square, and their plinths ---- */
    for (const [kind, x, z, r, y0] of [['cube', 4.5, 9, 0.85, 0], ['octahedron', -4.5, 1, 1.2, 0], ['icosahedron', 3.8, -7, 1.35, 0], ['rhombicuboctahedron', -3.8, T1Z - 2.2, 1.4, Y.t1]]) {
      // the two far solids have many edges, so they are the biggest: smaller, they read as gold lumps from the start
      const ph = 1.0;
      S.box([x, y0 + ph / 2 - 0.2, z], [0.62, ph / 2 + 0.2, 0.62], wallM, { rd: 0.04, res: 0.1 });
      S.box([x, y0 + ph - 0.05, z], [0.72, 0.08, 0.72], marble, { rd: 0.03, res: 0.09 });
      ctx.later(() => wireSolid(kind, [x, y0 + ph + 0.6 + r, z], r, { yaw: 0.5 + x * 0.1, tilt: kind === 'cube' ? 0.62 : 0.3 }));
    }

    /* ---- tiles lifting out of the floor at the square's east and west edges ---- */
    {
      const tileM = { ...marble, rf: (x, y, z) => null };
      // the stair of lifted tiles east of the square, each 0.45 higher, up to the wisp
      for (let k = 0; k < 6; k++) {
        const x = TX, z = 5.0 - k * 2, top = 0.45 * (k + 1);
        S.box([x, top - 0.15, z], [0.92, 0.15, 0.92], { ...tileM, r: (k % 2 ? vd : mb.slice(1)) }, { ax: yawAx(0.04 * (k - 2)), rd: 0.03, res: 0.13 });
        if (top > 0.5) S.box([x, (top - 0.3) / 2, z], [0.18, (top - 0.3) / 2, 0.18], dark, { res: 0.1 }); // a thin stalk of light under it
      }
      // where a tile has gone from the floor, it floats above its place, higher toward the podium and the edges; a few kept tiles
      // stand a little proud as low steps. The floating tiles are in ctx.later: they do not block the feet
      for (const side of [-1, 1]) for (let iz = 2; iz >= -7; iz--) for (let ix = 2; ix <= 5; ix++) {
        const x = side * (ix * 2 + 1), z = iz * 2 + 1;
        if (Math.abs(x) > innerX(z) - 1.2) continue;
        if (side > 0 && Math.abs(x - TX) < 1.9 && z <= 6 && z >= -6) continue;
        if (Math.abs(x + 6) < 4.2 && Math.abs(z + 6) < 4.2) continue; // the sunken grid
        const k = B.n3(ix * 1.3, iz * 1.3, side + 4), kept = tileKept(x, z), out = (ix - 1.5) / 3.5, deep = (3 - iz) / 10;
        const r = (Math.floor(x / 2) + Math.floor(z / 2)) % 2 === 0 ? mb.slice(1) : vd;
        if (kept) {
          if (k > 0.6) S.box([x, 0.12 + (k - 0.6) * 0.8, z], [0.92, 0.12, 0.92], { ...tileM, r }, { ax: yawAx(B.rr(-0.05, 0.05)), rd: 0.03, res: 0.14 });
          continue;
        }
        if (k < 0.3 - out * 0.2) continue;
        const lift = 1.2 + 3.6 * out * (0.4 + deep) + 1.2 * k, tw = (k - 0.5) * 0.9 * side, tl = 0.25 * side * (0.5 + out);
        const fx = x + side * out * 0.6, fz = z + B.rr(-0.25, 0.25);
        ctx.glow(({ B }) => { for (const [a1, a2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.iso(x + a1 * 0.98, 0.05, z + a2 * 0.98, 0.07, B.P[gr[2]], 3, { em: true, nd: true }); });
        ctx.later(() => S.box([fx, lift, fz], [0.84, 0.12, 0.84], { ...tileM, r },
          { ax: [[Math.cos(tl), Math.sin(tl), 0], [-Math.sin(tl) * Math.cos(tw), Math.cos(tl) * Math.cos(tw), Math.sin(tw)], [Math.sin(tl) * Math.sin(tw), -Math.cos(tl) * Math.sin(tw), Math.cos(tw)]], rd: 0.03, res: 0.15 }));
      }
    }

    /* ---- far columns of impossible scale in the fog, two of them broken ---- */
    for (const [a, d, hh, broken] of [[-0.9, 64, 30, false], [-0.45, 76, 34, true], [0.62, 70, 28, false], [1.05, 62, 26, true], [-1.6, 72, 32, false], [1.7, 78, 30, false]]) {
      const x = Math.sin(a) * d, z = -Math.cos(a) * d + 6, gy = h(x, z) - 1, r = hh * 0.075;
      S.lathe([x, gy, z], hh, t => r * (1 - 0.12 * t * t), far, { res: 1.0 });
      if (!broken) S.box([x, gy + hh + 0.6, z], [r * 1.5, 0.6, r * 1.5], far, { res: 1.0 });
      else S.box([x + r * 1.8, h(x + r * 2, z) + 0.8, z + r], [r * 0.9, r * 0.9, r * 2.2], far, { ax: yawAx(a + 0.7), res: 0.6 });
    }

    /* ---- the start, the wisps ---- */
    ctx.spawn([START[0], Y.start + 0.13, START[1]], Math.PI);
    {
      const b = W[1], m = [(b.a[0] + b.b[0]) / 2 + b.n[0] * b.s * 0.45, (b.a[1] + b.b[1]) / 2 + b.n[1] * b.s * 0.45];
      ctx.wisp([m[0], 1.1, m[1]]); // under the west arcade
    }
    ctx.wisp([TX, 2.7 + 1.1, -5.0]); // on the stair of lifted tiles
    {
      const b = E[2], L = bayLevels(b), m = [(b.a[0] + b.b[0]) / 2 + b.n[0] * b.s * 0.5, (b.a[1] + b.b[1]) / 2 + b.n[1] * b.s * 0.5];
      ctx.wisp([m[0], L.roof + 1.1, m[1]]); // on the east arcade's roof walk
    }
    ctx.wisp([-6, Y.pit + 1.1, -6]); // in the sunken grid
    ctx.wisp([-4.4, Y.t2 + 1.1, T2Z - 2.6]); // on the second terrace
    // a plinth beside it
    S.box([-3.2, Y.t2 + 0.5, T2Z - 3.3], [0.5, 0.5, 0.5], wallM, { rd: 0.04, res: 0.1 });

    /* ---- what glows: the grid, the sky, the sun and its halo, stars, cloud, motes ---- */
    const eye = [START[0], Y.start + 0.13 + EYE_UP, START[1] + EYE_BACK];
    // grid lines: dabs along each line on the ground. Far away the spacing doubles and the tone falls a step, so far lines do not shimmer
    const gridLines = ({ x0, x1, z0, z1 }, { step = 2, y = null, cols = gr, keep = () => true, near = 37, mid = 50, w = 0.05, fat = 0.0016, len = 0.32, gap = 0.5 }) => {
      const dab = (x, z, dir) => {
        if (!keep(x, z)) return;
        const yy = (y ?? h(x, z)) + 0.08, dist = Math.hypot(x - eye[0], z - eye[2]);
        const c = dist < near ? cols[2] : dist < mid ? cols[1] : cols[0];
        B.axial(x, yy, z, dir, len, w + dist * fat, B.P[c], 3, { em: true, nd: true });
      };
      for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-6; x += step) {
        const k = Math.round(x / step);
        for (let z = z0; z <= z1 + 1e-6; z += gap) { const dist = Math.hypot(x - eye[0], z - eye[2]); if (dist > 44 && k % 2) continue; dab(x, z, [0, 0, 1]); }
      }
      for (let z = Math.ceil(z0 / step) * step; z <= z1 + 1e-6; z += step) {
        const k = Math.round(z / step);
        for (let x = x0; x <= x1 + 1e-6; x += gap) { const dist = Math.hypot(x - eye[0], z - eye[2]); if (dist > 44 && k % 2) continue; dab(x, z, [1, 0, 0]); }
      }
    };
    ctx.glow(({ B }) => {
      // the floor's grid where the tiles thin out, across the square and under the arcades
      gridLines({ x0: -16, x1: 16, z0: -12, z1: 4 }, { keep: (x, z) => Math.abs(x) < innerX(z) + 4 && !(Math.abs(x + 6) < 3.6 && Math.abs(z + 6) < 3.6) });
      // the sunken grid: a bright, fine grid on its dark floor
      gridLines({ x0: -9, x1: -3, z0: -9, z1: -3 }, { step: 0.5, y: Y.pit, near: 99, w: 0.022, fat: 0, len: 0.14, gap: 0.22 });

      const sk = ramp('skyband'), dk = ramp('sky')[0], sun = ramp('sun');
      // five sfumato bands, darkest at the top. Each band edge is broken by scattered dabs of both tones, so no edge is hard
      const edges = [0.015, 0.05, 0.1, 0.17, 0.27], tones = [sk[4], sk[3], sk[2], sk[1], sk[0], dk];
      const toneAt = e => { let i = 0; while (i < edges.length && e > edges[i]) i++; return i; };
      B.sky(d => tones[toneAt(d[1])], 230);
      const dir = (a, e) => [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
      for (let i = 0; i < 260; i++) for (let j = 0; j < 14; j++) {
        const a = (i / 260) * Math.PI * 2 + B.rr(-0.01, 0.01), e = -0.04 + j * 0.024 + B.rr(-0.012, 0.012), p = dir(a, e), R = 182;
        let k = toneAt(e);
        const lo = k ? edges[k - 1] : -1, hi = k < edges.length ? edges[k] : 2, f = (e - lo) / (hi - lo);
        if (f < 0.35 && k > 0 && B.rr(0, 1) < 0.5 - f) k--; else if (f > 0.65 && k < edges.length && B.rr(0, 1) < f - 0.5) k++;
        B.iso(eye[0] + p[0] * R, eye[1] + p[1] * R, eye[2] + p[2] * R, 3.4, B.P[tones[k]], 2.0, { em: true, nd: true });
      }
      // the low sun, just right of the temple, a disc of sun steps, and three rings of punched gold dots round it
      const toT = Math.atan2(TC[0] - eye[0], -(TC[1] - eye[2])), dT = Math.hypot(TC[0] - eye[0], TC[1] - eye[2]);
      const deg = Math.PI / 180, sr = 2.2 * deg, az = toT + Math.atan(7.5 / dT) + sr, el = -1.4 * deg, D = 172, rs = D * Math.tan(sr);
      const u = dir(az, el), M = [eye[0] + u[0] * D, eye[1] + u[1] * D, eye[2] + u[2] * D];
      const rt = B.norm([-u[2], 0, u[0]]), up = [rt[1] * u[2] - rt[2] * u[1], rt[2] * u[0] - rt[0] * u[2], rt[0] * u[1] - rt[1] * u[0]];
      const at = (a, b, back = 0) => [M[0] + rt[0] * a + up[0] * b + u[0] * back, M[1] + rt[1] * a + up[1] * b + u[1] * back, M[2] + rt[2] * a + up[2] * b + u[2] * back];
      // a warm glow low round the sun, under the halo
      for (let i = 0; i < 160; i++) {
        const a = B.rr(0, Math.PI * 2), q = Math.sqrt(B.rr(0, 1)) * rs * 4.2, p = at(Math.cos(a) * q * 1.4, Math.sin(a) * q * 0.55, 6);
        B.iso(p[0], p[1], p[2], 2.6, B.P[q < rs * 2.2 ? sk[4] : sk[3]], 1.6, { em: true, nd: true });
      }
      const sp = rs * 0.15;
      for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
        const a = (i + (j % 2) * 0.5) * sp, b = j * sp * 0.87, q = Math.hypot(a, b) / rs;
        if (q > 0.97) continue;
        const p = at(a, b);
        B.iso(p[0], p[1], p[2], sp * 0.62, B.P[q > 0.72 ? sun[0] : sun[1]], 3, { em: true, nd: true });
      }
      [[1.45, gd[3], 0.55], [1.85, gd[2], 0.5], [2.3, gd[1], 0.45]].forEach(([k, c, s], ri) => {
        const rr = rs * k, n = Math.round((Math.PI * 2 * rr) / (rs * 0.36));
        for (let i = 0; i < n; i++) {
          const a = (i + ri * 0.5) / n * Math.PI * 2, p = at(Math.cos(a) * rr, Math.sin(a) * rr, -1);
          B.iso(p[0], p[1], p[2], s, B.P[c], 3, { em: true, nd: true });
        }
      });
      // thin flat lines of cloud across the low sky
      for (let i = 0; i < 22; i++) {
        const a = toT + B.rr(-0.9, 0.9), e = B.rr(0.012, 0.09), p = dir(a, e), R = 176;
        B.axial(eye[0] + p[0] * R, eye[1] + p[1] * R, eye[2] + p[2] * R, [Math.cos(a), 0, Math.sin(a)], B.rr(6, 14), 0.7, B.P[sk[1]], 1.4, { em: true, nd: true });
      }
      // stars, high only
      for (let i = 0; i < 40; i++) {
        const a = B.rr(0, Math.PI * 2), e = B.rr(0.32, 1.25), r = 195;
        B.iso(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, B.rr(0.25, 0.42), B.P[B.pick([sk[3], gd[2]])], 3, { em: true, nd: true });
      }
      // cyan motes over the grid
      lib.motes(B, 60, [-12, 12, 0.3, 4, -14, 4], [gr[1], gr[2]], 0.035);
    });
  }
};
