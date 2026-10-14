// Light Years Home v3: the event kit (final.md 18.1, 9; races §2). Round 1 has one timed event, the Wall's First Light;
// Coma's opponents (D100, Vela) are checked on their own. Checks: the bots finish every seed; the medal times agree
// with what the bots drive; restart timing (control at 0.6 s, the
// clock at 1.6 s from the press); start normalisation; accidental starts cancel quietly; a tap goes back to the last
// gate; off course and turning away; Vela's band; D100's time; something within 4 u every 3 s; determinism.
// node qa/light-years-home/v3/race.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { startEvent, course, medalOf, starsOf, restartEvent, eventById } from '../../../public/light-years-home/core/race.js';
import { actionOf } from '../../../public/light-years-home/core/zone.js';
import { BOTS } from '../../../public/light-years-home/core/bots.js';
import { hashState } from '../../../public/light-years-home/core/hash.js';
import { builtOf } from '../../../public/light-years-home/core/game.js';
import { query, STATIC_BASE } from '../../../public/light-years-home/core/collide.js';
import { posAt } from '../../../public/light-years-home/core/traffic.js';
import { wireAll, newGame, run, of, place, median, WALL, COMA, H } from './activities.mjs';

wireAll();
const SEEDS = [1, 2, 3, 4, 5];
const FL = WALL.events.find((e) => e.id === 'first-light');
const TIMED = WALL.events.filter((e) => ['sprint', 'circuit', 'showcase', 'rival'].includes(e.type));

// One run of a bot from the event's run-up (the start ring arms it, the clock starts at the ring).
function race(event, skill, seed, extra = {}) {
  const game = newGame({ seed, ...extra });
  startEvent(game, event.id, { fromRunup: true });
  const bot = BOTS[skill].make({ event: event.id, seed });
  let gapMax = 0, lastClose = null;
  const res = run(game, (g) => bot.next(g), 60, {
    until: (g) => {
      if (extra.closeness && g.race?.state === 'running') {
        // Something within 4 u (a body's surface, traffic or a gate's ring) at least every 3 s.
        const t = g.eventT;
        if (lastClose === null) lastClose = t;
        if (nearest(g) <= 4) lastClose = t;
        gapMax = Math.max(gapMax, t - lastClose);
      }
      return g.race?.state === 'finished' || (!g.race && g.t > 3);
    },
  });
  const fin = of(res.events, 'finish')[0] || null;
  return { game, fin, events: res.events, gapMax };
}

const IDS = new Int32Array(512), BP = [0, 0, 0];
function nearest(game) {
  const built = builtOf(game), s = game.ship;
  let best = Infinity;
  const n = query(built.grid, s.pos, 16, IDS);
  for (let i = 0; i < n; i++) {
    const id = IDS[i];
    if (id >= STATIC_BASE) {
      const b = built.statics[id - STATIC_BASE];
      best = Math.min(best, Math.hypot(b.pos[0] - s.pos[0], b.pos[1] - s.pos[1], b.pos[2] - s.pos[2]) - b.rc);
    } else {
      posAt(built.traffic, id, game.zoneT, BP);
      best = Math.min(best, Math.hypot(BP[0] - s.pos[0], BP[1] - s.pos[1], BP[2] - s.pos[2]) - built.traffic.size[id]);
    }
  }
  const ev = eventById(game, game.race.id);
  for (const g of course(ev).gates) best = Math.min(best, Math.abs(Math.hypot(g.pos[0] - s.pos[0], g.pos[1] - s.pos[1]) - g.r));
  return best;
}

// The medal table the bots imply (races §2.6): Tern the expert's best, gold × 1.07, silver the slower of Tern × 1.2
// and the mid bot's median, bronze the slower of Tern × 1.5 and the beginner's worst × 1.05; rounded up to 0.1 s
// under 20 s and 0.5 s above.
const runs = new Map();
function botTimes(event) {
  if (runs.has(event.id)) return runs.get(event.id);
  const out = {};
  for (const skill of ['beginner', 'mid', 'expert']) out[skill] = SEEDS.map((seed) => race(event, skill, seed).fin);
  runs.set(event.id, out);
  return out;
}
const up = (v) => { const q = v < 20 ? 0.1 : 0.5; return Math.round(Math.ceil(v / q - 1e-9) * q * 10) / 10; };

