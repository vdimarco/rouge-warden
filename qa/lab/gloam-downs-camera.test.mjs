// Gloam Downs' cameras, checked in node with no browser (public/lab/gloam-downs/play.js camLayout and makeCamera, cameras.js):
//   the framing of each window: the 4 m round the lamplighter inside the screen and above the touch buttons, a foe 3.5 m to each side
//     in view, the horizon under the HUD, the ground read at 20° or more, and the figure's size;
//   the follow camera on made-up ground: Q and E, a new window keeps the player's pitch, it rises over a wall and stays back, a post
//     between does not move it, the rise is never faster than 4 rad/s, and under a roof it comes in with its eye clear;
//   the follow camera on the five baked places (skipped with GLOAM_WORLDS=0): each route walked at run speed at five layouts, and the
//     view swept round at each waypoint: its distance, the figure's size, the ring, foes to the side, the lamplighter hidden, the eye
//     in the scenery and the largest turn in one step;
//   the combat camera: the turn to a foe and its stop, no foe, two foes at about the same distance, running away from a foe, look input
//     wins, reduced motion, foes at home or out of range, and training posts as stand-ins;
//   the boss camera with a stand-in boss: the frame at five layouts, its distance and aim, where it starts and hands back, its turn, a
//     run round the boss, reduced motion, and the real arena on Barrow Crown's walk map.
//   the smooth camera (design.md "Smooth camera"): main.js's frame loop at 60, 120, 144 and 165 Hz (and 60 Hz with rAF jitter): a
//     steady mouse move turns the picture by the frame's own move every frame, and a run or Q moves the eye evenly every frame; on the
//     five routes at run speed with the mouse taken and free, the rise starts and stops eased, the eye never jolts and the aim's height
//     is smooth; the combat turn and the swing ease in and out; the mouse's spike cap is the same turn speed at any frame rate; the
//     mouse's pitch between steps tilts neither the boss camera's view nor a follow view held at its top; and the boss camera's
//     distance comes in and goes out eased as a pillar passes between; and at 120 Hz near walls and roofs, the eye comes in smoothly,
//     never in the scenery, and a mouse turn beside a wall or under an overhang, from rest or walking, starts and stops without a jump.
// Run: node qa/lab/gloam-downs-camera.test.mjs   (GLOAM_WORLDS=0 to leave out the baked places)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, makeCamera, makeBlend, camLayout, VIEW, zoomFov, ZOOM, fadeOf, makeFade, pose, NEAR_FADE, TIGHT, AUTO } from '../../public/lab/gloam-downs/play.js';
import { stepCount } from '../../public/lab/gloam-downs/run.js';
import { mouseLook, MOUSE } from '../../public/lab/gloam-downs/input.js';
import { makeCut, showing, CUT } from '../../public/lab/gloam-downs/cut.js';
import { makeCombat, makeMoveLock, makeBossCam, projector, frameClear, bossLeast, yawDiff, asFoes, COMBAT, BOSS, easeTurn } from '../../public/lab/gloam-downs/cameras.js';
import { clearLine, makePost } from '../../public/lab/gloam-downs/moves.js';
import { ORDER } from '../../public/lab/gloam-downs/save.js';
import { ROUTES } from '../../games/gloam-downs/lib/zones.mjs';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url));
const STEP = 1 / 60, DEG = Math.PI / 180;
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const r2 = v => +v.toFixed(2);

/* ---------------- the five layouts ----------------
   The touch buttons are the rects of design.md "HUD and layouts" (none with the fine pointer at 1280x720); the HUD and the tools are
   the rects of the spec's "The HUD in the boss fight" (the tools measured with Pause) */
const hud = w => (w <= 520 ? [10, 60, w === 320 ? 180 : w === 360 ? 220 : 250, 88] : [10, 60, 262, 91]);
const tools = w => (w <= 520 ? [w - 122, 60, 112, 44] : [w - 144, 60, 134, 44]);
const LAYOUTS = {
  '1280x720': [1280, 720, []],
  '800x600': [800, 600, [[708, 440, 76, 76], [640, 522, 60, 60], [720, 524, 64, 64], [648, 458, 48, 48]]],
  '390x844': [390, 844, [[290, 664, 84, 84], [214, 750, 64, 64], [302, 756, 72, 72], [226, 682, 52, 52]]],
  '360x640': [360, 640, [[268, 480, 76, 76], [200, 562, 60, 60], [280, 564, 64, 64], [208, 498, 48, 48]]],
  '320x640': [320, 640, [[228, 480, 76, 76], [160, 562, 60, 60], [240, 564, 64, 64], [168, 498, 48, 48]]]
};
const screenOf = name => { const [w, h, btn] = LAYOUTS[name]; return { w, h, bar: 52, rects: [...btn, hud(w), tools(w)] }; };

/* ---------------- made-up ground ---------------- */
function layered(fn, half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz, vals = [];
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) {
    const v = fn(info.x0 + i * info.step, info.z0 + j * info.step);
    vals.push(Array.isArray(v) ? v : [v, v]);
  }
  const three = vals.some(v => v.length > 2), cells = new Int16Array((three ? 3 : 2) * N);
  vals.forEach(([t, g, u], k) => {
    cells[k] = Math.round(t * 100);
    cells[N + k] = Math.round((g ?? t) * 100);
    if (three) cells[2 * N + k] = u === undefined ? 0 : Math.round(u * 100);
  });
  return makeWalk(info, cells);
}
const OPEN = layered(() => 0, 40);
const eyeOf = v => { const cp = Math.cos(v.pitch); return [v.target[0] + v.dist * Math.sin(v.yaw) * cp, v.target[1] + v.dist * Math.sin(v.pitch), v.target[2] + v.dist * Math.cos(v.yaw) * cp]; };
const cameraFor = (walk, name, yaw, o = {}) => { const [w, h] = LAYOUTS[name] || name; return makeCamera(walk, { yaw, ...camLayout(w, h), ...o }); };
// a lamplighter body standing at (x, z) on the walk map, facing yaw
const stand = (walk, x, z, yaw = Math.PI, y = walk.top(x, z)) => makeBody(walk, { p: [x, y + 0.5, z], yaw }, 38);

/* ---------------- the framing of each window ---------------- */
{
  const rows = [];
  const windows = [...Object.keys(LAYOUTS).map(k => LAYOUTS[k].slice(0, 2)), [1920, 1080], [2560, 1080], [1024, 768], [844, 390], [412, 915], [375, 667], [360, 780], [320, 568], [768, 1024]];
  for (const [w, h] of windows) {
    const L = camLayout(w, h), tall = w < h, top = tall ? 0.22 : 0.12, bottom = tall ? (w >= 600 ? 0.8 : 0.76) : 0.95;
    const view = { target: [0, L.aim, 0], dist: L.dist, yaw: 0, pitch: L.pitch, fov: L.fov }, P = projector(view, w, h);
    const eyeY = L.aim + L.dist * Math.sin(L.pitch), hz = P([0, eyeY, -500])[1] / h;
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    for (let k = 0; k < 32; k++) {
      const [x, y] = P([4 * Math.cos(k * Math.PI / 16), 0, 4 * Math.sin(k * Math.PI / 16)]);
      x0 = Math.min(x0, x / w); x1 = Math.max(x1, x / w); y0 = Math.min(y0, y / h); y1 = Math.max(y1, y / h);
    }
    const tag = `${w}x${h}`;
    assert(x0 >= 0.03 && x1 <= 0.97, `${tag}: the 4 m ring spans ${x0.toFixed(3)}..${x1.toFixed(3)} of the width`);
    assert(y0 >= top && y1 <= bottom, `${tag}: the 4 m ring spans ${y0.toFixed(3)}..${y1.toFixed(3)} of the height, inside ${top}..${bottom}`);
    assert(hz >= top, `${tag}: the horizon at ${hz.toFixed(3)} of the height is under the HUD (${top})`);
    for (const sg of [-1, 1]) for (const up of [0, 0.9]) {
      const [x, y] = P([3.5 * sg, up, 0]);
      assert(x >= 0 && x <= w && y >= 0 && y <= h, `${tag}: a foe 3.5 m to the side is in view`);
    }
    const fig = (P([0, 0, 0])[1] - P([0, 1.6, 0])[1]) / h, ground = Math.atan2(eyeY, L.dist * Math.cos(L.pitch)) / DEG;
    assert(fig >= 0.07 && fig <= 0.25, `${tag}: the figure is ${(fig * 100).toFixed(1)}% of the height`);
    assert(ground >= 20, `${tag}: the ground is seen at ${ground.toFixed(1)}°`);
    rows.push({ w: tag, fov: r2(L.fov / DEG), dist: r2(L.dist), pitch: +L.pitch.toFixed(3), aim: r2(L.aim), horizon: r2(hz), ring: [r2(y0), r2(y1)], figure: +(fig * 100).toFixed(1), ground: +ground.toFixed(1) });
  }
  // the touch buttons: in a tall window no point of the ring is under one
  for (const name of ['390x844', '360x640', '320x640']) {
    const { w, h, rects } = screenOf(name), L = camLayout(w, h), P = projector({ target: [0, L.aim, 0], dist: L.dist, yaw: 0, pitch: L.pitch, fov: L.fov }, w, h);
    for (let k = 0; k < 32; k++) {
      const p = P([4 * Math.cos(k * Math.PI / 16), 0, 4 * Math.sin(k * Math.PI / 16)]);
      assert(!rects.some(([x, y, rw, rh]) => p[0] >= x && p[0] <= x + rw && p[1] >= y && p[1] <= y + rh), `${name}: the ring is under a control at ${p.map(Math.round)}`);
    }
  }
  pass('each window frames the 4 m round the lamplighter, a foe to each side and the horizon', rows);
}

/* ---------------- the follow camera on made-up ground ---------------- */
{ // Q and E turn the view at 2.6 rad/s; a new window keeps the pitch the player set, relative to the window's
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '1280x720', 0, { auto: false });
  cam.snap(b.s, 0);
  for (let i = 0; i < 60; i++) cam.follow(b.s, STEP, { ox: 1 });
  assert(near(cam.c.yaw, 2.6, 0.1), `E held for 1 s turns the yaw by ${cam.c.yaw}`);
  for (let i = 0; i < 15; i++) cam.follow(b.s, STEP, { oy: 1 });
  const offset = cam.c.pitch - cam.c.base;
  cam.layout(camLayout(390, 844));
  assert(near(cam.c.pitch - cam.c.base, offset, 1e-9) && near(cam.c.want, camLayout(390, 844).dist, 1e-9), 'a new window keeps the pitch the player set');
  pass('Q and E turn the view, and a new window keeps the pitch the player set', { yaw: r2(cam.c.yaw), offset: r2(offset) });
}
{ // a wall 2.5 high behind the lamplighter: the camera rises over it and stays back, its eye clear, and it sees the head
  const WALL = layered((x, z) => (z >= 2 && z <= 3 ? 2.5 : 0));
  const out = [];
  for (const name of ['1280x720', '390x844']) {
    const b = stand(WALL, 0, 0), cam = cameraFor(WALL, name, 0, { auto: false });
    cam.snap(b.s, 0);
    let v;
    for (let i = 0; i < 120; i++) {
      v = cam.follow(b.s, STEP, {});
      const e = eyeOf(v);
      assert(e[1] > WALL.top(e[0], e[2]) + 0.1, `${name}: the eye is in the wall`);
    }
    const e = eyeOf(v);
    assert(near(v.dist, cam.c.want, 0.05), `${name}: it stays back (${v.dist})`);
    assert(v.pitch > cam.c.base + 0.1, `${name}: it rose over the wall (${v.pitch})`);
    assert(clearLine(WALL, e[0], e[1], e[2], b.s.x, b.s.y + 1.3, b.s.z), `${name}: it sees the head`);
    out.push({ name, dist: r2(v.dist), pitch: r2(v.pitch) });
  }
  pass('a wall behind: the camera rises over it and stays back', out);
}
{ // a post 0.3 wide right between the eye and the lamplighter, and a row of posts run past: the camera does not move for them
  const POST = layered((x, z) => (Math.abs(x) < 0.15 && Math.abs(z - 3) < 0.15 ? 3 : 0));
  const b = stand(POST, 0, 0), cam = cameraFor(POST, '1280x720', 0, { auto: false });
  cam.snap(b.s, 0);
  let v;
  for (let i = 0; i < 90; i++) v = cam.follow(b.s, STEP, {});
  assert(near(v.dist, 8.5, 1e-6) && near(v.pitch, cam.c.base, 1e-6), `a post between does not move it (dist ${v.dist}, pitch ${v.pitch})`);
  // posts every 3 m along the run, 1.5 m to the side: run past them at 6.4 m/s
  const ROW = layered((x, z) => (Math.abs(x - 1.5) < 0.15 && Math.abs(((z % 3) + 3) % 3 - 1.5) < 0.15 ? 2.5 : 0), 40);
  const r = stand(ROW, 0, 30), c2 = cameraFor(ROW, '1280x720', 0);
  c2.snap(r.s, 0);
  let last = null, worst = 0, came = 0;
  for (let i = 0; i < 480; i++) {
    r.s.z -= 6.4 * STEP; r.s.vz = -6.4; r.s.vx = 0; r.s.yaw = Math.PI;
    const w2 = c2.follow(r.s, STEP, {});
    if (last) { worst = Math.max(worst, Math.abs(w2.pitch - last.pitch)); if (w2.dist < last.dist - 0.01) came++; }
    last = w2;
  }
  assert(worst < 1e-6 && came === 0, `a row of posts run past: the pitch moved ${worst} in a step and the camera came in ${came} times`);
  pass('posts between the eye and the lamplighter do not move the camera');
}
{ // a wall that comes between suddenly (a door in a long wall, run through): the rise never turns the view faster than 4 rad/s
  const DOOR = layered((x, z) => (z >= -0.5 && z <= 0.5 && Math.abs(x) > 1.2 ? 3.5 : 0), 30);
  for (const name of ['1280x720', '390x844']) {
    const b = stand(DOOR, 0, 8), cam = cameraFor(DOOR, name, 0);
    cam.snap(b.s, 0);
    let last = null, fastest = 0, inWall = 0;
    for (let i = 0; i < 300; i++) {
      b.s.z -= 3 * STEP; b.s.vz = -3; b.s.vx = 0; b.s.yaw = Math.PI;
      const v = cam.follow(b.s, STEP, {});
      if (last) fastest = Math.max(fastest, Math.abs(v.pitch - last.pitch) / STEP);
      const e = eyeOf(v);
      if (DOOR.support(e[0], e[2], e[1]) === null) inWall++;
      last = v;
    }
    assert(fastest <= 4 + 1e-6, `${name}: the view rose at ${fastest} rad/s`);
    assert(inWall === 0, `${name}: the eye was in the wall on ${inWall} steps`);
  }
  pass('a wall that comes between: the view rises at no more than 4 rad/s, and the eye stays out of the wall');
}
{ // under a long low roof the camera must come in, and its eye stays clear inside the passage
  const ROOF = layered((x, z) => (Math.abs(x) <= 1.5 && z > -10 && z < 10 ? [4, 0, 2.4] : Math.abs(x) <= 3 && z > -10 && z < 10 ? 4 : 0));
  const b = stand(ROOF, 0, 0, Math.PI, 0), cam = cameraFor(ROOF, '1280x720', 0, { auto: false });
  assert(near(b.s.y, 0, 1e-6), 'it stands on the floor under the roof');
  cam.snap(b.s, 0);
  let v;
  for (let i = 0; i < 90; i++) {
    v = cam.follow(b.s, STEP, {});
    const e = eyeOf(v);
    assert(ROOF.support(e[0], e[2], e[1]) !== null, 'the eye is inside the roof');
  }
  // (it stands at the full distance inside the passage: the view dips under the roof, which only a dip that reaches the full distance does)
  assert(v.dist >= 8 && v.dist <= 8.5, `under the roof it stands ${v.dist} back`);
  pass('under a long roof the camera follows inside the passage', { dist: r2(v.dist), pitch: r2(v.pitch) });
}

{ /* the spring never moves away from its goal: a wall 3 m behind comes between (the eye behind it comes in fast, past it), and is gone
     again, while the eye still comes in fast. On that step the eye does not go on in (a spring carried on by its speed
     went on in, past NEAR and through the aim, in the torn cell of 45ffb438); it comes back out, eased */
  const OPENW = layered(() => 0), WALLED = layered((x, z) => (z >= 3 && z <= 4 ? 14 : 0));
  let cur = OPENW;
  const walk = new Proxy({}, { get: (_, k) => cur[k] });
  const b = stand(OPENW, 0, 0), cam = makeCamera(walk, { yaw: 0, ...camLayout(1280, 720), auto: false });
  cam.snap(b.s, 0);
  for (let i = 0; i < 30; i++) cam.follow(b.s, STEP, {});
  cur = WALLED;
  // (the eye behind the wall waits GRACE before it comes in, and then builds speed)
  for (let i = 0; i < 15 && cam.c.dv > -8; i++) cam.follow(b.s, STEP, {});
  const d0 = cam.c.dist, v0 = cam.c.dv;
  assert(v0 < -5 && d0 < 8.4, `the eye was coming in fast (${d0.toFixed(2)} m at ${v0.toFixed(1)} m/s)`);
  cur = OPENW;
  cam.follow(b.s, STEP, {});
  assert(cam.c.dist >= d0 - 1e-9, `with its goal gone back out, the eye went on in from ${d0.toFixed(3)} to ${cam.c.dist.toFixed(3)}`);
  let last = cam.c.dist;
  for (let i = 0; i < 60; i++) { cam.follow(b.s, STEP, {}); assert(last > 8.45 || cam.c.dist >= last - 1e-9, `step ${i} out: ${last} -> ${cam.c.dist}`); last = cam.c.dist; }
  assert(near(last, 8.5, 0.05), `and it went back out to ${last}`);
  pass('the spring never moves away from its goal: a goal that steps back out stops an eye coming in fast', { from: r2(d0), speed: r2(v0) });
}

