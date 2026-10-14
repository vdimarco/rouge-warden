// Ahead of the Light: the page. Boot, URL options, the fixed 120 Hz loop (frame delta clamped to 0.25 s), the
// screens' switch, and window.__race, the test hook (final.md 20).
// SPINE (WP0): it draws a blank ring on the 2D overlay and runs the core's stubs. The world (render/), input, HUD,
// sound and screens (ui/) arrive with WP1, WP6 and WP7; their hooks below are marked WP.
import { SLUG, parseOverrides } from './core/tune.js';
import { ringView, captionY } from './core/ringmath.js';
import { stepRace, STEP, NO_INTENT } from './core/race.js';
import {
  createRun, startLeg, endLeg, breakOf, pick, skip, reroll, banish, chooseLane, snapshot, restore,
} from './core/run.js';
import { buy, refund } from './core/survival.js';
import { ROUTE, LEG_TYPES } from './core/course/legs.js';
import { buildLeg } from './core/course/gen.js';
import { validateLeg } from './core/course/validate.js';
import { chartView } from './core/chart.js';
import { driverFor, DRIVERS, PRESETS } from './core/bots.js';
import { serialize, restoreSave } from './core/save.js';
import { daySeed, cottageDay } from '../lab/kit/rng.js';

const $ = (id) => document.getElementById(id);
const KEY_RUN = `${SLUG}.run.v1`, KEY_META = `${SLUG}.meta.v1`, KEY_LOG = `${SLUG}.log.v1`;
const EVENT_KEEP = 4000;

// ---------- URL options and tuning ----------
const url = parseOverrides(location.search);
const tune = url.tune;
const opt = url.options;
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
document.documentElement.dataset.input = coarse ? 'touch' : 'desk';

// ---------- storage (every read and write in try/catch; blocked storage plays on and says nothing) ----------
const store = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, text) { try { localStorage.setItem(key, text); return true; } catch (e) { return false; } },
  del(key) { try { localStorage.removeItem(key); } catch (e) { /* blocked */ } },
};
let meta = restoreSave(store.get(KEY_META)) || { v: 1, seen: {}, runs: 0 };

// ---------- seeds ----------
const LETTERS = 'BCDFGHJKLMNPRSTVZ', VOWELS = 'AEIOU';
function newSeed() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const set = i % 2 ? VOWELS : LETTERS;
    s += set[Math.floor(Math.random() * set.length)];
  }
  return s;
}

// ---------- the game ----------
let mode = 'title';                    // 'title' | 'play' | 'break' | 'result'
let paused = false;
let run = null, race = null;
let ranked = url.ranked;
const recent = [];                     // the last EVENT_KEEP events, for __race.events(n)
const manual = { target: null, turn: 0 };
const edge = { action: null, burn: false };
let driver = null, driverName = null;
const intents = { you: NO_INTENT };
const timing = { firstInputMs: null, firstSteerMs: null, lastRetryMs: null, fps: 0 };
let playAt = 0, retryAt = null;
const feedback = { sounds: {}, effects: {}, haptics: {} };    // WP7 counts what it starts, per event type

function newRun(seed = opt.seed || newSeed()) {
  run = createRun({ seed, ship: opt.ship || 'lantern', tune, meta });
  race = startLeg(run, tune);
  recent.length = 0;
  return run.seed;
}

function legIndex(leg) {
  if (leg === undefined || leg === null || leg === '') return 0;
  const n = Number(leg);
  if (Number.isInteger(n)) return Math.max(0, Math.min(ROUTE.length - 1, n > 0 ? n - 1 : 0));
  const i = ROUTE.indexOf(String(leg).toLowerCase());
  return i < 0 ? 0 : i;
}

// Jump straight into a leg (unranked): ?leg=virgo&lane=M87, or __race.goto.
function gotoLeg({ leg, lane, seed, beat, build, ship } = {}) {
  run = createRun({ seed: seed || opt.seed || newSeed(), ship: ship || opt.ship || 'lantern', tune, meta });
  run.ranked = false;
  ranked = false;
  run.leg = legIndex(leg);
  const lanes = run.chart[run.leg] || [];
  const want = lane ? String(lane).toUpperCase() : null;
  run.lanes[run.leg] = lanes.find((l) => want && (l.id === lane || l.name === want)) || lanes[0] || null;
  if (Array.isArray(build)) run.build = build.map((b) => (typeof b === 'string' ? { id: b, r: 0 } : b));
  race = startLeg(run, tune);
  if (Number.isFinite(beat)) for (const s of race.ships) s.dist = beat;
  recent.length = 0;
  play();
  return { seed: run.seed, leg: ROUTE[run.leg] };
}

function play() {
  mode = 'play';
  paused = false;
  playAt = performance.now();
  $('title').hidden = true;
  $('hud').hidden = false;
}

function start() {
  if (mode !== 'title') return;
  if (opt.leg) gotoLeg({ leg: opt.leg, lane: opt.lane, seed: opt.seed });
  else { newRun(); play(); }
}

function restart(seed) {
  retryAt = performance.now();
  timing.lastRetryMs = null;
  const s = newRun(seed || newSeed());
  play();
  return s;
}

