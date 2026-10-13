// Light Years Home: boot and the main loop. Checks for WebGL2, picks a quality tier, loads the renderer, overlay,
// sound and frame meter, runs the pure engine on a fixed 1/60 s tick (at most 5 steps a frame), turns its state into
// a camera (core/geo) for the renderer and the overlay, and its events into HUD, sound and saves. Pauses itself on
// blur, a hidden page, pagehide, the game switcher and a lost graphics context. window.__lyh is the QA hook.
import {
  create, start as startEngine, update, act as engineAct, drainEvents, jump as engineJump, scanOf, TICK, LETTERS,
} from './core/engine.js';
import { cameraFor, contentBox, lookToward, prepareScans, keyartPose, CLUE_BLEND } from './core/geo.js';
import { project, edgeChevron } from './core/project.js';
import { hitTest, HIT_MIN } from './core/pick.js';
import { botStep, POLICIES } from './core/bot.js';
import {
  readBest, saveBest, bestLine, readProgress, saveProgress, clearProgress, readSettings, saveSettings, readSeen, saveSeen,
  CHAPTER_STARTS,
} from './core/save.js';
import { STOPS, CHAPTERS } from './core/route.js';
import { OBJECTS } from './core/objects.js';
import { createHud } from './ui/hud.js';
import { createInput } from './ui/input.js';

const MAX_STEPS = 5;
const MAX_DT = 0.1;
const SOUND_KEY = 'arcade.sound';
const PLAY = new Set(['intro', 'clue', 'scan', 'fork', 'flight', 'reveal', 'chapter']);
const CHEVRON_HIT = 26;            // px around an edge chevron that count as tapping it

const params = new URLSearchParams(location.search);
const QA = params.get('qa') === '1';
const KEYART = params.get('keyart') === '1';
const PERF = params.has('perf');
const SEED = /^\d+$/.test(params.get('seed') || '') ? Number(params.get('seed')) % 4294967296 : null;

const viewCanvas = document.getElementById('view');
const overlayCanvas = document.getElementById('overlay');
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const coarse = matchMedia('(pointer: coarse)').matches;
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedQuery.matches;
reducedQuery.addEventListener?.('change', (e) => { reduced = e.matches; });

const stopNames = STOPS.map((s) => (OBJECTS[s.id] && OBJECTS[s.id].name) || s.id);
const randomSeed = () => (crypto?.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0]
  : Math.floor(Math.random() * 4294967296));

// ---------- saved things ----------

function readSound() {
  try { return JSON.parse(storage?.getItem(SOUND_KEY) ?? 'true') !== false; } catch { return true; }
}
function writeSound(on) {
  try { storage?.setItem(SOUND_KEY, JSON.stringify(Boolean(on))); } catch { /* storage off */ }
}

let settings = readSettings(storage);
if (QA) settings = { ...settings, hints: false };
let soundOn = readSound();

// ---------- state ----------

let state = create({ seed: SEED ?? randomSeed(), today: new Date(), firstRun: !QA && !readSeen(storage), settings });
let view = null, overlay = null, audio = null, perf = null;
let lastCam = null, layoutCache = null, layoutDirty = true;
let stepping = false, autopilot = null, lastT = 0, acc = 0, booted = false;
let safe = { top: 0, right: 0, bottom: 0, left: 0 };
const prepared = new Set();

const hud = createHud({
  on: {
    play: () => play(false),
    continue: () => play(true),
    resume: () => resume(),
    restart: () => act({ type: 'retryChapter' }),
    pause: () => pause(),
    sound: () => setSound(!soundOn),
    act: (a) => act(a),
    select: (letter) => select(letter),
    newJourney: () => newJourney(),
    setting: (name, value) => setSetting(name, value),
    lens: (id, size) => (view && view.lensShot ? view.lensShot(id, size) : null),
  },
});
hud.setTouch(coarse);
hud.setSound(soundOn);
hud.setSettings(state.settings);
refreshTitle();

function refreshTitle() {
  const progress = readProgress(storage);
  hud.showTitle(state.phase === 'title' && !KEYART, { best: bestLine(readBest(storage), stopNames), resume: progress });
}

// ---------- engine glue ----------

function act(action) {
  if (!state) return;
  engineAct(state, action);
  flush();
}

function flush() {
  for (const ev of drainEvents(state)) handle(ev);
}

