// js/story/index.js : the story director. It builds the one context object S, loads the packages in a
// fixed order, runs every phase in PHASES order each tick, and owns the single entry, begin().
// game.js reaches it through one seam (loadStory); FIGHT GABE never imports this file.
import * as THREE from 'three';
import { createTimers, createCo, createDay } from '../core/clock.js';
import { createBus } from '../core/bus.js';
import { rng } from '../core/rng.js';
import { createFilm } from '../core/film.js';
import { createInteract } from './core/interact.js';
import { PHASES, PHASE_RULES, PACKAGES, PACKAGE_PATHS, BEGIN_REASONS, CHAPTER_ORDER, ARENA_CAST, checkContract } from './types.js';

const Q = new URLSearchParams(location.search);
// ?stub=all or ?stub=look,world loads those packages from stubs/; ?real=combat loads only combat for real
// and stubs the rest. contract.mjs uses this to check each package against the stubs (B13).
function source(pkg) {
  const real = Q.get('real');
  if (real) return real.split(',').includes(pkg) ? 'real' : 'stub';
  const stub = (Q.get('stub') || '').split(',');
  return stub.includes('all') || stub.includes(pkg) ? 'stub' : 'real';
}
// define getters as getters (Object.assign would copy their current values)
const define = (target, src) => Object.defineProperties(target, Object.getOwnPropertyDescriptors(src));

export async function createStory(ctx) {
  const pkgs = {};
  const mods = await Promise.all(PACKAGES.map((p) => {
    pkgs[p] = source(p);
    return import(pkgs[p] === 'stub' ? `./stubs/${p}.js` : `./${PACKAGE_PATHS[p]}`);
  }));
  return build(ctx, mods, pkgs);
}

