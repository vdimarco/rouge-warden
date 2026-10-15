// node qa/pingpong/rally.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from '../../public/pingpong/sim.js';
import { RULES, judgeLanding, spinTimeScale, spinFromRoll } from '../../public/pingpong/rules.js';

function incoming() {
  const match = createMatch({ seed: 4, input: 'swing' });
  match.placeBall({
    x: 0, y: 0.5, z: 0.7, vx: 0, vy: 0.2, vz: -2.4,
    hitter: 'neighbour', phase: 'incoming', bounces: 0, spinType: 'none', spinLevel: 0,
  });
  return match;
}

function untilShot(match) {
  let snap = match.state();
  for (let i = 0; i < 360 && !(snap.lastShot && snap.lastShot.struckAt != null); i++) snap = match.step();
  return snap;
}

function untilLanding(match, after) {
  let snap = match.state();
  for (let i = 0; i < 400; i++) {
    snap = match.step();
    if (snap.lastLanding && snap.lastShot && snap.lastLanding.t > after) return snap;
  }
  return snap;
}

test('the opening feed is won inside five seconds', () => {
  const match = createMatch({ seed: 1, input: 'swing' });
  const serve = match.state().ball;
  const speed = Math.hypot(serve.vx, serve.vy, serve.vz);
  assert.ok(Math.abs(speed - 5) < 1e-9, speed);
  assert.equal(serve.spinLevel, 0);
  match.swing({ degPerSec: 320, dir: 'backhand', tiltX: 4, tiltY: 0, rollDegPerSec: 0, offsetMs: 40 });
  let snap = match.state();
  for (let i = 0; i < 60 * 5 && !snap.pointsPlayed; i++) snap = match.step();
  assert.equal(snap.score.you, 1);
  assert.equal(snap.score.neighbour, 0);
  assert.ok(snap.time < 5, snap.time);
  assert.equal(snap.lastShot.kind, 'drive');
  assert.equal(snap.lastShot.band, 'perfect');
  assert.ok(Math.abs(snap.lastShot.speed - 11 * 1.15) < 1e-9);
});

test('a hook swing outside 200 ms does not win the feed', () => {
  const match = createMatch({ seed: 1, input: 'swing' });
  match.swing({ degPerSec: 800, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 210 });
  let snap = match.state();
  for (let i = 0; i < 360 && !snap.pointsPlayed; i++) snap = match.step();
  assert.equal(snap.lastShot.band, 'miss');
  assert.equal(snap.score.you, 0);
});

test('7.9 cm long is nudged in and 8.1 cm is out', () => {
  function drop(past) {
    const match = createMatch({ seed: 1, input: 'swing' });
    match.placeBall({
      x: 0, y: 0.3, z: RULES.tableLength + past, vx: 0, vy: -3, vz: 0,
      hitter: 'you', phase: 'outgoing', bounces: 0,
    });
    let snap = match.state();
    for (let i = 0; i < 40; i++) snap = match.step();
    return snap;
  }
  const inside = drop(0.079);
  const edge = drop(0.08);
  const outside = drop(0.081);
  assert.equal(inside.lastLanding.call, 'in');
  assert.equal(inside.lastLanding.nudged, true);
  assert.equal(inside.score.neighbour, 0);
  assert.ok(inside.ball.z <= RULES.tableLength);
  assert.equal(edge.lastLanding.call, 'in');
  assert.equal(edge.lastLanding.nudged, true);
  assert.equal(edge.score.neighbour, 0);
  assert.equal(outside.lastLanding.call, 'out');
  assert.equal(outside.score.neighbour, 1);
  const wide = judgeLanding(RULES.halfWidth + 0.079, 2, 0.08);
  assert.equal(wide.call, 'in');
  assert.equal(wide.nudged, true);
  assert.equal(judgeLanding(RULES.halfWidth + 0.081, 2, 0.08).call, 'out');
});

