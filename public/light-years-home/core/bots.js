// Light Years Home v3: bots (final.md 18.2). A bot turns the game state into an InputRecord, so the same bots run in
// node tests, through the hook and live with ?bot=. Each has its own seeded random stream; none reads anything the
// player could not see. BOTS[name].make(opts) → { next(game) → InputRecord }.
//   idle, random, wander, drifter      the toy and density bots
//   beginner, mid, expert              pure pursuit on an event's course (opts.event): beginner is one thumb with the
//                                      gas held, no drift, boost only on a full bar; mid boosts at 0.5 and drifts the
//                                      sharp corners; expert drift-boosts every corner, boosts at 0.3
//   mission                            the current objective with a helper per goal (chase and ram, catch, far scans,
//                                      hook, drop, stunts)
//   story                              the Wall's story path: the on-ramp drift, Node 0, WHICH WAY HOME, then JUMP
import { mulberry32, hashSeed } from './rng.js';
import { makeInput, zoneOf, builtOf } from './game.js';
import { query, rebuildTraffic, STATIC_BASE } from './collide.js';
import { posAt, velAt } from './traffic.js';
import { course, eventById } from './race.js';
import { trackAt, nearestOn, actorById } from './actors.js';
import { farDir, actionOf } from './zone.js';
import { JUMP_BOTS } from './jump.js';
import { missionById } from './world/missions/ch1.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const hyp = (dx, dy) => Math.sqrt(dx * dx + dy * dy);

// ---------------------------------------------------------------- steering helpers

const velHeading = (s) => (s.speed > 2 ? Math.atan2(s.vel[0], s.vel[1]) : s.yaw);

/**
 * steerTo(game, heading, k, max) → steer toward a heading (radians clockwise from +y): proportional on the nose's
 * error, damped by the yaw rate so it settles instead of weaving. max below AUTO_STEER keeps touch from drifting.
 */
export function steerTo(game, heading, k = 2.2, max = 1) {
  const s = game.ship;
  const err = wrap(heading - (s.drift?.on ? velHeading(s) : s.yaw));
  return clamp(k * err - 0.3 * (s.yawRate || 0), -max, max);
}

/** aimAt(game, x, y) → the heading from the ship to a point. */
export const aimAt = (game, x, y) => Math.atan2(x - game.ship.pos[0], y - game.ship.pos[1]);

// Keep near the plane (z 0) with the climb axis: bots fly the zone's plane like a player who never climbs.
export function holdHeight(game, r, z = 0) {
  const dz = z - game.ship.pos[2];
  r.climb = Math.abs(dz) > 1 ? clamp(dz * 0.12 - game.ship.pitch * 1.5, -0.6, 0.6) : 0;
  return r;
}

function rec(source = 'keys', over = null) {
  const r = makeInput({ source, autoDrift: source === 'touch' });
  return over ? Object.assign(r, over) : r;
}

// A drift round a body: pass it at R + 6 u on the given side, hold the drift steering to keep R from its centre,
// let go at the tier wanted once the travel line has turned enough (hold: only once it has turned `turn`, for a full
// lap). Returns a small state machine.
function driftRound(centre, { R = 13, side = -1, tier = 2, turn = 2.2, hold = false } = {}) {
  const st = { phase: 'approach', turned: 0, last: 0, done: false };
  st.next = (game, r) => {
    const s = game.ship, p = s.pos;
    const dx = centre[0] - p[0], dy = centre[1] - p[1], d = hyp(dx, dy);
    const toG = Math.atan2(dx, dy), vang = velHeading(s);
    if (st.phase === 'approach') {
      const off = Math.asin(clamp((R + 6) / Math.max(d, R + 6), -1, 1)) * -side;
      if (d < R + 14 && wrap(toG - s.yaw) * side > 0.6) { st.phase = 'drift'; st.last = vang; }
      r.steer = clamp(3 * wrap(toG + off - s.yaw), -1, 1);
      r.gas = 1;
      return r;
    }
    if (st.phase === 'drift') {
      st.turned += Math.abs(wrap(vang - st.last));
      st.last = vang;
      if (hold ? st.turned > turn : (s.drift.tier >= tier && st.turned > turn) || s.drift.tier >= 3 || st.turned > 7) {
        st.phase = 'out'; st.done = true;
        r.drift = false;
        return r;
      }
      r.steer = side * clamp(0.55 + (2.5 * (d - R)) / R, 0.1, 1);
      r.drift = true;
      r.gas = 1;
      return r;
    }
    return r;
  };
  return st;
}

