// Ahead of the Light: saves (final.md 14.1): the storage keys, serialize, restoreSave and migrate for plain run, meta
// and log objects, and makeStore, which wraps any get/set/remove backend so every read and write sits in try/catch.
// The page passes localStorage to makeStore (ui/store.js); this file never names it. A version mismatch drops the
// run, never the meta. Pure.
import { SLUG } from './tune.js';
import { normalizeMeta } from './meta.js';

export const VERSION = 1;
export const KEYS = Object.freeze({
  meta: `${SLUG}.meta.v1`, run: `${SLUG}.run.v1`, log: `${SLUG}.log.v1`, sound: 'arcade.sound',
});
export const LOG_KEEP = 20;                 // run logs kept for Copy log

export function serialize(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return null;
  }
}

// → the object, or null if the text is not a save.
export function restoreSave(text) {
  if (typeof text !== 'string' || !text) return null;
  try {
    const o = JSON.parse(text);
    return o && typeof o === 'object' ? o : null;
  } catch (e) {
    return null;
  }
}

// A stored run (or a suspend envelope { v, at, run }) brought up to date, or null to drop it. A run of another
// version is dropped (it resumes from nothing rather than from a wrong shape).
export function migrate(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.run && typeof obj.run === 'object' && obj.at) {
    if (obj.v !== VERSION) return null;
    const run = migrate(obj.run);
    return run ? { ...obj, run } : null;
  }
  if (obj.v !== VERSION) return null;
  if (typeof obj.seed !== 'string' && typeof obj.seed !== 'number') return null;
  if (!obj.you || !Array.isArray(obj.chart) || !Array.isArray(obj.build) || !Array.isArray(obj.legs)) return null;
  return obj;
}

// A stored meta, kept whatever its version: missing parts are filled from a fresh meta.
export const migrateMeta = (obj) => normalizeMeta(obj);

// The last LOG_KEEP run logs, newest last, with one more added.
export function pushLog(list, entry) {
  const out = Array.isArray(list) ? list.slice(-(LOG_KEEP - 1)) : [];
  if (entry) out.push(entry);
  return out;
}

// A store over a backend with getItem, setItem and removeItem (localStorage, or a test's stand-in). Every call is in
// try/catch: with storage blocked, get returns null and set returns false, and the game plays on with the starter pool
// and LANTERN, saying nothing.
export function makeStore(backend) {
  const ok = backend && typeof backend === 'object';
  return {
    get(key) {
      try { return ok ? backend.getItem(key) : null; } catch (e) { return null; }
    },
    set(key, text) {
      if (text === null || text === undefined) return false;
      try { if (!ok) return false; backend.setItem(key, text); return true; } catch (e) { return false; }
    },
    del(key) {
      try { if (!ok) return false; backend.removeItem(key); return true; } catch (e) { return false; }
    },
    // read and parse an object (null when missing, broken or blocked)
    read(key) { return restoreSave(this.get(key)); },
    write(key, obj) { return this.set(key, serialize(obj)); },
  };
}
