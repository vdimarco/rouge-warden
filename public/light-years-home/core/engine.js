// Light Years Home: the rules of the game as a pure state machine. The state is plain data (JSON and structuredClone
// safe) and the same seed with the same inputs always gives the same journey. main.js calls update() on a fixed tick
// with { hold }, sends discrete actions with act(), and drains events for the HUD, sound and saves.
// Phases: title, intro, clue, scan, fork, flight, reveal, chapter, ending, lost. Pause is a flag, not a phase.
import {
  heatRatio, zoneLimit, viewRapidity, zoneDistance, zoneLambda, fmt, groupDigits, DAYS_PER_YEAR,
} from './physics.js';
import { STOPS, CHAPTERS, INTRO, zonesFor, legLengthLy, legPoints, resolve, candidate, stopIndex } from './route.js';
import { OBJECTS, distanceLy } from './objects.js';
import { pointAlong } from './gas.js';
import { todayFrom, milestonesBetween, milestoneAgo, heardYear, arrivalText } from './timeline.js';
import { MILESTONES } from './milestones.js';
import { chunk, timings, SLOW } from './captions.js';
import { cleanSettings, cleanProgress, RANKS } from './save.js';
import { hashSeed } from './rng.js';

// ---------- constants (final.md 2.13) ----------

export const TICK = 1 / 60;
export const PANES = 3;
export const THROTTLE_UP = 0.42, THROTTLE_DOWN = 0.9;              // per second
export const HEAT_GAIN = 0.55, HEAT_MAX_RATE = 1.5, HEAT_COOL = 0.22;
export const CRACK_HEAT = 0.4, CRACK_LOCK = 0.8;                     // heat after a crack; seconds of locked input
export const CARRY_PER_WRONG = 0.25, CARRY_MAX = 0.5;
export const DROPOUT = 1.2, HINT_AFTER = 25;                         // seconds

// Pacing and thresholds the design states in prose (2.6, 2.8, 2.9).
export const HEAT_SAFE = 0.8;              // under this heat ratio the Lens cools
export const HEAT_HIGH = 0.7;              // the HUD shows HOT above this heat
export const CRACK_DROP = 0.1;             // after a crack the throttle sits this far under the notch
export const NOTCH_SOON = 1.5;             // screen seconds before a zone: warn of its notch
export const RATE_K = 0.35, RATE_MIN = 0.3, RATE_MAX = 1.6;   // zone progress rate: clamp(e^(0.35 (η − η_lim)))
export const ETA_HEADROOM = 0.8, ETA_FLOOR = 1.6, ETA_SPAN = 4.8;
export const REVEAL_MIN = 3;               // seconds a reveal stays up unless hurried
export const CAPTION_TAIL = 0.12;          // seconds between one caption line and the next
export const GENTLE_ZERO = 1;              // seconds at zero throttle before the last drop-out
export const VIEW_EASE = 5;                // per second: the view eases to rest in a drop-out
export const MAX_DT = 0.25;                // update() ignores longer steps
export const POINTS = Object.freeze({
  find: Object.freeze([1000, 400, 100]), spot: 300, grade: 500, gradeCap: 1.6, clean: 50, crack: -400, sheet: 400,
  gentle: 500, pane: 1000, perfect: 5000,
});
export const RANK_AT = Object.freeze([15000, 25000, 32000]);       // score where each rank after the first begins
export const ENDING_BEATS = Object.freeze(['approach', 'today', 'clocks', 'address', 'card']);
const BEAT_MIN = { approach: 8, today: 6, clocks: 6, address: 15, card: 0 };
export const LETTERS = Object.freeze(['A', 'B', 'C']);
export const PHASES = Object.freeze(['title', 'intro', 'clue', 'scan', 'fork', 'flight', 'reveal', 'chapter', 'ending',
  'lost']);

// Lines the engine says itself (route.js holds the rest). Our own words; numbers as digits.
export const TEXT = Object.freeze({
  crack: 'Shield cracked.',
  lostNear: (name) => `Your shield gives out near ${name}.`,
  lostOnWay: (name) => `Your shield gives out on the way to ${name}.`,
  lostWhen: (when) => `On Earth it is ${when}.`,
  lostNobody: 'Nobody there knows you were coming.',
  approach: 'The radio catches up. It is playing right now.',
  home: 'You are home.',
  forYou: (time) => `For you: ${time}.`,
  forEarth: (years) => `For Earth: ${years} years.`,
  noAnimals: 'You left before there were animals on Earth.',
  address: Object.freeze([['Earth.', 'earth'], ['The Sun.', 'sun'], ['The Orion Arm.', 'orion-arm'],
    ['The Milky Way.', 'milky-way'], ['The Local Group.', 'local-group'], ['Laniakea.', 'laniakea'],
    ['Not the centre of anything.', null], ['Home.', 'home']]),
});

// ---------- route data the engine derives once ----------

const LAST = STOPS.length - 1;
const CHAPTER_STARTS = CHAPTERS.map((c) => stopIndex(c.stops[0]));
const FIRST_TRIES = STOPS.length + STOPS.filter((s) => s.spot).length;   // 17
const LEG_LY = STOPS.map((_, i) => legLengthLy(i));
const AHEAD = LEG_LY.map((_, i) => LEG_LY.slice(i).reduce((a, b) => a + b, 0)).concat([0]);
export const ROUTE_LY = AHEAD[0];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const copy = (v) => JSON.parse(JSON.stringify(v));
const EPS = 1e-9;

// Light-years of route still ahead when the leg to stop i starts (AHEAD[15] = 0, home).
export function aheadAt(i) {
  return AHEAD[clamp(Math.round(Number(i) || 0), 0, AHEAD.length - 1)];
}