// ---------------------------------------------------------------- simple bots

const idle = { make: () => ({ next: () => rec('touch') }) };

const random = {
  make({ seed = 1, source = 'touch' } = {}) {
    const rng = mulberry32(hashSeed('bot-random', seed));
    let next = 0, steer = 0;
    const r = rec(source);
    return { next(game) {
      if (game.t >= next) { steer = rng() * 2 - 1; next = game.t + 0.5 + rng(); }
      r.steer = steer;
      return r;
    } };
  },
};

// Random goals inside the rim, pure pursuit, boost when the bar is over 0.5.
const wander = {
  make({ seed = 1, source = 'keys', R = null } = {}) {
    const rng = mulberry32(hashSeed('bot-wander', seed));
    let goal = null;
    const r = rec(source);
    return { next(game) {
      const s = game.ship;
      const rim = (R ?? 400) * 0.85;
      if (!goal || hyp(goal[0] - s.pos[0], goal[1] - s.pos[1]) < 25 || game.t > goal[2]) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * rim;
        goal = [Math.cos(a) * d, Math.sin(a) * d, game.t + 30];
      }
      r.steer = steerTo(game, aimAt(game, goal[0], goal[1]));
      r.gas = 1;
      r.boost = s.boosting ? s.bar > 0.1 : s.bar > 0.5;
      return r;
    } };
  },
};

// Drives at the nearest big body (or opts.body) and drifts round it, releasing at tier 2 or 3, then again. lap: hold
// each drift for a full lap of the body (The Shadow).
const drifter = {
  make({ body = null, tier = 2, source = 'keys', lap = false, R = null } = {}) {
    let dr = null;
    const r = rec(source);
    return { next(game) {
      r.drift = false; r.steer = 0; r.gas = 1;
      if (!dr || dr.done) {
        const bodies = (zoneOf(game)?.bodies || []).filter((b) => (body ? b.id === body : b.r >= 8));
        const s = game.ship;
        bodies.sort((a, b) => hyp(a.pos[0] - s.pos[0], a.pos[1] - s.pos[1]) - hyp(b.pos[0] - s.pos[0], b.pos[1] - s.pos[1]));
        const b = bodies[0];
        if (!b) return r;
        if (dr && dr.done && hyp(b.pos[0] - s.pos[0], b.pos[1] - s.pos[1]) < 60) {
          r.steer = steerTo(game, aimAt(game, b.pos[0], b.pos[1]) + Math.PI);    // go out before the next lap
          return r;
        }
        const rr = R ?? Math.max(13, (b.well?.rs || 10) * 0.95);
        dr = driftRound(b.pos, lap ? { R: rr, tier, turn: TAU + 0.4, hold: true } : { R: rr, tier });
      }
      return dr.next(game, r);
    } };
  },
};

// ---------------------------------------------------------------- race bots

const SKILL = {
  beginner: { source: 'touch', boostAt: 0.99, keepTo: 0.1, drift: false, k: 2.4, lag: 0.18, noise: 0.12, max: 0.8,
    lanes: true, avoid: 0 },
  mid: { source: 'keys', boostAt: 0.45, keepTo: 0.1, drift: 'sharp', k: 2.4, lag: 0.1, noise: 0, max: 1, lanes: true,
    lift: true },
  expert: { source: 'keys', boostAt: 0.05, keepTo: 0.02, drift: 'all', k: 2.6, lag: 0, noise: 0, max: 1, lanes: true,
    lift: true },
};

// The speed a turn of radius R allows without a drift (full steer turns at about v / yawMax(v)).
function vForR(R, tune) {
  const S = tune.SHIP;
  let lo = 0, hi = S.S_CAP;
  for (let i = 0; i < 24; i++) {
    const v = (lo + hi) / 2;
    const ym = v < S.PIVOT_S ? S.YAW_PIVOT : S.YAW_LO + (S.YAW_HI - S.YAW_LO) * clamp(v / S.S_TOP, 0, 1);
    if (v / ym <= 0.8 * R) lo = v; else hi = v;
  }
  return lo;
}

