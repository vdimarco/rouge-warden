// Light Years Home v3: the event kit (races §2, final.md 9). Timed events (sprint, circuit, showcase, rival) start
// when you drive through their start ring: no countdown, no menu. The ring sets you to RACE.START_S and a half bar
// over RACE.START_FLASH, so every attempt is the same race. Gates pass as BULLSEYE, PASS, CLIP or MISS (+3 s); split
// gates show the delta to your best; accidental starts cancel quietly; a 0.35 s hold of the action control restarts
// (control back at 0.6 s, the clock at 1.6 s from the press); a tap goes back to the last gate. Stunts (drift zones,
// speed traps, oncoming roads, Light Lines, skims, slingshots, threads) start when you enter them and end with stars.
// Light pads kick anywhere. Traffic on a course runs on a fixed clock per event, so every run meets the same galaxies.
import { addBar, chainEvent, padKick, setSpeed } from './ship.js';
import { createRecorder, record, flagsOf, encode } from './ghost.js';
import { lock, zoneOf, builtOf } from './game.js';
import { trackOf, trackAt, nearestOn, actorById } from './actors.js';
import { posAt } from './traffic.js';
import { hashSeed } from './rng.js';
import { TUNE } from './tune.js';

export const TIMED = Object.freeze(['sprint', 'circuit', 'showcase', 'rival']);
export const STUNT_KINDS = Object.freeze(['drift', 'trap', 'oncoming', 'line', 'skim', 'sling', 'thread']);
export const isTimed = (e) => !!e && TIMED.includes(e.type);
export const isStunt = (e) => !!e && STUNT_KINDS.includes(e.type);

// Points (races §2.4): the race and stunt tallies; the chain multiplier is ship.js's.
export const POINTS = Object.freeze({ near: 100, hairline: 250, thread: 300, skim: 150, draft: 75,
  drift: Object.freeze([200, 500, 1000]), sling: 400, perfectSling: 800, pad: 50, padPerfect: 100, bullseye: 50,
  takedown: 500 });

export const PAD_R = 2.5;              // u: a pad hit (its PERFECT is RACE.PAD_PERFECT_R)
const PAD_COOL = 1.0;                  // s before the same pad kicks again
const FINISH_SHOW = 6;                 // s a finished race stays (the AGAIN chip)
const ARMED_MAX = 3;                   // s a restart's run-in may take before it cancels
const GATE_REACH = 150;                // u: crossing a gate's plane farther out than this is not a pass or a miss
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const num = (x, d = 0) => (typeof x === 'number' && x === x && x !== Infinity && x !== -Infinity ? x : d);
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- medals and stars

/** medalOf(ev, time) → 'tern' | 'gold' | 'silver' | 'bronze' | null. Works for events and for mission medals. */
export function medalOf(ev, time) {
  if (!ev || !Number.isFinite(time)) return null;
  const m = ev.medals || ev;
  const tern = m.tern ?? m.author;
  if (Number.isFinite(tern) && time <= tern + 1e-9) return 'tern';
  if (Number.isFinite(m.gold) && time <= m.gold + 1e-9) return 'gold';
  if (Number.isFinite(m.silver) && time <= m.silver + 1e-9) return 'silver';
  if (Number.isFinite(m.bronze) && time <= m.bronze + 1e-9) return 'bronze';
  return null;
}
export const MEDALS = Object.freeze(['bronze', 'silver', 'gold', 'tern']);
export const medalRank = (m) => MEDALS.indexOf(m) + 1;
export const betterMedal = (a, b) => (medalRank(a) >= medalRank(b) ? a || null : b || null);

/** nextMedal(ev, best) → { medal, time } for the next medal the player lacks (the pacer's pace), or null. */
export function nextMedal(ev, rec = null) {
  const have = medalRank(rec?.medal);
  for (const m of MEDALS) {
    if (medalRank(m) <= have) continue;
    const time = m === 'tern' ? ev.tern : ev[m];
    if (Number.isFinite(time)) return { medal: m, time };
  }
  return null;
}

/**
 * starsOf(stunt, value) → 0..3. Numbers count the thresholds reached (a trap's speed, a skim's seconds, an oncoming
 * road's near misses, a drift's tier). A Light Line takes { all, exit, perfect }; a thread { clean, speed }.
 */
export function starsOf(stunt, value) {
  const stars = stunt?.stars || [];
  let n = 0;
  for (const s of stars) {
    if (typeof s === 'number') { if (num(value, -Infinity) >= s - 1e-9) n++; continue; }
    const v = value || {};
    if (s === 'all') { if (v.all) n++; } else if (s === 'all+exit') { if (v.all && v.exit) n++; }
    else if (s === 'all-perfect') { if (v.all && v.perfect) n++; }
    else if (s.startsWith('clean')) {
      const at = Number(s.split('@')[1] || 0);
      if (v.clean && num(v.speed) >= at) n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------- courses

const COURSES = new WeakMap();

// 'arc: centre (-9,-10), r 430, from -90 deg to -270 deg, clockwise' → points every 5°.
function parseArc(text) {
  const m = /centre\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*,\s*r\s*(-?[\d.]+)\s*,\s*from\s*(-?[\d.]+)\s*deg\s*to\s*(-?[\d.]+)\s*deg/.exec(text);
  if (!m) return null;
  const [cx, cy, r, a0, a1] = m.slice(1, 6).map(Number);
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 5));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * DEG;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), 0]);
  }
  return pts;
}

const unit2 = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l, 0]; };

/**
 * course(ev) → { start: { pos, dir, r }, gates: [{ i, pos, n, r, name, split, kind, finish, lapEnd }], track, L, laps,
 * closed }. Cached per event. Gates come from line indexes (at) or positions (pos); each gate faces along the line.
 */
