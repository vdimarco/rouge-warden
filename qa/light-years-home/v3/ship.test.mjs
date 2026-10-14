// Light Years Home v3: the flight model (final.md 18.1, handling §12). The twelve handling checks on core/ship.js, with
// S_CRUISE 24 (decisions.md 3): cruise to 28.5 u/s on gas is 1.85 s, and full steer at cruise turns 180° in about
// 2.1 s (it was 1.9 s at 20 u/s).
// node qa/light-years-home/v3/ship.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNE } from '../../../public/light-years-home/core/tune.js';
import { createShip, stepShip, shipForward, addBar, setSpeed, stepTow } from '../../../public/light-years-home/core/ship.js';
import { createEventBuffer } from '../../../public/light-years-home/core/events.js';
import { createGame, step, wire, unwire } from '../../../public/light-years-home/core/game.js';
import { FLIGHT } from '../../../public/light-years-home/core/ship.js';
import { hashState } from '../../../public/light-years-home/core/hash.js';

const h = 1 / 120;
const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ctxOf = (over = {}) => ({ tune: TUNE, t: 0, zoneT: 0, frameU: [0, 0, 1], settings: { assists: 'cruise' }, ...over });

// Step a lone ship (no zone, no traffic) until cond(ship) or max seconds; returns the time taken.
function until(ship, ctx, input, cond, max = 20, ev = null) {
  let t = 0;
  while (!cond(ship) && t < max) {
    ctx.t += h;
    stepShip(ship, typeof input === 'function' ? input(ship, t) : input, ctx, h, ev);
    t += h;
  }
  return t;
}
const run = (ship, ctx, input, secs, ev = null) => until(ship, ctx, input, () => false, secs, ev);

test('0 to 95% of cruise (22.8 u/s) in 1.0 ± 0.1 s', () => {
  const s = createShip({ pos: [0, 0, 0], heading: 0, speed: 0 });
  const t = until(s, ctxOf(), {}, (q) => q.speed >= 0.95 * TUNE.SHIP.S_CRUISE);
  assert.ok(Math.abs(t - 1.0) <= 0.1, `took ${t.toFixed(2)} s`);
});

test('cruise to 28.5 u/s on gas: about 1.85 ± 0.2 s from 24 u/s (2.5 s from the old 20 u/s cruise)', () => {
  const s = createShip({ speed: TUNE.SHIP.S_CRUISE });
  const t = until(s, ctxOf(), { gas: 1 }, (q) => q.speed >= 28.5);
  assert.ok(Math.abs(t - 1.85) <= 0.2, `took ${t.toFixed(2)} s`);
});

test('brake 30 to 20 u/s in 0.6 ± 0.1 s, and to a stop in 1.2 ± 0.1 s', () => {
  // As in the handling sim: top to 20 u/s, then 20 u/s to a stop.
  const s = createShip({ speed: 30 });
  const c = ctxOf();
  const a = until(s, c, { brake: 1 }, (q) => q.speed <= 20);
  const b = until(s, c, { brake: 1 }, (q) => q.speed <= 0.01);
  assert.ok(Math.abs(a - 0.6) <= 0.1, `30 to 20 took ${a.toFixed(2)} s`);
  assert.ok(Math.abs(b - 1.2) <= 0.1, `20 to 0 took ${b.toFixed(2)} s`);
  // Braking is the only way under 6 u/s: let go and it drives off again.
  const t = until(s, c, {}, (q) => q.speed >= 0.95 * TUNE.SHIP.S_CRUISE);
  assert.ok(t <= 1.1, `back to cruise in ${t.toFixed(2)} s`);
});

