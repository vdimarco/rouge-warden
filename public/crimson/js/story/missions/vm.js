// js/story/missions/vm.js : the mission VM. Chapters and missions run as coroutines on story time (S.co);
// steps are data run by the generators in steps.js.
// - The chain: startChapter(id) runs that chapter, then the next ones in CHAPTER_ORDER (a chapter the
//   content lacks is skipped). A chapter sets its day, clock, look and POV body and puts the hero at its
//   start place, then runs its interlude cine (if any) and its missions. From P2 on, a chapter waits in free
//   roam behind its giver marker until the player walks into it (a jump or the autopilot starts it at once).
//   One root task (ROOT_PREFIX) is alive while the story plays: this chain, or free roam.
// - A mission spawns its cast, vehicles and foes, then runs its steps. A step with cp:true is a checkpoint
//   (and so is the mission's start): a snapshot of the hero, the van (pose, damage, look), the seats, the
//   clock, the flags, the weapons and the canteen. RETRY puts the snapshot back, rebuilds the spawns and
//   runs the step again, in the same tick. Fail rules: MissionDef.fail {vanWrecked, heroDown, leaveArea},
//   the hero going down (always), a step's own timeLimit, and whatever a step asks for (m.fail).
// - Passing a mission applies onPass (unlock, flags), shows MISSION PASSED with its numbers when it had
//   anything to play, and saves. A fail shows MISSION FAILED with the reason, RETRY first, QUIT second.
import { CAST_IDS, CHAPTER_ORDER, COLD_OPEN, CREW_IDS, ROOT_PREFIX } from '../types.js';

export const FAIL = Object.freeze({ fail: true }), PASS = Object.freeze({ pass: true });
// steps that are play (a mission made only of the others is a scene: no MISSION PASSED card)
const PLAY = new Set(['goto', 'drive', 'enter', 'photo', 'tail', 'lose', 'chase', 'race', 'fight', 'defend', 'stealth', 'interact', 'escort', 'collect', 'stakeout']);
const idx = (id) => CHAPTER_ORDER.indexOf(id);
export const gated = (C) => !!C && idx(C.id) > idx('p1') && C.id !== 'e1' && !C.auto && !C.arena && !/^[ic]\d/.test(C.id);

