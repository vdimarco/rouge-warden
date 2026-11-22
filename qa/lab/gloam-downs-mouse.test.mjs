// Gloam Downs' mouse look and the calmer cameras, checked in node with no browser (public/lab/gloam-downs/input.js mouseLook and
// mouseAct, play.js makeCamera, across and autoTurn, cameras.js makeCombat):
//   the look math: the speed per pixel, the fallback drag, the cap on one event and the pitch kept in the camera's limits;
//   which button does what, with the mouse taken, not taken, and where the page cannot take it;
//   with the mouse taken, the swing behind a running lamplighter, the turn out of a lane and the combat camera's turn stay off;
//   on touch, keys and pads, the swing and the combat turn wait 2 s and turn slower, and never while a move across the view is held;
//   the boss camera does not turn while the mouse is taken or a move across the view is held, and turns after 0.6 s when neither;
//   the pull-in near a wall eases both ways, with the eye never in the wall, for walls 0.5 and 1 m thick, 1 and 2 m away, at 1.2 and
//     3 rad/s, at 1280x720 and 390x844; and standing still by a wall or under a roof is still;
//   on the five baked places (skipped with GLOAM_WORLDS=0): the view swept round with the mouse at 1.2 rad/s both ways at the spawn and
//     each wisp, at 1280x720 and 390x844: the distance never dives, and the eye comes in faster than 15 m/s only where the walk map says
//     its own path round meets a wall.
// Run: node qa/lab/gloam-downs-mouse.test.mjs   (GLOAM_WORLDS=0 to leave out the baked places)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { mouseLook, mouseAct, MOUSE } from '../../public/lab/gloam-downs/input.js';
import { makeWalk, makeBody, makeCamera, camLayout, across, autoTurn, AUTO } from '../../public/lab/gloam-downs/play.js';
import { makeCombat, makeBossCam, makeMoveLock, yawDiff, COMBAT, BOSS } from '../../public/lab/gloam-downs/cameras.js';
import { ORDER } from '../../public/lab/gloam-downs/save.js';

const DIR = new URL('../../public/lab/gloam-downs/', import.meta.url);
// the mouse turn in the wall check: 0.02 rad a step, 1.2 rad/s
const TURN = 0.02;
const STEP = 1 / 60, DEG = Math.PI / 180;
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;
const r3 = v => +v.toFixed(3);
function layered(fn, half = 30) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz, vals = [];
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) {
    const v = fn(info.x0 + i * info.step, info.z0 + j * info.step);
    vals.push(Array.isArray(v) ? v : [v, v]);
  }
  const three = vals.some(v => v.length > 2), cells = new Int16Array((three ? 3 : 2) * N);
  vals.forEach(([t, g, u], k) => { cells[k] = Math.round(t * 100); cells[N + k] = Math.round((g ?? t) * 100); if (three) cells[2 * N + k] = u === undefined ? 0 : Math.round(u * 100); });
  return makeWalk(info, cells);
}
const OPEN = layered(() => 0, 40);
const stand = (walk, x, z, yaw = Math.PI) => makeBody(walk, { p: [x, walk.top(x, z) + 0.5, z], yaw }, 38);
const eyeOf = v => { const cp = Math.cos(v.pitch); return [v.target[0] + v.dist * Math.sin(v.yaw) * cp, v.target[1] + v.dist * Math.sin(v.pitch), v.target[2] + v.dist * Math.cos(v.yaw) * cp]; };

