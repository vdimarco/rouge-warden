// Slingshot Home (lab B): the page. Hold and lift on every device, the fixed 120 Hz loop, URL tuning, the title,
// pause, the HUD and callouts, the Coma vista and the result card, telemetry (the last 20 runs on this device, Copy log)
// and the window.__lab test hook. Nothing here is sent anywhere.
import { TUNE, BOTS, createState, step, restart, preview, summary, speedText, holdWindows, letGoTimes } from './core.js';
import { createView } from './view.js';
import { createSound } from './sound.js';
import { wordTime } from '../../core/captions.js';

const H = 1 / 120;
const RUNS_KEY = 'lyh-lab-b-runs';
const $ = (id) => document.getElementById(id);

// ---------- URL: every TUNE key (any case), seed, debug, toy, bot, cue, cam, tap ----------
const q = new URLSearchParams(location.search);
const tune = { ...TUNE };
const keyOf = new Map(Object.keys(TUNE).map((k) => [k.toLowerCase(), k]));
for (const [k, v] of q) {
  const key = keyOf.get(k.toLowerCase());
  if (key && v.trim() !== '' && Number.isFinite(Number(v))) tune[key] = Number(v);
}
Object.freeze(tune);
const flag = (name) => q.has(name) && !['0', 'false', 'no', 'off'].includes((q.get(name) || '').toLowerCase());
const seed = (Number.parseInt(q.get('seed') || '1', 10) >>> 0) || 1;
const debug = flag('debug'), toy = flag('toy'), cue = flag('cue'), tapMode = flag('tap');
const botParam = q.get('bot');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const low = touch && Math.min(screen.width, screen.height) < 500;

// ---------- the pieces ----------
// The mass-1 tutorial (slow world, half-speed first swing, wide first windows) is for someone who has not flown yet.
let practiced = readRuns().some((r) => !r.bot && !r.toy && Array.isArray(r.releases) && r.releases.length >= 3);
let S = createState({ seed, tune, toy, tutorial: !practiced });
const view = createView({ canvas: $('gl'), overlay: $('ov'), tune, reduced, seed, cue, low });
view.setCourse(S);
if ((q.get('cam') || '').toLowerCase() === 'chart') view.setChart(true);
const sound = createSound();

let mode = 'title';                 // title | play | paused | regrip | ended
let frozen = false;                 // tests: hold the simulation still while frames still draw
const pointers = new Set();         // every finger or button down on the play area: any of them holds
let pointerDown = false, keyDown = false, tapDown = false, forced = null, bot = null;
let latch = false;                  // a press that lifts before the next step still reaches the simulation once
let log = [];
const session = [];
const timing = { startAt: null, firstInputMs: null, retryAt: null, lastRetryMs: null, fps: 0 };
const hint = { hold: false, longer: false, coma: false, letGo: 0 };
// the release windows of the current hold (for the approach ring and LET GO), found on the grab frame
let win = null;

