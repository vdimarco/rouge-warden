// Lantern Fen: a stilt hamlet over black water, cupped between low rolling hills, at night. You stand on the south brow and look down
// on it: fat-stilted huts on either side, a boardwalk that zigzags between them over the water, lanterns that glow a sick green, mist
// lying low. Across the fen a hill rises to an old drying-rack windmill with a low yellow moon beside its sails, and the beacon waits
// on the deck lashed to the mill's side. Black-teal water, dark wet timber, dark moss hills, sick green lanterns, orange fire.
//
// The page's follow camera stands 4 above the feet and looks down so low that the top of its picture is half a degree under eye level.
// The beacon must stand 2 above the start, so it is only about 2 under the eye: anything much taller than the beacon is cut off. So
// the mill is squat and fat, its cap no higher than the beacon, and the beacon burns in a fire cage on a mast over the deck, the
// highest thing on the hill. The moon hangs just left of the sails, low enough to be whole in that picture.
//
// You start at the very lip of the brow, where it drops steeply to the water, so the lip does not hide the near fen. The huts stand
// off to the sides of that picture, so the middle of it is open water and boardwalk leading the eye up to the mill.
//
// The fen can be waded anywhere: its bed lies half a unit under the water. The boardwalks are the dry way across.
import { yawAx, turn } from '../lib/props.mjs';
import { lib, polyDist, tile } from '../lib/common.mjs';

const W = 0; // the water's surface
const BED = -0.5; // the fen's bed under it: deep enough to wade, never to swim
const DECK = 0.5; // the boardwalks' top
const PORCH = 1.7; // the huts' floors: high enough to wade under
const Y = { start: 5.0, top: 3.4, deck: 4.9, fire: 7.05 };
const START = [2, 19.4];
const SUMMIT = [-2, -17]; // the middle of the summit's flat top
const MILL = [-4.4, -17.6]; // the windmill
// the fen's bed: round flats that overlap, so the shore wanders [x, z, r, blend]
const FEN = [[-9, 7, 7.5, 4], [6, 6, 7.5, 4], [-1, 1.5, 6.5, 3.5], [15, 1, 5, 3.5], [-18, 3, 4.5, 3.5], [8, -1, 5, 3]];
// the water lies over this rectangle, wherever the ground is under the surface
const POOL = [-30, 28, -14, 24];
// the boardwalk's turns: off the landing at the foot of the brow, then west, east, west, and up onto the north shore
const J = { land: [4.6, 14.2], a: [3.6, 11.4], b: [-5.6, 9.4], c: [-5.4, 5.6], d: [8.0, 3.6], e: [8.0, 0.2], f: [-5.8, -1.4], g: [-4.8, -5.0], shore: [-4.2, -8.4] };
const MAIN = [J.land, J.a, J.b, J.c, J.d, J.e, J.f, J.g, J.shore];
// the way along the brow to the start (a road of logs), and the way up the summit hill in two switchbacks
const DOWN = [[0.6, 34], [1.0, 27], [2, 19.4]];
const CLIMB = [[-4.2, -8.4], [5.6, -9.6], [1.0, -12.8], [-0.6, -14.2]];
const T1 = [5.6, -9.6]; // the terrace at the switchback
// the huts: where, how big, and the walk their door looks at. In the first picture: one near on the left, one far on the left,
// one on the right; the other two stand out of it, east and west. The walls are tall enough that the eaves clear the porch by 1.8,
// so the porch can be walked all the way round under them
// Only two carry a lantern on the porch: the others show a lit window, so the green lights stay few and lead along the walk
const HUTS = [
  { at: [-9.4, 11.4], r: 1.6, to: J.b, win: 'warm' },
  { at: [12.2, 4.6], r: 1.7, to: J.d, win: 'sick', lamp: true },
  { at: [-10.4, -2.2], r: 1.5, to: J.f, win: 'warm', long: true, lamp: true },
  { at: [16.6, 11.0], r: 1.5, to: [12.0, 11.0], win: 'sick' },
  { at: [-18.4, 3.6], r: 1.5, to: [-13.4, 4.6], win: 'warm' }
];
const WALL = 2.25; // a hut's wall, porch to eaves
const STAGE = [12.2, -2.6]; // a roofless stage on stilts where fish are dried: you can wade under it
const BOAT = [16.6, -4.2];
const ISLE = [-17.4, 11.0]; // the net-menders' islet
const CAIRN = [24.5, -5]; // an old stone cairn on the east hill
const DROWNED = [2.6, -3.6]; // a hut that sank: only its roof shows, tipped over
// where the page camera's eye is at the start (target 1.15 over the feet, 8.5 back, pitch 0.34), to hang the moon beside the sails
const EYE_UP = 1.15 + 8.5 * Math.sin(0.34), EYE_BACK = 8.5 * Math.cos(0.34);