/* ---------------- the follow camera on the five baked places ---------------- */
const skipWorlds = process.env.GLOAM_WORLDS === '0';
const places = {};
function place(id) {
  if (places[id]) return places[id];
  const meta = JSON.parse(fs.readFileSync(`${DIR}worlds/${id}.json`, 'utf8'));
  const raw = zlib.gunzipSync(fs.readFileSync(`${DIR}worlds/${id}.walk.bin.gz`));
  return (places[id] = { meta, walk: makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1)) });
}
/* What the lamplighter covers of the picture: its splats as the page draws them (posed on their bones, the near fade's share left out,
   the shadow disc not counted), each a disc of 2 sigma projected from the eye, marked on a grid of cells h/36 px across. -> the share of
   the view's cells it covers. The figure is the same in every place, so the Gaol's is used */
let FIG = null;
function figure() {
  if (FIG) return FIG;
  const SplatCodec = new Function(fs.readFileSync(DIR + 'ink/splat-codec.js', 'utf8') + '\nreturn SplatCodec;')();
  const meta = JSON.parse(fs.readFileSync(`${DIR}worlds/gaol.json`, 'utf8')), B = meta.bones;
  const { data } = SplatCodec.decode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${DIR}worlds/gaol.bin.gz`))), { maxRows: 1_000_000 });
  return (FIG = { data, B, fade: makeFade(data, B), bones: new Float32Array(12 * B.names.length), shadow: B.names.indexOf('shadow') });
}
function covers(v, s, w, h, share = fadeOf(eyeOf(v), s)) {
  const { data, B, fade, bones, shadow } = figure(), P = projector(v, w, h), e = P.eye;
  fade.set(share);
  pose(bones, B, s, 0, true);
  const cell = h / 36, gw = Math.ceil(w / cell), gh = 36, grid = new Uint8Array(gw * gh), f = h / 2 / Math.tan(v.fov / 2);
  for (let i = B.first; i < B.end; i++) {
    const o = i * 16, b = data[o + 12];
    if (data[o + 3] === 0 || b === shadow) continue;
    const q = 12 * b, x = data[o], y = data[o + 1], z = data[o + 2];
    const p = [bones[q] * x + bones[q + 1] * y + bones[q + 2] * z + bones[q + 9], bones[q + 3] * x + bones[q + 4] * y + bones[q + 5] * z + bones[q + 10], bones[q + 6] * x + bones[q + 7] * y + bones[q + 8] * z + bones[q + 11]];
    const sp = P(p);
    if (!sp) continue;
    const r = 2 * Math.sqrt(Math.max(data[o + 4], data[o + 8], data[o + 10])) * f / Math.max(0.05, Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2])) / cell;
    const cx = sp[0] / cell, cy = sp[1] / cell;
    for (let gy = Math.max(0, Math.floor(cy - r)); gy <= Math.min(gh - 1, Math.floor(cy + r)); gy++)
      for (let gx = Math.max(0, Math.floor(cx - r)); gx <= Math.min(gw - 1, Math.floor(cx + r)); gx++)
        if ((gx + 0.5 - cx) ** 2 + (gy + 0.5 - cy) ** 2 <= (r + 0.5) ** 2) grid[gy * gw + gx] = 1;
  }
  fade.set(0);
  let n = 0;
  for (const g of grid) n += g;
  return n / grid.length;
}
if (!skipWorlds) {
  /* Each route walked at run speed with no look input (the explorer's swing), and the view swept round at each waypoint (8 yaws, 1.5 s
     each). The pass numbers are what the fix gives with a margin; the camera of stage 1 stood under 0.6 of its distance on 28 to 32%
     of route steps, filled more than 45% of the height on 21 to 22%, had the whole ring on screen on 0 to 5% and a foe 3.5 m to each
     side on 0 to 63%, and turned up to 62° in one step */
  const PASS = { far: 0.95, big: 0.03, hidden: 0.03, inside: 0.01, turn: 4.5, ringTall: 0.9, ringWide: 0.55, sideTall: 0.95, sideWide: 0.8 };
  const rows = [];
  for (const name of Object.keys(LAYOUTS)) {
    const [w, h] = LAYOUTS[name], tall = w < h;
    const tot = { steps: 0, far: 0, big: 0, hidden: 0, inside: 0, ring: 0, side: 0, turn: 0, sweeps: 0, sweepFar: 0, sweepBig: 0, byPlace: {} };
    for (const id of ORDER) {
      const { walk } = place(id), pts = ROUTES[id], floor = (x, z, y) => walk.support(x, z, y + 1.6) ?? walk.top(x, z);
      const b = makeBody(walk, { p: pts[0], yaw: 0 }, 34), s = b.s;
      const yaw0 = Math.atan2(pts[1][0] - pts[0][0], pts[1][2] - pts[0][2]), cam = cameraFor(walk, name, yaw0 + Math.PI);
      s.yaw = yaw0; cam.snap(s, yaw0 + Math.PI);
      const len = i => Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][2] - pts[i][2]);
      let seg = 0, t = 0, last = null;
      for (;;) {
        t += 6.4 * STEP;
        while (seg < pts.length - 1 && t > len(seg)) t -= len(seg++);
        if (seg >= pts.length - 1) break;
        const A = pts[seg], B = pts[seg + 1], k = t / len(seg), hd = Math.atan2(B[0] - A[0], B[2] - A[2]);
        s.x = A[0] + (B[0] - A[0]) * k; s.z = A[2] + (B[2] - A[2]) * k;
        const yy = A[1] + (B[1] - A[1]) * k;
        s.y = walk.support(s.x, s.z, yy + 1.2) ?? yy;
        s.vx = Math.sin(hd) * 6.4; s.vz = Math.cos(hd) * 6.4; s.ground = true;
        s.yaw += wrap(hd - s.yaw) * Math.min(1, 12 * STEP);
        const v = cam.follow(s, STEP, {}), P = projector(v, w, h), e = P.eye;
        tot.steps++;
        if (v.dist >= 0.6 * cam.c.want) tot.far++;
        const fig = (P([s.x, s.y, s.z])?.[1] ?? 0) - (P([s.x, s.y + 1.6, s.z])?.[1] ?? h * 2);
        if (fig > 0.45 * h) tot.big++;
        if (!clearLine(walk, e[0], e[1], e[2], s.x, s.y + 0.9, s.z) && !clearLine(walk, e[0], e[1], e[2], s.x, s.y + 1.5, s.z)) { tot.hidden++; tot.byPlace[id] = (tot.byPlace[id] || 0) + 1; }
        if (walk.support(e[0], e[2], e[1]) === null) tot.inside++;
        let ring = 0;
        for (let q = 0; q < 16; q++) {
          const x = s.x + 4 * Math.cos(q * Math.PI / 8), z = s.z + 4 * Math.sin(q * Math.PI / 8), p = P([x, floor(x, z, s.y), z]);
          if (p && p[0] >= 0 && p[0] <= w && p[1] >= 0 && p[1] <= h) ring++;
        }
        if (ring === 16) tot.ring++;
        const rt = [Math.cos(v.yaw), -Math.sin(v.yaw)];
        if ([-1, 1].every(sg => { const x = s.x + rt[0] * 3.5 * sg, z = s.z + rt[1] * 3.5 * sg, y = floor(x, z, s.y); return [P([x, y, z]), P([x, y + 0.9, z])].every(p => p && p[0] >= 0 && p[0] <= w && p[1] >= 0 && p[1] <= h); })) tot.side++;
        if (last) tot.turn = Math.max(tot.turn, Math.acos(Math.min(1, Math.cos(v.pitch) * Math.cos(last.pitch) * Math.cos(v.yaw - last.yaw) + Math.sin(v.pitch) * Math.sin(last.pitch))) / DEG);
        last = v;
      }
      for (const p of pts) for (let k = 0; k < 8; k++) {
        const yaw = (k * Math.PI) / 4, c2 = cameraFor(walk, name, yaw);
        b.place(p, yaw + Math.PI); c2.snap(b.s, yaw);
        let v;
        for (let i = 0; i < 90; i++) v = c2.follow(b.s, STEP, {});
        const P = projector(v, w, h), fig = (P([b.s.x, b.s.y, b.s.z])?.[1] ?? 0) - (P([b.s.x, b.s.y + 1.6, b.s.z])?.[1] ?? h * 2);
        tot.sweeps++;
        if (v.dist >= 0.6 * c2.c.want) tot.sweepFar++;
        if (fig > 0.45 * h) tot.sweepBig++;
      }
    }
    const share = k => tot[k] / tot.steps;
    const row = { name, steps: tot.steps, far: r2(share('far')), big: +share('big').toFixed(3), hidden: +share('hidden').toFixed(3), inside: +share('inside').toFixed(3), ring: r2(share('ring')), side: r2(share('side')), turn: +tot.turn.toFixed(1), sweepFar: r2(tot.sweepFar / tot.sweeps), sweepBig: +(tot.sweepBig / tot.sweeps).toFixed(3) };
    row.hiddenIn = tot.byPlace;
    rows.push(row);
    assert(row.far >= PASS.far && tot.sweepFar / tot.sweeps >= PASS.far, `${name}: the camera stood at 0.6 of its distance or more on ${row.far} of route steps and ${row.sweepFar} of sweeps`);
    assert(row.big <= PASS.big && row.sweepBig <= PASS.big, `${name}: the figure filled more than 45% of the height on ${row.big} of steps and ${row.sweepBig} of sweeps`);
    assert(row.hidden <= PASS.hidden, `${name}: the lamplighter was hidden on ${row.hidden} of steps`);
    assert(row.inside <= PASS.inside, `${name}: the eye was inside the scenery on ${row.inside} of steps`);
    assert(row.turn <= PASS.turn, `${name}: the view turned ${row.turn}° in one step`);
    assert(row.ring >= (tall ? PASS.ringTall : PASS.ringWide), `${name}: the whole 4 m ring was on screen on ${row.ring} of steps`);
    assert(row.side >= (tall ? PASS.sideTall : PASS.sideWide), `${name}: a foe 3.5 m to each side was on screen on ${row.side} of steps`);
  }
  pass('the five routes at five layouts: the camera stays back, rises over the scenery, and keeps the ground round the lamplighter in view', rows);

  /* The torn cell of the Gaol, where its first wisp hangs: a cell 1.8 m wide and 1.9 deep under the first tier, its floor 2.2 under a
     roof, open to the yard through a mouth under a lintel. The player's report: "where the first coin is it zooms in too much".
     Before 2337588c a phone's camera (aim 1.8) stood 0.5 m from the aim walking in from the yard, its line in the lintel. Now, walking
     in from the yard, the eye ends out in the yard at the layout's distance from within 20° of square to the mouth, and at least 2 m
     back from 35° (the aim comes down under the roof). And where the walls bring the eye in, the field of view widens (the follow zoom) */
  {
    const { walk } = place('gaol'), cell = [1.6, -1.7], rows = [];
    for (const name of ['1280x720', '390x844']) {
      const [w, h] = LAYOUTS[name], L = camLayout(w, h);
      for (const ang of [0, 20, 35, -35]) {
        const a = ang * DEG, sx = cell[0] + Math.sin(a) * 6, sz = cell[1] + Math.cos(a) * 6;
        const b = makeBody(walk, { p: [sx, walk.top(sx, sz) + 0.3, sz], yaw: a + Math.PI }, 34), cam = cameraFor(walk, name, a);
        cam.snap(b.s, a);
        let v;
        for (let i = 0; i < 240; i++) {
          const dx = cell[0] - b.s.x, dz = cell[1] - b.s.z, dd = Math.hypot(dx, dz), y = cam.c.yaw;
          const inp = dd > 0.25 ? { mx: (dx * Math.cos(y) - dz * Math.sin(y)) / dd, mz: -(dx * Math.sin(y) + dz * Math.cos(y)) / dd } : {};
          b.step(STEP, inp, y);
          v = cam.follow(b.s, STEP, { ...inp, mouse: true });
        }
        assert(Math.hypot(b.s.x - cell[0], b.s.z - cell[1]) < 0.5 && b.s.y < -2, `${name} from ${ang}°: the lamplighter walked into the cell (${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)}, ${b.s.z.toFixed(2)})`);
        /* from 35° (each way), with the mouse taken, the view may not turn by itself to the mouth, so the walls bring the eye in: it
           stands 2 m back, or the near fade leaves out the whole figure, the lantern and the blade too (it covers at most 15%) */
        const least = Math.abs(ang) <= 20 ? L.dist - 0.05 : 2, cover = covers(v, b.s, w, h);
        assert(v.dist >= least || (Math.abs(ang) > 20 && fadeOf(eyeOf(v), b.s) === NEAR_FADE.all && cover <= 0.15), `${name} from ${ang}°: in the cell the eye stands ${v.dist.toFixed(2)} back, not out in the yard (${least.toFixed(2)}), and the figure covers ${(cover * 100).toFixed(0)}%`);
        rows.push({ name, from: ang, dist: r2(v.dist), pitch: r2(v.pitch), cover: r2(cover) });
      }
    }
    // the follow zoom itself: none from CLOSE out, the view as tall as from CLOSE nearer in, and its caps
    const L = camLayout(1280, 720);
    assert.equal(zoomFov(L.fov, 8.5, L.asp), L.fov);
    assert.equal(zoomFov(L.fov, ZOOM.close, L.asp), L.fov);
    assert(near(2 * 2 * Math.tan(zoomFov(L.fov, 2, L.asp) / 2), 2 * ZOOM.close * Math.tan(L.fov / 2), 1e-9), 'from 2 m the view is as tall as from CLOSE');
    assert(near(2 * Math.atan(Math.tan(zoomFov(L.fov, 0.3, L.asp) / 2) * L.asp), ZOOM.wide, 1e-9), 'across, the view is at most 110°');
    const T = camLayout(390, 844);
    assert(near(zoomFov(T.fov, 0.3, T.asp), ZOOM.most, 1e-9), 'upright, the view is at most 90° tall');
    pass('the Gaol\'s torn cell: walking in, the eye stays out in the yard, and the view widens as it comes in', rows);
  }

  /* A full turn of the mouse in 6 s, standing at three places in the torn cell and at every wisp of the five places, at 1280x720 and
     390x844 ("it zooms in too much"; "mouse feels good"). While the mouse turns the view, a nook has walls on most sides, so the eye
     cannot stand back at every yaw the player turns to: on each step the eye stands at least 2.5 m back, or the near fade leaves the
     figure out whole (the eye in 0.9 m of it), and never nearer than 0.5; it sees the head as it settles (it never stands over a bell's
     crown with the figure hidden under it); and on every step the lamplighter as drawn (posed, less the near fade's share) covers at
     most 35% of the view. The share of steps in between (the eye 0.9 to 2.5 m back, a share of the figure left out) is at most 35% at
     a spot and 6% over all. Once the mouse stops, the framed shot leans the view (at most 60°) to a clear yaw: in the torn cell the eye
     stands 2.5 m back again within 1.5 s. The framed shot of 100a12c4 kept the eye 2.5 m back on 91% of the steps by showing the
     picture from a yaw up to 150° from the mouse's, so the picture stood still while the mouse turned (on 68 to 92% of the steps in
     the cell), and a move went sideways on screen; the mouse checks are in gloam-downs-mouse.test.mjs */
  {
    const rows = [], spots = [['gaol', 1.6, -1.6], ['gaol', 1.6, -2.1], ['gaol', 1.6, -0.9]];
    for (const id of ORDER) for (const wp of place(id).meta.wisps) spots.push([id, wp.p[0], wp.p[2], wp.p[1]]);
    for (const name of ['1280x720', '390x844']) {
      const [w, h] = LAYOUTS[name];
      let worstMid = 0, worstCover = 0, worstLeast = Infinity, mid = 0, back = 0, all = 0;
      for (const [k, [id, x, z, wy]] of spots.entries()) {
        const { walk } = place(id), y = wy === undefined ? walk.floor(x, z) : walk.support(x, z, wy + 0.5) ?? walk.floor(x, z);
        const b = stand(walk, x, z, Math.PI, y), cam = cameraFor(walk, name, 0);
        cam.snap(b.s, 0);
        let n = 0, m = 0, least = Infinity, cover = 0;
        for (let i = 0; i < 420; i++) {
          b.step(STEP, {}, cam.c.yaw);
          const v = cam.follow(b.s, STEP, i < 60 ? { mouse: true } : { dyaw: 2 * Math.PI / 360, mouse: true });
          if (i === 59) {
            const e = eyeOf(v);
            // or the cutaway leaves out what stands between (the splats themselves are checked in the cutaway's sweep below)
            assert(v.cut || clearLine(walk, e[0], e[1], e[2], b.s.x, b.s.y + 1.3, b.s.z), `${name} ${id} at ${x.toFixed(1)}, ${z.toFixed(1)}: the settled eye does not see the head`);
          }
          if (i < 60) continue;
          n++; all++;
          if (v.dist >= 2.5) back++;
          else if (fadeOf(eyeOf(v), b.s) < NEAR_FADE.most) { m++; mid++; }
          least = Math.min(least, v.dist);
          if (i % 2 === 0 || v.dist < 2.5) cover = Math.max(cover, covers(v, b.s, w, h));
        }
        const tag = `${name} ${id} at ${x.toFixed(1)}, ${z.toFixed(1)}`;
        assert(m / n <= 0.35, `${tag}: the eye stood 0.9 to 2.5 m back with the figure partly drawn on ${(m / n).toFixed(2)} of a sweep`);
        assert(least >= 0.5 - 1e-9, `${tag}: a sweep brought the eye ${least.toFixed(2)} from the aim`);
        assert(cover <= 0.35, `${tag}: the lamplighter covered ${(cover * 100).toFixed(0)}% of the view`);
        worstMid = Math.max(worstMid, m / n); worstCover = Math.max(worstCover, cover); worstLeast = Math.min(worstLeast, least);
      }
      assert(mid / all <= 0.06, `${name}: the eye stood 0.9 to 2.5 m back with the figure partly drawn on ${(mid / all).toFixed(3)} of all sweeps`);
      rows.push({ name, spots: spots.length, back: r2(back / all), between: +(mid / all).toFixed(3), worstBetween: r2(worstMid), least: r2(worstLeast), cover: r2(worstCover) });
    }
    pass('a sweep of the mouse in the torn cell and at every wisp: the eye stands back or the figure is left out, it sees the head, and the figure never fills the view', rows);
  }
  /* The cutaway ("it zooms in too much"; the review of 19b99dd8: in the torn cell, with the mouse looking away from the mouth, the eye
     came to about 1 m and the near fade hid the figure, a blurry close view of walls). A full turn of the mouse in 6 s, 1° a step, at
     the same 28 spots (three in the torn cell, the 25 wisps), at 1280x720 and 390x844, with the place's own splats cut away as the page
     does (cut.js, stepped with each view). The eye stands at least 2.5 m back on 98% of the steps at each spot and 99.5% over all,
     and the near fade never thins the figure; the figure shows (the near fade leaving it whole, and its head or its chest at least
     half seen through the splats at their densities now, each splat counted as round as it is wide, so flat ones seen edge on count
     against it) on 93% of all steps, and on 98% of the steps where the cutaway is whole;
     at a spot the share may fall to 75% (posts and lanterns the camera looks past by design, thin in the walk map, stand between at
     8.5 m); it covers at most 25% of the view; the picture turns by 80 to 120% of each 1° step, and in the cutaway by the whole step;
     and the cutaway, once off, does not come on again within 0.25 s. Before (19b99dd8) the eye stood 2.5 m back on 70% (1280x720)
     and 74% (390x844) of all steps, and on 7 to 28% at the three spots in the torn cell (the rest nearer, the figure left out by the
     near fade) */
  {
    const CUTPASS = { back: 0.98, all: 0.995, seen: 0.75, seenAll: 0.93, seenCut: 0.98, cover: 0.25 };
    const SplatCodec = new Function(fs.readFileSync(DIR + 'ink/splat-codec.js', 'utf8') + '\nreturn SplatCodec;')();
    const splats = {};
    const splatsOf = id => {
      if (splats[id]) return splats[id];
      const { meta } = place(id), { data, count } = SplatCodec.decode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${DIR}worlds/${id}.bin.gz`))), { maxRows: 1_000_000 });
      return (splats[id] = { data, cut: makeCut(data, { count, skip: [[meta.bones.first, meta.bones.end], ...meta.beacon.fire, ...meta.wisps.map(w => w.ids)] }) });
    };
    const rows = [], spots = [['gaol', 1.6, -1.6], ['gaol', 1.6, -2.1], ['gaol', 1.6, -0.9]];
    for (const id of ORDER) for (const wp of place(id).meta.wisps) spots.push([id, wp.p[0], wp.p[2], wp.p[1]]);
    for (const name of ['1280x720', '390x844']) {
      const [w, h] = LAYOUTS[name];
      let all = 0, back = 0, faded = 0, cutSteps = 0, seenAll = 0, cutSeen = 0, cutFull = 0, worstBack = 1, worstSeen = 1, worstCover = 0, lo = Infinity, hi = 0, flick = 0, worstAt = '';
      for (const [id, x, z, wy] of spots) {
        const { walk } = place(id), { data, cut } = splatsOf(id), y = wy === undefined ? walk.floor(x, z) : walk.support(x, z, wy + 0.5) ?? walk.floor(x, z);
        const b = stand(walk, x, z, Math.PI, y), cam = cameraFor(walk, name, 0);
        cam.snap(b.s, 0);
        const grid = (e, p) => cut.around(e, p, 0.6);
        let n = 0, nb = 0, seen = 0, cover = 0, prev = null, offAt = -99, was = false, cutRun = 0;
        for (let i = 0; i < 420; i++) {
          b.step(STEP, {}, cam.c.yaw);
          const v = cam.follow(b.s, STEP, i < 60 ? { mouse: true } : { dyaw: DEG, mouse: true });
          cut.step(v.cut ? eyeOf(v) : null, [b.s.x, b.s.y + CUT.mid, b.s.z], STEP);
          if (i >= 60) {
            n++; all++;
            if (v.dist >= 2.5) { nb++; back++; }
            if (v.cut) cutSteps++;
            const r = wrap(v.yaw - prev) / DEG;
            lo = Math.min(lo, r); hi = Math.max(hi, r);
            if (v.cut) assert(Math.abs(r - 1) < 1e-6, `${name} ${id} at ${x.toFixed(1)}, ${z.toFixed(1)}: in the cutaway a 1° step turned the picture by ${r.toFixed(3)}°`);
            // the figure shows only where the near fade leaves it whole too (the review of 8afff94f: a figure faded out counted as seen)
            const e = eyeOf(v), shows = fadeOf(e, b.s) > 0 ? 0 : Math.max(showing(data, grid, e, [b.s.x, b.s.y + 1.3, b.s.z]), showing(data, grid, e, [b.s.x, b.s.y + 0.8, b.s.z]));
            if (fadeOf(e, b.s) > 0) faded++;
            if (shows >= 0.5) { seen++; seenAll++; }
            // the cutaway whole (eased in over CUT.in s): the splats between are out, so the figure shows
            if (v.cut && cam.c.cut && (cutRun += STEP) > CUT.in + STEP) { cutFull++; if (shows >= 0.5) cutSeen++; }
            if (!cam.c.cut) cutRun = 0;
            if (i % 3 === 0) cover = Math.max(cover, covers(v, b.s, w, h));
            if (v.cut && !was && i - offAt < 15) flick++;
            if (!v.cut && was) offAt = i;
          }
          was = v.cut; prev = v.yaw;
        }
        cut.reset();
        const tag = `${name} ${id} at ${x.toFixed(1)}, ${z.toFixed(1)}`;
        if (nb / n < worstBack) worstAt = tag;
        assert(nb / n >= CUTPASS.back, `${tag}: the eye stood 2.5 m back on ${(nb / n).toFixed(2)} of a sweep`);
        assert(seen / n >= CUTPASS.seen, `${tag}: the figure showed on ${(seen / n).toFixed(2)} of a sweep`);
        assert(cover <= CUTPASS.cover, `${tag}: the figure covered ${(cover * 100).toFixed(0)}% of the view`);
        worstBack = Math.min(worstBack, nb / n); worstSeen = Math.min(worstSeen, seen / n); worstCover = Math.max(worstCover, cover);
      }
      assert(back / all >= CUTPASS.all, `${name}: the eye stood 2.5 m back on ${(back / all).toFixed(3)} of all sweeps`);
      assert(lo >= 0.8 && hi <= 1.2, `${name}: a 1° step turned the picture by ${lo.toFixed(2)} to ${hi.toFixed(2)}°`);
      assert(seenAll / all >= CUTPASS.seenAll, `${name}: the figure showed on ${(seenAll / all).toFixed(3)} of all sweeps`);
      assert(cutSeen / cutFull >= CUTPASS.seenCut, `${name}: in the cutaway the figure showed on ${(cutSeen / cutFull).toFixed(3)} of its steps`);
      assert.equal(flick, 0, `${name}: the cutaway went off and on again within 0.25 s ${flick} times`);
      assert.equal(faded, 0, `${name}: the near fade thinned the figure on ${faded} steps of the sweeps`);
      rows.push({ name, spots: spots.length, back: +(back / all).toFixed(3), faded, worstBack: r2(worstBack), worstAt, seen: r2(worstSeen), seenAll: +(seenAll / all).toFixed(3), seenCut: +(cutSeen / cutFull).toFixed(3), cover: r2(worstCover), cut: +(cutSteps / all).toFixed(3), turn: [r2(lo), r2(hi)] });
    }
    pass('the cutaway: a sweep of the mouse in the torn cell and at every wisp keeps the eye 2.5 m back, the figure in sight and the turn the player\'s', rows);
  }
  /* A slow pan in from the mouth (the review of 8afff94f: at 1280x720, turning slowly from the mouth into the torn cell, the follow eye
     came in to 0.8 to 1 m, the near fade hid the whole figure for about 20 steps, and only then did the cutaway come on and ease the
     eye out to 3.2 m, up to 0.41 m in one step: a pump in, blind, and a pop out). At the three spots in the torn cell and the Gaol's
     wisp at (7.6, -2.2), at 1280x720 and 390x844, the mouse turns the view from the mouth at 0.5, 1 and 2° a step for a full turn. On
     every step the view stands at least 2.5 m back and the near fade leaves the figure whole, and while the cutaway is on the view's
     distance grows by no more than TIGHT.grow m/s up to TIGHT.dist (and by no more than the follow eye's 12 m/s going out). Before, at
     (1.6, -0.9) at 1280x720, 28 of 360 steps at 1° a step stood nearer than 2.5 m or faded the figure */
  {
    const rows = [], spots = [['gaol', 1.6, -1.6], ['gaol', 1.6, -2.1], ['gaol', 1.6, -0.9], ['gaol', 7.6, -2.2, 1.7]];
    for (const name of ['1280x720', '390x844']) for (const rate of [0.5, 1, 2]) {
      let steps = 0, least = Infinity, grow = 0, out = 0;
      for (const [id, x, z, wy] of spots) {
        const { walk } = place(id), y = wy === undefined ? walk.floor(x, z) : walk.support(x, z, wy + 0.5) ?? walk.floor(x, z);
        const b = stand(walk, x, z, Math.PI, y), cam = cameraFor(walk, name, 0);
        cam.snap(b.s, 0);
        let prev = null;
        for (let i = 0; i < 60 + Math.ceil(360 / rate); i++) {
          b.step(STEP, {}, cam.c.yaw);
          const v = cam.follow(b.s, STEP, i < 60 ? { mouse: true } : { dyaw: rate * DEG, mouse: true });
          if (i < 60) { prev = v.dist; continue; }
          steps++;
          const tag = `${name} ${(rate)}°/step at ${x.toFixed(1)}, ${z.toFixed(1)}, step ${i - 60}`, f = fadeOf(eyeOf(v), b.s);
          assert(v.dist >= 2.5 && f === 0, `${tag}: the view stands ${v.dist.toFixed(2)} m back with a near fade of ${f} (cutaway ${v.cut})`);
          least = Math.min(least, v.dist);
          if (v.cut && v.dist > prev) {
            const by = (v.dist - prev) / STEP;
            if (prev < TIGHT.dist - 1e-6) { grow = Math.max(grow, by); assert(by <= TIGHT.grow + 1e-6, `${tag}: in the cutaway the view went out at ${by.toFixed(1)} m/s`); }
            else { out = Math.max(out, by); assert(by <= 12 + 1e-6, `${tag}: the view went out at ${by.toFixed(1)} m/s`); }
          }
          prev = v.dist;
        }
      }
      rows.push({ name, rate, steps, least: r2(least), grow: r2(grow), out: r2(out) });
    }
    pass('a slow pan in from the mouth: on every step the view stands 2.5 m back with the figure whole, and the cutaway never pops out', rows);
  }
  /* The mouse's pitch in the cutaway (the review of 8afff94f: there the view's pitch was the least that cleared the roof at or over the
     mouse's, so the mouse down did not move the picture, up barely did until it passed about 1.1 rad, and the mouse's own pitch went on
     changing out of sight and swung in as the cutaway ended). In the torn cell and at the Gaol's wisp, with the cutaway whole, each
     step of the mouse's pitch (0.3° and 1°, up and down) moves the view's pitch by just as much as the mouse's own pitch moves: up by
     the whole step until TIGHT.top, down until the eye would leave the open, where both stop. The view's pitch is never over TIGHT.top
     (at the wisp the old rise had put it at 1.28 rad, looking almost straight down on the figure) */
  {
    const rows = [], spots = [['gaol', 1.6, -1.6, 180], ['gaol', 1.6, -2.1, 180], ['gaol', 1.6, -0.9, 120], ['gaol', 7.6, -2.2, 90, 1.7]];
    for (const name of ['1280x720', '390x844']) for (const [id, x, z, turn, wy] of spots) {
      const { walk } = place(id), y = wy === undefined ? walk.floor(x, z) : walk.support(x, z, wy + 0.5) ?? walk.floor(x, z);
      const b = stand(walk, x, z, Math.PI, y), cam = cameraFor(walk, name, 0);
      cam.snap(b.s, 0);
      let v;
      const st = inp => { b.step(STEP, {}, cam.c.yaw); return (v = cam.follow(b.s, STEP, { mouse: true, ...inp })); };
      for (let i = 0; i < 60; i++) st({});
      for (let i = 0; i < turn; i++) st({ dyaw: DEG });
      for (let i = 0; i < 60; i++) st({});
      const tag = `${name} at ${x.toFixed(1)}, ${z.toFixed(1)}`;
      if (!(cam.c.cut && cam.c.cutK === 1)) { rows.push({ tag, cut: false }); assert(name === '390x844' && wy !== undefined, `${tag}: the cutaway is not on`); continue; }
      const row = { tag, from: r2(v.pitch) };
      let up = 0, down = 0, stopped = 0;
      for (const [dp, n] of [[0.3, 20], [-0.3, 40], [1, 40], [-1, 80]]) for (let i = 0; i < n; i++) {
        const pv = v.pitch, pc = cam.c.pitch;
        st({ dpitch: dp * DEG });
        const dv = v.pitch - pv, dc = cam.c.pitch - pc;
        assert(cam.c.cut && v.pitch <= TIGHT.top + 1e-9, `${tag}: the view's pitch ${v.pitch.toFixed(3)} in the cutaway`);
        assert(Math.abs(dv - dc) < 2e-3, `${tag}: a mouse step of ${dp}° moved the view by ${(dv / DEG).toFixed(3)}° and the mouse's pitch by ${(dc / DEG).toFixed(3)}°`);
        // a step moves the view by the whole step, or by part of it where it reaches a limit (and then by none)
        assert(dv * dp >= -1e-9 && Math.abs(dv) <= Math.abs(dp * DEG) + 2e-3, `${tag}: a mouse step of ${dp}° moved the view by ${(dv / DEG).toFixed(3)}°`);
        if (Math.abs(dv - dp * DEG) >= 2e-3) { stopped++; assert(dp < 0 || cam.c.pitch >= 1.05 - 1e-9 || v.pitch >= TIGHT.top - 1e-6, `${tag}: a step up stopped at ${v.pitch.toFixed(3)}`); continue; }
        if (dp > 0) up++; else down++;
      }
      assert(up >= 20 && down >= 2, `${tag}: the view answered ${up} steps up and ${down} down`);
      Object.assign(row, { up, down, stopped, top: r2(v.pitch) });
      rows.push(row);
    }
    // a pitch up from where the cutaway starts reaches TIGHT.top or the mouse's own limit: the steps up that stopped were at the top
    pass('the mouse\'s pitch in the cutaway moves the view by as much as the mouse\'s own pitch, up to TIGHT.top, and none is left out of sight', rows);
  }
  /* Walking and the mouse together (the review of 8afff94f: in play the cutaway came back on 4, 9 and 17 steps after going off, and
     came on with the follow eye 13 to 15 m away, cutting a 15 m cone through the place). At the 28 spots, at 1280x720 and 390x844, two
     runs each of 15 s of made-up play: every 0.5 s a new move (none, a walk or a run in any direction, or forward) and a new turn and
     pitch of the mouse (up to 1.5° and 0.3° a step). Once off, the cutaway never comes back on within 0.25 s unless the follow eye has
     come within TIGHT.in (where it would otherwise hide the figure); it never comes on with the follow eye farther out than TIGHT.near, but where no rise clears the room and something already
     stands between; and the
     near fade thins the figure on under 0.5% of the steps (running through a lane, or walking past a wall in the open, where the
     cutaway does not come on by design). Before, the fade did on 0.88% */
  {
    const spots = [['gaol', 1.6, -1.6], ['gaol', 1.6, -2.1], ['gaol', 1.6, -0.9]];
    for (const id of ORDER) for (const wp of place(id).meta.wisps) spots.push([id, wp.p[0], wp.p[2], wp.p[1]]);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let steps = 0, faded = 0, again = 0, near = 0, far = 0, easing = 0;
    for (const name of ['1280x720', '390x844']) for (const [id, x, z, wy] of spots) for (let t = 0; t < 2; t++) {
      const { walk } = place(id), y = wy === undefined ? walk.floor(x, z) : walk.support(x, z, wy + 0.5) ?? walk.floor(x, z);
      const b = stand(walk, x, z, Math.PI, y), cam = cameraFor(walk, name, 0);
      cam.snap(b.s, 0);
      let mv = {}, look = {}, was = false, offAt = -99;
      for (let i = 0; i < 900; i++) {
        if (i % 30 === 0) {
          const r = rnd();
          mv = r < 0.3 ? {} : r < 0.6 ? { mx: rnd() * 2 - 1, mz: rnd() * 2 - 1 } : { mz: rnd() < 0.5 ? 0.5 : 0 };
          look = { dyaw: (rnd() - 0.5) * 3 * DEG, dpitch: (rnd() - 0.5) * 0.6 * DEG, mouse: true };
        }
        b.step(STEP, mv, cam.c.yaw);
        const d0 = cam.c.dist, v = cam.follow(b.s, STEP, look);
        steps++;
        if (fadeOf(eyeOf(v), b.s) > 0) faded++;
        // it comes on farther out only where no rise clears the room and something already stands between (a camera still coming in
        // from far comes in with the splats between cut)
        if (v.cut && !was && cam.c.cut && !(cam.c.goal.dist < TIGHT.in && cam.c.hidden > 0)) far = Math.max(far, d0);
        if (v.cut && !cam.c.cut) easing = Math.max(easing, v.dist);
        if (v.cut && !was && i - offAt < 15) { if (d0 < TIGHT.in) near++; else again++; }
        if (!v.cut && was) offAt = i;
        was = v.cut;
      }
    }
    assert.equal(again, 0, `the cutaway came back on within 0.25 s ${again} times with the follow eye out of the way`);
    assert(far < TIGHT.near, `the cutaway came on with the follow eye ${far.toFixed(2)} m out`);
    assert(faded / steps < 0.005, `the near fade thinned the figure on ${(faded / steps * 100).toFixed(2)}% of the steps`);
    pass('walking and the mouse together: the cutaway does not flicker, comes on only with the follow eye near (or the figure already hidden), and the figure is whole on 99.5% of the steps', { steps, faded: +(faded / steps * 100).toFixed(2), againNear: near, far: r2(far), easing: r2(easing) });
  }
  /* The mouse stops in a nook ("it zooms in too much"; "mouse feels good"). At three spots in the torn cell and at the Gaol's wisp at
     (7.6, -2.2), at 1280x720 and 390x844, the mouse turns the view from the mouth by 0 to 315° (8 yaws, 1° a step) and then stops.
     With the mouse taken, and again with reduced motion, nothing turns the view in the next 1.5 s (the framed shot leans only while the
     player turns: spec "A calm camera"), and 1.5 s after the mouse stops the eye stands at least 2.5 m back, or no part of the figure
     (the lantern and the blade included) covers more than 15% of the view. With a stick and the mouse free, the view stays still for
     AUTO.wait s too, and then the lean may turn it, at no more than SHOT.turn (0.5 rad/s). The build of 1974d668 turned the view by
     itself by up to 43° in 0.5 s with the mouse taken, and settled the eye 0.95 to 1.3 m back with the lantern and the blade over much
     of the view */
  {
    const rows = [], spots = [['gaol', 1.6, -1.6], ['gaol', 1.6, -2.1], ['gaol', 1.6, -0.9], ['gaol', 7.6, -2.2, 1.7]];
    for (const name of ['1280x720', '390x844']) {
      const [w, h] = LAYOUTS[name];
      let cases = 0, moved = 0, worstCover = 0, near = 0, padMax = 0, padEarly = 0;
      for (const [id, x, z, wy] of spots) for (let k = 0; k < 8; k++) for (const how of ['mouse', 'still', 'stick']) {
        const { walk } = place(id), y = wy === undefined ? walk.floor(x, z) : walk.support(x, z, wy + 0.5) ?? walk.floor(x, z);
        const b = stand(walk, x, z, Math.PI, y), cam = cameraFor(walk, name, 0, { auto: how !== 'still' });
        cam.snap(b.s, 0);
        const look = how === 'stick' ? {} : { mouse: true };
        for (let i = 0; i < 60; i++) { b.step(STEP, {}, cam.c.yaw); cam.follow(b.s, STEP, look); }
        for (let i = 0; i < k * 45; i++) { b.step(STEP, {}, cam.c.yaw); cam.follow(b.s, STEP, { ...look, dyaw: DEG }); }
        const y0 = cam.c.yaw;
        let v, most = 0;
        for (let i = 0; i < 90; i++) { b.step(STEP, {}, cam.c.yaw); v = cam.follow(b.s, STEP, look); most = Math.max(most, Math.abs(cam.c.yaw - y0)); }
        const tag = `${name} ${how} at ${x.toFixed(1)}, ${z.toFixed(1)}, turned ${k * 45}°`;
        cases++;
        assert.equal(most, 0, `${tag}: the view turned by itself by ${(most / DEG).toFixed(1)}° after the mouse stopped`);
        if (how === 'stick') {
          // past the wait the lean may turn the view, never faster than 0.5 rad/s
          let prev = cam.c.yaw;
          for (let i = 0; i < 180; i++) {
            b.step(STEP, {}, cam.c.yaw); v = cam.follow(b.s, STEP, look);
            const r = Math.abs(Math.atan2(Math.sin(cam.c.yaw - prev), Math.cos(cam.c.yaw - prev))) / STEP;
            padMax = Math.max(padMax, r);
            if (r > 0 && cam.c.idle <= 2) padEarly++;
            prev = cam.c.yaw;
          }
          continue;
        }
        const cover = v.dist >= 2.5 ? 0 : covers(v, b.s, w, h);
        if (v.dist < 2.5) near++;
        assert(cover <= 0.15, `${tag}: 1.5 s after the mouse stopped the eye stands ${v.dist.toFixed(2)} back and the figure covers ${(cover * 100).toFixed(0)}%`);
        worstCover = Math.max(worstCover, cover);
        if (most > 0) moved++;
      }
      assert(padMax <= 0.5 + 1e-6 && padEarly === 0, `${name}: with a stick the lean turned at up to ${padMax.toFixed(2)} rad/s, ${padEarly} steps before the wait`);
      rows.push({ name, cases, near, cover: r2(worstCover), stickRate: r2(padMax) });
    }
    pass('the mouse stops in a nook: nothing turns the view by itself with the mouse taken or reduced motion, and the eye stands back or the figure (its lantern and blade too) is left out', rows);
  }
  /* the near fade itself: an eye 0.5 m behind the hood (as the walls of a nook can leave it, the view widened to 90°). The figure drawn
     whole covers 30% of the view or more, and thinned by a share of 0.8 (2337588c's most) it covers nearly as much, for each splat left
     is drawn large; the fade there now leaves out all of it, the blade and the lantern too (within NEAR_FADE.hold, 1.6 m), and covers
     nothing. Kept, the blade and the lantern alone cover up to 10% from 0.5 m; from 1 to 1.3 m, looking out of the torn cell, they covered
     much of the view (the review of 1974d668) */
  {
    const { walk } = place('gaol'), b = stand(walk, -14.8, 8), out = [];
    for (const name of ['1280x720', '390x844']) {
      const [w, h] = LAYOUTS[name], L = camLayout(w, h), v = { target: [b.s.x, b.s.y + 1.15, b.s.z], dist: 0.5, yaw: 0, pitch: 0.3, fov: zoomFov(L.fov, 0.5, L.asp) };
      const share = fadeOf(eyeOf(v), b.s), whole = covers(v, b.s, w, h, 0), old = covers(v, b.s, w, h, 0.8), kept = covers(v, b.s, w, h, NEAR_FADE.most), now = covers(v, b.s, w, h);
      assert.equal(share, NEAR_FADE.all);
      assert(whole >= 0.3 && old >= 0.7 * whole && kept <= 0.1 && now === 0, `${name}: an eye 0.5 m away: whole ${r2(whole)}, at 0.8 ${r2(old)}, held kept ${r2(kept)}, faded ${r2(now)}`);
      out.push({ name, whole: r2(whole), at08: r2(old), heldKept: r2(kept), faded: r2(now) });
    }
    pass('the near fade: from 1.6 m in it leaves out all of the figure, the blade and the lantern too, and the view is clear, as a share of 0.8 did not make it', out);
  }
}

