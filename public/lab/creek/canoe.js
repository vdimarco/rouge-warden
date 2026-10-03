// Up the Creek: the canoe. A 2D body on the river (position, velocity, heading ψ, yaw rate ω) plus a roll φ.
// Heading 0 points downstream (+y), and + turns to the right. Roll + is the right side down.
// The hull samples the current at three points, so an eddy line (water going one way at the bow and the other at the
// stern) spins it; its side drag is far larger than its drag along the keel, so it tracks. Strokes, J-strokes,
// back strokes and braces act on it the way a paddle does: a stroke on the right pushes it ahead and turns the bow left.
// No DOM here: the Node tests import it.
import { FINISH, START, JAM } from "./river.js";

const D2R = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
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
  CAPSIZE: 50 * D2R,
  WARN_AHEAD: 0.4, WARN_OFF: 42 * D2R,         // warn when the roll 0.4 s ahead passes CAPSIZE; stop under 42°
  ROLL_CAP_AT: 30 * D2R, ROLL_RATE: 1.2,       // past 30° the hull rolls over no faster than 1.2 rad/s
  HULL_R: 0.45,                                // the hull's half beam, for rocks and banks
  ROCK_SLIDE: 4,                               // m/s² along a rock's side while you touch it
  KNOCK: 0.3,                                  // m/s into a rock or a bank that counts as a knock
  SWIM: 1.8,                                   // seconds from a capsize to the reset
  SWIM_BACK: 4,                                // metres upstream of the swim where you climb back in
  EDDY_E: 0.6, EDDY_REL: 0.7, EDDY_GROUND: 1.3, EDDY_COS: Math.cos(70 * D2R), EDDY_HOLD: 0.4,
  // the ledge: over the lip within 30° of straight is a boof, and a stroke in the last 0.4 s makes it a clean one.
  // More crooked, the drop rolls the hull toward its downstream side for 0.45 s, harder the more crooked it is.
  BOOF_OFF: 30 * D2R, BOOF_STROKE: 0.4, KICK: 40, KICK_T: 0.45,
  EDDY_GRAB: 1.0,                              // per second, at the core of an eddy
  PEEL: 0.4, PEEL_T: 0.8,                      // the share of the grab left for 0.8 s after a stroke with the bow
                                               // downstream. With no peel, the grab held a canoe that paddled hard.
};

export function newCanoe(river, at = null) {
  const y = at ? at.y : START, x = at ? at.x : river.c(y);
  const [tx, ty] = river.tan(y);
  return {
    x, y, vx: 0, vy: 0, psi: at && at.psi != null ? at.psi : Math.atan2(tx, ty), om: 0, phi: 0, dphi: 0,
    t: 0, lean: 0, brace: 0, pushes: [], turns: [], warn: 0, strokeT: -9, kick: null, ledge: null, ledgeT: -9,
    swim: 0, swims: 0, swimX: 0, swimY: 0, caught: new Set(), lastEddy: null, inEddy: null, eddyT: 0, touching: false, pinT: 0,
    eddyQ: null, eddyBow: false, eddySlow: false, holding: false,
    miss: {}, done: false, strokes: 0, js: 0, braces: 0, rocks: 0,
  };
}

