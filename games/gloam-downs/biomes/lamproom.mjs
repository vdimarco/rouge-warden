// The Lamp-room: the hall between runs (openspec/changes/gloam-downs-hub design.md "Part H"). A stone hall 14 m wide, lit by torches
// and by the lamps of its stations, with an open front on the camera's side. You wake on a worn mat at the front and the run door
// stands at the back. On the way: the well, the wick rack, the blade rack, the off-hand stand, the ability post, the lamp shelf, the
// pane window, the kiln, the trophy wall, the Ember bell and the map table. What the player owns shows in the hall: each growth object
// is baked as one range of splats of its own (ctx.grow), which the page puts out or back by the save (hub.js shown()).
//
// The cut-away room is the high fixed view of Hades' House and of the family home in Children of Morta: no front wall, so the follow
// camera sees in. The stone, the torch light and the painted look are the Sunken Gaol's. All forms here are our own.
import { yawAx } from '../lib/props.mjs';
import { tile } from '../lib/common.mjs';
import { STATIONS, HALL, growIds } from '../../../public/lab/gloam-downs/hub.js';
import { UPGRADES, UNLOCKS } from '../../../public/lab/gloam-downs/run.js';
import { PATTERNS, PANES, LAMP_KEYS, ABILITIES } from '../../../public/lab/gloam-downs/growth.js';
import { BLADES, OFFHANDS } from '../../../public/lab/gloam-downs/gear.js';
import { ELITE_LIST } from '../../../public/lab/gloam-downs/elites.js';

const { x0: X0, x1: X1, back: BACK, front: FRONT } = HALL;
const WALL = 0.9; // the walls' thickness
const SIDE_H = 4.2, BACK_H = 5.4; // their heights
const DOOR = { half: 1.1, h: 3.3 };
const WIN = { z0: -1.65, z1: 0.65, y0: 1.05, y1: 2.65, mull: 0.1 }; // the pane window's opening in the right wall
const st = id => STATIONS.find(s => s.id === id);