const legCache = new Map();

// A leg's flight plan: zones with their limit η, notch x and pacing λ, the leg's η range and its par ship time.
function legFor(stop, branch) {
  const i = clamp(Math.round(Number(stop) || 0), 0, LAST);
  const b = STOPS[i].branches && branch === 'void' ? 'void' : 'sheet';
  const key = `${i}:${b}`;
  if (legCache.has(key)) return legCache.get(key);
  const raw = zonesFor(i, b);
  const limits = raw.map((z) => zoneLimit(z.n));
  const etaHi = Math.max(...limits) + ETA_HEADROOM;
  const etaLo = Math.min(Math.min(...limits) - ETA_FLOOR, etaHi - ETA_SPAN);
  const zones = raw.map((z, k) => Object.freeze({
    ...z,
    screen: k === raw.length - 1 && !(z.screen > 0) ? DROPOUT : z.screen,
    limit: limits[k],
    notch: clamp((limits[k] - etaLo) / (etaHi - etaLo), 0, 1),
    lambda: k < raw.length - 1 ? zoneLambda(z.ly, raw[k + 1].ly) : 0,
    dropout: k === raw.length - 1,
  }));
  const leg = {
    stop: i, id: STOPS[i].id, branch: b, lengthLy: LEG_LY[i], zones: Object.freeze(zones), etaLo, etaHi,
    points: Object.freeze(legPoints(i, b)),
  };
  leg.parLimit = parShipYears(leg);
  leg.par = gradePar(leg);
  Object.freeze(leg);
  legCache.set(key, leg);
  return leg;
}

// ---------- pure helpers for the HUD, the bots and the tests ----------

// The leg being flown or about to be flown: { stop, id, branch, lengthLy, zones, etaLo, etaHi, par, points }.
export function legOf(state) {
  return legFor(state.stop, state.branch);
}

// η for throttle x on a leg: η_lo + x (η_hi − η_lo).
export function etaFor(leg, x) {
  return leg.etaLo + clamp(isNum(x) ? x : 0, 0, 1) * (leg.etaHi - leg.etaLo);
}

// Ship time in years with every zone flown exactly at its limit.
export function parShipYears(leg) {
  return leg.zones.reduce((s, z) => s + z.ly / Math.sinh(isNum(z.limit) ? z.limit : zoneLimit(z.n)), 0);
}

// Ship time of a leg's first zone flown from a standing start. Every flight starts at x = 0 and the throttle rises at
// THROTTLE_UP, so even a perfect pilot crosses the start of that zone under its notch, where most of a long zone's
// distance passes. Flown with the flight's own rules: hold until the notch, then stay on it.
export function standingStartYears(leg) {
  const z = leg.zones[0];
  if (z.dropout) return z.ly / Math.sinh(z.limit);
  let x = 0, p = 0, years = 0;
  for (let i = 0; i < 1e6 && p < 1; i++) {
    x = Math.min(z.notch, x + THROTTLE_UP * TICK);
    const eta = etaFor(leg, x);
    const next = Math.min(1, p + TICK * rateOf(z, eta) / z.screen);
    years += (zoneDistance(next, z.ly, z.lambda) - zoneDistance(p, z.ly, z.lambda)) / Math.sinh(eta);
    p = next;
  }
  return years;
}

// The flight grade's par: the first zone from a standing start, every other zone at its limit. A pilot who beats it
// rode over a notch somewhere.
export function gradePar(leg) {
  const z = leg.zones[0];
  return parShipYears(leg) - z.ly / Math.sinh(z.limit) + standingStartYears(leg);
}

export function rankFor(score) {
  const s = isNum(score) ? score : 0;
  const k = RANK_AT.findIndex((at) => s < at);
  return RANKS[k < 0 ? RANKS.length - 1 : k];
}

// Zone progress per second of screen time: faster above the notch, slower under it.
function rateOf(z, eta) {
  return clamp(Math.exp(RATE_K * (eta - z.limit)), RATE_MIN, RATE_MAX);
}

// The zone being flown: { index, zone, notchX, nextNotchX, nextIn, dropout }. nextIn is the screen time left in this
// zone at the current speed. null outside a flight.
export function zoneAt(state) {
  const f = state && state.flight;
  if (!f || (state.phase !== 'flight' && state.phase !== 'lost')) return null;
  const leg = legOf(state);
  const z = leg.zones[f.zone], next = leg.zones[f.zone + 1] || null;
  const rate = z.dropout ? 1 : rateOf(z, f.eta);
  return {
    index: f.zone, zone: z, notchX: z.notch, nextNotchX: next ? next.notch : null,
    nextIn: (1 - f.p) * z.screen / rate, dropout: z.dropout,
  };
}

// The scan being played: { id, mode, entry, letters, target, open, tried, candidates }.
export function scanOf(state) {
  if (!state || !STOPS[state.stop]) return null;
  const entry = scanEntry(state);
  const letters = state.draw[entry.id];
  const tried = state.scan.tried;
  return {
    id: entry.id, mode: state.mode, entry, letters: { ...letters },
    target: LETTERS.find((k) => letters[k] === entry.target.id),
    open: state.scan.open, tried: [...tried],
    candidates: LETTERS.map((k) => ({ letter: k, grey: tried.includes(k), ...candidate(entry, letters[k]) })),
  };
}

function scanEntry(state) {
  const stop = STOPS[state.stop];
  return state.mode === 'spot' && stop.spot ? stop.spot : stop;
}

// ---------- create and start ----------

