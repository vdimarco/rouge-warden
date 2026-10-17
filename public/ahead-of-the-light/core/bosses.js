// Ahead of the Light: the bosses (final.md 10.3): WHALE, MAKO and MANTA. Each drives under every rival rule (rivals.js)
// plus one rule of its own, applied here once a step (race.js part 8, bossStep) and in the rival AI (bossThink,
// bossFast). WHALE: its bow wave shoves ships beside it and it breaches every 12 s, towing its wake harder (its wake,
// tow and the SLAM on contact are handle.js's). MAKO: hunts the ship with the fewest fuel cells near it, rolls after
// each ram, and backs off after two takedowns. MANTA: the light pushes its sail unless a ship shadows it, the sail
// holds its gap off 1 s, its lane lights before it passes, and a takedown tears the sail. Every change shows as an
// event. Pure.
import { TUNE } from './tune.js';
import { emit, E } from './events.js';
import { bpsOf } from './handle.js';
import { wrap } from './course/kinds.js';
import { beatsPerS } from './ringmath.js';

export const BOSSES = Object.freeze(['whale', 'mako', 'manta']);

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const isOut = (s) => s.caught || s.wrecked;
const sgn = (v) => (v >= 0 ? 1 : -1);
const aheadS = (a, b, T) => (b.dist - a.dist) / bpsOf(a, T);

// Boss state on its ship.ai at the grid.
export function bossInit(ship, tune = TUNE) {
  const T = tune, A = ship.ai;
  if (ship.type === 'whale') {
    ship.half = T.WHALE.half;
    ship.turnMax = T.WHALE.turn;
    A.nextBreach = T.WHALE.breachFrom;
    A.songAt = T.WHALE.breachFrom - 1;
    A.breachLeft = 0;
    A.breachUntil = -1;
    A.bow = {};
  } else if (ship.type === 'mako') {
    A.finAt = 0;
    A.target = null;
    A.rollUntil = -1;
    A.rollDir = 1;
    A.downs = 0;
    A.backOff = null;
  } else if (ship.type === 'manta') {
    A.shadowed = false;
    A.shadowBy = null;
    A.tornUntil = -1;
    A.lane = null;
    A.laned = {};
    A.push = 0;
  }
}

// MAKO's prey for the AI's hunt: its fin target (rivals.js asks every TICK). → a ship or null.
export function bossThink(race, ship, A, tune = TUNE) {
  if (ship.type !== 'mako' || A.backOff) return null;
  const t = A.target ? race.ships.find((s) => s.id === A.target) : null;
  return t && !isOut(t) ? t : null;
}

// Per step in the AI: MAKO's roll owns its bearing (steering locked, drifting away at rollRate); MAKO backing off
// steers wide; MANTA steers onto its lane while it passes. → true when the boss owns the steering this step.
export function bossFast(race, ship, A, tune = TUNE) {
  const T = tune, I = A.intent, now = race.t;
  if (ship.type === 'mako') {
    if (now < A.rollUntil) { I.target = ship.bearing + A.rollDir * T.MAKO.rollRate * T.TURN_TAU; return true; }
    if (A.backOff) { I.target = ship.bearing; return true; }
  }
  if (ship.type === 'manta' && A.lane && now <= A.lane.until) {
    I.target = ship.bearing + wrap(A.lane.psi - ship.bearing);
    return true;
  }
  return false;
}

// One boss's rule for a step (dt: sim seconds).
export function bossStep(race, ship, dt, tune = race.tune || TUNE) {
  const T = tune;
  if (!ship || isOut(ship) || !ship.ai) return;
  if (ship.type === 'whale') whaleStep(race, ship, dt, T);
  else if (ship.type === 'mako') makoStep(race, ship, dt, T);
  else if (ship.type === 'manta') mantaStep(race, ship, dt, T);
}

// ---------------------------------------------------------------- WHALE

function whaleStep(race, w, dt, T) {
  const A = w.ai, W = T.WHALE, now = race.t;
  // the breach: its song 1 s before, then +breachEta over breachS (2 fuel), the wake towing × breachTow meanwhile
  if (now >= A.songAt && A.songAt >= 0) {
    A.songAt = -1;
    if (w.fuel >= 2 - 1e-9) emit(race, E.breach, w, { soon: true, at: A.nextBreach });
  }
  if (now >= A.nextBreach) {
    if (w.fuel >= 2 - 1e-9) {
      w.fuel -= 2;
      A.breachLeft = W.breachEta;
      A.breachUntil = now + W.breachS;
      emit(race, E.breach, w, { soon: false, eta: W.breachEta, until: A.breachUntil });
    }
    A.nextBreach += W.breachEvery;
    A.songAt = A.nextBreach - 1;
  }
  if (A.breachLeft > 0 && dt > 0) {
    const add = Math.min(A.breachLeft, (W.breachEta / Math.max(1e-3, W.breachS)) * dt);
    A.breachLeft -= add;
    w.eta = Math.min(T.RIVAL_ETA_MAX, w.eta + add);
  }
  // the bow wave: a ship 13.5 to 25° off its bearing and within ±0.15 s drifts away at bowRate
  const [lo, hi] = W.bowWave;
  for (const s of race.ships) {
    if (s === w || isOut(s) || s.whip) continue;
    const z = Math.abs(aheadS(w, s, T)), off = wrap(s.bearing - w.bearing), a = Math.abs(off);
    const on = z <= 0.15 && a >= lo && a <= hi;
    if (on && dt > 0) {
      const m = sgn(off) * W.bowRate * dt;
      s.bearing += m;
      s.target += m;
      if (!A.bow[s.id]) emit(race, E.bowWave, s, { by: w.id, side: sgn(off) });
    }
    A.bow[s.id] = on;
  }
}

