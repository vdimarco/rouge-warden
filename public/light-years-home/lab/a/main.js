// Light Years Ahead (lab A): the page. Input (drag, halves, keys, mouse), the fixed 120 Hz loop with rendering on
// requestAnimationFrame, URL tuning, the title and the cards, telemetry with Copy log, pause, and window.__lab.
import { TUNE, createState, step, restart, BOTS, par, summary, rankOf, DEG, wrap, INTRO_SKIP } from './core.js';
import { createView } from './view.js';
import { createSound } from './sound.js';
import { blackbodyRGB, srgbEncode } from '../../core/physics.js';

const STEP = 1 / 120;
const RUNS_KEY = 'lyh-lab-a-runs';
const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- URL tuning: every TUNE key, case-insensitive, plus seed, debug, toy, bot, scheme, cam ----------
const query = new URLSearchParams(location.search);
const qget = (name) => {
  for (const [k, v] of query) if (k.toLowerCase() === name.toLowerCase()) return v;
  return null;
};
const overrides = {};
const tuneLive = { ...TUNE };
for (const k of Object.keys(TUNE)) {
  const v = qget(k);
  if (v !== null && v !== '' && Number.isFinite(Number(v))) { tuneLive[k] = Number(v); overrides[k] = Number(v); }
}
const tune = Object.freeze(tuneLive);
const seedArg = Number.parseInt(qget('seed') ?? '', 10);
const debug = qget('debug') === '1';
const toy = qget('toy') === '1';
const halvesOpt = qget('scheme') === 'halves';
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const camForced = qget('cam') === 'fixed' || reduced;
const BOT_PRESETS = {
  novice: ['human', { reactMs: 300, jitterDeg: 7, greed: 0.2 }],
  mid: ['human', { reactMs: 200, jitterDeg: 3, greed: 0.6 }],
  expert: ['human', { reactMs: 140, jitterDeg: 1.2, greed: 0.95 }],
};

// ---------- the game ----------
let S = createState({ seed: Number.isFinite(seedArg) ? seedArg >>> 0 : 1, tune, toy });
const glCanvas = $('view'), overlay = $('overlay');
const view = createView({ glCanvas, overlay, tune, seed: S.seed, reduced, debug,
  fx: { flash: $('fx-flash'), red: $('fx-red'), rim: $('fx-rim'), flood: $('fx-flood'), fill: $('fx-fill') } });
const sound = createSound();
let mode = 'title';                 // 'title' | 'play' (S.phase says play, caught or clear)
let paused = false;
let camFixed = camForced;
let titleBeat = 0;
let log = [];
const runs = [];
const timing = { firstInputMs: null, lastRetryMs: null, fps: 0 };
let playAt = 0, retryTapAt = null, cardShownFor = null, cardAt = 0, firstInputLogged = false;
let lastInputKind = coarse ? 'touch' : 'keys';

// The steering scheme is locked for a run by its first deliberate input (keys, drag, halves or mouse aim), and the
// camera with it. Nothing changes the camera mid-run. The next run starts with the last run's scheme in mind.
let scheme = null, lastScheme = null;
const inp = {
  dAim: 0, ptrs: new Map(), active: null, halves: new Map(), keys: { l: false, r: false }, keyAt: -1e9,
  mouse: null, mouseTrail: [], mouseHold: false,
  bot: null, manual: null,
};

let glScale = 1, slowFor = 0;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  view.resize(w, h, Math.min(window.devicePixelRatio || 1, 2), glScale);
}
// A slow device draws the sky at a lower resolution: after 2 s under 40 fps, three steps at most.
function adapt(dt) {
  if (mode !== 'play' || paused || glScale <= 0.5) return;
  slowFor = fpsAvg < 40 ? slowFor + dt : 0;
  if (slowFor > 2) { glScale = Math.max(0.5, glScale * 0.75); slowFor = 0; fpsAvg = 50; resize(); }
}
window.addEventListener('resize', resize);
resize();