// ---------- telemetry: the last 20 runs on this device ----------
function readRuns() {
  try {
    const v = JSON.parse(localStorage.getItem(RUNS_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function saveRun(run) {
  try {
    const runs = readRuns();
    runs.push(run);
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(-20)));
  } catch { /* storage blocked: the run still shows */ }
}
function tuneDiff() {
  const out = {};
  for (const k of Object.keys(TUNE)) if (tune[k] !== TUNE[k]) out[k] = tune[k];
  return out;
}
function runRecord() {
  const sum = summary(S);
  const releases = log.filter((e) => e.type === 'release').map((e) => [+e.t.toFixed(2), e.mass + 1, e.grade[0],
    +e.errDeg.toFixed(1), +e.depth.toFixed(2), +e.gain.toFixed(3)]);
  const grabs = log.filter((e) => e.type === 'grab').map((e) => [+e.t.toFixed(2), e.mass + 1, +e.cost.toFixed(3),
    +e.depth.toFixed(2)]);
  const fails = log.filter((e) => e.type === 'burn' || e.type === 'lost').map((e) => [+e.t.toFixed(2), e.type, e.mass + 1]);
  return {
    v: 1, at: new Date().toISOString(), seed: S.seed, toy, bot: bot ? bot.name : null, tune: tuneDiff(),
    screen: [innerWidth, innerHeight], touch, ...sum, firstInputMs: timing.firstInputMs, releases, grabs, fails,
  };
}
function bestClock() {
  const all = readRuns().concat(session).filter((r) => !r.toy && !r.bot && Number.isFinite(r.clock));
  return all.length ? Math.min(...all.map((r) => r.clock)) : null;
}

// ---------- callouts ----------
const callout = $('callout');
let calloutTimer = 0, calloutKey = '', karaoke = null;
function say(text, { cls = '', ms = 700, lit = -1, sub = '', key = text, words = false } = {}) {
  clearTimeout(calloutTimer);
  calloutKey = key;
  const parts = text.split(' ');
  callout.className = 'callout ' + cls;
  callout.innerHTML = parts.map((w, i) => `<span${i === lit ? ' class="now"' : ''}>${w}</span>`).join(' ')
    + (sub ? `<span class="sub">${sub}</span>` : '');
  void callout.offsetWidth;
  if (!reduced && !cls.includes('pulse')) callout.classList.add('pop');
  karaoke = words ? { spans: [...callout.querySelectorAll('span:not(.sub)')], t: 0, i: 0 } : null;
  if (ms > 0) calloutTimer = setTimeout(() => clearSay(key), ms);
}
function clearSay(key) {
  if (key && key !== calloutKey) return;
  callout.innerHTML = '';
  callout.className = 'callout';
  calloutKey = '';
  karaoke = null;
}
function tickKaraoke(dt) {
  if (!karaoke) return;
  karaoke.t += dt;
  const { spans } = karaoke;
  let t = karaoke.t, i = 0;
  while (i < spans.length - 1 && t > wordTime(spans[i].textContent)) { t -= wordTime(spans[i].textContent); i++; }
  if (i !== karaoke.i || !spans[i].classList.contains('now')) {
    spans.forEach((s, k) => s.classList.toggle('now', k === i));
    karaoke.i = i;
  }
}
const big = $('big');
function bigSpeed(eta) {
  const t = speedText(eta);
  big.innerHTML = hotText(t);
  big.classList.remove('go');
  void big.offsetWidth;
  big.classList.add('go');
}
function hotText(t) {
  if (t.hot < 0) return t.text;
  return t.text.slice(0, t.hot) + `<span class="hot">${t.text[t.hot]}</span>` + t.text.slice(t.hot + 1);
}

// ---------- haptics (Android; iPhones get the sound alone) ----------
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* not allowed */ } };

// ---------- events: every one plays its sound and picture on the frame it happens ----------
// The HUD speed flashes: up (orange) when you climb back to a nine, down (red) when a press costs you speed.
function flashSpeed(kind) {
  const el = $('speedBox');
  el.classList.remove('up', 'down');
  void el.offsetWidth;
  el.classList.add(kind);
}

