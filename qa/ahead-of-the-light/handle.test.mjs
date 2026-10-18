// Ahead of the Light: handling (final.md 5, 6, 15.1 and 21.3). Replays hash the same; every scorch is warned 0.6 s
// ahead and every legal grab leaves 2.0 s; GOOD windows are ±150 ms or more; LET GO shows 0.4 s after the grab at the
// earliest and 0.25 s before a band's centre; burns, Oberth and dry clicks; the slingshot; takedowns; SLAM spills;
// gearUp's best; the input's tap, press and latch cancel; random input; and the step allocates nothing but events.
// node qa/ahead-of-the-light/handle.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TUNE, parseOverrides } from '../../public/ahead-of-the-light/core/tune.js';
import { createRace, stepRace, STEP, NO_INTENT } from '../../public/ahead-of-the-light/core/race.js';
import * as H from '../../public/ahead-of-the-light/core/handle.js';
import { createInput, gainAt } from '../../public/ahead-of-the-light/ui/input.js';
import { toyLeg } from '../../public/ahead-of-the-light/core/toy.js';
import { applyBuild } from '../../public/ahead-of-the-light/core/cards.js';
import { buildLeg } from '../../public/ahead-of-the-light/core/course/gen.js';
import { ROUTE } from '../../public/ahead-of-the-light/core/course/legs.js';
import { mulberry32 } from '../../public/light-years-home/core/rng.js';

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const EPS = 1e-9;
const still = parseOverrides('?drag=0&engine=0').tune;            // no drag and no engine: η changes only by events

// A frozen leg of these items (numbered in order), the gen.js shape.
function legOf(items, beats = 200, gateBeat = beats - 4) {
  const its = items.map((x, i) => Object.freeze({ id: i, piece: 'test', ...x }));
  return Object.freeze({ type: 'test', lane: null, seed: 1, beats, items: Object.freeze(its), sections: [],
    gate: { id: null, beat: gateBeat }, pickups: [], wells: [], labels: [], hash: 'test', report: { ok: true, errors: [] } });
}
// A race on that leg out of leg 1 (no soft start, no teaching whip) unless legNo says so.
function raceOf(items, { tune = TUNE, legNo = 1, beats, gateBeat } = {}) {
  const race = createRace({ leg: legOf(items, beats, gateBeat), tune });
  race.legNo = legNo;
  return race;
}
// Your cards on a race: their patches in race.tune (yours) and their hooks; the rivals keep `tune`.
function withBuild(race, build, tune = race.tune) {
  const B = applyBuild(build, tune);
  race.tune = B.tune;
  race.hooks = B.hooks;
  race.baseTune = tune;
  return race;
}
function rival(race, { id = 'pike', bearing = 0, ahead = 0, eta = null, fuel = 2, fuelCap = 4 } = {}) {
  const you = race.ships[0];
  const r = H.createShip({ id, kind: 'regular', type: id, bearing, eta: eta ?? you.eta, tune: race.tune,
    meters: { fuel, fuelCap } });
  r.dist = you.dist + ahead * H.bpsOf(you, race.tune);
  r.ai = { intent: { target: bearing, turn: 0, action: null, burn: false } };
  race.ships.push(r);
  return r;
}
const intentOf = (target = null, action = null, burn = false, turn = 0) => ({ target, turn, action, burn });
// Step n times; fn(i, race) gives your intent. Returns the events with the real time each step ended at.
function fly(race, n, fn = () => NO_INTENT) {
  const out = [];
  for (let i = 0; i < n && race.phase !== 'done'; i++) {
    for (const e of stepRace(race, { you: fn(i, race) }, STEP)) out.push({ ...e, real: race.real });
  }
  return out;
}
const types = (ev, ship = 'you') => ev.filter((e) => e.ship === ship).map((e) => e.type);
// Seconds before the well (item) is abreast of the ship.
const tTo = (race, item, ship = race.ships[0]) => (item.beat - ship.dist) / H.bpsOf(ship, race.tune);

// The allocation probe runs in a child with the gc exposed: a ship riding a rail in a rival's full wake with a burn
// ramping and a whip sweeping, PHASE HULL's cool-down running down, stepped through handle's own parts with the
// event buffer reused. Bytes a step, the best of six windows with no collector run. The child compiles on its main
// thread (--no-concurrent-recompilation): with background compiles, a busy machine delays the optimized code, and
// until it lands the step runs unoptimized and boxes its numbers (30 to 700 bytes a step), so on a loaded machine all
// six windows could miss it.
async function allocChild() {
  const { PerformanceObserver, performance } = await import('node:perf_hooks');
  const gc = globalThis.gc;
  // a slow sweep so PIKE's whip lasts the whole probe; no suction or skim gain, so no gear changes
  const T = { ...parseOverrides('?sweep0=1&sweep1=1&scorchwarn=0.01&suction=0&skim=0').tune, PHASE_HULL: 1 };
  const items = [{ kind: 'rail', beat: 1, end: 1e6, psi: 10, half: 1.5, omega: 0, breaks: [], skimBand: 6, skimX: 1 },
    { kind: 'well', beat: 12, psi: 0, size: 'landmark', exits: [] }];
  const race = raceOf(items, { beats: 1e6, tune: T });
  const you = race.ships[0];
  const lead = rival(race, { id: 'remora', bearing: 0, ahead: 0.3 });
  const pike = rival(race, { id: 'pike', bearing: 25, ahead: 0.0 });
  const intents = [intentOf(0), lead.ai.intent, pike.ai.intent];
  you.phaseCool = 1e6;                         // solid from a pass: the cool-down ticks every step
  const ev = race.events;
  race.win.hi = items.length;
  const step = (i) => {
    ev.length = 0;
    race.t += STEP; race.real += STEP;
    pike.ai.intent.action = !pike.whip && H.windowOpen(race, pike) ? 'down' : null;
    for (let k = 0; k < race.ships.length; k++) {
      const s = race.ships[k];
      H.steerShip(s, intents[k], STEP, T);
      H.stepHandle(race, s, intents[k], STEP, STEP, T);
      s.dist += H.bpsOf(s, T) * STEP;
    }
    for (let k = 0; k < race.ships.length; k++) {
      H.passCheck(race, race.ships[k], items[0], T, null);
      H.stepWell(race, race.ships[k], intents[k], STEP, T);
    }
    H.stepContact(race, STEP, T);
    if (i === 6000) { H.burn(race, you, T); H.burn(race, lead, T); }     // a burn's ramp each, side by side
  };
  for (let i = 0; i < 12000; i++) step(i);
  const stamps = [];
  const obs = new PerformanceObserver((list) => { for (const e of list.getEntries()) stamps.push(e.startTime); });
  obs.observe({ entryTypes: ['gc'] });
  const windows = [];
  for (let w = 0; w < 6; w++) {
    gc();
    const w0 = performance.now(), h0 = process.memoryUsage().heapUsed;
    let n = 0;
    for (let i = 0; i < 1200; i++) { step(12000 + w * 1200 + i); n += ev.length; }
    windows.push([w0, performance.now(), (process.memoryUsage().heapUsed - h0) / 1200, n]);
  }
  await new Promise((done) => setTimeout(done, 50));
  obs.disconnect();
  let best = Infinity;
  for (const [w0, w1, bytes, n] of windows) {
    if (!stamps.some((t) => t >= w0 && t <= w1) && n === 0) best = Math.min(best, bytes);
  }
  return { best, drafting: you.draft.lead === 'remora', skim: H.skimOf(you), whip: Boolean(pike.whip),
    phase: you.phaseCool > 0 && you.phaseCool < 1e6,
    windows: windows.map((w) => [Math.round(w[2] * 10) / 10, w[3]]) };
}

if (process.env.AOL_ALLOC_CHILD) {
  process.stdout.write(`ALLOC ${JSON.stringify(await allocChild())}\n`);
  process.exit(0);
}

test('core/handle.js exports its 18.4 API and imports in plain node', () => {
  const api = ['createShip', 'steerShip', 'passCheck', 'stepWell', 'stepContact', 'burn', 'hit', 'windowOf', 'exitsOf',
    'gearOf', 'stepHandle', 'skimOf', 'slamAim', 'windowOpen', 'sweepTime', 'angleAt', 'pressCost', 'wakeOf', 'bpsOf'];
  for (const name of api) assert.equal(typeof H[name], 'function', name);
  assert.equal(H.gearOf(1.0), 0);
  assert.equal(H.gearOf(1.4722), 1);
  assert.equal(H.gearOf(2.6467), 2);
  assert.equal(H.gearOf(4.9517), 4);
});