export default {
  id: 'lamproom',
  name: 'The Lamp-room',
  sub: 'A lamp-lit hall between the runs',
  hint: 'Walk to a station and use it. The run door is at the back.',
  seed: 23,
  run: false,
  set: 'hub',
  palette: [
    ['sky', [0x04050b]],
    ['skyband', [0x0a0d1c, 0x151a32, 0x232a4c]],
    ['fog', [0x0d1020]],
    ['ink', [0x020308]],
    ['shade', [0x06070d]],
    ['stone', [0x0b0e18, 0x161b2b, 0x252c43, 0x39435d, 0x56638a]],
    ['flag', [0x0e0c10, 0x1d1a1e, 0x2e2a2c, 0x463e3a]],
    ['wood', [0x120c0a, 0x2a1c13, 0x47301f]],
    ['cloth', [0x1c080c, 0x461418, 0x7a2626]],
    ['water', [0x0a1822, 0x24485a]],
    ['brass', [0x3a2810, 0xa8843a]],
    ['ward', [0x2a5a3a, 0x8fd6a0]],
    ['gloam', [0x3a2f6a, 0xa99cff]],
    ['sand', [0x2a2218, 0x4a3c2a]]
  ],
  // the key light falls from above the open front: the moon over your shoulder, so the stations' faces catch it
  light: { sun: [-0.35, 0.8, 0.55], amb: 0.12, sky: 0.14, sunK: 0.42, shK: 7 },
  fog: { color: 'fog', far: 60, start: 0.55, max: 0.86 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 11 },
  hills: {
    base: 0,
    bumps: [[-26, -20, 16, 4], [24, -22, 15, 5], [0, -40, 22, 6], [-30, 14, 14, 3], [30, 16, 14, 3]],
    fbm: { amp: 0.4, freq: 1 / 11, oct: 3 },
    far: { amp: 6, start: 22, end: 46 },
    flats: [{ at: [0, 0], box: [11, 11], blend: 6, y: 0 }],
    box: [-100, 100, -100, 100]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
    const stn = ramp('stone'), fl = ramp('flag'), wd = ramp('wood'), cl = ramp('cloth'), fire = ramp('fire'), lamp = ramp('lamp'), iron = ramp('iron');
    const grit = (k = 1) => (x, y, z) => k * (0.16 * (B.n3(x * 0.45, z * 0.45, y * 0.3 + 3) - 0.5) + 0.14 * (B.n3(x * 2.6, y * 2.6, z * 2.6) - 0.5));
    const laid = (k = 0.8, ch = 0.55) => {
      const g = grit(k);
      return (x, y, z) => {
        const c = y / ch, row = Math.floor(c), f = c - row, u = ((x + z) / 1.05 + row * 0.5) % 1;
        return g(x, y, z) + (f < 0.12 || (u + 1) % 1 < 0.07 ? -0.15 : 0);
      };
    };
    // flagstones: big square slabs with dark joints, each slab a little lighter or darker than the next
    const flags = (x, y, z) => {
      const u = x / 1.2 + 0.3, v = z / 1.2 + (Math.floor(x / 1.2) % 2) * 0.5, fu = u - Math.floor(u), fv = v - Math.floor(v);
      return grit(0.8)(x, y, z) + 0.08 * (B.n3(Math.floor(u) * 1.7, Math.floor(v) * 1.3, 2) - 0.5) + (fu < 0.05 || fv < 0.05 ? -0.18 : 0);
    };
    // the walls' glow is mostly the stone's own lighter shades with a warm tint at the top, so a torch's light on stone reads as a
    // lit wall and not a flat orange smear
    const warmStone = [stn[1], stn[2], stn[3], ramp('wood')[2], ramp('brass')[0], fire[1]];
    const stone = { r: stn, g: warmStone, mod: laid(0.8) };
    const rough = { r: stn, g: warmStone, mod: grit(0.9) };
    const dark = { r: stn.slice(0, 3), g: [stn[0]], mod: grit(0.6) };
    const floorM = { r: fl, g: [fl[1], fl[2], fl[3], fire[1], fire[2], fire[3], fire[4]], mod: flags };
    // wood catches the stations' lamps: its glow runs to warm brass, so the racks, stands and tables stand out of the stone
    const wood = { r: wd, g: [wd[1], wd[2], ramp('brass')[1], fire[2]], mod: grit(0.5) };
    const ironM = { r: [iron[0], iron[0], iron[1]], g: [iron[0], wd[1], fire[1]] };
    const cloth = { r: cl, g: [cl[1]], mod: grit(0.4) };
    const brass = { r: ramp('brass'), g: [ramp('brass')[1]] };
    const sand = { r: ramp('sand'), g: [ramp('sand')[1]], mod: grit(1) };
    const water = { r: ramp('water'), em: true };
    const moor = { r: fl.slice(0, 2), mod: grit(1.2) };
    const yHall = 0;

    /* ---- the ground: the hall's floor of flagstones, the terrace before it, the moor round about ---- */
    {
      tile(S, h, floorM, { x0: X0 - 0.2, x1: X1 + 0.2, z0: BACK - 0.2, z1: FRONT + 0.6, res: 0.24 });
      const N = [-14, 14, -14, 16];
      /* the terrace before the open front: flagstones lit by two braziers, so the foreground of the cut-away view is a warm floor and
         not the dark moor (the follow camera stands out here, 9 m behind the lamplighter) */
      const T = { x: 8.2, z1: FRONT + 4.6 };
      tile(S, h, floorM, { x0: -T.x, x1: T.x, z0: FRONT + 0.6, z1: T.z1, res: 0.36 });
      S.box([0, -0.12, T.z1 + 0.15], [T.x + 0.1, 0.16, 0.2], rough, { rd: 0.05, res: 0.12 });
      tile(S, h, { ...moor, fat: 0.8 }, { x0: N[0], x1: N[1], z0: T.z1 + 0.35, z1: N[3], res: 0.48 });
      tile(S, h, { ...moor, fat: 0.8 }, { x0: N[0], x1: -T.x, z0: FRONT + 0.6, z1: T.z1 + 0.35, res: 0.4 });
      tile(S, h, { ...moor, fat: 0.8 }, { x0: T.x, x1: N[1], z0: FRONT + 0.6, z1: T.z1 + 0.35, res: 0.4 });
      for (const sx of [-1, 1]) {
        const bx = sx * 4.2, bz = FRONT + 2.4;
        S.tube([[bx, 0, bz], [bx, 0.95, bz]], 0.07, 0.06, ironM, { res: 0.05 });
        for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; S.tube([[bx, 0.5, bz], [bx + Math.cos(a) * 0.32, 0, bz + Math.sin(a) * 0.32]], 0.04, 0.035, ironM, { res: 0.04 }); }
        S.ball([bx, 1.02, bz], [0.36, 0.14, 0.36], ironM, { res: 0.05 });
        ctx.fire([bx, 1.12, bz], 0.75, { k: 0.8, r: 5.5 });
      }
      tile(S, h, { ...moor, fat: 0.8 }, { x0: N[0], x1: X0 - 0.2, z0: N[2], z1: FRONT + 0.6, res: 0.4 });
      tile(S, h, { ...moor, fat: 0.8 }, { x0: X1 + 0.2, x1: N[1], z0: N[2], z1: FRONT + 0.6, res: 0.4 });
      tile(S, h, { ...moor, fat: 0.8 }, { x0: X0 - 0.2, x1: X1 + 0.2, z0: N[2], z1: BACK - 0.2, res: 0.4 });
      const M = [-50, 50, -50, 50];
      // the far moor: coarse, it is seen only past the open front (the hall camera looks in from over it)
      tile(S, h, { ...moor, fat: 0.95 }, { x0: M[0], x1: M[1], z0: N[3], z1: M[3], res: 1.5 });
      tile(S, h, { ...moor, fat: 0.95 }, { x0: M[0], x1: M[1], z0: M[2], z1: N[2], res: 1.8 });
      tile(S, h, { ...moor, fat: 0.95 }, { x0: M[0], x1: N[0], z0: N[2], z1: N[3], res: 1.6 });
      tile(S, h, { ...moor, fat: 0.95 }, { x0: N[1], x1: M[1], z0: N[2], z1: N[3], res: 1.6 });
    }

    /* ---- small props ---- */
    // an iron sconce on a wall: a bracket out from the face (nx, nz) and a cup with a flame
    const sconce = (x, y, z, nx, nz, { s = 0.62, k = 0.75, r = 4.6 } = {}) => {
      const ox = x + nx * 0.4, oz = z + nz * 0.4;
      S.tube([[x, y - 0.3, z], [ox, y - 0.06, oz]], 0.06, 0.05, ironM, { res: 0.05 });
      S.ball([ox, y, oz], [0.17, 0.1, 0.17], ironM, { res: 0.05 });
      ctx.fire([ox, y + 0.08, oz], s, { k, r, n: 2 });
    };
    // a pilaster on a wall's inner face: (x, z) on the face, (nx, nz) out into the hall
    const pilaster = (x, z, nx, nz, hh) => {
      S.box([x + nx * 0.14, hh / 2 - 0.3, z + nz * 0.14], [nx ? 0.16 : 0.3, hh / 2 + 0.3, nz ? 0.16 : 0.3], stone, { rd: 0.04, res: 0.1 });
      S.box([x + nx * 0.2, hh - 0.08, z + nz * 0.2], [nx ? 0.24 : 0.38, 0.12, nz ? 0.24 : 0.38], rough, { rd: 0.04, res: 0.09 });
    };
    // a small glass lamp on a hook: an iron cap and a dark glass (its light is a growth object, or `lit`)
    const lampGlass = (x, y, z, lit = false) => {
      S.ball([x, y + 0.13, z], [0.06, 0.025, 0.06], ironM, { res: 0.025 });
      S.ball([x, y, z], [0.055, 0.09, 0.055], lit ? { r: lamp, em: true } : { r: [stn[1], stn[2]] }, { res: 0.025 });
    };

    /* ---- the walls: the back wall with the run door, the two side walls (the right with the pane window), the open front ---- */
    {
      const zb = BACK - WALL / 2;
      // the back wall, either side of the door, and over it
      for (const s of [-1, 1]) {
        const xa = s * DOOR.half, xb = s * (X1 + WALL), cx = (xa + xb) / 2, hx = Math.abs(xb - xa) / 2;
        S.box([cx, BACK_H / 2 - 0.4, zb], [hx, BACK_H / 2 + 0.4, WALL / 2], stone, { rd: 0.06, res: 0.16 });
      }
      S.box([0, (DOOR.h + 0.5 + BACK_H) / 2, zb], [DOOR.half + 0.02, (BACK_H - DOOR.h - 0.5) / 2, WALL / 2], stone, { rd: 0.06, res: 0.16 });
      // the door's frame: two jambs and an arch of fat stones over a dark lintel
      for (const s of [-1, 1]) S.box([s * (DOOR.half - 0.12), DOOR.h / 2, BACK + 0.08], [0.2, DOOR.h / 2 + 0.05, 0.22], rough, { rd: 0.05, res: 0.08 });
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (i / 6), x = Math.cos(a) * (DOOR.half - 0.05), y = DOOR.h + 0.1 + Math.sin(a) * 0.55;
        S.box([x, y, BACK + 0.06], [0.2, 0.16, 0.24], rough, { ax: [[Math.cos(a - Math.PI / 2), Math.sin(a - Math.PI / 2), 0], [-Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2), 0], [0, 0, 1]], rd: 0.04, res: 0.08 });
      }
      // the door: tall planks, iron bands and a ring
      S.box([0, DOOR.h / 2, BACK - 0.15], [DOOR.half - 0.1, DOOR.h / 2, 0.1], wood, { rd: 0.03, res: 0.08 });
      for (const y of [0.6, 1.6, 2.6]) S.box([0, y, BACK - 0.03], [DOOR.half - 0.12, 0.05, 0.03], ironM, { rd: 0.01, res: 0.055 });
      S.torus([0.45, 1.25, BACK + 0.02], 0.11, 0.025, ironM, { res: 0.025, ax: [[1, 0, 0], [0, 0, 1], [0, -1, 0]] });
      // the side walls; the right one around the window's opening
      S.box([X0 - WALL / 2, SIDE_H / 2 - 0.4, (BACK - WALL + FRONT) / 2], [WALL / 2, SIDE_H / 2 + 0.4, (FRONT - BACK + WALL) / 2], stone, { rd: 0.06, res: 0.16 });
      const xr = X1 + WALL / 2, seg = (za, zb2, ya, yb) => S.box([xr, (ya + yb) / 2, (za + zb2) / 2], [WALL / 2, (yb - ya) / 2, (zb2 - za) / 2], stone, { rd: 0.05, res: 0.16 });
      seg(WIN.z1, FRONT, -0.8, SIDE_H);
      seg(BACK - WALL, WIN.z0, -0.8, SIDE_H);
      seg(WIN.z0, WIN.z1, -0.8, WIN.y0);
      seg(WIN.z0, WIN.z1, WIN.y1, SIDE_H);
      // the front: a low parapet between two fat pillars, each with a fire bowl on top
      S.box([0, 0.2, FRONT + 0.25], [X1 - 0.3, 0.42, 0.25], rough, { rd: 0.06, res: 0.1 });
      for (const s of [-1, 1]) {
        const px = s * (X1 + 0.05), pz = FRONT + 0.1;
        S.lathe([px, -0.4, pz], 4.4, [0.62, 0.52], stone, { res: 0.11 });
        S.box([px, 4.1, pz], [0.72, 0.14, 0.72], rough, { rd: 0.05, res: 0.09 });
        S.ball([px, 4.38, pz], [0.48, 0.2, 0.48], ironM, { res: 0.06 });
        ctx.fire([px, 4.5, pz], 0.95, { k: 0.8, r: 6.5 });
      }
      // a coping along the tops of the walls
      S.box([X0 - WALL / 2, SIDE_H + 0.1, (BACK - WALL + FRONT) / 2], [WALL / 2 + 0.1, 0.12, (FRONT - BACK + WALL) / 2 + 0.05], rough, { rd: 0.04, res: 0.14 });
      S.box([X1 + WALL / 2, SIDE_H + 0.1, (BACK - WALL + FRONT) / 2], [WALL / 2 + 0.1, 0.12, (FRONT - BACK + WALL) / 2 + 0.05], rough, { rd: 0.04, res: 0.14 });
      S.box([0, BACK_H + 0.1, BACK - WALL / 2], [X1 + WALL + 0.1, 0.12, WALL / 2 + 0.1], rough, { rd: 0.04, res: 0.14 });
      // pilasters, and a torch on most
      for (const z of [6.0, 2.75, -0.6, -5.2]) pilaster(X0, z, 1, 0, SIDE_H);
      for (const z of [6.0, 2.4, -2.15]) pilaster(X1, z, -1, 0, SIDE_H);
      for (const x of [-5.6, -1.9, 1.9, 5.6]) pilaster(x, BACK, 0, 1, BACK_H);
      for (const z of [6.0, -0.6, -5.2]) sconce(X0 + 0.28, 2.15, z, 1, 0, { r: 4.0 });
      for (const z of [6.0, 2.4]) sconce(X1 - 0.28, 2.15, z, -1, 0, { r: 4.0 });
      for (const x of [-1.9, 1.9]) sconce(x, 2.7, BACK + 0.28, 0, 1, { s: 0.7, r: 5 });
      // banners on the back wall, between the stations
      for (const x of [-5.6, 5.6]) {
        S.box([x, 4.2, BACK + 0.36], [0.4, 0.04, 0.04], wood, { res: 0.055 });
        S.box([x, 3.55, BACK + 0.34], [0.34, 0.62, 0.03], cloth, { rd: 0.01, res: 0.05 });
      }
    }

    /* ---- the stations' objects (hub.js STATIONS: the points, the faces and the objects) ---- */
    // the worn mat at the spawn
    S.box([HALL.spawn[0], yHall + 0.015, HALL.spawn[1]], [0.75, 0.02, 0.5], cloth, { rd: 0.01, res: 0.06 });
    // the well: a stone ring, dark water, two posts, a beam and a bucket
    {
      const [x, z] = st('well').obj;
      const ring = S.lathe([x, -0.2, z], 0.95, [0.78, 0.74], stone, { hold: true });
      const hollow = S.lathe([x, 0.1, z], 1.2, [0.56, 0.56], stone, { hold: true });
      S.join('cut', ring, hollow, { res: 0.08, inner: stn.slice(0, 2) });
      S.box([x, 0.55, z], [0.56, 0.03, 0.56], water, { res: 0.07 });
      for (const s of [-1, 1]) S.box([x, 1.1, z + s * 0.72], [0.07, 1.1, 0.07], wood, { rd: 0.02, res: 0.055 });
      S.tube([[x, 2.1, z - 0.8], [x, 2.1, z + 0.8]], 0.06, 0.06, wood, { res: 0.055 });
      S.tube([[x, 2.05, z + 0.15], [x, 1.45, z + 0.15]], 0.012, 0.012, ironM, { res: 0.015 });
      S.lathe([x, 1.2, z + 0.15], 0.26, [0.12, 0.15], wood, { res: 0.03 });
    }
    // the wick rack: two posts and three bars on the left wall, nine iron hooks, a stub of wick on each
    {
      const [x, z] = st('wick').obj;
      for (const s of [-1, 1]) S.box([x, 1.2, z + s * 0.75], [0.07, 1.2, 0.07], wood, { rd: 0.02, res: 0.055 });
      for (const y of [0.9, 1.5, 2.1]) S.box([x, y, z], [0.06, 0.05, 0.8], wood, { rd: 0.02, res: 0.055 });
      UNLOCKS.forEach((u, i) => {
        const [hx, hy, hz] = wickAt(i, x, z);
        S.tube([[hx - 0.04, hy - 0.06, hz], [hx + 0.08, hy - 0.06, hz]], 0.012, 0.012, ironM, { res: 0.014 });
        S.tube([[hx + 0.08, hy - 0.06, hz], [hx + 0.08, hy + 0.06, hz]], 0.02, 0.016, { r: [wd[2], stn[3]] }, { res: 0.014 });
      });
    }
    // the blade rack: a frame on the right wall with four hooks; the blades are growth objects
    {
      const [x, z] = st('blades').obj;
      for (const s of [-1, 1]) S.box([x, 1.2, z + s * 0.85], [0.07, 1.2, 0.07], wood, { rd: 0.02, res: 0.055 });
      S.box([x, 2.25, z], [0.07, 0.06, 0.92], wood, { rd: 0.02, res: 0.055 });
      S.box([x, 0.35, z], [0.12, 0.05, 0.92], wood, { rd: 0.02, res: 0.055 });
      BLADES.forEach((b, i) => { const [bx, by, bz] = bladeAt(i, x, z); S.tube([[bx + 0.06, by + 0.05, bz], [bx - 0.04, by + 0.05, bz]], 0.016, 0.016, ironM, { res: 0.016 }); });
    }
    // the off-hand stand: a board on the left wall with six pegs in two rows
    {
      const [x, z] = st('offhand').obj;
      S.box([x - 0.05, 1.35, z], [0.05, 0.75, 0.85], wood, { rd: 0.02, res: 0.055 });
      for (const s of [-1, 1]) S.box([x, 0.8, z + s * 0.92], [0.08, 0.8, 0.08], wood, { rd: 0.02, res: 0.055 });
      OFFHANDS.forEach((o, i) => { const [px, py, pz] = offAt(i, x, z); S.tube([[px - 0.08, py + 0.1, pz], [px + 0.06, py + 0.12, pz]], 0.022, 0.018, wood, { res: 0.018 }); });
    }
    // the ability post: a fat post on a ring of sand, a cross arm, and a rack of three lit ability lamps beside it
    {
      const [x, z] = st('post').obj;
      tile(S, h, sand, { x0: x - 1.0, x1: x + 1.0, z0: z - 1.0, z1: z + 1.0, res: 0.12 });
      S.lathe([x, -0.1, z], 1.75, [0.2, 0.17], wood, { res: 0.055 });
      S.box([x, 1.25, z], [0.08, 0.08, 0.5], wood, { rd: 0.02, res: 0.055 });
      S.ball([x, 1.9, z], [0.2, 0.13, 0.2], sand, { res: 0.05 });
      for (const y of [0.55, 1.0, 1.5]) S.torus([x, y, z], 0.2, 0.025, { r: [ramp('sand')[1]] }, { res: 0.02 });
      // a lamp pole beside it: three ability lamps hung from a cross arm
      const rx = x + 0.1, rz = z + 1.3;
      S.lathe([rx, -0.1, rz], 2.2, [0.07, 0.06], wood, { res: 0.04 });
      S.box([rx, 2.0, rz], [0.04, 0.04, 0.45], wood, { rd: 0.01, res: 0.04 });
      for (let i = 0; i < 3; i++) { const lz = rz - 0.38 + i * 0.38; S.tube([[rx, 1.98, lz], [rx, 1.82, lz]], 0.008, 0.008, ironM, { res: 0.012 }); lampGlass(rx, 1.68, lz, true); }
      ctx.lamp([rx, 1.7, rz], 2.4, 0.55, false);
    }
    // the lamp shelf: three bays of shelves on the left wall, four tall glass lamps a bay. A lamp's glass rings fill by its ware's level
    {
      const [x, z] = st('shelf').obj;
      for (let b = 0; b < 3; b++) {
        const bz = z - 1.1 + b * 1.1;
        for (const y of [0.85, 1.75]) S.box([x + 0.18, y, bz], [0.2, 0.035, 0.5], wood, { rd: 0.01, res: 0.05 });
        for (const s of [-1, 1]) S.box([x + 0.18, 1.3, bz + s * 0.52], [0.2, 1.3, 0.035], wood, { rd: 0.01, res: 0.05 });
      }
      S.box([x + 0.18, 2.62, z], [0.22, 0.05, 1.7], wood, { rd: 0.01, res: 0.05 });
      UPGRADES.forEach((u, i) => {
        const [lx, ly, lz] = wareAt(i, x, z);
        S.lathe([lx, ly - 0.02, lz], 0.04, [0.1, 0.1], ironM, { res: 0.025 });
        S.lathe([lx, ly + 0.02, lz], 0.42, [0.085, 0.085], { r: [stn[0], stn[1]] }, { res: 0.025 });
        S.lathe([lx, ly + 0.44, lz], 0.05, [0.1, 0.06], ironM, { res: 0.025 });
      });
    }
    // the pane window: three slots in the right wall's opening, leaded bars across each, a sill; the glass and shutters are growth
    {
      const xr = X1 + 0.15;
      S.box([X1 - 0.08, WIN.y0 - 0.06, (WIN.z0 + WIN.z1) / 2], [0.22, 0.07, (WIN.z1 - WIN.z0) / 2 + 0.12], rough, { rd: 0.03, res: 0.06 });
      const w = (WIN.z1 - WIN.z0) / 3;
      for (let i = 1; i < 3; i++) S.box([xr, (WIN.y0 + WIN.y1) / 2, WIN.z0 + w * i], [0.12, (WIN.y1 - WIN.y0) / 2, WIN.mull], stone, { rd: 0.02, res: 0.05 });
      for (let i = 0; i < 3; i++) {
        const zc = WIN.z0 + w * (i + 0.5);
        for (const y of [1.5, 2.1]) S.tube([[xr + 0.12, y, zc - w / 2], [xr + 0.12, y, zc + w / 2]], 0.014, 0.014, ironM, { res: 0.016 });
        S.tube([[xr + 0.12, WIN.y0, zc], [xr + 0.12, WIN.y1, zc]], 0.014, 0.014, ironM, { res: 0.016 });
      }
    }
    // the kiln: a squat brick oven with a fire in its mouth, under a stone hood whose face holds five rows of eight hooks
    {
      const [x, z] = st('kiln').obj;
      const body = S.box([x, 0.6, z], [0.45, 0.65, 0.75], stone, { hold: true, rd: 0.12 });
      const mouth = S.ball([x - 0.5, 0.38, z], [0.42, 0.36, 0.34], stone, { hold: true });
      S.join('cut', body, mouth, { res: 0.07, inner: [stn[0], fire[0]] });
      S.ball([x + 0.05, 1.3, z], [0.5, 0.28, 0.72], rough, { res: 0.07 });
      ctx.fire([x - 0.25, 0.2, z], 0.95, { k: 0.9, r: 4.2, n: 5 });
      // the hood: a breast of stone from the kiln to the wall's top, and a ledge under the hooks
      S.box([X1 - 0.32, 2.8, z], [0.34, 1.4, 1.3], stone, { rd: 0.05, res: 0.1 });
      S.box([X1 - 0.66, 1.62, z], [0.1, 0.05, 1.25], wood, { rd: 0.01, res: 0.05 });
      PATTERNS.forEach((p, i) => { const [hx, hy, hz] = hookAt(i, z); S.tube([[hx + 0.06, hy + 0.12, hz], [hx, hy + 0.14, hz], [hx, hy + 0.17, hz]], 0.01, 0.01, ironM, { res: 0.012 }); });
    }
    // the trophy wall: three key plaques high, five elite plaques under them
    {
      const [x] = st('trophy').obj;
      LAMP_KEYS.forEach((k, i) => { const [px, py] = keyAt(i, x); S.box([px, py, BACK + 0.06], [0.3, 0.36, 0.05], wood, { rd: 0.04, res: 0.05 }); });
      ELITE_LIST.forEach((e, i) => { const [px, py] = eliteAt(i, x); S.box([px, py, BACK + 0.05], [0.2, 0.24, 0.04], { r: [wd[0], wd[1]] }, { rd: 0.03, res: 0.03 }); });
    }
    // the Ember bell: a frame of two posts and a beam, a brass bell hung from it
    {
      const [x, z] = st('bell').obj;
      for (const s of [-1, 1]) S.box([x + s * 0.85, 1.4, z], [0.09, 1.4, 0.09], wood, { rd: 0.02, res: 0.055 });
      S.box([x, 2.78, z], [1.0, 0.09, 0.11], wood, { rd: 0.02, res: 0.055 });
      const bell = S.lathe([x, 1.6, z], 0.95, [0.48, 0.22], brass, { hold: true });
      const hollow = S.lathe([x, 1.5, z], 0.85, [0.4, 0.14], brass, { hold: true });
      S.join('cut', bell, hollow, { res: 0.04, inner: [ramp('brass')[0]] });
      S.ball([x, 2.58, z], [0.12, 0.08, 0.12], brass, { res: 0.03 });
      S.ball([x, 1.68, z], 0.08, ironM, { res: 0.025 });
    }
    // the map table: a heavy table with the route as five small lamps on it
    {
      const [x, z] = st('map').obj;
      S.box([x, 0.88, z], [0.55, 0.05, 0.8], wood, { rd: 0.02, res: 0.055 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.box([x + sx * 0.45, 0.43, z + sz * 0.7], [0.06, 0.43, 0.06], wood, { rd: 0.02, res: 0.055 });
      S.box([x, 0.94, z], [0.42, 0.01, 0.66], { r: [cl[0], wd[1]] }, { res: 0.055 });
      for (let i = 0; i < 5; i++) lampGlass(x + Math.sin(i * 1.3) * 0.18, 1.05, z + 0.52 - i * 0.26, i === 0);
    }
    // barrels and crates in the front corners, out of the way
    for (const [x, z] of [[-6.1, 6.3], [6.2, 6.4], [-5.9, -6.9]]) S.lathe([x, -0.05, z], 0.95, [0.38, 0.36], wood, { res: 0.05 });
    for (const [x, z, a] of [[-5.2, 6.5, 0.3], [5.3, 6.6, -0.2]]) S.box([x, 0.32, z], [0.36, 0.34, 0.36], wood, { ax: yawAx(a), rd: 0.03, res: 0.05 });

    /* ---- a lantern over each station: a pool of warm light on its object and the floor before it, so each station reads from across
       the hall as a lit thing against the dark stone (a lit set piece in a dim room, as the stations of Hades' House glow) ---- */
    {
      const lantern = (x, y, z, top) => {
        S.tube([[x, top, z], [x, y + 0.24, z]], 0.015, 0.015, ironM, { res: 0.04 });
        S.ball([x, y + 0.2, z], [0.11, 0.05, 0.11], ironM, { res: 0.045 });
        S.ball([x, y, z], [0.1, 0.16, 0.1], { r: lamp, em: true }, { res: 0.045 });
        S.ball([x, y - 0.18, z], [0.08, 0.03, 0.08], ironM, { res: 0.045 });
        ctx.lamp([x, y, z], 3.4, 0.85, true);
      };
      // where each lantern hangs: inward of a wall station's object, out from the back wall's, over the table and the well
      const at = { wick: [-5.75, 4.5], blades: [5.75, 4.5], offhand: [-5.75, 1], shelf: [-5.9, -2.5], window: [6.0, 0.9], kiln: [5.6, -5.4], trophy: [-3.5, -6.6], bell: [3.2, -6.4], map: [1.3, -3.6], well: [-3.7, 1.55] };
      for (const [id, [x, z]] of Object.entries(at)) {
        // a wall arm from the nearest wall, or a chain from a beam over the hall's middle
        const wallX = x < -5 ? X0 : x > 5 ? X1 : null, wallZ = z < -6 ? BACK : null;
        if (wallX !== null) S.tube([[wallX, 3.4, z], [x, 3.4, z]], 0.035, 0.035, ironM, { res: 0.06 });
        else if (wallZ !== null) S.tube([[x, 3.4, wallZ], [x, 3.4, z]], 0.035, 0.035, ironM, { res: 0.06 });
        else S.tube([[x - 0.4, 3.4, z], [x + 0.4, 3.4, z]], 0.04, 0.04, wood, { res: 0.06 });
        lantern(x, id === 'well' ? 2.55 : 2.7, z, 3.4);
      }
    }

    /* ---- the marks: the spawn, the run door, the stations ---- */
    ctx.spawn([HALL.spawn[0], yHall + 0.03, HALL.spawn[1]], HALL.yaw);
    ctx.door([HALL.door[0], yHall, HALL.door[1]]);
    for (const s of STATIONS) ctx.mark('station', { id: s.id, at: [s.at[0], yHall, s.at[1]], face: s.face, obj: s.obj });
    // a lantern over the door, and its glow under the door
    sconce(0, DOOR.h + 0.95, BACK + 0.25, 0, 1, { s: 0.7, r: 5.5 });
    ctx.glow(({ B }) => {
      for (let i = -9; i <= 9; i++) B.iso(i * 0.11, 0.03, BACK - 0.02, 0.05, B.P[fire[3]], 3, { em: true, nd: true, k: 6, ph: i * 0.7, sp: 1.5 });
    });

    /* ---- the growth objects: each one range (hub.js growIds names them, and shown() says when each shows) ---- */
    const P = c => B.P[c];
    const ring = (x, y, z, r, n, c, s = 0.022, o = {}) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; B.iso(x + Math.cos(a) * r, y, z + Math.sin(a) * r, s, P(c), 3, { em: true, nd: true, ...o }); } };
    const flame = (x, y, z, s = 1) => { B.iso(x, y, z, 0.035 * s, P(fire[4]), 3, { em: true, nd: true, k: 7, ph: x + z, sp: 2 }); B.iso(x, y - 0.03 * s, z, 0.05 * s, P(fire[3]), 2.4, { em: true, nd: true }); };
    const hueSlot = colour => (colour === 'ward' ? ramp('ward') : colour === 'gloam' ? ramp('gloam') : [fire[2], fire[4]]);
    const ids = new Set(growIds());
    const grow = (id, fn) => { if (!ids.has(id)) throw new Error(`lamproom: ${id} is not a growth object of hub.js`); ctx.grow(id, fn); };
    // the wares: the k-th glass ring of a lamp lights at level k (a shape, so the level reads on a grey screen too)
    UPGRADES.forEach((u, i) => {
      const [lx, ly, lz] = wareAt(i, st('shelf').obj[0], st('shelf').obj[1]), n = u.costs.length;
      for (let k = 1; k <= n; k++) grow(`ware:${u.id}:${k}`, () => {
        const y = ly + 0.04 + ((k - 0.5) / 8) * 0.38;
        ring(lx, y, lz, 0.1, 12, lamp[0], 0.03);
        B.iso(lx, y, lz, 0.07, P(fire[3]), 2, { em: true, nd: true });
        B.iso(lx, y, lz, 0.17, P(fire[2]), 0.35, { em: true, nd: true });
      });
    });
    // the patterns: a dark lamp hangs on its hook when found, a lit one when kindled
    PATTERNS.forEach((p, i) => {
      const [hx, hy, hz] = hookAt(i, st('kiln').obj[1]);
      grow(`pattern:${p.id}:found`, () => {
        B.iso(hx, hy, hz, 0.075, P(stn[3]), 3, { em: true }); B.iso(hx, hy + 0.09, hz, 0.05, P(iron[0]), 3, { em: true });
        B.iso(hx, hy - 0.01, hz, 0.03, P(fire[1]), 3, { em: true, nd: true }); B.iso(hx, hy - 0.09, hz, 0.03, P(iron[0]), 3, { em: true });
      });
      grow(`pattern:${p.id}:lit`, () => {
        const c = hueSlot(colourOf(p));
        B.iso(hx, hy, hz, 0.075, P(c[1]), 3, { em: true, nd: true, k: 7, ph: i, sp: 1.6 });
        B.iso(hx - 0.02, hy + 0.01, hz, 0.035, P(lamp[1] ?? lamp[0]), 3, { em: true, nd: true });
        B.iso(hx, hy, hz, 0.18, P(c[0]), 0.45, { em: true, nd: true });
        B.iso(hx, hy + 0.09, hz, 0.05, P(iron[1]), 3, { em: true });
        B.iso(hx, hy - 0.09, hz, 0.03, P(iron[1]), 3, { em: true });
      });
    });
    // the panes: coloured glass in a slot of the window; a shutter on a slot not bought
    {
      const w = (WIN.z1 - WIN.z0) / 3, xr = X1 + 0.12;
      PANES.forEach(p => {
        const c = hueSlot(p.colour);
        for (let s = 0; s < 3; s++) grow(`pane:${p.id}:${s}`, () => {
          const zc = WIN.z0 + w * (s + 0.5);
          for (let a = 0; a < 6; a++) for (let b = 0; b < 12; b++) {
            const z = zc - w / 2 + (a + 0.5) * (w / 6), y = WIN.y0 + (b + 0.5) * ((WIN.y1 - WIN.y0) / 12), edge = a === 0 || a === 5 || b === 0 || b === 11;
            B.iso(xr, y, z, 0.075, P(edge ? c[0] : c[(a + b) % 3 === 0 ? 0 : 1]), 2.2, { em: true, nd: true });
          }
        });
      });
      for (let s = 0; s < 3; s++) grow(`shutter:${s}`, () => {
        const zc = WIN.z0 + w * (s + 0.5);
        for (let a = 0; a < 4; a++) for (let b = 0; b < 9; b++) B.iso(X1 + 0.02, WIN.y0 + (b + 0.5) * ((WIN.y1 - WIN.y0) / 9), zc - w / 2 + (a + 0.5) * (w / 4), 0.1, P(b % 3 === 1 ? wd[0] : wd[1]), 3, { em: true });
      });
    }
    // the unlocks: a lit wick on its hook
    UNLOCKS.forEach((u, i) => { const [hx, hy, hz] = wickAt(i, st('wick').obj[0], st('wick').obj[1]); grow(`unlock:${u.id}`, () => { flame(hx + 0.08, hy + 0.14, hz, 2); B.iso(hx + 0.08, hy + 0.12, hz, 0.16, P(fire[2]), 0.4, { em: true, nd: true }); }); });
    // the blades: each hangs point down on its hook; the start blade glows along its edge
    BLADES.forEach((b, i) => {
      const [bx, by, bz] = bladeAt(i, st('blades').obj[0], st('blades').obj[1]), len = 1.0 * b.bone, wide = 0.11 * (b.width || 1);
      grow(`blade:${b.id}`, () => {
        B.iso(bx - 0.04, by, bz, 0.04, P(iron[0]), 3, { em: true });
        B.axial(bx - 0.06, by - 0.12, bz, [0, 1, 0], 0.08, 0.03, P(wd[1]), 3, { em: true });
        B.axial(bx - 0.06, by - 0.2, bz, [0, 0, 1], 0.12, 0.025, P(iron[0]), 3, { em: true });
        const segs = 10;
        for (let k = 0; k < segs; k++) {
          const y = by - 0.24 - len * (k + 0.5) / segs, w = wide * (b.id === 'bell' && k > 6 ? 1.7 : 1) * (k === segs - 1 && b.id !== 'bell' ? 0.6 : 1);
          B.axial(bx - 0.06, y, bz, [0, 1, 0], len / (segs * 1.6), w, P(iron[k % 2]), 3, { em: true });
          // the edge: a thin line of the bright steel down one side
          B.axial(bx - 0.1, y, bz + w * 0.8, [0, 1, 0], len / (segs * 1.6), 0.025, P(stn[4]), 3, { em: true });
        }
        if (b.id === 'twin') for (let k = 0; k < 8; k++) B.axial(bx - 0.06, by - 0.24 - len * (k + 0.5) / 8, bz + 0.2, [0, 1, 0], len / 13, wide * 0.8, P(iron[1]), 3, { em: true });
      });
      grow(`blade:${b.id}:start`, () => { for (let k = 0; k < 8; k++) B.iso(bx - 0.03, by - 0.24 - len * (k + 0.5) / 8, bz + wide + 0.05, 0.035, P(lamp[0]), 3, { em: true, nd: true, k: 7, ph: k, sp: 1.4 }); B.iso(bx - 0.08, by - 0.24 - len / 2, bz, 0.3, P(fire[2]), 0.3, { em: true, nd: true }); });
    });
    // the off-hands, each on its peg; the start one glows
    OFFHANDS.forEach((o, i) => {
      const [px, py, pz] = offAt(i, st('offhand').obj[0], st('offhand').obj[1]);
      grow(`offhand:${o.id}`, () => {
        const y = py - 0.08, K = 1.6;
        const ring = (x, yy, z, r, n, c, sz = 0.022, o2 = {}) => { for (let q = 0; q < n; q++) { const a = (q / n) * Math.PI * 2; B.iso(x, yy + Math.sin(a) * r * K, z + Math.cos(a) * r * K, sz * K, P(c), 3, { em: true, ...o2 }); } };
        const iso = (x, yy, z, r, c, o2 = { em: true }) => B.iso(x, y + (yy - y) * K, pz + (z - pz) * K, r * K, P(c), 3, o2);
        if (o.id === 'buckler') { ring(px + 0.02, y, pz, 0.14, 16, iron[1], 0.03); iso(px, y, pz, 0.12, wd[2]); iso(px - 0.02, y, pz, 0.045, stn[4]); }
        else if (o.id === 'cuff') { ring(px, y, pz, 0.09, 14, iron[1], 0.03); ring(px - 0.01, y, pz, 0.065, 10, iron[0], 0.022); }
        else if (o.id === 'sling') { for (let k = 0; k < 8; k++) iso(px, y - k * 0.04, pz + Math.sin(k * 0.6) * 0.05, 0.02, wd[2]); iso(px, y - 0.32, pz, 0.05, stn[4]); }
        else if (o.id === 'pot') { iso(px, y - 0.1, pz, 0.12, wd[2]); iso(px, y + 0.02, pz, 0.05, fire[2], { em: true, nd: true }); iso(px, y - 0.12, pz + 0.07, 0.03, fire[1], { em: true, nd: true }); }
        else if (o.id === 'chain') { for (let k = 0; k < 9; k++) iso(px, y - k * 0.045, pz + (k % 2) * 0.02, 0.024, stn[4]); }
        else { iso(px, y - 0.12, pz, 0.08, iron[1]); iso(px, y - 0.04, pz, 0.1, cl[2]); iso(px, y - 0.16, pz, 0.035, ramp('gloam')[1], { em: true, nd: true }); }
      });
      grow(`offhand:${o.id}:start`, () => { ring(px + 0.05, py - 0.08, pz, 0.24, 14, lamp[0], 0.03, { k: 7, ph: i, sp: 1.4 }); B.iso(px + 0.05, py - 0.1, pz, 0.32, P(fire[2]), 0.3, { em: true, nd: true }); });
    });
    // the keys' trophies and the elites' plaques
    LAMP_KEYS.forEach((k, i) => {
      const [px, py] = keyAt(i, st('trophy').obj[0]), c = hueSlot(k.colour || 'flame');
      grow(`key:${k.id}`, () => {
        // a key: a ring, a shaft and two teeth, in light
        ring(px, py + 0.12, BACK + 0.13, 0.08, 10, c[1], 0.022);
        for (let t = 0; t < 7; t++) B.iso(px, py + 0.02 - t * 0.04, BACK + 0.13, 0.022, P(c[1]), 3, { em: true, nd: true });
        for (const t of [0, 1]) B.iso(px + 0.05, py - 0.17 + t * 0.06, BACK + 0.13, 0.022, P(c[1]), 3, { em: true, nd: true });
        B.iso(px, py, BACK + 0.15, 0.2, P(c[0]), 0.35, { em: true, nd: true });
      });
    });
    ELITE_LIST.forEach((e, i) => {
      const [px, py] = eliteAt(i, st('trophy').obj[0]);
      grow(`elite:${e.id}`, () => {
        for (let q = 0; q < 14; q++) { const a = (q / 14) * Math.PI * 2; B.iso(px + Math.cos(a) * 0.15, py + Math.sin(a) * 0.18, BACK + 0.11, 0.032, P(lamp[0]), 3, { em: true, nd: true }); }
        B.iso(px, py, BACK + 0.11, 0.08, P(fire[3]), 3, { em: true, nd: true });
        B.iso(px, py, BACK + 0.13, 0.26, P(fire[2]), 0.35, { em: true, nd: true });
      });
    });
    // the Ember levels: a ring of light round the bell's mouth for each level open, wider each level
    {
      const [x, z] = st('bell').obj;
      for (let n = 0; n <= 5; n++) grow(`ember:${n}`, () => ring(x, 1.58 - n * 0.03, z, 0.55 + n * 0.09, 14 + n * 3, n < 3 ? fire[3] : fire[4], 0.022, { k: 7, ph: n, sp: 1.2 }));
    }
    const missing = [...ids].filter(id => !ctx.grown(id));
    if (missing.length) throw new Error(`lamproom: growth objects with no drawing: ${missing.join(' ')}`);

    /* ---- the sky over the open roof: a dark dome, a few stars, and dust in the torch light ---- */
    ctx.glow(({ B }) => {
      const sk = ramp('skyband'), dk = ramp('sky')[0];
      B.sky(d => (d[1] < 0.08 ? sk[1] : d[1] < 0.25 ? sk[0] : dk), 200);
      for (let i = 0; i < 60; i++) {
        const a = B.rr(0, Math.PI * 2), e = B.rr(0.35, 1.3), r = 180;
        B.iso(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, B.rr(0.25, 0.4), B.P[B.pick([sk[2], stn[3]])], 3, { em: true, nd: true });
      }
    });
  }
};