function handle(e) {
  log.push(e);
  if (log.length > 1200) log = log.slice(-1000);
  sound.event(e, S);
  view.event(e, S);
  switch (e.type) {
    case 'grab': {
      buzz(10);
      if (timing.firstInputMs === null && timing.startAt !== null) {
        timing.firstInputMs = Math.round(performance.now() - timing.startAt);
      }
      // a grab clears the screen, so nothing covers the ring you aim at
      clearSay();
      win = holdWindows(S);
      win.at = S.real;
      win.letGo = letGoTimes(win, tune);
      win.cue = 0;
      view.setWindows(win);
      // a press before the mass comes alongside costs speed: say so, with the cost, only when it really cost some
      const pct = Math.round((100 * e.cost) / (S.eta + e.cost));
      if (e.cost > 0.05 && pct >= 4) {
        say('EARLY', { cls: 'grey', ms: 700, key: 'early', sub: `${pct}% SPEED LOST` });
        flashSpeed('down');
      }
      if (S.course.masses[e.mass].jump && !hint.longer && S.stats.depths.length >= 4
        && S.stats.depths.slice(0, 4).every((d) => d < 0.3)) {
        hint.longer = true;
        say('HOLD LONGER', { cls: '', ms: 1400, words: true, key: 'longer' });
      }
      break;
    }
    case 'armed': buzz(5); break;
    case 'release': {
      const g = e.grade;
      buzz(g === 'PERFECT' ? 30 : 15);
      win = null;
      view.setWindows(null);
      if (S.stats.clean >= 3 && !practiced) practiced = true;
      if (e.final) break;                                   // Coma: the vista speaks for itself
      const clean = g === 'PERFECT' || g === 'GOOD';
      const sub = e.skip && clean ? `SKIP · CHAIN ${e.chain}` : e.chain >= 3 && clean ? `CHAIN ${e.chain}` : '';
      if (g === 'PERFECT') say('PERFECT', { lit: 0, ms: 650, sub });
      else if (g === 'GOOD') say('GOOD', { ms: 550, sub });
      else if (g === 'WIDE') say('WIDE', { cls: 'grey', ms: 550, sub: e.core ? 'TOO CLOSE' : '' });
      else say('MISS', { cls: 'grey', ms: 650, sub: e.core ? 'INTO A CORE' : '' });
      break;
    }
    case 'nine':
      if (S.phase === 'clear') break;                       // Coma: the vista takes over
      if (e.first) { buzz(60); if (!S.ls) bigSpeed(e.eta); } else flashSpeed('up');
      break;
    case 'ninedrop': flashSpeed('down'); break;
    case 'lightspeed':
      buzz([80, 40, 160]);
      if (S.phase === 'clear') break;
      say('LIGHT SPEED', { words: true, ms: 1600, key: 'ls' });
      if (e.first) bigSpeed(S.eta);
      break;
    case 'dropout': buzz(40); flashSpeed('down'); break;
    case 'warn':
      buzz([5, 60, 5, 60, 5]);
      // flying into a core you could still catch: a press saves you
      if (e.flight && e.save && S.phase === 'fly') say('GRAB', { cls: 'hot', lit: 0, ms: 520, key: 'grab' });
      break;
    case 'burn': buzz([50, 30, 80]); say('BURN', { cls: 'red', ms: 1200 }); break;
    case 'lost': say('LOST', { cls: 'grey', ms: 1200 }); break;
    case 'resume': if (calloutKey === 'BURN' || calloutKey === 'LOST') clearSay(); break;
    case 'vista': endStage(); break;
    default: break;
  }
}

function tick(input) {
  const ev = step(S, input, H);
  for (const e of ev) handle(e);
  return ev;
}

function currentInput() {
  if (forced) return forced;
  if (bot) return bot.fn(S);
  if (window.GameSwitch?.isOpen) return { down: false };
  const down = tapMode ? tapDown : pointerDown || keyDown || latch;
  latch = false;
  return { down };
}
const holding = () => (tapMode ? tapDown : pointerDown || keyDown);

// ---------- flow ----------
function start() {
  if (mode !== 'title') return;
  sound.start();
  $('title').hidden = true;
  $('hud').hidden = false;
  $('pause').hidden = false;
  if (S.toy) $('clockBox').hidden = true;
  mode = 'play';
  timing.startAt = performance.now();
  acc = 0;
}