/* ---------------- the combat camera ---------------- */
// one step of the follow camera with a run camera's turn hook; returns the view
const stepCam = (cam, s, turn, inp = {}) => cam.follow(s, STEP, inp, turn);
// a foe at distance d and `deg` to the right of the view's forward direction (yaw), from s
const around = (s, yaw, d, deg) => {
  const fw = [-Math.sin(yaw), -Math.cos(yaw)], rt = [Math.cos(yaw), -Math.sin(yaw)], a = deg * DEG;
  return { x: s.x + d * (fw[0] * Math.cos(a) + rt[0] * Math.sin(a)), y: 0, z: s.z + d * (fw[1] * Math.cos(a) + rt[1] * Math.sin(a)) };
};
{ // a Snuffer 5 m away, 60° to the right: after 2 s with no look input the view turns right at no more than 0.6 rad/s, and stops at 20°
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '390x844', 0), foe = { id: 'S', ...around(b.s, 0, 5, 60) };
  const combat = makeCombat({ foes: () => [foe] });
  cam.snap(b.s, 0);
  let yaw = cam.c.yaw, fastest = 0, firstTurn = null;
  const d0 = yawDiff(cam.c.yaw, b.s, foe);
  for (let i = 1; i <= 180; i++) {
    stepCam(cam, b.s, combat.turn);
    const dy = Math.abs(wrap(cam.c.yaw - yaw)) / STEP;
    if (dy > 1e-9 && firstTurn === null) firstTurn = i * STEP;
    fastest = Math.max(fastest, dy);
    yaw = cam.c.yaw;
  }
  const d1 = yawDiff(cam.c.yaw, b.s, foe);
  // the snap leaves idle at 9 s (as after a load), so it turns at once
  // a foe to the right has a negative yaw difference: the yaw goes down to face it
  assert(d0 < 0 && cam.c.yaw < 0, `the foe is to the right (yaw difference ${d0 / DEG}°), and the view turned right (yaw ${cam.c.yaw})`);
  assert(fastest <= COMBAT.rate + 1e-9, `it turned at ${fastest} rad/s`);
  assert(Math.abs(d1) <= 20 * DEG + 1e-9 && Math.abs(d1) >= 19.5 * DEG, `it stopped at a yaw difference of ${d1 / DEG}°`);
  // with the wait: after a look input, nothing for 2 s
  const c2 = cameraFor(OPEN, '390x844', 0), m2 = makeCombat({ foes: () => [foe] });
  c2.snap(b.s, 0);
  stepCam(c2, b.s, m2.turn, { ox: 0.5 });
  const y0 = c2.c.yaw;
  let started = null;
  for (let i = 1; i <= 180; i++) { stepCam(c2, b.s, m2.turn); if (started === null && Math.abs(c2.c.yaw - y0) > 1e-9) started = i * STEP; }
  assert(near(COMBAT.wait, 2, 1e-9) && near(COMBAT.rate, 0.6, 1e-9), 'the wait is 2 s and the rate 0.6 rad/s');
  assert(started > COMBAT.wait - 1e-9 && started < COMBAT.wait + 2 * STEP, `after a look input the turn starts after ${started} s`);
  pass('the combat camera turns to a foe after 2 s, at 0.6 rad/s, and stops at 20°', { from: r2(d0 / DEG), to: r2(d1 / DEG), rate: r2(fastest), starts: r2(started) });
}
{ // no foe awake: the explorer's swing behind a running lamplighter comes back, as without the combat camera
  const run = (useCombat) => {
    const b = stand(OPEN, 0, 0, Math.PI / 2), cam = cameraFor(OPEN, '1280x720', 0), m = makeCombat({ foes: () => [] });
    cam.snap(b.s, 0); cam.c.idle = 0;
    for (let i = 0; i < 180; i++) { b.s.x += 5 * STEP; b.s.vx = 5; b.s.vz = 0; stepCam(cam, b.s, useCombat ? m.turn : null); }
    return cam.c.yaw;
  };
  const a = run(true), b2 = run(false);
  assert(near(a, b2, 1e-12) && Math.abs(a) > 0.3, `with no foe the swing turns the view as in the explorer (${a} and ${b2})`);
  pass('no foe awake: the explorer swing applies', { yaw: r2(a) });
}
{ // two Snuffers on opposite sides whose distances swap between 4.0 and 4.3 m every 0.5 s: the camera's foe does not change in 3 s
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '1280x720', 0);
  const A = { id: 'A', x: 4, y: 0, z: 0 }, B = { id: 'B', x: -4.3, y: 0, z: 0 };
  const m = makeCombat({ foes: () => [A, B] });
  cam.snap(b.s, 0); cam.c.idle = 0;
  const seen = new Set();
  for (let i = 0; i < 180; i++) {
    const swap = Math.floor(i / 30) % 2 === 1;
    A.x = swap ? 4.3 : 4; B.x = swap ? -4 : -4.3;
    stepCam(cam, b.s, m.turn);
    seen.add(m.foe?.id);
  }
  assert.deepEqual([...seen], ['A'], `the camera's foe changed: ${[...seen]}`);
  // a foe 1.5 m nearer takes over
  B.x = -2.4; A.x = 4;
  stepCam(cam, b.s, m.turn);
  assert.equal(m.foe.id, 'B', 'a foe 1.5 m nearer takes over');
  pass('two foes at about the same distance: the camera keeps its foe, and changes to one 1.5 m nearer');
}
{ /* run away from a foe: a Snuffer held still 4 m behind the lamplighter. W and Shift for 3 s: the lamplighter walks 9 m (±1) to 13 m
     (±1) from it, the view turns toward it while it is in range, and the heading changes by 10° or less */
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '1280x720', 0), foe = { id: 'S', x: 0, y: 0, z: 4 };
  const m = makeCombat({ foes: () => [foe] }), lock = makeMoveLock();
  cam.snap(b.s, 0); cam.c.idle = 0.01;
  const yaw0 = b.s.yaw, held = { mz: 1, slow: true };
  let heading = 0, turned = 0;
  cam.c.idle = 9;
  for (let i = 0; i < 180; i++) {
    b.step(STEP, held, lock.yaw(held, cam.c));
    stepCam(cam, b.s, m.turn);
    if (i > 30) heading = Math.max(heading, Math.abs(wrap(b.s.yaw - yaw0)));
    if (Math.hypot(foe.x - b.s.x, foe.z - b.s.z) <= COMBAT.range) turned = Math.max(turned, Math.PI - Math.abs(yawDiff(cam.c.yaw, b.s, foe)));
  }
  const walked = Math.hypot(b.s.x, b.s.z), away = Math.hypot(foe.x - b.s.x, foe.z - b.s.z);
  assert(near(walked, 9, 1) && near(away, 13, 1), `it walked ${walked} m, to ${away} m from the Snuffer`);
  assert(turned > 0.9, `the view turned ${turned} rad toward the Snuffer while it was in range`);
  assert(heading <= 10 * DEG, `the heading changed by ${heading / DEG}°`);
  pass('running away from a foe: the move keeps its world direction while the view turns', { walked: r2(walked), away: r2(away), turned: r2(turned), heading: r2(heading / DEG) });
}
{ // the move lock, for either run camera: it holds the yaw where the turn started, and lets go when the stick turns by more than 20°,
  // when it is let go, and on a look input
  const lock = makeMoveLock(), c = { yaw: 1.2, from: 1.0, turning: true, idle: 1 };
  assert.equal(lock.yaw({ mz: 1 }, c), 1.0, 'it holds the yaw of the turn\'s start');
  c.yaw = 1.5; c.turning = false;
  assert.equal(lock.yaw({ mz: 1, mx: 0.3 }, c), 1.0, 'a stick turned by 17° keeps it, after the turn too');
  assert.equal(lock.yaw({ mz: 1, mx: 0.4 }, c), 1.5, 'a stick turned by 22° lets go');
  c.turning = true;
  assert.equal(lock.yaw({ mz: 1 }, c), 1.0);
  assert.equal(lock.yaw({}, c), 1.5, 'let go');
  assert.equal(lock.yaw({ mz: 1 }, c), 1.0);
  c.idle = 0;
  assert.equal(lock.yaw({ mz: 1 }, c), 1.5, 'a look input lets go');
  pass('the move lock holds the turn\'s start, and lets go at 20°, when let go, and on a look input');
}
{ // look input wins on the same step: the view follows only the player's input, and turns by itself again only after 2 s
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '1280x720', 0), foe = { id: 'S', ...around(b.s, 0, 5, 150) };
  const m = makeCombat({ foes: () => [foe] });
  cam.snap(b.s, 0); cam.c.idle = 0;
  for (let i = 0; i < 130; i++) stepCam(cam, b.s, m.turn);
  assert(m.turning, 'it turns by itself');
  const y0 = cam.c.yaw;
  stepCam(cam, b.s, m.turn, { ox: -0.3 });
  assert(near(cam.c.yaw - y0, -0.3 * 2.6 * STEP, 1e-12) && !m.turning, 'on the step of the look input the view follows only the input');
  const y1 = cam.c.yaw;
  let again = null;
  for (let i = 1; i <= 150; i++) { stepCam(cam, b.s, m.turn); if (again === null && Math.abs(cam.c.yaw - y1) > 1e-12) again = i * STEP; }
  assert(again > COMBAT.wait - 1e-9 && again < COMBAT.wait + 2 * STEP, `it turns by itself again after ${again} s`);
  pass('look input wins on the same step', { again: r2(again) });
}
{ // reduced motion: the combat camera never turns by itself
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '390x844', 0, { auto: false }), foe = { id: 'S', ...around(b.s, 0, 5, 90) };
  const m = makeCombat({ foes: () => [foe], still: true });
  cam.snap(b.s, 0); cam.c.idle = 0;
  for (let i = 0; i < 180; i++) stepCam(cam, b.s, m.turn);
  assert.equal(cam.c.yaw, 0, 'with reduced motion the view does not turn');
  pass('reduced motion: the combat camera does not turn');
}
{ // its foe is within 10 m and neither home nor walking home: a Snuffer at home 13 m away, or 11 m away, does not turn the view
  const b = stand(OPEN, 0, 0, Math.PI);
  const cases = [[{ id: 'S', ...around(b.s, 0, 13, 90), home: true }, false], [{ id: 'S', ...around(b.s, 0, 6, 90), home: true }, false], [{ id: 'S', ...around(b.s, 0, 11, 90) }, false], [{ id: 'S', ...around(b.s, 0, 9, 90) }, true]];
  for (const [foe, turns] of cases) {
    const cam = cameraFor(OPEN, '1280x720', 0, { auto: false }), m = makeCombat({ foes: () => [foe] });
    cam.snap(b.s, 0); cam.c.idle = 0;
    for (let i = 0; i < 180; i++) stepCam(cam, b.s, m.turn);
    assert.equal(Math.abs(cam.c.yaw) > 0.1, turns, `a foe ${JSON.stringify(foe)}: the view ${turns ? 'turns' : 'does not turn'}`);
  }
  pass('a foe at home or more than 10 m away does not turn the view');
}
{ // training posts stand in for the foes: asFoes keeps the live ones, and the camera turns to the nearest
  const posts = [makePost(OPEN, 4, -3, { id: 'post1' }), makePost(OPEN, -6, -6, { id: 'post2' })];
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '1280x720', 0), m = makeCombat({ foes: () => asFoes(posts) });
  cam.snap(b.s, 0); cam.c.idle = 0;
  // 2 s of wait and 1.5 s of turn: the turn eases in and out over 0.2 s at each end (COMBAT.acc), so 1 s no longer quite reaches 33°
  for (let i = 0; i < 210; i++) stepCam(cam, b.s, m.turn);
  assert.equal(m.foe.id, 'post1');
  assert(Math.abs(yawDiff(cam.c.yaw, b.s, posts[0])) <= 20 * DEG + 1e-9, 'it turned to the nearest post');
  posts[0].alive = false;
  stepCam(cam, b.s, m.turn);
  assert.equal(m.foe.id, 'post2', 'a post put out: it chooses again');
  assert.deepEqual(asFoes([{ id: 'a', x: 0, y: 0, z: 0, awake: false }, { id: 'b', x: 1, y: 0, z: 1, home: 1, range: Infinity }]), [{ id: 'b', x: 1, y: 0, z: 1, home: true, range: Infinity }]);
  pass('training posts stand in for foes');
}

