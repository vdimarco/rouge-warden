// Ahead of the Light: the bots (final.md 21.1): drivers that send the same intents as a player, presets, run
// policies, and playRun, which plays a whole run headless for the sims and returns what happened, leg by leg.
// The drivers port lab A's planner (upcoming, candidates, worth, plan) and its `human`, generalised so they see every
// course kind through kinds.blocked (where a ship's centre may not be) and kinds.resolve (what a bearing gets), so a
// new kind needs no bot code. A rail is judged where the ship meets it and along the hold, so a filament that starts
// ahead or turns is seen in time. On top of the line they work every verb: the burn (by policy), the whip (side,
// band, press and lift, with human timing errors), the draft and slingshot, and the SLAM into a knot (slamAim). A
// driver that knows its cards (opts.cards) plays them: KICK OUT and SIDESTEP burns, TIDAL FRAME's red zone, and more
// drafting, hairlines or rams for the cards that pay for them.
// Drivers: idle; dodge (keeps 12° clear, no verbs); graze (a perfect line); whipper (grabs every well 10° off and
// lets go on the furthest band before the warning); human(knobs). Run policies (dock, lane, pick) answer the breaks.
// Pure: every random number comes from mulberry32.
import { TUNE } from './tune.js';
import { stepRace, STEP, NO_INTENT } from './race.js';
import { createRun, startLeg, endLeg, chooseLane, pick as pickCard, skip as skipOffer } from './run.js';
import { blocked, resolve, psiAt, railOn, isHazard } from './course/kinds.js';
import { ROUTE } from './course/legs.js';
import { bpsOf, windowOf, sweepTime, slamAim, skimOf } from './handle.js';
import { dockPrices, buy as buyChip } from './survival.js';
import { CARD, amountOf } from './cards.js';
import { normalizeMeta } from './meta.js';
import { isDropped } from './course/director.js';
import { mulberry32, hashSeed } from '../../light-years-home/core/rng.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isOut = (s) => s.caught || s.wrecked;
const sgn = (v) => (v >= 0 ? 1 : -1);
// kinds.wrap, bit for bit, without its two float modulos when the angle is already within one turn
const wrap = (d) => {
  const x = d + 180;
  if (x >= 0 && x < 360) { const y = x + 360; return (y < 720 ? y - 360 : 0) - 180; }
  if (x >= -360 && x < 0) { const y = x + 360; return (y < 360 ? y : 0) - 180; }
  return ((((d + 180) % 360) + 360) % 360) - 180;
};

// ---------------------------------------------------------------- the planner (lab A, generalised)

const RAIL_LEAD = 0.12;           // s: a rail beside the ship is judged where the ship will be this soon
const RAIL_DT = 0.12;             // s between the samples a held bearing is judged at along a rail
const RAIL_SAMPLES = 3;

// Course items still to pass within horizon seconds, in order: { it, t (s to its pass; 0 if a rail is beside
// you), tEnd }. Cues and fog are not lines; a pickup another ship took is gone, and so is an item the director
// dropped.
export function upcoming(race, ship, horizon, tune = TUNE) {
  const out = [], items = race.leg.items, bps = bpsOf(ship, tune), d = ship.dist;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind === 'cue' || it.kind === 'fog') continue;
    const t = (it.beat - d) / bps, tEnd = it.end !== undefined ? (it.end - d) / bps : t;
    if (tEnd <= 0 || t > horizon) continue;
    if (it.end === undefined && t <= 0) continue;
    if (it.kind === 'pickup' && race.wells[it.id] && race.wells[it.id].holder) continue;
    if (isDropped(race, it)) continue;
    out.push({ it, t: Math.max(0, t), tEnd: Math.max(0, tEnd) });
  }
  return out.sort((a, b) => a.t - b.t);
}

// The beat a ship meets an item at: an instant item at its own beat; a rail as it starts, or, while it is beside the
// ship, where the ship will be in RAIL_LEAD s.
export function meetBeat(it, dist, bps) {
  if (it.end === undefined) return it.beat;
  return Math.max(it.beat + 1e-6, dist + bps * RAIL_LEAD);
}

// Bearings worth aiming at for an item: each blocked arc's edges pushed out by each wanted gap, the middle of every
// opening between two arcs (a wall's gap, a gate's thread), a pickup's own bearing and a dock ring's centre. beat:
// where a rail is judged (its meet beat).
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

