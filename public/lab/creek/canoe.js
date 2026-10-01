// Up the Creek: the canoe. A 2D body on the river (position, velocity, heading ψ, yaw rate ω) plus a roll φ.
// Heading 0 points downstream (+y), and + turns to the right. Roll + is the right side down.
// The hull samples the current at three points, so an eddy line (water going one way at the bow and the other at the
// stern) spins it; its side drag is far larger than its drag along the keel, so it tracks. Strokes, J-strokes,
// back strokes and braces act on it the way a paddle does: a stroke on the right pushes it ahead and turns the bow left.
// No DOM here: the Node tests import it.
import { FINISH } from "./river.js";

const D2R = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const H = 1 / 120;
export const C = {
  PTS: [[2, 0.3], [0, 0.4], [-2, 0.3]],       // where the hull feels the water: [metres ahead of the middle, weight]
  SIDE_Q: 2.2, SIDE_L: 1.5,                   // side drag, quadratic and linear
  FWD_Q: 0.04, FWD_L: 0.06,                   // drag along the keel
  YAW_I: 1.92, YAW_D: 0.5,
  STROKE_V: 0.45, STROKE_YAW: 0.6, STROKE_T: 0.22,   // a stroke of power 1: push (m/s) and turn (rad/s), over 0.22 s
  J_YAW: 0.6, J_T: 0.15, J_CUT: 0.12,                // a J-stroke: the turn back, and the push it costs
  BRACE_DRAG: 0.8, BRACE_YAW: 0.35, BRACE_LEAN: 22 * D2R, BRACE_K: 20, BRACE_C: 6,
  RIGHT_K: 7, ROLL_C: 3, LEAN_K: 6, LEAN_MAX: 15 * D2R, TRIP: 2.6, TRIP_LEAN: 0.35,
  CAPSIZE: 50 * D2R, TIP_WARN: 35 * D2R,
  HULL_R: 0.45,                                // the hull's half beam, for rocks and banks
  ROCK_SLIDE: 4,                               // m/s² along a rock's side while you touch it
  SWIM: 1.8,                                   // seconds from a capsize to the reset
  EDDY_E: 0.6, EDDY_REL: 0.7, EDDY_GROUND: 1.3, EDDY_COS: Math.cos(70 * D2R), EDDY_HOLD: 0.4,
  EDDY_GRAB: 1.0,                              // per second, at the core of an eddy
};

export function newCanoe(river, at = null) {
  const y = at ? at.y : 6, x = at ? at.x : river.c(y);
  const [tx, ty] = river.tan(y);
  return {
    x, y, vx: 0, vy: 0, psi: at && at.psi != null ? at.psi : Math.atan2(tx, ty), om: 0, phi: 0, dphi: 0,
    t: 0, lean: 0, brace: 0, pushes: [], turns: [],
    swim: 0, swims: 0, caught: new Set(), lastEddy: null, inEddy: null, eddyT: 0, touching: false, pinT: 0,
    miss: {}, done: false, strokes: 0, js: 0, braces: 0, rocks: 0,
  };
}

// a paddle action: {type: "stroke" | "j" | "back", side: -1 left | +1 right, power 0..1.4}
export function act(c, a) {
  if (c.swim > 0 || c.done) return;
  const P = clamp(a.power ?? 1, 0, 1.4), s = a.side < 0 ? -1 : 1;
  if (a.type === "stroke" || a.type === "back") {
    const dir = a.type === "back" ? -1 : 1;
    c.pushes.push({ a: (dir * C.STROKE_V * P) / C.STROKE_T, t: C.STROKE_T });
    c.turns.push({ a: (-dir * s * C.STROKE_YAW * P) / C.STROKE_T, t: C.STROKE_T });
    c.strokes++;
  } else if (a.type === "j") {
    c.turns.push({ a: (s * C.J_YAW * P) / C.J_T, t: C.J_T });
    for (const p of c.pushes) p.a *= 1 - C.J_CUT;
    c.js++;
  }
}

