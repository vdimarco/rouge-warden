// Crow Ramparts: a broken curtain wall that rides the ridges of rolling downs at the last light of a storm. Squat round towers stand at
// its bends, rubble heaps and a breach let you climb onto the wall-walk, braziers burn along it, blood-red rags hang from poles and
// battlements, and the siege's leavings lie in the vale below. The highest tower holds the summit; steps wind up round it to the beacon.
// Storm-violet sky over a thin sick yellow-green band, pale stone in violet shadow, dark olive grass, red rags, orange fire.
import { torch, brazier, stakes, rocks, shrubs, deadTree, yawAx } from '../lib/props.mjs';
import { polyDist, lib } from '../lib/common.mjs';

const SPAWN = [0, 27];
const C = [-6, -21]; // the summit tower
const TR = 3.0; // its radius
const T1 = [8, 17], T2 = [13, -1], T3 = [4, -12];
// the curtain wall, south to north; towers stand at T1, T2 and T3, and it ends at the foot of the summit steps
const WALL = [[19, 33.5], T1, [12, 7], T2, [10, -7], T3, [-1.4, -20.6]];
// the wall goes on west from the summit tower, broken, down the far slope and away over the far downs
const WEST = [[-9.4, -23.4], [-19, -27.5], [-31, -29.5]];
const FAR_W = [[-31, -29.5], [-46, -33], [-62, -27], [-80, -31]];
const FAR_E = [[19, 33.5], [30, 44], [44, 50], [60, 47]];
// the chalk path from the start down through the vale to the foot of the summit steps, and a spur to the rubble below T1
const PATH = [[0, 27], [-1.2, 21], [-2.6, 14], [-1.8, 7], [-3.6, 0], [-3, -7], [-5.5, -12.5], [-9.2, -16.6]];
const SPUR = [[0.4, 24.6], [3.2, 19.5], [3.4, 14.5]];

// the ridge the wall rides: a chain of bumps along it, each its own height, so the ridge rolls
const RIDGE = [[17, 30, 7, 1.0], [12.5, 22.5, 7, 1.0], [9, 16.5, 7, 1.15], [10.8, 11, 7, 1.35], [12.4, 5, 7, 1.55], [13.4, -0.5, 7, 1.7],
  [12, -4.5, 6, 0.9], [7, -9.5, 6, 0.95], [4, -12, 7, 1.35], [0.5, -16.5, 6, 0.9]];

