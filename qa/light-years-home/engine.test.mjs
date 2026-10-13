// Light Years Home: engine checks. The scan (wrong locks, the third lock, hints), the throttle, heat and cracks, the
// exact clocks, the drop-out, the whole journey played by the bots (phase order, chapters, spots, the fork, "On Earth"
// cards, radio, the lost ending and retry), pause, determinism, saves, and that stray actions and bad input do nothing.
// node qa/light-years-home/engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  create, start, update, act, drainEvents, jump, legOf, zoneAt, scanOf, etaFor, parShipYears, gradePar,
  standingStartYears, rankFor, resultOf,
  progressOf, aheadAt, TICK, PANES, THROTTLE_UP, THROTTLE_DOWN, HEAT_GAIN, HEAT_MAX_RATE, HEAT_COOL, CRACK_HEAT,
  CRACK_LOCK, CARRY_PER_WRONG, CARRY_MAX, HINT_AFTER, TEXT, ROUTE_LY, POINTS,
} from '../../public/light-years-home/core/engine.js';
import { botStep, playJourney } from '../../public/light-years-home/core/bot.js';
import { STOPS, CHAPTERS, routeLengthLy, candidate } from '../../public/light-years-home/core/route.js';
import { heatRatio, viewRapidity } from '../../public/light-years-home/core/physics.js';
import { MILESTONES } from '../../public/light-years-home/core/milestones.js';
import { saveProgress, readProgress, cleanBest } from '../../public/light-years-home/core/save.js';

const TODAY = { y: 2026, m: 10, d: 13 };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const fresh = (opts = {}) => create({ seed: 7, today: TODAY, ...opts });

// A storage object like the browser's, in memory.
function memoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k),
  };
}

// Steps n ticks with the same input; returns the events.
function run(state, n, input = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    update(state, input, TICK);
    out.push(...drainEvents(state));
  }
  return out;
}

// Steps until pred(state, events) is true or limit ticks pass; returns { ticks, events }.
function until(state, pred, { input = {}, limit = 60 * 120, bot = null } = {}) {
  const events = [];
  for (let i = 1; i <= limit; i++) {
    let hold = input.hold === true;
    if (bot) {
      const step = botStep(bot, state);
      for (const a of step.actions) act(state, a);
      hold = step.hold;
    }
    update(state, { hold }, TICK);
    const ev = drainEvents(state);
    events.push(...ev);
    if (pred(state, ev)) return { ticks: i, events };
  }
  throw new Error(`condition not met in ${limit} ticks (phase ${state.phase}, stop ${state.stop})`);
}

// A state at the scan of a stop (or spot), events drained.
function atScan(stop, opts = {}) {
  const s = fresh(opts);
  start(s, { skipIntro: true });
  jump(s, stop, 'scan', opts);
  drainEvents(s);
  return s;
}

// A state flying a leg at a given zone, p and x, events drained.
function atFlight(stop, opts = {}) {
  const s = fresh(opts);
  start(s, { skipIntro: true });
  jump(s, stop, 'flight', opts);
  drainEvents(s);
  return s;
}

// The zone index of the first open stretch on leg 1 (the void).
const VOID_ZONE = legOf({ stop: 0, branch: null }).zones.findIndex((z) => z.kind === 'void');

// ---------- scan ----------

test('C6: a wrong lock says why not, greys the ring, carries heat, and the find then scores 400', () => {
  const s = atScan(0);
  const scan = scanOf(s);
  const decoys = ['A', 'B', 'C'].filter((k) => k !== scan.target);
  act(s, { type: 'select', letter: decoys[0] });
  assert.equal(s.scan.open, decoys[0]);
  act(s, { type: 'lock' });
  const ev = drainEvents(s);
  const wrong = ev.find((e) => e.type === 'wrong');
  const whyNot = candidate(scan.entry, scan.letters[decoys[0]]).whyNot;
  assert.ok(wrong && wrong.whyNot === whyNot);
  assert.equal(s.say.current.text, whyNot, 'the why-not line plays at once');
  assert.equal(s.say.current.kind, 'whyNot');
  assert.deepEqual(s.scan.tried, [decoys[0]]);
  assert.equal(s.scan.open, null);
  assert.equal(s.heatCarry, CARRY_PER_WRONG);
  assert.equal(s.phase, 'scan');
  act(s, { type: 'select', letter: decoys[0] });
  assert.equal(s.scan.open, null, 'a greyed ring does not open');
  act(s, { type: 'select', letter: scan.target });
  act(s, { type: 'lock' });
  const lock = drainEvents(s).find((e) => e.type === 'lock');
  assert.equal(lock.points, 400);
  assert.equal(s.score.finds, 400);
  assert.equal(s.stats.wrong, 1);
  assert.equal(s.stats.firstTry, 0);
  assert.equal(s.phase, 'flight');
  assert.equal(s.flight.heat, CARRY_PER_WRONG, 'the flight starts with the carried heat');
  assert.equal(s.heatCarry, 0);
});

test('C7: after two wrong locks the last ring is right, the flight starts and the find scores 100', () => {
  const s = atScan(1);
  const scan = scanOf(s);
  for (const k of ['A', 'B', 'C'].filter((l) => l !== scan.target)) {
    act(s, { type: 'select', letter: k });
    act(s, { type: 'lock' });
  }
  assert.equal(s.heatCarry, Math.min(CARRY_MAX, 2 * CARRY_PER_WRONG));
  act(s, { type: 'select', letter: scan.target });
  act(s, { type: 'lock' });
  assert.equal(s.phase, 'flight');
  assert.equal(s.score.finds, 100);
  assert.equal(s.flight.heat, CARRY_MAX);
  // carried heat is capped at 0.5 even with a third decoy on the stop
  const t = atScan(12);
  const ts = scanOf(t);
  for (const k of ['A', 'B', 'C'].filter((l) => l !== ts.target)) {
    act(t, { type: 'select', letter: k });
    act(t, { type: 'lock' });
  }
  assert.equal(t.heatCarry, CARRY_MAX);
});

