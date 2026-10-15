// Numbers from the table-tennis spec and the look sheet. Pure helpers, no sensors.

export const RULES = Object.freeze({
  tableLength: 2.74,
  halfWidth: 0.76,
  netHeight: 0.1525,
  netZ: 1.37,
  ballR: 0.02,
  hitZ: 0.3,
  gravity: 9.81,
  swingStart: 300,
  pushMax: 600,
  driveMax: 1100,
  pushSpeed: 6,
  driveSpeed: 11,
  smashSpeed: 17,
  smashClearance: 0.15,
  peakWindow: 0.15,
  smoothSamples: 3,
  cooldown: 0.35,
  windowMs: 120,
  perfectMs: 40,
  hookWindowMs: 200,
  pullDeg: 25,
  perfectSpeed: 1.15,
  aimGamma: 30,
  aimX: 0.7,
  aimBeta: 20,
  shortPastNet: 0.3,
  spinStart: 200,
  spinDip: 0.15,
  spinLevels: 3,
  forgive: 0.08,
  accelBoost: 12,
  accelBoostMul: 1.1,
  dropAccel: 40,
  hitstop: 0.05,
  hitstopPerfect: 0.08,
  nudgePx: 4,
  smashShake: 3,
  calibrate: 0.3,
  hookServe: 5,
  neighbourDelay: 0.26,
  neighbourError: 0.18,
  neighbourSpeedMin: 6,
  neighbourSpeedMax: 9,
  neighbourSpread: 0.3,
  gamePoints: 11,
  winBy: 2,
  // Light pull toward the ball's line. The held pose keeps the other 85%.
  assist: 0.15,
  // Side tilt (gamma) and forward tilt (beta), degrees from the neutral pose.
  batDead: 2.5,
  batFullSide: 20,
  batFullDepth: 16,
  // Centre of the bat travels most of the 0.76 m half-width.
  batReachX: 0.74,
  batBackZ: 0.02,
  batHomeZ: 0.3,
  batInZ: 1.05,
  // One-pole time constant. Perceived lag is about this, under 50 ms.
  batTau: 0.016,
  reachX: 0.22,
  reachZ: 0.5,
  swingPush: 0.42,
  swipeFollow: 0.85,
  vibrateHit: 15,
  vibrateSmash: 30,
  trailDrive: 4,
  trailSmash: 8,
  feedbackMs: 500,
  crowdRally: 8,
  dprCap: 2,
  eyeHeight: 0.5,
  eyeBehind: 1.2,
  farWidth: 0.45,
  safePx: 56,
});

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shotFromPeak(peak, ballY) {
  const p = Number(peak) || 0;
  if (p < RULES.swingStart) return { kind: null, speed: 0 };
  if (p <= RULES.pushMax) return { kind: 'push', speed: RULES.pushSpeed };
  if (p <= RULES.driveMax) return { kind: 'drive', speed: RULES.driveSpeed };
  const high = ballY >= RULES.netHeight + RULES.smashClearance;
  if (high) return { kind: 'smash', speed: RULES.smashSpeed };
  return { kind: 'drive', speed: RULES.driveSpeed };
}

// offsetMs is negative when the swing is early. hook widens the window and treats it as perfect.
export function timingFromOffset(offsetMs, hook) {
  const edge = hook ? RULES.hookWindowMs : RULES.windowMs;
  const abs = Math.abs(Number(offsetMs) || 0);
  if (abs > edge) return { band: 'miss', pullDeg: 0, speedMul: 1 };
  if (hook || abs <= RULES.perfectMs) return { band: 'perfect', pullDeg: 0, speedMul: RULES.perfectSpeed };
  const span = edge - RULES.perfectMs;
  const mag = ((abs - RULES.perfectMs) / span) * RULES.pullDeg;
  const sign = offsetMs < 0 ? -1 : 1;
  return {
    band: offsetMs < 0 ? 'early' : 'late',
    pullDeg: sign * mag,
    speedMul: 1,
  };
}

export function aimTarget(tiltX, tiltY) {
  const x = clamp((Number(tiltX) || 0) / RULES.aimGamma, -1, 1) * RULES.aimX;
  const u = clamp((RULES.aimBeta - (Number(tiltY) || 0)) / (RULES.aimBeta * 2), 0, 1);
  const shortZ = RULES.netZ + RULES.shortPastNet;
  const z = shortZ + u * (RULES.tableLength - shortZ);
  return { x, z };
}

