// js/story/missions/missions.js : the MISSIONS package. init(S) fills S.missions, S.cine, S.photo,
// S.evidence, S.save and S.markers3d, sets S.ready (B2), and adds S.test.missions, S.test.photo and
// S.test.save. The parts:
// - vm.js: chapters and missions as coroutines, checkpoints, RETRY, pass and fail cards
// - steps.js: every step type, each with its autopilot
// - cine.js: the cut-scene player; photo.js: the phone camera; evidence.js: the four slots and Gabe's wall
// - save.js: the save, its repair, checkpoints; freeroam.js: free roam and the side content
// - markers3d.js: the crimson ground ring and pillar
// Everything runs on story time (S.timers, S.co, handles with done flags). One root task is alive while the
// story plays (the chapter chain or free roam). init starts no timers or tasks: a session starts on 'start'.
import { CHAPTER_ORDER, COLD_OPEN, CORE_CAST, CREW_IDS, EVIDENCE, PHASE_ORDER, SAVE_KEY, WEAPON_IDS } from '../types.js';
import { createMarkers3D } from './markers3d.js';
import { createPhoto } from './photo.js';
import { createEvidence } from './evidence.js';
import { createSave, repairSave } from './save.js';
import { createCine } from './cine.js';
import { createSteps } from './steps.js';
import { createVM } from './vm.js';
import { createRoam } from './freeroam.js';