test('C8: with hints on, the target ring pulses after 25 s idle; with hints off it does not', () => {
  const on = atScan(0);
  run(on, Math.round((HINT_AFTER - 1) * 60));
  assert.equal(on.scan.hint, false);
  act(on, { type: 'select', letter: 'A' });
  act(on, { type: 'close' });
  run(on, Math.round((HINT_AFTER - 1) * 60));
  assert.equal(on.scan.hint, false, 'opening a card resets the idle time');
  run(on, 2 * 60);
  assert.equal(on.scan.hint, true);
  assert.equal(scanOf(on).target, ['A', 'B', 'C'].find((k) => on.draw.coma[k] === 'coma'));
  const off = atScan(0, { settings: { hints: false } });
  run(off, Math.round((HINT_AFTER + 5) * 60));
  assert.equal(off.scan.hint, false);
  act(off, { type: 'settings', settings: { hints: true } });
  run(off, 1);
  assert.equal(off.scan.hint, true, 'turning hints on in the pause menu takes effect');
});

test('O1: on a first run the Laniakea line plays and the rings with the tap hint come within 14 s', () => {
  const s = fresh();
  start(s);
  const said = [];
  const { ticks, events } = until(s, (st) => st.phase === 'clue');
  said.push(...events.filter((e) => e.type === 'say').map((e) => e.item));
  assert.ok(ticks * TICK < 13, `clue (rings) at ${ticks * TICK} s`);
  assert.deepEqual(said.map((i) => i.kind), ['intro', 'intro', 'intro', 'clue']);
  assert.equal(said[2].ring, 'laniakea', 'the Laniakea ring draws with the third line');
  assert.equal(s.say.current.kind, 'clue');
  assert.equal(s.scan.teach, true, 'ring A pulses with "Tap a ring"');
  // a tap on a ring during the clue opens its card at once; the clue line plays on
  act(s, { type: 'select', letter: 'B' });
  assert.equal(s.phase, 'scan');
  assert.equal(s.scan.open, 'B');
  assert.equal(s.say.current.kind, 'clue');
  // O4: on later runs the first two lines are skipped
  const later = fresh({ firstRun: false });
  start(later);
  assert.equal(later.phase, 'clue');
  assert.equal(later.say.current.text, 'Home is in that ring. Too big to aim at.');
  assert.equal(later.say.current.ring, 'laniakea');
});

test('the first scan of a first run teaches the tap; later runs do not', () => {
  const s = fresh();
  start(s);
  until(s, (st) => st.phase === 'scan');
  assert.equal(s.scan.teach, true);
  act(s, { type: 'select', letter: 'B' });
  assert.equal(s.scan.teach, false);
  const later = fresh({ firstRun: false });
  start(later);
  until(later, (st) => st.phase === 'scan');
  assert.equal(later.scan.teach, false);
});

// ---------- flight ----------

test('F1: held, the throttle rises 0.42 per s; released, it falls 0.9 per s', () => {
  const s = atFlight(0);
  run(s, 60, { hold: true });
  near(s.flight.x, THROTTLE_UP, 1e-9, 'x after 1 s held');
  run(s, 60, { hold: true });
  near(s.flight.x, 2 * THROTTLE_UP, 1e-9, 'x after 2 s held');
  run(s, 30, { hold: false });
  near(s.flight.x, 2 * THROTTLE_UP - THROTTLE_DOWN / 2, 1e-9, 'x after 0.5 s released');
  run(s, 120, { hold: false });
  assert.equal(s.flight.x, 0);
  assert.equal(s.flight.eta, legOf(s).etaLo);
  near(s.flight.view, viewRapidity(0), 0, 'view at rest');
});

test('the leg maps x to η: intergalactic legs run η 16.0 to 20.8, the open notch at 0.834, a disc at 0.333', () => {
  const leg = legOf({ stop: 0, branch: null });
  near(leg.etaLo, 16.0, 0.01, 'η_lo');
  near(leg.etaHi, 20.81, 0.01, 'η_hi');
  near(leg.zones[VOID_ZONE].notch, 0.834, 0.002, 'open notch');
  near(leg.zones.find((z) => z.kind === 'waypoint').notch, 0.333, 0.002, 'disc notch');
  near(etaFor(leg, 0.5), (leg.etaLo + leg.etaHi) / 2, 1e-12, 'η halfway');
  for (let i = 0; i < STOPS.length; i++) {
    const l = legOf({ stop: i, branch: 'sheet' });
    assert.ok(l.etaHi - l.etaLo >= 4.8 - 1e-9 && l.etaLo > 6.79, `leg ${i + 1} span`);
  }
  const orion = legOf({ stop: STOPS.findIndex((s) => s.id === 'orion-nebula'), branch: null });
  near(orion.zones.find((z) => z.label === 'Orion Nebula').notch, 0.14, 0.01, 'Orion Nebula core notch');
});

test('F4: over the notch heat rises at min(1.5, 0.55 ln r) per s; under 0.8 r it falls at 0.22 per s', () => {
  const s = atFlight(0, { zone: VOID_ZONE, x: 1 });
  const leg = legOf(s), z = leg.zones[VOID_ZONE];
  const r = heatRatio(z.n, leg.etaHi);
  assert.ok(r > 1);
  run(s, 30, { hold: true });
  near(s.flight.heat, Math.min(HEAT_MAX_RATE, HEAT_GAIN * Math.log(r)) * 0.5, 1e-9, 'heat after 0.5 s at x = 1');
  // a galaxy disc at full throttle heats at the 1.5 per s cap
  const w = atFlight(0, { zone: 1, x: 1 });
  run(w, 12, { hold: true });
  near(w.flight.heat, HEAT_MAX_RATE * 0.2, 1e-9, 'heat in a galaxy at x = 1');
  // let go: under 0.8 r the Lens cools
  s.flight.x = 0;
  const h = s.flight.heat;
  run(s, 60, { hold: false });
  near(s.flight.heat, h - HEAT_COOL, 1e-9, 'heat after 1 s at x = 0');
  // between 0.8 and 1 the heat holds (x frozen by the input lock)
  const m = atFlight(0, { zone: VOID_ZONE, x: z.notch - 0.01 });
  assert.ok(heatRatio(z.n, m.flight.eta) > 0.8 && heatRatio(z.n, m.flight.eta) < 1);
  m.flight.heat = 0.3;
  m.flight.lock = 10;
  run(m, 60);
  assert.equal(m.flight.heat, 0.3);
});

