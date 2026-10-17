// Ahead of the Light: handling (final.md 5 and 6) for every ship under the same rules. Steering (lab A's chase and
// key ramp), the pass check through kinds.resolve (grazes, hairlines, the chain, rail skims, gates, pickups), the
// burn, the whip (lab B's swing rebuilt for the ring: window, latch, sweep, red zone, exit bands, LET GO, release,
// scorch), draft, tow and the slingshot, contact (BUMP, SLAM, rear-end, takedowns, TRAPPED), hits, the gears and the
// nines, HEADLIGHT and LIGHT SPEED. The player, the bots and the rivals all reach it through the same intents.
// Pure: no clocks, no Math.random. The step allocates nothing but its events: each ship's whip and shove objects are
// made once, and the few values that live for a step or two (the bearing at the step's start, the skim, the last
// passes for TRAPPED) sit in a per-ship scratch.
import { TUNE } from './tune.js';
import { emit, E, runHooks } from './events.js';
import { courseSpeed, wrap } from './ringmath.js';
import { resolve, psiAt, railOn, wellCore, wellReach } from './course/kinds.js';

const REAR_DEG = 3;            // 5.5: a ship within 3° straight behind another rear-ends it
const SLING_WINDOW = 0.4;      // s after leaving a wake in which a pull-out still slingshots
const CONTACT_CD = 0.1;        // s after a shove ends before the same two ships can touch again
const APPROACH_S = 1.5;        // 5.3: a well's reach arc and exit bands show this long before it is abreast
const RECENT = 4;              // passes each ship remembers, for TRAPPED
const RAIL_CLEAR = 1;           // °: a rail hit glides the ship out to this far past the rail's edge
const GEAR_HYST = 0.04;        // η: a gear drops only this far under its nine, so drag at a nine does not flap it
const GRADES = ['PERFECT', 'GOOD', 'WIDE'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const isOut = (s) => s.caught || s.wrecked;
const isYou = (s) => s.kind === 'you';
// (returns a value the table already holds, so it never boxes a new double)
const etaTop = (s, T) => (isYou(s) || T.ETA_MAX < T.RIVAL_ETA_MAX ? T.ETA_MAX : T.RIVAL_ETA_MAX);
const WHALE = (s) => s.kind === 'boss' && s.type === 'whale';
// The tuning a ship flies with in a race: yours is race.tune (your ship's and cards' patches), every other ship's is
// race.baseTune.
const tuneOf = (race, s) => (isYou(s) ? race.tune : race.baseTune || race.tune) || TUNE;
const MAKO = (s) => s.kind === 'boss' && s.type === 'mako';

// Course beats a second for a ship (its tow and surges aside): seconds to an item are beats ÷ this.
export const bpsOf = (ship, tune = TUNE) => courseSpeed(ship.eta, tune, ship.lightspeed) / tune.BEAT_R;

// ---------------------------------------------------------------- ships

// The scratch's numbers live in one Float64Array (n), so writing them never boxes a double.
const B0 = 0, D0 = 1, RDT = 2, SDT = 3, SKIM = 4, SKIM_NOW = 5, REL_T = 6;
const SCRATCH = new WeakMap();
function scratch(ship) {
  let s = SCRATCH.get(ship);
  if (!s) {
    s = {
      n: new Float64Array(7), winWell: null,
      whip: { well: null, psi: 0, size: 'medium', mass: 1, core: 5, reach: 40, side: 1, dir: 1, b0: 0, angle: 0, t: 0,
        latched: true, red: false, cost: 0, scorchAt: 300, redAt: 225, teach: false, x: 1, n: 0,
        exits: [0, 0], exitA: [NaN, NaN], letgo: [false, false], warned: false, gate: null },
      shove: { v: 0, left: 0, until: -1, by: null, t0: -1e9, slam: false },
      recId: new Array(RECENT).fill(null), recT: new Float64Array(RECENT), recGap: new Float64Array(RECENT), recK: 0,
      ctx: { race: null, ship, event: null, tune: null, item: null, res: null, bearing: 0, other: null, gap: 0 },
    };
    s.n[B0] = ship.bearing;
    s.n[D0] = ship.dist;
    s.n[REL_T] = -1e9;
    SCRATCH.set(ship, s);
  }
  return s;
}

// A ship in a race (18.2). meters: { hull, hullMax, shield, shieldMax, fuel, fuelCap, gap, bestGear } carried from
// the run (yours) or the field (a rival's); anything missing starts at the tuning table's value. bestGear makes
// `gearUp { best }` a best of the run (6.2) once the run carries it.
export function createShip({ id, kind = 'you', type = 'lantern', name = null, bearing = 0, eta = 1.0, meters = {},
  tune = TUNE } = {}) {
  const T = tune, m = meters || {};
  const gap = m.gap ?? T.GAP0;
  const ship = {
    id, kind, name: name ?? (kind === 'you' ? 'YOU' : String(id).toUpperCase()), type,
    half: T.SHIP_HALF, turnMax: T.TURN_MAX,
    bearing, target: bearing, turnRate: 0,
    dist: 0, far: null,
    eta, gear: gearOf(eta, T), bestGear: m.bestGear ?? 0, headlight: false, lightspeed: false, punch: 0,
    hull: m.hull ?? T.HULL0, hullMax: m.hullMax ?? T.HULL_MAX, shield: m.shield ?? T.SHIELD_MAX,
    shieldMax: m.shieldMax ?? T.SHIELD_MAX, shieldT: 99,
    fuel: m.fuel ?? T.FUEL0, fuelCap: m.fuelCap ?? T.FUEL_CAP, burn: { t: 0, queued: false, left: 0, rate: 0, cap: 0 },
    gap, ttc: gap / Math.max(1e-9, 1 - Math.tanh(eta)), light: 'far',
    lightHold: 0, overCap: 0,
    chain: 0, chainT: 0, flicker: 0, stumble: 0, soft: true,
    whip: null,
    draft: { lead: null, charge: 0, keep: 0, tow: T.TOW, exitLead: null, exitCharge: 0, exitT: -1e9 },
    surge: { x: 1, until: 0 },
    shove: null,
    gate: null,
    caught: false, wrecked: false, fedBy: null,
    years: 0, earth: 0,
    ai: null,
    stats: { grazes: 0, hairs: 0, hits: 0, burns: 0, whips: 0, perfect: 0, slings: 0, slams: 0, takedowns: 0,
      glareS: 0, topGear: 0 },
  };
  ship.headlight = ship.gear >= 2;
  scratch(ship);
  return ship;
}

function shipById(race, id) {
  const ships = race.ships;
  for (let i = 0; i < ships.length; i++) if (ships[i].id === id) return ships[i];
  return null;
}

// The world runs at x for s more real seconds. A stronger slow motion already running wins.
function slowFor(race, x, s) {
  const sl = race.slow;
  if (race.real < sl.until && sl.x < x) return;
  if (race.real < sl.until && sl.x === x) { sl.until = Math.max(sl.until, race.real + s); return; }
  sl.x = x;
  sl.until = race.real + s;
}

// ---------------------------------------------------------------- steering (5.1)

// Steering from an intent { target: deg | null, turn: −1..1 }: a target is chased at up to turnMax (lab A's
// TURN_TAU), keys and the pad turn at KEY_TURN × turn with a KEY_RAMP ramp and carry the target with them. A shove
// slides the ship (and its target) aside, and while it lasts the ship cannot steer. dt: real seconds (0 in a
// hit-stop). A whip owns the bearing.
export function steerShip(ship, intent, dt, tune = TUNE) {
  const T = tune, S = scratch(ship);
  const b0 = ship.bearing;
  S.n[B0] = b0;
  if (!(dt > 0)) { ship.turnRate = 0; return; }
  if (ship.whip) { ship.target = ship.bearing; return; }
  const sh = ship.shove;
  if (sh && sh.left > 0) {
    const d = Math.min(sh.left, Math.abs(sh.v) * dt), s = sh.v < 0 ? -d : d;
    ship.bearing += s;
    ship.target = ship.bearing;
    sh.left -= d;
    ship.turnRate = s / dt;
    return;
  }
  const turn = intent && finite(intent.turn) ? clamp(intent.turn, -1, 1) : 0;
  if (intent && finite(intent.target)) ship.target = intent.target;
  if (turn !== 0) {
    const want = turn * T.KEY_TURN;
    let v = Math.sign(ship.turnRate) === Math.sign(turn) ? clamp(ship.turnRate, -T.KEY_TURN, T.KEY_TURN) : 0;
    v += (want - v) * Math.min(1, dt / Math.max(1e-3, T.KEY_RAMP));
    ship.bearing += v * dt;
    ship.target = ship.bearing;
  } else {
    const err = ship.target - ship.bearing;
    const max = ship.turnMax || T.TURN_MAX;
    const v = clamp(err / Math.max(1e-3, T.TURN_TAU), -max, max);
    ship.bearing = Math.abs(v * dt) >= Math.abs(err) ? ship.target : ship.bearing + v * dt;
  }
  if (!finite(ship.bearing)) ship.bearing = b0;
  if (!finite(ship.target)) ship.target = ship.bearing;
  ship.turnRate = (ship.bearing - b0) / dt;
}

// ---------------------------------------------------------------- the ship's upkeep (step part 1)

// After steering and burns: burn ramps, drag and the engine, suction, the chain timer, the soft start, timers, and the
// gears with HEADLIGHT and LIGHT SPEED. rdt: real seconds (0 in a hit-stop); sdt: sim seconds.
export function stepHandle(race, ship, intent, rdt, sdt, tune = TUNE) {
  const T = tune, S = scratch(ship);
  const N = S.n;
  N[RDT] = rdt > 0 ? rdt : 0;
  N[SDT] = sdt > 0 ? sdt : 0;
  N[D0] = ship.dist;
  const dt = N[SDT];
  ship.soft = race.legNo === 0 && race.t < T.SOFT_S;
  if (ship.flicker > 0) ship.flicker = Math.max(0, ship.flicker - dt);
  if (ship.punch > 0) ship.punch = Math.max(0, ship.punch - N[RDT]);
  if (ship.surge.x !== 1 && ship.surge.until <= race.t) ship.surge.x = 1;
  if (ship.shove && ship.shove.left <= 0 && race.t > ship.shove.until + CONTACT_CD) ship.shove = null;

  // the burn's ramp: BURN_ETA over BURN_S, never past its cap; a queued burn fires as it ends
  const B = ship.burn;
  if (B.t > 0 && dt > 0) {
    const st = Math.min(B.t, dt);
    const add = Math.min(B.left, B.rate * st);
    B.left -= add;
    B.t -= st;
    const room = B.cap - ship.eta;
    if (room > 0) ship.eta += Math.min(add, room);
    if (B.t <= 1e-9) {
      B.t = 0;
      B.left = 0;
      if (B.queued) { B.queued = false; fire(race, ship, T); }
    }
  }

  // drag above cruise (none in a wake or with no gas), the engine below it, suction in a wake
  if (dt > 0) {
    const D = ship.draft;
    if (D.lead) {
      const lead = shipById(race, D.lead);
      ship.eta += (lead && WHALE(lead) ? T.WHALE.suction : T.SUCTION) * dt;
    } else if (ship.eta > T.ETA0) {
      if (!race.leg.noDrag) {
        const drag = T.DRAG * (1 + T.DRAG_GEAR * ship.gear) * (race.leg.dragX ?? 1);
        ship.eta = Math.max(T.ETA0, ship.eta - drag * dt);
      }
    } else if (ship.eta < T.ETA0) ship.eta = Math.min(T.ETA0, ship.eta + T.ENGINE * dt);
    if (ship.eta > etaTop(ship, T)) ship.eta = etaTop(ship, T);
    if (!(ship.eta >= T.ETA_MIN)) ship.eta = finite(ship.eta) ? T.ETA_MIN : T.ETA0;

    // the chain lapses after CHAIN_TIMEOUT with no graze
    if (ship.chain > 0) {
      ship.chainT += dt;
      if (ship.chainT > T.CHAIN_TIMEOUT) breakChain(race, ship, 'timeout');
    }
  }
  gearStep(race, ship, T);
}

function breakChain(race, ship, why) {
  if (ship.chain > 0) emit(race, E.chainEnd, ship, { chain: ship.chain, why });
  ship.chain = 0;
  ship.chainT = 0;
}

// The gear for a speed, 0..4 by the nines (0.9c, 0.99c, 0.999c, 0.9999c).
export function gearOf(eta, tune = TUNE) {
  const N = tune.NINES;
  let g = 0;
  for (let i = 0; i < N.length; i++) if (eta >= N[i] - 1e-9) g++;     // indexed: for-of on a frozen array allocates
  return g;
}

// Gears, HEADLIGHT and LIGHT SPEED from the speed now (6.2). Every crossing of a nine sends gearUp { gear, best } or
// gearDown (a gear drops GEAR_HYST under its nine, so the key does not flap); best is a new best gear (the run's once
// run.you carries bestGear). HEADLIGHT lights on the first 0.99c of
// each leg, with the full moment (slow motion) only on the run's first. LIGHT SPEED is the player's: a freeze, the
// punch and course speed × LS_SURGE, until a hit, a scorch, a WIDE release or a fall under the fourth nine drops
// the ship to LS_DROP.
function gearStep(race, ship, T) {
  if (ship.lightspeed && ship.eta < T.NINES[3] - 1e-9) endLightspeed(race, ship, T, 'slow');
  const best0 = ship.bestGear;
  let g = gearOf(ship.eta, T);
  if (g < ship.gear && !ship.lightspeed) g = Math.min(ship.gear, gearOf(ship.eta + GEAR_HYST, T));
  if (g !== ship.gear) {
    if (g > ship.gear) {
      for (let k = ship.gear + 1; k <= g; k++) {
        const best = k > ship.bestGear;
        if (best) ship.bestGear = k;
        emit(race, E.gearUp, ship, { gear: k, best });
      }
    } else emit(race, E.gearDown, ship, { gear: g, from: ship.gear });
    ship.gear = g;
  }
  const lit = g >= 2;
  if (lit && !ship.headlight) {
    ship.headlight = true;
    if (ship.stats.topGear < 2) {
      const full = isYou(ship) && best0 < 2;
      if (full) slowFor(race, T.SLOWMO_X, T.HEADLIGHT_SLOW);
      emit(race, E.headlight, ship, { first: best0 < 2, full, thread: false });
    }
  } else if (!lit && ship.headlight) ship.headlight = false;
  if (g >= 4 && isYou(ship) && !ship.lightspeed) {
    ship.lightspeed = true;
    ship.punch = T.PUNCH_S;
    race.stop = Math.max(race.stop, T.LS_FREEZE);
    emit(race, E.lightspeed, ship, { eta: ship.eta });
  }
  if (g > ship.stats.topGear) ship.stats.topGear = g;
}

function endLightspeed(race, ship, T, why) {
  if (!ship.lightspeed) return;
  ship.lightspeed = false;
  ship.eta = Math.min(ship.eta, T.LS_DROP);
  emit(race, E.dropout, ship, { why, eta: ship.eta });
}

// ---------------------------------------------------------------- the burn (5.2)

// A burn: → 'burn' | 'oberth' | 'dry'. A whole fuel cell buys BURN_ETA over BURN_S, never above the leg's burn cap
// (BURN_CAP; none in the VOID); past OBERTH_ANGLE in a whip it is OBERTH_ETA with no cap. One more burn queues
// during a ramp. In HEADLIGHT or above a burn also adds CHAIN_LIT_BONUS to the chain timer. With no fuel: `dry`.
export function burn(race, ship, tune = TUNE) {
  if (isOut(ship)) return 'dry';
  if (ship.burn.t > 0) {
    if (ship.fuel < 1 - 1e-9 && !ship.burn.queued) return fire(race, ship, tune);
    ship.burn.queued = true;
    return 'burn';
  }
  return fire(race, ship, tune);
}

function fire(race, ship, T) {
  if (!(ship.fuel >= 1 - 1e-9)) {
    emit(race, E.dry, ship, { why: 'fuel' });
    return 'dry';
  }
  ship.fuel = Math.max(0, ship.fuel - 1);
  const W = ship.whip;
  const oberth = Boolean(W && !W.latched && W.angle >= T.OBERTH_ANGLE);
  const legCap = race.leg.burnCap === null ? Infinity : race.leg.burnCap ?? T.BURN_CAP;
  const B = ship.burn;
  B.left = oberth ? T.OBERTH_ETA : T.BURN_ETA;
  B.t = Math.max(1e-3, T.BURN_S);
  B.rate = B.left / B.t;
  B.cap = oberth ? etaTop(ship, T) : Math.min(legCap, etaTop(ship, T));
  B.queued = false;
  if (ship.gear >= 2 && ship.chain > 0) ship.chainT -= T.CHAIN_LIT_BONUS;
  ship.stats.burns++;
  emit(race, oberth ? E.oberth : E.burn, ship, { eta: ship.eta, cap: finite(B.cap) ? B.cap : null, fuel: ship.fuel });
  return oberth ? 'oberth' : 'burn';
}

// ---------------------------------------------------------------- the pass check (5.1)

// The pass check for one course item. race.js calls it when the ship's dist crosses item.beat, with `at` the share of
// the step where it crossed (0..1), and each step a lasting item (rail, fog) is beside the ship, with at = null.
// Instant kinds go through kinds.resolve at the bearing of the crossing; rails are ridden (a skim) or crossed (a
// hit) step by step. Emits into race.events and returns that buffer.
export function passCheck(race, ship, item, tune = TUNE, at = null) {
  const T = tune, S = scratch(ship);
  if (isOut(ship)) return race.events;
  if (at === null) {
    if (item.kind === 'rail') ride(race, ship, item, T, S);
    return race.events;
  }
  const f = clamp(at, 0, 1);
  const b = S.n[B0] + (ship.bearing - S.n[B0]) * f;
  const t = race.t - S.n[SDT] * (1 - f);
  switch (item.kind) {
    case 'cue': case 'fog': return race.events;
    case 'pickup': {
      const W = race.wells[item.id];
      if (W && W.holder) return race.events;
      const r = resolve(item, b, item.beat, T, ship.half);
      if (!r.take) return race.events;
      if (W) W.holder = ship.id;
      else race.wells[item.id] = { holder: ship.id };
      emit(race, item.type === 'patch' ? E.pickPatch : E.pickFuel, ship,
        { t, item: item.id, piece: item.piece ?? null, psi: item.psi });
      return race.events;
    }
    default:
  }
  // a gate crossed mid-whip is judged at the release, at the bearing you let go (SLINGSHOT HOME's well sits just
  // before its gate: a fling through the gap is a thread)
  if (ship.whip && item.kind === 'gate' && !item.pair) { ship.whip.gate = item; return race.events; }
  if (ship.whip && (item.kind !== 'knot' && item.kind !== 'pulse')) return race.events;   // walls, rails: no touch
  if (item.kind === 'well' && ship.whip && ship.whip.well === item.id) return race.events;
  const r = resolve(item, b, item.beat, T, ship.half);
  if (isYou(ship) && race.hooks && race.hooks.pass) {
    const c = S.ctx;
    c.race = race; c.tune = T; c.item = item; c.res = r; c.bearing = b; c.event = null;
    runHooks(race, 'pass', c);
  }
  remember(S, item.id, t, r.overlap);
  if (r.hit) {
    // a knot crossed mid-whip is a plain graze (5.3; LENSED LANE's pass hook makes it a hairline)
    if (ship.whip) { graze(race, ship, item, T.HAIR, 1, t, T); return race.events; }
    hit(race, ship, item.kind, T, item);
    if (item.kind === 'gate' && !item.pair) {
      ship.gate = 'past';
      emit(race, E.thread, ship, { t, gate: item.id, miss: true });
    }
    return race.events;
  }
  if (item.kind === 'rail') return race.events;     // a rail's front only checks for a hit; riding it is a skim
  const band = item.soft || (race.legNo === 0 && item.beat < T.SOFT_BEATS) ? T.GRAZE_SOFT : T.GRAZE;
  const gaps = r.gaps;
  for (let k = 0; k < gaps.length; k++) if (gaps[k].g < band) graze(race, ship, item, gaps[k].g, gaps[k].side, t, T);
  if (item.kind === 'gate') gatePass(race, ship, item, r, t, T);
  return race.events;
}

function remember(S, id, t, gap) {
  const k = S.recK;
  S.recId[k] = id;
  S.recT[k] = t;
  S.recGap[k] = finite(gap) ? gap : 1e9;
  S.recK = (k + 1) % RECENT;
}

function graze(race, ship, item, g, side, t, T) {
  if (WHALE(ship)) return;                       // 10.3: the WHALE cannot graze (too big)
  const hair = g < T.HAIR;
  const top = etaTop(ship, T);
  ship.eta = Math.min(top, ship.eta + (hair ? T.KICK_HAIR : T.KICK));
  ship.chain++;
  ship.chainT = Math.min(ship.chainT, 0);
  if (hair) ship.stats.hairs++; else ship.stats.grazes++;
  emit(race, hair ? E.hair : E.graze, ship, { t, gap: g, side, item: item.id, kind: item.kind, chain: ship.chain,
    piece: item.piece ?? null, psi: item.psi });
}

// THREAD, a pair, DOCK or fly past (9.1). Survival pays the gap from the event.
function gatePass(race, ship, item, r, t, T) {
  if (item.pair) {
    if (!r.thread) return;
    ship.eta = Math.min(etaTop(ship, T), ship.eta + T.PAIR_ETA);
    ship.chain++;
    ship.chainT = Math.min(ship.chainT, 0);
    emit(race, E.thread, ship, { t, gate: item.id, pair: true, miss: false, piece: item.piece ?? null });
    return;
  }
  if (r.thread) {
    ship.gate = 'thread';
    ship.eta = Math.min(etaTop(ship, T), Math.max(ship.eta + T.THREAD_ETA, T.NINES[1] + 0.02));
    emit(race, E.thread, ship, { t, gate: item.id, pair: false, miss: false, piece: item.piece ?? null });
    if (!ship.headlight) ship.headlight = true;
    if (isYou(ship)) {
      ship.punch = Math.max(ship.punch, T.PUNCH_S);
      slowFor(race, T.SLOWMO_X, T.HEADLIGHT_SLOW);
    }
    emit(race, E.headlight, ship, { t, first: ship.stats.topGear < 2 && ship.bestGear < 2, full: true, thread: true });
    return;
  }
  if (r.tag === 'dock') { ship.gate = 'dock'; emit(race, E.dock, ship, { t, gate: item.id }); return; }
  ship.gate = 'past';
  emit(race, E.past, ship, { t, gate: item.id });
}

// A rail beside the ship this step: crossing it or touching it is a hit; riding within its skim band is a skim.
function ride(race, ship, item, T, S) {
  const beat = ship.dist;
  if (ship.whip || !railOn(item, beat)) return;
  const psi = psiAt(item, beat);
  const d1 = wrap(ship.bearing - psi), a1 = Math.abs(d1);
  const g = a1 - ship.half - item.half;
  const d0 = wrap(S.n[B0] - psiAt(item, Math.max(item.beat, S.n[D0])));
  const crossed = (d0 < 0) !== (d1 < 0) && Math.abs(d0) < 90 && a1 < 90;
  if (g < 0 || crossed) {
    if (ship.flicker <= 0) hit(race, ship, 'rail', T, item);
    return;
  }
  if (g <= (item.skimBand ?? T.SKIM_BAND)) S.n[SKIM_NOW] += item.skimX ?? 1;
}

// The skim the ship rode this step: the summed skimX of the rails it rides (0 when it is not skimming).
export function skimOf(ship) {
  const S = SCRATCH.get(ship);
  return S ? S.n[SKIM] : 0;
}

function finishItems(race, ship, T, S) {
  const N = S.n, x = N[SKIM_NOW];
  N[SKIM_NOW] = 0;
  if (x > 0 && N[SDT] > 0) {
    ship.eta = Math.min(etaTop(ship, T), ship.eta + T.SKIM * x * N[SDT]);
    if (ship.chain > 0) ship.chainT = Math.min(ship.chainT, 0);
  }
  if ((x > 0) !== (N[SKIM] > 0)) {
    if (x > 0) emit(race, E.skimOn, ship, { x });
    else emit(race, E.skimOff, ship, {});
  }
  N[SKIM] = x;
}

// ---------------------------------------------------------------- hits (5.6)

// A hit: −HIT_ETA (never under ETA_MIN), LIGHT SPEED ends, the chain breaks, FLICKER of safety, the hit-stop (yours),
// and the stumble's glide back in the field. Survival applies the damage, the gap's stumble and the catch from the
// `hit` event. A hit inside a shove's TAKEDOWN_S is the rammer's takedown; a drafter hitting what its leader just
// passed close is TRAPPED. In leg 1's first SOFT_S it is a bump: 10° aside and nothing else. force: a scorch hits
// through the flicker. → 'hit' | 'bump' | null.
export function hit(race, ship, cause, tune = TUNE, item = null, force = false) {
  const T = tune;
  if (isOut(ship)) return null;
  if (ship.flicker > 0 && !force) return null;
  const psi = item ? itemPsi(item, ship) : NaN;
  const side = finite(psi) ? (wrap(psi - ship.bearing) >= 0 ? 1 : -1) : 0;
  if (ship.soft && !force) {
    const dir = item ? bumpDir(item, ship, side) : -1;
    ship.bearing += dir * T.BUMP;
    ship.target += dir * T.BUMP;
    emit(race, E.bump, ship, { cause, side, item: item ? item.id : null, piece: item ? item.piece ?? null : null });
    return 'bump';
  }
  let by = null, why = cause;
  if (item && cause !== 'scorch') {
    // the shove's record outlives the live shove (stepHandle clears ship.shove after SHOVE_S + CONTACT_CD), so a
    // SLAM's takedown window is the whole TAKEDOWN_S
    const sh = ship.shove || scratch(ship).shove;
    if (sh && sh.slam && sh.by && race.t - sh.t0 <= T.TAKEDOWN_S && !WHALE(ship)) {
      by = sh.by;
      why = 'takedown';
      const r = shipById(race, by);
      emit(race, E.takedown, ship, { by, victim: ship.id, item: item.id, piece: item.piece ?? null });
      if (r) {
        r.stats.takedowns++;
        const room = Math.max(0, r.fuelCap - r.fuel);
        r.fuel += Math.min(T.TAKEDOWN_FUEL, room);
      }
    } else {
      const leadId = ship.draft.lead || (race.t - ship.draft.exitT <= T.TRAP_S ? ship.draft.exitLead : null);
      const lead = leadId ? shipById(race, leadId) : null;
      if (lead && trappedBy(race, lead, item, T)) {
        by = lead.id;
        why = 'trapped';
        lead.stats.takedowns++;
        emit(race, E.trapped, ship, { by, victim: ship.id, item: item.id });
        emit(race, E.takedown, ship, { by, victim: ship.id, trapped: true, item: item.id, piece: item.piece ?? null });
      }
    }
  }
  // a named rival's hull is its own ship's: a hit costs it RIVAL_HIT_ETA (your ship's HIT_ETA is yours; a drifter's
  // is yours too, so it stays the slow one the light takes)
  const named = ship.kind === 'regular' || ship.kind === 'boss';
  const loss = named ? (T.RIVAL_HIT_ETA ?? T.HIT_ETA) : T.HIT_ETA;
  ship.eta = Math.max(T.ETA_MIN, ship.eta - loss);
  endLightspeed(race, ship, T, 'hit');
  breakChain(race, ship, 'hit');
  ship.flicker = T.FLICKER;
  if (isYou(ship)) race.stop = Math.max(race.stop, T.HITSTOP);
  ship.stumble = T.STUMBLE_S;
  ship.stats.hits++;
  emit(race, E.hit, ship, { cause: why, piece: item ? item.piece ?? null : null, side, by,
    item: item ? item.id : null });
  // a rail throws the ship off it: it glides out to the rail's nearer edge, so the stumble back along the rail does
  // not replay the same contact once a FLICKER (WP2's request; tuning found novices wrecked in 15 s that way)
  if (item && item.kind === 'rail' && cause === 'rail' && !ship.shove) {
    const d = wrap(ship.bearing - psiAt(item, ship.dist));
    const need = item.half + ship.half + RAIL_CLEAR - Math.abs(d);
    if (need > 0) shove(race, ship, d >= 0 ? 1 : -1, need, null, T, false);
  }
  return 'hit';
}

function trappedBy(race, lead, item, T) {
  const L = SCRATCH.get(lead);
  if (!L) return false;
  for (let k = 0; k < RECENT; k++) {
    if (L.recId[k] === item.id && race.t - L.recT[k] <= T.TRAP_S && L.recGap[k] >= 0 && L.recGap[k] < T.TRAP_GAP) {
      return true;
    }
  }
  return false;
}

// Where a hazard sits for the side of a hit: a rail at the ship's beat, a gate's nearer giant, a wall's nearest gap.
function itemPsi(item, ship) {
  if (item.kind === 'rail') return psiAt(item, ship.dist);
  return finite(item.psi) ? item.psi : NaN;
}

// Which way a soft-start bump throws the ship: away from a knot, a rail or a giant, toward a wall's nearest gap.
function bumpDir(item, ship, side) {
  const b = ship.bearing;
  if (item.kind === 'wall' && item.gaps && item.gaps.length) {
    let best = Infinity, dir = 1;
    for (const gp of item.gaps) {
      const d = wrap(gp.psi - b);
      if (Math.abs(d) < best) { best = Math.abs(d); dir = d >= 0 ? 1 : -1; }
    }
    return dir;
  }
  if (item.kind === 'gate' && item.halves) {
    const d = wrap(b - item.psi);
    const centre = d >= 0 ? item.gap / 2 + item.halves[1] : -(item.gap / 2 + item.halves[0]);
    return d - centre >= 0 ? 1 : -1;
  }
  return side ? -side : -1;
}

// ---------------------------------------------------------------- the whip (5.3)

// The sweep speed at angle a: SWEEP0 rising to SWEEP1 at SWEEP_A, times x (the first whip's TEACH_SWEEP).
const sweepK = (T) => (T.SWEEP1 - T.SWEEP0) / Math.max(1e-6, T.SWEEP_A);

// Real seconds to sweep from angle a0 to a1.
export function sweepTime(a0, a1, tune = TUNE, x = 1) {
  const T = tune;
  if (!(a1 > a0)) return 0;
  const k = sweepK(T), A = T.SWEEP_A;
  let t = 0;
  if (a0 < A) {
    const e = Math.min(a1, A);
    t += k > 1e-9 ? Math.log((T.SWEEP0 + k * e) / (T.SWEEP0 + k * a0)) / k : (e - a0) / T.SWEEP0;
  }
  if (a1 > A) t += (a1 - Math.max(a0, A)) / T.SWEEP1;
  return t / Math.max(1e-6, x);
}

// The angle round after t real seconds of sweeping (the latch excluded).
export function angleAt(t, tune = TUNE, x = 1) {
  const T = tune, k = sweepK(T), A = T.SWEEP_A;
  const tt = Math.max(0, t) * x;
  const tA = sweepTime(0, A, T, 1);
  if (tt <= tA) return k > 1e-9 ? (T.SWEEP0 * Math.exp(k * tt) - T.SWEEP0) / k : T.SWEEP0 * tt;
  return A + T.SWEEP1 * (tt - tA);
}

// What a press t seconds before the well is abreast costs (t < 0: after), in η; null outside the window.
export function pressCost(t, tune = TUNE, wide = 1) {
  const e = tune.WIN_EARLY * wide, l = tune.WIN_LATE * wide;
  if (t > e || t < -l) return null;
  const u = t >= 0 ? t / e : -t / l;
  return tune.GRAB_COST * u * u;
}

// The first whip of a run sweeps at TEACH_SWEEP with TEACH_WIN windows: leg 1's, or a later leg's while the run has
// made no whip yet (race.teachWhip; a returning player's leg 1 has no well).
const teaching = (race, ship) => isYou(ship) && ship.stats.whips === 0
  && (race.legNo === 0 || race.teachWhip === true);

// The next well coming up for this ship within APPROACH_S (or still inside its late window): its item index, or −1.
function nextWell(race, ship, T) {
  const items = race.leg.items, bps = bpsOf(ship, T);
  const late = T.WIN_LATE * T.TEACH_WIN;
  let best = -1, bestT = Infinity;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind !== 'well') continue;
    const tA = (it.beat - ship.dist) / bps;
    if (tA < -late || tA > APPROACH_S) continue;
    if (tA < bestT) { bestT = tA; best = k; }
  }
  return best;
}

