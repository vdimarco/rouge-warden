// Ahead of the Light: the page (final.md 15, 16, 17, 20). Boot, the URL options, the fixed 120 Hz loop (each frame's
// delta clamped to 0.25 s, the state drawn interpolated between steps), the screens' flow (title → leg → gate →
// vista → break → chart → the next leg, until caught or home, then the result card and AGAIN), the toy at ?toy=30,
// one piece on a loop at ?piece=, idle building of the next leg's backdrop, pause on a hidden page, a blur or the
// arcade switcher (with HOLD TO GO ON for a held whip), saves at each break and launch, and window.__race, the test
// hook. Every effect (sound, picture, haptic, caption) starts on the frame its event arrives.
import { SLUG, parseOverrides } from './core/tune.js';
import { ringView, captionY, layoutFor, beatsPerS, bpmOf, wrap } from './core/ringmath.js';
import { createRace, stepRace, STEP, NO_INTENT } from './core/race.js';
import { createRun, startLeg, endLeg, breakOf, pick, skip, reroll, banish, chooseLane, chartOf, resultOf, snapshot,
  suspend, resume, follow, practiceRun } from './core/run.js';
import { buy, refund, landNeed } from './core/survival.js';
import { ROUTE, LEG_TYPES } from './core/course/legs.js';
import { buildLeg, PIECES } from './core/course/gen.js';
import { validateLeg } from './core/course/validate.js';
import { resolve, place } from './core/course/kinds.js';
import { isDropped } from './core/course/director.js';
import { driverFor, DRIVERS, PRESETS } from './core/bots.js';
import { serialize, restoreSave, migrate } from './core/save.js';
import { createMeta, normalizeMeta, applyRun, dailyFor, SHIPS, SHIP_ORDER, PAGES, nextUnlock, medalFor }
  from './core/meta.js';
import { runSummary, runLogText, legName } from './core/log.js';
import { CARD, cardFires, faceOf } from './core/cards.js';
import { createField } from './core/rivals.js';
import { windowOpen } from './core/handle.js';
import { createToy, stepToy, toySummary, TOY_S } from './core/toy.js';
import { GATE_NAMES } from './core/chart.js';
import { mulberry32, hashSeed } from '../light-years-home/core/rng.js';
import { cottageDay } from '../lab/kit/rng.js';
import { createInput, bindInput, pollPad } from './ui/input.js';
import { createHud, captionsFor, createCaptionMemory, newLegMemory, PRI } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createSound } from './ui/sound.js';
import { createHaptics } from './ui/haptics.js';
import { createStore } from './ui/store.js';
import { createScene, pickTier, createRoll } from './render/scene.js';
import { createOverlay, tellsOf } from './render/overlay.js';
import { createVista } from './render/vista.js';
import { createBuilder } from './render/landmarks.js';
import { drawChart } from './render/chart.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const plain = (o) => JSON.parse(JSON.stringify(o ?? null));
const EVENT_KEEP = 4000;
const END_HOLD = { caught: 1.3, home: 2.2 };      // s on the last frame before the result card

// ---------------------------------------------------------------- URL options, tuning, storage
const url = parseOverrides(location.search);
const tune = url.tune;
const opt = url.options;
const store = createStore();
let meta = store.meta();
const settings = () => meta.settings || (meta.settings = {});
const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const reducedNow = () => prefersReduced || Boolean(settings().reduced);
const root = document.documentElement;
root.dataset.input = coarse ? 'touch' : 'desk';
const desk = () => root.dataset.input === 'desk';

// ---------------------------------------------------------------- the world: WebGL scene, 2D overlay, vista
const glCanvas = $('view'), overCanvas = $('overlay');
const octx = overCanvas.getContext('2d');
let W = window.innerWidth, H = window.innerHeight;
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

// The GPU's name, or null when WebGL will not start (then the page plays on the thin stand-in below).
function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return String(name || '');
  } catch (e) { return null; }
}

// A thin stand-in when WebGL will not start: the overlay still draws the ring, so the page still plays.
function fallbackScene() {
  const roll = createRoll(tune);
  let w = 1, h = 1, view = null;
  return {
    fallback: true, rel: null, roll,
    resize(a, b) { w = a; h = b; },
    render(race, dt, o = {}) {
      const you = race ? race.ships[0] : null;
      const cam = you ? roll.step(you, dt, { fixed: o.fixed, whip: Boolean(you.whip) }) : roll.cam;
      view = ringView({ w, h, eta: you ? you.eta : o.skyEta ?? 1, punch: you ? you.punch : 0, cam,
        lightspeed: Boolean(you && you.lightspeed), tune });
      return view;
    },
    adapt: () => 1,
    info: () => ({ calls: 0, points: 0, glScale: 1, tier: 'none', ratio: 1, hazards: 0, backdrop: null, backdropPoints: 0 }),
    setBackdrop() {}, backdrop: () => null, view: () => view, layout: () => layoutFor(w, h, tune), dispose() {},
  };
}

const gpu = gpuName();
const tier = pickTier({ want: opt.tier || null, w: W, h: H, coarse, gpu: gpu || '' });
let scene;
try { scene = gpu === null ? fallbackScene() : createScene({ canvas: glCanvas, tune, tier, reduced: reducedNow(), seed: 1 }); }
catch (e) { scene = fallbackScene(); }
let overlay = makeOverlay();
let vista = null;
try { vista = scene.fallback ? null : createVista({ scene, tune }); } catch (e) { vista = null; }
function makeOverlay() {
  return createOverlay({ canvas: overCanvas, tune, reduced: reducedNow(),
    fx: { glare: $('fx-glare'), flash: $('fx-flash'), flood: $('fx-flood') } });
}

// ---------------------------------------------------------------- sound, haptics, HUD, screens, input
const sound = createSound({ on: store.soundOn(), onToggle: (on) => store.setSound(on) });
const haptics = createHaptics({ enabled: true });
const hud = createHud({ speed: $('speed'), place: $('place'), land: $('land'), captions: $('captions'), tune,
  slow: Boolean(settings().slowCaptions) });
const screens = createScreens({ root: $('screens'), onAction: (act, d) => action(act, d) });
const input = createInput({ tune, burnTap: opt.burn === 'tap', halves: opt.scheme === 'halves', width: W });
const actBtn = $('act');
const buttonOn = () => opt.button === '1' || Boolean(settings().button);

// ---------------------------------------------------------------- the game's state
const G = {
  mode: 'title',            // 'title' | 'play' | 'ending' | 'vista' | 'break' | 'chart' | 'result' | 'toy' | 'toycard'
  paused: false, regrip: false, modal: null, back: null,
  run: null, race: null, toy: null, piece: null, toyCaps: 0,
  ranked: url.ranked, mem: createCaptionMemory(), races: [], runT: 0,
  acc: 0, endAt: 0, endHold: 1.2, chartT: 0, chartModel: null, chartRects: null, tunePick: null,
  result: null, applied: null, metaBefore: null, logTab: 'PLACES', practiceOpen: false,
  builder: null, builderType: null, built: {},
  prev: [], sweep: { a: null, v: 0 }, whipA: null, copied: false,
};
const recent = [];
let frameEvents = [];
const hook = { target: null, turn: 0, action: null, burn: false };
let driver = null, driverName = null;
const timing = { firstInputMs: null, firstSteerMs: null, lastRetryMs: null, fps: 0 };
let playAt = 0, retryAt = null;
const perfS = { frame: [], step: [], render: [] };

