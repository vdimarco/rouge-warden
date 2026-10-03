// Gentle tilt contracts: screen directions, recovery, and real ball flight.
// Run: node qa/lab/tilt.motion.sim.mjs
import assert from 'node:assert/strict';
import { createTiltControl, createTiltFilter } from '../../public/lab/tilt/motion.js';
import { createAdventure, currentSector, setAdventureTilt, TILT_ACCELERATION, updateAdventure } from '../../public/lab/tilt/adventure.js';
import { H } from '../../public/lab/tilt/physics.js';

const length = v => Math.hypot(v.x, v.y);
const near = (a, b, tolerance = 1e-9) => assert(Math.abs(a - b) <= tolerance, `${a} should be within ${tolerance} of ${b}`);
const zero = value => { near(value.x, 0); near(value.y, 0); };
function hold(filter, pose, start = 0, seconds = 1) {
  let value;
  for (let i = 0; i <= Math.round(seconds * 120); i++) {
    const time = start + i * 1000 / 120;
    filter.ingest({ ...pose, time });
    value = filter.sample(H, time);
  }
  return value;
}

{
  const filter = createTiltFilter();
  zero(filter.sample(H, 0));
  // A comfortable held angle is the center, rather than a demand to hold the phone flat.
  zero(hold(filter, { beta: 47, gamma: -8, angle: 0 }));
  zero(hold(filter, { beta: 47.5, gamma: -7.5, angle: 0 }, 1010));
  assert(filter.calibrated, 'a valid comfortable grip calibrates');
  const leaned = hold(filter, { beta: 47, gamma: 5, angle: 0 }, 2020);
  assert(leaned.x > 0.3 && Math.abs(leaned.y) < 0.001, 'a small right lean gently pulls right');
  filter.reset();
  zero(filter.sample(H, 3030));
  zero(hold(filter, { beta: 60, gamma: 19, angle: 0 }, 3030));
  console.log('ok: comfortable grip, hand jitter dead zone and explicit recenter');
}

{
  // These device poses describe the same screen-relative right/down lean in each rotation.
  const poses = [
    { angle: 0, right: [0, 12], down: [12, 0] },
    { angle: 90, right: [12, 0], down: [0, -12] },
    { angle: 180, right: [0, -12], down: [-12, 0] },
    { angle: 270, right: [-12, 0], down: [0, 12] },
  ];
  for (const { angle, right, down } of poses) {
    for (const [direction, [db, dg]] of [['right', right], ['down', down]]) {
      const filter = createTiltFilter();
      hold(filter, { beta: 35, gamma: 0, angle });
      const v = hold(filter, { beta: 35 + db, gamma: dg, angle }, 1010);
      assert(direction === 'right' ? v.x > 0.4 && Math.abs(v.y) < 0.001 : v.y < -0.4 && Math.abs(v.x) < 0.001,
        `${angle}° ${direction} lean follows the screen`);
    }
  }
  console.log('ok: portrait, upside-down and both landscape orientations have correct screen directions');
}

{
  const filter = createTiltFilter();
  hold(filter, { beta: 35, gamma: 0, angle: 0 });
  const first = hold(filter, { beta: 80, gamma: 65, angle: 0 }, 1010, 0);
  assert(length(first) > 0 && length(first) < 0.15, 'the first steep lean eases in instead of kicking the ball');
  const full = hold(filter, { beta: 80, gamma: 65, angle: 0 }, 1020);
  assert(length(full) > 0.95 && length(full) <= 1.000001, 'even a diagonal extreme lean stays within the circular cap');
  zero(filter.sample(H, 2700));
  assert(!filter.calibrated, 'a stale stream loses its old neutral');
  zero(hold(filter, { beta: 20, gamma: -20, angle: 0 }, 2800));
  const left = hold(filter, { beta: 20, gamma: -35, angle: 0 }, 3810);
  assert(left.x < -0.5, 'fresh readings work after sensor recovery');
  zero(hold(filter, { beta: 20, gamma: -35, angle: 90 }, 4820));
  assert.equal(filter.ingest({ beta: null, gamma: null, angle: 90, time: 5900 }), false);
  assert.equal(filter.ingest({ beta: NaN, gamma: Infinity, angle: 90, time: 5910 }), false);
  zero(filter.sample(H, 6500));
  console.log('ok: smoothing, circular cap, stale recovery, rotation recalibration and absent sensor values');
}

{
  // Device beta wraps at ±180. A tiny change across that seam must remain a tiny lean.
  const filter = createTiltFilter();
  hold(filter, { beta: 179.5, gamma: 0, angle: 0 });
  zero(hold(filter, { beta: -179.5, gamma: 0, angle: 0 }, 1010));
  console.log('ok: crossing the beta angle seam does not produce a gravity kick');
}

{
  const upright = createTiltFilter();
  hold(upright, { beta: 90, gamma: 0, angle: 0 });
  const tinyLean = hold(upright, { beta: 88, gamma: 90, angle: 0 }, 1010);
  assert(length(tinyLean) < 0.01, 'a two-degree upright phone lean stays tiny through the Euler singularity');
  const equivalent = createTiltFilter();
  hold(equivalent, { beta: 80, gamma: 89, angle: 0 });
  zero(hold(equivalent, { beta: 100, gamma: -89, angle: 0 }, 1010));
  console.log('ok: upright-phone singularities and equivalent orientation representations cannot kick the ball');
}

