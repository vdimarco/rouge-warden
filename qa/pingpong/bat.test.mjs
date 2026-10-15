// node qa/pingpong/bat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from '../../public/pingpong/sim.js';
import { RULES } from '../../public/pingpong/rules.js';
import {
  assistX,
  axisPastDead,
  batFromTilt,
  batPresentation,
  mapAxes,
  poseFilter,
  poseLag,
  swingPush,
} from '../../public/pingpong/motion.js';
import { project } from '../../public/pingpong/render.js';

function feedAt(x, z) {
  const match = createMatch({ seed: 4, input: 'swing' });
  match.placeBall({
    x, y: 0.5, z, vx: 0, vy: 0.2, vz: -2.4,
    hitter: 'neighbour', phase: 'incoming', bounces: 0, spinType: 'none', spinLevel: 0,
  });
  return match;
}

function untilShot(match) {
  let snap = match.state();
  for (let i = 0; i < 360 && !(snap.lastShot && snap.lastShot.struckAt != null); i++) snap = match.step();
  return snap;
}

test('side tilt covers most of the table and nearly the screen', () => {
  assert.equal(RULES.batDead, 2.5);
  assert.ok(RULES.batDead >= 2 && RULES.batDead <= 3);
  const right = batFromTilt(RULES.batFullSide, 0);
  const left = batFromTilt(-RULES.batFullSide, 0);
  assert.ok(right.x >= RULES.halfWidth * 0.9, right.x);
  assert.ok(left.x <= -RULES.halfWidth * 0.9, left.x);
  assert.ok(right.x <= RULES.halfWidth);
  assert.equal(right.depth, RULES.batHomeZ);
  const w = 390;
  const h = 844;
  const a = project(left.x, 0, RULES.batBackZ, w, h);
  const b = project(right.x, 0, RULES.batBackZ, w, h);
  assert.ok(b.x - a.x > w * 0.8, b.x - a.x);
});

test('a 2 degree tilt stays put and 3 degrees starts to move', () => {
  assert.equal(axisPastDead(2, RULES.batFullSide), 0);
  assert.equal(axisPastDead(-2.5, RULES.batFullSide), 0);
  assert.equal(batFromTilt(2, 2).x, 0);
  assert.equal(batFromTilt(-2, -2).depth, RULES.batHomeZ);
  const nudge = batFromTilt(3, 0);
  assert.ok(nudge.x > 0 && nudge.x < 0.05, nudge.x);
  const back = batFromTilt(0, -3);
  assert.ok(back.depth < RULES.batHomeZ);
  assert.ok(back.depth > RULES.batHomeZ - 0.08);
});

test('forward tilt steps in and back tilt backs off', () => {
  const inn = batFromTilt(0, RULES.batFullDepth);
  const out = batFromTilt(0, -RULES.batFullDepth);
  const home = batFromTilt(0, 0);
  assert.equal(home.depth, RULES.hitZ);
  assert.ok(inn.depth >= 1, inn.depth);
  assert.ok(inn.depth < RULES.netZ, inn.depth);
  assert.ok(out.depth < 0.05, out.depth);
  assert.equal(inn.x, 0);
  const w = 390;
  const h = 844;
  const near = project(0, 0, out.depth, w, h);
  const far = project(0, 0, inn.depth, w, h);
  assert.ok(far.s < near.s * 0.85, far.s / near.s);
  assert.ok(near.y - far.y > 80, near.y - far.y);
});

test('the pose filter is smooth and under 50 ms', () => {
  assert.ok(poseLag() < 0.05, poseLag());
  let v = 0;
  let t = 0;
  const dt = 1 / 60;
  while (v < 20 * 0.63 && t < 0.2) {
    v = poseFilter(v, 20, dt);
    t += dt;
  }
  assert.ok(t < 0.05, t);
  const one = poseFilter(0, 20, dt);
  assert.ok(one > 8 && one < 18, one);
  let slow = 0;
  slow = poseFilter(slow, 20, 1 / 30);
  assert.ok(slow > 12, slow);
});

