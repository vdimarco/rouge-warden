// Light Years Home v3: the pure parts of ui/input.js (final.md 13.2, 13.3) and the touch pipeline driven with fake
// pointer events: stick maths, the flick, the action hold, scheme switching, keys, pad, mouse, tilt and pedals.
// node qa/light-years-home/v3/input.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expo, deadScale, stickAxes, follow, FOLLOW, createFlick, createAction, nextSource, kindForSource, keyAxes,
  mouseAxes, padAxes, padPressed, PAD, tiltSteer, rollOf, pedalAt, hitTarget, canSteer, createInput,
} from '../../../public/light-years-home/ui/input.js';
import { TUNE } from '../../../public/light-years-home/core/tune.js';
import { layoutFor } from '../../../public/light-years-home/core/layout.js';

const I = TUNE.INPUT;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('expo and dead zones', () => {
  assert.equal(expo(0), 0);
  assert.equal(expo(1), 1);
  assert.equal(expo(-1), -1);
  assert.ok(near(expo(0.5), 0.5 ** TUNE.SHIP.EXPO));
  assert.ok(near(expo(-0.5), -(0.5 ** TUNE.SHIP.EXPO)));
  assert.equal(expo(3), 1, 'clamped');
  assert.equal(deadScale(5, 6, 56), 0);
  assert.equal(deadScale(56, 6, 56), 1);
  assert.equal(deadScale(-200, 6, 56), -1);
  assert.ok(near(deadScale(31, 6, 56), 0.5));
  assert.ok(!Object.is(deadScale(-3, 6, 56), -0), 'no −0');
});

test('stick: X steers with a 6 px dead zone, full at 56 px, expo 1.5', () => {
  assert.equal(stickAxes(I.STICK_DEAD, 0).steer, 0);
  assert.equal(stickAxes(I.STICK_FULL, 0).steer, 1);
  assert.equal(stickAxes(-I.STICK_FULL - 40, 0).steer, -1);
  const half = (I.STICK_DEAD + I.STICK_FULL) / 2;
  assert.ok(near(stickAxes(half, 0).steer, 0.5 ** TUNE.SHIP.EXPO));
  assert.ok(stickAxes(20, 0).steer > 0, 'right is positive');
});

test('stick: Y climbs, scaled 0.8, dead zone 24 px, full at 96 px; up climbs; invert flips', () => {
  assert.equal(stickAxes(0, -I.CLIMB_DEAD).climb, 0);
  assert.ok(near(stickAxes(0, -I.CLIMB_FULL).climb, I.CLIMB_X));
  assert.ok(near(stickAxes(0, I.CLIMB_FULL).climb, -I.CLIMB_X));
  assert.ok(near(stickAxes(0, -I.CLIMB_FULL, TUNE, true).climb, -I.CLIMB_X));
  // A steering thumb that wanders 20 px up or down never pitches the ship (drive.e2e checks the same live).
  for (const dy of [-20, -10, 0, 10, 20]) assert.equal(stickAxes(50, dy).climb, 0, `dy ${dy}`);
});

test('stick: the anchor follows a thumb that runs past the stick', () => {
  const full = I.STICK_FULL;
  assert.equal(follow(100, 140, full), 100, 'inside the reach it stays');
  assert.equal(follow(100, 100 + full * FOLLOW + 30, full), 130);
  assert.equal(follow(100, 100 - full * FOLLOW - 30, full), 70);
  // Back the other way: from full right, full left is one stick width away, not two.
  const anchor = follow(100, 300, full);
  assert.ok(stickAxes(300 - anchor, 0).steer === 1);
  assert.equal(stickAxes((anchor - full) - anchor, 0).steer, -1);
});

// A swipe: y from y0 to y1 over ms, sampled every 8 ms (a 120 Hz touch screen).
function swipe(flick, t0, y0, y1, ms) {
  let fired = 0;
  for (let t = 0; t <= ms; t += 8) {
    const y = y0 + (y1 - y0) * Math.min(1, t / ms);
    if (flick.move(t0 + t, y)) fired++;
  }
  return fired;
}

test('flick: 48 px up within 150 ms at 700 px/s fires once', () => {
  const f = createFlick();
  f.reset(0, 600);
  assert.equal(swipe(f, 0, 600, 530, 60), 1, '70 px in 60 ms');
});