// Wells: the approach, the pull, the window and the grab; then, while whipping, the latch, the sweep, the red zone,
// LET GO, the release on a lift and the scorch. dt: real seconds (0 in a hit-stop). It also settles the step's rail
// skim for this ship (race.js calls it right after the ship's items).
export function stepWell(race, ship, intent, dt, tune = TUNE) {
  const T = tune, S = scratch(ship);
  if (isOut(ship)) return;
  finishItems(race, ship, T, S);
  const action = intent ? intent.action : null;
  if (ship.whip) { whipStep(race, ship, action, dt, T, S); return; }
  const k = nextWell(race, ship, T);
  if (k < 0) return;
  const it = race.leg.items[k];
  const bps = bpsOf(ship, T);
  const tA = (it.beat - ship.dist) / bps;
  const core = wellCore(it, T), reach = wellReach(it, T);
  const d = wrap(ship.bearing - it.psi), a = Math.abs(d);
  const w = teaching(race, ship) ? T.TEACH_WIN : 1;
  const open = tA <= T.WIN_EARLY * w && tA >= -T.WIN_LATE * w;
  const inReach = a > core + ship.half && a <= reach;
  if (open && S.winWell !== it.id) {
    S.winWell = it.id;
    emit(race, E.window, ship, { well: it.id, inReach, psi: it.psi });
  }
  // gravity: from PULL_S out to the end of the window, the well draws the ship in
  if (tA <= T.PULL_S && tA >= -T.WIN_LATE * w && a < reach && a > 1e-6 && S.n[SDT] > 0) {
    const rate = T.PULL * (1 - a / reach);
    const m = Math.min(a, rate * S.n[SDT]) * (d >= 0 ? 1 : -1);
    ship.bearing -= m;
    ship.target -= m;
  }
  if (action !== 'down' || !open || !inReach) return;
  const W0 = race.wells[it.id];
  if (W0 && W0.holder && W0.holder !== ship.id) {
    emit(race, E.dry, ship, { why: 'held', well: it.id, holder: W0.holder });
    return;
  }
  grab(race, ship, it, tA, d, w, T, S);
}