const P = [0, 0, 0, 0], Q = [0, 0, 0, 0], RQ = [0, 0, 0, 0];

// Lane choice: among lateral offsets from the course's centre line, the one that stays clearest of the traffic
// over the next second (each body moved on its own velocity), with a small pull to the current lane and the centre.
const LANES = [-4.5, -3, -1.5, 0, 1.5, 3, 4.5];
const LANE_T = 0.45;          // s to move across to a new lane
const LIDS = new Int32Array(256), LB = new Float64Array(256 * 5);
function laneChoice(game, c, sNow, lim, cur) {
  const built = gridNow(game);
  if (!built) return 0;
  const s = game.ship, tr = built.traffic;
  const n0 = query(built.grid, s.pos, 14 + s.speed * 1.1, LIDS);
  let n = 0;
  for (let i = 0; i < n0 && n < 256; i++) {
    const id = LIDS[i];
    if (id >= STATIC_BASE) {
      const b = built.statics?.[id - STATIC_BASE];
      if (!b) continue;
      LB[n * 5] = b.pos[0]; LB[n * 5 + 1] = b.pos[1]; LB[n * 5 + 2] = 0; LB[n * 5 + 3] = 0; LB[n * 5 + 4] = b.rc;
    } else {
      if (!(tr.rc[id] > 0.45)) continue;
      posAt(tr, id, game.zoneT, BP);
      if (Math.abs(BP[2] - s.pos[2]) > tr.rc[id] + 2.5) continue;
      velAt(tr, id, game.zoneT, BV);
      LB[n * 5] = BP[0]; LB[n * 5 + 1] = BP[1]; LB[n * 5 + 2] = BV[0]; LB[n * 5 + 3] = BV[1]; LB[n * 5 + 4] = tr.rc[id];
    }
    n++;
  }
  if (!n) return cur * 0.98;
  // Where the ship is across the course now: it moves to a new lane over about LANE_T s.
  trackAt(c.track, sNow, P);
  const lat0 = (s.pos[0] - P[0]) * Math.cos(P[3]) - (s.pos[1] - P[1]) * Math.sin(P[3]);
  const clearOf = (off, slow) => {
    let clear = 6;
    for (let k = 1; k <= 7; k++) {
      const tt = k * 0.15;
      trackAt(c.track, sNow + s.speed * slow * tt, P);
      const lat = lat0 + (off - lat0) * Math.min(1, tt / LANE_T);
      const x = P[0] + Math.cos(P[3]) * lat, y = P[1] - Math.sin(P[3]) * lat;
      for (let j = 0; j < n; j++) {
        const d = Math.hypot(LB[j * 5] + LB[j * 5 + 2] * tt - x, LB[j * 5 + 1] + LB[j * 5 + 3] * tt - y) - LB[j * 5 + 4] - 0.4;
        if (d < clear) clear = d;
      }
    }
    return clear;
  };
  let best = cur, bestScore = -Infinity, bestClear = 6;
  for (const off of LANES) {
    if (Math.abs(off) > lim) continue;
    const clear = clearOf(off, 1);
    const score = Math.min(clear, 3) - 0.12 * Math.abs(off - cur) - 0.05 * Math.abs(off);
    if (score > bestScore) { bestScore = score; best = off; bestClear = clear; }
  }
  // Every lane is blocked at this speed: lift and brake if that lets it pass (something crossing a gate).
  LANE.lift = bestClear < 0.3 && clearOf(best, 0.7) > 1;
  return best;
}
const LANE = { lift: false };

/**
 * A race bot for one event: from wherever it is, drives to the start ring along the run-up line, then pure pursuit
 * on the course, aiming through each gate's centre. skill: 'beginner' | 'mid' | 'expert'.
 */