function steerText() {
  if (scheme === 'mouse') return 'POINT TO STEER';
  if (scheme === 'keys' || (!scheme && !coarse)) return '← → TO STEER';
  return halvesOpt ? 'HOLD LEFT OR RIGHT' : 'DRAG TO STEER';
}
$('go').textContent = coarse ? 'TAP TO FLY' : 'CLICK OR PRESS SPACE';

// ---------- input ----------
const switcherOpen = () => Boolean(window.GameSwitch && window.GameSwitch.isOpen);
const isControl = (el) => Boolean(el && el.closest && el.closest('button, a'));
const playing = () => mode === 'play' && S.phase === 'play' && !paused;

function noteInput(kind) {
  lastInputKind = kind;
  if (!firstInputLogged && mode === 'play' && S.phase === 'play') {
    firstInputLogged = true;
    timing.firstInputMs = Math.round(performance.now() - playAt);
  }
}

// Lock this run's scheme. The camera follows the scheme only while the two cameras still agree (near the start
// bearing), so the view never snaps; mouse aim needs the fixed camera, so it can lock only then.
function lockScheme(kind) {
  if (scheme) return scheme === kind;
  const wantFixed = camForced || kind === 'mouse';
  const canSwitch = Math.abs(wrap(S.bearing)) < 20;
  if (wantFixed !== camFixed) {
    if (!canSwitch) { if (kind === 'mouse') return false; }
    else camFixed = wantFixed;
  }
  scheme = kind;
  lastScheme = kind;
  if (kind === 'mouse' && runs.length < 2) view.say('POINT TO STEER', { min: 1.6, prio: 2 });
  return true;
}

// Drag gain rises with thumb speed: fine control when slow, a flick swings far.
function gainAt(v) {
  const k = clamp((v - tune.GAIN_V0) / Math.max(1, tune.GAIN_V1 - tune.GAIN_V0), 0, 1);
  return tune.GAIN + (tune.GAIN_FAST - tune.GAIN) * k * k * (3 - 2 * k);
}

// Key changes are queued with their timestamps and replayed onto the 120 Hz steps they fall in, so a tap shorter
// than a slow frame still turns the ship for as long as it was held.
const keyQueue = [];
let keyNow = { l: false, r: false };
function keysAt(t) {
  if (t === undefined) { while (keyQueue.length) keyNow = keyQueue.shift(); return keyNow; }
  while (keyQueue.length && keyQueue[0].t <= t) keyNow = keyQueue.shift();
  return keyNow;
}
function pushKeys(t) { keyQueue.push({ t, l: inp.keys.l, r: inp.keys.r }); if (keyQueue.length > 64) keyQueue.shift(); }

function buildInput(t) {
  if (inp.bot) return inp.bot(S);
  if (inp.manual) return typeof inp.manual === 'function' ? inp.manual(S) : inp.manual;
  const k = keysAt(t);
  let turn = (k.r ? 1 : 0) - (k.l ? 1 : 0);
  if (!turn && inp.halves.size) {
    let l = false, r = false;
    for (const side of inp.halves.values()) { if (side < 0) l = true; else r = true; }
    turn = (r ? 1 : 0) - (l ? 1 : 0);
  }
  if (turn) { inp.dAim = 0; return { aim: null, turn }; }
  if (inp.dAim !== 0) {
    // drag right goes right round the ring, in either camera (in the fixed camera a projection onto the ship's path
    // stalled at 3 and 9 o'clock)
    const aim = (S.target + inp.dAim) * DEG;
    inp.dAim = 0;
    return { aim, turn: 0 };
  }
  if (scheme === 'mouse' && camFixed && inp.mouse && !inp.mouseHold) {
    const L = view.layout();
    const x = inp.mouse.x - L.cx, y = inp.mouse.y - L.cy;
    if (Math.hypot(x, y) > 14) {
      const want = Math.atan2(x, y) / DEG;
      return { aim: (S.bearing + wrap(want - S.bearing)) * DEG, turn: 0 };
    }
  }
  return { aim: null, turn: 0 };
}

