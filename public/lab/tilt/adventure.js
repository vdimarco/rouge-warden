// Celestial expedition: open orbital fields use Full Tilt's steel-ball/flipper solver.
// Positions are world coordinates with y up. This module has no browser dependencies.
import { makeWorld, step, serve, setFlip, forecastFlip, forecastHit, H } from './physics.js';
import { prepareAsteroids, breakAsteroid, advanceAsteroids, resetAsteroids, asteroidPose } from './asteroids.js';
import { BALL_R } from './table.js';
import { TRANSIT_DURATION, REDUCED_TRANSIT_DURATION } from './transit.js';
import { createWarpSurf, setWarpSurfAim, clearWarpSurfAim, stepWarpSurf, settleWarpSurf } from './warp-surf.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const NAMES = ['Lunar Harbor', 'Amber Belt', 'Jade Observatory', 'Violet Reach', 'Solar Forge', 'The Star Engine'];
const COLORS = ['#70dddf', '#edb66c', '#8ee0ae', '#b8a3f4', '#ff9672', '#f0df9e'];
const FIELDS = ['pull', 'pull', 'tide', 'repel', 'pull', 'pull'];
const DESCRIPTIONS = ['Slingshot around the moon to reach its relays.', 'Thread an orbit through the asteroid belt.', 'Ride the changing gravitational tide.', 'Use the dark planet’s push to reach the relays.', 'A close flyby gives your shot more speed.', 'Charge each core twice to restart the sun.'];
// Each world has tested relay layouts. A layout also sets the launch side and the relay that
// a launch can reach: the skill shot. qa/lab/tilt.skill.sim.mjs checks every layout.
const LAYOUTS = [
  [{ relays: [[-335, 590], [330, 725], [-50, 970]], side: -1, skill: 1 }],
  [{ relays: [[-375, 655], [260, 785], [-165, 990]], side: -1, skill: 0 }],
  [{ relays: [[-330, 750], [340, 575], [155, 990]], side: 1, skill: 1 }],
  [{ relays: [[-350, 540], [360, 805], [-105, 1010]], side: 1, skill: 1 }],
  [{ relays: [[-360, 810], [340, 620], [165, 1000]], side: -1, skill: 2 }],
  [{ relays: [[-340, 610], [340, 720], [-80, 995]], side: -1, skill: 0 }],
];
const ROUTE = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1]];
const UPGRADES = [
  { id: 'pulse', name: 'Quick pulse', description: 'Your gravity pulse recharges 20% faster.' },
  { id: 'shield', name: 'Hull repair', description: 'Restore one life and extend the launch shield.' },
  { id: 'comet', name: 'Comet drive', description: 'Stronger pulses and 20% more points from relays.' },
];
const segment = (a, b, extra = {}) => ({ a, b, e: 0.48, ...extra });
const emit = (run, type, extra = {}) => (run._updating ? run.events : run._pendingEvents).push({ type, x: run.world.ball.x, y: run.world.ball.y, ...extra });
export const currentSector = (run) => run.sectors[run.sectorIndex];
export const availableUpgrades = () => UPGRADES.map(u => ({ ...u }));
// The orbit lasts this long before the return current brings the ball back to a flipper.
export const RALLY_FLIGHT = 2.5;
export const RALLY_POWER = 4;
// Good and Perfect flips in a row build the rally. Each CHAIN_STEP of them in one row adds one
// to the multiplier, with no top. A Late flip ends the row and keeps the multiplier. A lost
// heart resets the multiplier.
export const CHAIN_STEP = 2;
// The grade of a flip sets the top speed of its shot. A Late flip makes a weak shot.
export const SHOT_SPEEDS = { perfect: 1850, good: 1680, late: 1220 };
// The launch power runs from LAUNCH_MIN (a tap) to 1 (a full charge).
export const LAUNCH_MIN = 0.35;
export const SKILL_BONUS = 2;
export const PULSE_IMPULSE = 420;
export const FIELD_CAPACITY = 3;
export const FIELD_DURATION = 5;
export const FIELD_RADIUS = 340;
export const FIELD_ACCELERATION = 1500;
const smooth = t => t * t * (3 - 2 * t);

