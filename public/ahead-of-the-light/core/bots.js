// Ahead of the Light: the bots (final.md 21.1): drivers that send the same intents as a player, presets, run
// policies, and playRun, which plays a whole run headless for the sims.
// The drivers port lab A's planner (upcoming, candidates, worth, plan) and its `human`, generalised so they see every
// course kind through kinds.blocked (where a ship's centre may not be) and kinds.resolve (what a bearing gets), so a
// new kind needs no bot code. On top of the line they work every verb: the burn (by policy), the whip (side, band,
// press and lift, with human timing errors), the draft and slingshot, and the SLAM into a knot (slamAim).
// Drivers: idle; dodge (keeps 12° clear, no verbs); graze (a perfect line); whipper (grabs every well 10° off and
// lets go on the furthest band before the warning); human(knobs). Pure: every random number comes from mulberry32.
import { TUNE } from './tune.js';
import { stepRace, STEP, NO_INTENT } from './race.js';
import { createRun, startLeg, endLeg, chooseLane } from './run.js';
import { blocked, resolve, psiAt, railOn } from './course/kinds.js';
import { wrap } from './ringmath.js';
import { bpsOf, windowOf, sweepTime, slamAim } from './handle.js';
import { mulberry32, hashSeed } from '../../light-years-home/core/rng.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isOut = (s) => s.caught || s.wrecked;

// ---------------------------------------------------------------- the planner (lab A, generalised)

// Course items still to pass within horizon seconds, in order: { it, t (s to its pass; 0 if a rail is beside
// you), tEnd }. Cues and fog are not lines; a pickup another ship took is gone.
export function upcoming(race, ship, horizon, tune = TUNE) {
  const out = [], items = race.leg.items, bps = bpsOf(ship, tune), d = ship.dist;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind === 'cue' || it.kind === 'fog') continue;
    const t = (it.beat - d) / bps, tEnd = it.end !== undefined ? (it.end - d) / bps : t;
    if (tEnd <= 0 || t > horizon) continue;
    if (it.end === undefined && t <= 0) continue;
    if (it.kind === 'pickup' && race.wells[it.id] && race.wells[it.id].holder) continue;
    out.push({ it, t: Math.max(0, t), tEnd: Math.max(0, tEnd) });
  }
  return out.sort((a, b) => a.t - b.t);
}

// Bearings worth aiming at for an item: each blocked arc's edges pushed out by each wanted gap, the middle of every
// opening between two arcs (a wall's gap, a gate's thread), a pickup's own bearing and a dock ring's centre.
export function candidates(it, beat, gaps, tune = TUNE, shipHalf = tune.SHIP_HALF) {
  const out = [];
  if (it.kind === 'pickup') { out.push(it.psi); return out; }
  const arcs = blocked(it, it.kind === 'rail' ? beat : it.beat, [], shipHalf, tune);
  for (const [from, to] of arcs) {
    if (to - from >= 360) continue;
    for (const g of gaps) { out.push(from - g); out.push(to + g); }
  }
  if (arcs.length > 1) {
    const s = arcs.map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]);
    for (let i = 0; i < s.length; i++) {
      const end = s[i][1], next = i + 1 < s.length ? s[i + 1][0] : s[0][0] + 360;
      if (next > end && next - end < 150) out.push(wrap((end + next) / 2));
    }
  }
  if (it.kind === 'gate' && it.dock) out.push(it.dock.psi);
  return out;
}