test('flick: too slow, too short or downward does not fire', () => {
  let f = createFlick();
  f.reset(0, 600);
  assert.equal(swipe(f, 0, 600, 500, 400), 0, '100 px in 400 ms is a climb, not a flick');
  f = createFlick();
  f.reset(0, 600);
  assert.equal(swipe(f, 0, 600, 570, 30), 0, '30 px is short');
  f = createFlick();
  f.reset(0, 600);
  assert.equal(swipe(f, 0, 600, 700, 40), 0, 'down is not a flick');
  f = createFlick();
  f.reset(0, 600);
  assert.equal(swipe(f, 0, 600, 590, 50) + swipe(f, 1000, 590, 530, 200), 0, '60 px in 200 ms is under 700 px/s');
});

test('flick: one swipe is one burst; a second swipe fires again; possible() tracks an upward thumb', () => {
  const f = createFlick();
  f.reset(0, 600);
  assert.equal(swipe(f, 0, 600, 450, 100), 1, 'a long fast swipe still fires once');
  assert.equal(swipe(f, 300, 450, 520, 200), 0, 'thumb back down');
  assert.equal(swipe(f, 600, 520, 460, 50), 1, 'flick again');
  const g = createFlick();
  g.reset(0, 600);
  g.move(10, 590);
  assert.ok(g.possible(20));
  assert.ok(!g.possible(10 + I.FLICK_MS + 1));
  g.move(400, 610);
  assert.ok(!g.possible(405), 'moving down: no flick coming');
});

test('action: a tap fires on release, a hold does not; jolt is a restart at once', () => {
  const a = createAction();
  a.press(1000);
  assert.ok(a.down);
  assert.ok(near(a.held(1200), 0.2));
  assert.equal(a.release(1200), true, 'a 0.2 s press is a tap');
  a.press(2000);
  assert.ok(a.held(2400) >= TUNE.RACE.RESTART_HOLD, 'held long enough to restart');
  assert.equal(a.release(2400), false, 'a hold never also taps');
  assert.equal(a.held(2500), 0);
  a.jolt();
  assert.equal(a.held(3000), 0, 'held() only peeks');
  assert.ok(a.take(3000) > TUNE.RACE.RESTART_HOLD);
  assert.equal(a.take(3016), 0, 'one read only');
  assert.equal(a.release(5000), false, 'release with nothing pressed');
});

test('scheme: touch, keys and pad buttons switch; a mouse move or a pad stick never does', () => {
  assert.equal(nextSource(null, 'touch'), 'touch');
  assert.equal(nextSource('touch', 'key'), 'keys');
  assert.equal(nextSource('keys', 'mouseMove'), 'keys');
  assert.equal(nextSource('keys', 'padAxis'), 'keys');
  assert.equal(nextSource('keys', 'padButton'), 'pad');
  assert.equal(nextSource('pad', 'mouseMove'), 'pad');
  assert.equal(nextSource('pad', 'mouseButton'), 'pad', 'a click on the HUD keeps the pad');
  assert.equal(nextSource('keys', 'mouseButton', { mouseSteer: true }), 'mouse');
  assert.equal(nextSource(null, 'mouseButton'), 'keys');
  assert.equal(nextSource('touch', 'mouseButton'), 'keys');
  assert.equal(nextSource('mouse', 'key', { mouseSteer: true }), 'keys');
});

test('scheme: layout kind per source', () => {
  assert.equal(kindForSource('touch', 390, 844), 'portrait');
  assert.equal(kindForSource('touch', 844, 390), 'landscape');
  assert.equal(kindForSource('touch', 1366, 1024), 'landscape', 'a tablet still gets pedals');
  assert.equal(kindForSource('keys', 1440, 900), 'desktop');
  assert.equal(kindForSource('pad', 1024, 768), 'desktop');
  assert.equal(kindForSource('keys', 844, 390), 'landscape', 'a phone with a keyboard keeps the phone layout');
});

test('keys: WASD, arrows, R / F, Space, Shift, Q', () => {
  const k = keyAxes(new Set(['KeyD', 'KeyW', 'Space', 'ShiftLeft']));
  assert.deepEqual([k.steer, k.climb, k.gas, k.brake, k.drift, k.boost], [1, 0, 1, 0, true, true]);
  const j = keyAxes(new Set(['ArrowLeft', 'ArrowDown', 'KeyR', 'KeyQ']));
  assert.deepEqual([j.steer, j.climb, j.gas, j.brake, j.lookBack], [-1, 1, 0, 1, true]);
  assert.equal(keyAxes(new Set(['KeyA', 'KeyD'])).steer, 0, 'both cancel');
});