{ // the look math: 0.0022 rad per px across, 0.0018 down; right turns right (yaw down), down tilts down (pitch up); the drag is twice
  // that; one event moves 120 px at most
  const a = mouseLook(100, 50);
  assert(near(a.dyaw, -0.22, 1e-12) && near(a.dpitch, 0.09, 1e-12), `100 px right and 50 down: ${JSON.stringify(a)}`);
  const d = mouseLook(-10, 0, true);
  assert(near(d.dyaw, 10 * MOUSE.yaw * MOUSE.drag, 1e-12), 'the drag of the fallback turns at twice the speed');
  const big = mouseLook(5000, -5000);
  assert(near(big.dyaw, -120 * MOUSE.yaw, 1e-12) && near(big.dpitch, -120 * MOUSE.pitch, 1e-12), 'a spike of 5000 px counts as 120');
  assert.deepEqual(mouseLook(undefined, undefined), { dyaw: -0, dpitch: 0 });
  // the pitch stays in the camera's limits, 0.08 to 1.05, whatever the mouse does
  const b = stand(OPEN, 0, 0), cam = makeCamera(OPEN, { yaw: 0, ...camLayout(1280, 720), auto: false });
  cam.snap(b.s, 0);
  for (let i = 0; i < 60; i++) cam.follow(b.s, STEP, { ...mouseLook(0, 120), mouse: true });
  assert(near(cam.c.pitch, 1.05, 1e-12), `down to ${cam.c.pitch}`);
  for (let i = 0; i < 60; i++) cam.follow(b.s, STEP, { ...mouseLook(0, -120), mouse: true });
  assert(near(cam.c.pitch, 0.08, 1e-12), `up to ${cam.c.pitch}`);
  // a sweep of 1280 px turns the view 2.8 rad: a calm speed, a half turn for a long move across a mouse pad
  pass('the mouse look: 0.0022 and 0.0018 rad per px, a drag at twice that, spikes capped, the pitch kept in 0.08 to 1.05', { sweep: r3(1280 * MOUSE.yaw) });
}
{ // which button does what
  const T = (b, o) => mouseAct(b, o);
  // the mouse not taken, and the page can take it: the click takes it and does nothing else
  for (const run of [true, false]) for (const b of [0, 2]) assert.equal(T(b, { run, locked: false, lockable: true }), 'take');
  // taken: in a run the left attacks and the right rolls; in the explorer the left jumps and the right does nothing
  assert.equal(T(0, { run: true, locked: true }), 'attack');
  assert.equal(T(2, { run: true, locked: true }), 'roll');
  assert.equal(T(0, { run: false, locked: true }), 'jump');
  assert.equal(T(2, { run: false, locked: true }), null);
  // the fallback: the left attacks or jumps, the right drags the look
  assert.equal(T(0, { run: true, locked: false, lockable: false }), 'attack');
  assert.equal(T(0, { run: false, locked: false, lockable: false }), 'jump');
  assert.equal(T(2, { run: true, locked: false, lockable: false }), 'look');
  assert.equal(T(2, { run: false, locked: false, lockable: false }), 'look');
  // the middle button and the side buttons do nothing; no button turns the view while the mouse is taken
  for (const b of [1, 3, 4]) assert.equal(T(b, { run: true, locked: true }), null);
  for (const b of [0, 1, 2, 3, 4]) assert.notEqual(T(b, { run: true, locked: true }), 'look');
  pass('the buttons: a click that takes the mouse does nothing else; taken, left attacks or jumps and right rolls; the fallback drags with the right');
}
{ // a move across the view: more than 35° from straight ahead or back, past the stick's dead size
  assert(!across(0, 1) && !across(0, -1) && !across(0.5, 1) && !across(0.1, 0.05), 'ahead, back, 27° and a light tilt are not across');
  assert(across(1, 0) && across(-1, 0) && across(0.8, 1) && across(1, -1), 'the side, 39° and a back diagonal are across');
  assert(near(AUTO.wait, 2, 1e-12) && near(AUTO.swing, 0.5, 1e-12), 'the wait is 2 s and the swing 0.5/s');
  assert(autoTurn({ auto: true, steer: false, across: false, idle: 2.1 }) && !autoTurn({ auto: true, steer: true, across: false, idle: 9 }) &&
    !autoTurn({ auto: true, steer: false, across: true, idle: 9 }) && !autoTurn({ auto: true, steer: false, across: false, idle: 1.9 }) &&
    !autoTurn({ auto: false, steer: false, across: false, idle: 9 }), 'autoTurn: only with the mouse free, no move across, after 2 s, and not with reduced motion');
  pass('a move across the view, and the rules for a turn by itself');
}
// the lamplighter runs to the side (+x) for `sec` s with the camera behind it at yaw 0; inp is the held input on each step
function runSide(inp, sec, turn = null, idle = 0) {
  const b = stand(OPEN, 0, 0, Math.PI / 2), cam = makeCamera(OPEN, { yaw: 0, ...camLayout(1280, 720) });
  cam.snap(b.s, 0); cam.c.idle = idle;
  const yaws = [];
  for (let i = 0; i < sec * 60; i++) { b.s.x += 5 * STEP; b.s.vx = 5; b.s.vz = 0; cam.follow(b.s, STEP, inp, turn); yaws.push(cam.c.yaw); }
  return { yaw: cam.c.yaw, yaws, cam };
}
{ // with the mouse taken nothing turns the view: 5 s of running to the side, and of running past a foe
  const free = runSide({}, 5), taken = runSide({ mouse: true }, 5);
  assert(Math.abs(free.yaw) > 0.3, `with the mouse free the swing turns the view (${free.yaw})`);
  assert.equal(taken.yaw, 0, 'with the mouse taken the view does not swing');
  const foe = { id: 'S', x: 3, y: 0, z: -4 };
  const m = makeCombat({ foes: () => [{ ...foe, x: foe.x }] }), past = runSide({ mouse: true }, 5, m.turn, 9);
  assert.equal(past.yaw, 0, 'with the mouse taken the combat camera does not turn to a foe');
  const m2 = makeCombat({ foes: () => [foe] }), b = stand(OPEN, 0, 0), cam = makeCamera(OPEN, { yaw: 0, ...camLayout(1280, 720) });
  cam.snap(b.s, 0);
  for (let i = 0; i < 300; i++) cam.follow(b.s, STEP, { mouse: true }, m2.turn);
  assert.equal(cam.c.yaw, 0, 'standing by a foe with the mouse taken, the view stays');
  for (let i = 0; i < 60; i++) cam.follow(b.s, STEP, {}, m2.turn);
  assert(cam.c.yaw !== 0 && m2.foe?.id === 'S', 'with the mouse free again (after 9 s with no look input) the combat camera turns');
  // a lane: walls 2 m to each side of a run with a bend, where the free camera turns out of the lane; taken, it does not
  const LANE = layered((x, z) => (Math.abs(x) > 1.6 && z > -25 ? 4 : 0));
  const run = inp => {
    const r = stand(LANE, 0, 10, Math.PI), c = makeCamera(LANE, { yaw: 0.9, ...camLayout(1280, 720) });
    r.s.yaw = Math.PI; c.snap(r.s, 0.9);
    for (let i = 0; i < 120; i++) { r.s.z -= 5 * STEP; r.s.vz = -5; r.s.vx = 0; c.follow(r.s, STEP, inp); }
    return c.c.yaw;
  };
  const laneFree = run({}), laneTaken = run({ mouse: true });
  assert(Math.abs(laneFree - 0.9) > 0.05, `the free camera turns in the lane (${laneFree})`);
  assert.equal(laneTaken, 0.9, 'taken, the camera does not turn out of the lane');
  pass('with the mouse taken, no swing, no turn to a foe and no turn out of a lane', { swingFree: r3(free.yaw), laneFree: r3(laneFree) });
}
{ // on touch, keys and pads: the swing waits 2 s with no look input and eases at 0.5/s; a move held across the view never turns it
  const r = runSide({}, 4);
  const first = r.yaws.findIndex(y => y !== 0);
  assert(near((first + 1) * STEP, AUTO.wait + STEP, 1.5 * STEP), `the swing starts after ${(first + 1) * STEP} s`);
  let fastest = 0;
  for (let i = 1; i < r.yaws.length; i++) fastest = Math.max(fastest, Math.abs(r.yaws[i] - r.yaws[i - 1]) / STEP);
  // the swing's turn is d × 0.5/s, so at most 0.5 × 2.6 rad/s, and here (a quarter turn) under 0.8 rad/s
  assert(fastest <= AUTO.swing * Math.PI / 2 + 1e-9, `the swing turned at ${fastest} rad/s`);
  const side = runSide({ mx: 1, mz: 0 }, 5);
  assert.equal(side.yaw, 0, 'holding a move across the view, the view does not swing');
  // the combat camera: after 2 s with no look input, at 0.6 rad/s; held across, not at all
  const foe = { id: 'S', x: 4, y: 0, z: 0 };
  const turnOf = inp => {
    const b = stand(OPEN, 0, 0), cam = makeCamera(OPEN, { yaw: 0, ...camLayout(390, 844) }), m = makeCombat({ foes: () => [foe] });
    cam.snap(b.s, 0); cam.c.idle = 0;
    let start = null, fast = 0, y = 0;
    for (let i = 1; i <= 240; i++) {
      cam.follow(b.s, STEP, inp, m.turn);
      if (start === null && cam.c.yaw !== y) start = i * STEP;
      fast = Math.max(fast, Math.abs(cam.c.yaw - y) / STEP); y = cam.c.yaw;
    }
    return { start, fast, yaw: cam.c.yaw };
  };
  const t = turnOf({}), held = turnOf({ mx: -1, mz: 0 });
  assert(near(t.start, COMBAT.wait + STEP, 1.5 * STEP) && t.fast <= COMBAT.rate + 1e-9, `the combat turn starts at ${t.start} s and turns at ${t.fast} rad/s`);
  assert.equal(held.yaw, 0, 'holding a move across the view, the combat camera does not turn');
  pass('touch, keys and pads: the turns wait 2 s, the swing eases at 0.5/s, the combat turn at 0.6 rad/s, and a move across stops both', { start: r3(t.start), rate: r3(t.fast) });
}
{ // the boss camera: the boss up and the fight started, the lamplighter 4 m from the arena's centre and 9 s with no look input. With
  // the mouse taken, or with a move held across the view, it does not turn for 3 s; with neither, it turns after BOSS.wait
  const centre = [0, 0, 0], boss = { id: 'reeve', x: 0, y: 0, z: 0, up: true, started: true };
  const screen = { w: 1280, h: 720, bar: 52, rects: [] };
  const rig = () => {
    const b = stand(OPEN, 4, 0), cam = makeCamera(OPEN, { yaw: 0, ...camLayout(1280, 720) }), bc = makeBossCam(cam, { screen, boss: () => boss, centre });
    cam.snap(b.s, 0); cam.c.idle = 9;
    return { b, cam, bc, step: inp => bc.step(b.s, STEP, cam.follow(b.s, STEP, inp, bc.turn)) };
  };
  const yaws = (r, inp, sec) => { const out = []; for (let i = 0; i < sec * 60; i++) { r.step(inp); out.push(r.cam.c.yaw); } return out; };
  const a = rig(), taken = yaws(a, { mouse: true }, 3);
  assert(a.bc.live(a.b.s), 'the boss camera is on');
  assert(taken.every(y => y === 0), `with the mouse taken the boss camera turned to ${Math.max(...taken.map(Math.abs))}`);
  const across1 = yaws(a, { mx: 1, mz: 0 }, 3);
  assert(across1.every(y => y === 0), 'with a move held across the view the boss camera does not turn');
  // a small look with the mouse, then the mouse freed and nothing held: the turn comes BOSS.wait after the look
  a.step({ dyaw: 0.01, mouse: true });
  const y1 = a.cam.c.yaw, free = yaws(a, {}, 1.5), first = free.findIndex(y => y !== y1);
  assert(first >= 0 && near((first + 1) * STEP, BOSS.wait + STEP, 1.5 * STEP), `with neither it turns after ${(first + 1) * STEP} s`);
  pass('the boss camera: no turn while the mouse is taken or a move across is held, and a turn after 0.6 s with neither', { after: r3((first + 1) * STEP) });
}
{ /* the pull-in near a wall eases both ways: the view turned into a long wall with the mouse, and back out again. Walls 0.5 and 1 m
     thick, 1 and 2 m behind the lamplighter, turned at 1.2 and 3 rad/s. No step changes the distance by more than 1 m, the change from
     one step to the next is 0.4 m or less, and the eye is never in the wall. The camera of 09fd360b came in by 4.8 m in one step at
     390x844 by the wall 0.5 m thick and 1 m away at 1.2 rad/s, and its eye was in that wall at 3 rad/s */
  const out = [];
  for (const [thick, gap] of [[1, 2], [0.5, 1], [1, 1], [0.5, 2]]) {
    const WALL = layered((x, z) => (x >= gap && x <= gap + thick ? 14 : 0));
    for (const rate of [1.2, 3, 6]) for (const [w, h] of [[1280, 720], [390, 844]]) {
      const b = stand(WALL, 0, 0), cam = makeCamera(WALL, { yaw: -Math.PI / 2, ...camLayout(w, h) });
      cam.snap(b.s, -Math.PI / 2);
      let last = null, step = 0, jerk = 0, inWall = 0, least = Infinity, d1 = null;
      for (let i = 0; i < 240; i++) {
        const v = cam.follow(b.s, STEP, { dyaw: (i < 120 ? 1 : -1) * rate * STEP, mouse: true });
        const e = eyeOf(v);
        if (WALL.support(e[0], e[2], e[1]) === null) inWall++;
        if (last) { const d = v.dist - last.dist; step = Math.max(step, Math.abs(d)); if (d1 !== null) jerk = Math.max(jerk, Math.abs(d - d1)); d1 = d; }
        least = Math.min(least, cam.c.dist);
        last = v;
      }
      const tag = `${w}x${h}, a wall ${thick} m thick ${gap} m away at ${rate} rad/s`;
      assert(least < cam.c.want - 1, `${tag}: it came in (${least})`);
      assert(step <= 1 && jerk <= 0.4, `${tag}: the distance changed by ${step} m in one step, and its change by ${jerk} m`);
      assert.equal(inWall, 0, `${tag}: the eye was in the wall on ${inWall} steps`);
      out.push({ w, thick, gap, rate, step: r3(step), jerk: r3(jerk) });
    }
  }
  /* a tall pillar 0.5 or 1 m thick, 1.5 or 3 m wide, 1 to 3 m behind the lamplighter, which walks past it at 3 and 6 m/s with the mouse
     taken: the pillar comes between, and the eye, clear behind it, must come in past it. The eye is never in the pillar (the camera of
     09fd360b had it there on 23 steps) */
  let inPillar = 0;
  for (const thick of [0.5, 1]) for (const gap of [1, 2, 3]) for (const wide of [1.5, 3]) for (const sp of [3, 6]) for (const [w, h] of [[1280, 720], [390, 844]]) {
    const P = layered((x, z) => (z >= gap && z <= gap + thick && Math.abs(x) <= wide / 2 ? 14 : 0));
    const b = makeBody(P, { p: [-6, 0.5, 0], yaw: Math.PI }, 38), cam = makeCamera(P, { yaw: 0, ...camLayout(w, h), auto: false });
    cam.snap(b.s, 0);
    for (let i = 0; i < 240; i++) {
      b.s.x += sp * STEP; b.s.vx = sp;
      const e = eyeOf(cam.follow(b.s, STEP, { mouse: true }));
      if (P.support(e[0], e[2], e[1]) === null) inPillar++;
    }
  }
  assert.equal(inPillar, 0, `walking past a pillar the eye was in it on ${inPillar} steps`);
  // standing still with the back to a wall, and under a low roof: the view does not move at all after it settles
  const ROOF = layered((x, z) => (Math.abs(x) <= 1.5 && z > -10 && z < 10 ? [4, 0, 2.4] : Math.abs(x) <= 3 && z > -10 && z < 10 ? 4 : 0));
  const WALL = layered((x, z) => (x >= 2 && x <= 3 ? 14 : 0));
  for (const [walk, x, z, yaw] of [[WALL, 1.5, 0, -Math.PI / 2], [WALL, 1.2, 0, -Math.PI / 4], [ROOF, 0, 0, 0], [ROOF, 0, 8, 0.4]]) {
    const b = makeBody(walk, { p: [x, 0.5, z], yaw: yaw + Math.PI }, 38), cam = makeCamera(walk, { yaw, ...camLayout(1280, 720) });
    cam.snap(b.s, yaw);
    let last = null, moved = 0;
    for (let i = 0; i < 180; i++) {
      b.step(STEP, {}, cam.c.yaw);
      const v = cam.follow(b.s, STEP, {});
      if (i >= 90 && last) moved += Math.abs(v.dist - last.dist) + Math.abs(v.pitch - last.pitch) + Math.abs(v.yaw - last.yaw);
      last = v;
    }
    assert(moved < 1e-6, `standing still at ${x}, ${z}: the view moved ${moved}`);
  }
  pass('the pull-in near a wall eases both ways with the eye out of the wall, and the view is still by a wall and under a roof', {
    worstStep: Math.max(...out.map(o => o.step)), worstJerk: Math.max(...out.map(o => o.jerk))
  });
}
if (process.env.GLOAM_WORLDS !== '0') {
  /* the five baked places: at the spawn and each wisp, the view turned round with the mouse at 1.2 rad/s for 6 s, each way, at 1280x720
     and 390x844. A step changes the distance by 0.6 m or less, except where the eye comes in through a wall from behind (the line from the
     old eye to the new one passes within 0.35 m of the scenery, where play.js lets no eye be; a turn faster than the camera may come
     in can leave it there): at most 8 such steps in all 120 sweeps, each under 2.1 m. Both ways, the camera of 3fe9318f had 8, up to
     1.75 m, and that of 45ffb438 7, up to 2.05 m: a clear eye now comes in at 15 m/s, not 33, and can meet a wall 2 m thick from
     behind. The first tight-space fix (2337588c) had 9, up to 2.69 m. The framed shot of 100a12c4 had 2, for it hid the follow eye
     behind a picture from another yaw, which stood still while the mouse turned. The view now turns with the mouse in a nook too, and
     the follow eye's own steps show: at most 10 such steps, each under 2.2 m (9, up to 2.08 m, all but two of them into the near
     fade's 1.5 m). The
     camera of 09fd360b changed it by more than 0.6 m on 142 steps of the 60 sweeps one way. And where the eye is clear, it comes in at no more than 15 m/s, except at a step
     through a wall: a wall that the turn will bring between starts it in early, but not faster; and its speed in builds by no more than
     360 m/s/s. "Clear" is read here from the walk map alone, not from play.js: the old eye (its last distance, at this step's aim and
     pitch) marched along its path round for 0.3 s of the sweep's turn, every 0.1 m, with the 0.35 m clearance of `through`. The camera
     of 7dcfd747 came in faster on 733 steps here (one way), from 8.5 m to under 1 m in 0.3 s; that of 3fe9318f on 53 steps (both ways),
     from 8.5 to 2.99 m in 0.23 s at Barrows (-7.9, 12.8), for its look-ahead marched a nearer goal's path, not the eye's */
  const DEV = { over: 0.6, cross: 10, crossMax: 2.2, pull: 15, acc: 360, look: 0.3, rate: 1.2 };
  let sum = 0, steps = 0, over = 0, cross = 0, crossMax = 0, worst = 0, fast = 0, fastAt = '', jolt = 0, joltAt = '';
  for (const id of ORDER) {
    const meta = JSON.parse(fs.readFileSync(new URL(`worlds/${id}.json`, DIR), 'utf8'));
    const raw = zlib.gunzipSync(fs.readFileSync(new URL(`worlds/${id}.walk.bin.gz`, DIR)));
    const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
    // may an eye be at (x, y, z): 0.35 m clear of the scenery, above it or in the gap under an arch?
    // (in a room taller than the least gap, up to 0.35 under its underside: the lowest of the four corners round the point)
    const under = (x, z) => {
      if (!walk.U) return null;
      const i = Math.floor((x - walk.x0) / walk.step), j = Math.floor((z - walk.z0) / walk.step);
      let lo = Infinity;
      for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const k = Math.min(walk.nz - 1, Math.max(0, j + c)) * walk.nx + Math.min(walk.nx - 1, Math.max(0, i + a));
        if (!(walk.G[k] < walk.T[k])) return null;
        lo = Math.min(lo, walk.U[k] * 0.01);
      }
      return lo;
    };
    const free = (x, y, z) => {
      const t = walk.top(x, z), g = walk.floor(x, z);
      if (y >= t + 0.35) return true;
      const u = g < t - 0.05 ? under(x, z) : null;
      return g < t - 0.05 && y >= g + 0.35 && y <= Math.max(g + 1.45, u === null ? 0 : u - 0.35);
    };
    // does the straight line between two eyes pass where an eye may not be?
    const through = (a, b) => {
      for (let k = 1; k < 40; k++) if (!free(a[0] + (b[0] - a[0]) * k / 40, a[1] + (b[1] - a[1]) * k / 40, a[2] + (b[2] - a[2]) * k / 40)) return true;
      return false;
    };
    // is the old eye clear on its path round: at distance d, this step's aim and pitch, from yaw0 on by `by`, every 0.1 m?
    const clearRound = (v, d, yaw0, by) => {
      const cp = Math.cos(v.pitch), n = Math.max(1, Math.ceil(Math.abs(by) * d * cp / 0.1));
      for (let k = 0; k <= n; k++) {
        const a = yaw0 + by * k / n;
        if (!free(v.target[0] + d * Math.sin(a) * cp, v.target[1] + d * Math.sin(v.pitch), v.target[2] + d * Math.cos(a) * cp)) return false;
      }
      return true;
    };
    for (const p of [meta.spawn.p, ...meta.wisps.map(q => q.p)]) for (const [w, h] of [[1280, 720], [390, 844]]) for (const dir of [1, -1]) {
      const b = makeBody(walk, { p, yaw: 0 }, 34), cam = makeCamera(walk, { yaw: Math.PI, ...camLayout(w, h) });
      b.place(p, 0); cam.snap(b.s, Math.PI);
      let last = null;
      for (let i = 0; i < 30; i++) last = cam.follow(b.s, STEP, { mouse: true });
      let inPrev = Math.max(0, -cam.c.dv * STEP);
      for (let i = 0; i < 360; i++) {
        const v = cam.follow(b.s, STEP, { dyaw: dir * DEV.rate * STEP, mouse: true });
        steps++; sum += v.dist;
        if (last) {
          const d = Math.abs(v.dist - last.dist);
          worst = Math.max(worst, d);
          if (d > DEV.over) {
            assert(through(eyeOf(last), eyeOf(v)), `${id} ${w}x${h} at ${p[0].toFixed(1)}, ${p[2].toFixed(1)}: the distance changed by ${d.toFixed(2)} m in one step with open air between`);
            cross++; crossMax = Math.max(crossMax, d);
          }
          if (d > DEV.over) over++;
          // the speed coming in builds by no more than 360 m/s/s: from rest to 15 m/s over 3 steps, not at once
          const inw = last.dist - v.dist;
          if (inw - inPrev > DEV.acc * STEP * STEP + 1e-6 && !through(eyeOf(last), eyeOf(v))) {
            jolt++;
            joltAt ||= `${id} ${w}x${h} at ${p[0].toFixed(1)}, ${p[2].toFixed(1)}, step ${i}: in by ${inPrev.toFixed(3)} then ${inw.toFixed(3)} m`;
          }
          inPrev = Math.max(0, inw);
          if (inw > DEV.pull * STEP + 1e-6 && !through(eyeOf(last), eyeOf(v)) && clearRound(v, last.dist, last.yaw, dir * DEV.rate * DEV.look)) {
            fast++;
            fastAt ||= `${id} ${w}x${h} at ${p[0].toFixed(1)}, ${p[2].toFixed(1)}, turning ${dir > 0 ? 'left' : 'right'}, step ${i}: ${last.dist.toFixed(2)} -> ${v.dist.toFixed(2)} m`;
          }
        }
        last = v;
      }
    }
  }
  assert.equal(fast, 0, `with the eye clear the camera came in faster than ${DEV.pull} m/s on ${fast} steps, first ${fastAt}`);
  assert(cross <= DEV.cross && crossMax < DEV.crossMax, `${cross} steps came in through a wall, by up to ${crossMax.toFixed(2)} m`);
  assert.equal(jolt, 0, `the speed coming in jumped on ${jolt} steps, first ${joltAt}`);
  pass('the five places: a sweep of the mouse at 1.2 rad/s each way at each spawn and wisp never dives', { sweeps: steps / 360, mean: r3(sum / steps), over, worst: r3(worst), cross, crossMax: r3(crossMax), fast });
}
if (process.env.GLOAM_WORLDS !== '0') {
  /* "mouse feels good", in a nook too. A full turn in 6 s, 1° a step, at three spots in the Gaol's torn cell and at every wisp of the
     five places (the camera test's 28 spots), at 1280x720 and 390x844: each way with the mouse, and one way with a stick (0.4 of its
     2.6 rad/s), then 1.5 s still. On every step the picture turns by 80 to 120% of the player's turn, and the framed shot's lean never
     takes it more than 60° from the player's own turns; the 1.5 s still never turns it (the lean only goes with a turn the player
     makes). follow() returns cam.c.yaw itself, which the moves, the soft aim and the fight's bearings read (main.js, run.js, fight.js),
     so there is one yaw. The framed shot of 100a12c4 showed the picture from a yaw up to 180° from the mouse's: in the cell it stood
     still (under 0.1° of a 1° step) on 68 to 92% of the steps, and a move went up to 180° off the way the screen showed */
  const place = id => {
    const meta = JSON.parse(fs.readFileSync(new URL(`worlds/${id}.json`, DIR), 'utf8'));
    const raw = zlib.gunzipSync(fs.readFileSync(new URL(`worlds/${id}.walk.bin.gz`, DIR)));
    return { meta, walk: makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1)) };
  };
  const places = Object.fromEntries(ORDER.map(id => [id, place(id)]));
  const spots = [['gaol', 1.6, -1.6], ['gaol', 1.6, -2.1], ['gaol', 1.6, -0.9]];
  for (const id of ORDER) for (const wp of places[id].meta.wisps) spots.push([id, wp.p[0], wp.p[2], wp.p[1]]);
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), ONE = DEG;
  const rows = [];
  let leaned = 0;
  for (const [w, h] of [[1280, 720], [390, 844]]) for (const how of ['mouse+', 'mouse-', 'stick']) {
    let lo = Infinity, hi = 0, off = 0, steps = 0, still = 0, framed = 0, after = 0;
    for (const [id, x, z, wy] of spots) {
      const { walk } = places[id], y = wy === undefined ? walk.floor(x, z) : walk.support(x, z, wy + 0.5) ?? walk.floor(x, z);
      const b = makeBody(walk, { p: [x, y + 0.5, z], yaw: Math.PI }, 38), cam = makeCamera(walk, { yaw: 0, ...camLayout(w, h) });
      cam.snap(b.s, 0);
      const dir = how === 'mouse-' ? -1 : 1, ox = 0.4, turn = how === 'stick' ? ox * 2.6 * STEP : dir * ONE;
      let prev = null, mine = 0;
      for (let i = 0; i < 510; i++) {
        b.step(STEP, {}, cam.c.yaw);
        const turning = i >= 60 && i < 420, inp = !turning ? { mouse: how !== 'stick' } : how === 'stick' ? { ox } : { dyaw: turn, mouse: true };
        const v = cam.follow(b.s, STEP, inp);
        if (i < 60) { prev = v.yaw; mine = v.yaw; continue; }
        if (i >= 420) after = Math.max(after, Math.abs(wrap(v.yaw - prev)));
        if (turning) {
          mine += turn;
          const r = wrap(v.yaw - prev) / turn;
          lo = Math.min(lo, r); hi = Math.max(hi, r); steps++;
          if (Math.abs(wrap(v.yaw - prev)) < 0.1 * DEG) still++;
        }
        off = Math.max(off, Math.abs(wrap(v.yaw - mine)));
        if (cam.c.framing && Math.abs(cam.c.off) > 0.02) framed++;
        prev = v.yaw;
      }
    }
    const tag = `${w}x${h} ${how}`;
    assert.equal(after, 0, `${tag}: the view turned by itself after the turn, by up to ${(after / DEG).toFixed(2)}° a step`);
    assert(lo >= 0.8 && hi <= 1.2, `${tag}: a step of the player's turn turned the picture by ${(lo * 100).toFixed(0)} to ${(hi * 100).toFixed(0)}%`);
    assert.equal(still, 0, `${tag}: the picture stood still on ${still} steps of the turn`);
    assert(off <= 60 * DEG + 1e-6, `${tag}: the view stood ${(off / DEG).toFixed(1)}° from the player's own turns`);
    rows.push({ tag, least: r3(lo), most: r3(hi), off: +(off / DEG).toFixed(1), framed });
    leaned += framed;
  }
  assert(leaned >= 20, `the framed shot leaned on only ${leaned} steps`);
  // in the open the mouse is as it was: the view turns by the mouse's turn exactly, and the framed shot never leans
  {
    const b = stand(OPEN, 0, 0), cam = makeCamera(OPEN, { yaw: 0, ...camLayout(1280, 720) });
    cam.snap(b.s, 0);
    let mine = 0, err = 0, lean = 0;
    for (let i = 0; i < 360; i++) {
      const dy = (i < 180 ? 1 : -1.7) * ONE;
      mine += dy;
      const v = cam.follow(b.s, STEP, { dyaw: dy, mouse: true });
      err = Math.max(err, Math.abs(wrap(v.yaw - mine)));
      if (cam.c.off || cam.c.framing) lean++;
    }
    assert(err < 1e-9 && lean === 0, `in the open the view stood ${err} from the mouse's turns, and leaned on ${lean} steps`);
  }
  pass('a turn in a nook: the picture turns with the mouse and the stick on every step, the view stays within 60° of the player\'s turns, and it is still once the turn ends', { rows, leaned });

  /* The lean's own count (c.off) is the lean on screen. Where a wall holds back part of a step's turn (a camera orbiting against a
     wall), it holds back the same part of that step's lean, so c.off changes by no more than the lean's share of what the step showed:
     at most 0.15 / 0.85 of the step's turn on screen. A fast turn of the mouse (6 and 3 rad/s, each way) at the same 28 spots, at both
     sizes, where the wall holds turns back most. In the build of 1974d668 c.off took the whole lean even where the wall held it back */
  {
    let steps = 0, worst = 0, held = 0;
    for (const [w, h] of [[1280, 720], [390, 844]]) for (const rate of [6, -6, 3, -3]) for (const [id, x, z, wy] of spots) {
      const { walk } = places[id], y = wy === undefined ? walk.floor(x, z) : walk.support(x, z, wy + 0.5) ?? walk.floor(x, z);
      const b = makeBody(walk, { p: [x, y + 0.5, z], yaw: Math.PI }, 38), cam = makeCamera(walk, { yaw: 0, ...camLayout(w, h) });
      cam.snap(b.s, 0);
      for (let i = 0; i < 30; i++) { b.step(STEP, {}, cam.c.yaw); cam.follow(b.s, STEP, { mouse: true }); }
      let prev = cam.c.yaw, off = cam.c.off;
      for (let i = 0; i < 240; i++) {
        b.step(STEP, {}, cam.c.yaw);
        cam.follow(b.s, STEP, { dyaw: rate * STEP, mouse: true });
        const shown = Math.abs(wrap(cam.c.yaw - prev)), d = Math.abs(cam.c.off - off);
        if (cam.c.off !== 0 || cam.c.framing) {
          steps++;
          if (shown < 0.85 * Math.abs(rate * STEP)) held++;
          const over = d - (0.15 / 0.85) * shown;
          worst = Math.max(worst, over);
          assert(over <= 1e-9, `${w}x${h} ${id} at ${x.toFixed(1)}, ${z.toFixed(1)}, ${rate} rad/s, step ${i}: c.off changed by ${(d / DEG).toFixed(2)}° on a step that showed ${(shown / DEG).toFixed(2)}°`);
        }
        prev = cam.c.yaw; off = cam.c.off;
      }
    }
    pass('a fast turn in a nook: the lean\'s count keeps only the share of the lean that a wall left on screen', { steps, held, worst: r3(worst / DEG) });
  }

  /* No look input in a nook: the view never turns by itself while the mouse is taken or with reduced motion (spec "A calm camera"). At
     the same 28 spots, from 24 start yaws (15° apart), at 1280x720 and 390x844: the player sets the yaw with the mouse (1 s of small
     turns) and then gives no look input for 3 s, with the mouse taken; and again with reduced motion (auto off) and the mouse free; and
     with the mouse taken and forward held. The yaw does not change at all. With a stick and the mouse free, nothing turns it for
     AUTO.wait s; after that the lean may turn it at no more than 0.5 rad/s (the figure at 1 m/s or less, so the swing does not), and while it does, a held move keeps its world direction
     (cameras.js makeMoveLock, which the explorer and the run both use): the yaw the move reads stays where the lean started. The build of
     1974d668 turned the view by itself in 47 of 672 cases at 1280x720 (up to 43°) with the mouse taken, the same with reduced motion,
     and a move held forward through the lean curved by up to 37° */
  {
    const out = {};
    for (const [w, h] of [[1280, 720], [390, 844]]) {
      let cases = 0, turned = 0, worst = 0, leanCases = 0, curve = 0, padRate = 0, early = 0;
      for (const [id, x, z, wy] of spots) for (let y0 = 0; y0 < 360; y0 += 15) for (const how of ['mouse', 'still', 'mouseW', 'stickW']) {
        const { walk } = places[id], y = wy === undefined ? walk.floor(x, z) : walk.support(x, z, wy + 0.5) ?? walk.floor(x, z);
        const b = makeBody(walk, { p: [x, y + 0.5, z], yaw: Math.PI }, 38), cam = makeCamera(walk, { yaw: y0 * DEG, ...camLayout(w, h), auto: how !== 'still' });
        const lock = makeMoveLock();
        cam.snap(b.s, y0 * DEG);
        const mouse = how === 'mouse' || how === 'mouseW';
        for (let i = 0; i < 60; i++) { b.step(STEP, {}, cam.c.yaw); cam.follow(b.s, STEP, { mouse, dyaw: (i % 2 ? -1 : 1) * 0.2 * DEG }); }
        const ya = cam.c.yaw, mv = how.endsWith('W') ? { mz: 1 } : {};
        let most = 0, from = null, prev = cam.c.yaw;
        for (let i = 0; i < (how === 'stickW' ? 300 : 180); i++) {
          const read = lock.yaw(mv, cam.c);
          b.step(STEP, mv, read);
          cam.follow(b.s, STEP, { mouse, ...mv });
          const t = i * STEP;
          if (how !== 'stickW' || t < AUTO.wait - STEP) most = Math.max(most, Math.abs(wrap(cam.c.yaw - ya)));
          if (how === 'stickW') {
            // (at over 1 m/s the swing and the turn out of a lane may turn it too, at their own rates)
            const r = Math.abs(wrap(cam.c.yaw - prev)) / STEP;
            if (Math.hypot(b.s.vx, b.s.vz) <= 1) padRate = Math.max(padRate, r);
            if (r > 0 && cam.c.idle <= AUTO.wait) early++;
            // while the lean turns the view (on this step and the one before), the move reads the same yaw
            if (cam.c.turning && from !== null) { curve = Math.max(curve, Math.abs(wrap(read - from))); leanCases++; }
            from = cam.c.turning ? read : null;
          }
          prev = cam.c.yaw;
        }
        cases++;
        if (most > 0) turned++;
        worst = Math.max(worst, most);
      }
      const tag = `${w}x${h}`;
      assert.equal(turned, 0, `${tag}: with no look input the view turned by itself in ${turned} of ${cases} cases, by up to ${(worst / DEG).toFixed(1)}°`);
      assert(padRate <= 0.5 + 1e-6 && early === 0, `${tag}: with a stick the lean turned at up to ${padRate.toFixed(2)} rad/s, on ${early} steps before the wait`);
      assert(curve < 1e-9, `${tag}: a held move turned by ${(curve / DEG).toFixed(1)}° while the lean turned the view`);
      out[tag] = { cases, turned, stickRate: r3(padRate), leanSteps: leanCases, curve: r3(curve / DEG) };
    }
    pass('no look input in a nook: the view does not turn by itself with the mouse taken or with reduced motion, and a held move keeps its way through the lean', out);
  }
}
console.log(`${n} checks passed`);