function raceBot(skillName) {
  return {
    make({ event, seed = 1 } = {}) {
      const sk = SKILL[skillName];
      const rng = mulberry32(hashSeed('bot-race', skillName, seed));
      const r = rec(sk.source);
      const mem = { id: -1, side: 0, until: 0 };
      const hist = [];
      let noise = 0, noiseT = 0, drifting = false, driftDir = 0, lane = 0, lift = false;
      return { next(game) {
        const ev = eventById(game, event);
        r.steer = 0; r.gas = 1; r.brake = 0; r.boost = false; r.drift = false; r.climb = 0;
        if (!ev) return r;
        const c = course(ev);
        const s = game.ship;
        const race = game.race;
        // Before the clock: line up and drive through the start ring.
        let target;
        if (!race || race.id !== event || race.state === 'finished') {
          const back = 25;
          const lx = c.start.pos[0] - c.start.dir[0] * back, ly = c.start.pos[1] - c.start.dir[1] * back;
          const dl = hyp(lx - s.pos[0], ly - s.pos[1]);
          const ahead = (s.pos[0] - c.start.pos[0]) * c.start.dir[0] + (s.pos[1] - c.start.pos[1]) * c.start.dir[1];
          target = dl > 12 && ahead < -back + 4 ? [lx, ly]
            : [c.start.pos[0] + c.start.dir[0] * 10, c.start.pos[1] + c.start.dir[1] * 10];
          r.steer = avoid(game, steerTo(game, aimAt(game, target[0], target[1]), sk.k, sk.max), dl > 12 ? 1 : 0.4, mem);
          return r;
        }
        const sNow = nearestOn(c.track, s.pos);
        const Ld = clamp(0.3 * s.speed + 3, 5, 18);
        // The lane: clear of traffic, held inside the next gate's ring when it is close.
        const g = c.gates[race.gate];
        const dg = g ? hyp(g.pos[0] - s.pos[0], g.pos[1] - s.pos[1]) : Infinity;
        const soon = Math.max(30, s.speed * 1.3);
        const lim = dg < soon ? Math.max(0, g.r - 2) : 4.5;
        if ((game.steps & 3) === 0) {
          LANE.lift = false;
          lane = sk.lanes ? laneChoice(game, c, sNow, lim, clamp(lane, -lim, lim)) : 0;
          lift = !!sk.lift && LANE.lift;
        }
        trackAt(c.track, sNow + Ld, P);
        P[0] += Math.cos(P[3]) * lane; P[1] -= Math.sin(P[3]) * lane;
        // Line up with the next gate a second out: aim at a point before it on its axis, then through it.
        if (g && dg < Math.max(Ld + 6, s.speed * 1.1)) {
          const o = clamp(lane, -lim, lim);
          const back = clamp(dg - 8, 0, 14);
          P[0] = g.pos[0] - g.n[0] * back + g.n[0] * 4 + g.n[1] * o;
          P[1] = g.pos[1] - g.n[1] * back + g.n[1] * 4 - g.n[0] * o;
        }
        let want = aimAt(game, P[0], P[1]);
        // The corner ahead: how sharp, how far.
        trackAt(c.track, sNow + 6, Q);
        trackAt(c.track, sNow + Math.max(30, s.speed * 1.4), RQ);
        const turnAhead = Math.abs(wrap(RQ[3] - Q[3]));
        if (skillName === 'beginner') {
          noiseT -= 1 / 120;
          if (noiseT <= 0) { noise = (rng() * 2 - 1) * sk.noise; noiseT = 0.5 + rng(); }
        }
        // Drift the sharp corners (mid) or every corner (expert).
        const wantDrift = sk.drift && s.speed > 18 && turnAhead > (sk.drift === 'all' ? 0.7 : 1.1);
        const err = wrap(want - (0.6 * velHeading(s) + 0.4 * s.yaw));
        if (drifting) {
          const left = Math.abs(wrap(RQ[3] - velHeading(s)));
          if (left < 0.25 || s.drift.tier >= 3 || !s.drift.on && s.drift.t > 0) drifting = false;
          r.drift = drifting;
          r.steer = driftDir * clamp(0.3 + err * driftDir * 3, -1, 1);
        } else if (wantDrift && Math.abs(err) > 0.08) {
          drifting = true; driftDir = Math.sign(err);
          r.drift = true; r.steer = driftDir;
        } else {
          r.steer = clamp(avoid(game, steerTo(game, want, sk.k, sk.max) + noise, sk.avoid ?? 0, mem, 0.5), -sk.max, sk.max);
          // Ease off before a corner too tight for the speed.
          const vMax = vForR(Math.max(8, 60 / Math.max(0.05, turnAhead)), game.tune);
          if (s.speed > vMax + 2) { r.gas = 0; if (s.speed > vMax + 6) r.brake = 0.5; }
        }
        // Boost on the straights.
        const straight = turnAhead < 0.5;
        if (straight && !drifting) r.boost = s.boosting ? s.bar > sk.keepTo : s.bar >= sk.boostAt;
        if (lift) { r.gas = 0; r.brake = 0.7; r.boost = false; }
        // Reaction lag.
        hist.push({ steer: r.steer, gas: r.gas, boost: r.boost, drift: r.drift, brake: r.brake });
        const lag = Math.round(sk.lag * 120);
        if (hist.length > lag + 1) hist.shift();
        const use = hist.length > lag ? hist[0] : null;
        if (use && lag > 0) {
          r.steer = use.steer; r.gas = use.gas; r.boost = use.boost; r.drift = use.drift; r.brake = use.brake;
        }
        return r;
      } };
    },
  };
}