test('mouse steer: 3% dead zone, full at 25% of the width', () => {
  const w = 1440;
  assert.equal(mouseAxes(0.02 * w, 0, w).steer, 0);
  assert.equal(mouseAxes(0.25 * w, 0, w).steer, 1);
  assert.equal(mouseAxes(-0.3 * w, 0, w).steer, -1);
  assert.ok(mouseAxes(0, -0.25 * w, w).climb === 1, 'up climbs');
  assert.ok(mouseAxes(0, -0.25 * w, w, TUNE, true).climb === -1, 'invert');
});

const fakePad = (axes = [0, 0], pressed = {}) => ({
  axes, connected: true, index: 0,
  buttons: Array.from({ length: 17 }, (_, i) => ({ value: pressed[i] ?? 0, pressed: (pressed[i] ?? 0) > 0.5 })),
});

test('pad: radial dead zone 0.12 and expo; triggers analog; standard buttons', () => {
  assert.deepEqual([padAxes(fakePad([0.1, 0.05])).steer, padAxes(fakePad([0.1, 0.05])).climb], [0, 0]);
  assert.ok(near(padAxes(fakePad([1, 0])).steer, 1));
  assert.ok(near(padAxes(fakePad([0, -1])).climb, 1), 'stick up climbs');
  const half = padAxes(fakePad([0.56, 0]));
  assert.ok(near(half.steer, (0.44 / 0.88) ** TUNE.SHIP.EXPO, 1e-6));
  const b = padAxes(fakePad([0, 0], { [PAD.RT]: 0.6, [PAD.LT]: 0.25, [PAD.A]: 1, [PAD.B]: 1, [PAD.X]: 1, [PAD.START]: 1 }));
  assert.equal(b.gas, 0.6);
  assert.equal(b.brake, 0.25);
  assert.deepEqual([b.boost, b.drift, b.action, b.pause, b.map], [true, true, true, true, false]);
  assert.equal(padAxes(fakePad([0, 0], { [PAD.RB]: 1 })).boost, true, 'RB boosts too');
  assert.equal(padAxes(fakePad([0, 0], { [PAD.VIEW]: 1 })).map, true);
  assert.equal(padPressed(fakePad([1, 1])), false, 'a stick alone does not take over');
  assert.equal(padPressed(fakePad([0, 0], { [PAD.RT]: 0.2 })), false, 'a resting trigger does not');
  assert.equal(padPressed(fakePad([0, 0], { [PAD.A]: 1 })), true);
});

test('tilt: ±25° of roll is full steer, 2° dead zone, from the level set when turned on', () => {
  assert.equal(tiltSteer(11.5, 10), 0);
  assert.equal(tiltSteer(35, 10), 1);
  assert.equal(tiltSteer(-20, 10), -1);
  assert.ok(near(tiltSteer(23.5, 10), (13.5 - 2) / 23));
  assert.equal(tiltSteer(179, -179), 0, 'wraps round ±180');
  assert.equal(rollOf(12, 3, 90), 12);
  assert.equal(rollOf(12, 3, 270), -12);
  assert.equal(rollOf(12, 3, 0), 3);
});

test('pedals: rolling thumb across GAS, BRAKE and BOOST', () => {
  const L = layoutFor({ w: 390, h: 844, safe: { t: 47, b: 34 } });
  const c = (name) => [L.rects[name][0] + L.rects[name][2] / 2, L.rects[name][1] + L.rects[name][3] / 2];
  assert.equal(pedalAt(L, ...c('gas')), 'gas');
  assert.equal(pedalAt(L, ...c('brake')), 'brake');
  assert.equal(pedalAt(L, ...c('boost')), 'boost');
  // The gap between BRAKE and GAS keeps the last pedal; far away drops it.
  const gapX = L.rects.brake[0] + L.rects.brake[2] + 3, gapY = c('brake')[1];
  assert.equal(pedalAt(L, gapX, gapY, 'gas'), 'gas');
  assert.equal(pedalAt(L, 30, 400, 'gas'), null);
});

test('targets: hidden targets do not take touches; the steer area excludes showing targets only', () => {
  const L = layoutFor({ w: 390, h: 844, safe: { t: 47, b: 34 } });
  const [x, y] = [L.rects.chip[0] + 10, L.rects.chip[1] + 10];
  assert.equal(hitTarget(L, x, y), 'chip');
  assert.equal(hitTarget(L, x, y, new Set(['chip'])), null);
  assert.equal(canSteer(L, x, y), false);
  assert.equal(canSteer(L, x, y, new Set(['chip'])), true);
  assert.equal(canSteer(L, L.rects.gas[0] + 5, L.rects.gas[1] + 5), false, 'a pedal never starts the stick');
  assert.equal(canSteer(L, 100, 200), false, 'above the steer area');
});

