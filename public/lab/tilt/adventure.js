// Celestial expedition: open orbital fields use Full Tilt's steel-ball/flipper solver.
// Positions are world coordinates with y up. This module has no browser dependencies.
import { makeWorld, step, serve, setFlip, H } from './physics.js';
import { TRANSIT_DURATION, REDUCED_TRANSIT_DURATION } from './transit.js';
import { createWarpSurf, setWarpSurfAim, clearWarpSurfAim, stepWarpSurf, settleWarpSurf } from './warp-surf.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const NAMES = ['Lunar Harbor', 'Amber Belt', 'Jade Observatory', 'Violet Reach', 'Solar Forge', 'The Star Engine'];
const COLORS = ['#70dddf', '#edb66c', '#8ee0ae', '#b8a3f4', '#ff9672', '#f0df9e'];
const FIELDS = ['pull', 'pull', 'tide', 'repel', 'pull', 'pull'];
const DESCRIPTIONS = ['Slingshot around the moon to reach its relays.', 'Thread an orbit through the asteroid belt.', 'Ride the changing gravitational tide.', 'Use the dark planet’s push to reach the relays.', 'A close flyby gives your shot more speed.', 'Charge each core twice to restart the sun.'];
const RELAYS = [
  [[-335, 590], [330, 725], [-50, 970]], [[-375, 655], [260, 785], [-165, 990]],
  [[-330, 750], [340, 575], [155, 990]], [[-350, 540], [360, 805], [-105, 1010]],
  [[-360, 810], [340, 620], [165, 1000]], [[-340, 610], [340, 720], [-80, 995]],
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
  return !run.table.bumpers.some(body => body.sector === s.id && body.asteroid &&
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
    const sector = { id, name: NAMES[id], x, y, w: 1100, h: 1150, color: COLORS[id], descriptor: DESCRIPTIONS[id],
      gravityRadius: 465, returnRadius: 510, dockRadius: 240, orbitDirection: id % 2 ? -1 : 1,
      planet: { x: x + (id % 2 ? -55 : 55), y: y + 665, r: 90 + id * 4, mass: 155000000 + id * 7000000,
        kind: FIELDS[id], strength: id === 4 ? 1.3 : id === 3 ? -0.72 : 1 },
      relays: [], gate: { x, y: y + 1060, r: 82, open: false },
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
    RELAYS[id].forEach(([rx, ry], index) => {
      const relay = { id: id * 10 + index, sector: id, x: x + rx, y: y + ry, r: 42, kick: 900,
        relay: true, hit: false, hits: 0, required: id === 5 ? 2 : 1 };
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
    fieldCharges: 1, gravityWell: null };
  // Other systems stay visible but are reached through their jump gates.
  table.isActive = object => object.sector === run.sectorIndex;
  table.reverseScoop = { enabled: () => run.phase === 'play', centerX: f => run.sectors[f.sector].x,
    depth: 154, cooldown: 0.8, impulse: 1080 };
  table.launchVelocity = (power = 0.75) => ({
    x: (run.seed % 2 ? -1 : 1) * (320 + run.sectorIndex * 12),
    y: 1020 + clamp(power, 0.35, 1) * 350,
  });
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

function checkpoint(run) {
  clearGravityWell(run, 'checkpoint');
  const sector = currentSector(run);
  run.table.launch = { ...sector.station };
  serve(run.world);
  for (const f of run.world.flippers) { f.held = false; f.th = f.rest; f.om = 0; f.sd = 0; }
  run.phase = 'ready'; run._still = 0; run._lastX = sector.station.x; run._lastY = sector.station.y;
  run._orbitAngle = null; run._orbitTravel = 0;
}

export function launchAdventure(run, power = 0.75) {
  if (run.phase !== 'ready') return false;
  const b = run.world.ball, s = currentSector(run);
  b.live = true; b.lane = false;
  const velocity = run.table.launchVelocity(power);
  b.vx = velocity.x; b.vy = velocity.y;
  run.phase = 'play'; run.saveUntil = run.clock + 10 + run._shieldLevel * 3;
  run._still = 0;
  emit(run, 'launch', { sector: s.id });
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
  const distance = Math.max(1, Math.hypot(tx, ty)), speed = Math.min(1800, 1420 * boost);
  const travel = Math.min(0.55, distance / speed), acceleration = run.table.gravity(b);
  tx -= acceleration.x * travel * travel * 0.45; ty -= acceleration.y * travel * travel * 0.45;
  tx += clamp(dx, -1, 1) * distance * 0.65;
  const length = Math.max(1, Math.hypot(tx, ty));
  b.vx = tx / length * speed; b.vy = ty / length * speed;
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
  clearGravityWell(run, 'drain');
  run.drainCount++;
  if (run.clock < run.saveUntil && !run.saved) {
    run.saved = true; checkpoint(run); emit(run, 'save'); return;
  }
  run.lives--; run.saved = false; run.combo = 0;
  if (run.lives <= 0) { run.phase = 'over'; emit(run, 'over'); return; }
  checkpoint(run); emit(run, 'drain');
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
  if (run.gravityWell) {
    run.gravityWell.remaining = Math.max(0, run.gravityWell.remaining - H);
    if (run.gravityWell.remaining < 1e-9) clearGravityWell(run, 'expired');
  }
  const collisions = [];
  step(run.world, collisions);
  const sector = currentSector(run), b = run.world.ball;
  for (const e of collisions) {
    if (e.k === 'drain') { drain(run); return; }
    if (e.k === 'bumper') {
      const relay = sector.relays.find(r => r.id === e.id);
      run.combo = run.clock - run.lastHit < 2.4 ? Math.min(8, run.combo + 1) : 1;
      run.lastHit = run.clock;
      run.score += 50 * run.combo;
      if (relay && !relay.hit) {
        relay.hits++; relay.hit = relay.hits >= relay.required;
        if (relay.hit) run.relaysHit++;
        run.score += Math.round((relay.hit ? 1000 : 450) * (1 + 0.2 * run._cometLevel));
        emit(run, 'relay', { id: e.id, x: relay.x, y: relay.y, complete: relay.hit, hits: relay.hits, required: relay.required });
        chargeGravityWell(run, 'relay', relay);
        if (sector.relays.every(r => r.hit)) {
          sector.gate.open = true; run.score += 1500; emit(run, 'gate', { x: sector.gate.x, y: sector.gate.y });
        }
      } else emit(run, 'bumper', { id: e.id });
    } else if (e.k === 'flipper') emit(run, 'flipper', { side: e.side });
    else if (e.k === 'reverse') emit(run, 'reverse', { side: e.side, x: e.x, y: e.y });
  }
  if (sector.gate.open && Math.hypot(b.x - sector.gate.x, b.y - sector.gate.y) < sector.gate.r) {
    sector.cleared = true; run.score += 3000; b.vx = 0; b.vy = 0;
    run.phase = run.sectorIndex === run.sectors.length - 1 ? 'won' : 'upgrade';
    clearGravityWell(run, run.phase === 'won' ? 'won' : 'sector');
    emit(run, run.phase === 'won' ? 'won' : 'clear', { sector: sector.id });
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
        run.score += 750; run.orbitCount++; run._orbitAwardAt = run.clock; run._orbitTravel = 0;
        emit(run, 'orbit', { sector: sector.id, bonus: 750 });
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
  if (run.phase === 'ready') return 'Hold LAUNCH, then release to leave the dock.';
  return s.gate.open ? 'Enter the bright gate above the planet.' : s.id === 5
    ? `Charge each core twice · ${s.relays.reduce((sum, r) => sum + r.hits, 0)}/6`
    : `Light the three relays · ${count}/3`;
}