function toSeed(seed) {
  if (Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff) return seed;
  return hashSeed(String(seed));
}

const freshScan = () => ({ open: null, tried: [], locks: 0, idle: 0, hint: false, teach: false });
const zeroScore = () => ({
  finds: 0, spots: 0, flight: 0, clean: 0, cracks: 0, sheet: 0, gentle: 0, panes: 0, perfect: 0, total: 0,
});
const zeroStats = () => ({ firstTry: 0, wrong: 0, cracks: 0, retries: 0, topEta: 0, legGrades: [] });

export function create({ seed = 1, today, firstRun = true, settings = {} } = {}) {
  const s = toSeed(seed);
  return {
    v: 1, seed: s,
    today: todayFrom(today),
    firstRun: firstRun !== false,
    settings: cleanSettings(settings),
    phase: 'title', mode: 'stop', paused: false,
    t: 0, phaseT: 0,
    chapter: 0, stop: 0,
    draw: resolve(s),
    scan: freshScan(),
    branch: null,
    flight: null,
    heatCarry: 0,
    panes: PANES,
    clocks: { ship: 0, earth: 0, aheadLy: AHEAD[0], radio: null },
    score: zeroScore(),
    stats: zeroStats(),
    say: { queue: [], current: null, t: 0, n: 0 },
    shown: [],
    ending: null,
    checkpoint: null,
    events: [],
  };
}

// Starts a journey: the intro on a first run, else the first clue (after the Laniakea line). With a valid progress
// save, play resumes at that chapter's first clue with its score, panes and stats. skipIntro (QA) goes straight to
// the first clue.
export function start(state, { progress = null, skipIntro = false } = {}) {
  resetJourney(state, state.seed, state.firstRun);
  const p = progress ? validProgress(progress) : null;
  if (p) {
    restore(state, p);
    emitChapter(state, { resumed: true });
    enterClue(state);
    return state;
  }
  state.checkpoint = snapshot(state);
  emitChapter(state, {});
  if (skipIntro) enterClue(state);
  else if (state.firstRun) enterIntro(state);
  else enterClue(state, INTRO.filter((l) => !l.firstRunOnly));
  return state;
}

// A fresh journey in place. The phase is kept so the next phase event names where play came from.
function resetJourney(state, seed, firstRun) {
  const fresh = create({ seed, today: state.today, firstRun, settings: state.settings });
  const events = state.events || [];
  const phase = PHASES.includes(state.phase) ? state.phase : 'title';
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh, { events, phase });
}

// ---------- progress (chapter-start snapshots) ----------

function snapshot(state) {
  return {
    v: 1, seed: state.seed, chapter: state.chapter, stop: state.stop, score: state.score.total, panes: state.panes,
    stats: copy(state.stats), branch: state.branch, shown: [...state.shown],
    points: { ...state.score }, ship: state.clocks.ship, earth: state.clocks.earth, heatCarry: state.heatCarry,
  };
}

// A progress record from storage, cleaned by save.js and then checked for the engine's own fields.
function validProgress(raw) {
  const p = cleanProgress(raw);
  if (!p) return null;
  const pts = zeroScore();
  let ok = p.points && typeof p.points === 'object';
  if (ok) {
    for (const k of Object.keys(pts)) {
      if (!isNum(p.points[k])) { ok = false; break; }
      pts[k] = p.points[k];
    }
  }
  if (ok) {
    const sum = Object.keys(pts).filter((k) => k !== 'total').reduce((s, k) => s + pts[k], 0);
    ok = Math.abs(sum - p.score) < 0.5 && Math.abs(pts.total - p.score) < 0.5;
  }
  const points = ok ? pts : { ...zeroScore(), finds: p.score, total: p.score };
  const stats = zeroStats();
  for (const k of ['firstTry', 'wrong', 'cracks', 'retries', 'topEta']) if (isNum(p.stats[k])) stats[k] = p.stats[k];
  if (Array.isArray(p.stats.legGrades)) stats.legGrades = p.stats.legGrades.slice(0, p.stop);
  const ship = isNum(p.ship) && p.ship >= 0 && p.ship < 1000 ? p.ship
    : LEG_LY.slice(0, p.stop).reduce((s, _, i) => s + legFor(i, p.branch).par, 0);
  const earth = isNum(p.earth) && p.earth >= 0 ? p.earth : ROUTE_LY - AHEAD[p.stop];
  const heatCarry = isNum(p.heatCarry) ? clamp(p.heatCarry, 0, CARRY_MAX) : 0;
  const branch = p.stop > 3 ? (p.branch === 'void' ? 'void' : 'sheet') : null;
  const shown = p.shown.filter((id) => MILESTONES.some((m) => m.id === id));
  return {
    v: 1, seed: p.seed, chapter: p.chapter, stop: p.stop, score: points.total, panes: p.panes, stats, branch, shown,
    points, ship, earth, heatCarry,
  };
}

function restore(state, p) {
  resetJourney(state, p.seed, state.firstRun);
  state.chapter = p.chapter;
  state.stop = p.stop;
  state.panes = clamp(p.panes, 1, PANES);
  state.stats = copy(p.stats);
  state.branch = p.branch;
  state.shown = [...p.shown];
  state.score = { ...p.points };
  state.heatCarry = p.heatCarry;
  state.clocks = { ship: p.ship, earth: p.earth, aheadLy: AHEAD[p.stop], radio: null };
  state.checkpoint = copy(p);
}

// The chapter-start snapshot, shaped for save.js (v, seed, chapter, stop, score, panes, stats, branch, shown) plus
// the engine's own points, ship, earth and heatCarry.
export function progressOf(state) {
  return copy(state.checkpoint || snapshot(state));
}