export function createVM(S, K) {
  const M = S.missions;
  let chain = null;

  /* ---------------- the runtime m ---------------- */
  function runtime(def) {
    const spawned = new Map(), fighters = [], temps = [];
    // a vehicle the mission asks the hero to get into (enter, drive, race, a drive escort) gets its doors,
    // even when the spawn does not say enterable (F2's jeeps, the jeep time trials)
    const boards = (ref) => (def.steps || []).some((st) => st && st.vehicle === ref && (st.type === 'enter' || st.type === 'drive' || st.type === 'race' || (st.type === 'escort' && st.drive)));
    const m = {
      S, def, index: 0, dt: 0, result: {}, lastPhoto: null, subsHandle: null,
      get auto() { return M.auto; },
      get hero() { return S.hero; },
      get van() { return S.vehicles.player; },
      rng: S.rng('story'),
      spawn(ref) {
        if (spawned.has(ref)) return spawned.get(ref);
        const sp = (def.spawns || []).find((x) => x.id === ref); if (!sp) return null;
        const at = sp.place ? S.world.place(sp.place) : sp.pos ? { x: sp.pos.x, y: sp.pos.y, z: sp.pos.z, yaw: sp.pos.yaw } : null;
        if (!at) { console.warn(`[missions] spawn '${ref}' of ${def.id} has no place`); }
        const P = at || { x: S.hero.pos.x + 4, y: S.hero.pos.y, z: S.hero.pos.z, yaw: 0 };
        const yaw = sp.yaw ?? P.yaw ?? 0;
        let obj = null;
        try {
          if (sp.kind) {
            const pv = S.vehicles.player;
            if (sp.player && pv && pv.kind === sp.kind && !pv.gone) { obj = pv; pv.setPose(P.x, P.z, yaw, Number.isFinite(P.y) ? P.y + 1 : undefined); pv.damage = Math.min(pv.damage || 0, 60); pv.wrecked = false; if (sp.look && pv.setLook) pv.setLook(sp.look); }
            else {
              if (sp.player && pv && !pv.gone) { if (S.drive.riding === pv) K.forceOut(pv); S.vehicles.despawn(pv); }
              obj = S.vehicles.spawn(sp.kind, { pos: { x: P.x, y: P.y, z: P.z }, yaw, look: sp.look, protect: sp.protect, bumpLimit: sp.bumpLimit, maxSpeed: sp.maxSpeed, maxContact: sp.maxContact, player: sp.player, gang: sp.gang, enterable: sp.enterable ?? boards(ref), tint: sp.tint, lights: sp.lights, siren: sp.siren });
              if (Number.isFinite(P.y) && obj.setPose) obj.setPose(P.x, P.z, yaw, P.y + 1);
            }
            obj.missionRef = ref;
          } else if (sp.foe) {
            obj = S.combat.spawn(sp.foe, { pos: { x: P.x, y: P.y, z: P.z }, yaw, group: sp.group || `m:${def.id}`, alert: sp.alert ?? false, patrol: sp.patrol, weapon: sp.weapon, flashlight: sp.flashlight, variant: sp.variant });
            fighters.push(obj);
          } else if (sp.cast) {
            obj = sp.cast === S.hero.body && S.hero.actor ? S.hero.actor : S.cast.spawn(sp.cast, { pos: { x: P.x, y: P.y, z: P.z }, yaw, props: sp.props, variant: sp.variant, costume: sp.costume });
            // Gabe's neon is per chapter: flashbacks at night keep it (0), the present drains it (1) (B10)
            if (sp.cast === 'gabe') S.cast.drain(obj, (S.content.CHAPTERS[def.chapter || M.chapter] || {}).drain ?? 1);
            if (sp.pose) S.cast.pose(obj, sp.pose, 1);
          }
        } catch (e) { console.error(`[missions] spawn '${ref}' of ${def.id}`, e); obj = null; }
        spawned.set(ref, obj);
        return obj;
      },
      get: (ref) => spawned.get(ref) || null,
      despawn(ref) {
        const o = spawned.get(ref); if (!o) return;
        spawned.delete(ref); drop(o);
      },
      // a cast member for this mission only (escort followers, seats)
      castSpawn(id, o = {}) { const a = S.cast.spawn(id, { pos: o.pos || { x: S.hero.pos.x + 2, y: S.hero.pos.y, z: S.hero.pos.z }, yaw: o.yaw ?? 0 }); temps.push(a); return a; },
      track(f) { if (f && !fighters.includes(f)) fighters.push(f); },
      adopt(a) { if (a && !temps.includes(a)) temps.push(a); },
      // the cine's who map: every spawned actor by its spawn id and by its cast id
      castMap() {
        const out = {};
        for (const sp of def.spawns || []) { const o = spawned.get(sp.id); if (!o) continue; const a = o.a && o.def ? o.a : o; out[sp.id] = a; if (sp.cast && !(sp.cast in out)) out[sp.cast] = a; }
        return out;
      },
      objective: (t) => { m.objText = t; K.setObjective(); },
      objectiveOverride: (t) => { m.override = t; K.setObjective(); },
      // the same marker again: moved (a moving target), else built anew only when its shape changes
      marker: (id, o) => {
        const cur = K.markers3d.get(`m:${id}`), kind = o.kind || 'both';
        if (cur && cur.r === Math.max(1.2, o.r || 4) && !!cur.hidden === !!o.hidden && cur.shape === kind && cur.kind === (o.mapKind || 'objective')) {
          if (Math.abs(cur.x - o.x) > 0.05 || Math.abs(cur.z - o.z) > 0.05) K.markers3d.move(`m:${id}`, o.x, o.z, o.y);
          return;
        }
        const nm = K.markers3d.add(`m:${id}`, { ...o }); if (nm) nm.shape = kind;
      },
      unmark: (id) => K.markers3d.remove(`m:${id}`),
      say: (lines, o) => S.ui.say(lines, o),
      subs: (who, line) => S.ui.subs(who, S.content.line(line)),
      card: (o) => S.ui.card(o.kind || 'title', o),
      cine: (id, o) => S.cine.play(id, { cast: { ...m.castMap(), ...((o && o.cast) || {}) } }),
      wait: (sec) => sec, until: (fn) => fn,
      fail: (r) => M.fail(r),
      flag: (k, v) => (v === undefined ? S.flags[k] : (S.flags[k] = v)),
      evidence: (slot, photo) => S.evidence.set(slot, photo && typeof photo === 'object' ? photo.id : photo),
      look: (n, o) => S.look.set(n, o),
      clock: (d, t) => S.day.set(d, t),
      cp: () => K.checkpoint(def.id, m.index, true),
      // run any step inline from a script: yield* m.run({type: 'fight', waves: [...]})
      *run(step) { const fn = K.STEPS[step.type]; if (!fn) throw new Error(`m.run: unknown step type '${step.type}'`); yield* fn(m, step); },
      // a timer for this step: fails with reason at 0 (stops while a modal freezes play)
      // skip: at 0 the step ends and the mission goes on (STEP_COMMON fail: 'skip')
      timer(sec, reason, skip = false) { m.timerLeft = sec; m.timerReason = reason || 'Out of time.'; m.timerSkip = !!skip; S.ui.timer(sec); },
      clearTimer() { m.timerLeft = null; m.timerSkip = false; S.ui.timer(null); },
      timerLeft: null, timerReason: '', objText: null, override: null,
      // the crew's van (a player:true spawn) stays for free roam and a retry; everything else goes
      cleanup() {
        for (const [ref, o] of [...spawned]) { if (o && o.kind && (def.spawns || []).find((x) => x.id === ref && x.player && x.keep !== false)) continue; drop(o); }
        spawned.clear();
        const groups = new Set([`m:${def.id}`]); for (const f of fighters) if (f && f.group) groups.add(f.group);
        for (const g of groups) { try { S.combat.clear(g); } catch (e) { /* stub */ } }
        fighters.length = 0;
        for (const a of temps) { S.cast.followers.remove(a); if (S.drive.unseat) S.drive.unseat(a); S.cast.despawn(a); }
        temps.length = 0;
      },
    };
    function drop(o) {
      if (!o) return;
      try {
        if (o.kind && o.pos && o.seats) { if (S.drive.riding === o) K.forceOut(o); S.vehicles.despawn(o); }
        else if (o.def && o.a) { const g = o.group; if (g) S.combat.clear(g); }
        else if (o !== S.hero.actor) { S.cast.followers.remove(o); if (S.drive.unseat) S.drive.unseat(o); S.cast.despawn(o); }
      } catch (e) { console.warn('[missions] despawn', e); }
    }
    return m;
  }

  /* ---------------- a guarded step: stops at the next wait once a pass or fail is asked for ---------------- */
  function* guarded(m, g) {
    let r = null, last = S.timers.now;
    m.dt = 0;
    try {
      r = g.next();
      while (!r.done) {
        let v, err = null;
        K.waiting = r.value;
        try { v = yield r.value; } catch (e) { err = e; }
        K.waiting = null;
        const now = S.timers.now; m.dt = Math.max(0, now - last); last = now;
        if (K.failReq) return FAIL;
        if (K.passReq) { K.passReq = false; return PASS; }
        if (K.skipReq) { K.skipReq = false; return null; } // an optional step ran out of time: on to the next
        r = err ? g.throw(err) : g.next(v);
      }
      if (K.failReq) return FAIL; // asked for while the step ran to its end in one go
      return r.value;
    } finally { if (r && !r.done) { try { g.return(); } catch (e) { console.warn('[missions] step cleanup', e); } } K.waiting = null; }
  }

  /* ---------------- one mission ---------------- */
  // o: {step, snap (a checkpoint to put back after the spawns)}. Returns PASS or FAIL.
  function* runMission(id, o = {}) {
    const def = K.lookup(id);
    if (!def) { console.warn(`[missions] no mission '${id}'`); return PASS; }
    const m = runtime(def);
    const step0 = Math.max(0, Math.min((def.steps || []).length - 1, o.step || 0));
    M.active = { id, step: step0, type: null, state: 'run' };
    K.last = { chapter: M.chapter, mission: id, step: step0 };
    K.current = m;
    K.failReq = null; K.passReq = false; K.skipReq = false;
    const t0 = S.time, stats0 = K.combatStats(), photos0 = K.photo.list().length;
    S.bus.emit('mission', { id, state: 'start' });
    K.log('mission', id, 'start', step0);
    try {
      for (const sp of def.spawns || []) m.spawn(sp.id);
      if (o.snap) S.save.restore(o.snap);
      // the start is a checkpoint too (RETRY before any cp step goes back here)
      if (!(K.cp && K.cp.mission === id && K.cp.chapter === M.chapter && K.cp.step <= step0)) K.checkpoint(id, step0, false, m);
      for (let i = step0; i < def.steps.length; i++) {
        const s = def.steps[i];
        m.index = i; m.objText = null; m.override = null; m.clearTimer(); K.skipReq = false;
        Object.assign(M.active, { step: i, type: s.type }); K.last.step = i;
        if (s.when && !cond(s.when)) continue;
        if (s.cp && i !== step0) K.checkpoint(id, i, true, m);
        else if (s.cp && i === step0 && !o.snap) K.checkpoint(id, i, true, m);
        m.objective(s.objective || null);
        if (s.timeLimit) m.timer(s.timeLimit, typeof s.fail === 'string' && s.fail !== 'skip' ? s.fail : 'Out of time.', s.fail === 'skip');
        S.bus.emit('step', { mission: id, index: i, type: s.type });
        K.log('step', id, i, s.type);
        const fn = K.STEPS[s.type];
        if (!fn) { console.warn(`[missions] unknown step type '${s.type}'`); continue; }
        const r = yield* guarded(m, fn(m, s));
        if (r === FAIL) { M.active.state = 'fail'; K.log('fail', id, i, K.failReq); S.bus.emit('fail', { id, reason: K.failReq }); return FAIL; }
        if (r === PASS) break; // M.pass(): the rest of the mission is skipped
      }
      M.active.state = 'pass';
      if (K.cp && K.cp.mission === id) K.cp = null; // the checkpoint ends with its mission
      K.doneSet.add(id);
      if (def.onPass) {
        if (def.onPass.flags) for (const [k, v] of Object.entries(def.onPass.flags)) if (k !== '__proto__') S.flags[k] = v;
        for (const u of def.onPass.unlock || []) K.unlock(u);
      }
      S.bus.emit('mission', { id, state: 'pass' });
      K.log('mission', id, 'pass');
      m.cleanup(false);
      K.current = null; S.ui.objective(null); K.markers3d.clear(); m.clearTimer();
      if (showsPass(def)) {
        const st = K.combatStats(), ev = S.evidence.count ?? 0;
        const time = S.time - t0, mm = Math.floor(time / 60), ss = Math.floor(time % 60);
        const stats = [{ label: 'TIME', value: `${mm}:${String(ss).padStart(2, '0')}` }, { label: 'PHOTOS', value: K.photo.list().length - photos0 },
          { label: 'TAKEDOWNS', value: st.takedowns - stats0.takedowns }, { label: 'DEFLECTS', value: st.deflects - stats0.deflects }, { label: 'EVIDENCE', value: `${ev}/3` }];
        if (m.result.smooth != null) stats.push({ label: 'SMOOTH', value: m.result.smooth });
        const h = S.ui.card('pass', { title: 'MISSION PASSED', kanji: '完', sub: def.title ? String(def.title).toUpperCase() : '', stats });
        while (!h.done) { if (M.auto) S.ui.advanceAll(); yield null; }
      }
      if (!K.lookupSide(id) && !COLD_OPEN.includes(M.chapter)) S.save.write();
      return PASS;
    } finally {
      m.clearTimer();
      if (M.active && M.active.state !== 'pass') m.cleanup(true);
      S.ui.objective(null); K.markers3d.clear();
      K.density.traffic = null; K.density.crowd = null;
      if (S.photo.active && K.photo.st.propped) K.photo.close();
      if (M.active && M.active.id === id) M.active = null;
      if (K.current === m) K.current = null;
      M.timeScale = 1;
    }
  }
  const showsPass = (def) => def.passCard === true || (def.passCard !== false && !/^[ic]\d/.test(def.chapter || M.chapter || '') && (def.steps || []).some((s) => PLAY.has(s.type)));
  // a step's when: a flag name ('!name' for not) or a function
  function cond(w) {
    if (typeof w === 'function') { try { return !!w(S); } catch (e) { return true; } }
    if (typeof w === 'string') return w.startsWith('!') ? !S.flags[w.slice(1)] : !!S.flags[w];
    return true;
  }

  // MISSION FAILED: RETRY runs the mission again from its checkpoint, QUIT goes to free roam
  function* failCard(id) {
    K.failing = true;
    const reason = K.failReq || 'The mission failed.';
    let h;
    try {
      h = S.ui.card('fail', { title: 'MISSION FAILED', kanji: '失', sub: reason, choices: ['RETRY', 'QUIT'] });
      while (!h.done) { if (M.auto) S.ui.advanceAll(); yield null; }
    } finally { K.failing = false; K.failReq = null; }
    if (h.choice === 1) return { quit: true };
    return { retry: retryPoint(id) };
  }
  // where RETRY goes for a mission of this chapter: its checkpoint, else its first step
  function retryPoint(id) {
    const c = K.cp && K.cp.mission === id && K.cp.chapter === M.chapter ? K.cp : null;
    K.retryT = performance.now();
    return { mission: id, step: c ? c.step : 0, snap: c ? c.snap : null, resume: !!c };
  }

  /* ---------------- chapters ---------------- */
  function* ensureWorld() {
    if (!S.ready) { S.ui.loading(0); while (!S.ready) { S.ui.loading(K.loadProgress()); yield null; } S.ui.loading(null); }
    if (!S.world.visible) { S.ctx.setArenaVisible(false); S.world.setVisible(true); S.bus.emit('swap', { to: 'story' }); }
  }
  function* runChapter(C, o = {}) {
    M.chapter = C.id; K.chapterNext = null; S.bus.emit('chapter', { id: C.id });
    K.log('chapter', C.id, o.reason || '');
    // the chapter's bodies start loading now (the missions' cast and the foes' gang body), well before a
    // cine or a step spawns them
    const want = new Set();
    for (const mid of C.missions || []) { const d = S.content.MISSIONS[mid] || {}; for (const c of d.cast || []) want.add(c); for (const sp of d.spawns || []) want.add(sp.cast || (sp.foe && (CAST_IDS.includes(sp.foe) ? sp.foe : 'gang'))); }
    const bodies = [...want].filter((c) => CAST_IDS.includes(c) && !S.cast.ready(c));
    if (bodies.length) S.cast.preload(bodies);
    if (!C.arena) yield* ensureWorld();
    const resuming = !!o.snap || !!o.resume;
    // CONTINUE into the middle of a mission: the save holds that mission's checkpoint (clock, hero, van)
    const fromSave = o.reason === 'continue' && K.bootSave && !o.retried ? K.bootSave : null;
    const saveMission = !!(fromSave && fromSave.mission && o.mission && fromSave.mission.id === o.mission);
    if (saveMission) S.day.set(fromSave.day, fromSave.time);
    else if (C.when && !resuming) S.day.set(C.when.day, C.when.time);
    if (C.look) S.look.set(C.look, { dur: 0 });
    if (!C.arena && S.hero) {
      const pov = C.pov === 'pick' || C.pov == null ? S.ctx.crewPick : C.pov;
      S.hero.setBody(CREW_IDS[pov] || CREW_IDS[S.ctx.crewPick] || 'shades');
      if (!resuming && !saveMission && C.start) { const p = S.world.place(C.start); if (p) S.hero.place(p.x, p.z, p.yaw, p.y + 1); }
      if (S.hero.mode !== 'foot' && !S.drive.riding) S.hero.setMode('foot');
    }
    if (!COLD_OPEN.includes(C.id)) S.save.write(); // CONTINUE resumes here, never in the cold open
    const list = C.missions || [];
    // the interlude or intro cine plays first, unless we come back into the middle of the chapter
    // (content plays an interlude's cine as its mission's step: then the chapter does not play it again)
    const inMission = (id) => list.some((mid) => ((S.content.MISSIONS[mid] || {}).steps || []).some((s) => s && s.type === 'cine' && s.id === id));
    if (C.cine && !o.mission && !resuming && !inMission(C.cine)) yield S.cine.play(C.cine);
    let at = o.mission ? list.indexOf(o.mission) : 0;
    if (at < 0) at = 0;
    for (let i = at; i < list.length; i++) {
      const first = i === at;
      K.chapterNext = list[i + 1] || null; // a save after this mission passes resumes at the next one
      const snap = first ? o.snap || (saveMission && fromSave.mission.id === list[i] ? K.saveSnap(fromSave) : null) : null;
      const r = yield* runMission(list[i], { step: first ? (saveMission ? fromSave.mission.step : o.step || 0) : 0, snap });
      if (r === FAIL) return yield* failCard(list[i]);
    }
    return null;
  }
  const nextOf = (id) => { const i = idx(id); return i >= 0 && i + 1 < CHAPTER_ORDER.length ? CHAPTER_ORDER[i + 1] : null; };
  function* runChain(id, o) {
    const end = CHAPTER_ORDER[CHAPTER_ORDER.length - 1];
    let cur = id, first = true;
    if (K.doneSet.has(end) && (cur === end || !cur)) { M.chapter = end; yield* K.roam.forever({ fromSave: o.reason === 'continue' }); return; } // the story is over
    while (cur) {
      const C = S.content.CHAPTERS[cur];
      if (C) {
        let opts = first ? o : {};
        // from P2 on, the chapter waits behind its giver in free roam (a jump or a retry starts it at once)
        if (gated(C) && !opts.mission && !opts.snap && opts.reason !== 'jump' && opts.reason !== 'retry') {
          M.chapter = C.id;
          yield* ensureWorld();
          if (first && o.reason === 'continue' && K.bootSave && !K.bootSave.hero.lost) { S.day.set(K.bootSave.day, K.bootSave.time); S.hero.place(K.bootSave.hero.x, K.bootSave.hero.z, K.bootSave.hero.yaw); }
          S.save.write();
          yield* K.roam.untilGiver(C);
          opts = { ...opts, reason: 'giver' };
        }
        for (;;) {
          const r = yield* runChapter(C, opts);
          if (r && r.retry) { opts = { ...r.retry, reason: 'retry', retried: true }; continue; } // RETRY: the same chapter from the checkpoint
          if (r && r.quit) { yield* K.roam.forever({ resume: C.id }); return; }
          break;
        }
        K.doneSet.add(cur); S.bus.emit('pass', { id: cur });
        K.log('chapter', cur, 'pass');
        first = false;
      }
      cur = nextOf(cur);
      if (cur) M.chapter = cur;
    }
    M.chapter = end;
    S.save.write();
    yield* K.roam.forever({});
  }

  /* ---------------- the public verbs ---------------- */
  function startChapter(id, o = {}) {
    S.timers.cancelTag('missions:switch');
    if (chain) chain.cancel();
    K.failReq = null; K.passReq = false; K.skipReq = false; K.failing = false; K.roaming = false;
    K.cp = null; // a checkpoint belongs to one run of one mission (retry read it before coming here)
    chain = S.co.start(runChain(id || 'f1', o), `${ROOT_PREFIX}chapter`);
    return chain;
  }
  function startMission(id, o = {}) {
    const def = K.lookup(id);
    if (!def) { console.warn(`[missions] start: no mission '${id}'`); return null; }
    const C = def.chapter && S.content.CHAPTERS[def.chapter];
    if (C && (C.missions || []).includes(id)) return startChapter(def.chapter, { mission: id, step: o.step || 0, reason: o.reason || 'jump' });
    // a mission of no chapter (side content, QA): run it from free roam, then roam on
    S.timers.cancelTag('missions:switch');
    if (chain) chain.cancel();
    K.failReq = null; K.passReq = false; K.skipReq = false; K.failing = false;
    if (!M.chapter) M.chapter = def.chapter || 'p1';
    chain = S.co.start(K.roam.forever({ side: id, step: o.step || 0, snap: o.snap || null }), `${ROOT_PREFIX}roam`);
    return chain;
  }
  const inItsChapter = (id) => { const d = K.lookup(id), C = d && d.chapter && S.content.CHAPTERS[d.chapter]; return !!C && (C.missions || []).includes(id); };
  // RETRY never does nothing (B16), even after the root task died and cleared M.active
  function retry() {
    if (K.roaming && !M.active) { quit(); return; }
    const ch = M.chapter || (K.last && K.last.chapter) || 'f1';
    const id = M.active ? M.active.id : K.last && K.last.chapter === ch ? K.last.mission : null;
    if (id && !inItsChapter(id) && K.lookup(id)) { // side content and chapterless missions restart on their own
      const c = K.cp && K.cp.mission === id ? K.cp : null, keep = K.cp;
      startMission(id, { step: c ? c.step : 0, snap: c ? c.snap : null });
      if (c) K.cp = keep;
      return;
    }
    const p = id ? retryPoint(id) : null;
    const keepCp = K.cp;
    startChapter(ch, p ? { mission: p.mission, step: p.step, snap: p.snap, resume: p.resume, reason: 'retry' } : { reason: 'retry' });
    if (p && p.snap) K.cp = keepCp;
  }
  function quit() {
    if (chain) chain.cancel();
    M.active = null; K.chapterNext = null;
    chain = S.co.start(K.roam.forever({ resume: M.chapter && !COLD_OPEN.includes(M.chapter) && !K.doneSet.has(M.chapter) ? M.chapter : null }), `${ROOT_PREFIX}roam`);
  }
  function stop() { if (chain) chain.cancel(); chain = null; }
  return { runMission, runChapter, runChain, startChapter, startMission, retry, quit, stop, runtime, guarded, failCard, get chain() { return chain; }, set chain(c) { chain = c; } };
}
