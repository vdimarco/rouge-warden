// Focused, deterministic adventure checks. Run: node qa/lab/tilt.adventure.sim.mjs
import assert from 'node:assert/strict';
import { createAdventure, updateAdventure, launchAdventure, pulseAdventure, chooseUpgrade, availableUpgrades, currentSector,
  skipAdventureFlight, dailySeed, dayKey, WORLD_LAYOUTS } from '../../public/lab/tilt/adventure.js';
import { makeWorld, step, setFlip, H } from '../../public/lab/tilt/physics.js';
import { makeTable, BALL_R } from '../../public/lab/tilt/table.js';

function advance(run, seconds) { for (let i = 0; i < Math.round(seconds / H); i++) updateAdventure(run); }
function advanceEvents(run, seconds) { const events = []; for (let i = 0; i < Math.round(seconds / H); i++) events.push(...updateAdventure(run)); return events; }
function place(run, x, y, vx = 0, vy = 0) {
  Object.assign(run.world.ball, { x, y, vx, vy, live: true, lane: false });
  for (const f of run.world.flippers) f.sd = 0;
  run.phase = 'play';
}
function strike(run, relay) {
  // Use a physical incoming shot. No scoring flags are changed by the test.
  place(run, relay.x + relay.r + 60, relay.y, -1100, 0);
  advance(run, 0.16);
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

{
  const run = createAdventure(8), s = currentSector(run), p = s.planet;
  assert.equal(run.table.W, 3600); assert.equal(run.table.H, 2800);
  const left = run.table.gravity({ x: p.x - 220, y: p.y });
  const right = run.table.gravity({ x: p.x + 220, y: p.y });
  assert(left.x > 0 && right.x < 0, 'gravity pulls inward from either side');
  assert(Math.abs(left.y) < 35 && Math.abs(right.y) < 35, 'open space has negligible ambient downward acceleration');
  const above = run.table.gravity({ x: p.x, y: p.y + 220 });
  const below = run.table.gravity({ x: p.x, y: p.y - 220 });
  assert(above.y < -100 && below.y > 100, 'the planet pulls vertically from above and below');
  assert(run.table.gravity(s.station).y < -300, 'local dock gravity supports the flippers');
  // The seed orders the middle worlds, so find each field by its kind.
  run.sectorIndex = run.sectors.findIndex(sector => sector.planet.kind === 'repel');
  const repeller = currentSector(run).planet;
  assert(run.table.gravity({ x: repeller.x + 220, y: repeller.y }).x > 0, 'Violet Reach pushes outward');
  run.sectorIndex = run.sectors.findIndex(sector => sector.planet.kind === 'tide');
  const tide = currentSector(run).planet;
  run.clock = 0; const early = run.table.gravity({ x: tide.x + 220, y: tide.y });
  run.clock = 2; const later = run.table.gravity({ x: tide.x + 220, y: tide.y });
  assert(distance(later, early) > 25, 'Jade tide changes the force over time');
  console.log('ok: radial planetary fields, negligible ambient fall, local dock gravity and tides');
}

{
  // The flight passes beside the planet. The seed picks the layout, so this check uses the first
  // layout of the first world, which has no beacon on that path.
  const open = { layouts: WORLD_LAYOUTS.map((list, world) => world === 0 ? [list[0]] : list) };
  const run = createAdventure(8, open), control = createAdventure(8, open), p = currentSector(run).planet;
  const start = { x: p.x - 230, y: p.y };
  place(run, start.x, start.y, 0, 600);
  place(control, start.x, start.y, 0, 600);
  control.table.gravity = () => ({ x: 0, y: 0 });
  let closest = Infinity;
  for (let i = 0; i < 72; i++) {
    updateAdventure(run); updateAdventure(control);
    closest = Math.min(closest, distance(run.world.ball, p));
  }
  assert.equal(run.phase, 'play');
  assert(closest > p.r + BALL_R, 'the curved flyby does not touch the planet');
  assert(run.world.ball.x > control.world.ball.x + 45, 'gravity visibly bends a tangential shot toward the planet');
  assert(run.world.ball.vx > control.world.ball.vx + 130, 'a flyby changes velocity through gravity');
  console.log('ok: a physical flyby bends through gravity without a wall or planet collision');
}

{
  const a = createAdventure(8), repeated = createAdventure(8), b = createAdventure(21);
  const geometry = run => JSON.stringify(run.sectors.map(s => ({ planet: s.planet, relays: s.relays,
    rocks: run.table.bumpers.filter(body => body.sector === s.id && body.asteroid) })));
  assert.equal(geometry(a), geometry(repeated), 'the same seed reproduces a route');
  assert.notEqual(geometry(a), geometry(b), 'different seeds change the route geometry');
  for (const seed of [1, 8, 21]) {
    const run = createAdventure(seed);
    for (const wall of run.table.walls.filter(w => w.enabled !== false)) {
      const station = run.sectors[wall.sector].station;
      assert(Math.hypot(wall.a[0] - wall.b[0], wall.a[1] - wall.b[1]) < 350, 'there are no long room walls');
      for (const [x, y] of [wall.a, wall.b]) assert(distance({ x, y }, station) < 350, 'hard rails stay close to a launch dock');
    }
    for (const sector of run.sectors) {
      const bodies = [sector.planet, ...sector.relays, ...run.table.bumpers.filter(body => body.sector === sector.id && body.asteroid)];
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        assert(distance(bodies[i], bodies[j]) > bodies[i].r + bodies[j].r + BALL_R * 2,
          `seed ${seed}, sector ${sector.id}: randomized bodies leave a ball-wide gap`);
      }
      for (const body of bodies) assert(distance(body, sector.gate) > body.r + BALL_R * 2,
        `seed ${seed}, sector ${sector.id}: the jump gate stays clear`);
    }
  }
  console.log('ok: open sectors, short dock rails and reproducible, safely spaced random geometry');
}

