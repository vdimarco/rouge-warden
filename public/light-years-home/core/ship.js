// Light Years Home v3: the Tern's flight model (handling §3, final.md 6.1 to 6.7). A car on an invisible road: steering
// yaws the ship about the zone plane's up, grip pulls the travel line toward the nose, the nose levels itself, and
// nothing stops the ship. Drift with three spark tiers and a drift-boost; a boost bar fed by risk (near misses,
// hairlines, threads, skims, drafts, drift tiers, slings, takedowns); scrapes that keep 90% of the speed; head-on
// bounces with a 6 u/s floor; gravity wells and slingshots; a tow line; the rim turns you back. stepShip is pure on
// the ship and a context; stepDrive is game.js's 'ship' slot (wire(FLIGHT) fills build, enter and ship).
// Angles in the ship's state are radians: yaw (clockwise from the map's +y), pitch (up is positive), slip (nose minus
// travel line, positive when the nose is clockwise of it) and bank (positive rolls the right wing down).
import { TUNE } from './tune.js';
import { newShip, NEAR_CAP, zoneOf, builtOf, hitStop, slowMo } from './game.js';
import { basisFrom } from './vec.js';
import { buildTraffic, posAt, velAt, KIND } from './traffic.js';
import {
  createGrid, addStatic, rebuildTraffic, query, sweepCapsule, classifyHit, createCands, createNearTracker, trackNear,
  STATIC_BASE, ACTOR_BASE, TICK,
} from './collide.js';
import { zoneFrame, upAt, bandAt, rimTurn } from './frame.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
// Plain square roots: Math.hypot boxes its arguments in V8, and this runs hundreds of times a step.
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const len2 = (x, y) => Math.sqrt(x * x + y * y);
const num = (x, d = 0) => (typeof x === 'number' && x === x && x !== Infinity && x !== -Infinity ? x : d);

// The sling ring is this many times a well's rs (the drift charges faster inside it; handling §3.10).
const SLING_RING = 2;
// Share of a well's pull along your velocity that changes your speed (fallback until tune.js has WELL.ALONG).
const WELL_ALONG = 0.4;
// The drift cushion round big bodies (fallbacks until tune.js has PLANE.FLOOR_DRIFT_SHELL and FLOOR_DRIFT_DAMP).
const DRIFT_SHELL = 4;      // u above the core
const DRIFT_DAMP = 18;      // per s, on the speed toward the core
// Colliders smaller than this (dwarf galaxies) only ever scrape: you plough through with sparks, never bounce.
// A fallback until tune.js has COLLIDE.PEBBLE_R (asked for in contract.md).
const PEBBLE_R = 0.5;

// Points for the chain (the scoring designer owns these; races and missions add them up).
export const POINTS = Object.freeze({ near: 100, hairline: 250, thread: 300, skim: 150, draft: 100, driftBoost: 150,
  sling: 300, takedown: 500 });

/**
 * flightFields(ship) → ship: adds the few fields the flight model keeps beyond final.md 5.1 (contract.md): yawRate
 * (show only), drift.manual / exitT / counterT / turn / well, padT, afterT / afterBend (Aftertouch), assistOffT and
 * coastT / coastS (an arrival holds its drop-out speed for SHIP.ENTRY_HOLD s).
 * The enter slot and createShip add them; stepShip adds them to any ship that lacks them.
 */
export function flightFields(ship) {
  if (ship.padT !== undefined) return ship;
  ship.yawRate = 0; ship.padT = 0; ship.afterT = 0; ship.afterBend = 0; ship.assistOffT = 0;
  ship.coastT = 0; ship.coastS = 0;
  const d = ship.drift;
  d.manual = false; d.exitT = 0; d.counterT = 0; d.turn = 0; d.well = -1;
  return ship;
}

/** createShip({ pos, heading (deg), speed, bar }) → the ship state of final.md 5.1 plus flightFields. */
export const createShip = (opts) => flightFields(newShip(opts));

// ---------------------------------------------------------------- small helpers other systems use

/** shipForward(ship, out) → out: the nose's unit direction. */
export function shipForward(ship, out = [0, 0, 0]) {
  basisFrom(ship.up, ship.yaw, F0, null);
  const c = Math.cos(ship.pitch), s = Math.sin(ship.pitch);
  out[0] = F0[0] * c + ship.up[0] * s; out[1] = F0[1] * c + ship.up[1] * s; out[2] = F0[2] * c + ship.up[2] * s;
  return out;
}

/** speedOf(ship) → u/s. */
export const speedOf = (ship) => ship.speed;

/** addBar(ship, x): fill (or, negative, spend) the boost bar, kept inside 0 to barMax. */
export function addBar(ship, x) {
  ship.bar = clamp(ship.bar + x, 0, ship.barMax);
  return ship.bar;
}

/** setSpeed(ship, s): set the speed along the current travel line (a race start, a checkpoint). */
export function setSpeed(ship, s) {
  const v = ship.vel, l = len3(v[0], v[1], v[2]);
  const sp = Math.max(0, num(s));
  if (l <= 1e-9) shipForward(ship, v);
  const k = sp / (l > 1e-9 ? l : 1);
  v[0] *= k; v[1] *= k; v[2] *= k;
  ship.speed = sp;
}

/** padKick(ship, perfect, tune): a light pad (races, stunts): +PAD_KICK u/s and boost speed for PAD_T with no bar. */
export function padKick(ship, perfect = false, tune = TUNE) {
  const R = tune.RACE;
  ship.speed = Math.min(tune.SHIP.S_CAP, ship.speed + R.PAD_KICK + (perfect ? R.PAD_PERFECT_KICK : 0));
  ship.padT = R.PAD_T;
}

/**
 * chainEvent(ship, t, points, ev, tune): one risky event for the chain (handling §3.7). Events within CHAIN_GAP s of
 * the last add one; the multiplier steps up at CHAIN_STEPS. Pushes chainUp when the multiplier rises.
 */
export function chainEvent(ship, t, points, ev, tune = TUNE) {
  const P = tune.PROX, ch = ship.chain;
  if (ch.n > 0 && t - ch.lastT > P.CHAIN_GAP) bankChain(ship, ev, tune);
  ch.n++;
  ch.lastT = t;
  let mult = 1;
  for (let i = 0; i < P.CHAIN_STEPS.length; i++) if (ch.n >= P.CHAIN_STEPS[i]) mult = P.CHAIN_MULT[i];
  if (mult > ch.mult && ev) ev.push('chainUp', { n: ch.n, mult });
  ch.mult = mult;
  ch.points += points * mult;
}

// A chain that ends clean pays into the boost bar: CHAIN_BAR × its multiplier (a ×4 chain is +12%).
function bankChain(ship, ev, tune = TUNE) {
  const ch = ship.chain;
  const bar = ch.mult > 1 ? num(tune.PROX.CHAIN_BAR, 0.03) * ch.mult : 0;
  if (bar > 0) addBar(ship, bar);
  if (ch.n > 0 && ev) ev.push('chainBank', { n: ch.n, mult: ch.mult, points: ch.points, bar });
  ch.n = 0; ch.mult = 1; ch.points = 0;
}

function loseChain(ship, ev) {
  const ch = ship.chain;
  if (ch.n > 0 && ev) ev.push('chainLost', { n: ch.n, points: ch.points });
  ch.n = 0; ch.mult = 1; ch.points = 0;
}

// ---------------------------------------------------------------- scratch (nothing below allocates per step)

const F0 = [0, 1, 0], N0 = [0, 1, 0], E0 = [1, 0, 0], FW = [0, 1, 0], RT = [1, 0, 0], NOSE = [0, 1, 0];
const P0 = [0, 0, 0], P1 = [0, 0, 0], Q0 = [0, 0, 0], Q1 = [0, 0, 0], BP = [0, 0, 0], BV = [0, 0, 0];
const REL = [0, 0, 0], TMP = [0, 0, 0], VEL = [0, 0, 0], UP = [0, 0, 1];
const HIT_N = [0, 0, 0], HIT_BV = [0, 0, 0];
const CAND_CAP = 256;
const IDS = new Int32Array(CAND_CAP);
// Per candidate: position, velocity, collider radius, drawn size, flags (1 skim, 2 floor, 4 actor, 8 moving).
const CX = new Float64Array(CAND_CAP), CY = new Float64Array(CAND_CAP), CZ = new Float64Array(CAND_CAP);
const CVX = new Float64Array(CAND_CAP), CVY = new Float64Array(CAND_CAP), CVZ = new Float64Array(CAND_CAP);
const CR = new Float64Array(CAND_CAP), CS = new Float64Array(CAND_CAP), CF = new Uint8Array(CAND_CAP);
const CG = new Float64Array(CAND_CAP);
const CI = new Int32Array(CAND_CAP);
const CANDS = createCands(CAND_CAP);
const PAY = {};

