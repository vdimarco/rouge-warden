// Light Years Home v3: the warp jump (final.md 11, decisions.md 2). Drive through three launch rings, punch to light
// speed, then fly down a free corridor of light with the zone's own stick: steer on two axes, graze knots for speed,
// thread cluster rings, ride filament rails, take a fork, and drop out into the next zone. Grazes raise the rapidity
// η, hits lower it to a floor, so the jump can never fail; the medal sets the boost bar you arrive with. Earth's clock
// runs while you fly and On Earth cards pass. Pure: no DOM, no three, no clocks; the same seed and inputs replay.
// Ported from lab A's tube (resolve, grazes, hairlines, threads, skims, the chain, the Headlight) with the ring rim
// swapped for a free cross-section, as decisions.md 2 asks.
import { TUNE } from './tune.js';
import { EV } from './events.js';
import { H, setMode, hitStop, slowMo, lock, rand, zoneById, zoneOf, enterZone } from './game.js';
import { JUMPS } from './world/jumps.js';
import { legOf, aheadLyAt, pointOf } from './world/legs.js';
import { OBJECTS } from './objects.js';
import { zoneFrame } from './frame.js';
import { milestoneAgo } from './timeline.js';
import { MILESTONES } from './milestones.js';
import { mulberry32, hashSeed } from './rng.js';

export const JUMP_PARTS = Object.freeze(['runup', 'punch', 'run', 'vista', 'dropout']);
// Hazard kinds in jump.haz.kind. Knots are galaxy groups, rails filament strands, walls sheets with a gap, gates
// cluster rings, pads light pads; the fork is a wall with two gaps.
export const HAZ = Object.freeze({ knot: 1, rail: 2, wall: 3, gate: 4, pad: 5, fork: 6 });
export const HAZ_NAMES = Object.freeze(['', 'knot', 'rail', 'wall', 'gate', 'pad', 'fork']);
// What happened at a hazard (jump.haz.res), for the view: passed clean, grazed, hairline, hit, threaded, a pad, a
// soft-start bump, skimmed.
export const RES = Object.freeze({ none: 0, pass: 1, graze: 2, hairline: 3, hit: 4, thread: 5, pad: 6, bump: 7,
  skim: 8 });
export const HAZ_CAP = 96;
// Rapidity at 0.99c and 0.999c.
export const NINE2 = Math.atanh(0.99);
export const NINE3 = Math.atanh(0.999);
export const MEDALS = Object.freeze(['bronze', 'silver', 'gold', 'tern']);

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const BEHIND = 40;                 // u behind the ship a hazard is kept for the view

// ---------------------------------------------------------------- length

/** jumpLength(distanceLy, soft) → s: round(clamp(LEN_A + LEN_B · log10(ly), LEN_MIN, LEN_MAX)); the soft first jump
 * is at most SOFT_L. */
export function jumpLength(distanceLy, soft = false, tune = TUNE) {
  const J = tune.JUMP;
  const ly = Math.max(1, fin(distanceLy, 1));
  const L = Math.round(clamp(J.LEN_A + J.LEN_B * Math.log10(ly), J.LEN_MIN, J.LEN_MAX));
  return soft ? Math.min(L, J.SOFT_L) : L;
}

// ---------------------------------------------------------------- the state

function newHaz() {
  return {
    kind: new Uint8Array(HAZ_CAP), state: new Uint8Array(HAZ_CAP), res: new Uint8Array(HAZ_CAP),
    tag: new Uint8Array(HAZ_CAP), id: new Int32Array(HAZ_CAP),
    tp: new Float64Array(HAZ_CAP),    // jump time its front passes the ship
    d: new Float32Array(HAZ_CAP),     // u ahead of the ship now (a rail's front), for the view
    x: new Float32Array(HAZ_CAP), y: new Float32Array(HAZ_CAP),     // centre across the corridor (a rail's start)
    x1: new Float32Array(HAZ_CAP), y1: new Float32Array(HAZ_CAP),   // a rail's end; the fork's second gap
    r: new Float32Array(HAZ_CAP),     // knot, gap, ring, pad or rail radius
    w: new Float32Array(HAZ_CAP),     // a ring's galaxy radius; a rail's length in s
    t: new Float32Array(HAZ_CAP),     // jump time it was passed (or met)
    n: 0, live: 0, seq: 0,
  };
}

// The direction to a route point from another, in the zone's map axes (a unit [x, y, z]), or null.
const FRAMES = new Map();
function frameOf(data) {
  if (!data) return null;
  if (!FRAMES.has(data)) FRAMES.set(data, zoneFrame(data));
  return FRAMES.get(data);
}
export function targetDir(fromData, toId, out = [0, 1, 0]) {
  const from = OBJECTS[fromData?.object] || OBJECTS[pointOf(fromData?.id)?.object];
  const to = OBJECTS[pointOf(toId)?.object] || OBJECTS[zoneById(toId)?.object];
  if (!from || !to) return null;
  const g = [to.pos[0] - from.pos[0], to.pos[1] - from.pos[1], to.pos[2] - from.pos[2]];
  const l = Math.hypot(g[0], g[1], g[2]) || 1;
  g[0] /= l; g[1] /= l; g[2] /= l;
  const f = frameOf(fromData);
  if (f) f.toMap(g, out); else { out[0] = g[0]; out[1] = g[1]; out[2] = g[2]; }
  return out;
}

/**
 * armJump(game, toZoneId, ev?) → true when the run-up starts: game.jump is made (final.md 11.2, the corridor
 * version) and the mode goes to 'runup'. Three launch rings bend toward the target; if it is behind you the first
 * ring waits (jump.runup.wait) until you turn.
 */
export function armJump(game, toZoneId, ev = null) {
  if (!game || game.jump || !toZoneId) return false;
  if (game.mode !== 'drive' && game.mode !== 'log' && game.mode !== 'ended') return false;
  const T = game.tune || TUNE, JT = T.JUMP;
  const from = game.zoneId;
  const data = Object.values(JUMPS).find((j) => j.from === from && j.to === toZoneId) || null;
  const leg = data ? null : legOf(from, toZoneId);
  const ly = data ? data.ly : fin(leg?.ly, 1e8);
  const soft = data?.soft ? { s: fin(data.soft.s, JT.SOFT_S), rate: fin(data.soft.rate, JT.SOFT_RATE),
    grazeX: fin(data.soft.grazeX, JT.GRAZE_SOFT / JT.GRAZE) } : null;
  const L = data?.L ?? jumpLength(ly, !!soft, T);
  // Earth's clock at this stop (legs.js), else whatever the game reads now.
  const aheadFrom = fin(data?.earth?.aheadFrom, fin(aheadLyAt(from), fin(game.earth?.aheadLy, 0)));
  const aheadTo = fin(data?.earth?.aheadTo, aheadLyAt(toZoneId) ?? 0);
  const zd = zoneOf(game);
  const dir = targetDir(zd, toZoneId, [0, 1, 0]) || [0, 1, 0];
  const pieces = (data?.pieces || []).map((p) => ({ at: p.at, kind: p.kind, label: p.label, side: p.side || null,
    s: fin(p.s, 0), knots: fin(p.knots, 0), done: false }));
  // A longer run has more to graze, so each gain counts for less: the nines take the same skill on every jump.
  const rings = pieces.filter((p) => p.kind === 'ring' || p.kind === 'gateRing').length;
  const span = L - 5 - JT.PUNCH_T - (soft ? soft.s * (1 - soft.rate) : 0) + JT.PIECE_S * rings;
  const gx = JT.GAIN_X * clamp((JT.GAIN_REF / Math.max(1, span)) ** JT.GAIN_POW, 0.4, 1);
  game.jump = {
    id: data?.id || `${from}>${toZoneId}`, from, to: toZoneId, distanceLy: ly, L, Lr: L, soft, gx,
    part: 'runup', t: 0, partT: 0,
    runup: { rings: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], normals: [[0, 1, 0], [0, 1, 0], [0, 1, 0]], done: 0,
      wait: false, placed: false, misses: 0, dir, aim: 0, assist: [0, 0, 0] },
    eta: 0, etaPeak: 0, phiSky: 0, skyPunch: 0,
    // the corridor: the ship across it (u), its sideways velocity, forward speed (u/s) and distance flown
    pos: [0, 0], prev: [0, 0], vel: [0, 0], speed: 0, s: 0,
    slide: false, slideAuto: false, autoT: 0, exitT: 0, charge: 0, tier: 0, dbT: 0, flickerT: 0,
    boosting: false, burstT: 0,
    haz: newHaz(),
    fork: data?.fork ? { at: data.fork.at, a: data.fork.a, b: data.fork.b, taken: null, until: 0 } : null,
    pieces,
    plan: { nextT: 0, lastT: -99, specials: [], mode: 'normal', modeUntil: 0, voidUntil: 0, voidSide: 0,
      sheetUntil: 0, bag: [], bagMode: null },
    chain: { n: 0, mult: 1, lastT: -99, points: 0 }, score: 0, hits: 0, bumps: 0, grazes: 0, hairlines: 0,
    threads: 0, pads: 0, skim: false, skimT: 0, lastHitT: -99, lastKnot: { t: -99, nx: 0, ny: 0 },
    nines: 0, headlight: false, holdT: 0, holdBest: 0, headlightT: 0, wallT: -99,
    earth: { aheadFrom, aheadTo, ahead: aheadFrom, cards: [], next: 0, queue: [], lastCardT: -99 },
    lines: data?.lines || {}, say: [], pend: [], dotLines: 0,
    danger: 0, dangerSide: 0, dangerX: 0, dangerY: 0, dangerId: -1,
    rec: null, longHaul: 0, zoneReady: false, medal: null, tutorial: data?.tutorial || null,
  };
  if (!setMode(game, 'runup', ev)) { game.jump = null; return false; }
  placeRings(game, game.jump, T);
  return true;
}