export default {
  id: 'ramparts',
  name: 'Crow Ramparts',
  sub: 'A broken wall rides the downs as the storm light dies',
  hint: 'Walk the wall to the high tower. Light the beacon.',
  seed: 23,
  palette: [
    ['sky', [0x050408]],
    ['skyband', [0x0e0b16, 0x18142a, 0x262036]],
    ['sick', [0x2c301e, 0x48502a, 0x6c7834]],
    ['fog', [0x221e30]],
    ['ink', [0x030205]],
    ['shade', [0x050407]],
    ['grass', [0x0a0c07, 0x12170b, 0x1c2311, 0x293018, 0x3b4222]],
    ['chalk', [0x17141d, 0x29242f, 0x3e3846]],
    ['stone', [0x0f0d17, 0x1d192a, 0x302a40, 0x48405c, 0x6a6280]],
    ['sunstone', [0x3c2c30, 0x6a4e46, 0x987456]],
    ['wood', [0x120b08, 0x261911, 0x3f2c1d]],
    ['rag', [0x2a0507, 0x560d0d, 0x8a1814]]
  ],
  // the sun is all but down in the west-north-west: weak, warm, low; it rims the west faces and leaves the rest in violet shadow
  light: { sun: [-0.8, 0.28, -0.45], amb: 0.1, sky: 0.15, sunK: 0.4, shK: 8 },
  fog: { color: 'fog', far: 70, start: 0.42, max: 0.85 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 34 },
  hills: {
    base: 0,
    bumps: [
      [0, 30, 14, 4.4], // the start's down
      ...RIDGE,
      [-6, -21, 12, 2.6], // the summit's hill
      [-17, 3, 11, 2.8], [-17, 21, 9, 1.8], // the west downs
      [-24, -14, 9, 1.6], [24, 16, 9, 1.4], [27, -16, 10, 2.0]
    ],
    pits: [[-3, 3, 13, 1.4], [0, -88, 56, 9]], // the vale, and the far lowland north of the summit
    fbm: { amp: 0.45, freq: 1 / 11, oct: 3 },
    warp: { amp: 1.5, freq: 1 / 24 },
    far: { amp: 8, start: 36, end: 66 },
    flats: [{ at: SPAWN, r: 2.2, blend: 2.5 }, { at: C, r: 6.2, blend: 3 }],
    paths: [{ pts: PATH, w: 2.2, depth: 0.14 }, { pts: SPUR, w: 1.8, depth: 0.1 }],
    box: [-110, 110, -110, 110]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
    const grit = (k = 1) => (x, y, z) => k * (0.16 * (B.n3(x * 0.45, z * 0.45, y * 0.3 + 3) - 0.5) + 0.14 * (B.n3(x * 2.6, y * 2.6, z * 2.6) - 0.5));
    const grass = ramp('grass'), chalk = ramp('chalk'), st = ramp('stone');
    const ground = {
      r: grass, g: [grass[1]], mod: grit(1),
      rf: (x, z) => null,
    };
    ground.rf = (x, y, z) => (Math.min(polyDist(x, z, PATH) - 0.6, polyDist(x, z, SPUR) - 0.4) + 0.5 * (B.n3(x * 1.3, z * 1.3, 4) - 0.5) < 0.4 ? chalk : grass);
    ctx.terrain(ground, { near: 24, res: 0.25, rings: [[50, 0.5, { r: grass, mod: grit(1.2), fat: 0.62 }], [104, 1.1, { r: grass, mod: grit(1.4), fat: 0.8 }]] });

    const stone = { r: st, s: ramp('sunstone'), g: [st[1]], mod: grit(0.8), top: { min: 0.99, r: grass.slice(1, 4) } };
    const cap = { r: st, s: ramp('sunstone'), g: [st[1]], mod: grit(0.7) };
    const dark = { r: st.slice(0, 3), mod: grit(0.6) };
    const wood = { r: ramp('wood'), g: [ramp('wood')[1]], mod: grit(0.5) };
    const iron = { r: ramp('iron') };
    const cloth = { r: ramp('rag'), g: [ramp('rag')[1]], mod: grit(0.6) };
    const black = { r: [st[0], ramp('sky')[0]] };

    /* ---- the curtain wall ---- */
    const spawnY = h(SPAWN[0], SPAWN[1]);
    const W = curtain(ctx, WALL, {
      mat: stone, cap, height: 2.7, thick: 2.6, side: 1,
      breaks: [[sAt(WALL, [10, -7]) - 2.4, sAt(WALL, [10, -7]) + 2.2]],
      open: [[sAt(WALL, [9.6, 13.6]) - 1.5, sAt(WALL, [9.6, 13.6]) + 1.5]],
      towers: [T1, T2, T3], pillars: true
    });
    // squat round towers at the bends; their roofs a step above the walk
    const towerAt = (p, o) => {
      const s = sAt(WALL, p), roof = W.walkAt(s) + 0.35;
      const ins = WALL.indexOf(p), a = WALL[ins - 1], b = WALL[ins + 1];
      const gaps = [Math.atan2(a[1] - p[1], a[0] - p[0]), Math.atan2(b[1] - p[1], b[0] - p[0])];
      squatTower(ctx, p[0], p[1], { mat: stone, cap, r: 2.6, roof, gaps, ...o });
      return roof;
    };
    const r1 = towerAt(T1, { broken: 1.6 });
    const r2 = towerAt(T2, {});
    const r3 = towerAt(T3, {});
    brazier(ctx, T1[0] - 1.0, T1[1] + 0.9, { iron, y: r1 - 0.05 });
    brazier(ctx, T2[0] - 0.6, T2[1] + 1.2, { iron, y: r2 - 0.05 });
    brazier(ctx, T3[0] + 0.4, T3[1] + 1.3, { iron, y: r3 - 0.05 });

    // the rubble heap that climbs from the vale onto the walk just north of T1
    {
      const s = sAt(WALL, [9.6, 13.6]), p = W.M.at(s), side = W.sideAt(s);
      const top = [p.x + side[0] * 1.2, p.z + side[1] * 1.2], foot = [p.x + side[0] * 8.5, p.z + side[1] * 8.5];
      rubbleStair(ctx, foot, top, W.walkAt(s) - 0.02, { mat: stone, width: 2.6, seed: 3 });
      torch(ctx, foot[0] + 1.6, foot[1] + 0.6, { wood, iron, h: 1.8 });
    }
    // the breach: the wall knocked down, its stones heaped both ways so you can climb through and back up
    {
      const s0 = sAt(WALL, [10, -7]) - 2.4, s1 = sAt(WALL, [10, -7]) + 2.2;
      breach(ctx, W, s0, s1, { mat: stone });
    }

    /* ---- the summit tower, with steps that wind up round it ---- */
    const G0 = h(C[0], C[1]);
    const roof = spawnY + 1.9;
    {
      const height = roof - (G0 - 1);
      S.lathe([C[0], G0 - 1, C[1]], height, t => TR * (1.16 - 0.16 * smooth(0, 0.32, t)), stone, { res: 0.15, maxRadius: TR * 1.16 });
      // a fat corbel ring under the crown
      S.lathe([C[0], roof - 0.55, C[1]], 0.5, TR + 0.28, cap, { res: 0.12 });
      // the steps: the walk's end drops onto them a little under its own height
      const rise = 0.36, n = Math.ceil((roof - G0) / rise), rr = (roof - G0) / n, da = 0.3;
      const last = WALL[WALL.length - 1], aArr = Math.atan2(last[1] - C[1], last[0] - C[0]);
      const kArr = Math.max(2, Math.round((W.walkAt(W.M.len) - 0.25 - G0) / rr) - 1);
      const a0 = aArr + kArr * da;
      for (let i = 0; i < n; i++) {
        const a = a0 - i * da, cx = C[0] + Math.cos(a) * (TR + 0.95), cz = C[1] + Math.sin(a) * (TR + 0.95), tread = G0 + (i + 1) * rr;
        let lo = 1e9;
        for (const [u, v] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) lo = Math.min(lo, h(cx + Math.cos(a) * u + Math.sin(a) * v * 0.6, cz + Math.sin(a) * u - Math.cos(a) * v * 0.6));
        const y0 = Math.min(lo, tread) - 0.6, hy = (tread - y0) / 2;
        S.box([cx, y0 + hy, cz], [0.64, hy, 1.05], stone, { ax: yawAx(Math.atan2(-Math.cos(a), -Math.sin(a))), rd: 0.06, res: 0.13 });
      }
      const aTop = a0 - (n - 1) * da;
      // merlons round the crown, open where the steps arrive
      const m = 12;
      for (let i = 0; i < m; i++) {
        const a = (i / m) * Math.PI * 2;
        if (Math.cos(a - aTop) > 0.86) continue;
        S.box([C[0] + Math.cos(a) * (TR - 0.05), roof + 0.38, C[1] + Math.sin(a) * (TR - 0.05)], [0.42, 0.42, 0.34], cap, { ax: yawAx(-a), rd: 0.07, res: 0.1 });
      }
      // fire bowls on two merlons, so the crown shows from the far end of the downs
      for (const da2 of [2.1, -2.3]) {
        const a = aTop + da2, x = C[0] + Math.cos(a) * (TR - 0.05), z = C[1] + Math.sin(a) * (TR - 0.05);
        S.ball([x, roof + 0.92, z], [0.36, 0.16, 0.36], iron, { res: 0.05 });
        ctx.fire([x, roof + 1.0, z], 0.8, { r: 5 });
      }
      // the beacon's cradle: a stone drum with an iron rim, in the middle of the roof
      S.lathe([C[0], roof - 0.1, C[1]], 0.55, t => 0.75 - 0.12 * t, cap, { res: 0.08, maxRadius: 0.75 });
      S.torus([C[0], roof + 0.47, C[1]], 0.62, 0.07, iron, { res: 0.04 });
      ctx.beacon([C[0], roof + 0.55, C[1]], 1.6);
      // a tall pole with a red rag, the place's flag
      ragPole(ctx, C[0] + Math.cos(aTop + 3.6) * 1.7, C[1] + Math.sin(aTop + 3.6) * 1.7, { wood, cloth, iron, y: roof, h: 3.2, len: 1.9, yaw: 0.4 });
      // braziers at the foot of the steps
      const af = a0 + 0.35;
      brazier(ctx, C[0] + Math.cos(af) * (TR + 2.4), C[1] + Math.sin(af) * (TR + 2.4), { iron });
    }
    // the wall west of the summit tower, broken, falling away down the far slope
    curtain(ctx, WEST, { mat: stone, cap, height: 2.4, thick: 2.2, side: -1, breaks: [[6, 9.5], [17, 19]], res: 0.16 });
    squatTower(ctx, -31, -29.5, { mat: stone, cap, r: 2.3, roof: h(-31, -29.5) + 3.4, broken: 1.8, gaps: [] });

    /* ---- the west downs: a tower stump and a stretch of wall on the rise ---- */
    {
      const sx = -16, sz = 3, top = h(sx, sz) + 2.5;
      squatTower(ctx, sx, sz, { mat: stone, cap, r: 2.2, roof: top, broken: 1.4, gaps: [0.2] });
      rubbleStair(ctx, [sx + 7.2, sz + 1.8], [sx + 1.8, sz + 0.6], top - 0.02, { mat: stone, width: 2.2, seed: 9 });
      curtain(ctx, [[sx - 1.5, sz - 1.5], [-22, -6], [-25, -12]], { mat: stone, cap, height: 2.3, thick: 2.2, side: 1, breaks: [[5.5, 8]] });
      ragPole(ctx, sx - 0.4, sz - 0.6, { wood, cloth, iron, y: top, h: 2.6, len: 1.6, yaw: 1.2 });
      deadTree(ctx, -11, 9, { bark: wood, h: 3.6, seed: 2 });
    }

    /* ---- the vale: what the siege left ---- */
    cart(ctx, 2.2, 2.5, 0.5, { wood, iron });
    torch(ctx, -0.6, 4.6, { wood, iron, h: 1.9 });
    stakes(ctx, [5, -2], [6.5, 6], { wood, n: 9, h: 1.4 });
    stakes(ctx, [3, -9], [6, -4.5], { wood, n: 7, h: 1.3 });
    stakes(ctx, [-8, -6], [-9.5, 1], { wood, n: 7, h: 1.2 });
    ladder(ctx, [5.8, -7.6], [9.8, -3.6], { wood, broken: true }); // fallen by the breach
    ragPole(ctx, -5.6, 8.5, { wood, cloth, iron, h: 3.4, len: 1.8, yaw: 0.3 });
    ragPole(ctx, -3.4, 23.2, { wood, cloth, iron, h: 3.0, len: 1.5, yaw: -0.4 });
    ragPole(ctx, 8.6, -5.4, { wood, cloth, iron, h: 2.8, len: 1.4, yaw: 0.9 });
    deadTree(ctx, 6.5, 22.5, { bark: wood, h: 3.0, seed: 5 });
    deadTree(ctx, -12, -10, { bark: wood, h: 3.4, seed: 7 });
    rocks(ctx, [[-6, 17, 0.8], [4.5, 9, 0.6], [-9, -3, 0.9], [1, -4, 0.55], [-1.5, -14, 0.7], [-13, 14, 1.0], [6, 25, 0.7],
      [-20, -6, 1.1], [16, 12, 0.8], [20, -6, 1.0], [-2, 31, 0.9], [11, 26, 0.8], [-26, 8, 1.3], [24, 4, 1.2]], { mat: cap, seed: 4 });
    shrubs(ctx, [[-4.5, 19, 0.6], [3, 14, 0.5], [-7, 3, 0.7], [0.5, -10, 0.5], [-11, -16, 0.6], [-14, 19, 0.7], [14, 20, 0.6], [17, -10, 0.6]],
      { mat: { r: grass.slice(0, 4), mod: grit(1) } });

    /* ---- far ruins on the far downs, dark against the fog ---- */
    curtain(ctx, FAR_W, { mat: dark, height: 3, thick: 2.4, side: 1, res: 0.3, merlon: false, breaks: [[22, 27]] });
    curtain(ctx, FAR_E, { mat: dark, height: 3, thick: 2.4, side: 1, res: 0.3, merlon: false });
    squatTower(ctx, -46, -33, { mat: dark, r: 2.6, roof: h(-46, -33) + 4.5, broken: 2, gaps: [], res: 0.3 });
    squatTower(ctx, 44, 50, { mat: dark, r: 2.6, roof: h(44, 50) + 4.2, gaps: [], res: 0.3 });
    squatTower(ctx, 34, -46, { mat: dark, r: 2.4, roof: h(34, -46) + 5, broken: 2.2, gaps: [], res: 0.3 });

    /* ---- crows on the battlements ---- */
    const beak = { r: [ramp('iron')[0]] };
    crow(ctx, T2[0] + 2.2, r2 + 0.78, T2[1] + 0.8, -2.2, black, beak);
    crow(ctx, T3[0] - 1.9, r3 + 0.78, T3[1] + 1.5, 2.8, black, beak);
    crow(ctx, C[0] + 2.1, roof + 0.82, C[1] + 2.1, 2.4, black, beak);

    /* ---- rags on the battlements: hung after the walk map, so they never block the feet ---- */
    ctx.later(() => {
      for (const p of [[11.2, 9.5], [12.9, 3.2], [8.2, -9.6], [0.8, -16.5]]) {
        const s = sAt(WALL, p), q = W.M.at(s), sd = W.sideAt(s), y = W.walkAt(s) + 0.55;
        const bx = q.x + sd[0] * 1.36, bz = q.z + sd[1] * 1.36;
        rag(ctx, [bx - q.dx * 0.7, bz - q.dz * 0.7], [bx + q.dx * 0.7, bz + q.dz * 0.7], y, { mat: cloth, len: 2.2, n: 4 });
      }
    });

    /* ---- the start, the wisps ---- */
    ctx.spawn([SPAWN[0], spawnY, SPAWN[1]], Math.PI);
    ctx.wisp([T2[0] + 0.6, r2 + 1.0, T2[1] - 0.6]); // on T2's roof
    ctx.wisp([-16, h(-16, 3) + 2.5 + 1.0, 3]); // on the west stump
    ctx.wisp([10.2, h(10.2, -7) + 1.1, -7]); // down in the breach
    ctx.wisp([20, h(20, -2) + 1.0, -2]); // outside the wall, under T2
    ctx.wisp([-24.5, h(-24.5, -27) + 1.0, -27]); // behind the summit, by the broken west wall

    /* ---- sky: storm violet overhead, the sick band at the horizon, the sun going down red in the west ---- */
    ctx.glow(({ B }) => {
      const sk = ramp('skyband'), sick = ramp('sick'), f = ramp('fire'), sun = ramp('sunstone');
      B.sky(d => (d[1] < 0.0 ? sick[0] : d[1] < 0.07 ? sk[2] : d[1] < 0.2 ? sk[1] : d[1] < 0.4 ? sk[0] : ramp('sky')[0]), 150);
      // the band: long low splats just over the horizon, brightest in a thin line
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * Math.PI * 2, r = 140;
        for (const [el, sz, c, al] of [[0.004, 1.6, sick[1], 0.9], [0.012, 0.8, sick[2], 0.9], [0.03, 1.4, sk[2], 0.7]]) {
          const ce = Math.cos(el + B.rr(-0.004, 0.004));
          B.axial(Math.sin(a) * ce * r, Math.sin(el) * r, -Math.cos(a) * ce * r, [Math.cos(a), 0, Math.sin(a)], 4.4, sz, B.P[c], al, { em: true, nd: true });
        }
      }
      // storm cloud: dark bars across the band and above it, a few lit red-brown from below by the sun
      for (let i = 0; i < 46; i++) {
        const a = B.rr(0, Math.PI * 2), el = B.rr(0.035, 0.26), r = 132, ce = Math.cos(el);
        const lit = Math.cos(a - (-0.7)) > 0.6 && el < 0.12;
        B.axial(Math.sin(a) * ce * r, Math.sin(el) * r, -Math.cos(a) * ce * r, [Math.cos(a), 0, Math.sin(a)], B.rr(10, 22), B.rr(1.4, 3.2),
          B.P[lit ? sun[0] : sk[B.pick([0, 0, 1])]], 0.85, { em: true, nd: true });
      }
      // the sun, low in the west-north-west, half in the band
      const sd = [-0.64, 0.012, -0.768], sr = 138;
      B.iso(sd[0] * sr, sd[1] * sr, sd[2] * sr, 3.2, B.P[f[2]], 3, { em: true, nd: true });
      B.iso(sd[0] * sr, sd[1] * sr, sd[2] * sr, 11, B.P[sun[0]], 0.45, { em: true, nd: true });
      // ash on the wind
      lib.motes(B, 110, [-30, 30, 0.3, 8, -30, 30], [sk[2], st[3]], 0.03);
    });
  }
};