test('F5: full throttle in open space cracks a pane after 1.15 ± 0.05 s', () => {
  const s = atFlight(0, { zone: VOID_ZONE, x: 1 });
  const { ticks, events } = until(s, (st, ev) => ev.some((e) => e.type === 'crack'), { input: { hold: true } });
  near(ticks * TICK, 1.15, 0.05, 'seconds to crack');
  const z = legOf(s).zones[s.flight.zone];
  assert.equal(s.panes, PANES - 1);
  assert.equal(s.flight.heat, CRACK_HEAT);
  near(s.flight.x, z.notch - 0.1, 1e-12, 'x after the crack');
  assert.equal(s.flight.lock, CRACK_LOCK);
  assert.equal(s.say.current.text.toUpperCase(), 'SHIELD CRACKED.');
  assert.equal(s.score.cracks, POINTS.crack);
  assert.ok(events.some((e) => e.type === 'heatHigh'));
  // input is locked for 0.8 s, then holding raises x again
  const x = s.flight.x;
  run(s, Math.round(CRACK_LOCK * 60), { hold: true });
  assert.equal(s.flight.x, x, 'locked for 0.8 s');
  run(s, 1, { hold: true });
  near(s.flight.x, x + THROTTLE_UP * TICK, 1e-12, 'free again');
});

test('F8: at constant η, ship time = ℓ / sinh η and Earth time = ℓ / tanh η within 1e-9', () => {
  for (const stop of [0, 6, 14]) {
    const s = atFlight(stop);
    const eta = legOf(s).etaLo, earth0 = s.clocks.earth;
    let checked = 0;
    const { events } = until(s, (st) => {
      if (st.phase !== 'flight' || st.flight.ly === 0) return st.phase !== 'flight';
      assert.equal(st.flight.eta, eta);
      assert.ok(rel(st.flight.ship, st.flight.ly / Math.sinh(eta)) < 1e-9, 'ship clock');
      assert.ok(rel(st.flight.earth, st.flight.ly / Math.tanh(eta)) < 1e-9, 'Earth clock');
      checked++;
      return false;
    });
    assert.ok(checked > 100, `leg ${stop + 1}: ${checked} ticks checked`);
    const leg = legOf({ stop, branch: null });
    const arrive = events.find((e) => e.type === 'arrive');
    assert.ok(rel(arrive.ship, leg.lengthLy / Math.sinh(eta)) < 1e-9, 'whole leg ship time');
    assert.ok(rel(arrive.earth, leg.lengthLy / Math.tanh(eta)) < 1e-9, 'whole leg Earth time');
    near(s.clocks.earth - earth0, arrive.earth, 1e-3, 'the journey clock adds the leg (float64 at 1.2e9 years)');
  }
});

test('F9: on every flight, Earth time on the leg is never less than the distance flown', () => {
  let ticks = 0;
  for (const kind of ['careful', 'skilled', 'reckless']) {
    playJourney(kind, {
      seed: 3,
      onTick(st) {
        if (st.phase !== 'flight') return;
        ticks++;
        assert.ok(st.flight.earth >= st.flight.ly * (1 - 1e-12), `${st.flight.earth} < ${st.flight.ly}`);
        assert.ok(st.clocks.earth >= ROUTE_LY - st.clocks.aheadLy - 1e-6 * ROUTE_LY);
      },
    });
  }
  assert.ok(ticks > 1000);
});

test('F10: the drop-out: x forced to 0, the view eases to rest, input ignored, the leg ends at the target', () => {
  const leg = legOf({ stop: 0, branch: null });
  const s = atFlight(0, { zone: leg.zones.length - 2, p: 0.95, x: 0.8 });
  let ev = until(s, (st) => st.flight.zone === leg.zones.length - 1, { input: { hold: true } }).events;
  assert.ok(ev.some((e) => e.type === 'zone' && e.dropout));
  assert.equal(s.flight.x, 0);
  const view0 = s.flight.view, eta0 = s.flight.eta;
  assert.ok(view0 > 0.5, 'the view starts from the speed it had');
  run(s, 30, { hold: true });
  assert.equal(s.flight.x, 0, 'holding does nothing');
  assert.equal(s.flight.eta, eta0, 'the drive holds its speed to the target');
  assert.ok(s.flight.view < view0 * 0.5, 'the view eases toward rest');
  const res = until(s, (st) => st.phase !== 'flight', { input: { hold: true } });
  near((res.ticks + 30) * TICK, leg.zones[leg.zones.length - 1].screen, 2 * TICK, 'drop-out seconds');
  ev = res.events;
  const arrive = ev.find((e) => e.type === 'arrive');
  assert.ok(arrive && arrive.id === 'coma');
  assert.equal(s.phase, 'reveal');
  assert.equal(s.clocks.aheadLy, aheadAt(1), 'exactly at the target');
  // the drop-out never flies faster than its zone's limit
  const fast = atFlight(0, { zone: leg.zones.length - 1, x: 1 });
  assert.ok(fast.flight.eta <= leg.zones[leg.zones.length - 1].limit);
  // legs 12 to 14 drop out over their own 1.4 s
  assert.equal(legOf({ stop: 12, branch: null }).zones.at(-1).screen, 1.4);
});

test('a clean crossing of a galaxy scores 50; any heat rise there loses it', () => {
  const s = atFlight(0, { zone: 1, p: 0.9, x: 0.2 });
  let ev = until(s, (st) => st.flight.zone === 2).events;
  assert.deepEqual(ev.find((e) => e.type === 'zone').cleared, { label: 'Spiral galaxy', points: POINTS.clean });
  assert.equal(s.score.clean, POINTS.clean);
  const h = atFlight(0, { zone: 1, p: 0.9, x: 0.6 });
  ev = until(h, (st) => st.flight.zone === 2, { input: { hold: true } }).events;
  assert.equal(ev.find((e) => e.type === 'zone').cleared, null);
  assert.equal(h.score.clean, 0);
});