// ---------------------------------------------------------------- the mission bot

/**
 * The mission bot: pure pursuit to the current objective, with helpers per goal. Exported as a function too, so the
 * story bot can use it beat by beat. opts: { source, skill: 'mid' | 'beginner' }.
 */
function missionStep(game, r, st, opts = {}) {
  const m = game.mission;
  const s = game.ship;
  const data = m && missionById(m.id);
  const beat = data?.beats[m.beat];
  const g = beat?.goal || {};
  const beginner = opts.skill === 'beginner';
  r.steer = 0; r.gas = 1; r.boost = false; r.drift = false; r.brake = 0; r.action = false; r.actionHeld = 0;
  if (!m || m.state !== 'running') return r;
  if (m.skipOffered && opts.skip !== false) { r.action = true; return r; }
  if (g.takedown) {
    const a = actorById(game, g.takedown.actors[0]);
    if (!a) return r;
    const dx = a.pos[0] - s.pos[0], dy = a.pos[1] - s.pos[1], d = hyp(dx, dy);
    const closing = ((s.vel[0] - a.vel[0]) * dx + (s.vel[1] - a.vel[1]) * dy) / (d || 1);
    // Lead the target from afar; close in, chase its tail (pure pursuit always catches a slower target).
    const lead = clamp(d / Math.max(4, closing), 0, 1.2) * clamp((d - 12) / 15, 0, 1);
    const tx = a.pos[0] + a.vel[0] * lead, ty = a.pos[1] + a.vel[1] * lead;
    r.steer = avoid(game, steerTo(game, aimAt(game, tx, ty), d < 20 ? 3.2 : 2.6, beginner ? 0.8 : 1), d < 10 ? 0 : 1, st.mem);
    // A beginner boosts on a full bar and lets go once close (at 42 u/s a near tail is overshot, not rammed).
    r.boost = beginner ? (s.boosting ? s.bar > 0.1 && d > 18 : s.bar > 0.99 && d > 25)
      : (s.boosting ? s.bar > 0.05 : s.bar > 0.3 && (d > 25 || closing < 7));
    return r;
  }
  if (g.catch) {
    const a = actorById(game, g.catch.item);
    if (!a) {
      const from = g.catch.from && actorById(game, g.catch.from);
      if (from) r.steer = steerTo(game, aimAt(game, from.pos[0], from.pos[1]));
      return r;
    }
    const d = hyp(a.pos[0] - s.pos[0], a.pos[1] - s.pos[1]);
    const lead = clamp(d / Math.max(10, s.speed), 0, 1);
    const want = aimAt(game, a.pos[0] + a.vel[0] * lead, a.pos[1] + a.vel[1] * lead);
    r.steer = steerTo(game, want, 3, beginner ? 0.8 : 1);
    const off = Math.abs(wrap(want - velHeading(s)));
    r.gas = off > 0.8 ? 0 : 1;
    if (off > 1.6 && s.speed > 22) r.brake = 0.4;
    return r;
  }
  if (g.scan) {
    const z = st.zoneOf(game);
    const ids = g.scan.ids.filter((id) => !game.zone.scanned[id]);
    if (!ids.length) return r;
    // The far rings: turn to each one and hold it. Start from the zone's far side so the hold never meets the rim.
    const dirs = ids.map((id) => {
      const f = (z.far || []).find((x) => x.scan === id || x.id === id);
      const d = f && farDir(z, f.object, [0, 0, 0]);
      return d ? { id, h: Math.atan2(d[0], d[1]) } : null;
    }).filter(Boolean);
    if (!dirs.length) return r;
    dirs.sort((a, b) => Math.abs(wrap(a.h - s.yaw)) - Math.abs(wrap(b.h - s.yaw)));
    const h = dirs[0].h;
    const R = z.R || 450;
    const ahead = s.pos[0] * Math.sin(h) + s.pos[1] * Math.cos(h);
    if (!st.scanFrom && ahead > R * 0.05) st.scanFrom = true;
    if (st.scanFrom && ahead > -R * 0.35 && Math.abs(wrap(h - s.yaw)) > 0.05) {
      // Too near the rim that way: drive back across the zone first.
      r.steer = steerTo(game, h + Math.PI);
      r.gas = 1;
      if (ahead < -R * 0.3) st.scanFrom = false;
      return r;
    }
    st.scanFrom = false;
    r.steer = steerTo(game, h, 2.5);
    r.gas = 0;
    return r;
  }
  if (g.stunt || g.all) {
    // Stunt goals (FIRST SHOUT): the first one not met yet.
    const subs = g.all ? g.all : [g];
    const j = subs.findIndex((x, k) => x.stunt && !m.sub[k]);
    const sg = j >= 0 ? subs[j].stunt : g.stunt;
    const ev = (st.zoneOf(game)?.events || []).find((e) => e.id === sg?.id);
    const want = m.target?.[sg?.id] ?? sg?.min ?? 1;
    if (ev?.type === 'drift') return stuntDrift(game, r, st, ev, want);
    if (ev?.type === 'trap') return stuntTrap(game, r, st, ev, want);
    return r;
  }
  if (g.reach && g.reach.ring === 'exit' && game.zone.exitOpen) {
    const chip = actionOf(game);
    if (chip?.id === 'jump') { r.action = true; return r; }
  }
  // Any other goal: drive to the objective's place.
  const at = placeOfGoal(game, g, st);
  if (at) r.steer = steerTo(game, aimAt(game, at[0], at[1]));
  return r;
}