{
  // Isolate each collision class so the shot must pass through a future sector's geometry.
  for (const kind of ['bumper', 'planet', 'rail', 'flipper']) {
    const run = createAdventure(8), sector = run.sectors[1];
    run.table.gravity = () => ({ x: 0, y: 0 });
    run.table.isDrain = () => false;
    let x, y, nx = 1, ny = 0;
    if (kind === 'bumper' || kind === 'planet') {
      const body = kind === 'bumper' ? sector.relays[0] : sector.planet;
      ({ x, y } = body);
    } else if (kind === 'rail') {
      const wall = run.table.walls.find(w => w.sector === 1);
      x = (wall.a[0] + wall.b[0]) / 2; y = (wall.a[1] + wall.b[1]) / 2;
      const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
      nx = -(wall.b[1] - wall.a[1]) / length; ny = (wall.b[0] - wall.a[0]) / length;
    } else {
      const f = run.world.flippers.find(f => f.sector === 1 && f.side === -1);
      x = f.px + Math.cos(f.rest) * f.len / 2; y = f.py + Math.sin(f.rest) * f.len / 2;
      nx = -Math.sin(f.rest); ny = Math.cos(f.rest);
    }
    place(run, x + nx * 150, y + ny * 150, -nx * 1000, -ny * 1000);
    advance(run, 0.30);
    assert((run.world.ball.x - x) * nx + (run.world.ball.y - y) * ny < -100,
      `inactive sector ${kind} does not block travel`);
    assert.equal(run.world.escapes, 0);
  }
  const run = createAdventure(8), s = currentSector(run), p = s.planet;
  place(run, p.x - 530, p.y, -1800, 0);
  let crossedOldEdge = false, returned = false, farthest = 0;
  for (let i = 0; i < 4 * 120; i++) {
    updateAdventure(run);
    const b = run.world.ball, radius = distance(b, p);
    crossedOldEdge ||= b.x < 20;
    farthest = Math.max(farthest, radius);
    if (crossedOldEdge && radius < 480) { returned = true; break; }
  }
  assert(crossedOldEdge, 'a fast shot can cross the former rectangular border');
  assert(returned && farthest < 1000, 'soft gravity turns the shot back into the field');
  assert.equal(run.world.escapes, 0, 'open space does not trigger the classic position clamp');
  console.log('ok: inactive-sector collision isolation and smooth return across the former border');
}

{
  const run = createAdventure(8), flipper = run.world.flippers.find(f => f.sector === 0 && f.side === -1);
  place(run, flipper.px + 55, flipper.py + 50, 0, -300);
  setFlip(run.world, -1, true);
  let hit = false, bestRise = 0;
  for (let i = 0; i < 36; i++) {
    updateAdventure(run);
    hit ||= run.events.some(e => e.type === 'flipper');
    bestRise = Math.max(bestRise, run.world.ball.vy);
  }
  assert(hit && bestRise > 800, 'a timed flipper physically sends a falling ball back into space');
  console.log('ok: the local launch dock retains a strong physical flipper rebound');
}