const f = {};
export function step(c, river, ev = null) {
  c.t += H;
  if (c.done) return;
  if (c.swim > 0) {
    c.swim -= H;
    if (c.swim <= 0) reset(c, river, ev);
    return;
  }
  const sp = Math.sin(c.psi), cp = Math.cos(c.psi);
  const fx = sp, fy = cp, rx = cp, ry = -sp;   // forward and right
  // side drag at each hull point, and the yaw it makes
  let aLat = 0, yawA = 0, wsMid = 0, wfMid = 0, eMid = 0, uxMid = 0, uyMid = 0;
  for (const [s, wt] of C.PTS) {
    const px = c.x + s * fx, py = c.y + s * fy;
    river.flow(px, py, f);
    const wx = c.vx + c.om * s * rx - f.vx, wy = c.vy + c.om * s * ry - f.vy;
    const ws = wx * rx + wy * ry;
    const a = -wt * (C.SIDE_Q * Math.abs(ws) + C.SIDE_L) * ws;
    aLat += a;
    yawA += s * a;
    if (s === 0) { wsMid = ws; wfMid = wx * fx + wy * fy; eMid = f.e; uxMid = f.vx; uyMid = f.vy; }
  }
  yawA = yawA / C.YAW_I - C.YAW_D * c.om;
  let aF = -(C.FWD_Q * Math.abs(wfMid) + C.FWD_L) * wfMid;
  // the paddle
  for (let i = c.pushes.length - 1; i >= 0; i--) { const p = c.pushes[i]; aF += p.a; p.t -= H; if (p.t <= 0) c.pushes.splice(i, 1); }
  for (let i = c.turns.length - 1; i >= 0; i--) { const p = c.turns[i]; yawA += p.a; p.t -= H; if (p.t <= 0) c.turns.splice(i, 1); }
  // a brace: the blade flat on the water on one side. It slows you, turns you toward it, and holds the lean
  let leanT = c.lean * C.LEAN_MAX, brake = 0;
  if (c.brace) {
    brake = C.BRACE_DRAG * wfMid;
    yawA += c.brace * C.BRACE_YAW * Math.abs(wfMid);
    leanT = c.brace * C.BRACE_LEAN;
  }
  aF -= brake;
  c.vx += (aLat * rx + aF * fx) * H;
  c.vy += (aLat * ry + aF * fy) * H;
  // an eddy grabs you: its boils and swirl drag the boat toward the speed of its water
  if (eMid > 0) {
    const g = C.EDDY_GRAB * eMid * eMid * H;
    c.vx -= g * (c.vx - uxMid); c.vy -= g * (c.vy - uyMid);
    c.om *= 1 - 0.5 * g;
  }
  c.om += yawA * H;
  c.psi += c.om * H;
  c.x += c.vx * H;
  c.y += c.vy * H;

  // roll: the hull rights itself up to 50°; sliding sideways over the water trips it, unless you lift the edge
  const trip = C.TRIP * wsMid * Math.abs(wsMid) * clamp(1 + Math.sign(wsMid) * (c.phi / C.TRIP_LEAN), 0, 1.8);
  let rollA = -C.RIGHT_K * Math.sin((Math.PI * c.phi) / C.CAPSIZE) - C.ROLL_C * c.dphi + C.LEAN_K * (leanT - c.phi) + trip;
  if (c.brace && c.brace * c.phi > C.BRACE_LEAN) rollA -= c.brace * (C.BRACE_K * (c.brace * c.phi - C.BRACE_LEAN) + C.BRACE_C * c.brace * c.dphi);
  c.dphi += rollA * H;
  c.phi += c.dphi * H;
  if (Math.abs(c.phi) > C.CAPSIZE) { capsize(c, ev); return; }
  if (ev && Math.abs(c.phi) > C.TIP_WARN && !c.tipping) ev.push({ k: "tip", side: Math.sign(c.phi) });
  c.tipping = Math.abs(c.phi) > C.TIP_WARN;

  collide(c, river, ev);
  // pinned on a rock: the current swings the hull round until it lies with the flow and slides off
  if (c.touching) {
    c.pinT += H;
    if (c.pinT > 0.8) {
      const fl = river.flow(c.x, c.y), sp2 = Math.sin(c.psi), cp2 = Math.cos(c.psi);
      const cross = sp2 * fl.vy - cp2 * fl.vx, dot = sp2 * fl.vx + cp2 * fl.vy;
      c.om += -Math.sign(cross * (dot >= 0 ? 1 : -1)) * 3 * H;
    }
  } else c.pinT = 0;

  // an eddy caught: deep in it, drifting with its water, the bow pointing upstream, for half a second
  const q = eMid > C.EDDY_E ? river.eddyAt(c.x, c.y) : null;
  const rel = Math.hypot(c.vx - uxMid, c.vy - uyMid), ground = Math.hypot(c.vx, c.vy);
  const [tx, ty] = river.tan(c.y);
  const upstream = -(fx * tx + fy * ty);
  if (q && rel < C.EDDY_REL && ground < C.EDDY_GROUND && upstream > C.EDDY_COS) {
    if (c.inEddy === q) c.eddyT += H; else { c.inEddy = q; c.eddyT = 0; }
    if (c.eddyT >= C.EDDY_HOLD && !c.caught.has(q.id)) {
      c.caught.add(q.id);
      c.lastEddy = q;
      if (ev) ev.push({ k: "eddy", id: q.id });
    }
  } else if (!q) { c.inEddy = null; c.eddyT = 0; }
  // how close you came to each eddy you have not caught
  for (const t of river.targets) {
    if (c.caught.has(t.id) || Math.abs(t.ey - c.y) > 8) continue;
    const d = Math.hypot(t.ex - c.x, t.ey - c.y);
    if (c.miss[t.id] == null || d < c.miss[t.id]) c.miss[t.id] = d;
  }
  if (c.y >= FINISH) { c.done = true; if (ev) ev.push({ k: "finish" }); }
}