export function course(ev) {
  let c = COURSES.get(ev);
  if (c) return c;
  const st = ev.start || {};
  const spos = [num(st.pos?.[0]), num(st.pos?.[1]), num(st.pos?.[2])];
  const sdir = unit2(num(st.dir?.[0], 0), num(st.dir?.[1], 1));
  let line = Array.isArray(ev.line) ? ev.line.map((p) => [p[0], p[1], p[2] || 0])
    : typeof ev.line === 'string' && ev.line.startsWith('arc') ? parseArc(ev.line) : null;
  if (!line) line = [spos, ...(ev.gates || []).filter((g) => g.pos).map((g) => [g.pos[0], g.pos[1], g.pos[2] || 0])];
  const closed = !!ev.closed;
  const laps = Math.max(1, ev.laps | 0);
  let pts = line;
  if (closed) { pts = []; for (let l = 0; l < laps; l++) pts.push(...line); pts.push(line[0]); }
  const track = trackOf(pts, false);
  const T = [0, 0, 0, 0];
  const R = TUNE.RACE.GATE_R;
  const gates = [];
  for (let l = 0; l < laps; l++) {
    (ev.gates || []).forEach((g, k) => {
      let pos, n;
      if (Number.isInteger(g.at) && line[g.at]) {
        const p = line[g.at];
        pos = [p[0], p[1], p[2] || 0];
        const a = line[Math.max(0, g.at - 1)], b = line[Math.min(line.length - 1, g.at + 1)] || p;
        const b2 = closed && g.at === line.length - 1 ? line[0] : b;
        n = unit2(b2[0] - a[0], b2[1] - a[1]);
      } else if (g.pos) {
        pos = [g.pos[0], g.pos[1], g.pos[2] || 0];
        trackAt(track, nearestOn(track, pos), T);
        n = [Math.sin(T[3]), Math.cos(T[3]), 0];
      } else {
        return;
      }
      const kind = g.kind || 'standard';
      gates.push({ i: gates.length, pos, n, r: num(g.r, R[kind] ?? 4.5), name: g.name || null, split: !!g.split, kind,
        finish: false, lapEnd: false, lap: l + 1, src: k });
    });
    if (closed) {
      gates.push({ i: gates.length, pos: spos.slice(), n: sdir.slice(), r: num(st.r, 4.5), name: l === laps - 1 ? 'FINISH' : null,
        split: false, kind: 'wide', finish: false, lapEnd: true, lap: l + 1, src: -1 });
    }
  }
  if (gates.length) gates[gates.length - 1].finish = true;
  c = { start: { pos: spos, dir: sdir, r: num(st.r, 4.5) }, gates, track, L: track.L, laps, closed };
  COURSES.set(ev, c);
  return c;
}

/** pacerOnCourse(ev, time, t, out) → true with out at t s on the course at an even pace that finishes in `time`. */
export function pacerOnCourse(ev, time, t, out) {
  const c = course(ev);
  if (!(time > 0) || t < 0 || t > time) return false;
  trackAt(c.track, (t / time) * c.L, out);
  return true;
}

// The fixed traffic clock for an event's runs (fair conditions, races §2.5). Among a few candidate times it picks
// the one where the run-in from the run-up is clear and the fewest galaxies sit dead on the racing line when a racer
// at Tern pace or at a slower pace gets there; traffic still flows close by, for the near misses. Searched once per
// event, zone and seed (about 30 ms).
const CLOCKS = new Map();
const CL = [0, 0, 0, 0], CB = [0, 0, 0];
function zoneT0(game, data) {
  const key = `${data.id}:${game.zoneId}:${game.seed}`;
  if (CLOCKS.has(key)) return CLOCKS.get(key);
  const base = 600 + (hashSeed('event', data.id) % 600);
  const tr = builtOf(game)?.traffic;
  let best = base;
  if (tr) {
    const c = course(data);
    const R = game.tune.RACE;
    const from = data.runup?.pos || [c.start.pos[0] - c.start.dir[0] * R.START_S, c.start.pos[1] - c.start.dir[1] * R.START_S, 0];
    const run = Math.hypot(c.start.pos[0] - from[0], c.start.pos[1] - from[1]);
    // The bodies that can come near the course in the searched span.
    const pts = [];
    for (let u = 0; u <= c.L; u += 10) { trackAt(c.track, u, CL); pts.push(CL[0], CL[1]); }
    pts.push(from[0], from[1]);
    const ids = [];
    for (let i = 0; i < tr.n; i++) {
      if (!(tr.rc[i] > 0.45)) continue;
      let near = false;
      for (const dt of [0, 30, 60, 90]) {
        posAt(tr, i, base + dt, CB);
        for (let k = 0; k < pts.length && !near; k += 2) {
          const dx = CB[0] - pts[k], dy = CB[1] - pts[k + 1];
          if (dx * dx + dy * dy < 90 * 90) near = true;
        }
        if (near) break;
      }
      if (near) ids.push(i);
    }
    const pace = num(data.length, c.L) / num(data.tern, 30);
    let bestScore = Infinity;
    for (let k = 0; k < 24; k++) {
      const z = base + k * 3.7;
      let score = 0;
      // The run-in: how close anything comes to it.
      let clear = 6;
      for (let j = 0; j <= 10 && score < bestScore; j++) {
        const f = j / 10, tt = -run / R.START_S + f * (run / R.START_S);
        const x = from[0] + (c.start.pos[0] - from[0]) * f, y = from[1] + (c.start.pos[1] - from[1]) * f;
        for (const i of ids) {
          posAt(tr, i, z + tt, CB);
          const dx = CB[0] - x, dy = CB[1] - y;
          if (dx * dx + dy * dy > 100 || Math.abs(CB[2]) > tr.rc[i] + 3) continue;
          clear = Math.min(clear, Math.sqrt(dx * dx + dy * dy) - tr.rc[i]);
        }
      }
      score += clear < 2 ? (2 - clear) * 20 : 0;
      // The line at three paces: a galaxy dead on it (within its collider and 1 u) costs a point.
      for (const p of [pace, pace * 0.85, pace * 0.72]) {
        for (let tt = 0.125; tt * p < c.L && score < bestScore; tt += 0.125) {
          trackAt(c.track, tt * p, CL);
          for (const i of ids) {
            posAt(tr, i, z + tt, CB);
            const dx = CB[0] - CL[0], dy = CB[1] - CL[1], r = tr.rc[i] + 1.2;
            if (dx * dx + dy * dy < r * r && Math.abs(CB[2]) < r + 1) score += 1;
          }
        }
      }
      if (score < bestScore) { bestScore = score; best = z; }
      if (score === 0) break;
    }
  }
  CLOCKS.set(key, best);
  return best;
}