// The traffic grid at this step's tick (the ship slot rebuilds it each tick; a bot reads it before the first step of
// a game, so it must not see another game's traffic).
function gridNow(game) {
  const built = builtOf(game);
  if (!built?.grid || !built.traffic) return null;
  const tq = Math.floor(game.zoneT * 30 + 1e-9) / 30;
  if (built.grid.builtAt !== tq || built.grid.traffic !== built.traffic) rebuildTraffic(built.grid, built.traffic, tq);
  return built;
}

// Steer round traffic in the way: for each body near, the time and distance of closest approach on the present
// lines; the worst one that comes within its collider plus a margin in the next HORIZON s pushes the steer to one
// side, and the bot keeps that side until it has passed (mem), so it never weaves into it.
const IDS = new Int32Array(256), BP = [0, 0, 0], BV = [0, 0, 0];
const HORIZON = 0.9, MARGIN = 1.8;
export function avoid(game, steer, k = 1, mem = null, horizon = HORIZON) {
  if (!(k > 0)) return steer;
  const built = gridNow(game);
  if (!built) return steer;
  const s = game.ship, tr = built.traffic;
  const rx = Math.cos(s.yaw), ry = -Math.sin(s.yaw);
  const n = query(built.grid, s.pos, 10 + s.speed * horizon, IDS);
  let worst = 0, wid = -1, wside = 0;
  for (let i = 0; i < n; i++) {
    const id = IDS[i];
    let r;
    if (id >= STATIC_BASE) {
      const b = built.statics?.[id - STATIC_BASE];
      if (!b) continue;
      BP[0] = b.pos[0]; BP[1] = b.pos[1]; BP[2] = b.pos[2]; BV[0] = 0; BV[1] = 0; BV[2] = 0; r = b.rc;
    } else {
      if (!(tr.rc[id] > 0.45)) continue;                   // pebbles only scrape
      posAt(tr, id, game.zoneT, BP);
      velAt(tr, id, game.zoneT, BV);
      r = tr.rc[id];
    }
    const px = BP[0] - s.pos[0], py = BP[1] - s.pos[1], pz = BP[2] - s.pos[2];
    if (Math.abs(pz) > r + 2) continue;
    const vx = BV[0] - s.vel[0], vy = BV[1] - s.vel[1];
    const v2 = vx * vx + vy * vy;
    if (v2 < 1e-6) continue;
    const tca = -(px * vx + py * vy) / v2;
    if (tca <= 0 || tca > horizon) continue;
    const miss = Math.hypot(px + vx * tca, py + vy * tca) - r - 0.32;
    if (miss > MARGIN) continue;
    const w = (1 - tca / horizon) * (1 - Math.max(0, miss) / MARGIN);
    if (w > worst) { worst = w; wid = id; wside = px * rx + py * ry >= 0 ? -1 : 1; }   // away from where it is now
  }
  if (wid < 0) { if (mem && game.t > mem.until) mem.id = -1; return steer; }
  let side = wside;
  if (mem) {
    if (mem.id === wid || game.t < mem.until) side = mem.side || wside;
    else { mem.id = wid; mem.side = wside; }
    mem.until = game.t + 0.3;
  }
  return clamp(steer + side * clamp(worst * 2.2, 0, 1) * k, -1, 1);
}

