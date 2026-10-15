// node qa/pingpong/rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES,
  aimTarget,
  feedbackWords,
  gameWon,
  judgeLong,
  judgeNet,
  serverForScore,
  shotFromPeak,
  signedPull,
  spinFromRoll,
  spinTimeScale,
  timingFromOffset,
} from '../../public/pingpong/rules.js';
import { createSwingDetector, dirFromYaw, smoothSpeed, swipeToSwing } from '../../public/pingpong/motion.js';
import { project } from '../../public/pingpong/render.js';
import { VOICES } from '../../public/pingpong/audio.js';

test('swing bands and speeds', () => {
  assert.equal(RULES.swingStart, 300);
  assert.equal(shotFromPeak(299, 0.5).kind, null);
  assert.deepEqual(shotFromPeak(300, 0.2), { kind: 'push', speed: 6 });
  assert.deepEqual(shotFromPeak(600, 0.2), { kind: 'push', speed: 6 });
  assert.deepEqual(shotFromPeak(601, 0.2), { kind: 'drive', speed: 11 });
  assert.deepEqual(shotFromPeak(1100, 0.2), { kind: 'drive', speed: 11 });
  assert.deepEqual(shotFromPeak(1101, 0.2), { kind: 'drive', speed: 11 });
  assert.deepEqual(shotFromPeak(1101, RULES.netHeight + RULES.smashClearance), { kind: 'smash', speed: 17 });
  assert.equal(RULES.smashClearance, 0.15);
  assert.equal(RULES.netHeight, 0.1525);
});

test('timing window, perfect band and 25 degrees', () => {
  assert.equal(RULES.windowMs, 120);
  assert.equal(RULES.perfectMs, 40);
  assert.equal(timingFromOffset(0, false).band, 'perfect');
  assert.equal(timingFromOffset(40, false).band, 'perfect');
  assert.equal(timingFromOffset(-40, false).band, 'perfect');
  assert.equal(timingFromOffset(0, false).speedMul, 1.15);
  assert.equal(timingFromOffset(41, false).band, 'late');
  assert.equal(timingFromOffset(-41, false).band, 'early');
  assert.equal(timingFromOffset(120, false).band, 'late');
  assert.equal(timingFromOffset(-120, false).band, 'early');
  assert.equal(timingFromOffset(121, false).band, 'miss');
  assert.equal(timingFromOffset(-121, false).band, 'miss');
  const early = signedPull(-120, 'forehand', false);
  const late = signedPull(120, 'forehand', false);
  assert.equal(early.pullDeg, -25);
  assert.equal(late.pullDeg, 25);
  assert.equal(signedPull(-120, 'backhand', false).pullDeg, 25);
  assert.equal(RULES.pullDeg, 25);
  assert.equal(RULES.hookWindowMs, 200);
  assert.equal(timingFromOffset(180, true).band, 'perfect');
  assert.equal(timingFromOffset(201, true).band, 'miss');
});

test('aim maps gamma and beta', () => {
  assert.equal(RULES.aimGamma, 30);
  assert.equal(RULES.aimX, 0.7);
  assert.equal(RULES.halfWidth, 0.76);
  const right = aimTarget(30, 0);
  const left = aimTarget(-30, 0);
  assert.ok(Math.abs(right.x - 0.7) < 1e-9);
  assert.ok(Math.abs(left.x + 0.7) < 1e-9);
  const short = aimTarget(0, 20);
  const deep = aimTarget(0, -20);
  assert.ok(Math.abs(short.z - (RULES.netZ + 0.3)) < 1e-9);
  assert.ok(Math.abs(deep.z - RULES.tableLength) < 1e-9);
  assert.equal(RULES.shortPastNet, 0.3);
  assert.equal(RULES.aimBeta, 20);
});

test('spin starts over 200 deg/s and level 3 dips 15 percent', () => {
  assert.equal(RULES.spinStart, 200);
  assert.equal(RULES.spinDip, 0.15);
  assert.deepEqual(spinFromRoll(200), { type: 'none', level: 0 });
  assert.equal(spinFromRoll(201).type, 'top');
  assert.equal(spinFromRoll(-201).type, 'back');
  assert.equal(spinFromRoll(900).level, 3);
  assert.equal(spinTimeScale(spinFromRoll(900)), 0.85);
  assert.equal(spinTimeScale({ type: 'back', level: 3 }), 1.15);
  assert.deepEqual(feedbackWords('perfect', { type: 'top', level: 2 }), ['Perfect', 'Topspin']);
  assert.deepEqual(feedbackWords('early', { type: 'back', level: 1 }), ['Early', 'Backspin']);
});

test('8 cm long is in and 8.1 cm is out', () => {
  assert.equal(RULES.forgive, 0.08);
  assert.equal(judgeLong(0.079), 'nudge');
  assert.equal(judgeLong(0.08), 'nudge');
  assert.equal(judgeLong(0.081), 'out');
  assert.equal(judgeLong(0), 'in');
});

test('net tape and clear height', () => {
  const clear = RULES.netHeight + RULES.ballR;
  assert.equal(judgeNet(clear), 'clear');
  assert.equal(judgeNet(clear - 0.01), 'tape');
  assert.equal(judgeNet(clear - 0.03), 'net');
});

test('score to 11, win by 2, serve names', () => {
  assert.equal(RULES.gamePoints, 11);
  assert.equal(RULES.winBy, 2);
  assert.equal(gameWon(11, 9), true);
  assert.equal(gameWon(11, 10), false);
  assert.equal(gameWon(12, 10), true);
  assert.equal(gameWon(10, 10), false);
  assert.equal(serverForScore(0, 0), 'neighbour');
  assert.equal(serverForScore(1, 0), 'neighbour');
  assert.equal(serverForScore(2, 0), 'you');
  assert.equal(serverForScore(10, 10), 'neighbour');
  assert.equal(serverForScore(11, 10), 'you');
  assert.equal(serverForScore(11, 11), 'neighbour');
});

