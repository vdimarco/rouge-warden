// Moonwell: the rules of a run. Pearls, the streak and its multiplier, the moon meter and Moonrise, gold rails, moon
// portals, shrines and charms. Fixed ticks of 1/120 s. No DOM here: game.js draws and plays what run.events says.
import { BALL_R as R, REGION, createWorld, ensure, trim, near, station, pathAt, rng } from './world.js';
import { step, animate, moveFlippers } from './physics.js';

export const TICK = 1 / 120;
export const START_PEARLS = 3, MAX_PEARLS = 5;
export const MOONRISE = 12, SAVER = 3, READY_WAIT = 1.6, SWIFT = 3.5;
export const POINTS = { star: 100, bumper: 50, lantern: 250, lanterns: 1500, ridge: 500, long: 2000, swift: 300, rail: 2500, portal: 1500, clutch: 250, pearl: 5000, shrine: 3000 };
const MOON = { star: 0.014, bumper: 0.005, lantern: 0.02, lanterns: 0.06, ridge: 0.02, long: 0.04, swift: 0.012, rail: 0.08, portal: 0.05, clutch: 0.03, shrine: 0.05 };

export const CHARMS = [
  { id: 'power', name: 'Brighter Moon', desc: 'Your flippers swing 12% harder.', max: 3 },
  { id: 'heart', name: 'Second Breath', desc: 'One more pearl, up to five.', max: 9 },
  { id: 'bridge', name: 'Moon Bridge', desc: 'Your next drain bounces back up.', max: 9 },
  { id: 'magnet', name: 'Star Magnet', desc: 'Stars drift toward your pearl.', max: 2 },
  { id: 'meter', name: 'Full Moon', desc: 'The moon meter fills 35% faster.', max: 3 },
  { id: 'pulse', name: 'Twin Pulse', desc: 'One more pulse, and pulses recharge faster.', max: 2 },
  { id: 'gold', name: 'Golden Thread', desc: 'More rails and portals, and they pay double.', max: 2 },
  { id: 'lamp', name: 'Lamplighter', desc: 'Lanterns pay double and give more moonlight.', max: 2 },
  { id: 'feather', name: 'Featherfall', desc: 'Gravity is 8% lighter. Your shots fly further.', max: 2 },
  { id: 'steady', name: 'Steady Tide', desc: 'A drain halves your streak instead of ending it.', max: 1 },
];

export function createRun({ seed = (Math.random() * 2 ** 32) >>> 0, best = 0 } = {}) {
  const run = {
    seed, world: createWorld(seed), phase: 'ready', clock: 0, score: 0, lives: START_PEARLS, at: 0, far: 0, islands: 0,
    ball: { x: 0, y: 0, vx: 0, vy: 0, mode: 'held', touch: null },
    streak: 0, bestStreak: 0, mult: 1, meter: 0, moonrise: 0, saver: 0, bridges: 0,
    pulse: { charges: 1, max: 1, cool: 0, rate: 10 },
    charms: {}, mods: { power: 1, g: 1, meter: 1, magnet: 0, gold: 1, lamp: 1, steady: false },
    flight: 0, enteredAt: 0, still: 0, readyT: 0, lastClutch: -9, lastShot: { left: -9, right: -9 }, starChain: 0, lastStar: -9,
    best, newBest: false, offer: null, ride: null, warp: null, prev: { left: false, right: false },
    stats: { stars: 0, bumpers: 0, lanterns: 0, rails: 0, portals: 0, long: 0, swift: 0, clutch: 0, saves: 0, shrines: 0 },
    picks: rng(seed ^ 0x5bd1e995), events: [],
  };
  holdOnBeam(run);
  return run;
}

const push = (run, e) => run.events.push(e);
const mult = (run) => Math.min(8, 1 + Math.floor(run.streak / 2));

export function award(run, base, kind, x, y, moon = 0) {
  const value = Math.round(base * run.mult * (run.moonrise > 0 ? 2 : 1));
  run.score += value;
  push(run, { type: 'score', kind, x, y, value });
  if (moon) gain(run, moon);
  return value;
}

function gain(run, m) {
  if (run.moonrise > 0) return;
  run.meter = Math.min(1, run.meter + m * run.mods.meter);
  if (run.meter >= 1) { run.moonrise = MOONRISE; push(run, { type: 'moonrise' }); }
}