export function spinFromRoll(rollDegPerSec) {
  const roll = Number(rollDegPerSec) || 0;
  const mag = Math.abs(roll);
  if (mag <= RULES.spinStart) return { type: 'none', level: 0 };
  const type = roll > 0 ? 'top' : 'back';
  let level = 1;
  if (mag > 450) level = 2;
  if (mag > 750) level = 3;
  return { type, level };
}

// 1 is no change. Level 3 topspin is 0.85, so the ball dips 15% sooner.
export function spinTimeScale(spin) {
  if (!spin || !spin.level || spin.type === 'none') return 1;
  const mag = RULES.spinDip * (spin.level / RULES.spinLevels);
  if (spin.type === 'top') return 1 - mag;
  if (spin.type === 'back') return 1 + mag;
  return 1;
}

export function signedPull(offsetMs, dir, hook) {
  const timing = timingFromOffset(offsetMs, hook);
  if (timing.band === 'miss' || timing.band === 'perfect') return timing;
  const flip = dir === 'backhand' ? -1 : 1;
  return { ...timing, pullDeg: timing.pullDeg * flip };
}

// past is metres beyond the line. Compared in centimetres so 8.0 cm is in and 8.1 cm is out.
export function judgeLong(pastM, forgive = RULES.forgive) {
  if (!(pastM > 0)) return 'in';
  const pastCm = Math.round(pastM * 1000) / 10;
  const forgiveCm = Math.round(forgive * 1000) / 10;
  if (pastCm <= forgiveCm) return 'nudge';
  return 'out';
}

export function judgeLanding(x, z, forgive = RULES.forgive) {
  const longPast = z - RULES.tableLength;
  const shortPast = -z;
  const widePast = Math.abs(x) - RULES.halfWidth;
  const longCall = judgeLong(longPast, forgive);
  const shortCall = judgeLong(shortPast, forgive);
  const wideCall = judgeLong(widePast, forgive);
  if (longCall === 'out' || shortCall === 'out' || wideCall === 'out') {
    return { call: 'out', nudged: false, longPast, shortPast, widePast };
  }
  let nx = x;
  let nz = z;
  const nudged = longCall === 'nudge' || shortCall === 'nudge' || wideCall === 'nudge';
  if (wideCall === 'nudge') nx = Math.sign(x || 1) * (RULES.halfWidth - 0.005);
  if (longCall === 'nudge') nz = RULES.tableLength - 0.005;
  if (shortCall === 'nudge') nz = 0.005;
  return { call: 'in', nudged, x: nx, z: nz, longPast, shortPast, widePast };
}

export function judgeNet(y, tape = true) {
  const clear = RULES.netHeight + RULES.ballR;
  if (y >= clear) return 'clear';
  if (tape && y >= clear - 0.02) return 'tape';
  return 'net';
}

export function gameWon(you, them) {
  const hi = Math.max(you, them);
  return hi >= RULES.gamePoints && Math.abs(you - them) >= RULES.winBy;
}

// Neighbour serves first. Every two points the name changes. From 10-10, every point.
export function serverForScore(you, them) {
  const played = you + them;
  if (you >= 10 && them >= 10) return played % 2 === 0 ? 'neighbour' : 'you';
  return Math.floor(played / 2) % 2 === 0 ? 'neighbour' : 'you';
}

export function feedbackWords(band, spin) {
  const words = [];
  if (band === 'perfect') words.push('Perfect');
  else if (band === 'early') words.push('Early');
  else if (band === 'late') words.push('Late');
  if (spin && spin.type === 'top' && spin.level > 0) words.push('Topspin');
  if (spin && spin.type === 'back' && spin.level > 0) words.push('Backspin');
  return words;
}

export function readOptions(search) {
  const q = new URLSearchParams(search || '');
  const seedRaw = q.get('seed');
  const seed = seedRaw == null || seedRaw === '' ? 1 : Number(seedRaw);
  const input = q.get('input') || 'motion';
  return {
    seed: Number.isFinite(seed) ? seed : 1,
    fast: q.get('fast') === '1',
    input,
    skipGate: input === 'swing',
  };
}

// ?fast=1 plays four times as much sim time, and will not drop a whole frame of it.
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