// ---------------------------------------------------------------- layout
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  scene.resize(W, H, DPR());
  overlay.resize(W, H, DPR());
  if (vista) vista.resize(W, H, DPR());
  input.resize(W);
  const v = ringView({ w: W, h: H, tune });
  const st = root.style;
  st.setProperty('--cx', `${v.cx}px`);
  st.setProperty('--cy', `${v.cy}px`);
  st.setProperty('--cap-y', `${Math.round(captionY(v, tune))}px`);
  root.dataset.layout = v.kind;
  if (G.mode === 'chart') G.chartRects = null;
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- backdrops, built in idle time
const idle = window.requestIdleCallback
  ? (fn) => window.requestIdleCallback(fn, { timeout: 120 })
  : (fn) => setTimeout(() => fn({ timeRemaining: () => 6, didTimeout: false }), 16);

function startBuilder(type) {
  if (scene.fallback || !type) return;
  if (G.built[type] || G.builderType === type) return;
  G.builderType = type;
  G.builder = createBuilder(type, { seed: 7, tier, rel: scene.rel });
  const work = (deadline) => {
    const b = G.builder;
    if (!b || G.builderType !== type) return;
    const playing = G.mode === 'play' && !G.paused;
    const ms = playing ? 2 : Math.max(2, Math.min(8, deadline.timeRemaining ? deadline.timeRemaining() : 4));
    if (b.step(ms)) { G.built[type] = b.result; G.builder = null; G.builderType = null; return; }
    idle(work);
  };
  idle(work);
}
// The leg's backdrop now: built if ready, else finished at once.
function backdropFor(type) {
  if (scene.fallback) return null;
  if (G.built[type]) { const b = G.built[type]; delete G.built[type]; return b; }
  if (G.builderType === type && G.builder) {
    const b = G.builder;
    G.builder = null; G.builderType = null;
    while (!b.done) b.step(Infinity);
    return b.result;
  }
  const b = createBuilder(type, { seed: 7, tier, rel: scene.rel });
  while (!b.done) b.step(Infinity);
  return b.result;
}
function useBackdrop(type) {
  if (scene.fallback) return;
  const cur = scene.backdrop();
  if (cur && cur.type === type) return;
  const bd = backdropFor(type);
  if (bd) scene.setBackdrop(bd);
  // drop built backdrops for other legs (each holds its own points)
  for (const k of Object.keys(G.built)) if (k !== ROUTE[ROUTE.indexOf(type) + 1]) { G.built[k].dispose(); delete G.built[k]; }
}

// ---------------------------------------------------------------- seeds
const LETTERS = 'BCDFGHJKLMNPRSTVZ', VOWELS = 'AEIOU';
function newSeed() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const set = i % 2 ? VOWELS : LETTERS;
    s += set[Math.floor(Math.random() * set.length)];
  }
  return s;
}

// ---------------------------------------------------------------- starting things
function shipChoice() {
  const want = opt.ship || settings().ship || 'lantern';
  return SHIPS[want] && (meta.ships.includes(want) || opt.ship) ? want : 'lantern';
}
function freshRun({ seed = null, daily = null, ship = null } = {}) {
  sound.start();
  const s = settings();
  const run = createRun({ seed: seed ?? (opt.seed || newSeed()), ship: ship || (daily ? null : shipChoice()), daily,
    redshift: s.redshift || 0, easy: Boolean(meta.easy && meta.easy.on), meta, tune });
  if (!G.ranked) run.ranked = false;
  return run;
}
function beginRun(run) {
  G.run = run;
  G.toy = null; G.piece = null;
  G.races = []; G.runT = 0;
  G.mem = createCaptionMemory();
  G.result = null; G.applied = null;
  overlay.reset({ run: true });
  recent.length = 0;
  launchLeg();
}

// The run's current leg, from its launch.
function launchLeg() {
  const run = G.run;
  G.race = startLeg(run, tune);
  useBackdrop(ROUTE[run.leg]);
  afterLaunch();
  store.saveRun(suspend(run, 'leg'));
}
function afterLaunch() {
  const race = G.race;
  overlay.reset();
  hud.reset();
  newLegMemory(G.mem);
  sound.setLeg(race.legNo, race.ships[0].dist);
  G.prev = [];
  G.sweep = { a: null, v: 0 };
  G.tunePick = null;
  fx('flood', false);
  play();
}
function play() {
  G.mode = G.toy ? 'toy' : 'play';
  G.paused = false; G.regrip = false;
  G.acc = 0;
  playAt = performance.now();
  timing.firstInputMs = null; timing.firstSteerMs = null;
  input.reset();
  screens.hide();
  $('hud').hidden = false;
  hint('');
}

function start() {
  if (G.mode !== 'title') return;
  sound.start();
  if (opt.toy) { startToy(); return; }
  if (opt.piece) { startPiece(opt.piece); return; }
  if (opt.leg) { gotoLeg({ leg: opt.leg, lane: opt.lane, seed: opt.seed }); return; }
  if (opt.daily === '1') { beginRun(freshRun({ daily: cottageDay() })); return; }
  beginRun(freshRun());
}

function restart(seed) {
  retryAt = performance.now();
  timing.lastRetryMs = null;
  const run = freshRun({ seed: seed || newSeed(), daily: G.run && G.run.daily && !seed ? G.run.daily : null });
  beginRun(run);
  return run.seed;
}

function legIndex(leg) {
  if (leg === undefined || leg === null || leg === '') return 0;
  const n = Number(leg);
  if (Number.isInteger(n)) return clamp(n > 0 ? n - 1 : 0, 0, ROUTE.length - 1);
  const i = ROUTE.indexOf(String(leg).toLowerCase());
  return i < 0 ? 0 : i;
}

// Straight into a leg, unranked: ?leg=virgo&lane=M87, or __race.goto.
function gotoLeg({ leg, lane, seed, beat, build, ship } = {}) {
  sound.start();
  const run = freshRun({ seed: seed || opt.seed || newSeed(), ship: ship || null });
  run.ranked = false;
  G.ranked = false;
  run.leg = legIndex(leg);
  const lanes = run.chart[run.leg] || [];
  const want = lane ? String(lane).toUpperCase() : null;
  const found = lanes.find((l) => want && (l.id === lane || l.id === String(lane).toLowerCase() || l.name === want
    || l.short === want));
  run.lanes[run.leg] = found || (lane ? { id: String(lane).toLowerCase(), name: want } : lanes[0] || null);
  if (run.leg > 0) run.you.launchEta = tune.LAUNCH_PAST;
  if (Array.isArray(build)) run.build = build.map((b) => (typeof b === 'string' ? { id: b, r: 0 } : b));
  beginRun(run);
  if (finite(beat)) for (const s of G.race.ships) s.dist = beat;
  return { seed: run.seed, leg: ROUTE[run.leg] };
}

function startPractice(i) {
  sound.start();
  const run = practiceRun({ seed: newSeed(), leg: i, lane: 0, tune });
  beginRun(run);
}

// THE TOY (24.2): the fixed 30 s stretch.
function startToy(seed = Number(opt.seed) || 1) {
  sound.start();
  G.run = null; G.piece = null;
  G.toy = createToy({ seed, tune, desk: desk() });
  G.toy.seed = seed;
  G.toyCaps = 0;
  G.race = G.toy.race;
  G.mem = createCaptionMemory();
  recent.length = 0;
  useBackdrop('coma');
  overlay.reset({ run: true });
  afterLaunch();
}