test('every bot finishes every seed of every timed event', (t) => {
  for (const ev of TIMED) {
    const b = botTimes(ev);
    for (const skill of Object.keys(b)) {
      const times = b[skill].map((f) => (f ? f.time.toFixed(2) : 'DNF'));
      t.diagnostic(`${ev.id} ${skill}: ${times.join(' ')}`);
      assert.ok(b[skill].every(Boolean), `${ev.id} ${skill}: ${times.join(' ')}`);
    }
    const ex = median(b.expert.map((f) => f.time)), beg = Math.max(...b.beginner.map((f) => f.time));
    assert.ok(beg <= ex * 1.8, `${ev.id}: the beginner's worst ${beg.toFixed(2)} within 1.8 × the expert's ${ex.toFixed(2)}`);
  }
});

test('the medal times agree with the bots (expert within 10% of Tern, mid silver, beginner bronze on 5 of 5)', (t) => {
  for (const ev of TIMED) {
    const b = botTimes(ev);
    const ex = b.expert.map((f) => f.time), mid = b.mid.map((f) => f.time), beg = b.beginner.map((f) => f.time);
    const tern = up(Math.min(...ex));
    const table = { tern, gold: up(tern * 1.07), silver: up(Math.max(tern * 1.2, median(mid))),
      bronze: up(Math.max(tern * 1.5, Math.max(...beg) * 1.05)) };
    t.diagnostic(`${ev.id}: data ${ev.tern}/${ev.gold}/${ev.silver}/${ev.bronze}; bots ${table.tern}/${table.gold}/${table.silver}/${table.bronze}`);
    assert.ok(median(ex) <= ev.tern * 1.1, `${ev.id}: expert median ${median(ex).toFixed(2)} against Tern ${ev.tern}`);
    assert.ok(median(mid) <= ev.silver, `${ev.id}: mid median ${median(mid).toFixed(2)} against silver ${ev.silver}`);
    for (const x of beg) assert.ok(medalOf(ev, x), `${ev.id}: beginner ${x.toFixed(2)} against bronze ${ev.bronze}`);
  }
});

test('restart: control back 0.6 s and the clock 1.6 s after the press (a 0.35 s hold)', () => {
  const R = newGame().tune.RACE;
  for (const seed of [1, 3]) {
    const game = newGame({ seed });
    startEvent(game, 'first-light', { fromRunup: true });
    const bot = BOTS.mid.make({ event: 'first-light', seed });
    run(game, (g) => bot.next(g), 6, { until: (g) => g.race?.state === 'running' && g.eventT > 3 });
    assert.equal(game.race.state, 'running');
    assert.equal(actionOf(game)?.id, 'restart');
    // Hold the action control: actionHeld grows each step (the input record's semantics).
    const press = game.t;
    let held = 0, control = null, clock = null;
    run(game, (g) => {
      held += H;
      const r = bot.next(g);
      r.actionHeld = held <= R.RESTART_HOLD + 0.05 ? held : 0;
      return r;
    }, 4, {
      onEvent: (e, g) => {
        if (e.type === 'eventStart' && e.restart) clock = g.t;
      },
      until: (g) => {
        if (control === null && g.race?.state === 'armed') control = g.t;
        return clock !== null;
      },
    });
    assert.ok(control !== null && clock !== null);
    // The press began H after the last step before it; control is back on the step after controlAt.
    assert.ok(Math.abs(control - press - R.CONTROL_BACK) <= 2 * H, `control at ${(control - press).toFixed(3)} s`);
    assert.ok(Math.abs(clock - press - R.CLOCK_START) <= 0.05, `clock at ${(clock - press).toFixed(3)} s`);
    assert.ok(game.t >= game.lockUntil, 'the controls are live again');
  }
});

test('start normalisation: crossing at 18 and at 45 u/s gives the same speed and bar 0.2 s later', () => {
  const c = course(FL);
  const out = [];
  for (const [speed, bar] of [[18, 0.1], [45, 0.95]]) {
    const game = newGame({ seed: 1 });
    const back = 6;
    place(game, [c.start.pos[0] - c.start.dir[0] * back, c.start.pos[1] - c.start.dir[1] * back, 0],
      (Math.atan2(c.start.dir[0], c.start.dir[1]) * 180) / Math.PI, speed);
    game.ship.bar = bar;
    let started = null;
    run(game, () => ({}), 1, { onEvent: (e, g) => { if (e.type === 'eventStart') started = g.t; },
      until: (g) => started !== null && g.t >= started + 0.2 - 1e-9 });
    assert.ok(started !== null, `started at ${speed} u/s`);
    out.push([game.ship.speed, game.ship.bar]);
  }
  assert.ok(Math.abs(out[0][0] - 30) < 0.05 && Math.abs(out[1][0] - 30) < 0.05, JSON.stringify(out));
  assert.ok(Math.abs(out[0][1] - 0.5) < 1e-9 && Math.abs(out[1][1] - 0.5) < 1e-9, JSON.stringify(out));
});