/** setZoneReady(game, ready = true): main.js says the next zone's art is in. The vista waits for it. */
export function setZoneReady(game, ready = true) {
  if (game?.jump) game.jump.zoneReady = !!ready;
}

/** jumpMedal(jump, tune?) → 'tern' | 'gold' | 'silver' | 'bronze' (final.md 11.5). */
export function jumpMedal(jump, tune = TUNE) {
  if (!jump) return 'bronze';
  const J = tune.JUMP;
  if (jump.etaPeak >= NINE3 && jump.hits === 0 && jump.holdBest >= J.TERN_HOLD - 1e-9) return 'tern';
  if (jump.etaPeak >= NINE3) return 'gold';
  if (jump.etaPeak >= NINE2 && jump.hits <= J.SILVER_HITS) return 'silver';
  return 'bronze';
}

/** The boost bar a medal gives on arrival. */
export const medalBar = (medal, tune = TUNE) => tune.JUMP.MEDAL_BAR[Math.max(0, MEDALS.indexOf(medal))];

// ---------------------------------------------------------------- the run-up

// Lay the three rings on an arc from the ship that bends at most RUNUP_BEND per ring toward the target, or hold
// them back while the target is behind.
function placeRings(game, J, T, start = 0, from = null) {
  const JT = T.JUMP, R = J.runup, ship = game.ship;
  const v = ship.vel, sp = Math.hypot(v[0], v[1]);
  const h0 = sp > 1 ? Math.atan2(v[0], v[1]) : ship.yaw;
  const hT = Math.atan2(R.dir[0], R.dir[1]);
  const off = wrap(hT - h0);
  R.aim = off / DEG;
  if (start === 0 && Math.abs(off) > JT.RUNUP_WAIT * DEG) { R.wait = true; R.placed = false; return; }
  R.wait = false;
  R.placed = true;
  const p = from ? from.slice() : [ship.pos[0], ship.pos[1], ship.pos[2]];
  let h = h0, travelled = start === 0 ? 0 : JT.RUNUP_RINGS[start - 1];
  const bend = JT.RUNUP_BEND * DEG;
  for (let k = start; k < 3; k++) {
    const gap = (start > 0 && k === start ? JT.RUNUP_REFORM : JT.RUNUP_RINGS[k] - travelled);
    travelled = JT.RUNUP_RINGS[k];
    h += clamp(wrap(hT - h), -bend, bend);
    p[0] += Math.sin(h) * gap; p[1] += Math.cos(h) * gap;
    R.rings[k][0] = p[0]; R.rings[k][1] = p[1]; R.rings[k][2] = p[2];
    R.normals[k][0] = Math.sin(h); R.normals[k][1] = Math.cos(h); R.normals[k][2] = 0;
  }
}

function cancelJump(game, ev) {
  const J = game.jump;
  if (ev) ev.push(EV.cancel, { what: 'jump', to: J?.to });
  game.jump = null;
  if (game.zone) game.zone.assistAt = null;
  setMode(game, 'drive', ev);
}

function runupStep(game, J, inp, ev, T) {
  const JT = T.JUMP, R = J.runup, ship = game.ship;
  // Only a tap of the action control calls it off: braking to line up a ring never does.
  if (inp.action) { cancelJump(game, ev); return; }
  if (R.wait || !R.placed) {
    placeRings(game, J, T);
    if (R.wait) { if (game.zone) game.zone.assistAt = null; return; }
  }
  const k = R.done, c = R.rings[k], n = R.normals[k];
  const pr = ship.prev?.pos || ship.pos, p = ship.pos;
  const a = (pr[0] - c[0]) * n[0] + (pr[1] - c[1]) * n[1] + (pr[2] - c[2]) * n[2];
  const b = (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1] + (p[2] - c[2]) * n[2];
  // Cruise's height assist aims at the next ring (a copy: the zone runtime may write into its own).
  if (game.zone) {
    const at = R.assist;
    at[0] = c[0]; at[1] = c[1]; at[2] = c[2];
    game.zone.assistAt = at;
  }
  if (a < 0 && b >= 0) {
    const f = a / (a - b);
    const qx = pr[0] + (p[0] - pr[0]) * f - c[0], qy = pr[1] + (p[1] - pr[1]) * f - c[1],
      qz = pr[2] + (p[2] - pr[2]) * f - c[2];
    const pass = inp.source === 'touch' ? JT.RUNUP_PASS_TOUCH : JT.RUNUP_PASS;
    if (Math.hypot(qx, qy, qz) <= JT.RING_R * pass) {
      R.done++;
      if (ev) ev.push(EV.runupRing, { n: R.done, id: J.id });
      if (R.done >= 3) punch(game, J, ev, T);
      return;
    }
    missRing(game, J, ev, T);
    return;
  }
  // Turned away from a ring you have not reached: it re-forms ahead.
  const dist = Math.hypot(c[0] - p[0], c[1] - p[1]);
  const along = ship.vel[0] * n[0] + ship.vel[1] * n[1];
  if (b < 0 && along < 0 && dist > 50) missRing(game, J, ev, T);
}

function missRing(game, J, ev, T) {
  const R = J.runup, ship = game.ship;
  R.misses++;
  if (ev) ev.push(EV.runupMiss, { n: R.done + 1, id: J.id });
  placeRings(game, J, T, R.done, [ship.pos[0], ship.pos[1], ship.pos[2]]);
}

// ---------------------------------------------------------------- the punch

function punch(game, J, ev, T) {
  const JT = T.JUMP;
  setMode(game, 'punch', ev);
  J.part = 'punch'; J.t = 0; J.partT = 0;
  if (game.zone) game.zone.assistAt = null;
  hitStop(game, JT.PUNCH_STOP);
  lock(game, JT.PUNCH_LOCK);
  J.pos[0] = J.pos[1] = J.prev[0] = J.prev[1] = J.vel[0] = J.vel[1] = 0;
  J.speed = JT.ARRIVE_S;
  J.eta = 0; J.phiSky = 0;
  J.earth.ahead = J.earth.aheadFrom;
  if (game.earth) game.earth.aheadLy = J.earth.aheadFrom;
  // The cards this jump crosses, oldest first, worked out once (so the step allocates nothing).
  const hi = J.earth.aheadFrom, lo = J.earth.aheadTo;
  J.earth.cards = MILESTONES.map((m) => ({ id: m.id, ago: milestoneAgo(m, game.today) }))
    .filter((c) => c.ago < hi && c.ago >= lo).sort((a, b) => b.ago - a.ago);
  J.earth.next = 0;
  planRun(game, J, T);
  if (ev) ev.push(EV.punch, { id: J.id, to: J.to });
  say(J, J.lines.punch, T);
}

// The run's fixed things: the set pieces, the fork, two rails and two cluster rings, at their times.
function planRun(game, J, T) {
  const JT = T.JUMP, P = J.plan, L = J.L;
  const start = JT.PUNCH_T + 1.2, end = L - 5;
  const softEnd = J.soft ? JT.PUNCH_T + J.soft.s : start;
  const sp = [];
  for (let i = 0; i < J.pieces.length; i++) sp.push({ t: J.pieces[i].at * L, type: 'piece', i, done: false });
  if (J.fork) sp.push({ t: J.fork.at * L, type: 'fork', done: false });
  const span = end - Math.max(start, softEnd);
  const want = [[0.32, 'rail'], [0.48, 'gate'], [0.7, 'rail'], [0.86, 'gate']];
  for (const [f, type] of want) {
    let t = Math.max(start, softEnd) + span * f;
    for (let tries = 0; tries < 8; tries++) {
      const clash = sp.find((s) => Math.abs(s.t - t) < 1.4);
      if (!clash) break;
      t = clash.t + (t >= clash.t ? 1.5 : -1.5);
    }
    if (t >= Math.max(start, softEnd) && t <= end - 0.6) sp.push({ t, type, done: false });
  }
  sp.sort((a, b) => a.t - b.t);
  P.specials = sp;
  P.nextT = start;
  P.mode = 'normal'; P.modeUntil = 0; P.lastT = -99;
}

// ---------------------------------------------------------------- spawning

function freeSlot(Hz) {
  for (let i = 0; i < Hz.n; i++) if (Hz.state[i] === 0) return i;
  if (Hz.n < HAZ_CAP) return Hz.n++;
  return -1;
}

// A hazard passes at jump time tp: its place ahead is (tp − t) × your speed, so a pass comes on time whatever the
// speed does meanwhile, and a faster ship sees the course stretch out ahead.
function addHaz(J, kind, tp, x, y, r, w = 0, x1 = 0, y1 = 0, tag = 0) {
  const Hz = J.haz, i = freeSlot(Hz);
  if (i < 0) return -1;
  Hz.kind[i] = kind; Hz.state[i] = 1; Hz.res[i] = 0; Hz.tag[i] = tag; Hz.id[i] = ++Hz.seq;
  Hz.tp[i] = tp; Hz.d[i] = (tp - J.t) * J.speed;
  Hz.x[i] = x; Hz.y[i] = y; Hz.x1[i] = x1; Hz.y1[i] = y1; Hz.r[i] = r; Hz.w[i] = w; Hz.t[i] = 0;
  Hz.live++;
  return i;
}

