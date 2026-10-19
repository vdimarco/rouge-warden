// node qa/pingpong/bat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from '../../public/pingpong/sim.js';
import { BAT, RULES } from '../../public/pingpong/rules.js';
import {
  assistX,
  axisPastDead,
  batFromTilt,
  batPresentation,
  driftNeutral,
  mapAxes,
  springStep,
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
  const linear = axisPastDead(3, RULES.batFullSide) * RULES.batReachX;
  assert.ok(nudge.x > 0 && nudge.x < 0.05, nudge.x);
  assert.ok(nudge.x < linear * 0.5, nudge.x);
  const back = batFromTilt(0, -3);
  assert.ok(back.depth < RULES.batHomeZ);
  assert.ok(back.depth > RULES.batHomeZ - 0.08);
});

test('a lean moves depth a short way, and the ends still read on screen', () => {
  const inn = batFromTilt(0, RULES.batFullDepth);
  const out = batFromTilt(0, -RULES.batFullDepth);
  const home = batFromTilt(0, 0);
  assert.equal(home.depth, RULES.hitZ);
  assert.ok(Math.abs(inn.depth - (BAT.homeZ + BAT.lean)) < 1e-9, inn.depth);
  assert.ok(Math.abs(out.depth - (BAT.homeZ - BAT.lean)) < 1e-9, out.depth);
  assert.ok(inn.depth < 0.55, inn.depth);
  assert.ok(out.depth > 0.08, out.depth);
  assert.equal(inn.x, 0);
  const w = 390;
  const h = 844;
  const near = project(0, 0, out.depth, w, h);
  const far = project(0, 0, inn.depth, w, h);
  assert.ok(far.s < near.s, far.s / near.s);
  assert.ok(near.y - far.y > 20, near.y - far.y);
});

test('the spring settles in 60 to 80 ms with no overshoot', () => {
  const target = 20;
  const dt = 1 / 60;
  let s = { x: 0, v: 0 };
  let t = 0;
  let at80 = null;
  while (t < 0.2 - 1e-9) {
    s = springStep(s, target, dt);
    t += dt;
    assert.ok(s.x <= target + 1e-6, s.x);
    assert.ok(s.x >= -1e-9, s.x);
    if (t <= 0.034) assert.ok(s.x < target * 0.8, s.x);
    if (at80 == null && t >= 0.08 - 1e-9) at80 = s.x;
  }
  assert.ok(at80 >= target * 0.9, at80);
  assert.ok(at80 <= target, at80);
  const one = springStep({ x: 0, v: 0 }, target, dt);
  assert.ok(one.x > 1 && one.x < target * 0.5, one.x);
});

test('a still phone near the middle re-centres over about 2 seconds', () => {
  let neutral = 0;
  const angle = 2;
  for (let i = 0; i < 120; i++) neutral = driftNeutral(neutral, angle, 0, 0, 1 / 60);
  const left = angle - neutral;
  assert.ok(left < angle * 0.5, left);
  assert.ok(left > angle * 0.2, left);
  assert.equal(driftNeutral(0, angle, 40, 0, 1 / 60), 0);
  assert.equal(driftNeutral(0, angle, 0, 0.5, 1 / 60), 0);
  assert.equal(driftNeutral(0, 8, 0, 0, 2), 0);
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
  assert.deepEqual(mapAxes(10, 4, 90), { beta: -4, gamma: 10 });
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

  const aside = feedAt(0.20, 0.30);
  aside.setBat({ x: 0, depth: 0.30, roll: 0 });
  aside.swing({ degPerSec: 700, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: -9 });
  const close = aside.state().lastShot;
  assert.equal(close.offsetMs, -9);
  assert.notEqual(close.band, 'miss');
  assert.notEqual(close.reason, 'reach');

  const over = feedAt(0.23, 0.30);
  over.setBat({ x: 0, depth: 0.30, roll: 0 });
  over.swing({ degPerSec: 700, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: -9 });
  assert.equal(over.state().lastShot.reason, 'reach');

  const early = feedAt(0, 0.9);
  early.setBat({ x: 0, depth: 0.55, roll: 0 });
  early.swing({ degPerSec: 640, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 0 });
  const took = untilShot(early);
  assert.notEqual(took.lastShot.band, 'miss');
  assert.ok(Math.abs(took.lastShot.batDepth - 0.55) < 1e-9);
  assert.ok(Math.abs(took.lastContact.z - 0.55) < 0.08, took.lastContact.z);
});