test('accidental starts cancel quietly: through the ring, then away', () => {
  const c = course(FL);
  const game = newGame({ seed: 2 });
  place(game, [c.start.pos[0] - c.start.dir[0] * 5, c.start.pos[1] - c.start.dir[1] * 5, 0],
    (Math.atan2(c.start.dir[0], c.start.dir[1]) * 180) / Math.PI, 26);
  const { events } = run(game, (g) => ({ steer: g.race ? 1 : 0, source: 'keys' }), 8);
  assert.equal(of(events, 'eventStart').length, 1);
  const cancel = of(events, 'cancel');
  assert.equal(cancel.length, 1);
  assert.equal(cancel[0].quiet, true);
  assert.equal(of(events, 'finish').length, 0);
  assert.equal(game.race, null);
  // Never reaching the first gate in time cancels too (2 × its Tern-pace time, at least 6 s): brake to a crawl.
  const g2 = newGame({ seed: 2 });
  place(g2, [c.start.pos[0] - c.start.dir[0] * 5, c.start.pos[1] - c.start.dir[1] * 5, 0],
    (Math.atan2(c.start.dir[0], c.start.dir[1]) * 180) / Math.PI, 26);
  const r2 = run(g2, (g) => ({ brake: g.race ? 1 : 0, source: 'keys' }), 12);
  assert.equal(of(r2.events, 'cancel').length, 1);
});

test('a tap goes back to the last gate, and the clock keeps running', () => {
  const game = newGame({ seed: 4 });
  startEvent(game, 'first-light', { fromRunup: true });
  const bot = BOTS.mid.make({ event: 'first-light', seed: 4 });
  run(game, (g) => bot.next(g), 20, { until: (g) => g.race?.gate >= 2 });
  const c = course(FL);
  const t0 = game.eventT;
  const r = bot.next(game);
  r.action = true;
  const { events } = run(game, () => r, H);
  const back = of(events, 'toGate')[0];
  assert.ok(back, 'toGate');
  assert.equal(back.i, 1);
  const g1 = c.gates[1].pos;
  assert.ok(Math.hypot(game.ship.pos[0] - g1[0], game.ship.pos[1] - g1[1]) < 3, 'at gate 1');
  assert.ok(game.eventT > t0, 'the clock runs on');
  assert.equal(game.race.gate, 2);
});

test('off course for OFF_BACK s puts you back at the last gate', () => {
  const game = newGame({ seed: 4 });
  startEvent(game, 'first-light', { fromRunup: true });
  const bot = BOTS.mid.make({ event: 'first-light', seed: 4 });
  run(game, (g) => bot.next(g), 20, { until: (g) => g.race?.gate >= 3 });
  // Lost: 150 u west of the line, driving on west.
  place(game, [game.ship.pos[0] - 150, game.ship.pos[1], 0], 270, 24);
  let back = null;
  const { events } = run(game, () => ({ source: 'keys' }), 12, { until: (g, e) => {
    if (g.race?.off && back === null) back = g.eventT;
    return of(e, 'toGate').length;
  } });
  const R = game.tune.RACE;
  assert.equal(of(events, 'toGate').length, 1);
  assert.equal(game.race?.state, 'running');
  const g2 = course(FL).gates[2].pos;
  assert.ok(Math.hypot(game.ship.pos[0] - g2[0], game.ship.pos[1] - g2[1]) < 3, 'back at gate 3 of 5 (index 2)');
  assert.ok(back !== null, 'the chevron showed first');
});