// A temporary field bends flight continuously. Its center and outer edge both
// have zero force, and easing avoids a sudden acceleration at birth or expiry.
export function gravityWellForce(well, ball) {
  if (!well || !ball || !Number.isFinite(well.x + well.y + ball.x + ball.y) ||
      !(well.remaining > 0) || !(well.duration > 0) || !(well.radius > 0)) return { x: 0, y: 0 };
  const dx = well.x - ball.x, dy = well.y - ball.y, d = Math.hypot(dx, dy);
  if (d < 1e-8 || d >= well.radius || (well.kind !== 'pull' && well.kind !== 'push')) return { x: 0, y: 0 };
  const birth = smooth(clamp((well.duration - well.remaining) / 0.18, 0, 1));
  const expiry = smooth(clamp(well.remaining / 0.75, 0, 1));
  const radial = Math.sin(Math.PI * d / well.radius) ** 2;
  const force = FIELD_ACCELERATION * radial * birth * expiry * (well.kind === 'push' ? -1 : 1);
  return { x: dx / d * force, y: dy / d * force };
}

export function canDeployGravityWell(run, x, y, kind = 'pull') {
  if (run.phase !== 'play' || !run.world.ball.live || run.fieldCharges < 1 || run.gravityWell ||
      !Number.isFinite(x) || !Number.isFinite(y) || (kind !== 'pull' && kind !== 'push')) return false;
  const s = currentSector(run), p = s.planet, distance = Math.hypot(x - p.x, y - p.y);
  if (distance > 700 || distance < p.r + 28) return false;
  return !run.table.bumpers.some(body => body.sector === s.id && body.asteroid && body.active !== false &&
    Math.hypot(x - body.x, y - body.y) < body.r + 24);
}

export function deployGravityWell(run, x, y, kind = 'pull') {
  if (!canDeployGravityWell(run, x, y, kind)) return false;
  run.fieldCharges--;
  run.gravityWell = { x, y, kind, remaining: FIELD_DURATION, duration: FIELD_DURATION,
    radius: FIELD_RADIUS, sector: run.sectorIndex };
  emit(run, 'field-deploy', { x, y, kind, duration: FIELD_DURATION, radius: FIELD_RADIUS, charges: run.fieldCharges });
  return true;
}

function chargeGravityWell(run, source, position = run.world.ball) {
  if (run.fieldCharges >= FIELD_CAPACITY) return;
  run.fieldCharges++;
  emit(run, 'field-charge', { x: position.x, y: position.y, source, amount: 1, charges: run.fieldCharges });
}

function clearGravityWell(run, reason) {
  if (!run.gravityWell) return;
  const { x, y, kind } = run.gravityWell;
  run.gravityWell = null;
  emit(run, 'field-expire', { x, y, kind, reason });
}

// A small optional steering force: at most one tenth of the dock's gravity.
export const TILT_ACCELERATION = 80;
export function setAdventureTilt(run, x = 0, y = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) { x = 0; y = 0; }
  const length = Math.max(1, Math.hypot(x, y));
  run.tilt.x = x / length; run.tilt.y = y / length;
}

