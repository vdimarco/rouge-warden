// Crow Ramparts: a broken curtain wall that rides the ridges of rolling downs at the last light of a storm. Squat round towers stand at
// its bends, rubble heaps and a breach let you climb onto the wall-walk, braziers burn along it, blood-red rags hang from poles and
// battlements, and the siege's leavings lie in the vale below. The highest tower holds the summit; steps wind up round it to the beacon.
// Storm-violet sky over a thin sick yellow-green band, pale stone in violet shadow, dark olive grass, red rags, orange fire.
import { torch, shrubs, deadTree, yawAx } from '../lib/props.mjs';
import { polyDist, lib, tile } from '../lib/common.mjs';

const SPAWN = [0, 27];
const C = [-6, -21]; // the summit tower
const TR = 3.4; // its radius
const T1 = [8, 17], T2 = [13, -1], T3 = [4, -12];
// the curtain wall, south to north; towers stand at T1, T2 and T3, and it ends at the foot of the summit steps
const WALL = [[19, 33.5], T1, [12, 7], T2, [10, -7], T3, [C[0] + TR + 2.4, C[1] + 0.5]];
// the wall goes on west from the summit tower, broken, down the far slope and away over the far downs
const WEST = [[-9.4, -23.4], [-19, -27.5], [-31, -29.5]];
const FAR_W = [[-31, -29.5], [-46, -33], [-62, -27], [-80, -31]];
const FAR_E = [[19, 33.5], [30, 44], [44, 50]];
// the chalk path from the start down through the vale to the foot of the summit steps, and a spur to the rubble below T1
const PATH = [[0, 27], [-1.2, 21], [-2.6, 14], [-1.8, 7], [-3.6, 0], [-3, -7], [-5.5, -12.5], [-9.2, -16.6]];
const SPUR = [[0.4, 24.6], [3.2, 19.5], [3.4, 14.5]];