function gauss(game) {
  const u = Math.max(1e-9, rand(game)), v = rand(game);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Keep a point inside a disc of radius lim (in place on a 2-list), honouring the void and sheet set pieces.
const PT = [0, 0];
function placeIn(J, x, y, lim, t) {
  const P = J.plan;
  if (t < P.voidUntil && Math.sign(x) === P.voidSide) x = -x;
  if (t < P.sheetUntil) y = -Math.abs(y) - 1.2;
  const l = Math.hypot(x, y);
  if (l > lim) { x *= lim / l; y *= lim / l; }
  PT[0] = x; PT[1] = y;
  return PT;
}

// Where the ship will be about `ahead` seconds from now, kept inside the tube.
function lineAt(J, ahead, T) {
  const lim = T.JUMP.TUBE_R - 2;
  let x = J.pos[0] + J.vel[0] * Math.min(0.25, ahead), y = J.pos[1] + J.vel[1] * Math.min(0.25, ahead);
  const l = Math.hypot(x, y);
  if (l > lim) { x *= lim / l; y *= lim / l; }
  PT[0] = x; PT[1] = y;
  return PT;
}

function knotR(game, T) {
  const JT = T.JUMP;
  return JT.KNOT_MIN + (JT.KNOT_MAX - JT.KNOT_MIN) * rand(game);
}


// Which ordinary pattern comes next: the soft start has knots and pads; the calm branch rails and pads; the dense
// branch packs knots.
export const PATTERNS = Object.freeze(['knot', 'pair', 'line', 'wall', 'pads', 'rail']);
// Patterns come from a shuffled bag per stretch, so every run gets a fair mix whatever the seed.
const BAGS = Object.freeze({
  soft: ['knot', 'knot', 'knot', 'knot', 'pads'],
  normal: ['knot', 'knot', 'knot', 'pair', 'pair', 'line', 'wall', 'wall', 'pads', 'rail'],
  calm: ['knot', 'pads', 'pads', 'rail', 'rail', 'pair'],
  dense: ['knot', 'knot', 'knot', 'pair', 'pair', 'line', 'wall'],
});
function patternKind(game, J, tPass, T) {
  const P = J.plan;
  const soft = J.soft && tPass < T.JUMP.PUNCH_T + J.soft.s;
  const mode = soft ? 'soft' : tPass < P.modeUntil ? P.mode : 'normal';
  if (P.bagMode !== mode || !P.bag.length) {
    const bag = BAGS[mode].slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rand(game) * (i + 1));
      const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
    }
    P.bag = bag;
    P.bagMode = mode;
  }
  return P.bag.pop();
}
// Room a pattern needs before it (s since the last pass), so every course can be flown clean.
const ROOM = { knot: 0, pair: 0.35, line: 0.5, wall: 0.6, pads: 0.3, rail: 0.45 };

// One ordinary pattern passing at tPass: a knot, a pair to thread, a line across, a wall, a pad line or a rail.
function spawnPattern(game, J, tPass, T, kind) {
  const JT = T.JUMP, R = JT.TUBE_R;
  const lead = Math.max(0.3, tPass - J.t);
  const d = tPass;
  const soft = J.soft && tPass < JT.PUNCH_T + J.soft.s;
  let dur = 0;
  if (kind === 'knot') {
    const r = knotR(game, T) * (soft ? 0.85 : 1);
    const aimed = rand(game) < JT.AIM || soft;
    let x, y;
    if (aimed) {
      const c = lineAt(J, lead, T);
      x = c[0] + gauss(game) * JT.AIM_SD; y = c[1] + gauss(game) * JT.AIM_SD;
    } else {
      const a = rand(game) * 2 * Math.PI, rr = (R - 1.5) * Math.sqrt(rand(game));
      x = Math.cos(a) * rr; y = Math.sin(a) * rr;
    }
    const p = placeIn(J, x, y, R - r * 0.6, tPass);
    addHaz(J, HAZ.knot, d, p[0], p[1], r);
  } else if (kind === 'pair') {
    // Two knots with a ship-wide gap between them, across your line: thread it or go round.
    const r = JT.KNOT_MIN + 0.3 * rand(game);
    const gap = 2 * JT.SHIP_R + 1.4 + 1.2 * rand(game);
    const c = lineAt(J, lead, T);
    const cx = c[0] + gauss(game) * 0.8, cy = c[1] + gauss(game) * 0.8;
    const a = rand(game) * Math.PI, half = gap / 2 + r;
    const ux = Math.cos(a), uy = Math.sin(a);
    let p = placeIn(J, cx + ux * half, cy + uy * half, R - r * 0.6, tPass);
    addHaz(J, HAZ.knot, d, p[0], p[1], r);
    p = placeIn(J, cx - ux * half, cy - uy * half, R - r * 0.6, tPass);
    addHaz(J, HAZ.knot, d + 0.02, p[0], p[1], r);
  } else if (kind === 'line') {
    // A filament across the corridor: three or four knots in a row with gaps you can slip through.
    const nk = 3 + (rand(game) < 0.5 ? 1 : 0);
    const r = JT.KNOT_MIN + 0.2 * rand(game);
    const a = rand(game) * Math.PI, ux = Math.cos(a), uy = Math.sin(a);
    const c = lineAt(J, lead, T);
    const step = 2 * r + 2 * JT.SHIP_R + 1.6 + 0.8 * rand(game);
    const off = (rand(game) - 0.5) * step;
    for (let k = 0; k < nk; k++) {
      const s = (k - (nk - 1) / 2) * step + off;
      const x = c[0] + ux * s, y = c[1] + uy * s;
      if (Math.hypot(x, y) > R - r * 0.5) continue;           // the row runs into the wall: that knot is gone
      const p = placeIn(J, x, y, R - r * 0.6, tPass);
      addHaz(J, HAZ.knot, d + k * 0.01, p[0], p[1], r);
    }
  } else if (kind === 'wall') {
    // A sheet with one gap, off your line, so you have to move.
    const hole = JT.HOLE_R;
    const a = rand(game) * 2 * Math.PI, m = 3 + 4 * rand(game);
    const c = lineAt(J, lead, T);
    const p = placeIn(J, c[0] + Math.cos(a) * m, c[1] + Math.sin(a) * m, R - hole - 0.8, tPass);
    addHaz(J, HAZ.wall, d, p[0], p[1], hole);
  } else if (kind === 'pads') {
    // Three light pads in a curving row: follow them for speed.
    const c = lineAt(J, lead, T);
    const a = rand(game) * 2 * Math.PI, m = 2 + 4 * rand(game);
    let x = c[0] + Math.cos(a) * m, y = c[1] + Math.sin(a) * m;
    const b = rand(game) * 2 * Math.PI, sx = Math.cos(b) * 1.6, sy = Math.sin(b) * 1.6;
    for (let k = 0; k < 3; k++) {
      const p = placeIn(J, x, y, R - JT.PAD_R - 0.5, tPass);
      addHaz(J, HAZ.pad, d + k * 0.32, p[0], p[1], JT.PAD_R);
      x = p[0] + sx; y = p[1] + sy;
    }
    dur = 0.7;
  } else {
    dur = spawnRail(game, J, d, tPass, T);
  }
  return dur;
}

// A filament rail along the corridor that drifts across it: ride beside it to skim.
function spawnRail(game, J, d, tPass, T) {
  const JT = T.JUMP, R = JT.TUBE_R;
  const c = lineAt(J, Math.max(0.3, tPass - J.t), T);
  const a = rand(game) * 2 * Math.PI, m = 2.5 + 2 * rand(game);
  const p0 = placeIn(J, c[0] + Math.cos(a) * m, c[1] + Math.sin(a) * m, R - 1.5, tPass);
  const x0 = p0[0], y0 = p0[1];
  const b = rand(game) * 2 * Math.PI, drift = 2 + 4 * rand(game);
  const p1 = placeIn(J, x0 + Math.cos(b) * drift, y0 + Math.sin(b) * drift, R - 1.5, tPass + JT.RAIL_T);
  addHaz(J, HAZ.rail, d, x0, y0, JT.RAIL_R, JT.RAIL_T, p1[0], p1[1]);
  return JT.RAIL_T;
}

function spawnSpecial(game, J, sp, ev, T) {
  const JT = T.JUMP, R = JT.TUBE_R, P = J.plan;
  const d = sp.t;
  if (sp.type === 'rail') { spawnRail(game, J, d, sp.t, T); return; }
  if (sp.type === 'gate') {
    const c = lineAt(J, sp.t - J.t, T);
    const a = rand(game) * 2 * Math.PI, m = 2 + 4 * rand(game);
    const ring = JT.GATE_RING;
    const p = placeIn(J, c[0] + Math.cos(a) * m, c[1] + Math.sin(a) * m, R - ring - 0.6, sp.t);
    addHaz(J, HAZ.gate, d, p[0], p[1], ring, JT.GATE_KNOT);
    return;
  }
  if (sp.type === 'fork') {
    // Two gaps on opposite sides, a to the left, b to the right.
    const a = Math.PI + (rand(game) - 0.5) * 0.8, m = 5.4, hole = JT.HOLE_R + 0.5;
    addHaz(J, HAZ.fork, d, Math.cos(a) * m, Math.sin(a) * m, hole, 0, -Math.cos(a) * m, -Math.sin(a) * m);
    if (ev) ev.push(EV.fork, { show: true, a: J.fork.a, b: J.fork.b });
    return;
  }
  const pc = J.pieces[sp.i];
  pc.done = true;
  const tag = sp.i + 1;
  if (pc.kind === 'ring') {
    // A big cluster ring off to one side, half in the corridor: thread it for a big gain.
    const side = pc.side === 'left' ? -1 : 1;
    addHaz(J, HAZ.gate, d, side * 5.4, 0.5, 4.0, 0.75, 0, 0, tag);
  } else if (pc.kind === 'gateRing') {
    addHaz(J, HAZ.gate, d, 0, 0, 5.6, 0.95, 0, 0, tag);
  } else if (pc.kind === 'void') {
    P.voidUntil = sp.t + pc.s; P.voidSide = pc.side === 'left' ? -1 : 1;
  } else if (pc.kind === 'sheet') {
    P.sheetUntil = sp.t + pc.s;
  }
  if (ev) ev.push(EV.setPiece, { label: pc.label, kind: pc.kind, side: pc.side, i: sp.i, at: sp.t });
}