// y of a slope at x
export function surfaceY(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    if ((x >= ax && x <= bx) || (x >= bx && x <= ax)) return ay + ((by - ay) * (x - ax)) / (bx - ax || 1);
  }
  return pts[pts.length - 1][1];
}

// The moonbeam: a waiting pearl hangs over the left slope of the current bowl
export function beam(s) {
  const x = s.x0 + Math.min(170, (s.cx - s.P - 72 - s.x0) * 0.45);
  return { x, y: surfaceY(s.left, x) - 120 };
}

function holdOnBeam(run) {
  const p = beam(station(run.world, run.at));
  Object.assign(run.ball, { x: p.x, y: p.y, vx: 0, vy: 0, mode: 'held', touch: null });
}

function drop(run) {
  run.phase = 'play';
  run.ball.mode = 'free';
  run.ball.vx = 40;
  run.saver = run.clock < 1 ? SAVER * 2 : SAVER;
  run.enteredAt = run.clock;
  run.still = 0;
  push(run, { type: 'drop', x: run.ball.x, y: run.ball.y });
}

const power = (run) => run.mods.power * (run.moonrise > 0 ? 1.12 : 1);
// Play runs brisk from the start and faster with distance: 1.22 times real time at first, 1.55 from island 60.
// It is a time scale, so every shot keeps its shape and only gets quicker.
export const pace = (run) => 1.22 + 0.33 * Math.min(1, run.far / 60);
// the stations whose flippers move: those near the pearl, so a long world behind it costs nothing
const active = (run) => near(run.world, run.ball.x - 2400, run.ball.x + 2400);
const mods = (run) => ({ power: power(run), g: run.mods.g });

// One tick. input: { left, right, drop, pulse } as held now; presses are found against the last tick.
export function tick(run, input) {
  const { world, ball } = run;
  if (run.phase === 'charm' || run.phase === 'over') return;
  const press = { left: input.left && !run.prev.left, right: input.right && !run.prev.right };
  run.prev = { left: !!input.left, right: !!input.right };
  run.clock += TICK;
  ensure(world, run.far + 3);
  trim(world, run.at);
  animate(world, TICK);
  timers(run);

  if (run.phase === 'ready') {
    run.readyT += TICK;
    for (const s of active(run)) moveFlippers(s, input, TICK, power(run));
    holdOnBeam(run);
    if (input.drop || run.readyT > READY_WAIT || (run.readyT > 0.2 && (press.left || press.right))) drop(run);
    return;
  }
  if (input.pulse) pulse(run);
  if (ball.mode === 'rail') return ride(run, input);
  if (ball.mode === 'warp') return warp(run, input);

  const ev = [];
  const stations = near(world, ball.x - 300, ball.x + 300);
  step(world, stations, ball, input, TICK * pace(run), mods(run), ev, active(run));
  contacts(run, ev, input);
  if (ball.touch) run.flight = 0;
  for (const s of stations) if (pickups(run, s)) return;
  crossRidges(run);
  drain(run);
  unstick(run, input);
}

function timers(run) {
  run.saver = Math.max(0, run.saver - TICK);
  if (run.moonrise > 0) {
    run.moonrise -= TICK;
    run.meter = Math.max(0, run.moonrise / MOONRISE);
    if (run.moonrise <= 0) { run.moonrise = 0; run.meter = 0; push(run, { type: 'moonset' }); }
  }
  const p = run.pulse;
  if (p.charges < p.max) {
    p.cool += TICK;
    if (p.cool >= p.rate) { p.charges++; p.cool = 0; push(run, { type: 'pulseReady' }); }
  }
}

function pulse(run) {
  const b = run.ball, p = run.pulse;
  if (run.phase !== 'play' || b.mode !== 'free' || p.charges <= 0) return;
  p.charges--;
  b.vy = Math.min(b.vy * 0.3, 0) - 640;
  b.vx *= 0.7;
  run.still = 0;
  push(run, { type: 'pulse', x: b.x, y: b.y });
}

