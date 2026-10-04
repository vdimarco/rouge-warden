// Moonwell: the physics. One pearl against the island slopes, the flippers, bumpers, mills, lanterns, posts and gates.
// Each tick is cut into substeps so the pearl moves at most a third of its radius per substep, and a flipper tip moves
// no more than that: no tunnelling. A flipper is a tapered capsule on a pivot, driven by a motor to hard stops. The
// pearl bounces off it relative to the flipper's own speed where they touch, so a swinging flipper shoots the pearl
// and a raised one holds it: a cradle, a drop catch and an aimed shot come from that. No DOM here.
import { BALL_R as R, FLIP } from './world.js';

export const PHY = {
  G: 1500,
  MOTOR: 12000, UP: 16, DOWN: 12,       // flipper motor: rad/s² and top speeds going up and coming down
  PASS: 0.78,                           // the right flipper swings at this share of the left one's speed: it passes
  E_GROUND: 0.32, E_FLIP: 0.42, E_HELD: 0.12, E_LANTERN: 0.55, E_MILL: 0.6, E_BUMP: 0.75, BUMP: 430,
  ROLL: 0.003,                          // a little rolling loss each contact substep
  GRIP: 0.5, RUBBER: 2.5,               // a swinging flipper's rubber grips the pearl; a still one slows a roll (per s)
  REST: 70,                             // a slower hit than this does not bounce, so a resting pearl stays put
  V_MAX: 2100,
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function moveFlippers(s, input, h, power = 1) {
  for (const f of s.flippers) {
    const held = f.side < 0 ? input.left : input.right;
    const target = held ? f.up : f.rest;
    const dir = Math.sign(target - f.th);
    if (!dir) { f.om = 0; continue; }
    const top = held ? PHY.UP * power * (f.side > 0 ? PHY.PASS : 1) : PHY.DOWN;
    f.om = clamp(f.om + dir * PHY.MOTOR * h, -top, top);
    f.th += f.om * h;
    if ((dir > 0 && f.th >= target) || (dir < 0 && f.th <= target)) { f.th = target; f.om = 0; }
  }
}

// The pearl against a circle or a rounded segment that may turn about (cx, cy) at om rad/s. Returns the contact.
function contact(b, px, py, rad, e, cx = px, cy = py, om = 0, grip = PHY.ROLL) {
  let nx = b.x - px, ny = b.y - py;
  const d2 = nx * nx + ny * ny, min = R + rad;
  if (d2 >= min * min) return null;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d; ny /= d;
  b.x = px + nx * min; b.y = py + ny * min;
  // the surface's own speed where it touches
  const sx = px + nx * rad, sy = py + ny * rad;
  const ux = -om * (sy - cy), uy = om * (sx - cx);
  const rvx = b.vx - ux, rvy = b.vy - uy, vn = rvx * nx + rvy * ny;
  if (vn >= 0) return { nx, ny, vn: 0, ux, uy };
  const bounce = -vn < PHY.REST && Math.abs(om) < 1 ? 0 : e;
  b.vx -= (1 + bounce) * vn * nx;
  b.vy -= (1 + bounce) * vn * ny;
  const tx = -ny, ty = nx, vt = (b.vx - ux) * tx + (b.vy - uy) * ty;
  b.vx -= vt * tx * grip; b.vy -= vt * ty * grip;
  return { nx, ny, vn: -vn, ux, uy };
}

function onSegment(b, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((b.x - ax) * dx + (b.y - ay) * dy) / l2, 0, 1) : 0;
  return [ax + dx * t, ay + dy * t, t];
}

// A flipper or a mill arm: the closest point on its axis, its radius there, and the contact
function bar(b, cx, cy, th, from, to, r0, r1, e, om, grip) {
  const c = Math.cos(th), s = Math.sin(th);
  const [qx, qy, t] = onSegment(b, cx + c * from, cy + s * from, cx + c * to, cy + s * to);
  const hit = contact(b, qx, qy, r0 + (r1 - r0) * t, e, cx, cy, om, grip);
  if (hit) hit.t = t;
  return hit;
}

