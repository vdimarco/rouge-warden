// Ahead of the Light: one leg in flight. createRace builds the race state (final.md 18.2) and stepRace runs one
// fixed step in the order of 18.3: steering, the course advance, the course window, passes and wells, ship against
// ship, card hooks, survival, rival AI, the director, then the leg itself (the gate line, the run-out, the landing,
// the end). It also re-exports the event list (18.5) and the step's event buffer from events.js. Pure: no clocks, no
// Math.random; every random number comes from a named stream in race.rng.
import { TUNE } from './tune.js';
import { EVENTS, EVENT_TYPES, E, HOOKS, isEvent, emit, logEntry, runHooks } from './events.js';
import { courseSpeed } from './ringmath.js';
import { createShip, steerShip, passCheck, stepWell, stepContact, burn, stepHandle } from './handle.js';
import { stepLight, yearsStep, land } from './survival.js';
import { createField, rivalIntents } from './rivals.js';
import { bossStep } from './bosses.js';
import { applyBuild } from './cards.js';
import { buildLeg } from './course/gen.js';
import { ROUTE } from './course/legs.js';
import { stepDirector } from './course/director.js';
import { hashSeed } from '../../light-years-home/core/rng.js';

export { EVENTS, EVENT_TYPES, E, HOOKS, isEvent, emit, logEntry, runHooks };

export const STEP = 1 / 120;
export const PHASES = Object.freeze(['launch', 'race', 'gate', 'runout', 'land', 'done']);

// What a ship wants this step. target: an absolute bearing (degrees) to steer to, or null; turn: −1, 0 or 1 (keys
// and pad); action: 'down' on the step of a new press, 'up' on the step of a lift, else null; burn: true on the step
// of a flick up (or ↑). The player, the bots and the rivals all send this shape.
export const NO_INTENT = Object.freeze({ target: null, turn: 0, action: null, burn: false });

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const out = (s) => s.caught || s.wrecked;

