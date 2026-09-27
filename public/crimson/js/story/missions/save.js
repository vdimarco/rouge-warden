// js/story/missions/save.js : the story save, 'crimson.story.v1' (types.js SaveV1). MISSIONS owns reading,
// repair and writing.
// - repairSave(raw, known) rebuilds a save field by field from whatever is stored: a corrupted, truncated,
//   older, newer or hostile save always comes back as a playable SaveV1. Positions clamp inside the world.
//   Ids this build does not know (chapters, missions) go to save.quarantine instead of being dropped, so a
//   later build can migrate them. Text that reaches the title (the summary) is rebuilt from the content.
// - createSave(S, K) is S.save: get, has, write, clear, summary, checkpoint, restore. write() writes nothing
//   and returns false until a chapter runs (the boot's loading never replaces the save CONTINUE loads).
//   While a mission runs, the save holds its checkpoint (the hero, the van, the clock and the flags as they
//   were there), so CONTINUE resumes at that checkpoint, as RETRY would.
import { CHAPTER_ORDER, COLD_OPEN, CREW_IDS, CAST_IDS, EVIDENCE, SAVE_KEY, VEHICLE_KINDS, VAN_LOOKS, WEAPON_IDS, HERO_MODES, blankSaveV1 } from '../types.js';
import { DAYS } from '../../core/clock.js';
import { WORLD, CAIRNS } from '../world/places.js';
import { seedValue } from '../../core/rng.js';

const LIMIT = WORLD.HALF - 4; // stay a few meters inside the world's edge
export const ID_RE = /^[A-Za-z0-9_:.-]{1,64}$/;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi, def) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def);
const int = (v, lo, hi, def) => Math.round(num(v, lo, hi, def));
const str = (v, max = 64) => (typeof v === 'string' && v.length <= max ? v : null);
const idOk = (v) => typeof v === 'string' && ID_RE.test(v);
const clampPos = (v) => num(v, -LIMIT, LIMIT, 0);
// a value small and plain enough to keep in the quarantine
const plain = (v) => { try { const j = JSON.stringify(v); return j !== undefined && j.length <= 2000 ? JSON.parse(j) : null; } catch (e) { return null; } };
export const THUMB_RE = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/;
export const THUMB_MAX = 24000; // a small evidence copy is about 3-6 KB

// What a truncated or garbled save still says: the chapter, the pick and the finished ids, read from the text.
function salvage(text) {
  const out = {};
  if (typeof text !== 'string') return out;
  const m1 = /"chapter"\s*:\s*"([a-z0-9]{1,8})"/.exec(text); if (m1) out.chapter = m1[1];
  const m2 = /"pick"\s*:\s*(\d)/.exec(text); if (m2) out.pick = +m2[1];
  const m3 = /"done"\s*:\s*\[([^\]]*)/.exec(text);
  if (m3) out.done = [...m3[1].matchAll(/"([A-Za-z0-9_:.-]{1,64})"/g)].map((x) => x[1]);
  const m4 = /"kazoos"\s*:\s*"([01]{1,51})/.exec(text); if (m4) out.kazoos = m4[1];
  return out;
}