function handle(ev) {
  hud.onEvent(ev, state);
  try { audio?.onEvent?.(ev, state); } catch (err) { console.warn('light-years-home: audio', err); }
  try { overlay?.onEvent?.(ev, state); } catch { /* optional */ }
  switch (ev.type) {
    case 'phase':
      layoutDirty = true;
      if (ev.to === 'clue' || ev.to === 'reveal' || ev.to === 'intro' || ev.to === 'title') input.resetLook();
      if (ev.to === 'flight' || ev.from === 'flight') input.resetThrust();
      if (ev.from === 'intro') saveSeen(storage, true);
      if (ev.to === 'flight' || ev.to === 'reveal' || ev.to === 'chapter') warmScans();
      break;
    case 'chapter':
      if (ev.chapter > 0) saveProgress(storage, ev.progress);   // save.js refuses chapter I (nothing to resume)
      view?.prepare?.(ev.chapter);
      break;
    case 'reveal': {
      const next = STOPS[state.stop + 1];
      if (next && next.chapter !== state.chapter) view?.prepare?.(next.chapter);
      break;
    }
    case 'select':
      layoutDirty = true;
      break;
    case 'crack':
      if (!reduced) { try { navigator.vibrate?.(40); } catch { /* not allowed */ } }
      break;
    case 'pause':
      input.clear();
      hud.setPaused(true);
      try { audio?.suspend?.(); } catch { /* sound is optional */ }
      break;
    case 'resume':
      hud.setPaused(false);
      try { audio?.resume?.(); } catch { /* sound is optional */ }
      lastT = 0;
      acc = 0;
      break;
    case 'home': {
      const r = saveBest(storage, ev.result);
      hud.setResult({ isNew: r.newBest });
      clearProgress(storage);
      break;
    }
    case 'lost':
      saveBest(storage, ev.result);
      break;
    default:
      break;
  }
}

// Work out the next scans' framings in idle time (a viewpoint search can take tens of ms).
function warmScans() {
  const key = `${state.stop}:${innerWidth}x${innerHeight}`;
  if (prepared.has(key)) return;
  prepared.add(key);
  const run = () => {
    try {
      prepareScans(state, innerWidth / innerHeight, freeBox());
    } catch (err) {
      console.warn('light-years-home: scans', err);
    }
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1500 });
  else setTimeout(run, 200);
}

// ---------- play, pause, settings ----------

// The AudioContext starts on the Play tap (a user gesture), or as soon as the sound module is there.
let audioStarted = false;
function startAudio() {
  if (audioStarted || !audio) return;
  try { audio.start?.(); audioStarted = true; } catch (err) { console.warn('light-years-home: audio', err); }
}

async function play(resumeSave) {
  startAudio();
  await ready;
  if (!view) return;
  startAudio();
  const progress = resumeSave ? readProgress(storage) : null;
  if (!resumeSave) clearProgress(storage);
  hud.reset();
  startEngine(state, { progress, skipIntro: QA });
  hud.showTitle(false);
  input.resetLook();
  flush();
}

function newJourney() {
  clearProgress(storage);
  hud.reset();
  act({ type: 'newJourney' });
}

function canPause() {
  if (!state || state.paused) return false;
  return PLAY.has(state.phase) || (state.phase === 'ending' && state.ending && !state.ending.done);
}
function pause() {
  input.clear();
  if (canPause()) act({ type: 'pause' });
}
function resume() {
  hud.closeHow();
  if (state.paused) act({ type: 'resume' });
}
function togglePause() {
  if (hud.modal() === 'how') { hud.closeHow(); return; }
  if (state.paused) resume();
  else pause();
}
function escape() {
  if (hud.closeHow()) return true;
  const m = hud.modal();
  if (m === 'pause') { resume(); return true; }
  if (m) return false;
  if (state.phase === 'scan' && state.scan.open) { act({ type: 'close' }); return true; }
  pause();
  return true;
}
// Lifecycle: anything that takes the player away pauses; only Resume (or Esc / P on the pause card) resumes.
function suspend() {
  input.clear();
  if (canPause()) act({ type: 'pause' });
}

function setSound(on) {
  soundOn = Boolean(on);
  writeSound(soundOn);
  hud.setSound(soundOn);
  try { audio?.setMuted?.(!soundOn); } catch { /* sound is optional */ }
}

