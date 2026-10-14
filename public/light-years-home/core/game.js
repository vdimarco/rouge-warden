// Light Years Home v3: the game. createGame makes the whole state as plain data (final.md 5.1). step runs one fixed
// 1/120 s step: clocks and time scale, the mode machine, then each system in a fixed order. Systems are slots that
// other modules fill with wire(): ship.js, zone.js, race.js and the rest stay independent of each other, and this
// file imports none of them. Zone data is static, kept here by id, and never copied into the state.
import { TUNE } from './tune.js';
import { hashSeed } from './rng.js';

export const H = 1 / 120;          // the fixed step, s
export const MAX_STEPS = 8;        // most steps one frame may run; extra real time is dropped

/**
 * The input record (final.md 5.2). ui/input.js makes one per frame; bots make one per step. Every step in a frame
 * sees the same record. step() reads a cleaned copy and then clears the record's edge fields, so an edge is used by
 * the first step only. In the jump corridor, steer and climb steer on two axes with the same rate stick as in the
 * zones (decisions.md 2); there is no ringPos.
 *
 * @typedef {object} InputRecord
 * @property {number} steer       −1 to 1 after the expo curve; positive turns right (clockwise seen from above)
 * @property {number} climb       −1 to 1; positive raises the nose (invert is applied in ui/input.js)
 * @property {number} gas         0 to 1; 0 holds cruise, 1 asks for top speed
 * @property {number} brake       0 to 1; slow down, stop if held
 * @property {boolean} drift      the handbrake (Space, B, BRAKE with a steer, a second finger in one thumb)
 * @property {boolean} boost      spend the bar while held
 * @property {boolean} boostBurst edge: a flick up, a 1.0 s burst
 * @property {boolean} action     edge: a tap of the action control
 * @property {number} actionHeld  s the action control has been held (restart at 0.35, let go of a tow at 1.0)
 * @property {boolean} lookBack   Q, LB
 * @property {boolean} map        edge: open the log
 * @property {boolean} pause      edge: pause
 * @property {boolean} autoDrift  a hard turn starts a drift (touch default)
 * @property {'touch'|'keys'|'mouse'|'pad'} source  one scheme per session
 */
export const EDGES = Object.freeze(['boostBurst', 'action', 'map', 'pause']);
const SOURCES = ['touch', 'keys', 'mouse', 'pad'];

export function makeInput(over = null) {
  const rec = {
    steer: 0, climb: 0, gas: 0, brake: 0, drift: false, boost: false, boostBurst: false,
    action: false, actionHeld: 0, lookBack: false, map: false, pause: false, autoDrift: false, source: 'keys',
  };
  return over ? Object.assign(rec, over) : rec;
}

const fin = (x, lo, hi) => (typeof x === 'number' && x === x ? Math.min(hi, Math.max(lo, x)) : 0);

// A clean copy of any record: numbers clamped, NaN and junk to 0, flags to booleans. Writes into out.
export function cleanInput(rec, out = makeInput()) {
  const r = rec || {};
  out.steer = fin(r.steer, -1, 1);
  out.climb = fin(r.climb, -1, 1);
  out.gas = fin(r.gas, 0, 1);
  out.brake = fin(r.brake, 0, 1);
  out.drift = !!r.drift;
  out.boost = !!r.boost;
  out.boostBurst = !!r.boostBurst;
  out.action = !!r.action;
  out.actionHeld = fin(r.actionHeld, 0, 3600);
  out.lookBack = !!r.lookBack;
  out.map = !!r.map;
  out.pause = !!r.pause;
  out.autoDrift = !!r.autoDrift;
  out.source = SOURCES.includes(r.source) ? r.source : 'keys';
  return out;
}

// ---------------------------------------------------------------- modes

export const MODES = Object.freeze(['title', 'drive', 'zoom', 'runup', 'punch', 'tunnel', 'dropout', 'paused', 'log',
  'ended']);
const HELD = new Set(['paused', 'log']);                 // the core does not step
const ZONE_LIVE = new Set(['title', 'drive', 'zoom', 'runup', 'dropout', 'ended']);   // traffic clock runs