function spawnStep(game, J, ev, T) {
  const JT = T.JUMP, P = J.plan;
  const lead = JT.LEAD, end = J.Lr - 5;
  for (let k = 0; k < P.specials.length; k++) {
    const sp = P.specials[k];
    if (!sp.done && sp.t - lead <= J.t && sp.t <= end + 1e-6) {
      sp.done = true;
      spawnSpecial(game, J, sp, ev, T);
    }
  }
  let guard = 0;
  while (P.nextT - lead <= J.t && P.nextT <= end - 0.4 && guard++ < 4) {
    const kind = patternKind(game, J, P.nextT, T);
    // Keep room round the fixed things: a pattern never lands on top of a ring, a rail or the fork.
    let tPass = Math.max(P.nextT, P.lastT + ROOM[kind]);
    for (let tries = 0; tries < 4; tries++) {
      let moved = false;
      for (let k = 0; k < P.specials.length; k++) {
        const sp = P.specials[k];
        if (sp.type === 'piece' && !J.pieces[sp.i] ) continue;
        const pk = sp.type === 'piece' ? J.pieces[sp.i].kind : sp.type;
        const solid = pk === 'ring' || pk === 'gateRing' || pk === 'gate' || pk === 'fork' || pk === 'rail';
        if (!solid) continue;
        const after = (pk === 'rail' ? JT.RAIL_T : 0) + Math.max(0.45, ROOM[kind]);
        if (tPass > sp.t - 0.6 && tPass < sp.t + after) { tPass = sp.t + after; moved = true; }
      }
      if (!moved) break;
    }
    if (tPass > end - 0.4) { P.nextT = tPass; break; }
    const dur = spawnPattern(game, J, tPass, T, kind);
    P.lastT = tPass + dur;
    // The rate: the soft start, then rising across the run; the dense branch packs it.
    const soft = J.soft && tPass < JT.PUNCH_T + J.soft.s;
    const prog = clamp((tPass - JT.PUNCH_T) / Math.max(1, end - JT.PUNCH_T), 0, 1);
    let rate = soft ? J.soft.rate : JT.HAZ_RATE + (JT.HAZ_RATE_MAX - JT.HAZ_RATE) * prog;
    if (tPass < P.modeUntil) rate *= P.mode === 'dense' ? JT.DENSE_X : P.mode === 'calm' ? 0.8 : 1;
    P.nextT = tPass + dur + (1 / rate) * (0.75 + 0.5 * rand(game));
  }
}

// ---------------------------------------------------------------- what a pass gives

// The result of meeting hazard i at (px, py) across the corridor, in OUT: code (RES), gap (u, the smallest edge
// gap; negative for a hit), side (−1 the hazard is on your left, +1 right), and for a fork which gap you took.
const OUT = { code: 0, gap: 0, side: 1, nx: 0, ny: 0, taken: 0, perfect: false };
export function resolveAt(Hz, i, px, py, T = TUNE, out = OUT) {
  const SR = T.JUMP.SHIP_R;
  const k = Hz.kind[i], r = Hz.r[i];
  let dx = px - Hz.x[i], dy = py - Hz.y[i];
  let dist = Math.hypot(dx, dy);
  out.taken = 0; out.perfect = false;
  out.nx = dist > 1e-6 ? dx / dist : 0; out.ny = dist > 1e-6 ? dy / dist : 1;
  out.side = dx > 1e-6 ? -1 : dx < -1e-6 ? 1 : (dy >= 0 ? -1 : 1);
  if (k === HAZ.knot || k === HAZ.rail) {
    out.gap = dist - r - SR;
    out.code = out.gap < 0 ? RES.hit : RES.pass;
  } else if (k === HAZ.wall) {
    out.gap = r - dist - SR;
    out.side = -out.side;
    out.code = out.gap < 0 ? RES.hit : RES.pass;
  } else if (k === HAZ.gate) {
    const kr = Hz.w[i];
    const inner = r - kr - dist - SR, outer = dist - r - kr - SR;
    if (inner >= 0) { out.gap = inner; out.code = RES.thread; out.side = -out.side; }
    else if (outer >= 0) { out.gap = outer; out.code = RES.pass; }
    else { out.gap = Math.max(inner, outer); out.code = RES.hit; }
  } else if (k === HAZ.pad) {
    out.gap = dist - r;
    out.code = dist <= r + SR * 0.5 ? RES.pad : RES.pass;
    out.perfect = dist <= r * 0.4;
  } else if (k === HAZ.fork) {
    const bx = px - Hz.x1[i], by = py - Hz.y1[i], db = Math.hypot(bx, by);
    const ga = r - dist - SR, gb = r - db - SR;
    out.taken = ga >= gb ? 1 : 2;
    if (out.taken === 2) { dx = bx; dy = by; dist = db; }
    out.gap = Math.max(ga, gb);
    out.side = dx > 0 ? 1 : -1;
    out.code = out.gap < 0 ? RES.hit : RES.pass;
  } else {
    out.gap = Infinity; out.code = RES.none;
  }
  return out;
}

// Where a rail is across the corridor at jump time t (its front passed at tp, its tail w s later).
function railAt(Hz, i, t, out = PT) {
  const u = clamp((t - Hz.tp[i]) / Math.max(1e-6, Hz.w[i]), 0, 1);
  out[0] = Hz.x[i] + (Hz.x1[i] - Hz.x[i]) * u;
  out[1] = Hz.y[i] + (Hz.y1[i] - Hz.y[i]) * u;
  return out;
}
export { railAt };

// ---------------------------------------------------------------- gains, hits, chain

function gammaOf(J) { return Math.cosh(J.eta); }

function addEta(game, J, x, ev, T, low = true) {
  const JT = T.JUMP;
  // Below TWO NINES every graze counts for more, so a rough start still reaches 0.99c; the third nine takes skill.
  if (low && x > 0 && J.eta < NINE2) x *= JT.LOW_X;
  J.eta = clamp(J.eta + x, JT.ETA_FLOOR, JT.ETA_CAP);
  if (J.eta > J.etaPeak) J.etaPeak = J.eta;
  checkNines(game, J, ev, T);
}

function checkNines(game, J, ev, T) {
  const JT = T.JUMP;
  if (J.eta >= NINE2 && J.nines < 2) {
    J.nines = 2;
    if (ev) ev.push(EV.nine, { n: 2, eta: J.eta });
  }
  if (J.eta >= NINE3 && !J.headlight) {
    J.headlight = true;
    J.headlightT = 0;
    J.skyPunch = 1;
    if (J.nines < 3) {
      J.nines = 3;
      if (ev) ev.push(EV.nine, { n: 3, eta: J.eta });
      slowMo(game, JT.HEADLIGHT_SLOW, JT.HEADLIGHT_T);
    }
    if (ev) ev.push(EV.headlight, { eta: J.eta });
  } else if (J.eta < NINE3 && J.headlight) {
    J.headlight = false;
    J.holdT = 0;
  }
}

function chainOn(J, pts, ev, T) {
  const X = T.PROX, ch = J.chain;
  ch.n++;
  ch.lastT = J.t;
  let mult = 1;
  for (let k = 0; k < X.CHAIN_STEPS.length; k++) if (ch.n >= X.CHAIN_STEPS[k]) mult = X.CHAIN_MULT[k];
  if (mult > ch.mult) { ch.mult = mult; if (ev) ev.push(EV.chainUp, { n: ch.n, mult }); }
  const dense = J.plan.mode === 'dense' && J.t < J.plan.modeUntil ? T.JUMP.DENSE_X : 1;
  const p = pts * ch.mult * (J.headlight ? T.JUMP.HEADLIGHT_X : 1) * dense;
  ch.points += p;
  J.score += p;
}

function chainEnd(J, lost, ev) {
  const ch = J.chain;
  if (ch.n > 0 && ev) {
    if (lost) ev.push(EV.chainLost, { n: ch.n, points: Math.round(ch.points) });
    else ev.push(EV.chainBank, { n: ch.n, mult: ch.mult, points: Math.round(ch.points) });
  }
  ch.n = 0; ch.mult = 1; ch.points = 0; ch.lastT = -99;
}

function addBar(game, x) {
  const s = game.ship;
  if (s) s.bar = clamp(s.bar + x, 0, s.barMax || 1);
}

function inSoft(J, T) { return !!J.soft && J.t < T.JUMP.PUNCH_T + J.soft.s; }

function hit(game, J, i, ev, T) {
  const JT = T.JUMP, Hz = J.haz;
  if (J.flickerT > 0) return false;
  const o = resolveAt(Hz, i, J.pos[0], J.pos[1], T);
  // Pushed away from what you hit (into the gap for a wall).
  let nx = o.nx, ny = o.ny;
  if (Hz.kind[i] === HAZ.wall || Hz.kind[i] === HAZ.fork) { nx = -nx; ny = -ny; }
  if (Hz.kind[i] === HAZ.gate && o.gap < 0) {
    const dd = Math.hypot(J.pos[0] - Hz.x[i], J.pos[1] - Hz.y[i]);
    if (dd < Hz.r[i]) { nx = -nx; ny = -ny; }
  }
  J.vel[0] = nx * JT.HIT_PUSH; J.vel[1] = ny * JT.HIT_PUSH;
  Hz.t[i] = J.t;
  if (inSoft(J, T)) {
    // The soft start: a bump aside, at no cost.
    Hz.res[i] = RES.bump;
    J.bumps++;
    J.flickerT = JT.HIT_FLICKER * 0.5;
    if (ev) ev.push(EV.jHit, { id: Hz.id[i], kind: HAZ_NAMES[Hz.kind[i]], side: o.side, soft: true, eta: J.eta });
    return true;
  }
  Hz.res[i] = RES.hit;
  J.hits++;
  J.lastHitT = J.t;
  J.flickerT = JT.HIT_FLICKER;
  J.eta = Math.max(JT.ETA_FLOOR, J.eta + JT.HIT);
  checkNines(game, J, ev, T);
  if (J.slide) endSlide(J, ev, T, true);
  chainEnd(J, true, ev);
  hitStop(game, JT.HIT_STOP);
  if (ev) ev.push(EV.jHit, { id: Hz.id[i], kind: HAZ_NAMES[Hz.kind[i]], side: o.side, eta: J.eta });
  return true;
}