// A stream's next number in [0, 1): mulberry32 (as light-years-home/core/rng.js) with its state kept in race.rng, so
// the state stays plain data and a race can be saved and replayed.
export function rand(race, stream) {
  const a = (((race.rng[stream] ?? hashSeed(stream)) + 0x6d2b79f5) >>> 0);
  race.rng[stream] = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// A race for one leg. run: the run (core/run.js), or null for a bare leg; leg: a Leg from buildLeg (built here if
// missing); tune: the live TUNE (URL overrides applied). The build's patches and hooks come from applyBuild, and the
// patched tuning rides along as race.tune because stepRace takes no tune.
export function createRace({ run = null, leg = null, tune = TUNE } = {}) {
  const legNo = run ? run.leg : 0;
  const seed = run ? run.seed : 1;
  const L = leg || buildLeg({ runSeed: seed, type: ROUTE[legNo] || ROUTE[0], tune });
  const build = applyBuild(run ? run.build : [], tune);
  const T = build.tune || tune;
  const you = createShip({ id: 'you', kind: 'you', type: run ? run.ship : 'lantern', bearing: 0,
    eta: run && run.you && finite(run.you.launchEta) ? run.you.launchEta : T.ETA0, meters: run ? run.you : null,
    tune: T });
  const race = {
    t: 0, real: 0,
    legNo, leg: L,
    win: { lo: 0, hi: 0 },
    ships: [you],
    wells: {},
    slow: { x: 1, until: 0 }, stop: 0,
    director: { breatherUntil: 0 },
    phase: 'launch',
    order: [],
    snaps: [],
    rng: { ai: hashSeed(seed, 'ai', legNo, L.seed), fx: hashSeed(seed, 'fx', legNo, L.seed) },
    hooks: build.hooks || {},
    events: [],
    log: [],
    tune: T,
  };
  const field = createField({ run, legNo, rng: (stream = 'ai') => rand(race, stream), tune: T, leg: L, you }) || [];
  for (const s of field) race.ships.push(s);
  for (const it of L.items) if (it.kind === 'well') race.wells[it.id] = { holder: null };
  return race;
}

const intentOf = (ship, intents) =>
  (intents && intents[ship.id]) || (ship.ai && ship.ai.intent) || NO_INTENT;

// Each ship's dist at the start of the step. Reused, so a step allocates nothing but its events.
const PREV = [];

// One step. intents: { [shipId]: intent } (rivals fall back to the intent their AI left in ship.ai.intent). dt: real
// seconds, clamped to 0.25. Hit-stop (race.stop, real seconds) freezes the world and the ship; slow motion
// (race.slow.x until race.real reaches race.slow.until) slows the world. steerShip and stepWell get real seconds
// (0 in a hit-stop), as the ship steers and a whip sweeps in real time; everything else gets sim seconds.
// Returns this step's events (also race.events).
export function stepRace(race, intents, dt) {
  race.events = [];
  const ev = race.events;
  if (race.phase === 'done') return ev;
  const T = race.tune || TUNE;
  const ships = race.ships;
  const real = finite(dt) ? clamp(dt, 0, 0.25) : 0;
  race.real += real;
  let sdt = real, frozen = false;
  if (race.stop > 0) {
    const f = Math.min(race.stop, sdt);
    race.stop -= f;
    sdt -= f;
    frozen = true;
  }
  if (race.slow.x !== 1) {
    if (race.real < race.slow.until) sdt *= clamp(race.slow.x, 0, 1);
    else race.slow.x = 1;
  }
  race.t += sdt;
  const rdt = frozen ? 0 : real;

  // 1. steering, burns, and each ship's own upkeep (burn ramps, drag and the engine, the chain, gears)
  for (const s of ships) {
    if (out(s)) continue;
    const intent = intentOf(s, intents);
    steerShip(s, intent, rdt, T);
    if (intent.burn) burn(race, s, T);
    stepHandle(race, s, intent, rdt, sdt, T);
  }

  // 2. the course advance: course speed × dt ÷ BEAT_R, with surges, the tow and the stumble's glide (ship.stumble
  // is the seconds left of it: you fall STUMBLE seconds of course back over STUMBLE_S)
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    PREV[i] = s.dist;
    if (out(s) || !(sdt > 0)) continue;
    const base = courseSpeed(s.eta, T, s.lightspeed);
    let v = base;
    if (s.surge.until > race.t) v *= s.surge.x;
    if (s.draft.lead) v *= s.draft.tow || T.TOW;
    let back = 0;
    if (s.stumble > 0) {
      const g = Math.min(s.stumble, sdt);
      s.stumble -= g;
      back = (T.STUMBLE / Math.max(1e-6, T.STUMBLE_S)) * base * g;
    }
    s.dist += (v * sdt - back) / T.BEAT_R;
  }
  PREV.length = ships.length;

  // 3. the course window: items join within SPAWN_BEATS of the leading ship and leave GONE_BEATS behind the last
  windowStep(race, T);

  // 4. per ship: items whose beat it crossed (with the share of the step where), lasting items beside it (rails,
  // fog), then wells
  const items = race.leg.items;
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    if (out(s)) continue;
    const p = PREV[i], d = s.dist;
    for (let k = race.win.lo; k < race.win.hi; k++) {
      const it = items[k];
      if (it.beat > p && it.beat <= d) passCheck(race, s, it, T, d > p ? (it.beat - p) / (d - p) : 1);
      else if (it.end !== undefined && it.beat <= p && d < it.end) passCheck(race, s, it, T, null);
    }
    stepWell(race, s, intentOf(s, intents), rdt, T);
  }

  // 5. ship against ship
  stepContact(race, sdt, T);

  // 6. card hooks on this step's events, then the step hook
  cardHooks(race, sdt);

  // 7. survival for every ship: the light, shield and hull, fuel, states, catches; and the clocks
  for (const s of ships) {
    if (out(s)) continue;
    stepLight(race, s, ev, sdt, T);
    s.years += yearsStep(s, sdt, T);
    s.earth += T.YEARS_PER_S * sdt;
  }

  // 8. rival AI (each rival keeps its own 50 ms tick in ship.ai.nextTick), then the bosses' rules
  const wants = rivalIntents(race, sdt, T);
  if (wants) for (const s of ships) if (s.ai && wants[s.id]) s.ai.intent = wants[s.id];
  for (const s of ships) if (s.kind === 'boss' && !out(s)) bossStep(race, s, sdt, T);

  // 9. the director
  stepDirector(race, ev, T);

  // 10. the leg
  legStep(race, T);
  return ev;
}