function collide(c, river, ev) {
  const sp = Math.sin(c.psi), cp = Math.cos(c.psi);
  c.touching = false;
  for (const [s] of C.PTS) {
    const px = c.x + s * sp, py = c.y + s * cp;
    // rocks
    for (const q of river.rocks) {
      const dx = px - q.x, dy = py - q.y, d = Math.hypot(dx, dy), min = q.R + C.HULL_R;
      if (d >= min || d < 1e-6) continue;
      c.touching = true;
      const nx = dx / d, ny = dy / d;
      if (contact(c, s, nx, ny, min - d, sp, cp)) { c.rocks++; if (ev && c.hitV > 0.3) ev.push({ k: "rock", v: c.hitV }); }
      // the water carries the hull round the rock, downstream, so a touch never becomes a trap
      let tx = -ny, ty = nx;
      if (tx * q.tx + ty * q.ty < 0) { tx = -tx; ty = -ty; }
      c.vx += tx * C.ROCK_SLIDE * H; c.vy += ty * C.ROCK_SLIDE * H;
    }
    // the banks: pushed back along the bank's own normal, so the hull slides along it instead of sticking
    const cy = river.c(py), by = river.b(py), n = (px - cy) / by;
    if (Math.abs(n) > 0.97) {
      const side = Math.sign(n), [tx, ty] = river.tan(py);
      if (contact(c, s, -side * ty, side * tx, (Math.abs(n) - 0.97) * by, sp, cp) && ev && c.hitV > 0.3) ev.push({ k: "bank", v: c.hitV });
    }
  }
}
// Push the hull point at s out along the normal (nx, ny). A blow off the middle spins the hull. True when it hit.
function contact(c, s, nx, ny, pen, sp, cp) {
  c.x += nx * pen; c.y += ny * pen;
  const vn = c.vx * nx + c.vy * ny + c.om * s * (cp * nx - sp * ny);
  c.hitV = 0;
  if (vn >= 0) return false;
  c.vx -= 1.2 * vn * nx; c.vy -= 1.2 * vn * ny;
  c.om += -(s * (nx * cp - ny * sp)) * vn * 0.25;
  c.hitV = -vn;
  return true;
}

function capsize(c, ev) {
  c.swim = C.SWIM;
  c.swims++;
  c.pushes.length = 0; c.turns.length = 0;
  if (ev) ev.push({ k: "capsize", side: Math.sign(c.phi) });
}

// back in the last eddy you caught (or at the top), still, the bow upstream in an eddy
function reset(c, river, ev) {
  const q = c.lastEddy;
  if (q) {
    c.x = q.ex; c.y = q.ey;
    c.psi = Math.atan2(-q.tx, -q.ty);
  } else {
    c.y = 6; c.x = river.c(6);
    const [tx, ty] = river.tan(6);
    c.psi = Math.atan2(tx, ty);
  }
  c.vx = 0; c.vy = 0; c.om = 0; c.phi = 0; c.dphi = 0; c.brace = 0; c.lean = 0;
  c.inEddy = null; c.eddyT = 0;
  if (ev) ev.push({ k: "reset" });
}

// how close you came to the eddies you missed: the smallest distance, or null
export function closestMiss(c, river) {
  let best = null, which = -1;
  river.targets.forEach((t, i) => {
    if (c.caught.has(t.id) || c.miss[t.id] == null) return;
    if (best == null || c.miss[t.id] < best) { best = c.miss[t.id]; which = i; }
  });
  return best == null ? null : { d: best, index: which };
}