function graze(game, J, i, o, hair, ev, T) {
  const JT = T.JUMP, Hz = J.haz;
  addEta(game, J, (hair ? JT.G_HAIRLINE : JT.G_GRAZE) * J.gx, ev, T);
  addBar(game, hair ? T.BAR.HAIRLINE : T.BAR.NEAR);
  if (hair) J.hairlines++; else J.grazes++;
  Hz.res[i] = hair ? RES.hairline : RES.graze;
  Hz.t[i] = J.t;
  chainOn(J, JT.PTS_GRAZE * gammaOf(J) * (hair ? JT.HAIR_X : 1), ev, T);
  if (ev) {
    ev.push(hair ? EV.jHairline : EV.jGraze, { id: Hz.id[i], kind: HAZ_NAMES[Hz.kind[i]], side: o.side,
      gap: o.gap, eta: J.eta, phi: J.eta, x: -o.nx, y: -o.ny });
  }
}

function thread(game, J, i, ev, T, kind = 'gate') {
  const JT = T.JUMP, Hz = J.haz;
  const big = i >= 0 && Hz.tag[i] > 0 && J.pieces[Hz.tag[i] - 1]?.kind === 'gateRing' ? 1.5 : 1;
  addEta(game, J, JT.G_THREAD * J.gx * big, ev, T);
  addBar(game, T.BAR.THREAD);
  J.threads++;
  if (i >= 0) { Hz.res[i] = RES.thread; Hz.t[i] = J.t; }
  chainOn(J, JT.PTS_THREAD * gammaOf(J) * big, ev, T);
  if (ev) ev.push(EV.jThread, { id: i >= 0 ? Hz.id[i] : -1, kind, eta: J.eta, phi: J.eta, big: big > 1, side: 0 });
}

function pad(game, J, i, o, ev, T) {
  const JT = T.JUMP, Hz = J.haz;
  addEta(game, J, JT.G_PAD * J.gx * (o.perfect ? 1.3 : 1), ev, T);
  addBar(game, JT.PAD_BAR);
  J.pads++;
  Hz.res[i] = RES.pad; Hz.t[i] = J.t;
  chainOn(J, JT.PTS_PAD * gammaOf(J), ev, T);
  if (ev) ev.push(EV.jPad, { id: Hz.id[i], perfect: o.perfect, eta: J.eta });
}

// A knot passed close on one side, then another on the other side soon after: a thread.
function knotThread(game, J, o, ev, T) {
  const JT = T.JUMP, lk = J.lastKnot;
  if (o.gap > JT.THREAD_GAP) return;
  if (J.t - lk.t <= JT.THREAD_T && o.nx * lk.nx + o.ny * lk.ny < -0.3) {
    thread(game, J, -1, ev, T, 'knots');
    lk.t = -99;
    return;
  }
  lk.t = J.t; lk.nx = o.nx; lk.ny = o.ny;
}

// The pass: hazard i's front reached the ship this step, at (px, py) across the corridor.
function pass(game, J, i, px, py, ev, T) {
  const JT = T.JUMP, Hz = J.haz;
  const o = resolveAt(Hz, i, px, py, T);
  const kind = Hz.kind[i];
  const band = inSoft(J, T) ? JT.GRAZE * J.soft.grazeX : JT.GRAZE;
  if (kind === HAZ.fork) {
    const taken = o.taken === 2 ? 'b' : 'a';
    J.fork.taken = taken;
    J.plan.mode = taken === 'b' ? 'dense' : 'calm';
    J.plan.modeUntil = J.t + JT.FORK_SPAN * J.L;
    J.fork.until = J.plan.modeUntil;
    if (ev) ev.push(EV.fork, { taken, label: taken === 'b' ? J.fork.b : J.fork.a });
  }
  if (o.code === RES.hit) {
    if (J.flickerT > 0) { Hz.res[i] = RES.pass; return; }
    hit(game, J, i, ev, T);
    return;
  }
  if (o.code === RES.thread) { thread(game, J, i, ev, T, Hz.tag[i] ? 'piece' : 'gate'); return; }
  if (o.code === RES.pad) { pad(game, J, i, o, ev, T); return; }
  if (kind === HAZ.pad) { Hz.res[i] = RES.pass; return; }
  if (o.gap < band) graze(game, J, i, o, o.gap < JT.HAIRLINE, ev, T);
  else Hz.res[i] = RES.pass;
  if (kind === HAZ.knot) knotThread(game, J, o, ev, T);
}

// ---------------------------------------------------------------- the slide (the drift here)

function endSlide(J, ev, T, lost = false) {
  const JT = T.JUMP, D = T.DRIFT;
  const tier = J.tier;
  J.slide = false; J.slideAuto = false; J.exitT = 0;
  if (tier > 0 && !lost) {
    J.dbT = D.DB_DUR[tier - 1];
    J.eta = clamp(J.eta + JT.G_DB[tier - 1] * J.gx, JT.ETA_FLOOR, JT.ETA_CAP);
    if (J.eta > J.etaPeak) J.etaPeak = J.eta;
    if (ev) ev.push(EV.driftBoost, { tier, speed: J.speed, jump: true });
  } else if (tier > 0 && lost && ev) ev.push(EV.driftLost, { tier, why: 'hit' });
  J.charge = 0; J.tier = 0;
}

// ---------------------------------------------------------------- the corridor step

function steerStep(game, J, inp, dt, ev, T) {
  const JT = T.JUMP, D = T.DRIFT;
  const sdt = game.timeScale > 0 ? H : 0;        // you steer in real time in slow motion; hit-stop holds all
  let sx = inp.steer, sy = inp.climb + (inp.source === 'keys' ? inp.gas - inp.brake : 0);
  sy = clamp(sy, -1, 1);
  const m = Math.hypot(sx, sy);
  if (m > 1) { sx /= m; sy /= m; }
  const mag = Math.min(1, m);
  // Slide: hold drift with the stick over, or (touch) hold a hard push.
  if (!J.slide) {
    if (inp.drift && mag >= D.MIN_STEER) {
      J.slide = true; J.slideAuto = false; J.charge = 0; J.tier = 0;
      if (ev) ev.push(EV.driftStart, { dir: sx >= 0 ? 1 : -1, auto: false, jump: true });
    } else if (inp.autoDrift && game.settings?.autoDrift !== false && mag >= D.AUTO_STEER) {
      J.autoT += sdt;
      if (J.autoT >= D.AUTO_T * 2) {
        J.slide = true; J.slideAuto = true; J.charge = 0; J.tier = 0;
        if (ev) ev.push(EV.driftStart, { dir: sx >= 0 ? 1 : -1, auto: true, jump: true });
      }
    } else J.autoT = 0;
  } else {
    const out = J.slideAuto ? mag < D.EXIT_STEER : !inp.drift;
    J.exitT = out ? J.exitT + sdt : 0;
    if (!J.slideAuto && !inp.drift) endSlide(J, ev, T);
    else if (J.slideAuto && J.exitT >= D.EXIT_T) endSlide(J, ev, T);
  }
  const rate = JT.LAT_RATE * (J.slide ? JT.SLIDE_X : 1);
  J.prev[0] = J.pos[0]; J.prev[1] = J.pos[1];
  for (let a = 0; a < 2; a++) {
    const tv = (a === 0 ? sx : sy) * rate, v = J.vel[a];
    let k;
    if (J.slide) k = JT.SLIDE_GRIP;
    else k = (tv * v > 0 && Math.abs(tv) >= Math.abs(v)) || (Math.abs(v) < 0.05 && tv !== 0) ? JT.LAT_IN : JT.LAT_OUT;
    J.vel[a] = v + (tv - v) * (1 - Math.exp(-k * sdt));
    J.pos[a] += J.vel[a] * sdt;
  }
  // The tube's wall: a soft edge you slide along.
  const lim = JT.TUBE_R - JT.SHIP_R, rho = Math.hypot(J.pos[0], J.pos[1]);
  if (rho > lim) {
    const nx = J.pos[0] / rho, ny = J.pos[1] / rho;
    J.pos[0] = nx * lim; J.pos[1] = ny * lim;
    const vr = J.vel[0] * nx + J.vel[1] * ny;
    if (vr > 0) { J.vel[0] -= nx * vr * 1.3; J.vel[1] -= ny * vr * 1.3; }
    J.wallT = J.t;
  }
  // The slide's charge: faster the faster you slide across the tube, whichever way (handling 8.3's rule, with the
  // sideways speed in place of the turn rate: weaving builds it too).
  if (J.slide && dt > 0) {
    const vm = Math.hypot(J.vel[0], J.vel[1]);
    J.charge += (D.CHARGE_BASE + D.CHARGE_IN * clamp(vm / JT.LAT_RATE, 0, 1)) * Math.max(D.CHARGE_FLOOR, mag) * dt;
    while (J.tier < 3 && J.charge >= D.TIERS[J.tier]) {
      J.tier++;
      addBar(game, D.TIER_BAR[J.tier - 1]);
      if (ev) ev.push(EV.driftTier, { tier: J.tier, dir: sx >= 0 ? 1 : -1, jump: true });
    }
  }
}

function boostStep(game, J, inp, dt, ev, T) {
  const B = T.BAR, JT = T.JUMP, ship = game.ship;
  if (inp.boostBurst) J.burstT = B.FLICK_BURST;
  J.burstT = Math.max(0, J.burstT - dt);
  const want = inp.boost || J.burstT > 0;
  const can = ship && ship.bar > B.MIN;
  if (want && can) {
    if (!J.boosting) { J.boosting = true; if (ev) ev.push(EV.boostStart, { burst: J.burstT > 0, jump: true }); }
    ship.bar = Math.max(0, ship.bar - B.DRAIN * dt);
    addEta(game, J, JT.G_BOOST * J.gx * dt, ev, T, false);
  } else if (J.boosting) {
    J.boosting = false;
    if (ev) ev.push(EV.boostEnd, { t: J.t, jump: true });
  }
  if (ship) ship.boosting = J.boosting;
}

