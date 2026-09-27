// The cast: how the rod stroke becomes a launch, and how the lure flies until it lands.
// Pure logic (no DOM, no three.js), so node can test it: node qa/fish/cast.sim.mjs
import { height, onDock, DOCK } from "./lake.js";

export const CAST = {
  IDEAL_RELEASE: 68,     // deg: θ at release that gives the 38° launch the assist aims for
  LOAD_THETA: 105,       // deg: tip the rod back past this to load it
  PITCH_OFFSET: 30,      // launch pitch = θ release − this (the lure leaves along the rod's arc, not along the rod)
  ASSIST_PITCH: 38,      // the assist pulls the launch toward this
  ASSIST_PULL: 0.35,     // how far it pulls (0..1), only when the pitch is inside ASSIST_RANGE
  ASSIST_RANGE: [10, 80],
  MIN_STROKE_SPEED: 60,  // deg/s: slower than this is not a cast, the lure just drops off the tip
  WEAK_SPEED: 220,       // deg/s: slower than this reads as "weak"
  V_MAX: 33,             // m/s: the fastest launch a rod can give
  V_K: 550,              // deg/s: the stroke speed for 63% of V_MAX (diminishing returns: a violent throw gains little)
  V_MIN: 1.5,            // m/s: a lob off the tip
  BACK_FULL: 50,         // deg of back cast past the release point for full power
  BACK_HALF: 20,         // ... and this much gives BACK_HALF_POWER
  BACK_HALF_POWER: 0.6,
  BACK_MIN_POWER: 0.3,   // no back cast at all still flicks the lure out a little
  HIGH_PITCH: 58,        // raw launch pitch above this is a "high" lob (released too early)
  LOW_PITCH: 18,         // below this is a "low" line drive (released too late)
  SLAM_STEEP: 2.5,       // a release below the horizon drives the lure down this much more steeply...
  SLAM_LOSS: 0.4,        // ...and loses up to this much speed as the line slaps the water
  G: 9.81,
  KQ: 0.0085,            // quadratic air drag (1/m), fitted to 26 m/s at 35° → 42 m in 3 s, and 14 m/s → 18 m
  KL: 0.13,              // linear drag (1/s): line peeling off the spool and through the guides
  FEATHER: 3.2,          // 1/s: extra braking of the outward speed while a finger feathers the line
  SAG: 0.03,             // line out = straight distance × (1 + SAG) + SAG_M: the line never flies perfectly straight
  SAG_M: 0.3,
  SPOOL_MAX: 150,        // m of line on the spool
  TREE_MIN: 1.2,         // m: land higher than this has pines on it
  TREE_H: 6,             // m: how tall the pines are
  STEP: 1 / 240,         // s: internal time step
};

const D2R = Math.PI / 180;
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

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

export function castParams({ thetaRelease, omegaPeak, thetaBack, yaw = 0, assist = true } = {}) {
  const C = CAST;
  const th = fin(thetaRelease, C.IDEAL_RELEASE);
  // the forward stroke speed; motion.js reports forward as negative, so take the size either way
  const w = Math.abs(fin(omegaPeak, 0));
  const raw = th - C.PITCH_OFFSET;
  let pitch = raw;
  if (assist && pitch >= C.ASSIST_RANGE[0] && pitch <= C.ASSIST_RANGE[1]) pitch += C.ASSIST_PULL * (C.ASSIST_PITCH - pitch);
  // a late release: the tip is already swinging down at the water, so the lure goes in hard and close
  if (raw < 0) pitch = Math.max(-80, raw * C.SLAM_STEEP);
  const k = strokeFactor(thetaBack, th);
  let v0 = w < C.MIN_STROKE_SPEED ? C.V_MIN : C.V_MAX * (1 - Math.exp(-w / C.V_K)) * k;
  if (raw < 0) v0 *= 1 - C.SLAM_LOSS * Math.min(1, -raw / 5);
  v0 = Math.max(C.V_MIN, v0);
  const power = clamp(v0 / C.V_MAX, 0, 1);
  let verdict;
  if (pitch >= 90) verdict = "behind"; // straight up or past it: it comes down behind you
  else if (pitch < 0) verdict = "slam";
  else if (w < C.WEAK_SPEED || power < 0.3) verdict = "weak";
  else if (raw > C.HIGH_PITCH) verdict = "high";
  else if (raw < C.LOW_PITCH) verdict = "low";
  else verdict = "sweet";
  return { v0, pitch, yaw: fin(yaw, 0), power, verdict, clock: clockOf(th) };
}

// what is under a point: the water (0), the dock deck, or the land
function ground(x, z) {
  if (onDock(x, z) && z > DOCK.z0 - 0.3) return { y: DOCK.deck, kind: "dock" };
  const h = height(x, z);
  if (h > 0) return { y: h, kind: h > CAST.TREE_MIN ? "trees" : "land" };
  return { y: 0, kind: "water" };
}

export class Flight {
  constructor(tip, params) {
    const C = CAST;
    this.tip = { x: fin(tip && tip.x, 0.28), y: fin(tip && tip.y, 3.5), z: fin(tip && tip.z, -1) };
    const p = params || castParams({});
    const v0 = fin(p.v0, C.V_MIN), pitch = fin(p.pitch, 35) * D2R, yaw = fin(p.yaw, 0) * D2R;
    // pitch past 90° has a negative cosine, so the lure flies back over your head
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
