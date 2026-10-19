// Swing speed from rotationRate, and the bat pose from orientation. No sensor objects here.

import { BAT, RULES, clamp } from './rules.js';

export function sampleSpeed(sample) {
  return Math.max(Math.hypot(Number(sample.alpha) || 0, Number(sample.beta) || 0), Number(sample.linearSpeed) || 0);
}

export function smoothSpeed(samples) {
  const last = samples.slice(-RULES.smoothSamples);
  if (!last.length) return 0;
  let sum = 0;
  for (const sample of last) sum += sampleSpeed(sample);
  return sum / last.length;
}

// Right-to-left yaw is a forehand for a right hander. Negative alpha is that direction.
export function dirFromYaw(alpha) {
  return (Number(alpha) || 0) < 0 ? 'forehand' : 'backhand';
}

export function createSwingDetector() {
  let samples = [];
  let open = null;
  let coolUntil = -Infinity;

  return {
    push(sample, now) {
      const t = Number(now) || 0;
      samples.push(sample);
      if (samples.length > RULES.smoothSamples) samples = samples.slice(-RULES.smoothSamples);
      const speed = smoothSpeed(samples);
      const yaw = Number(sample.alpha) || 0;
      const roll = Number(sample.gamma) || 0;
      const accel = Number(sample.accel) || 0;
      if (open) {
        const instant = sampleSpeed(sample);
        if (instant >= open.peak) {
          open.peak = instant;
          open.yaw = yaw;
          open.peakAt = t;
        }
        if (Math.abs(roll) >= Math.abs(open.roll)) open.roll = roll;
        if (accel > open.accel) open.accel = accel;
        if (t - open.start >= RULES.peakWindow - 1e-9) {
          const swing = {
            degPerSec: open.peak,
            dir: dirFromYaw(open.yaw),
            rollDegPerSec: open.roll,
            accel: open.accel,
            at: open.peakAt == null ? t : open.peakAt,
          };
          open = null;
          coolUntil = t + RULES.cooldown;
          return swing;
        }
        return null;
      }
      if (t < coolUntil) return null;
      if (speed > RULES.swingStart) {
        open = { start: t, peak: sampleSpeed(sample), yaw, roll, accel, peakAt: t };
      }
      return null;
    },
    tracking() {
      return open != null;
    },
    reset() { samples = []; open = null; coolUntil = -Infinity; },
  };
}

// A drag maps onto the same three bands. Speed is the upward part of the stroke.
// A flick up at the end is topspin. A pull down is backspin.
export function swipeToSwing(gesture) {
  const dt = Math.max(1 / 60, Number(gesture.dt) || 0);
  const up = Math.max(0, -(Number(gesture.dy) || 0));
  const pxPerSec = up / dt;
  const degPerSec = pxPerSec * (RULES.swingStart / 400);
  const tiltX = Math.max(-RULES.aimGamma, Math.min(RULES.aimGamma, ((Number(gesture.dx) || 0) / 120) * RULES.aimGamma));
  const endDt = Math.max(1 / 60, Number(gesture.endDt) || dt);
  const endV = (Number(gesture.endDy) || 0) / endDt;
  let rollDegPerSec = 0;
  if (endV < -400) rollDegPerSec = 650;
  else if (endV > 280) rollDegPerSec = -650;
  const dir = (Number(gesture.dx) || 0) >= 0 ? 'forehand' : 'backhand';
  return { degPerSec, dir, tiltX, tiltY: 0, rollDegPerSec };
}

// Desktop pointer. The bat tracks the ball sideways. Cursor x is the aim,
// cursor y is the lean. A flick is pointer speed over about 60 ms, in
// window widths per second, so a 2560 window reads the same as 1280.
export const POINTER = Object.freeze({
  window: 0.06,
  push: 1.2,
  drive: 2.3,
  smash: 4.3,
  bend: 20,
});

// 0 is the left edge, 1 is the right edge. Centre aims straight. The ends are ±30 deg.
export function aimFromCanvas(u) {
  const x = clamp(Number(u) || 0, 0, 1);
  return (x - 0.5) * 2 * RULES.aimGamma;
}

