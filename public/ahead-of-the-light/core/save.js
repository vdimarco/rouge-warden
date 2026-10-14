// Ahead of the Light: saves (final.md 14.1): serialize, restore and migrate plain run and meta objects. The page
// does the storage (ui/store.js, in try/catch); this only turns objects into text and back.
// SPINE STUB (WP0): JSON round trips. WP5 owns this file. Pure.

export const VERSION = 1;

export function serialize(obj) { return JSON.stringify(obj); }

// → the object, or null if the text is not a save.
export function restoreSave(text) {
  try {
    const o = JSON.parse(text);
    return o && typeof o === 'object' ? o : null;
  } catch (e) {
    return null;
  }
}

// Bring an old save up to date, or null to drop it (a version mismatch drops the run, never the meta). Stub.
export function migrate(obj) { return obj && obj.v === VERSION ? obj : null; }