if (!skipWorlds) { /* the combat camera in a nook: the framed shot does not fight it. A foe 6 m away in 6 directions, at three spots in the
     Gaol's torn cell and 6 start yaws, with no look input for 10 s and the mouse free (so both may turn the view by themselves). The yaw
     changes direction at most once, and the foe ends within COMBAT.stop of the view's forward direction, or the eye stands so near that
     the near fade leaves the figure out whole. In the build of 1974d668 the lean turned the yaw back toward a clear yaw on the same step
     as the combat camera turned it toward the foe: in 92 of 432 such cases the yaw reversed more than 50 times, and the foe was left up
     to 143° off */
  const { walk } = place('gaol'), out = { cases: 0, reversals: 0, worstOff: 0, faded: 0 };
  for (const [x, z] of [[1.6, -1.6], [1.6, -2.1], [1.6, -0.9]]) for (let fd = 0; fd < 360; fd += 60) for (let y0 = 0; y0 < 360; y0 += 60) {
    const b = stand(walk, x, z, Math.PI, walk.floor(x, z)), cam = cameraFor(walk, '1280x720', y0 * DEG);
    const foe = { id: 'S', x: x + 6 * Math.sin(fd * DEG), y: b.s.y, z: z + 6 * Math.cos(fd * DEG) }, combat = makeCombat({ foes: () => [foe] });
    cam.snap(b.s, y0 * DEG);
    let prev = cam.c.yaw, sign = 0, flips = 0, v;
    for (let i = 0; i < 600; i++) {
      b.step(STEP, {}, cam.c.yaw);
      v = stepCam(cam, b.s, combat.turn);
      const d = wrap(cam.c.yaw - prev), sg = Math.abs(d) > 1e-9 ? Math.sign(d) : 0;
      if (sg && sign && sg !== sign) flips++;
      if (sg) sign = sg;
      prev = cam.c.yaw;
    }
    const off = Math.abs(yawDiff(cam.c.yaw, b.s, foe)), faded = fadeOf(eyeOf(v), b.s) === NEAR_FADE.all;
    const tag = `at ${x}, ${z}, foe at ${fd}°, from ${y0}°`;
    assert(flips <= 1, `${tag}: the yaw changed direction ${flips} times`);
    assert(off <= COMBAT.stop + 1e-6 || faded, `${tag}: the foe was left ${(off / DEG).toFixed(0)}° off, the eye ${v.dist.toFixed(2)} back`);
    out.cases++; out.reversals = Math.max(out.reversals, flips); out.worstOff = Math.max(out.worstOff, +(off / DEG).toFixed(1)); if (faded) out.faded++;
  }
  pass('the combat camera in the torn cell: the framed shot does not fight it, and the foe comes into view', out);
}