function restartRun(newSeed) {
  ending = null;
  if (newSeed !== undefined) S = createState({ seed: newSeed >>> 0 || 1, tune, toy, tutorial: !practiced });
  else { S.tutorial = !practiced; restart(S); }
  view.setCourse(S);
  view.resetFx();
  sound.reset(S);
  log = [];
  win = null;
  view.setWindows(null);
  hint.hold = hint.longer = hint.coma = false;
  hint.letGo = 0;
  clearSay();
  $('result').hidden = true;
  $('vista').hidden = true;
  $('pausecard').hidden = true;
  $('title').hidden = true;
  $('hud').hidden = false;
  $('pause').hidden = false;
  pointers.clear();
  pointerDown = keyDown = tapDown = false;
  timing.retryAt = performance.now();
  timing.startAt = performance.now();
  timing.firstInputMs = null;
  if (mode === 'title') sound.start(); else sound.resume();
  mode = 'play';
  acc = 0;
}

// Pausing never lets go of a swing. trust: the page still sees every lift (the P key, the pause button), so a thumb
// or key still down when play goes on keeps holding. A blur or a hidden page can miss the lift, so it forgets them,
// and a swing in progress waits for a fresh press: HOLD TO GO ON.
function pause(trust = false) {
  if (mode !== 'play' && mode !== 'regrip') return;
  mode = 'paused';
  latch = false;
  if (!trust) { pointers.clear(); pointerDown = keyDown = false; }
  clearSay('regrip');
  $('pausecard').hidden = false;
  $('resume').focus({ preventScroll: true });
  sound.suspend();
}
function resume() {
  if (mode !== 'paused') return;
  $('pausecard').hidden = true;
  sound.resume();
  acc = 0;
  if (S.phase === 'hold' && !holding() && !bot && !forced) {
    mode = 'regrip';
    say('HOLD TO GO ON', { cls: 'pulse', lit: 0, ms: 0, key: 'regrip' });
    return;
  }
  mode = 'play';
}
// The fresh press after a pause takes the swing on from where it stopped.
function regrip() {
  if (mode !== 'regrip') return;
  mode = 'play';
  clearSay('regrip');
  acc = 0;
}

// Coma: the vista plays (view), a short card on the white, then the result card.
function endStage() {
  mode = 'ended';
  pointers.clear();
  pointerDown = keyDown = tapDown = false;
  const sum = summary(S);
  const run = runRecord();
  const before = bestClock();
  if (!S.toy) { session.push(run); if (!bot) saveRun(run); }
  // after the first time home, a tap skips the vista
  ending = { sum, before, card: false, skippable: before !== null || session.length > 1 };
}
function skipVista() {
  if (!ending || !ending.skippable) return false;
  $('vista').hidden = true;
  $('hud').hidden = true;
  $('pause').hidden = true;
  clearSay();
  view.fx.vistaT = 9;
  showResult(ending.sum, ending.before);
  ending = null;
  return true;
}

// The card and the result follow the vista's own clock in the view, so they line up with the white-out on any frame rate.
let ending = null;
function tickEnding() {
  if (!ending) return;
  const v = view.fx.vistaT;
  if (!ending.card && v >= 1.15) {
    ending.card = true;
    const vista = $('vista');
    vista.innerHTML = `THE WEB · +${S.clock.toFixed(2)} YR · <span class="now">${ending.sum.rank}</span> · VIRGO NEXT`;
    vista.hidden = false;
    $('hud').hidden = true;
    $('pause').hidden = true;
    clearSay();
  }
  if (ending.card && v >= 2.65) {
    $('vista').hidden = true;
    showResult(ending.sum, ending.before);
    ending = null;
  }
}