// Hazards come toward you; each one's front is checked as it reaches you, rails while they run beside you.
function hazardStep(game, J, dt, ev, T) {
  const JT = T.JUMP, Hz = J.haz;
  let skim = false, skimSide = 0;
  const band = JT.GRAZE, t0 = J.t - dt, t1 = J.t;
  for (let i = 0; i < Hz.n; i++) {
    const st = Hz.state[i];
    if (st === 0) continue;
    const tp = Hz.tp[i];
    Hz.d[i] = (tp - t1) * J.speed;
    if (st === 1 && tp <= t1) {
      // Its front reaches you inside this step: check at your place then.
      const f = dt > 0 ? clamp((tp - t0) / dt, 0, 1) : 1;
      const px = J.prev[0] + (J.pos[0] - J.prev[0]) * f, py = J.prev[1] + (J.pos[1] - J.prev[1]) * f;
      Hz.state[i] = 2;
      Hz.t[i] = J.t;
      if (Hz.kind[i] === HAZ.rail) {
        const o = resolveAt(Hz, i, px, py, T);
        if (o.code === RES.hit && J.flickerT <= 0) hit(game, J, i, ev, T);
      } else pass(game, J, i, px, py, ev, T);
    } else if (st === 2 && Hz.kind[i] === HAZ.rail && t1 < tp + Hz.w[i]) {
      // Riding beside a rail: touching it is a hit, keeping within the graze band is a skim.
      const p = railAt(Hz, i, t1);
      const g = Math.hypot(J.pos[0] - p[0], J.pos[1] - p[1]) - Hz.r[i] - JT.SHIP_R;
      if (g < 0) { if (J.flickerT <= 0) hit(game, J, i, ev, T); } else if (g < band) {
        skim = true;
        skimSide = J.pos[0] < p[0] ? 1 : -1;
        if (Hz.res[i] !== RES.hit) Hz.res[i] = RES.skim;
      }
    }
    const tail = Hz.kind[i] === HAZ.rail ? Hz.w[i] : 0;
    if ((tp + tail - t1) * Math.max(J.speed, 1) < -BEHIND) { Hz.state[i] = 0; Hz.live--; }
  }
  if (skim && dt > 0) {
    addEta(game, J, JT.G_SKIM * J.gx * dt, ev, T);
    addBar(game, T.BAR.SKIM * dt);
    J.skimT += dt;
    J.chain.lastT = J.t;
    J.score += JT.PTS_SKIM * gammaOf(J) * dt * J.chain.mult * (J.headlight ? JT.HEADLIGHT_X : 1);
  }
  if (skim !== J.skim) {
    J.skim = skim;
    if (skim && ev) ev.push(EV.jSkim, { side: skimSide, eta: J.eta });
  }
  while (Hz.n > 0 && Hz.state[Hz.n - 1] === 0) Hz.n--;
}

// The proximity whine: how soon your current line meets a hazard, and which way is out.
function dangerStep(J, T) {
  const JT = T.JUMP, Hz = J.haz;
  let best = 0, id = -1, sx = 0, sy = 0;
  const sp = Math.max(1, J.speed);
  for (let i = 0; i < Hz.n; i++) {
    if (Hz.state[i] !== 1 || Hz.kind[i] === HAZ.pad) continue;
    const ttp = Hz.tp[i] - J.t;
    if (ttp <= 0 || ttp > JT.DANGER_T || (best && ttp >= best)) continue;
    const o = resolveAt(Hz, i, J.pos[0], J.pos[1], T);
    if (o.code !== RES.hit) continue;
    best = ttp; id = Hz.id[i];
    const out = Hz.kind[i] === HAZ.wall || Hz.kind[i] === HAZ.fork || (Hz.kind[i] === HAZ.gate
      && Math.hypot(J.pos[0] - Hz.x[i], J.pos[1] - Hz.y[i]) < Hz.r[i]) ? -1 : 1;
    sx = o.nx * out; sy = o.ny * out;
  }
  J.danger = best; J.dangerId = id; J.dangerX = sx; J.dangerY = sy;
  J.dangerSide = id < 0 ? 0 : sx >= 0 ? 1 : -1;
}

// Earth's clock runs from the punch to the arrival; cards come one per CARD_GAP.
function earthStep(game, J, dt, ev, T) {
  const JT = T.JUMP, E = J.earth;
  const remain = J.Lr - J.t;
  E.ahead = remain > 1e-6 ? E.ahead - (E.ahead - E.aheadTo) * Math.min(1, dt / remain) : E.aheadTo;
  if (game.earth) game.earth.aheadLy = E.ahead;
  while (E.next < E.cards.length && E.cards[E.next].ago >= E.ahead) {
    const id = E.cards[E.next++].id;
    E.queue.push(id);
    if (game.earth && !game.earth.cardsShown.includes(id)) game.earth.cardsShown.push(id);
  }
  if (E.queue.length && J.t - E.lastCardT >= JT.CARD_GAP && J.part !== 'dropout') {
    const id = E.queue.shift();
    E.lastCardT = J.t;
    if (ev) ev.push(EV.earthCard, { id });
    const line = J.lines.cards?.[id];
    if (line) say(J, line, T);
    const after = J.lines.after?.[id];
    if (after) say(J, after, T);
  }
}

// Ask the radio for one of Dot's lines (talk.js says them from jump.say): at most DOT_LINES a jump, never within
// 2 s of a hit.
function say(J, id, T) {
  if (!id || J.dotLines >= T.JUMP.DOT_LINES) return;
  J.dotLines++;
  J.pend.push(id);
}
function sayStep(J) {
  if (!J.pend.length || J.t - J.lastHitT < 2) return;
  J.say.push(J.pend.shift());
}

function skyStep(J, dt, T) {
  const JT = T.JUMP;
  if (J.part === 'punch') {
    J.phiSky = JT.ETA_ENTRY * smooth(J.t / JT.PUNCH_SKY_T);
    return;
  }
  if (J.part === 'vista') {
    const base = Math.min(J.eta, JT.SKY_CAP);
    J.phiSky = base + (JT.VISTA_PHI - base) * smooth(J.partT / JT.VISTA_RISE);
    return;
  }
  if (J.part === 'dropout') {
    const u = clamp(J.partT / JT.DROP_S, 0, 1);
    J.phiSky = J.phi0 * Math.pow(1 - u, 3);
    return;
  }
  const base = Math.min(J.eta, JT.SKY_CAP);
  if (J.skyPunch > 0) J.skyPunch = Math.max(J.headlight ? 0.35 : 0, J.skyPunch - dt / JT.SKY_PUNCH_T);
  else if (J.headlight) J.skyPunch = 0.35;
  J.phiSky = base + (JT.SKY_PUNCH - base) * smooth(J.skyPunch);
}

function corridorStep(game, J, inp, dt, ev, T) {
  const JT = T.JUMP;
  J.flickerT = Math.max(0, J.flickerT - dt);
  J.dbT = Math.max(0, J.dbT - dt);
  if (J.part === 'punch') {
    J.eta = JT.ETA_ENTRY * smooth(J.t / JT.PUNCH_SKY_T);
    J.speed = JT.ARRIVE_S + (JT.RUN_S - JT.ARRIVE_S) * smooth(J.t / JT.PUNCH_SKY_T);
  } else {
    if (J.eta > JT.ETA_ENTRY) J.eta = Math.max(JT.ETA_ENTRY, J.eta - JT.DRIFT_BACK * dt);
    J.speed = JT.RUN_S * (1 + JT.RUN_K * (J.eta - JT.ETA_ENTRY));
  }
  J.s += J.speed * dt;
  steerStep(game, J, inp, dt, ev, T);
  if (J.part === 'run') boostStep(game, J, inp, dt, ev, T);
  hazardStep(game, J, dt, ev, T);
  if (J.part === 'punch' || J.part === 'run') spawnStep(game, J, ev, T);
  if (J.part === 'run') {
    checkNines(game, J, ev, T);
    if (J.headlight) { J.holdT += dt; J.headlightT += dt; if (J.holdT > J.holdBest) J.holdBest = J.holdT; }
    if (J.chain.n > 0 && J.t - J.chain.lastT > JT.CHAIN_GAP) chainEnd(J, false, ev);
  }
  dangerStep(J, T);
}

// ---------------------------------------------------------------- the slot

/**
 * stepJump(game, input, dt, ev): game.js's jump slot, run first in runup, punch, tunnel and dropout. In the run-up
 * it watches the launch rings; from the punch it flies the corridor; it ends the jump in 'drive' in the next zone.
 */