test('same seed and inputs give the same events (hash); another seed differs', () => {
  const items = [];
  for (let b = 6; b < 150; b += 2.5) items.push({ kind: 'knot', beat: b, psi: ((b * 37) % 120) - 60, half: 3 });
  items.push({ kind: 'rail', beat: 40, end: 60, psi: 90, half: 1.5, omega: 0, breaks: [], skimBand: 6, skimX: 1 });
  items.push({ kind: 'well', beat: 70, psi: -40, size: 'medium', exits: [100, -160] });
  items.push({ kind: 'gate', beat: 90, psi: 0, gap: 18, halves: [3.5, 3.5], pair: true });
  items.push({ kind: 'pickup', type: 'fuel', beat: 95, psi: 20, line: 10, slot: 'fuel' });
  items.sort((a, b) => a.beat - b.beat);
  const play = (seed) => {
    const race = raceOf(items);
    rival(race, { id: 'pike', bearing: 10, ahead: 0.4 });
    rival(race, { id: 'hound', bearing: -15, ahead: -0.2 });
    const rnd = mulberry32(seed);
    const ev = fly(race, 4000, (i) => {
      for (const s of race.ships.slice(1)) s.ai.intent.target = s.bearing + (rnd() - 0.5) * 30;
      return intentOf(race.ships[0].target + (rnd() - 0.5) * 40, rnd() < 0.01 ? 'down' : rnd() < 0.01 ? 'up' : null,
        rnd() < 0.003);
    });
    return { h: hash({ ev, ships: race.ships.map((s) => [s.bearing, s.eta, s.dist, s.fuel, s.chain]) }), n: ev.length };
  };
  const a = play(7), b = play(7), c = play(8);
  assert.ok(a.n > 50, `the run did things (${a.n} events)`);
  assert.equal(a.h, b.h);
  assert.notEqual(a.h, c.h);
});

// Grab a well from `off` degrees beside it (side +1: to its right) on the step its window centre passes, then do
// what hold(race, ship, i) says each step (true keeps holding). → { race, ev, grabAt }.
function whip(size, off, { exits = [150, -150], hold = () => true, tune = TUNE, legNo = 1, maxS = 6 } = {}) {
  const T = tune;
  const race = raceOf([{ kind: 'well', beat: 20, psi: 0, size, exits }], { tune: T, legNo });
  const you = race.ships[0];
  const well = race.leg.items[0];
  let grabAt = null;
  const ev = fly(race, Math.round(maxS * 120) + 2000, (i) => {
    const t = tTo(race, well);
    if (grabAt === null) {
      you.bearing = off; you.target = off;           // hold the grab point against the pull
      if (t <= STEP * H.bpsOf(you, T) / 2 + 1e-6 || t <= 0) { grabAt = race.real; return intentOf(off, 'down'); }
      return intentOf(off);
    }
    if (race.real - grabAt > maxS) return intentOf(null, 'up');
    return hold(race, you, i) ? NO_INTENT : intentOf(null, 'up');
  });
  return { race, ev, grabAt };
}

test('every scorch had a scorchWarn at least 0.6 s earlier; every legal grab leaves 2.0 s or more to a scorch', () => {
  // the sweep's timing for every size and every legal grab point, both clocks (the first whip's half speed too)
  for (const [size, w] of Object.entries(TUNE.WELLS)) {
    for (let a = w.core + TUNE.SHIP_HALF + 0.01; a <= w.reach; a += 0.25) {
      const scorchAt = 360 - a - w.core - TUNE.SHIP_HALF;
      for (const x of [1, TUNE.TEACH_SWEEP]) {
        const t = TUNE.LATCH_S + H.sweepTime(0, scorchAt, TUNE, x);
        assert.ok(t >= 2.0, `${size} grabbed ${a.toFixed(2)}° off: ${t.toFixed(3)} s to the scorch`);
      }
    }
  }
  // held to the end: the scorch comes, after its warning
  let scorches = 0;
  for (const [size, w] of Object.entries(TUNE.WELLS)) {
    for (const off of [w.core + TUNE.SHIP_HALF + 0.5, (w.core + w.reach) / 2, w.reach - 0.5]) {
      for (const side of [1, -1]) {
        const { ev, grabAt } = whip(size, side * off);
        const grab = ev.find((e) => e.type === 'grab');
        assert.ok(grab, `${size} ${side * off}: grabbed`);
        const warn = ev.find((e) => e.type === 'scorchWarn'), sc = ev.find((e) => e.type === 'scorch');
        assert.ok(warn && sc, `${size} ${side * off}: warned and scorched`);
        assert.ok(sc.real - warn.real >= TUNE.SCORCH_WARN - EPS, `warned ${(sc.real - warn.real).toFixed(3)} s ahead`);
        assert.ok(sc.real - grabAt >= 2.0 - STEP, `${size}: ${(sc.real - grabAt).toFixed(3)} s from press to scorch`);
        const after = ev.slice(ev.indexOf(sc));
        assert.ok(after.some((e) => e.type === 'hit' && e.cause === 'scorch'), 'a scorch is a hit');
        const rel = after.find((e) => e.type === 'release');
        assert.equal(rel.grade, 'WIDE');
        assert.equal(rel.gain, 0);
        assert.equal(rel.scorched, true);
        scorches++;
      }
    }
  }
  assert.equal(scorches, 24);
});

test('every generated well\'s GOOD window is ±150 ms or more', () => {
  const wells = [...toyLeg().items.filter((i) => i.kind === 'well')];
  for (const type of ROUTE) {
    for (let seed = 1; seed <= 5; seed++) {
      try { for (const it of buildLeg({ runSeed: seed, type }).items) if (it.kind === 'well') wells.push(it); } catch { /* WP2 */ }
    }
  }
  assert.ok(wells.length >= 1);
  let checked = 0;
  for (const it of wells) {
    const w = TUNE.WELLS[it.size];
    for (const off of [w.core + TUNE.SHIP_HALF + 0.5, w.reach]) {
      for (const side of [1, -1]) {
        const b0 = it.psi + side * off, scorchAt = 360 - off - w.core - TUNE.SHIP_HALF;
        for (const e of it.exits) {
          const d = ((((e - b0) % 360) + 540) % 360) - 180;                  // wrap(e − b0)
          const aE = (((side * d) % 360) + 360) % 360;
          if (!(aE < scorchAt)) continue;
          for (const x of [1, TUNE.TEACH_SWEEP]) {
            const half = (TUNE.EXIT_W / 2) * (x < 1 ? TUNE.TEACH_WIN : 1);
            const before = H.sweepTime(Math.max(0, aE - half), aE, TUNE, x), after = H.sweepTime(aE, aE + half, TUNE, x);
            assert.ok(Math.min(before, after) >= 0.15 - EPS, `${it.name || it.id}: ±${(Math.min(before, after) * 1000).toFixed(0)} ms`);
            checked++;
          }
        }
      }
    }
  }
  assert.ok(checked >= 8, `${checked} bands checked`);
  // in play: a lift 140 ms either side of a band's centre (judged 50 ms before the lift) is still GOOD
  for (const err of [-0.14, 0.14]) {
    const { ev } = whip('medium', 20, { exits: [150, -150], hold: (race, you) => {
      const W = you.whip;
      if (!W) return false;
      const aE = W.exitA[0];
      const t = race.real - (W.t - TUNE.LATCH_S);                 // when the sweep began
      return race.real < t + H.sweepTime(0, aE) + TUNE.LIFT_COMP + err;
    } });
    const rel = ev.find((e) => e.type === 'release');
    assert.ok(rel && rel.grade !== 'WIDE', `a lift ${err * 1000} ms off is ${rel && rel.grade}`);
  }
});

