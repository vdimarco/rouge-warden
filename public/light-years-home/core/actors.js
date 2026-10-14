// Light Years Home v3: actors (final.md 4.3, 8.1): the ships and things that move with a mind of their own. At most 8.
// Kinds: towable (the Pelican: holds, sinks toward a well, is hooked and towed by ship.js stepTow), pursuer (a Magpie
// diving at a target), runner (a thief on a looped path or a road; Cruise slows it when far ahead and when you are on
// its tail, so a ram always lands), racer (Vela: idle, fly-by, race), faller (D100 along its path), blob (a jet blob)
// and item (a tossed chart, pod or crate to drive through). ship.js collides with actors (rc, r, spinT, ghost) and
// turns side hits into takedowns; here a runner with takedownAny is also taken down by any contact closing at that
// speed or more, caught just before the touch so the ram never reads as a crash.
import { addBar, chainEvent, POINTS, shipForward } from './ship.js';
import { hitStop, zoneOf } from './game.js';

export const KINDS = Object.freeze(['towable', 'pursuer', 'runner', 'racer', 'faller', 'blob', 'item']);
export const MAX_ACTORS = 8;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const num = (x, d = 0) => (typeof x === 'number' && x === x && x !== Infinity && x !== -Infinity ? x : d);

const TOSS_T = 0.35;          // s before a tossed item can be caught
const ITEM_DRIFT = 4;         // u/s an item tumbles at once it settles
const ITEM_SETTLE = 1.6;      // per s: how fast a toss eases to the drift
const SOFT_TAIL = 10;         // u: Cruise's runner tires when you are this close behind, so a ram lands
const BOLT_T = 1.8;           // s a clipping runner bolts, untouchable
const BOLT_KICK = 30;         // u/s over the Tern's speed when it bursts out
const JOIN_R = 6;             // u: a runner joins its path this close to it
const FLEE_T = 4;             // s a beaten runner flees before it goes
const SPIN_RATE = 9;          // rad/s while spinning out
const KNOCK = 0.06;           // s of hit-stop on a takedown ram
const RAM_CRUISE = 1.2;       // u a ram reaches past the colliders in Cruise
const RAM_PILOT = 0.15;

const clone = (v) => (Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v)
  .map(([k, x]) => [k, clone(x)])) : v);

// ---------------------------------------------------------------- paths

// A polyline (looped or not) resampled every STEP u, cached by its points (actors keep the points in their data).
const STEP = 2;
const TRACKS = new Map();
export function trackOf(pts, loop = false) {
  const key = `${loop ? 'L' : 'O'}${pts.map((p) => `${p[0]},${p[1]},${p[2] || 0}`).join(';')}`;
  let tr = TRACKS.get(key);
  if (tr) return tr;
  const P = pts.map((p) => [p[0], p[1], p[2] || 0]);
  if (loop) P.push(P[0]);
  const xs = [], ys = [], zs = [], cum = [];
  let acc = 0;
  xs.push(P[0][0]); ys.push(P[0][1]); zs.push(P[0][2]); cum.push(0);
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(d / STEP));
    for (let k = 1; k <= n; k++) {
      const f = k / n;
      xs.push(a[0] + (b[0] - a[0]) * f); ys.push(a[1] + (b[1] - a[1]) * f); zs.push(a[2] + (b[2] - a[2]) * f);
      cum.push(acc + d * f);
    }
    acc += d;
  }
  // Round the corners: three passes of a small moving average (the ends of an open path stay put).
  for (let pass = 0; pass < 3; pass++) {
    const n = xs.length;
    const nx = xs.slice(), ny = ys.slice();
    for (let i = 0; i < n; i++) {
      if (!loop && (i === 0 || i === n - 1)) continue;
      const a = loop ? (i - 1 + n - 1) % (n - 1) : i - 1, b = loop ? (i + 1) % (n - 1) : i + 1;
      nx[i] = (xs[a] + 2 * xs[i] + xs[b]) / 4; ny[i] = (ys[a] + 2 * ys[i] + ys[b]) / 4;
    }
    for (let i = 0; i < n; i++) { xs[i] = nx[i]; ys[i] = ny[i]; }
    if (loop) { xs[n - 1] = xs[0]; ys[n - 1] = ys[0]; }
  }
  // Arc length after smoothing.
  cum[0] = 0;
  for (let i = 1; i < xs.length; i++) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1], zs[i] - zs[i - 1]);
  tr = { loop, n: xs.length, L: cum[cum.length - 1], x: Float64Array.from(xs), y: Float64Array.from(ys),
    z: Float64Array.from(zs), cum: Float64Array.from(cum) };
  TRACKS.set(key, tr);
  return tr;
}