test('full steer at cruise turns 180° in 2.1 ± 0.2 s (1.9 s at the old 20 u/s cruise)', () => {
  for (const source of ['pad', 'keys']) {
    const s = createShip({ speed: TUNE.SHIP.S_CRUISE });
    let turned = 0, prev = 0;
    const t = until(s, ctxOf(), { steer: 1, source }, (q) => {
      const a = Math.atan2(q.vel[0], q.vel[1]);
      turned += wrap(a - prev); prev = a;
      return turned >= Math.PI;
    });
    assert.ok(Math.abs(t - 2.1) <= 0.2, `${source}: 180° took ${t.toFixed(2)} s`);
    const radius = s.speed / (Math.PI / t);
    assert.ok(radius > 12 && radius < 20, `radius ${radius.toFixed(1)} u`);
  }
});

test('drift tiers at 0.88 / 1.68 / 2.48 ± 0.1 s with peak slip 45° to 60°', () => {
  const s = createShip({ speed: 30 });
  const c = ctxOf(), ev = createEventBuffer();
  const tiers = [];
  let peak = 0, t = 0, started = false;
  for (let i = 0; i < 2.7 * 120; i++) {
    ev.clear(); c.t += h; t += h;
    stepShip(s, { steer: 1, drift: true, gas: 1, source: 'pad' }, c, h, ev);
    for (let k = 0; k < ev.n; k++) {
      if (ev.list[k].type === 'driftStart') started = true;
      if (ev.list[k].type === 'driftTier') tiers.push(t);
    }
    peak = Math.max(peak, Math.abs(s.slip) / DEG);
  }
  assert.ok(started, 'the drift starts');
  assert.equal(tiers.length, 3, `tiers ${tiers}`);
  [0.88, 1.68, 2.48].forEach((want, i) => assert.ok(Math.abs(tiers[i] - want) <= 0.1, `tier ${i + 1} at ${tiers[i].toFixed(2)}`));
  assert.ok(peak >= 45 && peak <= 60, `peak slip ${peak.toFixed(1)}°`);
  // Steering against the drift only bends it: it never flips, and tier 1 still comes.
  const s2 = createShip({ speed: 30 });
  run(s2, c, { steer: 1, drift: true, gas: 1, source: 'pad' }, 0.1);
  run(s2, c, { steer: 0, drift: true, gas: 1, source: 'pad' }, 1.8);
  assert.ok(s2.drift.on && s2.drift.dir === 1 && s2.drift.tier >= 1, 'neutral steer holds the drift and charges it');
});

test('a tier 2 release peaks at 37 u/s or more and stays above top for 2.5 s', () => {
  const s = createShip({ speed: 30 });
  const c = ctxOf(), ev = createEventBuffer();
  until(s, c, { steer: 1, drift: true, gas: 1, source: 'pad' }, (q) => q.drift.tier >= 2);
  ev.clear();
  let peak = 0, above = 0;
  run(s, c, (q) => {
    peak = Math.max(peak, q.speed);
    if (q.speed > TUNE.SHIP.S_TOP + 0.5) above += h;
    return { gas: 1 };
  }, 4, ev);
  assert.ok(ev.list.slice(0, ev.n).some((e) => e.type === 'driftBoost' && e.tier === 2), 'a tier 2 drift-boost');
  assert.ok(peak >= 37, `peak ${peak.toFixed(1)} u/s`);
  assert.ok(above >= 2.5, `above top for ${above.toFixed(2)} s`);
});

// A scripted wall to hit: one static body in a zone of its own.
function wallZone(pos, rc) {
  return { id: 'test-wall', R: 700, band: 100, bodies: [{ id: 'rock', pos, r: rc, rc }], roads: [], swarms: [] };
}