const sweepSide = (rel, right) => (rel[0] * right[0] + rel[1] * right[1] + rel[2] * right[2] >= 0 ? 1 : -1);

// The gap from the ship's capsule to every candidate's surface, into CG. SEG holds the capsule: centre, unit nose,
// half length and radius (written once, so no number is boxed per candidate).
const SEG = new Float64Array(8);
function capsuleGaps(n) {
  const px = SEG[0], py = SEG[1], pz = SEG[2], fx = SEG[3], fy = SEG[4], fz = SEG[5], hl = SEG[6], cap = SEG[7];
  for (let c = 0; c < n; c++) {
    const dx = CX[c] - px, dy = CY[c] - py, dz = CZ[c] - pz;
    let a = dx * fx + dy * fy + dz * fz;
    a = a < -hl ? -hl : a > hl ? hl : a;
    const ex = dx - fx * a, ey = dy - fy * a, ez = dz - fz * a;
    CG[c] = Math.sqrt(ex * ex + ey * ey + ez * ez) - CR[c] - cap;
  }
}
function setSeg(p, f, T) {
  SEG[0] = p[0]; SEG[1] = p[1]; SEG[2] = p[2]; SEG[3] = f[0]; SEG[4] = f[1]; SEG[5] = f[2];
  SEG[6] = T.COLLIDE.CAPSULE_HALF; SEG[7] = T.COLLIDE.CAPSULE_R;
}

// ---------------------------------------------------------------- the step

/**
 * stepShip(ship, input, ctx, h, ev): one step of h seconds (the scaled step; h = 0 in hit-stop moves nothing).
 * ctx = { zone, frameU, grid, wells, tow, cargo, settings, tune, wellsOff } as in final.md 4.3, plus the fields
 * stepDrive fills: traffic, statics, near (the tracker), t (game.t), zoneT (the traffic clock), actors, stats,
 * assistAt ([x, y, z] of the objective for Cruise's height assist, or null), slingAt ([x, y] of a marked sling exit,
 * or null), freeBoost (the jump's run-up: boost speed for free). It writes hitStop and slowT/slowX back into ctx when
 * a crash asks for them.
 */