test('feel numbers', () => {
  assert.equal(RULES.cooldown, 0.35);
  assert.equal(RULES.peakWindow, 0.15);
  assert.equal(RULES.smoothSamples, 3);
  assert.equal(RULES.hitstop, 0.05);
  assert.equal(RULES.hitstopPerfect, 0.08);
  assert.equal(RULES.nudgePx, 4);
  assert.equal(RULES.smashShake, 3);
  assert.equal(RULES.accelBoost, 12);
  assert.equal(RULES.accelBoostMul, 1.1);
  assert.equal(RULES.dropAccel, 40);
  assert.equal(RULES.calibrate, 0.3);
  assert.equal(RULES.hookServe, 5);
  assert.equal(RULES.neighbourDelay, 0.26);
  assert.equal(RULES.neighbourError, 0.18);
  assert.equal(RULES.neighbourSpeedMin, 6);
  assert.equal(RULES.neighbourSpeedMax, 9);
  assert.equal(RULES.neighbourSpread, 0.3);
  assert.equal(RULES.vibrateHit, 15);
  assert.equal(RULES.vibrateSmash, 30);
  assert.equal(RULES.assist, 1);
  assert.equal(RULES.dprCap, 2);
  assert.equal(RULES.trailDrive, 4);
  assert.equal(RULES.trailSmash, 8);
  assert.equal(RULES.crowdRally, 8);
  assert.equal(RULES.eyeHeight, 0.5);
  assert.equal(RULES.eyeBehind, 1.2);
  assert.equal(RULES.farWidth, 0.45);
  assert.equal(RULES.safePx, 56);
});

test('swing detector smooths 3 samples, peaks for 150 ms, then cools down 350 ms', () => {
  const samples = [
    { alpha: 400, beta: 0, gamma: 0 },
    { alpha: 100, beta: 0, gamma: 0 },
    { alpha: 100, beta: 0, gamma: 0 },
  ];
  assert.ok(Math.abs(smoothSpeed(samples) - (400 + 100 + 100) / 3) < 1e-9);
  assert.equal(dirFromYaw(-10), 'forehand');
  assert.equal(dirFromYaw(10), 'backhand');
  const watch = createSwingDetector();
  assert.equal(watch.push({ alpha: 400, beta: 0, gamma: 10, accel: 4 }, 0), null);
  assert.equal(watch.push({ alpha: -900, beta: 0, gamma: 40, accel: 8 }, 0.05), null);
  const swing = watch.push({ alpha: -200, beta: 0, gamma: 900, accel: 13 }, 0.15);
  assert.ok(swing);
  assert.ok(swing.degPerSec >= 900);
  assert.equal(swing.dir, 'forehand');
  assert.equal(swing.rollDegPerSec, 900);
  assert.equal(swing.accel, 13);
  assert.equal(watch.push({ alpha: 800, beta: 0, gamma: 0, accel: 0 }, 0.2), null);
  assert.equal(watch.push({ alpha: 800, beta: 0, gamma: 0, accel: 0 }, 0.49), null);
  assert.equal(watch.push({ alpha: 500, beta: 0, gamma: 0, accel: 0 }, 0.16 + 0.35), null);
});

test('a swipe uses the same three bands', () => {
  const push = swipeToSwing({ dx: 10, dy: -80, dt: 80 / 400, endDy: -10, endDt: 0.05 });
  assert.ok(push.degPerSec >= 300 && push.degPerSec <= 600);
  const drive = swipeToSwing({ dx: -40, dy: -200, dt: 200 / 900, endDy: -30, endDt: 0.04 });
  assert.ok(drive.degPerSec > 600 && drive.degPerSec <= 1100);
  const smash = swipeToSwing({ dx: 20, dy: -240, dt: 240 / 1600, endDy: -40, endDt: 0.03 });
  assert.ok(smash.degPerSec > 1100);
  const top = swipeToSwing({ dx: 0, dy: -100, dt: 0.2, endDy: -40, endDt: 0.05 });
  assert.ok(top.rollDegPerSec > 200);
  const back = swipeToSwing({ dx: 0, dy: -100, dt: 0.2, endDy: 30, endDt: 0.05 });
  assert.ok(back.rollDegPerSec < -200);
});

test('the far end of the table is about 45 percent of the near end', () => {
  const w = 390;
  const h = 844;
  const near = project(RULES.halfWidth, 0, 0, w, h).x - project(-RULES.halfWidth, 0, 0, w, h).x;
  const far = project(RULES.halfWidth, 0, RULES.tableLength, w, h).x - project(-RULES.halfWidth, 0, RULES.tableLength, w, h).x;
  assert.ok(Math.abs(far / near - 0.45) < 0.02, far / near);
  assert.ok(project(0, 0, 0, w, h).y > h * 0.7);
  assert.ok(project(0, 0, 0, w, h).y <= h - 56);
});

test('bat hit and table bounce are different voices', () => {
  assert.notEqual(VOICES.pock.freq, VOICES.tik.freq);
  assert.ok(VOICES.tik.freq > VOICES.pock.freq);
  assert.ok(VOICES.tik.dur < VOICES.pock.dur);
  assert.equal(VOICES.pock.dur, 0.04);
  assert.equal(VOICES.tik.dur, 0.025);
  assert.equal(VOICES.pock.freq, 1200);
});