function hitAt(angleDeg, speed) {
  unwire();
  wire(FLIGHT);
  // The ship heads north; a sphere sits ahead so the travel line meets its surface at angleDeg. It is under
  // PLANE.FLOOR_MIN_R, so the floor assist (which lifts shallow meetings off big bodies) stays out of it.
  const rc = 7;
  const off = rc + TUNE.COLLIDE.CAPSULE_R;
  const zone = wallZone([off * Math.cos(angleDeg * DEG), 40, 0], rc);
  const game = createGame({ seed: 1, zoneData: zone, mode: 'drive', at: [0, 40 - off * Math.sin(angleDeg * DEG) - 6, 0],
    heading: 0, speed });
  const ev = createEventBuffer();
  const out = { kind: null, after: 0, game, back: null };
  for (let i = 0; i < 4 * 120; i++) {
    ev.clear();
    step(game, { gas: speed > 24 ? 1 : 0, source: 'keys' }, ev);
    for (let k = 0; k < ev.n; k++) {
      const e = ev.list[k];
      if ((e.type === 'scrape' || e.type === 'crash') && !out.kind) { out.kind = e.type; out.before = e.speed; out.after = game.ship.speed; out.t = game.t; }
    }
    if (out.kind === 'crash' && out.back === null && game.ship.speed >= 0.95 * TUNE.SHIP.S_CRUISE) out.back = game.t - out.t;
  }
  return out;
}

test('a 20° scrape keeps 88%', () => {
  const r = hitAt(20, 30);
  assert.equal(r.kind, 'scrape');
  assert.ok(r.after >= 0.88 * r.before, `kept ${(r.after / r.before * 100).toFixed(0)}%`);
  const steep = hitAt(34, 30);
  assert.equal(steep.kind, 'scrape', 'just under 35° is still a scrape');
});

test('a head-on leaves at 6 u/s or more and is back to 95% of cruise within 1.6 s', () => {
  for (const speed of [14, 24, 30, 42]) {
    const r = hitAt(90, speed);
    assert.equal(r.kind, 'crash', `head-on at ${speed}`);
    assert.ok(r.after >= TUNE.COLLIDE.HEAD_FLOOR - 1e-9, `left at ${r.after.toFixed(1)} u/s`);
    assert.ok(r.back !== null && r.back <= 1.6, `back to cruise in ${r.back?.toFixed(2)} s`);
    const s = r.game.ship;
    assert.ok(s.flickerT >= 0 && s.stunT >= 0);
  }
  const big = hitAt(90, 42);
  assert.ok(big.game.stats.crashes === 1, 'one crash, no pinball');
});

test('flying straight out at boost: heading inward within 5 s, never past R + 120', () => {
  for (const R of [450, 700]) {
    const zone = { id: 'rim', R, band: 100 };
    for (const fight of [false, true]) {
      const s = createShip({ pos: [0, R - 20, 0], heading: 0, speed: 42, bar: 1 });
      const c = ctxOf({ zone });
      let maxR = 0, inward = null;
      run(s, c, (q, t) => {
        const r = Math.hypot(q.pos[0], q.pos[1]);
        maxR = Math.max(maxR, r);
        if (inward === null && q.vel[0] * q.pos[0] + q.vel[1] * q.pos[1] < 0) inward = t;
        // The fighter steers to keep its nose pointing straight out.
        const out = Math.atan2(q.pos[0], q.pos[1]);
        return { boost: true, steer: fight ? Math.max(-1, Math.min(1, 3 * wrap(out - q.yaw))) : 0, source: 'keys' };
      }, 12);
      assert.ok(inward !== null && inward <= 5, `R ${R}${fight ? ' fighting' : ''}: inward at ${inward}`);
      assert.ok(maxR < R + 120, `R ${R}${fight ? ' fighting' : ''}: reached R + ${(maxR - R).toFixed(0)}`);
    }
  }
});

