// Casual table tennis. One game to 11. The Neighbour serves every point.
// Shot speed, timing, aim and spin live in rules.js so the tests can call them directly.

import {
  RULES,
  aimTarget,
  clamp,
  feedbackWords,
  gameWon,
  judgeLanding,
  judgeNet,
  mulberry32,
  serverForScore,
  shotFromPeak,
  signedPull,
  spinFromRoll,
  spinTimeScale,
} from './rules.js';

const SUB = 8;

function launch({ x, y, z, destX, destZ, speed, kind, spin, clearNet }) {
  const dx = destX - x;
  const dz = destZ - z;
  const dist = Math.max(0.2, Math.hypot(dx, dz));
  let horiz = kind === 'push' ? 0.58 : kind === 'smash' ? 0.97 : 0.86;
  let solved = null;
  for (let i = 0; i < 18; i++) {
    const vh = Math.max(1.2, speed * horiz);
    const t = dist / vh;
    const vy = (RULES.ballR - y + 0.5 * RULES.gravity * t * t) / t;
    const vx = dx / t;
    const vz = dz / t;
    const yNet = yAtTime(y, vy, (RULES.netZ - z) / vz, RULES.gravity);
    const need = RULES.netHeight + RULES.ballR;
    solved = { vx, vy, vz, yNet, t };
    if (!clearNet || yNet >= need || !(vz < 0 || vz > 0)) break;
    if (yNet >= need) break;
    horiz *= 0.84;
  }
  const scale = spinTimeScale(spin);
  return {
    vx: solved.vx / scale,
    vy: solved.vy / scale,
    vz: solved.vz / scale,
    g: RULES.gravity / (scale * scale),
    yNet: solved.yNet,
    flight: solved.t * scale,
  };
}

function yAtTime(y, vy, t, g) {
  if (!Number.isFinite(t) || t < 0) return y;
  return y + vy * t - 0.5 * g * t * t;
}

// A serve that is still about 0.4 m up when it crosses the hit plane.
function lobToPlane(speed, destX) {
  const fromZ = RULES.tableLength - RULES.hitZ;
  const fromY = 0.52;
  const targetY = 0.4;
  let lo = 0.28;
  let hi = 1.35;
  let best = null;
  for (let i = 0; i < 22; i++) {
    const t = (lo + hi) / 2;
    const vx = destX / t;
    const vz = (RULES.hitZ - fromZ) / t;
    const vy = (targetY - fromY + 0.5 * RULES.gravity * t * t) / t;
    const mag = Math.hypot(vx, vy, vz);
    best = { x: 0, y: fromY, z: fromZ, vx, vy, vz, g: RULES.gravity, t, mag };
    if (mag > speed) lo = t;
    else hi = t;
  }
  return best;
}

function freshBall(parts) {
  return {
    x: 0,
    y: 0.4,
    z: 2.2,
    vx: 0,
    vy: 0,
    vz: -5,
    g: RULES.gravity,
    spinType: 'none',
    spinLevel: 0,
    bounces: 0,
    hitter: 'neighbour',
    ...parts,
  };
}

