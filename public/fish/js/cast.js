// The cast: how the rod stroke becomes a launch, and how the lure flies until it lands.
// Pure logic (no DOM, no three.js), so node can test it: node qa/fish/cast.sim.mjs
import { height, onDock, DOCK, currentPlace } from "./lake.js";

export const CAST = {
  IDEAL_RELEASE: 68,     // deg: θ at release that gives the 38° launch the assist aims for
  LOAD_THETA: 100,       // deg: tip the rod back past this to load it (10° past upright)
  PITCH_OFFSET: 30,      // launch pitch = θ release − this (the lure leaves along the rod's arc, not along the rod)
  ASSIST_PITCH: 38,      // easy mode (the assist) pulls the launch toward this
  ASSIST_PULL: 0.55,     // how far it pulls (0..1), while the raw pitch is inside ASSIST_RANGE...
  ASSIST_RANGE: [-15, 95],
  ASSIST_FADE: 10,       // ...fading in and out over this many degrees at both ends, so no release falls off a cliff
  MIN_STROKE_SPEED: 60,  // deg/s: slower than this is not a cast, the lure just drops off the tip
  WEAK_SPEED: 220,       // deg/s: slower than this reads as "weak"
  V_MAX: 33,             // m/s: the fastest launch a rod can give
  V_K: 550,              // deg/s: the stroke speed for 63% of V_MAX (diminishing returns: a violent throw gains little)
  V_K_EASY: 420,         // ...in easy mode: a gentle stroke goes farther
  V_MIN: 1.5,            // m/s: a lob off the tip
  BACK_FULL: 50,         // deg of back cast past the release point for full power
  BACK_HALF: 20,         // ... and this much gives BACK_HALF_POWER
  BACK_HALF_POWER: 0.6,
  BACK_MIN_POWER: 0.3,   // no back cast at all still flicks the lure out a little
  SHORT_STROKE: 0.65,    // a back cast worth less power than this is "short": the fix is to tip back, not to swing harder
  MAX_PITCH: 75,        // early releases stay in the forward hemisphere, even with assist off
  HIGH_PITCH: 58,        // raw launch pitch above this is a "high" lob (released too early)
  LOW_PITCH: 18,         // below this is a "low" line drive (released too late)
  SLAM_STEEP: 2.5,       // a release below the horizon drives the lure down this much more steeply...
  SLAM_LOSS: 0.4,        // ...and loses up to this much speed as the line slaps the water...
  SLAM_SPAN: 5,          // ...all of it this many degrees below the horizon
  SLAM_SPAN_EASY: 10,    // ...in easy mode a little later, so a late lift tails off rather than drops
  G: 9.81,
  KQ: 0.0085,            // quadratic air drag (1/m), fitted to 26 m/s at 35° → 42 m in 3 s, and 14 m/s → 18 m
  KL: 0.13,              // linear drag (1/s): line peeling off the spool and through the guides
  FEATHER: 3.2,          // 1/s: extra braking of the outward speed while a finger feathers the line
  SAG: 0.03,             // line out = straight distance × (1 + SAG) + SAG_M: the line never flies perfectly straight
  SAG_M: 0.3,
  SPOOL_MAX: 150,        // m of line on the spool
  TREE_H: 6,             // m: how tall the pines are
  STEP: 1 / 240,         // s: internal time step
};

const D2R = Math.PI / 180;
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// "11 o'clock" for a rod angle, seen from the angler's right side
export function clockOf(theta) {
  let h = Math.round(12 - (90 - theta) / 30);
  while (h <= 0) h += 12;
  while (h > 12) h -= 12;
  return `${h} o'clock`;
}