function grab(race, ship, it, tA, d, w, T, S) {
  const W = S.whip;
  const size = (T.WELLS && T.WELLS[it.size]) || T.WELLS.medium;
  W.well = it.id;
  W.psi = it.psi;
  W.size = it.size || 'medium';
  W.mass = size.mass;
  W.core = size.core;
  W.reach = size.reach;
  W.side = d >= 0 ? 1 : -1;
  W.dir = W.side;
  W.b0 = ship.bearing;
  W.angle = 0;
  W.t = 0;
  W.latched = true;
  W.red = false;
  W.warned = false;
  W.gate = null;
  W.teach = w > 1;
  W.x = W.teach ? T.TEACH_SWEEP : 1;
  W.cost = pressCost(tA, T, w) || 0;
  W.scorchAt = 360 - Math.abs(d) - W.core - ship.half;
  W.redAt = W.scorchAt - (race.leg.redSpan ?? T.RED_SPAN);       // TIDES widens it (11.3)
  const ex = it.exits || [];
  W.n = Math.min(2, ex.length);
  for (let k = 0; k < 2; k++) {
    W.letgo[k] = false;
    if (k < W.n) {
      W.exits[k] = ex[k];
      const a = ((W.dir * wrap(ex[k] - W.b0)) % 360 + 360) % 360;
      W.exitA[k] = a < W.scorchAt ? a : NaN;
    } else { W.exits[k] = 0; W.exitA[k] = NaN; }
  }
  ship.whip = W;
  ship.eta = Math.max(T.ETA_MIN, ship.eta - W.cost);
  if (race.wells[it.id]) race.wells[it.id].holder = ship.id;
  else race.wells[it.id] = { holder: ship.id };
  emit(race, E.grab, ship, { well: it.id, side: W.side, cost: W.cost, early: tA, psi: it.psi, teach: W.teach });
}