/** trackAt(tr, s, out) → out = [x, y, z] at arc length s (wrapped on a loop, clamped otherwise); out[3] = heading. */
export function trackAt(tr, s, out) {
  let u = s;
  if (tr.loop) u = ((s % tr.L) + tr.L) % tr.L;
  else u = clamp(s, 0, tr.L);
  let lo = 0, hi = tr.n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr.cum[m] <= u) lo = m; else hi = m; }
  const seg = tr.cum[hi] - tr.cum[lo] || 1;
  const f = (u - tr.cum[lo]) / seg;
  out[0] = tr.x[lo] + (tr.x[hi] - tr.x[lo]) * f;
  out[1] = tr.y[lo] + (tr.y[hi] - tr.y[lo]) * f;
  out[2] = tr.z[lo] + (tr.z[hi] - tr.z[lo]) * f;
  if (out.length > 3) out[3] = Math.atan2(tr.x[hi] - tr.x[lo], tr.y[hi] - tr.y[lo]);
  return out;
}

/** nearestOn(tr, pos) → the arc length of the track point nearest pos (in the plane). */
export function nearestOn(tr, pos) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < tr.n; i++) {
    const dx = tr.x[i] - pos[0], dy = tr.y[i] - pos[1];
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  return tr.cum[best];
}

// ---------------------------------------------------------------- spawn

/** actorById(game, id) → the actor or null. */
export function actorById(game, id) {
  const list = game.actors;
  for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
  return null;
}

/**
 * spawn(game, spec) → id. spec: { id, kind, pos | at, heading, speed, ...kind fields } (final.md 8.2's spawn specs).
 * An actor with the same id is replaced. Past MAX_ACTORS the oldest item or fleeing actor makes room.
 */
export function spawn(game, spec, ev = null) {
  const kind = KINDS.includes(spec.kind) ? spec.kind : 'item';
  const id = spec.id || `${kind}-${game.actors.length}`;
  despawn(game, id);
  if (game.actors.length >= MAX_ACTORS) {
    const k = game.actors.findIndex((a) => a.kind === 'item' || a.state === 'fleeing' || a.state === 'gone');
    game.actors.splice(k >= 0 ? k : 0, 1);
  }
  const ship = game.ship;
  const data = clone(spec);
  const heading = num(spec.heading, NaN);
  const a = {
    id, kind, pos: [0, 0, 0], vel: [0, 0, 0], yaw: Number.isFinite(heading) ? heading * DEG : ship.yaw,
    speed: num(spec.speed, 0), state: spec.state || 'idle', hits: 0, spinT: 0, t: 0, s: 0, mode: 'idle',
    rc: num(spec.rc, kind === 'item' ? 0 : kind === 'towable' ? 1.4 : 0.6), r: num(spec.r, kind === 'towable' ? 2 : 1),
    label: spec.label || null, hull: spec.hull || null, ghost: false, data,
  };
  const p = spec.pos || spec.idleAt;
  if (Array.isArray(p)) { a.pos[0] = num(p[0]); a.pos[1] = num(p[1]); a.pos[2] = num(p[2]); }
  if (kind === 'runner') placeRunner(game, a, spec);
  if (kind === 'racer' && Number.isFinite(spec.idleHeading)) a.yaw = spec.idleHeading * DEG;
  if (kind === 'faller' && Array.isArray(spec.path)) {
    const tr = trackOf(spec.path, false);
    trackAt(tr, 0, a.pos);
    a.speed = num(spec.idleSpeed, 4);
  }
  a.vel[0] = Math.sin(a.yaw) * a.speed; a.vel[1] = Math.cos(a.yaw) * a.speed;
  game.actors.push(a);
  if (ev && kind !== 'item') ev.push('ringSeen', { id: `actor:${id}` });
  return id;
}