// What a bearing is worth at an item for a bot with these values (lab A's worth, through resolve).
export function worth(it, b, beat, tune, val, hold = 0, shipHalf = tune.SHIP_HALF) {
  const T = tune;
  const r = resolve(it, b, it.kind === 'rail' ? beat : it.beat, T, shipHalf);
  if (it.kind === 'pickup') return r.take ? val.fuel || 0 : 0;
  if (r.hit) return val.hit;
  if (it.kind === 'rail') {
    return r.overlap <= (it.skimBand ?? T.SKIM_BAND) ? val.skim * (it.skimX ?? 1) * Math.max(0.3, hold) : 0;
  }
  let v = 0;
  for (const { g } of r.gaps) {
    if (g < T.HAIR) v += val.hair;
    else if (g < T.GRAZE) v += val.graze;
    else if (val.margin) v += Math.min(g, 20) * val.margin;
  }
  if (r.thread) v += it.pair ? val.thread : val.gate ?? val.thread;
  if (r.tag === 'dock') v += val.dock || 0;
  return v;
}

// Rails beside the ship now (they cannot be crossed).
function activeRails(race, ship) {
  const out = [], items = race.leg.items;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind === 'rail' && railOn(it, ship.dist)) out.push(it);
  }
  return out;
}

// Search the next few items for the best line; → the bearing (unwrapped degrees) to aim at now. opts: depth, turn
// (°/s it can count on), settle (s), gapsFor(it) → wanted gaps, val (a worth table), move (cost a degree), from.
export function plan(race, ship, items, opts, tune = TUNE) {
  const T = tune;
  const n = Math.min(items.length, opts.depth);
  const from = finite(opts.from) ? opts.from : ship.bearing;
  if (n === 0) return from;
  const rails = opts.rails || [];
  const beat = ship.dist;
  let best = -Infinity, bestB = from;
  const rec = (i, b, tFree, acc, first) => {
    if (i === n) { if (acc > best) { best = acc; bestB = first; } return; }
    const x = items[i];
    const raw = candidates(x.it, beat, opts.gapsFor(x.it), T, ship.half);
    raw.push(b);
    const seen = new Set();
    for (const c0 of raw) {
      const opts2 = [b + wrap(c0 - b)];
      if (i === 0 && rails.length && x.it.kind !== 'rail') opts2.push(opts2[0] - 360 * Math.sign(opts2[0] - b || 1));
      for (const c of opts2) {
        const key = Math.round(c * 4);
        if (seen.has(key)) continue;
        seen.add(key);
        const dist = Math.abs(c - b);
        const avail = x.t - tFree - opts.settle;
        let v = worth(x.it, c, beat, T, opts.val, x.tEnd - x.t, ship.half) - dist * opts.move;
        if (dist > 0.5 && dist > opts.turn * Math.max(0, avail)) v += opts.val.late;
        for (const r of rails) {
          const psi = psiAt(r, beat);
          const a0 = wrap(b - psi), a1 = a0 + (c - b);
          if (Math.sign(a0) !== Math.sign(a1) || Math.abs(a1) < ship.half + r.half) v += opts.val.hit;
        }
        rec(i + 1, c, x.it.end !== undefined ? x.tEnd : x.t, acc + v, i === 0 ? c : first);
      }
    }
  };
  rec(0, from, 0, 0, from);
  return bestB;
}

// A planner bot that replans when its next item changes, or every `replan` seconds. No verbs.
function plannerBot(makeOpts) {
  let key = null, aim = null, nextAt = 0;
  const intent = { target: null, turn: 0, action: null, burn: false };
  return (race, ship) => {
    if (race.phase === 'done' || isOut(ship)) { key = null; return NO_INTENT; }
    const T = race.tune || TUNE;
    const o = makeOpts(race, ship);
    const items = upcoming(race, ship, o.horizon, T);
    const k = items.length ? items[0].it.id : -1;
    if (k !== key || race.real >= nextAt || aim === null) {
      key = k;
      nextAt = race.real + o.replan;
      aim = plan(race, ship, items, { ...o, rails: activeRails(race, ship) }, T);
    }
    intent.target = aim;
    return intent;
  };
}

const GRAZE_VAL = { hit: -100, hair: 3, graze: 1, thread: 6, gate: 30, skim: 4, late: -60, margin: 0, fuel: 4,
  dock: -5 };

// ---------------------------------------------------------------- the human (and the whipper)