{
  const run = createAdventure(8), s = currentSector(run);
  assert(launchAdventure(run, 0), 'a quick tap launches safely');
  assert(run.world.ball.vy > 500, 'a quick tap leaves the launch dock');
  assert(pulseAdventure(run));
  assert.equal(pulseAdventure(run), false, 'pulse cannot be spammed');
  updateAdventure(run);
  assert(run.events.some(e => e.type === 'pulse'), 'input events reach the next update');
  advance(run, 2.6);
  assert.equal(run.pulseCooldown, 0);
  // The launch arc can light a relay, so aim at one that is still dark.
  const relay = s.relays.find(r => !r.hit);
  place(run, relay.x, relay.y + 140);
  assert(pulseAdventure(run));
  assert(run.world.ball.vy < -100, 'a pulse can aim down toward a relay in open space');
  console.log('ok: launch, pulse cooldown and aiming in two dimensions');
}

{
  const run = createAdventure(5);
  for (let sectorIndex = 0; sectorIndex < 6; sectorIndex++) {
    const s = currentSector(run);
    assert.equal(s.id, sectorIndex);
    launchAdventure(run);
    strike(run, s.relays[0]);
    assert.equal(s.gate.open, false, 'a single core cannot open a gate');
    for (const relay of s.relays) {
      for (let attempt = 0; attempt < 4 && !relay.hit; attempt++) strike(run, relay);
      assert(relay.hit, 'an incoming physical shot charges a relay');
    }
    assert(s.gate.open, 'physical collisions charge every relay and open the gate');
    place(run, s.gate.x + s.gate.r + 25, s.gate.y, -1000, 0);
    advance(run, 0.12);
    assert.equal(run.phase, sectorIndex === 5 ? 'won' : 'upgrade');
    if (run.phase === 'won') break;
    assert.equal(chooseUpgrade(run, 'unknown'), false, 'invalid upgrades have no effect');
    const choice = availableUpgrades(run)[sectorIndex % 3].id;
    const beforeLives = run.lives;
    assert(chooseUpgrade(run, choice));
    if (choice === 'shield') assert.equal(run.lives, Math.min(5, beforeLives + 1));
    assert.equal(run.phase, 'flight');
    advance(run, run.flight.duration + H * 2);
    assert.equal(run.phase, 'ready');
    assert.equal(run.sectorIndex, sectorIndex + 1);
    assert.deepEqual([run.world.ball.x, run.world.ball.y], [currentSector(run).station.x, currentSector(run).station.y]);
  }
  assert.equal(run.relaysHit, 18); assert.equal(run.sectors.filter(s => s.cleared).length, 6);
  assert(run.sectors[5].relays.every(r => r.hits === 2), 'the final cores each need two collisions');
  console.log('ok: all 21 relay charges, gates, upgrade choices, flights and final victory');
}

{
  const run = createAdventure(1), s = currentSector(run);
  launchAdventure(run);
  place(run, s.x + 450, s.y + 3, 0, -100);
  advance(run, 0.2);
  assert.equal(run.phase, 'play', 'passing below the dock off to one side is safe space');
  assert.equal(run.lives, 3);
  strike(run, s.relays[0]);
  place(run, s.x, s.y + 3, 0, -100);
  updateAdventure(run);
  assert.equal(run.lives, 3); assert.equal(run.phase, 'ready');
  assert(s.relays[0].hit, 'checkpoint preserves earned relay progress');
  launchAdventure(run); run.saveUntil = 0;
  place(run, s.x, s.y + 3, 0, -100);
  updateAdventure(run);
  assert.equal(run.lives, 2); assert.equal(run.phase, 'ready');
  assert.equal(run.world.ball.x, s.station.x);
  console.log('ok: only the dock drains; launch shield and later drain retain checkpoint progress');
}