function setSetting(name, value) {
  if (name === 'sound') { setSound(value === 'on'); return; }
  const patch = name === 'hints' ? { hints: value === 'on' } : { [name]: value };
  engineAct(state, { type: 'settings', settings: patch });
  settings = saveSettings(storage, state.settings);
  hud.setSettings(state.settings);
  if (name === 'thrust') input.resetThrust();
}

// ---------- scans: picking, chips, chevrons ----------

function candidates() {
  if (!state || (state.phase !== 'clue' && state.phase !== 'scan')) return [];
  const sc = scanOf(state);
  return sc ? sc.candidates : [];
}

// Rings of the candidates as the overlay drew them last frame, or worked out here with core/project.
function candidateRings() {
  const drawn = (() => { try { return overlay?.rings?.() || []; } catch { return []; } })().filter((r) => r && r.letter);
  if (drawn.length) return drawn;
  if (!lastCam) return [];
  return candidates().map((c) => {
    const p = project(c.id, lastCam);
    return { id: c.id, letter: c.letter, x: p.x, y: p.y, r: p.r, hitR: Math.max(p.r, HIT_MIN), expectX: p.x,
      expectY: p.y, onScreen: p.visible, grey: c.grey };
  });
}

function pick(x, y) {
  const hit = hitTest(candidateRings(), x, y);
  if (hit) return { letter: hit.letter };
  if (!lastCam) return null;
  for (const c of candidates()) {
    if (c.grey) continue;
    const ch = edgeChevron(c.id, lastCam);
    if (ch && Math.hypot(ch.x - x, ch.y - y) <= CHEVRON_HIT) return { chevron: c.id };
  }
  return null;
}

// Swing the view toward an object when it is outside the free box.
function swingIfHidden(id) {
  if (!lastCam) return;
  const p = project(id, lastCam);
  const b = lastCam.box;
  const inside = p.front && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  if (!inside) input.swingTo(lookToward(id, lastCam));
}

function select(letter) {
  if (!LETTERS.includes(letter)) return;
  act({ type: 'select', letter });
  if (state.scan.open === letter) {
    const c = candidates().find((x) => x.letter === letter);
    if (c) swingIfHidden(c.id);
    requestAnimationFrame(() => hud.focusCard());
  }
}

function cycle(dir) {
  const sc = scanOf(state);
  if (!sc) return;
  const open = LETTERS.filter((L) => !sc.tried.includes(L));
  if (!open.length) return;
  const i = open.indexOf(sc.open);
  const next = i < 0 ? open[dir > 0 ? 0 : open.length - 1] : open[(i + dir + open.length) % open.length];
  select(next);
}

// ---------- layout and camera ----------

const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
  + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) '
  + 'env(safe-area-inset-left,0px)';
document.body.appendChild(safeProbe);
function readSafe() {
  const cs = getComputedStyle(safeProbe);
  const px = (v) => parseFloat(v) || 0;
  safe = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
}

// The free content box: where scan candidates go, clear of the HUD (core/geo contentBox; the stylesheet keeps the
// HUD outside it).
function freeBox() {
  return contentBox(innerWidth, innerHeight, safe);
}

function layoutNow() {
  if (layoutDirty || !layoutCache) {
    layoutCache = hud.layout();
    layoutDirty = false;
  }
  return layoutCache;
}

function cameraNow() {
  const W = innerWidth, H = innerHeight;
  const box = freeBox();
  // key art has no HUD, so the whole screen is free
  if (KEYART) return keyartPose(W / H, { x: 0, y: 0, w: W, h: H, width: W, height: H });
  // once the clue's camera blend is over, a clue looks like the scan it leads to, so look-drags apply at once
  const s = state.phase === 'clue' && state.phaseT >= CLUE_BLEND ? { ...state, phase: 'scan' } : state;
  return cameraFor(s, W / H, { yaw: input.look.yaw, pitch: input.look.pitch, reduced }, box);
}

function canLook() {
  const ph = state.phase;
  return !KEYART && (ph === 'scan' || ph === 'fork' || (ph === 'clue' && state.phaseT >= CLUE_BLEND));
}

function onResize() {
  readSafe();
  hud.updateMode();
  layoutDirty = true;
  try { view?.resize?.(innerWidth, innerHeight); } catch (err) { console.warn('light-years-home: resize', err); }
  try { overlay?.resize?.(); } catch { /* optional */ }
}

// ---------- input ----------