function contacts(run, ev, input) {
  const b = run.ball;
  let thud = 0;
  for (const e of ev) {
    if (e.type === 'flip' && e.moving && e.v > 150) {
      const key = e.f.side < 0 ? 'left' : 'right';
      if (run.clock - run.lastShot[key] < 0.2) continue;
      run.lastShot[key] = run.clock;
      push(run, { type: 'shot', side: e.f.side, x: e.x, y: e.y, v: e.v });
      // a clutch save: the pearl was already below the flipper line, falling toward the gap
      if (e.y > e.s.fy + 14 && Math.abs(e.x - e.s.cx) < e.s.P && run.clock - run.lastClutch > 2) {
        run.lastClutch = run.clock;
        run.stats.clutch++;
        award(run, POINTS.clutch, 'clutch', e.x, e.y - 40, MOON.clutch);
      }
    } else if (e.type === 'bumper') {
      run.stats.bumpers++;
      award(run, POINTS.bumper, 'bumper', e.x, e.y - 30, MOON.bumper);
      push(run, e);
    } else if (e.type === 'lantern') {
      push(run, e);
      if (e.o.lit) continue;
      e.o.lit = true;
      run.stats.lanterns++;
      award(run, POINTS.lantern * run.mods.lamp, 'lantern', e.x, e.y - 30, MOON.lantern * run.mods.lamp);
      if (e.s.lanterns.every((o) => o.lit)) award(run, POINTS.lanterns * run.mods.lamp, 'lanterns', e.x, e.y - 70, MOON.lanterns * run.mods.lamp);
    } else if (e.type === 'thud') thud = Math.max(thud, e.v);
    else if (e.type === 'gate' || e.type === 'mill') push(run, e);
  }
  if (thud) push(run, { type: 'thud', x: b.x, y: b.y, v: thud });
}

// Stars, rail mouths, portals, the shrine's moonwell and big pearls. True when the pearl left normal play.
function pickups(run, s) {
  const b = run.ball;
  const dist = (o) => Math.hypot(o.x - b.x, o.y - b.y);
  for (const st of s.stars) {
    if (st.taken) continue;
    let d = dist(st);
    if (run.mods.magnet && d < 120 + 60 * run.mods.magnet) {
      const k = Math.min(1, (260 * run.mods.magnet * TICK) / d);
      st.x += (b.x - st.x) * k; st.y += (b.y - st.y) * k;
      d = dist(st);
    }
    if (d < R + 22) {
      st.taken = true;
      run.stats.stars++;
      run.starChain = run.clock - run.lastStar < 1.2 ? run.starChain + 1 : 0;
      run.lastStar = run.clock;
      award(run, POINTS.star, 'star', st.x, st.y - 26, MOON.star);
      push(run, { type: 'star', x: st.x, y: st.y, chain: run.starChain });
    }
  }
  if (s.pearl && dist(s.pearl) < R + s.pearl.r) {
    const p = s.pearl;
    s.pearl = null;
    run.lives = Math.min(MAX_PEARLS, run.lives + 1);
    award(run, POINTS.pearl, 'pearl', p.x, p.y - 40);
    push(run, { type: 'pearl', x: p.x, y: p.y });
  }
  if (s.rail && dist(s.rail.mouth) < R + s.rail.mouth.r) { startRide(run, s.rail); return true; }
  if (s.portal && dist(s.portal) < R + s.portal.r) { startWarp(run, s); return true; }
  if (s.well && !s.well.spent) {
    const w = s.well, d = dist(w);
    if (d < w.pull) {
      // the moonwell draws a passing pearl in
      const a = 4600 * (1 - d / w.pull) ** 1.2;
      b.vx += ((w.x - b.x) / d) * a * TICK;
      b.vy += ((w.y - b.y) / d) * a * TICK;
      b.vx *= 0.992; b.vy *= 0.992;
    }
    if (d < R + 30) { enterShrine(run, s); return true; }
  }
  return false;
}

