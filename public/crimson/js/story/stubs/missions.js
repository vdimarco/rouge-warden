// Stub MISSIONS (frozen; the missions package replaces missions/missions.js, not this file).
// A small VM on S.co: chapters chain in CHAPTER_ORDER (skipping ones the content lacks), missions run
// their steps in order. cine, talk, card, goto, drive, enter, exit, wait, set, script and choice work;
// every other step type passes after 1 s. Cines show as a 1.5 s card. The save has the SaveV1 shape.
// It also owns S.ready (B2) and the 3D markers (B6). One root task is alive while the story plays: the
// chapter chain ('root:chapter') or free roam ('root:roam').
import { CHAPTER_ORDER, COLD_OPEN, CORE_CAST, CREW_IDS, EVIDENCE, SAVE_KEY, SAVE_SCHEMA, PHASE_ORDER, ROOT_PREFIX, blankSaveV1, checkType } from '../types.js';
import { toHour } from '../../core/clock.js';
import { seedValue } from '../../core/rng.js';
import { createMarkers3D } from './markers3d.js';

const FAIL = { fail: true }, PASS = { pass: true };

export function init(S) {
  // cp: the checkpoint {chapter, mission, step, snap}; last: the mission that ran last {chapter, mission, step}
  let chain = null, preload = null, failReq = null, passReq = false, failing = false, cp = null, last = null, roaming = false, cineCard = null, lastSave = null;
  const doneSet = new Set();
  const M = S.missions = {
    chapter: null, timeScale: 1, active: null, auto: false, cairns: [],
    startChapter, start: (id, o = {}) => startChapter(chapterOf(id), { mission: id, step: o.step || 0 }),
    pass() { if (M.active) passReq = true; },
    fail(reason = 'The mission failed.') { if (M.active && !failing) failReq = reason; },
    // RETRY never does nothing (B16), even after the root task died and cleared M.active: the current or last
    // mission of this chapter from its checkpoint, else from its first step; with no mission, the chapter; in
    // free roam, free roam.
    retry() {
      if (roaming) { M.quit(); return; }
      const ch = M.chapter || (last && last.chapter) || 'f1';
      const id = M.active ? M.active.id : last && last.chapter === ch ? last.mission : null;
      const c = id && cp && cp.chapter === ch && cp.mission === id ? cp : null;
      if (c && c.snap) Save.restore(c.snap);
      startChapter(ch, id ? { mission: id, step: c ? c.step : 0, resume: !!c, reason: 'retry' } : { reason: 'retry' });
    },
    quit() { if (chain) chain.cancel(); M.active = null; chain = S.co.start(freeRoam(), `${ROOT_PREFIX}roam`); },
    done: (id) => doneSet.has(id),
    available: () => [],
    markers: () => S.markers3d.list,
    travel() {},
    wait(hhmm) { S.day.set(null, hhmm); },
    autopilot(on) { M.auto = !!on; },
  };
  S.markers3d = createMarkers3D(S);
  const chapterOf = (missionId) => (S.content.MISSIONS[missionId] || {}).chapter || M.chapter || 'f1';

  // S.ready: the world is built and the core cast is loaded (B2)
  const ensurePreload = () => { if (!preload) preload = S.cast.preload(CORE_CAST); };
  S.bus.on('preload', ensurePreload);
  S.register('script', () => { if (!S.ready && preload && preload.done && S.world.ready) S.ready = true; }, PHASE_ORDER.script.ready);

  /* ---------------- the save ---------------- */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || s.v !== 1 || typeof s.chapter !== 'string') return null;
      const b = blankSaveV1();
      for (const [k, t] of Object.entries(SAVE_SCHEMA)) if (!checkType(s[k], t)) s[k] = b[k]; // repair field by field
      if (!CHAPTER_ORDER.includes(s.chapter) || COLD_OPEN.includes(s.chapter)) s.chapter = 'f1';
      return s;
    } catch (e) { return null; }
  }
  function snapshot() {
    const s = { ...blankSaveV1(), ...(load() || {}) };
    const C = S.content.CHAPTERS[M.chapter] || null;
    s.seed = seedValue(); s.pick = S.ctx.crewPick;
    s.chapter = M.chapter && !COLD_OPEN.includes(M.chapter) ? M.chapter : 'f1';
    s.mission = M.active && !COLD_OPEN.includes(M.chapter) ? { id: M.active.id, step: M.active.step } : null;
    s.done = [...doneSet]; s.flags = { ...S.flags }; s.evidence = { ...S.evidence.slots };
    s.day = S.day.day; s.time = S.day.hour;
    if (S.hero) s.hero = { x: S.hero.pos.x, z: S.hero.pos.z, yaw: S.hero.face, mode: S.hero.mode === 'drive' || S.hero.mode === 'passenger' ? S.hero.mode : 'foot' };
    const v = S.vehicles.player;
    s.van = v ? { kind: v.kind, x: v.pos.x, z: v.pos.z, yaw: v.yaw, dmg: v.damage, look: { ...v.look } } : null;
    if (S.hero) { s.hp = S.hero.hp; s.canteen = S.hero.canteen; s.canteenMax = S.hero.canteenMax; s.weapon = S.hero.weapon; }
    s.assist = !!S.game.assist;
    const sc = C && !COLD_OPEN.includes(C.id) ? C : S.content.CHAPTERS.f1;
    s.summary = sc ? { chapter: sc.n, title: sc.title } : { chapter: 3, title: 'Ten Seats' };
    s.updated = Date.now();
    return s;
  }
  const Save = S.save = {
    get: () => load() || blankSaveV1(),
    has: () => !!load(),
    // nothing to write until a chapter runs: the boot's loading never replaces the save CONTINUE is loading
    write() {
      if (!M.chapter) return false;
      const s = snapshot();
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); lastSave = s; S.bus.emit('save', s); return true; } catch (e) { return false; }
    },
    clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage blocked */ } },
    summary: () => Save.get().summary,
    checkpoint: () => ({ hero: S.hero ? { x: S.hero.pos.x, z: S.hero.pos.z, yaw: S.hero.face } : null, flags: { ...S.flags }, day: S.day.day, hour: S.day.hour }),
    restore(c) { if (!c) return; if (c.hero && S.hero) S.hero.place(c.hero.x, c.hero.z, c.hero.yaw); Object.assign(S.flags, c.flags || {}); S.day.set(c.day, c.hour); },
  };

  /* ---------------- chapters and missions ---------------- */
  function startChapter(id, o = {}) {
    if (chain) chain.cancel();
    failReq = null; passReq = false; failing = false; roaming = false;
    cp = null; // a checkpoint belongs to one run of one mission (retry read it before coming here)
    chain = S.co.start(runChain(id, o), `${ROOT_PREFIX}chapter`);
  }
  const nextOf = (id) => { const i = CHAPTER_ORDER.indexOf(id); return i >= 0 && i + 1 < CHAPTER_ORDER.length ? CHAPTER_ORDER[i + 1] : null; };
  function* runChain(id, o) {
    const end = CHAPTER_ORDER[CHAPTER_ORDER.length - 1];
    let cur = id, first = true;
    if (doneSet.has(end) && cur === end) { M.chapter = end; yield* freeRoam(); return; } // the story is over
    while (cur) {
      const C = S.content.CHAPTERS[cur];
      if (C) {
        let opts = first ? o : {};
        for (;;) {
          const r = yield* runChapter(C, opts);
          if (r && r.retry) { opts = r.retry; continue; } // RETRY: run the chapter again from the checkpoint
          if (r && r.quit) { yield* freeRoam(); return; }
          break;
        }
        doneSet.add(cur); S.bus.emit('pass', { id: cur });
        first = false;
      }
      cur = nextOf(cur);
    }
    Save.write();
    yield* freeRoam();
  }
  // after the story, or after QUIT: walk and drive anywhere. The task stays alive (a root task) while the
  // player roams.
  function* freeRoam() {
    roaming = true;
    if (!S.ready) { S.ui.loading(0); while (!S.ready) { S.ui.loading(S.world.progress || 0); yield null; } S.ui.loading(null); }
    if (!S.world.visible) {
      S.ctx.setArenaVisible(false); S.world.setVisible(true); S.bus.emit('swap', { to: 'story' });
      S.look.set('DAY');
      const p = S.world.place('aframe'); if (S.hero && p) { S.hero.setBody(CREW_IDS[S.ctx.crewPick] || 'shades'); S.hero.place(p.x, p.z, p.yaw); }
    }
    S.mode = 'play'; M.active = null;
    S.ui.objective('Free roam. Press Esc for the menu.');
    for (;;) yield 3600;
  }
  function* runChapter(C, o) {
    M.chapter = C.id; S.bus.emit('chapter', { id: C.id });
    if (!C.arena) {
      if (!S.ready) { S.ui.loading(0); while (!S.ready) { S.ui.loading(S.world.progress || 0); yield null; } S.ui.loading(null); }
      if (!S.world.visible) { S.ctx.setArenaVisible(false); S.world.setVisible(true); S.bus.emit('swap', { to: 'story' }); }
    }
    if (C.when && !o.resume) S.day.set(C.when.day, C.when.time);
    if (C.look) S.look.set(C.look);
    if (!C.arena && S.hero) {
      const pov = C.pov === 'pick' || C.pov == null ? S.ctx.crewPick : C.pov;
      S.hero.setBody(CREW_IDS[pov] || CREW_IDS[S.ctx.crewPick]);
      const p = !o.resume && C.start ? S.world.place(C.start) : null;
      if (p) S.hero.place(p.x, p.z, p.yaw);
    }
    if (!COLD_OPEN.includes(C.id)) Save.write(); // CONTINUE resumes here, never in the cold open
    const list = C.missions || [];
    const at = o.mission ? Math.max(0, list.indexOf(o.mission)) : 0;
    for (let i = at; i < list.length; i++) {
      const r = yield* runMission(list[i], i === at ? o.step || 0 : 0);
      if (r === FAIL) return yield* failCard(list[i]);
    }
    return null;
  }
  // MISSION FAILED: RETRY runs the mission again from its last checkpoint, QUIT goes to free roam
  function* failCard(id) {
    failing = true;
    const reason = failReq || 'The mission failed.'; failReq = null;
    const h = S.ui.card('fail', { title: 'MISSION FAILED', kanji: '失', sub: reason, choices: ['RETRY', 'QUIT'] });
    yield h;
    failing = false;
    if (h.choice === 1) return { quit: true };
    const c = cp && cp.mission === id && cp.chapter === M.chapter ? cp : { mission: id, step: 0 };
    if (c.snap) Save.restore(c.snap);
    return { retry: { mission: c.mission, step: c.step, resume: !!c.snap } };
  }
  // run one step, checking between every wait for a pass or fail request
  function* guarded(g) {
    let r = g.next();
    try {
      while (!r.done) {
        let v, err = null;
        try { v = yield r.value; } catch (e) { err = e; }
        if (failReq) return FAIL;
        if (passReq) { passReq = false; return PASS; }
        r = err ? g.throw(err) : g.next(v);
      }
      return r.value;
    } finally { if (!r.done) try { g.return(); } catch (e) { /* the step was running */ } }
  }
  function* runMission(id, step0) {
    const def = S.content.MISSIONS[id];
    if (!def) return PASS;
    const m = runtime(def);
    M.active = { id, step: step0, type: null, state: 'run' };
    last = { chapter: M.chapter, mission: id, step: step0 };
    S.bus.emit('mission', { id, state: 'start' });
    try {
      for (const sp of def.spawns || []) m.spawn(sp.id);
      for (let i = step0; i < def.steps.length; i++) {
        const s = def.steps[i];
        Object.assign(M.active, { step: i, type: s.type }); last.step = i;
        if (s.cp) cp = { chapter: M.chapter, mission: id, step: i, snap: Save.checkpoint() };
        if (s.objective) S.ui.objective(s.objective);
        S.bus.emit('step', { mission: id, index: i, type: s.type });
        const r = yield* guarded((STEPS[s.type] || autoPass)(m, s));
        if (r === FAIL) { M.active.state = 'fail'; S.bus.emit('fail', { id, reason: failReq }); return FAIL; }
      }
      M.active.state = 'pass';
      if (cp && cp.mission === id) cp = null; // the checkpoint ends with its mission
      S.bus.emit('mission', { id, state: 'pass' });
      if (def.onPass) { Object.assign(S.flags, def.onPass.flags || {}); if (def.onPass.save) Save.write(); }
      return PASS;
    } finally {
      m.cleanup(); S.ui.objective(null); S.markers3d.clear();
      if (M.active && M.active.id === id) M.active = null;
    }
  }
  function runtime(def) {
    const spawned = new Map();
    const m = {
      S, def,
      spawn(ref) {
        if (spawned.has(ref)) return spawned.get(ref);
        const sp = (def.spawns || []).find((x) => x.id === ref); if (!sp) return null;
        const at = sp.place ? S.world.place(sp.place) : sp.pos;
        let obj = null;
        if (sp.kind) obj = S.vehicles.spawn(sp.kind, { pos: at, yaw: sp.yaw ?? (at && at.yaw), look: sp.look, protect: sp.protect, bumpLimit: sp.bumpLimit, maxSpeed: sp.maxSpeed, player: sp.player });
        else if (sp.foe) obj = S.combat.spawn(sp.foe, foeOpts(sp, at));
        else if (sp.cast) {
          obj = S.cast.spawn(sp.cast, { pos: at, yaw: sp.yaw ?? (at && at.yaw) });
          // Gabe's neon is per chapter: flashbacks at night keep it (0), the present drains it (1) (B10)
          if (sp.cast === 'gabe') S.cast.drain(obj, (S.content.CHAPTERS[def.chapter] || {}).drain ?? 1);
        }
        spawned.set(ref, obj); return obj;
      },
      get: (ref) => spawned.get(ref) || null,
      objective: (t) => S.ui.objective(t), marker: (id, o) => S.markers3d.add(id, o), unmark: (id) => S.markers3d.remove(id),
      say: (lines, o) => S.ui.say(lines, o), subs: (who, line) => S.ui.subs(who, S.content.line(line)),
      card: (o) => S.ui.card(o.kind || 'title', o), cine: (id) => S.cine.play(id), wait: (sec) => sec, until: (fn) => fn,
      fail: (r) => M.fail(r), flag: (k, v) => (v === undefined ? S.flags[k] : (S.flags[k] = v)),
      evidence: (slot, photo) => S.evidence.set(slot, photo && photo.id), look: (n) => S.look.set(n), clock: (d, t) => S.day.set(d, t),
      hero: S.hero, get van() { return S.vehicles.player; }, cp: () => { cp = { chapter: M.chapter, mission: def.id, step: M.active ? M.active.step : 0, snap: Save.checkpoint() }; },
      cleanup() {
        for (const [, o] of spawned) {
          if (!o) continue;
          if (o.kind && o.obj) S.vehicles.despawn(o);
          else if (o.def && o.a) S.combat.clear(o.group);
          else S.cast.despawn(o);
        }
        spawned.clear();
      },
    };
    return m;
  }
  // every FoeOpts field of a spawn or wave entry goes on to S.combat.spawn (a legend needs its variant, E9)
  const foeOpts = (f, at) => ({ pos: at, yaw: f.yaw ?? (at && at.yaw), group: f.group, alert: f.alert, patrol: f.patrol, weapon: f.weapon, flashlight: f.flashlight, variant: f.variant });
  const pt = (to) => (typeof to === 'string' ? S.world.place(to) : { x: to.x, y: 0, z: to.z, r: 8 });
  const vehicleOf = (m, ref) => (ref && ref !== 'player' ? m.get(ref) || m.spawn(ref) : S.vehicles.player);
  const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) <= r;
  // the steps this stub runs for real; every other type passes after 1 s (at once on autopilot)
  const STEPS = {
    *cine(m, s) { yield S.cine.play(s.id); },
    *talk(m, s) { const h = S.ui.say([].concat(s.lines), { block: s.block }); while (!h.done) { if (M.auto) S.ui.advanceAll(); yield null; } },
    *card(m, s) { const h = S.ui.card(s.kind || 'title', s); while (!h.done) { if (M.auto) S.ui.advanceAll(); yield null; } },
    *goto(m, s) {
      const p = pt(s.to), r = s.r || p.r || 4;
      S.markers3d.add('goal', { x: p.x, z: p.z, r });
      while (!near(S.hero.pos, p, r)) { if (M.auto) S.hero.place(p.x, p.z); yield null; }
      S.markers3d.remove('goal');
    },
    *drive(m, s) {
      const p = pt(s.to), r = s.r || p.r || 10, v = vehicleOf(m, s.vehicle);
      S.markers3d.add('goal', { x: p.x, z: p.z, r });
      while (!(v && near(v.pos, p, r))) {
        if (M.auto && v) { if (!S.drive.riding) S.drive.enter(v, 0); v.setPose(p.x, p.z, v.yaw); v.speed = 0; }
        yield null;
      }
      S.markers3d.remove('goal');
    },
    *enter(m, s) {
      const v = vehicleOf(m, s.vehicle);
      if (v) S.markers3d.add('van', { x: v.pos.x, z: v.pos.z, r: 3, kind: 'ring' });
      while (!(v && S.drive.riding === v)) { if (M.auto && v) S.drive.enter(v, s.seat || 0); yield null; }
      S.markers3d.remove('van');
    },
    *exit() { while (S.drive.riding) { if (M.auto) { S.drive.riding.speed = 0; S.drive.exit(); } yield null; } },
    *wait(m, s) {
      if (s.until) { M.timeScale = s.lapse || 60; const want = toHour(s.until); while (Math.abs(S.day.hour - want) > 0.05) { if (M.auto) S.day.set(null, want); yield null; } M.timeScale = 1; }
      else yield M.auto ? 0 : s.sec ?? 1;
    },
    *set(m, s) {
      if (s.flags) Object.assign(S.flags, s.flags);
      if (s.clock) S.day.set(s.clock.day, s.clock.time);
      if (s.look) S.look.set(s.look);
      if (s.evidence) for (const [k, v] of Object.entries(s.evidence)) S.evidence.set(k, v);
      if (s.weapon) S.combat.setWeapon(s.weapon);
      if (s.save) Save.write();
    },
    *script(m, s) { const fn = S.content.SCRIPTS[s.fn]; if (fn) yield* fn(m, s); },
    *choice(m, s) {
      const h = S.ui.choose(s.title, s.options.map((o) => (typeof o === 'string' ? o : o.label)));
      while (!h.done) { if (M.auto) S.ui.advanceAll(); yield null; }
      const pick = s.options[h.index || 0];
      if (pick && typeof pick === 'object' && pick.set) yield* STEPS.set(m, pick.set);
    },
  };
  function* autoPass() { yield M.auto ? 0 : 1; }

  // fail rules from the mission definition
  S.register('script', () => {
    if (!M.active || failing || failReq) return;
    const def = S.content.MISSIONS[M.active.id], f = def && def.fail;
    if (!f) return;
    if (f.vanWrecked && S.vehicles.player && S.vehicles.player.wrecked) M.fail('The van is wrecked.');
    else if (f.heroDown && S.hero && S.hero.down) M.fail('The crew pulls you out.');
  }, PHASE_ORDER.script.missions);

  /* ---------------- cines, photos, evidence (stubs) ---------------- */
  S.cine = {
    active: false,
    play(id) {
      const def = S.content.CINES[id] || { id, dur: 1.5 };
      const c = (def.cards && def.cards[0]) || { kind: 'title', title: String(id).toUpperCase() };
      S.cine.active = true; document.body.classList.add('cine');
      const h = cineCard = S.ui.card(c.kind || 'title', { title: c.title, sub: c.sub, kanji: c.kanji, dur: 1.5 });
      return S.co.start((function* cine() {
        try { yield h; if (def.end && def.end.look) S.look.set(def.end.look); } finally { S.cine.active = false; cineCard = null; document.body.classList.remove('cine'); }
      })(), `cine:${id}`);
    },
    skip() { if (cineCard) S.ui.advanceAll(); },
  };
  const gallery = [];
  S.photo = {
    active: false, gallery,
    open() { S.photo.active = true; if (S.hero) S.hero.setMode('photo'); },
    close() { S.photo.active = false; if (S.hero && S.hero.mode === 'photo') S.hero.setMode('foot'); },
    shoot() { return null; }, best: () => null, thumb: () => '', reference: () => null,
  };
  const slots = { face: null, place: null, date: null, link: null };
  S.evidence = { slots, set(slot, id) { if (EVIDENCE.includes(slot)) slots[slot] = id ?? null; }, get: (slot) => slots[slot] ?? null };

  // a new session: restore from the save when continuing, else start clean
  S.bus.on('start', (info) => {
    ensurePreload();
    doneSet.clear(); cp = null; last = null; roaming = false; M.timeScale = 1; M.active = null; M.chapter = null;
    for (const k of Object.keys(S.flags)) delete S.flags[k];
    for (const k of EVIDENCE) slots[k] = null;
    const s = info.save;
    if (s) { for (const d of s.done) doneSet.add(d); Object.assign(S.flags, s.flags); for (const k of EVIDENCE) slots[k] = s.evidence[k] ?? null; }
  });
  S.bus.on('exit', () => { if (chain) chain.cancel(); chain = null; M.active = null; M.timeScale = 1; S.markers3d.clear(); failReq = null; passReq = false; failing = false; roaming = false; });

  S.test.missions = {
    goto: (id, step = 0) => M.start(id, { step }), resolve: () => M.pass(), pass: () => M.pass(), fail: (r) => M.fail(r),
    get list() { return Object.keys(S.content.MISSIONS); }, get done() { return [...doneSet]; },
  };
  S.test.photo = { aim() { return false; }, shoot: () => S.photo.shoot() };
  S.test.save = { get: () => Save.get(), write: () => Save.write(), clear: () => Save.clear(), load(o) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) { /* storage blocked */ } }, get last() { return lastSave; } };
}