export function stepJump(game, input, dt, ev) {
  const J = game.jump;
  if (!J) return;
  const T = game.tune || TUNE, JT = T.JUMP;
  const inp = input;
  if (game.mode === 'runup') { runupStep(game, J, inp, ev, T); return; }
  if (game.mode !== 'punch' && game.mode !== 'tunnel' && game.mode !== 'dropout') return;
  J.t += dt;
  J.partT += dt;

  // Parts by time.
  if (J.part === 'punch' && J.t >= JT.PUNCH_T) {
    setMode(game, 'tunnel', ev);
    J.part = 'run'; J.partT = 0;
    J.eta = Math.max(J.eta, JT.ETA_ENTRY);
    J.etaPeak = Math.max(J.etaPeak, J.eta);
    if (J.lines.early) say(J, J.lines.early, T);
  }
  if (J.part === 'run' && J.t >= J.Lr - 5) {
    // Long haul: the next zone is late, so the run gets another stretch of hazards.
    const data = zoneById(J.to);
    if ((!J.zoneReady && J.longHaul < JT.LONG_HAUL_MAX) || !data) {
      J.longHaul++;
      J.Lr += JT.LONG_HAUL;
      if (ev) ev.push(EV.longHaul, { n: J.longHaul, ready: J.zoneReady });
    }
  }
  if (J.part === 'run' && J.t >= J.Lr - JT.VISTA_AT) {
    J.part = 'vista'; J.partT = 0;
    if (J.boosting) {
      J.boosting = false;
      if (game.ship) game.ship.boosting = false;
      if (ev) ev.push(EV.boostEnd, { t: J.t, jump: true });
    }
    if (J.slide) endSlide(J, ev, T);
    if (J.chain.n > 0) chainEnd(J, false, ev);
    slowMo(game, JT.VISTA_SLOW, JT.VISTA_T);
    if (ev) ev.push(EV.vista, { to: J.to, id: J.id });
    if (J.lines.vista) { J.dotLines = Math.min(J.dotLines, JT.DOT_LINES - 1); say(J, J.lines.vista, T); }
  }
  if (J.part === 'vista' && J.t >= J.Lr - JT.DROP_AT) dropOut(game, J, ev, T);

  if (J.part === 'dropout') {
    skyStep(J, dt, T);
    J.eta = J.phiSky;
    // The stick takes over again once the ring has dissolved.
    if (J.phiSky >= 1) {
      inp.steer = 0; inp.climb = 0; inp.drift = false; inp.boost = false; inp.boostBurst = false;
      inp.gas = 0; inp.brake = 0;
    }
    inp.action = false;
    earthStep(game, J, dt, ev, T);
    sayStep(J);
    if (J.t >= J.Lr - 1e-9) arrive(game, J, ev, T);
    return;
  }
  corridorStep(game, J, inp, dt, ev, T);
  skyStep(J, dt, T);
  earthStep(game, J, dt, ev, T);
  sayStep(J);
}

function dropOut(game, J, ev, T) {
  const JT = T.JUMP;
  J.medal = jumpMedal(J, T);
  J.part = 'dropout'; J.partT = 0;
  J.phi0 = J.phiSky;
  const data = zoneById(J.to);
  setMode(game, 'dropout', ev);
  if (ev) ev.push(EV.drop, { to: J.to, id: J.id, medal: J.medal });
  if (data) {
    enterZone(game, data, { speed: JT.ARRIVE_S, bar: medalBar(J.medal, T) }, ev);
    game.jump = J;          // the enter slot must not drop the jump mid drop-out
  }
}

function arrive(game, J, ev, T) {
  const medal = J.medal || jumpMedal(J, T);
  if (game.earth) game.earth.aheadLy = J.earth.aheadTo;
  const best = game.progress?.jumps?.[J.id];
  if (game.progress && game.progress.jumps) {
    const better = !best || MEDALS.indexOf(medal) > MEDALS.indexOf(best.medal);
    game.progress.jumps[J.id] = {
      medal: better ? medal : best.medal,
      peakEta: Math.max(fin(best?.peakEta), J.etaPeak),
      score: Math.max(fin(best?.score), Math.round(J.score)),
    };
  }
  if (ev) {
    ev.push(EV.jumpMedal, { id: J.id, to: J.to, medal, eta: J.etaPeak, peakEta: J.etaPeak, hits: J.hits,
      grazes: J.grazes + J.hairlines, threads: J.threads, score: Math.round(J.score), longHaul: J.longHaul });
  }
  game.jump = null;
  setMode(game, 'drive', ev);
}

/** The slots for game.js: wire(JUMP_SLOTS) (main.js adds it with FLIGHT and WP4's). */
export const JUMP_SLOTS = Object.freeze({ jump: stepJump });

// ---------------------------------------------------------------- reading the run (render, HUD, hook)

/** The run's progress 0..1 from the punch to the arrival. */
export const jumpProgress = (J) => (J ? clamp(J.t / Math.max(1, J.Lr), 0, 1) : 0);

/** A cluster ring's galaxies: how many, and where the k-th sits (out = [x, y]). */
export function gateKnots(Hz, i) { return Hz.tag[i] ? 12 : 8; }
export function gateKnotAt(Hz, i, k, out = [0, 0]) {
  const n = gateKnots(Hz, i), a = (k / n) * 2 * Math.PI + Hz.id[i] * 0.7;
  out[0] = Hz.x[i] + Math.cos(a) * Hz.r[i];
  out[1] = Hz.y[i] + Math.sin(a) * Hz.r[i];
  return out;
}

// ---------------------------------------------------------------- bots

// Upcoming hazards for a plan: [{ i, ttp }] sorted by time to pass, and the rails beside you now.
function upcoming(J, horizon) {
  const Hz = J.haz, out = [];
  for (let i = 0; i < Hz.n; i++) {
    if (Hz.state[i] !== 1) continue;
    const ttp = Hz.tp[i] - J.t;
    if (ttp > 0 && ttp <= horizon) out.push({ i, ttp });
  }
  out.sort((a, b) => a.ttp - b.ttp);
  return out;
}

// Group hazards that pass within 0.15 s of each other: they must be planned together.
function slices(list) {
  const out = [];
  for (const it of list) {
    const last = out[out.length - 1];
    if (last && it.ttp - last.ttp < 0.15) last.items.push(it.i);
    else out.push({ ttp: it.ttp, items: [it.i] });
  }
  return out;
}

// Points worth aiming at for a slice, for gaps g wanted from the edges.
function candidates(J, items, gaps, T) {
  const Hz = J.haz, SR = T.JUMP.SHIP_R, out = [[J.pos[0], J.pos[1]], [0, 0]];
  const rnd = (Hz.id[items[0]] * 0.618) % 1;
  const ring = (cx, cy, rad) => {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 2 * Math.PI + rnd * 0.5;
      out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    const dx = J.pos[0] - cx, dy = J.pos[1] - cy, l = Math.hypot(dx, dy);
    if (l > 1e-3) out.push([cx + (dx / l) * rad, cy + (dy / l) * rad]);
  };
  for (const i of items) {
    const k = Hz.kind[i], r = Hz.r[i];
    if (k === HAZ.knot) for (const g of gaps) ring(Hz.x[i], Hz.y[i], r + SR + g);
    else if (k === HAZ.wall) {
      out.push([Hz.x[i], Hz.y[i]]);
      for (const g of gaps) if (r - SR - g > 0) ring(Hz.x[i], Hz.y[i], r - SR - g);
    }
    else if (k === HAZ.gate) { out.push([Hz.x[i], Hz.y[i]]); ring(Hz.x[i], Hz.y[i], r + Hz.w[i] + SR + 1.2); }
    else if (k === HAZ.pad) out.push([Hz.x[i], Hz.y[i]]);
    else if (k === HAZ.fork) { out.push([Hz.x[i], Hz.y[i]]); out.push([Hz.x1[i], Hz.y1[i]]); }
    else if (k === HAZ.rail) {
      const p = Hz.state[i] === 2 ? railAt(Hz, i, J.t + 0.25, [0, 0]) : [Hz.x[i], Hz.y[i]];
      for (const g of [0.5, 0.9]) ring(p[0], p[1], r + SR + g);
    }
  }
  return out;
}

// What a point is worth at a slice, for a bot with these values.
function worth(J, items, px, py, T, val) {
  const JT = T.JUMP, lim = JT.TUBE_R - JT.SHIP_R - 0.15;
  if (Math.hypot(px, py) > lim) return val.hit;
  const Hz = J.haz;
  let v = 0;
  for (const i of items) {
    if (Hz.kind[i] === HAZ.rail && Hz.state[i] === 2) {
      const p = railAt(Hz, i, J.t + 0.25, BOT_PT);
      const g = Math.hypot(px - p[0], py - p[1]) - Hz.r[i] - JT.SHIP_R;
      v += g < 0.15 ? val.hit * 0.6 : g < JT.GRAZE - 0.2 ? val.skim : 0;
      continue;
    }
    const o = resolveAt(Hz, i, px, py, T, BOT_OUT);
    if (o.code === RES.hit) { v += val.hit * (Hz.kind[i] === HAZ.rail ? 0.6 : 1); continue; }
    if (o.code === RES.thread) v += Hz.tag[i] ? val.thread * 2 : val.thread;
    else if (o.code === RES.pad) v += val.pad;
    else if (Hz.kind[i] === HAZ.rail) v += o.gap < JT.GRAZE ? val.skim : 0;
    else if (Hz.kind[i] === HAZ.pad) v += 0;
    else if (o.gap < JT.HAIRLINE) v += val.hair;
    else if (o.gap < JT.GRAZE) v += val.graze;
    else v += Math.min(o.gap, 4) * val.margin;
    if (Hz.kind[i] === HAZ.fork && o.taken === 2) v += val.dense || 0;
  }
  return v;
}
const BOT_OUT = { code: 0, gap: 0, side: 1, nx: 0, ny: 0, taken: 0, perfect: false };
const BOT_PT = [0, 0];

// Rails beside you now: any point across them costs a hit; points in their band skim.
function railTerm(J, px, py, T, val) {
  const Hz = J.haz, JT = T.JUMP;
  let v = 0;
  for (let i = 0; i < Hz.n; i++) {
    if (Hz.state[i] !== 2 || Hz.kind[i] !== HAZ.rail || J.t >= Hz.tp[i] + Hz.w[i]) continue;
    const p = railAt(Hz, i, J.t + 0.15, [0, 0]);
    const g0 = Math.hypot(J.pos[0] - p[0], J.pos[1] - p[1]);
    const g = Math.hypot(px - p[0], py - p[1]) - Hz.r[i] - JT.SHIP_R;
    // Crossing the rail's line costs a hit.
    const cross = ((J.pos[0] - p[0]) * (px - p[0]) + (J.pos[1] - p[1]) * (py - p[1])) < 0 && g0 < 4;
    if (g < 0 || cross) v += val.hit * 0.6;
    else if (g < JT.GRAZE) v += val.skim;
  }
  return v;
}