test('coaching shows on a first run only; lines show every run', () => {
  const a = fresh();
  start(a, { skipIntro: true });
  jump(a, 0, 'scan');
  act(a, { type: 'select', letter: scanOf(a).target });
  act(a, { type: 'lock' });
  assert.equal(a.say.current.kind, 'coach');
  assert.equal(a.say.current.text, 'Hold to go faster.');
  const ev = until(a, (st) => st.flight.zone >= 1, { input: { hold: true } }).events;
  const said = ev.filter((e) => e.type === 'say').map((e) => e.item.text);
  assert.ok(said.includes('Galaxy ahead. Let go!'), said.join(' | '));
  // F7: the warning cuts in as the galaxy comes up, not after the line before it
  const at = ev.findIndex((e) => e.type === 'say' && e.item.text === 'Galaxy ahead. Let go!');
  assert.equal(ev[at - 1].type, 'notchSoon');
  // a lock while the clue still plays: the flight coaching starts at once and never comes after the warning
  const q = fresh();
  start(q, { skipIntro: true });
  drainEvents(q);
  assert.equal(q.phase, 'clue');
  act(q, { type: 'select', letter: scanOf(q).target });
  act(q, { type: 'lock' });
  assert.equal(q.say.current.text, 'Hold to go faster.');
  const evq = until(q, (st) => st.flight.zone >= 2, { input: { hold: true } }).events;
  const order = evq.filter((e) => e.type === 'say').map((e) => e.item.text);
  assert.ok(order.includes('Galaxy ahead. Let go!'), order.join(' | '));
  assert.ok(!order.slice(order.indexOf('Galaxy ahead. Let go!')).includes('Hold to go faster.'), order.join(' | '));
  const b = fresh({ firstRun: false });
  start(b, { skipIntro: true });
  jump(b, 0, 'scan');
  act(b, { type: 'select', letter: scanOf(b).target });
  act(b, { type: 'lock' });
  const evb = until(b, (st) => st.phase !== 'flight', { bot: 'careful' }).events;
  assert.equal(evb.filter((e) => e.type === 'say' && e.item.kind === 'coach').length, 0);
  const c = fresh({ firstRun: false });
  start(c, { skipIntro: true });
  jump(c, 6, 'flight');
  const evc = until(c, (st) => st.phase !== 'flight', { bot: 'careful' }).events;
  assert.ok(evc.some((e) => e.type === 'say' && e.item.kind === 'line' && /Orion Arm/.test(e.item.text)));
  // story lines wait their turn: the first radio line plays in full before the next line
  const r = fresh({ firstRun: false });
  start(r, { skipIntro: true });
  jump(r, 11, 'flight');
  drainEvents(r);
  const heard = [];
  let tick = 0;
  until(r, (st, ev) => {
    tick++;
    for (const e of ev) if (e.type === 'say') heard.push({ text: e.item.text, dur: e.item.dur, at: tick * TICK });
    return st.phase !== 'flight';
  }, { bot: 'careful' });
  const listen = heard.findIndex((x) => /first radio/.test(x.text));
  const lines = heard.map((x) => x.text).join(' | ');
  assert.ok(listen >= 0 && heard[listen + 1] && /younger/.test(heard[listen + 1].text), lines);
  assert.ok(heard[listen + 1].at - heard[listen].at >= heard[listen].dur - 1e-9, 'the radio line was cut short');
});

// ---------- whole journeys ----------

const careful = Array.from({ length: 5 }, (_, i) => playJourney('careful', { seed: i + 1 }));
const skilled = Array.from({ length: 5 }, (_, i) => playJourney('skilled', { seed: i + 1 }));

test('G1: a journey runs title, intro, clue, scan, flight, reveal … chapter … ending, in route order', () => {
  const { phases, state } = careful[0];
  assert.deepEqual(phases.slice(0, 7), ['title', 'intro', 'clue', 'scan', 'flight', 'reveal', 'clue']);
  assert.equal(phases.at(-1), 'ending');
  assert.equal(phases.filter((p) => p === 'chapter').length, 3);
  assert.equal(phases.filter((p) => p === 'fork').length, 1);
  assert.equal(phases.filter((p) => p === 'flight').length, 15);
  assert.equal(phases.filter((p) => p === 'reveal').length, 14 + 2, '14 landmarks and 2 spots; Earth is the ending');
  // the order of arrivals is the route order
  const ids = [];
  const arrivals = (st, ev) => ids.push(...ev.filter((e) => e.type === 'arrive').map((e) => e.id));
  playJourney('careful', { seed: 1, onTick: arrivals });
  assert.deepEqual(ids, STOPS.map((s) => s.id));
  assert.equal(state.clocks.aheadLy, 0);
  assert.equal(state.ending.done, true);
});

test('G2: each chapter ends with its card; the next chapter restores a pane and saves progress', () => {
  const s = atFlight(2, { zone: legOf({ stop: 2, branch: null }).zones.length - 1, panes: 1 });
  const ev = until(s, (st) => st.phase === 'chapter', { bot: 'careful' }).events;
  assert.equal(s.say.current.text, CHAPTERS[0].end);
  const ch = ev.find((e) => e.type === 'chapter');
  assert.equal(ch.chapter, 1);
  assert.equal(ch.ended, 0);
  assert.ok(ev.some((e) => e.type === 'paneRestored' && e.panes === 2));
  assert.equal(s.panes, 2);
  assert.equal(s.stop, 3);
  // the progress in the event is what save.js stores
  const storage = memoryStorage();
  assert.equal(saveProgress(storage, ch.progress), true);
  assert.deepEqual(readProgress(storage), ch.progress);
  // a full pane count stays at 3
  const full = careful[0].counts;
  assert.equal(full.paneRestored || 0, 0);
  assert.equal(full.chapter, 4, 'chapter I start plus three cards');
  act(s, { type: 'advance' });
  assert.equal(s.phase, 'clue');
  assert.equal(s.stop, 3);
});