// 0 is the top of the court (toward the net), 1 is the near edge.
export function leanFromCanvas(v) {
  const y = clamp(Number(v) || 0, 0, 1);
  return (0.5 - y) * 2 * BAT.fullLean;
}

// While the ball is coming in, the bat's sideways target is the ball.
// Any other phase rests at the middle.
export function sideTarget(phase, ballX) {
  if (phase !== 'incoming') return 0;
  const line = Number(ballX);
  return Number.isFinite(line) ? line : 0;
}

export function flickFromSamples(samples, now, viewWidth, windowSec = POINTER.window) {
  const t = Number(now) || 0;
  const width = Math.max(1, Number(viewWidth) || 1);
  let oldest = null;
  let newest = null;
  const list = samples || [];
  for (let i = 0; i < list.length; i++) {
    const sample = list[i];
    if (!sample || t - sample.t > windowSec + 1e-6) continue;
    if (!oldest || sample.t < oldest.t) oldest = sample;
    if (!newest || sample.t >= newest.t) newest = sample;
  }
  if (!oldest || !newest || oldest === newest) return null;
  const dt = Math.max(1 / 120, newest.t - oldest.t);
  const dx = newest.x - oldest.x;
  const dy = newest.y - oldest.y;
  const widthsPerSec = Math.hypot(dx, dy) / dt / width;
  if (!(widthsPerSec + 1e-8 >= POINTER.push)) return null;
  let degPerSec;
  if (widthsPerSec <= POINTER.drive + 1e-8) {
    const u = (widthsPerSec - POINTER.push) / (POINTER.drive - POINTER.push);
    degPerSec = RULES.swingStart + Math.min(1, Math.max(0, u)) * (RULES.pushMax - RULES.swingStart);
  } else if (widthsPerSec <= POINTER.smash + 1e-8) {
    const u = (widthsPerSec - POINTER.drive) / (POINTER.smash - POINTER.drive);
    degPerSec = RULES.pushMax + Math.min(1, Math.max(0, u)) * (RULES.driveMax - RULES.pushMax);
    if (degPerSec <= RULES.pushMax) degPerSec = RULES.pushMax + 1e-6;
  } else {
    degPerSec = RULES.driveMax + (widthsPerSec - POINTER.smash) * (RULES.swingStart / POINTER.push);
    if (degPerSec <= RULES.driveMax) degPerSec = RULES.driveMax + 1e-6;
  }
  const bend = Math.atan2(-dy, Math.abs(dx)) * (180 / Math.PI);
  let rollDegPerSec = 0;
  if (bend + 1e-4 >= POINTER.bend) rollDegPerSec = 360;
  else if (bend - 1e-4 <= -POINTER.bend) rollDegPerSec = -360;
  const dir = dx >= 0 ? 'forehand' : 'backhand';
  return { degPerSec, dir, rollDegPerSec, at: newest.t, widthsPerSec, bend };
}

// Portrait gamma is side tilt. In landscape the axes swap, same as Lawn Tennis.
export function mapAxes(beta, gamma, angle) {
  const turn = ((Number(angle) || 0) % 360 + 360) % 360;
  if (turn === 90) return { beta: -gamma, gamma: beta };
  if (turn === 270) return { beta: gamma, gamma: -beta };
  if (turn === 180) return { beta: -beta, gamma: -gamma };
  return { beta: Number(beta) || 0, gamma: Number(gamma) || 0 };
}

// Past the dead zone, 0 is centred and ±1 is the end of the travel.
export function axisPastDead(deg, full, dead = RULES.batDead) {
  const v = Number(deg) || 0;
  const mag = Math.abs(v);
  if (!(mag > dead)) return 0;
  const span = Math.max(1e-6, full - dead);
  return Math.sign(v) * Math.min(1, (mag - dead) / span);
}

// Gentle near the middle, faster toward the edges. ±1 stays ±1, so full tilt still reaches the side.
function shapeUnit(unit) {
  const a = Math.abs(unit);
  if (!(a > 0)) return 0;
  return Math.sign(unit) * Math.pow(Math.min(1, a), BAT.curve);
}