{
  // Orbits now last 2.5 s and end at a lit relay, so one run can pass with no half-orbit.
  // The three runs together must still earn the orbit bonus, and each run counts it exactly.
  let orbits = 0;
  for (const seed of [1, 8, 21]) {
    const run = createAdventure(seed), events = {};
    let farthest = 0, playTicks = 0;
    for (let i = 0; i < 360 * 120; i++) {
      if (run.phase === 'ready') launchAdventure(run, 0.75);
      if (run.phase === 'upgrade') chooseUpgrade(run, run.lives < 3 ? 'shield' : 'pulse');
      if (run.phase === 'play') {
        const b = run.world.ball, s = currentSector(run);
        for (const side of [-1, 1]) setFlip(run.world, side, b.y < s.y + 360 && b.vy < 100 && playTicks % 36 < 16);
        if (run.pulseCooldown <= 0) pulseAdventure(run);
        playTicks++;
      }
      updateAdventure(run);
      const b = run.world.ball;
      assert(Number.isFinite(b.x + b.y + b.vx + b.vy));
      if (run.phase === 'play') farthest = Math.max(farthest, distance(b, currentSector(run).planet));
      for (const e of run.events) events[e.type] = (events[e.type] || 0) + 1;
      if (run.phase === 'won' || run.phase === 'over') break;
    }
    assert(farthest < 1200, 'soft gravity keeps an ordinary run in range'); assert.equal(run.world.escapes, 0);
    assert.equal(events.rescue || 0, 0, 'the bot completes without a stalled-ball rescue');
    assert(events.pulse > 0, 'the run uses gravity pulses');
    assert.equal(run.orbitCount, events.orbit || 0, 'each orbit bonus is counted once');
    orbits += run.orbitCount;
    assert.equal(run.phase, 'won', `seed ${seed}: a simple physical bot can finish the sixth sector`);
    assert.equal(run.relaysHit, 18);
    console.log(`ok: seed ${seed} physical bot finished six sectors in ${run.clock.toFixed(1)} s; ${events.flipper || 0} flipper hits, ${events.relay} relay charges, ${events.orbit || 0} orbits, no boundary clamps or rescue burns`);
  }
  assert(orbits > 0, 'real flights earn the orbit bonus');
}

{
  // Seeded voyages: Lunar Harbor opens and the Star Engine ends every voyage. The seed orders the
  // four worlds between them and picks one tested layout for each world.
  const orders = new Set(), picks = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    const run = createAdventure(seed), order = run.sectors.map(s => s.world);
    assert.equal(order[0], 0); assert.equal(order[5], 5);
    assert.deepEqual(order.slice(1, 5).sort(), [1, 2, 3, 4], 'the middle four worlds are each visited once');
    orders.add(order.join(''));
    for (const s of run.sectors) {
      const layout = WORLD_LAYOUTS[s.world][s.layout];
      picks.add(`${s.world}:${s.layout}`);
      assert.deepEqual(s.relays.map(r => [r.x - s.x, r.y - s.y]), layout.relays, 'a world uses one of its tested layouts');
      assert.equal(s.relays.filter(r => r.skill).length, 1);
      assert.equal(s.relays.every(r => r.required === (s.world === 5 ? 2 : 1)), true, 'only the Star Engine needs two hits per beacon');
    }
  }
  const layouts = WORLD_LAYOUTS.reduce((sum, list) => sum + list.length, 0);
  assert(orders.size >= 20, 'near seeds give many world orders');
  assert.equal(picks.size, layouts, 'every tested layout appears in some voyage');
  assert(WORLD_LAYOUTS.every(list => list.length >= 3), 'every world has at least three layouts');
  // One seed per local calendar day, so the crew flies the same voyage on the same day.
  const day = '2026-10-03', voyage = run => JSON.stringify({ order: run.sectors.map(s => [s.world, s.layout]),
    bodies: run.table.bumpers.map(b => [b.id, b.x, b.y, b.r]), offers: availableUpgrades(run).map(u => u.id) });
  assert.equal(dayKey(new Date(2026, 9, 3, 0, 1)), day); assert.equal(dayKey(new Date(2026, 9, 3, 23, 59)), day);
  assert.equal(dailySeed(new Date(2026, 9, 3, 23, 59)), dailySeed(day), 'the seed follows the local calendar day');
  assert.equal(voyage(createAdventure(dailySeed(day))), voyage(createAdventure(dailySeed(day))), 'one date always gives the same voyage');
  assert.notEqual(dailySeed('2026-10-04'), dailySeed(day), 'the next day gives a new seed');
  const week = new Set(Array.from({ length: 7 }, (_, i) => voyage(createAdventure(dailySeed(`2026-10-0${i + 1}`)))));
  assert.equal(week.size, 7, 'each day of a week has its own voyage');
  console.log(`ok: ${orders.size} world orders in 80 seeds, all ${layouts} tested layouts used, and one voyage per calendar day`);
}

