// Ahead of the Light: the page. A fixed 120 Hz step of core/flight.js, drawn in characters by render/ascii.js (an
// ascii.rest piece), with ui/sound.js's score. The title flies a bot down the starbow behind its menu. Screens:
// title → run → result (or pause). window.__race is the hook the QA scripts use.
import { newRun, step, gapOf, TUNE } from './core/flight.js';
import { createBot } from './core/bot.js';
import { SECTORS, SECTOR_LEN, COURSE_LEN, sectorAt } from './core/world.js';
import { createAsciiView } from './render/ascii.js';
import { banner } from './vendor/ascii-rest/banner.js';
import { createInput } from './ui/input.js';
import { createSound } from './ui/sound.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const params = new URLSearchParams(location.search);

// ---- storage: every read and write in try/catch, so blocked storage only loses the best run ----
const META = 'ahead-of-the-light.meta.v2', OLD_META = 'ahead-of-the-light.meta.v1', SOUND = 'arcade.sound';
function load(key) { try { const t = localStorage.getItem(key); return t === null ? null : JSON.parse(t); } catch (e) { return null; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } }
function meta() {
  const m = load(META);
  return m && typeof m === 'object' ? { runs: m.runs | 0, bestD: Number(m.bestD) || 0, home: m.home | 0, bestT: Number(m.bestT) || 0 }
    : { runs: 0, bestD: 0, home: 0, bestT: 0 };
}
// The homepage cabinet reads its line from the old save's records.best.legNo: keep it fed.
function feedCabinet(m) {
  const legNo = m.home ? SECTORS.length - 1 : clamp(sectorAt(m.bestD), 0, SECTORS.length - 1);
  save(OLD_META, { records: { best: { home: false, legNo } } });
}

const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.documentElement.dataset.input = touch ? 'touch' : 'desk';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const G = { mode: 'title', run: null, attract: null, bot: null, acc: 0, last: 0, paused: false, autopilot: null,
  hintGone: false, result: null, ms: [] };

const view = createAsciiView({ canvas: $('view'), reduced, touch });
const input = createInput({ surface: $('view'), boostBtn: $('boost') });
const sound = createSound({ on: load(SOUND) !== false, onToggle: (on) => { save(SOUND, on); soundLabels(); } });
function soundLabels() {
  for (const id of ['soundBtn', 'pSound']) {
    const b = $(id);
    b.lastChild.textContent = sound.isOn() ? 'SOUND ON' : 'SOUND OFF';
    b.setAttribute('aria-pressed', String(sound.isOn()));
  }
}
soundLabels();

// ---- the logo: ascii.rest's block letters, LIGHT in the spectrum, sized to fit ----
function blocks(text) { return banner(text, { effect: 'still' }).default()(0).split('\n'); }
function logo() {
  const tall = innerWidth / innerHeight < 0.8;
  const lines = tall ? [['AHEAD', ''], ['OF THE', ''], ['LIGHT', 'light']] : [['AHEAD OF THE', ''], ['LIGHT', 'light']];
  const art = lines.map(([t, cls]) => ({ rows: blocks(t), cls }));
  const widest = Math.max(...art.map((a) => a.rows[0].length));
  const avail = tall ? innerWidth - 40 : Math.min(innerWidth * 0.62, 900);
  const px = clamp(Math.floor((avail / (widest * 0.6)) * 10) / 10, 4, 15);
  const el = $('logo');
  el.style.setProperty('--logo', `${px}px`);
  el.innerHTML = art.map((a) => `<span class="${a.cls}">${a.rows.map((r) => r.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('\n')}</span>`).join('\n');
}
addEventListener('resize', () => { view.resize(); if (G.mode === 'title') logo(); });