function dropWhip(race, ship) {
  const W = ship.whip;
  if (!W) return;
  const h = race.wells[W.well];
  if (h && h.holder === ship.id) h.holder = null;
  ship.whip = null;
  ship.target = ship.bearing;
}

function whipStep(race, ship, action, dt, T, S) {
  const W = ship.whip;
  W.t += dt;
  if (W.latched && W.t >= T.LATCH_S) W.latched = false;
  if (action === 'up') {
    if (W.latched) {
      ship.eta += W.cost;                        // a re-grip: the grab cost nothing
      emit(race, E.latchCancel, ship, { well: W.well });
      const G = W.gate;
      W.gate = null;
      dropWhip(race, ship);
      if (G) settleGate(race, ship, G, T, ship.bearing);
      return;
    }
    const aJ = angleAt(W.t - T.LATCH_S - T.LIFT_COMP, T, W.x);
    release(race, ship, aJ, T, false);
    return;
  }
  if (W.latched) return;
  const sweepT = W.t - T.LATCH_S;
  const prev = W.angle;
  W.angle = angleAt(sweepT, T, W.x);
  ship.bearing = W.b0 + W.dir * W.angle;
  ship.target = ship.bearing;
  ship.turnRate = dt > 0 ? (W.dir * (W.angle - prev)) / dt : 0;
  if (isYou(ship)) slowFor(race, 1 - T.WORLD_SLOW * Math.min(W.angle, T.SWEEP_A) / T.SWEEP_A, 0.05);
  if (!W.red && W.angle >= W.redAt) {
    W.red = true;
    emit(race, E.redIn, ship, { well: W.well, angle: W.angle });
  }
  if (W.angle >= W.scorchAt) {
    emit(race, E.scorch, ship, { well: W.well, real: race.real });
    hit(race, ship, 'scorch', T, null, true);
    release(race, ship, W.angle, T, true);
    return;
  }
  const toScorch = sweepTime(W.angle, W.scorchAt, T, W.x);
  if (!W.warned && toScorch <= T.SCORCH_WARN + 0.05) {
    W.warned = true;
    emit(race, E.scorchWarn, ship, { well: W.well, real: race.real, left: toScorch });
  }
  if (W.t >= T.LETGO_MIN) {
    for (let k = 0; k < W.n; k++) {
      const aE = W.exitA[k];
      if (W.letgo[k] || !finite(aE)) continue;
      if (aE <= W.angle) { W.letgo[k] = true; continue; }
      const left = sweepTime(W.angle, aE, T, W.x);
      if (left <= T.LETGO_LEAD + dt / 2) {
        W.letgo[k] = true;
        emit(race, E.letgo, ship, { well: W.well, exit: k, angle: aE, left });
      }
    }
  }
}

