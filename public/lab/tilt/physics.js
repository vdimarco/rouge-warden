// Full Tilt: the physics. One steel ball against segments, circles and two flippers, in millimetres and seconds.
// Each frame (1/120 s) is cut into substeps so the ball moves at most 0.4 of its radius per substep, and flippers move
// less than that at their tips: no tunnelling. A flipper is a capsule on a pivot driven by a motor to hard stops; the
// ball bounces off it relative to the flipper's own speed where they touch, so a moving flipper shoots the ball and a
// flipper already at its stop is soft. From that, the skills come for free: a cradle, a post pass, a live catch.
// Two guards back the substeps up: a ball may never change sides of a flipper within its length, and a ball found
// outside the table goes back to where it last was. No DOM here: qa/lab/tilt.sim.mjs imports it.
import { BALL_R as R, inside } from "./table.js";

export const H = 1 / 120;
export const F = {
  G: 1600,                  // mm/s² down the table (a real slope gives about 1100; a phone screen wants it a bit quicker)
  MOTOR: 6000, UP: 32, DOWN: 18,   // flipper motor: rad/s² and top speeds going up and coming down
  E_MOVING: 0.45, E_HELD: 0.2, REST_V: 30, FRICTION: 0.15,
  MAX_SUB: 24, V_MAX: 9000, ROLL_DAMP: 0.03,
  LAUNCH: 5200,             // mm/s at a full pull of the plunger
};

export function makeWorld(table, { kickers = true } = {}) {
  const cell = 40, cols = Math.ceil(table.W / cell) + 2, rows = Math.ceil(table.H / cell) + 2;
  const grid = Array.from({ length: cols * rows }, () => []);
  const put = (item, x0, y0, x1, y1) => {
    const m = R + 2;
    for (let cy = Math.max(0, Math.floor((y0 - m) / cell)); cy <= Math.min(rows - 1, Math.floor((y1 + m) / cell)); cy++)
      for (let cx = Math.max(0, Math.floor((x0 - m) / cell)); cx <= Math.min(cols - 1, Math.floor((x1 + m) / cell)); cx++) grid[cy * cols + cx].push(item);
  };
  for (const s of table.walls) {
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy);
    s.len2 = L * L;
    s.nx = -dy / L; s.ny = dx / L;   // the left normal of a→b (a one-way wall blocks only from this side)
    put({ kind: "seg", s }, Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1]));
  }
  for (const p of table.posts) put({ kind: "circle", c: p }, p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r);
  for (const b of table.bumpers) put({ kind: "circle", c: b, bumper: true }, b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r);
  return {
    table, grid, cell, cols, rows, kickers,
    ball: { x: table.launch.x, y: table.launch.y, vx: 0, vy: 0, live: false, lane: true },
    flippers: table.flippers.map((f) => ({ ...f, th: f.rest, om: 0, held: false, dir: f.side < 0 ? 1 : -1, sd: 0 })),
    t: 0, escapes: 0, tunnels: 0, laneHit: -1,
  };
}

// the flipper's axis end point
const tip = (f) => [f.px + f.len * Math.cos(f.th), f.py + f.len * Math.sin(f.th)];

function moveFlippers(w, hs) {
  let moving = false;
  for (const f of w.flippers) {
    const target = f.held ? f.dir * F.UP : -f.dir * F.DOWN;
    const dv = target - f.om, a = F.MOTOR * hs;
    f.om += dv > a ? a : dv < -a ? -a : dv;
    f.th += f.om * hs;
    const lo = Math.min(f.rest, f.up), hi = Math.max(f.rest, f.up);
    if (f.th < lo) { f.th = lo; if (f.om < 0) f.om = 0; }
    if (f.th > hi) { f.th = hi; if (f.om > 0) f.om = 0; }
    if (Math.abs(f.om) > 0.5) moving = true;
  }
  return moving;
}

// A bounce off a surface moving at (sx, sy) with outward normal (nx, ny). Returns the speed into it, or 0.
function bounce(b, nx, ny, e, sx = 0, sy = 0, fr = 0) {
  const rx = b.vx - sx, ry = b.vy - sy, vn = rx * nx + ry * ny;
  if (vn >= 0) return 0;
  const ee = -vn < F.REST_V ? 0 : e;
  let tx = rx - vn * nx, ty = ry - vn * ny;
  if (fr) {
    const vt = Math.hypot(tx, ty), cut = Math.min(vt, fr * (1 + ee) * -vn);
    if (vt > 1e-9) { tx -= (tx / vt) * cut; ty -= (ty / vt) * cut; }
  }
  b.vx = sx + tx - ee * vn * nx;
  b.vy = sy + ty - ee * vn * ny;
  return -vn;
}