// ---------------------------------------------------------------- helpers

function eventsOf(game) {
  return zoneOf(game)?.events || [];
}
export function eventById(game, id) {
  return eventsOf(game).find((e) => e.id === id) || null;
}

// Crossing the plane through c with normal n this step (prev → pos): the fraction f and the radial distance.
const X = [0, 0, 0];
function crossing(prev, pos, c, n) {
  const s0 = (prev[0] - c[0]) * n[0] + (prev[1] - c[1]) * n[1] + (prev[2] - c[2]) * n[2];
  const s1 = (pos[0] - c[0]) * n[0] + (pos[1] - c[1]) * n[1] + (pos[2] - c[2]) * n[2];
  if (!(s0 < 0 && s1 >= 0)) return -1;
  const f = s0 / (s0 - s1);
  X[0] = prev[0] + (pos[0] - prev[0]) * f; X[1] = prev[1] + (pos[1] - prev[1]) * f; X[2] = prev[2] + (pos[2] - prev[2]) * f;
  CROSS.r = Math.hypot(X[0] - c[0], X[1] - c[1], X[2] - c[2]);
  return f;
}
const CROSS = { r: 0 };

// The closest approach of the segment p0 → p1 to point c.
function segDist(p0, p1, c) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const l2 = dx * dx + dy * dy + dz * dz;
  let f = l2 > 1e-12 ? ((c[0] - p0[0]) * dx + (c[1] - p0[1]) * dy + (c[2] - p0[2]) * dz) / l2 : 0;
  f = clamp(f, 0, 1);
  return Math.hypot(p0[0] + dx * f - c[0], p0[1] + dy * f - c[1], p0[2] + dz * f - c[2]);
}

// This step's events (stamped with game.t), oldest first.
function firstNew(ev, t) {
  if (!ev || !ev.list) return 0;
  let i = ev.n - 1;
  while (i >= 0 && ev.list[i] && ev.list[i].t === t) i--;
  return i + 1;
}

/** calmShip(ship): clear a drift's charge, a boost and a kick (a start ring, a restart, a respawn). */
export function calmShip(ship, bar = null) {
  const dr = ship.drift;
  dr.on = false; dr.t = 0; dr.charge = 0; dr.tier = 0; dr.autoT = 0;
  if ('exitT' in dr) { dr.exitT = 0; dr.counterT = 0; dr.turn = 0; dr.well = -1; dr.manual = false; }
  ship.boosting = false; ship.burstT = 0; ship.kickT = 0; ship.boostT = 0;
  ship.db.t = 0; ship.db.tier = 0; ship.snapT = 0;
  if ('padT' in ship) ship.padT = 0;
  ship.stunT = 0;
  if (bar !== null) ship.bar = bar;
}

/** placeShip(game, pos, headingRad, speed): move the ship (a restart, a respawn, a retry), with no streak to draw. */
export function placeShip(game, pos, yaw, speed) {
  const s = game.ship;
  s.pos[0] = pos[0]; s.pos[1] = pos[1]; s.pos[2] = pos[2] || 0;
  s.yaw = yaw; s.pitch = 0; s.slip = 0; s.bank = 0;
  s.vel[0] = Math.sin(yaw) * speed; s.vel[1] = Math.cos(yaw) * speed; s.vel[2] = 0;
  s.speed = speed;
  s.prev.pos[0] = s.pos[0]; s.prev.pos[1] = s.pos[1]; s.prev.pos[2] = s.pos[2];
  s.prev.yaw = yaw; s.prev.pitch = 0; s.prev.bank = 0;
  s.steerS = 0; s.climbS = 0;
  if (s.skim) { s.skim.on = false; s.skim.t = 0; s.skim.body = null; }
  if (s.draft) { s.draft.on = false; s.draft.t = 0; s.draft.target = null; }
  if (game.near && game.near.ids) {
    game.near.n = 0;
    game.near.ids.fill(-1);
    if (game.near.away) game.near.away.fill(0);
  }
}

// ---------------------------------------------------------------- timed events

function newRace(game, ev, from) {
  const R = game.tune.RACE;
  const c = course(ev);
  // The first gate's deadline: twice its Tern-pace time, at least CANCEL_MIN.
  const g0 = c.gates[0];
  const d0 = g0 ? Math.hypot(g0.pos[0] - c.start.pos[0], g0.pos[1] - c.start.pos[1]) : 100;
  const pace = num(ev.length, c.L) / num(ev.tern, 30);
  const prev = game.race && game.race.id === ev.id ? game.race : null;
  return {
    id: ev.id, state: 'running', t: 0, gate: 0, lap: 1, splits: [], misses: 0, bullseyes: 0, points: 0, holdT: 0,
    pen: 0, rec: createRecorder(R.GHOST_HZ, Math.max(60, num(ev.bronze, 30) * 2)), result: null,
    norm: R.START_FLASH, firstAt: Math.max(R.CANCEL_MIN, (R.CANCEL_X * d0) / pace), turnT: 0, offT: 0, off: false,
    lastGate: -1, controlAt: 0, clockAt: 0, armT: 0, finishedAt: 0, from, tries: (prev?.tries || 0) + 1,
    holdUsed: prev ? prev.holdUsed : false, opp: null, toGates: 0, z0: zoneT0(game, ev),
  };
}

/**
 * startEvent(game, id, { fromRunup, ev }) → true. fromRunup puts the ship at the event's run-up at race speed and arms
 * it (the hook's raceStart); else the clock starts here (the ship has just crossed the start ring).
 */