// ---------- one fixed step ----------
function stepOnce() {
  if (!race || race.phase === 'done') return [];
  const you = race.ships[0];
  let want = NO_INTENT;
  if (driver) want = driver(race, you) || NO_INTENT;
  else if (manual.target !== null || manual.turn !== 0 || edge.action || edge.burn) {
    want = { target: manual.target, turn: manual.turn, action: edge.action, burn: edge.burn };
  }
  edge.action = null;
  edge.burn = false;
  intents.you = want;
  const ev = stepRace(race, intents, STEP);
  for (const e of ev) {
    recent.push(e);
    if (e.type === 'legEnd') onLegEnd();
  }
  if (recent.length > EVENT_KEEP) recent.splice(0, recent.length - EVENT_KEEP);
  return ev;
}

function onLegEnd() {
  endLeg(run, race);
  if (run.phase === 'break') {
    mode = 'break';
    store.set(KEY_RUN, serialize(snapshot(run)));            // the run saves at every break (9.2)
  } else {
    mode = 'result';
    store.del(KEY_RUN);
    meta.runs = (meta.runs || 0) + 1;
    store.set(KEY_META, serialize(meta));
  }
}

// The spine's own stand-in for the break and result screens (WP7): a tap goes on.
function nextFromScreen() {
  if (mode === 'break') {
    chooseLane(run, 0);
    race = startLeg(run, tune);
    play();
  } else if (mode === 'result') restart();
}

// ---------- drawing (SPINE: a blank ring; WP6 replaces this with render/ and the overlay) ----------
const glCanvas = $('view'), overlay = $('overlay');
const ctx = overlay.getContext('2d');
let W = 0, H = 0, ratio = 1;
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  ratio = Math.min(window.devicePixelRatio || 1, 2);
  for (const c of [glCanvas, overlay]) {
    c.width = Math.max(1, Math.round(W * ratio));
    c.height = Math.max(1, Math.round(H * ratio));
  }
  const v = ringView({ w: W, h: H, tune });
  const root = document.documentElement.style;
  root.setProperty('--cx', `${v.cx}px`);
  root.setProperty('--cy', `${v.cy}px`);
  root.setProperty('--cap-y', `${captionY(v, tune)}px`);
}
window.addEventListener('resize', resize);
resize();

function viewNow() {
  const you = race ? race.ships[0] : null;
  return ringView({ w: W, h: H, eta: you ? you.eta : tune.ETA0, punch: you ? you.punch : 0,
    lightspeed: you ? you.lightspeed : false, tune });
}

function draw() {
  const v = viewNow();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (mode !== 'play') return;                              // the title shows the sky only (16)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = v.desk ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(v.cx, v.cy, v.R, 0, Math.PI * 2);
  ctx.stroke();
}

// ---------- the loop ----------
let last = null, acc = 0, fpsAvg = 60;
function frame(now) {
  const dt = last === null ? 0 : Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  if (dt > 0) fpsAvg += (1 / dt - fpsAvg) * 0.05;
  timing.fps = Math.round(fpsAvg);
  if (mode === 'play' && !paused) {
    acc += dt;
    while (acc >= STEP) { stepOnce(); acc -= STEP; }
    if (retryAt !== null && timing.lastRetryMs === null) { timing.lastRetryMs = now - retryAt; retryAt = null; }
  } else acc = 0;
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- input (SPINE: start and go on; WP1's ui/input.js brings steering, the flick and the whip) ----------
function noteInput() {
  if (timing.firstInputMs === null && mode === 'play') timing.firstInputMs = performance.now() - playAt;
}
$('title').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (e.target.closest('a, button')) return;
  start();
});
document.body.addEventListener('pointerdown', () => {
  if (mode === 'break' || mode === 'result') nextFromScreen();
  else noteInput();
});
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (mode === 'title' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); start(); return; }
  if ((mode === 'break' || mode === 'result') && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault();
    nextFromScreen();
    return;
  }
  if (mode === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) { paused = !paused; return; }
  noteInput();
});
$('pause').addEventListener('click', () => { if (mode === 'play') paused = !paused; });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') paused = true; });

// ---------- the test hook (20) ----------
const plain = (o) => JSON.parse(JSON.stringify(o ?? null));
const youShip = () => (race ? race.ships[0] : null);
function advance(seconds = 1, input) {
  if (input) window.__race.input(input);
  if (mode === 'title') start();
  const n = Math.max(0, Math.round(seconds / STEP)), out = [];
  for (let i = 0; i < n && mode === 'play'; i++) for (const e of stepOnce()) out.push(e);
  draw();
  return plain(out);
}

