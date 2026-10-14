// Ahead of the Light: rivals (final.md 10): the roster, barks, the field, perception, modes, line choice, mistakes,
// standings and the Nemesis. Rivals send the same intents as the player to the same stepRace.
// SPINE STUB (WP0): safe do-nothing bodies with the 18.4 signatures. WP4 owns this file and replaces them. Pure.
import { TUNE } from './tune.js';

// The 7 named ships and the drifter. WP4 adds silhouettes, motifs, knobs and barks.
export const ROSTER = Object.freeze({
  hound: Object.freeze({ id: 'hound', name: 'HOUND', kind: 'regular' }),
  pike: Object.freeze({ id: 'pike', name: 'PIKE', kind: 'regular' }),
  remora: Object.freeze({ id: 'remora', name: 'REMORA', kind: 'regular' }),
  moth: Object.freeze({ id: 'moth', name: 'MOTH', kind: 'regular' }),
  whale: Object.freeze({ id: 'whale', name: 'WHALE', kind: 'boss' }),
  mako: Object.freeze({ id: 'mako', name: 'MAKO', kind: 'boss' }),
  manta: Object.freeze({ id: 'manta', name: 'MANTA', kind: 'boss' }),
  drifter: Object.freeze({ id: 'drifter', name: '', kind: 'drifter' }),
});

// Three regulars race; the fourth waits in reserve. Stub: always the same three.
export function pickRegulars(seed) { return { racing: ['hound', 'pike', 'remora'], reserve: 'moth' }; }

// The ships on the grid for a leg (not you). Stub: an empty field.
export function createField({ run, legNo, rng, tune = TUNE } = {}) { return []; }

// Every rival's intent: { [shipId]: { target, turn, action, burn } }. Runs its own 50 ms tick (ship.ai.nextTick).
// Stub: none.
export function rivalIntents(race, dt, tune = TUNE) { return {}; }

// A bark for an event, or null. Stub: silence.
export function barkFor(race, event, tune = TUNE) { return null; }

// The leg's standings for the arrival line and the run.
export function legResult(race) {
  return { order: race ? [...race.order] : [], eaten: [], fed: [], takedowns: [], nemesis: null, boss: null };
}