// A tap on a card or during the closing pass: retry, or skip the vista once you have cleared before.
function tapAction(e) {
  if (S.phase === 'caught' && S.phaseT >= tune.CAUGHT_LOCK) { retry(); return true; }
  if (S.phase === 'clear' && cardShownFor === 'clear' && performance.now() - cardAt >= 800 && !isControl(e?.target)) {
    retry();
    return true;
  }
  if (S.phase === 'play' && S.vista && (S.meta.clears || 0) > 0) { skipVista(); return true; }
  return false;
}

window.addEventListener('pointerdown', (e) => {
  if (switcherOpen() || isControl(e.target)) return;
  sound.start();
  // the tap that starts or retries also grips: hold and drag straight away
  if (mode === 'title') { startPlay(); e.preventDefault(); }
  if (paused) return;
  if (S.phase !== 'play' || S.vista) tapAction(e);
  if (S.phase !== 'play') return;
  if (e.pointerType === 'mouse' && scheme === 'mouse') return;
  if (halvesOpt && e.pointerType !== 'mouse') {
    inp.halves.set(e.pointerId, e.clientX < window.innerWidth / 2 ? -1 : 1);
    lockScheme('halves');
    noteInput('halves');
  } else {
    // the most recent finger steers; a resting second thumb adds nothing
    const p = { x: e.clientX, y: e.clientY, t: e.timeStamp, v: 0, n: 0 };
    inp.ptrs.set(e.pointerId, p);
    inp.active = e.pointerId;
  }
  try { e.target.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
}, { passive: false });

window.addEventListener('pointermove', (e) => {
  if (switcherOpen()) return;
  if (e.pointerType === 'mouse' && !inp.ptrs.has(e.pointerId)) mouseMove(e);
  const p = inp.ptrs.get(e.pointerId);
  if (!p) return;
  const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
  const samples = list.length ? list : [e];
  for (const q of samples) {
    const dx = q.clientX - p.x, dy = q.clientY - p.y;
    const dt = Math.max(0.004, (q.timeStamp - p.t) / 1000 || 0.016);
    const inst = Math.hypot(dx, dy) / dt;
    p.v = p.n++ ? p.v + (inst - p.v) * 0.5 : inst;      // thumb speed, px/s (the first move counts in full)
    if (e.pointerId === inp.active && playing() && dx !== 0) {
      // a drag is always deliberate: it steers in any scheme (and holds off mouse aim until the mouse moves again)
      lockScheme('drag');
      if (scheme === 'mouse') inp.mouseHold = true;
      inp.dAim += dx * gainAt(p.v);
      noteInput('drag');
    }
    p.x = q.clientX; p.y = q.clientY; p.t = q.timeStamp;
  }
});

// Mouse aim only takes over on a deliberate sweep (120 px within 0.5 s), never over a button, never within 1.5 s
// of a key, and only if this run has not already been steered another way.
function mouseMove(e) {
  if (isControl(e.target)) { inp.mouseTrail.length = 0; return; }   // reaching for a button never steers
  inp.mouse = { x: e.clientX, y: e.clientY };
  if (!playing()) { inp.mouseTrail.length = 0; return; }
  if (scheme && scheme !== 'mouse') return;
  if (performance.now() - inp.keyAt < 1500) { inp.mouseTrail.length = 0; return; }
  const now = e.timeStamp;
  inp.mouseTrail.push({ x: e.clientX, y: e.clientY, t: now });
  while (inp.mouseTrail.length && now - inp.mouseTrail[0].t > 500) inp.mouseTrail.shift();
  let travel = 0;
  for (let i = 1; i < inp.mouseTrail.length; i++) {
    const a = inp.mouseTrail[i - 1], b = inp.mouseTrail[i];
    travel += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (scheme === 'mouse') {
    if (inp.mouseHold && travel > 30) inp.mouseHold = false;
    noteInput('mouse');
  } else if (travel > 120 && lockScheme('mouse')) noteInput('mouse');
}

const lift = (e) => {
  inp.ptrs.delete(e.pointerId);
  inp.halves.delete(e.pointerId);
  if (inp.active === e.pointerId) {
    // hand the steering to the newest finger still down, from where it is now
    let id = null;
    for (const k of inp.ptrs.keys()) id = k;
    inp.active = id;
  }
};
window.addEventListener('pointerup', lift);
window.addEventListener('pointercancel', lift);

const KEYS_L = new Set(['ArrowLeft', 'KeyA']), KEYS_R = new Set(['ArrowRight', 'KeyD']);
window.addEventListener('keydown', (e) => {
  if (switcherOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
  const c = e.code;
  if (KEYS_L.has(c) || KEYS_R.has(c)) {
    e.preventDefault();
    if (KEYS_L.has(c)) inp.keys.l = true; else inp.keys.r = true;
    if (!e.repeat) pushKeys(e.timeStamp);
    inp.keyAt = performance.now();
    if (mode === 'play' && S.phase === 'play') {
      // a mouse player's run starts locked to the mouse; keys in its first moments take over cleanly
      if (scheme === 'mouse' && S.t < 1.5 && Math.abs(wrap(S.bearing)) < 20) scheme = null;
      if (!lockScheme('keys') && scheme === 'mouse') inp.mouseHold = true;
      noteInput('keys');
    }
    return;
  }
  if (c === 'KeyM') { const on = sound.toggle(); $('mute').textContent = on ? 'Sound on' : 'Sound off'; return; }
  if (c === 'Escape' || c === 'KeyP') { if (mode === 'play' && S.phase === 'play') setPaused(!paused); return; }
  if (c === 'Space' || c === 'Enter' || c === 'KeyR') {
    if (e.target && isControl(e.target) && c !== 'KeyR') return;
    e.preventDefault();
    sound.start();
    if (mode === 'title') { startPlay(); return; }
    if (paused) { if (c === 'KeyR') { setPaused(false); retry(); } else setPaused(false); return; }
    if (S.phase === 'caught' && S.phaseT >= tune.CAUGHT_LOCK) retry();
    else if (S.phase === 'clear' && S.phaseT >= 0.5) retry();
    else if (S.phase === 'play' && c === 'KeyR') retry();
    else if (S.phase === 'play' && S.vista && (S.meta.clears || 0) > 0) skipVista();
  }
});
window.addEventListener('keyup', (e) => {
  if (!KEYS_L.has(e.code) && !KEYS_R.has(e.code)) return;
  if (KEYS_L.has(e.code)) inp.keys.l = false;
  if (KEYS_R.has(e.code)) inp.keys.r = false;
  pushKeys(e.timeStamp);
});
window.addEventListener('blur', () => {
  inp.keys.l = inp.keys.r = false; keyQueue.length = 0; keyNow = { l: false, r: false };
  inp.ptrs.clear(); inp.halves.clear(); inp.active = null;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play' && S.phase === 'play') setPaused(true);
});

// buttons give focus back, so Space never presses a hidden button by accident
$('pause').addEventListener('click', (e) => {
  e.currentTarget.blur();
  if (mode === 'play' && S.phase === 'play') setPaused(!paused);
});
$('resume').addEventListener('click', (e) => { e.currentTarget.blur(); setPaused(false); });
$('retry').addEventListener('click', () => { setPaused(false); retry(); });
$('mute').textContent = sound.isOn() ? 'Sound on' : 'Sound off';
$('mute').addEventListener('click', () => {
  const on = sound.toggle();
  $('mute').textContent = on ? 'Sound on' : 'Sound off';
});
$('again').addEventListener('click', (e) => { e.currentTarget.blur(); retry(); });
$('newsky').addEventListener('click', (e) => { e.currentTarget.blur(); retry({ newSeed: true }); });
$('copy').addEventListener('click', () => copyLog($('copy')));
$('copy2').addEventListener('click', () => copyLog($('copy2')));

// ---------- flow ----------
function startPlay() {
  mode = 'play';
  sound.start();
  playAt = performance.now();
  firstInputLogged = false;
  $('title').hidden = true;
  $('hudbox').hidden = false;
  view.reset(S, { seasoned: runs.length >= 1 });
}

function retry({ newSeed = false, seed = null } = {}) {
  retryTapAt = performance.now();
  restart(S, { newSeed, seed });
  inp.dAim = 0;
  inp.mouseTrail.length = 0;
  inp.mouseHold = false;
  // a new run: the camera starts as the last scheme wants it, and the first deliberate input locks it again
  scheme = null;
  camFixed = camForced || lastScheme === 'mouse';
  if (lastScheme === 'mouse') scheme = 'mouse';
  log = [];
  cardShownFor = null;
  $('caught').hidden = true;
  $('result').hidden = true;
  if (mode !== 'play') startPlay();
  else view.reset(S, { seasoned: runs.length >= 1 });
  playAt = performance.now();
  firstInputLogged = false;
}

// The closing pass after a first clear: a tap runs it out at once.
function skipVista() {
  for (let i = 0; i < 4000 && S.phase === 'play'; i++) handle(step(S, { aim: null, turn: 0 }, STEP));
}

function setPaused(p) {
  paused = p;
  $('paused').hidden = !p;
  sound.setPaused(p);
  if (!p) {
    acc = 0;
    // resume into a short slow motion, so a hazard 0.2 s away is not an instant hit
    if (S.phase === 'play') S.slow = Math.max(S.slow, tune.SLOWMO_RESUME);
  }
}

const buzzes = {};
const haptic = (ms, type) => {
  buzzes[type] = (buzzes[type] || 0) + 1;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* not allowed */ }
};
const HAPTICS = {
  graze: 8, hair: 15, thread: 40, hit: 60, bump: 12, chainEnd: 20, headlightEnd: 25,
  headlight: [80, 40, 160], caught: [120, 60, 220], clear: [30, 40, 30, 40, 90], warn: [20, 80, 20],
};

function handle(events) {
  if (!events.length) return;
  view.onEvents(events, S, { steerText: steerText(), seasoned: runs.length >= 2 });
  sound.onEvents(events, S);
  for (const e of events) {
    if (e.type !== 'tick') log.push(e);
    if (HAPTICS[e.type] !== undefined) haptic(HAPTICS[e.type], e.type);
    if (e.type === 'caught' || e.type === 'clear') { saveRun(); queueAhead(); }
  }
  if (log.length > 600) log = log.slice(-400);
}

// ---------- par, worked out in idle time ----------
// Par for this sky (and for the retry and the next sky) is worked out while a card or the title shows, one per idle
// callback, so no run ever stalls on it.
const parQueue = [];
const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 600 }) : setTimeout(fn, 60));
function pumpPar() {
  const job = parQueue.shift();
  if (!job) return;
  try { par(job.seed, tune, job.start); } catch { /* worked out later */ }
  if (parQueue.length) idle(pumpPar);
}
function queuePar(seed, start) {
  parQueue.push({ seed, start });
  if (parQueue.length === 1) idle(pumpPar);
}
// After a catch or a clear: par for AGAIN and for NEW SKY, from where the next run will start.
function queueAhead() {
  const start = (S.meta.farthest || 0) >= 20 ? INTRO_SKIP : 0;
  queuePar(S.seed, start);
  queuePar((S.seed >>> 0) + 1, start);
}