const input = createInput(viewCanvas, {
  state: () => state,
  modal: () => Boolean(hud.modal()) || KEYART,
  cardOpen: () => state.phase === 'scan' && Boolean(state.scan.open),
  canLook,
  degPerPx: () => (lastCam ? lastCam.fovY : 60) / Math.max(1, innerHeight),
  reduced: () => reduced,
  thrustMode: () => state.settings.thrust,
  pick,
  act,
  select,
  swing: (id) => { if (lastCam) input.swingTo(lookToward(id, lastCam)); },
  cycle,
  pause,
  togglePause,
  mute: () => setSound(!soundOn),
  escape,
});

// ---------- lifecycle ----------

addEventListener('blur', suspend);
addEventListener('pagehide', suspend);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
for (const b of document.querySelectorAll('[data-switch]')) b.addEventListener('click', suspend);
addEventListener('resize', onResize);

// ---------- the loop ----------

function tick(dt = TICK, given = null) {
  let hold = given ? Boolean(given.hold) : input.hold();
  if (autopilot) {
    const b = botStep(autopilot, state);
    for (const a of b.actions) engineAct(state, a);
    hold = b.hold;
  }
  update(state, { hold }, dt);
  flush();
}

function overlayLayout() {
  const l = layoutNow();
  return { mode: l.mode, rects: l.rects, box: lastCam && lastCam.box, reduced, keyart: KEYART, look: input.look,
    safe };
}

// Camera, renderer, overlay and HUD for one frame. Returns the renderer's { calls, points }.
function drawFrame(now) {
  const cam = cameraNow();
  lastCam = cam;
  const shown = KEYART ? { ...state, phase: 'keyart' } : state;
  try { view?.sync(shown, cam); } catch (err) { console.warn('light-years-home: sync', err); }
  // the HUD writes first; the overlay then gets this frame's HUD boxes (measured only when one was shown or hidden)
  if (hud.frame(state, { cam, now })) layoutDirty = true;
  try { overlay?.draw(shown, cam, view, overlayLayout()); } catch (err) {
    console.warn('light-years-home: overlay', err);
  }
  try { audio?.frame?.(state); } catch { /* sound is optional */ }
}

