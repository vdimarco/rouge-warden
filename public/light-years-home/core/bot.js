// Light Years Home: bots that play whole journeys. The engine tests, qa/light-years-home/bot.mjs and the QA hook's
// autopilot use them. Each policy reads the state and returns { hold, actions } for one tick.
//   careful: names every landmark on the first lock and stays under every notch, letting go in good time.
//   skilled: also always right; rides close to the notch, goes over it in open space while the Lens is cool, lets
//            go just before galaxies and thick gas, and starts climbing before a long open stretch begins, so it
//            is fast where most of that stretch's distance passes.
//   reckless: holds full throttle and locks whichever ring comes first.
import {
  create, start, update, act, drainEvents, legOf, zoneAt, scanOf, resultOf, TICK, THROTTLE_UP, THROTTLE_DOWN,
} from './engine.js';
import { STOPS } from './route.js';

export const POLICIES = Object.freeze(['careful', 'skilled', 'reckless']);

// Tuning per policy. margin: how far under a notch it stays in gas and galaxies; lead: seconds of spare time when
// letting go before a lower notch; push: how far over the notch it goes in open space; cool: heat at which it backs
// off under the notch; early: climb into a long open stretch ahead of time while the heat is under this; fork: the
// branch it takes.
export const TUNING = Object.freeze({
  careful: Object.freeze({ margin: 0.05, lead: 0.3, push: null, cool: 0, early: 0, fork: 'void' }),
  skilled: Object.freeze({ margin: 0.02, lead: 0.1, push: 0.1, cool: 0.55, early: 0.6, fork: 'sheet' }),
  reckless: Object.freeze({ fork: 'sheet' }),
});

const LAST = STOPS.length - 1;
const LOOK_AHEAD = 6;     // screen seconds of zones ahead the bot plans for
const LONG = 10;          // an open stretch at least this many times longer than the zone before it is worth a burst

// The highest throttle allowed now so that, letting go at 0.9 per s, x is at or under (notch − margin) when each
// zone ahead begins. Times ahead use each zone's screen time at its notch; under the notch the real time is longer.
function ceiling(state, za, margin, lead) {
  const leg = legOf(state);
  let cap = 1, t = za.nextIn;
  for (let k = za.index + 1; k < leg.zones.length && t < LOOK_AHEAD; k++) {
    const z = leg.zones[k];
    if (z.dropout) break;
    cap = Math.min(cap, z.notch - margin + THROTTLE_DOWN * Math.max(0, t - lead));
    t += z.screen;
  }
  return cap;
}

function flightHold(kind, state) {
  const f = state.flight;
  const za = zoneAt(state);
  if (!f || !za || za.dropout || f.lock > 0) return false;
  if (kind === 'reckless') return true;
  const tune = TUNING[kind];
  const z = za.zone, leg = legOf(state);
  // the last approach: let go early for a gentle arrival
  if (state.stop === LAST && za.index === leg.zones.length - 2) return false;
  // a long open stretch ahead: start climbing so x reaches its notch as it begins (the heat that costs here is
  // worth it, since most of the stretch's distance passes in its first moments)
  const next = leg.zones[za.index + 1];
  if (tune.early > 0 && next && !next.dropout && next.notch > z.notch && next.ly >= LONG * z.ly
      && za.nextIn <= (next.notch - f.x) / THROTTLE_UP && f.heat < tune.early) return true;
  const open = z.kind !== 'waypoint' && z.n < 0.1;
  let target = z.notch - tune.margin;
  if (tune.push !== null && open) target = f.heat < tune.cool ? z.notch + tune.push : z.notch - tune.margin;
  target = Math.min(target, ceiling(state, za, tune.margin, tune.lead));
  return f.x + THROTTLE_UP * TICK <= target;
}

function scanActions(kind, state) {
  const scan = scanOf(state);
  const letter = kind === 'reckless' ? ['A', 'B', 'C'].find((k) => !scan.tried.includes(k)) : scan.target;
  if (!letter) return [];
  return scan.open === letter ? [{ type: 'lock' }] : [{ type: 'select', letter }, { type: 'lock' }];
}

// One tick of a policy: { hold, actions }.
export function botStep(kind, state) {
  const k = POLICIES.includes(kind) ? kind : 'careful';
  if (!state || state.paused) return { hold: false, actions: [] };
  switch (state.phase) {
    case 'scan':
      return { hold: false, actions: scanActions(k, state) };
    case 'fork':
      return { hold: false, actions: [{ type: 'fork', branch: TUNING[k].fork }] };
    case 'chapter':
      return { hold: false, actions: [{ type: 'continue' }] };
    case 'flight':
      return { hold: flightHold(k, state), actions: [] };
    default:
      return { hold: false, actions: [] };
  }
}

const finished = (state) => state.phase === 'lost' || (state.phase === 'ending' && state.ending && state.ending.done);

// Plays a whole journey with one policy, from the title to the score card or the lost ending.
// Returns { state, result, ticks, seconds, phases, counts, lostAt } (lostAt: the stop index, or null).
export function playJourney(kind, {
  seed = 1, today = { y: 2026, m: 10, d: 13 }, firstRun = true, settings = {}, maxSeconds = 1800, onTick = null,
} = {}) {
  const state = create({ seed, today, firstRun, settings });
  start(state);
  const phases = ['title'], counts = {};
  const tally = (events) => {
    for (const e of events) {
      counts[e.type] = (counts[e.type] || 0) + 1;
      if (e.type === 'phase') phases.push(e.to);
    }
  };
  tally(drainEvents(state));
  let ticks = 0;
  const max = Math.round(maxSeconds / TICK);
  while (!finished(state) && ticks < max) {
    const { hold, actions } = botStep(kind, state);
    for (const a of actions) act(state, a);
    update(state, { hold }, TICK);
    const events = drainEvents(state);
    tally(events);
    if (onTick) onTick(state, events, hold);
    ticks++;
  }
  return {
    state, result: resultOf(state), ticks, seconds: ticks * TICK, phases, counts,
    lostAt: state.phase === 'lost' ? state.stop : null,
  };
}