export function startEvent(game, id, { fromRunup = false, ev = null, f = 1, dt = 0 } = {}) {
  const data = eventById(game, id);
  if (!data || !isTimed(data)) return false;
  if (fromRunup) {
    const race = newRace(game, data, 'runup');
    race.state = 'restart';
    race.controlAt = game.t;
    race.clockAt = game.t + 1;
    race.armT = game.t;
    game.race = race;
    game.activity = { kind: 'event', id };
    toRunIn(game, data, race);
    return true;
  }
  const R = game.tune.RACE;
  const race = newRace(game, data, 'ring');
  game.race = race;
  game.activity = { kind: 'event', id };
  game.eventT = (1 - f) * dt;
  game.zoneT = race.z0 + game.eventT;
  calmShip(game.ship);
  if (ev) ev.push('eventStart', { id, flash: R.START_FLASH });
  startOpponent(game, data, race);
  return true;
}

// The run-in after a restart: the run-up point (30 u before the ring), facing it, at race speed, with a half bar.
function toRunIn(game, data, race) {
  const R = game.tune.RACE;
  const c = course(data);
  let pos, yaw;
  if (data.runup?.pos) {
    pos = data.runup.pos;
    yaw = Math.atan2(c.start.pos[0] - pos[0], c.start.pos[1] - pos[1]);
  } else {
    pos = [c.start.pos[0] - c.start.dir[0] * R.START_S, c.start.pos[1] - c.start.dir[1] * R.START_S, c.start.pos[2]];
    yaw = Math.atan2(c.start.dir[0], c.start.dir[1]);
  }
  placeShip(game, pos, yaw, R.START_S);
  calmShip(game.ship, R.START_BAR);
  const run = Math.hypot(c.start.pos[0] - pos[0], c.start.pos[1] - pos[1]) / R.START_S;
  game.zoneT = race.z0 - run;
  race.state = 'armed';
  race.armT = game.t;
  resetOpponent(game, data);
}

/**
 * restartEvent(game, ev, pressT): the 0.35 s hold (or AGAIN, or Delete). Control comes back RACE.CONTROL_BACK after
 * the press, the ship at the run-up; the clock starts at the start ring, RACE.CLOCK_START after the press.
 */
export function restartEvent(game, ev = null, pressT = null) {
  const race = game.race;
  if (!race) return false;
  const R = game.tune.RACE;
  const press = Number.isFinite(pressT) ? Math.min(pressT, game.t) : game.t - R.RESTART_HOLD;
  race.state = 'restart';
  race.controlAt = Math.max(game.t, press + R.CONTROL_BACK);
  race.clockAt = press + R.CLOCK_START;
  race.tries = (race.tries || 0) + (race.result ? 0 : 1);
  race.result = null;
  game.activity = { kind: 'event', id: race.id };
  lock(game, race.controlAt - game.t);
  if (ev) ev.push('restart', { id: race.id, controlIn: race.controlAt - game.t });
  return true;
}

/** toLastGate(game, ev): back to the last gate passed (the start ring before any), clock running. */
export function toLastGate(game, ev = null) {
  const race = game.race;
  if (!race || race.state !== 'running') return false;
  const data = eventById(game, race.id);
  if (!data) return false;
  const c = course(data);
  const R = game.tune.RACE;
  const g = race.lastGate >= 0 ? c.gates[race.lastGate] : null;
  const next = c.gates[race.gate];
  const from = g ? g.pos : c.start.pos;
  const dir = g ? g.n : c.start.dir;
  const yaw = next ? Math.atan2(next.pos[0] - from[0], next.pos[1] - from[1]) : Math.atan2(dir[0], dir[1]);
  placeShip(game, [from[0] + Math.sin(yaw) * 2, from[1] + Math.cos(yaw) * 2, from[2]], yaw, R.START_S);
  calmShip(game.ship);
  race.offT = 0; race.off = false; race.turnT = 0; race.toGates++;
  lock(game, R.CONTROL_BACK - R.RESTART_HOLD);
  if (ev) ev.push('toGate', { id: race.id, i: Math.max(0, race.lastGate) });
  return true;
}

/** cancelEvent(game, ev, quiet = true): end the event with no result. */
export function cancelEvent(game, ev = null, quiet = true) {
  const race = game.race;
  if (!race) return false;
  if (ev) ev.push('cancel', { id: race.id, quiet });
  if (race.opp) resetOpponent(game, eventById(game, race.id));
  game.race = null;
  if (game.activity?.kind === 'event') game.activity = null;
  return true;
}