// Where each mode may go (tech §3.3). Any mode may go to 'title'; paused and log go back to the mode they held.
export const NEXT = Object.freeze({
  title: Object.freeze(['drive']),
  drive: Object.freeze(['zoom', 'runup', 'paused', 'log', 'ended']),
  zoom: Object.freeze(['drive', 'paused', 'log']),
  runup: Object.freeze(['punch', 'drive', 'paused', 'log']),
  punch: Object.freeze(['tunnel', 'paused']),
  tunnel: Object.freeze(['dropout', 'paused']),
  dropout: Object.freeze(['drive', 'ended', 'paused']),
  paused: Object.freeze(['log']),
  log: Object.freeze(['paused', 'runup']),              // runup: jump back from the log
  ended: Object.freeze(['drive', 'paused', 'log']),
});

export function canEnter(game, mode) {
  if (!MODES.includes(mode) || mode === game.mode) return false;
  if (mode === 'title' || NEXT[game.mode].includes(mode)) return true;
  return HELD.has(game.mode) && mode === game.prevMode;
}

// Change mode. Returns false (and changes nothing) when the move is not allowed. Pushes 'mode', and 'pause' or
// 'resume' when the core stops or starts stepping. Leaving the title locks the controls for INPUT.PLAY_LIVE.
export function setMode(game, mode, ev = null) {
  if (!canEnter(game, mode)) return false;
  const from = game.mode;
  if (!(HELD.has(from) && HELD.has(mode))) game.prevMode = from;   // paused <-> log keeps the mode to go back to
  game.mode = mode;
  game.modeT = 0;
  if (from === 'title' && mode === 'drive') lock(game, game.tune.INPUT.PLAY_LIVE);
  if (ev) {
    ev.push('mode', { from, to: mode });
    if (HELD.has(mode) && !HELD.has(from)) ev.push('pause', { from });
    if (HELD.has(from) && !HELD.has(mode)) ev.push('resume', { to: mode });
  }
  return true;
}

// Back to the mode that paused or log held.
export function resume(game, ev = null) {
  return HELD.has(game.mode) ? setMode(game, game.prevMode || 'drive', ev) : false;
}

// ---------------------------------------------------------------- time

// Hit-stop: nothing moves for s seconds of step time.
export function hitStop(game, s) { game.stopUntil = Math.max(game.stopUntil, game.t + s); }

// Slow motion at x (0.3 big crash, 0.35 THREE NINES, 0.4 vista) for s seconds of step time; the slowest one wins.
export function slowMo(game, x, s) {
  game.slowX = game.t < game.slowUntil ? Math.min(game.slowX, x) : x;
  game.slowUntil = Math.max(game.slowUntil, game.t + s);
}

// Ignore the driving controls for s seconds (PLAY, the punch, a restart's control-back).
export function lock(game, s) { game.lockUntil = Math.max(game.lockUntil, game.t + s); }

// A frame clock for main.js and the hook: run frameSteps(clock, realDt) steps, draw with alpha = clock.acc / H.
export const createClock = () => ({ acc: 0 });
export function frameSteps(clock, dt) {
  clock.acc += Math.max(0, Number.isFinite(dt) ? dt : 0);
  const whole = Math.floor(clock.acc / H + 1e-9);
  const n = Math.min(MAX_STEPS, whole);
  clock.acc = Math.max(0, clock.acc - whole * H);      // time past MAX_STEPS is dropped, the fraction kept
  return n;
}

// ---------------------------------------------------------------- random numbers (mulberry32 on game.rng)