// One piece on a loop with the light off (?piece=m87-jet&loop=1).
function pieceLeg(id) {
  const pc = PIECES[id];
  if (!pc) return null;
  const reps = opt.loop ? 3 : 1;
  const len = pc.beats === 'rest' ? 24 : pc.beats[1];
  const items = [];
  let b0 = 6, anchor = 0;
  for (let r = 0; r < reps; r++) {
    const rnd = mulberry32(hashSeed('piece', id, r + 1));
    const p = {};
    for (const [k] of Object.entries(pc.params)) p[k] = pc.safe[k];
    const built = pc.build({ len, p, rnd, density: 1, opts: {}, legNo: 1, type: pc.leg || 'coma', skin: pc.leg || 'coma',
      T: tune, mods: {}, first: false, lane: null, gate: 'gate-virgo' });
    for (const x of built.items) {
      if (x.beat < len + 1e-9 || x.kind === 'cue') items.push({ ...place(x, b0, anchor, 1), piece: id });
    }
    anchor = wrap(anchor + (built.exit || 0));
    b0 += len + 6;
  }
  items.sort((a, b) => a.beat - b.beat);
  items.forEach((it, i) => { it.id = i; it.sec = 0; Object.freeze(it); });
  const beats = b0;
  return Object.freeze({ type: ROUTE.includes(pc.leg) ? pc.leg : 'coma', name: id.toUpperCase(), legNo: 1, lane: null,
    seed: 1, beats, items: Object.freeze(items), sections: Object.freeze([]), labels: Object.freeze([]),
    gate: Object.freeze({ id: null, beat: beats + 1000 }), pickups: items.filter((i) => i.kind === 'pickup'),
    wells: items.filter((i) => i.kind === 'well'), hash: `piece-${id}`, rules: {}, field: { none: true },
    report: { ok: true, errors: [] } });
}
function startPiece(id) {
  const leg = pieceLeg(id);
  if (!leg) { beginRun(freshRun()); return; }
  G.run = null; G.toy = null;
  G.piece = { id, leg, tune: Object.freeze({ ...tune, BLEED: 0 }) };
  G.mem = createCaptionMemory();
  G.race = createRace({ leg, tune: G.piece.tune });
  G.race.ships[0].gap = 99;
  useBackdrop(leg.type);
  afterLaunch();
}

// ---------------------------------------------------------------- one fixed step
function stepOnce(stepMs) {
  const race = G.race;
  if (G.toy && G.mode === 'toy' && race && (race.phase === 'done' || race.ships[0].caught || race.ships[0].wrecked)) {
    toyEnd();
    return [];
  }
  if (!race || race.phase === 'done') return [];
  const you = race.ships[0];
  let want;
  if (driver) want = driver(race, you) || NO_INTENT;
  else {
    want = input.take(race, you, stepMs);
    if (hook.target !== null || hook.turn || hook.action || hook.burn) {
      want = { target: hook.target, turn: hook.turn, action: hook.action || want.action, burn: hook.burn || want.burn };
    }
  }
  hook.action = null;
  hook.burn = false;
  if (timing.firstSteerMs === null && (want.target !== null || want.turn)) timing.firstSteerMs = performance.now() - playAt;
  if (retryAt !== null && timing.lastRetryMs === null) {
    timing.lastRetryMs = performance.now() - retryAt;
    retryAt = null;
  }
  // the previous step, for drawing between steps
  for (let i = 0; i < race.ships.length; i++) {
    const s = race.ships[i];
    const p = G.prev[i] || (G.prev[i] = { b: 0, d: 0, id: null });
    p.b = s.bearing; p.d = s.dist; p.id = s.id;
  }
  G.prev.length = race.ships.length;
  const t0 = performance.now();
  const ev = G.toy ? stepToy(G.toy, { you: want }, STEP) : stepRace(race, { you: want }, STEP);
  perfS.step.push(performance.now() - t0);
  if (G.run) follow(G.run, race);
  let ended = false;
  for (const e of ev) {
    recent.push(e);
    frameEvents.push(e);
    if (e.type === 'legEnd') ended = true;
  }
  if (recent.length > EVENT_KEEP) recent.splice(0, recent.length - EVENT_KEEP);
  if (G.piece && you.dist >= G.piece.leg.beats - 1) {
    G.race = createRace({ leg: G.piece.leg, tune: G.piece.tune });
    G.race.ships[0].gap = 99;
    overlay.reset();
    newLegMemory(G.mem);
  }
  if (G.toy && race.t >= TOY_S && G.mode === 'toy') toyEnd();
  if (ended) onLegEnd();
  return ev;
}

// The leg ended (18.3 part 10): to the vista and the break, or to the end of the run.
function onLegEnd() {
  const race = G.race, run = G.run;
  if (!run) return;
  const end = race.events.find((e) => e.type === 'legEnd');
  endLeg(run, race, tune);
  G.races.push({ leg: { legNo: race.legNo, hash: race.leg.hash } });
  G.runT += race.t;
  if (run.phase === 'break') {
    store.saveRun(suspend(run, 'break'));
    startBuilder(ROUTE[run.leg + 1]);
    const rec = run.legs[run.legs.length - 1];
    G.vistaSkippable = Boolean(rec && rec.vista && rec.vista.skippable);
    if (vista && scene.backdrop() && end && end.why === 'gate') {
      vista.begin({ race, backdrop: scene.backdrop() });
      G.mode = 'vista';
      hint(G.vistaSkippable ? (desk() ? 'SPACE TO SKIP' : 'TAP TO SKIP') : '');
      $('hud').hidden = true;
      hud.clearCaptions();
    } else showBreak();
    return;
  }
  // caught or home: hold the last frame (the flood, or the landing), then the card
  G.mode = 'ending';
  G.endAt = performance.now();
  G.endHold = run.phase === 'home' ? END_HOLD.home : END_HOLD.caught;
  finishRun();
}

function finishRun() {
  const run = G.run;
  const before = meta;
  const summary = runSummary(run);
  const applied = applyRun(before, summary, tune);
  meta = applied.meta;
  store.saveMeta(meta);
  store.pushLog({ ...summary, text: runLogText(run, G.races) });
  store.clearRun();
  G.metaBefore = before;
  G.applied = applied;
  G.result = resultOf(run, before, tune, applied);
}

function toyEnd() {
  const s = G.toy.sum || toySummary(G.toy);
  const you = G.toy.race.ships[0];
  const caught = you.caught || you.wrecked;
  G.mode = 'toycard';
  clearWorld();
  $('hud').hidden = true;
  hud.clearCaptions();
  const top = ['LAUNCH', '0.9C', '0.99C', '0.999C', '0.9999C'][s.topGear] || 'LAUNCH';
  screens.toyCard({ title: caught ? 'THE LIGHT CAUGHT YOU' : 'THE TOY', rows: [['TOP SPEED', top],
    ['GRAZES', String(s.grazes)], ['WHIP', s.grade || 'NONE'], ['SLINGSHOT', s.slingshot ? 'YES' : 'NO'],
    ['TAKEDOWN', s.takedown ? 'YES' : 'NO']] });
}

