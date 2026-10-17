// Ahead of the Light: the spine (final.md 18.2 to 18.5). Every core module exports the 18.4 API; createRace and
// createRun build the 18.2 shapes; the event list is 18.5's; emit refuses unknown types; stepRace runs its ten parts
// in 18.3's order, advances the course at 6.1's speed (slow motion and hit-stop included), keeps the course window,
// runs card hooks on your events, walks a leg through its phases (and Earth's landing), replays exactly, and
// survives random input. node qa/ahead-of-the-light/race.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import {
  createRace, stepRace, STEP, NO_INTENT, PHASES, EVENTS, EVENT_TYPES, E, HOOKS, emit, rand, isEvent, cardHooks,
} from '../../public/ahead-of-the-light/core/race.js';
import { createRun } from '../../public/ahead-of-the-light/core/run.js';
import { buildLeg } from '../../public/ahead-of-the-light/core/course/gen.js';
import { beatsPerS } from '../../public/ahead-of-the-light/core/ringmath.js';
import { mulberry32 } from '../../public/light-years-home/core/rng.js';
import { playRun } from '../../public/ahead-of-the-light/core/bots.js';

const CORE = '../../public/ahead-of-the-light/core/';
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

// 18.4, module by module: name → 'function' or 'const'.
const API = {
  'handle.js': ['createShip', 'steerShip', 'passCheck', 'stepWell', 'stepContact', 'burn', 'hit', 'windowOf', 'exitsOf',
    'gearOf'],
  'survival.js': ['stepLight', 'pushBack', 'launchState', 'dockPrices', 'buy', 'refund', 'land', 'yearsStep'],
  'rivals.js': ['ROSTER:const', 'pickRegulars', 'createField', 'rivalIntents', 'barkFor', 'legResult'],
  'bosses.js': ['bossStep'],
  'race.js': ['createRace', 'stepRace'],
  'run.js': ['createRun', 'startLeg', 'endLeg', 'breakOf', 'pick', 'skip', 'reroll', 'banish', 'chooseLane',
    'resultOf', 'snapshot', 'restore'],
  'course/kinds.js': ['psiAt', 'blocked', 'resolve'],
  'course/gen.js': ['legSeed', 'buildLeg'],
  'course/validate.js': ['validateLeg'],
  'course/strip.js': ['stripSvg'],
  'course/legs.js': ['LEG_TYPES:const', 'ROUTE:const', 'CONDITIONS:const'],
  'course/director.js': ['stepDirector'],
  'chart.js': ['makeChart', 'chartView'],
  'offer.js': ['makeOffer'],
  'cards.js': ['CARDS:const', 'applyBuild'],
  'meta.js': ['pagesFor', 'unlocksAt', 'shipUnlocks'],
  'save.js': ['serialize', 'restoreSave', 'migrate'],
  'log.js': ['runLogText'],
  'route.js': ['STOPS:const', 'FACTS:const'],
  'bots.js': ['DRIVERS:const', 'POLICIES:const', 'playRun'],
  'tune.js': ['SLUG:const', 'TUNE:const', 'RANGES:const', 'parseOverrides'],
  'ringmath.js': ['phiHazOf', 'phiSkyOf', 'depthPx', 'ringPx', 'screenOf', 'wrap', 'burstPx', 'rivalPx', 'wingsPx',
    'placeLabels', 'lightLabelPx'],
};
const PIECE_FILES = ['common', 'web', 'coma', 'virgo', 'local', 'milkyway', 'orion', 'neighbours', 'earth', 'gates'];

const RACE_KEYS = ['t', 'real', 'legNo', 'leg', 'win', 'ships', 'wells', 'slow', 'stop', 'director', 'phase', 'order',
  'snaps', 'rng', 'hooks', 'events', 'log', 'tune'];
const SHIP_KEYS = ['id', 'kind', 'name', 'type', 'half', 'turnMax', 'bearing', 'target', 'turnRate', 'dist', 'eta',
  'gear', 'bestGear', 'headlight', 'lightspeed', 'punch', 'hull', 'hullMax', 'shield', 'shieldMax', 'shieldT',
  'fuel', 'fuelCap', 'burn', 'gap', 'ttc', 'light', 'lightHold', 'overCap', 'chain', 'chainT', 'flicker',
  'stumble', 'soft', 'whip', 'draft', 'surge', 'shove', 'gate', 'caught', 'wrecked', 'fedBy', 'years', 'earth', 'ai',
  'stats'];