test('G3: after the Andromeda and Pleiades reveals a spot runs; the clocks stay still; a first try scores 300', () => {
  for (const stop of [3, 9]) {
    const s = fresh();
    start(s, { skipIntro: true });
    jump(s, stop, 'reveal');
    drainEvents(s);
    const ev = until(s, (st) => st.phase === 'scan').events;
    assert.equal(s.mode, 'spot');
    const id = STOPS[stop].spot.id;
    assert.ok(ev.some((e) => e.type === 'spot' && e.id === id));
    const clocks = { ...s.clocks };
    act(s, { type: 'select', letter: scanOf(s).target });
    act(s, { type: 'lock' });
    assert.equal(s.score.spots, POINTS.spot);
    assert.equal(s.phase, 'reveal');
    until(s, (st) => st.phase !== 'reveal');
    assert.deepEqual({ ...s.clocks, radio: null }, { ...clocks, radio: null }, 'no time passes in a spot');
    assert.equal(s.mode, 'stop');
    assert.ok(s.stop === stop + 1 || s.phase === 'chapter');
  }
  // a spot found on the second try scores nothing
  const t = fresh();
  start(t, { skipIntro: true });
  jump(t, 3, 'scan', { mode: 'spot' });
  const sc = scanOf(t);
  act(t, { type: 'select', letter: ['A', 'B', 'C'].find((k) => k !== sc.target) });
  act(t, { type: 'lock' });
  act(t, { type: 'select', letter: sc.target });
  act(t, { type: 'lock' });
  assert.equal(t.score.spots, 0);
  assert.equal(careful[0].state.score.spots, 2 * POINTS.spot);
});

test('G4: the Andromeda lock opens the fork; both branches arrive at the same distance; the Sheet pays 400', () => {
  const out = {};
  for (const branch of ['sheet', 'void']) {
    const s = atScan(3);
    act(s, { type: 'select', letter: scanOf(s).target });
    act(s, { type: 'lock' });
    assert.equal(s.phase, 'fork');
    assert.ok(s.say.current.text.length > 0);
    act(s, { type: 'fork', branch });
    assert.equal(s.branch, branch);
    assert.equal(s.phase, 'flight');
    const ev = until(s, (st) => st.phase === 'reveal', { bot: 'careful' }).events;
    out[branch] = { ahead: s.clocks.aheadLy, sheet: s.score.sheet, arrive: ev.find((e) => e.type === 'arrive') };
  }
  assert.equal(out.sheet.ahead, out.void.ahead);
  assert.equal(out.sheet.ahead, aheadAt(4));
  assert.equal(out.sheet.sheet, POINTS.sheet);
  assert.equal(out.void.sheet, 0);
  // a crack on the Sheet loses the bonus
  const c = atScan(3);
  act(c, { type: 'select', letter: scanOf(c).target });
  act(c, { type: 'lock' });
  act(c, { type: 'fork', branch: 'sheet' });
  c.flight.heat = 0.99;
  until(c, (st) => st.stats.cracks > 0, { input: { hold: true } });
  until(c, (st) => st.phase === 'reveal', { bot: 'careful' });
  assert.equal(c.stats.cracks, 1);
  assert.equal(c.score.sheet, 0);
});

test('G5: each "On Earth" card shows once, in order; the asteroid card on leg 3 after 98 % of the leg', () => {
  const seen = [];
  let asteroid = null;
  playJourney('careful', {
    seed: 2,
    onTick(st, ev) {
      for (const e of ev.filter((x) => x.type === 'milestone')) {
        seen.push(e.id);
        if (e.id === 'asteroid') asteroid = { stop: st.stop, share: st.flight ? st.flight.ly / legOf(st).lengthLy : 1 };
      }
    },
  });
  assert.deepEqual(seen, MILESTONES.map((m) => m.id));
  assert.equal(asteroid.stop, 2);
  assert.ok(asteroid.share > 0.98 && asteroid.share <= 1, `asteroid at ${asteroid.share}`);
});

test('G6: chapter IV radio: silent at Aldebaran, 2004 ± 1 at Sirius, 2018 ± 1 at Alpha Centauri', () => {
  const at = {};
  let first = null;
  playJourney('careful', {
    seed: 4,
    onTick(st, ev) {
      if (st.phase === 'scan' && st.stop === 10) at.aldebaranScan = st.clocks.radio;
      if (st.phase === 'reveal' && st.stop === 10) at.aldebaran = st.clocks.radio;
      if (st.phase === 'reveal' && st.stop === 11) at.sirius = st.clocks.radio;
      if (st.phase === 'reveal' && st.stop === 12) at.alphaCen = st.clocks.radio;
      if (st.chapter < 3) assert.equal(st.clocks.radio, null);
      const r = ev.find((e) => e.type === 'radio');
      if (r && first === null) first = { stop: st.stop, year: r.year, share: st.flight.ly / legOf(st).lengthLy };
    },
  });
  assert.equal(at.aldebaranScan, null);
  assert.equal(at.aldebaran, null);
  near(at.sirius, 2004, 1, 'radio at Sirius');
  near(at.alphaCen, 2018, 1, 'radio at Alpha Centauri');
  assert.equal(first.stop, 11, 'the first radio comes on the leg to Sirius');
  assert.equal(first.year, 1895);
  assert.ok(first.share > 0.02 && first.share < 0.2, `first radio at ${first.share}`);
});

test('G7: the last pane breaks: the lost lines name the stop and Earth year; Try chapter again restores', () => {
  const s = atFlight(11, { zone: 1, p: 0.6, x: 1, panes: 1 });
  const cp = progressOf(s);
  const ev = until(s, (st) => st.phase === 'lost', { input: { hold: true } }).events;
  const lost = ev.find((e) => e.type === 'lost');
  assert.equal(lost.id, 'sirius');
  assert.equal(s.panes, 0);
  const lines = [s.say.current.text, ...s.say.queue.map((q) => q.text)];
  assert.match(lines[0], /^Your shield gives out (near|on the way to) Sirius\.$/);
  assert.match(lines[1], /^On Earth it is 20\d\d\.$/);
  assert.equal(lines[2], TEXT.lostNobody);
  // the lines play out, then the state rests
  run(s, 60 * 20);
  const rest = structuredClone(s);
  run(s, 60);
  assert.deepEqual(s, rest);
  // Try chapter again
  act(s, { type: 'retryChapter' });
  const ev2 = drainEvents(s);
  assert.equal(s.phase, 'clue');
  assert.equal(s.panes, PANES);
  assert.equal(s.stop, 10);
  assert.equal(s.stats.retries, cp.stats.retries + 1);
  assert.equal(s.score.total, cp.score);
  assert.equal(s.clocks.aheadLy, aheadAt(10));
  assert.ok(ev2.some((e) => e.type === 'chapter' && e.retry && e.progress.stats.retries === 1));
  // a retried journey earns no perfect bonus
  until(s, (st) => st.phase === 'ending', { bot: 'careful', limit: 60 * 400 });
  assert.equal(s.score.perfect, 0);
  // New journey from the lost card starts chapter I with a new seed
  const n = atFlight(0, { zone: VOID_ZONE, x: 1, panes: 1 });
  until(n, (st) => st.phase === 'lost', { input: { hold: true } });
  act(n, { type: 'newJourney', seed: 99 });
  assert.equal(n.seed, 99);
  assert.equal(n.phase, 'clue');
  assert.equal(n.stop, 0);
  assert.equal(n.panes, PANES);
  assert.equal(n.score.total, 0);
});