// ---------------------------------------------------------------- the screens
// Leaving play for a screen: both layers drop the race in the same task as the DOM change, so no frame shows the
// screen over a stale race.
function clearWorld() {
  try {
    // a fresh backing store (a resize) drops the race for certain; the cleared-only canvas could keep showing its
    // last race frame in Chromium (seen after a vista in SwiftShader)
    overCanvas.width = overCanvas.width;
    overlay.resize(W, H, DPR());
    scene.render(null, 0, { title: true, skyEta: G.run ? G.run.you.launchEta : 1.2 });
  } catch (e) { /* the next frame draws it */ }
}
function showBreak() {
  G.mode = 'break';
  if (vista) vista.end();
  clearWorld();
  hint('');
  $('hud').hidden = true;
  hud.clearCaptions();
  overlay.reset();
  fx('flood', false);
  const m = breakOf(G.run, tune);
  if (G.tunePick) m.tunePick = G.tunePick.map((id) => faceOf(id, 0, G.run.build)).filter(Boolean);
  screens.brk(m);
}
function showChart() {
  G.mode = 'chart';
  clearWorld();
  G.chartModel = chartOf(G.run, tune);
  G.chartT = 0;
  G.chartRects = null;
  $('hud').hidden = true;
}
function showResult() {
  G.mode = 'result';
  clearWorld();
  $('hud').hidden = true;
  hud.clearCaptions();
  overlay.reset();
  fx('flood', true);
  const r = G.result;
  const medals = (G.applied && G.applied.medals || []).map((x) => ({ medal: x.medal, name: legName(x.type) }));
  screens.result({ ...r, medals, easyOffer: Boolean(meta.easy && meta.easy.offered),
    easyOn: Boolean(meta.easy && meta.easy.on) });
}
function showTitle() {
  G.mode = 'title';
  G.race = null; G.toy = null; G.piece = null;
  clearWorld();
  G.paused = false; G.modal = null;
  $('hud').hidden = true;
  hud.clearCaptions();
  hint('');
  overlay.reset({ run: true });
  fx('flood', false);
  const env = store.run();
  const best = meta.records && meta.records.best;
  const s = settings();
  const d = meta.runs >= 1 ? dailyFor(cottageDay(), meta) : null;
  titleTop = null;
  screens.title({
    ship: SHIPS[shipChoice()].name,
    goOn: goOnLine(env),
    daily: d ? `DAILY · ${d.borrowed ? `BORROWED: ${SHIPS[d.ship].name}` : SHIPS[d.ship].name}` : null,
    practice: meta.runs >= 1,
    log: meta.runs >= 1, pages: meta.pages.length,
    redshift: meta.redshift && meta.redshift.open > 0 ? `REDSHIFT z ${s.redshift || 0}` : null,
    easy: meta.easy && meta.easy.offered ? `EASY LIGHT: ${meta.easy.on ? 'ON' : 'OFF'}` : null,
    easyOn: Boolean(meta.easy && meta.easy.on),
    best: best ? (best.home ? `BEST: HOME IN ${best.years.toFixed(1)} YR` : `BEST: ${legName(ROUTE[best.legNo || 0])}`) : null,
  });
  startBuilder(ROUTE[0]);
}
// The title's GO ON chip for a saved run: the leg it goes on with.
function goOnLine(env) {
  if (!env || !env.run) return null;
  const k = Math.min(ROUTE.length - 1, env.run.leg + (env.at === 'break' ? 1 : 0));
  return `GO ON · LEG ${k + 1} · ${legName(ROUTE[k])}`;
}
function showPause() {
  const run = G.run, race = G.race;
  const you = race ? race.ships[0] : null;
  const years = (run ? run.you.years : 0) + (you ? you.years : 0);
  screens.pause({
    where: G.toy ? 'THE TOY' : G.piece ? `PIECE · ${G.piece.id.toUpperCase()}` : run
      ? `${legName(ROUTE[run.leg])} · LEG ${run.leg + 1} OF ${ROUTE.length}` : '',
    years: `YOU AGED ${years.toFixed(1)} YR SO FAR`,
    regrip: Boolean(you && you.whip),
    build: run ? run.build.map((b) => faceOf(b.id, b.r, run.build)).filter(Boolean) : [],
    sound: sound.isOn(), canQuit: Boolean(run),
  });
}
function showSettings(back) {
  G.back = back;
  G.modal = 'settings';
  const s = settings();
  screens.settings({ sound: sound.isOn(), slowCaptions: Boolean(s.slowCaptions), fixedCam: Boolean(s.fixedCam),
    button: buttonOn(), reduced: reducedNow(), barks: s.barks !== false && opt.barks !== '0' });
}
const PAGE_LABEL = (id) => {
  const [k, v] = id.split(':');
  if (k === 'gate') return `${GATE_NAMES[ROUTE.indexOf(v)] || v}`;
  if (k === 'lane') {
    for (const t of ROUTE) for (const l of Object.values(LEG_TYPES[t].lanes)) if (l.id === v) return l.name;
    return v.toUpperCase();
  }
  if (k === 'card') return CARD[v] ? CARD[v].name : v;
  if (k === 'eaten') return `THE LIGHT TOOK ${v.toUpperCase()}`;
  if (k === 'beat') return `${v.toUpperCase()} BEATEN`;
  if (k === 'caught') return `CAUGHT · ${legName(v)}`;
  return id === 'home' ? 'HOME' : id === 'first-home' ? 'FIRST HOME' : id.toUpperCase();
};
const PAGE_HINT = (id) => {
  const [k, v] = id.split(':');
  if (k === 'card' && CARD[v] && CARD[v].kind === 'fusion' && CARD[v].halves) {
    const fam = (h) => (CARD[h[0]] ? CARD[h[0]].fam : '?');
    return `${fam(CARD[v].halves[0])} + ${fam(CARD[v].halves[1])} = ?`;
  }
  return '?';
};
function showLog(back) {
  G.back = back;
  G.modal = 'log';
  const have = new Set(meta.pages);
  const tabs = Object.entries(PAGES).map(([t, list]) => ({ id: t, total: list.length,
    found: list.filter((p) => have.has(p)).length }));
  const list = PAGES[G.logTab] || PAGES.PLACES;
  const nx = nextUnlock(meta.pages);
  screens.log({ tab: G.logTab, tabs, found: have.size, total: Object.values(PAGES).flat().length,
    next: nx ? `${nx.at - have.size} PAGES TO ${nx.short || nx.name}` : 'EVERY UNLOCK OPEN',
    pages: list.map((p) => ({ id: p, found: have.has(p), label: PAGE_LABEL(p), hint: PAGE_HINT(p) })) });
}
function showHangar(back) {
  G.back = back;
  G.modal = 'hangar';
  const pickd = shipChoice();
  screens.hangar({ ships: SHIP_ORDER.map((id) => {
    const s = SHIPS[id];
    return { id, name: s.name, half: s.half, unlocked: meta.ships.includes(id), selected: id === pickd, feat: s.feat || '',
      quirk: s.quirk, stats: `HULL ${s.hull} · SHIELD ${s.shield} · FUEL ${s.fuel}/${s.fuelCap} · TURN ${s.turn}°/S` };
  }) });
}
function showPractice(back) {
  G.back = back;
  G.modal = 'practice';
  const reached = ROUTE.map((t, i) => i === 0 || meta.pages.includes(`gate:${ROUTE[i - 1]}`));
  screens.practice({ legs: ROUTE.map((t, i) => ({ i, name: legName(t), open: reached[i], medal: meta.medals[t] || null })) });
}
function closeModal() {
  const back = G.back;
  G.modal = null;
  G.back = null;
  if (back === 'pause') { G.modal = 'pause'; showPause(); } else showTitle();
}