// Opponents: D100 on its path at its race speed; Vela on the course at Tern × her pace (Cruise's bounded band).
function startOpponent(game, data, race) {
  const o = data.opponent || data.rival;
  if (!o?.actor) return;
  const a = actorById(game, o.actor);
  if (!a) return;
  const c = course(data);
  const time = num(o.time, num(data.tern, 30) * num(o.paceX, 1.1));
  race.opp = { id: a.id, s: 0, time, done: false, doneT: 0, path: !!(data.opponent && a.data?.path) };
  a.mode = 'race';
  a.s = 0;
  if (!race.opp.path) placeOnCourse(a, c.track, 0);
}
// A rival starts beside you (OPP_SIDE u to the right of the line) and merges onto the line over OPP_MERGE u.
const OPP_SIDE = 4, OPP_MERGE = 40;
function placeOnCourse(a, track, sAt) {
  trackAt(track, sAt, P4);
  const side = OPP_SIDE * Math.max(0, 1 - sAt / OPP_MERGE);
  a.pos[0] = P4[0] + Math.cos(P4[3]) * side; a.pos[1] = P4[1] - Math.sin(P4[3]) * side; a.pos[2] = P4[2];
  a.yaw = P4[3];
}
function resetOpponent(game, data) {
  const o = data?.opponent || data?.rival;
  const a = o?.actor ? actorById(game, o.actor) : null;
  if (!a) return;
  a.mode = 'idle';
  a.s = 0;
  a.speed = 0; a.vel[0] = 0; a.vel[1] = 0; a.vel[2] = 0;
  if (a.data?.path && data.opponent) {
    trackAt(trackOf(a.data.path, false), 0, P4);
    a.pos[0] = P4[0]; a.pos[1] = P4[1]; a.pos[2] = P4[2];
  }
  else placeOnCourse(a, course(data).track, 0);
}
const P4 = [0, 0, 0, 0];
function stepOpponent(game, data, race, dt) {
  const o = race.opp;
  if (!o || o.done) return;
  const a = actorById(game, o.id);
  if (!a) { race.opp = null; return; }
  const c = course(data);
  const tr = o.path ? trackOf(a.data.path, false) : c.track;
  let v = tr.L / o.time;
  // Vela's band (Cruise only): slower when she leads by RIVAL_LEAD, faster when she trails, off for the last 15%.
  if (data.rival && game.settings?.assists !== 'pilot' && o.s < tr.L * (1 - game.tune.RACE.RIVAL_OFF)) {
    const R = game.tune.RACE;
    const mine = nearestOn(c.track, game.ship.pos);
    const lead = o.s - mine;
    if (lead > R.RIVAL_LEAD) v *= R.RIVAL_SLOW;
    else if (lead < -R.RIVAL_TRAIL) v = Math.min(v * R.RIVAL_FAST, (c.L / num(data.tern, 30)) * R.RIVAL_CAP);
  }
  if (a.spinT > 0) v *= 0.4;
  o.s = Math.min(tr.L, o.s + v * dt);
  if (o.path) { trackAt(tr, o.s, P4); a.pos[0] = P4[0]; a.pos[1] = P4[1]; a.pos[2] = P4[2]; a.yaw = P4[3]; }
  else placeOnCourse(a, tr, o.s);
  a.vel[0] = Math.sin(a.yaw) * v; a.vel[1] = Math.cos(a.yaw) * v; a.vel[2] = 0;
  a.speed = v;
  if (o.s >= tr.L - 1e-6) { o.done = true; o.doneT = game.eventT; }
}

function stepTimed(game, dt, ev) {
  const race = game.race;
  const R = game.tune.RACE;
  const data = eventById(game, race.id);
  if (!data) { game.race = null; game.activity = null; return; }
  const ship = game.ship;
  const c = course(data);

  if (race.state === 'finished') {
    if (game.t - race.finishedAt > FINISH_SHOW) game.race = null;
    return;
  }
  if (race.state === 'restart') {
    if (game.t >= race.controlAt - 1e-9) toRunIn(game, data, race);
    return;
  }
  if (race.state === 'armed') {
    // The run-in: race speed until the start ring.
    setSpeed(ship, R.START_S);
    const f = crossing(ship.prev.pos, ship.pos, c.start.pos, c.start.dir);
    if (f >= 0 && CROSS.r <= c.start.r + R.CLIP * 2) {
      race.state = 'running';
      race.norm = R.START_FLASH;
      game.eventT = (1 - f) * dt;
      game.zoneT = race.z0 + game.eventT;
      race.rec = createRecorder(R.GHOST_HZ, Math.max(60, num(data.bronze, 30) * 2));
      race.gate = 0; race.lastGate = -1; race.splits = []; race.pen = 0; race.misses = 0; race.bullseyes = 0;
      race.lap = 1; race.offT = 0; race.turnT = 0; race.toGates = 0;
      if (ev) ev.push('eventStart', { id: race.id, flash: R.START_FLASH, restart: true });
      startOpponent(game, data, race);
    } else if (game.t - race.armT > ARMED_MAX) {
      cancelEvent(game, ev, true);
    }
    return;
  }

  // Running. The start flash eases the speed to START_S and the bar to START_BAR.
  if (race.norm > 0) {
    const frac = race.norm > dt ? dt / race.norm : 1;
    setSpeed(ship, ship.speed + (R.START_S - ship.speed) * frac);
    ship.bar += (R.START_BAR - ship.bar) * frac;
    ship.drift.charge = 0; ship.drift.tier = 0;
    race.norm -= dt;
    if (race.norm <= 1e-9) { race.norm = 0; setSpeed(ship, R.START_S); ship.bar = R.START_BAR; }
  }
  race.t = game.eventT + race.pen;
  if (dt > 0) record(race.rec, ship, flagsOf(ship, game.t), game.eventT);
  stepOpponent(game, data, race, dt);

  // Gates: the next one, or the one after it cleanly (then the skipped one is a miss).
  for (let k = 0; k < 2; k++) {
    const g = c.gates[race.gate + k];
    if (!g) break;
    const f = crossing(ship.prev.pos, ship.pos, g.pos, g.n);
    if (f < 0 || CROSS.r > GATE_REACH) continue;
    const d = CROSS.r;
    if (k === 1) {
      if (d > g.r + R.CLIP) continue;
      miss(game, race, c.gates[race.gate], ev);
    }
    passGate(game, data, race, g, d, f, dt, ev);
    break;
  }
  if (race.state !== 'running') return;

  // Accidental starts cancel quietly before gate 2: the first gate too late, or turned away for a while.
  if (race.gate < 2) {
    const g = c.gates[race.gate];
    if (race.gate === 0 && game.eventT > race.firstAt) { cancelEvent(game, ev, true); return; }
    if (g) {
      const want = Math.atan2(g.pos[0] - ship.pos[0], g.pos[1] - ship.pos[1]);
      const head = Math.atan2(ship.vel[0], ship.vel[1]);
      const off = Math.abs(Math.atan2(Math.sin(want - head), Math.cos(want - head)));
      race.turnT = off > R.CANCEL_TURN * DEG ? race.turnT + dt : 0;
      if (race.turnT > R.CANCEL_TURN_T) { cancelEvent(game, ev, true); return; }
    }
  }
  // Off course: a chevron after OFF_CHEVRON s, back to the last gate after OFF_BACK s.
  if ((game.steps & 7) === 0) {
    const s = nearestOn(c.track, ship.pos);
    trackAt(c.track, s, P4);
    race.offD = Math.hypot(ship.pos[0] - P4[0], ship.pos[1] - P4[1], ship.pos[2] - P4[2]);
  }
  if (num(race.offD) > R.OFF_COURSE) {
    race.offT += dt;
    race.off = race.offT > R.OFF_CHEVRON;
    if (race.offT > R.OFF_BACK) toLastGate(game, ev);
  } else {
    race.offT = 0; race.off = false;
  }
}

