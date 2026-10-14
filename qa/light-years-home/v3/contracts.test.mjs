// Light Years Home v3: the WP0 contracts. Event names and the buffer (final.md 5.3), the vector helpers, the game
// skeleton (state shape 5.1, input 5.2, modes, clocks, time scale, slots) and the world schema against the design's
// Chapter 1 data. node qa/light-years-home/v3/contracts.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { EV, EV_GROUPS, EV_LIST, isEvent, createEventBuffer } from '../../../public/light-years-home/core/events.js';
import * as V from '../../../public/light-years-home/core/vec.js';
import {
  createGame, step, advance, enterZone, setMode, resume, canEnter, MODES, H, wire, unwire, SLOTS, makeInput,
  cleanInput, hitStop, slowMo, lock, rand, zoneOf, parentOf, builtOf, createClock, frameSteps, MAX_STEPS, newShip,
} from '../../../public/light-years-home/core/game.js';
import { TUNE } from '../../../public/light-years-home/core/tune.js';
import { mulberry32, hashSeed } from '../../../public/light-years-home/core/rng.js';
import { checkZone, checkEvent, checkMission, checkLine } from '../../../public/light-years-home/core/world/schema.js';
import {
  WALL, COMA, VIRGO_JET, ANDROMEDA_EDGE, MISSIONS, LINES, FIRST_LIGHT,
} from './fixtures.mjs';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const vnear = (a, b, eps = 1e-9) => a.every((x, i) => near(x, b[i], eps));

// ---------------------------------------------------------------- events

test('EV holds every type of final.md 5.3, once', () => {
  const want = {
    ship: 'near hairline thread skimStart skimEnd draftStart draftEnd driftStart driftTier driftBoost driftLost '
      + 'boostStart boostEnd scrape crash bigCrash takedown sling perfectSling edgeTurn planeChange pad padPerfect spark '
      + 'chainUp chainBank chainLost',
    zone: 'ringSeen scanStart scan farScan lookHome rumour secret setItem setDone exitOpen zoomIn zoomOut scaleCard arrive',
    events: 'eventSeen eventArm eventStart gate gateMiss split lap finish cancel restart toGate stuntStart stuntResult',
    missions: 'missionOffer missionStart beat cargoHit cargoBreak hook release fail retry skipOffer missionDone fix',
    talk: 'line lineEnd lineDrop lineSkip',
    jump: 'runupRing runupMiss punch jGraze jHairline jThread jPad jSkim jHit nine headlight fork setPiece earthCard vista '
      + 'drop longHaul jumpMedal',
    game: 'mode pause resume chapterEnd',
  };
  for (const [group, names] of Object.entries(want)) assert.deepEqual([...EV_GROUPS[group]], names.split(' '), group);
  const all = Object.values(want).join(' ').split(' ');
  assert.equal(EV_LIST.length, all.length);
  assert.equal(new Set(EV_LIST).size, EV_LIST.length, 'no type twice');
  for (const name of all) assert.equal(EV[name], name);
  assert.ok(Object.isFrozen(EV) && isEvent('near') && !isEvent('nope'));
});

test('the event buffer stamps t, refuses unknown types, grows and clears', () => {
  const ev = createEventBuffer(2);
  ev.t = 1.5;
  ev.push(EV.near, { gap: 1.2, side: -1 });
  ev.push(EV.gate, { kind: 'bullseye' });
  ev.t = 2;
  ev.push(EV.finish, { medal: 'gold' });
  assert.equal(ev.n, 3);
  assert.deepEqual(ev.list[0], { type: 'near', t: 1.5, gap: 1.2, side: -1 });
  assert.equal(ev.list[2].t, 2);
  assert.equal(ev.count('gate'), 1);
  assert.deepEqual(ev.last(1).map((e) => e.type), ['finish']);
  assert.throws(() => ev.push('nearMiss'), /unknown event type/);
  ev.clear();
  assert.equal(ev.n, 0);
  assert.equal(ev.list[0], null, 'cleared slots let go of old events');
  assert.equal(ev.push('near', { type: 'crash' }).type, 'near', 'a payload cannot change the type');
});

