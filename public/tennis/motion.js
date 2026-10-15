// Tilt, flick, and frame-catch-up numbers for Lawn Tennis. No sensors here.

export const TILT = Object.freeze({
  dead: 3,
  full: 25,
  smooth: 0.25,
  spike: 40,
  depth: 0.4,
  cooldown: 0.35,
  freeze: 0.25,
  flickStart: 250,
  flickOpening: 150,
  dropMax: 450,
  driveMax: 900,
  accelStart: 12,
  run: 4.6,
});

export function axisAmount(deg, full = TILT.full, dead = TILT.dead) {
  const amount = Math.abs(deg);
  if (!(amount > dead)) return 0;
  const span = Math.max(1, full - dead);
  const t = Math.min(1, (amount - dead) / span);
  return Math.sign(deg) * t;
}

export function lowPass(prev, raw, spike = TILT.spike, mix = TILT.smooth) {
  const delta = Math.max(-spike, Math.min(spike, raw - prev));
  const limited = prev + delta;
  return prev + mix * (limited - prev);
}

export function magnetPull(ai, point, hits) {
  if (ai === 'pro') return 0;
  if (hits < 3) return 0.6;
  if (point <= 1) return 0.35;
  if (point <= 4) return 0.2;
  return 0.1;
}

// Opening lobs accept a softer flick. Over 900 on a low ball is a hard drive.
export function flickKind(peak, ball, opening) {
  const start = opening ? TILT.flickOpening : TILT.flickStart;
  if (!(peak >= start)) return null;
  if (peak < TILT.dropMax) return 'drop';
  if (peak <= TILT.driveMax) return 'flat';
  const high = ball.z > 1.15 || ball.y < 6.35;
  return high ? 'smash' : 'flat';
}

export function accelToPeak(mps2) {
  if (!(mps2 > TILT.accelStart)) return 0;
  return TILT.flickStart * (mps2 / TILT.accelStart);
}

export function mapAxes(beta, gamma, angle) {
  const turn = ((Number(angle) || 0) % 360 + 360) % 360;
  if (turn === 90 || turn === 270) return { beta: gamma, gamma: beta };
  return { beta, gamma };
}

// A steer drag must not also swing. Vertical and diagonal drags are the same.
// A tap, a hold in place, or a swipe up still swings.
export function releaseSwing({ steered, dx, dy, held }) {
  if (steered) return null;
  if (dy < -48 && Math.abs(dy) > Math.abs(dx) && held < 450) return 'smash';
  if (Math.hypot(dx, dy) > 28) return null;
  if (held >= 180) return 'lob';
  return 'flat';
}

// ?fast=1 used to add more time than the 8-step cap could play, then drop the rest.
export function planFrame(acc, elapsed, fast) {
  const scale = fast ? 4 : 1;
  const cap = fast ? 0.5 : 0.1;
  let next = acc + Math.min(cap, Math.max(0, elapsed)) * scale;
  const budget = fast ? 180 : 8;
  const dt = 1 / 60;
  let steps = 0;
  while (next >= dt - 1e-8 && steps < budget) {
    next -= dt;
    steps += 1;
  }
  if (steps >= budget) next = Math.min(next, dt);
  return { acc: next, steps };
}
