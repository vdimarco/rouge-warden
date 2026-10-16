// Light Years Home v3: boot, the loop and the wiring (final.md 4.6), the only file that imports core, render and ui.
// Boot checks WebGL2, picks a graphics tier, shows the title over the far web and loads the first zone. The loop runs
// the core at a fixed 120 Hz on real time (at most 8 steps a frame), reads one input record a frame, then draws: the
// zone pipeline (chase camera, effects, ship, zone view, backdrop), or the light-speed corridor in a jump, then the
// HUD, the overlay and the sound, all fed the same frame's core events. It saves on change, pauses when the page
// hides or the game switcher opens, loads the next zone behind the jump, and installs the test hook window.__lyh
// (final.md 17, scratchpad hook.md).
import * as THREE from 'three';
import { TUNE, withOverrides, tuneAt } from './core/tune.js';
import { createEventBuffer } from './core/events.js';
import {
  createGame, step, setMode, resume, wire, registerZone, zoneOf, builtOf, H, makeInput, createClock, frameSteps,
} from './core/game.js';
import { buildFlight } from './core/ship.js';
import { posAt } from './core/traffic.js';
import { playSlots, actionOf, scanState } from './core/zone.js';
import { startEvent, restartEvent, eventById, nextMedal, pacerOnCourse, placeShip, calmShip } from './core/race.js';
import { startMission } from './core/mission.js';
import { current as talkLine } from './core/talk.js';
import { stepJump, armJump, setZoneReady } from './core/jump.js';
import { decode, toLink, fromLink } from './core/ghost.js';
import {
  makeRegistry, readSave, writeSave, cleanSave, saveOf, progressOf, continueOf, readSettings, writeSettings,
  readGhost, writeGhost, touchGhost, clearSave, readRuns, addRun, breadcrumb, stepDown,
} from './core/save.js';
import { BOTS } from './core/bots.js';
import { layoutFor } from './core/layout.js';
import { checkZone } from './core/world/schema.js';
import { loadZone, hasZone, ZONE_IDS, MISSIONS, JUMPS, factById, ROUND, missionsIn } from './core/world/index.js';
import { earthDateText } from './core/timeline.js';
import { createStage } from './render/stage.js';
import { createBackdrop } from './render/backdrop.js';
import { buildZoneView } from './render/zoneview.js';
import { createTern } from './render/tern.js';
import { createChase, shipPose } from './render/chase.js';
import { createFx } from './render/fx.js';
import { createGhosts } from './render/ghosts.js';
import { createTunnel, runupRings } from './render/tunnel.js';
import { createInput, kindForSource } from './ui/input.js';
import { createHud, safeArea, labelChip } from './ui/hud.js';
import { createOverlay, marksFrom, homeLabel } from './ui/overlay.js';
import { createMenus } from './ui/menu.js';
import { createLog } from './ui/log.js';
import { createSound } from './ui/sound/mix.js';
import { createPerf, graphicsName, isSoftware } from './ui/perf.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const clone = (v) => (v == null ? v : structuredClone(v));
const DEG = Math.PI / 180;
const DRIVING = new Set(['drive', 'zoom', 'runup', 'punch', 'tunnel', 'dropout', 'ended']);
const ZONE_LIVE = new Set(['title', 'drive', 'zoom', 'runup', 'dropout', 'ended']);
const SKY = new Set(['punch', 'tunnel']);
const EDGE_KEYS = ['boostBurst', 'action', 'map', 'pause'];
const ZONE_NAMES = { wall: 'THE WALL', coma: 'COMA CITY', virgo: 'VIRGO' };
const RINGS = ['shapley', 'leo', 'hercules', 'virgo', 'coma'];   // far landmarks that glow in Chapter 1's sky
const OPEN_PHI = 3.2, OPEN_T = 1.3;                              // the opening drop-out: rapidity and seconds
const LOAD_START = 1.5;                                          // s after the punch the next zone's upload begins

function storageOf(name) {
  try {
    const s = window[name];
    s.setItem('lyh.probe', '1');
    s.removeItem('lyh.probe');
    return s;
  } catch { return null; }
}
const store = storageOf('localStorage');
const session = storageOf('sessionStorage');

function todayNow() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), hh: d.getHours(), mm: d.getMinutes() };
}

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

function fail(err) {
  console.error('light-years-home: boot failed', err);
  $('boot')?.classList.add('gone');
  $('graphics-error').hidden = false;
  globalThis.GameSwitch?.wire?.();
}

if (!hasWebGL2()) fail(new Error('no WebGL2'));
else boot().catch(fail);