function render() {
  try { return view ? view.render() : { calls: 0, points: 0 }; } catch (err) {
    console.warn('light-years-home: render', err);
    return { calls: 0, points: 0 };
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  if (document.hidden) { lastT = 0; return; }
  const dt = lastT ? Math.min(MAX_DT, (now - lastT) / 1000) : 0;
  lastT = now;
  if (stepping) return;
  perf?.begin?.();
  if (!state.paused) {
    acc += dt;
    let n = 0;
    while (acc >= TICK - 1e-9 && n < MAX_STEPS) { tick(); acc -= TICK; n++; }
    if (n === MAX_STEPS) acc = 0;
  } else {
    acc = 0;
  }
  input.frame(dt);
  drawFrame(now);
  perf?.end?.();
  const r = render();
  try { perf?.frame?.(dt * 1000, r); } catch { /* optional */ }
  if (dt > 0) { try { view?.adapt?.(dt * 1000); } catch { /* optional */ } }
}

// ---------- boot ----------

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

async function load(path, name, fallback) {
  try {
    const m = await import(path);
    if (typeof m[name] === 'function') return m[name];
    console.warn(`light-years-home: ${path} has no ${name}`);
  } catch (err) {
    console.warn(`light-years-home: ${path} did not load`, err?.message || err);
  }
  return fallback;
}

const noOverlay = () => ({ draw() {}, rings: () => [], labels: () => [], resize() {} });
const noAudio = () => ({ start() {}, setMuted() {}, muted: false, onEvent() {}, frame() {}, suspend() {}, resume() {} });
const noPerf = () => ({ begin() {}, end() {}, frame() {}, stats: () => ({}), show() {} });

function graphicsFailed(err) {
  if (err) console.warn('light-years-home: graphics could not start', err?.message || err);
  input.clear();
  if (canPause()) act({ type: 'pause' });
  hud.showGraphicsError(true);
}

async function boot() {
  readSafe();
  if (!hasWebGL2()) { graphicsFailed(); return; }
  const [makeView, makeOverlay, makeAudio, makePerf] = await Promise.all([
    load('./render/view.js', 'createView', null),
    load('./ui/overlay.js', 'createOverlay', noOverlay),
    load('./ui/audio.js', 'createAudio', noAudio),
    load('./ui/perf.js', 'createPerf', noPerf),
  ]);
  if (!makeView) { graphicsFailed(); return; }
  const tier = coarse ? 'mid' : 'high';
  try {
    view = makeView(viewCanvas, { tier, reduced, seed: state.seed });
  } catch (err) {
    graphicsFailed(err);
    return;
  }
  try {
    overlay = makeOverlay(overlayCanvas);
  } catch (err) {
    console.warn('light-years-home: overlay', err);
    overlay = noOverlay();
  }
  try {
    audio = makeAudio();
    audio?.setMuted?.(!soundOn);
  } catch (err) {
    console.warn('light-years-home: audio', err);
    audio = noAudio();
  }
  try { perf = makePerf(); if (PERF) perf?.show?.(true); } catch { perf = noPerf(); }
  view.onContextLost?.(() => graphicsFailed());
  view.onContextRestored?.(() => { hud.showGraphicsError(false); if (state.phase === 'title') refreshTitle(); });
  view.resize?.(innerWidth, innerHeight);
  if (KEYART) {
    document.body.classList.add('keyart');
    view.prepare?.(3);
  } else {
    view.prepare?.(0);
  }
  booted = true;
  requestAnimationFrame(loop);
}

const ready = boot().catch((err) => graphicsFailed(err));

// ---------- QA hook (gameplay never reads it) ----------

function startJourney(opts = {}) {
  const o = opts || {};
  state = create({
    seed: Number.isSafeInteger(o.seed) ? o.seed : SEED ?? randomSeed(),
    today: o.today ?? new Date(),
    firstRun: o.firstRun !== undefined ? Boolean(o.firstRun) : !o.skipIntro && !QA && !readSeen(storage),
    settings: { ...state.settings, ...(o.settings || {}) },
  });
  hud.reset();
  startEngine(state, { skipIntro: Boolean(o.skipIntro) });
  const stop = Number.isInteger(o.stop) ? o.stop : Number.isInteger(o.chapter) ? CHAPTER_STARTS[o.chapter] : null;
  if (stop !== null && stop !== undefined) engineJump(state, stop, 'clue');
  view?.prepare?.(state.chapter);
  hud.showTitle(false);
  hud.setSettings(state.settings);
  input.resetLook();
  flush();
}

window.__lyh = {
  get state() { return structuredClone(state); },
  get layout() { layoutDirty = true; return layoutNow(); },
  get ready() { return booted && Boolean(view) && view.ready !== false; },
  start(opts) { startJourney(opts); return this.state; },
  step(given = {}, dt = TICK, n = 1) {
    stepping = true;
    for (let i = 0; i < Math.max(1, n | 0); i++) tick(dt, given || {});
    input.frame(dt);
    drawFrame(performance.now());
    render();
    return this.state;
  },
  live() { stepping = false; lastT = 0; acc = 0; },
  act(action) { act(action); return this.state; },
  hold(on) { input.setVirtual(on); },
  jump(stop, phase, opts) {
    hud.reset();
    engineJump(state, stop, phase, opts);
    // bake this chapter's art now (sync would on the next frame), so __lyh.ready right after a jump means it is there
    view?.prepare?.(state.chapter);
    hud.showTitle(false);
    hud.setPaused(false);
    input.resetLook();
    flush();
    layoutDirty = true;
    return this.state;
  },
  autopilot(kind) { autopilot = POLICIES.includes(kind) ? kind : null; return autopilot; },
  rings() {
    try { const r = overlay?.rings?.(); if (r && r.length) return r; } catch { /* fall back */ }
    return candidateRings();
  },
  labels() { try { return overlay?.labels?.() || []; } catch { return []; } },
  project(id) {
    const cam = lastCam || cameraNow();
    const p = project(id, cam);
    return { x: p.x, y: p.y, r: p.r, visible: p.visible, D: p.D };
  },
  debugRender(opts) { return view?.debugRender?.(opts); },
  probe(id, radiusPx) { return view?.probe?.(id, radiusPx); },
  get perf() {
    const info = (() => { try { return view?.info?.() || {}; } catch { return {}; } })();
    const s = (() => { try { return perf?.stats?.() || {}; } catch { return {}; } })();
    return { ...info, cpu: s.cpu, frame: s.frame };
  },
  simulateSlow(ms, seconds) { return view?.simulateSlow?.(ms, seconds); },
  setQuality(tier) { view?.setQuality?.(tier); },
  get look() { return { yaw: input.look.yaw, pitch: input.look.pitch }; },
  get chapters() { return CHAPTERS.map((c) => c.title); },
};