// A rail running beside you now, or −1.
function ridingRail(J) {
  const Hz = J.haz;
  for (let i = 0; i < Hz.n; i++) {
    if (Hz.state[i] === 2 && Hz.kind[i] === HAZ.rail && J.t < Hz.tp[i] + Hz.w[i] - 0.25) return i;
  }
  return -1;
}

// Rails still ahead: a move that crosses one's line while it runs beside you costs a hit.
function crossTerm(J, list, tArrive, px, py, T, val) {
  const Hz = J.haz, JT = T.JUMP;
  let v = 0;
  for (const it of list) {
    const i = it.i;
    if (Hz.kind[i] !== HAZ.rail || it.ttp > tArrive + 0.05) continue;
    // The rail's start: does the move from here to (px, py) pass through it?
    const ax = J.pos[0], ay = J.pos[1], bx = px - ax, by = py - ay, l2 = bx * bx + by * by;
    const u = l2 > 1e-9 ? clamp(((Hz.x[i] - ax) * bx + (Hz.y[i] - ay) * by) / l2, 0, 1) : 0;
    const g = Math.hypot(ax + bx * u - Hz.x[i], ay + by * u - Hz.y[i]) - Hz.r[i] - JT.SHIP_R - 0.3;
    if (g < 0) v += val.hit * 0.6;
  }
  return v;
}

/**
 * JUMP_BOTS: still, mid, expert and thumb (one axis, for a touch player who never climbs). Each make(opts) →
 * { next(game) → InputRecord }. They plan over the next two passes with the game's own pass check, then steer at
 * the planned point with the rate stick. In the run-up they steer through the launch rings.
 */
function plannerBot(cfg) {
  return (opts = {}) => {
    const rng = mulberry32(hashSeed('jump-bot', cfg.name, opts.seed ?? 1));
    const gauss = () => {
      const u = Math.max(1e-9, rng()), v = rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const rec = { steer: 0, climb: 0, gas: 0, brake: 0, drift: false, boost: false, boostBurst: false, action: false,
      actionHeld: 0, lookBack: false, map: false, pause: false, autoDrift: false, source: cfg.source || 'pad' };
    let target = null, key = -1, nextPlan = 0, err = [0, 0], boosting = false, lapse = new Set();
    const decided = new Map();
    // A hazard's choices are made once, the first time the bot looks at it (a rail it rides can be new).
    const decide = (id) => {
      let d = decided.get(id);
      if (!d) {
        d = { greedy: rng() < cfg.greed, hair: rng() < cfg.hair, e: [gauss(), gauss()] };
        decided.set(id, d);
        if (rng() < cfg.lapse) lapse.add(id);
      }
      return d;
    };
    const next = (game) => {
      rec.steer = 0; rec.climb = 0; rec.gas = 0; rec.brake = 0; rec.drift = false; rec.boost = false;
      rec.boostBurst = false; rec.action = false;
      const J = game.jump;
      if (!J) return rec;
      const T = game.tune || TUNE, JT = T.JUMP;
      if (game.mode === 'runup') return runupBot(game, J, rec);
      if (game.mode !== 'tunnel' && game.mode !== 'punch') return rec;
      if (cfg.still) return rec;
      // Plan.
      if (J.t >= nextPlan || target === null) {
        nextPlan = J.t + cfg.react;
        const list = upcoming(J, cfg.horizon).filter((x) => !lapse.has(J.haz.id[x.i]));
        for (const x of list) decide(J.haz.id[x.i]);
        const sl = slices(list.filter((x) => !lapse.has(J.haz.id[x.i])));
        // Riding beside a rail with nothing else close: follow it.
        const beside = ridingRail(J);
        if (beside >= 0 && (!sl.length || sl[0].ttp > 0.5)) sl.unshift({ ttp: 0.2, items: [beside], ride: true });
        if (sl.length) {
          const s0 = sl[0], s1 = sl[1];
          const d0 = decide(J.haz.id[s0.items[0]]);
          const gaps0 = d0.greedy ? (d0.hair ? [cfg.hairGap, 0.9] : [0.9]) : [cfg.safe];
          const c0 = candidates(J, s0.items, gaps0, T);
          let best = -Infinity, bestP = c0[0];
          const reach = (dt) => JT.LAT_RATE * cfg.thumb * Math.max(0, dt - cfg.settle) + 0.3;
          for (const p of c0) {
            const dist = Math.hypot(p[0] - J.pos[0], p[1] - J.pos[1]);
            let v = worth(J, s0.items, p[0], p[1], T, cfg.val) - dist * cfg.move + railTerm(J, p[0], p[1], T, cfg.val)
              + crossTerm(J, list, s0.ttp, p[0], p[1], T, cfg.val);
            if (dist > reach(s0.ttp)) v += cfg.val.late;
            if (s1) {
              const d1 = decide(J.haz.id[s1.items[0]]);
              const gaps1 = d1.greedy ? [0.9] : [cfg.safe];
              let b1 = -Infinity;
              for (const q of candidates(J, s1.items, gaps1, T)) {
                const dq = Math.hypot(q[0] - p[0], q[1] - p[1]);
                let w = worth(J, s1.items, q[0], q[1], T, cfg.val) - dq * cfg.move;
                if (dq > reach(s1.ttp - s0.ttp)) w += cfg.val.late;
                if (w > b1) b1 = w;
              }
              v += 0.7 * b1;
            }
            if (v > best) { best = v; bestP = p; }
          }
          const k = J.haz.id[s0.items[0]];
          if (k !== key) { key = k; err = d0.e; }
          target = [bestP[0] + err[0] * cfg.err, bestP[1] + err[1] * cfg.err];
        } else target = [J.pos[0] * 0.98, J.pos[1] * 0.98];
      }
      // Steer at the target with the rate stick.
      const dx = target[0] - J.pos[0], dy = target[1] - J.pos[1];
      let sx = (dx / cfg.tau - J.vel[0] * cfg.damp) / JT.LAT_RATE;
      let sy = (dy / cfg.tau - J.vel[1] * cfg.damp) / JT.LAT_RATE;
      if (cfg.oneAxis) sy = 0;
      const m = Math.hypot(sx, sy);
      if (m > 1) { sx /= m; sy /= m; }
      rec.steer = sx; rec.climb = sy;
      // Slide on long moves, let go near the target.
      if (cfg.slide) {
        const far = Math.hypot(dx, dy);
        if (J.slide) rec.drift = far > 1.2 && J.tier < 3;
        else rec.drift = far > cfg.slide && m > 0.6;
      }
      // Boost.
      const bar = game.ship?.bar ?? 0;
      if (cfg.boostAt >= 0) {
        if (!boosting && bar >= cfg.boostAt) boosting = true;
        if (boosting && bar < cfg.boostEnd) boosting = false;
        rec.boost = boosting && J.part === 'run';
      }
      return rec;
    };
    return { next, name: cfg.name };
  };
}

// The run-up: pure pursuit at the next launch ring, at its height, steering the travel line (the nose leads it in
// a slide, so aiming the nose misses).
function runupBot(game, J, rec) {
  const R = J.runup, ship = game.ship;
  const v = ship.vel, travel = Math.hypot(v[0], v[1]) > 1 ? Math.atan2(v[0], v[1]) : ship.yaw;
  if (R.wait || !R.placed) {
    const off = wrap(Math.atan2(R.dir[0], R.dir[1]) - travel);
    rec.steer = clamp(off * 2, -1, 1);
    return rec;
  }
  const c = R.rings[Math.min(2, R.done)];
  const dx = c[0] - ship.pos[0], dy = c[1] - ship.pos[1], dz = c[2] - ship.pos[2];
  const want = Math.atan2(dx, dy);
  rec.steer = clamp(wrap(want - travel) * 3, -1, 1);
  rec.climb = clamp(dz * 0.3 - (ship.pitch || 0) * 2, -1, 1);
  return rec;
}

const VAL_MID = { hit: -100, hair: 2.5, graze: 1.5, thread: 6, pad: 3, skim: 2, late: -40, margin: 0, dense: 0.5 };
const VAL_EXPERT = { hit: -100, hair: 3, graze: 1.5, thread: 7, pad: 3.5, skim: 3, late: -60, margin: 0, dense: 1 };
export const JUMP_BOTS = Object.freeze({
  still: plannerBot({ name: 'still', still: true }),
  // The handling doc's mid player: a quarter-second to react, aims half a unit off, greedy half the time, boosts a
  // half bar.
  mid: plannerBot({ name: 'mid', react: 0.25, horizon: 1.9, err: 0.5, greed: 0.5, hair: 0.15, hairGap: 0.3, lapse: 0.07,
    safe: 2.6, thumb: 0.75, settle: 0.12, move: 0.03, tau: 0.14, damp: 0.08, val: VAL_MID, boostAt: 0.5,
    boostEnd: 0.15, slide: 0 }),
  // An expert: quick, accurate, greedy, threads every ring, slides on long moves and boosts early.
  expert: plannerBot({ name: 'expert', react: 0.12, horizon: 2.2, err: 0.12, greed: 0.92, hair: 0.45, hairGap: 0.4,
    lapse: 0,
    safe: 2.6, thumb: 0.9, settle: 0.06, move: 0.015, tau: 0.1, damp: 0.06, val: VAL_EXPERT, boostAt: 0.3,
    boostEnd: 0.05, slide: 7 }),
  // A touch player who only steers left and right.
  thumb: plannerBot({ name: 'thumb', react: 0.25, horizon: 1.9, err: 0.6, greed: 0.4, hair: 0.1, hairGap: 0.3,
    lapse: 0.07,
    safe: 2.6, thumb: 0.7, settle: 0.12, move: 0.03, tau: 0.14, damp: 0.08, val: VAL_MID, boostAt: -1,
    boostEnd: 0, slide: 0, oneAxis: true, source: 'touch' }),
});