// The record for the best save: { score, reached, home, shipYears, firstTry, rank, date }.
export function resultOf(state) {
  const home = state.phase === 'ending';
  const arrived = home ? STOPS.length
    : state.stop + (state.phase === 'reveal' || state.mode === 'spot' ? 1 : 0);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    score: Math.max(0, Math.round(state.score.total)),
    reached: clamp(arrived, 0, STOPS.length),
    home,
    shipYears: state.clocks.ship,
    firstTry: state.stats.firstTry,
    rank: rankFor(state.score.total),
    date: `${String(state.today.y).padStart(4, '0')}-${pad(state.today.m)}-${pad(state.today.d)}`,
  };
}

// ---------- events and captions ----------

function emit(state, type, payload = {}) {
  state.events.push({ type, ...payload });
}

export function drainEvents(state) {
  const out = state.events;
  state.events = [];
  return out;
}

function setPhase(state, to) {
  const from = state.phase;
  state.phase = to;
  state.phaseT = 0;
  emit(state, 'phase', { from, to });
}

// Queue a caption. now: replace the one showing; front: next in line.
function say(state, text, kind, { now = false, front = false, ring = null } = {}) {
  if (!text) return;
  const slow = state.settings.captions === 'slow';
  const chunks = chunk(text);
  const item = {
    id: ++state.say.n, kind, text, chunks,
    dur: timings(chunks, slow).total + CAPTION_TAIL * (slow ? SLOW : 1),
    ring: ring || null,
  };
  if (now) {
    state.say.queue.unshift(item);
    nextCaption(state);
  } else {
    if (front) state.say.queue.unshift(item);
    else state.say.queue.push(item);
    if (!state.say.current) nextCaption(state);
  }
}

function nextCaption(state) {
  const item = state.say.queue.shift() || null;
  state.say.current = item;
  state.say.t = 0;
  if (item) emit(state, 'say', { item: copy(item) });
}

function clearSay(state) {
  state.say.queue = [];
  state.say.current = null;
  state.say.t = 0;
}

const quiet = (state) => !state.say.current && state.say.queue.length === 0;

function tickSay(state, dt) {
  if (!state.say.current) return;
  state.say.t += dt;
  if (state.say.t >= state.say.current.dur - EPS) nextCaption(state);
}

// Coaching (first run only) and lines (every run) of the stop being flown. trigger: 'flight', 'notch', 'radio' or
// a zone index.
function cue(state, trigger) {
  const f = state.flight;
  if (!f) return;
  const stop = STOPS[state.stop];
  const key = typeof trigger === 'number' ? `z${trigger}` : trigger;
  if (f.cues.includes(key)) return;
  f.cues.push(key);
  const match = (c) => (typeof trigger === 'number' ? c.atZone === trigger : c.at === trigger);
  const coach = (state.firstRun ? stop.coach : []).filter(match).map((c) => c.text);
  const lines = stop.lines.filter(match).map((c) => c.text);
  if (typeof trigger === 'number' && coach.length) {
    // a coaching warning for the zone ahead cuts in at once, in order
    say(state, coach[0], 'coach', { now: true });
    for (const text of coach.slice(1).reverse()) say(state, text, 'coach', { front: true });
  } else {
    for (const text of coach) say(state, text, 'coach');
  }
  // story lines wait their turn ("Listen. The first radio from home." was cut off half way by the next line)
  for (const text of lines) say(state, text, 'line');
}

function emitChapter(state, extra) {
  const c = CHAPTERS[state.chapter];
  emit(state, 'chapter', {
    chapter: state.chapter, title: c.title, info: c.info, progress: progressOf(state), ...extra,
  });
}

// ---------- phases ----------

function enterIntro(state) {
  setPhase(state, 'intro');
  clearSay(state);
  for (const l of INTRO) say(state, l.text, 'intro', { ring: l.ring });
}

// The clue step: the clue plays and the candidate rings draw. A tap on a ring opens its card at once.
function enterClue(state, prelude = []) {
  state.flight = null;
  state.scan = freshScan();
  state.scan.teach = state.firstRun && state.stop === 0 && state.mode === 'stop';
  setPhase(state, 'clue');
  clearSay(state);
  for (const l of prelude) say(state, l.text, 'intro', { ring: l.ring });
  say(state, scanEntry(state).clue, 'clue');
  updateRadio(state);
}

function enterScan(state) {
  setPhase(state, 'scan');
}

function enterFork(state) {
  setPhase(state, 'fork');
  clearSay(state);
  say(state, STOPS[state.stop].fork.prompt, 'fork');
}

function startFlight(state) {
  const leg = legOf(state);
  state.flight = {
    zone: 0, p: 0, x: 0, eta: leg.etaLo, view: 0, heat: clamp(state.heatCarry, 0, 1), lock: 0, ly: 0, ship: 0,
    earth: 0, clean: true, cracks: 0, zeroT: 0, hot: false, soon: false, cues: [],
  };
  state.heatCarry = 0;
  state.scan.open = null;
  setPhase(state, 'flight');
  // The scan's lines (a clue still playing, a why-not) end here, so the flight coaching plays now and not after a
  // later warning ("Hold to go faster." once came after "Galaxy ahead. Let go!").
  clearSay(state);
  emit(state, 'flightStart', { stop: state.stop, id: leg.id, branch: leg.branch, heat: state.flight.heat });
  cue(state, 'flight');
  enterZone(state, leg, 0, null);
}

