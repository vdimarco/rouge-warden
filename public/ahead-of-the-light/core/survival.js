// Ahead of the Light: survival (final.md 7, 8, 9): the gap and time to catch, push-backs, the light's states, hull
// and shield, fuel, pickups, the red zone, gates, docks, the landing and the years.
// SPINE STUB (WP0): safe do-nothing bodies with the 18.4 signatures. WP3 owns this file and replaces them. Pure.
import { TUNE } from './tune.js';

// Gap, TTC, push-backs from this step's events, states and the catch for one ship. events: the whole step's
// buffer (race.events); read only the ones whose ship is ship.id. Stub: the light stands still.
export function stepLight(race, ship, events, dt, tune = TUNE) {}

// Push the light back: capped by the leg's cap. Returns the seconds actually gained. Stub: 0.
export function pushBack(race, ship, kind, amount, tune = TUNE) { return 0; }

// η and meters for the next leg from the gate choice ('thread' | 'dock' | 'past').
export function launchState(run, gateChoice, tune = TUNE) {
  const eta = gateChoice === 'thread' ? tune.LAUNCH_THREAD : gateChoice === 'dock' ? tune.LAUNCH_DOCK
    : tune.LAUNCH_PAST;
  return { eta, meters: { ...(run && run.you) } };
}

// The dock strip's chips: [{ id, price, ttcDrop, ok }]. Stub: none.
export function dockPrices(run, tune = TUNE) { return []; }

// Buy or refund a dock chip. Stub: nothing changes; returns false.
export function buy(run, chip, tune = TUNE) { return false; }
export function refund(run, chip, tune = TUNE) { return false; }

// The landing at Earth: → { ok, cellsSpent, hullSpent, margin }. Stub: always home, nothing spent.
export function land(ship, tune = TUNE) { return { ok: true, cellsSpent: 0, hullSpent: 0, margin: 0 }; }

// Years aged this step (your clock). Stub: 0.
export function yearsStep(ship, dt, tune = TUNE) { return 0; }