/* ---------------- helpers: lines, frames ---------------- */
function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
// a polyline measured: its length, and the point and heading at a distance s along it
function measure(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1];
  const at = s => {
    let i = 1;
    while (i < pts.length - 1 && cum[i] < s) i++;
    const a = pts[i - 1], b = pts[i], l = cum[i] - cum[i - 1], t = Math.max(0, Math.min(1, (s - cum[i - 1]) / l));
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / l, dz: (b[1] - a[1]) / l };
  };
  return { cum, len, at };
}
// how far along the line the point nearest p is
function sAt(pts, p) {
  const M = measure(pts);
  let best = 1e9, bs = 0;
  for (let s = 0; s <= M.len; s += 0.05) { const q = M.at(s), d = Math.hypot(q.x - p[0], q.z - p[1]); if (d < best) { best = d; bs = s; } }
  return bs;
}
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a frame whose x runs along u, its y as near up as it can be, turned by roll about u
function frameAlong(u, roll = 0) {
  const U = norm3(u), W0 = norm3(cross(U, [0, 1, 0])), V0 = cross(W0, U);
  const c = Math.cos(roll), s = Math.sin(roll);
  const V = [V0[0] * c + W0[0] * s, V0[1] * c + W0[1] * s, V0[2] * c + W0[2] * s];
  const W = [W0[0] * c - V0[0] * s, W0[1] * c - V0[1] * s, W0[2] * c - V0[2] * s];
  return [U, V, W];
}

