// Ahead of the Light: one run. You fly home down a tube of stars at the edge of light speed while the burst's light
// comes up behind you. Steer across and up and down; a star in your path is a hit (shield first, then hull, and most
// of your speed); slip past one close and it charges your boost; a spectral ring gives charge and a kick of speed;
// BOOST burns charge for speed. The light is a little faster than you cruise, so the gap only grows when you fly
// well. Pure and seeded: the page, the bots and the tests all step the same code. step() fills run.events.
import { createWorld, sectorAt, hardAt, COURSE_LEN, TUBE, SHIP_R, RING_R, RING_EVERY } from './world.js';

export const TUNE = Object.freeze({
  START_GAP: 520,                 // m between you and the light at the launch
  CALM: 1200, RAMP: 3600, CATCH_UP: 0.05,         // the light only matches your cruise for the first CALM m, then gains over RAMP m
  CRUISE: 60, CRUISE_HARD: 26,    // your cruise speed, plus this much by Earth
  LIGHT_OVER: 29, LIGHT_HARD: 14, // the light's speed over your cruise, plus this much by Earth
  BOOST: 42, BOOST_DRAIN: 0.3, CHARGE_IN: 0.035,
  RING_CHARGE: 0.25, RING_KICK: 22, KICK_DECAY: 7,
  GRAZE: 1.8, GRAZE_CHARGE: 0.08,  // a pass this close to a star's edge charges you
  STRAFE: 16, STRAFE_K: 0.05, RESPOND: 6,
  HIT: 26, HIT_SLOW: 0.62, SLOW_BACK: 0.5,
  SHIELD_BACK: 16, SHIELD_WAIT: 1.6,
  WARN_GAP: 120,
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function newRun({ seed = 1, tune = TUNE } = {}) {
  return {
    seed, tune, world: createWorld(seed), t: 0, mode: 'fly', events: [],
    ship: { x: 0, y: 0, d: 0, vx: 0, vy: 0, speed: tune.CRUISE, kick: 0, slow: 1, hull: 100, shield: 100,
      charge: 0.5, boosting: false, hurtAt: -9 },
    light: { d: -tune.START_GAP, speed: tune.CRUISE + tune.LIGHT_OVER },
    rings: { i: 2, chain: 0, best: 0 },
    sector: 0, gear: 0, warned: false,
    stats: { rings: 0, missed: 0, grazes: 0, hits: 0, boostS: 0, closest: tune.START_GAP },
  };
}

export const gapOf = (run) => run.ship.d - run.light.d;
export const progressOf = (run) => clamp(run.ship.d / COURSE_LEN, 0, 1);
// The speed to show, as a fraction of c: it creeps toward 1 with your speed and the run's progress.
export const betaOf = (run) => 1 - 1e-5 * (60 / Math.max(30, run.ship.speed)) * (1 - 0.85 * progressOf(run));

function hurt(run, amount) {
  const s = run.ship;
  const fromShield = Math.min(s.shield, amount);
  s.shield -= fromShield;
  s.hull = Math.max(0, s.hull - (amount - fromShield));
  s.hurtAt = run.t;
  if (fromShield > 0 && s.shield <= 0) run.events.push({ type: 'shieldPop', ship: 'you' });
}

// One step. input: { x, y } in -1..1 (right, up), boost (held).
export function step(run, input, dt) {
  run.events.length = 0;
  if (run.mode !== 'fly') return run;
  const T = run.tune, s = run.ship, W = run.world;
  run.t += dt;
  const hard = hardAt(s.d);
  // steering, inside the tube
  const ix = clamp(input.x || 0, -1, 1), iy = clamp(input.y || 0, -1, 1);
  const k = Math.min(1, dt * T.RESPOND), top = T.STRAFE + T.STRAFE_K * s.speed;
  s.vx += (ix * top - s.vx) * k;
  s.vy += (iy * top - s.vy) * k;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  const out = Math.hypot(s.x, s.y);
  if (out > TUBE) {
    s.x *= TUBE / out; s.y *= TUBE / out;
    const nx = s.x / TUBE, ny = s.y / TUBE, along = s.vx * nx + s.vy * ny;
    if (along > 0) { s.vx -= along * nx * 1.5; s.vy -= along * ny * 1.5; }
  }
  // speed: cruise, a ring's kick, the boost, the slow after a hit
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
  // the stars you pass this step: a hit, a graze, or nothing
  for (const st of W.starsBetween(d0, s.d)) {
    const off = Math.hypot(s.x - st.x, s.y - st.y) - st.r - SHIP_R;
    if (off < 0) {
      s.slow = Math.min(s.slow, T.HIT_SLOW);
      hurt(run, T.HIT * (st.kind === 'giant' ? 1.4 : 1));
      run.stats.hits++;
      run.events.push({ type: 'hit', ship: 'you', star: st.kind, side: Math.sign(s.x - st.x) || 1 });
      if (run.rings.chain > 1) run.events.push({ type: 'chainEnd', ship: 'you', chain: run.rings.chain });
      run.rings.chain = 0;
      // the star throws you clear of it
      const dx = s.x - st.x, dy = s.y - st.y, n = Math.hypot(dx, dy) || 1;
      s.vx = (dx / n) * 18; s.vy = (dy / n) * 18;
    } else if (off < T.GRAZE) {
      s.charge = Math.min(1, s.charge + T.GRAZE_CHARGE);
      run.stats.grazes++;
      run.events.push({ type: off < T.GRAZE / 3 ? 'hair' : 'graze', ship: 'you', side: Math.sign(st.x - s.x) || 1,
        chain: 1 + (run.stats.grazes % 5), star: st.kind });
    }
  }
  if (run.t - s.hurtAt > T.SHIELD_WAIT && s.shield < 100) {
    const was = s.shield;
    s.shield = Math.min(100, s.shield + T.SHIELD_BACK * dt);
    if (was <= 0 && s.shield > 0) run.events.push({ type: 'shieldBack', ship: 'you' });
  }
  // the rings you pass this step
  for (;;) {
    const g = W.ring(run.rings.i);
    if (!g) { if (run.rings.i * RING_EVERY > COURSE_LEN) break; run.rings.i++; continue; }
    if (g.d > s.d) break;
    if (g.d > d0 - 1) {
      const off = Math.hypot(s.x - g.x, s.y - g.y);
      if (off <= RING_R) {
        run.rings.chain++;
        run.rings.best = Math.max(run.rings.best, run.rings.chain);
        run.stats.rings++;
        s.charge = Math.min(1, s.charge + T.RING_CHARGE);
        s.kick = T.RING_KICK;
        run.events.push({ type: 'grab', ship: 'you', ring: g.i, chain: run.rings.chain, off });
      } else {
        run.stats.missed++;
        if (run.rings.chain > 1) run.events.push({ type: 'chainEnd', ship: 'you', chain: run.rings.chain });
        run.rings.chain = 0;
        run.events.push({ type: 'miss', ship: 'you', ring: g.i, off });
      }
    }
    run.rings.i++;
  }
  // the light
  // at first the light only keeps pace with your cruise, so a new pilot can learn; then it gains
  const ramp = clamp((s.d - T.CALM) / T.RAMP, 0, 1);
  // and when it is far behind it closes faster, so a lead counts but never lasts the whole run
  const far = Math.max(0, gapOf(run) - T.START_GAP) * T.CATCH_UP;
  run.light.speed = cruise + (T.LIGHT_OVER + T.LIGHT_HARD * hard) * ramp + far;
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