// A runner starts on its path (at: 'node0' means the path's start), or orAhead u in front of the ship when the ship
// is far from there; with clip, a ship near the start sees it burst out beside it and bolt past.
function placeRunner(game, a, spec) {
  const ship = game.ship;
  const tr = spec.path ? trackOf(spec.path, !!spec.loop) : null;
  a.mode = 'loop';
  if (!tr) return;
  const p0 = [0, 0, 0, 0];
  trackAt(tr, 0, p0);
  const far = Math.hypot(ship.pos[0] - p0[0], ship.pos[1] - p0[1]);
  const fx = Math.sin(ship.yaw), fy = Math.cos(ship.yaw);
  if (spec.clip && far <= 150) {
    // Out of Node 0's traffic: just behind the Tern's shoulder, faster, so it whips past close (a NEAR) and bolts.
    // It cannot be rammed while it bolts (BOLT_T): it comes out about 25 u ahead and the chase is on.
    const side = 2.6;
    a.pos[0] = ship.pos[0] - fx * 8 + fy * side; a.pos[1] = ship.pos[1] - fy * 8 - fx * side; a.pos[2] = ship.pos[2];
    a.yaw = ship.yaw;
    a.speed = ship.speed + BOLT_KICK;
    a.mode = 'bolt';
    a.ghost = true;
  } else if (Number.isFinite(spec.orAhead) && far > 150) {
    a.pos[0] = ship.pos[0] + fx * spec.orAhead; a.pos[1] = ship.pos[1] + fy * spec.orAhead; a.pos[2] = ship.pos[2];
    a.yaw = ship.yaw;
    a.speed = num(spec.speed, 27);
    a.mode = 'join';
  } else {
    a.pos[0] = p0[0]; a.pos[1] = p0[1]; a.pos[2] = p0[2];
    a.yaw = p0[3];
    a.s = 0;
    a.speed = num(spec.speed, 27);
  }
  a.data.join = a.mode === 'loop' ? 0 : nearestAhead(tr, a.pos, a.yaw);
}

// The arc length of a path point near pos and ahead of the heading (so a joining runner does not turn back).
function nearestAhead(tr, pos, yaw) {
  const fx = Math.sin(yaw), fy = Math.cos(yaw);
  let best = 0, bd = Infinity;
  for (let i = 0; i < tr.n; i++) {
    const dx = tr.x[i] - pos[0], dy = tr.y[i] - pos[1];
    const d = Math.hypot(dx, dy);
    const ahead = (dx * fx + dy * fy) / (d || 1);
    const cost = d * (ahead > 0.2 ? 1 : 3) + (d < 25 ? 60 : 0);
    if (cost < bd) { bd = cost; best = i; }
  }
  return tr.cum[best];
}

/** despawn(game, id) → true when it was there. A towed actor lets go first. */
export function despawn(game, id) {
  const k = game.actors.findIndex((a) => a && a.id === id);
  if (k < 0) return false;
  if (game.ship.tow && game.ship.tow.actor === id) game.ship.tow = null;
  game.actors.splice(k, 1);
  return true;
}

/**
 * tossItem(game, id, from, opts, ev) → id: an item (the chart, a pod, the lens crate) thrown out of an actor or a
 * point. It flies on with the thrower's motion plus a sideways kick, then settles to a slow tumble.
 */
export function tossItem(game, id, from, { along = null, side = 0, speed = 18, kick = 8, label = null } = {}, ev = null) {
  spawn(game, { id, kind: 'item', pos: from, rc: 0, r: 1.2, label }, null);
  const it = actorById(game, id);
  const fx = along ? along[0] : Math.sin(game.ship.yaw), fy = along ? along[1] : Math.cos(game.ship.yaw);
  const l = Math.hypot(fx, fy) || 1;
  const ux = fx / l, uy = fy / l;
  const sg = side || 1;
  it.vel[0] = ux * speed + uy * kick * sg;
  it.vel[1] = uy * speed - ux * kick * sg;
  it.yaw = Math.atan2(it.vel[0], it.vel[1]);
  it.state = 'tossed';
  it.speed = Math.hypot(it.vel[0], it.vel[1]);
  return id;
}

