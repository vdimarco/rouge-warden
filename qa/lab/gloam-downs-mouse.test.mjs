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
import { makeCombat, makeBossCam, yawDiff, COMBAT, BOSS } from '../../public/lab/gloam-downs/cameras.js';
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
      let last = null, step = 0, jerk = 0, inWall = 0, least = Infinity, d1 = 0;
      for (let i = 0; i < 240; i++) {
        const v = cam.follow(b.s, STEP, { dyaw: (i < 120 ? 1 : -1) * rate * STEP, mouse: true });
        const e = eyeOf(v);
        if (WALL.support(e[0], e[2], e[1]) === null) inWall++;
        if (last) { const d = v.dist - last.dist; step = Math.max(step, Math.abs(d)); jerk = Math.max(jerk, Math.abs(d - d1)); d1 = d; }
        least = Math.min(least, v.dist);
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
     in can leave it there): at most 10 such steps in all 120 sweeps, each under 2.8 m. Both ways, the camera of 3fe9318f had 8, up to
     1.75 m, and that of 45ffb438 7, up to 2.05 m: a clear eye now comes in at 15 m/s, not 33, and can meet a wall 2 m thick from
     behind. The tight-space fix (the aim lower under a roof, the dip under a lintel, the room's height) leaves the eye farther back
     in a room before it meets the wall, so it has 9, up to 2.69 m: two new ones at a fen porch and the Bell Knoll's west wisp on a
     phone, each from behind a wall into a room 1 to 1.5 m deep. The
     camera of 09fd360b changed it by more than 0.6 m on 142 steps of the 60 sweeps one way. And where the eye is clear, it comes in at no more than 15 m/s, except at a step
     through a wall: a wall that the turn will bring between starts it in early, but not faster; and its speed in builds by no more than
     360 m/s/s. "Clear" is read here from the walk map alone, not from play.js: the old eye (its last distance, at this step's aim and
     pitch) marched along its path round for 0.3 s of the sweep's turn, every 0.1 m, with the 0.35 m clearance of `through`. The camera
     of 7dcfd747 came in faster on 733 steps here (one way), from 8.5 m to under 1 m in 0.3 s; that of 3fe9318f on 53 steps (both ways),
     from 8.5 to 2.99 m in 0.23 s at Barrows (-7.9, 12.8), for its look-ahead marched a nearer goal's path, not the eye's */
  const DEV = { over: 0.6, cross: 10, crossMax: 2.8, pull: 15, acc: 360, look: 0.3, rate: 1.2 };
  let sum = 0, steps = 0, over = 0, cross = 0, crossMax = 0, worst = 0, fast = 0, fastAt = '', jolt = 0, joltAt = '';
  for (const id of ORDER) {
    const meta = JSON.parse(fs.readFileSync(new URL(`worlds/${id}.json`, DIR), 'utf8'));
    const raw = zlib.gunzipSync(fs.readFileSync(new URL(`worlds/${id}.walk.bin.gz`, DIR)));
    const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
    // may an eye be at (x, y, z): 0.35 m clear of the scenery, above it or in the gap under an arch?
    const free = (x, y, z) => {
      const t = walk.top(x, z), g = walk.floor(x, z);
      return y >= t + 0.35 || (g < t - 0.05 && y >= g + 0.35 && y <= g + 1.45);
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
  pass('the five places: a sweep of the mouse at 1.2 rad/s each way at each spawn and wisp never dives', { sweeps: steps / 360, mean: r3(sum / steps), over, worst: r3(worst), cross, fast });
}
console.log(`${n} checks passed`);