test('Vela without the band finishes within 1% of Tern × pace; with it never faster than Tern × 1.02', () => {
  const ev = COMA.events.find((e) => e.id === 'ring-road-rush');
  for (const assists of ['pilot', 'cruise']) {
    const game = newGame({ zone: COMA, seed: 1, settings: { assists } });
    assert.ok(game.actors.find((a) => a.id === 'vela'), 'Vela is in Coma');
    startEvent(game, ev.id, { fromRunup: true });
    // The player crosses the start and then sits still: Vela races alone (Cruise: she leads, the band slows her).
    run(game, () => ({}), 3, { until: (g) => g.race?.state === 'running' });
    game.race.firstAt = 1e9;
    let done = null;
    run(game, (g) => { g.race.turnT = 0; g.race.offT = 0; g.ship.speed = 0; g.ship.vel.fill(0); return { brake: 1 }; }, 60,
      { until: (g) => { if (g.race?.opp?.done) done = g.race.opp.doneT; return done !== null; } });
    assert.ok(done !== null, `${assists}: she finishes`);
    const pace = ev.tern * ev.rival.paceX;
    if (assists === 'pilot') assert.ok(Math.abs(done - pace) / pace < 0.01, `pilot ${done.toFixed(2)} against ${pace}`);
    else assert.ok(done >= ev.tern / 1.02 - 0.05, `cruise ${done.toFixed(2)} never faster than Tern × 1.02`);
  }
});

test('D100 hits its time in Race the Jellyfish', () => {
  const ev = COMA.events.find((e) => e.id === 'race-the-jellyfish');
  const game = newGame({ zone: COMA, seed: 1 });
  startEvent(game, ev.id, { fromRunup: true });
  run(game, () => ({}), 3, { until: (g) => g.race?.state === 'running' });
  let done = null;
  run(game, (g) => { g.race.turnT = 0; g.race.offT = 0; g.race.firstAt = 1e9; return {}; }, 30,
    { until: (g) => { if (g.race?.opp?.done) done = g.race.opp.doneT; return done !== null; } });
  assert.ok(done !== null && Math.abs(done - ev.opponent.time) < 0.1, `D100 ${done}`);
});

test('the expert bot passes something within 4 u at least every 3 s', () => {
  for (const ev of TIMED) {
    for (const seed of [1, 2]) {
      const r = race(ev, 'expert', seed, { closeness: true });
      assert.ok(r.fin, `${ev.id} seed ${seed} finishes`);
      assert.ok(r.gapMax <= 3, `${ev.id} seed ${seed}: ${r.gapMax.toFixed(2)} s with nothing within 4 u`);
    }
  }
});

test('the same seed and inputs give the same time and the same state hash', () => {
  const a = race(FL, 'mid', 3), b = race(FL, 'mid', 3);
  assert.equal(a.fin.time, b.fin.time);
  assert.equal(hashState(a.game), hashState(b.game));
});

test('medals and stars read their thresholds', () => {
  assert.equal(medalOf(FL, FL.tern), 'tern');
  assert.equal(medalOf(FL, FL.gold), 'gold');
  assert.equal(medalOf(FL, FL.silver - 0.01), 'silver');
  assert.equal(medalOf(FL, FL.bronze), 'bronze');
  assert.equal(medalOf(FL, FL.bronze + 0.01), null);
  assert.equal(medalOf({ medals: { author: 50, gold: 54, silver: 60, bronze: 75 } }, 53), 'gold');
  const trap = WALL.events.find((e) => e.id === 'void-run');
  assert.deepEqual([39, 41, 45, 48].map((v) => starsOf(trap, v)), [0, 1, 2, 3]);
  const line = WALL.events.find((e) => e.id === 'sloan-pads');
  assert.equal(starsOf(line, { all: true, exit: true, perfect: false }), 2);
  assert.equal(starsOf(line, { all: false }), 0);
});

test('a finished race offers AGAIN, and AGAIN restarts with the same timing', () => {
  const game = newGame({ seed: 5 });
  startEvent(game, 'first-light', { fromRunup: true });
  const bot = BOTS.mid.make({ event: 'first-light', seed: 5 });
  run(game, (g) => bot.next(g), 40, { until: (g) => g.race?.state === 'finished' });
  assert.equal(actionOf(game)?.id, 'again');
  const press = game.t;
  restartEvent(game, null, press);
  let clock = null;
  run(game, (g) => bot.next(g), 3, { onEvent: (e, g) => { if (e.type === 'eventStart') clock = g.t; }, until: () => clock !== null });
  assert.ok(Math.abs(clock - press - game.tune.RACE.CLOCK_START) < 0.05, `clock at ${clock - press}`);
});