// ---------------------------------------------------------------- the step

const P = [0, 0, 0, 0];
const NOSE = [0, 1, 0];

function moveToward(a, tx, ty, tz, speed, turnRate, dt) {
  const want = Math.atan2(tx - a.pos[0], ty - a.pos[1]);
  const d = wrap(want - a.yaw);
  const m = turnRate * dt;
  a.yaw = wrap(a.yaw + clamp(d, -m, m));
  a.speed = speed;
  a.vel[0] = Math.sin(a.yaw) * speed; a.vel[1] = Math.cos(a.yaw) * speed;
  a.vel[2] = clamp(tz - a.pos[2], -4, 4);
  a.pos[0] += a.vel[0] * dt; a.pos[1] += a.vel[1] * dt; a.pos[2] += a.vel[2] * dt;
}

/** stepActors(game, dt, ev): game.js's actors slot. */
export function stepActors(game, dt, ev) {
  const list = game.actors;
  // ship.js's side-hit takedowns this step: a Magpie spins out and flees, a carrier drops what it carries.
  if (ev && ev.list) {
    let i = ev.n - 1;
    while (i >= 0 && ev.list[i] && ev.list[i].t === game.t) i--;
    for (let j = i + 1; j < ev.n; j++) {
      const e = ev.list[j];
      if (e.type !== 'takedown' || e.ram) continue;
      const a = actorById(game, e.id);
      if (!a || a.state === 'beaten' || a.state === 'fleeing') continue;
      if (a.kind === 'runner' || a.kind === 'pursuer') beat(game, a, e.side || 1, ev);
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    if (!a) continue;
    a.t += dt;
    if (a.spinT > 0) a.spinT = Math.max(0, a.spinT - dt);
    switch (a.kind) {
      case 'runner': stepRunner(game, a, dt, ev); break;
      case 'item': stepItem(a, dt); break;
      case 'towable': stepTowable(game, a, dt, ev); break;
      case 'pursuer': stepPursuer(game, a, dt, ev); break;
      case 'racer': stepRacer(game, a, dt); break;
      case 'faller': stepFaller(game, a, dt); break;
      case 'blob': a.pos[0] += a.vel[0] * dt; a.pos[1] += a.vel[1] * dt; break;
      default: break;
    }
    if (a.state === 'gone') list.splice(i, 1);
  }
  if (dt > 0) rams(game, ev);
}

function stepRunner(game, a, dt, ev) {
  const spec = a.data;
  if (a.state === 'beaten' || a.state === 'fleeing') {
    // Spun out, then flees out of the zone and is gone.
    a.state = 'fleeing';
    if (a.spinT > 0) {
      a.yaw = wrap(a.yaw + SPIN_RATE * dt);
      a.speed *= Math.exp(-2 * dt);
    } else {
      a.speed = Math.min(40, a.speed + 20 * dt);
      const away = Math.atan2(a.pos[0] - game.ship.pos[0], a.pos[1] - game.ship.pos[1]);
      a.yaw = wrap(a.yaw + clamp(wrap(away - a.yaw), -2 * dt, 2 * dt));
    }
    if (a.spinT <= 0) { a.vel[0] = Math.sin(a.yaw) * a.speed; a.vel[1] = Math.cos(a.yaw) * a.speed; }
    a.pos[0] += a.vel[0] * dt; a.pos[1] += a.vel[1] * dt;
    a.data.fleeT = num(a.data.fleeT) + dt;
    if (a.data.fleeT > FLEE_T) a.state = 'gone';
    return;
  }
  const tr = spec.path ? trackOf(spec.path, !!spec.loop) : null;
  if (!tr) return;
  // Speed: its own, Cruise's band when far ahead, and Cruise's soft tail when you are right behind it.
  const ship = game.ship;
  const gap = Math.hypot(ship.pos[0] - a.pos[0], ship.pos[1] - a.pos[1], ship.pos[2] - a.pos[2]);
  let speed = num(spec.speed, 27);
  const cruise = game.settings?.assists !== 'pilot';
  const band = spec.cruiseBand;
  if (cruise && band) {
    const behind = (a.pos[0] - ship.pos[0]) * Math.sin(a.yaw) + (a.pos[1] - ship.pos[1]) * Math.cos(a.yaw) > 0;
    // It also waits a moment when you have just crashed, so one mistake never loses the chase.
    if (gap >= band.far || (behind && gap < SOFT_TAIL) || game.t - num(ship.lastHitT, -99) < 3) speed = band.speed;
  }
  if (a.spinT > 0) speed *= 0.4;
  if (a.mode === 'bolt') {
    // Burst past the Tern's shoulder, straight for 0.6 s, then bend toward the path.
    a.speed = Math.max(speed + 6, a.speed - 6 * dt);
    trackAt(tr, a.data.join, P);
    moveToward(a, P[0], P[1], P[2], a.speed, a.t > 0.6 ? 1.4 : 0, dt);
    if (a.t > BOLT_T) { a.mode = 'join'; a.ghost = false; }
    return;
  }
  if (a.mode === 'join') {
    // Fly to a point on the path ahead (picked again each second as it turns), then run the path from there.
    if ((a.t % 1) < dt) a.data.join = nearestAhead(tr, a.pos, a.yaw);
    const s = a.data.join;
    trackAt(tr, s, P);
    moveToward(a, P[0], P[1], P[2], Math.max(speed, a.speed - 4 * dt), 1.6, dt);
    if (Math.hypot(P[0] - a.pos[0], P[1] - a.pos[1]) < JOIN_R) { a.mode = 'loop'; a.s = s; }
    return;
  }
  // On the loop: the path is a road under it; it eases onto it and runs at its speed.
  a.speed += clamp(speed - a.speed, -12 * dt, 12 * dt);
  a.s += a.speed * dt;
  if (!tr.loop && a.s >= tr.L) a.s = tr.L;
  trackAt(tr, a.s, P);
  const px = a.pos[0], py = a.pos[1], pz = a.pos[2];
  // Eases onto the path after a join or a bump, never faster than half its speed sideways.
  const k = 1 - Math.exp(-6 * dt);
  let ex = (P[0] - a.pos[0]) * k, ey = (P[1] - a.pos[1]) * k;
  const el = Math.hypot(ex, ey), cap = 0.5 * a.speed * dt;
  if (el > cap) { ex *= cap / el; ey *= cap / el; }
  a.pos[0] += ex; a.pos[1] += ey;
  a.pos[2] += (P[2] - a.pos[2]) * k;
  // The path point runs on at the runner's speed; the eased position chases it along the way.
  if (Math.hypot(P[0] - a.pos[0], P[1] - a.pos[1]) > 1) {
    const dx = P[0] - a.pos[0], dy = P[1] - a.pos[1], l = Math.hypot(dx, dy);
    a.pos[0] += (dx / l) * Math.min(l, a.speed * dt) * 0.5; a.pos[1] += (dy / l) * Math.min(l, a.speed * dt) * 0.5;
  }
  if (dt > 0) {
    a.vel[0] = (a.pos[0] - px) / dt; a.vel[1] = (a.pos[1] - py) / dt; a.vel[2] = (a.pos[2] - pz) / dt;
  }
  trackAt(tr, a.s + a.speed * 0.15, P);                      // face a little ahead along the path
  a.yaw = wrap(a.yaw + clamp(wrap(Math.atan2(P[0] - a.pos[0], P[1] - a.pos[1]) - a.yaw), -4 * dt, 4 * dt));
}

function stepItem(a, dt) {
  // A toss eases to a slow tumble along the way it was thrown.
  const s = Math.hypot(a.vel[0], a.vel[1], a.vel[2]);
  if (s > ITEM_DRIFT) {
    const ns = ITEM_DRIFT + (s - ITEM_DRIFT) * Math.exp(-ITEM_SETTLE * dt);
    const k = ns / s;
    a.vel[0] *= k; a.vel[1] *= k; a.vel[2] *= k;
  }
  a.speed = Math.hypot(a.vel[0], a.vel[1], a.vel[2]);
  a.pos[0] += a.vel[0] * dt; a.pos[1] += a.vel[1] * dt; a.pos[2] += a.vel[2] * dt;
  a.yaw = wrap(a.yaw + 2.5 * dt);
  if (a.t > TOSS_T) a.state = 'free';
}

/** catchable(game, a) → true when the ship is close enough to grab item a (Cruise 4 u, Pilot 2.5 u). */
export function catchable(game, a) {
  if (!a || a.kind !== 'item' || a.t < TOSS_T) return false;
  const r = game.settings?.assists === 'pilot' ? 2.5 : 4;
  const p = game.ship.pos, q = game.ship.prev?.pos || p;
  return segDist(q, p, a.pos) <= r + a.r * 0.5;
}

// The distance from point c to the segment p0 → p1.
function segDist(p0, p1, c) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const l2 = dx * dx + dy * dy + dz * dz;
  let f = l2 > 1e-12 ? ((c[0] - p0[0]) * dx + (c[1] - p0[1]) * dy + (c[2] - p0[2]) * dz) / l2 : 0;
  f = clamp(f, 0, 1);
  return Math.hypot(p0[0] + dx * f - c[0], p0[1] + dy * f - c[1], p0[2] + dz * f - c[2]);
}