const STATS_KEYS = ['grazes', 'hairs', 'hits', 'burns', 'whips', 'perfect', 'slings', 'slams', 'takedowns', 'glareS',
  'topGear'];
const RUN_KEYS = ['v', 'seed', 'daily', 'ship', 'redshift', 'easy', 'ranked', 'leg', 'phase', 'chart', 'lanes', 'you',
  'build', 'pending', 'pity', 'rerolls', 'banishes', 'banned', 'offer', 'dock', 'field', 'used', 'seen', 'legs',
  'streams'];
const YOU_KEYS = ['hull', 'hullMax', 'shield', 'shieldMax', 'fuel', 'fuelCap', 'gap', 'years', 'earth', 'launchEta'];

// A frozen test leg: knots every 2 beats from beat 6, a rail from 30 to 50.
function testLeg(type = 'web', beats = 96) {
  const items = [];
  for (let b = 6, id = 0; b < beats - 6; b += 2, id++) {
    items.push(Object.freeze({ id, kind: 'knot', beat: b, psi: 0, half: 3 }));
  }
  items.push(Object.freeze({ id: 999, kind: 'rail', beat: 30.5, end: 50, psi: 90, half: 1.5 }));
  items.sort((a, b) => a.beat - b.beat);
  return Object.freeze({ ...buildLeg({ type }), items: Object.freeze(items) });
}

function flyLeg(race, intents = null, maxS = 200) {
  const ev = [];
  const phases = [race.phase];
  while (race.phase !== 'done' && race.real < maxS) {
    for (const e of stepRace(race, intents, STEP)) ev.push(e);
    if (phases[phases.length - 1] !== race.phase) phases.push(race.phase);
  }
  return { ev, phases };
}

test('every core module exports the 18.4 API, and every piece file exports PIECES', async () => {
  for (const [file, names] of Object.entries(API)) {
    const mod = await import(CORE + file);
    for (const entry of names) {
      const [name, kind] = entry.split(':');
      assert.ok(name in mod, `${file} exports ${name}`);
      if (kind === 'const') assert.notEqual(typeof mod[name], 'function', `${file}.${name} is data`);
      else assert.equal(typeof mod[name], 'function', `${file}.${name} is a function`);
    }
  }
  for (const p of PIECE_FILES) {
    const mod = await import(`${CORE}course/pieces/${p}.js`);
    assert.equal(typeof mod.PIECES, 'object', `pieces/${p}.js`);
  }
});

test('createRace and createRun build the 18.2 shapes', () => {
  const run = createRun({ seed: 'KOMAZI' });
  assert.deepEqual(Object.keys(run).sort(), [...RUN_KEYS].sort());
  assert.deepEqual(Object.keys(run.you).sort(), [...YOU_KEYS].sort());
  assert.equal(run.v, 1);
  assert.equal(run.you.gap, TUNE.GAP0);
  assert.equal(run.you.fuel, TUNE.FUEL0);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(run))), JSON.stringify(run), 'the run is JSON-safe');
  const race = createRace({ run, tune: TUNE });
  assert.deepEqual(Object.keys(race).sort(), [...RACE_KEYS].sort());
  assert.equal(race.phase, 'launch');
  assert.ok(PHASES.includes(race.phase));
  const you = race.ships[0];
  assert.deepEqual(Object.keys(you).sort(), [...SHIP_KEYS].sort());
  assert.deepEqual(Object.keys(you.stats).sort(), [...STATS_KEYS].sort());
  assert.equal(you.id, 'you');
  assert.equal(you.kind, 'you');
  assert.equal(you.eta, 1.0);
  assert.equal(you.gap, TUNE.GAP0);
  const ttc0 = TUNE.GAP0 / (1 - Math.tanh(1));
  assert.ok(Math.abs(you.ttc - ttc0) < 0.05, `TTC ${you.ttc}`);
  assert.equal(race.leg.type, 'web');
  assert.equal(race.leg.beats, 96);
  assert.equal(race.tune, TUNE, 'no cards: the tuning rides along unpatched');
});

