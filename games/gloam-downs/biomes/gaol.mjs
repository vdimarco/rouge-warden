// The Sunken Gaol: a prison sunk into a bowl in the moor, seen by moonlight. You arrive on the south rim at a ruined gate and look down
// into the yard. Across it the far side climbs in tiers: each tier is a block of barred cells with torches at their mouths, and the
// cracked watch-keep stands on the top with a low moon behind it. Cold blue stone, black-green moor, orange fire.
//
// The start camera looks down at a low pitch: the top of its picture is only about 1.8 degrees above level. So the start stands high on
// the rim and the top is a little lower than the start, which puts the keep and the moon in the top band of the first picture. The
// beacon stands on a stepped pyre, so it is still well above the start.
import { brazier, steps, tower, deadTree, rocks, shrubs, yawAx } from '../lib/props.mjs';
import { lib, polyDist, tile } from '../lib/common.mjs';

// heights of the levels
const Y = { start: 7.0, yard: 0, t1: 2.6, t2: 5.0, top: 6.4, graves: 3.4 };
const START = [3, 27];
// the walked line: down from the rim, across the yard, up the west stair, east along the first tier, up the east stair, west along
// the second tier, through the inner arch and onto the top
const PATH = [[3, 27], [2.6, 22.5], [1.5, 17], [0.2, 11], [-3, 5.5], [-8, 2.6], [-10.4, 1], [-10.4, -3.2], [-9, -6.2], [0, -6.4],
  [8.6, -6.2], [9.4, -8.6], [9.4, -12.4], [4, -12.8], [0, -13], [0, -16.6], [2.2, -18.4]];
// the keep and the beacon pyre on the top, the graves on the west shelf, the tower stump on the east hill
const KEEP = [-2.6, -24];
const PYRE = [3.4, -18.8];
const GRAVES = [-16, 9];
const STUMP = [17.5, 3];
// the start camera's eye (the preview's and the page's first view), used to hang the moon behind the keep
const EYE_UP = 1 + 9 * Math.sin(0.3), EYE_BACK = 9 * Math.cos(0.3);

