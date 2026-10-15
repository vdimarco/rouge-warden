// Swing speed from rotationRate. No sensor objects here.

import { RULES } from './rules.js';

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