// The grade for a release at angle aJ: within PERFECT of a band's centre, inside a band (EXIT_W wide), or WIDE.
function gradeAt(W, aJ, T) {
  const b = W.b0 + W.dir * aJ;
  const w = W.teach ? T.TEACH_WIN : 1;
  let g = 2;
  for (let k = 0; k < W.n; k++) {
    if (!finite(W.exitA[k])) continue;
    const off = Math.abs(wrap(b - W.exits[k]));
    if (off <= T.PERFECT * w) g = 0;
    else if (off <= (T.EXIT_W / 2) * w && g > 1) g = 1;
  }
  return g;
}

// A release at angle aJ. force: a grade index (0 PERFECT) a card sets (KICK OUT), else −1 and the angle grades it.
// A gate crossed during the whip is judged now. → the release event.
function release(race, ship, aJ, T, scorched, force = -1) {
  const W = ship.whip;
  const a = Math.max(0, aJ);
  const g = scorched ? 2 : force >= 0 ? force : gradeAt(W, a, T);
  const d = Math.min(a, T.SWEEP_A) / T.SWEEP_A;
  const red = W.red && !scorched;
  let gain = 0;
  if (!scorched) {
    // the red zone pays RED_X (TIDAL FRAME raises it); TIDES lifts it to its own × 1.5 (11.3)
    const redX = Math.max(T.RED_X, race.leg.redX || 0);
    gain = (T.GAIN_BASE + T.GAIN_DEPTH * d * d) * W.mass * T.AIM[g] * (red ? redX : 1) * T.WHIP_GAIN_X;
    ship.eta = Math.min(etaTop(ship, T), ship.eta + gain);
  }
  ship.stats.whips++;
  if (g === 0) ship.stats.perfect++;
  ship.flicker = Math.max(ship.flicker, T.LAND_GRACE);
  scratch(ship).n[REL_T] = race.t;
  const well = W.well, mass = W.mass, G = W.gate, b = W.b0 + W.dir * a;     // b: the bearing the grade judged
  W.gate = null;
  dropWhip(race, ship);
  if (g === 2) endLightspeed(race, ship, T, 'wide');
  const e = emit(race, E.release, ship, { well, grade: GRADES[g], angle: a, gain, red, mass, d, scorched,
    kick: force >= 0 });
  if (G) settleGate(race, ship, G, T, scorched ? null : b);
  return e;
}