function collideStatic(w, ev) {
  const b = w.ball;
  const cx = Math.floor(b.x / w.cell), cy = Math.floor(b.y / w.cell);
  if (cx < 0 || cy < 0 || cx >= w.cols || cy >= w.rows) return;
  for (const it of w.grid[cy * w.cols + cx]) {
    if (it.kind === "seg") {
      const s = it.s;
      if (s.enabled === false) continue;
      if (w.table.isActive && !w.table.isActive(s)) continue;
      if (s.drop && !s.drop.up) continue;
      const ax = s.a[0], ay = s.a[1], dx = s.b[0] - ax, dy = s.b[1] - ay;
      let u = ((b.x - ax) * dx + (b.y - ay) * dy) / s.len2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = ax + u * dx, qy = ay + u * dy;
      let nx = b.x - qx, ny = b.y - qy;
      const d = Math.hypot(nx, ny);
      if (d >= R) continue;
      // the gate lets the ball through from behind, and does not shove a ball that is on its way through
      if (s.oneway && ((b.x - ax) * s.nx + (b.y - ay) * s.ny < 0 || b.vx * s.nx + b.vy * s.ny > 0)) continue;
      if (d < 1e-6) { nx = s.nx; ny = s.ny; } else { nx /= d; ny /= d; }
      b.x = qx + nx * R; b.y = qy + ny * R;
      const vin = bounce(b, nx, ny, s.e, 0, 0, 0.02);
      if (vin > 0) {
        if (s.kick && w.kickers && vin > 120) {
          const vn = b.vx * nx + b.vy * ny, want = Math.max(vn, s.kick);
          b.vx += (want - vn) * nx; b.vy += (want - vn) * ny;
          if (ev) ev.push({ k: "sling", side: s.sling, v: vin });
        } else if (s.drop) { s.drop.up = false; if (ev) ev.push({ k: "drop", id: s.drop.id, v: vin }); }
        else if (ev && vin > 250) ev.push({ k: "wall", v: vin });
      }
    } else {
      const c = it.c;
      if (w.table.isActive && !w.table.isActive(c)) continue;
      const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy), min = R + c.r;
      if (d >= min || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d;
      b.x = c.x + nx * min; b.y = c.y + ny * min;
      const vin = bounce(b, nx, ny, c.e ?? 0.6);
      if (vin > 0 && it.bumper) {
        if (w.kickers) {
          const vn = b.vx * nx + b.vy * ny, want = Math.max(vn, c.kick);
          b.vx += (want - vn) * nx; b.vy += (want - vn) * ny;
        }
        if (ev) ev.push({ k: "bumper", id: c.id, v: vin });
      } else if (vin > 200 && ev) ev.push({ k: "post", v: vin });
    }
  }
}

function collideFlippers(w, ev) {
  const b = w.ball;
  for (const f of w.flippers) {
    if (w.table.isActive && !w.table.isActive(f)) continue;
    const [tx, ty] = tip(f), dx = tx - f.px, dy = ty - f.py, L2 = f.len * f.len;
    let u = ((b.x - f.px) * dx + (b.y - f.py) * dy) / L2;
    const side = (dx * (b.y - f.py) - dy * (b.x - f.px)) / f.len;   // + left of the axis, - right of it
    const inSpan = u >= 0 && u <= 1;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = f.px + u * dx, qy = f.py + u * dy, rc = f.r1 + (f.r2 - f.r1) * u;
    let nx = b.x - qx, ny = b.y - qy, d = Math.hypot(nx, ny);
    // guard: the ball changed sides of the flipper inside its length: it went through. Put it back where it was
    const crossed = inSpan && f.sd !== 0 && Math.sign(side) !== Math.sign(f.sd) && Math.abs(side) < R + f.r1;
    if (crossed) {
      w.tunnels++;
      const s = Math.sign(f.sd), px = -dy / f.len, py = dx / f.len;   // unit normal on the left of the axis
      nx = s * px; ny = s * py; d = 0;
    } else if (d >= R + rc) { f.sd = side; continue; }
    else if (d < 1e-9) { const s = Math.sign(f.sd) || 1; nx = (s * -dy) / f.len; ny = (s * dx) / f.len; }
    else { nx /= d; ny /= d; }
    b.x = qx + nx * (R + rc + 0.01); b.y = qy + ny * (R + rc + 0.01);
    // the flipper's own speed where it touches the ball
    const sx = -f.om * (qy - f.py), sy = f.om * (qx - f.px);
    const e = Math.abs(f.om) > 0.5 ? F.E_MOVING : F.E_HELD;
    const vin = bounce(b, nx, ny, e, sx, sy, F.FRICTION);
    f.sd = (dx * (b.y - f.py) - dy * (b.x - f.px)) / f.len;
    if (vin > 150 && ev) ev.push({ k: "flipper", side: f.side, v: vin });
  }
}

