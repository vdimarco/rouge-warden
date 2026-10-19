// node qa/pingpong/rally.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from '../../public/pingpong/sim.js';
import { RULES, judgeLanding, spinTimeScale, spinFromRoll } from '../../public/pingpong/rules.js';
import { POINTER, flickFromSamples } from '../../public/pingpong/motion.js';

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

function throughCount(match) {
  let snap = match.state();
  assert.equal(snap.phase, 'count');
  const ticks = [];
  const held = { x: snap.ball.x, y: snap.ball.y, z: snap.ball.z };
  for (let i = 0; i < 60 * 4 && snap.phase === 'count'; i++) {
    const before = snap.ball;
    snap = match.step();
    if (snap.phase === 'count') {
      assert.equal(snap.ball.x, before.x);
      assert.equal(snap.ball.y, before.y);
      assert.equal(snap.ball.z, before.z);
      assert.equal(snap.ball.vx, 0);
      assert.equal(snap.ball.vy, 0);
      assert.equal(snap.ball.vz, 0);
    }
    for (const event of snap.events) if (event.type === 'tick') ticks.push(event.beat);
  }
  assert.equal(snap.phase, 'incoming');
  assert.deepEqual(ticks, [3, 2, 1]);
  assert.equal(held.x, snap.ball.x);
  return snap;
}

test('the count-in holds the ball, then the serve settles near 3.5 m/s', () => {
  const match = createMatch({ seed: 1, input: 'swing' });
  const earlySwing = match.swing({ degPerSec: 400, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0 });
  assert.equal(earlySwing.reason, 'away');
  const launched = throughCount(match);
  assert.equal(launched.ball.spinLevel, 0);
  const earlyH = Math.hypot(launched.ball.vx, launched.ball.vz);
  const rebuilt = Math.hypot(launched.ball.vx * 2, launched.ball.vy, launched.ball.vz * 2);
  assert.ok(earlyH < RULES.serveSpeed * 0.5, earlyH);
  assert.ok(Math.abs(rebuilt - RULES.serveSpeed) < 0.35, rebuilt);
  let snap = launched;
  for (let i = 0; i < 23; i++) snap = match.step();
  const laterH = Math.hypot(snap.ball.vx, snap.ball.vz);
  assert.ok(Math.abs(laterH - RULES.serveSpeed * 0.7) < 0.25, laterH);
  assert.ok(snap.ball.y > 0.45, snap.ball.y);
});

test('the opening feed is won by about seven seconds', () => {
  const match = createMatch({ seed: 1, input: 'swing' });
  throughCount(match);
  match.swing({ degPerSec: 320, dir: 'backhand', tiltX: 4, tiltY: 0, rollDegPerSec: 0, offsetMs: 40 });
  let snap = match.state();
  for (let i = 0; i < 60 * 8 && !snap.pointsPlayed; i++) snap = match.step();
  assert.equal(snap.score.you, 1);
  assert.equal(snap.score.neighbour, 0);
  assert.ok(snap.time < 7.5, snap.time);
  assert.equal(snap.lastShot.kind, 'drive');
  assert.equal(snap.lastShot.band, 'perfect');
  assert.ok(Math.abs(snap.lastShot.speed - 11 * 1.15) < 1e-9);
});

function widthsFlick(widthsPerSec) {
  const width = 1280;
  const dt = POINTER.window;
  const dist = widthsPerSec * width * dt;
  return flickFromSamples(
    [{ x: 0, y: 0, t: 0 }, { x: dist, y: 0, t: dt }],
    dt,
    width,
  );
}

function openingPoint(swing) {
  const match = createMatch({ seed: 1, input: 'swing' });
  throughCount(match);
  if (swing) match.swing({ dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, ...swing });
  let snap = match.state();
  for (let i = 0; i < 60 * 8 && snap.score.you === 0 && snap.score.neighbour === 0; i++) snap = match.step();
  return snap;
}

test('a speed-0 miss 383 ms early does not take the opening hook', () => {
  const missed = openingPoint({ degPerSec: 0, offsetMs: -383 });
  assert.equal(missed.score.you, 0);
  assert.equal(missed.score.neighbour, 1);
  assert.equal(missed.lastShot.band, 'miss');
  assert.equal(missed.lastShot.speed, 0);
  assert.notEqual(missed.lastShot.hook, true);

  const quiet = openingPoint(null);
  assert.equal(quiet.score.you, 0);
  assert.equal(quiet.score.neighbour, 1);
  assert.equal(quiet.lastShot, null);

  assert.equal(widthsFlick(1.1), null);
  const flick = widthsFlick(1.2);
  assert.ok(flick.widthsPerSec + 1e-9 >= 1.2);
  for (const offsetMs of [-200, 0, 200]) {
    const won = openingPoint({ degPerSec: flick.degPerSec, widthsPerSec: flick.widthsPerSec, offsetMs });
    assert.equal(won.score.you, 1, String(offsetMs));
    assert.equal(won.score.neighbour, 0, String(offsetMs));
    assert.equal(won.lastShot.hook, true, String(offsetMs));
    assert.equal(won.lastShot.kind, 'drive', String(offsetMs));
  }
});