// the ridge the wall rides: a chain of bumps along it, each its own height, so the ridge rolls
const RIDGE = [[17, 30, 7, 1.3], [12.5, 22.5, 7, 1.4], [9, 16.5, 7, 1.5], [10.8, 11, 7, 1.6], [12.4, 5, 7, 1.7], [13.4, -0.5, 7, 1.75],
  [12, -4.5, 6, 0.9], [7, -9.5, 6, 1.1], [4, -12, 7, 1.5], [0.5, -16.5, 6, 1.0]];

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
    ['fog', [0x29253c]],
    ['ink', [0x030205]],
    ['shade', [0x050407]],
    ['grass', [0x0a0c07, 0x12170b, 0x1c2311, 0x293018, 0x3b4222]],
    ['chalk', [0x17141d, 0x29242f, 0x3e3846]],
    ['stone', [0x0f0d17, 0x1d192a, 0x302a40, 0x48405c, 0x6a6280]],
    ['sunstone', [0x3c2c30, 0x6a4e46, 0x987456]],
    ['wood', [0x120b08, 0x261911, 0x3f2c1d]],
    ['rag', [0x2a0507, 0x560d0d, 0x8a1814]]
  ],
  // the sun is all but down in the north-west: weak, warm, low; it rims the faces turned to it and leaves the rest in violet shadow
  light: { sun: [-0.74, 0.3, -0.6], amb: 0.12, sky: 0.17, sunK: 0.5, shK: 8 },
  fog: { color: 'fog', far: 80, start: 0.48, max: 0.82 },
  dither: 0.5,
  outline: 0.45,
  walk: { half: 34 },
  hills: {
    base: 0,
    bumps: [
      [0, 30, 14, 4.4], // the start's down
      ...RIDGE,
      [-6, -21, 12, 1.6], // the summit's hill
      [-17, 3, 11, 2.8], [-17, 21, 9, 1.8], // the west downs
      [-24, -14, 9, 1.6], [24, 16, 9, 1.4], [27, -16, 10, 2.0]
    ],
    pits: [[-3, 3, 13, 1.4], [-6, -84, 46, 10], [-54, -52, 32, 9]], // the vale, the far lowland behind the summit, and the low ground under the sunset
    fbm: { amp: 0.45, freq: 1 / 11, oct: 3 },
    warp: { amp: 1.5, freq: 1 / 24 },
    far: { amp: 12, start: 38, end: 70 },
    flats: [{ at: SPAWN, r: 2.2, blend: 2.5 }, { at: C, r: 6.8, blend: 3 }],
    paths: [{ pts: PATH, w: 2.2, depth: 0.14 }, { pts: SPUR, w: 1.8, depth: 0.1 }],
    box: [-110, 110, -110, 110]
  },
  build(ctx) {
    const { S, B, h, ramp } = ctx;
    const grit = (k = 1) => (x, y, z) => k * (0.16 * (B.n3(x * 0.45, z * 0.45, y * 0.3 + 3) - 0.5) + 0.14 * (B.n3(x * 2.6, y * 2.6, z * 2.6) - 0.5));
    const grass = ramp('grass'), chalk = ramp('chalk'), st = ramp('stone');
    // the ground: dark olive grass, and pale chalk where the paths wear through it
    const ground = {
      r: grass, g: [grass[1]], mod: grit(1),
      rf: (x, y, z) => (Math.min(polyDist(x, z, PATH) - 0.6, polyDist(x, z, SPUR) - 0.4) + 0.5 * (B.n3(x * 1.3, z * 1.3, 4) - 0.5) < 0.4 ? chalk : grass)
    };
    groundTiles(ctx, ground, [{ r: grass, g: [grass[1]], mod: grit(1.2), fat: 0.64 }, { r: grass, mod: grit(1.4), fat: 0.88 }]);

    const stone = { r: st, s: ramp('sunstone'), g: [st[1]], b: 0.07, mod: grit(0.8), top: { min: 0.99, r: grass.slice(1, 4) } };
    const cap = { r: st, s: ramp('sunstone'), g: [st[1]], b: 0.07, mod: grit(0.7) };
    // fallen stone: darker, gone green on top
    const rubble = { r: st.slice(0, 4), s: ramp('sunstone'), g: [st[1]], mod: grit(1.1), top: { min: 0.82, r: grass.slice(1, 4) } };
    const dark = { r: st.slice(0, 3), mod: grit(0.6) };
    const wood = { r: ramp('wood'), g: [ramp('wood')[1]], mod: grit(0.5) };
    const iron = { r: ramp('iron') };
    const cloth = { r: ramp('rag'), g: [ramp('rag')[1]], mod: grit(0.6) };
    const black = { r: [st[0], ramp('sky')[0]] };
    const rock = { r: st.slice(0, 4), g: [st[1]], mod: grit(0.9), top: { min: 0.8, r: grass.slice(1, 4) } };

    /* ---- the curtain wall ---- */
    const spawnY = h(SPAWN[0], SPAWN[1]);
    const W = curtain(ctx, WALL, {
      mat: stone, cap, height: 2.7, thick: 2.6, side: 1, res: 0.17,
      breaks: [[sAt(WALL, [10, -7]) - 2.4, sAt(WALL, [10, -7]) + 2.2]],
      open: [[sAt(WALL, [9.6, 13.6]) - 1.5, sAt(WALL, [9.6, 13.6]) + 1.5], [sAt(WALL, [12.6, 2.2]) - 1.3, sAt(WALL, [12.6, 2.2]) + 0.7]],
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
    const r3 = towerAt(T3, { broken: 1.1 });
    basket(ctx, T1[0] - 1.0, T1[1] + 0.9, { iron, y: r1 - 0.05 });
    basket(ctx, T2[0] - 0.6, T2[1] + 1.2, { iron, y: r2 - 0.05 });
    basket(ctx, T3[0] + 0.4, T3[1] + 1.3, { iron, y: r3 - 0.05 });

    // the rubble heap that climbs from the vale onto the walk just north of T1
    {
      const s = sAt(WALL, [9.6, 13.6]), p = W.M.at(s), side = W.sideAt(s);
      const top = [p.x + side[0] * 1.2, p.z + side[1] * 1.2], foot = [p.x + side[0] * 8.5, p.z + side[1] * 8.5];
      rubbleStair(ctx, foot, top, W.walkAt(s) - 0.02, { mat: rubble, loose: rock, width: 2.6, seed: 3 });
      torch(ctx, foot[0] + 1.6, foot[1] + 0.6, { wood, iron, h: 1.8 });
    }
    // a flight of stone steps up the inner face of the wall, south of T2, arriving at the walk through a gap in the merlons
    wallStair(ctx, W, sAt(WALL, [12.15, 5.8]), sAt(WALL, [12.6, 2.2]), { mat: stone });
    // the breach: the wall knocked down, its stones heaped both ways so you can climb through and back up
    {
      const s0 = sAt(WALL, [10, -7]) - 2.4, s1 = sAt(WALL, [10, -7]) + 2.2;
      breach(ctx, W, s0, s1, { mat: rubble, loose: rock });
    }

    /* ---- the summit tower: a fat drum with steps winding up round it, and on its crown a turret that holds the beacon ---- */
    // the beacon stands about 2.4 over the start: any higher and the start's low camera would lose it off the top of the picture
    const G0 = h(C[0], C[1]), roof = spawnY + 0.85, roof2 = roof + 1.02;
    const aT = -2.25, TT = [C[0] + Math.cos(aT) * 1.2, C[1] + Math.sin(aT) * 1.2], TRr = 1.55; // the turret, toward the back
    {
      S.lathe([C[0], G0 - 1, C[1]], roof - G0 + 1, t => TR * (1.16 - 0.16 * smooth(0, 0.32, t)), stone, { res: 0.15, maxRadius: TR * 1.16 });
      S.lathe([C[0], roof - 0.95, C[1]], 0.55, TR + 0.28, cap, { res: 0.13 }); // a fat corbel ring under the crown
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
        S.box([cx, y0 + hy, cz], [0.64, hy, 1.05], stone, { ax: yawAx(Math.atan2(-Math.cos(a), -Math.sin(a))), rd: 0.06, res: 0.14 });
      }
      const aTop = a0 - (n - 1) * da;
      // merlons round the drum's crown, open where the steps arrive
      for (let i = 0; i < 13; i++) {
        const a = (i / 13) * Math.PI * 2;
        if (Math.cos(a - aTop) > 0.86) continue;
        S.box([C[0] + Math.cos(a) * (TR - 0.05), roof + 0.38, C[1] + Math.sin(a) * (TR - 0.05)], [0.42, 0.42, 0.34], cap, { ax: yawAx(-a), rd: 0.07, res: 0.11 });
      }
      // the turret, its own small corbel and merlons, and three steps up its side from the drum's roof
      S.lathe([TT[0], roof - 0.3, TT[1]], roof2 - roof + 0.3, TRr, stone, { res: 0.12 });
      S.lathe([TT[0], roof2 - 0.62, TT[1]], 0.32, TRr + 0.17, cap, { res: 0.11 });
      const aS = Math.atan2(C[1] - TT[1], C[0] - TT[0]) - 0.5;
      for (let k = 0; k < 3; k++) {
        const a = aS + k * 0.5, cx = TT[0] + Math.cos(a) * (TRr + 0.5), cz = TT[1] + Math.sin(a) * (TRr + 0.5), tread = roof + (k + 1) * (roof2 - roof) / 3;
        const hy = (tread - roof + 0.2) / 2;
        S.box([cx, roof - 0.2 + hy, cz], [0.48, hy, 0.55], stone, { ax: yawAx(Math.atan2(-Math.cos(a), -Math.sin(a))), rd: 0.06, res: 0.11 });
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        if (Math.cos(a - (aS + 1.0)) > 0.75) continue;
        S.box([TT[0] + Math.cos(a) * (TRr - 0.05), roof2 + 0.3, TT[1] + Math.sin(a) * (TRr - 0.05)], [0.3, 0.32, 0.26], cap, { ax: yawAx(-a), rd: 0.06, res: 0.1 });
      }
      // the beacon's cradle on the turret: a stone drum with an iron rim
      S.lathe([TT[0], roof2 - 0.1, TT[1]], 0.5, t => 0.66 - 0.1 * t, cap, { res: 0.08, maxRadius: 0.66 });
      S.torus([TT[0], roof2 + 0.42, TT[1]], 0.55, 0.08, iron, { res: 0.07 });
      ctx.beacon([TT[0], roof2 + 0.5, TT[1]], 1.6);
      // the place's flag, on the drum's crown to the east
      ragPole(ctx, C[0] + Math.cos(0.35) * 2.3, C[1] + Math.sin(0.35) * 2.3, { wood, cloth, iron, y: roof, h: 2.8, len: 1.6, yaw: 0.5, n: 6 });
      // fire-baskets at the foot of the steps
      for (const af of [a0 + 0.3, a0 + 0.95]) basket(ctx, C[0] + Math.cos(af) * (TR + 2.5), C[1] + Math.sin(af) * (TR + 2.5), { iron });
    }
    // the wall west of the summit tower, broken, falling away down the far slope
    curtain(ctx, WEST, { mat: stone, cap, height: 2.0, thick: 2.2, side: -1, breaks: [[6, 9.5], [16, 19]], res: 0.22 });

    /* ---- the west downs: a tower stump on the rise, with fallen stone heaped up to its top ---- */
    {
      const sx = -16, sz = 3, top = h(sx, sz) + 2.1;
      squatTower(ctx, sx, sz, { mat: stone, cap, r: 2.2, roof: top, broken: 1.4, gaps: [0.2] });
      rubbleStair(ctx, [sx + 6.0, sz + 1.5], [sx + 1.8, sz + 0.6], top - 0.02, { mat: rubble, loose: rock, width: 2.2, seed: 9, nLoose: 3 });
      ragPole(ctx, sx - 0.4, sz - 0.6, { wood, cloth, iron, y: top, h: 2.8, len: 1.2, yaw: 1.2 });
      deadTree(ctx, -11, 9, { bark: wood, h: 3.6, seed: 2 });
    }

    /* ---- a ruined gate at the brow of the start's down: two fat posts, one broken short, the lintel fallen in the grass ---- */
    {
      const gz = 22.6, L = [-3.5, gz], R = [1.9, gz + 0.3], yl = h(L[0], L[1]), yr = h(R[0], R[1]);
      S.box([L[0], yl + 1.3, L[1]], [0.62, 2.0, 0.62], stone, { rd: 0.1, res: 0.12 });
      S.box([L[0], yl + 3.45, L[1]], [0.8, 0.2, 0.8], cap, { rd: 0.06, res: 0.11 });
      // a stub of the lintel still on it, reaching in over the path, and a rag hung from it
      S.box([L[0] + 1.1, yl + 3.15, L[1]], [0.9, 0.3, 0.5], cap, { ax: frameAlong([1, -0.12, 0]), rd: 0.08, res: 0.11 });
      ctx.later(() => rag(ctx, [L[0] + 0.7, L[1] + 0.1], [L[0] + 1.8, L[1] + 0.1], yl + 2.88, { mat: cloth, len: 1.3, n: 4 }));
      // the right post broken short, a block slid half off its top
      S.box([R[0], yr + 0.7, R[1]], [0.62, 1.4, 0.62], stone, { rd: 0.1, res: 0.12 });
      S.box([R[0] + 0.2, yr + 2.35, R[1] - 0.1], [0.5, 0.28, 0.55], stone, { ax: frameAlong([1, 0.3, 0.1]), rd: 0.08, res: 0.11 });
      // the lintel, fallen across the grass
      const fx = R[0] + 1.8, fz = gz - 1.6;
      S.box([fx, h(fx, fz) + 0.18, fz], [1.75, 0.32, 0.48], cap, { ax: frameAlong([0.8, 0.07, -0.6], 0.15), rd: 0.08, res: 0.11 });
    }

    /* ---- the vale: what the siege left ---- */
    cart(ctx, 2.2, 2.5, 0.5, { wood, iron });
    torch(ctx, -0.6, 4.6, { wood, iron, h: 1.9 });
    spikes(ctx, [5, -2], [6.5, 6], { wood, n: 9, h: 1.5, lean: [-0.45, 0.1] });
    spikes(ctx, [3, -9], [6, -4.5], { wood, n: 7, h: 1.4, lean: [-0.4, 0.2] });
    spikes(ctx, [-8, -6], [-9.5, 1], { wood, n: 7, h: 1.3, lean: [0.4, 0] });
    ladder(ctx, [5.8, -7.6], [9.8, -3.6], { wood, broken: true }); // fallen by the breach
    ragPole(ctx, -11.5, 6.5, { wood, cloth, iron, h: 3.6, len: 1.2, yaw: 0.3 });
    ragPole(ctx, -9.5, 16, { wood, cloth, iron, h: 3.4, len: 1.1, yaw: -0.4 });
    ragPole(ctx, 8.6, -5.4, { wood, cloth, iron, h: 3.2, len: 1.1, yaw: 0.9 });
    deadTree(ctx, 6.5, 22.5, { bark: wood, h: 3.0, seed: 5 });
    deadTree(ctx, -12, -10, { bark: wood, h: 3.4, seed: 7 });
    boulders(ctx, [[-6, 17, 0.8], [4.5, 9, 0.6], [-9, -3, 0.9], [-13, 14, 1.0], [5.5, 24, 0.6], [-20, -6, 1.1], [20, -6, 1.0], [-26, 8, 1.2]], rock, 4);
    shrubs(ctx, [[-4.5, 19, 0.6], [3, 14, 0.5], [-7, 3, 0.7], [0.5, -10, 0.5], [-11, -16, 0.6], [-14, 19, 0.7], [14, 20, 0.6], [17, -10, 0.6]],
      { mat: { r: grass.slice(0, 4), mod: grit(1) } });

    /* ---- far ruins on the far downs, dark against the fog ---- */
    curtain(ctx, FAR_W, { mat: dark, height: 3, thick: 2.4, side: 1, seg: 2.6, res: 0.36, merlon: false, breaks: [[22, 27]] });
    curtain(ctx, FAR_E, { mat: dark, height: 3, thick: 2.4, side: 1, seg: 2.6, res: 0.36, merlon: false });
    squatTower(ctx, -46, -33, { mat: dark, r: 2.6, roof: h(-46, -33) + 4.5, broken: 2, gaps: [], res: 0.4 });
    squatTower(ctx, 44, 50, { mat: dark, r: 2.6, roof: h(44, 50) + 4.2, gaps: [], res: 0.4 });
    squatTower(ctx, 34, -46, { mat: dark, r: 2.4, roof: h(34, -46) + 5, broken: 2.2, gaps: [], res: 0.4 });

    /* ---- crows on the battlements ---- */
    const beak = { r: [ramp('iron')[0]] };
    crow(ctx, T2[0] + 2.2, r2 + 0.78, T2[1] + 0.8, -2.2, black, beak);
    crow(ctx, T3[0] - 1.9, r3 + 0.78, T3[1] + 1.5, 2.8, black, beak);
    crow(ctx, C[0] + Math.cos(1.2) * 2.95, roof + 0.8, C[1] + Math.sin(1.2) * 2.95, 2.4, black, beak);
    crow(ctx, -3.3, h(-3.5, 22.6) + 3.65, 22.75, 2.6, black, beak); // on the gate post, the first thing that watches you
    crow(ctx, 5.3, h(6.5, 22.5) + 2.05, 22.0, -1.2, black, beak, 1.4); // in the dead tree by the gate

    /* ---- rags on the battlements: hung after the walk map, so they never block the feet ---- */
    ctx.later(() => {
      for (const p of [[15.5, 27.5], [11.2, 9.5], [6.6, -10.4], [0.8, -16.5]]) {
        const s = sAt(WALL, p), q = W.M.at(s), sd = W.sideAt(s), y = W.walkAt(s) + 0.55;
        const bx = q.x + sd[0] * 1.36, bz = q.z + sd[1] * 1.36;
        rag(ctx, [bx - q.dx * 0.7, bz - q.dz * 0.7], [bx + q.dx * 0.7, bz + q.dz * 0.7], y, { mat: cloth, len: 2.2, n: 4 });
      }
    });

    /* ---- the start, the wisps ---- */
    ctx.spawn([SPAWN[0], spawnY, SPAWN[1]], Math.PI);
    ctx.wisp([T2[0] + 0.6, r2 + 1.0, T2[1] - 0.6]); // on T2's roof
    ctx.wisp([-16, h(-16, 3) + 2.1 + 1.0, 3]); // on the west stump
    ctx.wisp([10.2, h(10.2, -7) + 1.1, -7]); // down in the breach
    ctx.wisp([20, h(20, -2) + 1.0, -2]); // outside the wall, under T2
    ctx.wisp([-24.5, h(-24.5, -27) + 1.0, -27]); // behind the summit, by the broken west wall

    /* ---- sky: storm violet overhead, the sick band at the horizon, the sun going down red in the north-west ---- */
    ctx.glow(({ B }) => {
      const sk = ramp('skyband'), sick = ramp('sick'), f = ramp('fire'), sun = ramp('sunstone'), fogc = ramp('fog')[0];
      // the dome: fog-coloured below the horizon, so the far lowland melts into it; storm grey above, near-black overhead
      dome(B, d => (d[1] < 0.03 ? fogc : d[1] < 0.1 ? sk[2] : d[1] < 0.22 ? sk[1] : d[1] < 0.4 ? sk[0] : ramp('sky')[0]), 150);
      // the band: rings of long low splats round the horizon, brightest in one thin line (seen from the start, a little under eye level)
      const aSun = -0.88; // the sun's bearing (0 is north, negative is west)
      for (let i = 0; i < 110; i++) {
        const a = (i / 110) * Math.PI * 2, r = 140, w = Math.cos(a - aSun) + B.rr(-0.15, 0.15);
        const layers = w > 0.35 ? [[0.022, 1.3, sick[0], 0.8], [0.034, 0.9, sick[1], 0.85], [0.042, 0.45, sick[2], 0.9], [0.058, 1.6, sk[2], 0.7]]
          : w > -0.2 ? [[0.024, 1.2, sk[2], 0.75], [0.036, 0.7, sick[0], 0.85], [0.058, 1.6, sk[2], 0.7]]
          : [[0.03, 1.6, sk[2], 0.7]];
        for (const [el, sz, c, al] of layers) {
          if (c === sick[2] && B.rr(0, 1) < 0.25) continue; // the bright line breaks
          const e = el + B.rr(-0.003, 0.003), ce = Math.cos(e);
          B.axial(Math.sin(a) * ce * r, Math.sin(e) * r, -Math.cos(a) * ce * r, [Math.cos(a), 0, Math.sin(a)], 4.6, sz, B.P[c], al, { em: true, nd: true });
        }
      }
      // storm cloud: dark bars over the band and above it, a few lit red-brown from below near the sun
      // (the low ones break the band, but leave it open behind the summit as the start sees it, bearing about -0.1)
      const low = [-2.6, -2.1, -1.55, -1.05, -0.62, 0.5, 0.95, 1.6, 2.3, 2.9];
      for (let i = 0; i < 46 + low.length; i++) {
        const a = i < low.length ? low[i] + B.rr(-0.08, 0.08) : B.rr(0, Math.PI * 2), el = i < low.length ? B.rr(0.05, 0.07) : B.rr(0.08, 0.3), r = 132, ce = Math.cos(el);
        const lit = Math.cos(a - aSun) > 0.75 && el > 0.06 && el < 0.14;
        B.axial(Math.sin(a) * ce * r, Math.sin(el) * r, -Math.cos(a) * ce * r, [Math.cos(a), 0, Math.sin(a)], i < low.length ? B.rr(7, 13) : B.rr(10, 22), i < low.length ? B.rr(0.8, 1.4) : B.rr(1.4, 3.2),
          B.P[lit ? sun[0] : sk[B.pick([0, 0, 1])]], 0.85, { em: true, nd: true });
      }
      // the sun, low in the north-west, sinking into the band
      const sd = B.norm([-0.77, 0.05, -0.64]), sr = 138;
      B.iso(sd[0] * sr, sd[1] * sr, sd[2] * sr, 3.2, B.P[f[2]], 3, { em: true, nd: true });
      B.iso(sd[0] * sr, sd[1] * sr, sd[2] * sr, 11, B.P[sun[0]], 0.45, { em: true, nd: true });
      // ash on the wind
      lib.motes(B, 110, [-30, 30, 0.3, 8, -30, 30], [sk[2], st[3]], 0.03);
    });
  }
};

