// Ahead of the Light: the page. A fixed 120 Hz step of core/flight.js, drawn by render/view.js (the point-cloud
// ground) and ui/hud.js (the orange instruments), with ui/sound.js's score. The title flies a bot down the canyon
// behind its panel. Screens: title → run → result (or pause). window.__race is the hook the QA scripts use.
import { newRun, step, gapOf, TUNE } from './core/flight.js';
import { createBot } from './core/bot.js';
import { SECTORS, SECTOR_LEN, COURSE_LEN, sectorAt } from './core/world.js';
import { createView } from './render/view.js';
import { createHud } from './ui/hud.js';
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
// The homepage cabinet reads its line from the old save's records.best (legNo, or home with years): keep it fed.
function feedCabinet(m) {
  const legNo = clamp(sectorAt(m.bestD), 0, SECTORS.length - 1);
  save(OLD_META, { records: { best: m.home ? { home: false, legNo: SECTORS.length - 1 } : { home: false, legNo } } });
}

// ---- the page's layout and input kind ----
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.documentElement.dataset.input = touch ? 'touch' : 'desk';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tier = params.get('tier') || (touch && ((navigator.deviceMemory || 4) < 4 || (navigator.hardwareConcurrency || 4) <= 4) ? 'low' : 'high');

const G = { mode: 'title', run: null, attract: null, bot: null, acc: 0, last: 0, paused: false, autopilot: null,
  hintGone: false, result: null, frames: 0, ms: [] };

let view = null;
try { view = createView({ canvas: $('view'), tier, reduced }); }
catch (e) { view = null; }
const hud = createHud($('hud'));
const input = createInput({ surface: $('view'), boostBtn: $('boost'), pingBtn: $('sonar') });
const sound = createSound({ on: load(SOUND) !== false, onToggle: (on) => { save(SOUND, on); soundLabels(); } });
function soundLabels() {
  for (const id of ['soundBtn', 'pSound']) {
    const b = $(id);
    b.textContent = sound.isOn() ? 'SOUND ON' : 'SOUND OFF';
    b.setAttribute('aria-pressed', String(sound.isOn()));
  }
}
soundLabels();

function insets() {
  const cs = getComputedStyle(document.documentElement);
  const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
  return { t: px('--st'), r: px('--sr'), b: px('--sb'), l: px('--sl') };
}
function resize() {
  const w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
  if (view) view.resize(w, h, dpr);
  hud.resize(w, h, dpr, insets());
}
addEventListener('resize', resize);
resize();

// ---- screens ----
const SCREENS = ['title', 'result', 'paused', 'nogl'];
function show(id) { for (const s of SCREENS) $(s).hidden = s !== id; }
function bestLine(m) {
  if (m.home) return `HOME ${m.home}× · BEST ${fmtT(m.bestT)}`;
  if (m.bestD > 0) return `BEST: ${SECTORS[sectorAt(m.bestD)].name} · ${(m.bestD / 1000).toFixed(1)} KM`;
  return 'FIRST RUN';
}
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function newAttract() {
  G.attract = newRun({ seed: 1 + Math.floor(Math.random() * 9999) });
  G.attract.light.d = -1e9;
  G.bot = createBot(0.85, G.attract.seed);
}
function toTitle() {
  G.mode = 'title'; G.paused = false; G.run = null;
  $('touch').hidden = true;
  hud.clear();
  $('best').textContent = bestLine(meta());
  show('title');
  if (!G.attract) newAttract();
  sound.setPaused(false);
}
function start() {
  if (!view) return;
  sound.start();
  sound.ui('pick');
  sound.setLeg(0, 0);
  input.reset();
  G.run = newRun({ seed: params.has('seed') ? Number(params.get('seed')) | 0 : 1 + Math.floor(Math.random() * 99999) });
  G.mode = 'play'; G.paused = false; G.acc = 0; G.autopilot = null;
  hud.clear();
  show(null);
  $('touch').hidden = !touch;
  $('steerHint').classList.toggle('gone', G.hintGone);
  hud.onEvents([{ type: 'sector', sector: 0 }], G.run);
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
    ['GATES', `${r.stats.gates} · BEST CHAIN ×${r.gates.best}`],
    ['HITS', String(r.stats.hits)],
  ];
  $('rStats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
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
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (G.mode === 'title' && (e.code === 'Enter' || e.code === 'Space') && document.activeElement?.closest('.row') == null) { e.preventDefault(); start(); }
  else if (G.mode === 'result' && (e.code === 'KeyR' || e.code === 'Enter')) { e.preventDefault(); start(); }
  else if (G.mode === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) pause(!G.paused);
  else if (G.mode === 'play' && G.paused && e.code === 'Enter') pause(false);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && !G.paused) pause(true); });