test('G8: the reckless bot is lost before stop 4 on every seed', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const r = playJourney('reckless', { seed });
    assert.equal(r.state.phase, 'lost', `seed ${seed}`);
    assert.ok(r.lostAt < 3, `seed ${seed} lost at stop ${r.lostAt + 1}`);
  }
});

test('G9: the careful bot gets home with no crack on seeds 1 to 5; the skilled bot outscores it on every seed', () => {
  for (let i = 0; i < 5; i++) {
    const c = careful[i].state, k = skilled[i].state;
    assert.equal(c.phase, 'ending', `careful seed ${i + 1}`);
    assert.equal(c.stats.cracks, 0);
    assert.equal(c.stats.firstTry, 17);
    assert.equal(c.score.perfect, POINTS.perfect);
    assert.equal(c.score.panes, 3 * POINTS.pane);
    assert.equal(c.score.gentle, POINTS.gentle);
    assert.equal(k.phase, 'ending');
    assert.ok(k.score.total > c.score.total, `seed ${i + 1}: skilled ${k.score.total} vs careful ${c.score.total}`);
    // the end record is one save.js accepts
    const res = resultOf(c);
    assert.deepEqual(cleanBest(res), res);
    assert.equal(res.home, true);
    assert.equal(res.reached, 15);
    assert.equal(res.rank, rankFor(c.score.total));
    assert.equal(res.date, '2026-10-13');
    // Earth's clock ran the whole route
    near(c.clocks.earth, routeLengthLy(), 1e-6 * ROUTE_LY, 'Earth years');
    assert.ok(c.clocks.ship > STOPS.reduce((s, _, j) => s + parShipYears(legOf({ stop: j, branch: c.branch })), 0));
  }
});

// The flight grade's par flies the first zone from a standing start. Measured: with every zone at its limit, the best
// possible leg 1 grade was 197 of 500 and the skilled bot beat the careful one by only 1,205 flight points.
test('the grade par is reachable: the first zone from a standing start, the rest at their limits', () => {
  for (let i = 0; i < STOPS.length; i++) {
    for (const branch of STOPS[i].branches ? ['sheet', 'void'] : ['sheet']) {
      const leg = legOf({ stop: i, branch });
      const z = leg.zones[0];
      near(leg.parLimit, parShipYears(leg), 0, `${leg.id} parLimit`);
      near(leg.par, gradePar(leg), 0, `${leg.id} par`);
      assert.ok(leg.par >= leg.parLimit, `${leg.id}: ${leg.par} < ${leg.parLimit}`);
      near(leg.par - leg.parLimit, standingStartYears(leg) - z.ly / Math.sinh(z.limit), 1e-12 * leg.par, leg.id);
    }
  }
  // A pilot who holds from x = 0 until the notch and then sits on it flies the first zone in the standing-start time.
  for (const stop of [0, 5, 14]) {
    const s = atFlight(stop);
    const leg = legOf(s), z = leg.zones[0];
    while (s.flight.zone === 0) {
      update(s, { hold: s.flight.x + THROTTLE_UP * TICK <= z.notch }, TICK);
      drainEvents(s);
    }
    near(s.flight.ship, standingStartYears(leg), 0.02 * standingStartYears(leg), `${leg.id} first zone from rest`);
  }
});

// A zone flown at x = 0 runs at the 0.3 rate floor. The Earth approach was 3.0 s at its notch, so letting go as the
// line says made it 10 s and leg 15 25 s.
test('leg 15: let go as told, the approach to Earth takes about 3 s and still earns the gentle arrival', () => {
  const s = atFlight(14, { zone: 5, x: 0 });
  assert.equal(legOf(s).zones[5].label, 'Earth');
  const { ticks } = until(s, (st) => st.phase !== 'flight' || zoneAt(st).dropout);
  assert.ok(ticks * TICK <= 3.5, `approach ${(ticks * TICK).toFixed(2)} s`);
  until(s, (st) => st.phase === 'ending');
  assert.equal(s.score.gentle, POINTS.gentle);
  // the careful bot's flights stay short enough: no leg over 20 s of screen time
  const time = [];
  playJourney('careful', { seed: 1, onTick: (st) => { if (st.phase === 'flight') time[st.stop] = (time[st.stop] || 0) + TICK; } });
  assert.equal(time.length, STOPS.length);
  time.forEach((t, i) => assert.ok(t >= 7 && t <= 20, `leg ${i + 1}: ${t.toFixed(1)} s`));
});

test('riding the notch pays on every intergalactic leg', () => {
  const heat = (kind) => {
    const legs = [];
    playJourney(kind, { seed: 1, onTick: (st) => {
      if (st.phase === 'flight' && st.stop < 5) legs[st.stop] = Math.max(legs[st.stop] || 0, st.flight.heat);
    } });
    return legs;
  };
  const used = heat('skilled');
  for (let i = 0; i < 5; i++) {
    const c = careful[0].state.stats.legGrades[i], k = skilled[0].state.stats.legGrades[i];
    assert.ok(used[i] > 0.3, `leg ${i + 1}: the skilled bot never pressed the Lens (${used[i]})`);
    assert.ok(k >= c + 50, `leg ${i + 1}: skilled grade ${k} vs careful ${c}`);
    assert.ok(k >= 350, `leg ${i + 1}: skilled grade ${k}`);
  }
  const flight = (r) => r.state.score.flight;
  assert.ok(flight(skilled[0]) - flight(careful[0]) >= 1500, `${flight(skilled[0])} vs ${flight(careful[0])}`);
  assert.equal(rankFor(careful[0].state.score.total), 'Navigator');
  assert.equal(rankFor(skilled[0].state.score.total), 'Lightkeeper');
});