// ---------------------------------------------------------------- vectors

test('vector helpers write into out and allow out to be an input', () => {
  const a = V.v3(1, 2, 3), b = V.v3(4, 5, 6), out = V.v3();
  assert.deepEqual(V.add(out, a, b), [5, 7, 9]);
  assert.deepEqual(V.sub(out, b, a), [3, 3, 3]);
  assert.deepEqual(V.scale(out, a, 2), [2, 4, 6]);
  assert.deepEqual(V.madd(out, a, b, 0.5), [3, 4.5, 6]);
  assert.equal(V.dot(a, b), 32);
  assert.deepEqual(V.cross(out, [1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  const c = [1, 2, 3];
  V.cross(c, c, [0, 0, 1]);
  assert.deepEqual(c, [2, -1, 0], 'out may alias an input');
  assert.ok(near(V.len(V.norm(out, [3, 4, 0])), 1));
  assert.deepEqual(V.norm(out, [0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(V.lerp(out, [0, 0, 0], [2, 4, 6], 0.5), [1, 2, 3]);
  assert.equal(V.dist([0, 0, 0], [3, 4, 0]), 5);
  assert.equal(V.dist2([0, 0, 0], [3, 4, 0]), 25);
  assert.deepEqual(V.copy(out, a), [1, 2, 3]);
  assert.deepEqual(V.set(out, 7, 8, 9), [7, 8, 9]);
});

test('rotateAbout is right-handed and keeps length', () => {
  const out = V.rotateAbout(V.v3(), [1, 0, 0], [0, 0, 1], Math.PI / 2);
  assert.ok(vnear(out, [0, 1, 0]));
  const r = V.rotateAbout(V.v3(), [1, 2, 3], V.norm(V.v3(), [1, 1, 0]), 1.234);
  assert.ok(near(V.len(r), Math.hypot(1, 2, 3), 1e-12));
});

test('basisFrom: heading is clockwise from north, as on the map', () => {
  const f = V.v3(), r = V.v3();
  V.basisFrom([0, 0, 1], 0, f, r);
  assert.ok(vnear(f, [0, 1, 0]) && vnear(r, [1, 0, 0]), 'north, right is east');
  V.basisFrom([0, 0, 1], Math.PI / 2, f, r);
  assert.ok(vnear(f, [1, 0, 0]) && vnear(r, [0, -1, 0]), 'east, right is south');
  assert.ok(near(V.headingOf([1, 0, 0]), Math.PI / 2));
  const up = V.norm(V.v3(), [0.3, -0.2, 0.9]);
  V.basisFrom(up, 0.7, f, r);
  assert.ok(near(V.len(f), 1) && near(V.len(r), 1) && near(V.dot(f, up), 0) && near(V.dot(r, up), 0) && near(V.dot(f, r), 0));
  V.basisFrom([0, 1, 0], 0, f, r);
  assert.ok(near(V.len(f), 1) && near(V.dot(f, [0, 1, 0]), 0), 'up along +y still gives a frame');
});

// ---------------------------------------------------------------- the game skeleton

const keys = (o) => Object.keys(o).sort();

test('createGame returns the state shape of final.md 5.1', () => {
  unwire();
  const g = createGame({ seed: 7 });
  assert.deepEqual(keys(g), ['activity', 'actors', 'arrivalT', 'chapter', 'earth', 'eventT', 'jump', 'lockUntil', 'mission',
    'mode', 'modeT', 'near', 'pocketId', 'prevMode', 'progress', 'race', 'rng', 'seed', 'settings', 'ship', 'slowUntil',
    'slowX', 'stats', 'steps', 'stopUntil', 'story', 'stunt', 't', 'talk', 'timeScale', 'today', 'tune', 'v', 'zone', 'zoneId',
    'zoneT'].sort());
  assert.deepEqual(keys(g.ship), ['bank', 'bar', 'barMax', 'boostT', 'boosting', 'burstT', 'cargo', 'chain', 'climbS', 'db',
    'draft', 'drift', 'edgeT', 'flickerT', 'hop', 'kickT', 'lastHitT', 'pitch', 'pos', 'prev', 'skim', 'slip', 'snapT',
    'speed', 'steerS', 'stunT', 'tow', 'up', 'vel', 'yaw'].sort());
  assert.deepEqual(keys(g.ship.drift), ['autoT', 'charge', 'dir', 'on', 't', 'tier']);
  assert.deepEqual(keys(g.zone), ['exitOpen', 'id', 'lookHome', 'rumours', 'scaleCardUntil', 'scan', 'scanned', 'secretT',
    'secrets', 'seen', 'sets', 'sparks', 'waypoint'].sort());
  assert.deepEqual(keys(g.near), ['coolUntil', 'gap', 'ids', 'n', 'rel']);
  assert.ok(g.near.ids instanceof Int32Array && g.near.gap instanceof Float32Array && g.near.ids.length === 64);
  assert.deepEqual(keys(g.talk), ['cur', 'lastEndT', 'log', 'queue', 'quietUntil', 'redshiftT']);
  assert.deepEqual(keys(g.progress), ['events', 'jumps', 'missions', 'postcards', 'stripes', 'stunts', 'tapes', 'trails',
    'zones']);
  assert.deepEqual(keys(g.stats), ['crashes', 'drifts', 'hairline', 'near', 'playT', 'scans', 'takedowns']);
  assert.deepEqual(keys(g.settings), ['assists', 'autoDrift', 'hand', 'invertClimb', 'reducedMotion', 'scheme',
    'slowCaptions']);
  assert.equal(g.v, 3);
  assert.equal(g.mode, 'title');
  assert.equal(g.zoneId, 'wall');
  assert.deepEqual(g.ship.pos, [0, -400, 0]);
  assert.ok(vnear(g.ship.vel, [0, 38, 0]), 'the opening drop-out at 38 u/s, north');
  assert.equal(g.ship.bar, 0.5);
  assert.equal(g.tune, TUNE);
  assert.deepEqual(g.earth, { aheadLy: 1.067e9, cardsShown: [] });
  assert.equal(g.settings.scheme, 'pedals', 'decisions.md 5: stick and pedals by default');
});

test('the state is plain data: structuredClone works and JSON has no functions', () => {
  const g = createGame({ seed: 3 });
  const c = structuredClone(g);
  assert.deepEqual(c.ship, g.ship);
  assert.ok(c.near.ids instanceof Int32Array);
  const walk = (o, path) => {
    if (typeof o === 'function') assert.fail(`function at ${path}`);
    if (o && typeof o === 'object') for (const [key, v] of Object.entries(o)) walk(v, `${path}.${key}`);
  };
  walk(g, 'game');
});

test('options: seed, pose, settings, today and a save', () => {
  const g = createGame({
    seed: 9, at: [10, 20, 3], heading: 90, speed: 24, settings: { scheme: 'one-thumb', hand: 'left', assists: 'bad', x: 1 },
    today: { y: 2027, m: 1, d: 2, hh: 3, mm: 4 },
    save: { missions: { 'which-way-home': { done: true } }, tapes: ['wake-up-call'], bogus: 1, events: [] },
  });
  assert.equal(g.seed, 9);
  assert.deepEqual(g.ship.pos, [10, 20, 3]);
  assert.ok(vnear(g.ship.vel, [24, 0, 0], 1e-12), 'heading 90 is +x');
  assert.ok(near(g.ship.yaw, Math.PI / 2));
  assert.equal(g.settings.scheme, 'one-thumb');
  assert.equal(g.settings.hand, 'left');
  assert.equal(g.settings.assists, 'cruise', 'bad values keep the default');
  assert.equal(g.settings.x, undefined);
  assert.deepEqual(g.today, { y: 2027, m: 1, d: 2, hh: 3, mm: 4 });
  assert.equal(g.progress.missions['which-way-home'].done, true);
  assert.deepEqual(g.progress.tapes, ['wake-up-call']);
  assert.deepEqual(g.progress.events, {}, 'a wrong type is dropped');
  assert.equal(g.progress.bogus, undefined);
  assert.notEqual(createGame({ seed: 1 }).rng, createGame({ seed: 2 }).rng);
});

test('modes: the list, the allowed moves, pause and resume', () => {
  assert.deepEqual([...MODES], ['title', 'drive', 'zoom', 'runup', 'punch', 'tunnel', 'dropout', 'paused', 'log', 'ended']);
  const g = createGame();
  const ev = createEventBuffer();
  assert.equal(setMode(g, 'tunnel', ev), false, 'the title cannot jump to the tunnel');
  assert.equal(g.mode, 'title');
  assert.equal(setMode(g, 'drive', ev), true);
  assert.deepEqual(ev.list[0], { type: 'mode', t: 0, from: 'title', to: 'drive' });
  assert.equal(setMode(g, 'paused', ev), true);
  assert.equal(ev.count('pause'), 1);
  assert.equal(setMode(g, 'log', ev), true, 'pause menu to log');
  assert.equal(g.prevMode, 'drive', 'still remembers the mode to go back to');
  assert.equal(resume(g, ev), true);
  assert.equal(g.mode, 'drive');
  assert.equal(ev.count('resume'), 1);
  for (const [from, to] of [['drive', 'runup'], ['runup', 'punch'], ['punch', 'tunnel'], ['tunnel', 'dropout'],
    ['dropout', 'drive'], ['drive', 'zoom'], ['zoom', 'drive'], ['drive', 'ended'], ['ended', 'drive']]) {
    assert.equal(g.mode, from);
    assert.ok(canEnter(g, to), `${from} → ${to}`);
    setMode(g, to);
  }
  assert.equal(setMode(g, 'title'), true, 'any mode can quit to the title');
});

test('step: the clocks, the paused core, and edges used once', () => {
  const g = createGame({ mode: 'drive' });          // no PLAY lock: createGame can start in any mode
  const ev = createEventBuffer();
  const seen = [];
  wire({ ship: (game, input) => seen.push(input.action) });
  const rec = makeInput({ action: true, boostBurst: true });
  advance(g, rec, 3 * H, ev);
  assert.deepEqual(seen, [true, false, false], 'the action edge reaches the first step only');
  assert.equal(rec.action, false);
  assert.equal(rec.boostBurst, false);
  assert.equal(g.steps, 3);
  assert.ok(near(g.t, 3 * H) && near(g.zoneT, 3 * H) && near(g.stats.playT, 3 * H));
  step(g, makeInput({ pause: true }), ev);
  assert.equal(g.mode, 'paused');
  const t = g.t;
  advance(g, makeInput(), 1, ev);
  assert.equal(g.t, t, 'nothing moves while paused');
  step(g, makeInput({ pause: true }), ev);
  assert.equal(g.mode, 'drive', 'pause again resumes');
  step(g, makeInput({ map: true }), ev);
  assert.equal(g.mode, 'log');
  step(g, makeInput({ map: true }), ev);
  assert.equal(g.mode, 'drive', 'the map key closes the log');
  unwire();
});

test('junk input reaches systems clean', () => {
  const g = createGame({ mode: 'drive' });
  let got = null;
  wire({ ship: (game, input) => { got = { ...input }; } });
  step(g, { steer: NaN, climb: Infinity, gas: -3, brake: '1', drift: 'yes', boost: 0, actionHeld: -1, source: 'joystick' });
  assert.deepEqual(got, { ...makeInput(), climb: 1, drift: true });
  step(g, null);
  assert.deepEqual(got, makeInput());
  assert.deepEqual(cleanInput({ steer: 5, gas: 0.5 }), { ...makeInput(), steer: 1, gas: 0.5 });
  unwire();
});

test('time scale: hit-stop freezes the world clock, slow motion slows it, t keeps going', () => {
  const g = createGame({ mode: 'drive' });
  const dts = [];
  wire({ ship: (game, input, dt) => dts.push(dt) });
  hitStop(g, 0.05);
  advance(g, makeInput(), 0.1);
  const stopped = dts.filter((d) => d === 0).length;
  assert.ok(Math.abs(stopped - 6) <= 1, `about 6 still steps in 0.05 s (got ${stopped})`);
  assert.ok(near(g.t, 0.1, 1e-9));
  assert.ok(near(g.zoneT, 0.1 - stopped * H, 1e-9));
  dts.length = 0;
  slowMo(g, 0.3, 0.5);
  slowMo(g, 0.5, 0.2);
  advance(g, makeInput(), 0.25);
  assert.ok(dts.every((d) => near(d, 0.3 * H)), 'the slowest one wins');
  assert.equal(g.timeScale, 0.3);
  advance(g, makeInput(), 0.5);
  assert.equal(g.timeScale, 1);
  assert.equal(g.slowX, 1);
  unwire();
});

test('the control lock: PLAY locks the controls for INPUT.PLAY_LIVE', () => {
  const g = createGame();
  const steers = [];
  wire({ ship: (game, input) => steers.push(input.steer) });
  advance(g, makeInput(), 1);
  setMode(g, 'drive');
  advance(g, makeInput({ steer: 1 }), 0.5);
  const locked = steers.filter((s) => s === 0).length;
  assert.ok(Math.abs(locked - TUNE.INPUT.PLAY_LIVE * 120) <= 1, `locked for ${locked} steps`);
  assert.equal(steers.at(-1), 1);
  lock(g, 0.1);
  steers.length = 0;
  advance(g, makeInput({ steer: -1 }), 0.2);
  assert.ok(steers.slice(0, 11).every((s) => s === 0) && steers.at(-1) === -1);
  unwire();
});

test('systems run in the documented order for each mode', () => {
  const calls = [];
  const sys = {};
  for (const name of SLOTS) if (!['build', 'zoneRt', 'enter'].includes(name)) sys[name] = () => calls.push(name);
  wire(sys);
  const g = createGame();
  const order = (mode) => { calls.length = 0; g.mode = mode; step(g, makeInput()); return calls.join(' '); };
  assert.equal(order('title'), '');
  assert.equal(order('drive'), 'ship actors zone race mission action talk');
  assert.equal(order('ended'), 'ship actors zone race mission action talk');
  assert.equal(order('zoom'), 'zoom actors talk');
  assert.equal(order('runup'), 'jump ship actors zone talk');
  assert.equal(order('punch'), 'jump talk');
  assert.equal(order('tunnel'), 'jump talk');
  assert.equal(order('dropout'), 'jump ship talk');
  assert.equal(order('paused'), '');
  assert.equal(order('log'), '');
  assert.throws(() => wire({ nope: () => {} }), /no such slot/);
  assert.throws(() => wire({ ship: 3 }), /needs a function/);
  unwire();
  calls.length = 0;
  g.mode = 'drive';
  step(g, makeInput());
  assert.equal(calls.length, 0, 'unwire puts the no-ops back');
});

test('the jump may change the input before the ship sees it in runup and dropout', () => {
  const g = createGame({ mode: 'drive' });
  setMode(g, 'runup');
  let shipSaw = null;
  wire({ jump: (game, input) => { input.gas = 1; }, ship: (game, input) => { shipSaw = input.gas; } });
  step(g, makeInput());
  assert.equal(shipSaw, 1);
  unwire();
});

test('enterZone: pose from the entry, the zone runtime, a pocket keeps its parent, arrive is pushed', () => {
  unwire();
  const ev = createEventBuffer();
  const g = createGame({ zoneData: WALL });
  assert.equal(zoneOf(g), WALL);
  assert.deepEqual(g.ship.pos, [0, -400, 0]);
  assert.equal(g.zone.id, 'wall');
  assert.equal(g.zone.sparks.length, 24, 'the Wall has 24 sparks');
  setMode(g, 'drive');
  advance(g, makeInput(), 1);
  enterZone(g, COMA, null, ev);
  assert.equal(g.zoneId, 'coma');
  assert.equal(g.zoneT, 0);
  assert.equal(g.arrivalT, g.t);
  assert.deepEqual(g.ship.pos, [-440, -428, 37]);
  assert.ok(near(g.ship.speed, 42) && vnear(g.ship.vel, [42 * Math.SQRT1_2, 42 * Math.SQRT1_2, 0], 1e-9), 'heading 45');
  assert.equal(g.zone.sparks.length, 32, 'Coma has 32 sparks');
  assert.equal(ev.list[0].type, 'arrive');
  g.ship.speed = 31;
  g.ship.cargo = { kind: 'lens', contacts: 1, scratched: false };
  const zoneRt = g.zone;
  enterZone(g, VIRGO_JET, null, ev);
  assert.equal(g.zoneId, 'coma', 'the zone stays');
  assert.equal(g.pocketId, 'virgo-jet');
  assert.equal(zoneOf(g), VIRGO_JET);
  assert.equal(parentOf(g), COMA);
  assert.equal(g.zone, zoneRt, 'a pocket shares its parent zone runtime');
  assert.equal(g.ship.speed, 31, "speed 'keep'");
  assert.equal(g.ship.cargo.kind, 'lens', 'cargo rides into the pocket');
  enterZone(g, ANDROMEDA_EDGE, { pos: [5, 6, 7], heading: 180, speed: 10, bar: 1 });
  assert.equal(g.pocketId, null);
  assert.deepEqual(g.ship.pos, [5, 6, 7]);
  assert.ok(vnear(g.ship.vel, [0, -10, 0], 1e-9));
  assert.equal(g.ship.bar, 1);
});

test('slots: zoneRt, enter and build', () => {
  let built = 0;
  wire({
    build: (data, seed) => ({ id: data.id, seed, n: ++built }),
    zoneRt: (data) => ({ id: data.id, custom: true }),
    enter: (game, data) => { game.story.flags.entered = data.id; },
  });
  const g = createGame({ seed: 5, zoneData: WALL });
  assert.equal(g.zone.custom, true);
  assert.equal(g.story.flags.entered, 'wall');
  assert.deepEqual(builtOf(g), { id: 'wall', seed: 5, n: 1 });
  assert.equal(builtOf(g).n, 1, 'built once per zone and seed');
  const h = createGame({ seed: 6, zoneData: WALL });
  assert.equal(builtOf(h).n, 2);
  unwire();
});

test('newShip is the 5.1 ship and the same as createGame makes', () => {
  const s = newShip({ pos: [0, -400, 0], heading: 0, speed: 38, bar: 0.5 });
  assert.deepEqual(s, createGame().ship);
});

test('rand is mulberry32 on game.rng and is deterministic', () => {
  const g = createGame({ seed: 11 });
  const ref = mulberry32(hashSeed('game', 11));
  for (let i = 0; i < 100; i++) {
    const x = rand(g);
    assert.equal(x, ref());
    assert.ok(x >= 0 && x < 1);
  }
});

test('the frame clock runs whole steps, at most MAX_STEPS, and drops a stall', () => {
  const c = createClock();
  assert.equal(frameSteps(c, 1 / 60), 2);
  assert.ok(c.acc < H);
  assert.equal(frameSteps(c, 1 / 240), 0);
  assert.equal(frameSteps(c, 1 / 240), 1);
  assert.equal(frameSteps(c, 5), MAX_STEPS, 'a 5 s stall never fast-forwards');
  assert.ok(c.acc >= 0 && c.acc < H);
  assert.equal(frameSteps(c, NaN), 0);
});

test('same seed and inputs give the same state', () => {
  wire({ ship: (game, input, dt) => { game.ship.pos[0] += input.steer * dt + rand(game) * 1e-3; } });
  const run = () => {
    const g = createGame({ seed: 4, mode: 'drive' });
    for (let i = 0; i < 240; i++) step(g, makeInput({ steer: Math.sin(i / 10) }));
    return g;
  };
  const a = run(), b = run();
  assert.deepEqual(a, b);
  const c = structuredClone(a), d = a;
  for (let i = 0; i < 60; i++) { step(c, makeInput({ steer: 0.5 })); step(d, makeInput({ steer: 0.5 })); }
  assert.deepEqual(c.ship, d.ship, 'a cloned state steps the same');
  unwire();
});

// ---------------------------------------------------------------- the world schema

test("the design's Chapter 1 data passes the schema", () => {
  for (const z of [WALL, COMA, VIRGO_JET, ANDROMEDA_EDGE]) assert.deepEqual(checkZone(z), [], z.id);
  for (const m of MISSIONS) assert.deepEqual(checkMission(m), [], m.id);
  for (const l of LINES) assert.deepEqual(checkLine(l), [], l.id);
  assert.deepEqual(checkEvent(FIRST_LIGHT), []);
});

test('the schema catches broken data', () => {
  const clone = (o) => structuredClone(o);
  const has = (errs, re) => assert.ok(errs.some((e) => re.test(e)), `${re} in ${JSON.stringify(errs)}`);
  const z = clone(WALL);
  z.bodys = [];
  z.kind = 'town';
  z.entry.pos = [0, -900, 0];
  z.exit.opensWhen = 'whenever';
  z.sparks.push({ road: 'nowhere', from: 0, to: 1, n: 3 });
  z.roads[0].flow = 2;
  z.bodies.push({ id: 'bend-giant', pos: [0, 0, 0], r: 1, rc: 1 });
  z.events[0].gold = 9;
  const errs = checkZone(z);
  has(errs, /unknown key 'bodys'/);
  has(errs, /^kind/);
  has(errs, /entry.pos: outside R/);
  has(errs, /exit.opensWhen/);
  has(errs, /no road 'nowhere'/);
  has(errs, /roads\[0\].flow/);
  has(errs, /'bend-giant' used twice/);
  has(errs, /events\[0\] medal times must not fall/);
  has(checkZone({ ...clone(WALL), exit: undefined }), /needs an exit gate/);

  const m = clone(MISSIONS[2]);
  m.beats[0].objective = 'Find the pelican somewhere out there';
  m.beats[1].goal = { hug: {} };
  m.beats[2].fails = [{ explode: {} }];
  m.medals.gold = 40;
  const merrs = checkMission(m);
  has(merrs, /objective: uppercase, 26/);
  has(merrs, /goal: one of/);
  has(merrs, /fails\[0\]: one of/);
  has(merrs, /medals: times must not fall/);

  has(checkLine({ id: 'dot.long', speaker: 'DOT', text: 'This line is much too long for a phone caption band.', pri: 2 }),
    /words|characters/);
  has(checkLine({ id: 'dot.dash', speaker: 'DOT', text: 'Wait — what?', pri: 2 }), /dashes/);
  has(checkLine({ id: 'x', speaker: 'BOB', text: 'Hi there.', pri: 5 }), /speaker/);
  has(checkEvent({ id: 'x', type: 'trap', title: 'X', ring: { pos: [0, 0, 0], r: 6 }, stars: [47, 44, 40] }), /rising speeds/);
  has(checkEvent({ id: 'x', type: 'warp', title: 'X' }), /^type/);
  has(checkEvent({ ...clone(FIRST_LIGHT), gates: [{ at: 9 }] }), /outside the line/);
});