test('the event list is 18.5\'s, E names each one, and emit refuses an unknown type', () => {
  assert.deepEqual(Object.keys(EVENTS), ['handling', 'survival', 'rivals', 'leg']);
  assert.equal(EVENTS.handling.length, 36);
  assert.equal(EVENTS.survival.length, 18);
  assert.equal(EVENTS.rivals.length, 14);
  assert.deepEqual([...EVENTS.leg], ['gateLine', 'runout', 'vista', 'legEnd']);
  assert.equal(new Set(EVENT_TYPES).size, EVENT_TYPES.length, 'no event is listed twice');
  for (const t of EVENT_TYPES) assert.equal(E[t], t);
  for (const t of ['graze', 'hair', 'lean', 'eaten', 'caught', 'thread', 'gearUp', 'dirtyAir']) {
    assert.ok(isEvent(t), t);
  }
  assert.deepEqual([...HOOKS], ['pass', 'graze', 'hair', 'burn', 'release', 'redIn', 'hit', 'damage', 'shieldPop',
    'rivalPass', 'takedown', 'step']);
  const race = createRace({});
  race.t = 1.25;
  const e = emit(race, E.graze, race.ships[0], { gap: 3 });
  assert.deepEqual(e, { t: 1.25, type: 'graze', ship: 'you', gap: 3 });
  assert.equal(race.events.at(-1), e);
  assert.equal(emit(race, 'hair', 'pike', { t: 1.2 }).t, 1.2, 'a pass inside the step keeps its own time');
  assert.throws(() => emit(race, 'grazed', 'you'), /unknown event type/);
});