test('pitch under 3° within 1.0 s of a release; bank under 2° within 0.6 s', () => {
  const s = createShip({ speed: 24 });
  const c = ctxOf();
  run(s, c, { climb: 1, source: 'pad' }, 2);
  assert.ok(s.pitch > 30 * DEG, 'full climb reaches the limit');
  const z = s.pos[2];
  const t = until(s, c, {}, (q) => Math.abs(q.pitch) < 3 * DEG);
  assert.ok(t <= 1.0, `pitch levelled in ${t.toFixed(2)} s`);
  run(s, c, {}, 2);
  assert.ok(Math.abs(s.pitch) < 0.01 * DEG, 'it settles level');
  assert.ok(s.pos[2] > z, 'and holds its new height');
  for (const input of [{ steer: 1, source: 'pad' }, { steer: -1, drift: true, source: 'keys' }]) {
    const b = createShip({ speed: 30 });
    run(b, c, input, 1.5);
    assert.ok(Math.abs(b.bank) > 20 * DEG, 'it banks in the turn');
    const tb = until(b, c, {}, (q) => Math.abs(q.bank) < 2 * DEG);
    assert.ok(tb <= 0.6, `bank levelled in ${tb.toFixed(2)} s`);
  }
});

test('junk input gives no NaN', () => {
  const junk = [{ steer: NaN, climb: Infinity, gas: -5, brake: 'x', drift: 'yes', boost: 1 }, { steer: 5, climb: -9 },
    null, undefined, {}, { steer: -Infinity, boostBurst: true, gas: NaN }, { steer: 1e308, climb: -1e308 }];
  const s = createShip({ speed: 24 });
  const c = ctxOf({ zone: { R: 450, band: 100 } });
  for (let i = 0; i < 6 * 120; i++) {
    c.t += h;
    stepShip(s, junk[i % junk.length], c, h, createEventBuffer());
  }
  const bad = [];
  const walk = (v, path) => {
    if (typeof v === 'number') { if (!Number.isFinite(v) && v !== -99) bad.push(path); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(s, 'ship');
  assert.deepEqual(bad, []);
  // Odd steps: zero, negative and huge h do nothing strange either.
  for (const hh of [0, -1, NaN]) stepShip(s, { steer: 1 }, c, hh, null);
  walk(s, 'ship');
  assert.deepEqual(bad, []);
});

test('same seed and inputs give the same hash', () => {
  unwire();
  wire(FLIGHT);
  const zone = { id: 'hash-zone', R: 450, band: 100, entry: { pos: [0, -100, 0], heading: 0, speed: 30 },
    bodies: [{ id: 'g', pos: [-30, 0, 0], r: 9, rc: 4.5, well: { rs: 14 }, skim: true }],
    roads: [{ id: 'r', kind: 'road', pts: [[0, -200, 0], [0, 0, 0], [50, 100, 0]], flow: 1, speed: 6, count: 40, tube: 8 }],
    swarms: [{ id: 's', count: 200, area: { r: 300 }, h: 30, size: [0.4, 1], drift: [1, 3] }] };
  const play = (seed) => {
    const g = createGame({ seed, zoneData: zone, mode: 'drive' });
    for (let i = 0; i < 20 * 120; i++) {
      const t = i / 120;
      step(g, { steer: Math.sin(t * 1.3), gas: t % 4 < 2 ? 1 : 0, drift: t % 5 > 3.5, boost: t % 7 > 6, source: 'keys' });
    }
    return hashState(g);
  };
  assert.equal(play(3), play(3));
  assert.notEqual(play(3), play(4), 'another seed makes other traffic');
});

test('helpers: shipForward, addBar, setSpeed and the tow line', () => {
  const s = createShip({ heading: 90, speed: 10 });
  const f = shipForward(s);
  assert.ok(Math.abs(f[0] - 1) < 1e-9 && Math.abs(f[1]) < 1e-9, 'heading 90 points along +x');
  assert.equal(addBar(s, 5), 1);
  assert.equal(addBar(s, -5), 0);
  setSpeed(s, 30);
  assert.ok(Math.abs(Math.hypot(...s.vel) - 30) < 1e-9 && s.speed === 30);
  // The tow: the load trails behind, swings wide in a turn and never goes past the hard limit.
  const ship = createShip({ pos: [0, 0, 0], heading: 0, speed: 20 });
  ship.tow = { actor: 'load', len: TUNE.TOW.LEN };
  const load = { id: 'load', pos: [0, -6, 0], vel: [0, 20, 0], yaw: 0, speed: 20 };
  const c = ctxOf();
  let maxD = 0;
  for (let i = 0; i < 6 * 120; i++) {
    c.t += h;
    stepShip(ship, { steer: i > 240 ? 1 : 0, gas: 1, source: 'pad' }, c, h, null);
    stepTow(ship, load, h, c);
    maxD = Math.max(maxD, Math.hypot(load.pos[0] - ship.pos[0], load.pos[1] - ship.pos[1]));
  }
  assert.ok(maxD <= TUNE.TOW.LIMIT_X * TUNE.TOW.LEN + 1e-6, `tether stretched to ${maxD.toFixed(1)} u`);
  assert.ok(maxD > TUNE.TOW.LEN, 'the load swings out past the rest length');
  assert.ok(ship.speed <= TUNE.SHIP.S_TOP * TUNE.TOW.TOP_X + 1, 'towing lowers top speed');
});

test('wells: a drift round a giant slings out; letting go toward the marked exit is a PERFECT SLING', () => {
  unwire();
  wire(FLIGHT);
  const giant = { id: 'giant', pos: [-48, -222, 0], r: 9, rc: 4.5, well: { rs: 14 }, skim: true };
  const zone = { id: 'sling-zone', R: 450, band: 100, bodies: [giant], roads: [], swarms: [] };
  // Pass the giant on the left at about 20 u, hold a hard left turn (touch, auto-drift) and let go after half a lap.
  const lap = (slingAt) => {
    const game = createGame({ seed: 1, zoneData: zone, mode: 'drive', at: [-28, -250, 0], heading: 0, speed: 26 });
    if (slingAt) game.zone.slingAt = slingAt;
    const ev = createEventBuffer();
    const got = {};
    let released = false;
    for (let i = 0; i < 5 * 120; i++) {
      ev.clear();
      const t = game.t;
      const turned = Math.abs(wrap(Math.atan2(game.ship.vel[0], game.ship.vel[1])));
      if (!released && t > 0.6 && game.ship.drift.tier >= 2 && turned > 2.8) released = true;
      step(game, released || t < 0.3 ? { source: 'touch', autoDrift: true } : { steer: -1, source: 'touch', autoDrift: true }, ev);
      for (let k = 0; k < ev.n; k++) got[ev.list[k].type] = ev.list[k];
    }
    return { game, got };
  };
  const plain = lap(null);
  assert.ok(plain.got.driftStart && plain.got.driftBoost, 'a drift and a drift-boost');
  assert.ok(plain.got.sling && plain.got.sling.body === 'giant', 'the release inside the well is a sling');
  assert.ok(plain.got.sling.turn >= Math.PI / 2);
  assert.equal(plain.got.perfectSling, undefined);
  const s0 = plain.got.driftBoost.speed;
  assert.ok(s0 > 30, `out at ${s0.toFixed(1)} u/s`);
  // The same lap with an exit marked straight ahead of the release (south): one tier more.
  const perfect = lap([-60, -600]);
  assert.ok(perfect.got.perfectSling, 'a PERFECT SLING');
  assert.ok(perfect.got.driftBoost.tier === Math.min(3, plain.got.driftBoost.tier + 1));
  // With the well switched off (an event's wellsOff) the same input is only a drift.
  const game = createGame({ seed: 1, zoneData: zone, mode: 'drive', at: [-28, -250, 0], heading: 0, speed: 26 });
  game.zone.wellsOff = ['giant'];
  const ev = createEventBuffer();
  let sling = 0;
  for (let i = 0; i < 4 * 120; i++) {
    ev.clear();
    step(game, game.t < 2.5 ? { steer: -1, source: 'touch', autoDrift: true } : { source: 'touch', autoDrift: true }, ev);
    sling += ev.count('sling');
  }
  assert.equal(sling, 0, 'no sling with the well off');
});