export function createMatch(opts = {}) {
  const rng = mulberry32(opts.seed == null ? 1 : opts.seed);
  const events = [];
  let started = false;
  let time = 0;
  let you = 0;
  let neighbour = 0;
  let phase = 'wait';
  let ball = freshBall();
  let ballId = 1;
  let pointNumber = 1;
  let rallyHits = 0;
  let hitstop = 0;
  let feedback = [];
  let feedbackUntil = 0;
  let lastShot = null;
  let pending = null;
  let cooldownUntil = -1;
  let pointStart = 0;
  let nextServeAt = 0;
  let pointOver = false;
  let pointJustAwarded = false;
  let gameJustEnded = false;
  let lastPointWinner = null;
  let gameWinner = null;
  let gameOver = false;
  let paused = false;
  let hookLive = false;
  let neighbourReadyAt = Infinity;
  let neighbourActed = false;
  let neighbourWillMiss = false;
  let whiffed = false;
  let pointsPlayed = 0;
  let neighbourPoints = 0;
  let gamesPlayed = 0;
  let neighbourGames = 0;
  let lastContact = null;
  let lastLanding = null;
  let bat = { x: 0, depth: RULES.batHomeZ, roll: 0 };
  let shake = 0;
  let nudge = 0;
  let bounceRing = 0;
  let squashed = false;

  function hookActive() {
    return hookLive;
  }

  function crossTime() {
    // The bat's depth is the contact plane. Side reach is checked when the swing fires.
    const plane = bat.depth;
    if (!(ball.vz < -0.05) || ball.z <= plane) {
      if (ball.z <= plane && ball.hitter === 'neighbour') return time;
      return null;
    }
    return time + (plane - ball.z) / ball.vz;
  }

  function take(type, extra) {
    events.push({ type, t: time, ...extra });
  }

  function beginPoint() {
    pointOver = false;
    pointJustAwarded = false;
    gameJustEnded = false;
    rallyHits = 0;
    whiffed = false;
    pending = null;
    neighbourActed = false;
    neighbourWillMiss = false;
    lastShot = null;
    squashed = false;
    bounceRing = 0;
    hookLive = you === 0 && neighbour === 0;
    const fromZ = RULES.tableLength - RULES.hitZ;
    if (hookLive) {
      // 5 m/s class feed: high, no spin, through the hit plane at about 0.48 m.
      const feed = 5 / Math.hypot(4.36, 2.35);
      ball = freshBall({
        x: 0,
        y: 0.58,
        z: fromZ,
        vx: 0,
        vy: 4.36 * feed,
        vz: -2.35 * feed,
        g: RULES.gravity,
        spinType: 'none',
        spinLevel: 0,
        hitter: 'neighbour',
        bounces: 0,
      });
    } else {
      const speed = RULES.neighbourSpeedMin + rng() * (RULES.neighbourSpeedMax - RULES.neighbourSpeedMin);
      const destX = (rng() * 2 - 1) * RULES.neighbourSpread;
      const shot = lobToPlane(speed, destX);
      ball = freshBall({
        ...shot,
        spinType: 'none',
        spinLevel: 0,
        hitter: 'neighbour',
        bounces: 0,
      });
    }
    ballId += 1;
    phase = 'incoming';
    pointStart = time;
    neighbourReadyAt = Infinity;
  }

  function start() {
    if (started) return;
    started = true;
    beginPoint();
  }

  function award(winner) {
    if (pointOver || gameOver) return;
    pointOver = true;
    phase = 'pause';
    if (winner === 'you') you += 1;
    else {
      neighbour += 1;
      neighbourPoints += 1;
    }
    lastPointWinner = winner;
    pointsPlayed += 1;
    pointJustAwarded = true;
    take(winner === 'you' ? 'point-you' : 'point-neighbour', { rallyHits, hook: hookLive });
    if (winner === 'you' && hookLive && you === 1 && neighbour === 0) take('ooh');
    if (winner === 'you') take('clap', { big: rallyHits >= RULES.crowdRally });
    if (gameWon(you, neighbour)) {
      gameOver = true;
      gameWinner = you > neighbour ? 'you' : 'neighbour';
      gameJustEnded = true;
      gamesPlayed += 1;
      if (gameWinner === 'neighbour') neighbourGames += 1;
      phase = 'gameover';
      take('game', { winner: gameWinner });
    } else {
      nextServeAt = time + 0.55;
    }
    hookLive = false;
  }

  function applyStrike(cmd, offsetMs) {
    const hook = hookActive();
    const timing = signedPull(offsetMs, cmd.dir || 'forehand', hook);
    if (timing.band === 'miss') {
      whiffed = true;
      take('whoosh', { peak: cmd.degPerSec });
      lastShot = { band: 'miss', speed: 0, kind: null, offsetMs, pullDeg: 0 };
      return;
    }
    let picked = shotFromPeak(cmd.degPerSec, ball.y);
    if (!picked.kind) {
      take('whoosh', { peak: cmd.degPerSec });
      return;
    }
    let speed = picked.speed * timing.speedMul;
    let kind = picked.kind;
    let band = timing.band;
    let pullDeg = timing.pullDeg;
    if (hook) {
      kind = 'drive';
      speed = RULES.driveSpeed * RULES.perfectSpeed;
      band = 'perfect';
      pullDeg = 0;
    }
    if ((Number(cmd.accel) || 0) > RULES.accelBoost) speed *= RULES.accelBoostMul;
    const dxBat = Math.abs(ball.x - bat.x);
    const dzBat = Math.abs(ball.z - bat.depth);
    if (dxBat > RULES.reachX || dzBat > RULES.reachZ) {
      whiffed = true;
      take('whoosh', { peak: cmd.degPerSec });
      lastShot = {
        band: 'miss',
        speed: 0,
        kind: null,
        offsetMs,
        pullDeg: 0,
        reason: 'reach',
        batX: bat.x,
        batDepth: bat.depth,
      };
      return;
    }
    const spin = hook ? { type: 'none', level: 0 } : spinFromRoll(cmd.rollDegPerSec);
    const aim = aimTarget(cmd.tiltX, cmd.tiltY);
    const dx = aim.x - ball.x;
    const dz = aim.z - ball.z;
    const rad = (pullDeg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const rdx = dx * c + dz * s;
    const rdz = -dx * s + dz * c;
    const destX = ball.x + rdx;
    const destZ = ball.z + Math.max(0.25, rdz);
    const flown = launch({
      x: ball.x,
      y: Math.max(ball.y, RULES.ballR + 0.02),
      z: ball.z,
      destX,
      destZ,
      speed,
      kind,
      spin,
      clearNet: kind === 'push' || hook,
    });
    ball.y = Math.max(ball.y, RULES.ballR + 0.02);
    ball.vx = flown.vx;
    ball.vy = flown.vy;
    ball.vz = flown.vz;
    ball.g = flown.g;
    ball.spinType = spin.type;
    ball.spinLevel = spin.level;
    ball.bounces = 0;
    ball.hitter = 'you';
    ballId += 1;
    rallyHits += 1;
    phase = 'outgoing';
    neighbourActed = false;
    neighbourWillMiss = !hook && rng() < RULES.neighbourError;
    neighbourReadyAt = hook ? Infinity : time + RULES.neighbourDelay;
    const perfect = band === 'perfect';
    hitstop = perfect ? RULES.hitstopPerfect : RULES.hitstop;
    nudge = Math.sign(ball.vx || pullDeg || 1) * RULES.nudgePx;
    shake = kind === 'smash' ? RULES.smashShake : 0;
    feedback = feedbackWords(band, spin);
    feedbackUntil = time + RULES.feedbackMs / 1000;
    lastShot = {
      kind,
      speed,
      band,
      pullDeg,
      offsetMs,
      aimX: aim.x,
      aimZ: aim.z,
      destX,
      destZ,
      spin: spin.type,
      spinLevel: spin.level,
      hook,
      yNet: flown.yNet,
      accel: Number(cmd.accel) || 0,
      struckAt: time,
      batX: bat.x,
      batDepth: bat.depth,
    };
    lastContact = { x: ball.x, y: ball.y, z: ball.z, kind };
    lastLanding = null;
    take('whoosh', { peak: cmd.degPerSec });
    take('pock', { kind, speed, perfect, x: ball.x });
    take('vibrate', { ms: kind === 'smash' ? RULES.vibrateSmash : RULES.vibrateHit });
    if (hook) take('hook');
  }

  function neighbourStrike() {
    neighbourActed = true;
    if (neighbourWillMiss) {
      const shot = launch({
        x: ball.x,
        y: Math.max(ball.y, 0.2),
        z: ball.z,
        destX: RULES.halfWidth + 0.2,
        destZ: 0.4,
        speed: 8,
        kind: 'drive',
        spin: { type: 'top', level: 1 },
        clearNet: false,
      });
      ball.vx = shot.vx;
      ball.vy = shot.vy;
      ball.vz = shot.vz;
      ball.g = shot.g;
      ball.spinType = 'top';
      ball.spinLevel = 1;
      ball.bounces = 0;
      ball.hitter = 'neighbour';
      ballId += 1;
      phase = 'incoming';
      rallyHits += 1;
      take('pock', { kind: 'drive', speed: 8, x: ball.x, who: 'neighbour' });
      return;
    }
    const speed = RULES.neighbourSpeedMin + rng() * (RULES.neighbourSpeedMax - RULES.neighbourSpeedMin);
    const destX = clamp((rng() * 2 - 1) * RULES.neighbourSpread, -RULES.neighbourSpread, RULES.neighbourSpread);
    const destZ = 0.55 + rng() * 0.45;
    const spin = { type: 'top', level: 1 };
    const shot = launch({
      x: ball.x,
      y: Math.max(ball.y, 0.18),
      z: ball.z,
      destX,
      destZ,
      speed,
      kind: 'drive',
      spin,
      clearNet: true,
    });
    ball.y = Math.max(ball.y, 0.18);
    ball.vx = shot.vx;
    ball.vy = shot.vy;
    ball.vz = shot.vz;
    ball.g = shot.g;
    ball.spinType = 'top';
    ball.spinLevel = 1;
    ball.bounces = 0;
    ball.hitter = 'neighbour';
    ballId += 1;
    phase = 'incoming';
    rallyHits += 1;
    whiffed = false;
    pending = null;
    take('pock', { kind: 'drive', speed, x: ball.x, who: 'neighbour' });
  }

  function onLand(x, z) {
    squashed = true;
    bounceRing = 0.2;
    const calledPre = judgeLanding(x, z);
    lastLanding = { x, z, t: time, ...calledPre };
    const overTable = z >= -0.02 && z <= RULES.tableLength + RULES.forgive + 0.02
      && Math.abs(x) <= RULES.halfWidth + RULES.forgive + 0.02;
    const called = calledPre;
    const left = called.call === 'out' || !overTable;
    if (left && called.call === 'out') {
      take(ball.bounces >= 1 ? 'tik' : 'floor', { x });
      // A ball that already bounced in is the receiver's miss. A first bounce out is the hitter's fault.
      if (ball.bounces >= 1) award(ball.hitter);
      else award(ball.hitter === 'you' ? 'neighbour' : 'you');
      ball.vy = Math.abs(ball.vy) * 0.28;
      ball.y = 0;
      return;
    }
    if (called.nudged) {
      ball.x = called.x;
      ball.z = called.z;
    } else {
      ball.x = x;
      ball.z = z;
    }
    ball.y = RULES.ballR;
    ball.vy = Math.abs(ball.vy) * 0.78;
    if (ball.spinType === 'top' && ball.spinLevel) {
      const fwd = Math.hypot(ball.vx, ball.vz) || 1;
      ball.vx += (ball.vx / fwd) * 0.45 * ball.spinLevel;
      ball.vz += (ball.vz / fwd) * 0.45 * ball.spinLevel;
      ball.vy *= 0.62;
    } else if (ball.spinType === 'back' && ball.spinLevel) {
      const fwd = Math.hypot(ball.vx, ball.vz) || 1;
      ball.vx -= (ball.vx / fwd) * 0.55 * ball.spinLevel;
      ball.vz -= (ball.vz / fwd) * 0.55 * ball.spinLevel;
      ball.vy *= 1.28;
    }
    ball.bounces += 1;
    take('tik', { x: ball.x });
    const half = ball.z >= RULES.netZ ? 'neighbour' : 'you';
    if (ball.hitter === half && ball.bounces === 1) {
      take('floor', { x: ball.x });
      award(ball.hitter === 'you' ? 'neighbour' : 'you');
      return;
    }
    if (ball.bounces >= 2) {
      award(ball.hitter);
    }
  }

  function crossNet(y0, z0, y1, z1) {
    if ((z0 - RULES.netZ) * (z1 - RULES.netZ) > 0) return;
    if (z0 === z1) return;
    const u = (RULES.netZ - z0) / (z1 - z0);
    if (u < 0 || u > 1) return;
    const y = y0 + (y1 - y0) * u;
    const call = judgeNet(y, true);
    if (call === 'clear') return;
    if (call === 'tape') {
      ball.y = Math.max(ball.y, RULES.netHeight + RULES.ballR + 0.01);
      take('tape', { y });
      return;
    }
    take('net', { y });
    ball.vz *= -0.25;
    ball.vy *= 0.4;
    award(ball.hitter === 'you' ? 'neighbour' : 'you');
  }

  function stepOnce(dt) {
    if (phase !== 'incoming' && phase !== 'outgoing') return;
    const x0 = ball.x;
    const y0 = ball.y;
    const z0 = ball.z;
    const vy0 = ball.vy;
    ball.y += vy0 * dt - 0.5 * ball.g * dt * dt;
    ball.vy = vy0 - ball.g * dt;
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    if (!pointOver) crossNet(y0, z0, ball.y, ball.z);
    if (pointOver) return;
    if (y0 >= RULES.ballR && ball.y < RULES.ballR) {
      const u = (RULES.ballR - y0) / (ball.y - y0);
      const lx = x0 + (ball.x - x0) * u;
      const lz = z0 + (ball.z - z0) * u;
      onLand(lx, lz);
    } else if (ball.y < -0.4) {
      award(ball.hitter === 'you' ? 'neighbour' : 'you');
    }
  }

  function thinkNeighbour() {
    if (phase !== 'outgoing' || neighbourActed || pointOver || hookLive) return;
    if (time + 1e-9 < neighbourReadyAt) return;
    // He plays the ball after it has bounced on his half, once he has had 260 ms.
    if (ball.hitter !== 'you' || ball.bounces !== 1) return;
    if (ball.z <= RULES.netZ || ball.z > RULES.tableLength + 0.02) return;
    if (ball.y > 1.15) return;
    if (Math.abs(ball.x) > RULES.halfWidth + RULES.forgive) return;
    neighbourStrike();
  }

  function firePending() {
    if (!pending || phase !== 'incoming' || pointOver) return;
    if (time + 1e-6 < pending.when) return;
    const cmd = pending.cmd;
    const offsetMs = pending.offsetMs;
    pending = null;
    applyStrike(cmd, offsetMs);
  }

  function swing(cmd) {
    if (!started || gameOver || paused) return { ignored: true, reason: 'idle' };
    if (phase !== 'incoming') return { ignored: true, penalty: false, reason: 'away' };
    if (time < cooldownUntil) return { ignored: true, penalty: false, reason: 'cooldown' };
    const offsetMs = cmd.offsetMs == null
      ? (() => {
        const cross = crossTime();
        return cross == null ? 0 : (time - cross) * 1000;
      })()
      : Number(cmd.offsetMs);
    const cross = crossTime();
    const when = cmd.offsetMs == null || cross == null ? time : cross + offsetMs / 1000;
    cooldownUntil = time + RULES.cooldown;
    pending = { cmd, offsetMs, when: Math.max(time, when) };
    if (pending.when <= time + 1e-6) firePending();
    return { accepted: true, offsetMs };
  }

  function step() {
    pointJustAwarded = false;
    gameJustEnded = false;
    squashed = false;
    if (bounceRing > 0) bounceRing = Math.max(0, bounceRing - 1 / 60);
    if (nudge !== 0) nudge *= 0.8;
    if (Math.abs(nudge) < 0.2) nudge = 0;
    if (shake > 0) shake = Math.max(0, shake - 1);
    const frameEvents = [];
    events.length = 0;
    if (!started || phase === 'gameover') {
      time += 1 / 60;
      return snapshot(frameEvents);
    }
    if (paused) {
      time += 1 / 60;
      return snapshot(frameEvents);
    }
    if (hitstop > 0) {
      hitstop = Math.max(0, hitstop - 1 / 60);
      time += 1 / 60;
      return snapshot(frameEvents);
    }
    if (phase === 'pause') {
      time += 1 / 60;
      if (!gameOver && time >= nextServeAt) {
        pointNumber += 1;
        beginPoint();
      }
      return snapshot(frameEvents);
    }
    if (phase === 'wait') {
      time += 1 / 60;
      return snapshot(frameEvents);
    }
    const dt = (1 / 60) / SUB;
    let frozen = false;
    for (let i = 0; i < SUB; i++) {
      time += dt;
      if (frozen) continue;
      firePending();
      if (pointOver || hitstop > 0) { frozen = true; continue; }
      stepOnce(dt);
      if (pointOver || hitstop > 0) { frozen = true; continue; }
      thinkNeighbour();
    }
    if (!pointOver && time - pointStart > 9) {
      award(phase === 'incoming' ? 'neighbour' : 'you');
    }
    frameEvents.push(...events);
    return snapshot(frameEvents);
  }

  function snapshot(frameEvents) {
    return {
      time,
      score: { you, neighbour },
      server: serverForScore(you, neighbour),
      ball: {
        x: ball.x,
        y: ball.y,
        z: ball.z,
        vx: ball.vx,
        vy: ball.vy,
        vz: ball.vz,
        spinType: ball.spinType,
        spinLevel: ball.spinLevel,
        bounces: ball.bounces,
        hitter: ball.hitter,
        g: ball.g,
      },
      ballId,
      phase,
      lastShot,
      point: pointNumber,
      rallyHits,
      hitstop,
      feedback: time < feedbackUntil ? feedback.slice() : [],
      gameOver,
      paused,
      hook: hookLive,
      pointsPlayed,
      neighbourPoints,
      gamesPlayed,
      neighbourGames,
      pointJustAwarded,
      gameJustEnded,
      lastPointWinner,
      gameWinner,
      events: frameEvents || events.slice(),
      nudge,
      shake,
      bounceRing,
      squashed,
      lastContact,
      lastLanding,
      crossIn: (() => {
        const cross = crossTime();
        return cross == null ? null : cross - time;
      })(),
      bat: { x: bat.x, depth: bat.depth, roll: bat.roll },
    };
  }

  function setBat(next = {}) {
    const xIn = Number(next.x);
    const depthIn = Number(next.depth);
    const rollIn = Number(next.roll);
    bat = {
      x: clamp(Number.isFinite(xIn) ? xIn : bat.x, -RULES.halfWidth, RULES.halfWidth),
      depth: clamp(Number.isFinite(depthIn) ? depthIn : bat.depth, RULES.batBackZ, RULES.batInZ),
      roll: clamp(Number.isFinite(rollIn) ? rollIn : bat.roll, -50, 50),
    };
    return { x: bat.x, depth: bat.depth, roll: bat.roll };
  }

  function state() {
    return snapshot(events.slice());
  }

  if (opts.input === 'swing' || opts.autostart) start();

  return {
    start,
    step,
    swing,
    state,
    setBat,
    shock(accel) {
      if (accel > RULES.dropAccel) {
        paused = true;
        take('drop');
        return true;
      }
      return false;
    },
    resume() {
      paused = false;
    },
    nextGame() {
      you = 0;
      neighbour = 0;
      gameOver = false;
      gameWinner = null;
      paused = false;
      phase = 'wait';
      pointNumber += 1;
      start();
      beginPoint();
    },
    placeBall(parts) {
      ball = freshBall({ ...ball, ...parts });
      phase = parts.phase || 'outgoing';
      pointOver = false;
      started = true;
      hookLive = false;
      pending = null;
      if (parts.hitter) ball.hitter = parts.hitter;
    },
    stats() {
      return { pointsPlayed, neighbourPoints, gamesPlayed, neighbourGames };
    },
  };
}

export function createAverageBot(seed) {
  const rng = mulberry32(seed);
  let seen = -1;
  let plan = null;
  return {
    consider(match) {
      const s = match.state();
      if (s.gameOver || s.paused) return null;
      if (s.phase !== 'incoming') {
        seen = -1;
        plan = null;
        return null;
      }
      if (s.ballId !== seen) {
        seen = s.ballId;
        if (rng() < 0.08) {
          plan = { skip: true };
        } else {
          const roll = rng();
          const degPerSec = roll < 0.42 ? 480 : roll < 0.92 ? 860 : 1240;
          const offsetMs = (rng() + rng() - 1) * 70;
          plan = {
            skip: false,
            sent: false,
            degPerSec,
            dir: rng() < 0.62 ? 'forehand' : 'backhand',
            tiltX: (rng() - 0.5) * 10,
            tiltY: 6 + (rng() - 0.5) * 8,
            rollDegPerSec: rng() < 0.45 ? 860 : 30,
            offsetMs,
          };
        }
      }
      if (!plan || plan.skip) return null;
      // The bot puts the bat on the ball. Depth stays on the old hit plane so timing matches.
      match.setBat({ x: s.ball.x, depth: RULES.hitZ, roll: 0 });
      if (plan.sent) return null;
      const bounced = s.ball.bounces >= 1 || s.ball.z <= 0.55;
      if (!bounced || s.crossIn == null) return null;
      const due = -plan.offsetMs / 1000;
      if (s.crossIn > due + 0.012) return null;
      plan.sent = true;
      return { ...plan, offsetMs: Math.max(-200, Math.min(200, -s.crossIn * 1000)) };
    },
  };
}

export function simulateWinRate(seed = 1, targetPoints = 1000) {
  const match = createMatch({ seed, input: 'swing' });
  const bot = createAverageBot(seed + 17);
  let steps = 0;
  const cap = targetPoints * 60 * 12;
  while (steps < cap) {
    const s = match.state();
    if (s.pointsPlayed >= targetPoints && (s.phase === 'pause' || s.gameOver || s.phase === 'wait')) break;
    const cmd = bot.consider(match);
    if (cmd) match.swing(cmd);
    match.step();
    if (match.state().gameJustEnded) match.nextGame();
    steps += 1;
  }
  const stats = match.stats();
  return {
    ...stats,
    rate: stats.pointsPlayed ? stats.neighbourPoints / stats.pointsPlayed : 0,
    gameRate: stats.gamesPlayed ? stats.neighbourGames / stats.gamesPlayed : 0,
    steps,
  };
}