export function createAdventure(seed = 1) {
  let n = (Number(seed) || 1) >>> 0;
  const random = () => { n = (Math.imul(1664525, n) + 1013904223) >>> 0; return n / 4294967296; };
  const table = { W: 3600, H: 2800, openSpace: true, maxSpeed: 1850, walls: [], posts: [], bumpers: [], drops: [], lanes: [], flippers: [],
    outline: [[20, 20], [3580, 20], [3580, 2780], [20, 2780]], launch: { x: 600, y: 350 }, drainY: 0 };
  const sectors = ROUTE.map(([col, row], id) => {
    const x = 600 + col * 1200, y = 130 + row * 1320;
    const layouts = LAYOUTS[id], layout = layouts[Math.floor(random() * layouts.length)];
    const sector = { id, name: NAMES[id], x, y, w: 1100, h: 1150, color: COLORS[id], descriptor: DESCRIPTIONS[id],
      gravityRadius: 465, returnRadius: 510, dockRadius: 240, orbitDirection: id % 2 ? -1 : 1,
      planet: { x: x + (id % 2 ? -55 : 55), y: y + 665, r: 90 + id * 4, mass: 155000000 + id * 7000000,
        kind: FIELDS[id], strength: id === 4 ? 1.3 : id === 3 ? -0.72 : 1 },
      relays: [], gate: { x, y: y + 1060, r: 82, open: false }, launchSide: layout.side,
      station: { x, y: y + 225 }, visited: id === 0, cleared: false };
    // Only the small launch dock has rails. Space has no collision boundary.
    for (const side of [-1, 1]) {
      const guide = [[x + side * 226, y + 240], [x + side * 176, y + 199], [x + side * 116, y + 171]];
      for (let i = 1; i < guide.length; i++) table.walls.push(segment(guide[i - 1], guide[i], { sector: id, dock: true, bowl: true, e: 0.25 }));
      table.flippers.push({ sector: id, side, px: x + side * 122, py: y + 160, len: 100, r1: 12, r2: 6,
        rest: side < 0 ? -Math.PI / 6 : Math.PI + Math.PI / 6,
        up: side < 0 ? 28 * Math.PI / 180 : Math.PI - 28 * Math.PI / 180 });
    }
    table.posts.push({ ...sector.planet, planet: true, sector: id, e: 0.96 });
    layout.relays.forEach(([rx, ry], index) => {
      const relay = { id: id * 10 + index, sector: id, x: x + rx, y: y + ry, r: 42, kick: 900,
        relay: true, hit: false, hits: 0, required: id === 5 ? 2 : 1, skill: index === layout.skill };
      sector.relays.push(relay); table.bumpers.push(relay);
    });
    // Broad gaps make each route accessible to an ordinary aimed flipper shot.
    const rocks = [[3, -365, 920], [4, 360, 445], [5, -195, 425]];
    if (id === 1) rocks.push([6, 365, 1000], [7, 170, 470]);
    if (id === 3) rocks[2] = [5, -335, 720];
    if (id === 4) rocks[0] = [3, -210, 1010];
    for (const [index, ax, ay] of rocks) {
      table.bumpers.push({ id: id * 10 + index, sector: id, x: x + ax + (random() - 0.5) * 34,
        y: y + ay + (random() - 0.5) * 28, r: 25 + random() * 9, kick: 660, asteroid: true });
    }
    return sector;
  });
  const run = { seed, table, sectors, sectorIndex: 0, phase: 'ready', lives: 3, score: 0, cycle: 1,
    clock: 0, saveUntil: 0, saved: false, pulseCooldown: 0, upgrades: [], events: [], flight: null,
    combo: 0, lastHit: -100, relaysHit: 0, recalls: 0, drainCount: 0, _still: 0, _lastX: 0, _lastY: 0,
    _acc: 0, _pulseLevel: 0, _cometLevel: 0, _shieldLevel: 0, _pendingEvents: [], _updating: false,
    orbitCount: 0, _orbitAngle: null, _orbitTravel: 0, _orbitAwardAt: -100, tilt: { x: 0, y: 0 },
    fieldCharges: 1, gravityWell: null, perfects: 0, bestChain: 0, skillShots: 0, skill: { armed: false },
    rally: { age: 0, returning: false, side: seed % 2 ? -1 : 1, powerRemaining: 0, multiplier: 1, shots: 0, lastStrike: -100, chain: 0 } };
  prepareAsteroids(table, sectors);
  table.advanceDynamic = (dt, events) => advanceAsteroids(table.bumpers, run.sectorIndex, run.world.ball, dt, events);
  table.breakDynamic = rock => run.rally.powerRemaining > 0 && breakAsteroid(rock);
  // Other systems stay visible but are reached through their jump gates.
  table.isActive = object => object.sector === run.sectorIndex;
  table.reverseScoop = { enabled: () => run.phase === 'play', centerX: f => run.sectors[f.sector].x,
    depth: 154, cooldown: 0.8, impulse: 1080 };
  // The charge sets the arc. A tap sends a slow, wide shot; a full charge sends a fast, steep one.
  table.launchVelocity = (power = 0.75) => {
    const p = clamp(Number(power) || 0, LAUNCH_MIN, 1), speed = 700 + 800 * p;
    const angle = (14 + (1 - p) * 10) * Math.PI / 180;
    return { x: currentSector(run).launchSide * Math.sin(angle) * speed, y: Math.cos(angle) * speed };
  };
  table.shotSpeed = grade => SHOT_SPEEDS[grade] ?? SHOT_SPEEDS.good;
  // The dock alone has a down direction. Beyond it, gravity curves the whole shot.
  // The outer return flow is a smooth force, never a bounce or a position clamp.
  table.gravityAt = (ball, elapsed = 0, overrideWell = undefined) => {
    elapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    const s = currentSector(run), p = s.planet;
    const dx = p.x - ball.x, dy = p.y - ball.y, d = Math.hypot(dx, dy), inv = 1 / Math.max(1, d);
    const nx = dx * inv, ny = dy * inv;
    const dockX = clamp((s.dockRadius - Math.abs(ball.x - s.x)) / 90, 0, 1);
    const dockY = clamp((s.y + 370 - ball.y) / 110, 0, 1) * clamp((ball.y - s.y + 95) / 60, 0, 1);
    const dock = dockX * dockY, field = 1 - dock;
    const force = Math.min(3300, p.mass / (d * d + 145 * 145)) * p.strength;
    let ax = nx * force * field, ay = ny * force * field - 800 * dock;
    if (p.kind === 'tide') {
      // A tangential tide varies without introducing a universal down direction.
      const tide = Math.sin((run.clock + elapsed) * 0.85) * 210 * field;
      ax += ny * tide; ay -= nx * tide;
    }
    const edge = clamp((d - s.returnRadius) / 160, 0, 1);
    const outward = Math.max(0, -(Number(ball.vx) || 0) * nx - (Number(ball.vy) || 0) * ny);
    const returning = edge * Math.min(6400, (d - s.returnRadius) * 14 + outward * 3.5) * field;
    ax += nx * returning; ay += ny * returning;
    // A light flow along the near surface prevents a ball from resting on a planet.
    if (d < p.r + 105 && field > 0) {
      const drift = 230 * clamp((p.r + 105 - d) / 70, 0, 1) * s.orbitDirection * field;
      ax -= ny * drift; ay += nx * drift;
    }
    // A rally has a short orbital arc, then a smooth descending approach. The
    // current stops below the blade so a missed timing still costs a ball.
    const rallyAge = run.rally.age + elapsed;
    if (rallyAge > RALLY_FLIGHT && ball.y > s.y + 180) {
      // A ball that is already close to the dock needs the current sooner.
      const close = clamp(1 - (Math.hypot(ball.x - s.x, ball.y - s.y) - 400) / 400, 0, 1);
      const blend = smooth(clamp((rallyAge - RALLY_FLIGHT) / (.8 - .55 * close), 0, 1));
      const side = run.rally.returning ? run.rally.side : (ball.x < s.x ? -1 : 1);
      // The ball drops onto the middle of the blade. When the planet stands over that lane,
      // the ball first passes wide of the planet, then lines up below it.
      const lane = s.x + side * 75, wide = p.x + side * (p.r + 70);
      const blocked = Math.abs(lane - p.x) < p.r + 40;
      const beside = smooth(clamp((ball.y - (p.y - p.r - 60)) / 120, 0, 1));
      const targetX = blocked ? lane + (wide - lane) * beside : lane;
      // Above the lineup height, plan a sideways speed that reaches the lane in time.
      // Below it, hold the lane so the ball falls straight onto the blade.
      const lineup = s.y + 300, vx = ball.vx || 0;
      // A low ball away from the lane rises first, so it can fall onto the blade from above.
      const offLane = clamp((Math.abs(targetX - ball.x) - 40) / 100, 0, 1) * clamp((lineup + 80 - ball.y) / 120, 0, 1);
      const targetVy = -clamp(340 + (ball.y - s.y - 330) * .6, 340, 760) * (1 - offLane) + 320 * offLane;
      let returnX = (targetX - ball.x) * 40 - vx * 13;
      if (ball.y > lineup) {
        const timeToGo = Math.max(0.15, (ball.y - lineup) / Math.max(250, -(ball.vy || 0)));
        returnX = (clamp((targetX - ball.x) / timeToGo, -700, 700) - vx) * 9;
      }
      returnX = clamp(returnX, -3000, 3000);
      const returnY = clamp((targetVy - (ball.vy || 0)) * 3.8, -2300, 2300);
      ax = ax * (1 - blend) + returnX * blend;
      ay = ay * (1 - blend) + returnY * blend;
    }
    const magnitude = Math.hypot(ax, ay);
    if (magnitude > 6800) { ax *= 6800 / magnitude; ay *= 6800 / magnitude; }
    const selectedWell = overrideWell === undefined ? run.gravityWell : overrideWell;
    if (selectedWell && selectedWell.sector === run.sectorIndex) {
      const well = gravityWellForce(elapsed ? { ...selectedWell, remaining: selectedWell.remaining - elapsed } : selectedWell, ball);
      ax += well.x; ay += well.y;
    }
    // Shared by the solver and shot preview so gentle tilt also bends the guide.
    return { x: ax + run.tilt.x * TILT_ACCELERATION, y: ay + run.tilt.y * TILT_ACCELERATION };
  };
  table.gravity = ball => table.gravityAt(ball);
  table.isDrain = b => {
    const s = currentSector(run);
    // Leave room below the flipper tips for one deliberate reverse-scoop press.
    // Sideways flight remains open space; missed dock shots still spend a life.
    return Math.abs(b.x - s.x) < 104 && b.y < s.y + 4 && b.y > s.y - 60 && b.vy < 0;
  };
  table.leaveLane = () => true;
  run.world = makeWorld(table);
  checkpoint(run);
  return run;
}