function miss(game, race, g, ev, d = null) {
  const R = game.tune.RACE;
  race.misses++;
  race.pen += R.MISS_PEN;
  if (ev) ev.push('gateMiss', { id: race.id, i: g.i, pen: R.MISS_PEN, d });
  race.gate++;
}

function passGate(game, data, race, g, d, f, dt, ev) {
  const R = game.tune.RACE;
  const ship = game.ship;
  let kind = d <= R.BULLSEYE ? 'bullseye' : d <= g.r ? 'pass' : d <= g.r + R.CLIP ? 'clip' : 'miss';
  if (kind === 'miss') miss(game, race, g, ev, d);
  else {
    race.gate++;
    if (ev) ev.push('gate', { id: race.id, i: g.i, kind, name: g.name, d });
    if (kind === 'bullseye') {
      race.bullseyes++;
      race.points += POINTS.bullseye;
      addBar(ship, game.tune.BAR.BULLSEYE);
      chainEvent(ship, game.t, POINTS.bullseye, ev, game.tune);
    }
  }
  race.lastGate = g.i;
  const time = game.eventT - (1 - f) * dt + race.pen;
  if (g.split) {
    const best = game.progress.events?.[race.id]?.splits?.[race.splits.length];
    const delta = Number.isFinite(best) ? time - best : null;
    race.splits.push(time);
    if (ev) ev.push('split', { id: race.id, i: g.i, time, delta });
  }
  if (g.lapEnd && !g.finish) {
    race.lap++;
    if (ev) ev.push('lap', { id: race.id, lap: race.lap, time });
  }
  if (g.finish) finish(game, data, race, time, ev);
}

function finish(game, data, race, time, ev) {
  const prog = game.progress.events || (game.progress.events = {});
  const old = prog[race.id] || null;
  const medal = medalOf(data, time);
  const record = !(Number.isFinite(old?.best) && old.best <= time);
  const pilot = game.settings?.assists === 'pilot';
  const opp = race.opp;
  const win = opp ? !opp.done || time < opp.doneT : null;
  const hadGold = Object.values(prog).some((p) => p?.medal === 'gold' || p?.medal === 'tern');
  const next = {
    best: record ? time : old.best, medal: betterMedal(old?.medal || null, medal), pilot: record ? pilot : !!old?.pilot,
    splits: record ? race.splits.slice() : old?.splits || [], tries: num(old?.tries) + 1,
    noMedal: medal ? 0 : num(old?.noMedal) + 1, wins: num(old?.wins) + (win ? 1 : 0), seen: true,
  };
  prog[race.id] = next;
  race.state = 'finished';
  race.finishedAt = game.t;
  race.t = time;
  race.result = { time, medal, misses: race.misses, bullseyes: race.bullseyes, record, win, pilot,
    prevBest: old?.best ?? null };
  game.activity = null;
  if (ev) {
    ev.push('finish', { id: race.id, medal, time, best: old?.best ?? null, record, win,
      ghost: record ? encode(race.rec) : null, short: data.short || data.title || race.id,
      firstGold: (medal === 'gold' || medal === 'tern') && !hadGold });
  }
  if (opp) resetOpponent(game, data);
}

// The start rings: seen at RACE.SEEN, armed at RACE.ARM within ARM_CONE, started by crossing them within START_CONE.
function stepStarts(game, dt, ev) {
  const R = game.tune.RACE;
  const ship = game.ship;
  const zr = game.zone;
  const busy = game.mission && game.mission.state !== 'done';
  if (!zr.armed) zr.armed = {};
  for (const data of eventsOf(game)) {
    if (!isTimed(data) || !data.start) continue;
    const c = course(data);
    const sp = c.start.pos;
    const dx = sp[0] - ship.pos[0], dy = sp[1] - ship.pos[1];
    const d = Math.hypot(dx, dy);
    if (d <= R.SEEN && !zr.seen[data.id]) {
      zr.seen[data.id] = true;
      const pe = game.progress.events || (game.progress.events = {});
      if (!pe[data.id]) pe[data.id] = { seen: true };
      if (ev) ev.push('eventSeen', { id: data.id });
    }
    if (busy) continue;
    const head = Math.atan2(ship.vel[0], ship.vel[1]);
    const to = Math.atan2(dx, dy);
    const off = Math.abs(Math.atan2(Math.sin(to - head), Math.cos(to - head)));
    if (d <= R.ARM && off <= R.ARM_CONE * DEG) {
      if (!zr.armed[data.id]) { zr.armed[data.id] = true; if (ev) ev.push('eventArm', { id: data.id }); }
    } else if (d > R.ARM * 1.5) {
      zr.armed[data.id] = false;
    }
    if (d > 60) continue;
    const f = crossing(ship.prev.pos, ship.pos, sp, c.start.dir);
    if (f < 0 || CROSS.r > c.start.r + R.CLIP) continue;
    const vx = ship.vel[0], vy = ship.vel[1];
    const along = (vx * c.start.dir[0] + vy * c.start.dir[1]) / (Math.hypot(vx, vy) || 1);
    if (along < Math.cos(R.START_CONE * DEG)) continue;
    startEvent(game, data.id, { ev, f, dt });
    return;
  }
}

// ---------------------------------------------------------------- stunts and pads

function stuntRec(game, id) {
  const p = game.progress.stunts || (game.progress.stunts = {});
  return p[id] || null;
}