// ---- screens ----
const SCREENS = ['title', 'result', 'paused'];
function show(id) { for (const s of SCREENS) $(s).hidden = s !== id; }
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function bestLine(m) {
  if (m.home) return `HOME ${m.home}× · BEST ${fmtT(m.bestT)}`;
  if (m.bestD > 0) return `BEST: ${SECTORS[sectorAt(m.bestD)].name} · ${(m.bestD / 1000).toFixed(1)} KM`;
  return 'FIRST RUN';
}
function newAttract() {
  G.attract = newRun({ seed: 1 + Math.floor(Math.random() * 9999) });
  G.attract.light.d = -1e9;
  G.bot = createBot(0.9, G.attract.seed);
}
function toTitle() {
  G.mode = 'title'; G.paused = false; G.run = null;
  $('touch').hidden = true;
  view.clear();
  $('best').textContent = bestLine(meta());
  logo();
  show('title');
  if (!G.attract) newAttract();
  sound.setPaused(false);
}
function start() {
  sound.start();
  sound.ui('pick');
  sound.setLeg(0, 0);
  input.reset();
  G.run = newRun({ seed: params.has('seed') ? Number(params.get('seed')) | 0 : 1 + Math.floor(Math.random() * 99999) });
  G.mode = 'play'; G.paused = false; G.acc = 0; G.autopilot = null;
  view.clear();
  show(null);
  $('touch').hidden = !touch;
  $('steerHint').classList.toggle('gone', G.hintGone);
  view.sectorBanner(0, G.run);
  // the tips for a player's first three runs (or ?tips)
  view.tips(meta().runs < 3 || params.has('tips'));
}
function finish() {
  const r = G.run, m = meta();
  m.runs++;
  const home = r.mode === 'home';
  const newBest = home ? (!m.home || r.t < m.bestT) : r.ship.d > m.bestD;
  if (home) { m.home++; m.bestT = m.bestT ? Math.min(m.bestT, r.t) : r.t; m.bestD = COURSE_LEN; }
  else m.bestD = Math.max(m.bestD, r.ship.d);
  save(META, m);
  feedCabinet(m);
  G.mode = 'result';
  G.result = { mode: r.mode, d: r.ship.d, t: r.t, newBest };
  $('touch').hidden = true;
  $('rKicker').textContent = home ? 'YOU MADE IT' : `RUN OVER · SECTOR ${String(sectorAt(r.ship.d) + 1).padStart(2, '0')}`;
  $('rTitle').textContent = home ? 'HOME AHEAD OF THE LIGHT' : r.mode === 'wreck' ? 'HULL LOST' : 'THE LIGHT CAUGHT YOU';
  const rows = [
    ['DISTANCE', `${(Math.min(r.ship.d, COURSE_LEN) / 1000).toFixed(2)} / ${(COURSE_LEN / 1000).toFixed(1)} KM`],
    ['REACHED', SECTORS[sectorAt(r.ship.d)].name],
    ['TIME', fmtT(r.t)],
    ['RINGS', `${r.stats.rings} · BEST ×${r.rings.best}`],
    ['SKIMS', String(r.stats.grazes)],
    ['HITS', String(r.stats.hits)],
  ];
  $('rStats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('rWhy').textContent = home ? 'The burst never caught you.'
    : r.mode === 'wreck' ? 'Too many stars hit you. Watch for red [ ] and steer round them.'
    : r.stats.rings < (r.stats.rings + r.stats.missed) * 0.6 ? 'The light caught up: you missed most gold rings. Each one speeds you up.'
    : 'The light caught up. Skim past stars to charge, then hold BOOST when the gap gets short.';
  $('rBest').textContent = newBest ? 'NEW BEST' : bestLine(m);
  show('result');
  $('again').focus({ preventScroll: true });
}
function pause(p) {
  if (G.mode !== 'play') return;
  G.paused = p;
  show(p ? 'paused' : null);
  $('touch').hidden = p || !touch;
  sound.setPaused(p);
  input.reset();
  if (p) $('resume').focus({ preventScroll: true });
}

$('go').addEventListener('click', start);
$('again').addEventListener('click', start);
$('toTitle').addEventListener('click', toTitle);
$('resume').addEventListener('click', () => pause(false));
$('quit').addEventListener('click', toTitle);
$('pause').addEventListener('click', () => pause(true));
for (const id of ['soundBtn', 'pSound']) $(id).addEventListener('click', () => { sound.start(); sound.toggle(); });
for (const b of document.querySelectorAll('.screen button')) b.addEventListener('pointerdown', () => { sound.start(); sound.ui('tap'); });
// the menus: the line under the pointer lights
for (const menu of document.querySelectorAll('.menu')) {
  for (const it of menu.querySelectorAll('.item')) it.addEventListener('pointerenter', () => { for (const o of menu.querySelectorAll('.item')) o.classList.toggle('on', o === it); });
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (G.mode === 'title' && (e.code === 'Enter' || e.code === 'Space') && !document.activeElement?.closest('.menu')) { e.preventDefault(); start(); }
  else if (G.mode === 'result' && (e.code === 'KeyR' || (e.code === 'Enter' && !document.activeElement?.closest('.menu')))) { e.preventDefault(); start(); }
  else if (G.mode === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) pause(!G.paused);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && !G.paused) pause(true); });