test('stepRace runs 18.3\'s ten parts in order', () => {
  const src = readFileSync(new URL(CORE + 'race.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('export function stepRace'), src.indexOf('function windowStep'));
  const order = ['steerShip', 'burn(', 'courseSpeed', 'windowStep', 'passCheck', 'stepWell', 'stepContact', 'cardHooks',
    'stepLight', 'rivalIntents', 'bossStep', 'stepDirector', 'legStep'];
  let at = -1;
  for (const name of order) {
    const i = body.indexOf(name, at + 1);
    assert.ok(i > at, `${name} comes after the part before it`);
    at = i;
  }
  for (let k = 1; k <= 10; k++) assert.ok(body.includes(`// ${k}. `), `part ${k} is marked`);
});

test('the course advances at course speed, frozen in a hit-stop and slowed in slow motion', () => {
  const race = createRace({ leg: testLeg() });
  for (let i = 0; i < 120; i++) stepRace(race, null, STEP);
  const bps = beatsPerS(1.0);
  assert.ok(Math.abs(race.ships[0].dist - bps) < 1e-6, `${race.ships[0].dist} beats in 1 s, want ${bps}`);
  assert.ok(Math.abs(race.t - 1) < 1e-9 && Math.abs(race.real - 1) < 1e-9);
  const d0 = race.ships[0].dist;
  race.stop = TUNE.HITSTOP;
  for (let i = 0; i < 12; i++) stepRace(race, null, STEP);              // 0.1 s, all inside the hit-stop
  assert.equal(race.ships[0].dist, d0, 'frozen');
  assert.ok(Math.abs(race.real - 1.1) < 1e-9, 'real time runs on');
  for (let i = 0; i < 3; i++) stepRace(race, null, STEP);
  race.slow = { x: 0.5, until: race.real + 1 };
  const d1 = race.ships[0].dist, t1 = race.t;
  for (let i = 0; i < 60; i++) stepRace(race, null, STEP);
  assert.ok(Math.abs(race.t - t1 - 0.25) < 1e-9, 'half speed');
  assert.ok(Math.abs(race.ships[0].dist - d1 - 0.25 * bps) < 1e-6);
  for (let i = 0; i < 120; i++) stepRace(race, null, STEP);
  assert.equal(race.slow.x, 1, 'slow motion ends');
  // the stumble glides you STUMBLE seconds of course back over STUMBLE_S
  const r2 = createRace({ leg: testLeg() });
  for (let i = 0; i < 240; i++) stepRace(r2, null, STEP);
  const before = r2.ships[0].dist;
  r2.ships[0].stumble = TUNE.STUMBLE_S;
  for (let i = 0; i < 48; i++) stepRace(r2, null, STEP);                // 0.4 s
  const moved = r2.ships[0].dist - before;
  assert.ok(Math.abs(moved - (0.4 - TUNE.STUMBLE) * bps) < 1e-6, `moved ${moved}`);
});

test('the course window: items join 12 beats ahead of the leader and leave 4 behind the last', () => {
  const race = createRace({ leg: testLeg() });
  const items = race.leg.items;
  for (let i = 0; i < 1200; i++) {
    stepRace(race, null, STEP);
    const d = race.ships[0].dist, { lo, hi } = race.win;
    for (let k = 0; k < items.length; k++) {
      const it = items[k], inside = k >= lo && k < hi;
      if (it.beat - d < TUNE.SPAWN_BEATS - 0.1 && (it.end ?? it.beat) > d - TUNE.GONE_BEATS + 0.1 && it.beat >= 0) {
        assert.ok(inside, `item ${it.id} at beat ${it.beat} should be in the window at ${d.toFixed(2)}`);
      }
      if (it.beat - d > TUNE.SPAWN_BEATS + 0.1) assert.ok(!inside, `item ${it.id} joined early`);
    }
  }
});

// The leg machine is under test here, not the handling or the light: the ship steers clear of testLeg's knots (on
// psi 0) and its rail (psi 90), the light holds still (BLEED 0), and only the leg group's events are compared.
const STILL = Object.freeze({ ...TUNE, BLEED: 0 });
const CLEAR = { you: { target: -90 } };
const legGroup = (ev, more = []) => ev.filter((e) => EVENTS.leg.includes(e.type) || more.includes(e.type)).map((e) => e.type);

test('a leg walks launch → race → gate → runout → done, with the gate line, run-out, vista and end', () => {
  const race = createRace({ leg: testLeg(), tune: STILL });
  const { ev: all, phases } = flyLeg(race, CLEAR);
  const ev = all.filter((e) => EVENTS.leg.includes(e.type));
  assert.deepEqual(phases, ['launch', 'race', 'gate', 'runout', 'done']);
  assert.deepEqual(legGroup(all), ['gateLine', 'runout', 'vista', 'legEnd']);
  assert.equal(ev[0].place, 1);
  assert.deepEqual(race.order, ['you']);
  assert.equal(ev.at(-1).why, 'gate');
  assert.equal(ev.at(-1).place, 1);
  assert.ok(Math.abs(race.real - 96 / beatsPerS(1)) < 0.05, `the leg took ${race.real.toFixed(2)} s`);
  assert.deepEqual(stepRace(race, null, STEP), [], 'a finished race does nothing');
  // Earth ends at the door with the landing
  const earth = createRace({ leg: testLeg('earth', 128), tune: STILL });
  const e2 = flyLeg(earth, CLEAR);
  assert.deepEqual(e2.phases, ['launch', 'race', 'gate', 'done']);
  assert.deepEqual(legGroup(e2.ev, ['door', 'land']), ['gateLine', 'door', 'land', 'legEnd']);
  assert.equal(e2.ev.at(-1).why, 'home');
  // caught ends the leg at once
  const c = createRace({ leg: testLeg() });
  for (let i = 0; i < 100; i++) stepRace(c, null, STEP);
  c.ships[0].caught = true;
  const ce = stepRace(c, null, STEP);
  assert.equal(c.phase, 'done');
  assert.deepEqual(ce.map((e) => [e.type, e.why]), [['legEnd', 'caught']]);
});

test('card hooks run on your events in order, never a rival\'s, and the step hook once a step', () => {
  const race = createRace({ leg: testLeg() });
  const got = [];
  race.hooks = {
    graze: [(ctx) => got.push(['graze', ctx.event.gap, ctx.ship.id, ctx.tune === TUNE]),
      (ctx) => { got.push(['second']); emit(ctx.race, 'graze', 'you', { gap: 9 }); }],
    takedown: [(ctx) => got.push(['takedown', ctx.event.by])],
    step: [(ctx) => got.push(['step', ctx.event, ctx.dt])],
  };
  race.events = [];
  emit(race, 'graze', 'you', { gap: 4 });
  emit(race, 'graze', 'pike', { gap: 5 });                      // a rival's graze is not yours
  emit(race, 'takedown', 'pike', { by: 'you', victim: 'pike' }); // your takedown, on PIKE's ship
  emit(race, 'hair', 'you', { gap: 1 });                         // no hook for it
  cardHooks(race, 0.5);
  assert.deepEqual(got, [['graze', 4, 'you', true], ['second'], ['takedown', 'you'], ['step', null, 0.5]]);
  assert.equal(race.events.length, 5, 'the hook\'s own graze was emitted, and ran no hooks');
  // in a whole leg, the step hook runs once for every step that moves
  const r2 = createRace({ leg: testLeg() });
  let steps = 0, moving = 0;
  r2.hooks = { step: [() => { steps++; }] };
  while (r2.phase !== 'done') { stepRace(r2, null, STEP); moving++; }
  assert.equal(steps, moving);
});

test('the same run and intents replay exactly; the rng streams are mulberry32', () => {
  const play = () => {
    const run = createRun({ seed: 'KOMAZI' });
    const race = createRace({ run, leg: testLeg() });
    const out = [];
    for (let i = 0; i < 3000 && race.phase !== 'done'; i++) {
      out.push(...stepRace(race, { you: { target: Math.sin(i / 50) * 40, turn: i % 400 < 30 ? 1 : 0,
        action: i % 97 === 0 ? 'down' : null, burn: i % 501 === 0 } }, STEP));
    }
    return hash({ out, d: race.ships[0].dist, rng: race.rng });
  };
  assert.equal(play(), play());
  const race = createRace({});
  const seed = race.rng.ai;
  const m = mulberry32(seed);
  for (let i = 0; i < 20; i++) assert.equal(rand(race, 'ai'), m());
  assert.ok(rand(race, 'new-stream') >= 0, 'a new stream starts from its name');
});

test('10,000 steps of random intents and dt: no NaN, no throw', () => {
  let x = 7;
  const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  let race = createRace({ run: createRun({ seed: 'NAPOLI' }), leg: testLeg() });
  for (let i = 0; i < 10000; i++) {
    const r = rnd();
    const intent = r < 0.3 ? { target: (rnd() - 0.5) * 400, turn: 0 }
      : r < 0.6 ? { target: null, turn: Math.floor(rnd() * 3) - 1 }
      : r < 0.62 ? null : r < 0.64 ? { target: NaN, turn: 'x', action: 'down', burn: true } : NO_INTENT;
    const dt = rnd() < 0.02 ? [NaN, -1, 5, Infinity][Math.floor(rnd() * 4)] : 0.001 + rnd() * 0.049;
    stepRace(race, intent ? { you: intent } : null, dt);
    for (const k of ['t', 'real']) assert.ok(Number.isFinite(race[k]), `${k} at step ${i}`);
    for (const k of ['dist', 'eta', 'gap', 'bearing']) assert.ok(Number.isFinite(race.ships[0][k]), `${k} at ${i}`);
    if (race.phase === 'done') race = createRace({ run: createRun({ seed: i }), leg: testLeg() });
  }
});

// With live handling an idle ship meets knots and rails, and the light and hits are live: run.test's tune (no stumble,
// no bleed, a 99 hull) lets it reach Earth. The exact event count and time hold only for an empty leg (above).
test('a whole stub run plays headless from leg 1 to Earth', () => {
  const RUN_TUNE = Object.freeze({ ...TUNE, STUMBLE: 0, BLEED: 0, HULL0: 99, HULL_MAX: 99, HULL_CAP: 99 });
  const s = playRun({ seed: 'KOMAZI', driver: 'idle', tune: RUN_TUNE });
  assert.equal(s.legs, 8);
  assert.equal(s.phase, 'home');
  assert.ok(s.events >= 7 * 4 + 4, `${s.events} events`);
});