// how much of the power a back cast gives: a long load is full power, a short one is not
export function strokeFactor(thetaBack, thetaRelease) {
  const C = CAST;
  if (!Number.isFinite(thetaBack)) return 1; // unknown back cast: do not punish it
  const d = thetaBack - thetaRelease;
  if (d >= C.BACK_FULL) return 1;
  if (d >= C.BACK_HALF) return C.BACK_HALF_POWER + (1 - C.BACK_HALF_POWER) * (d - C.BACK_HALF) / (C.BACK_FULL - C.BACK_HALF);
  return Math.max(C.BACK_MIN_POWER, C.BACK_HALF_POWER * Math.max(0, d) / C.BACK_HALF);
}

// how hard easy mode pulls a raw launch pitch toward ASSIST_PITCH (0..ASSIST_PULL)
export function assistPull(raw) {
  const C = CAST, [lo, hi] = C.ASSIST_RANGE, F = C.ASSIST_FADE;
  return C.ASSIST_PULL * smooth(lo, lo + F, raw) * (1 - smooth(hi - F, hi, raw));
}

// stroke: the share of the power the back cast gave (strokeFactor)
export function castParams({ thetaRelease, omegaPeak, thetaBack, yaw = 0, assist = true } = {}) {
  const C = CAST;
  const th = fin(thetaRelease, C.IDEAL_RELEASE);
  // the forward stroke speed; motion.js reports forward as negative, so take the size either way
  const w = Math.abs(fin(omegaPeak, 0));
  const raw = th - C.PITCH_OFFSET;
  // a late release: the tip is already swinging down at the water, so the lure goes in hard and close
  let pitch = raw < 0 ? Math.max(-80, raw * C.SLAM_STEEP) : raw;
  // easy mode pulls the launch toward a good angle, a slam too. The pull fades out at the ends of its range
  if (assist) pitch += assistPull(raw) * (C.ASSIST_PITCH - pitch);
  pitch = clamp(pitch, -80, C.MAX_PITCH);
  const k = strokeFactor(thetaBack, th);
  let v0 = w < C.MIN_STROKE_SPEED ? C.V_MIN : C.V_MAX * (1 - Math.exp(-w / (assist ? C.V_K_EASY : C.V_K))) * k;
  if (raw < 0) v0 *= 1 - C.SLAM_LOSS * Math.min(1, -raw / (assist ? C.SLAM_SPAN_EASY : C.SLAM_SPAN));
  v0 = Math.max(C.V_MIN, v0);
  const power = clamp(v0 / C.V_MAX, 0, 1);
  let verdict;
  if (pitch < 0) verdict = "slam";
  // an early lift is "high" even when the short stroke also cut the power: the fix is the timing, not more speed
  else if (raw > C.HIGH_PITCH) verdict = "high";
  // no back cast: the fix is to tip the rod back first, not to swing faster
  else if (k < C.SHORT_STROKE) verdict = "short";
  else if (w < C.WEAK_SPEED || power < 0.3) verdict = "weak";
  else if (raw < C.LOW_PITCH) verdict = "low";
  else verdict = "sweet";
  return { v0, pitch, yaw: fin(yaw, 0), power, verdict, clock: clockOf(th), stroke: k };
}