{
  // Each gate offers three different upgrades from a pool of six. The seed and the world set them.
  const pool = new Set(availableUpgrades().map(u => u.id)), seen = new Set();
  assert.equal(pool.size, 6);
  for (let seed = 1; seed <= 40; seed++) for (let sector = 0; sector < 5; sector++) {
    const run = createAdventure(seed); run.sectorIndex = sector;
    const offer = availableUpgrades(run).map(u => u.id);
    assert.equal(new Set(offer).size, 3, 'three different choices');
    assert(offer.every(id => pool.has(id)));
    assert.deepEqual(availableUpgrades(createAdventure(seed)).map(u => u.id), availableUpgrades(createAdventure(seed)).map(u => u.id));
    offer.forEach(id => seen.add(id));
    run.lives = 1;
    assert(availableUpgrades(run).some(u => u.id === 'shield'), 'Hull repair is offered on the last heart');
  }
  assert.equal(seen.size, 6, 'every upgrade can be offered');
  // Long flippers: 12% longer blades in every world, once. The gap between the tips stays wider
  // than the ball, so a ball can still fall between them.
  const run = createAdventure(8), length = run.world.flippers[0].len;
  for (const expected of [1.12, 1.12]) {
    run.phase = 'upgrade'; assert(chooseUpgrade(run, 'long')); skipAdventureFlight(run);
    assert(run.world.flippers.every(f => Math.abs(f.len - length * expected) < 1e-9), 'long flippers lengthen every blade');
  }
  assert(!availableUpgrades(run).some(u => u.id === 'long'), 'a full upgrade is not offered again');
  const [left, right] = run.world.flippers.filter(f => f.sector === run.sectorIndex).sort((a, b) => a.side - b.side);
  const gap = (right.px + Math.cos(right.rest) * right.len) - (left.px + Math.cos(left.rest) * left.len) - left.r2 - right.r2;
  assert(gap > 2 * BALL_R + 4, `the gap between long blades (${gap.toFixed(1)}) is wider than the ball`);
  // Magnet save: once in each world, a lost ball goes back up and no heart is lost.
  const saved = createAdventure(8);
  saved.phase = 'upgrade'; chooseUpgrade(saved, 'magnet'); skipAdventureFlight(saved);
  for (const lost of [false, true]) {
    const s = currentSector(saved);
    if (saved.phase === 'ready') launchAdventure(saved);
    saved.saveUntil = 0; place(saved, s.x, s.y + 3, 0, -100);
    const events = advanceEvents(saved, H);
    if (!lost) {
      assert(events.some(e => e.type === 'magnet') && saved.lives === 3 && saved.phase === 'play' && saved.world.ball.vy > 500,
        'the magnet throws a lost ball back up');
    } else assert(events.some(e => e.type === 'drain') && saved.lives === 2, 'the magnet works once in each world');
  }
  saved.phase = 'upgrade'; chooseUpgrade(saved, 'pulse'); skipAdventureFlight(saved);
  assert.equal(saved._magnets, 1, 'the magnet is ready again in the next world');
  console.log('ok: three seeded upgrade choices from six; long flippers and magnet save change play');
}

{
  // The simple physical bot from the block above finishes 50 seeded voyages.
  const times = [];
  for (let seed = 101; seed <= 150; seed++) {
    const run = createAdventure(seed);
    let playTicks = 0;
    for (let i = 0; i < 360 * 120 && run.phase !== 'won' && run.phase !== 'over'; i++) {
      if (run.phase === 'ready') launchAdventure(run, 0.75);
      if (run.phase === 'upgrade') chooseUpgrade(run, run.lives < 3 ? 'shield' : 'pulse');
      if (run.phase === 'play') {
        const b = run.world.ball, s = currentSector(run);
        for (const side of [-1, 1]) setFlip(run.world, side, b.y < s.y + 360 && b.vy < 100 && playTicks % 36 < 16);
        if (run.pulseCooldown <= 0) pulseAdventure(run);
        playTicks++;
      }
      updateAdventure(run);
    }
    assert.equal(run.phase, 'won', `seed ${seed}: the simple physical bot finishes the voyage within six minutes`);
    times.push(run.clock);
  }
  times.sort((a, b) => a - b);
  console.log(`ok: the simple physical bot finished 50 of 50 seeded voyages; median ${times[25].toFixed(0)} s, slowest ${times[49].toFixed(0)} s`);
}

// Default tables retain the original gravity and launcher behavior after adding optional hooks.
{
  const world = makeWorld(makeTable());
  Object.assign(world.ball, { x: 228, y: 400, vx: 0, vy: 0, live: true, lane: false });
  step(world);
  assert(world.ball.vy < -13 && world.ball.vy > -14);
  assert.equal(world.table.gravity, undefined);
  console.log('ok: classic table retains its original downward gravity');
}
console.log('tilt.adventure.sim: all passed');

