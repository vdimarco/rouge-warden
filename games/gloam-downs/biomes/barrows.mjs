// Barrow Crown: the last place. A down of grassy burial mounds under a big low moon. The mounds are the rolling hills: each has a dark
// stone door-mouth in its side, some carry rings of leaning stones, and teal ghost fog lies in the hollows between them. You stand on
// the long barrow in the south and look north across the hollow at the crown hill. A broken curtain wall girds it. Inside, the ruined
// keep stands on the left with one lit window, and on the right the greatest barrow rises in a dome crowned by a ring of tall stones
// that lean outward like the points of a crown. The beacon waits in the middle of that ring. The moon hangs low between the keep and
// the crown, in a deep violet band that goes magenta round it. Moonlit blue stone, deep teal grass, ghost-green glows, brazier embers.
//
// The follow camera looks down at a low pitch: the top of its picture is at about eye level. So the start stands high on its barrow,
// the crown hill's bailey lies lower, and the keep and the crown of stones reach up to about eye height. The land behind the crown hill
// falls away, so the keep, the stones and the moon stand against the sky.
import { rocks, deadTree, yawAx } from '../lib/props.mjs';
import { lib, polyDist, tile } from '../lib/common.mjs';

// heights
const Y = { start: 8.0, bailey: 5.0, summit: 9.4 };
const START = [2, 27];
const SUMMIT = [4, -20]; // the greatest barrow's top: the crown of stones and the beacon
const KEEP = [-9.5, -19]; // the keep, on the bailey west of the summit
const KW = 2.7; // the keep's half width
const BAILEY = [-2.5, -19.5], BOX = [11, 6.5]; // the flat top of the crown hill, a rounded box
const SOUTH = BAILEY[1] + BOX[1] - 0.7; // the line of the south curtain wall
const GATE = [0, SOUTH];
// the walked line: down off the start barrow, through the hollow between the mounds, up the crown hill's stair to the gate
const PATH = [[2.6, 36], [2, 27], [1.4, 22.5], [-0.6, 18], [-2.2, 13.5], [-1.6, 9], [0.4, 4.6], [1.4, 0.4], [1.0, -3.6], [0.4, -7.4], [0, -11], [0, SOUTH - 1.2]];
// inside the gate: the avenue of stones up the dome to the crown, and a branch west to the keep's hall
const AVENUE = [[0, SOUTH - 1.2], [0.8, -16.2], [2.2, -18.4], [SUMMIT[0], SUMMIT[1]]];
const HALL = [[0, SOUTH - 1.2], [-3.6, -17.4]];
// the barrows that are hills of their own: [x, z, radius, height]
const MOUNDS = {
  start: [2, 29, 12, 6.6], startW: [-6, 31, 9, 4.2],
  west: [-12.5, 12, 8, 4.4], east: [14, 6, 9, 5.0],
  midW: [-10, -3, 7, 3.2], midE: [10.5, -7, 6, 2.6],
  nw: [-23, 21, 7, 3.4], ne: [22, 23, 8, 4.0], fw: [-25, -6, 8, 4.4], fe: [24, -12, 8, 4.8],
  bw: [-22, -31, 8, 3.4], be: [21, -31, 9, 3.8]
};
const DOLMEN = [9.5, 18.5]; // a table of stone at the foot of the start barrow
// where the start camera's eye is (preview: 9 back, pitch 0.3), to hang the moon between the keep and the crown
const EYE = [START[0], Y.start + 1 + 9 * Math.sin(0.3), START[1] + 9 * Math.cos(0.3)];