/* ---------------- the release ---------------- */
// Touch and mouse: the finger's height is the rod angle. h is the drag that turns the rod 150° (touchSpan). Below the
// press point the rod follows the finger; above it the rod moves at ABOVE of the finger's travel, so a flick that carries
// on past the press point (the natural end of a flick) still lets go near 11 o'clock. Above the press point the span is
// always SPAN_MAX: a flick carries on about as far on any screen, so a short one (a phone on its side) forgives as much
export const TOUCH = { REST: 80, ABOVE: 0.4, SPAN_K: 0.3, SPAN_MIN: 160, SPAN_MAX: 240, ROOM_THETA: 125, EDGE: 4, SPAN_EDGE: 48 };
export function touchSpan(gameH) { return clamp(fin(gameH, 0) * TOUCH.SPAN_K, TOUCH.SPAN_MIN, TOUCH.SPAN_MAX); }
// The span for a press at y0 (px from the top) on a screen gameH tall. A press low on the screen has little room below it,
// so the drag down shrinks to fit: the finger reaches ROOM_THETA (past full power) EDGE px above the bottom. A press with
// the room keeps touchSpan, and no span is shorter than SPAN_EDGE
export function touchSpanAt(gameH, y0) {
  const h = touchSpan(gameH), room = fin(gameH, 0) - fin(y0, 0) - TOUCH.EDGE;
  return clamp(room / ((TOUCH.ROOM_THETA - TOUCH.REST) / 150), TOUCH.SPAN_EDGE, h);
}
// dy: px the finger is below the press point (negative: above it)
export function touchTheta(dy, h) {
  dy = fin(dy, 0); h = Math.max(1, fin(h, TOUCH.SPAN_MAX));
  return clamp(TOUCH.REST + (dy < 0 ? (dy * TOUCH.ABOVE) / TOUCH.SPAN_MAX : dy / h) * 150, 5, 170);
}
// the other way: where the finger is for a rod angle (the touch rail draws its marks with this)
export function touchDy(theta, h) {
  const d = (fin(theta, TOUCH.REST) - TOUCH.REST) / 150;
  return d < 0 ? (d * TOUCH.SPAN_MAX) / TOUCH.ABOVE : d * Math.max(1, fin(h, TOUCH.SPAN_MAX));
}

// Motion: a release is graded by time, not angle: a fast whip sweeps the sweet band in 30 ms. errMs is how long after the
// rod crossed IDEAL_RELEASE the thumb lifted (negative: before it), and MS_DEG maps about ±90 ms onto the sweet band.
// A lift before the crossing reads the samples up to WAIT_MS after it (the phone is over the shoulder: nobody sees the
// launch wait). A thumb held down through the swing (held) casts a low line drive, worse than any lift made in time
export const RELEASE = { MS_DEG: 0.22, MAX_MS: 400, LOOK_MS: 450, WAIT_MS: 100, HELD_THETA: 30 };
export function gradeRelease({ errMs = 0, held = false } = {}) {
  const R = RELEASE;
  if (held) return { thetaRelease: R.HELD_THETA, assist: false };
  return { thetaRelease: CAST.IDEAL_RELEASE - clamp(fin(errMs, 0), -R.MAX_MS, R.MAX_MS) * R.MS_DEG, assist: true };
}
// errMs for a lift at t (ms). at(q) is the rod angle at time q; fwd the forward swing speed (deg/s); tEnd the newest
// time the history reaches (a lift before the crossing looks ahead to it)
export function liftError(at, t, fwd, tEnd = t) {
  const I = CAST.IDEAL_RELEASE, R = RELEASE, sp = Math.max(1, Math.abs(fin(fwd, 0)));
  const th = at(t);
  if (th < I) {
    // past 11 o'clock: when did it cross?
    for (let q = t; q > t - R.LOOK_MS; q -= 2) {
      const a = at(q - 2), b = at(q);
      if (a >= I && b < I) return t - (q - 2 + (2 * (a - I)) / (a - b));
    }
    return -((th - I) / sp) * 1000;
  }
  // not there yet: when it got there, from the samples after the lift
  for (let q = t; q < tEnd; q += 2) {
    const e = Math.min(q + 2, tEnd), a = at(q), b = at(e);
    if (a >= I && b < I) return t - (q + ((e - q) * (a - I)) / (a - b));
  }
  // still not there at tEnd: the rest of the way at the swing's speed
  return t - tEnd - ((at(tEnd) - I) / sp) * 1000;
}

// what is under a point: the water (0), the stand (dock, road, bar or wall), or the land.
// Land higher than the place's treeMin has trees on it.
function ground(x, z) {
  if (onDock(x, z)) return { y: DOCK.deck, kind: "dock" };
  const h = height(x, z);
  if (h > 0) return { y: h, kind: h > currentPlace().treeMin ? "trees" : "land" };
  return { y: 0, kind: "water" };
}

