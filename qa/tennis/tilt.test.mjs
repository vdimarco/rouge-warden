// Tilt, flick, gate audio, and the phone-control bug fixes.
// node qa/tennis/tilt.test.mjs
import fs from 'fs';
import { createMatch, createTest, readOptions, planFrame, releaseSwing } from '../../public/tennis/game.js';
import { axisAmount, lowPass, flickKind, magnetPull } from '../../public/tennis/motion.js';
import { unlockCourt } from '../../public/tennis/gate.js';
import { createSoundKit, whooshAmount } from '../../public/tennis/audio.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log('  ok   ' + name);
  } catch (e) {
    results.push({ name, ok: false });
    console.log('  FAIL ' + name + '\n       ' + (e && e.message));
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg}: ${a} vs ${b}`);
}

function settle(api, beta, gamma) {
  for (let i = 0; i < 40; i++) api.tilt(beta, gamma);
}

test('dead zone holds still and 25 degrees is full speed', () => {
  assert(axisAmount(2) === 0, '2 deg should be inside the dead zone');
  assert(axisAmount(3) === 0, '3 deg is the edge of the dead zone');
  near(axisAmount(25), 1, 1e-9, '25 deg is full lateral speed');
  near(axisAmount(14), (14 - 3) / (25 - 3), 1e-9, 'speed between the dead zone and full tilt');
  near(lowPass(0, 80), 10, 1e-9, 'a spike is clamped before the low pass');

  const still = createTest(createMatch({ seed: 1, ai: 'pro', input: 'tilt' }));
  still.calibrate();
  settle(still, 0, 2);
  const x0 = still.state().playerX;
  still.step(30);
  near(still.state().playerX, x0, 0.02, '2 deg moved the player');
  assert(still.state().magnet === 0, 'pro aim assist should be off');

  const run = createTest(createMatch({ seed: 1, ai: 'pro', input: 'tilt' }));
  run.calibrate();
  settle(run, 0, 25);
  run.step(30);
  near(run.state().playerX, 2.3, 0.15, 'full tilt speed');

  const depth = createTest(createMatch({ seed: 1, ai: 'pro', input: 'tilt' }));
  depth.calibrate();
  const y0 = depth.state().playerY;
  settle(depth, 25, 0);
  depth.step(30);
  near(depth.state().playerY - y0, 0.92, 0.15, 'forward tilt is 40 percent of lateral speed');
  near(depth.state().playerX, 0, 0.05, 'forward tilt should not slide sideways');
});

test('casual aim assist fades and never fights a tilt', () => {
  assert(magnetPull('casual', 1, 0) === 0.6, 'opening magnet');
  assert(magnetPull('casual', 1, 3) === 0.35, 'rest of point 1');
  assert(magnetPull('casual', 2, 4) === 0.2, 'points 2 to 4');
  assert(magnetPull('casual', 5, 6) === 0.1, 'later points');
  assert(magnetPull('pro', 1, 0) === 0, 'pro');
  const api = createTest(createMatch({ seed: 1, input: 'tilt' }));
  api.calibrate();
  assert(api.state().magnet === 0.6, 'the opening state should offer the strong magnet');
});

test('flick bands are drop, drive, and smash', () => {
  assert(flickKind(300, { z: 0.8, y: 6.8 }, false) === 'drop', '300');
  assert(flickKind(600, { z: 0.8, y: 6.8 }, false) === 'flat', '600');
  assert(flickKind(1000, { z: 1.4, y: 6.8 }, false) === 'smash', 'high ball');
  assert(flickKind(1000, { z: 0.4, y: 5.4 }, false) === 'smash', 'front half');
  assert(flickKind(1000, { z: 0.4, y: 7.1 }, false) === 'flat', 'low ball is a hard drive, not a miss');
  assert(flickKind(200, { z: 1, y: 6 }, false) === null, 'under 250 is ignored after the opening');
  assert(flickKind(200, { z: 1, y: 6 }, true) === 'drop', 'the opening lob accepts 150');

  const api = createTest(createMatch({ seed: 1, input: 'tilt' }));
  let guard = 0;
  let drop = null;
  while (guard < 60 * 8 && !drop) {
    if (api.state().window) drop = api.flick(300);
    else api.step();
    guard += 1;
  }
  assert(drop && drop.lastShot === 'drop' && drop.lastHit && drop.lastHit.kind === 'drop', 'a 300 flick in the window is a drop');

  const drive = createTest(createMatch({ seed: 1, input: 'tilt' }));
  guard = 0;
  let shot = null;
  while (guard < 60 * 8 && !shot) {
    if (drive.state().window) shot = drive.flick(600);
    else drive.step();
    guard += 1;
  }
  assert(shot && shot.lastShot === 'drive' && shot.lastHit && shot.lastHit.kind === 'flat', 'a 600 flick is a drive');

  const early = createTest(createMatch({ seed: 1, input: 'tilt' }));
  const miss = early.flick(600);
  assert(miss.events.some((e) => e.type === 'whoosh'), 'a miss still whooshes');
  assert(miss.events.some((e) => e.type === 'whiff'), 'the miss is a whiff');
  assert(miss.flowerCount.you === 0, 'a miss planted a flower');
  near(whooshAmount(250), 0, 1e-9, 'soft whoosh');
  near(whooshAmount(1000), 1, 1e-9, 'hard whoosh');
});

test('a second flick inside 350 ms is ignored and movement stays frozen', () => {
  const api = createTest(createMatch({ seed: 1, ai: 'pro', input: 'tilt' }));
  api.calibrate();
  settle(api, 0, 25);
  api.flick(400);
  const again = api.flick(800);
  assert(again.events.some((e) => e.type === 'flick-ignored'), 'the second flick should wait');
  assert(again.cooldownLeft > 0, 'cooldown should be running');
  api.advance(0.2);
  assert(api.flick(800).events.some((e) => e.type === 'flick-ignored'), '200 ms is still inside the cooldown');
  api.advance(0.2);
  assert(!api.flick(400).events.some((e) => e.type === 'flick-ignored'), 'the cooldown should be over');

  const frozen = createTest(createMatch({ seed: 1, ai: 'pro', input: 'tilt' }));
  frozen.calibrate();
  settle(frozen, 0, 25);
  frozen.step(3);
  const x = frozen.state().playerX;
  frozen.flick(400);
  settle(frozen, 0, -40);
  frozen.step(8);
  assert(frozen.state().playerX > x + 0.3, 'the swing should keep the last tilt instead of reversing');
  assert(frozen.state().freezeLeft > 0, 'movement input should still be frozen');
});

test('tilt falls back to touch and keys can reach a wide ball', () => {
  const tilt = createTest(createMatch({ seed: 1, ai: 'pro', input: 'tilt' }));
  const touch = createTest(createMatch({ seed: 1, ai: 'pro', input: 'touch' }));
  tilt.calibrate();
  settle(tilt, 0, 30);
  touch.tilt(0, 30);
  tilt.step(20);
  touch.step(20);
  assert(tilt.state().playerX > touch.state().playerX + 0.4, 'touch mode should ignore tilt');

  const keys = createTest(createMatch({ seed: 1, ai: 'pro' }));
  keys.setMove(-1, 0);
  keys.step(90);
  assert(keys.state().playerX < -3.05, `arrow travel stopped at ${keys.state().playerX}`);

  assert(releaseSwing({ steered: true, dx: 80, dy: 40, held: 100 }) === null, 'a steer drag must not swing');
  assert(releaseSwing({ steered: false, dx: 4, dy: 3, held: 40 }) === 'flat', 'a tap still swings');
  assert(readOptions('?input=tilt&seed=123').input === 'tilt', 'query tilt');
});

test('fast mode catches up on a slow frame', () => {
  const slow = planFrame(0, 0.25, true);
  assert(slow.steps > 8, `a slow fast frame only played ${slow.steps} steps`);
  assert(slow.acc < 0.02, `time was left behind (${slow.acc})`);
  let acc = 0;
  let steps = 0;
  for (let i = 0; i < 60; i++) {
    const planned = planFrame(acc, 1 / 60, false);
    acc = planned.acc;
    steps += planned.steps;
  }
  assert(steps === 60 && acc < 0.001, `a steady clock played ${steps} steps with ${acc} left`);
});

test('seed 123 on tilt wins point 1 inside the opening beats', () => {
  const api = createTest(createMatch({ seed: 123, input: 'tilt' }));
  api.calibrate();
  let first = null;
  let guard = 0;
  while (guard < 60 * 25 && api.state().score.you < 1) {
    if (api.state().window) {
      const hit = api.flick(600);
      if (!first && hit.lastHit) first = hit.time;
    }
    api.step();
    guard += 1;
  }
  assert(first != null && first < 4, `first hit at ${first}`);
  assert(api.state().score.you === 1, 'point 1 was not won');
  assert(api.state().time < 20, `point 1 ended at ${api.state().time}`);
});

test('the gate tap unlocks audio and motion in the same call', () => {
  const order = [];
  let returned = false;
  class AudioContext {
    constructor() { order.push(['create', returned]); }
    resume() { order.push(['resume', returned]); return Promise.resolve(); }
  }
  const env = {
    DeviceMotionEvent: { requestPermission() { order.push(['motion', returned]); return Promise.resolve('granted'); } },
    DeviceOrientationEvent: { requestPermission() { order.push(['orient', returned]); return Promise.resolve('granted'); } },
    AudioContext,
  };
  const unlocked = unlockCourt(env);
  returned = true;
  assert(unlocked.audio instanceof AudioContext, 'the tap should create the audio context');
  assert(order.map((step) => step[0]).join(',') === 'motion,orient,create,resume', order.map((step) => step[0]).join(','));
  assert(order.every((step) => step[1] === false), 'permission or resume ran after the handler returned');

  const gateSrc = fs.readFileSync('public/tennis/gate.js', 'utf8');
  assert(!gateSrc.includes('await') && !gateSrc.includes('setTimeout') && !gateSrc.includes('.then('), 'unlockCourt waits');
  const gameSrc = fs.readFileSync('public/tennis/game.js', 'utf8');
  const start = gameSrc.indexOf('function onGateTap()');
  const end = gameSrc.indexOf('function onTouchChoice()');
  const body = gameSrc.slice(start, end);
  assert(start > 0 && body.startsWith('function onGateTap()'), 'onGateTap should stay a plain function');
  assert(!body.includes('await') && !body.includes('setTimeout') && !body.includes('.then('), 'the gate handler waits before returning');
  const unlockAt = body.indexOf('unlockCourt(');
  const later = body.indexOf('settleGate(');
  assert(unlockAt > 0 && later > unlockAt, 'permission and audio run before the gate continues');

  const settleAt = gameSrc.indexOf('async function settleGate(unlocked)');
  const settleBody = gameSrc.slice(settleAt, gameSrc.indexOf('function onGateTap()'));
  const pauseAt = settleBody.indexOf('simHold = true');
  const waitAt = settleBody.indexOf('await');
  assert(pauseAt > 0 && pauseAt < waitAt, 'the pose gate should pause the match before it waits');
});

test('sounds are synthesized, with no audio files', () => {
  const src = fs.readFileSync('public/tennis/audio.js', 'utf8');
  assert(!/\.(mp3|ogg|wav|m4a|aac)/.test(src), 'an audio file is referenced');
  assert(src.includes('createOscillator') && src.includes('createBuffer'), 'voices should be oscillators and noise');
  const calls = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    createOscillator() {
      calls.push('osc');
      return {
        type: '',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
    },
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    },
    createBuffer(_ch, n) { return { getChannelData: () => new Float32Array(n) }; },
    createBufferSource() {
      calls.push('noise');
      return { connect() {}, start() {} };
    },
    createBiquadFilter() {
      return {
        type: '',
        frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
        Q: { setValueAtTime() {} },
        connect() {},
      };
    },
  };
  const kit = createSoundKit();
  kit.attach(ctx);
  kit.tok();
  kit.chime();
  kit.chirp();
  kit.whoosh(1000);
  assert(calls.includes('osc') && calls.includes('noise'), 'tok, chime, chirp, and whoosh did not schedule');
});

const bad = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - bad} passed, ${bad} failed`);
process.exitCode = bad ? 1 : 0;
