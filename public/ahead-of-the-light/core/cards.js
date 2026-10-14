// Ahead of the Light: the cards as data (final.md 12): 22 starters, 6 fusions, 4 legendaries, 4 trophies, and
// applyBuild, which patches the tuning table within 12.6's caps and collects the build's hooks.
// SPINE STUB (WP0): no cards yet; applyBuild returns the tuning unchanged. WP5 owns this file. Pure.
import { TUNE } from './tune.js';

// [{ id, name, fam, kind, values, tag, pack, face, tell, patch(v), hooks: { [hook]: (ctx) => {} } }]
export const CARDS = Object.freeze([]);

// → { tune: a patched copy within 12.6's caps, hooks: { [hook]: [fn] } }. Stub: no patches, no hooks.
export function applyBuild(build, tune = TUNE) { return { tune, hooks: {} }; }