// The next flip, forecast with the same gravity as play: which flipper, and when to press it.
// Moving asteroids end the forecast when the path comes near one, since a bounce changes it.
export function forecastAdventureFlip(run, horizon = 1.2) {
  if (run.phase !== 'play') return null;
  return forecastFlip(run.world, horizon, { gravity: (ball, elapsed) => run.table.gravityAt(ball, elapsed), blocked: rockAhead(run) });
}
// The launch arc for a given charge, and the first thing it meets. The dock preview draws it,
// so a player can aim the skill shot. It uses the same physics as the launch itself, and it
// looks as far ahead as a skill shot can count: until the return starts.
export function forecastLaunch(run, power, horizon = RALLY_FLIGHT) {
  if (run.phase !== 'ready') return null;
  const s = currentSector(run), velocity = run.table.launchVelocity(power), rock = rockAhead(run), path = [];
  const hit = forecastHit(run.world, { ...run.world.ball, vx: velocity.x, vy: velocity.y }, horizon, {
    gravity: (ball, elapsed) => run.table.gravityAt(ball, elapsed), path,
    blocked: (ball, elapsed) => rock(ball, elapsed) ? 'rock' : null,
  });
  const relay = hit ? s.relays.find(r => r.id === hit.id) : null;
  return { power: clamp(Number(power) || 0, LAUNCH_MIN, 1), path, hit, relay: relay || null, skill: !!(relay?.skill && !relay.hit) };
}