// ---------------------------------------------------------------- MAKO

// Every MAKO.every s: the ship with the fewest whole fuel cells within MAKO.range s of it (ties to the nearest,
// critic lead item 8); a fin marks it. Backing off: it falls back 3 s of course over 2 s, then cruises out of the race.
function makoStep(race, m, dt, T) {
  const A = m.ai, now = race.t, M = T.MAKO;
  if (A.backOff) {
    A.target = null;
    if (now <= A.backOff.until && dt > 0) {
      const rate = (3 * bpsOf(m, T)) / Math.max(1e-3, A.backOff.until - A.backOff.t0);
      m.dist -= rate * dt;
    }
    return;
  }
  if (now < A.finAt) return;
  A.finAt = now + M.every;
  let best = null, bestCells = Infinity, bestZ = Infinity;
  for (const s of race.ships) {
    if (s === m || isOut(s) || s.kind === 'boss') continue;
    const z = Math.abs(aheadS(m, s, T));
    if (z > M.range) continue;
    const cells = Math.floor(s.fuel + 1e-9);
    if (cells < bestCells || (cells === bestCells && z < bestZ)) { best = s; bestCells = cells; bestZ = z; }
  }
  const id = best ? best.id : null;
  if (id !== A.target) {
    A.target = id;
    emit(race, E.fin, m, { target: id, cells: best ? bestCells : null });
  }
}

// ---------------------------------------------------------------- MANTA

// The push: η += push × max(0, 1 − gap ÷ range) a second while its sail is lit (no ship within shadowS behind it and
// ±shadowDeg of its bearing, and not torn), and its gap held at floor; the sail's drag always. The lane: laneLead
// before it passes a ship, at laneOff from that ship's bearing.
function mantaStep(race, m, dt, T) {
  const A = m.ai, now = race.t, MA = T.MANTA;
  let by = null;
  for (const s of race.ships) {
    if (s === m || isOut(s)) continue;
    const z = aheadS(m, s, T);                     // − : behind MANTA
    if (z < 0 && z >= -MA.shadowS && Math.abs(wrap(s.bearing - m.bearing)) <= MA.shadowDeg) { by = s.id; break; }
  }
  const shadowed = by !== null;
  if (shadowed !== A.shadowed) {
    A.shadowed = shadowed;
    A.shadowBy = by;
    emit(race, E.shadow, m, { on: shadowed, by });
  }
  const torn = now < A.tornUntil;
  const lit = !shadowed && !torn;
  A.push = lit ? MA.push * Math.max(0, 1 - m.gap / MA.range) : 0;
  if (dt > 0) {
    m.eta = Math.min(T.RIVAL_ETA_MAX, Math.max(T.ETA_MIN, m.eta + (A.push - MA.sailDrag) * dt));
    if (lit && m.gap < MA.floor) m.gap = MA.floor;
  }
  // the lane: for the next ship it will pass within laneLead
  if (A.lane && now > A.lane.until) A.lane = null;
  if (!A.lane) {
    const bm = beatsPerS(m.eta, T, false);
    for (const s of race.ships) {
      if (s === m || isOut(s) || A.laned[s.id] || s.dist <= m.dist) continue;
      const close = bm - beatsPerS(s.eta, T, s.lightspeed);
      if (!(close > 1e-6)) continue;
      const tPass = (s.dist - m.dist) / close;
      if (tPass > MA.laneLead) continue;
      const side = sgn(wrap(m.bearing - s.bearing)) || 1;
      const psi = wrap(s.bearing + side * MA.laneOff);
      A.laned[s.id] = true;
      A.lane = { target: s.id, psi, at: now + tPass, until: now + tPass + 0.3 };
      emit(race, E.lane, m, { target: s.id, psi, pass: tPass });
      break;
    }
  }
}

export const isBoss = (ship) => Boolean(ship && ship.kind === 'boss' && finite(ship.dist));