export function rand(game) {
  game.rng = (game.rng + 0x6d2b79f5) >>> 0;
  let t = game.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- systems

// Each slot's signature. dt is the scaled step (H × timeScale); systems must cope with dt = 0 (hit-stop).
//   build(zoneData, seed) → built       WP1: traffic tables, collision grid, wells (cached per zone and seed)
//   zoneRt(zoneData, progress) → zone   WP4: createZoneRt; the default makes section 5.1's shape
//   enter(game, zoneData, ev)           after enterZone set the pose; WP1 and WP4 reset what they own
//   ship(game, input, dt, ev)           WP1: frame, ship, collisions, near misses, bar, chain
//   actors(game, dt, ev)                WP4: stepActors
//   zone(game, dt, ev)                  WP4: stepZone (scans, sparks, rings, secrets, exit)
//   race(game, dt, ev)                  WP4: stepRace (events and stunts)
//   mission(game, dt, ev)               WP4: stepMission
//   action(game, input, ev)             WP4: the action chip (SKIP, ↺, TAKE JOB, LET GO, JUMP, ZOOM OUT)
//   talk(game, dt, ev)                  WP4: stepTalk
//   zoom(game, input, dt, ev)           WP4: the 1.5 s zoom into or out of a pocket
//   jump(game, input, dt, ev)           WP5: stepJump for runup, punch, tunnel and dropout
const NOOP = () => {};
const DEFAULTS = Object.freeze({
  build: () => null, zoneRt: null, enter: NOOP, ship: NOOP, actors: NOOP, zone: NOOP, race: NOOP, mission: NOOP,
  action: NOOP, talk: NOOP, zoom: NOOP, jump: NOOP,
});
export const SLOTS = Object.freeze(Object.keys(DEFAULTS));
const SYS = { ...DEFAULTS };

// Fill slots: wire({ ship: stepDrive, zone: stepZone }). Unknown names throw. Returns the slots now in use.
export function wire(systems) {
  for (const [name, fn] of Object.entries(systems || {})) {
    if (!(name in DEFAULTS)) throw new Error(`no such slot: ${name}`);
    if (fn !== null && typeof fn !== 'function') throw new Error(`slot ${name} needs a function`);
    SYS[name] = fn ?? DEFAULTS[name];
    if (name === 'build') BUILT.clear();
  }
  return Object.freeze({ ...SYS });
}

// Put every slot back to its default (tests).
export function unwire() {
  Object.assign(SYS, DEFAULTS);
  BUILT.clear();
}

// ---------------------------------------------------------------- zone data

const ZONES = new Map();           // id → zone data (static, shared by every game)
const BUILT = new Map();           // 'id:seed' → what the build slot made

export function registerZone(zoneData) {
  if (!zoneData || typeof zoneData.id !== 'string') throw new Error('zone data needs an id');
  ZONES.set(zoneData.id, zoneData);
  return zoneData;
}
export const zoneById = (id) => ZONES.get(id) || null;
// The zone the ship is in: the pocket while inside one, else the zone.
export const zoneOf = (game) => ZONES.get(game.pocketId || game.zoneId) || null;
export const parentOf = (game) => ZONES.get(game.zoneId) || null;

// What the build slot made for the current zone and seed, built once.
export function builtOf(game) {
  const data = zoneOf(game);
  if (!data) return null;
  const key = `${data.id}:${game.seed}`;
  if (!BUILT.has(key)) BUILT.set(key, SYS.build(data, game.seed));
  return BUILT.get(key);
}

// ---------------------------------------------------------------- state

const DEG = Math.PI / 180;
export const DEFAULT_TODAY = Object.freeze({ y: 2026, m: 10, d: 13, hh: 12, mm: 0 });
export const DEFAULT_SETTINGS = Object.freeze({
  assists: 'cruise', autoDrift: true, scheme: 'pedals', hand: 'right', reducedMotion: false, slowCaptions: false,
  invertClimb: false,
});
const SETTING_VALUES = {
  assists: ['cruise', 'pilot'], scheme: ['pedals', 'one-thumb'], hand: ['right', 'left'],
};

function cleanSettings(s) {
  const out = { ...DEFAULT_SETTINGS };
  if (!s || typeof s !== 'object') return out;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const v = s[key];
    if (SETTING_VALUES[key] ? SETTING_VALUES[key].includes(v) : typeof v === 'boolean') out[key] = v;
  }
  return out;
}

function cleanToday(t) {
  const out = { ...DEFAULT_TODAY };
  if (!t || typeof t !== 'object') return out;
  for (const key of Object.keys(DEFAULT_TODAY)) if (Number.isInteger(t[key])) out[key] = t[key];
  return out;
}

// Plain data only: numbers, strings, booleans, null, arrays and plain objects.
function plain(v) {
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [key, x] of Object.entries(v)) if (typeof x !== 'function') out[key] = plain(x);
    return out;
  }
  return typeof v === 'function' ? null : v;
}

// The ship's state (5.1). heading is degrees clockwise from the map's +y; yaw is the same angle in radians.
export function newShip({ pos = [0, -400, 0], heading = 0, speed = 38, bar = TUNE.BAR.START } = {}) {
  const yaw = heading * DEG;
  const p = [pos[0] || 0, pos[1] || 0, pos[2] || 0];
  return {
    pos: p, vel: [Math.sin(yaw) * speed, Math.cos(yaw) * speed, 0], yaw, pitch: 0,
    up: [0, 0, 1], speed, slip: 0, bank: 0, hop: 0,
    prev: { pos: p.slice(), yaw, pitch: 0, bank: 0 },
    steerS: 0, climbS: 0,
    drift: { on: false, dir: 0, t: 0, charge: 0, tier: 0, autoT: 0 },
    db: { t: 0, tier: 0 }, snapT: 0, kickT: 0,
    bar, barMax: 1, boosting: false, boostT: 0, burstT: 0,
    stunT: 0, flickerT: 0, edgeT: -99, lastHitT: -99,
    tow: null,
    cargo: null,
    chain: { n: 0, mult: 1, lastT: -99, points: 0 },
    skim: { on: false, t: 0, body: null },
    draft: { on: false, target: null, t: 0 },
  };
}