// Advance the flippers of the stations in view and the pearl by dt. Contacts go to ev; ball.touch says what it rests on.
export function step(world, stations, ball, input, dt, mods, ev, shown = world.list) {
  const power = mods.power || 1, g = PHY.G * (mods.g || 1);
  const speed = Math.hypot(ball.vx, ball.vy);
  const tip = PHY.UP * power * FLIP.len;
  const n = clamp(Math.ceil((Math.max(speed, tip) * dt) / (0.33 * R)), 1, 32);
  const h = dt / n;
  ball.touch = null;
  for (let i = 0; i < n; i++) {
    for (const s of shown) moveFlippers(s, input, h, power);
    ball.vy += g * h;
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    for (const s of stations) collide(s, ball, h, g, ev);
    const v = Math.hypot(ball.vx, ball.vy);
    if (v > PHY.V_MAX) { ball.vx *= PHY.V_MAX / v; ball.vy *= PHY.V_MAX / v; }
  }
}

function collide(s, b, h, g, ev) {
  for (const [ax, ay, bx, by] of s.segs) {
    if (Math.max(ax, bx) < b.x - R || Math.min(ax, bx) > b.x + R || Math.max(ay, by) < b.y - R || Math.min(ay, by) > b.y + R) continue;
    const [qx, qy] = onSegment(b, ax, ay, bx, by);
    const hit = contact(b, qx, qy, 0, PHY.E_GROUND);
    if (hit) {
      // a rolling pearl speeds up at 5/7 of a sliding one: give back 2/7 of gravity along the slope
      const tx = -hit.ny, ty = hit.nx, gt = g * ty * h * (2 / 7);
      b.vx -= tx * gt; b.vy -= ty * gt;
      b.touch = b.touch || 'ground';
      if (hit.vn > 260) ev.push({ type: 'thud', x: b.x, y: b.y, v: hit.vn });
    }
  }
  // the wall at the edge of the kept world, and a shrine's sealed gate on its right ridge
  const wall = (x, y) => {
    if (Math.abs(b.x - x) > R + 6 || b.y > y + R) return;
    const hit = contact(b, x, clamp(b.y, -6000, y - 6), 6, 0.5);
    if (hit && hit.vn > 120) ev.push({ type: 'gate', x, y: b.y, v: hit.vn });
  };
  if (s.gate) wall(s.x0, s.y0);
  if (s.sealed) wall(s.x1, s.y1);
  for (const p of s.posts) {
    const hit = contact(b, p.x, p.y, p.r, 0.5);
    if (hit) b.touch = b.touch || 'ground';
  }
  for (const f of s.flippers) {
    const moving = Math.abs(f.om) > 1;
    const hit = bar(b, f.px, f.py, f.th, 0, f.len, f.r0, f.r1, moving ? PHY.E_FLIP : PHY.E_HELD, f.om, moving ? PHY.GRIP : PHY.RUBBER * h);
    if (!hit) continue;
    b.touch = f;
    if (hit.vn > 40 || moving) ev.push({ type: 'flip', s, f, t: hit.t, v: hit.vn, moving, x: b.x, y: b.y });
  }
  for (const o of s.bumpers) {
    const hit = contact(b, o.x, o.y, o.r, PHY.E_BUMP);
    if (hit && hit.vn > 0 && !(o.cool > 0)) {
      b.vx += hit.nx * PHY.BUMP; b.vy += hit.ny * PHY.BUMP;
      o.flash = 1; o.cool = 0.06;
      ev.push({ type: 'bumper', s, o, x: o.x, y: o.y });
    }
    if (o.cool > 0) o.cool -= h;
  }
  for (const o of s.lanterns) {
    const hit = contact(b, o.x, o.y, o.r, PHY.E_LANTERN);
    if (hit && hit.vn > 30) { o.flash = 1; ev.push({ type: 'lantern', s, o, x: o.x, y: o.y }); }
  }
  for (const m of s.mills) {
    const hit = bar(b, m.x, m.y, m.a, -m.half, m.half, m.r, m.r, PHY.E_MILL, m.om);
    if (hit && hit.vn > 60) ev.push({ type: 'mill', s, o: m, x: b.x, y: b.y, v: hit.vn });
  }
}

// Turn the mills and fade the flashes of every station, once per tick
export function animate(world, dt) {
  for (const s of world.list) {
    for (const m of s.mills) m.a += m.om * dt;
    for (const o of s.bumpers) o.flash = Math.max(0, o.flash - dt * 4);
    for (const o of s.lanterns) o.flash = Math.max(0, o.flash - dt * 3);
  }
}