test('LET GO never shows within 0.4 s of a grab and shows 0.25 s (±1 step) before a band\'s centre', () => {
  let seen = 0;
  for (const aE of [40, 60, 90, 130, 180, 230]) {
    for (const size of ['small', 'medium', 'landmark']) {
      const w = TUNE.WELLS[size], off = w.core + TUNE.SHIP_HALF + 4;
      const exit = off + aE;                                  // side +1 sweeps up from b0 = +off
      if (aE >= 360 - off - w.core - TUNE.SHIP_HALF) continue;
      let centreAt = null;
      const { ev, grabAt } = whip(size, off, { exits: [exit], maxS: 3, hold: (race, you) => {
        if (centreAt === null && you.whip && you.whip.angle >= aE) centreAt = race.real;
        return centreAt === null || race.real < centreAt + 0.2;
      } });
      const lg = ev.find((e) => e.type === 'letgo');
      assert.ok(lg, `${size} ${aE}°: LET GO showed`);
      assert.ok(lg.real - grabAt >= TUNE.LETGO_MIN - EPS, `${size} ${aE}°: ${(lg.real - grabAt).toFixed(3)} s after the grab`);
      const ahead = centreAt - lg.real;
      if (centreAt - grabAt - TUNE.LETGO_MIN >= TUNE.LETGO_LEAD + STEP) {
        assert.ok(Math.abs(ahead - TUNE.LETGO_LEAD) <= STEP + EPS, `${size} ${aE}°: ${ahead.toFixed(4)} s before the centre`);
      } else {
        assert.ok(lg.real - grabAt <= TUNE.LETGO_MIN + STEP + EPS, `${size} ${aE}°: the 0.4 s rule binds`);
      }
      seen++;
    }
  }
  assert.ok(seen >= 15);
});

test('a burn adds 0.4 up to 2.6 and never lights HEADLIGHT; an Oberth burn adds 0.8; with no fuel, dry and nothing else', () => {
  // +0.4 over 0.3 s
  let race = raceOf([], { tune: still });
  const you = race.ships[0];
  let ev = fly(race, 60, (i) => intentOf(null, null, i === 0));
  assert.ok(Math.abs(you.eta - 1.4) < EPS, `η ${you.eta}`);
  assert.equal(you.fuel, TUNE.FUEL0 - 1);
  assert.deepEqual(types(ev), ['burn']);
  // capped at 2.6, never HEADLIGHT, however many cells
  race = raceOf([], { tune: still });
  const s2 = race.ships[0];
  s2.eta = 2.4; s2.fuel = 6; s2.fuelCap = 6;
  ev = fly(race, 600, (i) => intentOf(null, null, i % 50 === 0));
  assert.ok(Math.abs(s2.eta - 2.6) < EPS, `η ${s2.eta}`);
  assert.equal(s2.headlight, false);
  assert.ok(!ev.some((e) => e.type === 'headlight' || (e.type === 'gearUp' && e.gear >= 2)));
  assert.equal(s2.fuel, 0, 'every burn spends its cell');
  // with no fuel: a dry click and nothing else
  race = raceOf([], { tune: still });
  const s3 = race.ships[0];
  s3.fuel = 0;
  ev = fly(race, 60, (i) => intentOf(null, null, i === 3));
  assert.deepEqual(types(ev), ['dry']);
  assert.equal(ev[0].why, 'fuel');
  assert.equal(s3.eta, 1.0);
  // a second burn during the ramp queues and fires as the first ends
  race = raceOf([], { tune: still });
  const s4 = race.ships[0];
  ev = fly(race, 120, (i) => intentOf(null, null, i === 0 || i === 10));
  assert.deepEqual(types(ev).filter((x) => x !== 'gearUp'), ['burn', 'burn']);
  assert.ok(Math.abs(s4.eta - 1.8) < EPS);
  assert.ok(ev[1].real - ev[0].real >= TUNE.BURN_S - STEP, 'the second waits for the first');
  // Oberth: a burn past 150° in a whip adds 0.8, with no cap (from 2.5 it passes 2.6)
  const r6 = raceOf([{ kind: 'well', beat: 20, psi: 0, size: 'large', exits: [] }], { tune: still });
  const y6 = r6.ships[0];
  y6.eta = 2.5;
  let pressed = false, before = null, burnt = false;
  const e6 = fly(r6, 1500, () => {
    if (!pressed) {
      y6.bearing = y6.target = 25;
      if (tTo(r6, r6.leg.items[0]) <= 0.004) { pressed = true; return intentOf(25, 'down'); }
      return intentOf(25);
    }
    if (y6.whip && y6.whip.angle >= 160 && !burnt) { burnt = true; before = y6.eta; return intentOf(null, null, true); }
    if (burnt && r6.real > 0 && y6.whip && y6.burn.t === 0 && before !== null) {
      assert.ok(Math.abs(y6.eta - (before + TUNE.OBERTH_ETA)) < EPS, `Oberth: ${before} → ${y6.eta}`);
      before = null;
    }
    return NO_INTENT;
  });
  assert.ok(e6.some((e) => e.type === 'oberth'), 'an Oberth burn');
  assert.equal(before, null, 'checked after the ramp');
});

test('a rival 0.3 s ahead, held in the wake 1.0 s then left, gives a slingshot', () => {
  const race = raceOf([], { tune: still });
  const you = race.ships[0];
  rival(race, { id: 'remora', bearing: 0, ahead: 0.3 });
  const ev = fly(race, 240, (i) => intentOf(i < 120 ? 0 : 16));
  const sl = ev.find((e) => e.type === 'slingshot');
  assert.ok(ev.find((e) => e.type === 'wake' && e.ship === 'you' && e.lead === 'remora'));
  assert.ok(ev.find((e) => e.type === 'drafted' && e.ship === 'remora' && e.by === 'you'));
  assert.ok(ev.find((e) => e.type === 'draftFull'), 'the draft filled in 1.0 s');
  assert.ok(sl, 'a slingshot');
  assert.ok(Math.abs(sl.charge - 1) < EPS);
  assert.ok(Math.abs(sl.gain - TUNE.SLING_ETA) < EPS);
  assert.equal(you.stats.slings, 1);
  assert.ok(you.eta > 1 + TUNE.SLING_ETA - 0.01, `η ${you.eta}`);
  // the surge: × SLING_SURGE course speed for SLING_S, then back
  assert.equal(you.surge.x, 1, 'the surge has ended by the end of the flight');
  // too soon out of the wake (charge under SLING_MIN): no slingshot
  const r2 = raceOf([], { tune: still });
  rival(r2, { id: 'remora', bearing: 0, ahead: 0.3 });
  const ev2 = fly(r2, 240, (i) => intentOf(i < 40 ? 0 : 16));
  assert.ok(!ev2.some((e) => e.type === 'slingshot'));
  assert.ok(ev2.some((e) => e.type === 'shaken' && e.ship === 'remora'));
  // in the wake: the tow and no drag
  const r3 = raceOf([]);
  const y3 = r3.ships[0];
  y3.eta = 2.0;
  rival(r3, { id: 'remora', bearing: 0, ahead: 0.3, eta: 2.0 });
  fly(r3, 60, () => intentOf(0));
  assert.equal(y3.draft.lead, 'remora');
  assert.equal(y3.draft.tow, TUNE.TOW);
  assert.ok(y3.eta > 2.0, 'suction and no drag');
});

// You at `you` degrees, a rival abreast at `at` degrees; a flick toward it on step `when`. build: your cards (their
// patches and hooks). → events.
function slam({ you = 0, at = 20, knotAt = null, knotIn = 0.25, when = 30, fuel = [2, 2], cap = 4, flick = 60,
  build = null } = {}) {
  const race = raceOf(knotAt === null ? [] : [{ kind: 'knot', beat: 2 + 1.866 * (when / 120 + knotIn), psi: knotAt, half: 3.5 }],
    { tune: still });
  if (build) withBuild(race, build, still);
  const y = race.ships[0];
  y.bearing = y.target = you;
  y.fuel = fuel[0];
  y.fuelCap = cap;
  for (const s of race.ships) s.dist = 2;
  const r = rival(race, { id: 'pike', bearing: at, ahead: 0, fuel: fuel[1] });
  r.ai.intent.target = null;                              // it holds its line and does not steer back
  const ev = fly(race, 180, (i) => (i >= when ? intentOf(you + flick) : intentOf(you)));
  return { race, y, r, ev };
}