/* ---------------- helpers: the sky, lines, frames ---------------- */
// a dome of big soft splats, as B.sky, but drawn behind everything (bk): the camera stands well off the dome's centre, and the dome's
// upper splats would otherwise sort in front of the horizon band and paint over it
function dome(B, fn, rad = 150, n = 300) {
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < n; k++) {
    const y = 1 - (2 * (k + 0.5)) / n, r = Math.sqrt(1 - y * y), a = k * ga, d = [Math.cos(a) * r, y, Math.sin(a) * r];
    B.iso(d[0] * rad, d[1] * rad, d[2] * rad, rad * 0.19, B.P[fn(d)], 0.85, { em: true, nd: true, bk: true });
  }
}
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

/* ---------------- the ground ----------------
   A fine rectangle over where you walk (from the start's down to behind the summit), coarser bands round it, and a wide ring of far
   downs at the coarsest spacing. Tiles on the same lattice meet without seams (common.mjs tile). */
function groundTiles(ctx, near, [mid, far]) {
  const { S, h } = ctx, N = [-21, 19, -29, 31], R = 48;
  tile(S, h, near, { x0: N[0], x1: N[1], z0: N[2], z1: N[3], res: 0.26 });
  for (const [x0, x1, z0, z1] of [[-R, R, -R, N[2]], [-R, R, N[3], R], [-R, N[0], N[2], N[3]], [N[1], R, N[2], N[3]]])
    tile(S, h, mid, { x0, x1, z0, z1, res: 0.55 });
  tile(S, h, far, { x0: -84, x1: 84, z0: -84, z1: 84, hole: R, res: 1.45 });
}
// big rocks lying in the grass, dark, their tops gone to grass
function boulders(ctx, list, mat, seed) {
  const { K, S, h } = ctx;
  list.forEach(([x, z, r], i) => K.grow.rock(S, [x, h(x, z) + r * 0.25, z], r, mat, { facets: 7, chip: 0.35, worn: 0.06, seed: seed + i, res: 0.13 }));
}
// a row of sharpened stakes driven in at a slant (lean: which way their points go), some missing
function spikes(ctx, a, b, { wood, n = 8, h = 1.3, lean = [0, 0] }) {
  const { S, B } = ctx;
  for (let i = 0; i < n; i++) {
    if (B.rr(0, 1) < 0.2) continue;
    const t = i / (n - 1), x = a[0] + (b[0] - a[0]) * t + B.rr(-0.1, 0.1), z = a[1] + (b[1] - a[1]) * t + B.rr(-0.1, 0.1), y0 = ctx.h(x, z) - 0.25;
    const hh = h * B.rr(0.75, 1.1), lx = lean[0] * hh + B.rr(-0.12, 0.12), lz = lean[1] * hh + B.rr(-0.12, 0.12);
    S.tube([[x, y0, z], [x + lx * 0.8, y0 + hh * 0.8, z + lz * 0.8], [x + lx, y0 + hh, z + lz]], 0.12, 0.015, wood, { res: 0.08 });
  }
}