// The Pelican and its kin: holding, sinking toward a body, hooked (ship.js moves it) or parked.
function stepTowable(game, a, dt, ev) {
  const spec = a.data;
  if (a.state === 'hooked') return;
  if (a.state === 'sinking' && spec.sinkTo) {
    const b = bodyPos(game, spec.sinkTo);
    if (b) {
      const dx = b[0] - a.pos[0], dy = b[1] - a.pos[1], dz = b[2] - a.pos[2];
      const d = Math.hypot(dx, dy, dz) || 1;
      const s = num(spec.sinkSpeed, 3);
      a.vel[0] = (dx / d) * s; a.vel[1] = (dy / d) * s; a.vel[2] = (dz / d) * s;
    }
  } else {
    a.vel[0] *= Math.exp(-1.5 * dt); a.vel[1] *= Math.exp(-1.5 * dt); a.vel[2] *= Math.exp(-1.5 * dt);
  }
  a.speed = Math.hypot(a.vel[0], a.vel[1], a.vel[2]);
  a.pos[0] += a.vel[0] * dt; a.pos[1] += a.vel[1] * dt; a.pos[2] += a.vel[2] * dt;
  // Auto-hook (both modes): the ship sits in the tow ring, TOW.LEN behind the load, for TOW.HOOK_T.
  const W = game.tune.TOW, ship = game.ship;
  if (a.state !== 'parked' && !ship.tow && a.data.hookable !== false) {
    const bx = a.pos[0] - Math.sin(a.yaw) * W.LEN, by = a.pos[1] - Math.cos(a.yaw) * W.LEN;
    const d = Math.hypot(ship.pos[0] - bx, ship.pos[1] - by, ship.pos[2] - a.pos[2]);
    const ring = game.settings?.assists === 'pilot' ? 4 : 6;
    if (d < ring) a.data.hookT = num(a.data.hookT) + dt;
    else a.data.hookT = 0;
    if (a.data.hookT >= W.HOOK_T) {
      a.state = 'hooked';
      a.data.hookT = 0;
      ship.tow = { actor: a.id, len: W.LEN };
      if (ev) ev.push('hook', { actor: a.id });
    }
  }
}