function showResult(sum, before) {
  $('rRank').textContent = sum.rank;
  $('rHome').textContent = `+${sum.clock.toFixed(2)} YR`;
  const best = $('rBest');
  if (before === null || sum.clock < before - 1e-9) {
    best.textContent = before === null ? 'YOUR FIRST TIME HOME' : `NEW BEST · WAS +${before.toFixed(2)} YR`;
    best.classList.add('new');
  } else {
    best.textContent = `BEST +${before.toFixed(2)} YR`;
    best.classList.remove('new');
  }
  const stats = [
    [speedText(S.stats.topEta).text, 'top speed'], [`${sum.perfectPct}%`, 'perfect'], [sum.maxChain, 'best chain'],
    [sum.burns, 'burns'], [sum.losts, 'lost'], [`${Math.round(sum.time)} s`, 'time'],
  ];
  $('rStats').innerHTML = stats.map(([v, k]) => `<div><b>${v}</b><small>${k}</small></div>`).join('')
    + (sum.branch !== '-' ? `<div style="grid-column: 1 / -1"><small>${sum.branch} branch at the fork</small></div>` : '');
  // the cost of pressing before the mass came alongside, in years
  const early = $('rEarly');
  early.hidden = !(sum.earlyYears >= 0.05);
  early.textContent = `Early grabs cost you +${sum.earlyYears.toFixed(2)} yr`;
  $('copied').textContent = '';
  $('result').hidden = false;
  $('again').focus({ preventScroll: true });
}

async function copyLog() {
  const runs = readRuns();
  for (const r of session) if (!runs.some((x) => x.at === r.at)) runs.push(r);
  const text = JSON.stringify({ game: 'lyh-lab-b', version: 1, runs }, null, 0);
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = false; }
  if (!ok) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  const n = runs.length;
  $('copied').textContent = ok ? `Copied ${n} run${n === 1 ? '' : 's'}. Paste it back to us.` : 'Copy did not work here.';
}

function setMute(m) {
  sound.setMuted(m);
  $('mute').textContent = m ? 'Sound off' : 'Sound on';
}
function toggleCamera() {
  const on = !view.view.chart;
  view.setChart(on);
  $('camera').textContent = on ? 'Camera: chart' : 'Camera: chase';
}
function toggleBot(name = 'exact', opts) {
  bot = bot ? null : { name, fn: BOTS[name](opts) };
}

