// Ahead of the Light: the page's storage (final.md 14.1). It wraps localStorage with core/save.js's makeStore, so
// every read and write sits in try/catch: with storage blocked the game plays on with the starter pool and LANTERN
// and says nothing. Keys: the meta, the run at its last save, the last 20 run logs, and the arcade's shared mute.
import { KEYS, makeStore, migrate, pushLog, serialize } from '../core/save.js';
import { normalizeMeta } from '../core/meta.js';

// localStorage, or null when the page may not touch it (a sandbox, a private window that throws on access).
function local() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
}

export function createStore(backend = local()) {
  const S = makeStore(backend);
  return {
    keys: KEYS,
    meta() { return normalizeMeta(S.read(KEYS.meta)); },
    saveMeta(meta) { return S.write(KEYS.meta, meta); },
    // the run's suspend envelope ({ v, at, run }), brought up to date, or null
    run() { return migrate(S.read(KEYS.run)); },
    saveRun(envelope) { return S.write(KEYS.run, envelope); },
    clearRun() { return S.del(KEYS.run); },
    runText() { return S.get(KEYS.run); },
    logs() { const l = S.read(KEYS.log); return Array.isArray(l) ? l : []; },
    pushLog(entry) { return S.set(KEYS.log, serialize(pushLog(this.logs(), entry))); },
    // the arcade's shared sound switch: a JSON bool, on by default
    soundOn() {
      const t = S.get(KEYS.sound);
      if (t === null) return true;
      try { return JSON.parse(t) !== false; } catch (e) { return true; }
    },
    setSound(on) { return S.set(KEYS.sound, JSON.stringify(Boolean(on))); },
    clear() { for (const k of [KEYS.run, KEYS.meta, KEYS.log]) S.del(k); return true; },
    raw: S,
  };
}