/* ---------------- the boss camera, with a stand-in boss ---------------- */
// the follow camera and the boss camera for a layout; boss is a stand-in { x, y, z, up, started }
function bossRig(walk, name, at, boss, o = {}) {
  const screen = screenOf(name), b = makeBody(walk, { p: [at.x, (walk.support(at.x, at.z, 9) ?? walk.top(at.x, at.z)) + 0.2, at.z], yaw: 0 }, 38);
  const yaw = Math.atan2(-(boss.x - at.x), -(boss.z - at.z)) + (o.off || 0);
  const cam = cameraFor(walk, name, yaw, { auto: !o.still }), centre = o.centre || [at.x, 0, at.z];
  const ground = (x, z) => walk.support(x, z, b.s.y + 1) ?? walk.top(x, z);
  const bc = makeBossCam(cam, { screen, boss: () => boss, centre, still: o.still, ground });
  const m = makeCombat({ foes: () => (o.foes ? o.foes() : []), still: o.still });
  const turn = (c, s, dt, looked) => bc.turn(c, s, dt, looked) || m.turn(c, s, dt, looked);
  cam.snap(b.s, yaw); cam.c.idle = 0;
  const step = (inp = {}) => bc.step(b.s, STEP, cam.follow(b.s, STEP, inp, turn));
  return { b, cam, bc, m, step, screen, ground };
}
{ // the frame at five layouts: the boss 2 to 13 m away on flat ground, at yaw differences of 0° and ±15°, stepped 3 s with no look input
  const out = {};
  for (const name of Object.keys(LAYOUTS)) {
    let largest = 0;
    for (let d = 2; d <= 13; d += 0.5) for (const off of [0, 15, -15]) {
      const boss = { x: 0, y: 0, z: -d, up: true, started: true };
      const r = bossRig(OPEN, name, { x: 0, z: 0 }, boss, { off: off * DEG });
      let v;
      for (let i = 0; i < 180; i++) v = r.step();
      const P = projector(v, r.screen.w, r.screen.h);
      assert(frameClear(P, r.b.s, boss, r.screen, r.ground), `${name}: boss ${d} m at ${off}°: the frame is not clear`);
      largest = Math.max(largest, v.dist);
    }
    assert(largest <= 21, `${name}: the boss camera stood ${largest} m back`);
    out[name] = r2(largest);
  }
  pass('the boss camera keeps the frame clear at five layouts', { largest: out });
}
{ // the cutaway yields to the boss camera: with the boss camera on, the view it draws never cuts the place's splats
  const boss = { x: 0, y: 0, z: -6, up: true, started: true };
  const r = bossRig(OPEN, '1280x720', { x: 0, z: 0 }, boss);
  let cuts = 0, on = 0;
  for (let i = 0; i < 120; i++) { const v = r.step(); if (r.bc.b.w > 0) { on++; if (v.cut) cuts++; } }
  assert(on > 0 && cuts === 0, `the boss camera's view cut ${cuts} of ${on} steps`);
  pass('the cutaway yields to the boss camera', { on });
}
{ // its distance at 390x844: the lamplighter 4 m from the arena's centre and the boss 4 m in front of it, on flat ground
  const centre = [0, 0, 0], at = { x: 4, z: 0 }, boss = { x: 0, y: 0, z: 0, up: true, started: true };
  const r = bossRig(OPEN, '390x844', at, boss, { centre });
  const least = bossLeast(camLayout(390, 844).dist);
  let v, by = null;
  for (let i = 1; i <= 60; i++) { v = r.step(); if (by === null && v.dist >= least - 0.01) by = i; }
  assert(by !== null && by <= 60, `within 1 s the distance is ${v.dist} (least ${least})`);
  // the aim lies between the lamplighter and the boss
  const [ax, , az] = v.target, k = ((ax - at.x) * (boss.x - at.x) + (az - at.z) * (boss.z - at.z)) / 16, off = Math.abs((ax - at.x) * (boss.z - at.z) - (az - at.z) * (boss.x - at.x)) / 4;
  assert(k >= 0 && k <= 1 && off < 0.05, `the aim lies between them (k ${k}, ${off} m off the line)`);
  pass('the boss camera reaches its distance within 1 s, and aims between the two', { least: r2(least), dist: r2(v.dist), steps: by, k: r2(k) });
}
{ /* where it starts: the intro over, the lamplighter walks from 9 m to 6 m from the arena's centre. At 9 m the combat camera has the
     boss as its foe (stage 3 hands it over with range Infinity outside the arena, within 16 m); at 6 m the boss camera is on. Then it
     leaves: more than 7.0 m away, the camera is back at the follow camera's distance and aim within 1 s */
  const centre = [0, 0, 0], boss = { id: 'reeve', x: 0, y: 0, z: 0, up: true, started: true };
  const near16 = s => Math.hypot(s.x, s.z) > BOSS.on && Math.hypot(s.x, s.z) <= 16 ? [{ ...boss, range: Infinity }] : [];
  let rig = null;
  const foes = () => near16(rig.b.s);
  rig = bossRig(OPEN, '1280x720', { x: 0, z: 9 }, boss, { centre, foes });
  rig.step();
  assert.equal(rig.m.foe?.id, 'reeve', 'at 9 m the combat camera has the boss');
  assert(!rig.bc.b.on, 'at 9 m the boss camera is off');
  for (let i = 0; i < 90; i++) { rig.b.s.z -= (3 / 90); rig.step(); }
  assert(rig.bc.b.on && Math.hypot(rig.b.s.x, rig.b.s.z) < 7, 'at 6 m the boss camera is on');
  for (let i = 0; i < 90; i++) rig.step();
  // leave the arena
  rig.b.s.z = 7.5;
  let v, back = null;
  for (let i = 1; i <= 90; i++) {
    const f = rig.cam.follow(rig.b.s, STEP, {}, null);
    v = rig.bc.step(rig.b.s, STEP, f);
    if (back === null && v === f) back = i;
  }
  assert(back !== null && back <= 60, `back at the follow camera after ${back} steps`);
  pass('the boss camera starts within 7.0 m and hands back over 1 s', { back });
}
{ /* an attack under way keeps it on outside the arena: the boss at the centre winds up a lunge at a lamplighter 7.5 m away, and the boss
     camera stays on, out at its least distance, until the attack is over; then it hands back within 1 s. Out to 16 m it comes on for an
     attack, and not beyond. With no attack, 7.5 m is outside (as above) */
  const centre = [0, 0, 0], boss = { id: 'reeve', x: 0, y: 0, z: 0, up: true, started: true, busy: true };
  const r = bossRig(OPEN, '1280x720', { x: 0, z: 7.5 }, boss, { centre });
  let v;
  for (let i = 0; i < 90; i++) v = r.step();
  assert(r.bc.b.on, 'at 7.5 m, with the attack under way, the boss camera is on');
  assert(v.dist >= bossLeast(r.cam.c.want) - 0.01, `and out at its least distance (${v.dist})`);
  boss.busy = false;
  let back = null;
  for (let i = 1; i <= 90; i++) { const f = r.cam.follow(r.b.s, STEP, {}, null); v = r.bc.step(r.b.s, STEP, f); if (back === null && v === f) back = i; }
  assert(!r.bc.b.on && back !== null && back <= 60, `the attack over, back at the follow camera after ${back} steps`);
  boss.busy = true;
  r.b.s.z = 15.5; r.step();
  assert(r.bc.b.on, 'at 15.5 m an attack under way turns it on');
  r.b.s.z = 16.5; r.step();
  assert(!r.bc.b.on, 'beyond 16 m it is off');
  pass('an attack under way keeps the boss camera on out to 16 m from the centre, and the camera hands back when it ends', { back });
}
{ // the turn to the boss: the boss 8 m behind the view; it starts after 0.6 s, turns at no more than 1.5 rad/s, and is within 15° by 3 s
  const centre = [0, 0, -4], boss = { x: 0, y: 0, z: 0, up: true, started: true };
  const r = bossRig(OPEN, '390x844', { x: 0, z: -8 }, boss, { centre, off: Math.PI });
  let yaw = r.cam.c.yaw, fastest = 0, start = null;
  for (let i = 1; i <= 180; i++) {
    r.step();
    const dy = Math.abs(wrap(r.cam.c.yaw - yaw)) / STEP;
    if (dy > 1e-9 && start === null) start = i * STEP;
    fastest = Math.max(fastest, dy);
    yaw = r.cam.c.yaw;
  }
  const d = Math.abs(yawDiff(r.cam.c.yaw, r.b.s, boss));
  assert(start > 0.6 - 1e-9 && start < 0.6 + 2 * STEP, `the turn starts after ${start} s`);
  assert(fastest <= BOSS.rate + 1e-9 && d <= 15 * DEG + 1e-9, `it turned at ${fastest} rad/s, to ${d / DEG}°`);
  // reduced motion: it does not turn, but it still aims and pulls back
  const q = bossRig(OPEN, '390x844', { x: 0, z: -8 }, boss, { centre, off: Math.PI / 2, still: true });
  const y0 = q.cam.c.yaw;
  let v;
  for (let i = 0; i < 180; i++) v = q.step();
  assert(q.cam.c.yaw === y0 && v.dist >= bossLeast(q.cam.c.want) - 0.01, 'with reduced motion it does not turn, and still pulls back');
  pass('the boss camera turns to the boss after 0.6 s at 1.5 rad/s, to 15°; reduced motion keeps the turn off', { start: r2(start), rate: r2(fastest), to: r2(d / DEG) });
}
{ // a run round the boss for 10 s at 390x844, 5 m from it, with no look input: both chests stay inside the screen
  const centre = [0, 0, 0], boss = { x: 0, y: 0, z: 0, up: true, started: true };
  const r = bossRig(OPEN, '390x844', { x: 0, z: 5 }, boss, { centre });
  const w = 6.4 / 5;
  let out = 0;
  for (let i = 0; i < 600; i++) {
    const a = w * i * STEP, s = r.b.s;
    s.x = 5 * Math.sin(a); s.z = 5 * Math.cos(a); s.vx = 6.4 * Math.cos(a); s.vz = -6.4 * Math.sin(a); s.yaw = Math.atan2(s.vx, s.vz);
    const v = r.step();
    if (i < 60) continue;
    const P = projector(v, 390, 844);
    for (const p of [P([s.x, s.y + 0.9, s.z]), P([0, 1.7, 0])]) if (!p || p[0] < 0 || p[0] > 390 || p[1] < 0 || p[1] > 844) out++;
  }
  assert.equal(out, 0, `a chest left the screen on ${out} steps`);
  pass('a run round the boss keeps both chests on screen');
}
if (!skipWorlds) { /* the real arena: 481 pairs of points on Barrow Crown's walk map, 3 to 9 m apart, the boss within 6.5 m of the centre;
     the boss camera stepped 3 s at each of the five layouts. In at least 95% of the pairs, both chests are inside 80% of the screen's
     width and inside its height */
  const { walk } = place('barrows'), C = [18, 0.68, -22];
  const pairs = [];
  for (let a = 0; a < 360; a += 15) for (const rl of [0, 2.5, 5]) for (const bb of [0, 90, 180, 270]) for (const db of [3, 6, 9]) {
    // as games/gloam-downs/tools/boss-arena.mjs reckons them (three pairs lie on the 6.5 m edge)
    const lx = C[0] + rl * Math.cos(a * Math.PI / 180), lz = C[2] + rl * Math.sin(a * Math.PI / 180);
    const bx = lx + db * Math.cos((a + bb) * Math.PI / 180), bz = lz + db * Math.sin((a + bb) * Math.PI / 180);
    if (Math.hypot(bx - C[0], bz - C[2]) > 6.5) continue;
    pairs.push([lx, lz, bx, bz]);
  }
  assert.equal(pairs.length, 481);
  const out = {};
  for (const name of Object.keys(LAYOUTS)) {
    const [w, h] = LAYOUTS[name];
    let ok = 0, pulled = 0;
    for (const [lx, lz, bx, bz] of pairs) {
      const by = walk.support(bx, bz, 3) ?? walk.top(bx, bz), boss = { x: bx, y: by, z: bz, up: true, started: true };
      const r = bossRig(walk, name, { x: lx, z: lz }, boss, { centre: C });
      r.b.place([lx, (walk.support(lx, lz, 3) ?? walk.top(lx, lz)) + 0.1, lz], 0);
      let v;
      for (let i = 0; i < 180; i++) v = r.step();
      if (r.bc.b.lift > 0.05) pulled++;
      const P = projector(v, w, h), s = r.b.s;
      if ([P([s.x, s.y + 0.9, s.z]), P([bx, by + 1.7, bz])].every(p => p && Math.abs(p[0] - w / 2) <= 0.4 * w && p[1] >= 0 && p[1] <= h)) ok++;
    }
    out[name] = { share: +(ok / pairs.length).toFixed(3), pulled };
    assert(ok / pairs.length >= 0.95, `${name}: both chests framed in ${ok} of ${pairs.length} pairs`);
  }
  pass('the boss camera in the real arena frames both chests in 95% of 481 pairs at each layout', out);
}

