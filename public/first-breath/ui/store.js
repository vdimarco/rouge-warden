// First Breath: the page's storage (design.md 10, 16.2), the only module that touches localStorage. Every read and
// write sits in try/catch, so with storage blocked (a sandbox, a private window that throws) the game plays on with
// defaults and says nothing. Values are JSON. core/save.js validates the save (SAVE_KEY); mute is the arcade's shared
// switch "arcade.sound", a JSON bool that is on by default.

export const SOUND_KEY = "arcade.sound";

// localStorage, or null when the page may not touch it.
function local() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; }
}

// The stored value for key, parsed from JSON; fallback when it is missing, broken or storage is off.
export function get(key, fallback) {
  try {
    const s = local();
    const t = s ? s.getItem(key) : null;
    if (t === null || t === undefined) return fallback;
    return JSON.parse(t);
  } catch (e) {
    return fallback;
  }
}

// Store value as JSON. → true when it was written.
export function set(key, value) {
  try {
    const s = local();
    if (!s) return false;
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function soundOn() {
  return get(SOUND_KEY, true) !== false;
}

export function setSoundOn(on) {
  return set(SOUND_KEY, Boolean(on));
}
