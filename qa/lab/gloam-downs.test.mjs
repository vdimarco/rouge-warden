// Gloam Downs, checked in node with no browser (public/lab/gloam-downs/):
//   the five baked places (budget, palette, bones, wisps, beacon, the start on the ground, everything in reach by the controller's rules),
//   the controller on made-up ground (walk, run, jump height, walls, steps, ledges, falls, walking under an arch),
//   the pose (the bones put the figure where the body is), and the saved game (rubbish in, a clean save out).
// Run: node qa/lab/gloam-downs.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, makeCamera, pose, reachable, touches, atBeacon, JUMP, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { clean, fresh, ORDER, wispCount } from '../../public/lab/gloam-downs/save.js';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url));
const SplatCodec = vm.runInNewContext(fs.readFileSync(DIR + 'ink/splat-codec.js', 'utf8') + '\nSplatCodec;', {});
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;

/* ---------------- the five places ---------------- */
// GLOAM_WORLDS=0 skips the baked places (to test the rules alone while the places are being baked)
const skipWorlds = process.env.GLOAM_WORLDS === '0';
const missing = skipWorlds ? [] : ORDER.filter(id => !fs.existsSync(`${DIR}worlds/${id}.json`));
for (const id of skipWorlds ? [] : ORDER) {
  if (missing.includes(id)) continue;
  const meta = JSON.parse(fs.readFileSync(`${DIR}worlds/${id}.json`, 'utf8'));
  const gz = fs.readFileSync(`${DIR}worlds/${id}.bin.gz`), wgz = fs.readFileSync(`${DIR}worlds/${id}.walk.bin.gz`);
  assert.equal(meta.format, 'gloam-downs/1');
  assert.equal(meta.id, id);
  assert(meta.count <= 250000, `${id}: ${meta.count} splats is over the budget of 250,000`);
  assert(gz.length + wgz.length <= 1.5e6, `${id}: ${gz.length + wgz.length} bytes is over 1.5 MB`);
  assert(meta.pal.length <= 48 && meta.pal.every(c => Number.isInteger(c) && c >= 0 && c <= 0xffffff), `${id}: palette`);
  const { data, count } = SplatCodec.decode(new Uint8Array(zlib.gunzipSync(gz)), { maxRows: 1_000_000 });
  assert.equal(count, meta.count);
  for (let i = 0; i < count; i++) assert(Number.isFinite(data[i * 16]) && Number.isFinite(data[i * 16 + 1]) && Number.isFinite(data[i * 16 + 2]), `${id}: splat ${i} has a finite place`);
  // the lamplighter: a run of splats, each on a GPU bone (kind 12) with a bone id the page writes
  const B = meta.bones;
  assert.equal(B.names.length, 7);
  assert(B.end - B.first === B.count && B.count > 1000, `${id}: lamplighter splats ${B.count}`);
  for (let i = B.first; i < B.end; i++) {
    const kind = Math.round(data[i * 16 + 11]) % 16, bone = data[i * 16 + 12];
    assert.equal(kind, 12, `${id}: splat ${i} rides a bone`);
    assert(Number.isInteger(bone) && bone >= 0 && bone < B.names.length);
  }
  // wisps and the beacon's fire: glowing splats in their own id ranges, inside the world
  assert.equal(meta.wisps.length, 5);
  const glows = (a, b) => { for (let i = a; i < b; i++) assert(Math.round(data[i * 16 + 11]) & 32 || (Math.round(data[i * 16 + 11]) >> 4) & 2, `${id}: splat ${i} glows`); };
  for (const w of meta.wisps) { assert(w.ids[0] < w.ids[1] && w.ids[1] <= count); glows(...w.ids); }
  for (const r of meta.beacon.fire) { assert(r[0] < r[1] && r[1] <= count); glows(...r); }
  // the walk map, and the reach of everything from the start
  const raw = new Uint8Array(zlib.gunzipSync(wgz));
  const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
  const floor = walk.support(meta.spawn.p[0], meta.spawn.p[2], meta.spawn.p[1] + 1);
  assert(floor !== null && near(floor, meta.spawn.p[1], 0.6), `${id}: the start stands on the ground`);
  const R = reachable(walk, meta.spawn, meta.bounds);
  assert(R.near(meta.beacon.p, meta.beacon.r * 0.9, -2.6, 2.6), `${id}: the beacon can be reached`);
  meta.wisps.forEach((w, i) => assert(R.near(w.p), `${id}: wisp ${i + 1} can be reached`));
  assert(meta.beacon.p[1] > meta.spawn.p[1] + 2, `${id}: the beacon stands on a rise above the start`);
  pass(`${id}: ${meta.name}`, { splats: count, mb: +((gz.length + wgz.length) / 1e6).toFixed(2), reach: R.cells });
}
if (!skipWorlds && !missing.length) { // five different places: names, palettes and landmarks differ
  const metas = ORDER.map(id => JSON.parse(fs.readFileSync(`${DIR}worlds/${id}.json`, 'utf8')));
  assert.equal(new Set(metas.map(m => m.name)).size, 5);
  assert.equal(new Set(metas.map(m => m.pal.slice(0, 32).join())).size, 5);
  pass('five places, each with its own name and palette', metas.map(m => m.name));
}