/* ---------------- the smooth camera ----------------
   design.md "Smooth camera". frames() is main.js frame() on flat ground: each frame Chrome hands one pointermove, whole px, which
   input.js adds to input.dyaw; stepCount gives the frame's fixed steps; each step runs body.step and cam.follow, then input.dyaw = 0
   and blend.step; the frame draws blend.view(acc / STEP, input.dyaw) and the lamplighter at blend.body. rAF times are rounded to 0.1 ms
   as Chrome's are, plus `jitter` ms of noise; px: the mouse's move each frame. old: the frame draws the last step's view and body as the
   page did before (a8b46709) */
function frames({ hz, px = 0, run = false, keys = 0, jitter = 0, old = false }) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / Math.SQRT2; };
  const b = stand(OPEN, 0, 30, Math.PI), cam = cameraFor(OPEN, '1280x720', 0), blend = makeBlend(cam);
  cam.snap(b.s, 0);
  const input = { mx: 0, mz: run ? 1 : 0, ox: keys, oy: 0, dyaw: 0, dpitch: 0, mouse: !keys };
  // 1 s first, so a run is at speed
  for (let i = 0; i < 60; i++) { b.step(STEP, input, cam.c.yaw); blend.step(cam.follow(b.s, STEP, input), b.s); }
  const rows = [];
  let acc = 0, last = 0;
  for (let f = 0; f < Math.round(2 * hz); f++) {
    const now = Math.round(((0.37 + f + 1) / hz * 1000 + gauss() * jitter) * 10) / 10, dt = f ? (now - last) / 1000 : 1 / hz;
    last = now;
    let mine = 0;
    if (px) { mine = mouseLook(px, 0).dyaw; input.dyaw += mine; }
    const c = stepCount(acc, dt);
    acc = c.acc;
    for (let i = 0; i < c.n; i++) { b.step(STEP, input, cam.c.yaw); const v = cam.follow(b.s, STEP, input); input.dyaw = input.dpitch = 0; blend.step(v, b.s); }
    const v = old ? blend.view(1) : blend.view(acc / STEP, input.dyaw, input.dpitch), s = old ? b.s : blend.body(b.s, acc / STEP);
    rows.push({ yaw: v.yaw, eye: eyeOf(v), fig: [s.x, s.y, s.z], mine, n: c.n });
  }
  return rows.slice(2);
}
// per-frame changes: { max/min, coefficient of variation, frames that stood still }
const pacing = vals => {
  const m = vals.reduce((a, b) => a + b, 0) / vals.length, sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  return { ratio: lo > 1e-12 ? +(hi / lo).toFixed(3) : 'still', cv: +(sd / m).toFixed(3), still: vals.filter(v => v < 1e-9).length, frames: vals.length };
};
const turns = r => r.slice(1).map((x, i) => Math.abs(wrap(x.yaw - r[i].yaw)));
const moves = (r, k = 'eye') => r.slice(1).map((x, i) => Math.hypot(x[k][0] - r[i][k][0], x[k][1] - r[i][k][1], x[k][2] - r[i][k][2]));
{ /* a steady mouse move, 4 px a frame with the mouse taken (as the browser check drags), at 60, 120, 144 and 165 Hz and at 60 Hz with
     0.1 ms of rAF jitter: every frame turns the picture by exactly that frame's mouse move, so the largest turn of a frame is no more
     than 1.3 times the least. Before (a8b46709) the turn waited for a step: at 144 Hz 168 of 288 frames stood still and the others
     turned 2 or 3 frames' worth (1.008 or 1.513°), and at 60 Hz with jitter the steps came 0 or 2 to a frame */
  const out = {};
  for (const [hz, jitter] of [[60, 0], [60, 0.1], [120, 0], [144, 0], [165, 0]]) {
    const r = frames({ hz, px: 4, jitter }), t = turns(r), was = pacing(turns(frames({ hz, px: 4, jitter, old: true })));
    const off = Math.max(...r.slice(1).map((x, i) => Math.abs(t[i] - Math.abs(x.mine))));
    const p = pacing(t), tag = `${hz} Hz${jitter ? ' jittered' : ''}`;
    assert(off < 1e-9, `${tag}: a frame's turn differed from its mouse move by ${off} rad`);
    assert.equal(p.still, 0, `${tag}: ${p.still} frames of a steady mouse move did not turn`);
    assert(p.ratio <= 1.3, `${tag}: the turn of a frame ranged ${p.ratio} times`);
    out[tag] = { ratio: p.ratio, cv: p.cv, before: { ratio: was.ratio, cv: was.cv, still: was.still } };
  }
  pass('a steady mouse move turns the picture by the frame\'s own move on every frame at 60 to 165 Hz', out);
}
{ /* a run straight ahead (6.4 m/s) and Q held: at 120, 144 and 165 Hz and at 60 Hz with jitter, the eye moves (and the view turns) by the
     same amount every frame, within 5% (coefficient of variation), and no frame stands still. Before: at 144 Hz the eye moved 0 on 168
     of 288 frames and 2.4 times its mean on 120 (CV 1.18), and Q turned the same way */
  const out = {};
  for (const [hz, jitter] of [[60, 0.1], [120, 0], [144, 0], [165, 0]]) {
    const tag = `${hz} Hz${jitter ? ' jittered' : ''}`, e = pacing(moves(frames({ hz, run: true, jitter }))), f = pacing(moves(frames({ hz, run: true, jitter }), 'fig'));
    const q = pacing(turns(frames({ hz, keys: 1, jitter }))), was = pacing(moves(frames({ hz, run: true, jitter, old: true })));
    for (const [k, p] of [['the eye', e], ['the lamplighter', f], ['Q', q]]) assert(p.still === 0 && p.cv <= 0.05, `${tag}: ${k} moved unevenly (CV ${p.cv}, ${p.still} frames still)`);
    out[tag] = { eye: e.cv, figure: f.cv, q: q.cv, before: { cv: was.cv, still: was.still } };
  }
  pass('a run and a held Q move the eye, the lamplighter and the view evenly on every frame at 60 to 165 Hz', out);
}
{ /* a camera snap is never blended: the frame after cam.snap draws the new view whole (a load, a fall, a teleport) */
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '1280x720', 0), blend = makeBlend(cam);
  cam.snap(b.s, 0);
  blend.step(cam.follow(b.s, STEP, {}), b.s);
  b.place([10, 0.5, 10], 0); cam.snap(b.s, 2);
  const v = cam.follow(b.s, STEP, {});
  blend.step(v, b.s);
  const d = blend.view(0.2);
  assert(near(d.yaw, v.yaw, 1e-12) && near(d.target[0], v.target[0], 1e-12) && blend.body(b.s, 0.2).x === b.s.x, 'a snap was blended with the view before it');
  pass('a snap is drawn whole, not blended with the view before it');
}
if (!skipWorlds) {
  /* each place's route at run speed, 1280x720, a step at a time, with the mouse taken (as the user plays on a laptop or desktop) and
     with it free (the swing behind a running lamplighter and the lane turn on, near the same hills and walls): the pitch's change from
     one step to the next (what reads as a jolt) is 2°/step² or less and never turns round by more than 2° (the rise starts and stops
     eased); the eye's own jolt (its second difference) is 0.35 m/step² or less; the aim's height jolt 0.06 m/step² or less; the eye
     moves no more than 0.7 m a step more than the lamplighter. A step where the follow eye comes in through a wall from behind (over
     1 m in one step: a cut, which the frame does not blend through the wall) comes 3 times or fewer a route, each under 2.8 m; a step
     where it comes in by 0.5 to 1 m (a squeeze: the eye kept out of a wall the view turns into) never comes with the mouse taken, and
     twice or less with it free. Both are left out of the eye's numbers. Before (a8b46709), the mouse taken: pitch 4.64, 3.66, 3.82,
     1.10 and 3.42°/step² (Gaol, Ramparts, Fen, Bells, Barrows) with 13, 5, 1, 0 and 8 turns round; the eye 0.57, 0.55, 0.54, 0.16 and
     0.50 m/step²; the aim 0.082, 0.088, 0.108, 0.072 and 0.037 m/step²; 1 cut of 2.35 m in the Gaol. The mouse free: pitch 4.45, 3.95,
     3.82, 1.10 and 4.08°/step² with 19, 10, 1, 0 and 6 turns round */
  const out = {};
  for (const free of [false, true]) for (const id of ORDER) {
    const { walk } = place(id), pts = ROUTES[id];
    const b = makeBody(walk, { p: pts[0], yaw: 0 }, 34), s = b.s, yaw0 = Math.atan2(pts[1][0] - pts[0][0], pts[1][2] - pts[0][2]);
    const cam = cameraFor(walk, '1280x720', yaw0 + Math.PI);
    s.yaw = yaw0; cam.snap(s, yaw0 + Math.PI);
    let seg = 1, stuck = 0, best = Infinity, step = 0, h = [];
    const m = { pitch: 0, round: 0, eye: 0, rel: 0, aim: 0, cuts: 0, cut: 0, squeezes: 0 };
    while (seg < pts.length && step++ < 7200) {
      const T = pts[seg], dx = T[0] - s.x, dz = T[2] - s.z, dd = Math.hypot(dx, dz);
      if (dd < 0.6) { seg++; best = Infinity; stuck = 0; continue; }
      if (dd < best - 0.05) { best = dd; stuck = 0; } else stuck++;
      // (a ledge the walker cannot climb: it jumps, and after 2.5 s it is put on the next waypoint, which starts the measure again)
      if (stuck > 150) { b.place(T, s.yaw); cam.snap(s, cam.c.yaw); seg++; best = Infinity; stuck = 0; h = []; continue; }
      const cy = cam.c.yaw, ux = dx / dd, uz = dz / dd, f0 = [s.x, s.y, s.z];
      const inp = { mx: ux * Math.cos(cy) - uz * Math.sin(cy), mz: -(ux * Math.sin(cy) + uz * Math.cos(cy)), jump: stuck > 10 && stuck % 40 < 20, mouse: !free };
      b.step(STEP, inp, cy);
      const v = cam.follow(s, STEP, inp);
      h.push({ e: eyeOf(v), p: v.pitch / DEG, d: v.dist, ty: v.target[1], f: [s.x - f0[0], s.y - f0[1], s.z - f0[2]] });
      if (h.length > 3) h.shift();
      if (h.length < 3) continue;
      const [a, q, c] = h, jumpIn = Math.abs(c.d - q.d);
      if (jumpIn > 1) { m.cuts++; m.cut = Math.max(m.cut, jumpIn); } else if (jumpIn > 0.5) m.squeezes++;
      const jp = Math.abs(c.p - 2 * q.p + a.p);
      m.pitch = Math.max(m.pitch, jp);
      if (jp > 2) m.round++;
      m.aim = Math.max(m.aim, Math.abs(c.ty - 2 * q.ty + a.ty));
      if (jumpIn <= 0.5 && Math.abs(q.d - a.d) <= 0.5) {
        m.eye = Math.max(m.eye, Math.hypot(...[0, 1, 2].map(i => c.e[i] - 2 * q.e[i] + a.e[i])));
        m.rel = Math.max(m.rel, Math.hypot(...[0, 1, 2].map(i => c.e[i] - q.e[i] - c.f[i])));
      }
    }
    for (const k in m) m[k] = +m[k].toFixed(3);
    const name = `${id}${free ? ' (mouse free)' : ''}`;
    out[name] = m;
    assert(m.pitch <= 2 && m.round === 0, `${name}: the pitch jolted by ${m.pitch}°/step², and turned round ${m.round} times`);
    assert(m.eye <= 0.35 && m.rel <= 0.7, `${name}: the eye jolted by ${m.eye} m/step², and moved ${m.rel} m a step more than the lamplighter`);
    assert(m.aim <= 0.06, `${name}: the aim's height jolted by ${m.aim} m/step²`);
    assert(m.cuts <= 3 && m.cut < 2.8, `${name}: the eye came in through a wall ${m.cuts} times, by up to ${m.cut} m`);
    assert(m.squeezes <= (free ? 2 : 0), `${name}: the eye came in by 0.5 to 1 m in a step ${m.squeezes} times`);
  }
  pass('the five routes at run speed, the mouse taken and free: the rise, the eye and the aim never jolt', out);
}
{ /* the combat camera's turn eases in and out: its rate builds and falls by no more than COMBAT.acc (3 rad/s²) and ends at rest on the
     stop, within 10%. Before: 0 to 0.6 rad/s in one step and back to 0 in one, 36 rad/s² */
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '390x844', 0), foe = { id: 'S', ...around(b.s, 0, 5, 60) }, combat = makeCombat({ foes: () => [foe] });
  cam.snap(b.s, 0);
  let yaw = cam.c.yaw, rate = 0, most = 0, end = 0;
  for (let i = 0; i < 240; i++) {
    stepCam(cam, b.s, combat.turn);
    const r = Math.abs(wrap(cam.c.yaw - yaw)) / STEP;
    most = Math.max(most, Math.abs(r - rate) / STEP);
    if (r === 0 && rate > 0) end = rate;
    rate = r; yaw = cam.c.yaw;
  }
  // (10% over COMBAT.acc for the last step, which turns only what is left to the stop)
  assert(most <= COMBAT.acc * 1.1 && end <= COMBAT.acc * STEP * 1.5, `the combat turn's rate changed by up to ${most.toFixed(2)} rad/s², and stopped from ${end.toFixed(3)} rad/s`);
  assert(near(easeTurn(0, 0.6, 3, 1, STEP), 0.05, 1e-12) && easeTurn(0.6, 0.6, 3, 0.001, STEP) < 0.1, 'easeTurn');
  pass('the combat camera\'s turn eases in and out', { acc: +most.toFixed(2), stopFrom: +end.toFixed(3) });
}
{ /* the swing behind a running lamplighter (the mouse free, after 2 s with no look input): its rate builds by no more than 1 rad/s².
     Before: 0 to 0.19 rad/s in one step, 11.4 rad/s² */
  const b = stand(OPEN, 0, 0), cam = cameraFor(OPEN, '1280x720', 0);
  cam.snap(b.s, 0);
  let yaw = cam.c.yaw, rate = 0, most = 0, turned = 0;
  for (let i = 0; i < 300; i++) {
    b.step(STEP, { mx: 0.4, mz: 1 }, cam.c.yaw);
    cam.follow(b.s, STEP, { mx: 0.4, mz: 1 });
    const r = wrap(cam.c.yaw - yaw) / STEP;
    most = Math.max(most, Math.abs(r - rate) / STEP); turned += Math.abs(r) * STEP;
    rate = r; yaw = cam.c.yaw;
  }
  assert(turned > 0.2, `the swing turned the view (${turned})`);
  assert(most <= 1.001, `the swing's rate changed by up to ${most.toFixed(2)} rad/s²`);
  pass('the swing behind a running lamplighter eases in', { acc: +most.toFixed(3), turned: +turned.toFixed(2), wait: AUTO.wait });
}
{ /* the mouse's spike cap is a turn speed: 120 px per 1/60 s since the last event, so a fast flick at 30 fps keeps its 240 px a frame
     (it lost 37% at 720°/s), and the first event after a pause is still capped at 120 */
  const at30 = mouseLook(240, 0, false, MOUSE, 1 / 30), first = mouseLook(5000, 0);
  assert(near(at30.dyaw, -240 * MOUSE.yaw, 1e-12) && near(first.dyaw, -120 * MOUSE.yaw, 1e-12), 'the spike cap');
  pass('the mouse\'s spike cap is the same turn speed at any frame rate');
}