// gamma (side tilt / roll) sets x. beta (a lean) nudges depth a short way.
// Aim is a separate map: the same angles at the swing still pick the landing spot.
export function batFromTilt(tiltX, tiltY) {
  const side = shapeUnit(axisPastDead(tiltX, BAT.fullSide, BAT.dead));
  const fore = shapeUnit(axisPastDead(tiltY, BAT.fullLean, BAT.dead));
  return {
    x: side * BAT.sideReach,
    depth: BAT.homeZ + fore * BAT.lean,
    side,
    fore,
  };
}

// Lean is a small offset. The bounce depth does most of the forward and back, softly.
export function depthWithBounce(leanDepth, bounceZ) {
  const home = BAT.homeZ;
  const lean = (Number(leanDepth) || home) - home;
  const bounce = Number(bounceZ);
  const at = Number.isFinite(bounce) ? bounce : home;
  const base = home + BAT.bounceBlend * (at - home);
  return clamp(base + lean, BAT.depthMin, BAT.depthMax);
}

// Where the incoming ball will meet the table on the player's half.
export function predictBounceZ(ball) {
  if (!ball || !(ball.vz < -0.05)) return null;
  let y = ball.y;
  let z = ball.z;
  let vy = ball.vy;
  const vz = ball.vz;
  const g = ball.g || RULES.gravity;
  const dt = 1 / 30;
  for (let i = 0; i < 90; i++) {
    const y0 = y;
    const z0 = z;
    y += vy * dt - 0.5 * g * dt * dt;
    vy -= g * dt;
    z += vz * dt;
    if (y0 >= RULES.ballR && y < RULES.ballR && z < RULES.netZ && z > -0.05) {
      const u = (RULES.ballR - y0) / (y - y0 || 1);
      return z0 + (z - z0) * u;
    }
    if (z < -0.2) break;
  }
  return null;
}

// Casual assist: a light pull of x toward the ball's line. Depth stays with the player.
export function assistX(x, ballX, amount = RULES.assist) {
  const a = clamp(Number(amount) || 0, 0, 1);
  const cmd = Number(x) || 0;
  const line = Number(ballX) || 0;
  return cmd + a * (line - cmd);
}

// Critically damped step. From rest, y = (1 + w t) e^(-w t) never crosses the target.
// w is about 69 rad/s, so a held angle settles in roughly 70 ms with no overshoot.
export function springStep(state, target, dt, w = BAT.springW) {
  const step = clamp(Number(dt) || 0, 0, 0.05);
  const x = Number(state && state.x) || 0;
  const v = Number(state && state.v) || 0;
  const dest = Number(target) || 0;
  if (!(step > 0)) return { x, v };
  const y0 = x - dest;
  const e = Math.exp(-w * step);
  const b = v + w * y0;
  const y = (y0 + b * step) * e;
  const vn = (b - w * y0 - w * b * step) * e;
  return { x: dest + y, v: vn };
}

// A still phone, with the bat already near the middle, lets the neutral pose
// follow a slow grip shift. Tau is 2 s. A swing or a bat at the side does not drift.
export function driftNeutral(neutral, angle, rate, batX, dt) {
  const base = Number(neutral) || 0;
  const at = Number(angle) || 0;
  const offset = at - base;
  const still = Math.abs(Number(rate) || 0) <= BAT.driftStill;
  const nearAngle = Math.abs(offset) <= BAT.driftNear;
  const nearBat = Math.abs(Number(batX) || 0) <= BAT.driftCentre;
  if (!still || !nearAngle || !nearBat) return base;
  const step = Math.max(0, Number(dt) || 0);
  const k = 1 - Math.exp(-step / BAT.driftTau);
  return base + offset * k;
}

// Slightly higher at the sides, like a forehand and a backhand clearing the table.
export function batHover(x) {
  const along = Math.min(1, Math.abs(Number(x) || 0) / BAT.sideReach);
  return BAT.hover + BAT.hoverArc * along * along;
}