export function stepShip(ship, input, ctx, h, ev) {
  const T = ctx.tune || TUNE;
  const S = T.SHIP, D = T.DRIFT, B = T.BAR, X = T.PROX, PL = T.PLANE, C = T.COLLIDE, W = T.WELL;
  const t = num(ctx.t);
  const pilot = ctx.settings?.assists === 'pilot';
  ctx.hitStop = 0; ctx.slowT = 0;
  if (ship.padT === undefined) flightFields(ship);

  // The pose the renderer blends from.
  ship.prev.pos[0] = ship.pos[0]; ship.prev.pos[1] = ship.pos[1]; ship.prev.pos[2] = ship.pos[2];
  ship.prev.yaw = ship.yaw; ship.prev.pitch = ship.pitch; ship.prev.bank = ship.bank;
  if (!(h > 0)) return ship;

  // Clean inputs (game.step cleans too; tests call this directly).
  const inSteer = clamp(num(input?.steer), -1, 1), inClimb = clamp(num(input?.climb), -1, 1);
  const gas = clamp(num(input?.gas), 0, 1), brake = clamp(num(input?.brake), 0, 1);
  const driftHeld = !!input?.drift, boostHeld = !!input?.boost, burst = !!input?.boostBurst;
  const autoDrift = !!input?.autoDrift && ctx.settings?.autoDrift !== false && !pilot;
  const keys = input?.source === 'keys' || input?.source == null;

  // 1. Timers.
  ship.stunT = Math.max(0, ship.stunT - h);
  ship.flickerT = Math.max(0, ship.flickerT - h);
  ship.snapT = Math.max(0, ship.snapT - h);
  ship.kickT = Math.max(0, ship.kickT - h);
  ship.burstT = Math.max(0, ship.burstT - h);
  ship.padT = Math.max(0, ship.padT - h);
  ship.assistOffT = Math.max(0, ship.assistOffT - h);
  if (ship.coastT > 0) ship.coastT = Math.max(0, ship.coastT - h);
  if (ship.db.t > 0) { ship.db.t = Math.max(0, ship.db.t - h); if (ship.db.t === 0) ship.db.tier = 0; }

  // 2. The plane: turn the ship's up toward U, never faster than U_TURN_MAX.
  const U = ctx.frameU || UP;
  {
    const up = ship.up;
    const d = clamp(up[0] * U[0] + up[1] * U[1] + up[2] * U[2], -1, 1);
    const ang = Math.acos(d);
    if (ang > 1e-6) {
      const f = Math.min(1, (PL.U_TURN_MAX * h) / ang);
      up[0] += (U[0] - up[0]) * f; up[1] += (U[1] - up[1]) * f; up[2] += (U[2] - up[2]) * f;
      const l = len3(up[0], up[1], up[2]) || 1;
      up[0] /= l; up[1] /= l; up[2] /= l;
    }
  }
  const up = ship.up;
  basisFrom(up, 0, N0, E0);                                   // north and east on the plane

  // 3. Smooth the stick: keys ramp linearly, sticks and touch ease with a time constant.
  ship.steerS = smoothAxis(ship.steerS, inSteer, keys, h, S);
  ship.climbS = smoothAxis(ship.climbS, inClimb, keys, h, S);
  const steer = ship.steerS, climb = ship.climbS;

  let s = Math.max(0, num(ship.speed));
  const sStart = s;
  const u = clamp(s / S.S_TOP, 0, 1);
  const yawMax = s < S.PIVOT_S ? S.YAW_PIVOT : lerp(S.YAW_LO, S.YAW_HI, u);

  // Travel line: heading and climb angle of the velocity (the nose when standing still).
  const v = ship.vel;
  const vlen = len3(v[0], v[1], v[2]);
  let vang, vpit;
  if (vlen > 1e-6) {
    const vu = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
    const vn = v[0] * N0[0] + v[1] * N0[1] + v[2] * N0[2], ve = v[0] * E0[0] + v[1] * E0[1] + v[2] * E0[2];
    vang = Math.atan2(ve, vn);
    vpit = Math.atan2(vu, len2(vn, ve));
  } else {
    vang = ship.yaw; vpit = ship.pitch;
  }
  const vang0 = vang;

  // 4. Drift: start, cash out, charge (the charge is after grip, below).
  const dr = ship.drift;
  const xIn = dr.on ? steer * dr.dir : 0;
  if (!dr.on) {
    let start = false;
    if (driftHeld && Math.abs(steer) >= D.MIN_STEER && s >= D.MIN_S) start = true;
    if (!start && autoDrift && !driftHeld && Math.abs(steer) >= D.AUTO_STEER && s >= D.AUTO_S) {
      dr.autoT += h;
      if (dr.autoT >= D.AUTO_T) start = true;
    } else if (!start) {
      dr.autoT = 0;
    }
    if (start && s >= Math.min(D.MIN_S, D.AUTO_S)) {
      dr.on = true; dr.dir = steer >= 0 ? 1 : -1; dr.t = 0; dr.charge = 0; dr.tier = 0; dr.autoT = 0;
      dr.manual = driftHeld; dr.exitT = 0; dr.counterT = 0; dr.turn = 0; dr.well = -1;
      if (ev) ev.push('driftStart', { dir: dr.dir, auto: !driftHeld });
    }
  } else {
    if (driftHeld) dr.manual = true;
    let out = false;
    if (dr.manual) {
      if (!driftHeld) out = true;
    } else {
      dr.exitT = steer * dr.dir < D.EXIT_STEER ? dr.exitT + h : 0;
      if (dr.exitT >= D.EXIT_T) out = true;
    }
    dr.counterT = xIn < -D.COUNTER ? dr.counterT + h : 0;
    if (dr.counterT >= D.COUNTER_T) out = true;
    if (s < D.MIN_S * 0.5) out = true;
    if (out) s = cashOut(ship, s, vang, ctx, t, ev, T);
  }

  // 5. Yaw about U.
  let yawRate;
  if (dr.on) {
    const x = clamp(steer * dr.dir, -1, 1);
    yawRate = dr.dir * yawMax * D.YAW_X * (0.45 + 0.55 * (x + 1) / 2);
  } else {
    yawRate = steer * yawMax;
  }
  if (ship.stunT > 0) yawRate *= C.HEAD_STEER;
  const playerYaw = yawRate;
  const zone = ctx.zone;
  // No turn-back in the jump's run-up: the exit gates sit at the rim and the launch rings lie beyond it.
  if (zone && !ctx.freeBoost) {
    const rim = rimTurn(zone, ship.pos, ship.yaw, T);
    if (rim !== 0) {
      const R = zone.R ?? 700;
      const x = clamp((len2(ship.pos[0], ship.pos[1]) - R) / T.EDGE.BAND, 0, 1);
      const edge = x * x * (3 - 2 * x);
      if (yawRate * rim < 0) yawRate *= 1 - edge;              // you can fight it for a while, never win
      yawRate += rim;
      if (t - ship.edgeT >= T.EDGE.LINE_GAP) {
        ship.edgeT = t;
        if (ev) ev.push('edgeTurn', { r: len2(ship.pos[0], ship.pos[1]) });
      }
    }
  }
  ship.yaw = wrap(ship.yaw + yawRate * h);
  ship.yawRate = yawRate;

  // 6. Pitch: climb, the band, the level return (toward Cruise's height assist, if any).
  const height = ship.pos[0] * up[0] + ship.pos[1] * up[1] + ship.pos[2] * up[2];
  const H = zone ? bandAt(zone, ship.pos) : 1e9;
  let auth = 1;
  if (Math.abs(height) > H && climb * height > 0) {
    auth = clamp(1 - (Math.abs(height) - H) / ((PL.BAND_FALL - 1) * H), 0, 1);   // none left at BAND_FALL × H
  }
  if (Math.abs(inClimb) > 0.05) ship.assistOffT = PL.HA_OFF;
  let target = 0;
  const A = ctx.assistAt;
  if (A && !pilot && ship.assistOffT <= 0 && s > 1) {
    const dx = A[0] - ship.pos[0], dy = A[1] - ship.pos[1], dz = A[2] - height;
    const far = len2(dx, dy);
    basisFrom(up, ship.yaw, FW, null);
    const ahead = (dx * FW[0] + dy * FW[1]) / (far || 1);
    if (far < PL.HA_RANGE && ahead > Math.cos(PL.HA_CONE * DEG)) {
      target = Math.asin(clamp(clamp(dz, -PL.HA_RATE, PL.HA_RATE) / s, -0.5, 0.5));
    }
  }
  const pmax = PL.PITCH_MAX * DEG;
  let pitch = ship.pitch + climb * auth * PL.PITCH_RATE * h;
  const w = 1 - Math.min(1, Math.abs(climb));
  if (w > 0) {
    // Ease to the target with a 2° overshoot aim, stopping at the target: a crisp level-off, no long tail.
    const d = target - pitch;
    if (Math.abs(d) > 1e-6) {
      const step = (d + Math.sign(d) * 2 * DEG) * (1 - Math.exp(-h / PL.PITCH_RET)) * w;
      pitch += Math.abs(step) > Math.abs(d) ? d : step;
    }
  }
  if (Math.abs(height) > H) pitch -= Math.sign(height) * PL.BAND_NUDGE * DEG * h;
  ship.pitch = clamp(pitch, -pmax, pmax);

  // 7. Grip: turn the travel line toward the nose; the vertical always grips hard.
  const slip0 = wrap(ship.yaw - vang);
  let grip = ship.snapT > 0 ? D.SNAP : dr.on ? D.GRIP : s < S.PIVOT_S ? 2 * S.GRIP_LO : lerp(S.GRIP_LO, S.GRIP_HI, u);
  if (ship.tow) grip *= T.TOW.GRIP_X;
  const dv = slip0 * (1 - Math.exp(-grip * h));
  vang = wrap(vang + dv);
  vpit += (ship.pitch - vpit) * (1 - Math.exp(-S.GRIP_V * h));
  s *= 1 - (dr.on ? D.SCRUB : S.SCRUB) * Math.abs(Math.sin(slip0)) * h;
  const slip = wrap(ship.yaw - vang);
  ship.slip = slip;

  // 8. Drift charge and tiers.
  if (dr.on) {
    dr.t += h;
    const x = clamp(steer * dr.dir, 0, 1);
    // Inside a well's sling ring gravity does the turning, so the nose barely slips: the slip factor is dropped there
    // and the charge runs CHARGE_X faster. A lap round a giant reaches the blue tier.
    const wi = wellAt(ctx, ship.pos, SLING_RING);
    const slipF = wi >= 0 ? 1 : clamp(Math.abs(slip) / (D.CHARGE_SLIP * DEG), D.CHARGE_FLOOR, 1);
    let rate = (D.CHARGE_BASE + D.CHARGE_IN * x) * slipF;
    if (wi >= 0) rate *= W.CHARGE_X;
    dr.charge += rate * h;
    let tier = 0;
    for (let i = 0; i < D.TIERS.length; i++) if (dr.charge >= D.TIERS[i]) tier = i + 1;
    if (tier > dr.tier) {
      dr.tier = tier;
      addBar(ship, D.TIER_BAR[tier - 1]);
      if (ev) ev.push('driftTier', { tier, dir: dr.dir });
    }
  }

  // 9. Speed along the travel line.
  const tow = !!ship.tow;
  const top = S.S_TOP * (ship.draft.on ? 1 + X.DRAFT_TOP : 1) * (tow ? T.TOW.TOP_X : 1);
  let tgt = lerp(S.S_CRUISE, Math.max(S.S_CRUISE, top), gas);
  let k = (s < S.S_CRUISE ? S.K_LOW : S.K_GAS) * (tow ? T.TOW.ACC_X : 1);
  if (ship.db.t > 0) { tgt = Math.max(tgt, S.S_TOP * S.S_DB_X); k = Math.max(k, S.K_BOOST); }
  if (ship.padT > 0) { tgt = Math.max(tgt, S.S_BOOST); k = Math.max(k, S.K_BOOST); }
  // An arrival keeps its drop-out speed for a moment (a free boost), so the first feeling is speed, not braking.
  // It is a straight run out of the drop-out: the first steer ends it, and so does anything that took the speed away
  // (a hit, a teleport, a race start).
  if (ship.coastT > 0 && (s < num(ship.coastS) - 4 || dr.on || Math.abs(steer) > 0.05)) ship.coastT = 0;
  if (ship.coastT > 0) tgt = Math.max(tgt, num(ship.coastS));
  if (burst && ship.bar >= B.MIN) ship.burstT = B.FLICK_BURST;
  const wants = !ctx.freeBoost && (boostHeld || ship.burstT > 0 || (ship.boosting && ship.boostT < B.MIN_BURST));
  if (!ship.boosting && wants && ship.bar >= B.MIN) {
    ship.boosting = true; ship.boostT = 0; ship.kickT = S.KICK_S;
    if (ev) ev.push('boostStart', { burst: !boostHeld });
  } else if (ship.boosting && (!wants || ship.bar <= 0)) {
    ship.boosting = false; ship.burstT = 0;
    if (ev) ev.push('boostEnd', { t: ship.boostT });
  }
  if (ship.boosting) {
    tgt = Math.max(tgt, S.S_BOOST); k = S.K_BOOST;
    ship.bar = Math.max(0, ship.bar - B.DRAIN * h);
    ship.boostT += h;
  }
  if (ctx.freeBoost) { tgt = Math.max(tgt, S.S_BOOST); k = Math.max(k, S.K_BOOST); }
  const braking = brake > 0.05;
  if (braking) ship.coastT = 0;
  if (braking) {
    s = Math.max(0, s - S.BRAKE_A * brake * h);
  } else if (s < tgt) {
    s += (k * (tgt - s) + (ship.kickT > 0 ? S.KICK_A : 0)) * h;
  } else {
    s -= S.K_COAST * (s - tgt) * h;
  }

  // 10. Velocity from the travel line, then outside forces (wells), then the floor assist.
  {
    const cp = Math.cos(vpit), sp = Math.sin(vpit), ca = Math.cos(vang), sa = Math.sin(vang);
    VEL[0] = (N0[0] * ca + E0[0] * sa) * cp * s + up[0] * sp * s;
    VEL[1] = (N0[1] * ca + E0[1] * sa) * cp * s + up[1] * sp * s;
    VEL[2] = (N0[2] * ca + E0[2] * sa) * cp * s + up[2] * sp * s;
  }
  const wells = ctx.wells;
  if (wells) {
    const along = W.ALONG ?? WELL_ALONG;
    for (let i = 0; i < wells.length; i++) {
      const wl = wells[i];
      if (!(ctx.wellsOff && ctx.wellsOff.includes(wl.id))) pull(wl, ship.pos, VEL, h, along);
    }
  }
  floorAssist(ship, ctx, VEL, h, pilot, T);
  s = len3(VEL[0], VEL[1], VEL[2]);

  // Aftertouch: in a big crash's slow motion, steering bends the rebound (up to ±AFTERTOUCH).
  if (ship.afterT > 0) {
    ship.afterT = Math.max(0, ship.afterT - h);
    const maxB = C.AFTERTOUCH * DEG;
    const want = clamp(ship.afterBend + steer * (maxB / (C.BIG_SLOW * C.BIG_X)) * h, -maxB, maxB);
    const d = want - ship.afterBend;
    ship.afterBend = want;
    if (d !== 0) { rotUp(VEL, up, -d); ship.yaw = wrap(ship.yaw + d); }
  }
  s = Math.min(s, S.S_CAP);
  if (!braking) s = Math.max(s, Math.min(sStart, C.HEAD_FLOOR));   // only the brake takes you under 6 u/s
  scaleTo(VEL, s);

  // 11. Move, sweeping the capsule against everything near (static bodies, traffic, actors).
  const p = ship.pos;
  P0[0] = p[0]; P0[1] = p[1]; P0[2] = p[2];
  P1[0] = p[0] + VEL[0] * h; P1[1] = p[1] + VEL[1] * h; P1[2] = p[2] + VEL[2] * h;
  basisFrom(up, ship.yaw, FW, RT);
  shipForward(ship, NOSE);
  const nc = gather(ship, ctx, T);
  setSeg(P0, NOSE, T);
  capsuleGaps(nc);
  const hit = sweepAll(nc, NOSE, T, h);
  let crashed = false;
  const hitId = hit >= 0 ? CI[hit] : -1;
  if (hit >= 0) {
    crashed = respond(ship, hit, ctx, t, ev, T, s);
    s = len3(VEL[0], VEL[1], VEL[2]);
  } else {
    p[0] = P1[0]; p[1] = P1[1]; p[2] = P1[2];
  }
  ship.vel[0] = VEL[0]; ship.vel[1] = VEL[1]; ship.vel[2] = VEL[2];
  ship.speed = s;

  // 12. Proximity: near misses, hairlines, threads, skims, drafts.
  proximity(ship, nc, ctx, h, t, ev, T, crashed, hitId);

  // 13. Sling memory: how far the travel line has turned inside a well, for the release.
  if (dr.on) {
    const wi = wellAt(ctx, p, W.CUT);
    if (wi >= 0) {
      const a1 = headingOnPlane(ship.vel);
      dr.well = wi;
      dr.turn += Math.abs(wrap(a1 - vang0));                 // grip and gravity together
    }
  }

  // 14. The chain banks after CHAIN_GAP s with nothing new.
  if (ship.chain.n > 0 && t - ship.chain.lastT > X.CHAIN_GAP) bankChain(ship, ev, T);

  // 15. Show only: bank and hop.
  const bankTgt = dr.on ? dr.dir * (PL.BANK_DRIFT * DEG + Math.abs(slip) * PL.BANK_SLIP)
    : clamp(playerYaw / Math.max(1e-6, yawMax), -1, 1) * PL.BANK_DRIVE * DEG;
  ship.bank += (bankTgt - ship.bank) * (1 - Math.exp(-h / PL.BANK_TC));
  ship.hop = dr.on && dr.t < D.HOP_T ? D.HOP * Math.sin((Math.PI * dr.t) / D.HOP_T) : 0;
  return ship;
}