/* ---------------- the curtain wall ----------------
   Blocks along a polyline. The walk on top follows the ground smoothed along the line plus `height`, so it rolls with the ridge in steps
   a foot can take. Merlons stand along one edge only (side +1: the left of the line's direction), so the walk stays wide. `open` lists
   stretches [s0, s1] with no merlons (where rubble comes up), `breaks` stretches with no wall. Round pillars fill the bends. */
function curtain(ctx, pts, o) {
  const { S, h, B } = ctx;
  const { mat, cap, height = 2.7, thick = 2.6, seg = 1.6, breaks = [], open = [], side = 1, res = 0.16, merlon = true, towers = [], pillars = false } = o;
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
        S.box([mx, walkAt(sm2) + mh, mz], [hl * 0.36, mh, 0.27], cap || mat, { ax, rd: 0.06, res: Math.min(res, 0.14) });
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
function squatTower(ctx, x, z, { mat, cap, r = 2.6, roof, gaps = [], broken = 0, res = 0.15 }) {
  const { S, h } = ctx, y0 = h(x, z) - 1.2, height = roof - y0;
  const prof = t => r * (1.14 - 0.14 * smooth(0, 0.35, t));
  if (broken) {
    const body = S.lathe([x, y0, z], height, prof, mat, { hold: true, maxRadius: r * 1.14 });
    const bite = S.ball([x + r * 0.75, roof + 0.3, z - r * 0.55], [r * 0.95, broken, r * 0.95], mat, { hold: true });
    S.join('cut', body, bite, { res });
  } else S.lathe([x, y0, z], height, prof, mat, { res, maxRadius: r * 1.14 });
  if (res < 0.25) S.lathe([x, roof - 0.9, z], 0.5, r + 0.22, cap || mat, { res: Math.min(0.14, res) });
  const n = Math.round(r * 3.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, mx = x + Math.cos(a) * (r - 0.05), mz = z + Math.sin(a) * (r - 0.05);
    if (gaps.some(g => Math.cos(a - g) > 0.82)) continue;
    if (broken && Math.hypot(mx - (x + r * 0.75), mz - (z - r * 0.55)) < r * 0.95 + 0.3) continue;
    S.box([mx, roof + 0.36, mz], [0.38, 0.38, 0.3], cap || mat, { ax: yawAx(-a), rd: 0.06, res: res >= 0.25 ? res : Math.min(0.13, res) });
  }
}

/* ---------------- rubble ----------------
   A heap of fallen blocks climbing from foot (on the ground) to the point `to`, whose top is yTop: each block a step higher, a little
   askew, all of them reaching down into the ground. Loose stones lie at its sides. */
function rubbleStair(ctx, foot, to, yTop, { mat, loose, width = 2.4, rise = 0.4, seed = 1, nLoose = 5 }) {
  const { S, h, B } = ctx;
  const dx = to[0] - foot[0], dz = to[1] - foot[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  const y0 = h(foot[0], foot[1]), n = Math.max(2, Math.ceil((yTop - y0) / rise)), run = len / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, side = B.rr(-0.3, 0.3), x = foot[0] + dx * t - uz * side, z = foot[1] + dz * t + ux * side;
    const top = y0 + (yTop - y0) * (i + 1) / n, lo = Math.min(h(x, z), top) - 0.6, hy = (top - lo) / 2;
    const tw = B.rr(-0.35, 0.35), c = Math.cos(tw), sn = Math.sin(tw);
    const F = frameAlong([ux * c - uz * sn, B.rr(-0.05, 0.05), uz * c + ux * sn], B.rr(-0.07, 0.07));
    S.box([x, lo + hy, z], [run / 2 + 0.28, hy, width / 2 * B.rr(0.8, 1.15)], mat, { ax: F, rd: 0.14, res: 0.12 });
  }
  // loose blocks tumbled to either side
  for (let i = 0; i < nLoose; i++) {
    const t = B.rr(0.05, 0.85), sd = (i % 2 ? 1 : -1) * B.rr(1.5, 2.4), r = B.rr(0.35, 0.7);
    const x = foot[0] + dx * t - uz * sd, z = foot[1] + dz * t + ux * sd;
    ctx.K.grow.rock(S, [x, h(x, z) + r * 0.3, z], r, loose || mat, { facets: 7, chip: 0.35, worn: 0.06, seed: seed * 13 + i, res: 0.13 });
  }
}
// the breach: the wall stops at s0 and starts again at s1; between, a saddle of fallen blocks that steps down from each broken end
function breach(ctx, W, s0, s1, { mat, loose }) {
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
    ctx.K.grow.rock(S, [x, h(x, z) + r * 0.3, z], r, loose || mat, { facets: 7, chip: 0.35, worn: 0.06, seed: 70 + i, res: 0.13 });
  }
}