/* ---------------- the controller, on made-up ground ---------------- */
// a 40 x 40 map at 0.25: flat ground at 0, a 3-high wall at x 4..5, a 1.0 ledge at z 4..6 (x -4..0), a 2.0 ledge at z 8..10, steps of
// 0.35 at z -4..-2, a gap at z -10 (a 6 deep pit), and an arch at x -8..-7 with its top at 3 and 2.2 of clearance under it
function made() {
  const info = { x0: -20, z0: -20, step: 0.25, nx: 161, nz: 161 };
  const N = info.nx * info.nz, cells = new Int16Array(2 * N);
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) {
    const x = info.x0 + i * info.step, z = info.z0 + j * info.step;
    let t = 0, g = null;
    if (x >= 4 && x <= 5 && z > -6 && z < 6) t = 3;
    if (x >= -4 && x <= 0 && z >= 4 && z <= 6) t = 1.0;
    if (x >= -4 && x <= 0 && z >= 8 && z <= 10) t = 2.0;
    if (x >= -4 && x <= 0 && z >= -4 && z <= -2) t = 0.35 * (1 + Math.floor((-2 - z) / 0.7));
    if (z <= -9 && z >= -11 && x > 6) t = -6;
    if (x >= -8 && x <= -7 && z >= -2 && z <= 2) { t = 3; g = 0; }
    cells[j * info.nx + i] = Math.round(t * 100);
    cells[N + j * info.nx + i] = Math.round((g ?? t) * 100);
  }
  return makeWalk(info, cells);
}
const W = made();
const run = (body, sec, inp, yaw = Math.PI) => { for (let i = 0; i < sec * 60; i++) body.step(1 / 60, inp, yaw); return body.s; };
{ // walk and run: the camera faces -z (yaw 0 puts the eye at +z), so forward is -z
  const b = makeBody(W, { p: [0, 0, 18], yaw: Math.PI }, 20);
  run(b, 1, { mz: 1, slow: true }, 0);
  const walked = 18 - b.s.z;
  assert(near(walked, PARAMS.walk, 0.4), `walked ${walked}`);
  const b2 = makeBody(W, { p: [0, 0, 18], yaw: Math.PI }, 20);
  run(b2, 1, { mz: 1 }, 0);
  assert(18 - b2.s.z > walked * 1.6, 'running is faster than walking');
  assert(Math.abs(b2.s.yaw - Math.PI) < 0.05 || Math.abs(Math.abs(b2.s.yaw) - Math.PI) < 0.05, 'it turns to face where it goes');
  pass('walk and run move the lamplighter away from the camera', { walked: +walked.toFixed(2), ran: +(18 - b2.s.z).toFixed(2) });
}
{ // jump height
  const b = makeBody(W, { p: [10, 0, 10], yaw: 0 }, 20);
  let top = 0;
  for (let i = 0; i < 120; i++) { b.step(1 / 60, { jump: true }, 0); top = Math.max(top, b.s.y); }
  assert(near(top, JUMP, 0.12), `jump top ${top}, expected ${JUMP}`);
  assert(b.s.ground && near(b.s.y, 0, 1e-6), 'it lands');
  const tap = makeBody(W, { p: [10, 0, 10], yaw: 0 }, 20);
  let low = 0;
  for (let i = 0; i < 120; i++) { tap.step(1 / 60, { jump: i < 4 }, 0); low = Math.max(low, tap.s.y); }
  assert(low < top * 0.75, 'a tap jumps lower than a held jump');
  pass('a held jump lifts the feet about JUMP, and a tap less', { held: +top.toFixed(2), tap: +low.toFixed(2) });
}
{ // a wall stops it; it slides along the wall
  const b = makeBody(W, { p: [2, 0, 0], yaw: 0 }, 20);
  run(b, 2, { mx: 1 }, 0);
  assert(b.s.x < 4 && b.s.x > 3, `stopped at the wall: x ${b.s.x}`);
  assert(near(b.s.y, 0, 1e-6));
  pass('a wall higher than a jump stops the lamplighter', { x: +b.s.x.toFixed(2) });
}
{ // steps of 0.35 are walked up; a 1.0 ledge needs a jump; a 2.0 ledge cannot be climbed
  const b = makeBody(W, { p: [-2, 0, -0.5], yaw: Math.PI }, 20);
  let high = 0;
  for (let i = 0; i < 90; i++) { b.step(1 / 60, { mz: 1, slow: true }, 0); high = Math.max(high, b.s.ground ? b.s.y : 0); }
  assert(high > 0.9, `walked up the steps to ${high}`);
  const c = makeBody(W, { p: [-2, 0, 2.5], yaw: 0 }, 20);
  run(c, 1, { mz: -1 }, 0);
  assert(near(c.s.y, 0, 1e-6) && c.s.z < 4, 'a 1.0 ledge stops a walk');
  let landed = null;
  for (let i = 0; i < 60 && landed === null; i++) { c.step(1 / 60, { mz: -1, jump: i < 30 }, 0); if (c.s.events.includes('land')) landed = c.s.y; }
  assert(landed !== null && near(landed, 1.0, 0.05), `jumped onto the 1.0 ledge: landed at ${landed}`);
  const d = makeBody(W, { p: [-2, 0, 7], yaw: 0 }, 20);
  for (let i = 0; i < 120; i++) d.step(1 / 60, { mz: -1, jump: true }, 0);
  assert(d.s.y < 1.9 && d.s.z < 8, `a 2.0 ledge is too high: y ${d.s.y}, z ${d.s.z}`);
  pass('steps are walked, a 1.0 ledge is jumped, a 2.0 ledge is too high');
}
{ // walking off an edge falls, and lands below
  const b = makeBody(W, { p: [8, 0, -7], yaw: Math.PI }, 20);
  run(b, 1.5, { mz: 1 }, 0);
  assert(b.s.y < -5, `fell into the pit: y ${b.s.y}`);
  assert(b.s.ground && near(b.s.y, -6, 1e-6));
  pass('walking off an edge falls and lands');
}
{ // under the arch: the floor under the gap is walked; the arch top is not where the feet go
  const b = makeBody(W, { p: [-10, 0, 0], yaw: 0 }, 20);
  run(b, 2, { mx: 1 }, 0);
  assert(b.s.x > -6 && near(b.s.y, 0, 1e-6), `walked under the arch: x ${b.s.x}, y ${b.s.y}`);
  pass('the lamplighter walks under an arch');
}
{ // the camera comes in front of a wall between it and the lamplighter
  const b = makeBody(W, { p: [3.4, 0, 0], yaw: -Math.PI / 2 }, 20);
  const cam = makeCamera(W, { yaw: Math.PI / 2, dist: 8.5, auto: false });
  cam.snap(b.s, Math.PI / 2);
  let v;
  for (let i = 0; i < 60; i++) v = cam.follow(b.s, 1 / 60, {});
  assert(v.dist < 2, `the camera came in: dist ${v.dist}`);
  const open = makeCamera(W, { yaw: -Math.PI / 2, dist: 8.5, auto: false });
  open.snap(b.s, -Math.PI / 2);
  for (let i = 0; i < 60; i++) v = open.follow(b.s, 1 / 60, {});
  assert(near(v.dist, 8.5, 0.01), 'with nothing in the way it stays back');
  pass('the camera comes in front of a wall');
}
{ // touch rules
  const s = { x: 0, y: 0, z: 0 };
  assert(touches(s, [0.5, 1, 0]) && !touches(s, [0.5, 2.5, 0]) && !touches(s, [1.5, 1, 0]));
  assert(atBeacon(s, { p: [1, 1, 0], r: 1.6 }) && !atBeacon(s, { p: [2, 1, 0], r: 1.6 }));
  pass('wisps and the beacon are touched only near them');
}
{ // reach search agrees with the controller
  const R = reachable(W, { p: [0, 0, 18], yaw: 0 }, 20);
  assert(R.near([-2, 1.5, 5]), 'the 1.0 ledge is in reach');
  assert(!R.near([-2, 3.9, 9], 0.6, -0.7, 1.5), 'the top of the 2.0 ledge is not');
  pass('the reach search matches the controller');
}