test('the ending: today, both clocks, the address, then the score card', () => {
  const s = careful[0].state;
  const lines = [];
  const said = (st, ev) => lines.push(...ev.filter((e) => e.type === 'say' && e.item.kind === 'ending')
    .map((e) => e.item.text));
  const r = playJourney('careful', { seed: 1, onTick: said });
  assert.ok(lines.includes('It is Tuesday, 13 October 2026.'), lines.join(' | '));
  assert.ok(lines.includes(TEXT.home));
  assert.ok(lines.includes('For Earth: 1,215,266,893 years.'), lines.join(' | '));
  assert.ok(lines.some((l) => /^For you: \d+ years?, \d+ days?\.$/.test(l)));
  assert.deepEqual(lines.slice(-8), TEXT.address.map(([t]) => t));
  assert.equal(r.counts.home, 1);
  assert.equal(s.ending.beat, 4);
  // a tap skips a beat
  const t = fresh();
  start(t, { skipIntro: true });
  jump(t, 14, 'ending');
  act(t, { type: 'advance' });
  assert.equal(t.ending.beat, 1);
});

// ---------- pause, determinism, saves ----------

test('G12: while paused, update does nothing', () => {
  const s = atFlight(0, { x: 0.5 });
  run(s, 30, { hold: true });
  act(s, { type: 'pause' });
  assert.deepEqual(drainEvents(s).map((e) => e.type), ['pause']);
  const before = structuredClone(s);
  run(s, 48, { hold: true });
  assert.deepEqual(s, before);
  act(s, { type: 'select', letter: 'A' });
  act(s, { type: 'advance' });
  assert.deepEqual(s, before, 'play actions wait while paused');
  act(s, { type: 'resume' });
  assert.equal(s.paused, false);
  run(s, 1, { hold: true });
  assert.notDeepEqual(s.flight, before.flight);
});

test('G13: the same seed and inputs give deep-equal states; the state is plain data', () => {
  const a = playJourney('skilled', { seed: 11 }).state;
  const b = playJourney('skilled', { seed: 11 }).state;
  assert.deepEqual(a, b);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.deepEqual(structuredClone(a), a);
  // mid-flight too, with scripted input
  const run2 = () => {
    const s = fresh({ seed: 5 });
    start(s);
    for (let i = 0; i < 60 * 40; i++) {
      for (const x of botStep('reckless', s).actions) act(s, x);
      update(s, { hold: i % 97 < 60 }, TICK);
      drainEvents(s);
    }
    return s;
  };
  assert.deepEqual(run2(), run2());
  assert.notDeepEqual(playJourney('careful', { seed: 1 }).state.draw, playJourney('careful', { seed: 2 }).state.draw);
});

test('progress: Continue resumes a chapter with its score, panes and stats; junk starts a new journey', () => {
  const s = fresh({ firstRun: false });
  start(s);
  until(s, (st) => st.phase === 'chapter' && st.chapter === 2, { bot: 'careful', limit: 60 * 400 });
  const p = progressOf(s);
  assert.equal(p.chapter, 2);
  assert.equal(p.stop, 6);
  const storage = memoryStorage();
  saveProgress(storage, p);
  const t = fresh({ seed: 1, firstRun: false });
  start(t, { progress: readProgress(storage) });
  assert.equal(t.phase, 'clue');
  assert.equal(t.stop, 6);
  assert.equal(t.chapter, 2);
  assert.equal(t.seed, s.seed);
  assert.deepEqual(t.draw, s.draw);
  assert.equal(t.score.total, s.score.total);
  assert.deepEqual(t.score, s.score);
  assert.equal(t.panes, s.panes);
  assert.deepEqual(t.stats, s.stats);
  assert.equal(t.branch, s.branch);
  assert.equal(t.clocks.ship, s.clocks.ship);
  assert.equal(t.clocks.aheadLy, aheadAt(6));
  // a save whose points do not add up keeps its total
  const u = fresh();
  start(u, { progress: { ...p, points: { finds: 'x' } } });
  assert.equal(u.score.total, p.score);
  for (const junk of [{}, { v: 1 }, { ...p, chapter: 0, stop: 0 }, { ...p, stop: 5 }, 'not json', null, [], 7]) {
    const j = fresh();
    start(j, { progress: junk });
    assert.equal(j.stop, 0, JSON.stringify(junk));
    assert.equal(j.phase, 'intro');
  }
});

// ---------- stray actions and bad input ----------

function statesByPhase() {
  const out = {};
  const title = fresh();
  out.title = title;
  const intro = fresh();
  start(intro);
  out.intro = intro;
  const clue = fresh();
  start(clue, { skipIntro: true });
  out.clue = clue;
  out.scan = atScan(0);
  const fork = atScan(3);
  act(fork, { type: 'select', letter: scanOf(fork).target });
  act(fork, { type: 'lock' });
  out.fork = fork;
  out.flight = atFlight(0, { x: 0.3, firstRun: false });
  const reveal = fresh();
  start(reveal, { skipIntro: true });
  jump(reveal, 1, 'reveal');
  out.reveal = reveal;
  const chapter = atFlight(2, { zone: legOf({ stop: 2, branch: null }).zones.length - 1 });
  until(chapter, (st) => st.phase === 'chapter');
  out.chapter = chapter;
  const ending = fresh();
  start(ending, { skipIntro: true });
  jump(ending, 14, 'ending');
  out.ending = ending;
  const lost = fresh();
  start(lost, { skipIntro: true });
  jump(lost, 2, 'lost');
  out.lost = lost;
  for (const s of Object.values(out)) drainEvents(s);
  return out;
}

const ACTIONS = {
  advance: { type: 'advance' }, select: { type: 'select', letter: 'A' }, close: { type: 'close' },
  lock: { type: 'lock' },
  fork: { type: 'fork', branch: 'sheet' }, pause: { type: 'pause' }, resume: { type: 'resume' },
  retryChapter: { type: 'retryChapter' }, newJourney: { type: 'newJourney', seed: 3 },
};
// The actions that fit each phase (advance fits where a caption or beat can be hurried).
const FITS = {
  title: [],
  intro: ['advance', 'pause'], clue: ['advance', 'select', 'pause'], scan: ['select', 'pause'],
  fork: ['fork', 'advance', 'pause'],
  flight: ['pause'], reveal: ['advance', 'pause'], chapter: ['advance', 'pause'],
  ending: ['advance', 'pause', 'newJourney'],
  lost: ['advance', 'pause', 'retryChapter', 'newJourney'],
};