// known: { chapters:Set, missions:Set, titles:{chapterId:{n,title}} }. Returns a fresh SaveV1 (never shares
// objects with raw) and the list of what was repaired.
export function repairSave(raw, known = {}) {
  const notes = [];
  let s = raw;
  if (typeof s === 'string') {
    try { s = JSON.parse(s); } catch (e) { notes.push('not JSON: salvaged what could be read'); s = salvage(raw); }
  }
  if (!isObj(s)) { notes.push('not an object'); s = {}; }
  const b = blankSaveV1(), out = blankSaveV1();
  const Q = [];
  const quarantine = (field, value) => { const v = plain(value); if (v !== null && Q.length < 100) Q.push({ field, value: v }); };
  // keep what an earlier repair already set aside
  if (Array.isArray(s.quarantine)) for (const q of s.quarantine.slice(0, 100)) { const v = plain(q); if (v !== null) Q.push(v); }
  if (s.v !== 1) { notes.push(`version ${String(s.v).slice(0, 12)}`); if (s.v !== undefined) quarantine('v', s.v); }
  const chapters = known.chapters || new Set(CHAPTER_ORDER), missions = known.missions || null;
  const knownId = (id) => chapters.has(id) || CHAPTER_ORDER.includes(id) || (missions ? missions.has(id) : true);

  out.seed = int(s.seed, 0, 0xffffffff, 0);
  out.pick = Number.isInteger(s.pick) && s.pick >= 0 && s.pick < CREW_IDS.length ? s.pick : b.pick;
  // the chapter CONTINUE resumes: known and never the cold open
  if (typeof s.chapter === 'string' && CHAPTER_ORDER.includes(s.chapter) && !COLD_OPEN.includes(s.chapter)) out.chapter = s.chapter;
  else { if (s.chapter != null && !COLD_OPEN.includes(s.chapter)) { quarantine('chapter', s.chapter); notes.push('unknown chapter'); } out.chapter = 'f1'; }
  // the mission in progress: a known id and a step inside it
  out.mission = null;
  if (isObj(s.mission) && idOk(s.mission.id)) {
    const id = s.mission.id, steps = known.steps ? known.steps(id) : Infinity;
    if (missions && !missions.has(id)) { quarantine('mission', s.mission); notes.push('unknown mission'); }
    else out.mission = { id, step: int(s.mission.step, 0, Math.max(0, steps - 1), 0) };
  }
  out.done = [];
  const seen = new Set();
  for (const id of Array.isArray(s.done) ? s.done.slice(0, 600) : []) {
    if (!idOk(id) || seen.has(id)) continue;
    seen.add(id);
    if (knownId(id)) out.done.push(id); else quarantine('done', id);
  }
  out.flags = {};
  if (isObj(s.flags)) {
    let n = 0;
    for (const k of Object.keys(s.flags)) {
      if (n >= 300 || BAD_KEYS.has(k) || k.length > 64) continue;
      const v = s.flags[k];
      if (typeof v === 'boolean' || v === null || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 200)) { out.flags[k] = v; n++; }
    }
  }
  out.evidence = { face: null, place: null, date: null, link: null };
  if (isObj(s.evidence)) for (const k of EVIDENCE) out.evidence[k] = idOk(s.evidence[k]) ? s.evidence[k] : null;
  out.day = DAYS.includes(s.day) ? s.day : b.day;
  out.time = typeof s.time === 'number' && Number.isFinite(s.time) ? ((s.time % 24) + 24) % 24 : b.time;
  const h = isObj(s.hero) ? s.hero : {};
  out.hero = { x: clampPos(h.x), z: clampPos(h.z), yaw: num(h.yaw, -1e3, 1e3, 0), mode: HERO_MODES.includes(h.mode) && h.mode !== 'photo' ? h.mode : 'foot' };
  if (!(Number.isFinite(h.x) && Number.isFinite(h.z))) out.hero.lost = true; // resume at the chapter's start instead
  if (Number.isFinite(h.y)) out.hero.y = num(h.y, -400, 400, 0);
  out.van = null;
  if (isObj(s.van) && VEHICLE_KINDS.includes(s.van.kind)) {
    const v = s.van, look = {};
    if (isObj(v.look)) for (const k of VAN_LOOKS) if (v.look[k] === true) look[k] = true;
    out.van = { kind: v.kind, x: clampPos(v.x), z: clampPos(v.z), yaw: num(v.yaw, -1e3, 1e3, 0), dmg: num(v.dmg, 0, 95, 0), look };
    if (!(Number.isFinite(v.x) && Number.isFinite(v.z))) out.van.lost = true;
  }
  out.seats = (Array.isArray(s.seats) ? s.seats : []).slice(0, 10).map((x) => (CAST_IDS.includes(x) ? x : null));
  out.canteenMax = int(s.canteenMax, 5, 8, 5);
  out.canteen = int(s.canteen, 0, out.canteenMax, out.canteenMax);
  out.hp = num(s.hp, 1, 500, 100); // never down on load
  out.weapons = ['fists'];
  for (const w of Array.isArray(s.weapons) ? s.weapons : []) if (WEAPON_IDS.includes(w) && !out.weapons.includes(w)) out.weapons.push(w);
  out.weapon = out.weapons.includes(s.weapon) ? s.weapon : 'fists';
  out.abilities = { bearCall: !!(isObj(s.abilities) && s.abilities.bearCall === true) };
  if (typeof s.kazoos === 'string' && /^[01]{51}$/.test(s.kazoos)) out.kazoos = s.kazoos;
  else { const k = typeof s.kazoos === 'string' ? s.kazoos.replace(/[^01]/g, '').slice(0, 51) : ''; out.kazoos = k.padEnd(51, '0'); if (s.kazoos != null) notes.push('kazoos repaired'); }
  out.cairns = [...new Set((Array.isArray(s.cairns) ? s.cairns : []).filter((c) => typeof c === 'string' && c in CAIRNS))];
  out.revealed = [...new Set((Array.isArray(s.revealed) ? s.revealed : []).filter(idOk))].slice(0, 300);
  out.trials = {};
  if (isObj(s.trials)) for (const k of Object.keys(s.trials).slice(0, 50)) if (idOk(k) && !BAD_KEYS.has(k) && typeof s.trials[k] === 'number' && s.trials[k] > 0 && s.trials[k] < 1e5) out.trials[k] = s.trials[k];
  out.photos = [];
  for (const p of Array.isArray(s.photos) ? s.photos.slice(-60) : []) {
    if (!isObj(p) || !idOk(p.id) || out.photos.some((x) => x.id === p.id)) continue;
    out.photos.push({ id: p.id, subject: str(p.subject) || 'scene', kind: str(p.kind, 16) || 'scene', score: num(p.score, 0, 100, 0), mission: idOk(p.mission) ? p.mission : null, t: num(p.t, 0, 1e9, 0),
      ...(typeof p.label === 'string' && p.label.length <= 40 ? { label: p.label } : {}), ...(p.match === true ? { match: true } : {}) });
  }
  out.thumbs = {};
  if (isObj(s.thumbs)) {
    let n = 0;
    for (const k of Object.keys(s.thumbs)) {
      if (n >= 12 || !idOk(k) || BAD_KEYS.has(k)) continue;
      const u = s.thumbs[k];
      if (typeof u === 'string' && u.length <= THUMB_MAX && THUMB_RE.test(u)) { out.thumbs[k] = u; n++; }
    }
  }
  const st = isObj(s.stats) ? s.stats : {};
  out.stats = {};
  for (const k of Object.keys(b.stats)) out.stats[k] = num(st[k], 0, 1e9, 0);
  out.assist = s.assist === true;
  out.quarantine = Q;
  // the title shows this: rebuilt from the content, never trusted from the file
  const T = known.titles && known.titles[out.chapter];
  if (T && Number.isFinite(T.n) && typeof T.title === 'string') out.summary = { chapter: T.n, title: T.title.slice(0, 40) };
  else {
    const sm = isObj(s.summary) ? s.summary : {};
    const n = int(sm.chapter, 1, 99, CHAPTER_ORDER.indexOf(out.chapter) >= 0 ? b.summary.chapter : 3);
    const title = typeof sm.title === 'string' ? sm.title.replace(/[^A-Za-z0-9 '.,!?-]/g, '').slice(0, 40) : '';
    out.summary = { chapter: n, title: title || b.summary.title };
  }
  out.updated = num(s.updated, 0, 1e15, 0);
  out.v = 1;
  return { save: out, notes };
}

export function createSave(S, K) {
  let cache = null, cacheText = null;
  const known = () => {
    const C = (S.content && S.content.CHAPTERS) || {}, titles = {};
    for (const [id, c] of Object.entries(C)) if (c && Number.isFinite(c.n)) titles[id] = { n: c.n, title: String(c.title || '') };
    const missions = new Set([...Object.keys((S.content && S.content.MISSIONS) || {}), ...Object.keys(K.side || {})]);
    return { chapters: new Set(Object.keys(C)), missions, titles, steps: (id) => { const d = K.lookup(id); return d && Array.isArray(d.steps) ? d.steps.length : Infinity; } };
  };
  function raw() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } }
  // the stored save, repaired (null when nothing is stored)
  function load() {
    const text = raw();
    if (text == null || text === '') return null;
    if (text === cacheText && cache) return cache;
    const { save, notes } = repairSave(text, known());
    if (notes.length) K.log('save', 'repaired', notes.join('; '));
    cache = save; cacheText = text;
    return save;
  }
  const copy = (o) => JSON.parse(JSON.stringify(o));

  // the state to keep: a mission in progress keeps its checkpoint's state, so CONTINUE resumes there
  function snapshot() {
    const prev = load() || blankSaveV1(), s = blankSaveV1();
    const M = S.missions, ch = M.chapter;
    s.seed = seedValue() >>> 0; s.pick = Number.isInteger(S.ctx.crewPick) ? S.ctx.crewPick : 2;
    s.chapter = ch && !COLD_OPEN.includes(ch) && CHAPTER_ORDER.includes(ch) ? ch : prev.chapter || 'f1';
    const cp = K.resumePoint();
    s.mission = cp && cp.chapter === ch && !COLD_OPEN.includes(ch) && !K.lookupSide(cp.mission) ? { id: cp.mission, step: cp.step } : null;
    // between two missions of a chapter (a mission just passed): CONTINUE starts the next one
    const C0 = S.content && S.content.CHAPTERS && S.content.CHAPTERS[ch];
    if (!s.mission && !cp && K.chapterNext && M.active && M.active.state === 'pass' && C0 && (C0.missions || []).includes(M.active.id) && !COLD_OPEN.includes(ch)) s.mission = { id: K.chapterNext, step: 0 };
    const snap = cp && s.mission ? cp.snap : live();
    s.done = [...K.doneSet];
    s.flags = {};
    for (const [k, v] of Object.entries(snap.flags || S.flags)) if (!BAD_KEYS.has(k) && (typeof v !== 'object' || v === null)) s.flags[k] = v;
    s.evidence = { ...(snap.evidence || S.evidence.slots) };
    s.day = snap.day; s.time = snap.hour;
    if (snap.hero) s.hero = { x: snap.hero.x, z: snap.hero.z, yaw: snap.hero.yaw, mode: snap.hero.mode === 'drive' || snap.hero.mode === 'passenger' ? snap.hero.mode : 'foot', ...(Number.isFinite(snap.hero.y) ? { y: snap.hero.y } : {}) };
    s.van = snap.van ? { kind: snap.van.kind, x: snap.van.x, z: snap.van.z, yaw: snap.van.yaw, dmg: Math.min(95, snap.van.dmg || 0), look: { ...snap.van.look } } : null;
    s.seats = (snap.seats || []).map((x) => (typeof x === 'string' && CAST_IDS.includes(x) ? x : null));
    s.hp = Math.max(1, snap.hp || 100); s.canteen = snap.canteen ?? 5; s.canteenMax = snap.canteenMax ?? 5;
    s.weapons = (snap.weapons || ['fists']).slice(); s.weapon = snap.weapon || 'fists';
    s.abilities = { bearCall: !!S.flags.bearCall || !!(S.combat && S.combat.bearCall && S.combat.bearCall.unlocked) };
    s.kazoos = K.kazooString();
    s.cairns = [...M.cairns];
    s.revealed = S.world && S.world.revealed ? [...S.world.revealed].filter(idOk).slice(0, 300) : prev.revealed;
    s.trials = { ...K.trials };
    s.photos = K.photo.list().map((p) => ({ id: p.id, subject: p.subject, kind: p.kind, score: Math.round(p.score), mission: p.mission || null, t: Math.round(p.t * 100) / 100, ...(p.label ? { label: p.label } : {}), ...(p.match ? { match: true } : {}) }));
    // D7: small copies of the photos the story needs (the evidence slots, the F5 photo on Gabe's wall)
    s.thumbs = {};
    for (const id of K.neededPhotos(s)) { const u = K.photo.small(id) || prev.thumbs[id]; if (u && u.length <= THUMB_MAX) s.thumbs[id] = u; }
    s.stats = K.statsNow();
    s.assist = !!S.game.assist;
    s.quarantine = (prev.quarantine || []).slice(0, 100);
    const C = (S.content && S.content.CHAPTERS && S.content.CHAPTERS[s.chapter]) || null;
    s.summary = C ? { chapter: C.n, title: C.title } : prev.summary || { chapter: 3, title: 'Ten Seats' };
    s.updated = Date.now();
    return s;
  }
  // the live state, in the checkpoint's shape
  function live() { return checkpoint(); }

  function checkpoint() {
    const H = S.hero, v = S.vehicles && S.vehicles.player, D = S.drive;
    const c = { t: S.time, day: S.day.day, hour: S.day.hour, flags: { ...S.flags }, evidence: { ...S.evidence.slots } };
    if (H) {
      c.hero = { x: H.pos.x, y: H.pos.y, z: H.pos.z, yaw: H.face, mode: H.mode === 'photo' ? K.photo.prevMode() : H.mode, seat: D && D.riding ? D.heroSeat ?? 0 : -1 };
      c.hp = H.hp > 0 ? H.hp : H.maxHp; c.canteen = H.canteen; c.canteenMax = H.canteenMax; c.weapon = H.weapon; c.weapons = (H.weapons || ['fists']).slice(); c.uses = { ...(H.uses || {}) };
    }
    if (v) c.van = { kind: v.kind, x: v.pos.x, y: v.pos.y, z: v.pos.z, yaw: v.yaw, dmg: v.wrecked ? 60 : v.damage || 0, look: { ...(v.look || {}) } };
    c.seats = v ? v.seats.map((x) => (x === 'hero' ? null : x && x.id && CAST_IDS.includes(x.id) ? x.id : null)) : [];
    return c;
  }
  // back to a checkpoint: the clock, the flags, the hero and the van as they were (the mission rebuilds
  // its own spawns first, so the van is there to put back)
  function restore(c) {
    if (!c) return;
    if (c.day || c.hour != null) S.day.set(c.day, c.hour);
    if (c.flags) { for (const k of Object.keys(S.flags)) delete S.flags[k]; for (const [k, v] of Object.entries(c.flags)) if (!BAD_KEYS.has(k)) S.flags[k] = v; }
    if (c.evidence) for (const k of EVIDENCE) S.evidence.slots[k] = c.evidence[k] ?? null;
    const H = S.hero, D = S.drive;
    if (K.photo.active) K.photo.close();
    if (D && D.riding) { const r = D.riding; r.speed = 0; D.exit(); if (D.riding) K.forceOut(r); }
    const v = S.vehicles && S.vehicles.player;
    if (v && c.van && v.kind === c.van.kind && !c.van.lost) {
      v.setPose(c.van.x, c.van.z, c.van.yaw, c.van.y != null ? c.van.y + 1 : undefined);
      v.damage = c.van.dmg || 0; v.wrecked = false; if (v.controls) Object.assign(v.controls, { throttle: 0, brake: 1, steer: 0, handbrake: true });
      if (v.setLook) v.setLook({ ...Object.fromEntries(VAN_LOOKS.map((k) => [k, false])), ...(c.van.look || {}) });
    }
    if (H) {
      if (c.hp != null) H.hp = Math.min(H.maxHp, Math.max(1, c.hp));
      if (c.canteenMax != null) H.canteenMax = c.canteenMax;
      if (c.canteen != null) H.canteen = Math.min(H.canteenMax, c.canteen);
      if (c.weapons && S.combat) { H.weapons = ['fists']; H.uses = { ...(c.uses || {}) }; for (const w of c.weapons) if (WEAPON_IDS.includes(w) && !H.weapons.includes(w)) H.weapons.push(w); try { S.combat.setWeapon(H.weapons.includes(c.weapon) ? c.weapon : 'fists'); } catch (e) { /* a stub */ } }
      if (c.hero && !c.hero.lost) {
        if (H.mode !== 'foot') H.setMode('foot');
        H.place(c.hero.x, c.hero.z, c.hero.yaw, Number.isFinite(c.hero.y) ? c.hero.y + 1 : undefined);
        if ((c.hero.mode === 'drive' || c.hero.mode === 'passenger') && v && D) D.enter(v, c.hero.mode === 'drive' ? 0 : Math.max(1, c.hero.seat || 1));
      }
    }
  }

  const Save = S.save = {
    get: () => load() || blankSaveV1(),
    has: () => !!load(),
    write() {
      if (!S.missions.chapter) return false;
      let s;
      try { s = snapshot(); } catch (e) { console.error('[save] snapshot', e); return false; }
      let text = JSON.stringify(s);
      for (let tries = 0; tries < 2; tries++) {
        try { localStorage.setItem(SAVE_KEY, text); cache = s; cacheText = text; K.lastSave = s; S.bus.emit('save', s); return true; }
        catch (e) { if (tries === 0 && Object.keys(s.thumbs).length) { s.thumbs = {}; text = JSON.stringify(s); continue; } K.log('save', 'failed', String(e && e.name)); return false; }
      }
      return false;
    },
    clear() { cache = null; cacheText = null; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage blocked */ } },
    summary: () => Save.get().summary,
    checkpoint, restore,
  };
  return { Save, load, snapshot, known, repair: (o) => repairSave(o, known()) };
}