function stuntDone(game, data, value, ev, quietly = false) {
  const stars = starsOf(data, value);
  const p = game.progress.stunts || (game.progress.stunts = {});
  const old = p[data.id] || { stars: 0, best: null };
  const v = typeof value === 'number' ? value : num(value?.speed, num(value?.n));
  p[data.id] = { stars: Math.max(old.stars || 0, stars), best: old.best === null ? v : Math.max(num(old.best), v) };
  const st = game.stunt;
  game.stunt = null;
  const zr = game.zone;
  zr.retry = { id: data.id, until: game.t + game.tune.RACE.RETRY_SHOW, dir: st?.dir || null };
  if (ev) {
    ev.push('stuntResult', { id: data.id, stars, value: v, best: p[data.id].best, prevStars: old.stars || 0,
      quiet: quietly || !!(game.race && game.race.state === 'running') });
  }
  return stars;
}

function beginStunt(game, data, value, ev, extra = null) {
  const old = stuntRec(game, data.id);
  const h = Math.atan2(game.ship.vel[0], game.ship.vel[1]);
  game.stunt = { id: data.id, t: 0, value, best: old?.best ?? null, dir: [Math.sin(h), Math.cos(h)], ...(extra || {}) };
  if (ev) ev.push('stuntStart', { id: data.id });
}

const roadTrackOf = (game, id) => {
  const r = (zoneOf(game)?.roads || []).find((x) => x.id === id && x.kind === 'road');
  return r ? { tr: trackOf(r.pts, false), r } : null;
};

function stepStunts(game, dt, ev) {
  const ship = game.ship;
  const z = zoneOf(game);
  const list = z?.events || [];
  const t = game.t;
  const i0 = firstNew(ev, t);

  // Pads (every line's pads, always live).
  stepPads(game, list, ev);
  const st = game.stunt;

  if (st) {
    const data = list.find((e) => e.id === st.id);
    if (!data) { game.stunt = null; return; }
    st.t += dt;
    switch (data.type) {
      case 'drift': {
        const c = data.area.centre;
        const inside = Math.hypot(ship.pos[0] - c[0], ship.pos[1] - c[1]) <= data.area.r;
        st.out = inside ? 0 : num(st.out) + dt;
        st.value = ship.drift.on ? ship.drift.tier : st.value;
        for (let i = i0; i < ev?.n; i++) {
          const e = ev.list[i];
          if (e.type === 'driftBoost') { stuntDone(game, data, e.tier, ev); return; }
          if (e.type === 'driftLost') { game.stunt = null; return; }
        }
        if (!ship.drift.on || st.out > 1) game.stunt = null;
        return;
      }
      case 'oncoming': {
        for (let i = i0; i < ev?.n; i++) {
          const e = ev.list[i];
          if (e.type === 'near' || e.type === 'hairline' || e.type === 'thread') st.value++;
        }
        if (st.t >= num(data['window'], 10)) stuntDone(game, data, st.value, ev);
        return;
      }
      case 'line': {
        const pads = data.pads;
        if (st.next >= pads.length) {
          st.exitMax = Math.max(num(st.exitMax), ship.speed);
          if (t - st.lastT > 1) {
            stuntDone(game, data, { all: true, exit: st.exitMax >= num(data.exitSpeed, 44), perfect: st.perfect >= pads.length,
              n: pads.length }, ev);
          }
        } else if (t - st.lastT > num(data['window'], game.tune.RACE.LINE_WINDOW) + 0.2) {
          if (st.next >= 2) stuntDone(game, data, { all: false, n: st.next }, ev);
          else game.stunt = null;
        }
        return;
      }
      case 'skim': {
        st.value = ship.skim.on && ship.skim.body === data.body ? ship.skim.t : st.value;
        for (let i = i0; i < ev?.n; i++) {
          const e = ev.list[i];
          if (e.type === 'skimEnd' && e.body === data.body) { stuntDone(game, data, e.t, ev); return; }
        }
        if (!ship.skim.on) stuntDone(game, data, st.value, ev);
        return;
      }
      case 'sling': {
        const b = (z.bodies || []).find((x) => x.id === data.body);
        const rs = b?.well?.rs || 10;
        if (!b) { game.stunt = null; return; }
        if (Math.hypot(ship.pos[0] - b.pos[0], ship.pos[1] - b.pos[1]) > 3 * rs) stuntDone(game, data, ship.speed, ev);
        else if (st.t > 8) game.stunt = null;
        return;
      }
      case 'thread': {
        for (let i = i0; i < ev?.n; i++) {
          const e = ev.list[i];
          if (e.type === 'scrape' || e.type === 'crash') st.clean = false;
        }
        if (t - st.at > 0.3) stuntDone(game, data, { clean: st.clean, speed: st.speed }, ev);
        return;
      }
      default:
        game.stunt = null;
        return;
    }
  }

  // Starts.
  for (const data of list) {
    switch (data.type) {
      case 'drift': {
        if (!ship.drift.on) break;
        const c = data.area.centre;
        if (Math.hypot(ship.pos[0] - c[0], ship.pos[1] - c[1]) <= data.area.r) {
          beginStunt(game, data, ship.drift.tier, ev);
          return;
        }
        break;
      }
      case 'trap': {
        const ring = data.ring;
        if (segDist(ship.prev.pos, ship.pos, ring.pos) <= num(ring.r, 6)) {
          if (game.zone.trapAt?.[data.id] > t - 1) break;
          (game.zone.trapAt || (game.zone.trapAt = {}))[data.id] = t;
          beginStunt(game, data, ship.speed, ev);
          stuntDone(game, data, ship.speed, ev);
          return;
        }
        break;
      }
      case 'oncoming': {
        if ((game.steps & 3) !== 0) break;
        const rt = roadTrackOf(game, data.road);
        if (!rt) break;
        const s = nearestOn(rt.tr, ship.pos);
        trackAt(rt.tr, s, P4);
        const tube = Array.isArray(rt.r.tube) ? Math.max(...rt.r.tube.map((x) => x[2])) : num(rt.r.tube, 15);
        if (Math.hypot(ship.pos[0] - P4[0], ship.pos[1] - P4[1]) > tube) break;
        const flow = rt.r.flow < 0 ? -1 : 1;
        const along = (ship.vel[0] * Math.sin(P4[3]) + ship.vel[1] * Math.cos(P4[3])) * flow;
        if (along < -0.6 * ship.speed && ship.speed > 12) { beginStunt(game, data, 0, ev); return; }
        break;
      }
      case 'skim': {
        if (ship.skim.on && ship.skim.body === data.body) { beginStunt(game, data, ship.skim.t, ev); return; }
        break;
      }
      case 'sling': {
        for (let i = i0; i < ev?.n; i++) {
          const e = ev.list[i];
          if (e.type === 'sling' && e.body === data.body && e.turn >= num(data.minTurn, 90) * DEG) {
            beginStunt(game, data, ship.speed, ev);
            return;
          }
        }
        break;
      }
      case 'thread': {
        const ring = data.ring;
        const n = ring.normal || [1, 0, 0];
        let f = crossing(ship.prev.pos, ship.pos, ring.pos, n);
        if (f < 0) f = crossing(ship.prev.pos, ship.pos, ring.pos, [-n[0], -n[1], -n[2] || 0]);
        if (f >= 0 && CROSS.r <= num(ring.r, 2.5)) {
          let clean = true;
          for (let i = i0; i < ev?.n; i++) if (ev.list[i].type === 'scrape' || ev.list[i].type === 'crash') clean = false;
          if (t - num(ship.lastHitT, -99) < 1) clean = false;          // no contact in the last second
          beginStunt(game, data, ship.speed, ev, { at: t, clean, speed: ship.speed });
          return;
        }
        break;
      }
      default: break;
    }
  }
}