// True when a forecast ball meets a live asteroid at its future place on the path.
function rockAhead(run) {
  const rocks = run.table.bumpers.filter(rock => rock.dynamic && rock.active && rock.sector === run.sectorIndex);
  return (ball, elapsed) => rocks.some(rock => {
    const pose = asteroidPose(rock, elapsed);
    return Math.hypot(ball.x - pose.x, ball.y - pose.y) < rock.r + BALL_R + 2;
  });
}

function checkpoint(run) {
  resetRally(run);
  resetAsteroids(run.table.bumpers, run.sectorIndex);
  clearGravityWell(run, 'checkpoint');
  const sector = currentSector(run);
  run.table.launch = { ...sector.station };
  serve(run.world);
  for (const f of run.world.flippers) { f.held = false; f.th = f.rest; f.om = 0; f.sd = 0; }
  run.phase = 'ready'; run._still = 0; run._lastX = sector.station.x; run._lastY = sector.station.y;
  run._orbitAngle = null; run._orbitTravel = 0;
}

// A new flight clears the power and the return. The rally row and its multiplier stay.
function resetRally(run) {
  Object.assign(run.rally, { age: 0, returning: false, powerRemaining: 0, shots: 0, lastStrike: -100, aim: null });
  run.skill.armed = false;
}
// Only a lost heart ends the multiplier.
function breakRally(run) {
  run.rally.chain = 0; run.rally.multiplier = 1;
}
function freshFlight(run, side) {
  run.rally.age = 0; run.rally.returning = false;
  if (side) run.rally.side = side;
}
// A hit on a relay or an asteroid ends the orbit, so the ball comes back for the next flip.
function startReturn(run) {
  run.rally.age = Math.max(run.rally.age, RALLY_FLIGHT);
}

export function launchAdventure(run, power = 0.75) {
  if (run.phase !== 'ready') return false;
  const b = run.world.ball, s = currentSector(run);
  b.live = true; b.lane = false;
  const velocity = run.table.launchVelocity(power);
  b.vx = velocity.x; b.vy = velocity.y;
  freshFlight(run);
  run.phase = 'play'; run.saveUntil = run.clock + 10 + run._shieldLevel * 3;
  run._still = 0;
  // Each launch can make one skill shot at the marked relay while it is still dark.
  const skill = s.relays.find(r => r.skill && !r.hit);
  run.skill = { armed: !!skill, relayId: skill?.id ?? null };
  emit(run, 'launch', { sector: s.id, power: clamp(Number(power) || 0, LAUNCH_MIN, 1) });
  return true;
}

export function pulseAdventure(run, dx = 0) {
  if (run.phase !== 'play' || run.pulseCooldown > 0) return false;
  const b = run.world.ball, s = currentSector(run), boost = 1 + run._cometLevel * 0.14;
  // Aim in every direction, including below the ball. Lateral input biases the shot.
  const targets = s.relays.filter(r => !r.hit);
  const target = (targets.length ? targets : [s.gate]).reduce((a, t) =>
    Math.hypot(t.x - b.x, t.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y) ? t : a);
  let tx = target.x - b.x, ty = target.y - b.y;
  const distance = Math.max(1, Math.hypot(tx, ty));
  tx += clamp(dx, -1, 1) * distance * 0.65;
  const length = Math.max(1, Math.hypot(tx, ty));
  const impulse = Math.min(560, PULSE_IMPULSE * boost);
  b.vx += tx / length * impulse; b.vy += ty / length * impulse;
  const speed = Math.hypot(b.vx, b.vy);
  if (speed > run.table.maxSpeed) { b.vx *= run.table.maxSpeed / speed; b.vy *= run.table.maxSpeed / speed; }
  run.pulseCooldown = Math.max(0.9, 2.5 * 0.8 ** run._pulseLevel);
  emit(run, 'pulse');
  return true;
}