// ---------- input ----------
// Any finger on the play area holds, so rolling from one thumb to the other keeps the swing. The pause button, the
// cards and links are not play input.
const isUi = (t) => t instanceof Element && t.closest('button, a, .card, #pausecard');
const resultShown = () => mode === 'ended' && !$('result').hidden;
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (window.GameSwitch?.isOpen) return;
  // the result card: a tap on the background flies again; during the vista a tap skips it (after the first time)
  if (mode === 'ended') {
    const ui = e.target instanceof Element && e.target.closest('button, a');
    if (resultShown() && !ui) { e.preventDefault(); restartRun(); } else if (!resultShown()) skipVista();
    return;
  }
  if (isUi(e.target)) return;
  if (mode === 'title') { e.preventDefault(); start(); return; }
  if (mode !== 'play' && mode !== 'regrip') return;
  e.preventDefault();
  if (tapMode) { tapDown = !tapDown; regrip(); return; }
  const was = pointerDown;
  pointers.add(e.pointerId);
  pointerDown = true;
  if (!was) latch = true;
  regrip();
  try { e.target.setPointerCapture?.(e.pointerId); } catch { /* fine */ }
}, { passive: false });
const lift = (e) => {
  if (!pointers.delete(e.pointerId)) return;
  pointerDown = pointers.size > 0;
};
addEventListener('pointerup', lift);
// the system took the touch (an edge swipe, a call): that is not a lift, so a swing in progress pauses instead
addEventListener('pointercancel', (e) => {
  if (!pointers.has(e.pointerId)) return;
  if (pointers.size === 1 && mode === 'play' && S.phase === 'hold') pause(false);
  else lift(e);
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('touchmove', (e) => { if (!isUi(e.target)) e.preventDefault(); }, { passive: false });
// losing focus can swallow the lift: pause, and a swing waits for a fresh press
addEventListener('blur', () => {
  if (mode === 'play' || mode === 'regrip') pause(false);
  else { pointers.clear(); pointerDown = keyDown = false; }
});

addEventListener('keydown', (e) => {
  if (window.GameSwitch?.isOpen || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === ' ' || k === 'Spacebar') {
    e.preventDefault();
    if (mode === 'regrip' && !tapMode) { keyDown = true; regrip(); return; }   // a held key's repeat counts too
    if (e.repeat) return;
    if (mode === 'title') { start(); return; }
    if (mode === 'ended') { if (resultShown()) restartRun(); else skipVista(); return; }
    if (mode === 'play') { if (tapMode) tapDown = !tapDown; else { keyDown = true; latch = true; } }
    return;
  }
  if (e.repeat) return;
  const l = k.toLowerCase();
  if (k === 'Enter' && mode === 'title') { start(); return; }
  if (k === 'Enter' && mode === 'ended') { e.preventDefault(); if (resultShown()) restartRun(); else skipVista(); return; }
  if (k === 'Escape' || l === 'p') {
    if (mode === 'play' || mode === 'regrip') pause(true); else if (mode === 'paused') resume();
    return;
  }
  if (l === 'r' && mode !== 'title') { restartRun(); return; }
  if (l === 'm') { setMute(!sound.muted); return; }
  if (l === 'c') { toggleCamera(); return; }
  if (l === 'b' && mode !== 'title') { toggleBot(); return; }
});
addEventListener('keyup', (e) => {
  if (e.key === ' ' || e.key === 'Spacebar') keyDown = false;
});

$('play').addEventListener('click', start);
$('play').textContent = touch ? 'Tap to fly' : 'Click or press Space';
$('againHow').textContent = touch ? 'Tap anywhere to fly again' : 'Click anywhere or press Space to fly again';
// Pause and Go on answer the finger's lift, not a click: a phone sends no click for a tap made while another thumb
// holds a swing. The click still works for a mouse or the keyboard.
function tapButton(el, fn) {
  let at = -1e9;
  el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { at = performance.now(); fn(); } });
  el.addEventListener('click', () => { if (performance.now() - at > 600) fn(); });
}
tapButton($('pause'), () => (mode === 'paused' ? resume() : pause(true)));
tapButton($('resume'), resume);
$('restart').addEventListener('click', () => restartRun());
$('mute').addEventListener('click', () => setMute(!sound.muted));
$('camera').addEventListener('click', toggleCamera);
$('again').addEventListener('click', () => restartRun());
$('copy').addEventListener('click', copyLog);
// A hidden page pauses and goes quiet; the sound comes back with the page unless the game sits paused.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { if (mode !== 'paused') sound.resume(); return; }
  if (mode === 'play' || mode === 'regrip') pause(false);
  sound.suspend();
});