/* ---------------- the curtain wall ----------------
   Blocks along a polyline. The walk on top follows the ground smoothed along the line plus `height`, so it rolls with the ridge in steps
   a foot can take. Merlons stand along one edge only (side +1: the left of the line's direction), so the walk stays wide. `open` lists
   stretches [s0, s1] with no merlons (where rubble comes up), `breaks` stretches with no wall. Round pillars fill the bends. */
function curtain(ctx, pts, o) {
  const { S, h, B } = ctx;
  const { mat, cap, height = 2.7, thick = 2.6, seg = 1.5, breaks = [], open = [], side = 1, res = 0.15, merlon = true, towers = [], pillars = false } = o;
  const M = measure(pts), n = Math.max(2, Math.ceil(M.len / 0.5)), ds = M.len / n;
  let sm = [];
  for (let i = 0; i <= n; i++) { const p = M.at(i * ds); sm.push(h(p.x, p.z)); }
  for (let pass = 0; pass < 3; pass++) {
    const k = Math.max(1, Math.round(2.5 / ds)), out = [];
    for (let i = 0; i <= n; i++) { let a = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(n, i + k); j++) { a += sm[j]; c++; } out.push(a / c); }
    sm = out;
  }
  const walkAt = s => { const f = Math.max(0, Math.min(n, s / ds)), i = Math.min(n - 1, Math.floor(f)), t = f - i; return sm[i] + (sm[i + 1] - sm[i]) * t + height; };
  const sideAt = s => { const q = M.at(s); return [q.dz * side, -q.dx * side]; };
  const inR = (s, L) => L.some(([a, b]) => s > a && s < b);
  const nearTower = (x, z, pad) => towers.some(t => Math.hypot(x - t[0], z - t[1]) < 2.6 + pad);
  for (let e = 0; e < pts.length - 1; e++) {
    const s0 = M.cum[e], s1 = M.cum[e + 1], ns = Math.max(1, Math.round((s1 - s0) / seg));
    const a = pts[e], b = pts[e + 1], dx = (b[0] - a[0]) / (s1 - s0), dz = (b[1] - a[1]) / (s1 - s0);
    const yaw = Math.atan2(dx, dz) + Math.PI / 2, ax = yawAx(yaw);
    const nx = dz * side, nz = -dx * side;
    for (let i = 0; i < ns; i++) {
      const sa = s0 + (s1 - s0) * i / ns, sb = s0 + (s1 - s0) * (i + 1) / ns, smid = (sa + sb) / 2;
      if (inR(smid, breaks)) continue;
      const x = a[0] + dx * (smid - s0), z = a[1] + dz * (smid - s0), top = walkAt(smid), hl = (sb - sa) / 2;
      let lo = 1e9;
      for (const [u, v] of [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]]) lo = Math.min(lo, h(x + dx * u * hl + nx * v * thick / 2, z + dz * u * hl + nz * v * thick / 2));
      const y0 = lo - 0.7, hy = (top - y0) / 2;
      S.box([x, y0 + hy, z], [hl + 0.04, hy, thick / 2], mat, { ax, rd: 0.08, res });
      // merlons: chunky teeth along the one edge, some fallen, none where rubble comes up or a tower stands
      if (merlon) for (const f of [-0.5, 0.5]) {
        const sm2 = smid + f * hl, mx = a[0] + dx * (sm2 - s0) + nx * (thick / 2 - 0.27), mz = a[1] + dz * (sm2 - s0) + nz * (thick / 2 - 0.27);
        if (inR(sm2, open) || inR(sm2, breaks.map(([p, q]) => [p - 0.6, q + 0.6])) || nearTower(mx, mz, 0.3) || B.rr(0, 1) < 0.14) continue;
        const mh = 0.4 * (B.rr(0, 1) < 0.2 ? 0.6 : 1);
        S.box([mx, walkAt(sm2) + mh, mz], [hl * 0.36, mh, 0.27], cap || mat, { ax, rd: 0.06, res: Math.min(res, 0.12) });
      }
    }
    // a round pillar at each inner bend, where two runs of blocks meet
    if (pillars && e > 0 && !towers.some(t => t[0] === a[0] && t[1] === a[1]) && !inR(s0, breaks)) {
      const top = walkAt(s0);
      S.lathe([a[0], h(a[0], a[1]) - 0.8, a[1]], top - h(a[0], a[1]) + 0.8, thick / 2 + 0.15, mat, { res });
    }
  }
  return { M, walkAt, sideAt, thick };
}