function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not on this phone */ } }
function feedback(run, events) {
  if (!events.length) return;
  sound.onEvents(events, { you: 'you', race: null });
  view.onEvents(events, run);
  for (const e of events) {
    if (e.type === 'sector') sound.setLeg(e.sector, 0);
    if (e.type === 'hit') buzz(50);
    else if (e.type === 'grab' || e.type === 'hair') buzz(12);
    else if (e.type === 'caught' || e.type === 'wreck') buzz([160, 60, 260]);
  }
}

// ---- the loop: the simulation here; ascii.rest's mount draws the piece at its own rate ----
const DT = 1 / 120;
function frame(now) {
  requestAnimationFrame(frame);
  const f0 = performance.now();
  const dt = clamp((now - (G.last || now)) / 1000, 0, 0.1);
  G.last = now;
  if (G.mode === 'title' || !G.run) {
    const a = G.attract;
    if (a) {
      G.acc += dt;
      while (G.acc >= DT) { step(a, G.bot(a), DT); G.acc -= DT; }
      if (a.mode !== 'fly' || a.ship.d > COURSE_LEN - 300) newAttract();
      view.show(G.attract, { title: true });
    }
    sound.frame({ mode: G.mode === 'title' ? 'title' : 'result', gear: 0, eta: 1 }, dt);
    return;
  }
  const r = G.run;
  if (G.mode === 'play' && !G.paused) {
    G.acc += dt;
    while (G.acc >= DT && r.mode === 'fly') {
      const inp = G.autopilot ? G.autopilot(r) : input.read();
      if (!G.hintGone && (Math.abs(inp.x) > 0.3 || Math.abs(inp.y) > 0.3)) { G.hintGone = true; $('steerHint').classList.add('gone'); }
      step(r, inp, DT);
      feedback(r, r.events);
      G.acc -= DT;
    }
    if (r.mode !== 'fly') { G.acc = 0; G.mode = 'ending'; setTimeout(() => { if (G.run === r && G.mode === 'ending') finish(); }, 900); }
  }
  view.show(r);
  $('boost').classList.toggle('on', r.ship.boosting);
  sound.frame({ mode: G.mode === 'play' && !G.paused ? 'play' : G.paused ? 'paused' : 'result', gear: r.gear,
    eta: 1 + r.ship.speed / 45, bpm: 108 }, dt);
  G.ms.push(performance.now() - f0);
  if (G.ms.length > 240) G.ms.shift();
}
toTitle();
requestAnimationFrame(frame);

// ---- the QA hook ----
window.__race = {
  get mode() { return G.paused ? 'paused' : G.mode; },
  get run() { return G.run; },
  get attract() { return G.attract; },
  get result() { return G.result; },
  get drawn() { return view.drawn; },
  get grid() { return view.grid; },
  start, toTitle, pause,
  autopilot(skill = 0.9) { G.autopilot = skill === null ? null : createBot(skill, 7); },
  // jump ahead to distance d with the light at the same gap
  warp(d) {
    const r = G.run; if (!r) return;
    const gap = gapOf(r);
    r.ship.d = d; r.light.d = d - gap;
    r.rings.i = Math.max(2, Math.floor(d / 170));
  },
  drawMs: () => view.drawMs(),
  frameMs() { const a = [...G.ms].sort((x, y) => x - y); return a.length ? { p50: a[a.length >> 1], p95: a[Math.floor(a.length * 0.95)] } : null; },
  sound: () => ({ on: sound.isOn(), played: sound.played(), ctx: sound.context() }),
  tune: TUNE, SECTOR_LEN, COURSE_LEN,
};