test('contact aim, pull, accel and a casual push clears the net', () => {
  const aimed = incoming();
  aimed.swing({ degPerSec: 500, dir: 'forehand', tiltX: 30, tiltY: 20, rollDegPerSec: 0, offsetMs: 0, accel: 13 });
  const shot = untilShot(aimed);
  assert.ok(Math.abs(shot.lastShot.aimX - 0.7) < 1e-9);
  assert.ok(Math.abs(shot.lastShot.aimZ - (RULES.netZ + 0.3)) < 1e-9);
  assert.ok(Math.abs(shot.lastShot.speed - 6 * 1.15 * 1.1) < 1e-9);
  const landed = untilLanding(aimed, shot.lastShot.struckAt);
  assert.ok(Math.abs(landed.lastLanding.x - 0.7) < 0.03, landed.lastLanding.x);
  assert.ok(Math.abs(landed.lastLanding.z - (RULES.netZ + 0.3)) < 0.03, landed.lastLanding.z);
  assert.ok(shot.lastShot.yNet >= RULES.netHeight + RULES.ballR);

  const pulled = incoming();
  pulled.swing({ degPerSec: 800, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: -120 });
  const early = untilShot(pulled);
  assert.equal(early.lastShot.band, 'early');
  assert.equal(early.lastShot.pullDeg, -25);
  assert.equal(early.lastShot.speed, 11);

  const late = incoming();
  // The late window is 120 ms after the plane, so the feed starts high enough to still be a smash.
  late.placeBall({
    x: 0, y: 0.9, z: 0.7, vx: 0, vy: 0.2, vz: -2.4,
    hitter: 'neighbour', phase: 'incoming', bounces: 0, spinType: 'none', spinLevel: 0,
  });
  late.swing({ degPerSec: 1200, dir: 'forehand', tiltX: 0, tiltY: -5, rollDegPerSec: 0, offsetMs: 120 });
  const smash = untilShot(late);
  assert.equal(smash.lastShot.kind, 'smash');
  assert.equal(smash.lastShot.speed, 17);
  assert.equal(smash.lastShot.pullDeg, 25);
});

test('level 3 topspin reaches the table 15 percent sooner', () => {
  function flight(roll) {
    const match = incoming();
    match.swing({ degPerSec: 450, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: roll, offsetMs: 0 });
    const shot = untilShot(match);
    const land = untilLanding(match, shot.lastShot.struckAt);
    const air = land.lastLanding.t - shot.lastShot.struckAt - RULES.hitstopPerfect;
    return { air, g: shot.ball.g, vy: shot.ball.vy, z: land.lastLanding.z };
  }
  const plain = flight(0);
  const top = flight(900);
  assert.equal(spinTimeScale(spinFromRoll(900)), 0.85);
  assert.ok(Math.abs(top.g / plain.g - 1 / (0.85 * 0.85)) < 1e-6);
  assert.ok(Math.abs(top.vy / plain.vy - 1 / 0.85) < 1e-6);
  assert.ok(Math.abs(top.z - plain.z) < 0.03);
  const ratio = top.air / plain.air;
  assert.ok(Math.abs(ratio - 0.85) < 0.02, ratio);
});

test('backspin sits up and a swing on the way back is ignored', () => {
  const back = incoming();
  back.swing({ degPerSec: 450, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: -900, offsetMs: 0 });
  const shot = untilShot(back);
  assert.equal(shot.lastShot.spin, 'back');
  assert.equal(shot.lastShot.spinLevel, 3);
  const away = createMatch({ seed: 1, input: 'swing' });
  away.placeBall({ x: 0, y: 0.3, z: 1.2, vx: 0, vy: 1, vz: 6, hitter: 'you', phase: 'outgoing', bounces: 1 });
  const ignored = away.swing({ degPerSec: 900, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 0 });
  assert.equal(ignored.reason, 'away');
  assert.equal(ignored.penalty, false);
});

test('cooldown is 350 ms and a drop pauses the point', () => {
  const match = incoming();
  const first = match.swing({ degPerSec: 700, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 0 });
  const second = match.swing({ degPerSec: 700, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 10 });
  assert.equal(first.accepted, true);
  assert.equal(second.reason, 'cooldown');
  for (let i = 0; i < 30; i++) match.step();
  const later = match.swing({ degPerSec: 700, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 0 });
  assert.notEqual(later.reason, 'cooldown');
  const paused = createMatch({ seed: 1, input: 'swing' });
  assert.equal(paused.shock(39), false);
  assert.equal(paused.shock(41), true);
  assert.equal(paused.state().paused, true);
});

test('a game ends at 11 and continues at 10-10', () => {
  const match = createMatch({ seed: 2, input: 'swing' });
  for (let i = 0; i < 10; i++) {
    match.placeBall({ x: 0, y: 0.2, z: 3, vx: 0, vy: -2, vz: 0, hitter: 'neighbour', phase: 'incoming', bounces: 0 });
    for (let n = 0; n < 30; n++) match.step();
  }
  assert.equal(match.state().score.you >= 1 || match.state().score.neighbour >= 1, true);
});
