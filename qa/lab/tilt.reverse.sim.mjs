// Run: node qa/lab/tilt.reverse.sim.mjs
import assert from 'node:assert/strict';
import { createAdventure, currentSector, updateAdventure, chooseUpgrade, skipAdventureFlight } from '../../public/lab/tilt/adventure.js';
import { canReverseScoop, makeWorld, setFlip, serve, step, H } from '../../public/lab/tilt/physics.js';
import { makeTable } from '../../public/lab/tilt/table.js';

const advance = (run, seconds) => { for (let i = 0; i < Math.ceil(seconds / H); i++) updateAdventure(run); };
function place(run, side, { x = 75, y = 65, vx = 0, vy = -280 } = {}) {
  const sector = currentSector(run);
  Object.assign(run.world.ball, { x: sector.x + side * x, y: sector.y + y, vx, vy, live: true, lane: false });
  run.phase = 'play'; run.saveUntil = 0;
  for (const f of run.world.flippers) f.sd = 0;
  return run.world.ball;
}

// Every dock uses its own active flippers. The exact position is unchanged by
// input; a continuous trajectory under the tip reaches the center and rises.
for (let sector = 0; sector < 6; sector++) for (const side of [-1, 1]) {
  const run = createAdventure(8); run.sectorIndex = sector;
  const b = place(run, side), world = run.world, s = currentSector(run);
  const before = { ...b }, snapshot = JSON.stringify(world.flippers);
  assert(canReverseScoop(world, side));
  assert.equal(JSON.stringify(world.flippers), snapshot, 'eligibility has no side effects');
  assert(!canReverseScoop(world, -side), 'opposite flipper cannot rescue across the dock');
  setFlip(world, side, true);
  assert.equal(b.x, before.x); assert.equal(b.y, before.y, 'a scoop never teleports the ball');
  const active = world.flippers.find(f => f.sector === sector && f.side === side);
  assert(active.reverseFx > 0 && active.reverseUntil > world.t);
  assert(world.flippers.filter(f => f.sector !== sector).every(f => f.reverseFx === 0));
  let reverse = 0, highest = b.y, largestMove = 0;
  for (let i = 0; i < 60; i++) {
    const old = { ...b };
    const events = updateAdventure(run);
    reverse += events.filter(e => e.type === 'reverse' && e.side === side).length;
    largestMove = Math.max(largestMove, Math.hypot(b.x - old.x, b.y - old.y));
    highest = Math.max(highest, b.y);
  }
  assert.equal(reverse, 1, 'one press emits one sound/visual event');
  assert.equal(run.phase, 'play'); assert.equal(run.lives, 3);
  assert(highest > s.y + 350, 'recovery climbs above the dock');
  assert(largestMove < 20, 'trajectory follows the speed limit with no position jump');
  assert.equal(world.reverseScoop, null); assert.equal(active.reverseFx, 0);
}
console.log('ok: both flippers recover physically in all six sectors with one event and no teleport');

{
  const run = createAdventure(8), world = run.world;
  place(run, -1); setFlip(world, -1, true); updateAdventure(run);
  advance(run, 0.2); place(run, -1);
  const before = { ...world.ball };
  for (let i = 0; i < 15; i++) setFlip(world, -1, true);
  assert.equal(world.ball.vx, before.vx); assert.equal(world.ball.vy, before.vy);
  assert.equal(world._inputEvents.length, 0, 'held/repeated keydown never replays a rescue');
  setFlip(world, -1, false);
  assert(!canReverseScoop(world, -1), 'a fresh press must also wait for cooldown');
  setFlip(world, -1, true);
  assert.equal(world._inputEvents.length, 0);
  setFlip(world, -1, false);
  // Advancing solver time with a served ball isolates the cooldown from drains.
  world.ball.live = false; world.ball.lane = true;
  for (let i = 0; i < 120; i++) step(world);
  place(run, -1);
  assert(canReverseScoop(world, -1));
  setFlip(world, -1, true);
  assert.equal(world._inputEvents.filter(e => e.k === 'reverse').length, 1);
}
console.log('ok: held input, key repeats and cooldown block extra impulses; later fresh input works');