function smoothAxis(cur, target, keys, h, S) {
  if (keys) {
    const toward = Math.abs(target) > Math.abs(cur) && target * cur >= 0;
    const rate = toward ? 1 / S.KEY_RAMP : 1 / S.KEY_DROP;
    const d = target - cur;
    return Math.abs(d) <= rate * h ? target : cur + Math.sign(d) * rate * h;
  }
  const tc = Math.abs(target) > Math.abs(cur) ? S.STEER_IN : S.STEER_OUT;
  return cur + (target - cur) * (1 - Math.exp(-h / tc));
}

// Rotate a vector about the unit up by a radians (positive is clockwise seen from above, as yaw).
function rotUp(vec, up, a) {
  const c = Math.cos(-a), s = Math.sin(-a), d = (up[0] * vec[0] + up[1] * vec[1] + up[2] * vec[2]) * (1 - c);
  const x = vec[0] * c + (up[1] * vec[2] - up[2] * vec[1]) * s + up[0] * d;
  const y = vec[1] * c + (up[2] * vec[0] - up[0] * vec[2]) * s + up[1] * d;
  const z = vec[2] * c + (up[0] * vec[1] - up[1] * vec[0]) * s + up[2] * d;
  vec[0] = x; vec[1] = y; vec[2] = z;
}

// A vector's heading on the plane (radians clockwise from north), with this step's north and east.
const headingOnPlane = (v) => Math.atan2(v[0] * E0[0] + v[1] * E0[1] + v[2] * E0[2], v[0] * N0[0] + v[1] * N0[1] + v[2] * N0[2]);

function scaleTo(vec, s) {
  const l = len3(vec[0], vec[1], vec[2]);
  if (l > 1e-9) { vec[0] *= s / l; vec[1] *= s / l; vec[2] *= s / l; }
}

// The index of the well whose ring (k × rs) holds pos, or −1.
function wellAt(ctx, pos, k) {
  const wells = ctx.wells;
  if (!wells) return -1;
  for (let i = 0; i < wells.length; i++) {
    const wl = wells[i];
    if (ctx.wellsOff && ctx.wellsOff.includes(wl.id)) continue;
    const dx = wl.pos[0] - pos[0], dy = wl.pos[1] - pos[1], dz = wl.pos[2] - pos[2];
    if (dx * dx + dy * dy + dz * dz < (k * wl.rs) ** 2) return i;
  }
  return -1;
}

// Let go of a drift: with a tier, the drift-boost (and a sling inside a well). Returns the new speed.
function cashOut(ship, s, vang, ctx, t, ev, T) {
  const D = T.DRIFT, dr = ship.drift;
  let tier = dr.tier;
  if (tier > 0) {
    // A sling: the drift turned the travel line 90° or more inside a well.
    if (dr.well >= 0 && dr.turn >= Math.PI / 2 && ctx.wells?.[dr.well]) {
      const wl = ctx.wells[dr.well];
      addBar(ship, T.BAR.SLING);
      if (ev) ev.push('sling', { body: wl.id, turn: dr.turn, speed: s });
      chainEvent(ship, t, POINTS.sling, ev, T);
      const at = ctx.slingAt;
      if (at) {
        const want = Math.atan2(at[0] - ship.pos[0], at[1] - ship.pos[1]);
        if (Math.abs(wrap(want - vang)) <= D.PERFECT_SLING * DEG) {
          tier = Math.min(3, tier + 1);
          if (ev) ev.push('perfectSling', { body: wl.id, tier });
        }
      }
    }
    ship.db.t = D.DB_DUR[tier - 1];
    ship.db.tier = tier;
    ship.snapT = D.SNAP_S;
    s = Math.min(T.SHIP.S_CAP, s + D.DB_KICK);
    if (ctx.stats) ctx.stats.drifts[tier - 1]++;
    if (ev) ev.push('driftBoost', { tier, speed: s });
    chainEvent(ship, t, POINTS.driftBoost * tier, ev, T);
  }
  dr.on = false; dr.t = 0; dr.charge = 0; dr.tier = 0; dr.exitT = 0; dr.counterT = 0; dr.turn = 0; dr.well = -1;
  dr.manual = false;
  return s;
}