// ---------- telemetry ----------
function readRuns() {
  try {
    const v = JSON.parse(window.localStorage.getItem(RUNS_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function saveRun() {
  const p = par(S.seed, tune, S.startBeat);
  const L = view.layout();
  const row = {
    ...summary(S, p), at: new Date().toISOString().slice(0, 16), layout: L.kind, size: `${L.w}x${L.h}`,
    input: lastInputKind, scheme: scheme || 'none', cam: camFixed ? 'fixed' : 'ship', firstInputMs: timing.firstInputMs,
    retryMs: timing.lastRetryMs, tune: Object.keys(overrides).length ? overrides : undefined,
  };
  runs.push(row);
  const all = readRuns();
  all.push(row);
  try { window.localStorage.setItem(RUNS_KEY, JSON.stringify(all.slice(-20))); } catch { /* storage off */ }
}
async function copyLog(btn) {
  const text = JSON.stringify({ game: 'lyh-lab-a', version: 2, runs: readRuns().length ? readRuns() : runs });
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch { ok = false; }
  }
  const was = btn.textContent;
  btn.textContent = ok ? 'Copied' : 'Copy failed';
  setTimeout(() => { btn.textContent = was; }, 1200);
}

// ---------- HUD and cards ----------
const hudText = { speed: '', score: '', prog: -1, hl: null };
const css = (T) => {
  const c = blackbodyRGB(T).map((v) => Math.round(255 * srgbEncode(v)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
const num = (n) => Math.round(n).toLocaleString('en-US');
let countUp = null;
function hud() {
  if (mode !== 'play') return;
  const sp = `${Math.tanh(S.eta).toFixed(3)}c`;
  if (sp !== hudText.speed) { hudText.speed = sp; $('speed').firstChild.nodeValue = sp; }
  const sc = num(S.score);
  if (sc !== hudText.score) { hudText.score = sc; $('score').firstChild.nodeValue = sc; }
  const pr = Math.round(S.progress * 200);
  if (pr !== hudText.prog) { hudText.prog = pr; $('progress').style.width = `${pr / 2}%`; }
  if (S.headlight !== hudText.hl) { hudText.hl = S.headlight; $('speed').style.color = S.headlight ? '#f08a2c' : ''; }

  if (S.phase === 'caught' && S.phaseT >= 0.5 && cardShownFor !== 'caught') {
    cardShownFor = 'caught';
    cardAt = performance.now();
    const best = S.result.best.progress;
    $('caught-text').textContent = `AT ${Math.round(S.progress * 100)} %`;
    $('caught-best').textContent = `BEST ${Math.round(best * 100)} %`;
    $('caught-why').textContent = S.stats.hits > 0 && S.stats.grazes + S.stats.hairs < 8
      ? 'GRAZE GALAXIES TO PULL AHEAD' : 'EVERY GRAZE PULLS YOU AHEAD';
    const mercy = S.meta.catches >= 2;
    $('caught-mercy').hidden = !mercy;
    $('caught-mercy').textContent = `+${tune.MERCY} S HEAD START`;
    $('caught-go').textContent = coarse ? 'TAP TO GO AGAIN' : 'CLICK OR PRESS SPACE';
    $('caught').hidden = false;
  }
  if (S.phase === 'clear' && S.phaseT >= 0.5 && cardShownFor !== 'clear') {
    cardShownFor = 'clear';
    cardAt = performance.now();
    const p = par(S.seed, tune, S.startBeat);
    const rk = rankOf(S.score, p, S.stats.hits);
    $('rank').textContent = rk.letter;
    $('rank').style.color = css(rk.T);
    $('rankline').textContent = rk.line;
    $('rankline').style.color = css(rk.T);
    $('nextgoal').textContent = !rk.next ? 'THE HOTTEST CLASS'
      : rk.next.clean && S.score >= rk.next.score ? `${rk.next.letter} NEEDS A RUN WITH NO HITS`
        : `+${num(rk.next.score - S.score)} TO ${rk.next.letter}`;
    const prev = S.result.prevBest.score;
    $('best').textContent = S.score > prev && prev > 0 ? `NEW BEST · WAS ${num(prev)}`
      : `BEST ${num(Math.max(prev, S.score))}`;
    $('st-lead').textContent = `${S.lead.toFixed(1)} s`;
    $('st-graze').textContent = S.stats.grazes;
    $('st-hair').textContent = S.stats.hairs;
    $('st-hits').textContent = S.stats.hits;
    $('st-hl').textContent = `${S.stats.headlightS.toFixed(1)} s`;
    $('st-top').textContent = `${Math.tanh(S.stats.maxEta).toFixed(3)}c`;
    $('result-go').textContent = coarse ? 'OR TAP ANYWHERE' : 'OR PRESS SPACE';
    $('result').hidden = false;
    countUp = { t0: performance.now(), to: Math.round(S.score) };
  }
  if (countUp) {
    const k = Math.min(1, (performance.now() - countUp.t0) / 800);
    $('final').textContent = num(countUp.to * (1 - (1 - k) ** 3));
    if (k >= 1) countUp = null;
  }
}

// ---------- the loop: a fixed 120 Hz step, rendering on requestAnimationFrame ----------
let last = performance.now(), acc = 0, fpsAvg = 60;
function frame(now) {
  requestAnimationFrame(frame);
  const gap = now - last;
  let dt = gap / 1000;
  last = now;
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 0.1);
  // after a long hitch the course runs at most 0.1 s, but key changes are replayed across the whole gap
  const stretch = dt > 0 ? Math.max(1, gap / (dt * 1000)) : 1;
  if (gap > 0) fpsAvg += (1000 / gap - fpsAvg) * 0.05;
  timing.fps = Math.round(fpsAvg);
  adapt(dt);
  if (mode === 'play' && !paused) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 16) {
      const ev = step(S, buildInput(now - (acc - STEP) * 1000 * stretch), STEP);
      handle(ev);
      acc -= STEP;
      n++;
    }
    if (n >= 16) acc = 0;
    if (retryTapAt !== null && S.phase === 'play') {
      timing.lastRetryMs = Math.round(performance.now() - retryTapAt);
      retryTapAt = null;
    }
  }
  const rate = paused ? 0 : S.freeze > 0 ? 0 : S.slow > 0 ? tune.SLOWMO_X : 1;
  let shown = S;
  if (mode === 'title') {
    titleBeat += dt * (tune.BPM0 / 60);
    shown = { ...S, beat: titleBeat };
  } else if (S.phase === 'play' && rate > 0 && acc > 0) {
    // draw the course where it is between two steps, so a 144 Hz screen does not judder
    shown = { ...S, beat: S.beat + (S.bpm / 60) * acc * rate };
  }
  try {
    const titleEl = mode === 'title' ? $('title-name') : null;
    view.render(shown, paused ? 0 : dt, { fixed: camFixed, title: mode === 'title', fps: fpsAvg,
      titleTop: titleEl ? titleEl.getBoundingClientRect().top : null });
  } catch (err) {
    if (!frame.warned) { frame.warned = true; console.warn('render', err); }
  }
  sound.frame(S, { rate, title: mode === 'title' });
  hud();
}
requestAnimationFrame(frame);
// Par for the first sky (from the start, and from the intro skip a retry uses), worked out while the title shows.
setTimeout(() => { queuePar(S.seed, 0); queuePar(S.seed, INTRO_SKIP); }, 300);

// ---------- the test hook ----------
window.__lab = {
  id: 'a', version: 2, tune,
  state: () => S,
  events: (n = 50) => log.slice(-n),
  runs: () => runs.slice(),
  restart(seed) { retry({ seed: Number.isFinite(seed) ? seed : null }); return S; },
  advance(seconds = 1, input) {
    if (mode === 'title') startPlay();
    const out = [];
    const steps = Math.max(0, Math.round(seconds / STEP));
    for (let i = 0; i < steps; i++) {
      const x = input === undefined ? buildInput() : typeof input === 'function' ? input(S) : input;
      const ev = step(S, x, STEP);
      handle(ev);
      out.push(...ev);
    }
    return out;
  },
  bot(name, opts = {}) {
    if (!name) { inp.bot = null; return false; }
    const [real, preset] = BOT_PRESETS[name] || [name, {}];
    if (!BOTS[real]) return false;
    inp.bot = BOTS[real]({ seed: S.seed, ...preset, ...opts });
    if (mode === 'title') startPlay();
    return true;
  },
  input(x) { inp.manual = x || null; },
  timing: () => ({ ...timing, glScale }),
  start() { if (mode === 'title') startPlay(); },
  view: () => ({ layout: view.layout(), cam: view.state.cam, fixed: camFixed, scheme }),
  parReady: (seed = S.seed, start = S.startBeat) => parQueue.every((j) => j.seed !== seed || j.start !== start),
  // feedback counters: sounds and effects the page actually started, per event type (sound needs the first tap)
  feedback: () => {
    const c = sound.context();
    return { audio: c ? c.state : 'none', played: sound.played(), shown: view.shown(), haptics: { ...buzzes },
      sixteenths: sound.beats() };
  },
};

const botArg = qget('bot');
if (botArg) window.__lab.bot(botArg);