async function boot() {
  // ---------------------------------------------------------------- settings, tier, tune

  let ui = readSettings(store);                      // the v3 settings key: core settings plus tilt, mouse, quality
  const coarse = matchMedia('(pointer: coarse)').matches;
  const reducedSystem = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const crumb = breadcrumb.check(session);
  const asked = q.get('quality') || ui.quality;
  let tier = ['high', 'mid', 'low'].includes(asked) ? asked
    : isSoftware(graphicsName()) ? 'low' : coarse ? 'mid' : 'high';
  if (crumb && !q.get('quality')) tier = stepDown(crumb);
  breadcrumb.set(session, tier, 0);
  let tune = withOverrides(TUNE, location.search);
  const seed0 = Number.isFinite(+q.get('seed')) && q.get('seed') ? +q.get('seed') : 1;
  // Round 1 plays; ?round=2 turns on the next round's work in progress (core/world/round.js).
  const round = q.get('round') === '2' ? 2 : ROUND;

  // ---------------------------------------------------------------- zones and the flight build

  const zones = new Map();                            // id → zone data, loaded on demand
  const loading = new Map();                          // id → promise
  function zoneData(id) {
    if (zones.has(id)) return Promise.resolve(zones.get(id));
    if (!loading.has(id)) {
      loading.set(id, loadZone(id, round).then((z) => {
        registerZone(z);
        zones.set(id, z);
        if (q.has('debug')) debugZone(z);
        return z;
      }));
    }
    return loading.get(id);
  }
  const flights = new Map();
  const flightOf = (z, seed) => {
    const key = `${z.id}:${seed}`;
    if (!flights.has(key)) flights.set(key, buildFlight(z, seed, tune));
    return flights.get(key);
  };
  wire(playSlots({ jump: stepJump, arm: armJump, build: flightOf }));
  const registry = () => makeRegistry({ zones: [...zones.values()], missions: Object.values(MISSIONS),
    jumps: Object.values(JUMPS) });

  // A save is cleaned against every zone in this build, so nothing it holds is dropped as unknown.
  let saved = readSave(store, null);
  if (saved) await Promise.all(ZONE_IDS.map((id) => zoneData(id).catch(() => null)));
  if (saved) saved = readSave(store, registry());
  const startId = hasZone(q.get('zone')) ? q.get('zone') : 'wall';
  const wall = await zoneData(startId);

  // ---------------------------------------------------------------- the stage and the render modules

  const canvas = $('view');
  const stage = createStage({ canvas, tier, onLost, onRestored });
  stage.resize(innerWidth, innerHeight, devicePixelRatio);
  if (q.get('quality') && q.get('quality') !== 'auto') stage.autoStep = false;
  const reduced = () => !!(game?.settings.reducedMotion || reducedSystem);
  const backdrop = createBackdrop(stage, { web: wall.backdrop?.web || 'chapter-1', rings: RINGS });
  const tern = createTern(stage, { kind: 'tern' });
  let kind = 'desktop';
  const chase = createChase(TUNE.CAM, kind, { reduced: reducedSystem });
  const fx = createFx(stage, tier);
  const ghosts = createGhosts(stage);
  const tunnel = createTunnel(stage, { backdrop, kind, tier, reduced: reducedSystem });
  const perf = createPerf();
  perf.attach({ info: () => stage.info() });
  if (q.has('perf')) perf.show(true);

  // ---------------------------------------------------------------- the UI

  const hud = createHud($('hud-root'));
  const overlay = createOverlay($('overlay'));
  const sound = createSound();
  let layout = null;
  const input = createInput({
    el: canvas, settings: { ...ui }, source: coarse ? 'touch' : null, onSource: () => relayout(),
  });
  const menus = createMenus($('menu-root'), {
    onPlay: () => play(false),
    onContinue: () => play(true),
    onResume: () => { resume(game, ev); syncMode(); },
    onLog: () => { setMode(game, 'log', ev); syncMode(); },
    onSettings: (patch) => applySettings(patch),
    onCopyLog: () => JSON.stringify({ runs: readRuns(store), now: runSummary() }, null, 1),
    onSources: () => { if (game.mode === 'ended') setMode(game, 'log', ev); syncMode(); log.open('log'); },
  });
  const log = createLog($('log-root'), {
    onClose: () => { resume(game, ev); syncMode(); },
    onWaypoint: () => { resume(game, ev); syncMode(); },
    onGhostLink: (id) => {
      const link = ghostLinkOf(id);
      if (link && navigator.clipboard?.writeText) {
        const url = `${location.origin}${location.pathname}?ghost=${encodeURIComponent(link)}`;
        navigator.clipboard.writeText(url).catch(() => {});
      }
    },
    onTab: (tab) => { if (tab === 'log') unread.clear(); },
  });

  // ---------------------------------------------------------------- state of this page

  const ev = createEventBuffer(2048);
  const clock = createClock();
  const history = [];                                  // the last 400 core events, copied, for the hook
  let game = null;
  let view = null, viewZone = null;                    // the zone on the GPU
  const next = { id: null, view: null, built: null, art: false, delay: 0, wait: 0, at: Infinity };
  const art = { ready: false, n: 0, warm: false };
  let pose = null, chaseOut = null, lastMode = null, lastRec = makeInput();
  let bot = null, forced = null, frozen = false, syncing = false;
  const carry = { boostBurst: false, action: false, map: false, pause: false };
  const opening = { t0: -99, on: false, kick: false };
  const PUNCH_KICK = [{ type: 'punch' }];
  // PLAY to control in wall ms and in game s (a slow software GPU runs fewer game seconds per wall second).
  const timing = { playAt: null, playToControlMs: null, firstInputMs: null, lastRestartMs: null, restartAt: null,
    playT: 0, playToControlS: null };
  const unread = new Set();
  const save = { dirty: false, lastWrite: 0, dirtyAt: 0, prev: saved };
  let friend = null;                                   // a ghost link: { id, ghost }
  let raceGhostsFor = null, ghostKinds = [];
  const velView = [0, 0, -1], homeDir = [0, 0, 0];
  const qInv = new THREE.Quaternion(), v3 = new THREE.Vector3();
  const flashEl = $('flash');
  let flash = 0;

  // ---------------------------------------------------------------- games

  // A new game: a zone, a pose, a save. The zone's view is built at once (traffic draws as points until its art bakes).
  function newGame({ zone, at = null, heading, speed, save: sv = null, settings = null, today = null, mode = 'title',
    seed = seed0 } = {}) {
    const z = zone;
    const g = createGame({
      zoneData: z, seed, at, heading: heading ?? z.entry?.heading ?? 0, speed: speed ?? z.entry?.speed ?? 24,
      save: sv, settings: { ...ui, ...(settings || {}) }, today: today || todayNow(), tune, mode,
    });
    game = g;
    clock.acc = 0;
    lastMode = null;
    raceGhostsFor = null;
    ghosts.set([]);
    hud.reset();
    next.id = null; next.view?.dispose?.(); next.view = null; next.art = false; next.at = Infinity; next.wait = 0;
    showZone(z, true);
    chaseOut = null;
    input.setSettings({ ...ui, ...g.settings });
    if (layout) relayout();
    syncMode();
    return g;
  }

  // Put a zone's view on the GPU (the old one goes), frame the backdrop and the camera on it.
  function showZone(z, rebuild = false) {
    if (view && viewZone === z.id && !rebuild) return view;
    view?.dispose();
    const built = builtOf(game);
    view = buildZoneView(stage, z, built, { seed: game.seed });
    viewZone = z.id;
    frameZone(z, built);
    art.ready = false;
    const v = view, n = ++art.n;
    Promise.all([v.ready, backdrop.ready])
      .then(() => stage.compile(stage.scenes.zone, stage.cameras.zone))
      .then(() => { if (art.n === n) { art.ready = true; art.warm = false; } })
      .catch((err) => { console.warn('light-years-home: zone art', err); art.ready = true; });
    return view;
  }

  function frameZone(z, built) {
    backdrop.setFrame(built.frame, z.scaleLy, { object: z.object });
    chase.setBodies(view.bodies);
    chase.setWells(view.wells);
    chase.reset(game.ship);
    pose = null;
  }

  // ---------------------------------------------------------------- the jump's loading (final.md 16.4)

  // The next zone's data and flight tables load as soon as the exit opens (or a jump is armed).
  function prepare(id) {
    if (!id || !hasZone(id)) return;
    zoneData(id).then((z) => { flightOf(z, game.seed); }).catch((err) => console.warn('light-years-home: load', err));
  }

  // At the punch the old zone leaves the GPU and the next one builds behind the corridor.
  function leaveZone() {
    const to = game.jump?.to;
    if (!to) return;
    view?.dispose();
    view = null;
    viewZone = null;
    next.id = to;
    next.art = false;
    next.wait = next.delay;          // simulateSlowLoad: the art reports ready this much later (core time)
    next.at = Infinity;
    next.delay = 0;
    const build = (z) => {
      if (next.id !== z.id || next.view) return;
      next.built = flightOf(z, game.seed);
      next.view = buildZoneView(stage, z, next.built, { seed: game.seed });
      const v = next.view;
      // A simulated slow load counts on the jump's own clock from where the real upload would start (16.4).
      const done = () => {
        if (next.view !== v) return;
        next.art = true;
        next.at = next.wait ? (game.jump?.t ?? 0) + LOAD_START + next.wait : 0;
      };
      v.ready.then(() => stage.compile(stage.scenes.zone, stage.cameras.zone)).then(done).catch(done);
    };
    if (zones.has(to)) build(zones.get(to));
    else zoneData(to).then(build).catch((err) => console.warn('light-years-home: next zone', err));
  }

  // Tell the jump the next zone is in: its art (or, when the hook steps the core by hand and no slow load was asked
  // for, its view) and any simulated delay after that.
  function readyCheck() {
    const J = game.jump;
    if (!J || J.zoneReady || J.part === 'runup' || !next.view || next.id !== J.to) return;
    if ((next.art && J.t >= next.at) || (syncing && !next.wait)) setZoneReady(game, true);
  }

  // The drop-out entered the next zone: its view takes over.
  function arrived(e) {
    const z = zones.get(e.zone);
    if (!z || e.pocket) return;
    if (next.view && next.id === z.id) {
      view?.dispose();
      view = next.view;
      viewZone = z.id;
      frameZone(z, next.built || builtOf(game));
      art.ready = next.art;
      if (!next.art) next.view.ready.then(() => { art.ready = true; });
      next.view = null; next.id = null; next.built = null;
    } else if (viewZone !== z.id) {
      showZone(z, true);
    }
    saveSoon(true);
  }

  // ---------------------------------------------------------------- races and ghosts

  function raceGhosts(id) {
    const data = eventById(game, id);
    if (!data) { ghosts.set([]); return; }
    touchGhost(store, id);
    const rec = game.progress.events?.[id];
    const bestBytes = readGhost(store, id);
    const best = bestBytes ? decode(bestBytes) : null;
    const target = nextMedal(data, rec);
    const slots = [];
    if (best) slots.push({ kind: 'best', ghost: best });
    if (target) {
      if (best && rec?.best > 0) slots.push({ kind: 'pacer', ghost: best, ratio: target.time / rec.best });
      else slots.push({ kind: 'pacer', sample: (t, out) => pacerOnCourse(data, target.time, t, out) });
    }
    if (friend && friend.id === id) slots.push({ kind: 'friend', ghost: friend.ghost });
    ghosts.set(slots.slice(0, 3));
    ghostKinds = slots.slice(0, 3).map((x) => x.kind);
    raceGhostsFor = id;
  }

  function ghostLinkOf(id) {
    const bytes = readGhost(store, id);
    return bytes ? toLink(id, bytes) : null;
  }

  // ---------------------------------------------------------------- the event table

  // Main's own work per core event; the HUD, overlay, effects and sound read the same list themselves.
  const SAVE_ON = new Set(['missionDone', 'finish', 'stuntResult', 'scan', 'farScan', 'secret', 'setItem', 'setDone',
    'lookHome', 'jumpMedal', 'exitOpen', 'rumour', 'fix']);
  const ON = {
    arrive: (e) => arrived(e),
    exitOpen: (e) => prepare(e.to || zoneOf(game)?.exit?.to),
    eventStart: (e) => raceGhosts(e.id),
    restart: (e) => { raceGhosts(e.id); timing.restartAt = performance.now(); },
    finish: (e) => { if (e.ghost instanceof Uint8Array) writeGhost(store, e.id, e.ghost); },
    cancel: () => { ghosts.set([]); raceGhostsFor = null; ghostKinds = []; },
    scan: (e) => unread.add(e.card || e.id),
    farScan: (e) => unread.add(e.card || e.id),
    rumour: (e) => unread.add(e.id),
    secret: (e) => unread.add(e.card || e.id),
    lookHome: (e) => unread.add(e.card),
  };

  function route(list) {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const fn = ON[e.type];
      if (fn) { try { fn(e); } catch (err) { console.warn('light-years-home: event', e.type, err); } }
      if (SAVE_ON.has(e.type)) saveSoon();
      history.push(e);
    }
    if (history.length > 400) history.splice(0, history.length - 400);
    if (game.race && game.race.state === 'running' && timing.restartAt !== null) {
      timing.lastRestartMs = performance.now() - timing.restartAt;
      timing.restartAt = null;
    }
    if (!game.race && raceGhostsFor) { ghosts.set([]); raceGhostsFor = null; ghostKinds = []; }
  }

  // ---------------------------------------------------------------- modes

  // Menus, the log and the input context follow the core's mode.
  function syncMode() {
    const m = game.mode;
    if (m === lastMode) return;
    const from = lastMode;
    lastMode = m;
    input.context(m, game.activity);
    if (m === 'title') {
      log.close();
      menus.title({ hasSave: !!saved, saveLine: saveLine(saved), source: input.source });
    } else if (m === 'paused') {
      log.close();
      const ahead = game.jump?.earth?.ahead ?? game.earth.aheadLy;
      menus.pause({ where: ZONE_NAMES[game.zoneId] || String(zoneOf(game)?.name || '').toUpperCase(),
        earth: `EARTH · ${earthDateText(ahead, game.today, { short: true })}`.toUpperCase() });
      flushSave();
    } else if (m === 'log') {
      menus.hide();
      openLog();
    } else {
      if (from === 'paused' || from === 'log' || from === 'title' || from === null) menus.hide();
      if (from === 'log') log.close();
    }
  }

  function openLog(tab = 'map') {
    const z = zoneOf(game);
    const sv = saveOf(game, save.prev);
    const known = {};
    for (const [id, d] of zones) known[id] = d;
    log.render(sv, z, {
      game, missions: missionsIn(Object.values(MISSIONS), round), zones: known,
      objective: { text: hud.state.topText || '' }, unread: [...unread],
      homeDir: backdrop.dirOf('earth', [0, 0, 0]), aheadLy: game.earth.aheadLy, canJumpBack: false, photos: {},
    });
    log.open(tab);
  }

  // Pause when the page hides, loses focus or the arcade's game switcher opens.
  function pauseNow() {
    if (game && DRIVING.has(game.mode) && setMode(game, 'paused', ev)) syncMode();
  }

  // ---------------------------------------------------------------- PLAY and CONTINUE

  async function play(cont) {
    sound.start();
    if (game.mode !== 'title') return;
    const link = fromLink(q.get('ghost') || '');
    if (link) friend = link;
    if (cont && saved) {
      const id = hasZone(saved.zoneId) ? saved.zoneId : 'wall';
      const z = await zoneData(id);
      const at = continueOf(saved, z);
      newGame({ zone: z, at: at.at, heading: at.heading, speed: at.speed, save: progressOf(saved) });
      save.prev = saved;
    } else if (game.zoneId !== startId || game.zone.exitOpen) {
      newGame({ zone: zones.get(startId) });
      save.prev = null;
    }
    setMode(game, 'drive', ev);
    syncMode();
    opening.t0 = game.t;
    opening.on = !cont;
    opening.kick = !cont;
    flash = reduced() ? 0.3 : 1;
    timing.playAt = performance.now();
    timing.playT = game.t;
    timing.playToControlMs = null;
    timing.playToControlS = null;
    timing.firstInputMs = null;
    if (crumb) hud.hint('lowgfx');
    setTimeout(() => breadcrumb.clear(session), 10000);
    if (link && eventById(game, link.id)) {
      startEvent(game, link.id, { fromRunup: true, ev });
      raceGhosts(link.id);
      chase.reset(game.ship);
    }
    const name = q.get('bot');
    if (name) startBot(name, {});
  }

  function saveLine(sv) {
    if (!sv) return '';
    const where = ZONE_NAMES[sv.zoneId] || String(sv.zoneId || '').toUpperCase();
    let golds = 0;
    for (const e of Object.values(sv.events || {})) if (e.medal === 'gold' || e.medal === 'tern') golds++;
    for (const j of Object.values(sv.jumps || {})) if (j.medal === 'gold' || j.medal === 'tern') golds++;
    return sv.chapterDone ? `CHAPTER I DONE · GOLDS ${golds}` : `${where} · GOLDS ${golds}`;
  }

  // ---------------------------------------------------------------- settings

  function settingValues() {
    return { ...game.settings, tilt: !!ui.tilt, mouseSteer: !!ui.mouseSteer, quality: ui.quality || 'auto',
      sound: sound.isOn(), music: ui.music !== false };
  }

  function applySettings(patch) {
    for (const [key, v] of Object.entries(patch)) {
      if (key === 'sound') { sound.setOn(v); continue; }
      if (key === 'music') { ui.music = v; sound.setMusic(v); continue; }
      ui[key] = v;
      if (key in game.settings) game.settings[key] = v;
      if (key === 'tilt') { if (v) input.enableTilt(); else input.disableTilt(); }
      if (key === 'quality') {
        if (v === 'auto') stage.autoStep = true;
        else { stage.autoStep = false; stage.setTier(v); }
      }
      if (key === 'reducedMotion') {
        chase.setReduced(reduced());
        tunnel.setReduced(reduced());
        document.documentElement.dataset.reducedMotion = String(!!v);
      }
    }
    input.setSettings({ ...ui });
    writeSettings(store, ui);
    if ('scheme' in patch || 'hand' in patch) relayout();
    menus.paint(settingValues());
  }

  // ---------------------------------------------------------------- layout

  function relayout() {
    const w = innerWidth, h = innerHeight;
    stage.resize(w, h, devicePixelRatio);
    overlay.resize(w, h, devicePixelRatio);
    kind = kindForSource(input.source, w, h);
    layout = layoutFor({ w, h, safe: safeArea(), scheme: game?.settings.scheme || ui.scheme,
      hand: game?.settings.hand || ui.hand, kind });
    input.setLayout(layout);
    hud.apply(layout);
    chase.setKind(kind);
    tunnel.setKind(kind);
  }
  addEventListener('resize', relayout);
  addEventListener('orientationchange', () => setTimeout(relayout, 60));

  // ---------------------------------------------------------------- saves

  function saveSoon(now = false) {
    if (!game || game.mode === 'title') return;
    save.dirty = true;
    save.dirtyAt = performance.now() - (now ? 1000 : 0);
  }
  function saveTick(nowMs) {
    if (!save.dirty || nowMs - save.dirtyAt < 1000 || nowMs - save.lastWrite < 2000) return;
    flushSave();
  }
  function flushSave() {
    if (!game || game.mode === 'title' || !save.dirty) return;
    const sv = saveOf(game, save.prev);
    if (writeSave(store, sv)) { saved = sv; save.prev = sv; }
    save.dirty = false;
    save.lastWrite = performance.now();
  }
  function runSummary() {
    if (!game) return null;
    return { date: new Date().toISOString().slice(0, 10), zone: game.zoneId, mode: game.mode,
      playMin: Math.round(game.stats.playT / 6) / 10, near: game.stats.near, scans: game.stats.scans,
      tier: stage.tier, screen: `${innerWidth}x${innerHeight}`, source: input.source };
  }
  let runAdded = false;
  addEventListener('pagehide', () => {
    breadcrumb.clear(session);                         // a page that unloads itself did not die loading
    if (game && game.mode !== 'title') { save.dirty = true; flushSave(); }
    if (!runAdded && game && game.stats.playT > 5) { runAdded = true; addRun(store, runSummary()); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseNow(); if (save.dirty) flushSave(); }
  });
  addEventListener('blur', () => pauseNow());

  // ---------------------------------------------------------------- lost context

  function onLost() { pauseNow(); }
  function onRestored() { art.ready = true; }

  // ---------------------------------------------------------------- bots

  function makeBot(name, opts = {}) {
    const jb = name.startsWith('jump-') ? BOTS.jump[name.slice(5)] : null;
    if (jb) return jb({ seed: game.seed, ...opts });
    const b = BOTS[name];
    if (!b || typeof b.make !== 'function') throw new Error(`no bot ${name}`);
    return b.make({ seed: game.seed, ...opts });
  }
  function startBot(name, opts) {
    bot = makeBot(name, opts);
    const me = bot;
    return { stop() { if (bot === me) bot = null; } };
  }

  // ---------------------------------------------------------------- one frame

  function readInput(nowMs) {
    const r = input.read(nowMs);
    if (forced) {
      // Only the fields the hook forces; the player's own input fills the rest. Forced taps fire once.
      for (const k in forced) if (k in r) r[k] = forced[k];
      for (const k of EDGE_KEYS) if (forced[k]) forced[k] = false;
    }
    for (const k of EDGE_KEYS) { if (carry[k]) { r[k] = true; carry[k] = false; } }
    return r;
  }

  // One core step. The punch frees the old zone at once, so the next one can build while the corridor runs.
  function stepOnce(rec) {
    readyCheck();
    const n0 = ev.n;
    step(game, bot ? bot.next(game) : rec, ev);
    for (let i = n0; i < ev.n; i++) if (ev.list[i].type === 'punch') leaveZone();
  }

  // Everything after the core's steps: routing, the timers, the picture, the HUD and the sound.
  function afterSteps(dt, nowMs, rec) {
    const list = ev.list.slice(0, ev.n);
    ev.clear();
    route(list);
    syncMode();
    if (game.mode === 'drive' && timing.playAt !== null) {
      if (timing.playToControlMs === null && game.t >= game.lockUntil) {
        timing.playToControlMs = nowMs - timing.playAt;
        timing.playToControlS = game.t - timing.playT;
      }
      const busy = rec && (rec.steer || rec.climb || rec.gas || rec.brake || rec.drift || rec.boost || rec.boostBurst);
      if (timing.firstInputMs === null && busy && game.t >= game.lockUntil) timing.firstInputMs = nowMs - timing.playAt;
    }
    draw(dt, list);
    saveTick(nowMs);
    return list;
  }

  function frame(nowMs) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.25, Math.max(0, (nowMs - (frame.last ?? nowMs)) / 1000));
    frame.last = nowMs;
    perf.begin();
    if (globalThis.GameSwitch?.isOpen) pauseNow();
    const rec = readInput(nowMs);
    lastRec = rec;
    let n = 0;
    if (!frozen) {
      n = frameSteps(clock, dt);
      for (let i = 0; i < n; i++) stepOnce(rec);
    }
    if (n === 0) for (const k of EDGE_KEYS) if (rec[k]) carry[k] = true;   // no step this frame: keep the taps
    afterSteps(frozen ? 0 : dt, nowMs, rec);
    perf.end();
    perf.frame(dt * 1000, stage.renderer.info.render);
  }

  // ---------------------------------------------------------------- the picture

  function titleCamera(dt) {
    const cam = stage.cameras.zone;
    titleCamera.a = (titleCamera.a || 0) + dt * 0.03;
    const s = game.ship.pos, a = game.ship.yaw + Math.sin(titleCamera.a) * 0.6;
    cam.position.set(s[0], s[1], s[2] + 2);
    cam.up.set(0, 0, 1);
    cam.lookAt(s[0] + Math.sin(a) * 100, s[1] + Math.cos(a) * 100, s[2] + 12 + Math.sin(titleCamera.a * 0.7) * 6);
    cam.fov = 60;
    cam.aspect = stage.size.w / Math.max(1, stage.size.h);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  function draw(dt, list) {
    const held = game.mode === 'paused' || game.mode === 'log';
    const mode = held ? game.prevMode || 'drive' : game.mode;
    const cam = stage.cameras.zone;
    const fdt = held ? 0 : dt;
    const alpha = clamp(clock.acc / H, 0, 1);
    let passes = null, ovCam = cam;
    if (mode === 'title' && art.ready && !art.warm) {
      // Draw the zone once behind the title, so its buffers and shaders are on the GPU before PLAY.
      art.warm = true;
      pose = shipPose(game.ship, 1, pose || {});
      chase.reset(game.ship);
      chase.update(cam, pose, game.ship.up, 1 / 60, list, null);
      fx.update({ cam, ship: pose, events: list, reduced: reduced() }, 1 / 60);
      view.update(game, 1, cam);
      tern.update(pose, 1, fx, 1 / 60);
      backdrop.update(cam, OPEN_PHI, null);
      stage.draw();
      $('boot')?.classList.add('gone');
    }
    if (mode === 'title') {
      titleCamera(dt);
      backdrop.update(cam, 0, null);
      passes = [stage.pass.backdrop];
    } else if (ZONE_LIVE.has(mode) && view) {
      pose = shipPose(game.ship, held ? 1 : alpha, pose || {});
      // The opening drop-out: the camera's light-speed kick (a wide view snapping back) on the first frame after PLAY.
      const camEvents = opening.kick ? PUNCH_KICK : list;
      opening.kick = false;
      chaseOut = chase.update(cam, pose, game.ship.up, fdt, camEvents, null);
      fx.update({ cam, ship: pose, events: list, reduced: reduced() }, fdt);
      tern.update(pose, 1, fx, fdt);
      view.setRings(mode === 'runup' ? runupRings(game.jump) : []);
      view.update(game, held ? 1 : alpha, cam);
      ghosts.update(game.race ? game.race.t : -1);
      if (mode !== 'dropout') {
        qInv.copy(cam.quaternion).invert();
        v3.set(pose.vel[0], pose.vel[1], pose.vel[2]).applyQuaternion(qInv);
        if (v3.lengthSq() > 1e-6) { v3.normalize(); velView[0] = v3.x; velView[1] = v3.y; velView[2] = v3.z; }
        let phi = TUNE.FX.BOOST_PHI * (chaseOut?.boost || 0);
        if (opening.on) {
          const k = (game.t - opening.t0) / OPEN_T;
          if (k >= 1) opening.on = false;
          else phi = Math.max(phi, OPEN_PHI * (1 - smooth(k)) ** 2);
        }
        backdrop.update(cam, phi, velView);
      }
    }
    tern.visible = !SKY.has(mode);
    if (SKY.has(mode) || mode === 'dropout') {
      const out = tunnel.update({ game, dt: fdt, alpha, events: list, zoneCam: cam });
      passes = out.passes;
      if (mode !== 'dropout') ovCam = tunnel.camera;
    }
    stage.draw(passes ? { passes } : undefined);
    if (flash > 0) {
      flash = Math.max(0, flash - dt * 2.4);
      flashEl.style.opacity = String(Math.min(reduced() ? 0.3 : 1, flash).toFixed(3));
    }
    ui2d(dt, list, mode, ovCam);
  }

  // How white the screen is right now (the PLAY fold's flash, the punch's, the drop-out's), for the HUD's holds.
  function washNow(mode) {
    let w = flash > 0 ? Math.min(reduced() ? 0.3 : 1, flash) : 0;
    if (SKY.has(mode) || mode === 'dropout') {
      const ts = tunnel.state || {};
      w = Math.max(w, Number(ts.flash) || 0, Number(ts.white) || 0);
    }
    return w;
  }
  // The ship's place on screen through the zone camera ([x, y] CSS px), or null at light speed.
  const shipV = new THREE.Vector3(), shipAt = [0, 0];
  function shipScreen(mode) {
    if (SKY.has(mode) || !game?.ship) return null;
    const cam = stage.cameras.zone, p = game.ship.pos;
    shipV.set(p[0], p[1], p[2]).project(cam);
    if (shipV.z > 1) return null;
    shipAt[0] = (shipV.x + 1) / 2 * stage.size.w; shipAt[1] = (1 - shipV.y) / 2 * stage.size.h;
    return shipAt;
  }

  function ui2d(dt, list, mode, ovCam) {
    const z = zoneOf(game);
    const chip = labelChip(actionOf(game, z), z);
    const m = hud.update({ game, zone: z, layout, events: list, line: talkLine(game), input: input.state,
      source: input.source, dt, chip, wash: washNow(mode), shipAt: shipScreen(mode) });
    input.show({ chip: !!m.chip, radar: m.radar });
    if (mode === 'title') { overlay.clear(); return; }
    ovCam.updateMatrixWorld();
    const sky = SKY.has(mode);
    const ahead = game.jump?.earth?.ahead ?? game.earth.aheadLy;
    const dir = backdrop.dirOf('earth', homeDir);
    overlay.draw({
      game, zone: z, layout, dt, events: list, reduced: reduced(),
      cam: { view: ovCam.matrixWorldInverse.elements, proj: ovCam.projectionMatrix.elements, w: stage.size.w,
        h: stage.size.h },
      marks: sky ? [] : scannedMarks(z, marksFrom(game, z,
        { dirOf: backdrop.dirOf, scan: (id) => scanState(game, id) })),
      home: sky || !dir ? null : { dir, label: homeLabel(ahead) },
    });
    if (game.mode !== 'paused' && game.mode !== 'log') {
      input.feedback(list);
      sound.update({ game, events: list, input: lastRec }, dt);
    } else {
      sound.update({ game, events: list, input: null }, dt);
    }
  }

  // A scanned traffic galaxy or road keeps the video's ring and label while it is near (marksFrom draws the rest).
  const markPos = new Map();
  function scannedMarks(z, marks) {
    const sa = game.zone.scannedAt;
    if (!sa || !z) return marks;
    const built = builtOf(game), p = game.ship.pos;
    for (const id in sa) {
      const a = sa[id];
      const s = (z.scans || []).find((x) => x.id === id);
      if (!s?.target || !(s.target.traffic || s.target.roads)) continue;
      let pos = a.pos;
      if (s.target.traffic && a.traffic >= 0 && built?.traffic && a.traffic < built.traffic.n) {
        pos = markPos.get(id) || [0, 0, 0];
        markPos.set(id, pos);
        posAt(built.traffic, a.traffic, game.zoneT, pos);
      }
      if (!pos || Math.hypot(pos[0] - p[0], pos[1] - p[1]) > 160) continue;
      marks.push({ id, pos, r: Math.max(1.5, a.r) * 1.3, kind: 'scanned', label: String(s.label || '').toUpperCase(),
        priority: 45 });
    }
    return marks;
  }

  // ---------------------------------------------------------------- debug

  function debugZone(z) {
    const errs = checkZone(z);
    if (!errs.length) return;
    const el = $('debug');
    el.hidden = false;
    el.textContent += `${z.id}: ${errs.length} schema errors\n${errs.slice(0, 20).join('\n')}\n`;
  }

  // ---------------------------------------------------------------- start

  newGame({ zone: wall });
  relayout();
  menus.paint(settingValues());
  document.documentElement.dataset.reducedMotion = String(!!ui.reducedMotion);
  requestAnimationFrame(frame);
  setTimeout(() => $('boot')?.classList.add('gone'), 4000);
  globalThis.GameSwitch?.wire?.();

  // ---------------------------------------------------------------- the test hook (final.md 17)

  const waitFor = (fn, ms = 20000) => new Promise((res, rej) => {
    const t0 = performance.now();
    const poll = () => {
      if (fn()) res();
      else if (performance.now() - t0 > ms) rej(new Error('timed out'));
      else setTimeout(poll, 30);
    };
    poll();
  });

  function zoneEntity(id) {
    const z = zoneOf(game);
    if (!z) return null;
    if (id === 'exit' && z.exit) return { pos: z.exit.pos, r: z.exit.r ?? 10 };
    const b = (z.bodies || []).find((x) => x.id === id);
    if (b) return { pos: b.pos, r: b.r ?? b.rc ?? 3 };
    const ring = (z.rings || []).find((x) => x.id === id);
    if (ring) return { pos: ring.pos, r: ring.r ?? 8 };
    const e = (z.events || []).find((x) => x.id === id);
    if (e?.start?.pos) return { pos: e.start.pos, r: e.start.r ?? 4.5 };
    const a = (game.actors || []).find((x) => x.id === id);
    if (a) return { pos: a.pos, r: a.data?.r ?? 1.6 };
    const s = (z.scans || []).find((x) => x.id === id);
    if (s) {
      const tg = s.target || {};
      if (tg.body) return zoneEntity(tg.body);
      if (tg.at) return { pos: Array.isArray(tg.at[0]) ? tg.at[0] : tg.at, r: tg.r ?? 3 };
      if (tg.inside) return { pos: tg.inside.centre, r: tg.inside.r };
    }
    const far = (z.far || []).find((f) => f.scan === id || f.id === id);
    if (far) {
      const d = backdrop.dirOf(far.object, [0, 0, 0]);
      if (d) {
        const p = game.ship.pos;
        return { pos: [p[0] + d[0] * 3000, p[1] + d[1] * 3000, p[2] + d[2] * 3000], r: 0, far: true };
      }
    }
    return null;
  }

  function project(id) {
    const e = zoneEntity(id);
    if (!e) return null;
    const cam = stage.cameras.zone;
    cam.updateMatrixWorld();
    const p = new THREE.Vector3(e.pos[0], e.pos[1], e.pos[2] || 0);
    const vc = p.clone().applyMatrix4(cam.matrixWorldInverse);
    const depth = -vc.z;
    const w = stage.size.w, h = stage.size.h;
    p.project(cam);
    const x = (p.x + 1) / 2 * w, y = (1 - p.y) / 2 * h;
    const r = depth > 0 ? (e.r * cam.projectionMatrix.elements[5] * (h / 2)) / depth : 0;
    const visible = depth > 0;
    return { x, y, r, visible, onScreen: visible && x >= 0 && x <= w && y >= 0 && y <= h };
  }

  function logView() {
    const sv = saveOf(game, save.prev);
    return {
      scans: sv.scans, cards: sv.scans.map((id) => ({ id, title: factById(id)?.title || id })), rumours: sv.rumours,
      secrets: sv.secrets, postcards: sv.postcards, records: { events: sv.events, stunts: sv.stunts, jumps: sv.jumps },
      unread: [...unread],
    };
  }

  // Run the core by hand: n steps with the input (its edges go to the first), then one drawn frame.
  function stepBy(input, seconds) {
    frozen = true;
    const rec = makeInput(input || {});
    const n = Math.max(1, Math.round((Number.isFinite(seconds) ? seconds : H) / H));
    const out = [];
    syncing = true;
    try {
      for (let i = 0; i < n; i++) {
        stepOnce(rec);
        if (ev.n > 1500) out.push(...afterQuiet());
      }
    } finally { syncing = false; }
    // The frame drawn after the steps runs the HUD's and the flash's clocks for the time stepped (at most 0.5 s), so
    // a stepped screenshot shows what a player would see, not a flash or a hint that should have gone.
    out.push(...afterSteps(Math.min(0.5, n * H), performance.now(), rec));
    return out.map((e) => clone(e));
  }
  // Route a long run's events now and then without drawing (so punch and arrive land in order).
  function afterQuiet() {
    const list = ev.list.slice(0, ev.n);
    ev.clear();
    route(list);
    syncMode();
    return list;
  }

  const hook = {
    version: 3,
    get ready() { return art.ready && !!view; },
    async start(opts = {}) {
      const id = hasZone(opts.zone) ? opts.zone : 'wall';
      const z = await zoneData(id);
      bot = null; forced = null; frozen = false;
      if (opts.save) await Promise.all(ZONE_IDS.map((k) => zoneData(k).catch(() => null)));
      const sv = opts.save ? cleanSave(opts.save, registry()) : null;
      newGame({ zone: z, at: opts.at || null, heading: opts.heading, speed: opts.speed,
        save: sv ? progressOf(sv) : null, settings: opts.settings || null, today: opts.today || null,
        seed: Number.isFinite(opts.seed) ? opts.seed : seed0 });
      save.prev = sv;
      if (opts.skipIntro) {
        sound.start();
        setMode(game, 'drive', ev);
        game.lockUntil = 0;
        if (game.story) game.story.openingI = 999;
        syncMode();
        timing.playAt = performance.now();
        timing.playT = game.t;
      }
      await waitFor(() => art.ready);
    },
    mode: () => game.mode,
    state: () => clone(game),
    ship: () => clone(game.ship),
    zone: () => ({ ...clone(game.zone), id: game.zoneId, pocketId: game.pocketId, zoneT: game.zoneT }),
    activity: () => clone(game.activity),
    chapter: () => ({
      zoneId: game.zoneId,
      missionsDone: Object.keys(game.progress.missions).filter((k) => game.progress.missions[k]?.done),
      exitOpen: !!game.zone.exitOpen, jumpsDone: Object.keys(game.progress.jumps),
      chapterDone: !!(game.story?.chapterDone || saved?.chapterDone),
    }),
    step: (input, seconds) => stepBy(input, seconds),
    live() { frozen = false; clock.acc = 0; forced = null; },
    freeze(on) { frozen = !!on; clock.acc = 0; },
    input(record) { forced = record ? { ...record } : null; },
    hold(record, ms) {
      forced = { ...record };
      const me = forced;
      return new Promise((res) => setTimeout(() => { if (forced === me) forced = null; res(); }, ms));
    },
    teleport(pos, heading = null, speed = null) {
      const s = game.ship;
      const yaw = heading === null ? s.yaw : heading * DEG;
      placeShip(game, pos, yaw, speed === null ? s.speed : speed);
      calmShip(s);
      chase.reset(game.ship);
      pose = null;
    },
    tune(path, value) {
      const p = String(path).replace(/^tune\./, '');
      if (tuneAt(tune, p) === undefined) return undefined;
      tune = withOverrides(tune, { [p]: value });
      game.tune = tune;
      return clone(tuneAt(tune, p));
    },
    events: (n = 50) => history.slice(-n).map((e) => clone(e)),
    played: () => ({ ...sound.played }),
    race: () => (game.race || game.stunt ? { ...clone(game.race || {}), stunt: clone(game.stunt) } : null),
    raceStart(id) {
      const ok = startEvent(game, id, { fromRunup: true, ev });
      if (ok) { raceGhosts(id); chase.reset(game.ship); pose = null; }
      return ok;
    },
    raceRestart() { return game.race ? restartEvent(game, ev) : false; },
    ghost(id) { const b = readGhost(store, id); return b ? clone(decode(b)) : null; },
    ghostSlots: () => ghostKinds.slice(),
    ghostLink: (id) => ghostLinkOf(id),
    mission: () => clone(game.mission),
    missionStart(id, beat = 0) { const ok = startMission(game, id, beat, ev); return ok !== false; },
    talk: () => ({ ...clone(game.talk), current: talkLine(game) }),
    scan: (id) => scanState(game, id),
    log: () => logView(),
    save: () => saveOf(game, save.prev),
    resetSave() { clearSave(store); saved = null; save.prev = null; },
    jump(to) {
      prepare(to);
      const ok = armJump(game, to, ev);
      syncMode();
      return ok;
    },
    jumpState: () => clone(game.jump),
    simulateSlowLoad(seconds) { next.delay = Math.max(0, +seconds || 0); },
    layout: () => ({ kind: layout.kind, rects: clone(layout.rects), dom: hud.dom() }),
    project,
    overlay: () => ({ rings: clone(overlay.rings), labels: clone(overlay.labels), chevrons: clone(overlay.chevrons),
      callout: overlay.callout }),
    get perf() {
      const i = stage.info(), s = perf.stats();
      return { fps: s.frame.p50 ? Math.round(1000 / s.frame.p50) : 0, p95: s.frame.p95, cpuMs: s.cpu.p50,
        drawCalls: i.calls, points: i.points, triangles: i.triangles, textureBytes: i.textureBytes,
        bufferBytes: i.bufferBytes, memory: { ...i.memory }, overdraw: null, tier: i.tier, pixelRatio: i.pixelRatio };
    },
    setQuality(t) {
      if (t === 'auto') stage.autoStep = true;
      else { stage.autoStep = false; stage.setTier(t); }
    },
    async loseContext() {
      const ext = stage.renderer.getContext().getExtension('WEBGL_lose_context');
      if (!ext) return;
      const back = new Promise((res) => { const off = stage.onRestored(() => { off(); res(); }); });
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 120));
      ext.restoreContext();
      await back;
    },
    timing: () => ({ playToControlMs: timing.playToControlMs, playToControlS: timing.playToControlS,
      firstInputMs: timing.firstInputMs, lastRestartMs: timing.lastRestartMs }),
    bot: (name, opts = {}) => startBot(name, opts),
  };
  window.__lyh = hook;
}