/* ---------------- the pose ---------------- */
{
  const rig = { names: ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'shadow'], pivots: [[0, 80.1, 0], [0, 80.82, 0], [0.15, 80.24, 0], [-0.15, 80.24, 0], [0.33, 80.72, 0.04], [-0.33, 80.72, 0], [0, 120, 0]] };
  const bones = new Float32Array(84);
  const s = { x: 3, y: 2, z: -5, yaw: Math.PI / 2, phase: 0, moveK: 0, runK: 0, landK: 0, landAge: 9, ground: true, vy: 0, floor: 2 };
  pose(bones, rig, s, 0, true);
  assert(bones.every(Number.isFinite));
  const apply = (b, p) => [0, 1, 2].map(a => bones[12 * b + a * 3] * p[0] + bones[12 * b + a * 3 + 1] * p[1] + bones[12 * b + a * 3 + 2] * p[2] + bones[12 * b + 9 + a]);
  const feet = apply(0, [0, 80, 0]);
  assert(near(feet[0], 3, 1e-5) && near(feet[1], 2, 1e-5) && near(feet[2], -5, 1e-5), 'the body bone puts the feet at the body');
  const nose = apply(1, [0, 81, 0.25]);
  assert(near(nose[0], 3.25, 0.02) && near(nose[2], -5, 0.02), 'facing +x at yaw π/2, the face is at +x');
  const sh = apply(6, [0, 120, 0]);
  assert(near(sh[1], 2.04, 1e-5) && near(sh[0], 3, 1e-5), 'the shadow lies on the floor under the body');
  s.y = 4; pose(bones, rig, s, 0, true);
  assert(bones[72] < 1, 'the shadow shrinks when the body is in the air');
  pass('the bones put the lamplighter where its body is');
}