test('actions outside their phase are ignored and emit nothing', () => {
  const states = statesByPhase();
  for (const [phase, s] of Object.entries(states)) {
    assert.equal(s.phase, phase);
    for (const [name, action] of Object.entries(ACTIONS)) {
      if (FITS[phase].includes(name)) continue;
      const before = structuredClone(s);
      act(s, action);
      assert.deepEqual(s.events, [], `${name} in ${phase} emitted ${JSON.stringify(s.events)}`);
      assert.deepEqual(s, before, `${name} in ${phase} changed the state`);
    }
    for (const junk of [null, undefined, {}, { type: 5 }, { type: 'warp' }, { type: 'select', letter: 'D' },
      { type: 'fork', branch: 'up' }, { type: 'settings', settings: 'x' }]) {
      const before = structuredClone(s);
      act(s, junk);
      assert.deepEqual(s, before, `${JSON.stringify(junk)} in ${phase}`);
    }
  }
  // and the fitting ones do something
  for (const [phase, names] of Object.entries(FITS)) {
    for (const name of names) {
      const s = statesByPhase()[phase];
      act(s, ACTIONS[name]);
      assert.ok(s.events.length > 0 || name === 'advance', `${name} in ${phase} emitted nothing`);
    }
  }
});

test('update ignores NaN, negative, infinite and too-long steps; junk input counts as not holding', () => {
  const s = atFlight(0, { x: 0.5 });
  const before = structuredClone(s);
  for (const dt of [NaN, -TICK, 0, Infinity, 1, '0.016', null, undefined]) update(s, { hold: true }, dt);
  assert.deepEqual(s, before);
  const a = structuredClone(before), b = structuredClone(before);
  update(a, { hold: 'yes' }, TICK);
  update(b, { hold: false }, TICK);
  assert.deepEqual(a, b);
  const c = structuredClone(before);
  update(c, null, TICK);
  assert.deepEqual(c, b);
  // title and finished endings do not move
  const t = fresh();
  const tb = structuredClone(t);
  update(t, { hold: true }, TICK);
  assert.deepEqual(t, tb);
  const e = careful[0].state;
  const eb = structuredClone(e);
  update(e, { hold: true }, TICK);
  assert.deepEqual(e, eb);
});

// ---------- helpers and text ----------

test('ranks, results and the leg helpers', () => {
  assert.equal(rankFor(0), 'Drifter');
  assert.equal(rankFor(14999), 'Drifter');
  assert.equal(rankFor(15000), 'Wayfinder');
  assert.equal(rankFor(24999), 'Wayfinder');
  assert.equal(rankFor(25000), 'Navigator');
  assert.equal(rankFor(31999), 'Navigator');
  assert.equal(rankFor(32000), 'Lightkeeper');
  assert.equal(rankFor(NaN), 'Drifter');
  const total = STOPS.reduce((s, _, i) => s + parShipYears(legOf({ stop: i, branch: 'sheet' })), 0);
  near(total, 4.97, 0.01, 'par ship time for the whole route, years');
  near(aheadAt(0), 1215266893, 0.001 * 1215266893, 'route length');
  assert.equal(aheadAt(15), 0);
  const s = atFlight(0, { zone: 1, p: 0.5, x: 0.2 });
  const za = zoneAt(s);
  assert.equal(za.index, 1);
  assert.equal(za.zone.kind, 'waypoint');
  near(za.notchX, 0.333, 0.002, 'notch');
  near(za.nextNotchX, 0.834, 0.002, 'next notch');
  assert.ok(za.nextIn > 0);
  assert.equal(zoneAt(atScan(0)), null);
  const lost = statesByPhase().lost;
  const res = resultOf(lost);
  assert.equal(res.home, false);
  assert.equal(res.reached, 2);
  assert.deepEqual(cleanBest(res), res);
});

test('notchSoon warns 1.5 s of screen time before a zone', () => {
  const s = atFlight(0, { x: 0.3 });
  let warned = null;
  until(s, (st, ev) => {
    const w = ev.find((e) => e.type === 'notchSoon');
    if (w && warned === null) warned = { zone: w.zone, left: zoneAt(st).nextIn };
    return st.flight.zone === 1;
  });
  assert.equal(warned.zone, 1);
  assert.ok(warned.left <= 1.5 + 1e-9 && warned.left > 1.4, `${warned.left}`);
});

// The engine's own lines must not repeat the video narration: the 6-word hashes live in route.test.mjs.
test('the engine\'s lines are our own words: no 6-word run from the narration, no em dashes', () => {
  const src = fs.readFileSync(new URL('./route.test.mjs', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('const NARRATION_6'));
  const hashes = new Set(block.slice(0, block.indexOf(']);')).match(/'([0-9a-z]+)'/g).map((h) => h.slice(1, -1)));
  assert.ok(hashes.size > 250, `${hashes.size} hashes`);
  const SPELL = { centre: 'center', grey: 'gray', neighbour: 'neighbor', neighbours: 'neighbors', colour: 'color',
    metres: 'meters' };
  const words = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/(\d),(\d)/g, '$1$2').split(/[^a-z0-9]+/)
    .filter(Boolean).map((w) => SPELL[w] || w);
  const fnv = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  };
  const lines = [TEXT.crack, TEXT.lostNear('Sirius'), TEXT.lostOnWay('the Coma Cluster'), TEXT.lostWhen('2009'),
    TEXT.lostNobody, TEXT.approach, TEXT.home, TEXT.forYou('4 years, 355 days'), TEXT.forEarth('1,215,266,893'),
    TEXT.noAnimals, ...TEXT.address.map(([t]) => t), 'It is Tuesday, 13 October 2026. You are home.'];
  const joined = lines.join(' ');
  for (const t of [...lines, joined]) {
    assert.ok(!/[—–]/.test(t), t);
    const w = words(t);
    for (let i = 0; i + 6 <= w.length; i++) {
      assert.ok(!hashes.has(fnv(w.slice(i, i + 6).join(' ')).toString(36)), `"${t}" repeats the narration`);
    }
  }
});