// Every screen button comes here.
function action(act, d = {}) {
  const run = G.run;
  const i = Number(d.i);
  sound.start();
  switch (act) {
    case 'fly': if (G.mode === 'title' && !G.modal) start(); break;
    case 'resume-save': {
      const env = store.run();
      const r = env ? resume(env, tune) : null;
      if (!r) { store.clearRun(); showTitle(); break; }
      G.ranked = r.ranked !== false;
      G.run = r;
      G.toy = null; G.piece = null; G.races = []; G.runT = 0; G.mem = createCaptionMemory();
      overlay.reset({ run: true });
      if (r.phase === 'break') { startBuilder(ROUTE[r.leg + 1]); showBreak(); }
      else if (r.phase === 'chart') { startBuilder(ROUTE[r.leg + 1]); showChart(); }
      else launchLeg();
      break;
    }
    case 'pick':
      if (G.mode === 'break' && pick(run, i)) {
        sound.ui('pick');
        if (run.phase === 'chart') showChart(); else showBreak();
      } else if (G.mode === 'chart') action('lane', d);
      break;
    case 'skip':
      if (G.mode === 'break' && skip(run, tune)) { sound.ui(); showChart(); }
      break;
    case 'reroll':
      if (G.mode === 'break' && reroll(run, tune)) { sound.ui(); showBreak(); }
      break;
    case 'banish':
      if (G.mode === 'break' && banish(run, i, tune)) { sound.ui(); showBreak(); }
      break;
    case 'buy': {
      if (G.mode !== 'break') break;
      if (d.chip === 'tune') {
        const chip = breakOf(run, tune).dock?.chips.find((c) => c.id === 'tune');
        G.tunePick = chip && chip.cards ? [...chip.cards] : null;
        showBreak();
        break;
      }
      if (buy(run, d.chip, tune)) sound.ui();
      showBreak();
      break;
    }
    case 'tune':
      if (G.mode === 'break' && buy(run, { id: 'tune', card: d.card }, tune)) sound.ui();
      G.tunePick = null;
      showBreak();
      break;
    case 'refund':
      if (G.mode === 'break' && refund(run, d.chip, tune)) sound.ui();
      showBreak();
      break;
    case 'lane':
      if (G.mode === 'chart' && run && chooseLane(run, i)) { sound.ui('pick'); launchLeg(); }
      break;
    case 'again': if (G.mode === 'result') restart(); break;
    case 'toy-again': if (G.mode === 'toycard') startToy((G.toy ? G.toy.seed : 1) + 1); break;
    case 'title': showTitle(); break;
    case 'copylog': copyLog(); break;
    case 'easy':
      meta.easy = { ...(meta.easy || {}), on: !(meta.easy && meta.easy.on) };
      store.saveMeta(meta);
      if (G.mode === 'result') showResult(); else showTitle();
      break;
    case 'redshift': {
      const s = settings();
      s.redshift = ((s.redshift || 0) + 1) % ((meta.redshift.open || 0) + 1);
      store.saveMeta(meta);
      showTitle();
      break;
    }
    case 'daily': beginRun(freshRun({ daily: cottageDay() })); break;
    case 'practice': showPractice(G.mode === 'title' ? 'title' : 'pause'); break;
    case 'practice-leg': G.modal = null; startPractice(i); break;
    case 'log': showLog('title'); break;
    case 'logtab': G.logTab = d.tab || 'PLACES'; showLog(G.back); break;
    case 'hangar': showHangar('title'); break;
    case 'ship':
      if (meta.ships.includes(d.id)) { settings().ship = d.id; store.saveMeta(meta); }
      showHangar(G.back);
      break;
    case 'settings': showSettings(G.paused ? 'pause' : 'title'); break;
    case 'set': setSetting(d.key); break;
    case 'back': closeModal(); break;
    case 'resume': resumeGame(); break;
    case 'mute': sound.toggle(); showPause(); break;
    case 'quit':
      if (run) store.saveRun(suspend(run, 'leg'));
      input.pause(false);
      showTitle();
      break;
    default:
  }
}

function setSetting(key) {
  const s = settings();
  if (key === 'sound') sound.toggle();
  else if (key === 'reduced') { s.reduced = !reducedNow(); overlay = makeOverlay(); overlay.resize(W, H, DPR()); }
  else if (key === 'barks') s.barks = s.barks === false;
  else if (key === 'button') s.button = !s.button;
  else s[key] = !s[key];
  hud.setSlow(Boolean(s.slowCaptions));
  if (actBtn) actBtn.hidden = !buttonOn();
  store.saveMeta(meta);
  showSettings(G.back);
}

function copyLog() {
  const text = G.run ? runLogText(G.run, G.races) : 'AHEAD OF THE LIGHT';
  const done = () => { G.copied = true; };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => {});
  } catch (e) { /* no clipboard */ }
  return text;
}

// ---------------------------------------------------------------- pause and HOLD TO GO ON
function pauseGame(trust = true) {
  if (!(G.mode === 'play' || G.mode === 'toy') || G.paused) return false;
  G.paused = true;
  G.regrip = false;
  input.pause(trust);
  sound.setPaused(true);
  G.modal = 'pause';
  hint('');
  showPause();
  return true;
}
function resumeGame() {
  if (!G.paused) return;
  G.paused = false;
  G.modal = null;
  screens.hide();
  sound.setPaused(false);
  const you = G.race ? G.race.ships[0] : null;
  const r = input.resume(Boolean(you && you.whip));
  if (r === 'regrip') { G.regrip = true; hint(desk() ? 'HOLD SPACE TO GO ON' : 'HOLD TO GO ON'); }
  else goOn();
}
// Play goes on after 0.6 s of slow motion.
function goOn() {
  G.regrip = false;
  hint('');
  const race = G.race;
  if (race) race.slow = { x: tune.SLOWMO_X, until: race.real + tune.RESUME_SLOW };
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (G.run && (G.mode === 'play')) store.saveRun(suspend(G.run, 'pagehide'));
  pauseGame(false);
});
window.addEventListener('pagehide', () => { if (G.run && G.mode === 'play') store.saveRun(suspend(G.run, 'pagehide')); });
window.addEventListener('blur', () => pauseGame(false));
document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest('[data-switch]')) pauseGame(true);
}, true);
$('pause').addEventListener('click', (e) => { e.stopPropagation(); if (!pauseGame(true)) resumeGame(); });

function hint(text) {
  const el = $('hint');
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}
function fx(name, on) {
  const el = $(`fx-${name}`);
  if (el) el.classList.toggle('fade', Boolean(on));
}

// ---------------------------------------------------------------- input
bindInput(input, {
  el: window, tune, topDead: tune.TOP_DEAD,
  button: () => (actBtn && !actBtn.hidden ? actBtn.getBoundingClientRect() : null),
  blocked: () => !(G.mode === 'play' || G.mode === 'toy') || G.paused || screens.open,
  onKey: (code, e) => {
    if (code === 'Escape' || code === 'KeyP') { e.preventDefault(); pauseGame(true); }
    else if (code === 'KeyM') sound.toggle();
  },
});
if (actBtn) actBtn.hidden = !buttonOn();

window.addEventListener('pointerdown', (e) => {
  root.dataset.input = e.pointerType === 'mouse' ? 'desk' : 'touch';
  if (timing.firstInputMs === null && (G.mode === 'play' || G.mode === 'toy')) timing.firstInputMs = performance.now() - playAt;
  sound.start();
  if (G.mode === 'vista' && G.vistaSkippable && vista) vista.skip();
  if (G.mode === 'ending' && performance.now() - G.endAt > 400) G.endAt = -1e9;
}, true);

// Keys for the screens (the play keys go through bindInput).
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  root.dataset.input = 'desk';
  if (timing.firstInputMs === null && (G.mode === 'play' || G.mode === 'toy')) timing.firstInputMs = performance.now() - playAt;
  if (e.repeat) return;
  const code = e.code;
  if (G.paused) {
    if (code === 'Escape' || code === 'KeyP') {
      e.preventDefault();
      if (!G.modal || G.modal === 'pause') resumeGame();
      else closeModal();
    }
    return;
  }
  if (G.modal && code === 'Escape') { e.preventDefault(); closeModal(); return; }
  if (G.mode === 'title' && !G.modal && (code === 'Space' || code === 'Enter')) {
    if (e.target && e.target.closest && e.target.closest('button, a')) return;
    e.preventDefault();
    start();
    return;
  }
  if (G.mode === 'vista' && G.vistaSkippable && vista && (code === 'Space' || code === 'Enter')) {
    e.preventDefault();
    vista.skip();
    return;
  }
  if (['break', 'chart', 'result', 'toycard'].includes(G.mode) && screens.key(code)) { e.preventDefault(); return; }
  if (code === 'KeyM' && G.mode !== 'play') sound.toggle();
});