/** releaseTow(game, ev, why): let go of the towed load (a drop ring or a 1 s LET GO hold). */
export function releaseTow(game, ev = null, why = 'letgo') {
  const tow = game.ship.tow;
  if (!tow) return false;
  const a = actorById(game, tow.actor);
  game.ship.tow = null;
  if (a) a.state = 'parked';
  if (ev) ev.push('release', { actor: tow.actor, why });
  return true;
}

// A Magpie: waits its delay, dives at its target, hits it (a push), peels off and comes again.
function stepPursuer(game, a, dt, ev) {
  const spec = a.data;
  if (a.state === 'beaten' || a.state === 'fleeing') { stepRunner(game, a, dt, ev); return; }
  if (a.t < num(spec.delay)) return;
  const tgt = spec.target === 'ship' || !spec.target ? game.ship : actorById(game, spec.target);
  if (!tgt) return;
  const cap = num(spec.speedCap, 34);
  if (a.spinT > 0) {
    a.yaw = wrap(a.yaw + SPIN_RATE * dt);
    a.speed *= Math.exp(-2 * dt);
    a.pos[0] += a.vel[0] * dt; a.pos[1] += a.vel[1] * dt;
    return;
  }
  if (a.mode === 'peel') {
    a.data.peelT = num(a.data.peelT) - dt;
    moveToward(a, a.pos[0] + Math.sin(a.yaw) * 20, a.pos[1] + Math.cos(a.yaw) * 20, a.pos[2], cap * 0.8, 1, dt);
    if (a.data.peelT <= 0) a.mode = 'dive';
    return;
  }
  a.mode = 'dive';
  moveToward(a, tgt.pos[0], tgt.pos[1], tgt.pos[2], cap, 2.2, dt);
  const d = Math.hypot(tgt.pos[0] - a.pos[0], tgt.pos[1] - a.pos[1], tgt.pos[2] - a.pos[2]);
  if (d < Math.max(2, num(spec.peelOff, 4) * 0.5)) {
    // A hit on a load pushes it toward the well it hangs over (final.md 8.2), 8 u/s.
    if (tgt !== game.ship && tgt.vel) {
      const b = tgt.data?.sinkTo ? bodyPos(game, tgt.data.sinkTo) : null;
      const dx = b ? b[0] - tgt.pos[0] : Math.sin(a.yaw), dy = b ? b[1] - tgt.pos[1] : Math.cos(a.yaw);
      const l = Math.hypot(dx, dy) || 1;
      tgt.vel[0] += (dx / l) * 8; tgt.vel[1] += (dy / l) * 8;
      tgt.hits = (tgt.hits | 0) + 1;
      if (ev) ev.push('cargoHit', { contacts: tgt.hits, speed: 8, actor: tgt.id, by: a.id });
    }
    a.mode = 'peel';
    a.data.peelT = 3;
    a.yaw = wrap(a.yaw + 1.2);
  }
}