// Gyro rate shoves the bat toward the net, then eases back when the rate drops.
export function swingPush(prev, gyroDegPerSec, dt) {
  const mag = Math.abs(Number(gyroDegPerSec) || 0);
  const target = clamp((mag - 80) / 520, 0, 1);
  const step = clamp(Number(dt) || 0, 0, 0.08);
  const rate = target > prev ? 28 : 7;
  const k = 1 - Math.exp(-rate * step);
  const from = Number(prev) || 0;
  return from + (target - from) * k;
}

// Face roll follows the phone's side tilt. Pitch foreshortens the face.
// pushZ is added to the bat's depth for the drawing only.
export function batPresentation({ roll, tiltY, push, x }) {
  const rollDeg = clamp(Number(roll) || 0, -50, 50);
  const pitch = clamp((Number(tiltY) || 0) / BAT.fullLean, -1.35, 1.35);
  const jab = clamp(Number(push) || 0, 0, 1);
  const along = Math.min(1, Math.abs(Number(x) || 0) / BAT.sideReach);
  const open = 1 + along * along * BAT.openSide;
  return {
    rollDeg,
    // A light squash and a shear, so the pitch reads and the paddle stays a paddle.
    // The face opens a little at the sides.
    scaleY: Math.max(0.86, 1 - pitch * 0.12) * open,
    shear: -pitch * 0.32,
    pushZ: jab * RULES.swingPush,
  };
}

// Heading is circular: crossing north must not send the bat across the table.
export function headingDelta(alpha, neutral) {
  if (!Number.isFinite(alpha) || !Number.isFinite(neutral)) return 0;
  return ((alpha - neutral + 540) % 360 + 360) % 360 - 180;
}

// Screen right and horizontal forward, from gravity-free device acceleration.
export function phoneAcceleration(sample, angle, pitch) {
  if (!sample || ![sample.x, sample.y, sample.z].every(Number.isFinite)) return { x: 0, z: 0 };
  const a = (Number(angle) || 0) * Math.PI / 180;
  const b = (Number(pitch) || 0) * Math.PI / 180;
  const x = sample.x * Math.cos(a) + sample.y * Math.sin(a);
  const up = sample.y * Math.cos(a) - sample.x * Math.sin(a);
  return { x, z: up * Math.cos(b) - sample.z * Math.sin(b) };
}

// Short strokes, not unbounded inertial navigation. A spring stops sensor drift.
export function createPhoneTravel() {
  let x = 0, z = 0, vx = 0, vz = 0, ax = 0, az = 0, at = -Infinity;
  return {
    sample(acceleration, angle, pitch, now) {
      const a = phoneAcceleration(acceleration, angle, pitch);
      ax = Math.abs(a.x) < 0.25 ? 0 : clamp(a.x, -18, 18);
      az = Math.abs(a.z) < 0.25 ? 0 : clamp(a.z, -18, 18);
      at = now;
    },
    step(dt, now) {
      const elapsed = clamp(Number(dt) || 0, 0, 0.05);
      const live = now - at < 0.1;
      const n = Math.max(1, Math.ceil(elapsed / (1 / 120)));
      const h = elapsed / n;
      for (let i = 0; i < n; i++) {
        vx += ((live ? ax * 2.8 : 0) - 16 * x - 8 * vx) * h;
        vz += ((live ? az * 2.8 : 0) - 16 * z - 8 * vz) * h;
        vx = clamp(vx, -2.5, 2.5); vz = clamp(vz, -2.5, 2.5);
        x = clamp(x + vx * h, -0.45, 0.45);
        z = clamp(z + vz * h, -0.32, 0.48);
        if (Math.abs(x) >= 0.45 && Math.sign(vx) === Math.sign(x)) vx = 0;
        if ((z <= -0.32 && vz < 0) || (z >= 0.48 && vz > 0)) vz = 0;
      }
      return { x, z };
    },
    reset() { x = z = vx = vz = ax = az = 0; at = -Infinity; },
  };
}