// The pad on the screens: the d-pad moves the highlight, A picks, Y rerolls, Start pauses or goes on.
const padWas = { l: false, r: false, a: false, y: false, start: false };
function padScreens() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const g = pads && [...pads].find((p) => p && p.connected);
  if (!g) return;
  const b = (k) => Boolean(g.buttons[k] && g.buttons[k].pressed);
  const now = { l: b(14) || g.axes[0] < -0.6, r: b(15) || g.axes[0] > 0.6, a: b(0), y: b(3), start: b(9) };
  const edge = (k) => now[k] && !padWas[k];
  if (edge('start')) { if (G.paused) resumeGame(); else if (G.mode === 'title') start(); }
  if (['break', 'chart', 'result', 'toycard'].includes(G.mode)) {
    if (edge('l')) screens.key('ArrowLeft');
    if (edge('r')) screens.key('ArrowRight');
    if (edge('a')) screens.key('Enter');
    if (edge('y')) screens.key('KeyR');
  } else if (G.mode === 'title' && edge('a')) start();
  Object.assign(padWas, now);
}

// ---------------------------------------------------------------- per frame: effects, sound, captions
function nearYou(id) {
  const race = G.race;
  if (!race) return false;
  const you = race.ships[0], s = race.ships.find((x) => x.id === id);
  if (!s) return false;
  return Math.abs(s.dist - you.dist) / Math.max(1e-6, beatsPerS(you.eta, race.tune || tune)) < 1;
}

// The first thing on your line that would hit within ALARM_LEAD: { t, side } or null.
function dangerOf(race) {
  const you = race.ships[0], T = race.tune || tune;
  if (you.caught || you.wrecked) return null;
  const bps = Math.max(1e-6, beatsPerS(you.eta, T, you.lightspeed));
  const lead = T.ALARM_LEAD * bps;
  const items = race.leg.items;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.beat <= you.dist) continue;
    if (it.beat > you.dist + lead) break;
    if (it.kind !== 'knot' && it.kind !== 'wall' && it.kind !== 'gate' && it.kind !== 'pulse') continue;
    if (isDropped(race, it)) continue;
    const r = resolve(it, you.bearing, it.beat, T, you.half);
    if (r.hit) {
      const side = it.kind === 'wall' ? 0 : -Math.sign(wrap((it.psi || 0) - you.bearing)) || 1;
      return { t: (it.beat - you.dist) / bps, side };
    }
  }
  return null;
}

function feed(events, race) {
  if (!events.length || !race) return;
  const you = race.ships[0];
  overlay.onEvents(events, race);
  const v = scene.view && scene.view();
  sound.onEvents(events.length > 96 ? events.slice(-96) : events, { you: you.id, race,
    doppler: v && finite(v.phi) ? Math.cosh(v.phi) : 1 });
  haptics.onEvents(events, { you: you.id, near: nearYou });
  for (const e of events) if (e.type === 'gearUp' && e.ship === you.id && e.best) hud.bigGear();
}

function captionFrame(events, race) {
  if (!race) return;
  if (G.toy) {
    const caps = G.toy.captions;
    for (; G.toyCaps < caps.length; G.toyCaps++) {
      const c = caps[G.toyCaps];
      hud.say(c.text, { pri: c.id === 'took' ? PRI.light : PRI.teach, type: c.id });
    }
  }
  const s = settings();
  const list = captionsFor(events, { race, mem: G.mem, runs: meta.seen ? meta.seen.runs || 0 : 0, desk: desk(),
    button: buttonOn(), barks: s.barks !== false && opt.barks !== '0', toy: Boolean(G.toy),
    fires: G.toy || G.piece ? [] : cardFires(race), prevDist: G.prevDist ?? 0 });
  for (const c of list) hud.say(c.text, c);
  G.prevDist = race.ships[0].dist;
}

function soundState(race, dt) {
  const you = race ? race.ships[0] : null;
  const mode = G.paused ? 'paused' : G.mode === 'toy' ? 'play' : G.mode === 'ending' ? 'result' : G.mode;
  if (!you) return { mode };
  const T = race.tune || tune;
  let sweep = null;
  if (you.whip) {
    const a = you.whip.angle || 0;
    if (G.sweep.a !== null && dt > 0) G.sweep.v += ((Math.abs(a - G.sweep.a) / dt) - G.sweep.v) * 0.3;
    G.sweep.a = a;
    sweep = { sweep: G.sweep.v, red: Boolean(you.whip.red) };
  } else G.sweep = { a: null, v: 0 };
  const slow = race.slow && race.slow.x !== 1 && race.real < race.slow.until ? race.slow.x : race.stop > 0 ? 0.4 : 1;
  const d = G.mode === 'play' || G.mode === 'toy' ? dangerOf(race) : null;
  return {
    mode, beat: you.dist, eta: you.eta, bpm: bpmOf(you.eta, T, you.lightspeed), gear: you.gear, lightspeed: you.lightspeed,
    headlight: you.headlight, slow, whip: sweep, draft: you.draft ? you.draft.charge || 0 : 0,
    inWindow: !you.whip && windowOpen(race, you, T), ttc: G.piece ? 99 : you.ttc, light: G.piece ? 'far' : you.light,
    danger: d ? Math.max(0.001, d.t) : 0, dangerSide: d ? d.side : 0, lastHull: you.hull <= 1 && you.shield < 1,
    alarmLead: T.ALARM_LEAD, nudge: T.MUSIC_NUDGE, onHeart: (glare) => { if (glare) haptics.heart(); },
  };
}

// ---------------------------------------------------------------- drawing
function interp(race, alpha, on) {
  if (!race || !G.prev.length) return;
  for (let i = 0; i < race.ships.length && i < G.prev.length; i++) {
    const s = race.ships[i], p = G.prev[i];
    if (p.id !== s.id) continue;
    if (on) {
      p.cb = s.bearing; p.cd = s.dist;
      if (Math.abs(s.bearing - p.b) < 90) s.bearing = p.b + (s.bearing - p.b) * alpha;
      if (Math.abs(s.dist - p.d) < 2) s.dist = p.d + (s.dist - p.d) * alpha;
    } else { s.bearing = p.cb; s.dist = p.cd; }
  }
}

function drawPlay(dt, alpha) {
  const race = G.race;
  const run = G.run;
  const fixed = opt.cam === 'fixed' || Boolean(settings().fixedCam) || reducedNow();
  const live = !G.paused && G.mode !== 'ending';
  const a = live ? alpha : 1;
  interp(race, a, true);
  const view = scene.render(race, live ? dt : 0, { fixed, shake: overlay.shake() });
  overlay.render(race, view, live || G.mode === 'ending' ? dt : 0, {
    backdrop: scene.backdrop(), first: (meta.seen.runs || 0) < tune.TEACH_RUNS && !G.toy,
    runT: G.runT + race.t, tells: run ? tellsOf(run.build) : null,
  });
  interp(race, a, false);
  if (live) scene.adapt(dt);
  const you = race.ships[0];
  const landText = race.leg.type === 'earth' && race.phase !== 'done' ? landNeed(you, race.tune || tune).text : null;
  hud.update(race, { landText });
  return view;
}