// A gate the whip carried the ship across, judged at the bearing it let go (the release's own, as its grade): a
// thread, a DOCK or a fly past. A giant there (or a scorch: bearing null) is a fly past with no damage, as nothing
// touches a whipping ship.
function settleGate(race, ship, item, T, bearing) {
  const r = bearing === null ? null : resolve(item, bearing, item.beat, T, ship.half);
  if (!r || r.hit) {
    ship.gate = 'past';
    emit(race, E.past, ship, { t: race.t, gate: item.id });
    return;
  }
  gatePass(race, ship, item, r, race.t, T);
}

// A release now at the whip's angle with a set grade (KICK OUT: 'PERFECT'), paid as a lift there would be, red zone
// and gate included. → the release event (kick: true), or null with no whip.
export function forceRelease(race, ship, grade = 'PERFECT', tune = TUNE) {
  const W = ship && ship.whip;
  if (!W || isOut(ship)) return null;
  const g = GRADES.indexOf(grade);
  return release(race, ship, W.angle, tune, false, g < 0 ? 0 : g);
}

// Is a grab window open for this ship now (a well within its window, the ship in reach and the well free)? For the
// input's tap rule (?burn=tap) and the bots; allocation-free.
export function windowOpen(race, ship, tune = tuneOf(race, ship)) {
  if (!ship || ship.whip || isOut(ship)) return false;
  const k = nextWell(race, ship, tune);
  if (k < 0) return false;
  const it = race.leg.items[k];
  const t = (it.beat - ship.dist) / bpsOf(ship, tune);
  const w = teaching(race, ship) ? tune.TEACH_WIN : 1;
  if (t > tune.WIN_EARLY * w || t < -tune.WIN_LATE * w) return false;
  const a = Math.abs(wrap(ship.bearing - it.psi));
  const h = race.wells[it.id];
  return a > wellCore(it, tune) + ship.half && a <= wellReach(it, tune) && !(h && h.holder && h.holder !== ship.id);
}

// The open grab window for a ship, or the well it is approaching (within APPROACH_S): { well, item, t (seconds to
// abreast, + before), open, early, late, inReach, side, cost (η if pressed now, or null), holder, teach }; or null
// while it whips or with no well near. For the renderer and the bots; it allocates its answer.
export function windowOf(race, shipId) {
  const ship = typeof shipId === 'object' ? shipId : shipById(race, shipId);
  if (!ship || ship.whip || isOut(ship)) return null;
  const T = tuneOf(race, ship);
  const k = nextWell(race, ship, T);
  if (k < 0) return null;
  const it = race.leg.items[k];
  const t = (it.beat - ship.dist) / bpsOf(ship, T);
  const w = teaching(race, ship) ? T.TEACH_WIN : 1;
  const d = wrap(ship.bearing - it.psi), a = Math.abs(d);
  const core = wellCore(it, T), reach = wellReach(it, T);
  const h = race.wells[it.id];
  return { well: it.id, item: it, t, open: t <= T.WIN_EARLY * w && t >= -T.WIN_LATE * w, early: T.WIN_EARLY * w,
    late: T.WIN_LATE * w, inReach: a > core + ship.half && a <= reach, side: d >= 0 ? 1 : -1, core, reach,
    cost: pressCost(t, T, w), holder: h ? h.holder : null, teach: w > 1 };
}