// What a bearing is worth at an item for a bot with these values (lab A's worth, through resolve). A rail is judged
// at its meet beat and, with bps, along RAIL_SAMPLES samples of the hold: a held bearing that a turning rail would
// cross in that time is a hit.
export function worth(it, b, beat, tune, val, hold = 0, shipHalf = tune.SHIP_HALF, bps = 0) {
  const T = tune;
  if (it.kind === 'rail') {
    let first = null;
    for (let k = 0; k < RAIL_SAMPLES; k++) {
      const bt = beat + k * bps * RAIL_DT;
      if (k && (!(bps > 0) || bt >= it.end)) break;
      const r = resolve(it, b, bt, T, shipHalf);
      if (r.hit) return val.hit;
      if (!first) first = r;
    }
    return first.overlap <= (it.skimBand ?? T.SKIM_BAND) ? val.skim * (it.skimX ?? 1) * Math.max(0.3, hold) : 0;
  }
  const r = resolve(it, b, it.beat, T, shipHalf);
  if (it.kind === 'pickup') return r.take ? val.fuel || 0 : 0;
  if (r.hit) return val.hit;
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
// (°/s it can count on), settle (s), gapsFor(it) → wanted gaps, val (a worth table), move (cost a degree), from,
// rails (the rails beside the ship: a move may not cross one, judged where the rail is while the ship turns).
export function plan(race, ship, items, opts, tune = TUNE) {
  const T = tune;
  const n = Math.min(items.length, opts.depth);
  const from = finite(opts.from) ? opts.from : ship.bearing;
  if (n === 0) return from;
  const rails = opts.rails || [];
  const beat = ship.dist, bps = bpsOf(ship, T);
  let best = -Infinity, bestB = from;
  const rec = (i, b, tFree, acc, first) => {
    if (i === n) { if (acc > best) { best = acc; bestB = first; } return; }
    const x = items[i];
    const mb = meetBeat(x.it, beat, bps);
    const raw = candidates(x.it, mb, opts.gapsFor(x.it), T, ship.half);
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
        let v = worth(x.it, c, mb, T, opts.val, x.tEnd - x.t, ship.half, bps) - dist * opts.move;
        if (dist > 0.5 && dist > opts.turn * Math.max(0, avail)) v += opts.val.late;
        for (const r of rails) {
          const tOff = (r.end - beat) / bps;
          if (!(tFree < tOff)) continue;                      // the rail is gone before this move starts
          const t1 = Math.min(tOff - 1e-3, Math.max(tFree, Math.min(x.t, tFree + dist / Math.max(1, opts.turn))));
          const p0 = psiAt(r, beat + bps * tFree), p1 = psiAt(r, beat + bps * t1);
          const a0 = wrap(b - p0), a1 = a0 + (c - b) - (p1 - p0);
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
const RED_POLICIES = new Set(['auto', 'never', 'ttc12', 'always']);
const LAND_POLICIES = new Set(['keep', 'all', 'free']);

// A card set from opts.cards: an array of ids or { id, r }, a Set, or a Map (id → r).
function cardSet(cards) {
  const m = new Map();
  if (!cards) return m;
  if (cards instanceof Map) { for (const [k, v] of cards) m.set(k, v || 0); return m; }
  for (const c of cards) {
    if (typeof c === 'string') m.set(c, 0);
    else if (c && c.id) m.set(c.id, c.r || 0);
  }
  return m;
}

// A person: sees an item only reactMs after it comes into a plan's reach (the tick lead, so FAR SIGHT helps), misses
// by jitterDeg (one error per item, never into a rail it rides), goes for a graze with chance greed (a hairline only
// when greed is high), moves the thumb at a human pace, and is moved by pulls and shoves like a thumb would be.
// Verbs on top: burns by burnPolicy, whips (whipGreed: how often it tries, how deep it grabs, which band it picks;
// press and lift errors from reactMs), drafts and slingshots (draftSkill), and SLAMs a rival into a hazard when
// slamAim says it would work (ramBias).
// More opts: red ('auto' | 'never' | 'ttc12' | 'always': when a red-zone band is planned), land ('keep': leg 8 burns
// keep landKeep cells for the landing; 'all': leg 8 burns every cell; 'free'), cards (what it owns), policy.dock.
// whipper: true makes the whipper: every well 10° off, the furthest band before the warning, no errors.
function human(opts = {}) {
  const o = { reactMs: 250, jitterDeg: 4, greed: 0.5, whipGreed: 0.5, burnPolicy: 'ttc6', draftSkill: 0.5,
    ramBias: 0, seed: 1, whipper: false, policy: null, red: 'auto', land: 'keep', landKeep: 2, cards: null, ...opts };
  if (!BURN_POLICIES.has(o.burnPolicy)) o.burnPolicy = 'ttc6';
  if (!RED_POLICIES.has(o.red)) o.red = 'auto';
  if (!LAND_POLICIES.has(o.land)) o.land = 'keep';
  const cards = cardSet(o.cards);
  const has = (id) => cards.has(id);
  // cards change how it flies: it plays the ones it owns
  const draftSkill = clamp(o.draftSkill + (has('slipstream') || has('leech-line') || has('remoras-grip') ? 0.3 : 0),
    0, 1);
  const ramBias = clamp(o.ramBias + (has('battering-prow') || has('bounty') || has('hounds-bite') ? 0.3 : 0), 0, 1);
  const hairLove = has('hair-trigger') || has('bussard-scoop') || has('still-light') || has('scrape')
    || has('moths-dance') ? 1 : 0.6;
  const kickAt = has('kick-out') ? amountOf('kick-out', cards.get('kick-out')) : null;
  const sidestep = has('sidestep');
  const tidal = has('tidal-frame');
  const rnd = mulberry32(hashSeed('human', o.seed, o.reactMs, o.jitterDeg, o.greed, o.whipGreed, o.draftSkill));
  const gauss = () => {
    const u = Math.max(1e-9, rnd()), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const react = o.reactMs / 1000;
  const thumb = 260 + 1.2 * (400 - o.reactMs);           // °/s: quicker hands with quicker eyes
  const railEvery = Math.max(0.08, react * 0.5);          // s between replans while riding beside a rail
  const mind = new Map(), wells = new Map(), rams = new Map(), drafts = new Map();
  const intent = { target: null, turn: 0, action: null, burn: false };
  let aim = null, goal = 0, key = null, lastReal = 0, alarmAt = -1, sent = null, stunUntil = 0, railAt = 0;
  let burnAt = -1, lastBurn = -9, hitsSeen = 0, lastHitT = -9, launchBurned = false, oberthDone = null;
  let ramUntil = 0, ramAim = 0, pullUntil = 0, pullAim = 0, lastLeg = null, alarmOn = false;

  const decide = (it) => {
    let m = mind.get(it.id);
    if (!m) {
      const greedy = rnd() < o.greed;
      m = { greedy, hair: greedy && rnd() < o.greed * hairLove, err: o.whipper ? 0 : gauss() * o.jitterDeg };
      mind.set(it.id, m);
    }
    return m;
  };
  const wantDock = (ship) => {
    const d = o.policy && o.policy.dock;
    return d === 'hull2' ? ship.hull <= 2 : d === 'hull1' ? ship.hull <= 1 : false;
  };
  const redOK = (ship) => {
    if (o.red === 'never') return false;
    if (tidal) return true;
    if (ship.hull <= 1 && ship.shield < 1) return false;     // the red zone would wreck it
    if (o.whipper || o.red === 'always') return true;
    if (o.red === 'ttc12') return ship.ttc < 12;
    return o.whipGreed > 0.7;
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
    const red = redOK(ship);
    const span = (race.leg.rules && race.leg.rules.redSpan) || T.RED_SPAN;
    let bestV = -Infinity;
    for (const s of [1, -1]) {
      const b0 = it.psi + s * off;
      const scorchAt = 360 - off - win.core - ship.half;
      const redAt = scorchAt - span;
      // never plan a band past the warning (plus reaction time); a timid hand stays out of the red zone
      let limit = scorchAt;
      while (limit > 0 && sweepTime(limit, scorchAt, T, x) < T.SCORCH_WARN + react + 0.1) limit -= 2;
      if (!red) limit = Math.min(limit, redAt - 2);
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

  // Should it burn now? → a reason, or false.
  function burnWhy(race, ship, T, now) {
    if (o.burnPolicy === 'never' || ship.fuel < 1 - 1e-9) return false;
    const W = ship.whip;
    if (ship.ttc < T.TTC_WARN) return 'light';
    const earth = race.leg.type === 'earth';
    const keep = earth && o.land === 'keep' ? o.landKeep : 0;
    if (ship.fuel - keep < 1 - 1e-9) return false;
    // a card's burn (KICK OUT flings at once, PERFECT; SIDESTEP hops a hit it is turning away from)
    if (kickAt !== null && W && !W.latched && W.angle >= kickAt + 3) {
      const m = wells.get(W.well);
      const aim = m && finite(W.exitA[m.band]) ? W.exitA[m.band] : NaN;
      if (!finite(aim) || aim > W.angle + 25) return 'kick';
    }
    if (sidestep && !W && alarmOn && Math.abs(ship.turnRate) > 320) return 'sidestep';
    if (o.burnPolicy === 'ttc6') return false;
    if (!launchBurned && race.t < 3 && ship.gear === 0) return 'launch';
    if (now - lastHitT < 2 && ship.eta < 1.6) return 'hit';
    const leg = race.leg;
    if (leg.burnCap === null || (leg.rules && leg.rules.burnCap === null)) return 'void';
    if (earth && o.land === 'all') return 'land-all';
    // full tanks with a cell coming: burn one rather than waste the pickup
    if (ship.fuel > ship.fuelCap - 1 + 1e-9 && ship.eta < T.BURN_CAP - 0.2 && fuelAhead(race, ship, T)) return 'full';
    if (o.burnPolicy === 'all') {
      if (W && !W.latched && W.angle >= T.OBERTH_ANGLE + 5 && oberthDone !== W.well) return 'oberth';
      if (ship.surge.x > 1 && ship.surge.until > race.t && ship.fuel >= 2) return 'sling';
    }
    return false;
  }

  return (race, ship) => {
    intent.target = null; intent.turn = 0; intent.action = null; intent.burn = false;
    if (race.phase === 'done' || isOut(ship)) { aim = null; key = null; return intent; }
    const T = race.tune || TUNE;
    const now = race.real;
    if (lastLeg !== race.leg) {
      lastLeg = race.leg; aim = null; mind.clear(); wells.clear(); rams.clear(); drafts.clear();
      launchBurned = false; hitsSeen = ship.stats.hits; lastHitT = -9; lastBurn = -9; burnAt = -1;
    }
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
    if (ship.burn.t <= 0 && now - lastBurn > 1.0) {
      const why = burnWhy(race, ship, T, now);
      const quick = why === 'kick' || why === 'sidestep';
      if (why && burnAt < 0) burnAt = now + (o.whipper || quick ? Math.min(react, 0.08) : react);
      if (!why) burnAt = -1;
      if (why && burnAt >= 0 && now >= burnAt) {
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
    if (ramBias > 0 && race.ships.length > 1 && !T.PHASE_HULL) {
      for (const r of race.ships) {
        if (r === ship || isOut(r) || r.whip) continue;
        const z = Math.abs(r.dist - ship.dist) / bpsOf(ship, T);
        if (z > 0.25) continue;
        let m = rams.get(r.id);
        if (!m || now > m.until) {
          m = { go: rnd() < 0.2 + ramBias, until: now + 2.5, err: gauss() * o.reactMs / 4000 };
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
    const bps = bpsOf(ship, T);
    const items = upcoming(race, ship, T.TICK_LEAD + 0.2 - react, T);
    const k = items.length ? items[0].it.id : -1;
    const first0 = items.length ? items[0] : null;
    alarmOn = false;
    if (first0 && first0.t <= T.ALARM_LEAD
      && resolve(first0.it, goal, meetBeat(first0.it, ship.dist, bps), T, ship.half).hit) {
      alarmOn = true;
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
    const rails = activeRails(race, ship);
    // beside a rail (or about to meet one) the line is redrawn as it moves
    const railNear = rails.length > 0 || items.some((x) => x.it.kind === 'rail' && x.t < 0.4);
    if (k !== key || fix || (railNear && now >= railAt)) {
      key = k;
      railAt = now + railEvery;
      if (items.length) {
        const first = decide(items[0].it);
        const dock = wantDock(ship);
        const target = plan(race, ship, items, {
          depth: o.greed >= 0.5 || o.whipper ? 2 : 1, turn: thumb * 0.8, settle: react * 0.5, move: 0.01, from: aim,
          rails,
          gapsFor: (it) => {
            const m = decide(it);
            if (it.kind === 'rail') {
              const band = it.skimBand ?? T.SKIM_BAND;
              return m.greedy ? [band / 2] : [band + 3.5];
            }
            return m.greedy ? (m.hair ? [1.5, 4] : [4]) : [11];
          },
          val: { hit: -100, hair: 3, graze: 1.5, thread: 6, gate: dock ? 2 : 30, dock: dock ? 40 : -2,
            skim: 3, late: -40, margin: 0, fuel: 2 + 4 * (1 - ship.fuel / Math.max(1, ship.fuelCap)) },
        }, T);
        goal = target + (target === aim ? 0 : keepOff(race, ship, items, rails, target, first.err, bps, T));
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
    else if (draftSkill > 0) {
      let lead = null, bestZ = Infinity;
      for (const r of race.ships) {
        if (r === ship || isOut(r) || r.whip) continue;
        const z = (r.dist - ship.dist) / bps;
        if (z < 0.05 || z > 1.0 || Math.abs(wrap(r.bearing - ship.bearing)) > 25) continue;
        if (z < bestZ) { bestZ = z; lead = r; }
      }
      if (lead && !(win && win.t < 1.6)) {
        let d = drafts.get(lead.id);
        if (!d || now > d.until) {
          d = { go: rnd() < 0.35 + 0.65 * draftSkill, until: now + 3,
            pullAt: o.whipper ? 0.95 : clamp(0.55 + 0.4 * draftSkill + gauss() * 0.08, 0.5, 1) };
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
          } else {
            // tuck in, unless the wake's line would put it into something now
            const tuck = ship.bearing + wrap(lead.bearing - ship.bearing);
            if (!lineHit(race, ship, items, tuck, 0.5, bps, T)) goal = tuck;
          }
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

// The hand's error for this line, kept from carrying the ship into a rail it rides or is about to meet: toward a
// rail it may close at most to 1° off the rail's edge; away from it, the full error.
function keepOff(race, ship, items, rails, target, err, bps, T) {
  if (!err) return 0;
  let e = err;
  const check = (r, beat) => {
    if (!railOn(r, beat)) return;
    const d = wrap(target - psiAt(r, beat));
    if (Math.abs(d) > 40 || sgn(e) === sgn(d)) return;          // far, or the error points away from it
    const room = Math.max(0, Math.abs(d) - ship.half - r.half - 1);
    if (Math.abs(e) > room) e = sgn(e) * room;
  };
  for (const r of rails) check(r, meetBeat(r, ship.dist, bps));
  for (const x of items) if (x.it.kind === 'rail' && x.t < 0.6) check(x.it, meetBeat(x.it, ship.dist, bps));
  return e;
}

// Does a bearing, held, hit anything in `items` within `look` seconds?
function lineHit(race, ship, items, b, look, bps, T) {
  for (const x of items) {
    if (x.t > look) break;
    if (x.it.kind === 'pickup') continue;
    if (worth(x.it, b, meetBeat(x.it, ship.dist, bps), T, HIT_ONLY, 0, ship.half, bps) < 0) return true;
  }
  return false;
}
const HIT_ONLY = Object.freeze({ hit: -1, hair: 0, graze: 0, thread: 0, gate: 0, skim: 0, late: 0, margin: 0,
  fuel: 0, dock: 0 });

// Is a fuel cell coming within 2 s that nobody has taken?
function fuelAhead(race, ship, T) {
  const items = race.leg.items, bps = bpsOf(ship, T);
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind !== 'pickup' || it.type !== 'fuel') continue;
    const t = (it.beat - ship.dist) / bps;
    if (t > 0 && t < 2 && !(race.wells[it.id] && race.wells[it.id].holder) && !isDropped(race, it)) return true;
  }
  return false;
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
  const items = upcoming(race, ship, 0.8, T), bps = bpsOf(ship, T);
  const score = [0, 0];
  [1, -1].forEach((s, i) => {
    const b = lead.bearing + s * 22;
    for (const x of items) {
      if (resolve(x.it, b, meetBeat(x.it, ship.dist, bps), T, ship.half).hit) score[i] += 1;
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
  horizon: 2.4, depth: 3, turn: 480, settle: 0.05, replan: 0.12, move: 0.002,
  gapsFor: (it) => (it.kind === 'rail' ? [3] : [1.0, 10]), val: GRAZE_VAL,
}));
const whipper = (opts = {}) => human({ reactMs: 140, jitterDeg: 0, greed: 0.9, whipGreed: 1, burnPolicy: 'never',
  draftSkill: 0, ramBias: 0, ...opts, whipper: true });
export const DRIVERS = Object.freeze({ idle, dodge, graze, whipper, human });

// The human() presets and their default run policies (21.1).
export const PRESETS = Object.freeze({
  weak: Object.freeze({ reactMs: 380, jitterDeg: 10, greed: 0.1, whipGreed: 0.1, burnPolicy: 'never', draftSkill: 0,
    ramBias: 0, policy: Object.freeze({ dock: 'hull1', lane: 'safe', pick: 'casual' }) }),
  novice: Object.freeze({ reactMs: 300, jitterDeg: 7, greed: 0.2, whipGreed: 0.3, burnPolicy: 'ttc6', draftSkill: 0.2,
    ramBias: 0, policy: Object.freeze({ dock: 'hull1', lane: 'safe', pick: 'casual' }) }),
  mid: Object.freeze({ reactMs: 200, jitterDeg: 3, greed: 0.6, whipGreed: 0.6, burnPolicy: 'launch-hits',
    draftSkill: 0.6, ramBias: 0.3, policy: Object.freeze({ dock: 'hull1', lane: 'family', pick: 'planner' }) }),
  expert: Object.freeze({ reactMs: 140, jitterDeg: 1.5, greed: 0.9, whipGreed: 0.85, burnPolicy: 'all',
    draftSkill: 0.9, ramBias: 0.6, policy: Object.freeze({ dock: 'never', lane: 'risk', pick: 'planner' }) }),
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

// ---------------------------------------------------------------- run policies (21.1)

// The lane for the next leg. safe: the plain lane (FIXED, FAMILY, JUPITER), never the VOID; family: the FAMILY lane;
// risk: the RISK lane (THE ASTEROID BELT at Earth); void: THE LOCAL VOID on leg 4, else as family. → the lane index.
export function laneFor(run, policy) {
  const lanes = run.chart[run.leg + 1] || [];
  const want = policy && policy.lane;
  const find = (f) => lanes.findIndex(f);
  let i = -1;
  if (want === 'risk') i = find((l) => l.kind === 'risk' || l.kind === 'short');
  else if (want === 'void') i = find((l) => l.kind === 'void');
  else if (want === 'family') i = find((l) => l.kind === 'family');
  if (i < 0) i = find((l) => l.kind !== 'risk' && l.kind !== 'void' && l.kind !== 'short');
  return i < 0 ? 0 : i;
}

// How much a mid player wants a starter (the planner's taste). Fusions, legendaries and trophies rank above.
const TASTE = Object.freeze({
  'twin-deflector': 9, 'bussard-scoop': 8, 'hair-trigger': 7, afterburner: 7, 'ablative-tanks': 7, 'slow-orbit': 6,
  'still-light': 6, scrape: 6, 'tidal-frame': 6, 'kick-out': 6, 'long-chain': 5, 'reactive-hull': 5,
  'steady-hand': 5, slipstream: 5, 'leech-line': 5, 'phase-hull': 5, 'far-sight': 4, 'battering-prow': 4,
  sidestep: 4, 'mass-shadow': 3, bounty: 3, 'dirty-air': 3,
});

// The card to take from an offer by pick policy. casual: any; focus: the family it owns most; spread: a family it
// does not own; planner: legendaries, fusions, cards that complete one, then its family toward a legendary and its
// taste; risk: the rarest, then as planner. → an index into offer.cards, or -1 for none.
export function pickFor(run, policy, rnd = Math.random) {
  const o = run.offer;
  if (!o || !o.cards.length) return -1;
  const open = o.cards.map((c, i) => i).filter((i) => !o.taken.includes(i));
  if (!open.length) return -1;
  const how = (policy && policy.pick) || 'casual';
  if (how === 'casual') return open[Math.floor(rnd() * open.length)];
  const owned = new Map();
  for (const b of run.build) {
    const c = CARD[b.id];
    if (c) owned.set(c.fam, (owned.get(c.fam) || 0) + 1);
  }
  const top = [...owned.entries()].sort((a, b) => b[1] - a[1])[0];
  const score = (i) => {
    const c = o.cards[i], card = CARD[c.id];
    if (!card) return -1;
    let s = (TASTE[c.id] ?? 6) + 2 * (c.r || 0);
    const fam = owned.get(card.fam) || 0;
    if (how === 'focus') s += top && card.fam === top[0] ? 20 : 0;
    if (how === 'spread') s += fam ? 0 : 20;
    if (how === 'planner' || how === 'risk') {
      if (card.kind === 'legend') s += 100;
      if (card.kind === 'fusion') s += 60;
      if (card.kind === 'trophy') s += 8;
      if (c.completes) s += 25;
      s += 3 * fam;
      if (card.kind === 'form' && c.replaces) s -= 8;
    }
    if (how === 'risk') s += 30 * (c.r || 0);
    return s;
  };
  let best = open[0], bs = -Infinity;
  for (const i of open) { const s = score(i); if (s > bs) { bs = s; best = i; } }
  return best;
}

// The dock strip: REPAIR while the hull is under 2, REFUEL while the tanks hold under 2 cells, if the floor allows.
export function dockFor(run, policy, tune) {
  if (!run.dock) return [];
  const got = [];
  const Y = run.you;
  const want = (id) => (id === 'repair' ? Y.hull < 2 : id === 'refuel' ? Y.fuel < 2 : false);
  for (const id of ['repair', 'refuel']) {
    const c = dockPrices(run, tune).find((x) => x.id === id);
    if (c && c.ok && !c.bought && want(id) && buyChip(run, id, tune)) got.push(id);
  }
  return got;
}

// ---------------------------------------------------------------- the leg recorder

// Counts what a ship did in a leg, step by step, from the events and its own state: the stats 21.2 and the 20 % rule
// read. Cheap: a handful of events a step and a few fields.
function recorder(race, ship) {
  const L = race.leg;
  const s = {
    legNo: race.legNo, type: L.type, lane: L.lane ? L.lane.id : null, kind: L.lane ? L.lane.kind : null,
    beats: L.beats, t: 0, why: null, place: null, gate: null,
    grazes: 0, hairs: 0, rivalGrazes: 0, skimS: 0, hits: 0, shieldPops: 0, hullLost: 0, burns: 0, oberths: 0, drys: 0,
    windows: 0, grabs: 0, releases: 0, good: 0, perfect: 0, wide: 0, reds: 0, redIns: 0, scorches: 0, drafts: 0,
    draftFull: 0, slings: 0, slamsBy: 0, slamsOn: 0, takedownsBy: 0, takedownsOn: 0, spilled: 0, fuelPicked: 0,
    patches: 0, glareIns: 0, glareOuts: 0, glareS: 0, warnS: 0, ttcMin: Infinity, gapMin: Infinity, topGear: 0,
    g1At: null, g2At: null, lightspeed: false, years: 0, fuelEnd: 0, hullEnd: 0, fuelStart: ship.fuel,
    etaEnd: 0, gearEnd: 0, eaten: [], drifterEaten: null, boss: null, bossBeaten: false, firstPlace: false,
    hitsBy: {}, passesBy: {}, causes: {}, glareBeforeCatch: null, landMargin: null, doorstep: false,
    cards: 0,
  };
  let next = 0, glareSeen = false;
  const items = L.items;
  return {
    s,
    step(ev, dt) {
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i];
        if (e.type === 'eaten') {
          const v = race.ships.find((x) => x.id === e.id);
          if (v && (v.kind === 'regular' || v.kind === 'boss')) s.eaten.push(v.type || v.id);
          else if (v && v.kind === 'drifter' && s.drifterEaten === null) s.drifterEaten = e.t;
          continue;
        }
        if (e.type === 'contact' && e.kind === 'slam') {
          if (e.by === ship.id) s.slamsBy++;
          else if (e.victim === ship.id) s.slamsOn++;
          continue;
        }
        if (e.type === 'takedown') {
          if (e.by === ship.id) s.takedownsBy++;
          else if (e.victim === ship.id) s.takedownsOn++;
          continue;
        }
        if (e.ship !== ship.id) continue;
        switch (e.type) {
          case 'graze': s.grazes++; break;
          case 'hair': s.hairs++; break;
          case 'rivalGraze': s.rivalGrazes++; break;
          case 'hit': {
            s.hits++;
            const p = e.piece || e.cause || '?';
            s.hitsBy[p] = (s.hitsBy[p] || 0) + 1;
            s.causes[e.cause] = (s.causes[e.cause] || 0) + 1;
            break;
          }
          case 'shieldPop': s.shieldPops++; break;
          case 'hullLost': s.hullLost++; break;
          case 'burn': s.burns++; break;
          case 'oberth': s.burns++; s.oberths++; break;
          case 'dry': if (e.why === 'fuel') s.drys++; break;
          case 'window': if (e.inReach !== false) s.windows++; break;
          case 'grab': s.grabs++; break;
          case 'release':
            s.releases++;
            if (e.grade === 'PERFECT') { s.perfect++; s.good++; } else if (e.grade === 'GOOD') s.good++; else s.wide++;
            if (e.red) s.reds++;
            if (e.scorched) s.scorches++;
            break;
          case 'redIn': s.redIns++; break;
          case 'wake': s.drafts++; break;
          case 'draftFull': s.draftFull++; break;
          case 'slingshot': s.slings++; break;
          case 'spill': s.spilled++; break;
          case 'pickFuel': s.fuelPicked++; break;
          case 'pickPatch': s.patches++; break;
          case 'glareIn': s.glareIns++; glareSeen = true; break;
          case 'glareOut': s.glareOuts++; break;
          case 'caught': if (e.why !== 'wreck') s.glareBeforeCatch = glareSeen; break;
          case 'land': s.landMargin = e.margin; s.doorstep = !e.ok; break;
          case 'gateLine': if (e.place === 1) s.firstPlace = true; break;
          default:
        }
      }
      // passes by piece: every hazard you fly past (rails once), for hits per pass
      while (next < items.length && items[next].beat <= ship.dist) {
        const it = items[next++];
        if (!isHazard(it) || isDropped(race, it)) continue;
        const p = it.piece || it.kind;
        s.passesBy[p] = (s.passesBy[p] || 0) + 1;
      }
      if (!(dt > 0)) return;
      if (skimOf(ship) > 0) s.skimS += dt;
      if (ship.light === 'glare') s.glareS += dt;
      if (ship.light === 'warned' || ship.light === 'glare') s.warnS += dt;
      if (ship.ttc < s.ttcMin) s.ttcMin = ship.ttc;
      if (ship.gap < s.gapMin) s.gapMin = ship.gap;
      if (ship.gear > s.topGear) s.topGear = ship.gear;
      if (ship.gear >= 1 && s.g1At === null) s.g1At = ship.dist / L.beats;
      if (ship.gear >= 2 && s.g2At === null) s.g2At = ship.dist / L.beats;
      if (ship.lightspeed) s.lightspeed = true;
    },
    end(run) {
      s.t = race.t;
      s.years = ship.years;
      s.fuelEnd = ship.fuel;
      s.hullEnd = ship.hull;
      s.etaEnd = ship.eta;
      s.gearEnd = ship.gear;
      const rec = run && run.legs[run.legs.length - 1];
      if (rec) {
        s.why = rec.why;
        s.place = rec.place;
        s.gate = rec.gate;
        s.boss = rec.boss;
        s.bossBeaten = rec.bossBeaten;
        s.eaten = [...new Set([...(rec.eaten || []), ...s.eaten])];
      }
      if (s.ttcMin === Infinity) s.ttcMin = ship.ttc;
      return s;
    },
  };
}

// ---------------------------------------------------------------- whole runs

// A returning player's meta (TEACH_RUNS runs played, a GOOD whip landed, the first offer seen): the course and offers
// every run after the first few. playRun uses it unless given a meta (null plays a first run).
export const RETURNING = Object.freeze({ seen: { runs: 3, goodWhip: true, offered: true } });

// Play a whole run headless, at most maxS sim seconds in all. → a summary of the run and of every leg.
//   driver: a driver or preset name; opts: more knobs for it (burnPolicy, red, land, ...); policy: { dock, lane,
//   pick } over the preset's (null for a plain driver: lane 0, no card); meta: the meta (RETURNING by default);
//   redshift, ship; setup(run): a hook before the first leg (start at another leg, set meters); legs: stop after
//   this many legs; force: { at, id, r } takes that card at break `at` in place of the offer; onBreak(run): a hook
//   at each break before the policy answers it.
export function playRun({ seed = 1, driver = 'idle', policy = null, tune = TUNE, maxS = 900, opts = {},
  meta = RETURNING, redshift = 0, ship = 'lantern', setup = null, legs = Infinity, force = null,
  onBreak = null } = {}) {
  const preset = PRESETS[driver];
  const pol = policy || preset ? { ...(preset ? preset.policy : {}), ...(policy || {}) } : null;
  const run = createRun({ seed, tune, meta: meta ? normalizeMeta(meta) : null, redshift, ship });
  if (setup) setup(run);
  const rnd = mulberry32(hashSeed('picks', seed));
  let t = 0, events = 0, played = 0;
  const legStats = [];
  for (;;) {
    const race = startLeg(run, tune);
    const you = race.ships[0];
    const drive = driverFor(driver, { seed: hashSeed(seed, run.leg), policy: pol, cards: run.build, ...opts });
    const R = recorder(race, you);
    const intents = { you: NO_INTENT };
    while (race.phase !== 'done' && t < maxS) {
      intents.you = drive(race, you) || NO_INTENT;
      const t0 = race.t;
      const ev = stepRace(race, intents, STEP);
      events += ev.length;
      R.step(ev, race.t - t0);
      t += STEP;
    }
    endLeg(run, race);
    const st = R.end(run);
    st.cards = run.build.length;
    legStats.push(st);
    played++;
    if (run.phase !== 'break' || t >= maxS || played >= legs) break;
    if (onBreak) onBreak(run);
    // the break: the dock strip, the offer, then the lane
    if (pol) dockFor(run, pol, tune);
    if (force && run.legs.length === force.at && run.offer) {
      const i = run.offer.cards.findIndex((c) => c.id === force.id);
      if (i >= 0) { run.offer.cards[i].r = force.r ?? run.offer.cards[i].r; pickCard(run, i); }
      else {
        run.offer.cards.push({ id: force.id, r: force.r || 0, slot: 9, why: 'forced', replaces: null,
          completes: null });
        pickCard(run, run.offer.cards.length - 1);
      }
    }
    if (pol && run.offer) {
      let guard = 8;
      while (run.phase === 'break' && run.offer && guard-- > 0) {
        const i = pickFor(run, pol, rnd);
        if (i < 0 || !pickCard(run, i)) { skipOffer(run, tune); break; }
      }
    }
    if (!chooseLane(run, pol ? laneFor(run, pol) : 0)) break;
  }
  const last = legStats[legStats.length - 1] || null;
  const home = run.phase === 'home';
  return {
    seed, driver, policy: pol, phase: run.phase, home, legs: run.legs.length, years: run.you.years,
    earth: run.you.earth, t, events, why: last ? last.why : null,
    caughtLeg: home ? null : run.legs.length, furthest: home ? ROUTE.length + 1 : run.legs.length,
    build: run.build.map((b) => b.id), firstHome: Boolean(run.legs.length && run.legs[run.legs.length - 1].firstHome),
    offered: [...new Set(run.legs.flatMap((l) => l.offered || []))],
    legStats,
  };
}