// The title's faint ring, kept clear of the name: its bottom stays above the title block.
let titleTop = null;
function titleRing(view) {
  if (titleTop === null) {
    const h1 = document.querySelector('#title h1');
    titleTop = h1 ? h1.getBoundingClientRect().top : view.h;
  }
  const r = Math.min(view.R0, titleTop - 18 - view.cy);
  return r > 40 ? r : 0.01;
}
window.addEventListener('resize', () => { titleTop = null; });

function drawSky(dt, skyEta = 1.2) {
  const view = scene.render(null, dt, { title: true, skyEta });
  overlay.render(null, view, dt, { title: true, titleR: G.mode === 'title' ? titleRing(view) : 0.01 });
  if (G.mode !== 'title') octx.clearRect(0, 0, overCanvas.width, overCanvas.height);
  return view;
}

// ---------------------------------------------------------------- the loop
let last = null, fpsAvg = 60, frames = 0, drew = '', overShown = true;
function frame(now) {
  requestAnimationFrame(frame);
  frames++;
  const f0 = performance.now();
  const dt = last === null ? 0 : clamp((now - last) / 1000, 0, 0.25);
  last = now;
  if (dt > 0) fpsAvg += (1 / dt - fpsAvg) * 0.05;
  timing.fps = Math.round(fpsAvg);
  const stepping = (G.mode === 'play' || G.mode === 'toy') && !G.paused && !G.regrip;
  if (G.mode === 'play' || G.mode === 'toy') pollPad(input, performance.now());
  padScreens();
  if (G.regrip && !input.waiting) goOn();
  if (stepping) {
    G.acc += dt;
    const t1 = performance.now();
    while (G.acc >= STEP && (G.mode === 'play' || G.mode === 'toy')) {
      G.acc -= STEP;
      stepOnce(t1 - G.acc * 1000);
    }
  } else G.acc = 0;
  const alpha = clamp(G.acc / STEP, 0, 1);
  const r0 = performance.now();
  const race = G.race;
  const events = frameEvents;
  frameEvents = [];
  if ((G.mode === 'play' || G.mode === 'toy' || G.mode === 'ending' || G.mode === 'vista') && race) {
    feed(events, race);
    captionFrame(events, race);
  }
  drew = G.mode;
  const wantOverlay = !(G.mode === 'break' || G.mode === 'result' || G.mode === 'toycard');
  if (overShown !== wantOverlay) { overShown = wantOverlay; overCanvas.style.visibility = wantOverlay ? '' : 'hidden'; }
  switch (G.mode) {
    case 'play': case 'toy': case 'ending':
      if (race) drawPlay(dt, alpha);
      if (G.mode === 'ending' && (now - G.endAt) / 1000 >= G.endHold) showResult();
      break;
    case 'vista': {
      const on = vista ? vista.render(dt, octx) : false;
      if (!on) showBreak();
      break;
    }
    case 'chart': {
      drawSky(dt, G.run ? G.run.you.launchEta : 1.2);
      G.chartT += dt;
      const out = drawChart(octx, G.chartModel, { w: W, h: H, dpr: DPR(), t: G.chartT, chips: false });
      if (!G.chartRects && out && out.chips) { G.chartRects = out.chips; screens.chart(G.chartModel, out.chips); }
      break;
    }
    default:
      // the title flies the first leg's sky once it is built
      if (G.mode === 'title' && !scene.fallback && G.built[ROUTE[0]] && (scene.backdrop() || {}).type !== ROUTE[0]) {
        useBackdrop(ROUTE[0]);
      }
      drawSky(dt, G.mode === 'break' && G.run ? G.run.you.launchEta : 1.2);
  }
  perfS.render.push(performance.now() - r0);
  sound.frame(soundState(G.mode === 'vista' || G.mode === 'break' ? null : race, dt), dt);
  hud.frame(G.paused ? 0 : dt);
  if (opt.debug || opt.perf) debugLine(race);
  perfS.frame.push(performance.now() - f0);
  for (const k of Object.keys(perfS)) if (perfS[k].length > 240) perfS[k].splice(0, perfS[k].length - 240);
}

function debugLine(race) {
  const el = $('debug');
  if (!el) return;
  el.hidden = false;
  const i = scene.info();
  const you = race && race.ships[0];
  el.textContent = `${G.mode} ${timing.fps}fps calls ${i.calls} pts ${i.points} gl ${i.glScale.toFixed(2)} ${i.tier}`
    + (you ? ` · b${you.dist.toFixed(1)} η${you.eta.toFixed(2)} ttc${(you.ttc || 0).toFixed(1)} ${you.light}` : '');
}

// ---------------------------------------------------------------- the test hook (20)
const youShip = () => (G.race ? G.race.ships[0] : null);

function advance(seconds = 1, inp) {
  if (inp) window.__race.input(inp);
  if (G.mode === 'title') start();
  const out = [];
  const n = Math.max(0, Math.round(seconds / STEP));
  for (let i = 0; i < n; i++) {
    if (G.mode === 'vista' && vista) { vista.render(seconds - i * STEP, octx); vista.skip(); showBreak(); break; }
    if (!(G.mode === 'play' || G.mode === 'toy') || G.paused || G.regrip) break;
    for (const e of stepOnce(performance.now())) out.push(e);
  }
  if (G.mode === 'ending') { G.endAt = -1e9; showResult(); }
  return plain(out);
}

function sumCounts(...tables) {
  const out = {};
  for (const t of tables) for (const [k, v] of Object.entries(t || {})) out[k] = (out[k] || 0) + v;
  return out;
}
const q = (a, p) => {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  return Math.round(b[Math.floor((b.length - 1) * p)] * 100) / 100;
};

