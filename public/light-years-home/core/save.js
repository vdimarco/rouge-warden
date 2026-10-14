// Light Years Home v3: saves (final.md 15), with v1's safety rules: storage may be missing or may throw, junk reads as
// nothing, unknown ids are dropped on read, and the game goes on. Storage is passed in (localStorage in the game, a
// plain object in tests). Keys: the save, the settings, one best ghost per event (at most 48, least recently raced
// dropped first), the last 20 session summaries for Copy log, and the boot breadcrumb in session storage.
import { toBase64, fromBase64 } from './ghost.js';
import { missionById } from './world/missions/ch1.js';

export const KEYS = Object.freeze({
  save: 'light-years-home.v3.save',
  settings: 'light-years-home.v3.settings',
  ghost: 'light-years-home.v3.ghost.',          // + event id (+ '.pilot')
  ghosts: 'light-years-home.v3.ghosts',         // { id: stamp }: when each ghost was last raced
  runs: 'light-years-home.v3.runs',
  boot: 'light-years-home.v3.boot',
});
export const SAVE_V = 1;
export const GHOST_KEEP = 48;
export const RUNS_KEEP = 20;
export const MEDALS = Object.freeze(['bronze', 'silver', 'gold', 'tern']);
export const DEFAULT_SETTINGS = Object.freeze({
  scheme: 'pedals', hand: 'right', assists: 'cruise', autoDrift: true, reducedMotion: false, slowCaptions: false,
  tilt: false, invertClimb: false, mouseSteer: false, quality: 'auto',
});
const SETTING_VALUES = Object.freeze({
  scheme: ['pedals', 'one-thumb'], hand: ['right', 'left'], assists: ['cruise', 'pilot'],
  quality: ['auto', 'high', 'mid', 'low'],
});

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isId = (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/.test(v);
const fin = (v, lo = -Infinity, hi = Infinity) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

function readJSON(storage, key) {
  try {
    const raw = storage && storage.getItem(key);
    if (typeof raw !== 'string') return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeJSON(storage, key, value) {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(storage, key) {
  try { if (storage) storage.removeItem(key); return true; } catch { return false; }
}

// ---------------------------------------------------------------- cleaning

/**
 * makeRegistry({ zones, missions, events, jumps, scans, rumours, secrets }) → a registry for cleanSave: each a list of
 * ids (or zone data, missions, jumps as objects with id). Anything not listed is dropped on read.
 */
export function makeRegistry({ zones = [], missions = [], jumps = [] } = {}) {
  const ids = (list) => new Set((Array.isArray(list) ? list : Object.values(list || {}))
    .map((x) => (typeof x === 'string' ? x : x?.id))
    .filter(isId));
  const zs = (zones || []).filter((z) => z && typeof z === 'object');
  const of = (key) => new Set(zs.flatMap((z) => (z[key] || []).map((x) => x.id)).filter(isId));
  return {
    zones: ids(zones), missions: ids(missions), jumps: ids(jumps),
    events: of('events'), scans: of('scans'), rumours: of('rumours'), secrets: of('secrets'),
    sets: new Set(zs.flatMap((z) => Object.keys(z.sets || {}).map((k) => `${z.id}:${k}`))),
  };
}

const known = (reg, kind, id) => isId(id) && (!reg || !reg[kind] || reg[kind].has(id));
const idList = (v, reg, kind) => (Array.isArray(v) ? [...new Set(v.filter((id) => known(reg, kind, id)))] : []);
const strList = (v) => (Array.isArray(v) ? [...new Set(v.filter(isId))] : []);
const medal = (v) => (MEDALS.includes(v) ? v : null);
const bits = (v) => (Array.isArray(v) ? v.slice(0, 256).map((x) => (x ? 1 : 0)) : []);
const b64 = (v) => (typeof v === 'string' && v.length <= 400 && /^[A-Za-z0-9+/]*={0,2}$/.test(v) ? v : '');

function cleanMap(v, reg, kind, fn) {
  const out = {};
  if (!isObj(v)) return out;
  for (const [id, x] of Object.entries(v)) {
    if (!known(reg, kind, id) || !isObj(x)) continue;
    const c = fn(x);
    if (c) out[id] = c;
  }
  return out;
}

/**
 * cleanSave(obj, registry = null) → a clean v3 save, or null when obj is not one. Unknown ids are dropped when a
 * registry (makeRegistry) is given; without one, any well-formed id is kept.
 */
export function cleanSave(obj, registry = null) {
  if (!isObj(obj) || obj.v !== SAVE_V) return null;
  const reg = registry;
  const zones = cleanMap(obj.zones, reg, 'zones', (z) => ({
    visited: !!z.visited, exitOpen: !!z.exitOpen, sparks: b64(z.sparks), scans: idList(z.scans, reg, 'scans'),
    rumours: idList(z.rumours, reg, 'rumours'), secrets: idList(z.secrets, reg, 'secrets'),
    sets: isObj(z.sets) ? Object.fromEntries(Object.entries(z.sets).filter(([k]) => isId(k)).map(([k, x]) => [k, bits(x)])) : {},
    lookHome: !!z.lookHome,
  }));
  const missions = cleanMap(obj.missions, reg, 'missions', (m) => ({
    done: !!m.done, medal: medal(m.medal), best: fin(m.best, 0, 36000) ? m.best : null, pilot: !!m.pilot,
    beat: fin(m.beat, 0, 99) ? Math.floor(m.beat) : 0, offered: !!m.offered,
    cards: strList(m.cards),
  }));
  const events = cleanMap(obj.events, reg, 'events', (e) => ({
    best: fin(e.best, 0, 36000) ? e.best : null, medal: medal(e.medal), pilot: !!e.pilot,
    splits: Array.isArray(e.splits) ? e.splits.filter((x) => fin(x, 0, 36000)).slice(0, 32) : [],
    tries: fin(e.tries, 0, 1e6) ? Math.floor(e.tries) : 0, wins: fin(e.wins, 0, 1e6) ? Math.floor(e.wins) : 0,
    seen: !!e.seen, noMedal: fin(e.noMedal, 0, 1e6) ? Math.floor(e.noMedal) : 0,
  }));
  const stunts = cleanMap(obj.stunts, reg, 'events', (s) => ({
    stars: fin(s.stars, 0, 3) ? Math.floor(s.stars) : 0, best: fin(s.best, -1e6, 1e6) ? s.best : null,
  }));
  const jumps = cleanMap(obj.jumps, reg, 'jumps', (j) => ({
    medal: medal(j.medal), peakEta: fin(j.peakEta, 0, 10) ? j.peakEta : null,
  }));
  const zoneId = known(reg, 'zones', obj.zoneId) ? obj.zoneId : null;
  const equip = isObj(obj.equip) ? obj.equip : {};
  const stats = isObj(obj.stats) ? obj.stats : {};
  const n = (x) => (fin(x, 0, 1e9) ? x : 0);
  return {
    v: SAVE_V, chapter: fin(obj.chapter, 1, 4) ? Math.floor(obj.chapter) : 1, zoneId,
    pocket: isId(obj.pocket) ? obj.pocket : null,
    zones, missions, events, stunts, jumps,
    scans: idList(obj.scans, reg, 'scans'), rumours: idList(obj.rumours, reg, 'rumours'),
    secrets: idList(obj.secrets, reg, 'secrets'),
    sets: isObj(obj.sets) ? Object.fromEntries(Object.entries(obj.sets).filter(([k]) => !reg || reg.sets.has(k))
      .map(([k, x]) => [k, bits(x)])) : {},
    postcards: strList(obj.postcards), tapes: strList(obj.tapes), stripes: strList(obj.stripes),
    trails: strList(obj.trails),
    equip: { stripe: isId(equip.stripe) ? equip.stripe : null, trail: isId(equip.trail) ? equip.trail : null,
      tape: isId(equip.tape) ? equip.tape : null },
    flags: isObj(obj.flags) ? Object.fromEntries(Object.entries(obj.flags).filter(([k, x]) => isId(k.toLowerCase())
      && typeof x === 'boolean')) : {},
    stats: { playT: n(stats.playT), near: n(stats.near), hairline: n(stats.hairline), takedowns: n(stats.takedowns) },
    chapterDone: obj.chapterDone === true,
  };
}

/** readSave(storage, registry) → a clean save, or null when there is none (or junk). */
export function readSave(storage, registry = null) {
  return cleanSave(readJSON(storage, KEYS.save), registry);
}

/** writeSave(storage, save) → true when written. */
export function writeSave(storage, save) {
  const clean = cleanSave(save);
  return clean ? writeJSON(storage, KEYS.save, clean) : false;
}

/** clearSave(storage): the save, settings, ghosts and runs (the hook's resetSave). */
export function clearSave(storage) {
  const idx = readJSON(storage, KEYS.ghosts);
  if (isObj(idx)) for (const id of Object.keys(idx)) remove(storage, KEYS.ghost + id);
  for (const k of [KEYS.save, KEYS.settings, KEYS.ghosts, KEYS.runs]) remove(storage, k);
}

// ---------------------------------------------------------------- from and to the game

/**
 * saveOf(game, prev) → the save object as it would be written now, from game.progress, the zone runtime, the story
 * flags and the stats. prev keeps what the game does not hold (equip).
 */
export function saveOf(game, prev = null) {
  const p = game.progress;
  const zones = JSON.parse(JSON.stringify(p.zones || {}));
  const flat = (key) => [...new Set(Object.values(zones).flatMap((z) => z[key] || []))];
  const sets = {};
  for (const [zid, z] of Object.entries(zones)) for (const [k, v] of Object.entries(z.sets || {})) sets[`${zid}:${k}`] = v;
  return {
    v: SAVE_V, chapter: game.chapter, zoneId: game.zoneId, pocket: game.pocketId || null,
    zones, missions: JSON.parse(JSON.stringify(p.missions || {})), events: JSON.parse(JSON.stringify(p.events || {})),
    stunts: JSON.parse(JSON.stringify(p.stunts || {})), jumps: JSON.parse(JSON.stringify(p.jumps || {})),
    scans: flat('scans'), rumours: flat('rumours'), secrets: flat('secrets'), sets,
    postcards: [...p.postcards], tapes: [...p.tapes], stripes: [...p.stripes], trails: [...p.trails],
    equip: prev?.equip || { stripe: null, trail: null, tape: null },
    flags: { ...(game.story?.flags || {}) },
    stats: { playT: game.stats.playT, near: game.stats.near, hairline: game.stats.hairline,
      takedowns: game.stats.takedowns },
    chapterDone: !!(game.story?.chapterDone || prev?.chapterDone),
  };
}

/**
 * progressOf(save) → the save made ready for createGame({ save }): a mission left half done starts again from beat 1,
 * except one whose only beat left is the exit gate when that exit is open (it counts as done).
 */
export function progressOf(save) {
  if (!save) return null;
  const out = JSON.parse(JSON.stringify(save));
  for (const [id, m] of Object.entries(out.missions || {})) {
    if (m.done) continue;
    const data = missionById(id);
    const zoneOpen = data && out.zones?.[data.zone]?.exitOpen;
    const rest = data ? data.beats.slice(m.beat || 0) : [];
    if (zoneOpen && rest.length && rest.every((b) => b.goal?.reach?.ring === 'exit')) {
      m.done = true;
      m.beat = data.beats.length;
    } else {
      m.beat = 0;
      delete m.parked;
    }
  }
  return out;
}

/**
 * continueOf(save, zoneData) → { zoneId, at, heading, speed }: Continue puts you at the zone's entry, or before its
 * exit gate when that is open; a save made inside a pocket continues at the pocket's way out in its zone.
 */
export function continueOf(save, zoneData) {
  if (!zoneData) return null;
  const z = save?.zones?.[zoneData.id];
  const e = zoneData.entry || {};
  if (save?.pocket && zoneData.pocket?.back) {
    const b = zoneData.pocket.back;
    return { zoneId: zoneData.id, at: b.pos.slice(), heading: (Math.atan2(b.dir[0], b.dir[1]) * 180) / Math.PI,
      speed: 24 };
  }
  if (z?.exitOpen && zoneData.exit?.pos) {
    const x = zoneData.exit.pos;
    const l = Math.hypot(x[0], x[1]) || 1;
    const ux = x[0] / l, uy = x[1] / l;
    return { zoneId: zoneData.id, at: [x[0] - ux * 60, x[1] - uy * 60, x[2] || 0],
      heading: (Math.atan2(ux, uy) * 180) / Math.PI, speed: 24 };
  }
  return { zoneId: zoneData.id, at: (e.pos || [0, 0, 0]).slice(), heading: e.heading ?? 0,
    speed: typeof e.speed === 'number' ? e.speed : 24 };
}

// ---------------------------------------------------------------- settings

/** readSettings(storage) → the settings, defaults where missing or junk. */
export function readSettings(storage) {
  const v = readJSON(storage, KEYS.settings);
  const out = { ...DEFAULT_SETTINGS };
  if (!isObj(v)) return out;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const x = v[key];
    if (SETTING_VALUES[key] ? SETTING_VALUES[key].includes(x) : typeof x === 'boolean') out[key] = x;
  }
  return out;
}

/** writeSettings(storage, settings) → true when written (only known keys and values). */
export function writeSettings(storage, settings) {
  const clean = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const x = settings?.[key];
    if (SETTING_VALUES[key] ? SETTING_VALUES[key].includes(x) : typeof x === 'boolean') clean[key] = x;
  }
  return writeJSON(storage, KEYS.settings, clean);
}

// ---------------------------------------------------------------- ghosts

function ghostIndex(storage) {
  const v = readJSON(storage, KEYS.ghosts);
  return isObj(v) ? Object.fromEntries(Object.entries(v).filter(([k, x]) => isId(k) && fin(x, 0))) : {};
}

/** readGhost(storage, id) → Uint8Array or null. */
export function readGhost(storage, id) {
  if (!isId(id)) return null;
  try {
    const raw = storage && storage.getItem(KEYS.ghost + id);
    return typeof raw === 'string' ? fromBase64(raw) : null;
  } catch {
    return null;
  }
}

/** writeGhost(storage, id, bytes) → true: stores the ghost, marks it just raced, keeps at most GHOST_KEEP. */
export function writeGhost(storage, id, bytes) {
  if (!isId(id) || !(bytes instanceof Uint8Array)) return false;
  try {
    if (!storage) return false;
    storage.setItem(KEYS.ghost + id, toBase64(bytes, true));
  } catch {
    return false;
  }
  touchGhost(storage, id);
  pruneGhosts(storage, GHOST_KEEP);
  return true;
}

/** touchGhost(storage, id): this event was just raced (the least recently raced ghosts go first). */
export function touchGhost(storage, id) {
  const idx = ghostIndex(storage);
  const top = Object.values(idx).reduce((a, b) => Math.max(a, b), 0);
  idx[id] = top + 1;
  return writeJSON(storage, KEYS.ghosts, idx);
}

/** pruneGhosts(storage, keep = 48) → ids removed, least recently raced first. */
export function pruneGhosts(storage, keep = GHOST_KEEP) {
  const idx = ghostIndex(storage);
  const ids = Object.keys(idx).sort((a, b) => idx[a] - idx[b]);
  const gone = ids.slice(0, Math.max(0, ids.length - keep));
  for (const id of gone) { remove(storage, KEYS.ghost + id); delete idx[id]; }
  if (gone.length) writeJSON(storage, KEYS.ghosts, idx);
  return gone;
}

// ---------------------------------------------------------------- runs (Copy log; nothing is sent anywhere)

/** readRuns(storage) → the last session summaries. */
export function readRuns(storage) {
  const v = readJSON(storage, KEYS.runs);
  return Array.isArray(v) ? v.filter(isObj).slice(-RUNS_KEEP) : [];
}

/** addRun(storage, summary) → true: keeps the last RUNS_KEEP. */
export function addRun(storage, summary) {
  if (!isObj(summary)) return false;
  return writeJSON(storage, KEYS.runs, [...readRuns(storage), summary].slice(-RUNS_KEEP));
}

// ---------------------------------------------------------------- the boot breadcrumb (session storage)

/**
 * breadcrumb: set(session, tier, t) at boot, clear(session) once the game has driven 20 s; check(session) at the next
 * boot gives the tier the last load died on (an iOS memory kill gives no warning), or null.
 */
export const breadcrumb = Object.freeze({
  set(session, tier, t = 0) { return writeJSON(session, KEYS.boot, { tier: String(tier), t: fin(t) ? t : 0 }); },
  check(session) {
    const v = readJSON(session, KEYS.boot);
    return isObj(v) && ['high', 'mid', 'low'].includes(v.tier) ? v.tier : null;
  },
  clear(session) { return remove(session, KEYS.boot); },
});

/** stepDown(tier) → the tier one lower ('low' stays). */
export const stepDown = (tier) => (tier === 'high' ? 'mid' : 'low');