// The zone runtime's default shape (5.1); zone.js's createZoneRt replaces it through the zoneRt slot.
export function newZoneRt(zoneData = null) {
  let sparks = 0;
  for (const s of zoneData?.sparks || []) sparks += s.n ?? s.pts?.length ?? 0;
  return {
    id: zoneData?.id ?? null, exitOpen: false, seen: {}, scanned: {}, scan: { id: null, t: 0 },
    sparks: new Uint8Array(sparks), sets: {}, rumours: {}, secrets: {}, secretT: {},
    lookHome: false, scaleCardUntil: 0, waypoint: null,
  };
}

export const NEAR_CAP = 64;

/**
 * createGame(options) → game, the whole state as plain data (final.md 5.1). heading is degrees clockwise from +y.
 * Pass zoneData to enter that zone at once; otherwise call enterZone when main.js has loaded it.
 */
export function createGame({
  seed = 1, zoneId = 'wall', at = null, heading = 0, speed = 38, save = null, settings = null, today = null,
  tune = TUNE, mode = 'title', zoneData = null,
} = {}) {
  const s = Number.isFinite(seed) ? seed >>> 0 : hashSeed(seed);
  const progress = {
    missions: {}, events: {}, stunts: {}, jumps: {}, zones: {}, tapes: [], stripes: [], trails: [], postcards: [],
  };
  if (save && typeof save === 'object') {
    for (const key of Object.keys(progress)) {
      const v = save[key];
      if (Array.isArray(progress[key]) ? Array.isArray(v) : v && typeof v === 'object' && !Array.isArray(v)) {
        progress[key] = plain(v);
      }
    }
  }
  const game = {
    v: 3, seed: s, rng: hashSeed('game', s),
    today: cleanToday(today),
    settings: cleanSettings(settings),
    tune,

    t: 0, zoneT: 0, eventT: 0, timeScale: 1, stopUntil: 0, slowUntil: 0, slowX: 1, lockUntil: 0, steps: 0,
    mode: MODES.includes(mode) ? mode : 'title', modeT: 0, prevMode: null,

    chapter: 1, zoneId, pocketId: null, arrivalT: 0,

    ship: newShip({ pos: at || undefined, heading, speed, bar: tune.BAR.START }),
    near: {
      ids: new Int32Array(NEAR_CAP).fill(-1), gap: new Float32Array(NEAR_CAP), rel: new Float32Array(NEAR_CAP),
      coolUntil: new Float32Array(NEAR_CAP), n: 0,
    },
    actors: [],
    zone: newZoneRt(null),

    activity: null, race: null, stunt: null, mission: null,
    talk: { cur: null, queue: [], lastEndT: -99, quietUntil: 0, redshiftT: -99, log: [] },
    jump: null,
    earth: { aheadLy: 1.067e9, cardsShown: [] },
    story: { openingI: 0, flags: { velaMet: false, magpieSaved: false } },
    progress,
    stats: { playT: 0, near: 0, hairline: 0, drifts: [0, 0, 0], scans: 0, takedowns: 0, crashes: 0 },
  };
  game.zone.id = zoneId;
  if (zoneData) enterZone(game, zoneData, at ? { pos: at, heading, speed } : null);
  return game;
}

/**
 * Put the game in a zone (or a pocket: data.kind 'pocket'). arrival { pos, heading, speed, bar } overrides the
 * zone's entry; speed 'keep' keeps the ship's speed. Resets the zone clock and the near tracker, makes the zone
 * runtime (a pocket keeps its parent's), pushes 'arrive', then calls the enter slot.
 */