export function chooseUpgrade(run, id, { reducedMotion = false } = {}) {
  if (run.phase !== 'upgrade' || !UPGRADES.some(u => u.id === id)) return false;
  run.upgrades.push(id);
  if (id === 'pulse') run._pulseLevel++;
  if (id === 'comet') run._cometLevel++;
  if (id === 'shield') { run.lives = Math.min(5, run.lives + 1); run._shieldLevel++; }
  const from = currentSector(run), to = run.sectors[run.sectorIndex + 1];
  if (!to) return false;
  const b = run.world.ball;
  run.flight = { from: { x: b.x, y: b.y }, to: { ...to.station }, fromSector: from.id, toSector: to.id,
    progress: 0, duration: reducedMotion ? REDUCED_TRANSIT_DURATION : TRANSIT_DURATION,
    surf: createWarpSurf(run.seed, from.id, to.id, { reducedMotion }) };
  run.phase = 'flight';
  setFlip(run.world, -1, false); setFlip(run.world, 1, false);
  emit(run, 'depart');
  return true;
}

export function setWarpAim(run, x, y) {
  if (run.phase !== 'flight' || !run.flight) return false;
  return setWarpSurfAim(run.flight.surf, x, y);
}

export function clearWarpAim(run) {
  return clearWarpSurfAim(run.flight?.surf);
}

function arrive(run) {
  const destination = run.flight.toSector, surf = run.flight.surf;
  if (settleWarpSurf(surf)) {
    const amount = Math.min(1, Math.max(0, FIELD_CAPACITY - run.fieldCharges));
    run.fieldCharges += amount;
    emit(run, 'warp-bonus', { hits: surf.hits, amount, charges: run.fieldCharges, reducedMotion: surf.reducedMotion });
  }
  run.sectorIndex = destination;
  currentSector(run).visited = true;
  run.flight = null; run.saved = false; run.pulseCooldown = 0;
  checkpoint(run);
  emit(run, 'arrive');
}

export function skipAdventureFlight(run) {
  if (run.phase !== 'flight' || !run.flight) return false;
  arrive(run);
  return true;
}

function drain(run) {
  resetRally(run);
  clearGravityWell(run, 'drain');
  run.drainCount++;
  if (run.clock < run.saveUntil && !run.saved) {
    run.saved = true; checkpoint(run); emit(run, 'save'); return;
  }
  const lost = run.rally.multiplier;
  run.lives--; run.saved = false; run.combo = 0;
  breakRally(run);
  if (run.lives <= 0) { run.phase = 'over'; emit(run, 'over', { multiplier: lost }); return; }
  checkpoint(run); emit(run, 'drain', { multiplier: lost });
}