function enterZone(state, leg, index, cleared) {
  const f = state.flight, z = leg.zones[index];
  f.zone = index;
  f.p = 0;
  f.clean = true;
  f.soon = false;
  if (z.dropout) {
    // The drop-out: the throttle goes to 0 and the view eases to rest, while the drive holds its speed (never above
    // the zone's limit) and stops at once at the target.
    if (state.stop === LAST && f.zeroT >= GENTLE_ZERO - EPS) {
      state.score.gentle = POINTS.gentle;
      total(state);
    }
    f.x = 0;
    f.lock = 0;
    f.eta = Math.min(f.eta, z.limit);
  }
  emit(state, 'zone', { index, label: z.label, kind: z.kind, n: z.n, notchX: z.notch, dropout: z.dropout, cleared });
  cue(state, index);
}

function enterReveal(state) {
  state.flight = null;
  const entry = scanEntry(state);
  setPhase(state, 'reveal');
  clearSay(state);
  say(state, entry.reveal, 'reveal');
  emit(state, 'reveal', { id: entry.id, mode: state.mode });
  updateRadio(state);
}

function nextAfterReveal(state) {
  const stop = STOPS[state.stop];
  if (state.mode === 'stop' && stop.spot) {
    state.mode = 'spot';
    emit(state, 'spot', { id: stop.spot.id });
    enterClue(state);
    return;
  }
  state.mode = 'stop';
  const next = state.stop + 1;
  if (next > LAST) {
    enterEnding(state);
    return;
  }
  const ch = CHAPTER_STARTS.indexOf(next);
  if (ch > 0) {
    enterChapterCard(state, ch);
    return;
  }
  state.stop = next;
  enterClue(state);
}

// The card between chapters. This is the chapter start: one pane returns and the checkpoint is taken, so a player
// who leaves here resumes at the next chapter.
function enterChapterCard(state, ch) {
  const ended = state.chapter;
  state.chapter = ch;
  state.stop = CHAPTER_STARTS[ch];
  state.mode = 'stop';
  const restored = state.panes < PANES;
  if (restored) state.panes += 1;
  state.checkpoint = snapshot(state);
  setPhase(state, 'chapter');
  clearSay(state);
  say(state, CHAPTERS[ended].end, 'chapter');
  emitChapter(state, { ended });
  if (restored) emit(state, 'paneRestored', { panes: state.panes });
}

function arriveLeg(state, leg) {
  const f = state.flight;
  const grade = Math.round(POINTS.grade * clamp(f.ship > 0 ? leg.par / f.ship : POINTS.gradeCap, 0, POINTS.gradeCap));
  state.score.flight += grade;
  state.stats.legGrades.push(grade);
  let sheet = 0;
  if (STOPS[state.stop].branches && leg.branch === 'sheet' && f.cracks === 0) {
    sheet = POINTS.sheet;
    state.score.sheet += sheet;
  }
  total(state);
  emit(state, 'arrive', { stop: state.stop, id: leg.id, grade, ship: f.ship, earth: f.earth, par: leg.par, sheet });
  if (state.stop === LAST) enterEnding(state);
  else enterReveal(state);
}

function enterEnding(state) {
  state.flight = null;
  state.mode = 'stop';
  state.score.panes = state.panes * POINTS.pane;
  const s = state.stats;
  if (s.firstTry === FIRST_TRIES && s.cracks === 0 && s.retries === 0) state.score.perfect = POINTS.perfect;
  total(state);
  setPhase(state, 'ending');
  state.ending = { beat: 0, t: 0, done: false };
  emit(state, 'home', { result: resultOf(state) });
  startBeat(state, 0);
}

function shipWords(years) {
  const y = Math.max(0, years);
  const whole = Math.floor(y);
  const days = Math.floor((y - whole) * DAYS_PER_YEAR);
  const part = (n, w) => `${groupDigits(n)} ${w}${n === 1 ? '' : 's'}`;
  if (whole === 0) return part(days, 'day');
  return days === 0 ? part(whole, 'year') : `${part(whole, 'year')}, ${part(days, 'day')}`;
}

function startBeat(state, i) {
  const beat = ENDING_BEATS[clamp(i, 0, ENDING_BEATS.length - 1)];
  state.ending.beat = ENDING_BEATS.indexOf(beat);
  state.ending.t = 0;
  clearSay(state);
  if (beat === 'approach') say(state, TEXT.approach, 'ending', { ring: 'moon' });
  if (beat === 'today') {
    say(state, arrivalText(state.today).line, 'ending', { ring: 'home' });
    say(state, TEXT.home, 'ending', { ring: 'home' });
  }
  if (beat === 'clocks') {
    say(state, TEXT.forYou(shipWords(state.clocks.ship)), 'ending');
    say(state, TEXT.forEarth(groupDigits(Math.floor(state.clocks.earth + EPS))), 'ending');
    say(state, TEXT.noAnimals, 'ending');
  }
  if (beat === 'address') for (const [text, ring] of TEXT.address) say(state, text, 'ending', { ring });
  if (beat === 'card') state.ending.done = true;
}

function tickEnding(state, dt) {
  const e = state.ending;
  e.t += dt;
  if (!e.done && quiet(state) && e.t >= BEAT_MIN[ENDING_BEATS[e.beat]] - EPS) startBeat(state, e.beat + 1);
}

// Earth's date in words for the lost captions: '2009', '8018 BC', '478 million years before today'.
function earthWhen(state) {
  const ago = state.clocks.aheadLy;
  if (ago < 12000) return fmt.earthDate(ago, state.today).replace('TODAY', 'today');
  const big = ago >= 1e9 ? [ago / 1e9, ' billion'] : ago >= 1e6 ? [ago / 1e6, ' million'] : [ago, ''];
  const n = big[1] ? String(Number(big[0].toPrecision(3))) : groupDigits(Number(ago.toPrecision(3)));
  return `${n}${big[1]} years before today`;
}