export class Flight {
  constructor(tip, params) {
    const C = CAST;
    this.tip = { x: fin(tip && tip.x, 0.28), y: fin(tip && tip.y, 3.5), z: fin(tip && tip.z, -1) };
    const p = params || castParams({});
    const v0 = fin(p.v0, C.V_MIN), pitch = clamp(fin(p.pitch, 35), -80, C.MAX_PITCH) * D2R, yaw = fin(p.yaw, 0) * D2R;
    // Enforce a forward launch even for callers supplying raw flight parameters.
    const h = Math.cos(pitch);
    this.p = { ...this.tip };
    this.v = { x: v0 * h * Math.sin(yaw), y: v0 * Math.sin(pitch), z: -v0 * h * Math.cos(yaw) };
    this.t = 0;
    this.lineOut = 0;
    this.spool = 0;
    this.done = false;
    this.land = null;
    this.apex = this.p.y;
  }

  step(dt, feather = false) {
    const C = CAST;
    dt = clamp(fin(dt, 0), 0, 0.25);
    if (!this.done && dt > 0) {
      const before = this.lineOut;
      let left = dt;
      while (left > 1e-9 && !this.done) {
        const h = Math.min(C.STEP, left);
        left -= h;
        this.sub(h, !!feather);
      }
      this.spool = Math.max(0, (this.lineOut - before) / dt);
    } else if (this.done) this.spool = 0;
    const p = this.p, v = this.v;
    return { x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, spool: this.spool, lineOut: this.lineOut, done: this.done, land: this.land, t: this.t };
  }

  sub(h, feather) {
    const C = CAST, p = this.p, v = this.v;
    const s = Math.hypot(v.x, v.y, v.z);
    let ax = -C.KQ * s * v.x - C.KL * v.x;
    let ay = -C.G - C.KQ * s * v.y - C.KL * v.y;
    let az = -C.KQ * s * v.z - C.KL * v.z;
    // a finger on the line brakes the lure's outward speed, so it drops short
    const dx = p.x - this.tip.x, dy = p.y - this.tip.y, dz = p.z - this.tip.z;
    const d = Math.hypot(dx, dy, dz);
    const full = this.lineOut >= C.SPOOL_MAX;
    if ((feather || full) && d > 0.05) {
      const ux = dx / d, uy = dy / d, uz = dz / d;
      const out = v.x * ux + v.y * uy + v.z * uz;
      if (out > 0) {
        const k = full ? 40 : C.FEATHER;
        ax -= k * out * ux; ay -= k * out * uy; az -= k * out * uz;
      }
    }
    v.x += ax * h; v.y += ay * h; v.z += az * h;
    p.x += v.x * h; p.y += v.y * h; p.z += v.z * h;
    this.t += h;
    if (p.y > this.apex) this.apex = p.y;
    const nd = Math.hypot(p.x - this.tip.x, p.y - this.tip.y, p.z - this.tip.z);
    // line only leaves the spool during the flight; it never winds back on by itself
    this.lineOut = Math.min(C.SPOOL_MAX, Math.max(this.lineOut, nd * (1 + C.SAG) + C.SAG_M * Math.min(1, this.t)));
    const g = ground(p.x, p.z);
    // falling into the pines: the lure hangs in a tree
    if (g.kind === "trees" && v.y < 0 && p.y < g.y + C.TREE_H) return this.stop("tree", p.y);
    if (p.y <= g.y) return this.stop(g.kind === "trees" ? "land" : g.kind, g.y);
    if (this.t > 12) this.stop("water", 0);
  }

  stop(kind, y) {
    this.p.y = y;
    this.v.x = this.v.y = this.v.z = 0;
    this.done = true;
    this.land = kind;
  }
}

// fly a cast to the end without drawing it: for tests and for an aim preview
export function castLanding(tip, params, featherAt = Infinity) {
  const f = new Flight(tip, params);
  let r = null;
  for (let i = 0; i < 2000 && !f.done; i++) r = f.step(1 / 60, f.t >= featherAt);
  r = r || f.step(0);
  const dist = Math.hypot(r.x, r.z);
  return { ...r, dist, apex: f.apex, time: f.t };
}