// ---------------------------------------------------------------- the touch pipeline with fake pointers

function fakeEl() {
  const on = {};
  return {
    style: {},
    addEventListener(type, fn) { on[type] = fn; },
    removeEventListener(type) { delete on[type]; },
    setPointerCapture() {}, hasPointerCapture() { return false; }, releasePointerCapture() {},
    fire(type, e) { on[type]?.({ preventDefault() {}, pointerType: 'touch', button: 0, ...e, type }); },
  };
}

function rig(scheme = 'pedals', w = 390, h = 844) {
  const el = fakeEl();
  const L = layoutFor({ w, h, scheme, safe: h > w ? { t: 47, b: 34 } : { l: 47, r: 47, b: 21 } });
  const inp = createInput({ el, layout: L, settings: { scheme, autoDrift: true } });
  inp.context('drive');
  const c = (name) => [L.rects[name][0] + L.rects[name][2] / 2, L.rects[name][1] + L.rects[name][3] / 2];
  const down = (id, x, y, t) => el.fire('pointerdown', { pointerId: id, clientX: x, clientY: y, timeStamp: t });
  const move = (id, x, y, t) => el.fire('pointermove', { pointerId: id, clientX: x, clientY: y, timeStamp: t });
  const up = (id, x, y, t) => el.fire('pointerup', { pointerId: id, clientX: x, clientY: y, timeStamp: t });
  return { el, L, inp, c, down, move, up };
}

test('touch: a drag in the steer area steers and the source is touch; nothing pressed is cruise', () => {
  const { inp, down, move, L } = rig();
  let r = inp.read(0);
  assert.deepEqual([r.steer, r.gas, r.brake, r.drift, r.boost], [0, 0, 0, false, false]);
  down(1, 100, 650, 10);
  move(1, 100 + L.rects.boost[2], 650, 30);
  r = inp.read(40);
  assert.equal(r.source, 'touch');
  assert.ok(r.steer > 0.9, `steer ${r.steer}`);
  assert.equal(r.gas, 0, 'the stick is not gas in pedals');
  assert.equal(r.autoDrift, true, 'touch drifts on a hard turn');
});

test('touch: GAS raises, BRAKE brakes, BRAKE with a steer drifts until let go, pedals never steer', () => {
  const { inp, down, move, up, c } = rig();
  down(5, ...c('gas'), 0);
  let r = inp.read(10);
  assert.deepEqual([r.gas, r.steer], [1, 0], 'a pedal touch never steers');
  move(5, ...c('brake'), 20);
  r = inp.read(30);
  assert.deepEqual([r.gas, r.brake, r.drift], [0, 1, false], 'rolled from GAS onto BRAKE');
  down(1, 80, 600, 40);
  move(1, 80 + 60, 600, 50);
  r = inp.read(60);
  assert.equal(r.drift, true, 'BRAKE with a steer of 0.35 or more drifts');
  assert.equal(r.brake, 0, 'and does not brake');
  move(1, 80, 600, 70);
  r = inp.read(80);
  assert.equal(r.drift, true, 'the drift holds while BRAKE is held');
  up(5, ...c('brake'), 90);
  r = inp.read(100);
  assert.deepEqual([r.drift, r.brake], [false, 0]);
});

test('touch: BOOST holds the boost; a flick up on the stick is one burst and does not pitch', () => {
  const { inp, down, move, up, c } = rig();
  down(7, ...c('boost'), 0);
  assert.equal(inp.read(5).boost, true);
  up(7, ...c('boost'), 10);
  assert.equal(inp.read(15).boost, false);
  down(1, 120, 700, 100);
  let fired = 0, maxClimb = 0;
  for (let t = 0; t <= 64; t += 8) {
    move(1, 120, 700 - 80 * (t / 64), 100 + t);
    const r = inp.read(100 + t);
    if (r.boostBurst) fired++;
    maxClimb = Math.max(maxClimb, r.climb);
  }
  for (let t = 72; t < 300; t += 16) {
    const r = inp.read(100 + t);
    if (r.boostBurst) fired++;
    maxClimb = Math.max(maxClimb, r.climb);
  }
  assert.equal(fired, 1);
  assert.equal(maxClimb, 0, 'the flick re-centres the stick');
});

test('touch: a slow push up climbs, 120 ms late while a flick is possible', () => {
  const { inp, down, move } = rig();
  down(1, 120, 700, 0);
  let first = null;
  for (let t = 8; t <= 800; t += 8) {
    move(1, 120, 700 - Math.min(110, t * 0.25), t);
    const r = inp.read(t);
    if (first === null && r.climb > 0) first = t;
  }
  assert.ok(first !== null, 'it climbs');
  // The live climb passes the dead zone at 24 px (96 ms); the ship sees it PITCH_DELAY later.
  assert.ok(first >= 96 + I.PITCH_DELAY - 8, `first climb at ${first} ms`);
});