/* ---------------- a squat round tower ----------------
   Battered at the foot, a fat corbel ring under the crown, merlons round the rim except where walls join (gaps: angles). roof is its
   flat top's height. broken: a bite out of the crown on the side away from the start. */
function squatTower(ctx, x, z, { mat, cap, r = 2.6, roof, gaps = [], broken = 0, res = 0.14 }) {
  const { S, h } = ctx, y0 = h(x, z) - 1.2, height = roof - y0;
  const prof = t => r * (1.14 - 0.14 * smooth(0, 0.35, t));
  if (broken) {
    const body = S.lathe([x, y0, z], height, prof, mat, { hold: true, maxRadius: r * 1.14 });
    const bite = S.ball([x + r * 0.75, roof + 0.3, z - r * 0.55], [r * 0.95, broken, r * 0.95], mat, { hold: true });
    S.join('cut', body, bite, { res });
  } else S.lathe([x, y0, z], height, prof, mat, { res, maxRadius: r * 1.14 });
  if (res < 0.25) S.lathe([x, roof - 0.5, z], 0.46, r + 0.22, cap || mat, { res: Math.min(0.13, res) });
  const n = Math.round(r * 3.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, mx = x + Math.cos(a) * (r - 0.05), mz = z + Math.sin(a) * (r - 0.05);
    if (gaps.some(g => Math.cos(a - g) > 0.82)) continue;
    if (broken && Math.hypot(mx - (x + r * 0.75), mz - (z - r * 0.55)) < r * 0.95 + 0.3) continue;
    S.box([mx, roof + 0.36, mz], [0.38, 0.38, 0.3], cap || mat, { ax: yawAx(-a), rd: 0.06, res: Math.min(0.11, res) });
  }
}