// The exit bands: while whipping, [{ psi, w, perfect, angle (round from the grab to its centre), reach (before the
// core), t (real seconds to its centre), letgo }] plus the red zone and the core as angles; while approaching a
// well, its bands for the side the ship is on now. [] otherwise. Allocates.
export function exitsOf(race, shipId) {
  const ship = typeof shipId === 'object' ? shipId : shipById(race, shipId);
  if (!ship) return [];
  const T = tuneOf(race, ship);
  const W = ship.whip;
  if (W) {
    const out = [];
    const w = W.teach ? T.TEACH_WIN : 1;
    for (let k = 0; k < W.n; k++) {
      const aE = W.exitA[k];
      out.push({ psi: W.exits[k], w: T.EXIT_W * w, perfect: T.PERFECT * w, angle: finite(aE) ? aE : null,
        reach: finite(aE), t: finite(aE) && aE > W.angle ? (W.latched ? T.LATCH_S - W.t : 0)
          + sweepTime(W.angle, aE, T, W.x) : null, letgo: W.letgo[k], redAt: W.redAt, scorchAt: W.scorchAt });
    }
    return out;
  }
  const win = windowOf(race, ship);
  if (!win) return [];
  const it = win.item, out = [];
  const dir = win.side, scorchAt = 360 - Math.abs(wrap(ship.bearing - it.psi)) - win.core - ship.half;
  const w = win.teach ? T.TEACH_WIN : 1;
  for (const e of it.exits || []) {
    const a = ((dir * wrap(e - ship.bearing)) % 360 + 360) % 360;
    out.push({ psi: e, w: T.EXIT_W * w, perfect: T.PERFECT * w, angle: a < scorchAt ? a : null, reach: a < scorchAt,
      t: null, letgo: false, redAt: scorchAt - (race.leg.redSpan ?? T.RED_SPAN), scorchAt });
  }
  return out;
}

// ---------------------------------------------------------------- ship against ship (5.4, 5.5)

// Wakes, draft and the tow, the slingshot, rival grazes and contact, for every pair of ships. dt: sim seconds. Ends
// with every ship's gears, so a speed change here or in the passes shows on its own step. tune: yours; every other
// ship drafts, grazes, rams and shifts gear with race.baseTune (your cards' SLIPSTREAM, SLAM_V and the rest are yours).
export function stepContact(race, dt, tune = TUNE) {
  const T = tune, B = race.baseTune || T, ships = race.ships, n = ships.length;
  for (let i = 0; i < n; i++) {
    const a = ships[i];
    if (isOut(a)) continue;
    draftStep(race, a, dt, isYou(a) ? T : B);
  }
  for (let i = 0; i < n; i++) {
    const a = ships[i];
    if (isOut(a)) continue;
    for (let j = i + 1; j < n; j++) {
      const b = ships[j];
      if (isOut(b)) continue;
      pairStep(race, a, b, T);
    }
  }
  for (let i = 0; i < n; i++) if (!isOut(ships[i])) gearStep(race, ships[i], isYou(ships[i]) ? T : B);
}

// Seconds ship b is ahead of ship a (negative: behind), at a's course speed.
const aheadS = (a, b, T) => (b.dist - a.dist) / bpsOf(a, T);

// The ship whose wake this ship sits in now (the nearest ahead within its wake), or null. WHALE's wake is wider
// and longer. Allocation-free.
export function wakeOf(race, ship, tune = TUNE) {
  const T = tune;
  if (ship.whip || isOut(ship)) return null;
  let best = null, bestZ = Infinity;
  const ships = race.ships;
  for (let i = 0; i < ships.length; i++) {
    const b = ships[i];
    if (b === ship || isOut(b) || b.whip) continue;
    const z = aheadS(ship, b, T);
    const far = WHALE(b) ? T.WHALE.wakeFar : T.WAKE_FAR;
    if (z < T.WAKE_NEAR || z > far) continue;
    const half = WHALE(b) ? T.WHALE.wakeHalf : T.WAKE_HALF;
    if (Math.abs(wrap(ship.bearing - b.bearing)) > half) continue;
    if (z < bestZ) { bestZ = z; best = b; }
  }
  return best;
}

function draftStep(race, ship, dt, T) {
  const D = ship.draft, S = scratch(ship);
  const lead = wakeOf(race, ship, T);
  if (lead) {
    if (D.lead !== lead.id) {
      let c = 0;
      if (D.exitLead === lead.id && race.t - D.exitT <= SLING_WINDOW) c = D.exitCharge;
      if (race.t - S.n[REL_T] <= 0.3) c = Math.max(c, T.WAKE_START);
      D.lead = lead.id;
      D.charge = c;
      D.exitLead = null;
      emit(race, E.wake, ship, { lead: lead.id });
      emit(race, E.drafted, lead, { by: ship.id });
    }
    const fill = WHALE(lead) ? T.WHALE.charge : T.DRAFT_FILL;
    const was = D.charge;
    D.charge = Math.min(1, D.charge + dt / Math.max(1e-3, fill));
    D.tow = WHALE(lead) ? T.WHALE.tow * (lead.ai && lead.ai.breachUntil > race.t ? T.WHALE.breachTow : 1) : T.TOW;
    if (was < 1 && D.charge >= 1) emit(race, E.draftFull, ship, { lead: lead.id });
    return;
  }
  if (D.lead) {
    D.exitLead = D.lead;
    D.exitCharge = D.charge;
    D.exitT = race.t;
    D.lead = null;
    D.charge = 0;
    D.tow = T.TOW;
  }
  if (!D.exitLead) return;
  // a full draft keeps DRAFT_KEEP after you leave (SLIPSTREAM); the pull-out is PULL_OUT off the leader (4° past the
  // edge of a normal wake, the same past the WHALE's)
  const keepS = Math.max(SLING_WINDOW, T.DRAFT_KEEP || 0);
  const lead0 = shipById(race, D.exitLead);
  const off = lead0 ? Math.abs(wrap(ship.bearing - lead0.bearing)) : 0;
  const pull = lead0 && WHALE(lead0) ? T.PULL_OUT + T.WHALE.wakeHalf - T.WAKE_HALF : T.PULL_OUT;
  const z = lead0 ? aheadS(ship, lead0, T) : -1;
  if (lead0 && !isOut(lead0) && D.exitCharge >= T.SLING_MIN && off > pull && z > -T.CONTACT_Z
    && race.t - D.exitT <= keepS) {
    const gain = T.SLING_ETA * D.exitCharge * (WHALE(lead0) ? T.WHALE.sling : 1);
    ship.eta = Math.min(etaTop(ship, T), ship.eta + gain);
    ship.surge.x = T.SLING_SURGE;
    ship.surge.until = race.t + T.SLING_S;
    ship.stats.slings++;
    emit(race, E.slingshot, ship, { lead: lead0.id, charge: D.exitCharge, gain });
    D.exitLead = null;
    D.exitCharge = 0;
    D.charge = 0;
    return;
  }
  if (race.t - D.exitT > keepS || !lead0 || isOut(lead0)) {
    if (lead0 && D.exitCharge > 0) emit(race, E.shaken, lead0, { by: ship.id });
    D.exitLead = null;
    D.exitCharge = 0;
    D.charge = 0;
  }
}

// Two ships: a rival graze as one passes the other, then contact when they touch.
function pairStep(race, a, b, T) {
  const Sa = scratch(a), Sb = scratch(b);
  const before = Sa.n[D0] - Sb.n[D0], now = a.dist - b.dist;
  const dpsi = wrap(b.bearing - a.bearing), ad = Math.abs(dpsi);
  const g = ad - a.half - b.half;
  if ((before < 0) !== (now < 0) && before !== 0 && !a.whip && !b.whip) {
    const passer = now > 0 ? a : b, other = passer === a ? b : a;
    if (g >= 0 && g < T.GRAZE) rivalGraze(race, passer, other, g, isYou(passer) ? T : race.baseTune || T);
    if (isYou(a) || isYou(b)) {
      const you = isYou(a) ? a : b, S = scratch(you);
      if (race.hooks && race.hooks.rivalPass) {
        const c = S.ctx;
        c.race = race; c.tune = T; c.other = you === a ? b : a; c.gap = g; c.event = null; c.item = null;
        runHooks(race, 'rivalPass', c);
      }
    }
  }
  if (a.whip || b.whip || g >= 0) return;
  const z = Math.abs(now) / bpsOf(now >= 0 ? b : a, T);
  if (z > T.CONTACT_Z) return;
  if (cooling(race, a, b) || cooling(race, b, a)) return;
  contact(race, a, b, dpsi, T);
}