export default {
  id: 'gaol',
  name: 'The Sunken Gaol',
  sub: 'Cells cut into the moor, and the keep on the hill',
  hint: 'Climb to the keep. Light the beacon.',
  seed: 11,
  palette: [
    ['sky', [0x04050b]],
    ['skyband', [0x0a0e1e, 0x141b36, 0x222b50, 0x36406c]],
    ['fog', [0x0d1122]],
    ['ink', [0x020308]],
    ['shade', [0x06080e]],
    ['moor', [0x07100c, 0x0d1a13, 0x15281b, 0x223a24, 0x35502e]],
    ['mud', [0x0f0b0c, 0x221715, 0x3a2822, 0x564030]],
    ['stone', [0x0a0e18, 0x151b2c, 0x232c45, 0x37445f, 0x56658a]],
    ['moss', [0x15241a, 0x2a4226]],
    ['wood', [0x120c0a, 0x281b13, 0x45301f]],
    ['rust', [0x1f120d, 0x4a2a1a]],
    ['moon', [0x8e9ab4, 0xdfe3d2]]
  ],
  // the key light is the moon, high in the north-west for form (the moon you see sits low in the north)
  light: { sun: [-0.45, 0.62, -0.62], amb: 0.1, sky: 0.16, sunK: 0.44, shK: 7 },
  fog: { color: 'fog', far: 60, start: 0.5, max: 0.88 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 34 },
  hills: {
    base: 3,
    bumps: [
      [-1, -22, 16, 2], // the summit hill
      [19, 2, 13, 3.6], // the east hill
      [-20, 4, 12, 2.6], // the west hill
      [-12, 30, 12, 3.2], [17, 29, 11, 3.4], [3, 36, 10, 3], // the south rim
      [-42, -36, 20, 6], [40, -40, 20, 7], // far hills either side of the keep
      [0, -96, 72, -12] // the land falls away north, so the keep and the moon stand against the sky
    ],
    fbm: { amp: 0.5, freq: 1 / 11, oct: 3 },
    warp: { amp: 3, freq: 1 / 22 },
    far: { amp: 8, start: 36, end: 62 },
    pits: [[1, 6, 19, 4]],
    flats: [
      { at: [0, 6], box: [10, 8], blend: 7, y: Y.yard }, // the yard
      { at: START, r: 3.5, blend: 6, y: Y.start }, // the rim at the start
      { at: GRAVES, r: 4.2, blend: 3, y: Y.graves }, // the burial shelf
      { at: [0, -20.5], r: 6.5, blend: 3, y: Y.top }, // the top
      { at: [0, -12.6], box: [10, 1.7], blend: 0.8, y: Y.t2 }, // the second tier
      { at: [0, -6.4], box: [11.5, 2.1], blend: 0.8, y: Y.t1 } // the first tier
    ],
    paths: [{ pts: PATH, w: 2.2, depth: 0.1 }],
    box: [-116, 116, -116, 116]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
    const moor = ramp('moor'), mud = ramp('mud'), st = ramp('stone'), fire = ramp('fire');
    // rough surfaces: a broad tone wander and a fine grain
    const grit = (k = 1) => (x, y, z) => k * (0.16 * (B.n3(x * 0.45, z * 0.45, y * 0.3 + 3) - 0.5) + 0.14 * (B.n3(x * 2.6, y * 2.6, z * 2.6) - 0.5));
    // laid stone: grit, and dark mortar between courses and between blocks
    const laid = (k = 0.8, ch = 0.62) => {
      const g = grit(k);
      return (x, y, z) => {
        const c = y / ch, row = Math.floor(c), f = c - row, u = ((x + z) / 1.15 + row * 0.5) % 1;
        return g(x, y, z) + (f < 0.12 || (u + 1) % 1 < 0.07 ? -0.15 : 0);
      };
    };
    const stone = { r: st, g: [st[1]], mod: laid(0.8), top: { min: 0.72, r: ramp('moss') } };
    const rough = { r: st, g: [st[1]], mod: grit(0.9), top: { min: 0.78, r: ramp('moss') } };
    const dark = { r: st.slice(0, 3), g: [st[0]], mod: grit(0.6) };
    const far = { r: st.slice(0, 2), mod: grit(0.5) };
    const wood = { r: ramp('wood'), g: [ramp('wood')[1]], mod: grit(0.5) };
    const iron = { r: ramp('rust'), g: [ramp('rust')[0]] };
    const soil = { r: mud, g: [mud[1]], mod: grit(1) };
    const bone = { r: [st[3], st[4]] };

    /* ---- the ground: a fine rectangle over the play area, then strips coarser each time out ---- */
    {
      const onPath = (x, z) => polyDist(x, z, PATH) + 0.7 * (B.n3(x * 1.1, z * 1.1, 4) - 0.5) < 1.15;
      const yard = (x, y, z) => y < Y.yard + 0.5 && B.n3(x * 0.5, z * 0.5, 9) > 0.48;
      const near = { r: moor, g: [moor[1]], mod: grit(1), rf: (x, y, z) => (onPath(x, z) || yard(x, y, z) ? mud : moor) };
      const mid = { r: moor, mod: grit(1.2), fat: 0.62 }, out = { r: moor, mod: grit(1.4), fat: 0.8 };
      const N = [-24, 24, -31, 31], M = [-56, 56, -56, 56], F = [-116, 116, -116, 116];
      tile(S, h, near, { x0: N[0], x1: N[1], z0: N[2], z1: N[3], res: 0.3 });
      const ring = (o, i, res, mat) => {
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: o[2], z1: i[2], res });
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: i[3], z1: o[3], res });
        tile(S, h, mat, { x0: o[0], x1: i[0], z0: i[2], z1: i[3], res });
        tile(S, h, mat, { x0: i[1], x1: o[1], z0: i[2], z1: i[3], res });
      };
      ring(M, N, 0.6, mid);
      ring(F, M, 1.3, out);
    }

    /* ---- small props of this place ---- */
    // a post with a fire on top
    const post = (x, z, { hgt = 1.8, y, s = 0.8, k = 0.75, r = 3.8 } = {}) => {
      const y0 = y ?? h(x, z) - 0.1;
      S.tube([[x, y0, z], [x, y0 + hgt, z]], 0.14, 0.1, wood, { res: 0.07 });
      S.ball([x, y0 + hgt + 0.02, z], [0.21, 0.12, 0.21], iron, { res: 0.06 });
      ctx.fire([x, y0 + hgt + 0.1, z], s, { k, r });
    };
    // an iron sconce on a wall: a bracket out from the face (nx, nz) and a cup with a flame
    const sconce = (x, y, z, nx, nz, { s = 0.7, k = 0.7, r = 3.4 } = {}) => {
      const ox = x + nx * 0.45, oz = z + nz * 0.45;
      S.tube([[x, y - 0.3, z], [ox, y - 0.06, oz]], 0.07, 0.05, iron, { res: 0.05 });
      S.ball([ox, y, oz], [0.2, 0.12, 0.2], iron, { res: 0.05 });
      ctx.fire([ox, y + 0.08, oz], s, { k, r });
    };
    // a chunky iron cage: a few fat bars, a hoop, a domed lid and a floor
    const cage = (x, yc, z, { r = 0.5, hh = 0.62 } = {}) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        S.tube([[x + Math.cos(a) * r, yc - hh, z + Math.sin(a) * r], [x + Math.cos(a) * r * 0.92, yc + hh, z + Math.sin(a) * r * 0.92]], 0.05, 0.05, iron, { res: 0.05 });
      }
      S.torus([x, yc + 0.1, z], r * 0.97, 0.045, iron, { res: 0.05 });
      S.ball([x, yc + hh + 0.06, z], [r * 1.02, 0.2, r * 1.02], iron, { res: 0.06 });
      S.ball([x, yc - hh, z], [r * 1.05, 0.08, r * 1.05], iron, { res: 0.06 });
    };
    // a gibbet: a post, an arm reaching `reach` the way (dx, dz), a brace, a chain and a cage at the end
    const gibbet = (x, z, dx, dz, { y, hgt = 4.2, reach = 2.2, drop = 2.4 } = {}) => {
      const y0 = (y ?? h(x, z)) - 0.2, ex = x + dx * reach, ez = z + dz * reach, yaw = Math.atan2(dx, dz);
      S.box([x, y0 + hgt / 2, z], [0.19, hgt / 2, 0.19], wood, { ax: yawAx(yaw), rd: 0.04, res: 0.09 });
      S.box([(x + ex) / 2 + dx * 0.15, y0 + hgt - 0.12, (z + ez) / 2 + dz * 0.15], [0.15, 0.15, reach / 2 + 0.3], wood, { ax: yawAx(yaw), rd: 0.04, res: 0.09 });
      S.tube([[x, y0 + hgt - 1.1, z], [x + dx * 0.9, y0 + hgt - 0.12, z + dz * 0.9]], 0.08, 0.08, wood, { res: 0.07 });
      S.tube([[ex, y0 + hgt - 0.2, ez], [ex, y0 + hgt - drop + 0.7, ez]], 0.035, 0.035, iron, { res: 0.05 });
      cage(ex, y0 + hgt - drop, ez);
    };
    // a grave: a low mound and a stake (crossed on some), maybe a skull on top
    const grave = (x, z, a, i) => {
      const y = h(x, z);
      S.ball([x, y - 0.1, z], [0.55, 0.3, 0.95], soil, { ax: yawAx(a), res: 0.1 });
      const hx = x + Math.sin(a) * 0.95, hz = z + Math.cos(a) * 0.95, lean = B.rr(-0.2, 0.2), tall = B.rr(1.1, 1.6);
      S.tube([[hx, y - 0.3, hz], [hx + lean, y + tall, hz + lean * 0.5]], 0.1, 0.07, wood, { res: 0.06 });
      if (i % 3 === 0) S.box([hx + lean * 0.75, y + tall * 0.72, hz + lean * 0.38], [0.42, 0.07, 0.07], wood, { ax: yawAx(a + Math.PI / 2), res: 0.06 });
      if (i % 4 === 1) S.ball([hx + lean, y + tall + 0.12, hz + lean * 0.5], [0.15, 0.17, 0.15], bone, { res: 0.05 });
    };
    // a frame for a slanted cut (rolled about the z axis)
    const rollAx = a => [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]];

    /* ---- the ruined gate on the rim, where the road drops into the yard ---- */
    {
      const gx = 2.6, gz = 22.6;
      const pillar = (x, tall, whole) => {
        const y0 = Math.min(h(x - 0.7, gz), h(x + 0.7, gz), h(x, gz - 0.7)) - 0.6, gy = h(x, gz);
        S.box([x, y0 + 0.55, gz], [0.95, 0.55 + 0.6, 0.95], rough, { rd: 0.1, res: 0.12 });
        S.box([x, (y0 + gy + tall) / 2, gz], [0.72, (gy + tall - y0) / 2, 0.72], stone, { rd: 0.08, res: 0.12 });
        if (whole) S.box([x, gy + tall + 0.2, gz], [0.92, 0.22, 0.92], rough, { rd: 0.06, res: 0.11 });
        else S.box([x + 0.15, gy + tall + 0.12, gz - 0.1], [0.6, 0.3, 0.55], rough, { ax: rollAx(0.35), rd: 0.06, res: 0.11 });
      };
      pillar(gx - 2.9, 2.3, false);
      pillar(gx + 2.9, 4.0, true);
      // the lintel lies broken at the foot of the short pillar, a chunk of it down the slope
      S.box([gx - 3.6, h(gx - 3.6, gz - 1.6) + 0.3, gz - 1.6], [1.6, 0.4, 0.5], rough, { ax: yawAx(0.45), rd: 0.08, res: 0.12 });
      S.box([gx + 0.6, h(gx + 0.6, gz - 4.5) + 0.2, gz - 4.5], [0.6, 0.35, 0.45], rough, { ax: yawAx(1.1), rd: 0.08, res: 0.12 });
      // fires on posts on the rim side, out from the pillars so the light falls on their edges
      post(gx - 2.1, gz + 1.5, { hgt: 1.7 });
      post(gx + 2.1, gz + 1.5, { hgt: 1.7 });
      // low broken walls along the rim either side
      const run = (pts, tall) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
          const n = Math.max(1, Math.round(len / 2.2));
          for (let k = 0; k < n; k++) {
            if (B.rr(0, 1) < 0.22) continue;
            const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, gy = h(x, z), hi = tall * B.rr(0.55, 1.05);
            S.box([x, gy + hi / 2 - 0.3, z], [0.5, hi / 2 + 0.3, len / n / 2 + 0.04], rough, { ax: yawAx(yaw), rd: 0.08, res: 0.14 });
          }
        }
      };
      run([[gx - 3.9, gz], [-6, 21.6], [-11, 19.4]], 2.0);
      run([[gx + 3.9, gz], [11, 21.8], [15.5, 19.2]], 2.2);
      rocks(ctx, [[gx - 5.5, gz - 2.5, 0.6], [gx + 4.6, gz - 1.8, 0.5]], { mat: rough, seed: 21 });
    }

    /* ---- the cell blocks: the faces of the two tiers, each a row of barred cells ---- */
    const cellBlock = ({ x0, x1, zf, zb, top, cells, arch = 2.2, half = 0.88, deep = 1.9, lights = [], res = 0.13 }) => {
      const yb = Math.min(h(x0, zf + 0.5), h(x1, zf + 0.5), h((x0 + x1) / 2, zf + 0.5)) - 1.2;
      const hx = (x1 - x0) / 2, hz = (zf - zb) / 2, hy = (top - yb) / 2;
      const block = S.box([(x0 + x1) / 2, yb + hy, (zf + zb) / 2], [hx, hy, hz], stone, { hold: true, rd: 0.1 });
      const holes = [];
      for (const c of cells) {
        const fy = h(c.x, zf + 0.6), sp = fy + arch - half;
        holes.push(S.box([c.x, (fy - 0.5 + sp) / 2, zf - deep / 2 + 0.15], [half, (sp - fy + 0.5) / 2, deep / 2 + 0.15], dark, { hold: true }));
        holes.push(S.tube([[c.x, sp, zf + 0.3], [c.x, sp, zf - deep]], half, half, dark, { hold: true }));
      }
      S.join('cut', block, holes, { res, inner: st.slice(0, 2) });
      // a cap course along the top edge, standing proud of the face
      S.box([(x0 + x1) / 2, top - 0.1, zf + 0.12], [hx + 0.12, 0.2, 0.3], rough, { rd: 0.06, res: 0.12 });
      for (const c of cells) {
        const fy = h(c.x, zf + 0.6), sp = fy + arch - half, zb2 = zf - 0.18;
        // bars: five fat ones and a cross bar, or torn out and bent where the cell is open
        const bx = [-0.62, -0.31, 0, 0.31, 0.62];
        if (!c.torn) {
          for (const d of bx) S.tube([[c.x + d, fy - 0.2, zb2], [c.x + d, sp + Math.sqrt(half * half - d * d) + 0.05, zb2]], 0.055, 0.055, iron, { res: 0.055 });
          S.tube([[c.x - half, fy + 1.15, zb2], [c.x + half, fy + 1.15, zb2]], 0.05, 0.05, iron, { res: 0.055 });
        } else {
          S.tube([[c.x - 0.62, fy - 0.2, zb2], [c.x - 0.62, sp + 0.6, zb2]], 0.055, 0.055, iron, { res: 0.055 });
          S.tube([[c.x + 0.31, sp + 0.8, zb2], [c.x + 0.5, fy + 0.9, zb2 + 0.7], [c.x + 0.9, fy + 0.05, zb2 + 1.3]], 0.055, 0.055, iron, { res: 0.055 });
          S.tube([[c.x, sp + 0.85, zb2], [c.x - 0.2, fy + 1.3, zb2 + 0.5], [c.x - 0.4, fy + 0.1, zb2 + 1.5]], 0.055, 0.055, iron, { res: 0.055 });
        }
        // inside: a chain from the vault, and in some a skull on the floor
        S.tube([[c.x + 0.25, sp + 0.7, zf - deep + 0.3], [c.x + 0.3, sp - 0.3, zf - deep + 0.35]], 0.035, 0.035, iron, { res: 0.045 });
        if (c.skull) S.ball([c.x - 0.3, fy + 0.12, zf - deep + 0.55], [0.16, 0.15, 0.17], bone, { res: 0.05 });
      }
      for (const lx of lights) sconce(lx, h(lx, zf + 0.6) + 1.9, zf, 0, 1);
    };
    // the first tier: four cells under the first terrace, one torn open
    cellBlock({ x0: -8.8, x1: 8.8, zf: -0.6, zb: -4.6, top: Y.t1 + 0.1, lights: [-7.3, -3.8, -0.2, 3.4, 7.0],
      cells: [{ x: -5.6, skull: true }, { x: -2.0 }, { x: 1.6, torn: true, skull: true }, { x: 5.2 }] });
    // the second tier: three cells under the second terrace
    cellBlock({ x0: -7.4, x1: 7.4, zf: -8.7, zb: -11.8, top: Y.t2 + 0.1, arch: 2.0, half: 0.8, lights: [-5.9, 2.4],
      cells: [{ x: -4.1 }, { x: -0.7, skull: true }, { x: 4.6 }] });
    // the face below the top: a low wall with a gap for the stair
    for (const [a, b] of [[-8.2, -1.7], [1.7, 8.2]]) {
      const yb = Y.t2 - 0.8, tp = Y.top + 0.25;
      S.box([(a + b) / 2, (yb + tp) / 2, -15.1], [(b - a) / 2, (tp - yb) / 2, 0.55], stone, { rd: 0.08, res: 0.14 });
    }

    /* ---- stairs between the levels ---- */
    steps(ctx, [-10.4, 1.6], [-10.4, -4.8], { mat: rough, width: 2.4, rise: 0.3 }); // yard to the first tier (west)
    steps(ctx, [9.4, -7.4], [9.4, -11.6], { mat: rough, width: 2.4, rise: 0.3 }); // first tier to the second (east)
    steps(ctx, [0, -13.3], [0, -16.6], { mat: rough, width: 2.6, rise: 0.3 }); // second tier to the top
    steps(ctx, [-9.6, 7.4], [-12.8, 8.2], { mat: rough, width: 2.2, rise: 0.3 }); // yard up to the graves
    post(-11.9, -2.2, { hgt: 1.6 });
    post(8.0, -8.0, { hgt: 1.6 });

    /* ---- gibbets on the first tier, their cages hung out over the yard ---- */
    gibbet(-4.0, -2.4, 0, 1, { y: Y.t1 + 0.1, reach: 2.6, drop: 3.6 });
    gibbet(6.9, -2.6, 0, 1, { y: Y.t1 + 0.1, reach: 2.4, drop: 3.4, hgt: 4.6 });
    brazier(ctx, -0.4, -7.2, { iron, s: 1.0 });

    /* ---- the inner arch at the head of the last stair ---- */
    {
      const ax0 = 0, az = -16.9, base = Y.top, clear = 2.3;
      for (const s of [-1, 1]) {
        S.box([ax0 + s * 2.05, base + (clear + 0.2) / 2 - 0.6, az], [0.58, (clear + 0.2) / 2 + 0.6, 0.62], stone, { rd: 0.08, res: 0.12 });
        sconce(ax0 + s * 2.05, base + 1.7, az + 0.62, 0, 1, { s: 0.65 });
      }
      S.box([ax0, base + clear + 0.4, az], [2.75, 0.42, 0.7], rough, { rd: 0.08, res: 0.12 });
      S.box([ax0, base + clear + 1.05, az], [0.5, 0.32, 0.74], rough, { rd: 0.06, res: 0.11 });
      S.tube([[ax0 - 1.1, base + clear, az], [ax0 - 1.1, base + clear - 0.5, az]], 0.035, 0.035, iron, { res: 0.045 });
    }

    /* ---- the keep on the top: cracked, its north-east corner bitten away, a turret at the back ---- */
    {
      const [kx, kz] = KEEP, gy = h(kx, kz), y0 = gy - 1.2, top = gy + 4.0, hw = 2.7;
      const body = S.box([kx, (y0 + top) / 2, kz], [hw, (top - y0) / 2, hw], stone, { hold: true, rd: 0.12 });
      const biteC = [kx + 2.5, top + 0.7, kz - 1.4], biteR = [2.1, 2.3, 2.3];
      const bite = S.ball(biteC, biteR, stone, { hold: true });
      const split = S.box([kx + 1.1, top - 0.9, kz + hw], [0.16, 1.5, 0.7], stone, { hold: true, ax: rollAx(-0.2) });
      const door = S.box([kx - 0.7, gy + 0.95, kz + hw], [0.85, 1.35, 0.75], stone, { hold: true });
      S.join('cut', body, [bite, split, door], { res: 0.14, inner: st.slice(0, 2) });
      const bitten = (x, y, z) => ((x - biteC[0]) / biteR[0]) ** 2 + ((y - biteC[1]) / biteR[1]) ** 2 + ((z - biteC[2]) / biteR[2]) ** 2 < 1.15;
      for (const [sx, sz, ex, ez] of [[-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1]])
        for (let i = 0; i < 5; i++) {
          const t = (i + 0.5) / 5, x = kx + (sx + (ex - sx) * t) * (hw - 0.3), z = kz + (sz + (ez - sz) * t) * (hw - 0.3);
          if (bitten(x, top, z) || i % 2) continue;
          S.box([x, top + 0.32, z], [0.42, 0.34, 0.42], rough, { rd: 0.06, res: 0.12 });
        }
      // the turret on the back-west corner, a little taller than the keep
      const tx = kx - hw + 0.4, tz = kz - hw + 0.4;
      S.lathe([tx, top - 1.6, tz], 2.7, [1.15, 1.0], stone, { res: 0.13 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        if (i === 2) continue;
        S.box([tx + Math.cos(a) * 0.9, top + 1.32, tz + Math.sin(a) * 0.9], [0.24, 0.26, 0.24], rough, { ax: yawAx(-a), rd: 0.05, res: 0.1 });
      }
      // buttresses at the front corners
      for (const s of [-1, 1]) S.box([kx + s * (hw + 0.3), gy + 0.6, kz + hw - 0.5], [0.45, 1.8, 0.6], rough, { ax: rollAx(s * 0.12), rd: 0.08, res: 0.13 });
      // the lit slits: the only warm windows on the hill
      ctx.glow(() => {
        for (const [x, y, z] of [[kx - 1.7, top - 1.1, kz + hw + 0.05], [tx + 0.35, top + 0.5, tz + 1.05]]) {
          B.iso(x, y, z, 0.13, B.P[fire[4]], 3, { em: true, nd: true, k: 7, ph: 1, sp: 2 });
          B.iso(x, y - 0.3, z, 0.12, B.P[fire[3]], 3, { em: true, nd: true });
        }
      });
      rocks(ctx, [[kx + 4.0, kz - 2.6, 0.75], [kx + 4.6, kz - 0.7, 0.5], [kx + 3.1, kz + 3.6, 0.42]], { mat: rough, seed: 40 });
      // a dead tree beside the keep, its limbs across the moon
      deadTree(ctx, kx + 3.6, kz - 1.8, { bark: wood, h: 3.6, seed: 9 });
    }

    /* ---- the beacon on its stepped pyre, fires either side ---- */
    {
      const [px, pz] = PYRE, gy = h(px, pz);
      [2.7, 2.2, 1.75, 1.3, 0.85].forEach((r, i) => S.lathe([px, gy - 0.6, pz], 0.6 + 0.45 * (i + 1), r, rough, { res: 0.11 }));
      const top = brazier(ctx, px, pz, { iron, y: gy + 2.25, fireOn: false });
      ctx.beacon(top, 1.7);
      post(px - 3.4, pz + 1.4, { hgt: 1.9 });
      post(px + 3.2, pz - 1.6, { hgt: 1.9 });
    }

    /* ---- the burial shelf on the west hill: a graveyard of stakes, a tomb, a gibbet ---- */
    {
      const [gx, gz] = GRAVES;
      let i = 0;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        const x = gx - 2.8 + c * 1.9 + B.rr(-0.3, 0.3), z = gz - 2.6 + r * 2.4 + B.rr(-0.3, 0.3);
        if (Math.hypot(x - gx - 1.2, z - gz) < 1.6) continue; // room for the tomb
        grave(x, z, B.rr(-0.25, 0.25), i++);
      }
      // the tomb: a stone chest with a cracked lid, low enough to jump onto
      const ty = h(gx + 1.2, gz);
      S.box([gx + 1.2, ty + 0.35, gz], [0.75, 0.7, 1.15], stone, { rd: 0.06, res: 0.1 });
      S.box([gx + 1.25, ty + 1.12, gz + 0.05], [0.85, 0.12, 1.25], rough, { ax: yawAx(0.08), rd: 0.04, res: 0.1 });
      gibbet(gx - 3.6, gz + 3.4, 1, 0, { reach: 1.8, drop: 2.2, hgt: 3.8 });
      brazier(ctx, gx + 3.2, gz - 2.4, { iron, s: 0.9 });
      deadTree(ctx, gx - 2.4, gz - 4.2, { bark: wood, h: 3.6, seed: 3 });
      // a row of leaning stakes along the shelf edge
      for (let k = 0; k < 7; k++) {
        const x = gx + 3.8 + B.rr(-0.2, 0.2), z = gz - 3 + k * 1.05, y = h(x, z) - 0.3, l = B.rr(-0.3, 0.3);
        if (k === 3) continue;
        S.tube([[x, y, z], [x + 0.25 + l * 0.2, y + B.rr(1.0, 1.5), z + l]], 0.1, 0.03, wood, { res: 0.06 });
      }
    }

    /* ---- the east hill: a broken tower stump with rubble to climb, a gibbet against the sky ---- */
    {
      const [sx, sz] = STUMP, gy = h(sx, sz);
      tower(ctx, sx, sz, { mat: stone, cap: rough, r: 2.0, height: 4.4, broken: 1.6, res: 0.13 });
      // rubble blocks rising round its south-west side, each a step up
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 0.95 - i * 0.42, x = sx + Math.cos(a) * 2.75, z = sz + Math.sin(a) * 2.75, tp = gy + 0.6 * (i + 1);
        S.box([x, (tp + h(x, z) - 0.5) / 2, z], [0.62, (tp - h(x, z) + 0.5) / 2, 0.55], rough, { ax: yawAx(-a), rd: 0.08, res: 0.12 });
      }
      brazier(ctx, sx - 3.4, sz + 2.6, { iron, s: 0.9 });
      gibbet(sx + 3.6, sz - 5.6, -1, 0, { reach: 2.0, drop: 2.0, hgt: 4.0 });
    }

    /* ---- dead trees, rocks, gorse ---- */
    for (const [x, z, hh, s] of [[-6.6, 19.6, 3.4, 1], [12.8, 18.6, 3.6, 2], [21, 10, 3.4, 4], [14, -5, 3.0, 5], [-26, -12, 3.8, 6],
      [25, -16, 3.2, 7], [-24, 24, 3.2, 8], [24, 27, 3.0, 10], [-15, -6, 3.2, 11]])
      deadTree(ctx, x, z, { bark: wood, h: hh, seed: s });
    rocks(ctx, [[-4, 13, 0.8], [6, 9, 0.7], [-7, -1.5, 0.6], [12, -3, 1.0], [-14, -14, 1.2], [13, -18, 1.1], [-21, 16, 1.0], [20, 18, 1.2], [-27, 4, 1.4], [27, -4, 1.3]],
      { mat: rough, seed: 3 });
    shrubs(ctx, [[-3, 18, 0.6], [8, 15, 0.5], [-12, 13, 0.6], [11, 5, 0.5], [-9, -12, 0.6], [11, -15, 0.7], [16, 24, 0.6], [-17, 21, 0.6]],
      { mat: { r: moor.slice(0, 4), mod: grit(1) } });

    /* ---- far ruins, black against the fog ---- */
    tower(ctx, 44, -34, { mat: far, r: 2.6, height: 9, broken: 3, res: 0.3 });
    tower(ctx, -46, -30, { mat: far, r: 2.2, height: 7, broken: 2.5, res: 0.3 });
    tower(ctx, 52, 16, { mat: far, r: 2, height: 7, res: 0.3 });

    /* ---- the start, the wisps ---- */
    ctx.spawn([START[0], h(START[0], START[1]), START[1]], Math.PI);
    ctx.wisp([1.6, h(1.6, -1.6) + 1.0, -1.6]); // inside the torn cell
    ctx.wisp([7.6, Y.t1 + 1.3, -2.2]); // on the ledge above the cells
    ctx.wisp([GRAVES[0] + 1.2, h(GRAVES[0] + 1.2, GRAVES[1]) + 2.4, GRAVES[1]]); // over the tomb
    ctx.wisp([STUMP[0] - 0.6, h(STUMP[0], STUMP[1]) + 4.6, STUMP[1] + 0.4]); // on the tower stump
    ctx.wisp([-0.6, h(-0.6, -28.6) + 1.1, -28.6]); // behind the keep

    /* ---- sky: a dark dome brightening to the horizon, a low moon behind the keep, torn cloud, stars, drifting dust ---- */
    ctx.glow(({ B }) => {
      const sk = ramp('skyband'), dk = ramp('sky')[0], mn = ramp('moon');
      const sy = h(START[0], START[1]);
      const eye = [START[0], sy + EYE_UP, START[1] + EYE_BACK];
      // the moon: a little right of the keep and just under level, as the start eye sees it
      const toKeep = Math.atan2(KEEP[0] - eye[0], -(KEEP[1] - eye[2]));
      const az = toKeep + 0.05, el = -0.004, D = 175, rm = D * Math.tan(1.9 * Math.PI / 180);
      const u = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
      const M = [eye[0] + u[0] * D, eye[1] + u[1] * D, eye[2] + u[2] * D];
      const md = B.norm(M);
      B.sky(d => {
        const near = d[0] * md[0] + d[1] * md[1] + d[2] * md[2];
        if (d[1] < 0.07 && near > 0.975) return sk[3];
        return d[1] < 0.05 ? sk[2] : d[1] < 0.15 ? sk[1] : d[1] < 0.32 ? sk[0] : dk;
      }, 230);
      // the disc, laid flat to the eye: pale, with darker seas
      const rt = B.norm([u[2], 0, -u[0]]), up = [rt[1] * u[2] - rt[2] * u[1], rt[2] * u[0] - rt[0] * u[2], rt[0] * u[1] - rt[1] * u[0]];
      const sp = rm * 0.16;
      for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
        const a = (i + (j % 2) * 0.5) * sp, b = j * sp * 0.87;
        if (a * a + b * b > rm * rm) continue;
        const sea = B.n3(a / rm * 1.6 + 4, b / rm * 1.6 + 1, 2) > 0.56 || (a + rm * 0.3) ** 2 + (b - rm * 0.25) ** 2 < (rm * 0.28) ** 2;
        B.iso(M[0] + rt[0] * a + up[0] * b, M[1] + rt[1] * a + up[1] * b, M[2] + rt[2] * a + up[2] * b, sp * 0.62, B.P[sea ? mn[0] : mn[1]], 3, { em: true, nd: true });
      }
      // two thin dark bars of cloud across its lower half
      for (const [b, w] of [[-0.35, 1.5], [-0.62, 1.1]]) {
        const c = [M[0] + up[0] * b * rm - u[0] * 4, M[1] + up[1] * b * rm - u[1] * 4, M[2] + up[2] * b * rm - u[2] * 4];
        for (let k = -3; k <= 3; k++)
          B.axial(c[0] + rt[0] * k * rm * 0.38 * w, c[1] + up[1] * Math.sin(k) * 0.4, c[2] + rt[2] * k * rm * 0.38 * w, rt, rm * 0.3 * w, rm * 0.045, B.P[sk[0]], 2.2, { em: true, nd: true });
      }
      // stars, high up only
      for (let i = 0; i < 70; i++) {
        const a = B.rr(0, Math.PI * 2), e = B.rr(0.22, 1.2), r = 225;
        B.iso(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, B.rr(0.25, 0.45), B.P[B.pick([sk[3], mn[0]])], 3, { em: true, nd: true });
      }
      // torn cloud low in the sky
      for (let i = 0; i < 16; i++) {
        const a = -1.3 + i * 0.17 + B.rr(-0.05, 0.05), e = 0.07 + B.rr(0, 0.16), r = 205;
        const p = [Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r, -Math.cos(a) * Math.cos(e) * r];
        B.axial(p[0], p[1], p[2], [Math.cos(a), 0, Math.sin(a)], B.rr(10, 18), B.rr(1.4, 2.4), B.P[sk[B.pick([0, 1])]], 0.8, { em: true, nd: true });
      }
      lib.motes(B, 90, [-26, 26, 0.4, 9, -30, 30], [sk[3], mn[0]], 0.03);
    });
  }
};