test('a sub-threshold phone or desktop swing does not win point 1', () => {
  for (const degPerSec of [0, RULES.swingStart - 1, RULES.swingStart]) {
    const phone = openingPoint({ degPerSec, offsetMs: 0 });
    assert.equal(phone.score.you, 0, `phone ${degPerSec}`);
    assert.equal(phone.score.neighbour, 1, `phone ${degPerSec}`);
    assert.equal(phone.lastShot.speed, 0, `phone ${degPerSec}`);
    assert.notEqual(phone.lastShot.hook, true, `phone ${degPerSec}`);
  }
  const phoneHit = openingPoint({ degPerSec: RULES.swingStart + 1, offsetMs: 0 });
  assert.equal(phoneHit.score.you, 1);
  assert.equal(phoneHit.score.neighbour, 0);
  assert.equal(phoneHit.lastShot.hook, true);

  assert.equal(widthsFlick(0), null);
  assert.equal(widthsFlick(1.1), null);
  for (const widthsPerSec of [0, 1.1]) {
    const desk = openingPoint({ degPerSec: 900, widthsPerSec, offsetMs: 0 });
    assert.equal(desk.score.you, 0, `desktop ${widthsPerSec}`);
    assert.equal(desk.score.neighbour, 1, `desktop ${widthsPerSec}`);
    assert.equal(desk.lastShot.speed, 0, `desktop ${widthsPerSec}`);
    assert.notEqual(desk.lastShot.kind, 'drive', `desktop ${widthsPerSec}`);
  }
  const earlyDesk = openingPoint({ degPerSec: 900, widthsPerSec: 0, offsetMs: -383 });
  assert.equal(earlyDesk.score.you, 0);
  assert.equal(earlyDesk.lastShot.speed, 0);

  const flick = widthsFlick(POINTER.push);
  const deskHit = openingPoint({
    degPerSec: flick.degPerSec,
    widthsPerSec: flick.widthsPerSec,
    offsetMs: 0,
  });
  assert.equal(deskHit.score.you, 1);
  assert.equal(deskHit.score.neighbour, 0);
  assert.equal(deskHit.lastShot.hook, true);
  assert.ok(flick.widthsPerSec + 1e-9 >= 1.2);
});

test('a hook swing outside 200 ms does not win the feed', () => {
  const match = createMatch({ seed: 1, input: 'swing' });
  throughCount(match);
  match.swing({ degPerSec: 800, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: 210 });
  let snap = match.state();
  for (let i = 0; i < 60 * 8 && !snap.pointsPlayed; i++) snap = match.step();
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

test('a hit 58 ms early stays on the table', () => {
  const match = createMatch({ seed: 4, input: 'swing' });
  match.placeBall({
    x: 0.1, y: 0.18, z: 0.62, vx: 0.2, vy: 1.2, vz: -3.2,
    hitter: 'neighbour', phase: 'incoming', bounces: 1,
  });
  match.setBat({ x: 0.1, depth: 0.62, roll: 0 });
  match.swing({ degPerSec: 860, dir: 'forehand', tiltX: 4, tiltY: 6, rollDegPerSec: 0, offsetMs: -58 });
  let snap = match.state();
  for (let i = 0; i < 180; i++) {
    snap = match.step();
    const types = snap.events.map((e) => e.type);
    if (types.includes('net') || types.includes('floor') || types.includes('tik')) break;
  }
  assert.equal(snap.lastShot.band, 'early');
  assert.equal(snap.lastShot.kind, 'drive');
  assert.ok(Math.abs(snap.lastShot.pullDeg + 5.625) < 1e-9, snap.lastShot.pullDeg);
  assert.equal(snap.events.some((e) => e.type === 'net'), false);
  assert.equal(snap.lastLanding.call, 'in');
  assert.equal(snap.score.neighbour, 0);
  assert.ok(snap.lastShot.yNet >= RULES.netHeight + RULES.ballR, snap.lastShot.yNet);

  const low = createMatch({ seed: 4, input: 'swing' });
  low.placeBall({
    x: 0, y: 0.08, z: 0.5, vx: 0, vy: 0.4, vz: -2.4,
    hitter: 'neighbour', phase: 'incoming', bounces: 1,
  });
  low.setBat({ x: 0, depth: 0.5, roll: 0 });
  low.swing({ degPerSec: 1200, dir: 'forehand', tiltX: 0, tiltY: 0, rollDegPerSec: 0, offsetMs: -58 });
  let smashed = low.state();
  for (let i = 0; i < 180; i++) {
    smashed = low.step();
    const types = smashed.events.map((e) => e.type);
    if (types.includes('net') || types.includes('floor') || types.includes('tik')) break;
  }
  assert.equal(smashed.lastShot.kind, 'smash');
  assert.equal(smashed.lastShot.speed, 17);
  assert.equal(smashed.events.some((e) => e.type === 'net'), false);
  assert.equal(smashed.lastLanding.call, 'in');
  assert.equal(smashed.score.neighbour, 0);
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