// Part 6: the build's hooks for each event so far this step that is yours (its ship, or its `by`, is you: the build
// is yours), in order, then the 'step' hook once. Events a hook emits do not run hooks themselves.
export function cardHooks(race, dt) {
  const hooks = race.hooks;
  if (!hooks) return;
  const you = race.ships[0], T = race.tune || TUNE, ev = race.events, n = ev.length;
  for (let k = 0; k < n; k++) {
    const e = ev[k];
    if (!hooks[e.type] || (e.ship !== you.id && e.by !== you.id)) continue;
    runHooks(race, e.type, { race, ship: you, event: e, tune: T });
  }
  if (hooks.step) runHooks(race, 'step', { race, ship: you, event: null, tune: T, dt });
}

function windowStep(race, T) {
  const items = race.leg.items;
  let lead = -Infinity, last = Infinity;
  for (const s of race.ships) {
    if (out(s)) continue;
    if (s.dist > lead) lead = s.dist;
    if (s.dist < last) last = s.dist;
  }
  if (lead === -Infinity) return;
  const w = race.win;
  while (w.hi < items.length && items[w.hi].beat - lead < T.SPAWN_BEATS) w.hi++;
  while (w.lo < w.hi && (items[w.lo].end ?? items[w.lo].beat) < last - T.GONE_BEATS) w.lo++;
}

// The leg's phases. launch → race once you pass the launch section; race → gate at L − GATE_CALL (THREAD OR DOCK);
// every ship crossing the gate line gets its place; gate → runout at the gate line, or at Earth gate → land → done
// at the door; runout → done at L, with the vista. Caught or wrecked ends the leg at once.
function legStep(race, T) {
  const ships = race.ships, you = ships[0], L = race.leg, beats = L.beats;
  const gateBeat = L.gate && finite(L.gate.beat) ? L.gate.beat : beats - 4;
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    if (out(s) || !(PREV[i] < gateBeat && s.dist >= gateBeat) || race.order.includes(s.id)) continue;
    race.order.push(s.id);
    emit(race, E.gateLine, s, { place: race.order.length });
  }
  const place = () => { const i = race.order.indexOf(you.id); return i < 0 ? null : i + 1; };
  if (out(you)) {
    race.phase = 'done';
    emit(race, E.legEnd, you, { why: you.wrecked ? 'wrecked' : 'caught', place: place() });
    return;
  }
  const launch = race.legNo === 0 ? T.LAUNCH_BEATS_FIRST : T.LAUNCH_BEATS;
  if (race.phase === 'launch' && you.dist >= launch) race.phase = 'race';
  if (race.phase === 'race' && you.dist >= beats - T.GATE_CALL) race.phase = 'gate';
  if (race.phase === 'gate' && you.dist >= gateBeat) {
    if (L.type === 'earth') {
      race.phase = 'land';
      emit(race, E.door, you, {});
      const r = land(you, T);
      emit(race, E.land, you, { ok: r.ok, margin: r.margin, cellsSpent: r.cellsSpent, hullSpent: r.hullSpent });
      race.phase = 'done';
      emit(race, E.legEnd, you, { why: r.ok ? 'home' : 'doorstep', place: place() });
      return;
    }
    race.phase = 'runout';
    emit(race, E.runout, you, {});
  }
  if (race.phase === 'runout' && you.dist >= beats) {
    race.phase = 'done';
    emit(race, E.vista, you, { gate: L.gate ? L.gate.id : null });
    emit(race, E.legEnd, you, { why: 'gate', place: place() });
  }
}