/* ---------------- rubble ----------------
   A heap of fallen blocks climbing from foot (on the ground) to the point `to`, whose top is yTop: each block a step higher, a little
   askew, all of them reaching down into the ground. Loose stones lie at its sides. */
function rubbleStair(ctx, foot, to, yTop, { mat, width = 2.4, rise = 0.4, seed = 1 }) {
  const { S, h, B } = ctx;
  const dx = to[0] - foot[0], dz = to[1] - foot[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  const y0 = h(foot[0], foot[1]), n = Math.max(2, Math.ceil((yTop - y0) / rise)), run = len / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = foot[0] + dx * t, z = foot[1] + dz * t, top = y0 + (yTop - y0) * (i + 1) / n;
    const lo = Math.min(h(x, z), top) - 0.6, hy = (top - lo) / 2;
    const yaw = Math.atan2(ux, uz) + Math.PI / 2 + B.rr(-0.18, 0.18);
    S.box([x + B.rr(-0.1, 0.1), lo + hy, z + B.rr(-0.1, 0.1)], [run / 2 + 0.22, hy, width / 2 * B.rr(0.9, 1.1)], mat, { ax: yawAx(yaw), rd: 0.12, res: 0.12 });
  }
  // loose blocks tumbled to either side
  const list = [];
  for (let i = 0; i < 6; i++) {
    const t = B.rr(0.1, 0.9), sd = (i % 2 ? 1 : -1) * B.rr(1.6, 2.6);
    list.push([foot[0] + dx * t - uz * sd, foot[1] + dz * t + ux * sd, B.rr(0.35, 0.7)]);
  }
  ctx.K.grow && list.forEach(([x, z, r], i) => ctx.K.grow.rock(S, [x, h(x, z) + r * 0.3, z], r, mat, { facets: 7, chip: 0.35, worn: 0.06, seed: seed * 13 + i, res: 0.1 }));
}
// the breach: the wall stops at s0 and starts again at s1; between, a saddle of fallen blocks that steps down from each broken end
function breach(ctx, W, s0, s1, { mat }) {
  const { h, B, S } = ctx, sm = (s0 + s1) / 2;
  for (const [sEnd, dir] of [[s0, 1], [s1, -1]]) {
    const yTop = W.walkAt(sEnd), steps = [];
    for (let s = sEnd + dir * 0.35; dir > 0 ? s < sm : s > sm; s += dir * 0.42) steps.push(s);
    steps.forEach((s, i) => {
      const q = W.M.at(s), g = h(q.x, q.z), top = Math.max(g + 0.25, yTop - (i + 1) * 0.42);
      const lo = g - 0.6, hy = (top - lo) / 2, yaw = Math.atan2(q.dx, q.dz) + Math.PI / 2 + B.rr(-0.25, 0.25);
      S.box([q.x, lo + hy, q.z], [0.36, hy, W.thick / 2 * B.rr(0.75, 0.95)], mat, { ax: yawAx(yaw), rd: 0.1, res: 0.12 });
    });
  }
  // blocks thrown out to both sides of the gap
  for (let i = 0; i < 8; i++) {
    const q = W.M.at(B.rr(s0 - 0.5, s1 + 0.5)), sd = (i % 2 ? 1 : -1) * B.rr(1.8, 4.2), sdv = [q.dz, -q.dx];
    const x = q.x + sdv[0] * sd, z = q.z + sdv[1] * sd, r = B.rr(0.35, 0.75);
    ctx.K.grow.rock(S, [x, h(x, z) + r * 0.3, z], r, mat, { facets: 7, chip: 0.35, worn: 0.06, seed: 70 + i, res: 0.1 });
  }
}