// Follow the pearl over ridges both ways. A ridge pays, and adds to the streak, only the first time it is crossed.
function crossRidges(run, carried = false) {
  const { world, ball } = run;
  let s = station(world, run.at);
  while (ball.x < s.x0 - R - 2 && run.at > world.first) {
    run.at--;
    run.enteredAt = run.clock;
    s = station(world, run.at);
    push(run, { type: 'back', island: run.at + 1, x: s.x1, y: s.y1 });
  }
  while (ball.x > s.x1 + R + 2) {
    ensure(world, run.at + 4);
    const next = station(world, run.at + 1);
    run.at++;
    if (run.at <= run.far) {
      push(run, { type: 'return', island: run.at + 1, x: s.x1, y: s.y1 });
    } else {
      run.far = run.at;
      run.islands++;
      run.streak++;
      run.flight++;
      run.bestStreak = Math.max(run.bestStreak, run.streak);
      run.mult = mult(run);
      award(run, POINTS.ridge + 25 * run.at, 'ridge', s.x1, s.y1 - 50, MOON.ridge);
      if (!carried && run.at > 1 && run.clock - run.enteredAt < SWIFT) { run.stats.swift++; award(run, POINTS.swift, 'swift', s.x1, s.y1 - 100, MOON.swift); }
      if (!carried && run.flight >= 2) { run.stats.long++; award(run, POINTS.long * (run.flight - 1), 'long', s.x1, s.y1 - 150, MOON.long); }
      push(run, { type: 'ridge', island: run.at + 1, x: s.x1, y: s.y1, streak: run.streak, mult: run.mult });
      if (!run.newBest && run.best > 0 && run.at + 1 > run.best) { run.newBest = true; push(run, { type: 'best', island: run.at + 1, x: s.x1, y: s.y1 }); }
      if (next.k % REGION === 0) push(run, { type: 'region', name: next.biome.name, island: run.at + 1 });
    }
    run.enteredAt = run.clock;
    s = next;
  }
}

function drain(run) {
  const b = run.ball, s = station(run.world, run.at);
  if (b.y < s.drainY && b.y < s.deep) return;
  if (run.moonrise > 0 || run.saver > 0 || run.bridges > 0) {
    const bridge = !(run.moonrise > 0 || run.saver > 0);
    if (bridge) run.bridges--;
    Object.assign(b, { x: s.cx, y: s.fy + 40, vx: (run.picks() - 0.5) * 160, vy: -1300 });
    run.stats.saves++;
    push(run, { type: 'saved', x: s.cx, y: s.fy + 40, by: bridge ? 'bridge' : run.moonrise > 0 ? 'moonrise' : 'shield' });
    return;
  }
  run.lives--;
  run.streak = run.mods.steady ? Math.floor(run.streak / 2) : 0;
  run.mult = mult(run);
  run.flight = 0;
  push(run, { type: 'drain', x: b.x, y: s.fy + 190, lives: run.lives });
  if (run.lives <= 0) {
    run.phase = 'over';
    b.mode = 'gone';
    push(run, { type: 'over' });
    return;
  }
  run.phase = 'ready';
  run.readyT = 0;
  holdOnBeam(run);
}

// A pearl that stops anywhere but a raised flipper gets a small puff toward the middle of its bowl
function unstick(run, input) {
  const b = run.ball, s = station(run.world, run.at);
  const cradled = b.touch && b.touch.side && (b.touch.side < 0 ? input.left : input.right);
  if (Math.hypot(b.vx, b.vy) < 35 && !cradled) run.still += TICK;
  else run.still = 0;
  if (run.still > 1) {
    run.still = 0;
    b.vy = -420;
    b.vx = b.x < s.cx ? 170 : -170;
    push(run, { type: 'nudge', x: b.x, y: b.y });
  }
}

function startRide(run, rail) {
  const b = run.ball;
  run.ride = { rail, u: 0, v: Math.max(1050, Math.hypot(b.vx, b.vy) * 0.8) };
  b.mode = 'rail';
  run.stats.rails++;
  push(run, { type: 'rail', x: b.x, y: b.y });
}

function ride(run, input) {
  const b = run.ball, r = run.ride;
  for (const s of active(run)) moveFlippers(s, input, TICK, power(run));
  const here = pathAt(r.rail.pts, r.u);
  r.v = Math.max(950, Math.min(1900, r.v + here.dy * 1800 * TICK));
  r.u += r.v * TICK;
  const p = pathAt(r.rail.pts, Math.min(r.u, r.rail.length));
  Object.assign(b, { x: p.x, y: p.y, vx: p.dx * r.v, vy: p.dy * r.v });
  crossRidges(run, true);
  if (r.u >= r.rail.length) {
    b.mode = 'free';
    b.vx = p.dx * 380; b.vy = p.dy * 380;
    run.ride = null;
    run.flight = 0;
    // a rail pays its bonus once: riding it again after going back is only for fun
    if (!r.rail.paid) { r.rail.paid = true; award(run, POINTS.rail * run.mods.gold, 'rail', b.x, b.y - 60, MOON.rail); }
    push(run, { type: 'railEnd', x: b.x, y: b.y });
  }
}

