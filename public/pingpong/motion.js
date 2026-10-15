// Swing speed from rotationRate, and the bat pose from orientation. No sensor objects here.

import { RULES, clamp } from './rules.js';

export function sampleSpeed(sample) {
  return Math.hypot(Number(sample.alpha) || 0, Number(sample.beta) || 0);
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

// Portrait gamma is side tilt. In landscape the axes swap, same as Lawn Tennis.
export function mapAxes(beta, gamma, angle) {
  const turn = ((Number(angle) || 0) % 360 + 360) % 360;
  if (turn === 90 || turn === 270) return { beta: gamma, gamma: beta };
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

// gamma (side tilt / roll) sets x. beta (forward positive) sets depth.
// Aim is a separate map: the same angles at the swing still pick the landing spot.
export function batFromTilt(tiltX, tiltY) {
  const side = axisPastDead(tiltX, RULES.batFullSide);
  const fore = axisPastDead(tiltY, RULES.batFullDepth);
  const x = side * RULES.batReachX;
  const depth = fore >= 0
    ? RULES.batHomeZ + fore * (RULES.batInZ - RULES.batHomeZ)
    : RULES.batHomeZ + fore * (RULES.batHomeZ - RULES.batBackZ);
  return { x, depth, side, fore };
}

// Casual assist: a light pull of x toward the ball's line. Depth stays with the player.
export function assistX(x, ballX, amount = RULES.assist) {
  const a = clamp(Number(amount) || 0, 0, 1);
  const cmd = Number(x) || 0;
  const line = Number(ballX) || 0;
  return cmd + a * (line - cmd);
}

// One-pole with a fixed time constant. alpha = 1 - exp(-dt/tau), from the
// exponential form in Casiez, Roussel and Vogel, 1€ Filter, CHI 2012.
// tau is 16 ms, so a moving phone is not dragged by a slow spring.
export function poseFilter(prev, raw, dt) {
  const step = clamp(Number(dt) || 1 / 60, 1 / 240, 0.08);
  const alpha = 1 - Math.exp(-step / RULES.batTau);
  const from = Number(prev) || 0;
  const target = Number(raw) || 0;
  return from + alpha * (target - from);
}

export function poseLag() {
  return RULES.batTau;
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
export function batPresentation({ roll, tiltY, push }) {
  const rollDeg = clamp(Number(roll) || 0, -50, 50);
  const pitch = clamp((Number(tiltY) || 0) / RULES.batFullDepth, -1.35, 1.35);
  const jab = clamp(Number(push) || 0, 0, 1);
  return {
    rollDeg,
    // A light squash and a shear, so the pitch reads and the paddle stays a paddle.
    scaleY: Math.max(0.86, 1 - pitch * 0.12),
    shear: -pitch * 0.32,
    pushZ: jab * RULES.swingPush,
  };
}
