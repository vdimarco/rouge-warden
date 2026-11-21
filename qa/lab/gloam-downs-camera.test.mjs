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
// Run: node qa/lab/gloam-downs-camera.test.mjs   (GLOAM_WORLDS=0 to leave out the baked places)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, makeCamera, camLayout, VIEW } from '../../public/lab/gloam-downs/play.js';
import { makeCombat, makeMoveLock, makeBossCam, projector, frameClear, bossLeast, yawDiff, asFoes, COMBAT, BOSS } from '../../public/lab/gloam-downs/cameras.js';
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
  assert(v.dist > 2 && v.dist <= 8.5, `under the roof it stands ${v.dist} back`);
  pass('under a long roof the camera follows inside the passage', { dist: r2(v.dist), pitch: r2(v.pitch) });
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
  for (let i = 0; i < 180; i++) stepCam(cam, b.s, m.turn);
  assert.equal(m.foe.id, 'post1');
  assert(Math.abs(yawDiff(cam.c.yaw, b.s, posts[0])) <= 20 * DEG + 1e-9, 'it turned to the nearest post');
  posts[0].alive = false;
  stepCam(cam, b.s, m.turn);
  assert.equal(m.foe.id, 'post2', 'a post put out: it chooses again');
  assert.deepEqual(asFoes([{ id: 'a', x: 0, y: 0, z: 0, awake: false }, { id: 'b', x: 1, y: 0, z: 1, home: 1, range: Infinity }]), [{ id: 'b', x: 1, y: 0, z: 1, home: true, range: Infinity }]);
  pass('training posts stand in for foes');
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

console.log(`\n${n} passed`);