window.__race = {
  id: SLUG, version: 1, tune,
  state() {
    const s = youShip();
    const v = viewNow();
    return plain({
      mode, paused, ranked, seed: run && run.seed, leg: run ? run.leg : null, type: run ? ROUTE[run.leg] : null,
      phase: race ? race.phase : null, t: race ? race.t : 0, real: race ? race.real : 0,
      layout: { kind: v.kind, w: v.w, h: v.h, cx: v.cx, cy: v.cy, R: v.R, R0: v.R0 },
      you: s && { bearing: s.bearing, target: s.target, dist: s.dist, eta: s.eta, gear: s.gear, light: s.light },
      ships: race ? race.ships.length : 0, set: url.set, options: opt, driver: driverName,
    });
  },
  run: () => (run ? snapshot(run) : null),
  survival() {
    const s = youShip();
    if (!s) return null;
    return plain({ gap: s.gap, ttc: s.ttc, light: s.light, hull: s.hull, hullMax: s.hullMax, shield: s.shield,
      shieldT: s.shieldT, fuel: s.fuel, fuelCap: s.fuelCap, years: s.years, earth: s.earth,
      cap: tune.GAP_CAP[race.legNo], leg: race.legNo });
  },
  rivals() {
    if (!race) return [];
    const me = youShip();
    return plain(race.ships.slice(1).map((r) => ({
      id: r.id, mode: r.ai ? r.ai.mode ?? null : null, gapAhead: (r.dist - me.dist), lightGap: r.gap, eta: r.eta,
      gear: r.gear, hull: r.hull, fuel: r.fuel, glare: r.light === 'glare', nemesis: Boolean(r.ai && r.ai.nemesis),
      target: r.ai ? r.ai.target ?? null : null, alive: !r.caught && !r.wrecked })));
  },
  events: (n = 50) => plain(recent.slice(-Math.max(0, n))),
  timing: () => ({ ...timing }),
  perf: () => ({ fps: timing.fps, drawCalls: 0, points: 0, glScale: 1, tier: opt.tier || null }),   // WP6
  feedback: () => plain(feedback),
  restart,
  advance,
  input(intent = {}) {
    if ('target' in intent) manual.target = Number.isFinite(intent.target) ? intent.target : null;
    if ('turn' in intent) manual.turn = Math.max(-1, Math.min(1, Math.round(intent.turn) || 0));
    if (intent.action === 'down' || intent.action === 'up') edge.action = intent.action;
    if (intent.burn) edge.burn = true;
    if (timing.firstSteerMs === null && mode === 'play' && (manual.target !== null || manual.turn)) {
      timing.firstSteerMs = performance.now() - playAt;
    }
    return { ...manual, ...edge };
  },
  bot(name, opts = {}) {
    if (!name) { driver = null; driverName = null; return true; }
    if (!DRIVERS[name] && !PRESETS[name]) return false;
    driver = driverFor(name, opts);
    driverName = name;
    return true;
  },
  rivalBot: (id, overrides) => null,                        // WP4
  field: (spec) => null,                                    // WP4
  pick: (i) => (run ? (pick(run, i), breakOf(run)) : null),
  skip: () => (run ? (skip(run), breakOf(run)) : null),
  reroll: () => (run ? (reroll(run), breakOf(run)) : null),
  banish: (i) => (run ? (banish(run, i), breakOf(run)) : null),
  lane(i = 0) {
    if (!run || !chooseLane(run, i)) return false;
    race = startLeg(run, tune);
    play();
    return true;
  },
  buy: (chip) => (run ? buy(run, chip, tune) : false),
  refund: (chip) => (run ? refund(run, chip, tune) : false),
  leg() {
    if (!race) return null;
    const L = race.leg;
    return plain({ type: L.type, name: LEG_TYPES[L.type] ? LEG_TYPES[L.type].name : null, lane: L.lane, seed: L.seed,
      beats: L.beats, hash: L.hash, items: L.items.length, gate: L.gate, phase: race.phase });
  },
  course({ from = 0, to = Infinity } = {}) {
    return race ? plain(race.leg.items.filter((it) => it.beat >= from && it.beat <= to)) : [];
  },
  gen({ seed = 1, type = 'web', lane = null, mods = {} } = {}) {
    const L = buildLeg({ runSeed: seed, type, lane, mods, tune });
    return plain({ type: L.type, seed: L.seed, beats: L.beats, hash: L.hash, items: L.items.length, report: L.report });
  },
  validate({ seed = 1, type = 'web', lane = null } = {}) {
    return plain(validateLeg(buildLeg({ runSeed: seed, type, lane, tune })));
  },
  chart: () => (run ? plain(chartView(run)) : null),
  goto: gotoLeg,
  save() {
    if (!run) return null;
    const text = serialize(snapshot(run));
    store.set(KEY_RUN, text);
    return text;
  },
  load(json) {
    const o = typeof json === 'string' ? restoreSave(json) : json;
    if (!o) return false;
    run = restore(o);
    race = startLeg(run, tune);
    recent.length = 0;
    play();
    return true;
  },
  clearSave() { for (const k of [KEY_RUN, KEY_META, KEY_LOG]) store.del(k); return true; },
  meta: () => plain(meta),
  setMeta(obj) {
    meta = plain(obj) || { v: 1, seen: {}, runs: 0 };
    store.set(KEY_META, serialize(meta));
    return true;
  },
  daily(date = cottageDay()) { return { date, seed: daySeed('race', date) }; },
};

if (opt.bot) window.__race.bot(opt.bot);
if (reduced) document.documentElement.dataset.motion = 'reduced';