test('touch: only the newest finger in the steer area steers', () => {
  const { inp, down, move } = rig();
  down(1, 60, 600, 0);
  move(1, 60 + 80, 600, 10);
  assert.ok(inp.read(20).steer > 0.9);
  down(2, 240, 450, 30);
  assert.equal(inp.read(40).steer, 0, 'a new thumb takes over at its own centre');
  move(1, 60 - 100, 600, 50);
  assert.equal(inp.read(60).steer, 0, 'the old finger no longer steers');
});

test('touch: a hidden chip is steering space; a showing chip takes the touch', () => {
  const { inp, down, move, up, c } = rig();
  down(3, ...c('chip'), 0);
  move(3, c('chip')[0] + 60, c('chip')[1], 10);
  assert.ok(inp.read(20).steer > 0.9, 'no chip on screen: the thumb steers');
  up(3, c('chip')[0] + 60, c('chip')[1], 30);
  inp.show({ chip: true });
  down(4, ...c('chip'), 40);
  move(4, c('chip')[0] + 60, c('chip')[1], 50);
  assert.equal(inp.read(60).steer, 0, 'the chip takes it');
});

test('touch: the chip taps on a short press and holds to restart; radar and pause are taps', () => {
  const { inp, down, up, move, c } = rig();
  inp.show({ chip: true });
  down(3, ...c('chip'), 0);
  up(3, ...c('chip'), 120);
  assert.equal(inp.read(130).action, true);
  assert.equal(inp.read(140).action, false, 'an edge, once');
  down(3, ...c('chip'), 200);
  const held = inp.read(200 + 400);
  assert.ok(held.actionHeld >= TUNE.RACE.RESTART_HOLD, `held ${held.actionHeld}`);
  assert.ok(inp.state.actionHeld > 0 && inp.state.chipDown);
  up(3, ...c('chip'), 650);
  assert.equal(inp.read(660).action, false, 'a hold never taps');
  down(4, ...c('radar'), 700);
  up(4, ...c('radar'), 780);
  assert.equal(inp.read(790).map, true, 'a radar tap opens the map');
  down(4, ...c('radar'), 800);
  move(4, c('radar')[0] - 60, c('radar')[1], 820);
  up(4, c('radar')[0] - 60, c('radar')[1], 900);
  assert.equal(inp.read(910).map, false, 'a drag from the radar is not a tap');
  down(6, ...c('pause'), 1000);
  up(6, ...c('pause'), 1080);
  assert.equal(inp.read(1090).pause, true);
});

test('touch, one thumb: touch held is gas; a second finger brakes, or drifts with a steer', () => {
  const { inp, down, move, up } = rig('one-thumb');
  down(1, 150, 600, 0);
  let r = inp.read(10);
  assert.deepEqual([r.gas, r.brake], [1, 0]);
  down(2, 300, 300, 20);
  r = inp.read(30);
  assert.deepEqual([r.gas, r.brake, r.drift], [1, 1, false], 'second finger, no steer: brake');
  move(1, 150 + 70, 600, 40);
  r = inp.read(50);
  assert.deepEqual([r.drift, r.brake], [true, 0], 'with a steer: drift');
  up(2, 300, 300, 60);
  up(1, 220, 600, 70);
  r = inp.read(80);
  assert.deepEqual([r.gas, r.drift, r.steer], [0, false, 0], 'lift: cruise');
});

test('touch, landscape: the stick is under the left thumb, the pedals under the right', () => {
  const { inp, down, move, c, L } = rig('pedals', 844, 390);
  assert.equal(L.kind, 'landscape');
  down(1, 150, 280, 0);
  move(1, 150 - 70, 280, 10);
  down(2, ...c('gas'), 15);
  const r = inp.read(20);
  assert.ok(r.steer < -0.9);
  assert.equal(r.gas, 1);
});

test('held modes: paused and log pass only their edges, and clear held fingers', () => {
  const { inp, down, c } = rig();
  down(5, ...c('gas'), 0);
  assert.equal(inp.read(5).gas, 1);
  inp.context('paused');
  assert.equal(inp.read(10).gas, 0);
  assert.equal(inp.state.pointers, 0, 'fingers let go on pause');
  inp.context('drive');
  assert.equal(inp.read(20).gas, 0, 'a finger held through the pause does not press GAS again');
});