// A drift zone: lap the body at its centre (or the centre itself) and let go at the tier wanted.
function stuntDrift(game, r, st, ev, tier) {
  const c = ev.area.centre;
  const body = (st.zoneOf(game)?.bodies || []).find((b) => Math.hypot(b.pos[0] - c[0], b.pos[1] - c[1]) < ev.area.r);
  const centre = body ? body.pos : [c[0], c[1], 0];
  const d = hyp(centre[0] - game.ship.pos[0], centre[1] - game.ship.pos[1]);
  if (!st.drift || st.drift.done || st.drift.id !== ev.id) {
    if (st.drift?.done && d < 70) { r.steer = steerTo(game, aimAt(game, centre[0], centre[1]) + Math.PI); return r; }
    st.drift = driftRound(centre, { R: Math.max(13, body?.well ? body.well.rs * 0.95 : 13), tier, turn: 2.2 });
    st.drift.id = ev.id;
  }
  if (d > 120) { r.steer = steerTo(game, aimAt(game, centre[0], centre[1])); return r; }
  return st.drift.next(game, r);
}

// A speed trap: run at the ring with it off to the right, drift right when it is well round to the side, and let go
// when the nose points at it: the drift-boost's kick lands close to the ring on full boost. Again until it pays.
const TRAP_SIDE = 40, TRAP_BACK = 160;
function stuntTrap(game, r, st, ev, stars) {
  const s = game.ship, ring = ev.ring.pos;
  const p = st.trap || (st.trap = { phase: 'back' });
  const out = Math.atan2(ring[0], ring[1]);                    // the line runs out from the zone's centre
  const ux = Math.sin(out), uy = Math.cos(out);
  const nx = -uy, ny = ux;                                     // to the left of the line
  const bearing = aimAt(game, ring[0], ring[1]);
  const off = wrap(bearing - s.yaw);                           // > 0: the ring is to the right
  const d = hyp(ring[0] - s.pos[0], ring[1] - s.pos[1]);
  r.gas = 1;
  if (p.phase === 'back') {
    // Well back down the line, and off to its left.
    const B = [ring[0] - ux * TRAP_BACK + nx * TRAP_SIDE, ring[1] - uy * TRAP_BACK + ny * TRAP_SIDE];
    r.steer = steerTo(game, aimAt(game, B[0], B[1]));
    if (hyp(B[0] - s.pos[0], B[1] - s.pos[1]) < 15) p.phase = 'run';
    return r;
  }
  if (p.phase === 'run') {
    // Parallel to the line, the ring coming up on the right.
    r.steer = steerTo(game, out, 2.5);
    if (s.bar >= 0.3 && d < 110) r.boost = true;
    if (off > 72 * DEG && d < 80) p.phase = 'drift';
    if (off > 120 * DEG) p.phase = 'back';
    return r;
  }
  if (p.phase === 'drift') {
    r.steer = 1; r.drift = true; r.boost = s.bar > 0.02;
    if (s.drift.on && s.drift.tier >= 1 && off < 6 * DEG) { r.drift = false; p.phase = 'in'; }
    else if (off < -20 * DEG) { r.drift = false; p.phase = 'in'; }
    return r;
  }
  // In: straight at the ring on boost; past it, round again (the stunt's result decides if it paid).
  r.steer = steerTo(game, bearing, 3);
  r.boost = s.bar > 0.02;
  if (Math.abs(off) > 100 * DEG || d < 4) p.phase = 'back';
  return r;
}