// A collision or a hard brake ends the drift and drops the charge.
function loseDrift(ship, ev, why) {
  const dr = ship.drift;
  if (!dr.on) return;
  if (ev) ev.push('driftLost', { tier: dr.tier, why });
  dr.on = false; dr.t = 0; dr.charge = 0; dr.tier = 0; dr.exitT = 0; dr.counterT = 0; dr.turn = 0; dr.well = -1;
  dr.manual = false;
}

// A well's pull on a velocity (handling §3.10): g_s · (rs / r)² outside rs, where it peaks. Inside rs it falls
// to nothing at the centre, as inside any spread-out mass, so a tight drift is not dragged into the core. Only
// `along` of the pull's push along the velocity changes the speed: the well mostly bends your line (a banked curve),
// it does not fling you in at 48 u/s. The drift-boost and the sling pay the speed.
function pull(wl, p, v, h, along) {
  const dx = wl.pos[0] - p[0], dy = wl.pos[1] - p[1], dz = wl.pos[2] - p[2];
  const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (r >= wl.cut || r < 1e-6) return;
  const q = r >= wl.rs ? wl.rs / r : 1;
  const g = r >= wl.rs ? wl.gs * q * q : (wl.gs * r) / wl.rs;
  let ax = (dx / r) * g, ay = (dy / r) * g, az = (dz / r) * g;
  const v2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  if (v2 > 1e-9 && along < 1) {
    const k = ((ax * v[0] + ay * v[1] + az * v[2]) / v2) * (1 - along);
    ax -= v[0] * k; ay -= v[1] * k; az -= v[2] * k;
  }
  v[0] += ax * h; v[1] += ay * h; v[2] += az * h;
}

// Floor assist (handling §3.8): big bodies get a shell; meeting it at a shallow angle damps the inward speed.
// While drifting the shell is the drift cushion: a full-lock drift begun anywhere near a giant slides round its core
// instead of into it (the circle should be easy), so the cushion takes any angle and damps harder.
function floorAssist(ship, ctx, vel, h, pilot, T) {
  const PL = T.PLANE, list = ctx.statics;
  if (!list) return;
  const drift = ship.drift.on;
  const shell = drift ? (PL.FLOOR_DRIFT_SHELL ?? DRIFT_SHELL) : pilot ? PL.FLOOR_SHELL_PILOT : PL.FLOOR_SHELL;
  const damp = drift ? (PL.FLOOR_DRIFT_DAMP ?? DRIFT_DAMP) : PL.FLOOR_DAMP;
  const p = ship.pos, cap = T.COLLIDE.CAPSULE_R;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (!b.floor) continue;
    const dx = p[0] - b.pos[0], dy = p[1] - b.pos[1], dz = p[2] - b.pos[2];
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const gap = r - b.rc - cap;
    if (gap > shell || r < 1e-6) continue;
    const nx = dx / r, ny = dy / r, nz = dz / r;
    const vn = vel[0] * nx + vel[1] * ny + vel[2] * nz;
    if (vn >= 0) continue;
    const sp = len3(vel[0], vel[1], vel[2]) || 1;
    if (drift) {
      // Turn the travel line toward the core's tangent, keeping the speed: you slide round it on the drift's side.
      let tx = vel[0] - nx * vn, ty = vel[1] - ny * vn, tz = vel[2] - nz * vn;
      let tl = len3(tx, ty, tz);
      if (tl < 0.3 * sp) {
        const c = Math.cos(ship.yaw), s = Math.sin(ship.yaw), sg = -ship.drift.dir;
        const rx = c * E0[0] - s * N0[0], ry = c * E0[1] - s * N0[1], rz = c * E0[2] - s * N0[2];
        const k = rx * nx + ry * ny + rz * nz;
        tx = sg * (rx - nx * k); ty = sg * (ry - ny * k); tz = sg * (rz - nz * k);
        tl = len3(tx, ty, tz) || 1;
      }
      const f = 1 - Math.exp(-damp * h);
      vel[0] += (tx / tl * sp - vel[0]) * f; vel[1] += (ty / tl * sp - vel[1]) * f; vel[2] += (tz / tl * sp - vel[2]) * f;
      scaleTo(vel, sp);
      continue;
    }
    if (Math.asin(Math.min(1, -vn / sp)) > PL.FLOOR_ANGLE * DEG) continue;   // steep dives hit
    const cut = -vn * (1 - Math.exp(-damp * h));
    vel[0] += nx * cut; vel[1] += ny * cut; vel[2] += nz * cut;
  }
}

// Gather everything near the ship into the candidate arrays: exact position and velocity at this step's end.
function gather(ship, ctx, T) {
  const X = T.PROX, p = ship.pos;
  const tr = ctx.traffic, grid = ctx.grid;
  let n = 0;
  if (grid) {
    const reach = X.TRACK + 8 + (tr ? tr.maxSpeed / 30 : 0) + ship.speed / 60;
    const m = query(grid, p, reach, IDS);
    const dtq = Math.min(TICK, Math.max(0, ctx.zoneT - grid.builtAt));
    for (let c = 0; c < m && n < CAND_CAP; c++) {
      const id = IDS[c];
      if (id >= STATIC_BASE) {
        const b = ctx.statics?.[id - STATIC_BASE];
        if (!b || !(b.rc > 0)) continue;
        CX[n] = b.pos[0]; CY[n] = b.pos[1]; CZ[n] = b.pos[2];
        CVX[n] = 0; CVY[n] = 0; CVZ[n] = 0;
        CR[n] = b.rc; CS[n] = b.r; CF[n] = (b.skim ? 1 : 0) | (b.floor ? 2 : 0);
      } else {
        if (!tr || tr.rc[id] <= 0) continue;
        const kind = tr.kind[id];
        if (kind === KIND.road || kind === KIND.orbit) {
          // The grid holds movers at this tick and the next; blend to this step's time (no spline lookups here).
          const k = id * 3, a = grid.tpos, b = grid.tpos1;
          CVX[n] = (b[k] - a[k]) * 30; CVY[n] = (b[k + 1] - a[k + 1]) * 30; CVZ[n] = (b[k + 2] - a[k + 2]) * 30;
          CX[n] = a[k] + CVX[n] * dtq; CY[n] = a[k + 1] + CVY[n] * dtq; CZ[n] = a[k + 2] + CVZ[n] * dtq;
        } else {
          posAt(tr, id, ctx.zoneT, BP);                       // swarm and parked bodies: few, and cheap
          velAt(tr, id, ctx.zoneT, BV);
          CX[n] = BP[0]; CY[n] = BP[1]; CZ[n] = BP[2];
          CVX[n] = BV[0]; CVY[n] = BV[1]; CVZ[n] = BV[2];
        }
        CR[n] = tr.rc[id]; CS[n] = tr.size[id]; CF[n] = 8;
      }
      CI[n] = id;
      n++;
    }
  }
  const actors = ctx.actors;
  if (actors) {
    for (let j = 0; j < actors.length && n < CAND_CAP; j++) {
      const a = actors[j];
      if (!a || !a.pos || a.ghost || (ship.tow && ship.tow.actor === a.id)) continue;
      const rc = num(a.rc ?? a.data?.rc, 0.6);
      if (!(rc > 0)) continue;
      CX[n] = num(a.pos[0]); CY[n] = num(a.pos[1]); CZ[n] = num(a.pos[2]);
      CVX[n] = num(a.vel?.[0]); CVY[n] = num(a.vel?.[1]); CVZ[n] = num(a.vel?.[2]);
      CR[n] = rc; CS[n] = num(a.r ?? a.data?.r, 1); CF[n] = 4 | 8;
      CI[n] = ACTOR_BASE + j;
      n++;
    }
  }
  return n;
}