/* ---- where the small things sit (shared by the scenery and the growth objects) ---- */
// the wick rack's nine hooks: three rows of three
function wickAt(i, x, z) { return [x + 0.08, 0.9 + 0.6 * Math.floor(i / 3) + 0.08, z - 0.5 + 0.5 * (i % 3)]; }
// the blade rack's four hooks, under the top bar
function bladeAt(i, x, z) { return [x - 0.02, 2.12, z - 0.66 + 0.44 * i]; }
// the off-hand stand's six pegs: two rows of three
function offAt(i, x, z) { return [x + 0.06, 1.75 - 0.6 * Math.floor(i / 3), z - 0.55 + 0.55 * (i % 3)]; }
// the lamp shelf's lamps: three bays of two shelves and two lamps
function wareAt(i, x, z) {
  const bay = Math.floor(i / 4), k = i % 4, shelf = Math.floor(k / 2), side = k % 2;
  return [x + 0.2, (shelf ? 1.75 : 0.85) + 0.035, z - 1.1 + bay * 1.1 + (side ? 0.22 : -0.22)];
}
// the kiln hood's hooks: five rows of eight, the lamp hung under each
function hookAt(i, z) { return [X1 - 0.72, 3.6 - 0.42 * Math.floor(i / 8), z - 1.05 + 0.3 * (i % 8)]; }
// the trophy wall: three key plaques, five elite plaques under them
function keyAt(i, x) { return [x - 0.85 + 0.85 * i, 2.75]; }
function eliteAt(i, x) { return [x - 1.0 + 0.5 * i, 1.6]; }
// a pattern's colour: its ability's, pane's, blade's or off-hand's
const COLOUR_OF = Object.fromEntries([...ABILITIES, ...PANES, ...BLADES, ...OFFHANDS].map(x => [x.id, x.colour]));
function colourOf(p) { return COLOUR_OF[p.id] || 'flame'; }