function lose(state) {
  const f = state.flight;
  const stop = STOPS[state.stop];
  const name = stop.reveal.split('.')[0].replace(/^The /, 'the ');
  const share = f ? f.ly / legOf(state).lengthLy : 0;
  setPhase(state, 'lost');
  clearSay(state);
  const when = earthWhen(state);
  say(state, share >= 0.5 ? TEXT.lostNear(name) : TEXT.lostOnWay(name), 'lost');
  say(state, TEXT.lostWhen(when), 'lost');
  say(state, TEXT.lostNobody, 'lost');
  emit(state, 'lost', { stop: state.stop, id: stop.id, name, when, result: resultOf(state) });
}

function total(state) {
  const s = state.score;
  s.total = s.finds + s.spots + s.flight + s.clean + s.cracks + s.sheet + s.gentle + s.panes + s.perfect;
}

// ---------- flight ----------

function shipPos(state) {
  if (state.flight) return pointAlong(legOf(state).points, state.flight.ly);
  if (state.phase === 'ending') return OBJECTS.earth.pos;
  const stop = STOPS[state.stop];
  if (state.phase === 'reveal' || state.mode === 'spot') return OBJECTS[stop.to].pos;
  return OBJECTS[stop.from].pos;
}

// The radio heard from Earth (chapter IV): the year it left Earth, or null before 1895.
function updateRadio(state) {
  const year = state.chapter === CHAPTERS.length - 1
    ? heardYear(state.today, state.clocks.aheadLy, distanceLy(shipPos(state), 'earth')) : null;
  if (year === state.clocks.radio) return;
  const first = state.clocks.radio === null;
  state.clocks.radio = year;
  if (year === null) return;
  emit(state, 'radio', { year, earthYear: Math.floor(state.today.frac - state.clocks.aheadLy) });
  if (first && state.flight) cue(state, 'radio');
}

function passMilestones(state, fromAhead, toAhead) {
  for (const m of milestonesBetween(fromAhead, toAhead, state.today)) {
    if (state.shown.includes(m.id)) continue;
    state.shown.push(m.id);
    emit(state, 'milestone', { id: m.id, text: m.text, yearsAgo: milestoneAgo(m, state.today) });
  }
}

function crack(state, leg, z) {
  const f = state.flight;
  state.panes -= 1;
  f.cracks += 1;
  state.stats.cracks += 1;
  state.score.cracks += POINTS.crack;
  total(state);
  f.heat = CRACK_HEAT;
  f.hot = false;
  f.clean = false;
  f.x = Math.max(0, z.notch - CRACK_DROP);
  f.eta = etaFor(leg, f.x);
  f.view = viewRapidity(f.x);
  f.lock = CRACK_LOCK;
  emit(state, 'crack', { panes: state.panes, stop: state.stop });
  if (state.panes <= 0) {
    lose(state);
    return true;
  }
  say(state, TEXT.crack, 'crack', { now: true });
  return false;
}

function tickFlight(state, hold, dt) {
  const f = state.flight;
  const leg = legOf(state);
  const z = leg.zones[f.zone];
  // throttle, speed and view
  if (z.dropout) {
    f.view *= Math.exp(-VIEW_EASE * dt);
  } else {
    if (f.lock > 0) f.lock = f.lock - dt > EPS ? f.lock - dt : 0;
    else f.x = clamp(f.x + (hold ? THROTTLE_UP : -THROTTLE_DOWN) * dt, 0, 1);
    f.eta = etaFor(leg, f.x);
    f.view = viewRapidity(f.x);
    if (f.x >= z.notch) cue(state, 'notch');
  }
  f.zeroT = f.x === 0 ? f.zeroT + dt : 0;
  if (f.eta > state.stats.topEta) state.stats.topEta = f.eta;
  // heat on the Lens
  const r = heatRatio(z.n, f.eta);
  const before = f.heat;
  if (r > 1) f.heat = Math.min(1, f.heat + Math.min(HEAT_MAX_RATE, HEAT_GAIN * Math.log(r)) * dt);
  else if (r < HEAT_SAFE) f.heat = Math.max(0, f.heat - HEAT_COOL * dt);
  if (f.heat > before) f.clean = false;
  if (f.heat > HEAT_HIGH && !f.hot) {
    f.hot = true;
    emit(state, 'heatHigh', { heat: f.heat });
  } else if (f.heat <= HEAT_HIGH) {
    f.hot = false;
  }
  if (f.heat >= 1 - EPS && crack(state, leg, z)) return;
  // progress through the zone, and the true distance it covers
  const rate = z.dropout ? 1 : rateOf(z, f.eta);
  const p = Math.min(1, f.p + dt * rate / z.screen);
  const d = zoneDistance(p, z.ly, z.lambda) - zoneDistance(f.p, z.ly, z.lambda);
  f.p = p;
  const done = p >= 1;
  const arrived = done && z.dropout;
  f.ly = arrived ? leg.lengthLy : z.startLy + zoneDistance(p, z.ly, z.lambda);
  // the two clocks, from the true distance
  if (d > 0) {
    const ship = d / Math.sinh(f.eta), earth = d / Math.tanh(f.eta);
    f.ship += ship;
    f.earth += earth;
    state.clocks.ship += ship;
    state.clocks.earth += earth;
  }
  const prevAhead = state.clocks.aheadLy;
  state.clocks.aheadLy = arrived ? AHEAD[state.stop + 1] : Math.max(AHEAD[state.stop + 1], AHEAD[state.stop] - f.ly);
  passMilestones(state, prevAhead, state.clocks.aheadLy);
  updateRadio(state);
  if (arrived) {
    arriveLeg(state, leg);
    return;
  }
  if (done) {
    const hazard = z.kind === 'waypoint' || z.n >= 0.1;
    let cleared = null;
    if (hazard && f.clean) {
      state.score.clean += POINTS.clean;
      total(state);
      cleared = { label: z.label, points: POINTS.clean };
    }
    enterZone(state, leg, f.zone + 1, cleared);
    return;
  }
  // warn of the next zone's notch
  const next = leg.zones[f.zone + 1];
  if (!f.soon && next && !next.dropout && (1 - f.p) * z.screen / rate <= NOTCH_SOON + EPS) {
    f.soon = true;
    emit(state, 'notchSoon', { zone: f.zone + 1, notchX: next.notch, label: next.label });
    cue(state, f.zone + 1);
  }
}