const BURN_POLICIES = new Set(['never', 'ttc6', 'launch-hits', 'all']);

// A person: sees an item only reactMs after it comes into a plan's reach, misses by jitterDeg (one error per item),
// goes for a graze with chance greed (a hairline only when greed is high), moves the thumb at a human pace, and is
// moved by pulls and shoves like a thumb would be. Verbs on top: burns by burnPolicy, whips (whipGreed: how often it
// tries, how deep it grabs, which band it picks; press and lift errors from reactMs), drafts and slingshots
// (draftSkill), and SLAMs a rival into a hazard when slamAim says it would work (ramBias).
// whipper: true makes the whipper: every well 10° off, the furthest band before the warning, no errors.
function human(opts = {}) {
  const o = { reactMs: 250, jitterDeg: 4, greed: 0.5, whipGreed: 0.5, burnPolicy: 'ttc6', draftSkill: 0.5,
    ramBias: 0, seed: 1, whipper: false, policy: null, ...opts };
  if (!BURN_POLICIES.has(o.burnPolicy)) o.burnPolicy = 'ttc6';
  const rnd = mulberry32(hashSeed('human', o.seed, o.reactMs, o.jitterDeg, o.greed, o.whipGreed, o.draftSkill));
  const gauss = () => {
    const u = Math.max(1e-9, rnd()), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const react = o.reactMs / 1000;
  const thumb = 260 + 1.2 * (400 - o.reactMs);           // °/s: quicker hands with quicker eyes
  const mind = new Map(), wells = new Map(), rams = new Map(), drafts = new Map();
  const intent = { target: null, turn: 0, action: null, burn: false };
  let aim = null, goal = 0, key = null, lastReal = 0, alarmAt = -1, sent = null, stunUntil = 0;
  let burnAt = -1, lastBurn = -9, hitsSeen = 0, lastHitT = -9, launchBurned = false, oberthDone = null;
  let ramUntil = 0, ramAim = 0, pullUntil = 0, pullAim = 0, lastLeg = null;

  const decide = (it) => {
    let m = mind.get(it.id);
    if (!m) {
      const greedy = rnd() < o.greed;
      m = { greedy, hair: greedy && rnd() < o.greed * 0.6, err: o.whipper ? 0 : gauss() * o.jitterDeg };
      mind.set(it.id, m);
    }
    return m;
  };
  const wantDock = (ship) => {
    const d = o.policy && o.policy.dock;
    return d === 'hull2' ? ship.hull <= 2 : d === 'hull1' ? ship.hull <= 1 : false;
  };

  // The whip plan for a well: try or not, the side and depth to grab at, the band, and this try's errors.
  function wellPlan(race, ship, win, T) {
    let m = wells.get(win.well);
    if (m) return m;
    const it = win.item;
    const tryP = o.whipper ? 1 : 0.3 + 0.7 * o.whipGreed;
    m = { try: rnd() < tryP, side: 1, b0: it.psi, aE: NaN, band: -1, pressed: false, relAt: NaN, warnAt: NaN,
      pressErr: o.whipper ? 0.02 : gauss() * (o.reactMs / 4000) + 0.02,
      relErr: o.whipper ? 0 : gauss() * (o.reactMs / 2600) };
    const off = o.whipper ? Math.max(10, win.core + ship.half + 1.5)
      : win.core + ship.half + 2 + (1 - o.whipGreed) * 18;
    const greedyBand = o.whipper || rnd() < o.whipGreed;
    const x = win.teach ? T.TEACH_SWEEP : 1;
    let bestV = -Infinity;
    for (const s of [1, -1]) {
      const b0 = it.psi + s * off;
      const scorchAt = 360 - off - win.core - ship.half;
      const redAt = scorchAt - T.RED_SPAN;
      // never plan a band past the warning (plus reaction time); a timid hand stays out of the red zone
      let limit = scorchAt;
      while (limit > 0 && sweepTime(limit, scorchAt, T, x) < T.SCORCH_WARN + react + 0.1) limit -= 2;
      if (!(o.whipper || o.whipGreed > 0.7)) limit = Math.min(limit, redAt - 2);
      let pick = -1, pickA = NaN;
      (it.exits || []).forEach((e, k) => {
        const a = ((s * wrap(e - b0)) % 360 + 360) % 360;
        if (a < 25 || a > limit) return;
        if (pick < 0 || (greedyBand ? a > pickA : a < pickA)) { pick = k; pickA = a; }
      });
      if (pick < 0) continue;
      const d = Math.min(pickA, T.SWEEP_A) / T.SWEEP_A;
      const v = (T.GAIN_BASE + T.GAIN_DEPTH * d * d) * (pickA >= redAt ? T.RED_X : 1)
        - 0.004 * Math.abs(wrap(b0 - ship.bearing));
      if (v > bestV) { bestV = v; m.side = s; m.b0 = b0 + (o.whipper ? 0 : gauss() * o.jitterDeg * 0.6); m.aE = pickA;
        m.band = pick; }
    }
    if (m.band < 0) m.try = false;
    wells.set(win.well, m);
    return m;
  }

  return (race, ship) => {
    intent.target = null; intent.turn = 0; intent.action = null; intent.burn = false;
    if (race.phase === 'done' || isOut(ship)) { aim = null; key = null; return intent; }
    const T = race.tune || TUNE;
    const now = race.real;
    if (lastLeg !== race.leg) { lastLeg = race.leg; aim = null; mind.clear(); wells.clear(); rams.clear(); }
    if (aim === null) { aim = ship.bearing; goal = aim; lastReal = now; sent = ship.target; }
    const dt = Math.max(0, now - lastReal);
    lastReal = now;

    // pulls, shoves and bumps move the thumb's frame too; a hard one takes a reaction to answer
    if (ship.whip) { aim = ship.bearing; goal = aim; sent = ship.target; }
    else if (sent !== null && ship.target !== sent) {
      const dlt = ship.target - sent;
      aim += dlt;
      if (Math.abs(dlt) > 3) stunUntil = now + react;
    }

    // ---- burns
    if (ship.stats.hits > hitsSeen) { hitsSeen = ship.stats.hits; lastHitT = now; }
    if (o.burnPolicy !== 'never' && ship.fuel >= 1 && ship.burn.t <= 0 && now - lastBurn > 1.0) {
      let want = ship.ttc < T.TTC_WARN;
      if (o.burnPolicy === 'launch-hits' || o.burnPolicy === 'all') {
        if (!launchBurned && race.t < 3 && ship.gear === 0) want = true;
        if (now - lastHitT < 2 && ship.eta < 1.6) want = true;
      }
      if (o.burnPolicy === 'all') {
        const W = ship.whip;
        if (W && !W.latched && W.angle >= T.OBERTH_ANGLE + 5 && oberthDone !== W.well) want = true;
        if (ship.surge.x > 1 && ship.surge.until > race.t && ship.fuel >= 2) want = true;
      }
      if (want && burnAt < 0) burnAt = now + (o.whipper ? 0 : react);
      if (!want) burnAt = -1;
      if (want && burnAt >= 0 && now >= burnAt) {
        intent.burn = true;
        lastBurn = now;
        burnAt = -1;
        if (race.t < 3) launchBurned = true;
        if (ship.whip) oberthDone = ship.whip.well;
      }
    }

    // ---- the whip: hold and lift
    if (ship.whip) {
      const W = ship.whip, m = wells.get(W.well);
      if (m && !finite(m.relAt) && finite(W.exitA[m.band] ?? NaN)) {
        const left = (W.latched ? T.LATCH_S - W.t : 0) + sweepTime(W.angle, W.exitA[m.band], T, W.x);
        m.relAt = now + left + T.LIFT_COMP + m.relErr;
      }
      if (!m || !finite(m.relAt)) {
        // a grab with no plan: let go on the first band, or at once if none is ahead
        const k = W.exitA.findIndex((a, i) => i < W.n && finite(a) && a > W.angle);
        if (k < 0) { intent.action = 'up'; return intent; }
        if (m) m.relAt = now + sweepTime(W.angle, W.exitA[k], T, W.x) + T.LIFT_COMP;
        else wells.set(W.well, { try: true, band: k, relAt: now + sweepTime(W.angle, W.exitA[k], T, W.x) + T.LIFT_COMP,
          warnAt: NaN, pressed: true });
      }
      const mm = wells.get(W.well);
      if (W.warned && !finite(mm.warnAt)) mm.warnAt = now;
      const panic = finite(mm.warnAt) && now >= mm.warnAt + react;
      if (now >= mm.relAt || panic) intent.action = 'up';
      return intent;
    }

    // ---- the ram: get beside a rival on the far side from a hazard it will pass, then flick into it when a SLAM
    // would carry it into the hazard (the orange tick) and leave you clear
    let setup = null;
    if (now < ramUntil) {
      if (ship.shove) { ramUntil = 0; aim = ship.bearing; goal = aim; }     // touched: the ram is done
      else { aim = ramAim; return send(ship); }
    }
    if (o.ramBias > 0 && race.ships.length > 1) {
      for (const r of race.ships) {
        if (r === ship || isOut(r) || r.whip) continue;
        const z = Math.abs(r.dist - ship.dist) / bpsOf(ship, T);
        if (z > 0.25) continue;
        let m = rams.get(r.id);
        if (!m || now > m.until) {
          m = { go: rnd() < 0.2 + o.ramBias, until: now + 2.5, err: gauss() * o.reactMs / 4000 };
          rams.set(r.id, m);
        }
        if (!m.go) continue;
        const off = wrap(r.bearing - ship.bearing), a = Math.abs(off);
        if (z <= 0.1 && a >= ship.half + r.half && a <= 40) {
          const delay = Math.max(0, (a - ship.half - r.half) / (ship.turnMax || T.TURN_MAX) + m.err);
          if (slamAim(race, ship, r, T, undefined, delay, true, 0.08)) {
            ramAim = ship.bearing + off + Math.sign(off) * 10;
            ramUntil = now + 0.3;
            m.go = false;
            aim = ramAim;
            return send(ship);
          }
        }
        if (!setup) setup = ramSetup(race, ship, r, T);
      }
    }

    // ---- the line: the planner over the next items, with errors
    const items = upcoming(race, ship, 1.5 - react, T);
    const k = items.length ? items[0].it.id : -1;
    if (items.length && items[0].t <= T.ALARM_LEAD && resolve(items[0].it, goal, items[0].it.beat, T, ship.half).hit) {
      if (alarmAt < 0) alarmAt = now;
    } else alarmAt = -1;
    let fix = false;
    if (alarmAt >= 0 && now - alarmAt >= react && items.length) {
      fix = true;
      alarmAt = -1;
      const m = decide(items[0].it);
      m.err = o.whipper ? 0 : gauss() * o.jitterDeg * 0.6;
      m.greedy = false;
    }
    if (k !== key || fix) {
      key = k;
      if (items.length) {
        const first = decide(items[0].it);
        const dock = wantDock(ship);
        const target = plan(race, ship, items, {
          depth: o.greed >= 0.5 || o.whipper ? 2 : 1, turn: thumb * 0.8, settle: react * 0.5, move: 0.01, from: aim,
          rails: activeRails(race, ship),
          gapsFor: (it) => { const m = decide(it); return m.greedy ? (m.hair ? [1.5, 4] : [4]) : [11]; },
          val: { hit: -100, hair: 3, graze: 1.5, thread: 6, gate: dock ? 2 : 30, dock: dock ? 40 : -2,
            skim: 3, late: -40, margin: 0, fuel: 2 + 4 * (1 - ship.fuel / Math.max(1, ship.fuelCap)) },
        }, T);
        goal = target + (target === aim ? 0 : first.err);
      }
    }

    if (setup !== null) goal = setup;

    // ---- the whip: approach on the planned side and press as the latch rings touch
    const win = o.whipGreed > 0 || o.whipper ? windowOf(race, ship) : null;
    if (win && win.holder === null) {
      const m = wellPlan(race, ship, win, T);
      if (m.try && !m.pressed) {
        if (win.t <= 1.4) goal = ship.bearing + wrap(m.b0 - ship.bearing);
        if (win.t <= m.pressErr && win.t >= -win.late) {
          m.pressed = true;
          intent.action = 'down';
        }
      }
    }

    // ---- the draft: tuck into a wake ahead, then pull out for the slingshot
    if (now < pullUntil) goal = pullAim;
    else if (o.draftSkill > 0) {
      let lead = null, bestZ = Infinity;
      for (const r of race.ships) {
        if (r === ship || isOut(r) || r.whip) continue;
        const z = (r.dist - ship.dist) / bpsOf(ship, T);
        if (z < 0.05 || z > 1.0 || Math.abs(wrap(r.bearing - ship.bearing)) > 25) continue;
        if (z < bestZ) { bestZ = z; lead = r; }
      }
      if (lead && !(win && win.t < 1.6)) {
        let d = drafts.get(lead.id);
        if (!d || now > d.until) {
          d = { go: rnd() < 0.35 + 0.65 * o.draftSkill, until: now + 3,
            pullAt: o.whipper ? 0.95 : clamp(0.55 + 0.4 * o.draftSkill + gauss() * 0.08, 0.5, 1) };
          drafts.set(lead.id, d);
        }
        if (d.go) {
          const D = ship.draft;
          if (D.lead === lead.id && D.charge >= d.pullAt) {
            const side = pullSide(race, ship, lead, T);
            pullAim = ship.bearing + wrap(lead.bearing + side * 22 - ship.bearing);
            pullUntil = now + 0.6;
            d.go = false;
            goal = pullAim;
          } else goal = ship.bearing + wrap(lead.bearing - ship.bearing);
        }
      }
    }

    // the thumb moves toward the goal at a human pace (not during a stun)
    if (now >= stunUntil) {
      const dd = goal - aim, stepMax = thumb * dt;
      aim += Math.abs(dd) <= stepMax ? dd : Math.sign(dd) * stepMax;
    }
    return send(ship);
  };

  function send(ship) {
    intent.target = aim;
    sent = aim;
    return intent;
  }
}

// Where to sit to slam a rival into a hazard it will pass in 0.3 to 1.6 s with 12 to 36° to spare (one shove): beside
// it on the far side from the hazard. → a bearing (unwrapped, near the ship), or null.
function ramSetup(race, ship, r, T) {
  const items = upcoming(race, r, 1.6, T);
  for (const x of items) {
    if (x.t < 0.3 || (x.it.kind !== 'knot' && x.it.kind !== 'pulse' && x.it.kind !== 'gate')) continue;
    const d = wrap(r.bearing - x.it.psi), a = Math.abs(d);
    if (a < 12 || a > 36) continue;
    const want = r.bearing + Math.sign(d) * 16;
    return ship.bearing + wrap(want - ship.bearing);
  }
  return null;
}

// The side to pull out of a wake: the one with fewer hazards close ahead (a slingshot into a knot is no slingshot).
function pullSide(race, ship, lead, T) {
  const items = upcoming(race, ship, 0.8, T);
  let score = [0, 0];
  [1, -1].forEach((s, i) => {
    const b = lead.bearing + s * 22;
    for (const x of items) if (resolve(x.it, b, x.it.kind === 'rail' ? ship.dist : x.it.beat, T, ship.half).hit) {
      score[i] += 1;
    }
  });
  return score[0] <= score[1] ? 1 : -1;
}

// A driver is (opts) => (race, ship) => intent (race.js NO_INTENT's shape).
const idle = () => () => NO_INTENT;
const dodge = () => plannerBot(() => ({
  horizon: 2.2, depth: 3, turn: 420, settle: 0.06, replan: 0.1, move: 0.004,
  gapsFor: () => [12.5], val: { hit: -100, hair: -20, graze: -20, thread: -20, gate: -20, skim: -5, late: -60,
    margin: 0.01, fuel: 0, dock: -20 },
}));
const graze = () => plannerBot(() => ({
  horizon: 2.4, depth: 3, turn: 480, settle: 0.05, replan: 0.25, move: 0.002,
  gapsFor: () => [1.0, 10], val: GRAZE_VAL,
}));
const whipper = (opts = {}) => human({ reactMs: 140, jitterDeg: 0, greed: 0.9, whipGreed: 1, burnPolicy: 'never',
  draftSkill: 0, ramBias: 0, ...opts, whipper: true });
export const DRIVERS = Object.freeze({ idle, dodge, graze, whipper, human });

// The human() presets and their default run policies (21.1).
export const PRESETS = Object.freeze({
  weak: Object.freeze({ reactMs: 380, jitterDeg: 10, greed: 0.1, whipGreed: 0.1, burnPolicy: 'never', draftSkill: 0,
    ramBias: 0, policy: { dock: 'hull1', lane: 'safe', pick: 'casual' } }),
  novice: Object.freeze({ reactMs: 300, jitterDeg: 7, greed: 0.2, whipGreed: 0.3, burnPolicy: 'ttc6', draftSkill: 0.2,
    ramBias: 0, policy: { dock: 'hull1', lane: 'safe', pick: 'casual' } }),
  mid: Object.freeze({ reactMs: 200, jitterDeg: 3, greed: 0.6, whipGreed: 0.6, burnPolicy: 'launch-hits',
    draftSkill: 0.6, ramBias: 0.3, policy: { dock: 'hull1', lane: 'family', pick: 'planner' } }),
  expert: Object.freeze({ reactMs: 140, jitterDeg: 1.5, greed: 0.9, whipGreed: 0.85, burnPolicy: 'all',
    draftSkill: 0.9, ramBias: 0.6, policy: { dock: 'never', lane: 'risk', pick: 'planner' } }),
});

export const POLICIES = Object.freeze({
  dock: Object.freeze(['never', 'hull1', 'hull2']),
  lane: Object.freeze(['safe', 'risk', 'void', 'family']),
  pick: Object.freeze(['casual', 'focus', 'spread', 'planner', 'risk']),
});

// A driver from a name: a driver ('idle'), or a preset ('mid', played by human() with the preset's knobs).
export function driverFor(name = 'idle', opts = {}) {
  if (PRESETS[name]) return DRIVERS.human({ ...PRESETS[name], ...opts });
  return (DRIVERS[name] || DRIVERS.idle)(opts);
}

// Play a whole run headless, at most maxS sim seconds in all. → a summary. Run policies arrive with the tune
// package (WP9); here every leg takes lane 0.
export function playRun({ seed = 1, driver = 'idle', policy = null, tune = TUNE, maxS = 900 } = {}) {
  const run = createRun({ seed, tune });
  let t = 0, events = 0;
  for (;;) {
    const race = startLeg(run, tune);
    const you = race.ships[0];
    const drive = driverFor(driver, { seed: hashSeed(seed, run.leg) });
    const intents = { you: NO_INTENT };
    while (race.phase !== 'done' && t < maxS) {
      intents.you = drive(race, you) || NO_INTENT;
      events += stepRace(race, intents, STEP).length;
      t += STEP;
    }
    endLeg(run, race);
    if (run.phase !== 'break' || t >= maxS || !chooseLane(run, 0)) break;
  }
  return { seed, driver, policy, phase: run.phase, home: run.phase === 'home', legs: run.legs.length,
    years: run.you.years, t, events };
}