/* ---------------- cloth, poles, the siege's leavings, crows ---------------- */
// a tattered rag: strips of cloth hanging from a bar from a to b at height y, each its own length, each swung a little by the wind
function rag(ctx, a, b, y, { mat, len = 1.6, n = 5 }) {
  const { S, B } = ctx, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, l = len * B.rr(0.45, 1.05);
    const F = frameAlong([dx, 0, dz], B.rr(-0.22, 0.22)), V = F[1];
    S.box([x - V[0] * l / 2, y - V[1] * l / 2, z - V[2] * l / 2], [L / n / 2 * 0.94, l / 2, 0.03], mat, { ax: F, res: 0.07 });
  }
}
// a pole with a crossbar and a rag on it; the rag is hung after the walk map
function ragPole(ctx, x, z, { wood, cloth, iron, y, h = 3, len = 1.6, yaw = 0 }) {
  const { S } = ctx, y0 = (y ?? ctx.h(x, z)) - 0.3, top = y0 + h;
  const ca = Math.cos(yaw), sa = Math.sin(yaw);
  S.tube([[x, y0, z], [x + 0.08, top, z + 0.05]], 0.1, 0.07, wood, { res: 0.05 });
  S.tube([[x - ca * 0.75, top - 0.25, z + sa * 0.75], [x + ca * 0.75, top - 0.2, z - sa * 0.75]], 0.05, 0.05, wood, { res: 0.04 });
  S.ball([x + 0.08, top + 0.05, z + 0.05], 0.1, iron, { res: 0.04 });
  ctx.later(() => rag(ctx, [x - ca * 0.72, z + sa * 0.72], [x + ca * 0.72, z - sa * 0.72], top - 0.25, { mat: cloth, len, n: 5 }));
}
// a broken cart: its bed slumped to the side whose wheel came off, that wheel lying in the grass, the shafts on the ground
function cart(ctx, x, z, yaw, { wood, iron }) {
  const { S, h } = ctx, y = h(x, z);
  const f = [Math.sin(yaw), 0, Math.cos(yaw)], r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const F = frameAlong(r, 0); // x across the cart
  const roll = -0.3, c = Math.cos(roll), s = Math.sin(roll);
  // bed frame: across (rolled), up, along
  const U = [r[0] * c, s, r[2] * c], V = norm3(cross(f, U)), Wf = f;
  const bedF = [U, V.map(v => -v), Wf];
  const at = (u, v, w) => [x + U[0] * u - V[0] * v + Wf[0] * w, y + 0.62 + U[1] * u - V[1] * v + Wf[1] * w, z + U[2] * u - V[2] * v + Wf[2] * w];
  S.box(at(0, 0, 0), [0.7, 0.07, 1.15], wood, { ax: bedF, rd: 0.02, res: 0.06 });
  for (const sd of [-1, 1]) S.box(at(0.66 * sd, 0.2, 0), [0.05, 0.2, 1.15], wood, { ax: bedF, rd: 0.02, res: 0.06 });
  S.box(at(0, 0.2, -1.12), [0.7, 0.2, 0.05], wood, { ax: bedF, rd: 0.02, res: 0.06 });
  // the standing wheel, on the high side
  const wc = at(0.86, -0.12, -0.2);
  const wheelF = [f, r, [0, 1, 0]];
  S.torus(wc, 0.5, 0.075, wood, { ax: wheelF, res: 0.04 });
  S.ball(wc, 0.12, iron, { res: 0.04 });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 4, dv = [f[0] * Math.cos(a), Math.sin(a), f[2] * Math.cos(a)];
    S.tube([[wc[0] - dv[0] * 0.48, wc[1] - dv[1] * 0.48, wc[2] - dv[2] * 0.48], [wc[0] + dv[0] * 0.48, wc[1] + dv[1] * 0.48, wc[2] + dv[2] * 0.48]], 0.035, 0.035, wood, { res: 0.03 });
  }
  // the fallen wheel, flat in the grass
  const fx = x - r[0] * 1.7 + f[0] * 0.6, fz = z - r[2] * 1.7 + f[2] * 0.6;
  S.torus([fx, h(fx, fz) + 0.06, fz], 0.5, 0.075, wood, { res: 0.04 });
  S.ball([fx, h(fx, fz) + 0.08, fz], [0.12, 0.06, 0.12], iron, { res: 0.04 });
  // shafts
  for (const sd of [-0.45, 0.45]) {
    const p0 = at(sd, -0.05, 1.1), ex = x + r[0] * sd * 1.1 + f[0] * 3.0, ez = z + r[2] * sd * 1.1 + f[2] * 3.0;
    S.tube([p0, [ex, h(ex, ez) + 0.08, ez]], 0.06, 0.05, wood, { res: 0.04 });
  }
  return F;
}
// a siege ladder lying where it fell: two rails and rungs, one rail snapped short
function ladder(ctx, a, b, { wood, broken = false }) {
  const { S, h } = ctx, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), px = -dz / L * 0.32, pz = dx / L * 0.32;
  for (const sd of [-1, 1]) {
    const end = broken && sd > 0 ? 0.72 : 1;
    const p0 = [a[0] + px * sd, 0, a[1] + pz * sd], p1 = [a[0] + dx * end + px * sd, 0, a[1] + dz * end + pz * sd];
    p0[1] = h(p0[0], p0[2]) + 0.08; p1[1] = h(p1[0], p1[2]) + 0.08;
    S.tube([p0, p1], 0.07, 0.07, wood, { res: 0.045 });
  }
  const n = Math.floor(L / 0.5);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (broken && t > 0.7 && i % 2) continue;
    const cx = a[0] + dx * t, cz = a[1] + dz * t, y = h(cx, cz) + 0.1;
    S.tube([[cx - px * 1.05, y, cz - pz * 1.05], [cx + px * (broken && t > 0.72 ? 0.2 : 1.05), y, cz + pz * (broken && t > 0.72 ? 0.2 : 1.05)]], 0.04, 0.04, wood, { res: 0.035 });
  }
}
// a crow: a round body, a round head, a pointed beak and a flat tail (yaw 0 faces +z)
function crow(ctx, x, y, z, yaw, mat, beak) {
  const { S } = ctx, F = yawAx(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
  S.ball([x, y + 0.17, z], [0.13, 0.15, 0.2], mat, { ax: F, res: 0.04 });
  S.ball([x + fx * 0.17, y + 0.33, z + fz * 0.17], 0.1, mat, { res: 0.035 });
  S.tube([[x + fx * 0.25, y + 0.33, z + fz * 0.25], [x + fx * 0.39, y + 0.3, z + fz * 0.39]], 0.035, 0.008, beak, { res: 0.02 });
  S.box([x - fx * 0.25, y + 0.12, z - fz * 0.25], [0.07, 0.025, 0.14], mat, { ax: F, res: 0.03 });
}