// Sweep the capsule (nose, middle and tail spheres) from P0 to P1 against each candidate, in the candidate's frame.
// Returns the candidate index of the first touch (HIT_N holds its normal, P1 the contact point), or −1.
function sweepAll(n, nose, T, h) {
  const C = T.COLLIDE, rc = C.CAPSULE_R, hl = C.CAPSULE_HALF;
  const travel = len3(P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]);
  let best = -1, bestT = 2, bestK = 0;
  for (let c = 0; c < n; c++) {
    BP[0] = CX[c]; BP[1] = CY[c]; BP[2] = CZ[c];
    const bv = len3(CVX[c], CVY[c], CVZ[c]) * h;
    if (CG[c] > travel + bv + 0.05) continue;
    for (let kk = -1; kk <= 1; kk++) {
      const o = kk * hl;
      // Start: the body was bv·h back along its path, so shift the start the other way (relative motion).
      Q0[0] = P0[0] + nose[0] * o + CVX[c] * h;
      Q0[1] = P0[1] + nose[1] * o + CVY[c] * h;
      Q0[2] = P0[2] + nose[2] * o + CVZ[c] * h;
      Q1[0] = P1[0] + nose[0] * o; Q1[1] = P1[1] + nose[1] * o; Q1[2] = P1[2] + nose[2] * o;
      const hit = sweepCapsule(Q0, Q1, rc, BP, CR[c]);
      if (hit && hit.t < bestT) {
        bestT = hit.t; best = c; bestK = o;
        HIT_N[0] = hit.n[0]; HIT_N[1] = hit.n[1]; HIT_N[2] = hit.n[2];
      }
    }
  }
  if (best >= 0) {
    // Contact: the touching sphere sits on the body's surface (plus a small push), the centre follows.
    const c = best, R = CR[c] + rc + T.COLLIDE.SCRAPE_PUSH;
    HIT_BV[0] = CVX[c]; HIT_BV[1] = CVY[c]; HIT_BV[2] = CVZ[c];
    P1[0] = CX[c] + HIT_N[0] * R - nose[0] * bestK;
    P1[1] = CY[c] + HIT_N[1] * R - nose[1] * bestK;
    P1[2] = CZ[c] + HIT_N[2] * R - nose[2] * bestK;
  }
  return best;
}

// The collision response (handling §3.9). Returns true for a head-on.
function respond(ship, c, ctx, t, ev, T, sBefore) {
  const C = T.COLLIDE, n = HIT_N, p = ship.pos;
  p[0] = P1[0]; p[1] = P1[1]; p[2] = P1[2];
  const actor = (CF[c] & 4) !== 0;
  REL[0] = VEL[0] - HIT_BV[0]; REL[1] = VEL[1] - HIT_BV[1]; REL[2] = VEL[2] - HIT_BV[2];
  const relSpeed = len3(REL[0], REL[1], REL[2]);
  const into = REL[0] * n[0] + REL[1] * n[1] + REL[2] * n[2];
  let kind = classifyHit(REL, n, sBefore, actor ? HIT_BV : null, T);
  if (kind === 'headon' && ship.flickerT > 0) kind = 'scrape';   // no second head-on at once
  const id0 = CI[c];
  const tgt0 = actor ? ctx.actors[id0 - ACTOR_BASE] : null;
  if (tgt0 && tgt0.spinT > 0) kind = 'scrape';                // a ship spinning out only brushes you
  const pebble = !actor && CR[c] < (C.PEBBLE_R ?? PEBBLE_R);
  if (pebble) kind = 'scrape';                                // pebbles never bounce you
  const side = sweepSide(n, RT) > 0 ? -1 : 1;                  // the body is on the side opposite the normal
  const id = CI[c];
  const aIndex = actor ? id - ACTOR_BASE : -1;
  const target = actor ? ctx.actors[aIndex] : null;
  PAY.id = actor ? target?.id ?? null : id; PAY.speed = sBefore; PAY.side = side; PAY.rel = relSpeed;
  PAY.x = p[0]; PAY.y = p[1]; PAY.z = p[2]; PAY.pebble = pebble;

  // Fragile cargo counts hard contacts.
  if (ship.cargo && relSpeed > C.CONTACT_HARD) {
    ship.cargo.contacts = (ship.cargo.contacts | 0) + 1;
    ship.cargo.scratched = true;
    if (ev) ev.push('cargoHit', { contacts: ship.cargo.contacts, speed: relSpeed });
  }

  // A towed load is never taken down (a tug you are rescuing only bumps).
  if (kind === 'takedown' && target && target.kind === 'towable') kind = 'scrape';
  if (kind === 'takedown') {
    if (target) {
      target.spinT = C.TAKEDOWN_SPIN;
      target.hits = (target.hits | 0) + 1;
      // Knock it clear of the ship: out of the overlap and moving away (actors.js spins it from here).
      target.pos[0] -= n[0] * 0.5; target.pos[1] -= n[1] * 0.5; target.pos[2] -= n[2] * 0.5;
      if (target.vel) { target.vel[0] -= n[0] * 6; target.vel[1] -= n[1] * 6; target.vel[2] -= n[2] * 6; }
    }
    if (into < 0) { VEL[0] -= n[0] * into; VEL[1] -= n[1] * into; VEL[2] -= n[2] * into; }
    scaleTo(VEL, Math.max(C.TAKEDOWN_KEEP * sBefore, C.HEAD_FLOOR));
    addBar(ship, T.BAR.TAKEDOWN);
    ship.lastHitT = t;
    ctx.hitStop = Math.max(ctx.hitStop, C.TAKEDOWN_STOP ?? 0.1);     // the same beat as a ram (actors.js)
    if (ctx.stats) ctx.stats.takedowns++;
    if (ev) ev.push('takedown', PAY);
    chainEvent(ship, t, POINTS.takedown, ev, T);
    return false;
  }

  if (!pebble) loseDrift(ship, ev, 'hit');                    // a pebble does not break a drift
  if (kind === 'scrape') {
    // Remove the speed into the surface, keep at least SCRAPE_KEEP of the rest, turn the nose toward the tangent
    // (not for a pebble: you plough on the way you were going).
    if (into < 0) { REL[0] -= n[0] * into; REL[1] -= n[1] * into; REL[2] -= n[2] * into; }
    const rs = len3(REL[0], REL[1], REL[2]);
    if (rs < 0.3 * relSpeed) {
      // Nearly dead centre (a pebble or a flicker): slide off sideways, away from the side it touched.
      const k = RT[0] * n[0] + RT[1] * n[1] + RT[2] * n[2];
      const sg = k >= 0 ? 1 : -1;
      REL[0] = sg * (RT[0] - n[0] * k); REL[1] = sg * (RT[1] - n[1] * k); REL[2] = sg * (RT[2] - n[2] * k);
      if (len3(REL[0], REL[1], REL[2]) < 1e-6) { REL[0] = RT[0]; REL[1] = RT[1]; REL[2] = RT[2]; }
      scaleTo(REL, C.SCRAPE_KEEP * relSpeed);
    } else if (rs < C.SCRAPE_KEEP * relSpeed) {
      scaleTo(REL, C.SCRAPE_KEEP * relSpeed);
    }
    VEL[0] = REL[0] + HIT_BV[0]; VEL[1] = REL[1] + HIT_BV[1]; VEL[2] = REL[2] + HIT_BV[2];
    const tang = headingOnPlane(VEL);
    if (!pebble) ship.yaw = wrap(ship.yaw + C.SCRAPE_TURN * wrap(tang - ship.yaw));
    ship.lastHitT = t;
    if (ev) ev.push('scrape', PAY);
    return false;
  }

  // Head-on: reflect, bend halfway to the tangent, keep 40% (never under the floor).
  const ref0 = REL[0] - 2 * into * n[0], ref1 = REL[1] - 2 * into * n[1], ref2 = REL[2] - 2 * into * n[2];
  let tx = REL[0] - into * n[0], ty = REL[1] - into * n[1], tz = REL[2] - into * n[2];
  let tl = len3(tx, ty, tz);
  if (tl < 1e-6) {                                             // dead centre: slide off to the ship's right
    tx = RT[0] - n[0] * (RT[0] * n[0] + RT[1] * n[1] + RT[2] * n[2]);
    ty = RT[1] - n[1] * (RT[0] * n[0] + RT[1] * n[1] + RT[2] * n[2]);
    tz = RT[2] - n[2] * (RT[0] * n[0] + RT[1] * n[1] + RT[2] * n[2]);
    tl = len3(tx, ty, tz) || 1;
  }
  const rl = len3(ref0, ref1, ref2) || 1;
  const bend = C.HEAD_BEND;
  VEL[0] = (ref0 / rl) * (1 - bend) + (tx / tl) * bend;
  VEL[1] = (ref1 / rl) * (1 - bend) + (ty / tl) * bend;
  VEL[2] = (ref2 / rl) * (1 - bend) + (tz / tl) * bend;
  scaleTo(VEL, Math.max(C.HEAD_FLOOR, C.HEAD_KEEP * sBefore));
  ship.yaw = headingOnPlane(VEL);
  ship.stunT = C.HEAD_STEER_T;
  ship.flickerT = C.FLICKER;
  ship.lastHitT = t;
  ship.boosting = false; ship.burstT = 0; ship.db.t = 0; ship.db.tier = 0; ship.padT = 0; ship.coastT = 0;
  addBar(ship, T.BAR.CRASH);
  loseChain(ship, ev);
  if (ctx.stats) ctx.stats.crashes++;
  ctx.hitStop = C.HITSTOP;
  if (ev) ev.push('crash', PAY);
  if (sBefore >= C.BIG_S) {
    ship.afterT = C.BIG_SLOW * C.BIG_X;
    ship.afterBend = 0;
    ctx.slowT = C.BIG_SLOW; ctx.slowX = C.BIG_X;
    if (ev) ev.push('bigCrash', PAY);
  }
  if (target) target.hits = (target.hits | 0) + 1;
  return true;
}