test('a shove through a knot\'s edge is a takedown, into open space is not', () => {
  const a = slam({ you: 0, at: 20, knotAt: 48 });
  const c = a.ev.find((e) => e.type === 'contact');
  assert.equal(c.kind, 'slam');
  assert.equal(c.by, 'you');
  const td = a.ev.find((e) => e.type === 'takedown');
  assert.ok(td, 'a takedown');
  assert.equal(td.by, 'you');
  assert.equal(td.victim, 'pike');
  assert.ok(a.ev.some((e) => e.type === 'hit' && e.ship === 'pike' && e.cause === 'takedown' && e.by === 'you'));
  assert.equal(a.y.stats.takedowns, 1);
  assert.equal(a.y.fuel, 2 + 1 + TUNE.TAKEDOWN_FUEL, 'the spilled cell and the takedown\'s');
  // the same slam into open space
  const b = slam({ you: 0, at: 20, knotAt: null });
  assert.ok(b.ev.some((e) => e.type === 'contact' && e.kind === 'slam'));
  assert.ok(!b.ev.some((e) => e.type === 'takedown' || e.type === 'hit'));
  // a knot it meets after the window is its own hit, not your takedown
  const d = slam({ you: 0, at: 20, knotAt: 48, knotIn: 0.9 });
  assert.ok(d.ev.some((e) => e.type === 'hit' && e.ship === 'pike' && e.cause === 'knot'));
  assert.ok(!d.ev.some((e) => e.type === 'takedown'));
  // the orange tick: slamAim sees the takedown before the flick
  const race = raceOf([{ kind: 'knot', beat: 2 + 1.866 * 0.2, psi: 48, half: 3.5 }], { tune: still });
  for (const s of race.ships) s.dist = 2;
  race.win.hi = race.leg.items.length;
  const r = rival(race, { id: 'pike', bearing: 20 });
  assert.ok(H.slamAim(race, race.ships[0], r, still), 'a knot past it');
  r.bearing = -20;
  assert.equal(H.slamAim(race, race.ships[0], r, still), null, 'shoved the other way');
});

test('a SLAM moves exactly one fuel cell', () => {
  const a = slam({ fuel: [2, 2] });
  assert.equal(a.r.fuel, 1);
  assert.equal(a.y.fuel, 3);
  const sp = a.ev.find((e) => e.type === 'spill');
  assert.deepEqual([sp.ship, sp.amount, sp.to, sp.taken], ['pike', 1, 'you', 1]);
  // a full rammer: the victim still spills its cell, and nobody takes it
  const b = slam({ fuel: [4, 2], cap: 4 });
  assert.equal(b.r.fuel, 1);
  assert.equal(b.y.fuel, 4);
  assert.equal(b.ev.find((e) => e.type === 'spill').taken, 0);
  // an empty victim spills nothing
  const c = slam({ fuel: [2, 0] });
  assert.ok(!c.ev.some((e) => e.type === 'spill'));
  assert.equal(c.y.fuel, 2);
  // a slow drift into it is a BUMP: both shoved apart, nothing lost
  const race = raceOf([], { tune: still });
  for (const s of race.ships) s.dist = 2;
  const y = race.ships[0];
  const r = rival(race, { id: 'pike', bearing: 12 });
  const ev = fly(race, 240, (i) => intentOf(Math.min(12, i * 0.5)));
  const c2 = ev.find((e) => e.type === 'contact');
  assert.equal(c2.kind, 'bump');
  assert.ok(!ev.some((e) => e.type === 'spill'));
  assert.deepEqual([y.fuel, r.fuel], [2, 2]);
});

test('a takedown counts for the whole TAKEDOWN_S after a SLAM, and a card\'s SLAM (MASS SHADOW) counts the same', () => {
  // knotIn: seconds after the flick that the knot passes PIKE (contact comes about 0.02 s after the flick)
  for (const knotIn of [0.3, 0.36, 0.41]) {
    const a = slam({ you: 0, at: 20, knotAt: 48, knotIn });
    const c = a.ev.find((e) => e.type === 'contact' && e.kind === 'slam');
    const td = a.ev.find((e) => e.type === 'takedown');
    assert.ok(td && td.by === 'you', `a knot ${knotIn} s after the flick: ${a.ev.map((e) => e.type).join(',')}`);
    assert.ok(td.t - c.t <= TUNE.TAKEDOWN_S + EPS);
    assert.ok(a.ev.some((e) => e.type === 'hit' && e.ship === 'pike' && e.cause === 'takedown'));
  }
  const late = slam({ you: 0, at: 20, knotAt: 48, knotIn: 0.5 });
  assert.ok(!late.ev.some((e) => e.type === 'takedown'), 'past TAKEDOWN_S it is PIKE\'s own hit');
  // a shove a card sets through shoveShip is a SLAM by you for the same window
  for (const knotIn of [0.2, 0.35]) {
    const race = raceOf([{ kind: 'knot', beat: 2 + 1.866 * knotIn, psi: 36, half: 3.5 }], { tune: still });
    for (const s of race.ships) s.dist = 2;
    race.win.hi = race.leg.items.length;
    const r = rival(race, { id: 'pike', bearing: 60 });
    r.ai.intent.target = null;
    race.ships[0].bearing = race.ships[0].target = -60;
    H.shoveShip(race, r, -1, 25, 'you', still, true);
    const ev = fly(race, 120, () => intentOf(-60));
    const td = ev.find((e) => e.type === 'takedown');
    assert.ok(td && td.by === 'you' && td.victim === 'pike', `card shove, knot at +${knotIn} s: ${types(ev, 'pike')}`);
  }
});

test('a rival rams with the rivals\' SLAM_V, you with yours (BATTERING PROW\'s 0 is yours alone)', () => {
  const prow = Object.freeze({ ...still, SLAM_V: 0 });
  const meet = (rammerId) => {
    const race = createRace({ leg: legOf([]), tune: prow, base: still });
    race.legNo = 1;
    const ram = rammerId === 'you' ? race.ships[0] : rival(race, { id: rammerId, bearing: 0 });
    if (rammerId !== 'you') race.ships[0].bearing = race.ships[0].target = 180;    // you are out of it
    const other = rival(race, { id: 'hound', bearing: 5 });
    for (const s of race.ships) { s.soft = false; s.dist = 2; s.turnRate = 0; }
    ram.turnRate = 150;                                    // closing at 150 °/s: under the base 200
    race.events = [];
    H.stepContact(race, STEP, race.tune);
    return race.events.find((e) => e.type === 'contact');
  };
  assert.equal(meet('pike').kind, 'bump', 'PIKE on HOUND at 150 °/s is a bump');
  assert.equal(meet('you').kind, 'slam', 'you on HOUND at 150 °/s is a SLAM with BATTERING PROW');
});

test('PHASE HULL: with the phase ready, the rival your hull touches flies through as a hairline that takes its fuel', () => {
  const card = [{ id: 'phase-hull', r: 0 }];
  const hairsOf = (ev) => ev.filter((e) => e.type === 'hair' && e.ship === 'you' && e.kind === 'rival');
  // your flick into PIKE: a SLAM that spills its cell without the card; with it you fly through PIKE, one hairline
  // and half its cell, and PIKE is not shoved
  assert.ok(slam().ev.some((e) => e.type === 'contact' && e.kind === 'slam'));
  const a = slam({ build: card });
  assert.ok(!a.ev.some((e) => e.type === 'contact'), types(a.ev, 'pike').join(','));
  assert.equal(a.r.shove, null, 'PIKE is not shoved');
  assert.equal(a.y.stats.slams, 0);
  assert.deepEqual(hairsOf(a.ev).map((e) => e.other), ['pike']);
  assert.ok(a.ev.some((e) => e.type === 'spill' && e.ship === 'pike' && e.by === 'phase-hull' && e.to === 'you'));
  assert.deepEqual([a.y.fuel, a.r.fuel], [2.5, 1.5]);
  assert.ok(a.y.phaseCool > 0 && !H.phaseReady(a.y, a.race.tune), 'the hull is solid after the pass');
  // PIKE flicks into you with a knot past you (you hold your line): its takedown on you without the card; with it
  // PIKE flies through you, you are not shoved and nothing hits you
  const flickIn = (build) => {
    const race = raceOf([{ kind: 'knot', beat: 2 + 1.866 * 0.5, psi: -28, half: 3.5 }], { tune: still });
    if (build) withBuild(race, build, still);
    for (const s of race.ships) s.dist = 2;
    const r = rival(race, { id: 'pike', bearing: 20 });
    const ev = fly(race, 180, (i) => { if (i === 30) r.ai.intent.target = -40; return intentOf(null); });
    return { ev, you: race.ships[0] };
  };
  const b0 = flickIn(null);
  assert.ok(b0.ev.some((e) => e.type === 'takedown' && e.victim === 'you' && e.by === 'pike'), types(b0.ev).join(','));
  const b = flickIn(card);
  assert.ok(!b.ev.some((e) => e.type === 'contact' || e.type === 'takedown'), types(b.ev).join(','));
  assert.equal(b.you.stats.hits, 0);
  assert.equal(b.you.shove, null, 'you are not shoved');
  assert.equal(hairsOf(b.ev).length, 1, 'PIKE passing through you is your hairline');
  // you overtake PIKE straight through it: a rear-end without the card; with it one hairline and half its cell
  const through = (build) => {
    const race = raceOf([], { tune: still });
    if (build) withBuild(race, build, still);
    const y = race.ships[0];
    y.eta = 2.0;
    y.fuel = 1;
    const r = rival(race, { id: 'pike', bearing: 0, ahead: 0.3, eta: 1.0, fuel: 2 });
    const ev = fly(race, 240, () => intentOf(0));
    return { ev, y, r };
  };
  const c0 = through(null);
  assert.ok(c0.ev.some((e) => e.type === 'contact' && e.kind === 'rear'), types(c0.ev).join(','));
  const c = through(card);
  assert.ok(c.y.dist > c.r.dist, 'you passed it');
  assert.ok(!c.ev.some((e) => e.type === 'contact'), types(c.ev).join(','));
  const hairs = hairsOf(c.ev);
  assert.equal(hairs.length, 1);
  assert.deepEqual([hairs[0].kind, hairs[0].other], ['rival', 'pike']);
  assert.deepEqual([c.y.fuel, c.r.fuel], [1.5, 1.5]);
  assert.ok(c.ev.some((e) => e.type === 'spill' && e.ship === 'pike' && e.by === 'phase-hull' && e.to === 'you'));
  // the rivals fly with the base tune: two rivals still touch each other
  const race = withBuild(raceOf([], { tune: still }), card, still);
  race.ships[0].bearing = race.ships[0].target = 180;
  const p = rival(race, { id: 'pike', bearing: 0 }), h = rival(race, { id: 'hound', bearing: 5 });
  for (const s of race.ships) { s.soft = false; s.dist = 2; s.turnRate = 0; }
  p.turnRate = 300;
  race.events = [];
  H.stepContact(race, STEP, race.tune);
  assert.equal(race.events.find((e) => e.type === 'contact').kind, 'slam', `${h.id} is slammed`);
});