/* ---------------- cloth, poles, the siege's leavings, crows ---------------- */
// a tattered rag hung from a bar from a to b at height y: whole for the top part of its length, torn below into strips of their own
// lengths, a few gone, each swung a little by the wind
function rag(ctx, a, b, y, { mat, len = 1.6, n = 5 }) {
  const { S, B } = ctx, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), whole = len * 0.42;
  const F0 = frameAlong([dx, 0, dz], B.rr(-0.08, 0.08)), V0 = F0[1];
  S.box([(a[0] + b[0]) / 2 - V0[0] * whole / 2, y - V0[1] * whole / 2, (a[1] + b[1]) / 2 - V0[2] * whole / 2], [L / 2, whole / 2, 0.03], mat, { ax: F0, res: 0.1 });
  for (let i = 0; i < n; i++) {
    if (B.rr(0, 1) < 0.15) continue;
    const t = (i + 0.5) / n, l = (len - whole) * B.rr(0.3, 1.25), w = (L / n / 2) * B.rr(0.6, 0.9);
    const x = a[0] + dx * t - V0[0] * whole, yy = y - V0[1] * whole + 0.04, z = a[1] + dz * t - V0[2] * whole;
    const F = frameAlong([dx, 0, dz], B.rr(-0.25, 0.25)), V = F[1];
    S.box([x - V[0] * l / 2, yy - V[1] * l / 2, z - V[2] * l / 2], [w, l / 2, 0.03], mat, { ax: F, res: 0.1 });
  }
}
// a pole with a crossbar and a rag on it; the rag is hung after the walk map
function ragPole(ctx, x, z, { wood, cloth, iron, y, h = 3, len = 1.6, yaw = 0, n = 4 }) {
  const { S } = ctx, y0 = (y ?? ctx.h(x, z)) - 0.3, top = y0 + h;
  const ca = Math.cos(yaw), sa = Math.sin(yaw);
  S.tube([[x, y0, z], [x + 0.08, top, z + 0.05]], 0.1, 0.07, wood, { res: 0.07 });
  S.tube([[x - ca * 0.75, top - 0.25, z + sa * 0.75], [x + ca * 0.75, top - 0.2, z - sa * 0.75]], 0.055, 0.055, wood, { res: 0.06 });
  S.ball([x + 0.08, top + 0.05, z + 0.05], 0.11, iron, { res: 0.06 });
  ctx.later(() => rag(ctx, [x - ca * 0.72, z + sa * 0.72], [x + ca * 0.72, z - sa * 0.72], top - 0.25, { mat: cloth, len, n }));
}
// a broken cart: its bed slumped to the side whose wheel came off, that wheel lying in the grass, the shafts on the ground
function cart(ctx, x, z, yaw, { wood, iron }) {
  const { S, h } = ctx, y = h(x, z);
  const f = [Math.sin(yaw), 0, Math.cos(yaw)], r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const roll = -0.3, c = Math.cos(roll), s = Math.sin(roll);
  // bed frame: across (rolled), up, along
  const U = [r[0] * c, s, r[2] * c], V = norm3(cross(f, U)), Wf = f;
  const bedF = [U, V.map(v => -v), Wf];
  const at = (u, v, w) => [x + U[0] * u - V[0] * v + Wf[0] * w, y + 0.62 + U[1] * u - V[1] * v + Wf[1] * w, z + U[2] * u - V[2] * v + Wf[2] * w];
  S.box(at(0, 0, 0), [0.7, 0.07, 1.15], wood, { ax: bedF, rd: 0.02, res: 0.1 });
  for (const sd of [-1, 1]) S.box(at(0.66 * sd, 0.2, 0), [0.05, 0.2, 1.15], wood, { ax: bedF, rd: 0.02, res: 0.1 });
  S.box(at(0, 0.2, -1.12), [0.7, 0.2, 0.05], wood, { ax: bedF, rd: 0.02, res: 0.1 });
  // the standing wheel, on the high side
  const wc = at(0.86, -0.12, -0.2);
  const wheelF = [f, r, [0, 1, 0]];
  S.torus(wc, 0.5, 0.085, wood, { ax: wheelF, res: 0.07 });
  S.ball(wc, 0.13, iron, { res: 0.06 });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 4, dv = [f[0] * Math.cos(a), Math.sin(a), f[2] * Math.cos(a)];
    S.tube([[wc[0] - dv[0] * 0.48, wc[1] - dv[1] * 0.48, wc[2] - dv[2] * 0.48], [wc[0] + dv[0] * 0.48, wc[1] + dv[1] * 0.48, wc[2] + dv[2] * 0.48]], 0.04, 0.04, wood, { res: 0.06 });
  }
  // the fallen wheel, flat in the grass
  const fx = x - r[0] * 1.7 + f[0] * 0.6, fz = z - r[2] * 1.7 + f[2] * 0.6;
  S.torus([fx, h(fx, fz) + 0.06, fz], 0.5, 0.085, wood, { res: 0.07 });
  S.ball([fx, h(fx, fz) + 0.08, fz], [0.13, 0.07, 0.13], iron, { res: 0.06 });
  // shafts
  for (const sd of [-0.45, 0.45]) {
    const p0 = at(sd, -0.05, 1.1), ex = x + r[0] * sd * 1.1 + f[0] * 3.0, ez = z + r[2] * sd * 1.1 + f[2] * 3.0;
    S.tube([p0, [ex, h(ex, ez) + 0.08, ez]], 0.065, 0.055, wood, { res: 0.07 });
  }
}
// a siege ladder lying where it fell: two rails and rungs, one rail snapped short
function ladder(ctx, a, b, { wood, broken = false }) {
  const { S, h } = ctx, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), px = -dz / L * 0.32, pz = dx / L * 0.32;
  for (const sd of [-1, 1]) {
    const end = broken && sd > 0 ? 0.72 : 1;
    const p0 = [a[0] + px * sd, 0, a[1] + pz * sd], p1 = [a[0] + dx * end + px * sd, 0, a[1] + dz * end + pz * sd];
    p0[1] = h(p0[0], p0[2]) + 0.08; p1[1] = h(p1[0], p1[2]) + 0.08;
    S.tube([p0, p1], 0.08, 0.08, wood, { res: 0.07 });
  }
  const n = Math.floor(L / 0.5);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (broken && t > 0.7 && i % 2) continue;
    const cx = a[0] + dx * t, cz = a[1] + dz * t, y = h(cx, cz) + 0.1;
    S.tube([[cx - px * 1.05, y, cz - pz * 1.05], [cx + px * (broken && t > 0.72 ? 0.2 : 1.05), y, cz + pz * (broken && t > 0.72 ? 0.2 : 1.05)]], 0.05, 0.05, wood, { res: 0.06 });
  }
}
// steps along the merlon side of a wall from sA (on the ground) up to sB (level with the walk), each block reaching down to the grass
function wallStair(ctx, W, sA, sB, { mat }) {
  const { S, h } = ctx, q0 = W.M.at(sA), sd0 = W.sideAt(sA), off = W.thick / 2 + 0.6;
  const g0 = h(q0.x + sd0[0] * off, q0.z + sd0[1] * off), top = W.walkAt(sB), n = Math.ceil((top - g0) / 0.36), run = (sB - sA) / n;
  for (let i = 0; i < n; i++) {
    const s = sA + run * (i + 0.5), q = W.M.at(s), sd = W.sideAt(s), x = q.x + sd[0] * off, z = q.z + sd[1] * off;
    const tread = g0 + (top - g0) * (i + 1) / n, lo = Math.min(h(x, z), tread) - 0.6, hy = (tread - lo) / 2;
    S.box([x, lo + hy, z], [run / 2 + 0.03, hy, 0.62], mat, { ax: yawAx(Math.atan2(q.dx, q.dz) + Math.PI / 2), rd: 0.05, res: 0.13 });
  }
}
// an iron fire-basket on three short legs, its fire, and its lamp (lighter than the shared brazier)
function basket(ctx, x, z, { iron, y, s = 1.0 }) {
  const { S } = ctx, y0 = y ?? ctx.h(x, z) - 0.05;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    S.tube([[x + Math.cos(a) * 0.42, y0, z + Math.sin(a) * 0.42], [x + Math.cos(a) * 0.2, y0 + 0.72, z + Math.sin(a) * 0.2]], 0.06, 0.05, iron, { res: 0.07 });
  }
  S.lathe([x, y0 + 0.6, z], 0.38, t => 0.24 + 0.26 * t, iron, { res: 0.07, maxRadius: 0.5 });
  ctx.fire([x, y0 + 1.02, z], s);
  return [x, y0 + 1.0, z];
}
// a crow: a round body, a round head, a pointed beak and a flat tail (yaw 0 faces +z)
function crow(ctx, x, y, z, yaw, mat, beak, k = 1.6) {
  const { S } = ctx, F = yawAx(yaw), fx = Math.sin(yaw) * k, fz = Math.cos(yaw) * k;
  S.ball([x, y + 0.17 * k, z], [0.13 * k, 0.15 * k, 0.2 * k], mat, { ax: F, res: 0.05 });
  S.ball([x + fx * 0.17, y + 0.33 * k, z + fz * 0.17], 0.1 * k, mat, { res: 0.045 });
  S.tube([[x + fx * 0.25, y + 0.33 * k, z + fz * 0.25], [x + fx * 0.39, y + 0.3 * k, z + fz * 0.39]], 0.035 * k, 0.008 * k, beak, { res: 0.03 });
  S.box([x - fx * 0.25, y + 0.12 * k, z - fz * 0.25], [0.07 * k, 0.025 * k, 0.14 * k], mat, { ax: F, res: 0.04 });
}