export function init(S) {
  let preload = null;
  const K = {
    S, side: {}, doneSet: new Set(), unlocked: new Set(), cp: null, last: null, failReq: null, passReq: false, failing: false,
    roaming: false, roamReq: null, current: null, waiting: null, bootSave: null, lastSave: null, retryT: 0, trials: {},
    density: { traffic: null, crowd: null }, stats: { deaths: 0, photos: 0, km: 0, playTime: 0 }, base: null, combat0: null,
    events: [], t0: 0,
    // a short log of what happened (QA compares two runs of the same mission with it)
    log(kind, ...a) { K.events.push([S.frame - K.t0, kind, ...a.map((x) => (x == null ? null : typeof x === 'object' ? JSON.stringify(x) : x))]); if (K.events.length > 4000) K.events.splice(0, 1000); },
    lookup: (id) => (S.content && S.content.MISSIONS && S.content.MISSIONS[id]) || K.lookupSide(id),
    lookupSide: (id) => { if (!id) return null; if (!K.side.built && /^(legend|trial|hunt)_/.test(id) && K.roam && S.world && S.world.ready) K.roam.buildSide(); const d = K.side[id]; return d && d.id ? d : null; },
    unlock(id) { if (!id) return; K.unlocked.add(id); S.flags[`unlock:${id}`] = true; },
    pickBody: () => CREW_IDS[S.ctx.crewPick] || 'shades',
    loadProgress: () => ((S.world && S.world.progress) || 0) * 0.8 + (preload ? preload.progress || 0 : 0) * 0.2,
    combatStats: () => { const s = (S.combat && S.combat.stats) || {}; return { deflects: s.deflects || 0, takedowns: s.takedowns || 0 }; },
    statsNow() {
      const b = K.base || {}, c = K.combatStats(), c0 = K.combat0 || { deflects: 0, takedowns: 0 };
      return { deaths: (b.deaths || 0) + K.stats.deaths, deflects: (b.deflects || 0) + Math.max(0, c.deflects - c0.deflects), takedowns: (b.takedowns || 0) + Math.max(0, c.takedowns - c0.takedowns),
        photos: (b.photos || 0) + K.stats.photos, km: Math.round(((b.km || 0) + K.stats.km) * 100) / 100, playTime: Math.round((b.playTime || 0) + K.stats.playTime) };
    },
    photoCount: () => ((K.base && K.base.photos) || 0) + K.stats.photos,
    bumpPhotoCount: () => { K.stats.photos++; },
    // the photos the story needs: the evidence slots, and every flag that holds a photo id (the F5 photo)
    neededPhotos(save) {
      const out = new Set(), g = new Set(S.photo.gallery.map((p) => p.id));
      const slots = save ? save.evidence : S.evidence.slots, flags = save ? save.flags : S.flags;
      for (const k of EVIDENCE) if (slots[k]) out.add(slots[k]);
      for (const v of Object.values(flags)) if (typeof v === 'string' && g.has(v)) out.add(v);
      return out;
    },
    evidenceDirty: () => { if (K.evidence) K.evidence.markDirty(); },
    photoLocked: () => (S.cine && S.cine.active) || S.mode !== 'play' || S.lockControl,
    // the hero out of a vehicle, even with no room at the doors
    forceOut(v) {
      const D = S.drive; if (!D || !D.riding) return;
      if (v) v.speed = 0;
      if (D.exit() && !D.riding) return;
      const r = D.riding, i = r.seats.indexOf('hero'); if (i >= 0) r.seats[i] = null;
      D.riding = null; if ('heroSeat' in D) D.heroSeat = -1; if ('anim' in D) D.anim = null;
      S.hero.setMode('foot');
      S.hero.place(r.pos.x + Math.cos(r.yaw) * 3, r.pos.z - Math.sin(r.yaw) * 3, r.yaw);
      if (S.hero.actor) { S.hero.actor.visible = true; S.cast.pose(S.hero.actor, 'sitDrive', 0); }
    },
    checkpoint(id, step, explicit, m) {
      K.cp = { chapter: M.chapter, mission: id, step, snap: S.save.checkpoint() };
      K.log('cp', id, step);
      if (explicit && !COLD_OPEN.includes(M.chapter) && !K.lookupSide(id)) S.save.write(); // autosave at a checkpoint
      void m;
    },
    resumePoint: () => (M.active && K.cp && K.cp.mission === M.active.id ? K.cp : null),
    // a SaveV1 as a checkpoint snapshot (CONTINUE into a mission)
    saveSnap: (s) => ({ day: s.day, hour: s.time, flags: { ...s.flags }, evidence: { ...s.evidence }, hero: { ...s.hero }, van: s.van ? { ...s.van } : null, hp: s.hp, canteen: s.canteen, canteenMax: s.canteenMax, weapon: s.weapon, weapons: s.weapons.slice(), uses: {} }),
    kazooString: () => (K.roam ? K.roam.kazooString() : '0'.repeat(51)),
    setObjective() { const m = K.current; if (!m) return; const t = m.override != null ? m.override : m.objText; S.ui.objective(t || null); },
    adopt: (a) => { if (K.current) K.current.adopt(a); },
  };

  /* ---------------- S.missions ---------------- */
  const M = S.missions = {
    chapter: null, timeScale: 1, active: null, auto: false, cairns: [],
    startChapter: (id, o = {}) => vm.startChapter(id, o),
    start: (id, o = {}) => vm.startMission(id, o),
    pass() { if (M.active) K.passReq = true; },
    fail(reason = 'The mission failed.') { if (M.active && !K.failing && !K.failReq) K.failReq = String(reason); },
    retry: () => vm.retry(),
    quit: () => vm.quit(),
    done: (id) => K.doneSet.has(id),
    available: () => (K.roam ? K.roam.available() : []),
    markers: () => [...K.markers3d.list.filter((m) => !m.hidden && m.hud), ...(K.roam ? K.roam.markers() : [])],
    travel: (cid) => (K.roam ? K.roam.travel(cid) : false),
    wait: (hhmm) => (K.roam ? K.roam.wait(hhmm) : false),
    // extra (not in the contract): a mission's title, side content included (the menu's log can use it)
    title: (id) => { const d = K.lookup(id); return (d && d.title) || id; },
    autopilot(on) { M.auto = !!on; if (M.auto && S.ui && S.ui.advanceAll && (K.failing || S.modal === 'card')) S.ui.advanceAll(); },
  };

  Object.defineProperty(K, 'auto', { get: () => M.auto });

  /* ---------------- the parts ---------------- */
  K.markers3d = S.markers3d = createMarkers3D(S);
  const photo = K.photo = createPhoto(S, K);
  const evidence = K.evidence = createEvidence(S, K);
  const saveMod = createSave(S, K);
  const cine = K.cine = createCine(S, K);
  const steps = K.steps = createSteps(S, K);
  K.STEPS = steps.STEPS;
  const vm = K.vm = createVM(S, K);
  const roam = K.roam = createRoam(S, K);

  // S.ready: the world is built and the core cast is loaded (B2)
  const ensurePreload = () => { if (!preload) preload = S.cast.preload(CORE_CAST); };
  S.bus.on('preload', ensurePreload);
  S.register('script', () => { if (!S.ready && preload && preload.done && S.world.ready) S.ready = true; }, PHASE_ORDER.script.ready);

  /* ---------------- fail rules, step timers, the wake-up ---------------- */
  S.register('script', (cdt, rdt) => {
    if (!S.api || !S.api.active) return;
    if (S.mode === 'play') {
      K.stats.playTime += rdt;
      const v = S.drive && S.drive.riding;
      if (v && v === S.vehicles.player) { const s = Math.abs(v.speed || 0) * rdt; if (s < 5) K.stats.km += s / 1000; }
    }
    const m = K.current;
    if (M.active && m && !K.failing && !K.failReq) {
      const def = m.def, f = def.fail || {};
      const pv = S.vehicles.player;
      if (S.hero && S.hero.down && !M.auto) M.fail('The crew pulls you out.');
      else if (f.vanWrecked && pv && pv.wrecked) M.fail('The van is wrecked.');
      else if (f.leaveArea) {
        const p = S.world.place(f.leaveArea.place), H = S.hero;
        if (p && H && Math.hypot(H.pos.x - p.x, H.pos.z - p.z) > (f.leaveArea.r || 200)) M.fail(f.leaveArea.reason || 'You left the area.');
      }
      if (m.timerLeft != null && !S.freeze && S.mode === 'play') {
        m.timerLeft -= rdt;
        S.ui.timer(Math.max(0, m.timerLeft));
        if (m.timerLeft <= 0) { m.timerLeft = null; S.ui.timer(null); if (!M.auto) M.fail(m.timerReason); }
      }
    }
    // a pass or fail was asked for: wake the chain from whatever it waits on, so the step ends this tick
    if ((K.failReq && !K.failing) || K.passReq) {
      const ch = vm.chain;
      if (ch && !ch.done && ch.wait != null) {
        const w = ch.wait;
        if (w && typeof w === 'object' && typeof w.cancel === 'function' && !w.done && w.name && w.name.startsWith('cine:')) w.cancel();
        ch.wait = null;
      }
    }
  }, PHASE_ORDER.script.missions);
  S.register('world', (cdt, rdt) => { if (!S.api || !S.api.active) return; K.markers3d.update(rdt); evidence.update(); });
  if (S.combat && S.combat.on) S.combat.on('heroDown', () => { if (M.active) K.stats.deaths++; });

  /* ---------------- the reference picture of a photo match ---------------- */
  let refEl = null;
  K.showReference = (place) => {
    if (!place) { if (refEl) refEl.remove(); refEl = null; return; }
    const r = photo.P.reference(place); if (!r) return;
    const root = document.getElementById('story') || document.body;
    if (!refEl) {
      refEl = document.createElement('figure'); refEl.id = 'sRef';
      Object.assign(refEl.style, { position: 'absolute', right: 'calc(12px + env(safe-area-inset-right, 0px))', top: '96px', width: '176px', margin: '0', padding: '6px 6px 4px', background: '#f2ede2', boxShadow: '0 6px 18px rgba(0,0,0,0.45)', transform: 'rotate(2deg)', zIndex: '5', pointerEvents: 'none', fontFamily: 'Georgia, serif' });
      root.appendChild(refEl);
    }
    refEl.innerHTML = `${r.thumb ? `<img alt="" src="${r.thumb}" style="display:block;width:164px;height:92px;object-fit:cover;background:#222">` : '<div style="width:164px;height:92px;background:#3a3430"></div>'}<figcaption style="font-size:12px;color:#2a2420;text-align:center;margin-top:3px">THE OLD PHOTO</figcaption>`;
  };
  // frame a subject for the autopilot: the camera goes where the subject fills about a quarter of the view
  K.aimAt = (id) => {
    const s = photo.subjects.get(id); if (!s) return false;
    photo.open({ force: true });
    const info = s.group ? null : photo.info(s);
    const c = info || (() => { const a = s.group[0]; return a ? { x: a.root.position.x, y: a.root.position.y, z: a.root.position.z, h: 1.8, yaw: a.root.rotation.y } : null; })();
    if (!c) return false;
    const h = Math.max(1, c.h || 2);
    let best = null;
    for (const zoom of [2, 1]) {
      const d = Math.min(160, Math.max(4, h / (0.25 * 2 * Math.tan(((52 / 2) * Math.PI / 180)) * zoom)));
      for (let k = 0; k < 8; k++) {
        const yaw = (s.kind === 'face' ? c.yaw : Math.atan2(S.hero.pos.x - c.x, S.hero.pos.z - c.z)) + k * Math.PI / 4;
        const x = c.x + Math.sin(yaw) * d, z = c.z + Math.cos(yaw) * d;
        const gy = S.world.surface(x, z, c.y + h + 40);
        const y = Math.max(gy + 1.6, c.y + h * 0.55);
        const look = Math.atan2(c.x - x, c.z - z), pitch = Math.atan2(c.y + h * 0.5 - y, d);
        photo.pose({ x, y, z, yaw: look, pitch, zoom });
        const r = photo.scoreOf(s);
        if (!best || r.score > best.score) best = { x, y, z, yaw: look, pitch, zoom, score: r.score };
        if (r.score >= 90) break;
      }
      if (best && best.score >= 90) break;
    }
    photo.pose(best);
    return best ? best.score : 0;
  };

  /* ---------------- the session ---------------- */
  S.bus.on('start', (info) => {
    ensurePreload();
    vm.stop();
    K.doneSet.clear(); K.unlocked.clear(); K.cp = null; K.last = null; K.failReq = null; K.passReq = false; K.failing = false; K.roaming = false; K.roamReq = null; K.current = null;
    K.trials = {}; K.density.traffic = K.density.crowd = null; K.density.lastT = K.density.lastC = undefined;
    K.stats = { deaths: 0, photos: 0, km: 0, playTime: 0 }; K.events.length = 0; K.t0 = S.frame;
    M.timeScale = 1; M.active = null; M.chapter = null; M.cairns.length = 0;
    for (const k of Object.keys(S.flags)) delete S.flags[k];
    const s = info && info.save ? info.save : null;
    K.bootSave = s;
    K.base = s ? { ...s.stats } : null;
    K.combat0 = K.combatStats();
    if (s) {
      for (const d of s.done) K.doneSet.add(d);
      for (const [k, v] of Object.entries(s.flags)) { S.flags[k] = v; if (k.startsWith('unlock:') && v) K.unlocked.add(k.slice(7)); }
      for (const c of s.cairns) M.cairns.push(c);
      Object.assign(K.trials, s.trials);
      if (s.abilities && s.abilities.bearCall) S.flags.bearCall = true;
      try { for (const id of s.revealed) S.world.reveal(id); } catch (e) { /* stub */ }
      // the hero's gear, after COMBAT's own reset on 'start'
      const H = S.hero;
      if (H) {
        H.canteenMax = Math.max(s.canteenMax, 5 + Math.floor((s.kazoos.split('1').length - 1) / 17));
        H.canteen = Math.min(H.canteenMax, s.canteen);
        H.weapons = ['fists']; for (const w of s.weapons) if (WEAPON_IDS.includes(w) && !H.weapons.includes(w)) H.weapons.push(w);
        if (s.weapon !== 'fists' && H.weapons.includes(s.weapon)) { try { S.combat.setWeapon(s.weapon); } catch (e) { /* stub */ } }
      }
    }
    evidence.reset(s);
    photo.reset(s);
    roam.reset(s);
    if (refEl) { refEl.remove(); refEl = null; }
  });
  S.bus.on('exit', () => {
    vm.stop(); cine.stop();
    if (photo.active) photo.close();
    K.markers3d.clear(); roam.exit();
    M.active = null; M.timeScale = 1; K.current = null; K.failReq = null; K.passReq = false; K.failing = false; K.roaming = false; K.roamReq = null;
    if (refEl) { refEl.remove(); refEl = null; }
  });

  /* ---------------- QA ---------------- */
  S.test.missions = {
    goto: (id, step = 0) => M.start(id, { step }),
    resolve: () => M.pass(), pass: () => M.pass(), fail: (r) => M.fail(r),
    get list() { return Object.keys((S.content && S.content.MISSIONS) || {}); },
    get done() { return [...K.doneSet]; }, get log() { return K.events.slice(); }, get cp() { return K.cp ? { chapter: K.cp.chapter, mission: K.cp.mission, step: K.cp.step } : null; },
    get failing() { return K.failing; }, get roaming() { return K.roaming; }, get retryT() { return K.retryT; },
    side: () => { roam.buildSide(); return Object.keys(K.side).filter((k) => k !== 'built'); },
    available: () => M.available(), kazoos: () => roam.kazooCount(), collect: (i) => roam.collect(i), K,
  };
  S.test.photo = {
    aim: (id) => { const sid = photo.subjects.has(id) ? id : photo.subjects.has(`ms:${id}`) ? `ms:${id}` : id; return K.aimAt(sid); },
    shoot: () => photo.shoot({ force: true }),
    pose: (p) => photo.pose(p), score: (id) => photo.P.scoreOf(id), subject: (id, spec) => photo.subject(id, spec),
    open: (o) => photo.open({ force: true, ...(o || {}) }), close: () => photo.close(),
    get gallery() { return photo.gallery; }, get db() { return photo.st.db; }, thumb: (id) => photo.thumbs.get(id) || '', small: (id) => photo.smalls.get(id) || '',
    get state() { const st = photo.st; return { active: st.active, zoom: st.zoom, score: st.score, note: st.note, countdown: st.countdown }; },
    reference: (place) => photo.P.reference(place), capture: (place) => photo.captureReference(place),
  };
  S.test.save = {
    get: () => S.save.get(), write: () => S.save.write(), clear: () => S.save.clear(),
    load(o) { try { localStorage.setItem(SAVE_KEY, typeof o === 'string' ? o : JSON.stringify(o)); } catch (e) { /* storage blocked */ } },
    repair: (o) => repairSave(o, saveMod.known()), get last() { return K.lastSave; },
  };
  S.test.evidence = { paint: () => evidence.paint(), get canvas() { return evidence.canvas; } };
  void CHAPTER_ORDER;
}