test('assist is a light pull and the player still owns the bat', () => {
  const cmd = 0.74;
  const x = assistX(cmd, 0, RULES.assist);
  assert.equal(RULES.assist, 0.15);
  assert.ok(Math.abs(x - cmd) < Math.abs(x - 0));
  assert.ok(x > 0.6, x);
  assert.ok(Math.abs(x - (cmd * 0.85)) < 1e-9);
});

test('the face rolls with the phone, pitches with tilt, and the swing pushes forward', () => {
  const level = batPresentation({ roll: 20, tiltY: 0, push: 0 });
  assert.equal(level.rollDeg, 20);
  assert.equal(level.scaleY, 1);
  const open = batPresentation({ roll: -12, tiltY: RULES.batFullDepth, push: 0 });
  assert.equal(open.rollDeg, -12);
  assert.ok(open.scaleY < 0.92 && open.scaleY > 0.84, open.scaleY);
  assert.ok(open.shear < 0);
  let push = 0;
  push = swingPush(push, 800, 1 / 60);
  assert.ok(push > 0.25, push);
  const jab = batPresentation({ roll: 0, tiltY: 0, push });
  assert.ok(jab.pushZ > 0.1, jab.pushZ);
  let back = push;
  for (let i = 0; i < 40; i++) back = swingPush(back, 0, 1 / 60);
  assert.ok(back < push * 0.25, back);
  assert.deepEqual(mapAxes(10, 4, 90), { beta: 4, gamma: 10 });
});

test('a hit uses the bat position and aim stays on the swing angle', () => {
  const on = feedAt(0.35, 0.7);
  on.setBat({ x: 0.35, depth: RULES.hitZ, roll: 8 });
  on.swing({ degPerSec: 500, dir: 'forehand', tiltX: 30, tiltY: 20, rollDegPerSec: 0, offsetMs: 0 });
  const shot = untilShot(on);
  assert.notEqual(shot.lastShot.band, 'miss');
  assert.ok(Math.abs(shot.lastShot.batX - 0.35) < 1e-9);
  assert.ok(Math.abs(shot.lastShot.batDepth - RULES.hitZ) < 1e-9);
  assert.ok(Math.abs(shot.lastShot.aimX - 0.7) < 1e-9);
  assert.ok(Math.abs(shot.lastShot.aimZ - (RULES.netZ + 0.3)) < 1e-9);
  assert.equal(shot.bat.roll, 8);

  const wide = feedAt(0, 0.7);
  wide.setBat({ x: -0.7, depth: RULES.hitZ, roll: 0 });
  wide.swing({ degPerSec: 500, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 0 });
  let missed = wide.state();
  for (let i = 0; i < 360 && !(missed.lastShot && missed.lastShot.reason === 'reach'); i++) missed = wide.step();
  assert.equal(missed.lastShot.band, 'miss');
  assert.equal(missed.lastShot.reason, 'reach');
  assert.ok(Math.abs(missed.lastShot.batX - (-0.7)) < 1e-9);

  const deep = feedAt(0, 0.4);
  deep.setBat({ x: 0, depth: RULES.batInZ, roll: 0 });
  const whiff = deep.swing({ degPerSec: 500, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 0 });
  assert.equal(whiff.accepted, true);
  const gone = deep.state();
  assert.equal(gone.lastShot.reason, 'reach');
  assert.ok(Math.abs(gone.lastShot.batDepth - RULES.batInZ) < 1e-9);

  const early = feedAt(0, 0.9);
  early.setBat({ x: 0, depth: 0.55, roll: 0 });
  early.swing({ degPerSec: 640, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 0 });
  const took = untilShot(early);
  assert.notEqual(took.lastShot.band, 'miss');
  assert.ok(Math.abs(took.lastShot.batDepth - 0.55) < 1e-9);
  assert.ok(Math.abs(took.lastContact.z - 0.55) < 0.08, took.lastContact.z);
});