// ---------- update and act ----------

// One fixed step. input { hold: boolean }. A no-op while paused, in 'title', in 'lost' once its lines are said, and
// once the ending reaches the score card; NaN, negative or too-long steps are ignored.
export function update(state, input, dt) {
  if (!state || state.paused || typeof dt !== 'number' || !(dt > 0) || !(dt <= MAX_DT)) return state;
  const ph = state.phase;
  if (ph === 'title' || (ph === 'ending' && state.ending && state.ending.done) || (ph === 'lost' && quiet(state))) {
    return state;
  }
  const hold = Boolean(input) && input.hold === true;
  state.t += dt;
  state.phaseT += dt;
  tickSay(state, dt);
  switch (ph) {
    case 'intro':
      if (quiet(state)) enterClue(state);
      break;
    case 'clue':
      if (quiet(state)) enterScan(state);
      break;
    case 'scan':
      state.scan.idle += dt;
      if (state.settings.hints && state.scan.idle >= HINT_AFTER - EPS) state.scan.hint = true;
      break;
    case 'flight':
      tickFlight(state, hold, dt);
      break;
    case 'reveal':
      if (quiet(state) && state.phaseT >= REVEAL_MIN - EPS) nextAfterReveal(state);
      break;
    case 'ending':
      tickEnding(state, dt);
      break;
    default:
      break;
  }
  return state;
}

const PLAY = new Set(['intro', 'clue', 'scan', 'fork', 'flight', 'reveal', 'chapter']);

// Discrete actions. Any action that does not fit the phase is ignored and emits nothing.
export function act(state, action) {
  if (!state || !action || typeof action.type !== 'string') return state;
  const ph = state.phase;
  switch (action.type) {
    case 'pause':
      if (ph !== 'title' && !state.paused) {
        state.paused = true;
        emit(state, 'pause');
      }
      return state;
    case 'resume':
      if (state.paused) {
        state.paused = false;
        emit(state, 'resume');
      }
      return state;
    case 'settings':
      if (action.settings && typeof action.settings === 'object') {
        state.settings = cleanSettings({ ...state.settings, ...action.settings });
      }
      return state;
    case 'retryChapter':
    case 'newJourney': {
      const paused = state.paused;
      const ok = action.type === 'retryChapter'
        ? state.checkpoint && (ph === 'lost' || (paused && PLAY.has(ph)))
        : ph === 'lost' || ph === 'ending' || (paused && PLAY.has(ph));
      if (!ok) return state;
      if (action.type === 'retryChapter') retryChapter(state);
      else newJourney(state, action.seed);
      if (paused) emit(state, 'resume');
      return state;
    }
    default:
      break;
  }
  if (state.paused) return state;
  const sc = state.scan;
  switch (action.type) {
    case 'advance':
      if (ph === 'title') break;
      if (ph === 'chapter') { enterClue(state); break; }
      if (ph === 'ending') {
        if (!state.ending.done) startBeat(state, state.ending.beat + 1);
        break;
      }
      if (state.say.current) { nextCaption(state); break; }
      if (ph === 'reveal') nextAfterReveal(state);
      break;
    case 'select':
      if ((ph === 'scan' || ph === 'clue') && LETTERS.includes(action.letter) && !sc.tried.includes(action.letter)) {
        if (ph === 'clue') enterScan(state);
        sc.open = action.letter;
        sc.idle = 0;
        sc.teach = false;
        emit(state, 'select', { letter: action.letter, id: state.draw[scanEntry(state).id][action.letter] });
      }
      break;
    case 'close':
      if (ph === 'scan' && sc.open) {
        sc.open = null;
        sc.idle = 0;
      }
      break;
    case 'lock':
      if (ph === 'scan' && sc.open && !sc.tried.includes(sc.open)) lock(state);
      break;
    case 'fork':
      if (ph === 'fork' && (action.branch === 'sheet' || action.branch === 'void')) {
        state.branch = action.branch;
        emit(state, 'fork', { branch: action.branch });
        startFlight(state);
      }
      break;
    default:
      break;
  }
  return state;
}

