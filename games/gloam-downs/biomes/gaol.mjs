// The Sunken Gaol: a prison sunk into a bowl in the moor, seen by moonlight. You stand in a ruined gate on the south rim and look down
// into the yard. Across it the far side climbs in tiers: each tier is a block of barred cells with torches at their mouths. On the top
// stands the cracked watch-keep with a low moon behind it, and the beacon waits on its roof. Cold blue stone, black-green moor, orange fire.
//
// The follow camera looks down at a low pitch: the top of its picture is at about eye level. So the start stands high on the rim, the
// top is lower than the start, and the beacon is raised on the keep's roof. That keeps the keep and the moon inside the first picture,
// and the beacon still stands well above the start.
import { rocks, shrubs, deadTree, yawAx } from '../lib/props.mjs';
import { lib, polyDist, tile } from '../lib/common.mjs';

// heights of the levels
const Y = { start: 7.4, yard: -2.2, t1: 0.4, t2: 2.8, top: 4.2, graves: 2.0, roof: 8.0 };
const START = [3, 25.5];
// the walked line: down from the rim, across the yard, up the west stair, east along the first tier, up the east stair, west along
// the second tier, up through the inner arch and over the top to the keep
const PATH = [[3.6, 36], [3.2, 30], [3, 25.5], [2.4, 21], [1.2, 16], [0.2, 11], [-3, 5.5], [-8, 2.6], [-10.4, 1], [-10.4, -3.2], [-9, -6.2], [0, -6.4],
  [8.6, -6.2], [9.4, -8.6], [9.4, -12.4], [4.5, -13], [4.5, -16.8], [1, -20.5], [-2.4, -22.4]];
// the keep on the top, the graves on the west shelf, the tower stump on the east hill
const KEEP = [-6, -24];
const KW = 3.0; // the keep's half width
const GRAVES = [-16, 8];
const STUMP = [17.5, 3];
// where the start camera's eye is (preview: 9 back, pitch 0.3), to hang the moon and the haze behind the keep
const EYE_UP = 1 + 9 * Math.sin(0.3), EYE_BACK = 9 * Math.cos(0.3);