test('PHASE HULL: the phase passes once; a touch inside PHASE_COOLDOWN is normal contact; then it is ready again', () => {
  const race = withBuild(raceOf([], { tune: still }), [{ id: 'phase-hull', r: 0 }], still);
  const T = race.tune, you = race.ships[0];
  assert.ok(T.PHASE_COOLDOWN >= 3 && T.PHASE_COOLDOWN <= 10, `PHASE_COOLDOWN ${T.PHASE_COOLDOWN}`);
  const p = rival(race, { id: 'pike', bearing: 40, fuel: 2 });
  for (const s of race.ships) { s.soft = false; s.dist = 2; s.turnRate = 0; }
  you.fuel = 1;
  // one step of contact with you flicking at 300 °/s (a SLAM without the card), PIKE at `at`°
  const touch = (at) => {
    p.bearing = at;
    you.turnRate = at === 5 ? 300 : 0;
    race.events = [];
    race.t += STEP;
    H.stepContact(race, STEP, T);
    return race.events.filter((e) => e.ship === 'you' || e.ship === 'pike').map((e) => `${e.type}:${e.kind || e.by || ''}`);
  };
  // apart for T s: the cool-down runs down
  const apart = (s) => { for (let t = 0; t < s - 1e-9; t += STEP) touch(40); };
  assert.ok(H.phaseReady(you, T));
  assert.deepEqual(touch(5), ['hair:rival', 'spill:phase-hull'], 'the pass');
  assert.equal(you.phaseCool, T.PHASE_COOLDOWN);
  assert.ok(!H.phaseReady(you, T));
  // still inside PIKE: you fly on through it, no contact, no second hairline
  assert.deepEqual(touch(5), []);
  apart(0.5);
  // a touch inside the cool-down is a normal SLAM: PIKE is shoved and spills its cell, which you take
  const fuel0 = you.fuel;
  assert.deepEqual(touch(5), ['contact:slam', 'spill:'], 'normal contact while solid');
  assert.ok(p.shove && p.shove.slam && p.shove.by === 'you');
  assert.deepEqual([you.fuel, p.fuel], [fuel0 + T.SPILL, 0.5], 'a SLAM\'s spill: one cell');
  assert.ok(Math.abs(you.phaseCool - (T.PHASE_COOLDOWN - 0.5 - 2 * STEP)) < 1e-6, `cool ${you.phaseCool}`);
  // the cool-down ends PHASE_COOLDOWN s after the pass, to the step
  p.shove = null;
  apart(T.PHASE_COOLDOWN - 0.5 - 3 * STEP);
  assert.ok(!H.phaseReady(you, T) && you.phaseCool <= STEP + 1e-9, `cool ${you.phaseCool}`);
  apart(STEP);
  assert.ok(H.phaseReady(you, T), `ready again: cool ${you.phaseCool}`);
  p.fuel = 1;
  assert.deepEqual(touch(5), ['hair:rival', 'spill:phase-hull'], 'the next pass');
  assert.equal(you.phaseCool, T.PHASE_COOLDOWN);
  // a new leg starts with the phase ready
  assert.equal(H.createShip({ id: 'you', kind: 'you', tune: T }).phaseCool, 0);
});

test('PHASE HULL: on the edge of contact after a pass, a hair apart is the same pass; clearly apart, they part', () => {
  // two ships at almost one speed sit on the edge of contact after a pass (z near CONTACT_Z, or a bearing gap near 0)
  // and drift a hair out and back in: you fly on through that ship with no contact, however long that lasts. Once
  // they are clearly apart (twice the contact depth, or a hairline between the hulls) they have parted, and a touch
  // while your hull is solid is normal contact
  const race = withBuild(raceOf([], { tune: still }), [{ id: 'phase-hull', r: 0 }], still);
  const T = race.tune, you = race.ships[0];
  const p = rival(race, { id: 'pike', bearing: 0, fuel: 2 });
  for (const s of race.ships) { s.soft = false; s.dist = 2; s.turnRate = 0; }
  // PIKE at `gap`° between the hulls (0 in your line), z s behind you (in your wake: the draft's events are left out)
  const at = (z, gap = null) => {
    p.dist = you.dist - z * H.bpsOf(p, T);
    p.bearing = gap === null ? 0 : you.half + p.half + gap;
    race.events = [];
    race.t += STEP;
    H.stepContact(race, STEP, T);
    return race.events.filter((e) => ['contact', 'hair', 'spill'].includes(e.type))
      .map((e) => `${e.type}:${e.kind || e.by || ''}`);
  };
  const IN = T.CONTACT_Z - 1e-4, OUT = T.CONTACT_Z + 1e-4, FAR = 2 * T.CONTACT_Z + 1e-3;
  assert.deepEqual(at(IN), ['hair:rival', 'spill:phase-hull'], 'the pass');
  for (const n of [1, 2, 5, 11, 60]) {
    for (let i = 0; i < n; i++) assert.deepEqual(at(OUT), []);
    assert.deepEqual(at(IN), [], `back in after ${n} steps a hair behind: the same pass`);
    for (let i = 0; i < n; i++) assert.deepEqual(at(IN, 0.2), []);
    assert.deepEqual(at(IN), [], `back in after ${n} steps a hair to the side: the same pass`);
  }
  assert.equal(p.shove, null, 'PIKE is not shoved');
  assert.equal(you.shove, null, 'you are not shoved');
  assert.ok(!H.phaseReady(you, T), 'still solid');
  // one step clearly behind: they parted, and this touch is a rear-end
  assert.deepEqual(at(FAR), []);
  assert.deepEqual(at(IN), ['contact:rear'], 'twice the contact depth apart: they parted');
  // the same for a hairline between the hulls, after a new pass with the phase ready again
  you.phaseCool = 0;
  p.shove = you.shove = null;
  race.t += 1;
  assert.deepEqual(at(FAR), []);
  assert.deepEqual(at(IN), ['hair:rival', 'spill:phase-hull'], 'the next pass');
  assert.deepEqual(at(IN, T.HAIR), []);
  assert.deepEqual(at(IN), ['contact:rear'], 'a hairline apart: they parted');
});