// Light pads: a kick for every pad you pass within PAD_R; a Light Line counts pads in a row.
function stepPads(game, list, ev) {
  const ship = game.ship;
  const R = game.tune.RACE, B = game.tune.BAR;
  const zr = game.zone;
  const t = game.t;
  for (const data of list) {
    if (data.type !== 'line' || !Array.isArray(data.pads)) continue;
    for (let i = 0; i < data.pads.length; i++) {
      const p = data.pads[i];
      if (Math.abs(p[0] - ship.pos[0]) > 50 || Math.abs(p[1] - ship.pos[1]) > 50) continue;
      const d = segDist(ship.prev.pos, ship.pos, p);
      if (d > PAD_R) continue;
      const key = `${data.id}:${i}`;
      const cool = zr.padT || (zr.padT = {});
      if (cool[key] > t - PAD_COOL) continue;
      cool[key] = t;
      const perfect = d <= R.PAD_PERFECT_R;
      padKick(ship, perfect, game.tune);
      addBar(ship, perfect ? B.PAD_PERFECT : B.PAD);
      chainEvent(ship, t, perfect ? POINTS.padPerfect : POINTS.pad, ev, game.tune);
      if (ev) ev.push(perfect ? 'padPerfect' : 'pad', { id: data.id, i, of: data.pads.length });
      // The line.
      const st = game.stunt;
      if (st && st.id === data.id) {
        if (i === st.next) { st.next++; st.lastT = t; if (perfect) st.perfect++; st.value = st.next; }
      } else if (!st && i === 0) {
        beginStunt(game, data, 1, ev, { next: 1, lastT: t, perfect: perfect ? 1 : 0, exitMax: 0 });
      }
    }
  }
}

/** stuntRetry(game, ev): the RETRY chip: back to the stunt's run-up at race speed with a half bar. */
export function stuntRetry(game, ev = null) {
  const r = game.zone.retry;
  if (!r || game.t > r.until) return false;
  const data = eventById(game, r.id);
  if (!data) return false;
  const R = game.tune.RACE;
  let at, yaw;
  const d = r.dir || [0, 1];
  const back = (p, u) => [p[0] - d[0] * u, p[1] - d[1] * u, p[2] || 0];
  if (data.type === 'trap') { at = back(data.ring.pos, R.STUNT_RUNUP_TRAP); }
  else if (data.type === 'drift') { at = back([...data.area.centre, 0], data.area.r + R.STUNT_RUNUP); }
  else if (data.type === 'line') {
    const a = data.pads[0], b = data.pads[1] || a;
    const u = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dd = [(b[0] - a[0]) / u, (b[1] - a[1]) / u];
    at = [a[0] - dd[0] * R.STUNT_RUNUP, a[1] - dd[1] * R.STUNT_RUNUP, a[2] || 0];
    yaw = Math.atan2(dd[0], dd[1]);
  } else if (data.type === 'thread') { at = back(data.ring.pos, R.STUNT_RUNUP); }
  else {
    const b = (zoneOf(game)?.bodies || []).find((x) => x.id === data.body);
    if (!b) return false;
    at = back(b.pos, 3 * (b.well?.rs || 10) + R.STUNT_RUNUP);
  }
  placeShip(game, at, yaw ?? Math.atan2(d[0], d[1]), R.START_S);
  calmShip(game.ship, R.START_BAR);
  game.stunt = null;
  game.zone.retry = null;
  lock(game, R.CONTROL_BACK - R.RESTART_HOLD);
  if (ev) ev.push('restart', { id: data.id, stunt: true });
  return true;
}

// ---------------------------------------------------------------- the step

/** stepRace(game, dt, ev): game.js's race slot: timed events, then stunts and pads. */
export function stepRace(game, dt, ev) {
  if (!game.zone) return;
  if (game.race) stepTimed(game, dt, ev);
  else stepStarts(game, dt, ev);
  const restarting = game.race && (game.race.state === 'restart' || game.race.state === 'armed');
  if (!restarting) stepStunts(game, dt, ev);
}

// For bots and tests: the built traffic of the zone (pass-through so they need not import game.js).
export const builtFor = (game) => builtOf(game);