// main.js frame() for any camera at hz: step(input) runs one fixed step and returns the view it draws; mouse(t) -> [px, py] moved
// before the frame at t s. -> a row a frame: the view drawn and the last step's
function drive({ hz, cam, body, step, secs, mouse }) {
  const blend = makeBlend(cam), input = { dyaw: 0, dpitch: 0, mouse: true }, rows = [];
  let acc = 0, v = null;
  for (let f = 0; f < Math.round(secs * hz); f++) {
    const m = mouse(f / hz);
    if (m) { const d = mouseLook(m[0], m[1]); input.dyaw += d.dyaw; input.dpitch += d.dpitch; }
    const c = stepCount(acc, 1 / hz);
    acc = c.acc;
    for (let i = 0; i < c.n; i++) { v = step(input); input.dyaw = input.dpitch = 0; blend.step(v, body.s); }
    const d = blend.view(acc / STEP, input.dyaw, input.dpitch);
    if (d) rows.push({ drawn: d, step: v });
  }
  return rows;
}
const flipsOf = vals => { let n = 0, ls = 0; for (let i = 1; i < vals.length; i++) { const d = vals[i] - vals[i - 1]; if (Math.abs(d) > 1e-6) { if (ls && Math.sign(d) !== ls) n++; ls = Math.sign(d); } } return n; };
{ /* the boss camera sets the pitch itself: the mouse moved up and down (1.5 rad/s, turning round every 0.25 s) at 144 Hz with the boss
     camera on does not tilt the drawn view between steps. Before this check: the drawn pitch went over 2.8° and back, turning round
     104 times in 300 frames, while the step's held still */
  const boss = { x: 0, y: 0, z: 0, up: true, started: true }, r = bossRig(OPEN, '1280x720', { x: 0, z: 5 }, boss, { centre: [0, 0, 0] });
  for (let i = 0; i < 120; i++) r.step({ mouse: true });
  assert(r.bc.b.w === 1, 'the boss camera is on');
  const rows = drive({ hz: 144, cam: r.cam, body: r.b, step: inp => r.step(inp), secs: 2, mouse: t => [0, (Math.floor(t / 0.25) % 2 ? -1 : 1) * 1.5 / 144 / MOUSE.pitch] });
  const ps = rows.map(x => x.drawn.pitch), range = (Math.max(...ps) - Math.min(...ps)) / DEG;
  assert(range < 0.01, `the drawn pitch moved over ${range.toFixed(3)}°`);
  pass('with the boss camera on, a vertical mouse move does not tilt the drawn view', { range: +range.toFixed(4), frames: rows.length });
}
{ /* a wall 4 m high behind the lamplighter holds the view risen; the mouse moved steadily down (1.2 rad/s) at 144 Hz into the top of
     the pitch, then up: the drawn pitch never goes over the follow camera's top (1.35), and turns round no more often than the steps'
     own pitch does (where the rise and the mouse take turns), plus four (as the mouse turns round). Before this check: it went over the top and back once a step (1.3653, 1.3583, 1.3514, 1.3667 ...) */
  const WALL = layered((x, z) => (z >= 2 && z <= 3 ? 4 : 0));
  const out = {};
  for (const name of ['1280x720', '390x844']) {
    const b = stand(WALL, 0, 0), cam = cameraFor(WALL, name, 0);
    cam.snap(b.s, 0);
    for (let i = 0; i < 60; i++) cam.follow(b.s, STEP, { mouse: true });
    const rows = drive({ hz: 144, cam, body: b, step: inp => cam.follow(b.s, STEP, inp), secs: 3, mouse: t => [0, (t < 1.5 ? 1 : -1) * 1.2 / 144 / MOUSE.pitch] });
    const ps = rows.map(x => x.drawn.pitch), top = Math.max(...ps), flips = flipsOf(ps), stepFlips = flipsOf(rows.map(x => x.step.pitch));
    assert(top <= 1.35 + 1e-9, `${name}: the drawn pitch went to ${top.toFixed(4)}`);
    assert(flips <= stepFlips + 4, `${name}: the drawn pitch turned round ${flips} times, the steps' ${stepFlips}`);
    out[name] = { top: +top.toFixed(4), flips, stepFlips };
  }
  pass('the mouse into the top of the pitch over a wall: the drawn pitch holds at the top and does not saw', out);
}
{ /* the boss camera's distance as a pillar passes between: the lamplighter runs round the boss 5 m away, past a pillar 3 m tall. Its
     distance comes in at no more than 15 m/s and goes back out at no more than 12 m/s, except to keep the eye itself out of the
     scenery. Before: 12 m to 2.6 m and back to 12 m in single steps (here, 9.78 m in a step with the eye clear) */
  const PIL = layered((x, z) => (Math.hypot(x - 7.5, z - 0) <= 0.6 ? 3 : 0));
  const boss = { x: 0, y: 0, z: 0, up: true, started: true }, r = bossRig(PIL, '1280x720', { x: 0, z: 5 }, boss, { centre: [0, 0, 0] });
  const w = 6.4 / 5, eyeIn = v => { const e = eyeOf(v); return e[1] <= PIL.top(e[0], e[2]) + 0.05; };
  let most = 0, pressed = 0, prev = null, came = 0;
  for (let i = 0; i < 900; i++) {
    const a = w * i * STEP, s = r.b.s;
    s.x = 5 * Math.sin(a); s.z = 5 * Math.cos(a); s.vx = 6.4 * Math.cos(a); s.vz = -6.4 * Math.sin(a); s.yaw = Math.atan2(s.vx, s.vz);
    const v = r.step();
    if (i > 60 && prev !== null && r.bc.b.w === 1) {
      const d = r.bc.b.dist - prev;
      if (d < -1e-6) came++;
      if (d < -15 * STEP - 1e-6 || d > 12 * STEP + 1e-6) { if (!eyeIn({ ...v, dist: prev })) most = Math.max(most, Math.abs(d)); else pressed++; }
    }
    prev = r.bc.b.dist;
  }
  assert(came > 0, 'the pillar never came between');
  assert(most === 0, `the boss camera's distance jumped by ${most.toFixed(2)} m in a step with its eye clear`);
  pass('the boss camera comes in and back out eased as a pillar passes between', { stepsIn: came, pressed });
}

/* ---------------- walls and ceilings at 120 Hz ----------------
   The user report after 7c7d55b7: "it's 120hz, still a bit jumpy near walls and things on ceilings". main.js's frame loop at 120 Hz
   (rAF jitter of ±0.25 ms, seeded) with the mouse taken, at the measured spots in four places (design.md "Smooth camera", "Walls and
   ceilings"), each spot a few hand moves: strafing, walking in and back, a mouse turn from rest, a mouse pitch, a pitch up and a turn
   while backing up. Per drawn frame (blend.view, as frame() draws it): the eye, the distance, the pitch, the mouse's pitch that frame */
function walls120(id, [x, y, z, camYaw], move, T = 3.5, hz = 120, before = {}) {
  const { walk, meta } = place(id);
  const b = makeBody(walk, { p: [x, y + 0.3, z], yaw: camYaw - Math.PI }, meta.bounds), cam = cameraFor(walk, '1280x720', camYaw, { auto: true }), blend = makeBlend(cam);
  cam.snap(b.s, camYaw);
  let seed = 5, acc = 0, t = 0, lastEv = 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const input = { dyaw: 0, dpitch: 0, mx: 0, mz: 0, ox: 0, oy: 0, mouse: true };
  const rows = [];
  for (let f = 0; f < Math.round((T + 0.5) * hz); f++) {
    const dt = f ? 1 / hz + (rnd() - 0.5) * 0.0005 : 0;
    t += dt;
    const k = t < 0.5 ? before : move(t - 0.5, dt);
    let mp = 0;
    if (k.px || k.py) { const m = mouseLook(k.px || 0, k.py || 0, false, MOUSE, Math.max(t - lastEv, 0.001)); lastEv = t; input.dyaw += m.dyaw; input.dpitch += m.dpitch; mp = m.dpitch; }
    input.mx = k.mx || 0; input.mz = k.mz || 0;
    const c = stepCount(acc, dt);
    acc = c.acc;
    let v = null;
    for (let i = 0; i < c.n; i++) { b.step(STEP, input, cam.c.yaw); v = cam.follow(b.s, STEP, input); input.dyaw = input.dpitch = 0; blend.step(v, b.s); }
    const d = blend.view(acc / STEP, input.dyaw, input.dpitch);
    if (!d || t < 0.5) continue;
    rows.push({ t, eye: eyeOf(d), dist: d.dist, pitch: d.pitch, cut: !!d.cut, clear: cam.clear(d), held: !!blend.dbg?.held, mp, n: c.n });
  }
  return { rows, walk };
}
if (!skipWorlds) {
  const px = r => r / MOUSE.yaw, py = r => r / MOUSE.pitch;
  const MOVES = {
    strafeL: () => ({ mx: -1 }), strafeR: () => ({ mx: 1 }), walkIn: t => ({ mz: t < 1.5 ? 1 : -1 }),
    turnL: (t, dt) => ({ px: px(0.6) * dt }), turnR: (t, dt) => ({ px: -px(0.6) * dt }), backTurn: (t, dt) => ({ mz: -1, px: px(0.6) * dt * (t < 1.5 ? 1 : -1) }),
    pitch: (t, dt) => ({ py: (Math.floor(t / 0.6) % 2 ? -1 : 1) * py(0.6) * dt }), pitchUp: (t, dt) => ({ py: (t < 2 ? 1 : -1) * py(0.3) * dt })
  };
  // the spots (y the floor; the feet go 0.3 over it) and what each shows
  const SPOTS = {
    G3: ['gaol', [9.0, -2.2, -1.5, 3.927], ['strafeL', 'strafeR', 'walkIn']], // the torn cell, the eye risen over its roof
    G4: ['gaol', [0, 7.38, 25.5, 3.927], ['strafeR', 'walkIn']], // a roof over the head at the start
    G5: ['gaol', [3.4, 4.1, -17.8, 0], ['strafeL', 'strafeR']], // by the archway
    R1: ['ramparts', [3, -0.04, 17.25, 5.498], ['turnL', 'turnR', 'pitchUp']], // an overhang over the eye
    R2: ['ramparts', [-3, -0.77, -5.25, 2.356], ['pitch', 'backTurn']], // an overhang with the eye risen
    B2: ['bells', [4.5, 2.2, 1.5, 1.571], ['pitch', 'backTurn']], // a wall close behind
    B3: ['bells', [1.5, 4.5, -8.25, 0], ['walkIn']], // the fallen bell's roof
    W1: ['barrows', [3, 0.52, 0.75, 3.142], ['pitchUp']], // an overhang 2.2 m over the eye
    W3: ['barrows', [1.3, 0.78, -1.28, 3.142], ['turnL', 'turnR', 'strafeR']], // a wall 0.2 m beside the eye
    O1: ['ramparts', [0, 3.7, 27, 3.142], ['backTurn']] // open, but backing up meets a roof's edge
  };
  // a point the eye may not be in: inside the walk map's solid (under its top, and not in a gap under an arch)
  const solid = (walk, [ex, ey, ez]) => walk.support(ex, ez, ey) === null;
  let frames = 0, jump = 0, jumpMax = 0, jumpAt = '', inside = 0, insideAt = '', popped = 0, popAt = '', held = 0, against = 0, pitched = 0;
  const rows = [];
  for (const [name, [id, spot, moves]] of Object.entries(SPOTS)) for (const mv of moves) {
    const { rows: r, walk } = walls120(id, spot, MOVES[mv]);
    let j = 0, ins = 0, pop = 0, hd = 0, ag = 0, np = 0;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], c = r[i];
      frames++;
      // the distance in one drawn frame: walls and ceilings bring it in at no more than SQUEEZE (33 m/s, 0.28 m a frame at 120 Hz)
      const dd = a.dist - c.dist;
      if (dd > 0.3 && !c.cut) { j++; if (dd > jumpMax) { jumpMax = dd; jumpAt = `${name} ${mv} at ${c.t.toFixed(2)} s: ${a.dist.toFixed(2)} -> ${c.dist.toFixed(2)} m`; } }
      if (!c.cut && !c.clear) { ins++; insideAt ||= `${name} ${mv} at ${c.t.toFixed(2)} s`; }
      // through a roof or a wall from one frame to the next: the line between the two drawn eyes passes through the solid
      if (!c.cut && !a.cut) for (let q = 1; q < 10; q++) if (solid(walk, a.eye.map((e, k) => e + (c.eye[k] - e) * q / 10))) { pop++; popAt ||= `${name} ${mv} at ${c.t.toFixed(2)} s`; break; }
      if (c.held) hd++;
      // a frame of the mouse's pitch that the drawn pitch went against
      if (Math.abs(c.mp) > 1e-4) { np++; if (Math.sign(c.pitch - a.pitch) !== Math.sign(c.mp) && Math.abs(c.pitch - a.pitch) > 0.001) ag++; }
    }
    jump += j; inside += ins; popped += pop; held += hd; against += ag; pitched += np;
    rows.push([name, mv, j, ins, pop, hd, `${ag}/${np}`]);
  }
  /* before (7c7d55b7): 31 frames came in by over 0.3 m (G3 strafing 6.10 -> 2.55 m in one frame, then still), the eye was drawn inside
     the scenery on frames and went through a roof between frames, 248 frames drew the step and held it, and the drawn pitch went against
     a steady mouse pitch on 869 of 28,356 frames over the full measure (scratch scen.mjs) */
  assert(jumpMax <= 0.6, `the drawn distance came in by ${jumpMax.toFixed(2)} m in one frame (${jump} frames over 0.3 m), worst ${jumpAt}`);
  assert(jump <= 8, `${jump} drawn frames came in by more than 0.3 m, worst ${jumpAt}`);
  assert.equal(inside, 0, `the eye was drawn inside the scenery on ${inside} frames, first ${insideAt}`);
  assert.equal(popped, 0, `the drawn eye went through a roof or a wall between frames ${popped} times, first ${popAt}`);
  assert(held <= 6, `${held} frames drew the step as it is and held it`);
  assert(against <= 0.02 * pitched, `the drawn pitch went against the mouse's on ${against} of ${pitched} frames`);
  pass('walls and ceilings at 120 Hz: the eye comes in smoothly, is never drawn in the scenery or through a roof, the frames between steps move, and the pitch is the mouse\'s', { frames, jump, jumpMax: r2(jumpMax), held, against: `${against}/${pitched}`, rows });
}
if (!skipWorlds) { /* the ceiling check: an overhang over the eye (Barrows W1, Ramparts R1, Bells B1), the view still and the mouse free. The rise never
     lifts the eye at its distance into the underside: on every step where the rise went up, the eye at the new pitch is clear. Before,
     the rise lifted it into the underside and the room there pulled the eye in, by up to 2.6 m under an overhang */
  let ups = 0, into = 0, at = '';
  for (const [id, x, y, z, yaw] of [['barrows', 3, 0.52, 0.75, 3.142], ['ramparts', 3, -0.04, 17.25, 5.498], ['bells', 0.75, 0.03, 7.5, 2.356], ['barrows', 1.3, 0.78, -1.28, 3.142], ['bells', 4.5, 2.2, 1.5, 1.571]]) for (const by of [0, 0.01, -0.01]) {
    const { walk, meta } = place(id), b = makeBody(walk, { p: [x, y + 0.3, z], yaw: yaw - Math.PI }, meta.bounds), cam = cameraFor(walk, '1280x720', yaw, { auto: true });
    cam.snap(b.s, yaw);
    for (let i = 0; i < 240; i++) {
      const l0 = cam.c.lift, d0 = cam.c.dist;
      b.step(STEP, {}, cam.c.yaw);
      const v = cam.follow(b.s, STEP, by ? { dyaw: by, mouse: true } : { mouse: true });
      // a step where the rise went up and the eye at its old distance was clear at the old pitch: is it clear at the new one?
      const p = Math.min(1.35, cam.c.pitch + cam.c.lift), was = { ...v, dist: d0, pitch: Math.min(1.35, cam.c.pitch + l0) };
      if (cam.c.lift > l0 + 1e-4 && !v.cut && cam.clear(was)) {
        ups++;
        if (!cam.clear({ ...was, pitch: p })) { into++; at ||= `${id} at ${x}, ${z} turning ${by} a step, step ${i}`; }
      }
    }
  }
  assert(ups > 0, 'the rise went up somewhere');
  assert.equal(into, 0, `the rise lifted the eye into an underside on ${into} of ${ups} steps, first ${at}`);
  pass('the ceiling check: the rise never lifts the eye into an underside', { ups });
}