/* ---------------- the saved game ---------------- */
{
  for (const bad of [null, 7, 'x', [], { reached: 'all' }, { reached: [1, 2], wisps: [], lit: 'yes', time: -4, best: NaN }, { wisps: { gaol: [0, 9, 'a', 2.5, 2] } }])
    assert.deepEqual(Object.keys(clean(bad)).sort(), Object.keys(fresh()).sort());
  const s = clean({ reached: ['gaol', 'ramparts', 'bells'], at: 'bells', wisps: { gaol: [0, 4, 4, 9], fen: [1] }, lit: { gaol: true, barrows: true }, time: 61, best: 1e12, seen: true });
  assert.deepEqual(s.reached, ['gaol', 'ramparts'], 'a gap in the places reached cuts the list there');
  assert.equal(s.at, 'gaol', 'a place not reached cannot be where you are');
  assert.deepEqual(s.wisps.gaol, [0, 4]);
  assert.deepEqual(s.lit, { gaol: true });
  assert(s.time === 61 && s.best === 0 && s.seen === true);
  assert.equal(wispCount(s), 3);
  pass('a bad save is cleaned field by field');
}
if (missing.length) { console.log(`FAIL not baked: ${missing.join(', ')} (node games/gloam-downs/bake.mjs)`); process.exitCode = 1; }
console.log(`${n} checks passed`);