// Near misses, threads, skims and drafts from the gathered candidates.
function proximity(ship, n, ctx, h, t, ev, T, crashed, hitId) {
  const X = T.PROX, B = T.BAR, C = T.COLLIDE;
  const p = ship.pos, v = ship.vel, cap = C.CAPSULE_R, hl = C.CAPSULE_HALF;
  const sp = Math.max(1e-6, ship.speed);
  let m = 0, skimGap = Infinity, skimId = -1, draftId = -1;
  setSeg(p, NOSE, T);
  capsuleGaps(n);
  for (let c = 0; c < n; c++) {
    const gap = CG[c];
    if (CI[c] === hitId) {
      // A contact is not a near miss: this body's pass is spent.
      const near = ctx.near;
      if (near) {
        for (let j = 0; j < near.ids.length; j++) {
          if (near.ids[j] === hitId) { near.away[j] = 1; near.gap[j] = Infinity; near.coolUntil[j] = near.t + X.COOL; }
        }
      }
      continue;
    }
    if (gap <= X.TRACK && m < CANDS.cap) {
      CANDS.ids[m] = CI[c];
      CANDS.gap[m] = gap;
      CANDS.rel[m] = len3(v[0] - CVX[c], v[1] - CVY[c], v[2] - CVZ[c]);
      TMP[0] = CX[c] - p[0]; TMP[1] = CY[c] - p[1]; TMP[2] = CZ[c] - p[2];
      CANDS.side[m] = sweepSide(TMP, RT);
      m++;
    }
    if ((CF[c] & 1) && gap < skimGap) { skimGap = gap; skimId = c; }
    // Draft: behind a moving body big enough, going your way.
    if ((CF[c] & 8) && CS[c] >= X.DRAFT_MIN_R && draftId < 0) {
      const bs = len3(CVX[c], CVY[c], CVZ[c]);
      if (bs >= 10) {
        const fx = CVX[c] / bs, fy = CVY[c] / bs, fz = CVZ[c] / bs;
        if ((v[0] * fx + v[1] * fy + v[2] * fz) / sp > Math.cos(30 * DEG)) {
          const dx = p[0] - CX[c], dy = p[1] - CY[c], dz = p[2] - CZ[c];
          const dist = len3(dx, dy, dz);
          const back = -(dx * fx + dy * fy + dz * fz);
          if (dist < X.DRAFT + CS[c] && back > 0 && back / (dist || 1) > Math.cos(X.DRAFT_CONE * DEG)) draftId = c;
        }
      }
    }
  }
  CANDS.n = m;
  const near = ctx.near;
  if (near) {
    trackNear(near, ship, CANDS, h, ev, T);
    const f = near.fresh;
    if (f.near || f.hairline || f.thread) {
      addBar(ship, f.near * B.NEAR + f.hairline * B.HAIRLINE + f.thread * B.THREAD);
      for (let i = 0; i < f.near; i++) chainEvent(ship, t, POINTS.near, ev, T);
      for (let i = 0; i < f.hairline; i++) chainEvent(ship, t, POINTS.hairline, ev, T);
      for (let i = 0; i < f.thread; i++) chainEvent(ship, t, POINTS.thread, ev, T);
      if (ctx.stats) { ctx.stats.near += f.near; ctx.stats.hairline += f.hairline; }
    }
  }

  // Skim: a skim surface within SKIM u for SKIM_MIN s; it holds until the gap passes SKIM_OFF.
  const sk = ship.skim;
  const bodyId = skimId >= 0 ? ctx.statics?.[CI[skimId] - STATIC_BASE]?.id ?? null : null;
  if (sk.on) {
    if (skimGap > X.SKIM_OFF || crashed) {
      sk.on = false;
      if (ev) ev.push('skimEnd', { body: sk.body, t: sk.t });
      sk.t = 0; sk.body = null;
    } else {
      sk.t += h;
      addBar(ship, B.SKIM * h);
      ship.chain.lastT = t;
    }
  } else if (skimGap < X.SKIM && !crashed) {
    sk.t += h;
    sk.body = bodyId;
    if (sk.t >= X.SKIM_MIN) {
      sk.on = true;
      if (ev) ev.push('skimStart', { body: bodyId, gap: skimGap });
      chainEvent(ship, t, POINTS.skim, ev, T);
    }
  } else {
    sk.t = 0; sk.body = null;
  }

  // Draft.
  const dr = ship.draft;
  if (draftId >= 0 && !crashed) {
    const id = CI[draftId];
    const target = id >= ACTOR_BASE ? ctx.actors?.[id - ACTOR_BASE]?.id ?? id : id;
    if (!dr.on) {
      dr.on = true; dr.t = 0; dr.target = target;
      if (ev) ev.push('draftStart', { target });
      chainEvent(ship, t, POINTS.draft, ev, T);
    }
    dr.t += h;
    dr.target = target;
    addBar(ship, B.DRAFT * h);
    ship.chain.lastT = t;
  } else if (dr.on) {
    dr.on = false;
    if (ev) ev.push('draftEnd', { target: dr.target, t: dr.t });
    dr.target = null; dr.t = 0;
  }
}

// ---------------------------------------------------------------- tow

/**
 * stepTow(ship, load, h, ctx): the tow line (handling §3.11). A spring of rest length TOW.LEN pulls the load (an actor
 * with pos, vel, yaw, speed) behind the ship; the load grips weakly (LOAD_GRIP) so it swings wide; past LIMIT_X × LEN
 * the line is a hard limit and never snaps. The ship feels a share of the pull. Wells pull the load too.
 */