// frames: rows are a solid's own x, y and z axes in the world. Turned by yaw about up, tipped by `tilt` about its own x axis (the top
// goes toward its own +z), then rolled by `roll` about its own z axis
const tipAx = (yaw, tilt = 0, roll = 0) => {
  const [X0, , Z0] = yawAx(yaw), Y0 = [0, 1, 0];
  const ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll);
  const Y1 = Y0.map((v, i) => v * ct + Z0[i] * st), Z1 = Z0.map((v, i) => v * ct - Y0[i] * st);
  const X2 = X0.map((v, i) => v * cr + Y1[i] * sr), Y2 = Y1.map((v, i) => v * cr - X0[i] * sr);
  return [X2, Y2, Z1];
};
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export default {
  id: 'barrows',
  name: 'Barrow Crown',
  sub: 'Mounds of the old dead, and the keep on the crowned hill',
  hint: 'Climb to the crown of stones. Light the beacon.',
  seed: 53,
  palette: [
    ['sky', [0x03050a]],
    ['skyband', [0x0d0a1a, 0x1c0f2e, 0x36143e, 0x5a1a52]],
    ['fog', [0x0a1a1c, 0x163130, 0x24463f]],
    ['ink', [0x010203]],
    ['shade', [0x030607]],
    ['grass', [0x030b0b, 0x061414, 0x0b201f, 0x122e2b, 0x1c3f38]],
    ['earth', [0x0e0a0a, 0x1f1614, 0x372720]],
    ['stone', [0x090c16, 0x131a2b, 0x202a44, 0x334263, 0x50638a]],
    ['ghost', [0x173f22, 0x3a9a48, 0xa6f27e]],
    ['wood', [0x120c0a, 0x2a1c14]],
    ['moon', [0x8ea6a8, 0xe2ecd8]],
    ['rag', [0x2e0a24, 0x5e1646]]
  ],
  // the key light is cold moonlight from the west and a little behind the place, so the mounds' tops and west flanks catch it and
  // the faces turned to the start stay dark until a fire finds them (the light is set for form, not to match the moon you see)
  light: { sun: [-0.7, 0.55, -0.25], amb: 0.11, sky: 0.15, sunK: 0.5, shK: 7 },
  fog: { color: 'fog', far: 74, start: 0.45, max: 0.88 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 34 },
  hills: {
    base: 1.0,
    bumps: [
      ...Object.values(MOUNDS),
      [-1, -19, 18, 2.4], // the crown hill under its bailey
      [-50, -26, 24, 8], [50, -22, 24, 9], // far downs either side
      [-46, 30, 20, 6], [44, 34, 20, 6],
      [0, -100, 72, -14] // the land falls away north, so the keep, the crown and the moon stand against the sky
    ],
    fbm: { amp: 0.45, freq: 1 / 11, oct: 3 },
    warp: { amp: 2.2, freq: 1 / 22 },
    far: { amp: 8, start: 38, end: 64 },
    pits: [[-1, 6, 10, 0.8]], // the hollow
    flats: [
      { at: START, r: 2.6, blend: 4.5, y: Y.start }, // the top of the start barrow
      { at: BAILEY, box: BOX, blend: 4, y: Y.bailey }, // the bailey on the crown hill
      { at: SUMMIT, r: 2.3, blend: 5.0, y: Y.summit }, // the greatest barrow, a dome inside the bailey
      { at: DOLMEN, r: 2.2, blend: 2.5, lift: 0 }
    ],
    paths: [{ pts: PATH, w: 2.2, depth: 0.12 }, { pts: AVENUE, w: 2.2, depth: 0.08 }, { pts: HALL, w: 2.0, depth: 0.06 }],
    box: [-112, 112, -112, 112]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
    const grass = ramp('grass'), earth = ramp('earth'), st = ramp('stone'), gh = ramp('ghost'), fire = ramp('fire'), ink = ramp('ink')[0];
    // rough surfaces: a broad tone wander and a fine grain
    const grit = (k = 1) => (x, y, z) => k * (0.16 * (B.n3(x * 0.45, z * 0.45, y * 0.3 + 3) - 0.5) + 0.14 * (B.n3(x * 2.6, y * 2.6, z * 2.6) - 0.5));
    // laid stone: grit, and dark mortar between courses and between blocks
    const laid = (k = 0.8, ch = 0.6) => {
      const g = grit(k);
      return (x, y, z) => {
        const c = y / ch, row = Math.floor(c), f = c - row, u = ((x + z) / 1.1 + row * 0.5) % 1;
        return g(x, y, z) + (f < 0.12 || (u + 1) % 1 < 0.07 ? -0.15 : 0);
      };
    };
    // old standing stone: grit, and rain streaks down its faces
    const weathered = (x, y, z) => grit(0.9)(x, y, z) + 0.12 * (B.n3(x * 4.2, y * 0.5, z * 4.2) - 0.5);
    // lamp light on stone: from cold stone through warm earth to orange, so a fire makes a pool of firelight, not a red smear
    const warmStone = [st[1], earth[1], earth[2], fire[1], fire[2], fire[3]];
    const moss = grass.slice(1, 4);
    const stone = { r: st, g: warmStone, mod: laid(0.8), top: { min: 0.72, r: moss } };
    const rough = { r: st, g: warmStone, mod: grit(0.9), top: { min: 0.78, r: moss } };
    const slab = { r: st, g: warmStone, mod: weathered, top: { min: 0.8, r: moss } };
    const far = { r: st.slice(0, 2), mod: grit(0.5) };
    const hollow = { r: [ink], em: true }; // the black inside a door-mouth
    const wood = { r: ramp('wood'), g: [ramp('wood')[1]], mod: grit(0.5) };
    const iron = { r: ramp('iron'), g: [ramp('iron')[0], earth[1], fire[1], fire[2]] };
    const bone = { r: [st[3], st[4]], g: [st[3]] };
    const leaf = { r: grass.slice(0, 3), g: [grass[1], earth[1], fire[1]], mod: grit(1.2) };
    const GHOSTLIGHT = [gh[0], gh[1]]; // a ghost light's pool: dark green, then green

    /* ---- the ground: a fine rectangle over the play area, then strips coarser each time out ---- */
    {
      const onPath = (x, z) => Math.min(polyDist(x, z, PATH) - 0.1, polyDist(x, z, AVENUE) - 0.15, polyDist(x, z, HALL) - 0.3) + 0.7 * (B.n3(x * 1.1, z * 1.1, 4) - 0.5) < 1.0;
      const g1 = grit(1);
      const near = { r: grass, g: [grass[1], grass[2], earth[2], fire[1], fire[2], fire[3]], mod: g1, rf: (x, y, z) => (onPath(x, z) ? earth : null) };
      const mid = { r: grass, mod: grit(1.2), fat: 0.62 }, out = { r: grass.slice(0, 4), mod: grit(1.4), fat: 0.8 };
      const N = [-25, 25, -31, 33], M = [-56, 56, -56, 56], F = [-108, 108, -108, 108];
      tile(S, h, near, { x0: N[0], x1: N[1], z0: N[2], z1: N[3], res: 0.32 });
      const ring = (o, i, res, mat) => {
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: o[2], z1: i[2], res });
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: i[3], z1: o[3], res });
        tile(S, h, mat, { x0: o[0], x1: i[0], z0: i[2], z1: i[3], res });
        tile(S, h, mat, { x0: i[1], x1: o[1], z0: i[2], z1: i[3], res });
      };
      ring(M, N, 0.7, mid);
      ring(F, M, 1.5, out);
    }

    /* ---- small props of this place ---- */
    const lowest = (x, z, r) => Math.min(h(x, z), h(x + r, z), h(x - r, z), h(x, z + r), h(x, z - r));
    // a standing stone: a fat rounded slab sunk into the ground, leaning `tilt` toward its own +z (yaw turns it). Returns its top.
    const menhir = (x, z, { hgt = 2.6, w = 0.5, d = 0.34, yaw = 0, tilt = 0, roll = 0, mat = slab, sink = 0.7, res = 0.13 } = {}) => {
      const gy = lowest(x, z, Math.max(w, d)), ax = tipAx(yaw, tilt, roll), up = ax[1], hh = (hgt + sink) / 2;
      const c = [x + up[0] * (hh - sink), gy - sink * up[1] + up[1] * hh, z + up[2] * (hh - sink)];
      S.box(c, [w, hh, d], mat, { ax, rd: Math.min(w, d) * 0.55, res });
      return [c[0] + up[0] * hh, c[1] + up[1] * hh, c[2] + up[2] * hh];
    };
    // a fallen stone lying on the ground, its long way along yaw
    const fallen = (x, z, { len = 2.6, w = 0.5, d = 0.34, yaw = 0, roll = 0.2, mat = slab, res = 0.13 } = {}) => {
      const gy = lowest(x, z, len * 0.4);
      S.box([x, gy + d * 0.5, z], [w, d, len / 2], mat, { ax: tipAx(yaw, 0, roll), rd: Math.min(w, d) * 0.55, res });
    };
    // a ring of stones round (cx, cz): some gone, some fallen outward, the rest leaning out a little
    const stoneRing = (cx, cz, R, n, { gone = [], down = [], hgt = 2.4, lean = 0.12, a0 = 0, w = 0.5, d = 0.34, res = 0.13 } = {}) => {
      const tops = [];
      for (let i = 0; i < n; i++) {
        if (gone.includes(i)) continue;
        const a = a0 + (i / n) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), x = cx + dx * R, z = cz + dz * R, yaw = Math.atan2(dx, dz);
        if (down.includes(i)) { fallen(x + dx * hgt * 0.45, z + dz * hgt * 0.45, { len: hgt * 0.95, w, d, yaw, roll: B.rr(-0.3, 0.3), res }); continue; }
        tops.push(menhir(x, z, { hgt: hgt * B.rr(0.8, 1.15), w, d, yaw, tilt: lean + B.rr(-0.08, 0.1), roll: B.rr(-0.1, 0.1), res }));
      }
      return tops;
    };
    // a post with a fire on top
    const post = (x, z, { hgt = 1.8, y, s = 0.8, k = 0.6, r = 3.4 } = {}) => {
      const y0 = y ?? h(x, z) - 0.1;
      S.tube([[x, y0, z], [x, y0 + hgt, z]], 0.14, 0.1, wood, { res: 0.08 });
      S.ball([x, y0 + hgt + 0.02, z], [0.21, 0.12, 0.21], iron, { res: 0.07 });
      ctx.fire([x, y0 + hgt + 0.1, z], s, { k, r });
    };
    // an iron fire bowl on three fat legs; returns the top of the bowl
    const bowl = (x, z, { y, s = 0.9, lit = true, k = 0.6, r } = {}) => {
      const y0 = y ?? h(x, z) - 0.05;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        S.tube([[x + Math.cos(a) * 0.45, y0, z + Math.sin(a) * 0.45], [x + Math.cos(a) * 0.2, y0 + 0.72, z + Math.sin(a) * 0.2]], 0.07, 0.06, iron, { res: 0.07 });
      }
      const b = S.ball([x, y0 + 0.95, z], [0.52, 0.3, 0.52], iron, { hold: true });
      const in_ = S.ball([x, y0 + 1.12, z], [0.43, 0.27, 0.43], iron, { hold: true });
      S.join('cut', b, in_, { res: 0.08 });
      if (lit) ctx.fire([x, y0 + 1.0, z], s, { k, r: r || 4.5 * s });
      return [x, y0 + 1.0, z];
    };
    // a ghost light: a pale green pool baked on what is round it, and (later) a faint glow and a few motes at its heart
    const ghosts = [];
    const ghostLight = (p, r = 4, k = 0.8) => { S.lights.push({ p, r, s: k, sh: true, c: GHOSTLIGHT }); ghosts.push(p); };
    /* a barrow's door-mouth at (x, z), looking the way `face` (a yaw: 0 looks to +z). Two fat jambs, a lintel, the passage's roof slabs
       going back into the mound, a black hollow between the jambs, a threshold stone and a low kerb either side */
    const mouth = (x, z, face, { wide = 0.9, tall = 1.9, glow = false, torch = 0 } = {}) => {
      const fx = Math.sin(face), fz = Math.cos(face), rx = Math.cos(face), rz = -Math.sin(face), ax = yawAx(face);
      const gy = h(x, z) - 0.05;
      const at = (s, f) => [x + rx * s + fx * f, z + rz * s + fz * f];
      // the hollow: a black block reaching back into the mound
      {
        const [cx, cz] = at(0, -1.7);
        S.box([cx, gy + tall / 2 - 0.2, cz], [wide + 0.05, tall / 2 + 0.25, 1.75], hollow, { ax, res: 0.12 });
      }
      // jambs, a little splayed
      for (const s of [-1, 1]) {
        const [jx, jz] = at(s * (wide + 0.42), 0);
        S.box([jx, gy + tall / 2 - 0.35, jz], [0.42, tall / 2 + 0.6, 0.55], slab, { ax: tipAx(face, 0, s * 0.06), rd: 0.12, res: 0.11 });
      }
      // the lintel, and the roof slabs of the passage behind it
      S.box([x + fx * 0.05, gy + tall + 0.32, z + fz * 0.05], [wide + 1.0, 0.36, 0.62], slab, { ax: tipAx(face, 0, 0.04), rd: 0.12, res: 0.11 });
      for (let i = 1; i <= 2; i++) {
        const [cx, cz] = at(B.rr(-0.15, 0.15), -i * 1.15);
        S.box([cx, gy + tall + 0.28 + i * 0.12, cz], [wide + 0.75, 0.3, 0.55], slab, { ax: tipAx(face + B.rr(-0.1, 0.1), 0.06, B.rr(-0.08, 0.08)), rd: 0.12, res: 0.12 });
      }
      // the threshold, and the kerb stones of the forecourt either side
      {
        const [tx, tz] = at(0, 0.75);
        S.box([tx, h(tx, tz) - 0.05, tz], [wide + 0.3, 0.14, 0.4], rough, { ax, rd: 0.06, res: 0.11 });
      }
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const a = 0.55 + i * 0.42, [kx, kz] = at(s * (wide + 1.0 + Math.sin(a) * 1.6), 0.2 + (1 - Math.cos(a)) * 1.5);
        menhir(kx, kz, { hgt: 1.15 - i * 0.22, w: 0.36, d: 0.28, yaw: face + s * (0.6 + i * 0.35), tilt: 0.12, res: 0.11 });
      }
      if (torch) for (const s of torch > 1 ? [-1, 1] : [1]) { const [px, pz] = at(s * (wide + 1.35), 1.0); post(px, pz, { hgt: 1.5, s: 0.7, k: 0.55, r: 3.2 }); }
      if (glow) { const [gx, gz] = at(0, -0.4); ghostLight([gx, gy + 0.9, gz], 3.6, 0.9); }
    };
    // kerb stones round a mound's foot, with gaps
    const kerb = ([cx, cz, R], { from = 0, to = Math.PI * 2, n = 14, r = 0.36 } = {}) => {
      for (let i = 0; i < n; i++) {
        if (B.rr(0, 1) < 0.25) continue;
        const a = from + (to - from) * (i + 0.5) / n, rr = R * 0.78, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
        if (polyDist(x, z, PATH) < 1.8) continue;
        menhir(x, z, { hgt: r * B.rr(1.4, 2.2), w: r, d: r * 0.75, yaw: Math.atan2(Math.cos(a), Math.sin(a)), tilt: B.rr(0, 0.25), sink: 0.4, res: 0.12 });
      }
    };
    // a chunky dark yew: a fat trunk and a stack of round crowns
    const yew = (x, z, { s = 1 } = {}) => {
      const y0 = h(x, z) - 0.2;
      S.tube([[x, y0, z], [x + 0.1, y0 + 1.6 * s, z]], 0.34 * s, 0.24 * s, wood, { res: 0.09 });
      S.ball([x, y0 + 1.9 * s, z], [1.3 * s, 1.0 * s, 1.3 * s], leaf, { res: 0.13 });
      S.ball([x + 0.25 * s, y0 + 2.8 * s, z - 0.1 * s], [0.95 * s, 0.85 * s, 0.95 * s], leaf, { res: 0.13 });
      S.ball([x - 0.1 * s, y0 + 3.5 * s, z + 0.1 * s], [0.55 * s, 0.6 * s, 0.55 * s], leaf, { res: 0.12 });
    };

    /* ---- the start barrow: a fire either side of where you stand, and its own door-mouth below, to the west ---- */
    post(START[0] - 2.4, START[1] - 0.6, { hgt: 1.5, k: 0.5, r: 3.0 });
    post(START[0] + 2.4, START[1] - 0.6, { hgt: 1.5, k: 0.5, r: 3.0 });
    rocks(ctx, [[START[0] - 3.4, START[1] + 1.2, 0.5], [START[0] + 3.6, START[1] + 1.8, 0.42]], { mat: rough, seed: 5 });
    kerb(MOUNDS.start, { from: Math.PI * 0.95, to: Math.PI * 2.05, n: 12, r: 0.4 });

    /* ---- the hollow: the west barrow's door looks at the path; the east barrow wears a stone ring ---- */
    {
      const [wx, wz, wr] = MOUNDS.west, face = Math.atan2(1, 0.35); // looking east, a little south
      const dx = Math.sin(face), dz = Math.cos(face), dr = wr * 0.5;
      mouth(wx + dx * dr, wz + dz * dr, face, { torch: 2 });
      kerb(MOUNDS.west, { from: -0.6, to: 1.0, n: 6 });
      kerb(MOUNDS.west, { from: 1.9, to: 5.2, n: 10 });
      ctx.wisp([wx + dx * (dr + 0.9), h(wx + dx * (dr + 0.9), wz + dz * (dr + 0.9)) + 1.0, wz + dz * (dr + 0.9)]); // at the west door
      stoneRing(wx - 0.8, wz - 0.4, 2.6, 6, { gone: [1, 4], down: [3], hgt: 1.9, lean: 0.1 });
    }
    {
      const [ex, ez, er] = MOUNDS.east;
      const tops = stoneRing(ex, ez, 3.1, 8, { gone: [2, 6], down: [5], hgt: 2.6, lean: 0.14, a0: 0.3 });
      void tops;
      ctx.wisp([ex, h(ex, ez) + 1.1, ez]); // in the ring on the east barrow
      kerb(MOUNDS.east, { n: 16 });
      // its door looks west at the hollow, a ghost light in it
      const face = -Math.PI / 2 - 0.35, dx = Math.sin(face), dz = Math.cos(face), dr = er * 0.52;
      mouth(ex + dx * dr, ez + dz * dr, face, { glow: true, wide: 0.8, tall: 1.7 });
    }
    // the dolmen: three fat legs and a tilted table stone, low enough to jump onto
    {
      const [dx, dz] = DOLMEN, gy = h(dx, dz);
      for (const [ox, oz, hh] of [[-1.0, -0.5, 0.95], [1.0, -0.6, 0.85], [0.1, 0.9, 0.7]])
        S.box([dx + ox, gy + hh / 2 - 0.3, dz + oz], [0.36, hh / 2 + 0.3, 0.3], slab, { ax: yawAx(ox * 0.6 + oz), rd: 0.12, res: 0.11 });
      S.box([dx, gy + 1.05, dz], [1.65, 0.24, 1.35], slab, { ax: tipAx(0.4, -0.09, 0.05), rd: 0.16, res: 0.11 });
      ctx.wisp([dx, gy + 1.3 + 1.2, dz]); // over the table stone
      rocks(ctx, [[dx + 2.2, dz + 1.4, 0.45], [dx - 2.0, dz + 1.6, 0.35]], { mat: rough, seed: 21 });
    }
    // the middle mounds: a door with a ghost light on the west one, grave slabs leaning on the east one
    {
      const [mx, mz, mr] = MOUNDS.midW, face = Math.atan2(1, 0.5);
      const dx = Math.sin(face), dz = Math.cos(face), dr = mr * 0.5;
      mouth(mx + dx * dr, mz + dz * dr, face, { glow: true, wide: 0.85 });
      stoneRing(mx - 1, mz - 1, 2.0, 5, { gone: [2], hgt: 1.6, lean: 0.2 });
      const [nx, nz] = MOUNDS.midE;
      for (let i = 0; i < 6; i++) {
        const a = -2.6 + i * 0.5, x = nx + Math.cos(a) * 2.6, z = nz + Math.sin(a) * 2.6;
        menhir(x, z, { hgt: B.rr(0.9, 1.4), w: 0.42, d: 0.16, yaw: a + Math.PI / 2, tilt: B.rr(-0.3, 0.3), roll: B.rr(-0.2, 0.2), res: 0.1 });
      }
      bowl(nx - 3.8, nz + 3.0, { s: 0.85 });
    }
    // a fallen giant across the hollow, and fires along the path
    fallen(-5.8, 6.4, { len: 4.6, w: 0.7, d: 0.5, yaw: 1.1, roll: 0.25 });
    menhir(-5.0, 9.6, { hgt: 3.6, w: 0.7, d: 0.46, yaw: 0.9, tilt: 0.28 });
    bowl(1.8, 14.6, { s: 0.85 });
    bowl(-2.2, 2.4, { s: 0.85 });

    /* ---- the far mounds round the edge: rings, lone stones, a dead tree or a yew on some ---- */
    stoneRing(MOUNDS.nw[0], MOUNDS.nw[1], 2.4, 6, { gone: [0, 3], hgt: 2.0, lean: 0.12 });
    menhir(MOUNDS.ne[0] - 0.5, MOUNDS.ne[1], { hgt: 3.8, w: 0.7, d: 0.45, yaw: 0.3, tilt: -0.22 });
    stoneRing(MOUNDS.fw[0], MOUNDS.fw[1], 3.0, 7, { gone: [1, 2, 5], down: [4], hgt: 2.6, lean: 0.16 });
    stoneRing(MOUNDS.fe[0], MOUNDS.fe[1], 2.8, 7, { gone: [0, 4], down: [2], hgt: 2.8, lean: 0.12, a0: 0.4 });
    {
      const [ex, ez, er] = MOUNDS.fe, face = -Math.PI / 2 + 0.6, dx = Math.sin(face), dz = Math.cos(face);
      mouth(ex + dx * er * 0.5, ez + dz * er * 0.5, face, { wide: 0.8, tall: 1.7, torch: 1 });
    }
    for (const [x, z, s] of [[-17, 16, 1.0], [18, 14, 0.9], [-19, -15, 1.1], [17, -19, 1.0], [-15, 27, 0.9]]) yew(x, z, { s });
    for (const [x, z, hh, s] of [[7, 11, 3.2, 3], [-7, -9, 3.4, 5], [13, -15, 3.0, 7], [-28, 10, 3.6, 2], [28, 4, 3.4, 8]])
      deadTree(ctx, x, z, { bark: wood, h: hh, seed: s });
    rocks(ctx, [[4.6, 9, 0.6], [-4.4, 0, 0.7], [5, -5, 0.8], [-13, 4, 0.9], [16, -2, 1.0], [-18, 8, 0.8]], { mat: rough, seed: 9 });

    /* ---- the crown hill: a stair up its south slope to the gate ---- */
    {
      const a = [0.3, -6.4], b = [0, SOUTH + 1.4], ya = h(a[0], a[1]), yb = Y.bailey;
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
      const n = Math.max(2, Math.ceil((yb - ya) / 0.4)), half = len / n / 2 + 0.04;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, top = ya + (yb - ya) * ((i + 1) / n);
        const low = Math.min(h(x, z), top) - 0.5;
        S.box([x, (top + low) / 2, z], [1.3, (top - low) / 2, half], rough, { ax: yawAx(yaw), rd: 0.06, res: 0.13 });
      }
      bowl(-2.4, -6.0, { s: 0.85 });
      bowl(2.6, -6.2, { s: 0.85 });
    }

    /* ---- the curtain wall: the south run with the gate, the west run behind the keep, a stub on the north ---- */
    const curtain = (a, b, { tall = 2.8, thick = 1.2, low = () => 1, crenel = true, res = 0.14 } = {}) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz) + Math.PI / 2, n = Math.max(1, Math.round(len / 2.2));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, k = low(t);
        if (k <= 0) continue;
        const gy = h(x, z), y0 = lowest(x, z, 1.2) - 0.8, top = gy + tall * k * B.rr(0.9, 1.05), hx = len / n / 2 + 0.03;
        S.box([x, (y0 + top) / 2, z], [hx, (top - y0) / 2, thick / 2], stone, { ax: yawAx(yaw), rd: 0.08, res });
        if (crenel && k > 0.85) for (const s of [-0.5, 0.5]) {
          if (B.rr(0, 1) < 0.3) continue;
          S.box([x + Math.cos(yaw) * s * hx, top + 0.3, z - Math.sin(yaw) * s * hx], [hx * 0.28, 0.32, thick / 2 + 0.04], rough, { ax: yawAx(yaw), rd: 0.05, res: 0.12 });
        }
      }
    };
    const W0 = BAILEY[0] - BOX[0] + 0.7, E0 = BAILEY[0] + BOX[0] - 0.7, N0 = BAILEY[1] - BOX[1] + 0.7;
    // west of the gate: tall by the gate, then broken down to stumps in front of the keep
    curtain([-2.0, SOUTH], [W0, SOUTH], { low: t => (t < 0.35 ? 1 : t < 0.5 ? 0.6 : t < 0.62 ? 0 : t < 0.8 ? 0.35 : 0.55) });
    curtain([2.0, SOUTH], [E0, SOUTH], { low: t => (t < 0.55 ? 1 : t < 0.7 ? 0 : 0.7) });
    curtain([W0, SOUTH], [W0, N0], { low: t => (t < 0.3 ? 0.8 : t < 0.45 ? 0 : 1) });
    curtain([W0, N0], [W0 + 5, N0], { low: t => (t < 0.6 ? 0.9 : 0) });
    // the gate: two squat round towers and a lintel high enough to walk under; rubble inside to climb onto the wall west of it
    {
      for (const s of [-1, 1]) {
        const tx = s * 2.3, tz = SOUTH, gy = h(tx, tz);
        S.lathe([tx, gy - 1.2, tz], 5.0, [1.45, 1.25], stone, { res: 0.13 });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.2;
          if (s > 0 && i === 4) continue;
          S.box([tx + Math.cos(a) * 1.1, gy + 3.8 + 0.32, tz + Math.sin(a) * 1.1], [0.3, 0.32, 0.3], rough, { ax: yawAx(-a), rd: 0.05, res: 0.11 });
        }
        // a sconce on each tower's face
        const ox = tx - s * 0.2, oz = tz + 1.55;
        S.tube([[tx - s * 0.2, gy + 1.7, tz + 1.2], [ox, gy + 1.95, oz]], 0.07, 0.05, iron, { res: 0.06 });
        S.ball([ox, gy + 2.0, oz], [0.2, 0.12, 0.2], iron, { res: 0.06 });
        ctx.fire([ox, gy + 2.08, oz], 0.7, { k: 0.7, r: 3.6 });
      }
      S.box([0, Y.bailey + 2.8 + 0.4, SOUTH], [1.6, 0.42, 0.75], rough, { rd: 0.08, res: 0.12 });
      // a rag hanging from the lintel
      ctx.later(() => {
        const rag = { r: ramp('rag'), g: [ramp('rag')[0]], mod: grit(0.5) };
        for (const [ox, len] of [[-0.6, 1.1], [0.1, 0.7], [0.5, 1.3]]) S.box([ox, Y.bailey + 2.8 - len / 2, SOUTH + 0.8], [0.18, len / 2, 0.03], rag, { res: 0.06 });
      });
      // rubble heaped against the inside of the wall, each block a step up, to the wall-walk
      const wy = h(-4.6, SOUTH) + 2.8;
      for (let i = 0; i < 5; i++) {
        const x = -7.4 + i * 0.55, z = SOUTH - 2.4 + i * 0.42, tp = Y.bailey + (wy - Y.bailey) * ((i + 1) / 5.4);
        S.box([x, (tp + Y.bailey - 0.6) / 2, z], [0.75, (tp - Y.bailey + 0.6) / 2, 0.7], rough, { ax: yawAx(0.5 + i * 0.2), rd: 0.1, res: 0.12 });
      }
      ctx.wisp([-4.4, wy + 1.0, SOUTH]); // on the wall-walk west of the gate
    }

    /* ---- the keep: a tall square tower, its top broken in steps, a round stair turret on its north-east corner standing highest,
       a bartizan on the south-east corner, one lit window. A roofless hall leans on its east side ---- */
    {
      const [kx, kz] = KEEP, gy = Y.bailey, y0 = gy - 1.2, top = 12.0, hw = KW;
      const rollAx = a => [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
      // a battered foot, wider than the tower
      S.box([kx, gy + 0.2, kz], [hw + 0.45, 1.4, hw + 0.45], rough, { rd: 0.2, res: 0.14 });
      const body = S.box([kx, (y0 + top) / 2, kz], [hw, (top - y0) / 2, hw], stone, { hold: true, rd: 0.12 });
      // the broken top: the west half stepped down, a crack down the front
      const bite1 = S.box([kx - hw, top + 0.2, kz], [hw * 0.9, 1.9, hw + 0.5], stone, { hold: true, ax: rollAx(0.5) });
      const bite2 = S.box([kx - hw * 0.15, top + 0.4, kz + hw], [0.7, 1.2, 0.9], stone, { hold: true, ax: rollAx(-0.3) });
      const crack = S.box([kx + 0.6, top - 2.4, kz + hw], [0.14, 1.8, 0.6], stone, { hold: true, ax: rollAx(-0.15) });
      const door = S.box([kx - 0.4, gy + 1.0, kz + hw], [0.8, 1.3, 0.8], stone, { hold: true });
      const doorTop = S.tube([[kx - 0.4, gy + 2.3, kz + hw + 0.5], [kx - 0.4, gy + 2.3, kz + hw - 0.8]], 0.8, 0.8, stone, { hold: true });
      const win = S.box([kx + 1.15, top - 2.6, kz + hw], [0.3, 0.75, 0.6], stone, { hold: true });
      const slits = [[-1.6, gy + 4.4], [1.4, gy + 3.2], [-0.4, gy + 5.6]].map(([ox, sy]) => S.box([kx + ox, sy, kz + hw], [0.12, 0.45, 0.5], stone, { hold: true }));
      S.join('cut', body, [bite1, bite2, crack, door, doorTop, win, ...slits], { res: 0.14, inner: st.slice(0, 2) });
      // the doorway and the slits are black inside
      S.box([kx - 0.4, gy + 1.1, kz + hw - 0.75], [0.78, 1.4, 0.06], hollow, { res: 0.1 });
      // crenels on the east half, still standing
      for (const [x, z] of [[kx + hw - 0.35, kz + hw - 0.35], [kx + 1.0, kz + hw - 0.35], [kx + hw - 0.35, kz + 0.4], [kx + hw - 0.35, kz - 1.4], [kx + 0.6, kz - hw + 0.35]])
        S.box([x, top + 0.35, z], [0.4, 0.36, 0.4], rough, { rd: 0.06, res: 0.12 });
      // the stair turret on the north-east corner: it stands highest
      {
        const tx = kx + hw - 0.1, tz = kz - hw + 0.1, tt = 13.2;
        S.lathe([tx, y0, tz], tt - y0, [1.3, 1.15], stone, { res: 0.13 });
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          if (i === 3) continue;
          S.box([tx + Math.cos(a) * 1.0, tt + 0.3, tz + Math.sin(a) * 1.0], [0.26, 0.3 + (i % 2) * 0.1, 0.26], rough, { ax: yawAx(-a), rd: 0.05, res: 0.1 });
        }
      }
      // a bartizan out on the south-east corner: a round box on a cone of corbels
      {
        const bx = kx + hw + 0.2, bz = kz + hw + 0.2, by = top - 1.6;
        S.lathe([bx, by - 1.0, bz], 1.0, [0.2, 0.85], rough, { res: 0.11 });
        S.lathe([bx, by, bz], 1.5, [0.85, 0.85], stone, { res: 0.11 });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          S.box([bx + Math.cos(a) * 0.65, by + 1.75, bz + Math.sin(a) * 0.65], [0.2, 0.25, 0.2], rough, { ax: yawAx(-a), rd: 0.04, res: 0.1 });
        }
      }
      // buttresses at the front corners
      for (const s of [-1, 1]) S.box([kx + s * (hw + 0.3), gy + 1.0, kz + hw - 0.5], [0.45, 2.0, 0.55], rough, { ax: rollAx(s * 0.12), rd: 0.08, res: 0.13 });
      // the one lit window: warm light baked round it, a glow in it after the bakes
      ctx.lamp([kx + 1.15, top - 2.6, kz + hw + 0.6], 2.2, 0.8);
      ctx.glow(() => {
        const [x, y, z] = [kx + 1.15, top - 2.6, kz + hw + 0.08];
        B.iso(x, y + 0.2, z, 0.2, B.P[fire[4]], 3, { em: true, nd: true, k: 7, ph: 1, sp: 2 });
        B.iso(x, y - 0.25, z, 0.2, B.P[fire[3]], 3, { em: true, nd: true });
        B.iso(x, y, z + 0.1, 0.7, B.P[fire[2]], 0.25, { em: true, nd: true, k: 7, ph: 2, sp: 1.6 });
      });
      // a torn banner down the turret, and a pole
      ctx.later(() => {
        const rag = { r: ramp('rag'), g: [ramp('rag')[0]], mod: grit(0.6) };
        const px = kx + hw + 0.9, pz = kz - hw + 0.4;
        S.tube([[px, 12.6, pz], [px + 0.9, 12.7, pz + 0.2]], 0.05, 0.05, wood, { res: 0.05 });
        for (const [ox, len] of [[0.25, 2.4], [0.55, 1.6], [0.8, 2.0]]) S.box([px + ox, 12.6 - len / 2, pz + 0.1], [0.14, len / 2, 0.03], rag, { res: 0.07 });
      });
      // the roofless hall: three walls and a gable, against the keep's east side
      {
        const x0 = kx + hw, x1 = kx + hw + 4.4, z0 = kz - 2.2, z1 = kz + 2.2, wt = 2.6;
        S.box([(x0 + x1) / 2, gy + wt / 2 - 0.4, z1], [(x1 - x0) / 2, wt / 2 + 0.4, 0.35], stone, { rd: 0.06, res: 0.14 });
        // the south wall has a doorway in it
        S.box([x1, gy + wt / 2 - 0.4, (z0 + z1) / 2 - 1.2], [0.35, wt / 2 + 0.4, 1.0], stone, { rd: 0.06, res: 0.14 });
        S.box([x1, gy + 1.0 - 0.4, z1 - 0.4], [0.35, 1.0 + 0.4, 0.4], stone, { rd: 0.06, res: 0.14 });
        S.box([(x0 + x1) / 2, gy + wt / 2 - 0.4, z0], [(x1 - x0) / 2, wt / 2 + 0.4, 0.35], stone, { rd: 0.06, res: 0.14 });
        rocks(ctx, [[x0 + 1.4, z0 + 1.2, 0.5], [x1 - 0.8, z1 - 1.6, 0.4]], { mat: rough, seed: 33 });
        ctx.wisp([(x0 + x1) / 2 + 0.4, gy + 1.0, (z0 + z1) / 2 + 0.3]); // in the roofless hall
        post(x1 + 0.9, z1 + 0.6, { hgt: 1.7, k: 0.55, r: 3.2 });
      }
      post(kx - 1.9, kz + hw + 1.6, { hgt: 1.8 });
    }

    /* ---- the greatest barrow: an avenue of stones up its dome, its kerb, and the crown of stones round the beacon ---- */
    {
      const [sx, sz] = SUMMIT;
      // the avenue: pairs of stones either side of the way up
      for (let i = 0; i < 3; i++) {
        const a = AVENUE[i + 1 < AVENUE.length - 1 ? i + 1 : i], b = AVENUE[Math.min(i + 2, AVENUE.length - 1)];
        void b;
        const p = [AVENUE[0][0] + (sx - AVENUE[0][0]) * (i + 1) / 4.2, AVENUE[0][1] + (sz - AVENUE[0][1]) * (i + 1) / 4.2];
        void a;
        const dx = sx - AVENUE[0][0], dz = sz - AVENUE[0][1], l = Math.hypot(dx, dz), rx = dz / l, rz = -dx / l;
        for (const s of [-1, 1]) {
          if (i === 1 && s > 0) { fallen(p[0] + rx * 2.2, p[1] + rz * 2.2, { len: 2.0, yaw: Math.atan2(dx, dz) + 0.4 }); continue; }
          menhir(p[0] + rx * s * 1.7, p[1] + rz * s * 1.7, { hgt: 1.5 + i * 0.25, w: 0.42, d: 0.3, yaw: Math.atan2(dx, dz), tilt: B.rr(-0.15, 0.15), roll: s * 0.12 });
        }
      }
      // the kerb round the dome's foot
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, x = sx + Math.cos(a) * 6.6, z = sz + Math.sin(a) * 6.6;
        if (polyDist(x, z, AVENUE) < 1.6 || B.rr(0, 1) < 0.2 || Math.hypot(x - KEEP[0], z - KEEP[1]) < KW + 5) continue;
        menhir(x, z, { hgt: B.rr(0.6, 0.9), w: 0.45, d: 0.34, yaw: Math.atan2(Math.cos(a), Math.sin(a)), tilt: 0.1, sink: 0.4, res: 0.12 });
      }
      // the crown: tall stones leaning out, a gap where the avenue comes in
      const tops = stoneRing(sx, sz, 3.0, 8, { gone: [3], hgt: 2.9, lean: 0.24, a0: Math.PI * 0.5 + 0.35, w: 0.58, d: 0.4 });
      // two carry a lintel across their tops, the one the start sees
      void tops;
      // the dais and the beacon
      S.lathe([sx, Y.summit - 0.5, sz], 0.95, [1.35, 1.2], rough, { res: 0.11 });
      ctx.beacon(bowl(sx, sz, { y: Y.summit + 0.42, lit: false }), 1.7);
      // ghost-green signs cut in two of the stones, glowing faintly
      ctx.glow(() => {
        for (const [a, y] of [[Math.PI * 0.5 + 0.35 + Math.PI * 2 * 2 / 8, 1.4], [Math.PI * 0.5 + 0.35 + Math.PI * 2 * 5 / 8, 1.6]]) {
          const cx = sx + Math.cos(a) * 2.55, cz = sz + Math.sin(a) * 2.55, cy = Y.summit + y;
          for (let k = 0; k < 7; k++) {
            const t = k / 7 * Math.PI * 2;
            B.iso(cx - Math.sin(a) * Math.cos(t) * 0.22, cy + Math.sin(t) * 0.3, cz + Math.cos(a) * Math.cos(t) * 0.22, 0.05, B.P[gh[2]], 2.5, { em: true, nd: true, k: 6, ph: k, sp: 1.2, rg: 0.01 });
          }
          B.iso(cx, cy, cz, 0.45, B.P[gh[1]], 0.25, { em: true, nd: true, k: 7, ph: a, sp: 1.4 });
        }
      });
      // braziers either side of where the avenue meets the crown
      bowl(-2.2, SOUTH - 2.4, { s: 0.85 });
    }

    /* ---- far ruins and stones, black against the fog ---- */
    const farStone = (x, z, tall) => { const gy = h(x, z); S.box([x, gy + tall / 2 - 0.5, z], [0.9, tall / 2 + 0.5, 0.6], far, { ax: tipAx(B.rr(0, 3), B.rr(-0.2, 0.2)), rd: 0.3, res: 0.3 }); };
    for (const [x, z, t] of [[-44, -40, 6], [-40, -42, 4.5], [46, -38, 5.5], [52, 8, 5], [-54, 4, 6]]) farStone(x, z, t);
    {
      const x = 40, z = -44, gy = h(x, z);
      S.lathe([x, gy - 1, z], 8, [2.2, 1.9], far, { res: 0.32 });
      for (let i = 0; i < 4; i++) S.box([x + Math.cos(i * 1.5) * 1.8, gy + 7.4, z + Math.sin(i * 1.5) * 1.8], [0.45, 0.45 + i * 0.15, 0.45], far, { res: 0.3 });
    }

    /* ---- the start ---- */
    ctx.spawn([START[0], h(START[0], START[1]), START[1]], Math.PI);

    /* ---- what glows: ghost lights in the doors, ghost-green motes over the mounds, fog lying in the hollows; the sky and the moon ---- */
    ctx.glow(({ B }) => {
      const sk = ramp('skyband'), dk = ramp('sky')[0], mn = ramp('moon'), fg = ramp('fog');
      // in each ghost-lit door: a faint green glow and a few slow specks
      ghosts.forEach(([x, y, z], i) => {
        B.iso(x, y, z, 0.7, B.P[gh[0]], 0.35, { em: true, nd: true, k: 7, ph: i, sp: 1.1 });
        B.iso(x, y - 0.2, z, 0.25, B.P[gh[1]], 0.6, { em: true, nd: true, k: 7, ph: i + 1, sp: 1.6 });
        lib.motes(B, 6, [x - 0.8, x + 0.8, y - 0.6, y + 1.2, z - 0.8, z + 0.8], [gh[1], gh[2]], 0.03);
      });
      // ghost-green motes drifting over the mounds
      for (const [mx, mz, mr] of Object.values(MOUNDS)) {
        const n = Math.round(mr * 1.1);
        for (let i = 0; i < n; i++) {
          const a = B.rr(0, Math.PI * 2), d = Math.sqrt(B.rr(0, 1)) * mr * 0.7, x = mx + Math.cos(a) * d, z = mz + Math.sin(a) * d;
          B.iso(x, h(x, z) + B.rr(0.5, 2.6), z, B.rr(0.025, 0.045), B.P[B.pick([gh[1], gh[1], gh[2]])], 2.5, { em: true, nd: true, k: 6, ph: B.rr(0, 6), sp: B.rr(0.3, 0.8), rg: B.rr(0.15, 0.5) });
        }
      }
      // ghost fog: long flat soft dabs lying low in the hollows, in drifts
      for (let i = 0; i < 140; i++) {
        const x = B.rr(-30, 30), z = B.rr(-30, 22), gy = h(x, z);
        if (gy > 2.4 || B.n3(x * 0.12 + 3, z * 0.12, 7) < 0.4) continue;
        B.axial(x, gy + B.rr(0.25, 0.9), z, [1, 0, B.rr(-0.25, 0.25)], B.rr(2.2, 4.4), B.rr(0.35, 0.6), B.P[B.pick([fg[1], fg[1], fg[2]])], B.rr(0.14, 0.3), { em: true, nd: true, k: 6, ph: B.rr(0, 6), sp: B.rr(0.1, 0.25), rg: B.rr(0.3, 0.6) });
      }

      // the moon: big and low between the keep and the crown, the turret just across its left edge
      const dir = (a, e) => [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
      const toKeep = Math.atan2(KEEP[0] - EYE[0], -(KEEP[1] - EYE[2])), dKeep = Math.hypot(KEEP[0] - EYE[0], KEEP[1] - EYE[2]);
      const mr = 3.0 * Math.PI / 180, az = toKeep + (KW + 1.2) / dKeep + mr * 0.7, el = -0.03, D = 175, rm = D * Math.tan(mr);
      const u = dir(az, el), M = [EYE[0] + u[0] * D, EYE[1] + u[1] * D, EYE[2] + u[2] * D];
      // the dome: near-black overhead, violet low down, fog colour under the horizon
      B.sky(d => (d[1] < -0.06 ? fg[0] : d[1] < 0.03 ? sk[1] : d[1] < 0.16 ? sk[0] : dk), 230);
      // the band: long low splats round the horizon, magenta toward the moon
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * Math.PI * 2, w = Math.cos(a - az) + B.rr(-0.12, 0.12), R = 205;
        const rows = w > 0.8 ? [[-0.11, sk[2]], [-0.08, sk[3]], [-0.05, sk[3]], [-0.02, sk[3]], [0.01, sk[2]], [0.045, sk[2]], [0.09, sk[1]]]
          : w > 0.2 ? [[-0.11, sk[1]], [-0.07, sk[2]], [-0.035, sk[2]], [0.0, sk[2]], [0.04, sk[1]], [0.09, sk[1]]]
          : [[-0.08, sk[1]], [-0.03, sk[1]], [0.02, sk[1]], [0.07, sk[0]]];
        for (const [e, c] of rows) {
          const p = dir(a + B.rr(-0.01, 0.01), e + B.rr(-0.004, 0.004));
          B.axial(EYE[0] + p[0] * R, EYE[1] + p[1] * R, EYE[2] + p[2] * R, [Math.cos(a), 0, Math.sin(a)], 6.5, 3.6, B.P[c], 0.8, { em: true, nd: true });
        }
      }
      // the disc, laid flat to the eye: pale green-white, with darker seas
      const rt = norm([-u[2], 0, u[0]]), up = cross(rt, u);
      const sp = rm * 0.09;
      for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
        const a = (i + (j % 2) * 0.5) * sp, b = j * sp * 0.87;
        if (a * a + b * b > rm * rm * 0.94) continue;
        const sea = B.n3(a / rm * 1.7 + 4, b / rm * 1.7 + 1, 2) > 0.58 || (a - rm * 0.25) ** 2 + (b - rm * 0.2) ** 2 < (rm * 0.3) ** 2;
        B.iso(M[0] + rt[0] * a + up[0] * b, M[1] + rt[1] * a + up[1] * b, M[2] + rt[2] * a + up[2] * b, sp * 0.62, B.P[sea ? mn[0] : mn[1]], 3, { em: true, nd: true });
      }
      // a soft magenta glow round it
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2, p = [M[0] + rt[0] * Math.cos(a) * rm * 1.5 + up[0] * Math.sin(a) * rm * 1.3, M[1] + up[1] * Math.sin(a) * rm * 1.3, M[2] + rt[2] * Math.cos(a) * rm * 1.5 + up[2] * Math.sin(a) * rm * 1.3];
        B.iso(p[0] + u[0] * 6, p[1] + u[1] * 6, p[2] + u[2] * 6, rm * 0.7, B.P[sk[3]], 0.3, { em: true, nd: true });
      }
      // thin dark cloud across its lower half
      for (const [off, len, th] of [[-0.45, 1.8, 0.06], [-0.7, 2.4, 0.05]]) {
        const c = [M[0] + up[0] * off * rm - u[0] * 8, M[1] + up[1] * off * rm - u[1] * 8, M[2] + up[2] * off * rm - u[2] * 8];
        for (let k = -2; k <= 2; k++) B.axial(c[0] + rt[0] * k * rm * len * 0.4, c[1], c[2] + rt[2] * k * rm * len * 0.4, rt, rm * len * 0.32, rm * th, B.P[sk[1]], 1, { em: true, nd: true });
      }
      // long torn cloud higher up, and dim stars
      for (let i = 0; i < 22; i++) {
        const a = az + B.rr(-1.5, 1.5), e = B.rr(0.08, 0.3), R = 210, p = dir(a, e);
        B.axial(EYE[0] + p[0] * R, EYE[1] + p[1] * R, EYE[2] + p[2] * R, [Math.cos(a), 0, Math.sin(a)], B.rr(12, 22), B.rr(1.2, 2.2), B.P[sk[B.pick([0, 0, 1])]], 0.85, { em: true, nd: true });
      }
      for (let i = 0; i < 50; i++) {
        const p = dir(B.rr(0, Math.PI * 2), B.rr(0.3, 1.3)), R = 222;
        B.iso(EYE[0] + p[0] * R, EYE[1] + p[1] * R, EYE[2] + p[2] * R, B.rr(0.3, 0.5), B.P[B.pick([sk[3], mn[0]])], 3, { em: true, nd: true });
      }
      void smooth;
    });
  }
};