test('PHASE HULL: while your hull is solid, a rival SLAM on you is a takedown and a drafter clipping a knot is TRAPPED', () => {
  const card = [{ id: 'phase-hull', r: 0 }];
  // PIKE flicks into you with a knot past you, as above, but your hull is solid from a pass 1 s ago
  const race = raceOf([{ kind: 'knot', beat: 2 + 1.866 * 0.5, psi: -28, half: 3.5 }], { tune: still });
  withBuild(race, card, still);
  for (const s of race.ships) s.dist = 2;
  const you = race.ships[0];
  you.phaseCool = race.tune.PHASE_COOLDOWN - 1;
  const r = rival(race, { id: 'pike', bearing: 20 });
  const ev = fly(race, 180, (i) => { if (i === 30) r.ai.intent.target = -40; return intentOf(null); });
  assert.ok(ev.some((e) => e.type === 'contact' && e.kind === 'slam' && e.victim === 'you'), types(ev).join(','));
  assert.ok(ev.some((e) => e.type === 'takedown' && e.victim === 'you' && e.by === 'pike'), types(ev).join(','));
  assert.ok(!ev.some((e) => e.type === 'hair' && e.kind === 'rival'), 'no pass while solid');
});

test('TRAPPED: you draft PIKE, it skims a knot and you clip it; PHASE HULL ready makes that a plain hit, solid not', () => {
  // the knot at 9.5° (half 3): PIKE on 0° (half 3.5) passes it at a 3° gap; you on 4°, 0.3 s behind, hit it
  const trap = (build, solid = false) => {
    const race = raceOf([{ kind: 'knot', beat: 6.9, psi: 9.5, half: 3 }], { tune: still });
    const you = race.ships[0];
    you.dist = 5;
    you.bearing = you.target = 4;
    const r = rival(race, { id: 'pike', bearing: 0, ahead: 0.3 });
    if (build) withBuild(race, build, still);
    if (solid) you.phaseCool = race.tune.PHASE_COOLDOWN;      // a pass just now: the hull is solid
    const ev = fly(race, 720, () => intentOf(4));
    return { ev, you, r };
  };
  const a = trap(null);
  assert.ok(a.ev.some((e) => e.type === 'trapped' && e.ship === 'you' && e.by === 'pike'), types(a.ev).join(','));
  assert.ok(a.ev.some((e) => e.type === 'takedown' && e.victim === 'you' && e.by === 'pike' && e.trapped));
  assert.equal(a.ev.find((e) => e.type === 'hit' && e.ship === 'you').cause, 'trapped');
  assert.equal(a.r.stats.takedowns, 1);
  const b = trap([{ id: 'phase-hull', r: 0 }]);
  const h = b.ev.filter((e) => e.type === 'hit' && e.ship === 'you');
  assert.equal(h.length, 1, types(b.ev).join(','));
  assert.deepEqual([h[0].cause, h[0].by], ['knot', null]);
  assert.ok(!b.ev.some((e) => e.type === 'trapped' || e.type === 'takedown'), types(b.ev).join(','));
  assert.equal(b.r.stats.takedowns, 0);
  const c = trap([{ id: 'phase-hull', r: 0 }], true);
  assert.ok(c.ev.some((e) => e.type === 'trapped' && e.ship === 'you' && e.by === 'pike'), types(c.ev).join(','));
  assert.equal(c.ev.find((e) => e.type === 'hit' && e.ship === 'you').cause, 'trapped');
});

test('a knot crossed mid-whip pays a plain graze, not a hairline', () => {
  const items = [{ kind: 'well', beat: 20, psi: 0, size: 'landmark', exits: [150] }];
  const go = (extra) => {
    const race = raceOf([...items, ...extra], { tune: still });
    const you = race.ships[0], well = race.leg.items[0];
    you.dist = 18;
    let grabbed = false, at21 = null;
    const ev = fly(race, 600, () => {
      if (you.dist >= 21 && at21 === null) at21 = you.bearing;
      if (grabbed || you.whip) { grabbed = true; return NO_INTENT; }
      you.bearing = you.target = 20;
      return intentOf(20, tTo(race, well) <= 0.01 ? 'down' : null);
    });
    return { ev, at21 };
  };
  const { at21 } = go([]);
  assert.ok(Number.isFinite(at21), 'the sweep reaches beat 21');
  const { ev } = go([{ kind: 'knot', beat: 21, psi: at21, half: 3 }]);
  const k = ev.find((e) => (e.type === 'graze' || e.type === 'hair') && e.kind === 'knot');
  assert.ok(k, `the knot: ${types(ev).join(',')}`);
  assert.equal(k.type, 'graze');
  assert.equal(k.gap, still.HAIR);
});

test('a gate the whip carries you across is judged at the release (SLINGSHOT HOME): a thread in its gap', () => {
  // a landmark well 1 beat before a gate; a lift as the bearing passes liftAt
  const go = (gatePsi, liftAt) => {
    const race = raceOf([{ kind: 'well', beat: 20, psi: 0, size: 'landmark', exits: [105] },
      { kind: 'gate', beat: 21, psi: gatePsi, gap: 26, halves: [12, 12], names: ['A', 'B'],
        dock: { psi: gatePsi + 90, w: 20 } }], { tune: still });
    const you = race.ships[0], well = race.leg.items[0];
    you.dist = 18;
    let grabbed = false;
    const ev = fly(race, 600, () => {
      if (you.whip) grabbed = true;
      if (grabbed) return you.whip && you.bearing >= liftAt ? intentOf(null, 'up') : NO_INTENT;
      you.bearing = you.target = 20;
      return intentOf(20, tTo(race, well) <= 0.01 ? 'down' : null);
    });
    return { you, ev };
  };
  const a = go(105, 120);                                  // let go on the line: PERFECT, and through the gap
  const rel = a.ev.find((e) => e.type === 'release');
  assert.equal(rel.grade, 'PERFECT');
  const th = a.ev.find((e) => e.type === 'thread' && !e.pair);
  assert.ok(th && !th.miss, types(a.ev).join(','));
  assert.equal(a.you.gate, 'thread');
  assert.ok(a.ev.indexOf(th) > a.ev.indexOf(rel), 'judged at the release');
  const b = go(95, 120);                                   // the release bearing sits on a giant: a fly past, no hit
  assert.ok(b.ev.some((e) => e.type === 'past'), types(b.ev).join(','));
  assert.ok(!b.ev.some((e) => e.type === 'hit'));
  assert.equal(b.you.gate, 'past');
});

test('a gate the whip carried you across, still unjudged when the leg ends mid-whip, is a fly past and pays its push-back', () => {
  // the gate line at beat 21 and the leg's end 1.5 beats on, so a held whip from the well at 20 outlasts the leg
  const race = raceOf([{ kind: 'well', beat: 20, psi: 0, size: 'landmark', exits: [105] },
    { kind: 'gate', beat: 21, psi: 105, gap: 26, halves: [12, 12], names: ['A', 'B'], dock: { psi: 195, w: 20 } }],
  { tune: still, beats: 22.5, gateBeat: 21 });
  const you = race.ships[0], well = race.leg.items[0];
  you.dist = 18;
  you.gap = 3;
  let grabbed = false;
  const ev = fly(race, 900, (i, r) => {
    if (you.whip) grabbed = true;
    if (grabbed) return NO_INTENT;                          // held: no lift before the leg ends
    you.bearing = you.target = 20;
    return intentOf(20, tTo(r, well) <= 0.01 ? 'down' : null);
  });
  const end = ev.find((e) => e.type === 'legEnd');
  assert.ok(end && end.why === 'gate', types(ev).join(','));
  assert.ok(you.whip && !ev.some((e) => e.type === 'release'), 'the leg ended mid-whip');
  const past = ev.find((e) => e.type === 'past' && e.ship === 'you');
  assert.ok(past, `a fly past: ${types(ev).join(',')}`);
  assert.equal(you.gate, 'past');
  const push = ev.find((e) => e.type === 'push' && e.ship === 'you' && e.from === 'past');
  assert.ok(push && Math.abs(push.amount - still.PB_PAST * still.MASS_K[1]) < EPS, 'the fly past pays PB_PAST x M');
  assert.ok(ev.indexOf(past) < ev.indexOf(end), 'paid before the leg ends');
  assert.equal(you.whip.gate, null);
});