// ---------- HUD ----------
const hud = { speed: '', chain: null, clock: '', ls: null };
function updateHud(dt) {
  if (mode === 'title') return;
  const t = speedText(S.eta);
  const sp = hotText(t);
  if (sp !== hud.speed) { $('speed').innerHTML = sp; hud.speed = sp; }
  const ch = S.chain >= 2 ? `CHAIN ${S.chain}` : 'YOUR SPEED';
  if (ch !== hud.chain) { $('chain').textContent = ch; $('chain').classList.toggle('on', S.chain >= 5); hud.chain = ch; }
  const cl = `+${S.clock.toFixed(2)} YR`;
  if (cl !== hud.clock) { $('clock').textContent = cl; hud.clock = cl; }
  if (S.ls !== hud.ls) { $('clockBox').classList.toggle('ls', S.ls); hud.ls = S.ls; }
  tickKaraoke(dt);
  if (mode !== 'play') return;
  // first-run hints: HOLD as mass 1 comes alongside, LET GO ahead of each window while you learn, Coma's name
  if (S.tutorial && !S.started && S.near >= 0 && S.timeScale < 0.85 && !hint.hold) {
    hint.hold = true;
    say('HOLD', { cls: 'pulse', lit: 0, ms: 0, key: 'HOLD' });
  }
  // LET GO while you learn (the tutorial run, until 3 clean releases): shown a quarter second before a window's aim,
  // so a lift a reaction later lands on it. Missed it? It shows again for the next window.
  if (S.phase === 'hold' && win && win.letGo && S.tutorial && S.stats.clean < 3) {
    const since = S.real - win.at;
    while (win.cue < win.letGo.length && since > win.letGo[win.cue].w.t1 + 0.05) win.cue++;
    const c = win.letGo[win.cue];
    if (c && since >= c.at && !c.said) {
      c.said = true;
      hint.letGo++;
      say('LET GO', { lit: 1, ms: Math.round(1000 * Math.max(0.45, c.w.t1 - since + 0.2)), key: 'letgo' });
    }
  }
  if (!hint.coma && !S.toy && S.stats.reached >= 20) {
    hint.coma = true;
    say('THE COMA CLUSTER', { words: true, ms: 1800, key: 'coma' });
  }
}

// ---------- the loop: a fixed 120 Hz simulation, drawn on each animation frame ----------
let acc = 0, last = performance.now();
function resize() {
  const dpr = Math.min(low ? 1.5 : 2, devicePixelRatio || 1);
  view.resize(innerWidth, innerHeight, dpr);
}
addEventListener('resize', resize);
resize();

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 0.1);
  if (dt > 0) timing.fps = timing.fps ? timing.fps * 0.95 + (1 / dt) * 0.05 : 1 / dt;
  if ((mode === 'play' || mode === 'ended') && !frozen) {
    acc += dt;
    let n = 0;
    while (acc >= H && n < 24) { tick(currentInput()); acc -= H; n++; }
    if (n >= 24) acc = 0;
    if (timing.retryAt !== null && n > 0) { timing.lastRetryMs = Math.round(now - timing.retryAt); timing.retryAt = null; }
  }
  view.render(S, dt, { title: mode === 'title', debug, card: !$('result').hidden || !$('vista').hidden,
    paused: mode === 'paused' || mode === 'regrip' });
  updateHud(dt);
  tickEnding();
  sound.update(S, { paused: mode === 'paused' || mode === 'title' || mode === 'regrip', ended: mode === 'ended' });
}
requestAnimationFrame(frame);

if (botParam && BOTS[botParam]) {
  bot = { name: botParam, fn: BOTS[botParam]() };
  start();
}

// ---------- the test hook ----------
window.__lab = {
  id: 'b', version: 1, tune,
  state: () => S,
  events: (n = 50) => log.slice(-n),
  runs: () => session.slice(),
  restart(newSeed) { restartRun(newSeed); },
  start() { start(); },
  // run the simulation headless at 120 Hz with this input (or the bot, or the live input); returns its events
  advance(seconds, input) {
    if (mode === 'title') start();
    const out = [];
    const steps = Math.round(seconds / H);
    for (let i = 0; i < steps; i++) out.push(...tick(input || currentInput()));
    return out;
  },
  bot(name, opts) { bot = name && BOTS[name] ? { name, fn: BOTS[name](opts) } : null; return Boolean(bot); },
  input(inp) { forced = inp ? { down: Boolean(inp.down) } : null; },
  timing: () => ({ firstInputMs: timing.firstInputMs, lastRetryMs: timing.lastRetryMs, fps: Math.round(timing.fps) }),
  mode: () => mode,
  preview: () => preview(S),
  inputs: () => ({ pointerDown, pointers: pointers.size, keyDown, tapDown, forced, bot: bot ? bot.name : null }),
  windows: () => win,
  freeze(on) { frozen = Boolean(on); acc = 0; },
  view: () => view.info(),
  pause, resume,
  practiced: () => practiced,
};
