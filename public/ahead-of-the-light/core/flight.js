// Ahead of the Light: one run. You fly the canyon home while the burst's light comes up behind you. Steer to strafe
// and climb, BOOST burns charge for speed, SONAR pings the dark and marks the gates ahead. A gate gives charge and a
// kick of speed; skimming low over the ground trickles charge in; a hit costs shield, then hull, and most of your
// speed. The light is a little faster than you cruise, so the gap only grows when you fly well. Pure and seeded: the
// page, the bots and the tests all step the same code. step() fills run.events for the sound, the HUD and haptics.
import { createWorld, sectorAt, hardAt, COURSE_LEN, CEILING, GATE_R } from './world.js';

export const TUNE = Object.freeze({
  START_GAP: 420,        // m between you and the light at the launch
  CRUISE: 60, CRUISE_HARD: 26,  // your cruise speed, plus this much by Earth
  LIGHT_OVER: 19, LIGHT_HARD: 11, // the light's speed over your cruise, plus this much by Earth
  BOOST: 42, BOOST_DRAIN: 0.3, CHARGE_IN: 0.035,
  GATE_CHARGE: 0.3, GATE_KICK: 14, KICK_DECAY: 7,
  SKIM: 5, SKIM_EVERY: 0.25, SKIM_CHARGE: 0.02,
  STRAFE: 26, STRAFE_K: 0.3, CLIMB: 28, RESPOND: 5,
  HIT: 34, HIT_SLOW: 0.5, SLOW_BACK: 0.45, HIT_COOL: 0.6,
  SHIELD_BACK: 12, SHIELD_WAIT: 2, EXPOSED: 24,
  PING_COOL: 2.2, PING_REACH: 650, MARK_FOR: 7, PING_SPEED: 420,
  WARN_GAP: 120,
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function newRun({ seed = 1, tune = TUNE } = {}) {
  const world = createWorld(seed);
  const y0 = world.height(world.centre(0), 0) + 12;
  return {
    seed, tune, world, t: 0, mode: 'fly', events: [],
    ship: { x: world.centre(0), y: y0, d: 0, vx: 0, vy: 0, speed: tune.CRUISE, kick: 0, slow: 1, hull: 100,
      shield: 100, charge: 0.5, boosting: false, hurtAt: -9, hitCool: 0, skimT: 0, exposed: false, alt: 12 },
    light: { d: -tune.START_GAP, speed: tune.CRUISE + tune.LIGHT_OVER },
    ping: { t0: -9, cool: 0 },
    gates: { i: 2, chain: 0, best: 0 },
    marks: new Map(),       // gate index → marked until this time
    sector: 0, gear: 0, warned: false,
    stats: { gates: 0, missed: 0, skims: 0, hits: 0, pings: 0, boostS: 0, closest: tune.START_GAP },
  };
}

export const gapOf = (run) => run.ship.d - run.light.d;
export const progressOf = (run) => clamp(run.ship.d / COURSE_LEN, 0, 1);

// Damage: the shield takes it first, then the hull.
function hurt(run, amount) {
  const s = run.ship;
  const fromShield = Math.min(s.shield, amount);
  s.shield -= fromShield;
  s.hull = Math.max(0, s.hull - (amount - fromShield));
  s.hurtAt = run.t;
  if (fromShield > 0 && s.shield <= 0) run.events.push({ type: 'shieldPop', ship: 'you' });
}

// One step. input: { x, y } in -1..1 (strafe right, climb), boost (held), ping (pressed this step).
export function step(run, input, dt) {
  run.events.length = 0;
  if (run.mode !== 'fly') return run;
  const T = run.tune, s = run.ship, W = run.world;
  run.t += dt;
  const hard = hardAt(s.d);
  // steering
  const ix = clamp(input.x || 0, -1, 1), iy = clamp(input.y || 0, -1, 1);
  const k = Math.min(1, dt * T.RESPOND);
  s.vx += (ix * (T.STRAFE + T.STRAFE_K * s.speed) - s.vx) * k;
  s.vy += (iy * T.CLIMB - s.vy) * k;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  // speed: cruise, a gate's kick, the boost, the slow after a hit
  s.charge = clamp(s.charge + T.CHARGE_IN * dt, 0, 1);
  const wasBoost = s.boosting;
  s.boosting = Boolean(input.boost) && s.charge > 0.01;
  if (s.boosting) { s.charge = Math.max(0, s.charge - T.BOOST_DRAIN * dt); run.stats.boostS += dt; }
  if (s.boosting && !wasBoost) run.events.push({ type: 'burn', ship: 'you' });
  s.kick = Math.max(0, s.kick - T.KICK_DECAY * dt);
  s.slow = Math.min(1, s.slow + T.SLOW_BACK * dt);
  const cruise = T.CRUISE + T.CRUISE_HARD * hard;
  const want = (cruise + s.kick + (s.boosting ? T.BOOST : 0)) * s.slow;
  s.speed += (want - s.speed) * Math.min(1, dt * 2.2);
  const d0 = s.d;
  s.d += s.speed * dt;
  // the ground: a hit bounces you up and away from the slope
  s.hitCool = Math.max(0, s.hitCool - dt);
  const g = W.height(s.x, s.d);
  s.alt = s.y - g;
  if (s.alt < 1.5) {
    s.y = g + 3;
    s.vy = Math.max(s.vy, 14);
    const slope = W.height(s.x + 1, s.d) - W.height(s.x - 1, s.d);
    if (Math.abs(slope) > 0.6) s.vx = -Math.sign(slope) * 16;
    if (s.hitCool <= 0) {
      s.hitCool = T.HIT_COOL;
      s.slow = Math.min(s.slow, T.HIT_SLOW);
      hurt(run, T.HIT);
      run.stats.hits++;
      run.events.push({ type: 'hit', ship: 'you', side: Math.sign(slope) || 0 });
      if (run.gates.chain > 1) run.events.push({ type: 'chainEnd', ship: 'you', chain: run.gates.chain });
      run.gates.chain = 0;
    }
  } else if (s.alt < T.SKIM) {
    s.skimT += dt;
    if (s.skimT >= T.SKIM_EVERY) {
      s.skimT -= T.SKIM_EVERY;
      s.charge = Math.min(1, s.charge + T.SKIM_CHARGE);
      run.stats.skims++;
      const slope = W.height(s.x + 2, s.d) - W.height(s.x - 2, s.d);
      run.events.push({ type: 'graze', ship: 'you', side: Math.sign(slope), chain: 1 + (run.stats.skims % 5) });
    }
  } else s.skimT = 0;
  // above the canyon the burst's light reaches you
  if (s.y > CEILING + 30) { s.y = CEILING + 30; s.vy = Math.min(0, s.vy); }
  const exposed = s.y > CEILING;
  if (exposed) hurt(run, T.EXPOSED * dt);
  if (exposed && !s.exposed) run.events.push({ type: 'glareIn', ship: 'you' });
  s.exposed = exposed;
  if (run.t - s.hurtAt > T.SHIELD_WAIT && s.shield < 100) {
    const was = s.shield;
    s.shield = Math.min(100, s.shield + T.SHIELD_BACK * dt);
    if (was <= 0 && s.shield > 0) run.events.push({ type: 'shieldBack', ship: 'you' });
  }
  // the gates you pass this step
  for (;;) {
    const gt = W.gate(run.gates.i);
    if (!gt) { if (run.gates.i * 170 > COURSE_LEN) break; run.gates.i++; continue; }
    if (gt.d > s.d) break;
    if (gt.d > d0 - 1) {
      const off = Math.hypot(s.x - gt.x, s.y - gt.y);
      if (off <= GATE_R) {
        run.gates.chain++;
        run.gates.best = Math.max(run.gates.best, run.gates.chain);
        run.stats.gates++;
        s.charge = Math.min(1, s.charge + T.GATE_CHARGE);
        s.kick = T.GATE_KICK;
        run.events.push({ type: 'grab', ship: 'you', gate: gt.i, chain: run.gates.chain, off });
      } else {
        run.stats.missed++;
        if (run.gates.chain > 1) run.events.push({ type: 'chainEnd', ship: 'you', chain: run.gates.chain });
        run.gates.chain = 0;
        run.events.push({ type: 'miss', ship: 'you', gate: gt.i, off });
      }
    }
    run.marks.delete(gt.i);
    run.gates.i++;
  }
  // sonar
  run.ping.cool = Math.max(0, run.ping.cool - dt);
  if (input.ping && run.ping.cool <= 0) {
    run.ping.t0 = run.t;
    run.ping.cool = T.PING_COOL;
    run.stats.pings++;
    let n = 0;
    for (let i = run.gates.i; ; i++) {
      const gt = W.gate(i);
      if (!gt) { if (i * 170 > COURSE_LEN) break; continue; }
      if (gt.d - s.d > T.PING_REACH) break;
      run.marks.set(i, run.t + T.MARK_FOR);
      n++;
    }
    run.events.push({ type: 'ping', ship: 'you', marked: n });
  }
  for (const [i, until] of run.marks) if (until < run.t) run.marks.delete(i);
  // the light
  run.light.speed = cruise + T.LIGHT_OVER + T.LIGHT_HARD * hard;
  run.light.d += run.light.speed * dt;
  const gap = gapOf(run);
  run.stats.closest = Math.min(run.stats.closest, gap);
  if (gap < T.WARN_GAP && !run.warned) { run.warned = true; run.events.push({ type: 'warn', ship: 'you' }); }
  if (gap > T.WARN_GAP * 1.5) run.warned = false;
  // sectors and the music's gear: the score builds over the whole run
  const sec = sectorAt(s.d);
  if (sec !== run.sector) { run.sector = sec; run.events.push({ type: 'sector', ship: 'you', sector: sec }); }
  const gear = clamp(Math.floor(progressOf(run) * 5), 0, 4);
  if (gear > run.gear) { run.gear = gear; run.events.push({ type: 'gearUp', ship: 'you', gear, best: gear === 4 }); }
  // the end
  if (s.hull <= 0) { run.mode = 'wreck'; run.events.push({ type: 'wreck', ship: 'you' }); }
  else if (gap <= 0) { run.mode = 'caught'; run.events.push({ type: 'caught', ship: 'you' }); }
  else if (s.d >= COURSE_LEN) { run.mode = 'home'; run.events.push({ type: 'land', ship: 'you', ok: true }); }
  return run;
}