export function stepTow(ship, load, h, ctx) {
  if (!load || !(h > 0)) return;
  const T = ctx?.tune || TUNE, W = T.TOW;
  const len = ship.tow?.len ?? W.LEN;
  const lp = load.pos, lv = load.vel || (load.vel = [0, 0, 0]);
  const dx = lp[0] - ship.pos[0], dy = lp[1] - ship.pos[1], dz = lp[2] - ship.pos[2];
  const L = len3(dx, dy, dz) || 1e-6;
  const ux = dx / L, uy = dy / L, uz = dz / L;
  const rv = (lv[0] - ship.vel[0]) * ux + (lv[1] - ship.vel[1]) * uy + (lv[2] - ship.vel[2]) * uz;
  let F = 0;
  if (L > len) F = W.K * (L - len) + W.DAMP * rv;
  if (F > 0) {
    lv[0] -= ux * F * h; lv[1] -= uy * F * h; lv[2] -= uz * F * h;
    const react = 0.25 * F * h;
    ship.vel[0] += ux * react; ship.vel[1] += uy * react; ship.vel[2] += uz * react;
  }
  // The load's weak grip: its travel line turns toward the way it faces, and it faces the ship.
  const ls = len2(lv[0], lv[1]);
  if (ls > 1e-6) {
    const face = Math.atan2(-ux, -uy);
    load.yaw = wrap(num(load.yaw) + wrap(face - num(load.yaw)) * (1 - Math.exp(-4 * h)));
    const va = Math.atan2(lv[0], lv[1]);
    const nva = va + wrap(load.yaw - va) * (1 - Math.exp(-W.LOAD_GRIP * h));
    lv[0] = Math.sin(nva) * ls; lv[1] = Math.cos(nva) * ls;
  }
  const wells = ctx?.wells;
  if (wells) {
    for (let i = 0; i < wells.length; i++) {
      const wl = wells[i];
      if (ctx.wellsOff && ctx.wellsOff.includes(wl.id)) continue;
      pull(wl, lp, lv, h, 1);                                   // the load feels the whole pull
    }
  }
  lv[0] *= 1 - 0.2 * h; lv[1] *= 1 - 0.2 * h; lv[2] *= 1 - 0.2 * h;
  lp[0] += lv[0] * h; lp[1] += lv[1] * h; lp[2] += lv[2] * h;
  // Hard limit.
  const mx = lp[0] - ship.pos[0], my = lp[1] - ship.pos[1], mz = lp[2] - ship.pos[2];
  const M = len3(mx, my, mz), lim = W.LIMIT_X * len;
  if (M > lim) {
    lp[0] = ship.pos[0] + (mx / M) * lim; lp[1] = ship.pos[1] + (my / M) * lim; lp[2] = ship.pos[2] + (mz / M) * lim;
    const out = (lv[0] - ship.vel[0]) * (mx / M) + (lv[1] - ship.vel[1]) * (my / M) + (lv[2] - ship.vel[2]) * (mz / M);
    if (out > 0) { lv[0] -= (mx / M) * out; lv[1] -= (my / M) * out; lv[2] -= (mz / M) * out; }
  }
  load.speed = len3(lv[0], lv[1], lv[2]);
  // The ship's speed follows its velocity, never under the floor from the pull.
  const s = len3(ship.vel[0], ship.vel[1], ship.vel[2]);
  ship.speed = Math.max(s, Math.min(ship.speed, T.COLLIDE.HEAD_FLOOR));
  scaleTo(ship.vel, ship.speed);
}

// ---------------------------------------------------------------- game.js slots

/**
 * buildFlight(zoneData, seed, tune?) → { traffic, grid, statics, wells, frame }: everything the flight needs that is
 * not game state, made once per zone and seed (game.js's build slot caches it). statics are the zone's bodies with a
 * collider; wells are the bodies with a well (rs, g_s, cut and a minimum radius for the pull).
 */
export function buildFlight(zoneData, seed = 1, tune = TUNE) {
  const W = tune.WELL;
  const traffic = buildTraffic(zoneData, seed, tune);
  const R = zoneData?.R ?? 700;
  const grid = createGrid(32, R + 300);
  const statics = [], wells = [];
  for (const b of zoneData?.bodies || []) {
    const pos = [b.pos?.[0] || 0, b.pos?.[1] || 0, b.pos?.[2] || 0];
    if (b.rc > 0) {
      const k = statics.length;
      const floor = (b.r ?? 0) >= tune.PLANE.FLOOR_MIN_R;
      statics.push({ id: b.id, pos, rc: b.rc, r: b.r ?? b.rc, skim: !!b.skim, floor });
      addStatic(grid, k, pos, b.rc + 2);
    }
    if (b.well && b.well.rs > 0) {
      const rs = b.well.rs, gain = b.well.gain ?? W.GAIN, refS = b.well.refS ?? W.REF_S;
      wells.push({ id: b.id, pos, rs, gs: (gain * refS * refS) / rs, cut: (b.well.cut ?? W.CUT) * rs });
    }
  }
  return { traffic, grid, statics, wells, frame: zoneFrame(zoneData) };
}

/** enterFlight(game, zoneData, ev): game.js's enter slot. A fresh near tracker and the plane's up at the entry. */
export function enterFlight(game, zoneData) {
  game.near = createNearTracker(NEAR_CAP);
  const ship = flightFields(game.ship), T = game.tune || TUNE;
  // Arriving faster than top speed (the opening's drop-out, a jump's): hold it for ENTRY_HOLD s, then ease to cruise.
  if (ship.speed > T.SHIP.S_TOP) { ship.coastT = T.SHIP.ENTRY_HOLD; ship.coastS = ship.speed; }
  upAt(zoneData, game.ship.pos, game.ship.up);
}

const CTX = {
  zone: null, frameU: [0, 0, 1], grid: null, traffic: null, statics: null, wells: null, tow: null, cargo: null,
  settings: null, tune: TUNE, wellsOff: null, near: null, t: 0, zoneT: 0, actors: null, stats: null, assistAt: null,
  slingAt: null, freeBoost: false, hitStop: 0, slowT: 0, slowX: 1,
};

/**
 * stepDrive(game, input, dt, ev): game.js's ship slot. Rebuilds the traffic grid when the 30 Hz tick changes, fills
 * the context from the game, steps the ship and its tow, and turns crash requests into hit-stop and slow motion.
 * Reads game.zone.wellsOff, assistAt and slingAt when WP4 sets them.
 */
export function stepDrive(game, input, dt, ev) {
  const data = zoneOf(game);
  if (!data) return;
  let built = LAST.data === data && LAST.seed === game.seed && LAST.game === game ? LAST.built : null;
  if (!built) {
    built = builtOf(game);
    if (!built || !built.grid) built = fallbackBuilt(data, game.seed, game.tune);
    LAST.data = data; LAST.seed = game.seed; LAST.game = game; LAST.built = built;
  }
  const tq = Math.floor(game.zoneT * 30 + 1e-9) / 30;
  if (built.grid.builtAt !== tq || built.grid.traffic !== built.traffic) rebuildTraffic(built.grid, built.traffic, tq);
  if (!game.near || !game.near.away) game.near = createNearTracker(NEAR_CAP);
  const ctx = CTX;
  ctx.zone = data;
  upAt(data, game.ship.pos, ctx.frameU);
  ctx.grid = built.grid; ctx.traffic = built.traffic; ctx.statics = built.statics; ctx.wells = built.wells;
  ctx.tow = game.ship.tow; ctx.cargo = game.ship.cargo; ctx.settings = game.settings; ctx.tune = game.tune || TUNE;
  ctx.wellsOff = game.zone?.wellsOff || null;
  ctx.near = game.near; ctx.t = game.t; ctx.zoneT = game.zoneT; ctx.actors = game.actors; ctx.stats = game.stats;
  ctx.assistAt = game.zone?.assistAt || null; ctx.slingAt = game.zone?.slingAt || null;
  ctx.freeBoost = game.mode === 'runup';
  stepShip(game.ship, input, ctx, dt, ev);
  if (game.ship.tow) {
    const id = game.ship.tow.actor;
    for (let j = 0; j < game.actors.length; j++) {
      const a = game.actors[j];
      if (a && a.id === id) { stepTow(game.ship, a, dt, ctx); break; }
    }
  }
  if (ctx.hitStop > 0) hitStop(game, ctx.hitStop);
  if (ctx.slowT > 0) slowMo(game, ctx.slowX, ctx.slowT);
}

const LAST = { data: null, seed: 0, game: null, built: null };   // builtOf builds a key string; skip it each step
let FALLBACK = null;
function fallbackBuilt(data, seed, tune) {
  if (!FALLBACK || FALLBACK.data !== data || FALLBACK.seed !== seed) {
    FALLBACK = { data, seed, built: buildFlight(data, seed, tune) };
  }
  return FALLBACK.built;
}

/** The slots for game.js: wire(FLIGHT) (main.js adds the other systems' slots). */
export const FLIGHT = Object.freeze({ build: (zoneData, seed) => buildFlight(zoneData, seed), enter: enterFlight,
  ship: stepDrive });