{
  const run = createAdventure(8), world = run.world, sector = currentSector(run);
  place(run, -1, { x: 0, y: 109, vy: -260 });
  advance(run, 0.15);
  assert.equal(run.phase, 'play', 'a falling ball remains recoverable after passing the tip');
  assert(canReverseScoop(world, -1), 'the reaction window has a useful recovery area');
  advance(run, 0.6);
  assert.equal(run.phase, 'ready'); assert.equal(run.lives, 2, 'a missed ball still drains');
  assert.equal(run.drainCount, 1);
  assert.equal(world.ball.y, sector.station.y);
  assert(world.flippers.every(f => f.reverseFx === 0 && f.reverseUntil === 0));

  for (const side of [-1, 1]) {
    const edge = createAdventure(8);
    place(edge, side, { x: 138, y: 7, vy: -1800 });
    assert(canReverseScoop(edge.world, side));
    setFlip(edge.world, side, true); advance(edge, 0.5);
    assert.equal(edge.phase, 'play', 'even a last-moment eligible scoop stays above the drain');
    assert(edge.world.ball.y > currentSector(edge).y + 250);
  }
}
console.log('ok: response time below the tips, late recovery, and a missed ball still costs a life');

{
  const run = createAdventure(8), world = run.world;
  for (const position of [{ x: 200 }, { y: 1 }, { y: 210 }, { vy: 400 }]) {
    place(run, -1, position);
    assert(!canReverseScoop(world, -1), 'outside the underside area has no rescue');
  }
  place(run, -1); run.phase = 'upgrade';
  assert(!canReverseScoop(world, -1), 'upgrade state cannot scoop');
  run.phase = 'flight'; assert(!canReverseScoop(world, -1));
  run.phase = 'ready'; assert(!canReverseScoop(world, -1));
  place(run, -1); world.ball.live = false; assert(!canReverseScoop(world, -1));
  place(run, -1); world.ball.lane = true; assert(!canReverseScoop(world, -1));

  place(run, -1); setFlip(world, -1, true);
  serve(world);
  assert.equal(world.reverseScoop, null); assert.equal(world._inputEvents.length, 0);
  assert(world.flippers.every(f => f.reverseFx === 0 && f.reverseUntil === 0));
  // Sector arrival calls the same reset while also releasing all held controls.
  setFlip(world, -1, false); place(run, -1); setFlip(world, -1, true);
  run.phase = 'upgrade'; assert(chooseUpgrade(run, 'pulse')); assert(skipAdventureFlight(run));
  assert.equal(run.sectorIndex, 1); assert.equal(world.reverseScoop, null);
  assert(world.flippers.every(f => !f.held && f.reverseFx === 0 && f.reverseUntil === 0));
}
console.log('ok: bounds, non-play states, serve and sector arrival clear or block recovery');

{
  const run = createAdventure(8), world = run.world, f = world.flippers[0];
  place(run, -1, { x: 67, y: 210, vy: -300 });
  assert(!canReverseScoop(world, -1)); setFlip(world, -1, true);
  let hit = false, highestSpeed = 0;
  for (let i = 0; i < 36; i++) {
    const events = updateAdventure(run);
    assert(!events.some(e => e.type === 'reverse'));
    hit ||= events.some(e => e.type === 'flipper');
    highestSpeed = Math.max(highestSpeed, world.ball.vy);
  }
  assert(hit && highestSpeed > 800, 'normal above-flipper shots remain physical rebounds');
  assert.equal(f.reverseFx, 0);
  const classic = makeWorld(makeTable());
  Object.assign(classic.ball, { x: 175, y: 50, vx: 0, vy: -300, live: true, lane: false });
  assert(!canReverseScoop(classic, -1)); setFlip(classic, -1, true);
  assert.equal(classic.ball.vy, -300); assert.equal(classic._inputEvents.length, 0);
}
console.log('ok: normal flipper shots and the classic table retain their original behavior');
console.log('tilt.reverse.sim: all passed');