const cooling = (race, s, other) => s.shove && s.shove.by === other.id && race.t <= s.shove.until + CONTACT_CD;

function rivalGraze(race, ship, other, g, T) {
  if (WHALE(ship)) return;
  ship.eta = Math.min(etaTop(ship, T), ship.eta + T.KICK_RIVAL);
  ship.chain++;
  ship.chainT = Math.min(ship.chainT, 0);
  ship.stats.grazes++;
  emit(race, E.rivalGraze, ship, { other: other.id, gap: g });
}

// Set a shove on a ship: dist degrees in direction dir over s seconds (SHOVE_S), by `by`. Reuses the ship's shove
// object, which stays as the record of the last shove (for takedowns) after ship.shove clears.
function shove(race, ship, dir, dist, by, T, slam = false, s = T.SHOVE_S) {
  const sh = scratch(ship).shove;
  sh.v = (dir * dist) / Math.max(1e-3, s);
  sh.left = dist;
  sh.until = race.t + s;
  sh.by = by;
  sh.t0 = race.t;
  sh.slam = slam;
  ship.shove = sh;
}

// A shove from outside handle (cards: MASS SHADOW's pull, SIDESTEP's hop): deg degrees in direction dir over s
// seconds, by `by`. It goes through the same record as handle's own, so a card's SLAM counts for takedowns.
export function shoveShip(race, ship, dir, deg, by, tune = TUNE, slam = false, s = tune.SHOVE_S) {
  shove(race, ship, dir, deg, by, tune, Boolean(slam), s);
}

// How hard a ship shoves: MAKO × 1.5, your cards' SHOVE_X; the WHALE barely moves (× 0.25).
const shoveOut = (s, T) => (MAKO(s) ? T.MAKO.shove : isYou(s) ? T.SHOVE_X : 1);
const shoveIn = (s) => (WHALE(s) ? 0.25 : 1);

function contact(race, a, b, dpsi, T) {
  const ad = Math.abs(dpsi);
  const dirAB = dpsi >= 0 ? 1 : -1;               // from a toward b
  const soft = a.soft || b.soft;
  if (ad <= REAR_DEG) {
    const behind = a.dist < b.dist ? a : b, front = behind === a ? b : a;
    if (!soft) behind.eta = Math.max(T.ETA_MIN, behind.eta - T.REAR_ETA);
    const d = dpsi === 0 ? (String(a.id) < String(b.id) ? 1 : -1) : dirAB;
    shove(race, a, -d, T.REAR_SHOVE * shoveIn(a), b.id, T);
    shove(race, b, d, T.REAR_SHOVE * shoveIn(b), a.id, T);
    emit(race, E.contact, front, { kind: 'rear', by: behind.id, victim: front.id, closing: 0 });
    return;
  }
  const va = a.turnRate * dirAB, vb = -b.turnRate * dirAB;     // each ship's speed toward the other, °/s
  const closing = Math.max(0, va) + Math.max(0, vb);
  let rammer = va >= vb ? a : b, victim = rammer === a ? b : a;
  if (WHALE(a) || WHALE(b)) { rammer = WHALE(a) ? a : b; victim = rammer === a ? b : a; }
  // SLAM_V is the rammer's: your ship's and cards' (TUG, BATTERING PROW, HOUND'S BITE) when you ram, else the base
  const slamV = isYou(rammer) ? T.SLAM_V : (race.baseTune || T).SLAM_V;
  const slam = !soft && (closing >= slamV || WHALE(rammer));
  const away = victim === b ? dirAB : -dirAB;
  if (!slam) {
    shove(race, a, -dirAB, T.BUMP_SHOVE * shoveIn(a), b.id, T);
    shove(race, b, dirAB, T.BUMP_SHOVE * shoveIn(b), a.id, T);
    emit(race, E.contact, victim, { kind: 'bump', by: rammer.id, victim: victim.id, closing });
    return;
  }
  const dist = WHALE(rammer) ? T.SHOVE_MAX
    : Math.min(T.SHOVE_MAX, T.SHOVE0 + T.SHOVE_K * closing) * shoveOut(rammer, T) * shoveIn(victim);
  shove(race, victim, away, dist, rammer.id, T, true);
  rammer.target = rammer.bearing;                   // the ram stops the rammer's swing
  const rs = scratch(rammer).shove;                 // and marks the pair as in contact for the cool-down
  if (rammer.shove !== rs) {
    rs.v = 0; rs.left = 0; rs.until = race.t + T.SHOVE_S; rs.by = victim.id; rs.t0 = -1e9; rs.slam = false;
    rammer.shove = rs;
  }
  rammer.stats.slams++;
  emit(race, E.contact, victim, { kind: 'slam', by: rammer.id, victim: victim.id, closing });
  const spill = Math.min(T.SPILL, victim.fuel);
  if (spill > 0) {
    const taken = Math.min(spill, Math.max(0, rammer.fuelCap - rammer.fuel));
    victim.fuel -= spill;
    rammer.fuel += taken;
    emit(race, E.spill, victim, { amount: spill, to: rammer.id, taken });
  }
}

// Would a SLAM from `rammer` now carry `victim` into a hazard within TAKEDOWN_S that it would miss on its own? → the
// item, or null. The same line logic that turns a knot's tick orange (5.5), for the renderer and the bots. A flick
// closes at the rammer's turn cap (600°/s, so the shove is SHOVE_MAX); `delay` is the seconds until the ships touch
// (by default the bearing gap at that rate). Only hazards that pass before the victim can steer back count (the
// shove plus `recover`, a rival's reaction; never past TAKEDOWN_S). safe: also require the rammer's own stop (just
// short of where the victim was) to be clear.
export function slamAim(race, rammer, victim, tune = TUNE, closing = rammer.turnMax || tune.TURN_MAX, delay = null,
  safe = false, recover = 0.2) {
  const T = tune;
  const off = wrap(victim.bearing - rammer.bearing);
  if (delay === null) delay = Math.max(0, Math.abs(off) - rammer.half - victim.half) / Math.max(1, closing);
  const dir = off >= 0 ? 1 : -1;
  const dist = Math.min(T.SHOVE_MAX, T.SHOVE0 + T.SHOVE_K * closing) * shoveOut(rammer, T) * shoveIn(victim);
  const stop = victim.bearing - dir * (rammer.half + victim.half);
  const bps = bpsOf(victim, T), items = race.leg.items;
  let found = null;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind !== 'knot' && it.kind !== 'pulse' && it.kind !== 'well' && it.kind !== 'rail' && it.kind !== 'wall'
      && it.kind !== 'gate') continue;
    const tA = (it.beat - victim.dist) / bps;
    const late = delay + Math.min(T.TAKEDOWN_S, T.SHOVE_S + recover);
    const lasting = it.kind === 'rail' && it.end > victim.dist && it.beat <= victim.dist + bps * late;
    if (!lasting && (tA < 0 || tA > late)) continue;
    const beat = lasting ? victim.dist : it.beat;
    if (safe && tA <= delay + 0.35 && resolve(it, stop, beat, T, rammer.half).hit) return null;
    if (!lasting && tA < delay) continue;
    if (found) continue;
    if (resolve(it, victim.bearing, beat, T, victim.half).hit) continue;      // it would hit that on its own
    const f = lasting ? 1 : clamp((tA - delay) / T.SHOVE_S, 0, 1);
    if (resolve(it, victim.bearing + dir * dist * f, beat, T, victim.half).hit) found = it;
  }
  return found;
}