// One frame of 1/120 s. ev (optional) collects what the ball hit.
export function step(w, ev = null) {
  const b = w.ball;
  w.t += H;
  if (b.lane && !b.live) { moveFlippers(w, H); return; }
  const v = Math.hypot(b.vx, b.vy);
  const flipMoving = w.flippers.some((f) => Math.abs(f.om) > 0.5 || f.held !== (f.th === f.up));
  let n = Math.ceil((v * H) / (0.4 * R));
  n = Math.max(flipMoving ? 4 : 2, Math.min(F.MAX_SUB, n));
  const hs = H / n;
  for (let i = 0; i < n; i++) {
    moveFlippers(w, hs);
    const px = b.x, py = b.y;
    if (w.table.gravity) {
      const a = w.table.gravity(b, w);
      b.vx += a.x * hs; b.vy += a.y * hs;
    } else b.vy -= F.G * hs;
    b.x += b.vx * hs; b.y += b.vy * hs;
    collideStatic(w, ev);
    collideFlippers(w, ev);
    if (!w.table.openSpace && !inside(w.table.outline, b.x, b.y)) { w.escapes++; b.x = px; b.y = py; b.vx *= -0.5; b.vy *= -0.5; }
  }
  // a little rolling drag, and a speed limit that keeps the substeps honest
  const k = 1 - F.ROLL_DAMP * H;
  b.vx *= k; b.vy *= k;
  const s = Math.hypot(b.vx, b.vy);
  const maxSpeed = w.table.maxSpeed ?? F.V_MAX;
  if (s > maxSpeed) { b.vx *= maxSpeed / s; b.vy *= maxSpeed / s; }
  // out of the shooter lane and into play
  if (b.lane && (w.table.leaveLane ? w.table.leaveLane(b) : b.x < 455 && b.y > 700)) b.lane = false;
  // the top lanes
  for (const L of w.table.lanes) {
    if (Math.abs(b.x - L.x) < 16 && Math.abs(b.y - L.y) < 22) { if (w.laneHit !== L.id) { w.laneHit = L.id; if (ev) ev.push({ k: "lane", id: L.id }); } }
  }
  if (w.laneHit >= 0 && Math.abs(b.y - w.table.lanes[w.laneHit].y) > 40) w.laneHit = -1;
  if (b.live && (w.table.isDrain ? w.table.isDrain(b) : b.y < w.table.drainY && b.x < 455)) { b.live = false; if (ev) ev.push({ k: "drain" }); }
}

export function setFlip(w, side, held) { for (const f of w.flippers) if (f.side === side) f.held = !!held; }

// Put a ball on the plunger.
export function serve(w) {
  const b = w.ball, L = w.table.launch;
  b.x = L.x; b.y = L.y; b.vx = 0; b.vy = 0; b.live = false; b.lane = true;
}
// How hard the plunger shoots for a pull of d (0..1). The spring is soft at first: the middle half of the pull sends
// the ball just over the top, where it falls into the top lanes, one lane after the other. The last quarter is for
// full launches round the top.
const PULL = [[0, 0.05], [0.2, 0.336], [0.75, 0.362], [1, 1]];
export function pullPower(d) {
  d = d < 0 ? 0 : d > 1 ? 1 : d;
  for (let i = 1; i < PULL.length; i++) {
    const [d0, p0] = PULL[i - 1], [d1, p1] = PULL[i];
    if (d <= d1) return p0 + ((p1 - p0) * (d - d0)) / (d1 - d0);
  }
  return 1;
}
// Let the plunger go: p is the launch power, 0..1 (pullPower turns a pull into one).
export function launch(w, p) {
  const b = w.ball;
  if (!b.lane || b.live) return false;
  b.live = true;
  b.vy = F.LAUNCH * Math.max(0.05, Math.min(1, p));
  return true;
}
// A nudge: the table jumps, so the ball's speed against it changes.
export function nudge(w, dvx, dvy) {
  const b = w.ball;
  if (!b.live) return;
  b.vx += dvx; b.vy += dvy;
}
// kinetic plus potential energy per unit mass, for tests
export const energy = (w) => 0.5 * (w.ball.vx ** 2 + w.ball.vy ** 2) + F.G * w.ball.y;
export { tip };