function build(ctx, mods, pkgs) {
  const q = Q.has('q') ? Math.max(0, Math.min(2, Math.round(+Q.get('q')) || 0)) : 2;
  const S = {
    THREE, ctx, game: ctx.game, scene: ctx.scene, camera: ctx.camera, renderer: ctx.renderer,
    time: 0, frame: 0, timers: createTimers(), bus: createBus(), rng, day: createDay(), flags: {},
    q, mode: 'boot', modal: null, freeze: false, lockControl: false, hitstop: 0, slow: 1, slowT: 0, timeScale: 1,
    interact: createInteract(), focus: new THREE.Vector3(), ready: false, test: {}, pkgs,
  };
  S.film = createFilm({ ...(ctx.film || {}), now: () => S.timers.now });
  S.co = createCo(S.timers, { onError: (task, error) => S.bus.emit('coError', { task, error }) });

  // phases: S.register throws on a name tick never runs (B6)
  const phases = Object.fromEntries(PHASES.map((p) => [p, []]));
  S.register = (phase, fn, order = 0) => {
    if (!phases[phase]) throw new Error(`S.register: unknown phase '${phase}'. Use one of: ${PHASES.join(', ')}`);
    if (typeof fn !== 'function') throw new Error(`S.register('${phase}'): fn must be a function`);
    const h = { fn, order };
    phases[phase].push(h); phases[phase].sort((a, b) => a.order - b.order);
    return () => { const i = phases[phase].indexOf(h); if (i >= 0) phases[phase].splice(i, 1); };
  };
  // cameras: the highest-priority active camera drives the view (cine 100, photo 90, drive 50, foot 40, boot 0)
  const cams = [];
  S.cameras = {
    add(name, prio, active, update) { const c = { name, prio, active, update }; cams.push(c); cams.sort((a, b) => b.prio - a.prio); return () => { const i = cams.indexOf(c); if (i >= 0) cams.splice(i, 1); }; },
    get current() { return cams.find((c) => c.active()) || null; },
    get list() { return cams.map((c) => c.name); },
  };
  S.cameras.add('boot', 0, () => true, () => {}); // holds the view (the cold open starts from the fight camera)

  for (const m of mods) m.init(S); // fixed order: look, audio, world, cast, vehicles, combat, missions, ui, content
  // the arena actors: the cold open drives them, and the cast only ever hides them (B9)
  for (const id of ARENA_CAST) if (ctx.actors && ctx.actors[id]) S.cast.register(id, ctx.actors[id]);
  S.register('control', () => { if (S.hero) S.interact.update(S.hero); }, -10);
  // the shared particle pool from fx.js: combat time while playing, story time otherwise
  S.register('fx', (cdt, rdt) => { if (ctx.updateFX) ctx.updateFX(S.mode === 'play' && !S.freeze ? cdt : rdt); }, 100);

  const run = (p, cdt, rdt, raw) => { for (const h of phases[p].slice()) h.fn(cdt, rdt, raw); };
  // One story tick. raw is the frame's real seconds. Freeze stops only gameplay (B7); timeScale scales
  // every sim phase, the timers and the clock (B8); hitstop and slow motion scale only the combat dt.
  function tick(raw) {
    S.frame++;
    if (S.input) S.input.update();
    const clockOn = S.mode !== 'menu', play = S.mode === 'play';
    const rdt = clockOn ? raw * S.timeScale : 0;
    const sim = play && !S.freeze;
    let cdt = sim ? rdt : 0;
    if (sim) {
      if (S.hitstop > 0) { S.hitstop -= rdt; cdt *= 0.04; }
      if (S.slowT > 0) { S.slowT -= rdt; cdt *= S.slow; }
    }
    const on = { always: true, clock: clockOn, sim };
    for (const p of PHASES) {
      if (!on[PHASE_RULES[p]]) continue;
      if (p === 'script') {
        S.time += rdt; S.timers.tick(rdt);
        if (play) S.day.advance(rdt, (S.missions && S.missions.timeScale) || 1);
        S.co.tick();
      }
      if (p === 'camera') { const c = S.cameras.current; if (c) c.update(rdt, raw); }
      run(p, cdt, rdt, raw);
    }
  }

  let active = false, errorShown = false;
  function* boot(info) {
    if (info.reason !== 'yield' && !S.ready) {
      S.ui.loading(0);
      while (!S.ready) { S.ui.loading(S.world.progress || 0); yield null; }
      S.ui.loading(null);
    }
    if (info.reason === 'skip') yield S.ui.card('title', { title: 'THE BEAR YIELDS', kanji: '熊', dur: 2 });
    S.mode = 'play';
    if (!info.chapter && info.mission) S.missions.start(info.mission, { step: info.step ?? 0 });
    else S.missions.startChapter(info.chapter, { mission: info.mission, step: info.step, reason: info.reason });
  }
  // a root task that threw: say so and offer RETRY, never hang (B16)
  S.bus.on('coError', ({ task }) => {
    if (!active || errorShown || !/^(root|director):/.test(task.name)) return;
    errorShown = true;
    S.co.start((function* retry() {
      S.mode = 'play'; S.freeze = false;
      yield S.ui.card('error', { title: 'SOMETHING WENT WRONG.', sub: 'Press RETRY to try again.', choices: ['RETRY'] });
      errorShown = false;
      if (task.name === 'director:boot' || !S.missions.chapter) S.missions.startChapter(S.missions.chapter || 'f1', { reason: 'retry' });
      else S.missions.retry();
    })(), 'director:error');
  });

  const api = {
    S, test: S.test,
    get ready() { return S.ready; },
    get active() { return active; },
    get mode() { return S.mode; },
    preload(stage) { S.bus.emit('preload', stage); }, // 'story' | 'transform' | 'yield'
    // The one entry (B4). reason: 'yield' (the fight was won), 'skip' (SKIP TO THE STORY), 'continue'
    // (the save), 'jump' (?chapter= or ?mission=&step=). The cold open keeps the arena; every other start hides it.
    begin(o = {}) {
      const reason = BEGIN_REASONS.includes(o.reason) ? o.reason : 'continue';
      if (active) api.leave();
      active = true; errorShown = false;
      Object.assign(S, { mode: 'boot', freeze: false, modal: null, lockControl: false, timeScale: 1, hitstop: 0, slow: 1, slowT: 0 });
      document.body.classList.add('story');
      if (reason !== 'yield') ctx.setArenaVisible(false);
      const save = reason === 'continue' && S.save.has() ? S.save.get() : null;
      let chapter = o.chapter || null, mission = o.mission || null, step = o.step ?? null;
      if (reason === 'yield') chapter = 'c0';
      else if (reason === 'skip') chapter = 'i0';
      else if (reason === 'continue') { chapter = save ? save.chapter : 'f1'; mission = save && save.mission ? save.mission.id : null; step = save && save.mission ? save.mission.step : null; }
      if (!chapter && mission) chapter = (S.content.MISSIONS[mission] || {}).chapter || null;
      if (!chapter && !mission) chapter = 'c0';
      if (chapter && !CHAPTER_ORDER.includes(chapter)) { console.warn(`[story] unknown chapter '${chapter}', starting at f1`); chapter = 'f1'; }
      const info = { reason, chapter, mission, step, save };
      S.bus.emit('start', info);
      S.co.start(boot(info), 'director:boot');
    },
    tick,
    key: (e, down) => { if (S.input) S.input.key(e, down); },
    pad: (p) => { if (S.input) S.input.pad(p); },
    pauseMenu(on) {
      if (!active || !S.ui || !S.ui.menu) return;
      if (on && S.mode === 'play' && !S.ui.menu.isOpen) S.ui.menu.open();
      else if (!on && S.ui.menu.isOpen) S.ui.menu.close();
    },
    save() { return active && S.save ? S.save.write() : false; }, // on pagehide, hiding and the switch click (B16)
    // stop the story without leaving the page: packages clean up on 'exit'; the arena look comes back
    leave() {
      if (!active) return;
      active = false;
      S.co.cancelAll(); S.timers.clear(); // running missions clean up in their finally blocks first
      S.bus.emit('exit');
      S.interact.clear(); S.film.skip();
      S.look.reset(); S.world.setVisible(false);
      Object.assign(S, { mode: 'boot', freeze: false, modal: null, lockControl: false, timeScale: 1, hitstop: 0, slow: 1, slowT: 0 });
      document.body.classList.remove('story');
    },
    // SAVE & QUIT: write the save, leave, and show the title
    exit() { if (active) { S.save.write(); api.leave(); } ctx.showTitle(); },
  };
  S.api = api;
  S.exit = () => api.exit();

  define(S.test, {
    S,
    get ready() { return S.ready; }, get mode() { return S.mode; }, get active() { return active; },
    get chapter() { return S.missions.chapter; }, get mission() { return S.missions.active; },
    get frame() { return S.frame; }, get time() { return S.time; },
    skip: () => { S.cine.skip(); if (S.ui.advanceAll) S.ui.advanceAll(); S.film.skip(); },
    autopilot: (on) => S.missions.autopilot(on),
    clock: { get: () => S.day.label(), set: (d, t) => S.day.set(d, t) },
    hero: { get pos() { return S.hero.pos; }, get mode() { return S.hero.mode; }, teleport: (x, z) => S.hero.place(x, z) },
    contract: () => checkContract(S),
  });
  return api;
}