// Vela: idles at her ring; a fly-by; in a race she runs the race's track (race.js moves her with raceTo).
function stepRacer(game, a, dt) {
  const spec = a.data;
  if (a.spinT > 0) { a.yaw = wrap(a.yaw + SPIN_RATE * dt); a.speed *= Math.exp(-2 * dt); }
  if (a.mode === 'race') return;
  if (a.mode === 'goto' && spec.goto) {
    moveToward(a, spec.goto[0], spec.goto[1], spec.goto[2] || 0, num(spec.gotoSpeed, 24), 1.5, dt);
    if (Math.hypot(spec.goto[0] - a.pos[0], spec.goto[1] - a.pos[1]) < 6) { a.mode = 'idle'; a.speed = 0; }
    return;
  }
  a.speed *= Math.exp(-2 * dt);
  a.vel[0] = Math.sin(a.yaw) * a.speed; a.vel[1] = Math.cos(a.yaw) * a.speed;
  a.pos[0] += a.vel[0] * dt; a.pos[1] += a.vel[1] * dt;
}

// D100 falls along its path at its idle speed, round and round (a race sets its speed).
function stepFaller(game, a, dt) {
  const spec = a.data;
  if (!spec.path) return;
  const tr = trackOf(spec.path, false);
  if (a.mode !== 'race') a.speed = num(spec.idleSpeed, 4);
  a.s += a.speed * dt;
  if (a.s > tr.L) a.s = a.mode === 'race' ? tr.L : 0;
  trackAt(tr, a.s, P);
  a.vel[0] = Math.sin(P[3]) * a.speed; a.vel[1] = Math.cos(P[3]) * a.speed; a.vel[2] = 0;
  a.pos[0] = P[0]; a.pos[1] = P[1]; a.pos[2] = P[2];
  a.yaw = P[3];
}

function bodyPos(game, id) {
  const b = (zoneOf(game)?.bodies || []).find((x) => x.id === id);
  return b ? b.pos : null;
}

// ---------------------------------------------------------------- rams