export function enterZone(game, zoneData, arrival = null, ev = null) {
  registerZone(zoneData);
  const pocket = zoneData.kind === 'pocket';
  if (pocket) {
    game.pocketId = zoneData.id;
  } else {
    game.zoneId = zoneData.id;
    game.pocketId = null;
    if (Number.isInteger(zoneData.chapter)) game.chapter = zoneData.chapter;
    game.zone = SYS.zoneRt ? SYS.zoneRt(zoneData, game.progress) : newZoneRt(zoneData);
    game.zoneT = 0;
  }
  const entry = { ...(zoneData.entry || {}), ...(arrival || {}) };
  const speed = entry.speed === 'keep' || entry.speed == null ? game.ship.speed : entry.speed;
  const bar = Number.isFinite(entry.bar) ? entry.bar : game.ship.bar;
  const ship = newShip({ pos: entry.pos || game.ship.pos, heading: entry.heading ?? 0, speed, bar });
  if (pocket) ship.cargo = game.ship.cargo;
  game.ship = ship;
  game.near.n = 0;
  game.near.ids.fill(-1);
  game.arrivalT = game.t;
  if (ev) ev.push('arrive', { zone: zoneData.id, pocket });
  SYS.enter(game, zoneData, ev);
  return game;
}

// ---------------------------------------------------------------- the step

const IN = makeInput();
const SINK = { t: 0, n: 0, push() { return null; } };   // used when a caller passes no buffer

/**
 * One fixed step of H seconds. Order: clean the input and clear its edges; pause and map edges; clocks and time
 * scale; the control lock; then the systems for the mode:
 *   drive, ended   ship, actors, zone, race, mission, action, talk
 *   zoom           zoom, actors, talk
 *   runup          jump, ship, actors, zone, talk
 *   punch, tunnel  jump, talk
 *   dropout        jump, ship, talk
 *   title          the zone clock only (traffic runs behind the title)
 * In runup and dropout the jump runs first and may change the cleaned input before the ship sees it.
 */
export function step(game, input, ev = null) {
  const e = ev || SINK;
  const inp = cleanInput(input, IN);
  if (input && typeof input === 'object') {
    for (let i = 0; i < EDGES.length; i++) if (input[EDGES[i]]) input[EDGES[i]] = false;   // indexed: no iterator a step
  }
  e.t = game.t;

  if (HELD.has(game.mode)) {
    if ((inp.pause && game.mode === 'paused') || (inp.map && game.mode === 'log')) resume(game, ev);
    return game;
  }
  if (inp.pause && game.mode !== 'title') { setMode(game, 'paused', ev); return game; }
  if (inp.map && (game.mode === 'drive' || game.mode === 'ended')) { setMode(game, 'log', ev); return game; }

  game.t += H;
  game.modeT += H;
  game.steps++;
  e.t = game.t;
  const scale = game.t < game.stopUntil ? 0 : game.t < game.slowUntil ? game.slowX : 1;
  if (game.t >= game.slowUntil) game.slowX = 1;
  game.timeScale = scale;
  const dt = H * scale;
  const mode = game.mode;
  if (ZONE_LIVE.has(mode)) game.zoneT += dt;
  if (game.activity) game.eventT += dt;
  if (mode !== 'title') game.stats.playT += H;

  if (game.t < game.lockUntil) {
    inp.steer = 0; inp.climb = 0; inp.gas = 0; inp.brake = 0; inp.drift = false; inp.boost = false;
    inp.boostBurst = false; inp.action = false; inp.actionHeld = 0;
  }

  switch (mode) {
    case 'drive':
    case 'ended':
      SYS.ship(game, inp, dt, e);
      SYS.actors(game, dt, e);
      SYS.zone(game, dt, e);
      SYS.race(game, dt, e);
      SYS.mission(game, dt, e);
      SYS.action(game, inp, e);
      SYS.talk(game, dt, e);
      break;
    case 'zoom':
      SYS.zoom(game, inp, dt, e);
      SYS.actors(game, dt, e);
      SYS.talk(game, dt, e);
      break;
    case 'runup':
      SYS.jump(game, inp, dt, e);
      if (game.mode === 'runup') {
        SYS.ship(game, inp, dt, e);
        SYS.actors(game, dt, e);
        SYS.zone(game, dt, e);
      }
      SYS.talk(game, dt, e);
      break;
    case 'punch':
    case 'tunnel':
      SYS.jump(game, inp, dt, e);
      SYS.talk(game, dt, e);
      break;
    case 'dropout':
      SYS.jump(game, inp, dt, e);
      if (game.mode === 'dropout') SYS.ship(game, inp, dt, e);
      SYS.talk(game, dt, e);
      break;
    default:
      break;
  }
  return game;
}

// Run whole steps for `seconds` with one input record (its edges go to the first step). Returns the step count.
export function advance(game, input, seconds, ev = null) {
  const n = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) / H));
  for (let i = 0; i < n; i++) step(game, input, ev);
  return n;
}