{
  assert.equal(TILT_ACCELERATION, 80);
  const run = createAdventure(8), p = currentSector(run).planet;
  const positions = [{ x: p.x - 230, y: p.y }, { ...currentSector(run).station }, { x: p.x + 850, y: p.y }];
  for (const point of positions) {
    setAdventureTilt(run);
    const base = run.table.gravity(point);
    setAdventureTilt(run, 12, -9);
    const tilted = run.table.gravity(point);
    near(Math.hypot(tilted.x - base.x, tilted.y - base.y), TILT_ACCELERATION, 0.0001);
    assert(tilted.x > base.x && tilted.y < base.y, 'gravity gets a small additive lean in the requested direction');
    setAdventureTilt(run);
    assert.deepEqual(run.table.gravity(point), base, 'off restores identical original gravity');
  }
  setAdventureTilt(run, NaN, Infinity);
  assert(Number.isFinite(length(run.table.gravity(positions[0]))), 'invalid sensor values cannot poison ball physics');

  const flyby = tilt => {
    const shot = createAdventure(8), planet = currentSector(shot).planet;
    Object.assign(shot.world.ball, { x: planet.x - 230, y: planet.y, vx: 0, vy: 600, live: true, lane: false });
    shot.phase = 'play';
    setAdventureTilt(shot, tilt, 0);
    for (let i = 0; i < 60; i++) {
      updateAdventure(shot, H);
      assert.equal(shot.events.length, 0, 'the measured flyby stays clear of collisions and game events');
    }
    return shot;
  };
  const plain = flyby(0), leaned = flyby(1), same = flyby(0);
  assert.deepEqual(plain.world.ball, same.world.ball, 'switching tilt off preserves deterministic existing flight');
  const drift = leaned.world.ball.x - plain.world.ball.x;
  assert(drift > 4 && drift < 25, `half a second of full lean makes a small measurable drift (${drift.toFixed(2)} world units)`);
  assert.equal(leaned.phase, 'play');
  assert(Math.hypot(leaned.world.ball.vx - plain.world.ball.vx, leaned.world.ball.vy - plain.world.ball.vy)
    < 0.1 * Math.hypot(plain.world.ball.vx, plain.world.ball.vy), 'the original planetary flyby still dominates the shot');
  console.log(`ok: additive force capped at ${TILT_ACCELERATION}, identical off physics, small real-flight drift ${drift.toFixed(2)}`);
}

{
  // Exercise the actual permission/listener boundary with a controllable clock.
  // This fake browser cannot move the ball or set the controller's internal state.
  const originalWindow = globalThis.window;
  let time = 0, requests = 0, nextTimer = 0;
  const timers = new Map(), orientationListeners = new Set();
  class Target extends EventTarget {
    addEventListener(type, listener, options) {
      if (this === win && type === 'deviceorientation') orientationListeners.add(listener);
      super.addEventListener(type, listener, options);
    }
    removeEventListener(type, listener, options) {
      if (this === win && type === 'deviceorientation') orientationListeners.delete(listener);
      super.removeEventListener(type, listener, options);
    }
  }
  const win = new Target(), doc = new EventTarget();
  Object.assign(win, { document: doc, performance: { now: () => time }, isSecureContext: true,
    screen: { orientation: Object.assign(new EventTarget(), { angle: 0 }) },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: time + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    DeviceOrientationEvent: class { static requestPermission() { requests++; return Promise.resolve('granted'); } },
  });
  doc.hidden = false;
  globalThis.window = win;
  const reading = (beta, gamma) => {
    time += 16;
    win.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma }));
  };
  const advance = milliseconds => {
    time += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.callback(); }
  };
  try {
    const control = createTiltControl();
    assert.equal(control.state, 'off');
    assert.equal(requests, 0);
    const enabling = control.enable();
    assert.equal(requests, 1, 'the request runs synchronously inside the enabling user gesture');
    assert.equal(control.enable(), enabling, 'two taps share one pending permission request');
    await enabling;
    assert.equal(orientationListeners.size, 1);
    reading(45, 0); zero(control.sample(H));
    for (let i = 0; i < 60; i++) { reading(45, 20); control.sample(H); }
    assert(control.sample(H).x > 0.5);
    control.suspend(); zero(control.sample(H));
    reading(60, -20); zero(control.sample(H));
    control.resume(); reading(60, -20); zero(control.sample(H));
    assert.equal(control.state, 'on');
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); zero(control.sample(H));
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    reading(30, 15); zero(control.sample(H));
    control.disable();
    assert.equal(control.state, 'off');
    assert.equal(orientationListeners.size, 0, 'off detaches the device sensor listener');
    reading(20, 40); zero(control.sample(H));

    let resolvePermission;
    win.DeviceOrientationEvent.requestPermission = () => new Promise(resolve => { resolvePermission = resolve; });
    const race = createTiltControl(), pending = race.enable();
    race.disable(); resolvePermission('granted'); await pending;
    assert.equal(race.state, 'off');
    assert.equal(orientationListeners.size, 0, 'late permission completion cannot re-enable tilt');

    win.DeviceOrientationEvent.requestPermission = () => Promise.resolve('denied');
    const denied = createTiltControl(); await denied.enable();
    assert.equal(denied.state, 'denied'); zero(denied.sample(H));
    assert.equal(orientationListeners.size, 0);
    win.DeviceOrientationEvent.requestPermission = () => Promise.resolve('granted');
    const silent = createTiltControl(); await silent.enable(); advance(4100);
    assert.equal(silent.state, 'unavailable'); zero(silent.sample(H));
    assert.equal(orientationListeners.size, 0);
    console.log('ok: opt-in permission, duplicate taps, pause/background reset, disable races, denial and silent hardware');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
}