function placeOfGoal(game, g, st) {
  const z = st.zoneOf(game);
  const ringPos = (id) => (typeof id === 'object' ? id.pos : id === 'exit' ? z?.exit?.pos
    : (game.zone.missionRings || []).find((x) => x.id === id)?.pos || (z?.rings || []).find((x) => x.id === id)?.pos);
  if (g.reach) return ringPos(g.reach.ring);
  if (g.drop) return ringPos(g.drop.ring);
  const a = g.near?.actor || g.hook?.actor || g.away?.actor;
  if (a) return actorById(game, a)?.pos || null;
  return null;
}

const mission = {
  make({ source = 'keys', skill = 'mid' } = {}) {
    const r = rec(source);
    const st = { zoneOf, mem: { id: -1, side: 0, until: 0 } };
    return { next: (game) => missionStep(game, r, st, { skill }) };
  },
};

// ---------------------------------------------------------------- the Wall's story bot

/**
 * story: the Wall on the story path. Drifts round the Bend Giant on the on-ramp, boosts on the straight, heads for
 * Node 0 and circles it until WHICH WAY HOME starts, rams the Magpie, drives through the chart, holds each far ring,
 * and taps JUMP.
 */
const story = {
  make({ source = 'keys' } = {}) {
    const r = rec(source);
    const st = { zoneOf, mem: { id: -1, side: 0, until: 0 } };
    let dr = null, circleA = 0;
    return { next(game) {
      r.steer = 0; r.gas = 1; r.boost = false; r.drift = false; r.brake = 0; r.action = false; r.actionHeld = 0;
      if (game.mode !== 'drive') return r;
      const s = game.ship;
      if (game.mission) return missionStep(game, r, st, { skill: 'mid' });
      const z = st.zoneOf(game);
      if (game.zone?.exitOpen) {
        if (actionOf(game)?.id === 'jump') { r.action = true; return r; }
      }
      // The on-ramp: drift round the Bend Giant once.
      const giant = (z?.bodies || []).find((b) => b.well);
      if (giant && !dr) dr = driftRound(giant.pos, { R: 13, tier: 2 });
      if (dr && !dr.done && hyp(giant.pos[0] - s.pos[0], giant.pos[1] - s.pos[1]) < 120) return dr.next(game, r);
      // Node 0: drive there and circle it (WHICH WAY HOME starts near it).
      const d0 = hyp(s.pos[0], s.pos[1]);
      if (d0 > 90) {
        r.steer = steerTo(game, aimAt(game, 0, 0));
        r.boost = s.boosting ? s.bar > 0.3 : s.bar > 0.8 && d0 > 200;
        return r;
      }
      circleA = Math.atan2(s.pos[0], s.pos[1]) + 0.5;
      r.steer = steerTo(game, aimAt(game, Math.sin(circleA) * 70, Math.cos(circleA) * 70));
      r.gas = 0;
      return r;
    } };
  },
};

// Race, mission and story bots also hold the plane's height (climb), as a player who never climbs does with Cruise.
// Hold the plane's height in the zones; through a jump (run-up to drop-out) the corridor bot drives (jump.js
// JUMP_BOTS, opts.jump: 'still' | 'mid' | 'expert' | 'thumb', default mid).
const JUMP_MODES = new Set(['runup', 'punch', 'tunnel', 'dropout']);
const level = (b) => ({ make(opts = {}) {
  const m = b.make(opts);
  let jb = null;
  return { next(game) {
    if (JUMP_MODES.has(game.mode)) {
      jb = jb || (JUMP_BOTS[opts.jump] || JUMP_BOTS.mid)({ seed: opts.seed ?? game.seed ?? 1 });
      return jb.next(game);
    }
    return holdHeight(game, m.next(game));
  } };
} });

export const BOTS = Object.freeze({
  idle, random, wander, drifter,
  beginner: level(raceBot('beginner')), mid: level(raceBot('mid')), expert: level(raceBot('expert')),
  mission: level(mission), story: level(story),
  chapter: level(story),              // Round 1: the chapter bot is the Wall's story path (WP8 extends it)
  jump: JUMP_BOTS,                    // the corridor bots themselves: (opts) → { name, next(game) }
});
