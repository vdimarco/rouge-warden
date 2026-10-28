// First Breath: steering a swimming body from the stick (design.md 6.1, 5.3). The stick's direction turns the body
// at a capped rate; its magnitude m sets the own speed target, top × m × mult ("ready" ×1.6 and the catch-up go in
// mult, never the bonuses). Below the target the speed rises at `accel`; above it, it eases down with `drag`. The
// stage adds the current, the waves and its bonuses to the velocity this returns, then moves the body. Reynolds,
// "Steering Behaviors for Autonomous Characters" (GDC 1999) is the model; the numbers are 6.1's. Pure.
//
// Contract choices: steerBody(body, steer, dt, tune) updates body.ang and body.speed in place and returns the own
// velocity { x, y }; it does not move the body. A stick under 1e-6 leaves the heading as it is. tune defaults to
// STEER (6.1's swim values); a stage passes its own (stage 4's tip: top 40, turn 2.6).
import { turnToward } from "./goals.js";

export const STEER = Object.freeze({ top: 55, accel: 120, drag: 1.8, turn: 3.0 });

export function steerBody(body, steer, dt, tune = STEER) {
  const t = { ...STEER, ...tune };
  const sx = steer && Number.isFinite(steer.x) ? steer.x : 0, sy = steer && Number.isFinite(steer.y) ? steer.y : 0;
  const m = Math.min(1, Math.hypot(sx, sy));
  if (!Number.isFinite(body.ang)) body.ang = Math.PI / 2;
  if (!Number.isFinite(body.speed)) body.speed = 0;
  if (m > 1e-6) body.ang = turnToward(body.ang, Math.atan2(sy, sx), t.turn, dt);
  const mult = Number.isFinite(t.mult) ? t.mult : 1;
  const target = t.top * m * mult;
  if (body.speed < target) body.speed = Math.min(target, body.speed + t.accel * dt);
  else body.speed = target + (body.speed - target) * Math.exp(-t.drag * dt);
  return { x: Math.cos(body.ang) * body.speed, y: Math.sin(body.ang) * body.speed };
}