test('forceRelease (KICK OUT) is a PERFECT release that pays the race\'s RED_X in the red zone', () => {
  const run = (redX) => {
    const T = Object.freeze({ ...still, RED_X: redX });
    const race = raceOf([{ kind: 'well', beat: 20, psi: 0, size: 'landmark', exits: [] }], { tune: T });
    const you = race.ships[0], well = race.leg.items[0];
    you.dist = 18;
    let rel = null;
    fly(race, 1200, () => {
      if (rel) return NO_INTENT;
      if (you.whip) {
        if (you.whip.red) { race.events = []; rel = H.forceRelease(race, you, 'PERFECT', T); }
        return NO_INTENT;
      }
      you.bearing = you.target = 20;
      return intentOf(20, tTo(race, well) <= 0.01 ? 'down' : null);
    });
    return rel;
  };
  const a = run(1.3), b = run(2.0);
  assert.ok(a && b && a.red && b.red && a.kick && a.grade === 'PERFECT', JSON.stringify(a));
  assert.ok(Math.abs(b.gain / a.gain - 2.0 / 1.3) < 1e-9, `${a.gain} and ${b.gain}`);
});

test('the first whip of a run teaches in any leg until the run has whipped (race.teachWhip)', () => {
  const grabTeach = (teachWhip) => {
    const race = raceOf([{ kind: 'well', beat: 20, psi: 0, size: 'medium', exits: [150] }], { tune: still });
    race.teachWhip = teachWhip;
    const you = race.ships[0], well = race.leg.items[0];
    you.dist = 18;
    const ev = fly(race, 400, () => {
      if (you.whip) return NO_INTENT;
      you.bearing = you.target = 20;
      return intentOf(20, tTo(race, well) <= 0.01 ? 'down' : null);
    });
    return ev.find((e) => e.type === 'grab');
  };
  assert.equal(grabTeach(true).teach, true, 'leg 2, no whip yet this run');
  assert.equal(grabTeach(false).teach, false, 'leg 2 after a whip');
});

test('gearUp { best: true } fires once per gear per leg', () => {
  const race = raceOf([], { tune: still });
  const you = race.ships[0];
  const plan = [1.5, 1.4, 1.5, 2.7, 2.5, 2.7, 1.2, 2.7, 3.9, 3.7, 3.9];
  const ev = [];
  for (const eta of plan) {
    you.eta = eta;
    for (let i = 0; i < 12; i++) for (const e of stepRace(race, null, STEP)) ev.push(e);
  }
  const ups = ev.filter((e) => e.type === 'gearUp');
  for (const g of [1, 2, 3]) assert.equal(ups.filter((e) => e.gear === g && e.best).length, 1, `gear ${g}`);
  assert.ok(ups.filter((e) => !e.best).length >= 4, 'a nine regained is a small tick');
  assert.ok(ev.some((e) => e.type === 'gearDown'));
  assert.equal(ev.filter((e) => e.type === 'headlight').length, 1, 'HEADLIGHT once a leg');
  // with the run's best gear carried in, nothing is a new best below it
  const r2 = createRace({ leg: legOf([]), tune: still, run: null });
  r2.legNo = 1;
  r2.ships[0] = H.createShip({ id: 'you', kind: 'you', eta: 1.0, meters: { bestGear: 2 }, tune: still });
  r2.ships[0].eta = 2.7;
  const e2 = [];
  for (let i = 0; i < 12; i++) for (const e of stepRace(r2, null, STEP)) e2.push(e);
  assert.ok(e2.filter((e) => e.type === 'gearUp').every((e) => !e.best));
  // a gear does not flap on drag at its nine: one gearDown per real drop
  const r3 = raceOf([]);
  r3.ships[0].eta = 1.48;
  const e3 = fly(r3, 600);
  assert.ok(e3.filter((e) => e.type === 'gearDown').length <= 1);
});

// Input: drive a gesture machine through the race at real time (ms = race.real × 1000).
function withInput(race, input, steps, script) {
  const out = [];
  const you = race.ships[0];
  for (let i = 0; i < steps && race.phase !== 'done'; i++) {
    const t = race.real * 1000;
    script(i, t, race);
    const intent = input.take(race, you, t + STEP * 1000);
    for (const e of stepRace(race, { you: intent }, STEP)) out.push({ ...e, real: race.real, step: i });
  }
  return out;
}

test('a lone tap does nothing (a burn with ?burn=tap); a press in a window grabs on the press; 20 px in the latch cancels', () => {
  // a lone tap, no window: nothing at all
  let race = raceOf([], { tune: still });
  let inp = createInput({ tune: still });
  let ev = withInput(race, inp, 120, (i, t) => {
    if (i === 10) inp.pointerDown(1, 200, 700, t);
    if (i === 20) inp.pointerUp(1, 202, 699, t);
  });
  assert.deepEqual(ev, []);
  assert.equal(race.ships[0].eta, 1.0);
  // with ?burn=tap the same tap burns, on the lift
  race = raceOf([], { tune: still });
  inp = createInput({ tune: still, burnTap: true });
  ev = withInput(race, inp, 120, (i, t) => {
    if (i === 10) inp.pointerDown(1, 200, 700, t);
    if (i === 20) inp.pointerUp(1, 202, 699, t);
  });
  assert.deepEqual(ev.map((e) => e.type), ['burn']);
  assert.ok(ev[0].step >= 20 && ev[0].step <= 21, `burned on step ${ev[0].step}`);
  // a long press is no tap
  race = raceOf([], { tune: still });
  inp = createInput({ tune: still, burnTap: true });
  ev = withInput(race, inp, 120, (i, t) => {
    if (i === 10) inp.pointerDown(1, 200, 700, t);
    if (i === 50) inp.pointerUp(1, 200, 700, t);
  });
  assert.deepEqual(ev, []);
  // a press in a window grabs on the press (not the lift)
  const well = { kind: 'well', beat: 6, psi: 0, size: 'medium', exits: [150, -150] };
  race = raceOf([well], { tune: still });
  inp = createInput({ tune: still });
  let pressStep = null;
  ev = withInput(race, inp, 600, (i, t, r) => {
    const y = r.ships[0];
    if (pressStep === null) { y.bearing = y.target = 20; }
    if (pressStep === null && H.windowOpen(r, y) && tTo(r, r.leg.items[0]) < 0.1) { inp.pointerDown(1, 200, 700, t); pressStep = i; }
    if (pressStep !== null && i === pressStep + 200) inp.pointerUp(1, 200, 700, t);
  });
  const grab = ev.find((e) => e.type === 'grab');
  assert.ok(grab, 'grabbed');
  assert.equal(grab.step, pressStep, 'on the step of the press');
  assert.ok(ev.some((e) => e.type === 'release' && e.step === pressStep + 200), 'let go on the lift');
  // 20 px of drag in the latch: a free latch cancel, and the drag steers on
  race = raceOf([well], { tune: still });
  inp = createInput({ tune: still });
  pressStep = null;
  ev = withInput(race, inp, 400, (i, t, r) => {
    const y = r.ships[0];
    if (pressStep === null) { y.bearing = y.target = 20; }
    if (pressStep === null && H.windowOpen(r, y) && tTo(r, r.leg.items[0]) < 0.1) { inp.pointerDown(1, 200, 700, t); pressStep = i; }
    if (pressStep !== null && i > pressStep && i <= pressStep + 8) inp.pointerMove(1, 200 + (i - pressStep) * 3, 700, t);
  });
  const types2 = ev.map((e) => e.type);
  assert.ok(types2.includes('grab') && types2.includes('latchCancel'), types2.join(','));
  assert.ok(!types2.includes('release'));
  const lc = ev.find((e) => e.type === 'latchCancel');
  assert.ok(lc.real - ev.find((e) => e.type === 'grab').real <= TUNE.LATCH_S + EPS);
  assert.equal(race.ships[0].whip, null);
  assert.ok(Math.abs(race.ships[0].eta - 1.0) < EPS, 'the grab cost nothing');
  assert.equal(inp.counts.cancels, 1);
});