// A clean flip can bend its shot a few degrees toward a dark relay, or toward the open gate.
// Each bend comes from a forecast of the real flight, and after it the ball flies by physics alone.
export const AIM_SPREAD = { perfect: 14, good: 6 };
function aimShot(run, grade) {
  const spread = AIM_SPREAD[grade];
  if (!spread) return null;
  const s = currentSector(run), b = run.world.ball, speed = Math.hypot(b.vx, b.vy), base = Math.atan2(b.vy, b.vx);
  const dark = new Set(s.relays.filter(r => !r.hit).map(r => r.id)), gate = s.gate.open ? s.gate : null;
  if (!dark.size && !gate) return null;
  const goal = gate ? ball => Math.hypot(ball.x - gate.x, ball.y - gate.y) < gate.r ? 'gate' : null : null;
  const gravity = (ball, elapsed) => run.table.gravityAt(ball, elapsed), rock = rockAhead(run);
  // A smash ends the orbit, so a path through an asteroid does not count as a way to a relay.
  const blocked = (ball, elapsed) => rock(ball, elapsed) ? 'rock' : null;
  const step = grade === 'perfect' ? 2 : 1;
  for (let k = 0; k * step <= spread; k++) for (const sign of k ? [1, -1] : [1]) {
    const bend = sign * k * step, angle = base + bend * Math.PI / 180;
    const start = { ...b, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    const hit = forecastHit(run.world, start, 1.3, { gravity, goal, blocked });
    if (hit && (dark.has(hit.id) || hit.id === 'gate')) {
      b.vx = start.vx; b.vy = start.vy;
      return { target: hit.id, bend };
    }
  }
  return null;
}

// One flip, graded. Good and Perfect build the row; a Late flip ends it.
function strike(run, e) {
  const rally = run.rally, clean = e.grade === 'perfect' || e.grade === 'good';
  const before = rally.multiplier, row = rally.chain;
  freshFlight(run, e.side);
  rally.lastStrike = run.clock; rally.shots++;
  rally.chain = clean ? rally.chain + 1 : 0;
  if (clean && rally.chain % CHAIN_STEP === 0) rally.multiplier++;
  rally.powerRemaining = RALLY_POWER;
  if (e.grade === 'perfect') run.perfects++;
  run.bestChain = Math.max(run.bestChain, rally.chain);
  run.skill.armed = false;
  rally.aim = AIM_SPREAD[e.grade] ? { grade: e.grade, side: e.side, at: run.clock } : null;
  emit(run, 'strike', { side: e.side, grade: e.grade || 'good', timing: e.timing, chain: rally.chain,
    multiplier: rally.multiplier, raised: rally.multiplier > before, broken: !clean && row > 1, duration: RALLY_POWER });
}

function tick(run) {
  run.clock += H;
  run.pulseCooldown = Math.max(0, run.pulseCooldown - H);
  if (run.phase === 'flight') {
    const f = run.flight, b = run.world.ball;
    const previousProgress = f.progress;
    f.progress = Math.min(1, f.progress + H / f.duration);
    for (const event of stepWarpSurf(f.surf, previousProgress, f.progress, H)) {
      run.score += event.points;
      emit(run, event.type, event);
    }
    const t = f.progress, smooth = t * t * (3 - 2 * t);
    b.x = f.from.x + (f.to.x - f.from.x) * smooth;
    b.y = f.from.y + (f.to.y - f.from.y) * smooth + Math.sin(t * Math.PI) * 170;
    b.vx = 0; b.vy = 0;
    if (t >= 1) arrive(run);
    return;
  }
  if (run.phase !== 'play') return;
  run.rally.age += H;
  run.rally.powerRemaining = Math.max(0, run.rally.powerRemaining - H);
  if (run.rally.age >= RALLY_FLIGHT && !run.rally.returning) {
    run.rally.returning = true;
    const offset = run.world.ball.x - currentSector(run).x;
    run.rally.side = Math.abs(offset) > 35 ? Math.sign(offset) : -run.rally.side;
    emit(run, 'return', { side: run.rally.side });
  }
  if (run.gravityWell) {
    run.gravityWell.remaining = Math.max(0, run.gravityWell.remaining - H);
    if (run.gravityWell.remaining < 1e-9) clearGravityWell(run, 'expired');
  }
  const collisions = [];
  step(run.world, collisions);
  const sector = currentSector(run), b = run.world.ball;
  for (const e of collisions) {
    if (e.k === 'drain') { drain(run); return; }
    if (e.k === 'asteroid-break') {
      const points = 250 * run.rally.multiplier;
      run.score += points;
      startReturn(run);
      emit(run, 'asteroid-break', { id: e.id, x: e.x, y: e.y, points, multiplier: run.rally.multiplier });
    } else if (e.k === 'asteroid-warning') emit(run, 'asteroid-warning', { id: e.id, x: e.x, y: e.y, duration: e.duration });
    else if (e.k === 'asteroid') emit(run, 'bumper', { id: e.id, x: e.x, y: e.y });
    else if (e.k === 'bumper') {
      const relay = sector.relays.find(r => r.id === e.id);
      run.combo = run.clock - run.lastHit < 2.4 ? Math.min(8, run.combo + 1) : 1;
      run.lastHit = run.clock;
      run.score += 50 * run.combo;
      if (relay && !relay.hit) {
        startReturn(run);
        const skill = run.skill.armed && run.skill.relayId === relay.id;
        relay.hits++; relay.hit = relay.hits >= relay.required;
        if (relay.hit) run.relaysHit++;
        const points = Math.round((relay.hit ? 1000 : 450) * (1 + 0.2 * run._cometLevel)) * run.rally.multiplier * (skill ? SKILL_BONUS : 1);
        run.score += points;
        if (skill) run.skillShots++;
        emit(run, 'relay', { id: e.id, x: relay.x, y: relay.y, complete: relay.hit, hits: relay.hits, required: relay.required,
          points, multiplier: run.rally.multiplier, skill });
        chargeGravityWell(run, 'relay', relay);
        if (sector.relays.every(r => r.hit)) {
          const bonus = 1500 * run.rally.multiplier;
          sector.gate.open = true; run.score += bonus; emit(run, 'gate', { x: sector.gate.x, y: sector.gate.y, points: bonus });
        }
      } else emit(run, 'bumper', { id: e.id });
      run.skill.armed = false;
    } else if (e.k === 'flipper') {
      emit(run, 'flipper', { side: e.side, powered: e.powered, grade: e.grade, timing: e.timing, u: e.u, swing: e.swing, speed: e.speed, rolling: e.rolling });
      run.skill.armed = false;
      if (e.powered && run.clock - run.rally.lastStrike > .15) strike(run, e);
    } else if (e.k === 'reverse') {
      freshFlight(run, e.side);
      emit(run, 'reverse', { side: e.side, x: e.x, y: e.y });
    }
  }
  // The bend waits until the blade ends its swing and the ball is free of it, so the blade
  // cannot change the shot again.
  const aim = run.rally.aim;
  if (aim) {
    const blade = run.world.flippers.find(f => f.sector === run.sectorIndex && f.side === aim.side);
    if ((!(blade?.touchLast >= run.world.t) && !(Math.abs(blade?.om) > .5)) || run.clock - aim.at > .12) {
      run.rally.aim = null;
      const result = aimShot(run, aim.grade);
      if (result) emit(run, 'aim', { grade: aim.grade, target: result.target, bend: result.bend });
    }
  }
  if (sector.gate.open && Math.hypot(b.x - sector.gate.x, b.y - sector.gate.y) < sector.gate.r) {
    const bonus = 3000 * run.rally.multiplier;
    sector.cleared = true; run.score += bonus; b.vx = 0; b.vy = 0;
    run.phase = run.sectorIndex === run.sectors.length - 1 ? 'won' : 'upgrade';
    resetRally(run);
    clearGravityWell(run, run.phase === 'won' ? 'won' : 'sector');
    emit(run, run.phase === 'won' ? 'won' : 'clear', { sector: sector.id, points: bonus });
    return;
  }
  // Reward a real half-orbit. Relays and gates still decide voyage progression.
  const p = sector.planet, radius = Math.hypot(b.x - p.x, b.y - p.y);
  const angle = Math.atan2(b.y - p.y, b.x - p.x);
  if (radius < sector.gravityRadius && radius > p.r + 35 && Math.hypot(b.vx, b.vy) > 220) {
    if (run._orbitAngle !== null) {
      let delta = angle - run._orbitAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      run._orbitTravel += delta;
      if (Math.abs(run._orbitTravel) >= Math.PI && run.clock - run._orbitAwardAt > 7) {
        const bonus = 750 * run.rally.multiplier;
        run.score += bonus; run.orbitCount++; run._orbitAwardAt = run.clock; run._orbitTravel = 0;
        emit(run, 'orbit', { sector: sector.id, bonus });
        chargeGravityWell(run, 'orbit');
      }
    }
    run._orbitAngle = angle;
  } else { run._orbitAngle = null; run._orbitTravel = 0; }
  // A stalled ball gets a small tangential rescue burn without moving its position.
  const cradled = run.world.flippers.some(f => f.sector === sector.id && f.held && Math.hypot(b.x - f.px, b.y - f.py) < 130);
  if (Math.hypot(b.x - run._lastX, b.y - run._lastY) > 24) {
    run._lastX = b.x; run._lastY = b.y; run._still = 0;
  } else if (!cradled) run._still += H;
  if (run._still > 8) {
    const nx = (b.x - p.x) / Math.max(1, radius), ny = (b.y - p.y) / Math.max(1, radius);
    b.vx += -ny * 620 * sector.orbitDirection + nx * 180;
    b.vy += nx * 620 * sector.orbitDirection + ny * 180;
    run._still = 0; emit(run, 'rescue');
  }
}

export function updateAdventure(run, dt = H) {
  run.events.length = 0;
  run.events.push(...run._pendingEvents.splice(0));
  run._updating = true;
  run._acc += Math.min(0.1, Math.max(0, dt));
  while (run._acc + 1e-10 >= H) { tick(run); run._acc -= H; }
  run._updating = false;
  return run.events;
}

export function objective(run) {
  if (run.phase === 'won') return 'Star Engine restored. All six sectors are open.';
  if (run.phase === 'over') return 'Expedition ended. Start a new journey.';
  if (run.phase === 'upgrade') return 'Choose a relic for the next sector.';
  if (run.phase === 'flight') return `Travelling to ${run.sectors[run.flight.toSector].name}`;
  const s = currentSector(run), count = s.relays.filter(r => r.hit).length;
  if (run.phase === 'ready') return 'Hold to aim. Let go to launch.';
  return s.gate.open ? 'Enter the bright gate above the planet.' : s.id === 5
    ? `Charge each beacon twice · ${s.relays.reduce((sum, r) => sum + r.hits, 0)}/6`
    : `Light the three beacons · ${count}/3`;
}