window.__race = {
  id: SLUG, version: 1, tune,
  state() {
    const s = youShip();
    const v = scene.view && scene.view() || ringView({ w: W, h: H, tune });
    const run = G.run, race = G.race;
    return plain({
      mode: G.mode, paused: G.paused, regrip: G.regrip, modal: G.modal, screen: screens.name, ranked: G.ranked, frames, drew,
      seed: run ? run.seed : G.toy ? G.toy.seed : null, leg: run ? run.leg : race ? race.legNo : null,
      type: race ? race.leg.type : run ? ROUTE[run.leg] : null, runPhase: run ? run.phase : null,
      phase: race ? race.phase : null, t: race ? race.t : 0, real: race ? race.real : 0,
      layout: { kind: v.kind, w: v.w, h: v.h, cx: v.cx, cy: v.cy, R: v.R, R0: v.R0 },
      you: s && { bearing: s.bearing, target: s.target, dist: s.dist, eta: s.eta, gear: s.gear, light: s.light,
        ttc: s.ttc, gap: s.gap, hull: s.hull, shield: s.shield, fuel: s.fuel, whip: Boolean(s.whip), caught: s.caught,
        wrecked: s.wrecked, inWindow: Boolean(race && windowOpen(race, s, race.tune || tune)) },
      ships: race ? race.ships.length : 0, caption: hud.caption, set: url.set, options: opt, driver: driverName,
      input: { scheme: input.scheme, holding: input.holding, waiting: input.waiting, pointers: input.pointers,
        counts: { ...input.counts } }, tier, fallback: Boolean(scene.fallback), sound: sound.isOn(),
      voices: sound.voices(), toy: G.toy ? { t: G.toy.race.t, sum: G.toy.sum } : null,
    });
  },
  run: () => (G.run ? snapshot(G.run) : null),
  survival() {
    const s = youShip();
    if (!s) return null;
    const T = G.race.tune || tune;
    return plain({ gap: s.gap, ttc: s.ttc, light: s.light, hull: s.hull, hullMax: s.hullMax, shield: s.shield,
      shieldT: s.shieldT, fuel: s.fuel, fuelCap: s.fuelCap, years: s.years, earth: s.earth,
      cap: T.GAP_CAP[G.race.legNo] + (s.lightHold || 0), leg: G.race.legNo });
  },
  rivals() {
    const race = G.race;
    if (!race) return [];
    const me = race.ships[0];
    const bps = Math.max(1e-6, beatsPerS(me.eta, race.tune || tune, me.lightspeed));
    return plain(race.ships.slice(1).map((r) => ({
      id: r.id, kind: r.kind, type: r.type, mode: r.ai ? r.ai.mode ?? null : null, gapAhead: (r.dist - me.dist) / bps,
      lightGap: r.gap, eta: r.eta, gear: r.gear, hull: r.hull, fuel: r.fuel, glare: r.light === 'glare',
      nemesis: Boolean(r.ai && r.ai.nemesis), target: r.ai ? r.ai.target ?? null : null, alive: !r.caught && !r.wrecked,
      bearing: r.bearing })));
  },
  events: (n = 50) => plain(recent.slice(-Math.max(0, n))),
  timing: () => ({ ...timing }),
  perf() {
    const i = scene.info();
    return plain({ fps: timing.fps, drawCalls: i.calls, points: i.points, glScale: i.glScale, tier: i.tier,
      ratio: i.ratio, hazards: i.hazards, backdrop: i.backdrop, backdropPoints: i.backdropPoints,
      frameMs: { p50: q(perfS.frame, 0.5), p95: q(perfS.frame, 0.95) }, renderMs: { p50: q(perfS.render, 0.5),
        p95: q(perfS.render, 0.95) }, stepMs: { p50: q(perfS.step, 0.5), p95: q(perfS.step, 0.95) },
      overlayOps: overlay.state ? overlay.state.ops : 0, voices: sound.voices(), fallback: Boolean(scene.fallback) });
  },
  // sounds started, effects drawn (the overlay's and the HUD's) and haptics fired, per event type, where they start
  feedback: () => plain({ sounds: sound.played(), effects: sumCounts(overlay.shown(), hud.counts()),
    haptics: haptics.fired(), captions: hud.counts() }),
  restart,
  advance,
  input(intent = {}) {
    if ('target' in intent) hook.target = finite(intent.target) ? intent.target : null;
    if ('turn' in intent) hook.turn = clamp(Number(intent.turn) || 0, -1, 1);
    if (intent.action === 'down' || intent.action === 'up') hook.action = intent.action;
    if (intent.burn) hook.burn = true;
    if (timing.firstSteerMs === null && G.mode === 'play' && (hook.target !== null || hook.turn)) {
      timing.firstSteerMs = performance.now() - playAt;
    }
    return { ...hook };
  },
  bot(name, opts = {}) {
    if (!name) { driver = null; driverName = null; return true; }
    if (!DRIVERS[name] && !PRESETS[name]) return false;
    driver = driverFor(name, opts);
    driverName = name;
    return true;
  },
  // A rival's knobs, with overrides merged in (unranked).
  rivalBot(id, overrides = {}) {
    const r = G.race && G.race.ships.find((s) => s.id === id || s.type === id);
    if (!r || !r.ai) return null;
    r.ai.knobs = { ...(r.ai.knobs || {}), ...overrides };
    G.ranked = false;
    return plain(r.ai.knobs);
  },
  // Replace this leg's field: spec { regulars, drifters, boss, none } as race.leg.field (unranked).
  field(spec = {}) {
    const race = G.race;
    if (!race || !G.run) return null;
    const you = race.ships[0];
    const leg = { ...race.leg, field: { regulars: 3, drifters: 0, boss: null, ...spec } };
    let k = 0;
    const ships = createField({ run: G.run, legNo: race.legNo, rng: () => ((k = (k * 9301 + 49297) % 233280) / 233280),
      tune: race.tune || tune, leg, you }) || [];
    race.ships = [you, ...ships];
    G.prev = [];
    G.ranked = false;
    return race.ships.map((s) => s.id);
  },
  pick: (i) => { action('pick', { i: String(i) }); return G.run ? plain(breakOf(G.run, tune)) : null; },
  skip: () => { action('skip'); return G.run ? plain(breakOf(G.run, tune)) : null; },
  reroll: () => { action('reroll'); return G.run ? plain(breakOf(G.run, tune)) : null; },
  banish: (i) => { action('banish', { i: String(i) }); return G.run ? plain(breakOf(G.run, tune)) : null; },
  lane(i = 0) {
    if (!G.run) return false;
    if (G.mode === 'break') { if (!skip(G.run, tune) && G.run.phase !== 'chart') return false; showChart(); }
    if (G.mode !== 'chart' || !chooseLane(G.run, i)) return false;
    launchLeg();
    return true;
  },
  buy: (chip) => { const ok = G.run ? buy(G.run, chip, tune) : false; if (G.mode === 'break') showBreak(); return ok; },
  refund: (chip) => { const ok = G.run ? refund(G.run, chip, tune) : false; if (G.mode === 'break') showBreak(); return ok; },
  leg() {
    const race = G.race;
    if (!race) return null;
    const L = race.leg;
    return plain({ type: L.type, name: LEG_TYPES[L.type] ? LEG_TYPES[L.type].name : L.name || null, lane: L.lane,
      seed: L.seed, beats: L.beats, hash: L.hash, items: L.items.length, gate: L.gate, phase: race.phase });
  },
  course({ from = 0, to = Infinity } = {}) {
    return G.race ? plain(G.race.leg.items.filter((it) => it.beat >= from && it.beat <= to)) : [];
  },
  gen({ seed = 1, type = 'web', lane = null, mods = {} } = {}) {
    const L = buildLeg({ runSeed: seed, type, lane, mods, tune });
    return plain({ type: L.type, seed: L.seed, beats: L.beats, hash: L.hash, items: L.items.length, report: L.report });
  },
  validate({ seed = 1, type = 'web', lane = null } = {}) {
    return plain(validateLeg(buildLeg({ runSeed: seed, type, lane, tune })));
  },
  chart: () => (G.run ? plain(chartOf(G.run, tune)) : null),
  goto: gotoLeg,
  toy: (seed) => { startToy(seed || 1); return true; },
  save() {
    if (!G.run) return null;
    const env = suspend(G.run, G.mode === 'break' || G.mode === 'chart' ? 'break' : 'leg');
    store.saveRun(env);
    return serialize(env);
  },
  load(json) {
    const o = typeof json === 'string' ? restoreSave(json) : json;
    const env = migrate(o);
    const r = env ? resume(env, tune) : null;
    if (!r) return false;
    store.saveRun(env.run && env.at ? env : suspend(r, 'break'));
    G.mode = 'title';
    action('resume-save');
    return true;
  },
  clearSave() { store.clear(); meta = createMeta(); return true; },
  meta: () => plain(meta),
  setMeta(obj) {
    meta = normalizeMeta(plain(obj));
    store.saveMeta(meta);
    if (G.mode === 'title') showTitle();
    return true;
  },
  daily(date = cottageDay()) { return dailyFor(date, meta); },
  medal: (type, years) => medalFor(type, years),
  screen: () => screens.name,
  action: (act, d) => action(act, d || {}),
  pause: () => pauseGame(true),
  resume: () => { resumeGame(); return G.paused; },
};

// ---------------------------------------------------------------- boot
if (opt.bot) window.__race.bot(opt.bot);
if (reducedNow()) root.dataset.motion = 'reduced';
showTitle();
requestAnimationFrame(frame);