// frames: rows are a solid's own x, y and z axes in the world
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(c => c / l); };
// turned by yaw about up, then tipped by `tilt` about its own x axis, then rolled by `roll` about its own z axis
const tipAx = (yaw, tilt = 0, roll = 0) => {
  const [X0, , Z0] = yawAx(yaw), Y0 = [0, 1, 0];
  const ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll);
  const Y1 = Y0.map((v, i) => v * ct + Z0[i] * st), Z1 = Z0.map((v, i) => v * ct - Y0[i] * st);
  const X2 = X0.map((v, i) => v * cr + Y1[i] * sr), Y2 = Y1.map((v, i) => v * cr - X0[i] * sr);
  return [X2, Y2, Z1];
};
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export default {
  id: 'fen',
  name: 'Lantern Fen',
  sub: 'Stilt huts over black water, and the mill on the hill',
  hint: 'Cross the fen to the mill. Light the beacon.',
  seed: 31,
  palette: [
    // the sky low down is a cold teal a step lighter than the fog, so the hills stand dark against it; only round the moon does
    // it warm to a sick olive
    ['sky', [0x020507]],
    ['skyband', [0x09161b, 0x10242b, 0x1d3a3c, 0x48502f]],
    ['fog', [0x0a1517]],
    ['ink', [0x010302]],
    ['shade', [0x030706]],
    ['moss', [0x050b07, 0x0b170e, 0x152517, 0x223421]],
    ['mud', [0x0d0b08, 0x1c1812, 0x2f281b]],
    ['water', [0x010607, 0x041011, 0x0a1d1f, 0x1a3436]],
    ['wood', [0x0b0807, 0x18110d, 0x2a1e15, 0x3f2f21, 0x57442f]],
    ['straw', [0x22200f, 0x3b3519, 0x5a4f2a]],
    ['lantern', [0x4e5c18, 0x9cae34, 0xe2ec86]],
    ['moon', [0x857d50, 0xccc289]]
  ],
  // the key light is cold moonlight from the west, a little toward the start, so the faces you first see are not all black (the moon
  // you see hangs low in the north-west: the light is set for form, not to match it)
  light: { sun: [-0.62, 0.58, 0.5], amb: 0.1, sky: 0.14, sunK: 0.46, shK: 7 },
  fog: { color: 'fog', far: 88, start: 0.5, max: 0.84 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 34 },
  hills: {
    base: 1.6,
    bumps: [
      [2, 24, 8, 3.4], [2, 31, 12, 2.6], // the south brow, where you start
      [-15, 22, 10, 2.6], [19, 21, 10, 2.9], // its shoulders
      [-28, 6, 11, 3.2], [28, 4, 11, 3.4], // the west and east hills
      [-2, -17, 15, 2.2], // the summit hill
      [-21, -19, 9, 2.0], [17, -20, 10, 2.4], // its shoulders
      [-46, -34, 20, 5], [44, -36, 20, 5.5], // far hills either side, out of the first picture
      [0, -84, 58, -20] // the land falls away north into a dark low country, so the summit stands against the sky
    ],
    fbm: { amp: 0.45, freq: 1 / 10, oct: 3 },
    warp: { amp: 3, freq: 1 / 22 },
    far: { amp: 8, start: 38, end: 64 },
    flats: [
      ...FEN.map(([x, z, r, blend]) => ({ at: [x, z], r, blend, y: BED })),
      { at: SUMMIT, r: 4.8, blend: 3.5, y: Y.top }, // the summit's top
      { at: T1, r: 1.8, blend: 2, y: 2.2 }, // the terrace at the switchback
      // the brow: flat behind the start, and falling steeply just in front of the feet, so its lip hides as little water as it can
      { at: [START[0] + 0.6, START[1] + 3.2], box: [4.6, 3.2], blend: 1.3, y: Y.start }
    ],
    // the far north sinks away: the edge of the land there would stand in front of the low moon
    pits: [[-14, -102, 46, 12]],
    paths: [{ pts: DOWN, w: 2.2, depth: 0.1 }, { pts: CLIMB, w: 2.2, depth: 0.12 }],
    box: [-112, 112, -112, 112]
  },
  build(ctx) {
    const { S, B, h, ramp, K } = ctx;
    const moss = ramp('moss'), mud = ramp('mud'), wt = ramp('water'), wd = ramp('wood'), lan = ramp('lantern'), st = ramp('straw');
    const sk = ramp('skyband'), fire = ramp('fire');
    // rough surfaces: a broad tone wander and a fine grain
    const grit = (k = 1) => (x, y, z) => k * (0.16 * (B.n3(x * 0.45, z * 0.45, y * 0.3 + 3) - 0.5) + 0.14 * (B.n3(x * 2.6, y * 2.6, z * 2.6) - 0.5));
    // upright boards round a centre: a dark seam every so often round the wall
    const boards = (cx, cz, k = 0.6) => {
      const g = grit(k);
      return (x, y, z) => {
        const u = (Math.atan2(z - cz, x - cx) * 1.6 / 0.42) % 1;
        return g(x, y, z) + ((u + 1) % 1 < 0.14 ? -0.16 : 0);
      };
    };
    // thatch: streaks down the slope and a darker course every so often
    const straw = (x, y, z) => 0.18 * (B.n3(x * 5, y * 1.2, z * 5) - 0.5) + ((y * 2.4) % 1 < 0.15 ? -0.14 : 0) + 0.1 * (B.n3(x * 0.6, y, z * 0.6) - 0.5);
    // lamp light: firelight warms through the shared fire ramp; a lantern's light (c) falls in a sick green pool
    const wood = { r: wd, g: [wd[1]], mod: grit(0.5) };
    const plank = { r: wd.slice(0, 4), g: [wd[2]], mod: grit(0.7), top: { min: 0.8, r: [wd[1], wd[2], wd[3], wd[4]] } };
    const logs = { r: wd.slice(0, 4), g: [wd[2]], mod: grit(0.9), top: { min: 0.75, r: [wd[1], wd[2], wd[3], wd[3]] } };
    const dark = { r: [wd[0], ramp('ink')[0]] };
    const thatch = { r: [mud[1], st[0], st[1], st[2]], g: [st[0]], mod: straw };
    const iron = { r: ramp('iron'), g: [ramp('iron')[0]] };
    const glass = { r: [lan[1]], em: true };
    const stone = { r: [sk[0], sk[1], sk[2]], g: [sk[1]], mod: grit(0.9), top: { min: 0.72, r: moss.slice(1, 4) } };
    const cloth = { r: [mud[0], mud[1], st[0]], g: [mud[0]], mod: grit(0.6) };
    const SICK = [st[1], lan[0]];
    const lamps = []; // lanterns, drawn after the bakes
    const fireGlints = []; // fires low over the water, whose light lies on it

    /* ---- the ground: a fine square over the play area, then strips coarser each time out ---- */
    // Nothing under the water can be seen, so nothing there is drawn: the sculptor skips any surface point S.pre turns down (the fen's
    // bed, the feet of stilts and posts). Those shapes still stand in the distance field, so the walk map still has them.
    const [px0, px1, pz0, pz1] = POOL;
    const inPool = (x, z) => x > px0 && x < px1 && z > pz0 && z < pz1;
    S.pre = (x, y, z) => !(y < W - 0.06 && inPool(x, z));
    {
      const onPath = (x, z) => Math.min(polyDist(x, z, DOWN), polyDist(x, z, CLIMB)) + 0.7 * (B.n3(x * 1.1, z * 1.1, 4) - 0.5) < 1.1;
      const bank = (y, x, z) => y < W + 0.3 + 0.3 * B.n3(x * 0.7, z * 0.7, 2);
      const near = { r: moss, g: [moss[1]], mod: grit(1), rf: (x, y, z) => (onPath(x, z) || bank(y, x, z) ? mud : moss) };
      const mid = { r: moss, mod: grit(1.2), fat: 0.62 }, out = { r: moss.slice(0, 3), mod: grit(1.4), fat: 0.8 };
      const N = [-26, 28, -32, 28], M = [-56, 56, -56, 56], F = [-108, 108, -108, 108];
      tile(S, h, near, { x0: N[0], x1: N[1], z0: N[2], z1: N[3], res: 0.32 });
      const ring = (o, i, res, mat) => {
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: o[2], z1: i[2], res });
        tile(S, h, mat, { x0: o[0], x1: o[1], z0: i[3], z1: o[3], res });
        tile(S, h, mat, { x0: o[0], x1: i[0], z0: i[2], z1: i[3], res });
        tile(S, h, mat, { x0: i[1], x1: o[1], z0: i[2], z1: i[3], res });
      };
      ring(M, N, 0.75, mid);
      ring(F, M, 1.6, out);
    }

    /* ---- small props of this place ---- */
    // a slab of timber: a box drawn on its top and sides only (nobody looks up at a plank's underside), so a deck costs half
    const slab = (c, [hx, hy, hz], mat, { ax, res = 0.13, rd = 0.03 } = {}) => S.solid(c, Math.hypot(hx, hy, hz),
      (x, y, z) => {
        const qx = Math.abs(x) - hx + rd, qy = Math.abs(y) - hy + rd, qz = Math.abs(z) - hz + rd;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rd;
      },
      (r, f) => {
        const dz = r * 0.87;
        for (let j = 0; -hz + (j + 0.5) * dz < hz; j++) {
          const z = -hz + (j + 0.5) * dz;
          for (let x = -hx + (j % 2 ? r : r * 0.5); x < hx; x += r) f(x, hy, z);
        }
        for (let y = -hy + r * 0.4; y < hy; y += r * 0.87) {
          for (let x = -hx + r * 0.5; x < hx; x += r) { f(x, y, hz); f(x, y, -hz); }
          for (let z = -hz + r * 0.5; z < hz; z += r) { f(hx, y, z); f(-hx, y, z); }
        }
      }, mat, { ax, res });
    // a lantern hung with its ring at (x, y, z): a fat glass that glows sick green under a small iron cap, and its green light on what
    // is near. The glass is most of it: a dark frame or a big black cap round a small glass reads, from across the fen, as a hooded
    // blob with a green mouth, not as a light
    const lantern = (x, y, z, { r = 3.8, k = 0.95 } = {}) => {
      S.tube([[x, y, z], [x, y - 0.14, z]], 0.035, 0.035, iron, { res: 0.04 });
      S.ball([x, y - 0.17, z], [0.15, 0.06, 0.15], iron, { res: 0.05 });
      S.ball([x, y - 0.43, z], [0.2, 0.26, 0.2], glass, { res: 0.045 });
      S.ball([x, y - 0.69, z], [0.11, 0.04, 0.11], iron, { res: 0.05 });
      S.lights.push({ p: [x, y - 0.45, z], r, s: k, sh: true, c: SICK });
      lamps.push([x, y - 0.45, z]);
    };
    // a post with a crook at the top and a lantern hung from it, the crook reaching (dx, dz)
    const crook = (x, z, dx, dz, { y, tall = 2.6 } = {}) => {
      const y0 = y ?? Math.max(BED, h(x, z)) - 0.3, top = y0 + tall + 0.3;
      S.tube([[x, y0, z], [x, top, z]], 0.14, 0.11, wood, { res: 0.1 });
      S.tube([[x, top - 0.15, z], [x + dx * 0.5, top + 0.12, z + dz * 0.5], [x + dx * 0.85, top - 0.02, z + dz * 0.85]], 0.07, 0.05, wood, { res: 0.07 });
      lantern(x + dx * 0.85, top - 0.08, z + dz * 0.85);
    };
    // a post with a fire on top
    const torch = (x, z, { tall = 1.8, y, s = 0.8, k = 0.65, r = 3.6 } = {}) => {
      const y0 = y ?? h(x, z) - 0.1;
      S.tube([[x, y0, z], [x, y0 + tall, z]], 0.15, 0.11, wood, { res: 0.1 });
      S.ball([x, y0 + tall + 0.02, z], [0.23, 0.12, 0.23], iron, { res: 0.07 });
      ctx.fire([x, y0 + tall + 0.1, z], s, { k, r });
    };
    // an iron fire basket on three legs; returns the top of the basket
    const basket = (x, z, { y, s = 0.9, lit = true, k = 0.6 } = {}) => {
      const y0 = y ?? h(x, z) - 0.05;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        S.tube([[x + Math.cos(a) * 0.45, y0, z + Math.sin(a) * 0.45], [x + Math.cos(a) * 0.2, y0 + 0.62, z + Math.sin(a) * 0.2]], 0.07, 0.06, iron, { res: 0.07 });
      }
      const b = S.ball([x, y0 + 0.82, z], [0.5, 0.28, 0.5], iron, { hold: true });
      const hole = S.ball([x, y0 + 0.98, z], [0.41, 0.25, 0.41], iron, { hold: true });
      S.join('cut', b, hole, { res: 0.08 });
      if (lit) ctx.fire([x, y0 + 0.86, z], s, { k });
      return [x, y0 + 0.86, z];
    };
    // a run of log steps from a to b, each `rise` high, as blocks set into the ground or the water
    const stair = (a, b, { width = 2.2, rise = 0.32, ya, yb } = {}) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
      ya = ya ?? h(a[0], a[1]); yb = yb ?? h(b[0], b[1]);
      const n = Math.max(2, Math.ceil(Math.abs(yb - ya) / rise)), half = len / n / 2 + 0.04;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, top = ya + (yb - ya) * ((i + 1) / n);
        const low = Math.min(Math.max(h(x, z), BED), top) - 0.4;
        slab([x, (top + low) / 2, z], [width / 2, (top - low) / 2, half], plank, { ax: yawAx(yaw + B.rr(-0.03, 0.03)), rd: 0.05, res: 0.13 });
      }
    };
    // a boardwalk from a to b: planks across the way, fat posts in pairs, now and then a stump of rail
    const walkway = (a, b, { y = DECK, wid = 2.1, lamp = -1 } = {}) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
      const ux = dx / len, uz = dz / len, qx = uz, qz = -ux; // q: across the walk
      const n = Math.max(1, Math.round(len / 0.66)), half = len / n / 2;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, top = y + B.rr(-0.035, 0.025), sh = B.rr(-0.12, 0.12);
        if (h(x, z) > top - 0.05) continue; // buried in the bank
        slab([x + qx * sh, top - 0.1, z + qz * sh], [wid / 2 + B.rr(-0.1, 0.1), 0.1, half - 0.03], plank, { ax: yawAx(yaw + B.rr(-0.05, 0.05)), res: 0.14 });
      }
      const np = Math.max(1, Math.round(len / 2.4));
      for (let i = 0; i <= np; i++) {
        const t = i / np, x = a[0] + dx * t, z = a[1] + dz * t;
        for (const s of [-1, 1]) {
          const px = x + qx * s * (wid / 2 - 0.1), pz = z + qz * s * (wid / 2 - 0.1), gy = Math.max(h(px, pz), BED);
          if (gy > y - 0.2) continue;
          const tall = (i * 2 + (s > 0 ? 1 : 0)) % 5 === 0 ? 0.8 : 0.06; // now and then a post stands up as a stump of rail
          S.tube([[px, gy - 0.3, pz], [px + B.rr(-0.06, 0.06), y + tall, pz + B.rr(-0.06, 0.06)]], 0.17, 0.15, wood, { res: 0.1 });
        }
        if (i === lamp || (lamp === 'end' && i === np)) crook(x + qx * (wid / 2 + 0.1), z + qz * (wid / 2 + 0.1), qx, qz);
      }
    };
    // a square landing where the boardwalk turns, on four posts
    const landing = (p, { y = DECK, half = 1.35 } = {}) => {
      const yaw = B.rr(-0.2, 0.2);
      slab([p[0], y - 0.11, p[1]], [half, 0.11, half], plank, { ax: yawAx(yaw), rd: 0.04, res: 0.14 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const [x, z] = turn(p[0], p[1], yaw, sx * (half - 0.15), sz * (half - 0.15)), gy = Math.max(h(x, z), BED);
        if (gy < y - 0.2) S.tube([[x, gy - 0.3, z], [x, y - 0.05, z]], 0.18, 0.16, wood, { res: 0.1 });
      }
    };
    // a rock, chunky, coarse enough to be cheap
    const rock = (x, z, r, i, y) => K.grow.rock(S, [x, (y ?? h(x, z)) + r * 0.3, z], r, stone, { facets: 7, chip: 0.35, worn: 0.06, seed: 40 + i, res: Math.max(0.1, Math.min(0.17, r * 0.16)) });
    // a dead fen tree: a fat trunk that leans and twists, three crooked limbs, all chunky
    const fenTree = (x, z, { tall = 3.2, seed = 1, y } = {}) => {
      const y0 = (y ?? h(x, z)) - 0.2, a0 = seed * 2.3, lx = Math.cos(a0) * 0.5, lz = Math.sin(a0) * 0.5;
      const top = [x + lx * tall * 0.45, y0 + tall, z + lz * tall * 0.45];
      S.tube([[x, y0, z], [x + lx * 0.3, y0 + tall * 0.45, z - lz * 0.2], top], 0.34, 0.1, wood, { res: 0.1 });
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * 2.1 + 0.4, t = 0.5 + k * 0.17, l = tall * (0.42 - k * 0.06);
        const p0 = [x + lx * tall * t * 0.6, y0 + tall * t, z + lz * tall * t * 0.4];
        const p1 = [p0[0] + Math.cos(a) * l * 0.6, p0[1] + l * 0.45, p0[2] + Math.sin(a) * l * 0.6];
        const p2 = [p1[0] + Math.cos(a + 0.7) * l * 0.45, p1[1] + l * 0.05, p1[2] + Math.sin(a + 0.7) * l * 0.45];
        S.tube([p0, p1, p2], 0.11, 0.03, wood, { res: 0.08 });
      }
    };
    // reeds: a clump of blades and a few dark heads, drawn after the bakes as single long dabs (they never block the feet)
    const reedBeds = [];
    const reeds = (x, z, n = 9, spread = 0.7, tall = 1.5) => reedBeds.push([x, z, n, spread, tall]);
    // grass on the hills: low tufts, also single dabs
    const tufts = [];

    /* ---- the brow: a road of logs to the lip, two torches at the lip, a log stair down its steep bank to the landing ---- */
    {
      const [sx, sz] = START;
      // the road: fat logs laid across the way, half sunk, a little askew, now and then one gone; the first thing under the camera
      for (let z = sz - 0.1, k = 0; z < sz + 7.5; z += 0.46 + B.rr(-0.03, 0.05), k++) {
        if (k > 2 && B.rr(0, 1) < 0.14) continue;
        const cx = 2 + (z - sz) * -0.14 + B.rr(-0.12, 0.12), a = B.rr(-0.12, 0.12), hl = 1.25 + B.rr(-0.15, 0.2), r = 0.19 + B.rr(-0.02, 0.03);
        const [x0, z0] = turn(cx, z, a, -hl, 0), [x1, z1] = turn(cx, z, a, hl, 0);
        S.tube([[x0, h(x0, z0) + r * 0.25, z0], [x1, h(x1, z1) + r * 0.25, z1]], r, r * 0.92, logs, { res: 0.11 });
      }
      // two torches at the lip, either side of the stair's head: they frame the fen, and are the warmest thing in the first picture
      torch(sx - 2.7, sz + 0.5, { tall: 1.3, s: 0.6 });
      torch(sx + 3.5, sz + 0.6, { tall: 1.3, s: 0.6 });
      // mooring posts and stones along the lip, so its edge is broken, not one hard line across the picture
      for (const [x, z, t] of [[sx - 4.6, sz + 0.2, 1.1], [sx + 5.4, sz + 0.4, 0.8], [sx - 1.6, sz - 0.1, 0.55]])
        S.tube([[x, h(x, z) - 0.3, z], [x + B.rr(-0.1, 0.1), h(x, z) + t, z + B.rr(-0.1, 0.1)]], 0.2, 0.15, wood, { res: 0.1 });
      stair([sx + 0.6, sz - 0.2], [5.2, 14.9], { width: 2.0, rise: 0.36, ya: Y.start - 0.1, yb: DECK });
      rock(sx + 5.0, sz + 2.2, 0.75, 1); rock(sx - 3.8, sz + 1.6, 0.6, 2); rock(sx - 6.2, sz + 0.8, 0.9, 3); rock(sx + 7.0, sz + 1.0, 0.8, 4);
      for (let k = 0; k < 30; k++) tufts.push([sx + B.rr(-8, 8), sz + B.rr(0, 7)]);
    }

    /* ---- the boardwalk: the main zigzag over the water, its landings, and two branches to the outer huts. Its lanterns hang at
       the far ends of the crossings, out to the sides of the first picture ---- */
    for (let i = 0; i < MAIN.length - 1; i++) walkway(MAIN[i], MAIN[i + 1], { lamp: i === 1 || i === 3 || i === 5 ? 'end' : -1 });
    for (const p of [J.a, J.b, J.c, J.d, J.e, J.f, J.g]) landing(p);
    walkway(J.a, [12.0, 11.0], { wid: 1.9 });
    walkway(J.c, [-13.4, 4.6], { wid: 1.9 });
    // the landing at the foot of the brow: a wide stage with a fire basket
    slab([4.6, DECK - 0.12, 14.6], [1.8, 0.12, 1.3], plank, { ax: yawAx(0.08), rd: 0.04, res: 0.13 });
    basket(6.0, 13.8, { y: DECK - 0.05, s: 0.8 });
    fireGlints.push([6.4, 12.9]);
    // a fire basket on the east turn, in the corner the walk does not cross: the one warm light out in the middle of the fen
    basket(J.e[0] + 0.75, J.e[1] - 0.75, { y: DECK - 0.05, s: 0.85, k: 0.75 });
    fireGlints.push([J.e[0] + 1.6, J.e[1] - 0.2]);

    /* ---- the huts ---- */
    // a stilted porch: fat planks across, on six stilts a little out of true, braced on two sides, with log steps up from the walk
    // on the side it faces. It returns where its legs stand
    const stilted = (x, z, face, ph) => {
      const n = Math.round(ph * 2 / 0.92);
      for (let k = 0; k < n; k++) {
        const o = -ph + (k + 0.5) * (2 * ph / n), [cx, cz] = turn(x, z, face, o, 0);
        slab([cx, PORCH - 0.12 + B.rr(-0.03, 0.03), cz], [ph / n - 0.03, 0.12, ph + B.rr(0, 0.12)], plank, { ax: yawAx(face + B.rr(-0.03, 0.03)), rd: 0.04, res: 0.14 });
      }
      const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0]].map(([sx, sz]) => turn(x, z, face, sx * (ph - 0.25), sz * (ph - 0.25)));
      for (const [lx, lz] of legs) S.tube([[lx, BED - 0.4, lz], [lx + B.rr(-0.15, 0.15), PORCH - 0.2, lz + B.rr(-0.15, 0.15)]], 0.26, 0.21, wood, { res: 0.11 });
      for (const [p, q] of [[0, 4], [1, 5]]) S.tube([[legs[p][0], 0.1, legs[p][1]], [legs[q][0], PORCH - 0.35, legs[q][1]]], 0.09, 0.09, wood, { res: 0.09 });
      // (its top step runs a little onto the porch, so there is no crack between them to fall through)
      const [fx, fz] = turn(x, z, face, 0, ph - 0.1), [gx, gz] = turn(x, z, face, 0, ph + 1.9);
      stair([gx, gz], [fx, fz], { width: 1.7, rise: 0.32, ya: DECK, yb: PORCH });
      return legs;
    };
    const hut = ({ at: [x, z], r, to, win, long, lamp }, i) => {
      const face = Math.atan2(to[0] - x, to[1] - z), ph = 2.3, lean = B.rr(-0.04, 0.04), tall = WALL;
      const legs = stilted(x, z, face, ph);
      let dr;
      if (long) {
        // a long hut: a box of boards along the porch, a ridge roof of thatch
        const hl = 1.9, hw = 1.3, top = PORCH + tall;
        S.box([x, PORCH + tall / 2 - 0.1, z], [hl, tall / 2 + 0.1, hw], { ...wood, mod: boards(x + 40, z) }, { ax: yawAx(face), rd: 0.12, res: 0.13 });
        for (const s of [-1, 1]) {
          const [cx, cz] = turn(x, z, face, 0, s * 0.85);
          S.box([cx, top + 0.5, cz], [hl + 0.45, 0.17, 1.25], thatch, { ax: tipAx(face + (s > 0 ? 0 : Math.PI), 0.6, lean), rd: 0.08, res: 0.14 });
        }
        const [r0x, r0z] = turn(x, z, face, -hl - 0.5, 0), [r1x, r1z] = turn(x, z, face, hl + 0.5, 0);
        S.tube([[r0x, top + 1.08, r0z], [r1x, top + 1.08, r1z]], 0.15, 0.15, thatch, { res: 0.1 });
        dr = hw + 0.02;
      } else {
        // a round hut: a wall of boards, a fat thatch cone with a topknot, sagging a little
        S.lathe([x, PORCH - 0.15, z], tall + 0.15, t => r * (1 - 0.07 * t), { ...wood, mod: boards(x, z) }, { res: 0.13, maxRadius: r });
        S.lathe([x, PORCH + tall - 0.25, z], 1.65, t => (r + 0.85) * Math.pow(1 - t, 1.2) + 0.08, thatch, { res: 0.14, maxRadius: r + 0.95, ax: tipAx(face, lean, B.rr(-0.04, 0.04)) });
        S.ball([x, PORCH + tall + 1.3, z], [0.22, 0.3, 0.22], thatch, { res: 0.08 });
        dr = r - 0.02;
      }
      // the door: a dark slab in a fat frame, facing the walk
      const [dx, dz] = turn(x, z, face, 0, dr);
      S.box([dx, PORCH + 0.7, dz], [0.42, 0.75, 0.1], dark, { ax: yawAx(face), res: 0.08 });
      for (const s of [-1, 1]) { const [jx, jz] = turn(x, z, face, s * 0.55, dr + 0.06); S.box([jx, PORCH + 0.72, jz], [0.12, 0.82, 0.12], wood, { ax: yawAx(face), rd: 0.03, res: 0.08 }); }
      { const [lx, lz] = turn(x, z, face, 0, dr + 0.08); S.box([lx, PORCH + 1.6, lz], [0.72, 0.12, 0.13], wood, { ax: yawAx(face), rd: 0.03, res: 0.08 }); }
      // a window round the side, lit from inside
      const side = i % 2 ? 1 : -1, wa = face + side * 1.25, wr = long ? 1.34 : r * 0.97;
      const [wx, wz] = long ? turn(x, z, face, side * 1.0, 1.33) : [x + Math.sin(wa) * wr, z + Math.cos(wa) * wr];
      S.box([wx, PORCH + 1.15, wz], [0.32, 0.26, 0.08], wood, { ax: yawAx(long ? face : wa), rd: 0.03, res: 0.07 });
      ctx.glow(() => {
        const c = win === 'warm' ? [fire[3], fire[2]] : [lan[1], lan[0]], [ox, oz] = long ? turn(0, 0, face, 0, 0.1) : [Math.sin(wa) * 0.1, Math.cos(wa) * 0.1];
        B.iso(wx + ox, PORCH + 1.15, wz + oz, 0.13, B.P[c[0]], 3, { em: true, nd: true, k: 7, ph: i, sp: 1.6 });
        B.iso(wx + ox, PORCH + 1.1, wz + oz, 0.1, B.P[c[1]], 3, { em: true, nd: true });
        B.iso(wx + ox * 4, PORCH + 1.15, wz + oz * 4, 0.55, B.P[c[1]], 0.18, { em: true, nd: true });
      });
      if (win === 'warm') ctx.lamp([wx, PORCH + 1.1, wz], 2.6, 0.5, true);
      // a lantern on a post at the porch's front corner
      if (lamp) {
        const [cx, cz] = turn(x, z, face, -side * (ph - 0.2), ph - 0.2);
        S.tube([[cx, PORCH - 0.1, cz], [cx, PORCH + 2.6, cz]], 0.13, 0.1, wood, { res: 0.09 });
        const [lx, lz] = turn(cx, cz, face, side * 0.7, 0.3);
        S.tube([[cx, PORCH + 2.5, cz], [lx, PORCH + 2.65, lz]], 0.06, 0.05, wood, { res: 0.06 });
        lantern(lx, PORCH + 2.6, lz);
      }
      // clutter: a barrel and a crate on the porch, the far side
      { const [bx, bz] = turn(x, z, face, side * 1.6, -1.5); S.lathe([bx, PORCH - 0.02, bz], 0.85, t => 0.32 + 0.06 * Math.sin(t * Math.PI), { ...wood, mod: boards(bx, bz, 0.4) }, { res: 0.08, maxRadius: 0.38 }); }
      { const [bx, bz] = turn(x, z, face, -side * 1.7, -1.3); slab([bx, PORCH + 0.3, bz], [0.36, 0.32, 0.36], plank, { ax: yawAx(face + 0.4), rd: 0.04, res: 0.08 }); }
      // reeds round the stilts
      for (const [lx, lz] of [legs[0], legs[3], legs[4]]) reeds(lx + B.rr(-0.6, 0.6), lz + B.rr(-0.6, 0.6), 7, 0.6, 1.3);
    };
    HUTS.forEach(hut);

    /* ---- the drying stage: a roofless porch on stilts off the east turn, a rack of poles on it with fish and a net hung to dry.
       It has no roof, so the space under it stays open to the water: a wisp waits down there ---- */
    {
      const [x, z] = STAGE, face = Math.atan2(J.e[0] - x, J.e[1] - z), ph = 1.8;
      const legs = stilted(x, z, face, ph);
      const at = (lx, ly, lz) => { const [a, b] = turn(x, z, face, lx, lz); return [a, PORCH + ly, b]; };
      // two crossed pairs of poles at the ends, a ridge pole along the back between them
      for (const s of [-1, 1]) {
        S.tube([at(s * 1.25 - 0.45, -0.1, -0.7), at(s * 1.25 + 0.2, 2.05, -0.7)], 0.08, 0.06, wood, { res: 0.07 });
        S.tube([at(s * 1.25 + 0.45, -0.1, -0.7), at(s * 1.25 - 0.2, 2.05, -0.7)], 0.08, 0.06, wood, { res: 0.07 });
      }
      S.tube([at(-1.7, 1.92, -0.7), at(1.7, 1.92, -0.7)], 0.08, 0.08, wood, { res: 0.07 });
      for (let k = 0; k < 6; k++) { const p = at(-1.0 + k * 0.4, 1.58, -0.7); S.ball(p, [0.09, 0.28, 0.05], cloth, { res: 0.05 }); }
      ctx.later(() => { const p = at(0.0, 1.45, -0.62); net(p[0], p[1], p[2], face + Math.PI / 2, 0.9, 0.42); });
      // a lantern on a post at the front corner
      const c = at(-1.55, 0, 1.55);
      S.tube([[c[0], PORCH - 0.1, c[2]], [c[0], PORCH + 2.6, c[2]]], 0.13, 0.1, wood, { res: 0.09 });
      { const p = at(-2.2, 2.65, 1.85); S.tube([[c[0], PORCH + 2.5, c[2]], p], 0.06, 0.05, wood, { res: 0.06 }); lantern(p[0], p[1] - 0.05, p[2]); }
      for (const [lx, lz] of [legs[1], legs[3]]) reeds(lx + B.rr(-0.6, 0.6), lz + B.rr(-0.6, 0.6), 7, 0.6, 1.3);
      { const p = at(0, -PORCH + W + 0.6, 0.7); ctx.wisp(p); } // under the stage, between its stilts
    }

    /* ---- the drowned hut: only its roof shows above the water, tipped over, its topknot pointing east ---- */
    {
      const [x, z] = DROWNED, ax = tipAx(0.9, 0.5, 0.15);
      S.lathe([x, -1.0, z], 1.9, t => 2.3 * Math.pow(1 - t, 1.25) + 0.08, thatch, { res: 0.14, maxRadius: 2.4, ax });
      S.tube([[x - 1.6, BED - 0.3, z + 1.2], [x - 1.9, 1.2, z + 1.5]], 0.22, 0.17, wood, { res: 0.11 });
      S.tube([[x + 1.7, BED - 0.3, z - 1.0], [x + 1.4, 0.7, z - 1.3]], 0.22, 0.18, wood, { res: 0.11 });
      reeds(x - 2.2, z - 0.6, 8, 0.7, 1.3);
    }

    /* ---- the rotting boat: half sunk, its bow up out of the water, a stump of mast with a lantern ---- */
    {
      const [bx, bz] = BOAT, ax = tipAx(0.9, -0.16, 0.2);
      const hull = S.ball([bx, -0.15, bz], [0.95, 0.72, 2.4], wood, { hold: true, ax });
      const hollow = S.ball([bx, 0.12, bz], [0.78, 0.66, 2.2], wood, { hold: true, ax });
      const gap = S.box([bx + 0.9, 0.0, bz - 0.4], [0.5, 0.35, 0.7], wood, { hold: true, ax });
      S.join('cut', hull, [hollow, gap], { res: 0.1, inner: wd.slice(0, 2) });
      const at = (lx, ly, lz) => [bx + ax[0][0] * lx + ax[1][0] * ly + ax[2][0] * lz, -0.15 + ax[0][1] * lx + ax[1][1] * ly + ax[2][1] * lz, bz + ax[0][2] * lx + ax[1][2] * ly + ax[2][2] * lz];
      // ribs show through the broken side; a thwart to stand on; the mast stump with a lantern
      for (const lz of [-0.9, -0.4, 0.1, 0.6]) S.tube([at(0.85, 0.5, lz), at(0.98, 0.05, lz), at(0.7, -0.45, lz)], 0.06, 0.05, wood, { res: 0.07 });
      slab(at(0, 0.28, 0.3), [0.82, 0.08, 0.26], plank, { ax, rd: 0.03, res: 0.08 });
      S.tube([at(0, -0.3, 0.9), at(0, 1.9, 0.95)], 0.12, 0.09, wood, { res: 0.08 });
      S.tube([at(0, 1.6, 0.92), at(0.6, 1.8, 0.92)], 0.05, 0.05, wood, { res: 0.06 });
      { const p = at(0.62, 1.78, 0.92); lantern(p[0], p[1], p[2]); }
      // an oar adrift
      S.tube([[bx - 2.4, W + 0.05, bz + 1.6], [bx - 0.6, W + 0.12, bz + 2.6]], 0.06, 0.06, wood, { res: 0.07 });
      S.box([bx - 2.7, W + 0.04, bz + 1.45], [0.15, 0.05, 0.32], wood, { ax: yawAx(1.05), res: 0.07 });
      reeds(bx - 1.4, bz - 1.2, 9, 0.8, 1.4);
      reeds(bx + 1.6, bz + 1.3, 8, 0.7, 1.2);
      ctx.wisp(at(0, 1.25, 0.3)); // over the thwart
    }

    /* ---- the net-menders' islet: a mud hummock with two net frames, a fire pit and a stack of crates ---- */
    {
      const [ix, iz] = ISLE, top = 0.6;
      S.ball([ix, -1.0, iz], [3.2, 1.65, 2.6], { r: moss.slice(0, 4), g: [moss[1]], mod: grit(1), rf: (x, y) => (y < 0.25 ? mud : null) }, { res: 0.13 });
      // two net frames: posts, a beam, the net itself (hung after the walk map, so it does not block)
      const frameAt = (fx, fz, yaw, wide = 1.3, tall = 2.0) => {
        const [ax0, az0] = turn(fx, fz, yaw, -wide, 0), [ax1, az1] = turn(fx, fz, yaw, wide, 0);
        for (const [px, pz] of [[ax0, az0], [ax1, az1]]) S.tube([[px, -0.6, pz], [px, top + tall, pz]], 0.13, 0.1, wood, { res: 0.09 });
        S.tube([[ax0, top + tall - 0.1, az0], [ax1, top + tall - 0.1, az1]], 0.1, 0.1, wood, { res: 0.08 });
        ctx.later(() => net(fx, top + tall - 0.95, fz, yaw, wide - 0.1, 0.8));
      };
      frameAt(ix - 1.4, iz - 0.6, 0.5);
      frameAt(ix + 1.2, iz + 1.0, -0.35, 1.1, 1.7);
      // the fire pit: a ring of stones round a basket
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; rock(ix + 0.9 + Math.cos(a) * 0.6, iz - 1.2 + Math.sin(a) * 0.6, 0.2, 60 + k, top - 0.1); }
      basket(ix + 0.9, iz - 1.2, { y: top - 0.6, s: 0.85 });
      fireGlints.push([ix + 1.4, iz + 2.2]);
      // crates stacked to climb, a wisp on the top
      slab([ix - 1.9, top + 0.3, iz + 1.2], [0.45, 0.4, 0.45], plank, { ax: yawAx(0.3), rd: 0.04, res: 0.09 });
      slab([ix - 2.6, top + 0.22, iz + 1.9], [0.4, 0.32, 0.4], plank, { ax: yawAx(-0.2), rd: 0.04, res: 0.09 });
      slab([ix - 2.0, top + 1.1, iz + 1.4], [0.4, 0.38, 0.4], plank, { ax: yawAx(0.7), rd: 0.04, res: 0.09 });
      ctx.wisp([ix - 2.0, top + 2.4, iz + 1.4]);
      reeds(ix + 2.8, iz + 1.6, 10, 0.9, 1.5);
      reeds(ix - 3.1, iz - 1.2, 9, 0.8, 1.4);
      reeds(ix + 0.4, iz + 2.8, 8, 0.8, 1.3);
    }
    // a net: a sheet with holes in it, hung between two posts
    function net(x, y, z, yaw, wide, tall) {
      const mesh = (x2, y2, z2) => {
        const u = (x2 * Math.cos(yaw) - z2 * Math.sin(yaw)) / 0.2, v = y2 / 0.2;
        const fu = ((u % 1) + 1) % 1, fv = ((v % 1) + 1) % 1;
        return fu < 0.3 || fv < 0.3 ? undefined : -1;
      };
      S.box([x, y, z], [wide, tall, 0.012], { r: [mud[0], mud[1], st[0]], tex: mesh, mod: grit(0.5) }, { ax: tipAx(yaw, 0.12), res: 0.05 });
    }

    /* ---- the north shore and the climb: terraces held up by stakes, torches at the turns, a drying rack ---- */
    {
      const stakeRow = (a, b, n, tall = 1.0) => {
        for (let k = 0; k < n; k++) {
          const t = k / (n - 1), x = a[0] + (b[0] - a[0]) * t + B.rr(-0.08, 0.08), z = a[1] + (b[1] - a[1]) * t + B.rr(-0.08, 0.08), y0 = h(x, z) - 0.4;
          S.tube([[x, y0, z], [x + B.rr(-0.12, 0.12), y0 + tall * B.rr(0.8, 1.15) + 0.4, z + B.rr(-0.12, 0.12)]], 0.17, 0.1, wood, { res: 0.1 });
        }
      };
      stakeRow([7.2, -7.2], [8.6, -10.6], 5, 0.9);
      stakeRow([0.0, -6.6], [5.4, -7.4], 5, 0.7);
      stakeRow([3.8, -13.6], [7.6, -11.8], 5, 0.9);
      torch(7.8, -9.0, { tall: 1.7 });
      torch(-5.8, -9.2, { tall: 1.5 });
      torch(1.4, -15.0, { y: Y.top - 0.1, tall: 1.6 });
      // a drying rack on the terrace: two crossed pairs of poles and a long pole with dark fish hung along it
      {
        const [tx, tz] = T1, y0 = h(tx, tz);
        for (const s of [-1, 1]) {
          const [cx, cz] = [tx - 0.4 + s * 1.3, tz - 1.2];
          S.tube([[cx - 0.5, y0 - 0.2, cz], [cx + 0.25, y0 + 1.9, cz]], 0.08, 0.06, wood, { res: 0.07 });
          S.tube([[cx + 0.5, y0 - 0.2, cz], [cx - 0.25, y0 + 1.9, cz]], 0.08, 0.06, wood, { res: 0.07 });
        }
        S.tube([[tx - 2.0, y0 + 1.7, tz - 1.2], [tx + 1.2, y0 + 1.7, tz - 1.2]], 0.07, 0.07, wood, { res: 0.07 });
        for (let k = 0; k < 7; k++) S.ball([tx - 1.5 + k * 0.38, y0 + 1.35, tz - 1.2], [0.08, 0.26, 0.05], cloth, { res: 0.05 });
      }
      for (let k = 0; k < 50; k++) tufts.push([B.rr(-12, 12), B.rr(-16, -7)]);
    }

    /* ---- the summit: a squat drying-rack windmill, the beacon deck lashed to its east side, the beacon in a fire cage on a mast ----
       The page's first picture cuts off anything much higher than the beacon, so the mill is fat rather than tall: its cap and its
       top sails stop under the fire cage, and the cage on its mast is the highest thing on the hill. */
    {
      const [mx, mz] = MILL, gy = Y.top, bodyTop = gy + 2.9, rAt = y => 1.55 - 0.6 * Math.max(0, Math.min(1, (y - gy - 0.2) / (bodyTop - gy - 0.2)));
      // a footing of fat stones, then the body: a stout tower of boards that narrows toward the cap, banded with iron. It is much
      // narrower than the sails' reach, so from across the fen the cross stands out round it against the haze
      S.lathe([mx, gy - 0.7, mz], 1.1, t => 1.95 - 0.2 * t, stone, { res: 0.13, maxRadius: 2.0 });
      S.lathe([mx, gy + 0.2, mz], bodyTop - gy - 0.2, t => 1.55 - 0.6 * t, { ...wood, mod: boards(mx, mz, 0.7) }, { res: 0.12, maxRadius: 1.6 });
      for (const y of [gy + 0.9, bodyTop - 0.4]) S.torus([mx, y, mz], rAt(y) + 0.04, 0.11, iron, { res: 0.08 });
      // the door at the foot, wide and dark, under a fat lintel
      S.box([mx + 0.2, gy + 0.85, mz + rAt(gy + 0.85) - 0.08], [0.55, 0.75, 0.14], dark, { res: 0.08 });
      S.box([mx + 0.2, gy + 1.7, mz + rAt(gy + 1.7) - 0.02], [0.8, 0.14, 0.16], wood, { rd: 0.04, res: 0.08 });
      // the cap: a fat thatch dome, sagging a little to one side, and a short topknot
      S.lathe([mx, bodyTop - 0.15, mz], 0.8, t => 1.2 * Math.sqrt(Math.max(0, 1 - t * t)) + 0.06, thatch, { res: 0.11, maxRadius: 1.3, ax: tipAx(0.4, 0.07, 0.03) });
      S.ball([mx + 0.05, bodyTop + 0.68, mz - 0.05], [0.18, 0.16, 0.18], thatch, { res: 0.08 });
      // the windshaft out of the south face, past the cap's rim, and a fat iron hub
      const hub = [mx, gy + 2.25, mz + 1.45];
      S.tube([[mx, hub[1], mz + 0.6], hub], 0.2, 0.18, wood, { res: 0.08 });
      S.ball(hub, 0.32, iron, { res: 0.07 });
      // four sails in a cross at forty-five degrees (the lowest a cross can stand), few and fat members: a stock, two rails and two
      // bars. Three carry dark sacking (one torn short), the fourth is a bare rack with fish hung to dry; all dark, so the cross
      // reads black against the lit haze
      const L = 2.3, sack = { r: [mud[0], mud[1], st[0]], g: [mud[1]], mod: grit(0.7) };
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + 0.03 + k * Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a), ax = [[uy, -ux, 0], [ux, uy, 0], [0, 0, 1]];
        const at = (s, o, dz = 0) => [hub[0] + ux * s + uy * o, hub[1] + uy * s - ux * o, hub[2] + 0.14 + dz];
        S.box(at(L / 2, 0), [0.14, L / 2 + 0.1, 0.14], wood, { ax, rd: 0.04, res: 0.08 });
        for (const o of [-0.36, 0.36]) S.box(at(0.45 + (L - 0.45) / 2, o, 0.05), [0.09, (L - 0.45) / 2, 0.09], wood, { ax, rd: 0.03, res: 0.08 });
        for (const s of [0.9, L - 0.1]) S.box(at(s, 0, 0.05), [0.45, 0.09, 0.09], wood, { ax, rd: 0.03, res: 0.08 });
        if (k !== 2) {
          const len = k === 3 ? 1.0 : L - 0.5;
          S.box(at(0.5 + len / 2, 0, 0.1), [0.33, len / 2, 0.035], sack, { ax, res: 0.08 });
        } else for (let b = 0; b < 2; b++) { const p = at(1.0 + b * 0.7, (b - 0.5) * 0.36, 0.14); S.ball([p[0], p[1] - 0.2, p[2]], [0.1, 0.24, 0.06], cloth, { res: 0.06 }); }
      }
      // one warm window low on the south face, in the gap between the two lower sails: the mill's only fire until the beacon burns
      {
        const wy = gy + 1.3, wr = rAt(wy) + 0.03;
        S.box([mx, wy, mz + wr], [0.32, 0.26, 0.09], wood, { rd: 0.03, res: 0.06 });
        ctx.lamp([mx, wy, mz + wr + 0.3], 2.4, 0.55, true);
        ctx.glow(() => {
          B.iso(mx, wy, mz + wr + 0.08, 0.13, B.P[fire[4]], 3, { em: true, nd: true, k: 7, ph: 2, sp: 1.8 });
          B.iso(mx, wy - 0.06, mz + wr + 0.08, 0.11, B.P[fire[3]], 3, { em: true, nd: true });
          B.iso(mx, wy, mz + wr + 0.3, 0.5, B.P[fire[2]], 0.18, { em: true, nd: true });
        });
      }
      // the deck: planks east of the body on four fat stilts with braces, a railing on its north and east sides, a stair up from the
      // south where the climb comes in
      const dx0 = mx + 1.5, dx1 = mx + 4.9, dz0 = mz - 1.8, dz1 = mz + 1.6, dcx = (dx0 + dx1) / 2, dcz = (dz0 + dz1) / 2, dy = Y.deck;
      for (let k = 0; k < 6; k++) {
        const z = dz0 + (k + 0.5) * (dz1 - dz0) / 6;
        slab([dcx, dy - 0.13 + B.rr(-0.02, 0.02), z], [(dx1 - dx0) / 2 + B.rr(-0.05, 0.12), 0.13, (dz1 - dz0) / 12 - 0.02], plank, { ax: yawAx(B.rr(-0.02, 0.02)), rd: 0.03, res: 0.12 });
      }
      const legs = [[dx1 - 0.35, dz0 + 0.35], [dx1 - 0.35, dz1 - 0.35], [dx0 + 0.6, dz0 + 0.35], [dx0 + 0.6, dz1 - 0.35]];
      for (const [x, z] of legs) S.tube([[x, Math.min(h(x, z), gy) - 0.5, z], [x + B.rr(-0.06, 0.06), dy - 0.2, z]], 0.27, 0.23, wood, { res: 0.1 });
      for (const [p, q] of [[0, 2], [1, 3], [0, 1]]) S.tube([[legs[p][0], gy + 0.4, legs[p][1]], [legs[q][0], dy - 0.35, legs[q][1]]], 0.1, 0.1, wood, { res: 0.08 });
      for (const [x, z] of [[dx0 + 0.3, dz0 + 0.12], [dcx, dz0 + 0.12], [dx1 - 0.12, dz0 + 0.12], [dx1 - 0.12, dcz]])
        S.tube([[x, dy - 0.1, z], [x, dy + 0.95, z]], 0.11, 0.1, wood, { res: 0.08 });
      S.tube([[dx0 + 0.3, dy + 0.85, dz0 + 0.12], [dx1 - 0.12, dy + 0.85, dz0 + 0.12], [dx1 - 0.12, dy + 0.85, dcz + 0.4]], 0.07, 0.07, wood, { res: 0.07 });
      stair([dcx + 0.5, dz1 + 3.6], [dcx + 0.5, dz1 - 0.3], { width: 1.8, rise: 0.32, yb: dy });
      // the beacon: a fat mast on the deck, braced to its corners, with an iron fire cage on top; the lamplighter lights it from the
      // deck below (the reach is 2.6 up)
      {
        const bx = dcx + 0.3, bz = dcz - 0.3, top = Y.fire - 0.35;
        S.tube([[bx, dy - 0.2, bz], [bx, top + 0.05, bz]], 0.22, 0.18, wood, { res: 0.09 });
        for (const [x, z] of [[dx1 - 0.3, dz0 + 0.3], [dx0 + 0.4, dz0 + 0.3], [dx1 - 0.3, dz1 - 0.6]])
          S.tube([[x, dy + 0.02, z], [bx + (x - bx) * 0.15, dy + 1.25, bz + (z - bz) * 0.15]], 0.07, 0.07, wood, { res: 0.07 });
        S.ball([bx, top + 0.02, bz], [0.3, 0.1, 0.3], iron, { res: 0.06 });
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2 + 0.3;
          S.tube([[bx + Math.cos(a) * 0.18, top, bz + Math.sin(a) * 0.18], [bx + Math.cos(a) * 0.46, top + 0.72, bz + Math.sin(a) * 0.46]], 0.055, 0.05, iron, { res: 0.05 });
        }
        S.torus([bx, top + 0.7, bz], 0.46, 0.055, iron, { res: 0.05 });
        S.ball([bx, top + 0.22, bz], [0.32, 0.07, 0.32], iron, { res: 0.05 });
        ctx.beacon([bx, Y.fire, bz], 1.7);
      }
      // a fire basket at the foot of the stair, so the deck and the mill's flank catch warm light from below
      basket(dcx + 2.2, dz1 + 2.4, { s: 0.85 });
      // stones round the summit (nothing tall beside the mill, so its outline stays clean)
      rock(mx - 3.2, mz - 1.8, 0.8, 21); rock(mx - 3.0, mz + 2.8, 0.55, 22); rock(mx + 7.2, mz + 2.2, 0.6, 23); rock(mx + 2.4, mz - 3.8, 0.7, 24);
    }

    /* ---- the east hill: an old cairn of stacked stones with a lantern by it, and stones to climb ---- */
    {
      const [cx, cz] = CAIRN, gy = h(cx, cz);
      S.lathe([cx, gy - 0.5, cz], 2.0, t => 1.3 - 0.45 * t, stone, { res: 0.13, maxRadius: 1.35 });
      S.box([cx + 0.1, gy + 1.65, cz], [0.75, 0.22, 0.7], stone, { ax: yawAx(0.4), rd: 0.08, res: 0.11 });
      for (let k = 0; k < 4; k++) {
        const a = 2.5 + k * 0.55, x = cx + Math.cos(a) * 1.9, z = cz + Math.sin(a) * 1.9, tp = gy + 0.42 * (k + 1), g2 = h(x, z);
        S.box([x, (tp + g2 - 0.5) / 2, z], [0.55, (tp - g2 + 0.5) / 2, 0.5], stone, { ax: yawAx(-a), rd: 0.08, res: 0.12 });
      }
      crook(cx + 1.6, cz + 1.2, -0.7, 0.2, { tall: 2.0 });
      ctx.wisp([cx, gy + 2.95, cz]); // on the cairn
    }

    /* ---- dead fen trees, rocks and reeds round the shores ---- */
    for (const [x, z, tall, s] of [[-13, 16, 3.4, 1], [13, 15.5, 3.0, 2], [-22.5, -4, 3.6, 3], [21, -9, 3.2, 5], [-14, -12, 3.8, 6], [24, 14, 3.0, 7]])
      fenTree(x, z, { tall, seed: s });
    [[-4, 14.8, 0.6], [10.4, 13.8, 0.7], [-21, 9.5, 0.9], [20.5, 7, 0.8], [-12.5, -7.5, 1.0], [14.5, -8.5, 0.9], [-24, -10, 1.2], [26, -14, 1.1]].forEach(([x, z, r], i) => rock(x, z, r, 80 + i));
    for (const [x, z, n] of [[-2, 13.2, 10], [9.5, 12.4, 9], [-14.6, 12.6, 10], [19.4, 6.4, 10], [-21.6, 1.0, 11], [-7.4, -6.6, 10], [0.6, -6.0, 9], [12.4, -5.8, 10], [0.6, 7.2, 7], [-11.4, 2.2, 8], [13.2, 0.4, 7], [2.2, 2.0, 6], [-1.6, -1.0, 6]])
      reeds(x, z, n, 0.9, 1.5);
    for (let k = 0; k < 60; k++) tufts.push([B.rr(-30, 30), B.rr(-30, 30)]);

    /* ---- the wisps out in the fen, and the start ---- */
    {
      // on the first hut's porch, round the side from its door
      const { at: [x, z], to } = HUTS[0], [wx, wz] = turn(x, z, Math.atan2(to[0] - x, to[1] - z), -1.5, 1.6);
      ctx.wisp([wx, PORCH + 1.0, wz]);
    }
    ctx.spawn([START[0], h(START[0], START[1]), START[1]], Math.PI);

    /* ---- the water: a flat dark teal sheet, laid after the walk map so it never blocks the feet ---- */
    const sy = h(START[0], START[1]), eye = [START[0], sy + EYE_UP, START[1] + EYE_BACK];
    ctx.later(() => {
      const pts = [], r = 0.3, dz = r * 0.87;
      for (let j = Math.ceil(pz0 / dz); j * dz < pz1; j++) {
        const z = j * dz, off = (((j % 2) + 2) % 2) * r * 0.5;
        for (let i = Math.ceil((px0 - off) / r); i * r + off < px1; i++) {
          const x = i * r + off;
          if (h(x, z) < W + 0.03 && S.sdf(x, W + 0.03, z) > 0.01) pts.push(x, z);
        }
      }
      // a pale scum line where the water meets the bank; the sky's haze lying on it in long level streaks, many far off and few close
      // by; and now and then a ripple
      const tex = (x, y, z) => {
        if (h(x, z) > W - 0.13 - 0.08 * B.n3(x * 1.3, z * 1.3, 7)) return wt[3];
        const far = smooth(12, 34, Math.hypot(x - eye[0], z - eye[2])), band = Math.sin(z * 2.6 + 1.3 * Math.sin(x * 0.35) + 2 * B.n3(x * 0.25, z * 0.6, 3));
        if (band > 0.93 - 0.35 * far && B.n3(x * 0.5, z * 1.8, 8) > 0.45) return far > 0.5 ? wt[3] : wt[2];
        return Math.sin(z * 5.2 + 1.7 * Math.sin(x * 0.8)) > 0.975 && B.n3(x * 0.7, z * 0.7, 5) > 0.58 ? wt[2] : undefined;
      };
      // the far water holds a little of the sky's haze, the near water is black
      const mod = (x, y, z) => 0.2 * (B.fbm(x * 0.3 + 3, z * 0.3, 0.5, 2) - 0.5) + 0.45 * smooth(14, 34, Math.hypot(x - eye[0], z - eye[2])) - 0.15;
      const water = { r: wt, mod, tex, fat: 0.62 };
      S.add({
        bc: [(px0 + px1) / 2, W - 0.3, (pz0 + pz1) / 2],
        br: Math.hypot((px1 - px0) / 2, 0.5, (pz1 - pz0) / 2),
        sd: (x, y, z) => Math.max(y - W, W - 0.6 - y, px0 - x, x - px1, pz0 - z, z - pz1),
        sample(f) { for (let k = 0; k < pts.length; k += 2) f(pts[k], W, pts[k + 1]); }
      }, water, { res: r });
    });

    /* ---- what glows: lanterns, their pools on the water, the moon's glitter, mist, reeds; then the sky, the moon by the sails ---- */
    ctx.glow(({ B }) => {
      const dk = ramp('sky')[0], mn = ramp('moon');
      // as the page's first picture sees it: the moon just left of the mill, the tip of its upper-left sail over the moon's edge, and
      // its top well under the picture's top edge (half a degree below level)
      const tip = [MILL[0] - 1.7, Y.top + 2.25 + 1.65, MILL[1] + 1.6]; // where the summit block puts that sail's tip
      const toTip = Math.atan2(tip[0] - eye[0], -(tip[2] - eye[2])), dTip = Math.hypot(tip[0] - eye[0], tip[2] - eye[2]);
      const deg = Math.PI / 180, mr = 1.75 * deg, az = toTip - 0.7 * mr, el = -3.15 * deg, D = 175, rm = D * Math.tan(mr);
      const toMill = Math.atan2(MILL[0] + 1.6 - eye[0], -(MILL[1] - eye[2])); // the middle of the mill and its deck
      const dir = (a, e) => [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
      const u = dir(az, el), M = [eye[0] + u[0] * D, eye[1] + u[1] * D, eye[2] + u[2] * D];

      // a light's reflection on the water under (x, z): a soft pool, and a broken column of level strokes running toward the eye,
      // wide and bright near the light and thinning out, as a light shows on still black water
      const glint = (x, z, cols, i, n = 7) => {
        if (h(x, z) > W - 0.05) return;
        B.disc(x, W + 0.12, z, B.UP, 1.0, 0.02, B.P[cols[0]], 0.3, { em: true, nd: true });
        B.disc(x, W + 0.13, z, B.UP, 0.4, 0.02, B.P[cols[0]], 1.1, { em: true, nd: true });
        const tx = eye[0] - x, tz = eye[2] - z, tl = Math.hypot(tx, tz), across = [-tz / tl, 0, tx / tl];
        for (let k = 0; k < n; k++) {
          const d = 0.25 + k * 0.5 + B.rr(-0.08, 0.08), px = x + tx / tl * d, pz = z + tz / tl * d;
          if (h(px, pz) > W - 0.05) break;
          B.axial(px + across[0] * B.rr(-0.06, 0.06), W + 0.14, pz + across[2] * B.rr(-0.06, 0.06), across, 0.34 - k * 0.035, 0.045, B.P[cols[k < 2 ? 1 : 0]], 1.5,
            { em: true, nd: true, k: 6, ph: k + i, sp: 1.3, rg: 0.04 });
        }
      };
      // each lantern: a bright glass, a soft halo, and its reflection on the water under it
      lamps.forEach(([x, y, z], i) => {
        B.iso(x, y, z, 0.17, B.P[lan[2]], 3, { em: true, nd: true, k: 6, ph: i * 0.7, sp: 3, rg: 0.01 });
        B.iso(x, y - 0.1, z, 0.15, B.P[lan[1]], 3, { em: true, nd: true });
        B.iso(x, y, z, 1.0, B.P[lan[0]], 0.24, { em: true, nd: true, k: 7, ph: i, sp: 2.4 });
        if (y - W < 4) glint(x, z, [lan[0], lan[1]], i);
      });
      // the fires low over the water throw a warm column on it too
      for (const [x, z] of fireGlints) glint(x, z, [fire[1], fire[2]], 3, 8);
      // the moon's glitter: short bright strokes on the water, in a band that runs from under the moon toward the start
      for (let k = 0; k < 90; k++) {
        const t = B.rr(17, 44), wob = (B.rr(-1, 1) + B.rr(-1, 1)) * 0.5 * (0.6 + t * 0.045);
        const x = eye[0] + Math.sin(az) * t + Math.cos(az) * wob, z = eye[2] - Math.cos(az) * t + Math.sin(az) * wob;
        if (h(x, z) > W - 0.1 || S.sdf(x, W + 0.1, z) < 0.05) continue;
        const c = Math.abs(wob) < 0.5 && B.rr(0, 1) < 0.5 ? mn[1] : B.pick([mn[0], mn[0], sk[3], wt[3]]);
        B.axial(x, W + 0.13, z, [Math.cos(az), 0, Math.sin(az)], B.rr(0.25, 0.6), 0.07, B.P[c], 2, { em: true, nd: true, k: 6, ph: B.rr(0, 6), sp: B.rr(0.8, 1.6), rg: 0.05 });
      }
      // reeds: each blade three long dabs, darker at the foot; some carry a dark head
      for (const [x, z, n, spread, tall] of reedBeds) {
        const gy = Math.max(h(x, z), W);
        for (let k = 0; k < n; k++) {
          const a = B.rr(0, Math.PI * 2), d = Math.sqrt(B.rr(0, 1)) * spread, bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
          const lx = Math.cos(a) * B.rr(0.1, 0.35), lz = Math.sin(a) * B.rr(0.1, 0.35), L = tall * B.rr(0.6, 1.1);
          for (let s = 0; s < 3; s++) {
            const t = (s + 0.5) / 3, bend = t * t;
            const p = [bx + lx * bend * L, gy + t * L, bz + lz * bend * L], dr = unit([lx * 2 * t, 1, lz * 2 * t]);
            B.stick(p[0], p[1], p[2], dr, L / 6 + 0.03, 0.05 * (1.1 - t * 0.6), B.P[s === 0 ? moss[1] : s === 1 ? st[0] : st[1]], 3);
          }
          if (k % 4 === 0) B.stick(bx + lx * L * 0.8, gy + L * 0.86, bz + lz * L * 0.8, [0, 1, 0], 0.13, 0.065, B.P[mud[1]], 3);
        }
      }
      // grass tufts on the dry ground
      for (const [x, z] of tufts) {
        const gy = h(x, z);
        if (gy < W + 0.3) continue;
        for (let k = 0; k < 4; k++) {
          const a = B.rr(0, Math.PI * 2), L = B.rr(0.16, 0.32);
          B.stick(x + Math.cos(a) * 0.1, gy + L * 0.45, z + Math.sin(a) * 0.1, unit([Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5]), L * 0.5, 0.035, B.P[B.pick([moss[1], moss[2], st[0]])], 3);
        }
      }
      // mist: long flat soft dabs lying low on the water, thicker toward the north shore, drifting
      for (let i = 0; i < 70; i++) {
        const x = B.rr(-24, 22), z = B.rr(-8, 15);
        if (h(x, z) > W + 0.2) continue;
        const far = smooth(12, -6, z);
        B.axial(x, W + B.rr(0.2, 0.8), z, [1, 0, B.rr(-0.2, 0.2)], B.rr(2.2, 4.2), B.rr(0.35, 0.6), B.P[far > 0.5 ? sk[3] : B.pick([sk[3], sk[2]])], 0.16 + 0.22 * far, { em: true, nd: true, k: 6, ph: B.rr(0, 6), sp: B.rr(0.12, 0.3), rg: B.rr(0.3, 0.6) });
      }
      // a thicker bank of it along the north shore, so the summit's foot stands in haze, apart from the fen in front of it
      // (in drifts, with gaps between them, not one even sheet)
      for (let i = 0; i < 56; i++) {
        const x = B.rr(-16, 15), z = B.rr(-8, -4.5);
        if (B.n3(x * 0.16 + 4, z * 0.3, 11) < 0.42) continue;
        B.axial(x, W + B.rr(0.3, 1.2), z, [1, 0, B.rr(-0.15, 0.15)], B.rr(2.0, 3.6), B.rr(0.45, 0.75), B.P[sk[3]], B.rr(0.24, 0.4), { em: true, nd: true, k: 6, ph: B.rr(0, 6), sp: B.rr(0.1, 0.2), rg: B.rr(0.3, 0.6) });
      }
      // marsh lights: a very few sick specks drifting low over the water
      lib.motes(B, 8, [-22, 20, W + 0.3, W + 1.4, -6, 10], [lan[0], lan[1]], 0.03);

      // the sky
      B.sky(d => (d[1] < 0.03 ? sk[1] : d[1] < 0.14 ? sk[0] : dk), 230);
      // the haze: level strokes in staggered rows (round dabs stacked in columns read as searchlights). Sick olive round the moon; a
      // lighter teal spread wide behind the mill and its deck, so the summit stands black against it and the pale sails read too;
      // nothing past that (the dome is already the teal of the low sky). Its edges are ragged, not a ruled band
      for (let j = 0; j < 22; j++) {
        const e = -0.15 + j * 0.0072;
        if (smooth(-0.155, -0.1, e) < B.rr(0, 1)) continue;
        for (let i = -26; i <= 26; i++) {
          const a = toMill + (i + (j % 2) * 0.5) * 0.024 + B.rr(-0.006, 0.006);
          const dm = Math.hypot((a - az) * 0.6, e - el) / mr + B.rr(-0.9, 0.9);
          const dh = Math.hypot((a - toMill) * 0.7, (e + 0.065) * 1.5) / mr + B.rr(-0.9, 0.9);
          const c = dm < 2.5 || dh < 1.9 ? sk[3] : dm < 4.4 || dh < 4.6 ? sk[2] : null;
          if (c === null || e > -0.014 + B.rr(-0.01, 0.006)) continue;
          const p = dir(a, e), R = 185;
          B.axial(eye[0] + p[0] * R, eye[1] + p[1] * R, eye[2] + p[2] * R, [Math.cos(a), 0, Math.sin(a)], R * 0.02, R * 0.0042, B.P[c], 1.6, { em: true, nd: true });
        }
      }
      // the disc, laid flat to the eye: dim yellow, with darker seas
      const rt = B.norm([-u[2], 0, u[0]]), up = cross(rt, u);
      const sp = rm * 0.15;
      for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
        const a = (i + (j % 2) * 0.5) * sp, b = j * sp * 0.87;
        if (a * a + b * b > rm * rm * 0.92) continue;
        const sea = B.n3(a / rm * 1.7 + 2, b / rm * 1.7 + 6, 3) > 0.55 || (a - rm * 0.25) ** 2 + (b + rm * 0.2) ** 2 < (rm * 0.3) ** 2;
        B.iso(M[0] + rt[0] * a + up[0] * b, M[1] + rt[1] * a + up[1] * b, M[2] + rt[2] * a + up[2] * b, sp * 0.62, B.P[sea ? mn[0] : mn[1]], 3, { em: true, nd: true });
      }
      // a dim ring of glow round it
      B.iso(M[0] - u[0] * 4, M[1] - u[1] * 4, M[2] - u[2] * 4, rm * 2.2, B.P[sk[3]], 0.3, { em: true, nd: true });
      // long thin bars of dark cloud lying across the haze, at different heights, so the sky has layers in front of the light
      for (const [ea, len, da] of [[-2.0, 9, -0.12], [-4.6, 13, 0.06], [-6.2, 7, -0.2]]) {
        const e = ea * deg;
        for (let k = 0; k < len; k++) {
          const a = toMill + da + (k - len / 2) * 0.022, p = dir(a, e + Math.sin(k * 1.3) * 0.002), R = 182;
          B.axial(eye[0] + p[0] * R, eye[1] + p[1] * R, eye[2] + p[2] * R, [Math.cos(a), 0, Math.sin(a)], R * 0.016, R * 0.0028, B.P[sk[0]], 2, { em: true, nd: true });
        }
      }
      // two thin dark lines of cloud across its lower half
      for (const [yy, x0, n] of [[-0.35, -3, 5], [-0.62, -1, 4]]) {
        const c = [M[0] + up[0] * rm * yy - u[0] * 4, M[1] + up[1] * rm * yy - u[1] * 4, M[2] + up[2] * rm * yy - u[2] * 4];
        for (let k = x0; k < x0 + n; k++)
          B.axial(c[0] + rt[0] * k * rm * 0.6, c[1] + Math.sin(k * 1.9) * rm * 0.03, c[2] + rt[2] * k * rm * 0.6, rt, rm * 0.42, rm * 0.04, B.P[sk[0]], 2.2, { em: true, nd: true });
      }
      // stars, high up only, few
      for (let i = 0; i < 55; i++) {
        const a = B.rr(0, Math.PI * 2), e = B.rr(0.22, 1.2), r = 225;
        B.iso(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, B.rr(0.25, 0.42), B.P[B.pick([sk[2], sk[3], mn[0]])], 3, { em: true, nd: true });
      }
      // torn cloud low over the hills
      for (let i = 0; i < 18; i++) {
        const a = -1.5 + i * 0.17 + B.rr(-0.05, 0.05), e = 0.1 + B.rr(0, 0.16), r = 215;
        const p = [Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r, -Math.cos(a) * Math.cos(e) * r];
        B.axial(p[0], p[1], p[2], [Math.cos(a), 0, Math.sin(a)], B.rr(10, 18), B.rr(1.4, 2.4), B.P[sk[B.pick([0, 1])]], 0.8, { em: true, nd: true });
      }
    });
  }
};