// a paddle action: {type: "stroke" | "j" | "back", side: -1 left | +1 right, power 0..1.4}
export function act(c, a) {
  if (c.swim > 0 || c.done) return;
  const P = clamp(a.power ?? 1, 0, 1.4), s = a.side < 0 ? -1 : 1;
  c.strokeT = c.t;
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
  // An eddy grabs you: its boils and swirl drag the boat toward the speed of its water. It holds a canoe that sits
  // still or faces upstream. Paddle with the bow downstream and most of the grab lets go: you peel out.
  if (eMid > 0) {
    const [dx, dy] = river.tan(c.y), peel = c.t - c.strokeT < C.PEEL_T && fx * dx + fy * dy > 0;
    const g = C.EDDY_GRAB * (peel ? C.PEEL : 1) * eMid * eMid * H;
    c.vx -= g * (c.vx - uxMid); c.vy -= g * (c.vy - uyMid);
    c.om *= 1 - 0.5 * g;
  }
  c.om += yawA * H;
  c.psi += c.om * H;
  const lip0 = river.lip(c.x, c.y);
  c.x += c.vx * H;
  c.y += c.vy * H;
  if (lip0 < 0 && river.lip(c.x, c.y) >= 0) overLip(c, river, ev);

  // roll: the hull rights itself up to 50°; sliding sideways over the water trips it, unless you lift the edge
  const trip = C.TRIP * wsMid * Math.abs(wsMid) * clamp(1 + Math.sign(wsMid) * (c.phi / C.TRIP_LEAN), 0, 1.8);
  let rollA = -C.RIGHT_K * Math.sin((Math.PI * c.phi) / C.CAPSIZE) - C.ROLL_C * c.dphi + C.LEAN_K * (leanT - c.phi) + trip;
  if (c.brace && c.brace * c.phi > C.BRACE_LEAN) rollA -= c.brace * (C.BRACE_K * (c.brace * c.phi - C.BRACE_LEAN) + C.BRACE_C * c.brace * c.dphi);
  if (c.kick) { rollA += c.kick.a; if ((c.kick.t -= H) <= 0) c.kick = null; }
  c.dphi += rollA * H;
  // past 30° the hull rolls on no faster than ROLL_RATE, so the warning comes in time to brace
  if (Math.abs(c.phi) > C.ROLL_CAP_AT && c.dphi * Math.sign(c.phi) > C.ROLL_RATE) c.dphi = Math.sign(c.phi) * C.ROLL_RATE;
  c.phi += c.dphi * H;
  if (Math.abs(c.phi) > C.CAPSIZE) { capsize(c, ev); return; }
  // the warning: the roll 0.4 s ahead passes 50°. It stays on until the roll ahead is back under 42°
  const ahead = c.phi + C.WARN_AHEAD * c.dphi, side = Math.sign(ahead);
  if (Math.abs(ahead) > C.CAPSIZE && c.warn !== side) { c.warn = side; if (ev) ev.push({ k: "tip", side }); }
  else if (c.warn && (Math.abs(ahead) < C.WARN_OFF || side !== c.warn)) c.warn = 0;

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

  // an eddy caught: deep in an eddy worth catching, drifting with its water, the bow pointing upstream, for 0.4 s
  const q = eMid > C.EDDY_E ? river.eddyAt(c.x, c.y) : null;
  const rel = Math.hypot(c.vx - uxMid, c.vy - uyMid), ground = Math.hypot(c.vx, c.vy);
  const [tx, ty] = river.tan(c.y);
  const upstream = -(fx * tx + fy * ty);
  // for the page: the eddy you sit in that you can still catch, and what the catch needs
  c.eddyQ = q && q.target && !c.caught.has(q.id) ? q : null;
  c.eddyBow = upstream > C.EDDY_COS;
  c.eddySlow = rel < C.EDDY_REL && ground < C.EDDY_GROUND;
  c.holding = !!c.eddyQ && c.eddyBow && c.eddySlow;
  if (q && c.eddySlow && c.eddyBow) {
    if (c.inEddy === q) c.eddyT += H; else { c.inEddy = q; c.eddyT = 0; }
    if (c.eddyT >= C.EDDY_HOLD && q.target && !c.caught.has(q.id)) {
      c.caught.add(q.id);
      c.lastEddy = q;
      c.eddyQ = null; c.holding = false;
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

// Over the lip of the ledge. Straight: a boof, the moment the page slows time for. Crooked: the drop rolls you over
// toward the downstream side, unless you brace there.
function overLip(c, river, ev) {
  const L = river.ledge, rel = wrap(c.psi - Math.atan2(L.tx, L.ty)), off = Math.abs(rel);
  c.ledgeT = c.t;
  if (off <= C.BOOF_OFF) {
    const clean = c.t - c.strokeT < C.BOOF_STROKE;
    c.ledge = clean ? "clean" : "boof";
    // no stroke: the bow drops into the foam, and the canoe slows and wobbles
    if (!clean) { c.vx *= 0.8; c.vy *= 0.8; c.dphi += (rel >= 0 ? -1 : 1) * 0.5; }
    if (ev) ev.push({ k: "boof", clean, off });
  } else {
    // the side of the hull that faces downstream: the left one when the bow points right of the current
    const side = rel > 0 ? -1 : 1;
    c.kick = { a: side * C.KICK * (0.3 + (off - C.BOOF_OFF) / (60 * D2R)), t: C.KICK_T };
    c.ledge = "crooked";
    if (ev) ev.push({ k: "crooked", off, side });
  }
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
      // a knock counts (and sounds) only when the hull hits; a hull that rests on the rock does not count
      if (contact(c, s, nx, ny, min - d, sp, cp) && c.hitV > C.KNOCK) { c.rocks++; if (ev) ev.push({ k: "rock", v: c.hitV }); }
      // the water carries the hull round the rock, downstream, so a touch never becomes a trap
      let tx = -ny, ty = nx;
      if (tx * q.tx + ty * q.ty < 0) { tx = -tx; ty = -ty; }
      c.vx += tx * C.ROCK_SLIDE * H; c.vy += ty * C.ROCK_SLIDE * H;
    }
    // the banks: pushed back along the bank's own normal, so the hull slides along it instead of sticking
    const cy = river.c(py), by = river.b(py), n = (px - cy) / by;
    if (Math.abs(n) > 0.97) {
      const side = Math.sign(n), [tx, ty] = river.tan(py);
      if (contact(c, s, -side * ty, side * tx, (Math.abs(n) - 0.97) * by, sp, cp) && ev && c.hitV > C.KNOCK) ev.push({ k: "bank", v: c.hitV });
    }
    // the log jam above the put-in: a straight wall across the river at y = JAM
    if (py < JAM + C.HULL_R && contact(c, s, 0, 1, JAM + C.HULL_R - py, sp, cp) && ev && c.hitV > C.KNOCK) ev.push({ k: "jam", v: c.hitV });
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
  if (c.ledge && c.t - c.ledgeT < 2) c.ledge = "swim";
  c.kick = null;
  c.swimX = c.x; c.swimY = c.y;
  c.warn = 0; c.eddyQ = null; c.holding = false;
  c.pushes.length = 0; c.turns.length = 0;
  if (ev) ev.push({ k: "capsize", side: Math.sign(c.phi) });
}

// back in the canoe a few metres upstream of the swim, so you can try the same move again: still, the bow downstream
function reset(c, river, ev) {
  const p = putIn(river, c.swimX, c.swimY - C.SWIM_BACK);
  c.x = p.x; c.y = p.y;
  const [tx, ty] = river.tan(p.y);
  c.psi = Math.atan2(tx, ty);
  c.vx = 0; c.vy = 0; c.om = 0; c.phi = 0; c.dphi = 0; c.brace = 0; c.lean = 0; c.warn = 0;
  c.inEddy = null; c.eddyT = 0;
  if (ev) ev.push({ k: "reset" });
}

// The open water nearest to (x, y), at y or a little upstream of it: well inside the banks, with the whole hull clear
// of the rocks, and out of the eddies. Never above the put-in, and never on the drop: a swim at the ledge puts you
// back 13 m above its lip, so you can line up again.
export function putIn(river, x, y) {
  const d = river.lip(x, y), f = {};
  if (d > -13 && d < 4) y -= 13 + d;
  const y0 = Math.max(START, y), n0 = clamp((x - river.c(y0)) / river.b(y0), -0.6, 0.6);
  const open = (px, py, strict) => {
    const [tx, ty] = river.tan(py);
    for (const s of [-2.3, 0, 2.3]) {
      const hx = px + s * tx, hy = py + s * ty;
      if (river.rocks.some((q) => Math.hypot(q.x - hx, q.y - hy) < q.R + (strict ? 1.5 : 0.6))) return false;
      if (strict && river.flow(hx, hy, f).e > 0.05) return false;
    }
    return true;
  };
  for (const strict of [true, false]) {
    for (let dy = 0; dy <= (strict ? 8 : 11); dy++) {
      const py = Math.max(START, y0 - dy);
      for (const dn of [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2]) {
        const n = n0 + dn;
        if (Math.abs(n) > 0.65) continue;
        const px = river.c(py) + n * river.b(py);
        if (open(px, py, strict)) return { x: px, y: py };
      }
    }
  }
  return { x: river.c(y0), y: y0 };
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