// ---- feedback for one step's events ----
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not on this phone */ } }
function feedback(run, events) {
  if (!events.length) return;
  sound.onEvents(events, { you: 'you', race: null });
  hud.onEvents(events, run);
  if (view) view.onEvents(events);
  for (const e of events) {
    if (e.type === 'sector') sound.setLeg(e.sector, 0);
    if (e.type === 'hit') buzz(50);
    else if (e.type === 'grab') buzz(12);
    else if (e.type === 'caught' || e.type === 'wreck') buzz([160, 60, 260]);
  }
}

// ---- the loop ----
const DT = 1 / 120;
function frame(now) {
  requestAnimationFrame(frame);
  const f0 = performance.now();
  const dt = clamp((now - (G.last || now)) / 1000, 0, 0.1);
  G.last = now;
  if (!view) return;
  if (G.mode === 'title' || !G.run) {
    const a = G.attract;
    if (a) {
      G.acc += dt;
      while (G.acc >= DT) { step(a, G.bot(a), DT); G.acc -= DT; }
      if (a.mode !== 'fly' || a.ship.d > COURSE_LEN - 300) newAttract();
      view.render(a, dt, { title: true });
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
  const out = view.render(r, G.paused ? 0 : dt);
  $('edge').style.opacity = String(Math.round(clamp(out.white * 0.9, 0, 0.9) * 100) / 100);
  if (G.mode === 'play' || G.mode === 'ending') hud.draw(r, view, dt, { controlsBottom: touch && innerWidth < 640 ? 112 : 0, touch });
  $('boost').classList.toggle('on', r.ship.boosting);
  sound.frame({ mode: G.mode === 'play' && !G.paused ? 'play' : G.paused ? 'paused' : 'result', gear: r.gear,
    eta: 1 + r.ship.speed / 45, bpm: 108 }, dt);
  G.frames++;
  G.ms.push(performance.now() - f0);
  if (G.ms.length > 240) G.ms.shift();
}

if (!view) show('nogl');
else { toTitle(); requestAnimationFrame(frame); }

// ---- the QA hook ----
window.__race = {
  get mode() { return G.paused ? 'paused' : G.mode; },
  get run() { return G.run; },
  get attract() { return G.attract; },
  get result() { return G.result; },
  get drawn() { return hud.state.drawn; },
  get tier() { return view ? view.tier : null; },
  get points() { return view ? view.points : 0; },
  start, toTitle, pause,
  // fly the run with the bot (skill 0..1), or null to hand it back
  autopilot(skill = 0.9) { G.autopilot = skill === null ? null : createBot(skill, 7); },
  // jump ahead to distance d with the light at the same gap
  warp(d) {
    const r = G.run; if (!r) return;
    const gap = gapOf(r);
    r.ship.d = d; r.light.d = d - gap;
    r.ship.x = r.world.centre(d); r.ship.y = r.world.height(r.ship.x, d) + 14;
    r.gates.i = Math.max(2, Math.floor(d / 170));
  },
  frameMs() { const a = [...G.ms].sort((x, y) => x - y); return a.length ? { p50: a[a.length >> 1], p95: a[Math.floor(a.length * 0.95)] } : null; },
  sound: () => ({ on: sound.isOn(), played: sound.played(), voices: sound.voices ? sound.voices() : null, ctx: sound.context() }),
  tune: TUNE, SECTOR_LEN, COURSE_LEN,
};