// A runner with takedownAny is taken down by any contact closing at that speed or more. The check runs just before
// the touch, after both have moved this step, so ship.js never sees a rear-end as a head-on crash. A slower bump only
// nudges it ahead.
function rams(game, ev) {
  const ship = game.ship;
  const T = game.tune;
  const C = T.COLLIDE;
  for (let i = 0; i < game.actors.length; i++) {
    const a = game.actors[i];
    if (!a || a.ghost || a.spinT > 0 || !(num(a.data?.takedownAny) > 0) || a.state === 'beaten') continue;
    shipForward(ship, NOSE);
    // Capsule (the ship's segment) to the actor's sphere.
    const hl = C.CAPSULE_HALF;
    const dx = a.pos[0] - ship.pos[0], dy = a.pos[1] - ship.pos[1], dz = a.pos[2] - ship.pos[2];
    const along = clamp(dx * NOSE[0] + dy * NOSE[1] + dz * NOSE[2], -hl, hl);
    const ex = dx - NOSE[0] * along, ey = dy - NOSE[1] * along, ez = dz - NOSE[2] * along;
    const d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6;
    // Cruise reaches a little further for a ram (a chase's aim assist); Pilot only the colliders.
    const assist = game.settings?.assists === 'pilot' ? RAM_PILOT : RAM_CRUISE;
    const gap = d - a.rc - C.CAPSULE_R - assist;
    const nx = -ex / d, ny = -ey / d, nz = -ez / d;          // from the actor toward the ship
    const rx = ship.vel[0] - a.vel[0], ry = ship.vel[1] - a.vel[1], rz = ship.vel[2] - a.vel[2];
    const closing = -(rx * nx + ry * ny + rz * nz);
    if (closing <= 0) continue;
    const reach = closing * (2 / 120) + 0.12;
    if (gap > reach) continue;
    if (closing >= a.data.takedownAny) {
      takedown(game, a, closing, nx, ny, nz, ev);
    } else {
      // A soft bump: it scoots ahead, nobody crashes.
      a.pos[0] -= nx * (reach - gap + 0.05); a.pos[1] -= ny * (reach - gap + 0.05);
      a.vel[0] -= nx * closing; a.vel[1] -= ny * closing;
    }
  }
}

/** takedown(game, actor, closing, nx, ny, nz, ev): a ram on an actor (the same pay as ship.js's side-hit). */
export function takedown(game, a, closing, nx, ny, nz, ev) {
  const ship = game.ship, T = game.tune;
  a.spinT = T.COLLIDE.TAKEDOWN_SPIN;
  a.hits = (a.hits | 0) + 1;
  a.state = 'beaten';
  a.ghost = true;
  a.pos[0] -= nx * 0.5; a.pos[1] -= ny * 0.5; a.pos[2] -= nz * 0.5;
  a.vel[0] -= nx * 6; a.vel[1] -= ny * 6;
  a.speed = Math.hypot(a.vel[0], a.vel[1]);
  addBar(ship, T.BAR.TAKEDOWN);
  ship.lastHitT = game.t;
  if (game.stats) game.stats.takedowns++;
  const right = [Math.cos(ship.yaw), -Math.sin(ship.yaw)];
  const side = (a.pos[0] - ship.pos[0]) * right[0] + (a.pos[1] - ship.pos[1]) * right[1] >= 0 ? 1 : -1;
  if (ev) {
    ev.push('takedown', { id: a.id, speed: ship.speed, side, rel: closing, x: a.pos[0], y: a.pos[1], z: a.pos[2],
      pebble: false, ram: true });
  }
  chainEvent(ship, game.t, POINTS.takedown, ev, T);
  hitStop(game, KNOCK);
  beat(game, a, side, ev);
}

// Beaten: it spins out, then flees; a carrier drops what it carries, tossed ahead of the Tern and to the side away
// from it, so you swing a little to grab it on the move.
function beat(game, a, side, ev) {
  a.state = 'beaten';
  a.ghost = true;
  if (a.data?.carries) {
    const ship = game.ship;
    const along = [Math.sin(ship.yaw), Math.cos(ship.yaw)];
    tossItem(game, a.data.carries, a.pos.slice(), { along, side: -side, speed: Math.max(12, ship.speed + 10), kick: 9,
      label: a.data.carriesLabel || null }, ev);
  }
}