test('drags steer by lab A\'s gain curve; a flick up burns and does not steer; keys turn; a re-grip keeps the target', () => {
  assert.ok(Math.abs(gainAt(100) - TUNE.GAIN) < EPS);
  assert.ok(Math.abs(gainAt(2000) - TUNE.GAIN_FAST) < EPS);
  // a slow 40 px drag: about 24°
  let race = raceOf([], { tune: still });
  let inp = createInput({ tune: still });
  withInput(race, inp, 240, (i, t) => {
    if (i === 10) inp.pointerDown(1, 200, 700, t);
    if (i > 10 && i <= 90) inp.pointerMove(1, 200 + (i - 10) * 0.5, 700, t);
  });
  assert.ok(Math.abs(race.ships[0].bearing - 24) < 0.5, `slow 40 px: ${race.ships[0].bearing.toFixed(2)}°`);
  // a fast one turns further
  race = raceOf([], { tune: still });
  inp = createInput({ tune: still });
  withInput(race, inp, 120, (i, t) => {
    if (i === 10) inp.pointerDown(1, 200, 700, t);
    if (i > 10 && i <= 14) inp.pointerMove(1, 200 + (i - 10) * 10, 700, t);
  });
  assert.ok(race.ships[0].bearing > 40, `fast 40 px: ${race.ships[0].bearing.toFixed(2)}°`);
  // a flick up mid-drag: one burn and no turn from its sideways part
  race = raceOf([], { tune: still });
  inp = createInput({ tune: still });
  const ev = withInput(race, inp, 120, (i, t) => {
    if (i === 5) inp.pointerDown(1, 200, 700, t);
    if (i > 5 && i <= 15) inp.pointerMove(1, 200 + (i - 5) * 1, 700, t);   // a slow drag, 10 px
    if (i > 30 && i <= 34) inp.pointerMove(1, 210 + (i - 30) * 4, 700 - (i - 30) * 18, t);   // up 72 px in 33 ms
  });
  assert.deepEqual(ev.map((e) => e.type), ['burn']);
  assert.ok(Math.abs(race.ships[0].bearing - 6) < 0.6, `the flick did not steer: ${race.ships[0].bearing.toFixed(2)}°`);
  // a re-grip keeps the target; two fingers do not double the gain
  race = raceOf([], { tune: still });
  inp = createInput({ tune: still });
  withInput(race, inp, 240, (i, t) => {
    if (i === 5) inp.pointerDown(1, 200, 700, t);
    if (i > 5 && i <= 25) inp.pointerMove(1, 200 + (i - 5) * 0.5, 700, t);
    if (i === 30) inp.pointerUp(1, 210, 700, t);
    if (i === 60) inp.pointerDown(2, 100, 600, t);
    if (i === 60) inp.pointerDown(3, 300, 600, t);
    if (i > 60 && i <= 80) { inp.pointerMove(2, 100 + (i - 60) * 0.5, 600, t); inp.pointerMove(3, 300 + (i - 60) * 0.5, 600, t); }
  });
  assert.ok(Math.abs(race.ships[0].bearing - 12) < 0.6, `re-grip and two fingers: ${race.ships[0].bearing.toFixed(2)}°`);
  // keys: ← turns at KEY_TURN; Space holds; ↑ burns
  race = raceOf([], { tune: still });
  inp = createInput({ tune: still });
  const ek = withInput(race, inp, 240, (i, t) => {
    if (i === 0) inp.keyDown('ArrowLeft', t);
    if (i === 60) inp.keyUp('ArrowLeft', t);
    if (i === 100) inp.keyDown('ArrowUp', t);
  });
  // 0.5 s at KEY_TURN less the KEY_RAMP's lag (about KEY_TURN × KEY_RAMP)
  const keyTurn = TUNE.KEY_TURN * (0.5 - TUNE.KEY_RAMP);
  assert.ok(Math.abs(race.ships[0].bearing + keyTurn) < 4, `0.5 s of ←: ${race.ships[0].bearing.toFixed(1)}°`);
  assert.deepEqual(ek.map((e) => e.type), ['burn']);
  assert.equal(inp.scheme, 'keys');
  // a mouse moving with no button never steers
  race = raceOf([], { tune: still });
  inp = createInput({ tune: still });
  withInput(race, inp, 120, (i, t) => { inp.pointerMove(9, 100 + i * 5, 400, t); });
  assert.equal(race.ships[0].bearing, 0);
});

test('pause keeps a held whip held; a blur forgets the thumb and play waits for HOLD TO GO ON', () => {
  const inp = createInput();
  inp.pointerDown(1, 200, 700, 0);
  assert.equal(inp.holding, true);
  inp.pause(true);
  assert.equal(inp.resume(true), 'play', 'the thumb is still down');
  inp.pause(false);                                       // a blur: lifts can be missed
  assert.equal(inp.holding, false);
  assert.equal(inp.resume(true), 'regrip');
  assert.equal(inp.waiting, true);
  inp.pointerDown(2, 200, 700, 100);                      // the fresh press carries the whip on, with no new action
  assert.equal(inp.waiting, false);
  assert.equal(inp.holding, true);
  assert.equal(inp.pending, 0);
});

test('10,000 steps of random intents and dt (1 to 50 ms): no NaN, no throw', () => {
  const items = [];
  for (let b = 4; b < 400; b += 3) {
    const k = Math.floor(b / 3) % 6;
    if (k === 0) items.push({ kind: 'knot', beat: b, psi: (b * 41) % 360 - 180, half: 3 });
    if (k === 1) items.push({ kind: 'well', beat: b, psi: (b * 17) % 360 - 180, size: ['small', 'medium', 'large', 'landmark'][b % 4], exits: [b % 180, -(b % 170)] });
    if (k === 2) items.push({ kind: 'rail', beat: b, end: b + 5, psi: (b * 7) % 360 - 180, half: 1.5, omega: 3, breaks: [[b + 1, b + 2]], skimBand: 6, skimX: 1 });
    if (k === 3) items.push({ kind: 'wall', beat: b, psi: 0, gaps: [{ psi: (b * 13) % 360 - 180, w: 60, tag: null }] });
    if (k === 4) items.push({ kind: 'gate', beat: b, psi: (b * 5) % 360 - 180, gap: 20, halves: [4, 5], dock: { psi: 90, w: 60 } });
    if (k === 5) items.push({ kind: 'pickup', type: b % 2 ? 'fuel' : 'patch', beat: b, psi: (b * 3) % 360 - 180, line: 0, slot: 'x' });
  }
  const rnd = mulberry32(99);
  let race = raceOf(items, { beats: 420, legNo: 0 });
  const add = (r) => { rival(r, { id: 'pike', bearing: 30, ahead: 0.3 }); rival(r, { id: 'moth', bearing: -10, ahead: -0.1 }); };
  add(race);
  for (let i = 0; i < 10000; i++) {
    const r = rnd();
    const intent = r < 0.3 ? intentOf((rnd() - 0.5) * 600, rnd() < 0.05 ? 'down' : rnd() < 0.05 ? 'up' : null, rnd() < 0.02)
      : r < 0.6 ? { target: null, turn: rnd() * 2 - 1, action: rnd() < 0.03 ? 'down' : null, burn: false }
        : r < 0.62 ? { target: NaN, turn: 'x', action: 'down', burn: true } : NO_INTENT;
    for (const s of race.ships.slice(1)) s.ai.intent = intentOf(s.bearing + (rnd() - 0.5) * 120, rnd() < 0.03 ? 'down' : rnd() < 0.03 ? 'up' : null, rnd() < 0.01);
    stepRace(race, { you: intent }, 0.001 + rnd() * 0.049);
    for (const s of race.ships) {
      for (const k of ['bearing', 'target', 'eta', 'dist', 'fuel', 'turnRate', 'chainT', 'flicker']) {
        assert.ok(Number.isFinite(s[k]), `${s.id}.${k} at step ${i}`);
      }
      if (s.whip) assert.ok(Number.isFinite(s.whip.angle));
    }
    if (race.phase === 'done') { race = raceOf(items, { beats: 420, legNo: i % 2 }); add(race); }
  }
});

test('the handling step allocates nothing but its events (gc exposed)', () => {
  const flags = ['--expose-gc', '--no-concurrent-recompilation'];
  const out = spawnSync(process.execPath, [...flags, fileURLToPath(import.meta.url)],
    { env: { ...process.env, AOL_ALLOC_CHILD: '1' }, encoding: 'utf8' });
  const m = /ALLOC (\{.*\})/.exec(out.stdout || '');
  assert.ok(m, `child reported: ${out.stdout} ${out.stderr}`);
  const r = JSON.parse(m[1]);
  assert.ok(r.drafting && r.skim > 0 && r.whip && r.phase, `the probe drafts, skims, whips and cools: ${m[1]}`);
  assert.ok(Number.isFinite(r.best), `a quiet window with no events and no collector run: ${m[1]}`);
  assert.ok(r.best < 8, `about ${r.best.toFixed(1)} bytes a step`);
});