export default {
  id: 'gaol',
  name: 'The Sunken Gaol',
  sub: 'Cells cut into the moor, and the keep on the hill',
  hint: 'Climb to the keep. Light the beacon.',
  seed: 11,
  palette: [
    ['sky', [0x04050b]],
    ['skyband', [0x0a0e1e, 0x141b36, 0x222b50, 0x36406c, 0x4f5c8a]],
    ['fog', [0x0d1122]],
    ['ink', [0x020308]],
    ['shade', [0x06080e]],
    ['moor', [0x060e0a, 0x0c1811, 0x132519, 0x1d3321, 0x2b4529]],
    ['mud', [0x0f0b0c, 0x221715, 0x3a2822, 0x564030]],
    ['stone', [0x0a0e18, 0x151b2c, 0x232c45, 0x37445f, 0x56658a]],
    ['moss', [0x15241a, 0x2a4226]],
    ['wood', [0x120c0a, 0x281b13, 0x45301f]],
    ['rust', [0x1f120d, 0x4a2a1a]],
    ['moon', [0x8e9ab4, 0xdfe3d2]]
  ],
  // the key light is cold moonlight from the south-west, over your left shoulder at the start, so the faces you look at (the gate's
  // drums, the cell fronts) catch it and read against their black mouths. The moon you see rises in the north behind the keep: the
  // light is set for form, not to match it.
  light: { sun: [-0.5, 0.6, 0.62], amb: 0.11, sky: 0.15, sunK: 0.46, shK: 7 },
  fog: { color: 'fog', far: 72, start: 0.5, max: 0.88 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 34 },
  hills: {
    base: 3,
    bumps: [
      [-3, -22, 16, 1.2], // the summit hill
      [19, 2, 13, 3.6], // the east hill
      [-20, 4, 12, 2.6], // the west hill
      [-12, 30, 12, 3.2], [17, 29, 11, 3.4], [3, 35, 10, 3], // the south rim
      [-42, -36, 20, 6], [40, -40, 20, 7], // far hills either side of the keep
      [0, -96, 72, -12] // the land falls away north, so the keep and the moon stand against the sky
    ],
    fbm: { amp: 0.5, freq: 1 / 11, oct: 3 },
    warp: { amp: 3, freq: 1 / 22 },
    far: { amp: 8, start: 36, end: 62 },
    // the yard's bowl, and a valley north of the summit: the land behind the keep drops below its foot, so the keep stands on the haze
    pits: [[1, 5, 19, 5], [-14, -70, 36, 9], [-18, -104, 50, 14]],
    flats: [
      { at: [0, 5], box: [10, 9], blend: 7, y: Y.yard }, // the yard
      { at: [3, 33.5], box: [6.2, 2.5], blend: 6, y: Y.start }, // the gate's terrace on the rim, falling gently away behind you
      { at: [3, 26.8], box: [5.6, 2.4], blend: 2.6, y: Y.start }, // and steeply in front, just past the gate
      { at: GRAVES, r: 4.2, blend: 3, y: Y.graves }, // the burial shelf
      { at: [-2, -20.6], r: 7, blend: 3, y: Y.top }, // the top
      { at: [0, -12.6], box: [10, 1.7], blend: 0.8, y: Y.t2 }, // the second tier
      { at: [0, -6.4], box: [11.5, 2.1], blend: 0.8, y: Y.t1 } // the first tier
    ],
    paths: [{ pts: PATH, w: 2.2, depth: 0.1 }],
    box: [-112, 112, -112, 112]
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
    // lamp light on stone: from cold stone through deep red and rust to orange, so a torch makes a pool of firelight, not grey mud
    const warmStone = [st[1], fire[0], ramp('rust')[1], fire[1], fire[2], fire[3]];
    const stone = { r: st, g: warmStone, mod: laid(0.8), top: { min: 0.72, r: ramp('moss') } };
    const rough = { r: st, g: warmStone, mod: grit(0.9), top: { min: 0.78, r: ramp('moss') } };
    const dark = { r: st.slice(0, 3), g: [st[0]], mod: grit(0.6) };
    const gateStone = { r: st.slice(0, 3), g: warmStone, mod: laid(0.7), top: { min: 0.72, r: ramp('moss') } };
    const far = { r: st.slice(0, 2), mod: grit(0.5) };
    const wood = { r: ramp('wood'), g: [ramp('wood')[1]], mod: grit(0.5) };
    const iron = { r: ramp('rust'), g: [ramp('rust')[0]] };
    const bars = { r: [ramp('iron')[0], ramp('iron')[0], ramp('iron')[1]], g: [ramp('iron')[0], ramp('rust')[0], ramp('rust')[1], fire[1]] };
    const soil = { r: mud, g: [mud[0], mud[1], mud[2], fire[1], fire[2], fire[3]], mod: grit(1) };
    const bone = { r: [st[3], st[4]] };

    /* ---- the ground: a fine rectangle over the play area, then strips coarser each time out ---- */
    {
      const onPath = (x, z) => polyDist(x, z, PATH) + 0.7 * (B.n3(x * 1.1, z * 1.1, 4) - 0.5) < 1.15;
      const yard = (x, y, z) => y < Y.yard + 0.5 && B.n3(x * 0.5, z * 0.5, 9) > 0.46;
      const near = { r: moor, g: [moor[0], moor[1], mud[1], mud[2], fire[1], fire[2]], mod: grit(1), rf: (x, y, z) => (onPath(x, z) || yard(x, y, z) ? mud : moor) };
      const mid = { r: moor, mod: grit(1.2), fat: 0.85 }, out = { r: moor, mod: grit(1.4), fat: 0.95 };
      const N = [-24, 24, -31, 38], M = [-56, 56, -56, 56], F = [-108, 108, -108, 108];
      tile(S, h, near, { x0: N[0], x1: N[1], z0: N[2], z1: N[3], res: 0.34 });
      const ring = (o, i, res, mat) => {
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: o[2], z1: i[2], res });
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: i[3], z1: o[3], res });
        tile(S, h, mat, { x0: o[0], x1: i[0], z0: i[2], z1: i[3], res });
        tile(S, h, mat, { x0: i[1], x1: o[1], z0: i[2], z1: i[3], res });
      };
      ring(M, N, 0.7, mid);
      ring(F, M, 2.0, out);
    }

    /* ---- small props of this place ---- */
    // a post with a fire on top
    const post = (x, z, { hgt = 1.8, y, s = 0.8, k = 0.6, r = 3.4 } = {}) => {
      const y0 = y ?? h(x, z) - 0.1;
      S.tube([[x, y0, z], [x, y0 + hgt, z]], 0.14, 0.1, wood, { res: 0.08 });
      S.ball([x, y0 + hgt + 0.02, z], [0.21, 0.12, 0.21], iron, { res: 0.07 });
      ctx.fire([x, y0 + hgt + 0.1, z], s, { k, r });
    };
    // an iron sconce on a wall: a bracket out from the face (nx, nz) and a cup with a flame
    const sconce = (x, y, z, nx, nz, { s = 0.7, k = 0.7, r = 3.6, n = 2 } = {}) => {
      const ox = x + nx * 0.45, oz = z + nz * 0.45;
      S.tube([[x, y - 0.3, z], [ox, y - 0.06, oz]], 0.07, 0.05, iron, { res: 0.06 });
      S.ball([ox, y, oz], [0.2, 0.12, 0.2], iron, { res: 0.06 });
      ctx.fire([ox, y + 0.08, oz], s, { k, r, n });
    };
    // an iron fire bowl on three fat legs; returns the top of the bowl
    const bowl = (x, z, { y, s = 0.9, lit = true, k = 0.6 } = {}) => {
      const y0 = y ?? h(x, z) - 0.05;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        S.tube([[x + Math.cos(a) * 0.45, y0, z + Math.sin(a) * 0.45], [x + Math.cos(a) * 0.2, y0 + 0.72, z + Math.sin(a) * 0.2]], 0.07, 0.06, iron, { res: 0.07 });
      }
      const b = S.ball([x, y0 + 0.95, z], [0.52, 0.3, 0.52], iron, { hold: true });
      const in_ = S.ball([x, y0 + 1.12, z], [0.43, 0.27, 0.43], iron, { hold: true });
      S.join('cut', b, in_, { res: 0.08 });
      if (lit) ctx.fire([x, y0 + 1.0, z], s, { k });
      return [x, y0 + 1.0, z];
    };
    // a run of stone steps from a to b, each `rise` high, as blocks set into the slope
    const stair = (a, b, { width = 2.4, rise = 0.32, mat = rough, ya, yb } = {}) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
      ya = ya ?? h(a[0], a[1]); yb = yb ?? h(b[0], b[1]);
      const n = Math.max(2, Math.ceil(Math.abs(yb - ya) / rise)), half = len / n / 2 + 0.04;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, top = ya + (yb - ya) * ((i + 1) / n);
        const low = Math.min(h(x, z), top) - 0.5;
        S.box([x, (top + low) / 2, z], [width / 2, (top - low) / 2, half], mat, { ax: yawAx(yaw), rd: 0.06, res: 0.13 });
      }
      ctx.stair([a, b], width);
    };
    // a chunky iron cage: a few fat bars, a hoop, a domed lid and a floor
    const cage = (x, yc, z, { r = 0.5, hh = 0.62 } = {}) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        S.tube([[x + Math.cos(a) * r, yc - hh, z + Math.sin(a) * r], [x + Math.cos(a) * r * 0.92, yc + hh, z + Math.sin(a) * r * 0.92]], 0.055, 0.055, bars, { res: 0.07 });
      }
      S.torus([x, yc + 0.1, z], r * 0.97, 0.05, bars, { res: 0.08 });
      S.ball([x, yc + hh + 0.06, z], [r * 1.02, 0.2, r * 1.02], iron, { res: 0.08 });
      S.ball([x, yc - hh, z], [r * 1.05, 0.08, r * 1.05], iron, { res: 0.08 });
    };
    // a gibbet: a post, an arm reaching `reach` the way (dx, dz), a brace, a chain and a cage at the end
    const gibbet = (x, z, dx, dz, { y, hgt = 4.2, reach = 2.2, drop = 2.4 } = {}) => {
      const y0 = (y ?? h(x, z)) - 0.2, ex = x + dx * reach, ez = z + dz * reach, yaw = Math.atan2(dx, dz);
      S.box([x, y0 + hgt / 2, z], [0.19, hgt / 2, 0.19], wood, { ax: yawAx(yaw), rd: 0.04, res: 0.11 });
      S.box([(x + ex) / 2 + dx * 0.15, y0 + hgt - 0.12, (z + ez) / 2 + dz * 0.15], [0.15, 0.15, reach / 2 + 0.3], wood, { ax: yawAx(yaw), rd: 0.04, res: 0.11 });
      S.tube([[x, y0 + hgt - 1.1, z], [x + dx * 0.9, y0 + hgt - 0.12, z + dz * 0.9]], 0.08, 0.08, wood, { res: 0.08 });
      S.tube([[ex, y0 + hgt - 0.2, ez], [ex, y0 + hgt - drop + 0.7, ez]], 0.04, 0.04, bars, { res: 0.07 });
      cage(ex, y0 + hgt - drop, ez);
    };
    // a grave: a low mound and a stake (crossed on some), maybe a skull on top
    const grave = (x, z, a, i) => {
      const y = h(x, z);
      S.ball([x, y - 0.1, z], [0.55, 0.3, 0.95], soil, { ax: yawAx(a), res: 0.12 });
      const hx = x + Math.sin(a) * 0.95, hz = z + Math.cos(a) * 0.95, lean = B.rr(-0.2, 0.2), tall = B.rr(1.1, 1.6);
      S.tube([[hx, y - 0.3, hz], [hx + lean, y + tall, hz + lean * 0.5]], 0.11, 0.07, wood, { res: 0.07 });
      if (i % 3 === 0) S.box([hx + lean * 0.75, y + tall * 0.72, hz + lean * 0.38], [0.42, 0.07, 0.07], wood, { ax: yawAx(a + Math.PI / 2), res: 0.07 });
      if (i % 4 === 1) S.ball([hx + lean, y + tall + 0.12, hz + lean * 0.5], [0.15, 0.17, 0.15], bone, { res: 0.06 });
    };
    // a frame for a slanted cut (rolled about the z axis)
    const rollAx = a => [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]];

    /* ---- the ruined gate on the rim: you start in it, its pillars stand on the terrace and frame the first view ---- */
    {
      const gx = START[0], gz = START[1] - 0.4, span = 4.2;
      // a pillar of fat stacked drums, each a little askew, on a plinth; a fire basket on its inner face lights the way between
      const pillar = (x, drums, whole) => {
        const gy = h(x, gz), side = Math.sign(gx - x);
        S.box([x, gy - 0.15, gz], [1.02, 0.5, 1.02], gateStone, { rd: 0.12, res: 0.13 });
        let y = gy + 0.35;
        drums.forEach((dh, i) => {
          const tw = B.rr(-0.09, 0.09), sx = B.rr(-0.06, 0.06), last = i === drums.length - 1 && !whole;
          S.box([x + sx + (last ? side * 0.12 : 0), y + dh / 2, gz + B.rr(-0.05, 0.05)], [0.74, dh / 2, 0.74], gateStone,
            { ax: last ? rollAx(-side * 0.32) : yawAx(tw), rd: 0.12, res: 0.13 });
          y += dh;
        });
        if (whole) S.box([x, y + 0.24, gz], [0.95, 0.26, 0.95], gateStone, { rd: 0.08, res: 0.13 });
        // the whole pillar keeps its fire basket; the broken one's lies cold on the ground at its foot
        if (whole) sconce(x + side * 0.74, gy + 1.95, gz + 0.25, side, 0, { s: 0.62, k: 0.5, r: 3.2 });
        else S.ball([x + side * 1.3, gy + 0.12, gz + 0.9], [0.24, 0.13, 0.22], iron, { ax: rollAx(0.6), res: 0.06 });
        return y;
      };
      pillar(gx - span, [1.1, 1.0, 1.15, 0.9], true);
      pillar(gx + span, [1.0, 0.65], false);
      // the lintel lies broken down the slope below the gate, and a drum has rolled after it
      S.box([gx - 2.4, h(gx - 2.4, gz - 4.2) + 0.25, gz - 4.2], [1.7, 0.42, 0.52], gateStone, { ax: yawAx(0.4), rd: 0.1, res: 0.13 });
      S.lathe([gx + 2.6, h(gx + 2.6, gz - 5.6) - 0.35, gz - 5.6], 1.2, 0.68, rough, { ax: [[0, 1, 0], [0.94, 0, 0.34], [0.34, 0, -0.94]], res: 0.13 });
      // the old road: big worn flagstones in staggered rows across the terrace to the lip, some sunk or tilted, some gone
      {
        const fg = grit(1.1), flag = { r: st.slice(0, 4), g: warmStone, mod: (x, y, z) => fg(x, y, z) - 0.1 };
        let row = 0;
        for (let z = 30.2; z > 23.9; z -= 1.0 + B.rr(-0.06, 0.1), row++) {
          const px = 3.2 + (30 - z) * 0.08, wide = z < 26.4 && z > 24 ? 3.1 : 1.8 + B.rr(-0.2, 0.3);
          for (let x = px - wide + (row % 2) * 0.55; x < px + wide - 0.4;) {
            const w = B.rr(0.42, 0.66);
            if (B.rr(0, 1) > 0.18 && Math.hypot(x + w - START[0], z - START[1]) > 1.0) {
              const cx = x + w + B.rr(-0.04, 0.04), cz = z + B.rr(-0.08, 0.08), gy = h(cx, cz);
              const tilt = B.rr(0, 1) < 0.3 ? B.rr(-0.14, 0.14) : 0, sunk = B.rr(0, 1) < 0.25 ? -0.1 : 0;
              S.box([cx, gy + sunk, cz], [w - 0.06, 0.13, 0.42 + B.rr(-0.06, 0.04)], flag,
                { ax: tilt ? rollAx(tilt) : yawAx(B.rr(-0.08, 0.08)), rd: 0.09, res: 0.15 });
            }
            x += 2 * w + 0.06;
          }
        }
        // the slab you start on, set square
        S.box([START[0], h(START[0], START[1]), START[1]], [0.62, 0.13, 0.5], flag, { rd: 0.09, res: 0.15 });
      }
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
      run([[gx - span - 1.2, gz], [-7, 24.4], [-12, 21.6]], 2.0);
      run([[gx + span + 1.2, gz], [13, 24.2], [17.5, 20.8]], 2.2);
    }

    /* ---- the cell blocks: the faces of the two tiers, each a row of barred cells ---- */
    // cell bars: darker than the cage iron, so they stand black against a lit cell
    const cellBars = { r: [ramp('iron')[0], ramp('iron')[0], st[2]], g: bars.g };
    const cellBlock = ({ x0, x1, zf, zb, top, cells, arch = 2.2, half = 0.88, deep = 1.9, lights = [], res = 0.15 }) => {
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
      S.box([(x0 + x1) / 2, top - 0.1, zf + 0.12], [hx + 0.12, 0.2, 0.3], rough, { rd: 0.06, res: 0.14 });
      for (const c of cells) {
        const fy = h(c.x, zf + 0.6), sp = fy + arch - half, zb2 = zf - 0.18;
        // bars: four fat ones and a cross bar, or torn out and bent where the cell is open
        const bx = [-0.6, -0.2, 0.2, 0.6], bars = cellBars;
        if (!c.torn) {
          for (const d of bx) S.tube([[c.x + d, fy - 0.2, zb2], [c.x + d, sp + Math.sqrt(half * half - d * d) + 0.05, zb2]], 0.05, 0.05, bars, { res: 0.07 });
          S.tube([[c.x - half, fy + 1.15, zb2], [c.x + half, fy + 1.15, zb2]], 0.055, 0.055, bars, { res: 0.08 });
        } else {
          /* one bar stands; two are torn from the vault and bent down against the sides, their feet kicked out over the floor. Each runs
             in the vault and then down between the walk map's grid points, so the way in stays wider than the lamplighter */
          const arc = d => sp + Math.sqrt(half * half - d * d) - 0.04;
          S.tube([[c.x - 0.62, fy - 0.2, zb2], [c.x - 0.62, sp + 0.6, zb2]], 0.06, 0.06, bars, { res: 0.08 });
          S.tube([[c.x + 0.1, arc(0.1), zb2], [c.x + 0.4, arc(0.4), zb2], [c.x + 0.8, sp + 0.68, zb2], [c.x + 0.8, fy + 0.4, zb2 + 0.05], [c.x + 1.15, fy + 0.06, zb2 + 0.8]], 0.06, 0.06, bars, { res: 0.08 });
          S.tube([[c.x - 0.05, arc(-0.05), zb2], [c.x - 0.36, arc(-0.36), zb2], [c.x - 0.48, sp + 0.68, zb2], [c.x - 0.48, fy + 0.35, zb2 + 0.05], [c.x - 0.85, fy + 0.06, zb2 + 0.85]], 0.06, 0.06, bars, { res: 0.08 });
        }
        // inside: a chain from the vault, and in some a skull on the floor
        S.tube([[c.x + 0.25, sp + 0.7, zf - deep + 0.3], [c.x + 0.3, sp - 0.3, zf - deep + 0.35]], 0.04, 0.04, bars, { res: 0.06 });
        if (c.skull) S.ball([c.x - 0.3, fy + 0.12, zf - deep + 0.55], [0.16, 0.15, 0.17], bone, { res: 0.06 });
        // a lit cell: a small fire on its floor at the back, so its bars stand black against the glow
        if (c.lit) {
          const bz = zf - deep + 0.62;
          S.ball([c.x + 0.2, fy - 0.02, bz], [0.32, 0.12, 0.3], iron, { res: 0.07 });
          ctx.fire([c.x + 0.2, fy + 0.12, bz], 0.55, { n: 2, r: 2.6, k: 1.0 });
          // the glow on the back wall and vault: soft warm light the bars cut across
          ctx.glow(() => {
            B.iso(c.x, fy + 1.0, zf - deep + 0.2, half * 0.8, B.P[fire[1]], 0.75, { em: true, nd: true });
            B.iso(c.x + 0.15, fy + 0.5, zf - deep + 0.3, half * 0.55, B.P[fire[2]], 0.8, { em: true, nd: true });
          });
        }
      }
      for (const lx of lights) sconce(lx, h(lx, zf + 0.6) + 1.9, zf, 0, 1);
    };
    // the first tier: four cells under the first terrace, one torn open, two lit from inside, three sconces between
    cellBlock({ x0: -8.8, x1: 8.8, zf: -0.6, zb: -4.6, top: Y.t1 + 0.1, lights: [-7.3, -0.2, 7.0],
      cells: [{ x: -5.6, skull: true }, { x: -2.0, lit: true }, { x: 1.6, torn: true, skull: true }, { x: 5.2, lit: true }] });
    // the second tier: three cells under the second terrace, one lit, two sconces
    cellBlock({ x0: -7.4, x1: 7.4, zf: -8.7, zb: -11.8, top: Y.t2 + 0.1, arch: 2.0, half: 0.8, lights: [-6.2, 2.2],
      cells: [{ x: -4.1, lit: true }, { x: -0.6, skull: true }, { x: 5.0 }] });
    // the face below the top: a low wall with a gap for the stair, crenellated, with fat buttresses down its face
    for (const [a, b] of [[-8.6, 3.0], [6.0, 8.2]]) {
      const yb = Y.t2 - 0.8, tp = Y.top + 0.3;
      S.box([(a + b) / 2, (yb + tp) / 2, -15.1], [(b - a) / 2, (tp - yb) / 2, 0.55], stone, { rd: 0.08, res: 0.15 });
      for (let x = a + 0.55; x < b - 0.3; x += 1.65) {
        if (B.rr(0, 1) < 0.2) continue; // a few have fallen
        S.box([x, tp + 0.3, -15.2], [0.42, 0.32 + B.rr(-0.08, 0.04), 0.5], rough, { rd: 0.06, res: 0.13 });
      }
    }
    for (const x of [-6.9, -2.9, 1.6]) S.box([x, Y.t2 + 0.45, -14.35], [0.5, 1.25, 0.42], rough, { ax: [[1, 0, 0], [0, 0.97, 0.24], [0, -0.24, 0.97]], rd: 0.1, res: 0.13 });

    /* ---- stairs between the levels ---- */
    stair([-10.4, 1.6], [-10.4, -4.8]); // yard to the first tier (west)
    stair([9.4, -7.4], [9.4, -11.6]); // first tier to the second (east)
    stair([4.5, -13.3], [4.5, -16.4], { width: 2.6 }); // second tier to the top
    post(-12.0, -2.4, { hgt: 1.6 });
    post(7.9, -8.2, { hgt: 1.6 });

    /* ---- the yard: an old well under a grate, a pair of stocks, a fire bowl ---- */
    {
      const wx = 4.2, wz = 8.2, wy = h(wx, wz);
      const ring = S.lathe([wx, wy - 0.6, wz], 1.45, 1.35, stone, { hold: true });
      const hole = S.lathe([wx, wy - 0.7, wz], 1.8, 0.98, stone, { hold: true });
      S.join('cut', ring, hole, { res: 0.12 });
      S.lathe([wx, wy + 0.52, wz], 0.1, 1.0, bars, { res: 0.09 });
      for (const s of [-1, 1]) S.box([wx + s * 1.15, wy + 1.1, wz], [0.13, 1.1, 0.13], wood, { res: 0.09 });
      S.box([wx, wy + 2.15, wz], [1.45, 0.13, 0.13], wood, { res: 0.09 });
      S.tube([[wx, wy + 2.05, wz], [wx, wy + 1.0, wz]], 0.04, 0.04, bars, { res: 0.06 });
      const kx = -5.4, kz = 10.6, ky = h(kx, kz);
      for (const s of [-1, 1]) S.box([kx + s * 0.85, ky + 0.55, kz], [0.12, 0.75, 0.12], wood, { res: 0.09 });
      S.box([kx, ky + 0.9, kz], [1.05, 0.2, 0.1], wood, { rd: 0.03, res: 0.08 });
      bowl(-1.6, 7.6, { s: 0.9, k: 0.7 });
    }

    /* ---- gibbets on the first tier, their arms reaching out sideways, so from the gate each reads as a hook with its cage ---- */
    gibbet(-4.0, -2.4, -1, 0, { y: Y.t1 + 0.1, reach: 2.3, drop: 2.2, hgt: 4.4 });
    gibbet(6.4, -2.6, 1, 0, { y: Y.t1 + 0.1, reach: 2.1, drop: 1.9, hgt: 4.6 });
    bowl(-0.4, -7.0, { s: 0.9 });

    /* ---- the inner arch at the head of the last stair ---- */
    {
      const ax0 = 4.5, az = -16.9, base = Y.top, clear = 2.3;
      for (const s of [-1, 1]) {
        S.box([ax0 + s * 2.05, base + (clear + 0.2) / 2 - 0.6, az], [0.58, (clear + 0.2) / 2 + 0.6, 0.62], stone, { rd: 0.08, res: 0.13 });
        sconce(ax0 + s * 2.05, base + 1.7, az + 0.62, 0, 1, { s: 0.65 });
      }
      S.box([ax0, base + clear + 0.4, az], [2.75, 0.42, 0.7], rough, { rd: 0.08, res: 0.13 });
      S.box([ax0, base + clear + 1.05, az], [0.5, 0.32, 0.74], rough, { rd: 0.06, res: 0.12 });
    }
    // fires on the top, either side of the way to the keep
    post(6.9, -19.8, { hgt: 1.9 });
    post(3.6, -21.0, { hgt: 1.9 });

    /* ---- a round tower west of the keep, and a broken wall to it: a wider outline on the summit ---- */
    {
      const tx = -13.2, tz = -20.4, ty = h(tx, tz);
      S.lathe([tx, ty - 1.2, tz], 5.4, [1.7, 1.5], stone, { res: 0.15 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3, hh = [0.7, 0.4, 0.9, 0.3, 0.6, 0.5][i];
        if (i === 3) continue;
        S.box([tx + Math.cos(a) * 1.3, ty + 4.2 + hh / 2, tz + Math.sin(a) * 1.3], [0.32, hh / 2 + 0.05, 0.34], rough, { ax: yawAx(-a), rd: 0.05, res: 0.12 });
      }
      // the wall from the tower to the keep, knocked down in the middle
      const ax = tx + 1.4, az = tz, dx = KEEP[0] - KW - ax, dz = KEEP[1] + 0.8 - az, L = Math.hypot(dx, dz), n = 4;
      for (let i = 0; i < n; i++) {
        if (i === 1) continue;
        const t = (i + 0.5) / n, x = ax + dx * t, z = az + dz * t, gy = h(x, z), tall = i === 2 ? 1.4 : 2.6;
        S.box([x, gy + tall / 2 - 0.4, z], [L / n / 2 + 0.05, tall / 2 + 0.4, 0.5], stone, { ax: yawAx(Math.atan2(dx, dz) + Math.PI / 2), rd: 0.08, res: 0.15 });
      }
    }

    /* ---- the keep on the top: a fat block with a battered foot and a proud parapet, a square watch-tower rising from its back corner
       (cracked, its crown bitten away), a stair up its east face to the roof and the beacon ---- */
    {
      const [kx, kz] = KEEP, gy = h(kx, kz), y0 = gy - 1.2, top = Y.roof, hw = KW;
      const body = S.box([kx, (y0 + top) / 2, kz], [hw, (top - y0) / 2, hw], stone, { hold: true, rd: 0.12 });
      // the battered foot: a wider, lower block the body stands in
      const foot = S.box([kx, (y0 + gy + 0.9) / 2, kz], [hw + 0.45, (gy + 0.9 - y0) / 2, hw + 0.45], stone, { hold: true, rd: 0.3 });
      const split = S.box([kx + 1.0, top - 0.9, kz + hw], [0.16, 1.5, 0.7], stone, { hold: true, ax: rollAx(-0.2) });
      const door = S.box([kx - 0.6, gy + 0.95, kz + hw + 0.3], [0.85, 1.35, 0.95], stone, { hold: true });
      S.join('cut', [body, foot], [split, door], { res: 0.15, inner: st.slice(0, 2) });
      // the parapet: a course standing proud all round under the crenels, so the top reads heavy against the haze
      for (const [sx, sz] of [[0, 1], [1, 0], [0, -1], [-1, 0]])
        S.box([kx + sx * (hw + 0.05), top - 0.32, kz + sz * (hw + 0.05)], [sz ? hw + 0.3 : 0.32, 0.3, sx ? hw + 0.3 : 0.32], rough, { rd: 0.06, res: 0.13 });
      // the watch-tower: square, on the back west quarter of the roof, its crown corbelled out and bitten away on the west
      const wx = kx - 1.6, wz = kz - 1.6, wh = 1.3, wt = top + 1.75;
      const tw = S.box([wx, (top - 0.5 + wt) / 2, wz], [wh, (wt - top + 0.5) / 2, wh], stone, { hold: true, rd: 0.08 });
      const crown = S.box([wx, wt + 0.12, wz], [wh + 0.28, 0.24, wh + 0.28], rough, { hold: true, rd: 0.06 });
      const merl = [];
      for (const [mx, mz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [1, 0]])
        merl.push(S.box([wx + mx * (wh - 0.05), wt + 0.62, wz + mz * (wh - 0.05)], [0.36, 0.3, 0.36], rough, { hold: true, rd: 0.05 }));
      const biteC = [wx - 1.5, wt + 0.7, wz - 1.1], biteR = [1.3, 1.25, 1.5];
      const bite = S.ball(biteC, biteR, stone, { hold: true });
      S.join('cut', [tw, crown, ...merl], bite, { res: 0.13, inner: st.slice(0, 2) });
      // crenels round the roof, with a gap where the stair comes up (the north-east corner) and none under the watch-tower
      for (const [sx, sz, ex, ez] of [[-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1]])
        for (let i = 0; i < 5; i++) {
          const t = (i + 0.5) / 5, x = kx + (sx + (ex - sx) * t) * (hw - 0.3), z = kz + (sz + (ez - sz) * t) * (hw - 0.3);
          if (i % 2 || (x > kx + 1 && z < kz - 1) || (x < wx + wh + 0.4 && z < wz + wh + 0.4)) continue;
          S.box([x, top + 0.32, z], [0.42, 0.34, 0.42], rough, { rd: 0.06, res: 0.12 });
        }
      // the stair: blocks along the east face, rising north from the ground to the roof
      const n = 8;
      for (let i = 0; i < n; i++) {
        const z = kz + hw - 0.35 - (i + 0.5) * ((2 * hw - 0.4) / n), tp = gy + (top - gy) * ((i + 1) / n);
        S.box([kx + hw + 0.62, (tp + gy - 0.6) / 2, z], [0.66, (tp - gy + 0.6) / 2, (hw - 0.2) / n + 0.03], rough, { rd: 0.05, res: 0.13 });
      }
      // buttresses at the front corners
      for (const s of [-1, 1]) S.box([kx + s * (hw + 0.35), gy + 0.7, kz + hw - 0.45], [0.46, 1.8, 0.6], rough, { ax: rollAx(s * 0.12), rd: 0.08, res: 0.13 });
      // a gantry out of the west face, a cage hung against the sky
      S.box([kx - hw - 1.2, top - 1.0, kz + 0.6], [1.35, 0.14, 0.14], wood, { rd: 0.03, res: 0.09 });
      S.tube([[kx - hw, top - 2.2, kz + 0.6], [kx - hw - 0.9, top - 1.05, kz + 0.6]], 0.08, 0.08, wood, { res: 0.08 });
      S.tube([[kx - hw - 2.3, top - 1.05, kz + 0.6], [kx - hw - 2.3, top - 1.9, kz + 0.6]], 0.04, 0.04, iron, { res: 0.07 });
      cage(kx - hw - 2.3, top - 2.6, kz + 0.6);
      // the beacon: a fire bowl on a plinth on the roof, east of the watch-tower
      const bx = kx + 0.7, bz = kz + 0.4;
      S.box([bx, top + 0.3, bz], [0.78, 0.38, 0.78], rough, { rd: 0.05, res: 0.11 });
      ctx.beacon(bowl(bx, bz, { y: top + 0.66, lit: false }), 1.7);
      // the lit slits: one warm window high in the watch-tower, one in the keep's face
      ctx.glow(() => {
        for (const [x, y, z, s] of [[wx + 0.3, wt - 0.6, wz + wh + 0.06, 1], [kx - 1.7, top - 1.6, kz + hw + 0.06, 0.85]]) {
          B.iso(x, y, z, 0.13 * s, B.P[fire[4]], 3, { em: true, nd: true, k: 7, ph: 1, sp: 2 });
          B.iso(x, y - 0.28 * s, z, 0.12 * s, B.P[fire[3]], 3, { em: true, nd: true });
        }
      });
      rocks(ctx, [[kx - 4.0, kz - 2.6, 0.75], [kx - 4.4, kz - 0.4, 0.5], [kx + 1.6, kz + 4.0, 0.42]], { mat: rough, seed: 40 });
      // a dead tree by the keep's west side
      deadTree(ctx, kx - 4.6, kz + 2.6, { bark: wood, h: 3.4, seed: 9 });
    }

    /* ---- an old colonnade on the north edge of the top: broken pillars against the sky behind the keep ---- */
    for (const [x, z, tall] of [[-13.6, -27.2, 2.6], [-11.2, -29.0, 3.4], [-8.6, -30.4, 1.6], [4.6, -27.6, 2.2]]) {
      const gy = h(x, z);
      S.box([x, gy + 0.1, z], [0.75, 0.35, 0.75], rough, { rd: 0.08, res: 0.13 });
      S.lathe([x, gy - 0.2, z], tall + 0.2, [0.5, 0.44], stone, { res: 0.12 });
      S.box([x + 0.08, gy + tall + 0.1, z], [0.42, 0.2, 0.38], rough, { ax: rollAx(0.3), rd: 0.05, res: 0.11 });
    }
    S.tube([[-4.9, h(-4.9, -30.7) + 0.3, -30.7], [-7.6, h(-7.6, -31.6) + 0.35, -31.6]], 0.45, 0.42, stone, { res: 0.12 }); // one lies fallen

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
      S.box([gx + 1.2, ty + 0.35, gz], [0.75, 0.7, 1.15], stone, { rd: 0.06, res: 0.11 });
      S.box([gx + 1.25, ty + 1.12, gz + 0.05], [0.85, 0.12, 1.25], rough, { ax: yawAx(0.08), rd: 0.04, res: 0.11 });
      gibbet(gx - 3.6, gz + 3.4, 1, 0, { reach: 1.8, drop: 2.2, hgt: 3.8 });
      bowl(gx + 3.2, gz - 2.4, { s: 0.9 });
      deadTree(ctx, gx - 2.4, gz - 4.2, { bark: wood, h: 3.6, seed: 3 });
      // a row of leaning stakes along the shelf edge
      for (let k = 0; k < 7; k++) {
        const x = gx + 3.8 + B.rr(-0.2, 0.2), z = gz - 3 + k * 1.05, y = h(x, z) - 0.3, l = B.rr(-0.3, 0.3);
        if (k === 3) continue;
        S.tube([[x, y, z], [x + 0.25 + l * 0.2, y + B.rr(1.0, 1.5), z + l]], 0.11, 0.035, wood, { res: 0.07 });
      }
    }

    /* ---- the east hill: a broken tower stump with rubble to climb, a gibbet against the sky ---- */
    {
      const [sx, sz] = STUMP, gy = h(sx, sz), top = gy + 2.6;
      S.lathe([sx, gy - 1.2, sz], top - gy + 1.2, [1.75, 1.6], stone, { res: 0.14 });
      // a ragged broken parapet on the west side, over the drop to the yard
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 0.55 + i * 0.42, hh = [0.7, 1.1, 0.5, 0.9, 0.4][i];
        S.box([sx + Math.cos(a) * 1.4, top + hh / 2, sz + Math.sin(a) * 1.4], [0.3, hh / 2 + 0.05, 0.36], rough, { ax: yawAx(-a), rd: 0.05, res: 0.11 });
      }
      // rubble blocks rising round its east side, up from the hilltop, each a step up
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.4, x = sx + Math.cos(a) * 2.15, z = sz + Math.sin(a) * 2.15, tp = gy + 0.5 * (i + 1), gh = h(x, z);
        S.box([x, (tp + gh - 0.5) / 2, z], [0.7, (tp - gh + 0.5) / 2, 0.66], rough, { ax: yawAx(Math.PI / 2 - a), rd: 0.08, res: 0.12 });
      }
      bowl(sx - 3.2, sz + 2.8, { s: 0.9 });
      gibbet(sx + 3.6, sz - 5.6, -1, 0, { reach: 2.0, drop: 2.0, hgt: 4.0 });
      ctx.wisp([sx - 0.3, top + 1.2, sz - 0.2]); // on the tower stump
    }

    /* ---- dead trees, rocks, gorse ---- */
    for (const [x, z, hh, s] of [[-6.6, 19.6, 3.4, 1], [12.8, 18.6, 3.6, 2], [21, 10, 3.4, 4], [14, -5, 3.0, 5], [-26, -12, 3.8, 6],
      [25, -16, 3.2, 7], [-24, 24, 3.2, 8]])
      deadTree(ctx, x, z, { bark: wood, h: hh, seed: s });
    rocks(ctx, [[0.2, 22.6, 0.45], [5.6, 21.8, 0.35], [-1.4, 19.6, 0.55], [-4, 13, 0.8], [6, 9, 0.7], [-7, -1.5, 0.6], [12, -3, 1.0], [-14, -14, 1.2], [13, -18, 1.1], [-21, 16, 1.0], [20, 18, 1.2]],
      { mat: rough, seed: 3 });
    rocks(ctx, [[0.4, 29.4, 0.35], [6.2, 28.2, 0.42], [-0.6, 32.5, 0.5]], { mat: rough, seed: 61 });
    shrubs(ctx, [[0.2, 27.6, 0.45], [6.6, 30.4, 0.55], [-1.8, 30, 0.5], [-3, 18, 0.6], [8, 15, 0.5], [-12, 13, 0.6], [11, 5, 0.5], [-9, -12, 0.6], [11, -15, 0.7], [16, 24, 0.6], [-17, 21, 0.6]],
      { mat: { r: moor.slice(0, 4), mod: grit(1) } });

    /* ---- far ruins, black against the fog ---- */
    const farTower = (x, z, r, tall) => {
      const gy = h(x, z);
      S.lathe([x, gy - 1, z], tall + 1, [r, r * 0.88], far, { res: 0.32 });
      for (let i = 0; i < 4; i++) S.box([x + Math.cos(i * 1.4) * r * 0.8, gy + tall + 0.35, z + Math.sin(i * 1.4) * r * 0.8], [0.4, 0.4 + i * 0.12, 0.4], far, { res: 0.3 });
    };
    farTower(44, -34, 2.4, 8);
    farTower(-46, -30, 2.0, 6.5);
    farTower(52, 16, 1.9, 6);

    /* ---- the start, the other wisps ---- */
    ctx.spawn([START[0], h(START[0], START[1]) + 0.13, START[1]], Math.PI); // on the top of the start slab
    // the combat run's foe zones (lib/zones.mjs): they add nothing to the scenery, only to the JSON
    ctx.zone('G1'); ctx.zone('G2'); ctx.zone('G3'); ctx.zone('G5');
    ctx.wisp([1.6, h(1.6, -1.6) + 1.0, -1.6]); // inside the torn cell
    ctx.wisp([7.6, Y.t1 + 1.3, -2.2]); // on the ledge above the cells
    ctx.wisp([GRAVES[0] + 1.2, h(GRAVES[0] + 1.2, GRAVES[1]) + 2.4, GRAVES[1]]); // over the tomb
    ctx.wisp([KEEP[0] + 1, h(KEEP[0] + 1, -29.6) + 1.1, -29.6]); // behind the keep

    /* ---- sky: a dark dome, a moonlit haze low in the north, the moon rising behind the keep, torn cloud, stars, drifting dust ---- */
    ctx.glow(({ B }) => {
      const sk = ramp('skyband'), dk = ramp('sky')[0], mn = ramp('moon');
      const sy = h(START[0], START[1]) + 0.13;
      const eye = [START[0], sy + EYE_UP, START[1] + EYE_BACK];
      // as the start eye sees them: the keep's bearing, and the moon tucked behind its right shoulder, its top under the page camera's
      // top edge (which sits half a degree below level)
      const toKeep = Math.atan2(KEEP[0] - eye[0], -(KEEP[1] - eye[2])), dKeep = Math.hypot(KEEP[0] - eye[0], KEEP[1] - eye[2]);
      const deg = Math.PI / 180, mr = 2.0 * deg, az = toKeep + Math.atan((KW + 0.6) / dKeep) + 1.2 * deg, el = -3.0 * deg, D = 170, rm = D * Math.tan(mr);
      const dir = (a, e) => [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
      const u = dir(az, el), M = [eye[0] + u[0] * D, eye[1] + u[1] * D, eye[2] + u[2] * D];
      B.sky(d => (d[1] < 0.05 ? sk[1] : d[1] < 0.2 ? sk[0] : dk), 230);
      // the halo: rings of cold light round the moon, wide enough to stand behind the whole keep, so the keep is a black cut-out
      // against it; and a low band of haze along the northern horizon. (Glows much past 200 units draw dim, so the sky stays near.)
      for (let i = -34; i <= 34; i++) for (let j = 0; j < 10; j++) {
        const a = az + i * 0.02 + B.rr(-0.005, 0.005), e = -0.13 + j * 0.016 + B.rr(-0.004, 0.004), p = dir(a, e), R = 178;
        const dm = Math.hypot((a - az) * 0.75, e - el) / mr, low = 1 - j / 9;
        const k = Math.max(dm < 2.3 ? 1 : dm < 3.7 ? 0.7 : dm < 5.4 ? 0.42 : 0, Math.abs(a - toKeep) < 0.3 && low > 0.6 ? 0.42 : Math.abs(a - toKeep) < 0.5 && low > 0.3 ? 0.25 : 0);
        if (k < 0.2) continue; // the dome is already sk[1] low down: no hard top edge to the haze
        const c = k >= 1 ? sk[4] : k >= 0.7 ? sk[3] : k >= 0.42 ? sk[2] : sk[1];
        B.iso(eye[0] + p[0] * R, eye[1] + p[1] * R, eye[2] + p[2] * R, 3.6, B.P[c], 2.2, { em: true, nd: true });
      }
      // the disc, laid flat to the eye: pale, with darker seas
      const rt = B.norm([-u[2], 0, u[0]]), up = [rt[1] * u[2] - rt[2] * u[1], rt[2] * u[0] - rt[0] * u[2], rt[0] * u[1] - rt[1] * u[0]];
      const sp = rm * 0.16;
      for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
        const a = (i + (j % 2) * 0.5) * sp, b = j * sp * 0.87;
        if (a * a + b * b > rm * rm * 0.92) continue;
        const sea = B.n3(a / rm * 1.6 + 4, b / rm * 1.6 + 1, 2) > 0.56 || (a + rm * 0.3) ** 2 + (b - rm * 0.25) ** 2 < (rm * 0.28) ** 2;
        B.iso(M[0] + rt[0] * a + up[0] * b, M[1] + rt[1] * a + up[1] * b, M[2] + rt[2] * a + up[2] * b, sp * 0.6, B.P[sea ? mn[0] : mn[1]], 3, { em: true, nd: true });
      }
      // one thin dark line of cloud across its lower part, running off to the right
      {
        const c = [M[0] - up[0] * rm * 0.55 - u[0] * 4, M[1] - up[1] * rm * 0.55 - u[1] * 4, M[2] - up[2] * rm * 0.55 - u[2] * 4];
        for (let k = -1; k <= 4; k++)
          B.axial(c[0] + rt[0] * k * rm * 0.6, c[1] + Math.sin(k * 1.7) * rm * 0.04, c[2] + rt[2] * k * rm * 0.6, rt, rm * 0.4, rm * 0.035, B.P[sk[0]], 2.2, { em: true, nd: true });
      }
      // stars, high up only
      for (let i = 0; i < 70; i++) {
        const a = B.rr(0, Math.PI * 2), e = B.rr(0.2, 1.2), r = 195;
        B.iso(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, B.rr(0.25, 0.45), B.P[B.pick([sk[3], mn[0]])], 3, { em: true, nd: true });
      }
      // torn cloud in the sky
      for (let i = 0; i < 16; i++) {
        const a = -1.3 + i * 0.17 + B.rr(-0.05, 0.05), e = 0.12 + B.rr(0, 0.16), r = 215; // far, so they draw faint
        const p = [Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r, -Math.cos(a) * Math.cos(e) * r];
        B.axial(p[0], p[1], p[2], [Math.cos(a), 0, Math.sin(a)], B.rr(10, 18), B.rr(1.4, 2.4), B.P[sk[B.pick([0, 1])]], 0.8, { em: true, nd: true });
      }
      lib.motes(B, 50, [-26, 26, -1.5, 9, -30, 30], [sk[2], sk[3]], 0.03);
    });
  }
};