function startWarp(run, s) {
  const b = run.ball, to = station(run.world, s.portal.to);
  run.warp = { t: 0, dur: 0.5, portal: s.portal, from: { x: s.portal.x, y: s.portal.y }, to: { x: to.exit.x, y: to.exit.y } };
  b.mode = 'warp';
  run.stats.portals++;
  push(run, { type: 'portal', x: b.x, y: b.y, to: run.warp.to });
}

function warp(run, input) {
  const b = run.ball, w = run.warp;
  for (const s of active(run)) moveFlippers(s, input, TICK, power(run));
  w.t += TICK;
  const f = Math.min(1, w.t / w.dur), e = f * f * (3 - 2 * f);
  b.x = w.from.x + (w.to.x - w.from.x) * e;
  b.y = w.from.y + (w.to.y - w.from.y) * e - Math.sin(f * Math.PI) * 160;
  crossRidges(run, true);
  if (f >= 1) {
    Object.assign(b, { x: w.to.x, y: w.to.y, vx: 170, vy: -90, mode: 'free' });
    run.warp = null;
    run.flight = 0;
    if (!w.portal.paid) { w.portal.paid = true; award(run, POINTS.portal * run.mods.gold, 'portal', b.x, b.y - 60, MOON.portal); }
    push(run, { type: 'warpEnd', x: b.x, y: b.y });
  }
}

function enterShrine(run, s) {
  const b = run.ball;
  Object.assign(b, { x: s.well.x, y: s.well.y, vx: 0, vy: 0, mode: 'held' });
  run.phase = 'charm';
  run.stats.shrines++;
  award(run, POINTS.shrine, 'shrine', s.well.x, s.well.y - 80, MOON.shrine);
  run.offer = offer(run);
  push(run, { type: 'shrine', x: s.well.x, y: s.well.y, offer: run.offer });
}

export function offer(run) {
  const open = CHARMS.filter((c) => (run.charms[c.id] || 0) < c.max && (c.id !== 'heart' || run.lives < MAX_PEARLS));
  for (let i = open.length - 1; i > 0; i--) { const j = Math.floor(run.picks() * (i + 1)); [open[i], open[j]] = [open[j], open[i]]; }
  return open.slice(0, 3);
}

// The player picks charm i of the offer. The pearl comes out of the moonwell over the first bowl of the next region.
export function choose(run, i) {
  if (run.phase !== 'charm' || !run.offer || !run.offer[i]) return false;
  const c = run.offer[i];
  run.charms[c.id] = (run.charms[c.id] || 0) + 1;
  const m = run.mods;
  if (c.id === 'power') m.power *= 1.12;
  if (c.id === 'heart') run.lives = Math.min(MAX_PEARLS, run.lives + 1);
  if (c.id === 'bridge') run.bridges++;
  if (c.id === 'magnet') m.magnet++;
  if (c.id === 'meter') m.meter *= 1.35;
  if (c.id === 'pulse') { run.pulse.max++; run.pulse.charges++; run.pulse.rate *= 0.75; }
  if (c.id === 'gold') { m.gold *= 2; run.world.richer = 1 + run.charms.gold * 0.6; }
  if (c.id === 'lamp') m.lamp *= 2;
  if (c.id === 'feather') m.g *= 0.92;
  if (c.id === 'steady') m.steady = true;
  run.offer = null;
  // the well is spent and the seal opens, so the pearl can come back this way
  const shrine = station(run.world, run.at);
  shrine.sealed = false;
  if (shrine.well) shrine.well.spent = true;
  ensure(run.world, run.at + 4);
  const next = station(run.world, run.at + 1);
  Object.assign(run.ball, { x: next.x0 + 150, y: Math.min(next.y0, next.fy - 280) - 60, vx: 170, vy: -120, mode: 'free' });
  run.phase = 'play';
  run.saver = Math.max(run.saver, 2.5);
  crossRidges(run, true);
  push(run, { type: 'charm', charm: c });
  return true;
}