function lock(state) {
  const sc = state.scan;
  const entry = scanEntry(state);
  const letter = sc.open;
  const id = state.draw[entry.id][letter];
  const c = candidate(entry, id);
  sc.locks += 1;
  sc.idle = 0;
  sc.open = null;
  if (!c.isTarget) {
    sc.tried.push(letter);
    state.stats.wrong += 1;
    state.heatCarry = Math.min(CARRY_MAX, state.heatCarry + CARRY_PER_WRONG);
    say(state, c.whyNot, 'whyNot', { now: true });
    emit(state, 'wrong', { letter, id, whyNot: c.whyNot, heatCarry: state.heatCarry, mode: state.mode });
    return;
  }
  const spot = state.mode === 'spot';
  const points = spot ? (sc.locks === 1 ? POINTS.spot : 0) : POINTS.find[Math.min(sc.locks, 3) - 1];
  if (sc.locks === 1) state.stats.firstTry += 1;
  if (spot) state.score.spots += points;
  else state.score.finds += points;
  total(state);
  emit(state, 'lock', { letter, id, mode: state.mode, tries: sc.locks, points });
  if (spot) enterReveal(state);
  else if (STOPS[state.stop].fork) enterFork(state);
  else startFlight(state);
}

function retryChapter(state) {
  const cp = copy(state.checkpoint);
  cp.stats.retries += 1;
  cp.panes = PANES;
  const firstRun = state.firstRun;
  restore(state, cp);
  state.firstRun = firstRun;
  emitChapter(state, { retry: true });
  enterClue(state);
}

function newJourney(state, seed) {
  const s = Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff ? seed : hashSeed(state.seed, 'next');
  resetJourney(state, s, false);
  state.checkpoint = snapshot(state);
  emitChapter(state, { fresh: true });
  enterClue(state, INTRO.filter((l) => !l.firstRunOnly));
}

// ---------- QA: put the journey at a given point (the test hook's jump) ----------

// phase 'clue' | 'scan' | 'flight' | 'reveal' | 'ending' | 'lost'. opts: { x, zone, p, mode: 'spot', branch, panes }.
// Earlier legs count as flown at par; their milestones count as shown.
export function jump(state, stop, phase, opts = {}) {
  const i = clamp(Math.round(Number(stop) || 0), 0, LAST);
  const ph = ['clue', 'scan', 'flight', 'reveal', 'ending', 'lost'].includes(phase) ? phase : 'clue';
  const at = ph === 'ending' ? LAST : i;
  state.stop = at;
  state.chapter = STOPS[at].chapter;
  state.mode = opts.mode === 'spot' && STOPS[at].spot && ph !== 'flight' && ph !== 'lost' && ph !== 'ending'
    ? 'spot' : 'stop';
  const flying = ph === 'flight' || ph === 'lost';
  if (at > 3 || (at === 3 && (flying || ph === 'reveal' || state.mode === 'spot'))) {
    state.branch = opts.branch === 'void' ? 'void' : opts.branch === 'sheet' ? 'sheet' : state.branch || 'sheet';
  } else {
    state.branch = null;
  }
  state.paused = false;
  state.ending = null;
  state.flight = null;
  state.scan = freshScan();
  state.heatCarry = 0;
  state.panes = clamp(Math.round(isNum(opts.panes) ? opts.panes : PANES), 1, PANES);
  clearSay(state);
  const arrived = ph === 'reveal' || ph === 'ending' || state.mode === 'spot';
  const legs = arrived ? at + 1 : at;
  const par = (k) => legFor(k, state.branch).par;
  state.clocks = { ship: LEG_LY.slice(0, legs).reduce((s, _, k) => s + par(k), 0), earth: ROUTE_LY - AHEAD[legs],
    aheadLy: AHEAD[legs], radio: null };
  state.shown = MILESTONES.filter((m) => milestoneAgo(m, state.today) >= state.clocks.aheadLy).map((m) => m.id);
  const cpStop = CHAPTER_STARTS[state.chapter];
  state.checkpoint = { ...snapshot(state), stop: cpStop, branch: cpStop > 3 ? state.branch : null,
    ship: LEG_LY.slice(0, cpStop).reduce((s, _, k) => s + par(k), 0), earth: ROUTE_LY - AHEAD[cpStop] };
  if (ph === 'clue') enterClue(state);
  else if (ph === 'scan') {
    enterClue(state);
    clearSay(state);
    enterScan(state);
  } else if (ph === 'reveal') enterReveal(state);
  else if (ph === 'ending') enterEnding(state);
  else {
    startFlight(state);
    const leg = legOf(state), f = state.flight;
    const zi = clamp(Math.round(isNum(opts.zone) ? opts.zone : 0), 0, leg.zones.length - 1);
    const z = leg.zones[zi];
    if (zi > 0) enterZone(state, leg, zi, null);
    f.p = clamp(isNum(opts.p) ? opts.p : 0, 0, z.dropout ? 0.999 : 1 - 1e-6);
    f.ly = z.startLy + zoneDistance(f.p, z.ly, z.lambda);
    f.x = z.dropout ? 0 : clamp(isNum(opts.x) ? opts.x : 0, 0, 1);
    f.eta = z.dropout ? Math.min(etaFor(leg, isNum(opts.x) ? opts.x : 0), z.limit) : etaFor(leg, f.x);
    f.view = viewRapidity(isNum(opts.x) ? clamp(opts.x, 0, 1) : f.x);
    const flown = leg.zones.slice(0, zi).reduce((s, q) => s + q.ly / Math.sinh(q.limit), 0)
      + (f.ly - z.startLy) / Math.sinh(z.limit);
    state.clocks.ship += flown;
    f.ship = flown;
    f.earth = f.ly;
    state.clocks.earth += f.ly;
    state.clocks.aheadLy = AHEAD[at] - f.ly;
    state.shown = MILESTONES.filter((m) => milestoneAgo(m, state.today) >= state.clocks.aheadLy).map((m) => m.id);
    updateRadio(state);
    if (ph === 'lost') {
      state.panes = 0;
      lose(state);
    }
  }
  return state;
}