if (!skipWorlds) {
  /* the review of the walls-and-ceilings fix (design.md "Walls and ceilings"): moves at 120 Hz where its first version went wrong.
     (1) No dive while the eye is clear: backing up a slope under the Gaol's overhang (G2), strafing there, and backing up and turning
     past the Gaol's lintelled doorway (N3) keep the drawn eye out where 7c7d55b7 kept it (7.45, 8.5, 8.5 and 7.2 m least). The first
     version's look-ahead lowered the goal and brought it in to 0.5 m. (2) The mouse lowering the view at 0.8 rad/s under a canopy or an
     overhang (Fen F2, Barrows W2, the doorway the other way, N7) never pulls the eye in by over 0.6 m in a frame: the rise held for the
     mouse let the eye sink into the scenery behind, and the step then snapped it in by 3.24, 1.56 and 1.08 m. (3) Walking in and back
     through that doorway (N3) the cutaway comes on at most once (the first version turned it on and off 4 times there; 7c7d55b7 never),
     and by the Bells' walls (B2, B3) no more than once and twice (the first version 3 and 3; 7c7d55b7 never, but jumped the eye 0.3
     and 2.6 m through the wall instead) */
  const px = r => r / MOUSE.yaw, py = r => r / MOUSE.pitch;
  const back = () => ({ mz: -1 }), strafe = t => ({ mx: t < 1.5 ? 1 : -1 }), backTurn = (t, dt) => ({ mz: -1, px: px(0.6) * dt * (t < 1.5 ? 1 : -1) });
  const down = (t, dt) => (t < 1.5 ? { py: -py(0.8) * dt } : {}), inOut = t => ({ mz: t < 1.5 ? 1 : -1 });
  const least = { 'G2 back': 7, 'G2 strafe': 8, 'N3 back': 8, 'N3 backTurn': 6.5 }, out = {};
  for (const [name, id, spot, move] of [['G2 back', 'gaol', [6, -2.19, 12, 0.785], back], ['G2 strafe', 'gaol', [6, -2.19, 12, 0.785], strafe],
    ['N3 back', 'gaol', [6.75, 0.46, -2.75, 0], back], ['N3 backTurn', 'gaol', [6.75, 0.46, -2.75, 0], backTurn]]) {
    const { rows } = walls120(id, spot, move), lo = Math.min(...rows.filter(r => !r.cut).map(r => r.dist));
    out[name] = r2(lo);
    assert(lo >= least[name], `${name}: the eye came in to ${lo.toFixed(2)} m with nothing between (7c7d55b7 kept it at ${least[name]} m or more)`);
  }
  for (const [name, id, spot] of [['F2 down', 'fen', [3, -0.49, 3, 1.571]], ['W2 down', 'barrows', [9.75, 1.43, -8.25, 3.927]], ['N7 down', 'gaol', [6.75, 0.46, -2.75, 3.142]]]) {
    const { rows } = walls120(id, spot, down);
    let pop = 0;
    for (let i = 1; i < rows.length; i++) if (!rows[i].cut && !rows[i - 1].cut) pop = Math.max(pop, rows[i - 1].dist - rows[i].dist);
    out[name] = r2(pop);
    assert(pop <= 0.6, `${name}: the mouse lowering the view pulled the eye in by ${pop.toFixed(2)} m in one frame`);
  }
  for (const [name, id, spot] of [['N3 inOut', 'gaol', [6.75, 0.46, -2.75, 0]], ['B2 inOut', 'bells', [4.5, 2.2, 1.5, 1.571]], ['B3 inOut', 'bells', [1.5, 4.5, -8.25, 0]]]) {
    const { rows } = walls120(id, spot, inOut);
    let tog = 0;
    for (let i = 1; i < rows.length; i++) if (rows[i].cut !== rows[i - 1].cut) tog++;
    out[name] = tog;
    assert(tog <= { 'N3 inOut': 1, 'B2 inOut': 2, 'B3 inOut': 3 }[name], `${name}: the cutaway turned on or off ${tog} times walking in and back`);
  }
  pass('walls at 120 Hz, the review: no dive while the eye is clear, no snap as the mouse lowers the view, and the cutaway on and off less in doorways', out);
}
// the nearest the eye came outside the cutaway at 663fade6 in the runs of "turning by walls", part 4, below
const NEAR_WAS = { f2_120: 7.28, f2_60: 6.67, r1_60: 3.99 };
if (!skipWorlds) {
  /* Turning by walls (the user report after 663fade6: "much smoother now, still a small jump turning by walls"; design.md "Smooth
     camera", "Turning by walls"). At 11 spots (the Barrows wall 0.2 m beside the eye and its overhang, the Bells' overhang and fallen
     bell, the Ramparts' overhang and doorway, the Fen's canopies, the Gaol's archway and lintelled doorway both ways). Per drawn frame
     outside the cutaway: the distance's step in, the change of its rate (the jolt), the change of the pitch's step (the pitch's
     jolt), the frames drawn as the step and held, and the frames with the eye inside the scenery. Figures are 663fade6 -> now.
     1. At 120 Hz, the view still for 0.5 s and then turned with the mouse at 0.3, 0.6 and 1.2 rad/s each way for 2 s (66 turns).
        Frames in by over 0.15 m 36 -> 8 (limit 12); jolts over 10 m/s 30 -> 28 (limit 30); held frames 12 -> 0 (limit 0); inside
        0 -> 0. The largest step in 0.57 -> 0.60 m and the largest jolt 70 -> 74 m/s: the eye passing the Fen canopy's margin where
        no eye between is clear, still open (limits 0.65 m and 80 m/s). The pitch's jolt 0.034 -> 0.040 rad, and 127 -> 129 frames
        over 0.006 rad (limits 0.045 and 135): a little worse here, where a 1.2 rad/s turn at the Fen canopy needs the rise at once
        and the rise starts at its full rate (eased, it came late and the eye came in for it, part 4).
     2. At 120 Hz, walking forward from the start and turning from 0.5 s: the Ramparts overhang at 1.2 rad/s left and the Barrows
        overhang at 3 rad/s right. The largest step in 0.33 -> 0.17 m and the largest jolt 39 -> 13 m/s (limits 0.25 m and 25 m/s).
        The first version of this fix made them 0.40 m and 49 m/s (an eye coming in that slowed by no more than 720 m/s/s, then
        squeezed on the next step).
     3. At 60 Hz, the Fen canopy turned at 0.6 rad/s left from rest, and at 0.8 rad/s left while the mouse raised the eye. The largest
        step in 0.22 -> 0.23 m, and 2 -> 0 frames with the eye inside the scenery (limits 0.35 m and none). The first version of this
        fix came in by 0.57 m in one step here.
     4. The rise does not come late and leave the eye to come in for it: the nearest the eye comes outside the cutaway is no more than
        1 m nearer than at 663fade6 (NEAR_WAS), for the mouse lowering the eye under the Fen canopy at 120 and 60 Hz (the first
        version of this fix: 4.82 and 5.64 m, an eased rise), and for the Ramparts walk and turn at 60 Hz */
  const SPOTS = { W3: ['barrows', [1.3, 0.78, -1.28, 3.142]], W1: ['barrows', [3, 0.52, 0.75, 3.142]], B1: ['bells', [0.75, 0.03, 7.5, 2.356]], B3: ['bells', [1.5, 4.5, -8.25, 0]],
    R1: ['ramparts', [3, -0.04, 17.25, 5.498]], N5: ['ramparts', [-1.75, 1.96, 23.25, 1.571]], F1: ['fen', [-0.75, -0.49, -3.75, 4.712]], F2: ['fen', [3, -0.49, 3, 1.571]],
    G5: ['gaol', [3.4, 4.1, -17.8, 0]], N3: ['gaol', [6.75, 0.46, -2.75, 0]], N7: ['gaol', [6.75, 0.46, -2.75, 3.142]] };
  const blank = () => ({ frames: 0, inMax: 0, in15: 0, pjMax: 0, pj6: 0, jolt: 0, j10: 0, held: 0, inside: 0, near: 9, at: '', pjAt: '' });
  const judge = (r, m, tag) => {
    let pdp = null, pr = null;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], c = r[i], dt = c.t - a.t;
      if (c.held) m.held++;
      if (!c.cut && !c.clear) m.inside++;
      if (!c.cut) m.near = Math.min(m.near, c.dist);
      if (a.cut || c.cut || !(dt > 0)) { pdp = pr = null; continue; }
      m.frames++;
      const dIn = a.dist - c.dist, dp = c.pitch - a.pitch, rr = (c.dist - a.dist) / dt;
      if (dIn > 0.15) m.in15++;
      if (dIn > m.inMax) { m.inMax = dIn; m.at = `${tag} at ${c.t.toFixed(2)} s`; }
      if (pdp !== null) {
        const pj = Math.abs(dp - pdp), j = Math.abs(rr - pr);
        if (pj > m.pjMax) { m.pjMax = pj; m.pjAt = `${tag} at ${c.t.toFixed(2)} s`; }
        if (pj > 0.006) m.pj6++;
        m.jolt = Math.max(m.jolt, j);
        if (j > 10) m.j10++;
      }
      pdp = dp; pr = rr;
    }
    return m;
  };
  const turn = (rate, dir, extra = {}) => (t, dt) => ({ ...extra, px: dir * rate / MOUSE.yaw * dt });
  const show = m => ({ frames: m.frames, inMax: r2(m.inMax), in15: m.in15, pjMax: +m.pjMax.toFixed(4), pj6: m.pj6, jolt: +m.jolt.toFixed(1), j10: m.j10, held: m.held, inside: m.inside });
  // 1. from rest at 120 Hz
  const m = blank();
  for (const [name, [id, spot]] of Object.entries(SPOTS)) for (const rate of [0.3, 0.6, 1.2]) for (const dir of [1, -1])
    judge(walls120(id, spot, turn(rate, dir), 2).rows, m, `${name} ${rate} rad/s ${dir > 0 ? 'right' : 'left'}`);
  assert.equal(m.inside, 0, `the eye was drawn inside the scenery on ${m.inside} frames`);
  assert.equal(m.held, 0, `${m.held} frames drew the step as it is and held it`);
  assert(m.in15 <= 12, `${m.in15} frames brought the eye in by over 0.15 m (worst ${m.inMax.toFixed(2)} m, ${m.at})`);
  assert(m.pjMax <= 0.045, `the pitch's step changed by ${m.pjMax.toFixed(3)} rad from one frame to the next (${m.pjAt})`);
  assert(m.pj6 <= 135, `the pitch's step changed by over 0.006 rad on ${m.pj6} frames`);
  assert(m.j10 <= 30, `the distance's rate changed by over 10 m/s on ${m.j10} frames`);
  assert(m.inMax <= 0.65 && m.jolt <= 80, `the eye came in by ${m.inMax.toFixed(2)} m in one frame (${m.at}), and its rate changed by up to ${m.jolt.toFixed(1)} m/s`);
  // 2. walking while turning at 120 Hz
  const w = blank();
  for (const [name, rate, dir] of [['R1', 1.2, -1], ['W1', 3, 1]]) {
    const [id, spot] = SPOTS[name];
    judge(walls120(id, spot, turn(rate, dir, { mz: 1 }), 2, 120, { mz: 1 }).rows, w, `${name} walking, ${rate} rad/s ${dir > 0 ? 'right' : 'left'}`);
  }
  assert.equal(w.inside, 0, `walking and turning, the eye was drawn inside the scenery on ${w.inside} frames`);
  assert(w.inMax <= 0.25 && w.jolt <= 25, `walking and turning, the eye came in by ${w.inMax.toFixed(2)} m in one frame (${w.at}), and its rate changed by up to ${w.jolt.toFixed(1)} m/s`);
  // 3. the Fen canopy at 60 Hz
  const s60 = blank();
  judge(walls120('fen', SPOTS.F2[1], turn(0.6, -1), 2, 60).rows, s60, 'F2 0.6 rad/s left at 60 Hz');
  judge(walls120('fen', SPOTS.F2[1], (t, dt) => ({ px: -0.8 / MOUSE.yaw * dt, py: 0.4 / MOUSE.pitch * dt }), 2, 60).rows, s60, 'F2 turning left and raising the eye at 60 Hz');
  assert.equal(s60.inside, 0, `at 60 Hz the eye was drawn inside the scenery on ${s60.inside} frames`);
  assert(s60.inMax <= 0.35, `at 60 Hz the eye came in by ${s60.inMax.toFixed(2)} m in one frame (${s60.at})`);
  // 4. the nearest the eye comes, against 663fade6
  const nearest = {};
  for (const [key, id, spot, move, hz, was] of [
    ['F2 lowering the eye 120 Hz', 'fen', SPOTS.F2[1], (t, dt) => (t < 1.5 ? { py: -0.8 / MOUSE.pitch * dt } : {}), 120, NEAR_WAS.f2_120],
    ['F2 lowering the eye 60 Hz', 'fen', SPOTS.F2[1], (t, dt) => (t < 1.5 ? { py: -0.8 / MOUSE.pitch * dt } : {}), 60, NEAR_WAS.f2_60],
    ['R1 walking and turning 60 Hz', 'ramparts', SPOTS.R1[1], (t, dt) => ({ mz: 1, px: 0.8 / MOUSE.yaw * dt }), 60, NEAR_WAS.r1_60]]) {
    const n = judge(walls120(id, spot, move, 3, hz).rows, blank(), key).near;
    nearest[key] = r2(n);
    assert(n >= was - 1, `${key}: the eye came in to ${n.toFixed(2)} m outside the cutaway (at 663fade6, ${was} m)`);
  }
  pass('turning by walls: a mouse turn from rest at 120 Hz, walking and turning, and the Fen canopy at 60 Hz come in without a jump and with no frame held or inside the scenery, and the rise does not leave the eye to come in for it',
    { rest: show(m), walking: show(w), at60: show(s60), nearest });
}
{
  /* A doorway into a roofed room, and a wall that comes between: the figure is never left hidden. A wall 6 or 14 m high and 0.5, 1 or
     2 m thick across the way, with a door 2.4 m wide, and with or without a roof 3 m up over the room behind; the lamplighter walks in
     through the door and on, then strafes 3 m along the room and stops, the camera following (both sides, walking and running). Outside
     the cutaway, the line from the eye to the head is blocked for no more than 0.5 s in a row. The first version of the near-face stop
     left the eye outside the wall at 4.2 m with the figure hidden to the end of the run in 6 of these 48 cases (11 to 13 s) */
  const blockedLine = (W, e, h) => { for (let k = 1; k < 60; k++) { const f = k / 60, p = e.map((q, i) => q + (h[i] - q) * f); if (W.support(p[0], p[2], p[1]) === null) return true; } return false; };
  let worst = 0, at = '';
  for (const H of [6, 14]) for (const th of [0.5, 1, 2]) for (const side of [1, -1]) for (const roof of [false, true]) for (const run of [1, 0.5]) {
    const W = layered((x, z) => (z >= -th && z <= 0 && Math.abs(x) > 1.2 ? H : roof && z < -th && z > -8 && Math.abs(x) < 6 ? [H, 0, 3] : 0), 20);
    const b = makeBody(W, { p: [0, 0.5, 6], yaw: Math.PI }, 38), cam = cameraFor(W, '1280x720', 0, { auto: true });
    cam.snap(b.s, 0);
    let hid = 0, phase = 0;
    for (let i = 0; i < 900; i++) {
      let inp = {};
      if (phase === 0) { if (b.s.z > -3) inp = { mz: run }; else phase = 1; }
      if (phase === 1) { if (Math.abs(b.s.x) < 3) inp = { mx: side * run }; else phase = 2; }
      b.step(STEP, inp, cam.c.yaw);
      const v = cam.follow(b.s, STEP, inp);
      if (!v.cut && blockedLine(W, eyeOf(v), [b.s.x, b.s.y + 1.3, b.s.z])) { if (++hid > worst) { worst = hid; at = `wall ${H} m, ${th} m thick, side ${side}, roof ${roof}, speed ${run}`; } } else hid = 0;
    }
  }
  assert(worst <= 30, `the figure stood hidden behind a wall for ${(worst * STEP).toFixed(2)} s outside the cutaway (${at})`);
  // a tall wall dropped between the eye and the figure as it stands (the view still): hidden no longer than 0.5 s outside the cutaway
  let hold = 0;
  for (const [H, th] of [[14, 1], [6, 1], [14, 2]]) {
    let cur = OPEN; const walk = new Proxy({}, { get: (_, k) => cur[k] }), W = layered((x, z) => (z >= 3 && z <= 3 + th ? H : 0));
    const b = makeBody(OPEN, { p: [0, 0.5, 0], yaw: Math.PI }, 38), cam = cameraFor(walk, '1280x720', 0, { auto: false });
    cam.snap(b.s, 0);
    for (let i = 0; i < 30; i++) cam.follow(b.s, STEP, {});
    cur = W;
    let hid = 0;
    for (let i = 0; i < 600; i++) { const v = cam.follow(b.s, STEP, {}); if (!v.cut && blockedLine(W, eyeOf(v), [b.s.x, b.s.y + 1.3, b.s.z])) hold = Math.max(hold, ++hid); else hid = 0; }
  }
  assert(hold <= 30, `with a wall come between, the figure stood hidden for ${(hold * STEP).toFixed(2)} s outside the cutaway`);
  /* and a wall that only runs alongside the line of sight (a corridor's, its face 0.05 to 0.25 m beside the eye, 5 or 12 m high) does
     not move the camera: the 0.3 m camera radius does not pull the eye forward for it (the first version settled it at 3.2 m from 8.5) */
  let lo = 99;
  for (const gap of [0.05, 0.15, 0.25]) for (const H of [5, 12]) {
    const W = layered((x, z) => (x >= gap && x <= gap + 1 && z >= 2 ? H : 0)), b = makeBody(W, { p: [0, 0.5, 0], yaw: Math.PI }, 38), cam = cameraFor(W, '1280x720', 0, { auto: false });
    cam.snap(b.s, 0);
    for (let i = 0; i < 300; i++) { b.step(STEP, {}, cam.c.yaw); const v = cam.follow(b.s, STEP, { mouse: true }); if (i > 60) lo = Math.min(lo, v.dist); }
  }
  assert(lo >= 8.4, `a wall alongside the line of sight brought the eye in to ${lo.toFixed(2)} m`);
  pass('a doorway into a roofed room or a wall come between never leaves the figure hidden over 0.5 s, and a wall alongside does not move the eye', { hiddenSteps: worst, between: hold, alongside: r2(lo) });
}

console.log(`\n${n} passed`);
