// Focused, deterministic adventure checks. Run: node qa/lab/tilt.adventure.sim.mjs
import assert from 'node:assert/strict';
import { createAdventure, updateAdventure, launchAdventure, pulseAdventure, chooseUpgrade, availableUpgrades, currentSector } from '../../public/lab/tilt/adventure.js';
import { makeWorld, step, setFlip, H } from '../../public/lab/tilt/physics.js';
import { makeTable, inside } from '../../public/lab/tilt/table.js';

function advance(run, seconds) { for (let i = 0; i < Math.round(seconds / H); i++) updateAdventure(run); }
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

{
  const run = createAdventure(8), s = currentSector(run), p = s.planet;
  assert.equal(run.table.W, 3600); assert.equal(run.table.H, 2800);
  const left = run.table.gravity({ x: p.x - 220, y: p.y });
  const right = run.table.gravity({ x: p.x + 220, y: p.y });
  assert(left.x > 0 && right.x < 0, 'gravity pulls inward from either side');
  assert.deepEqual(run.table.gravity(s.station), { x: 0, y: -800 }, 'gravity near the flippers stays predictable');
  run.sectorIndex = 3;
  const repeller = currentSector(run).planet;
  assert(run.table.gravity({ x: repeller.x + 220, y: repeller.y }).x > 0, 'Violet Reach pushes outward');
  run.sectorIndex = 2;
  const tide = currentSector(run).planet;
  run.clock = 0; const early = run.table.gravity({ x: tide.x + 220, y: tide.y }).x;
  run.clock = 2; const later = run.table.gravity({ x: tide.x + 220, y: tide.y }).x;
  assert(later > early, 'Jade tide changes the lateral force over time');
  console.log('ok: wide world, attraction, repulsion and changing tides');
}

{
  const run = createAdventure(8);
  assert(launchAdventure(run, 0), 'a quick tap launches safely');
  assert(run.world.ball.vy >= 2800);
  assert(pulseAdventure(run));
  assert.equal(pulseAdventure(run), false, 'pulse cannot be spammed');
  updateAdventure(run);
  assert(run.events.some(e => e.type === 'pulse'), 'input events reach the next update');
  advance(run, 2.6);
  assert.equal(run.pulseCooldown, 0);
  console.log('ok: launch power and pulse cooldown');
}

{
  const run = createAdventure(5);
  for (let sectorIndex = 0; sectorIndex < 6; sectorIndex++) {
    const s = currentSector(run);
    assert.equal(s.id, sectorIndex);
    launchAdventure(run);
    strike(run, s.relays[0]);
    assert.equal(s.gate.open, false, 'a single core cannot open a gate');
    for (const relay of s.relays) while (!relay.hit) strike(run, relay);
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
    advance(run, 2.3);
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
  strike(run, s.relays[0]);
  place(run, s.x, s.y + 99, 0, -100);
  updateAdventure(run);
  assert.equal(run.lives, 3); assert.equal(run.phase, 'ready');
  assert(s.relays[0].hit, 'checkpoint preserves earned relay progress');
  launchAdventure(run); run.saveUntil = 0;
  place(run, s.x, s.y + 99, 0, -100);
  updateAdventure(run);
  assert.equal(run.lives, 2); assert.equal(run.phase, 'ready');
  assert.equal(run.world.ball.x, s.station.x);
  console.log('ok: early shield and later drain return to the active checkpoint');
}

{
  const run = createAdventure(8), events = {};
  let outside = 0;
  for (let i = 0; i < 120 * 120; i++) {
    if (run.phase === 'ready') launchAdventure(run, 0.75);
    if (run.phase === 'upgrade') chooseUpgrade(run, run.lives < 3 ? 'shield' : 'pulse');
    if (run.phase === 'play') {
      const b = run.world.ball, s = currentSector(run);
      for (const side of [-1, 1]) setFlip(run.world, side, b.y < s.y + 360 && b.vy < 100 && i % 36 < 16);
      if (run.pulseCooldown <= 0 && b.vy < 700) pulseAdventure(run);
    }
    updateAdventure(run);
    const b = run.world.ball;
    assert(Number.isFinite(b.x + b.y + b.vx + b.vy));
    if (!inside(run.table.outline, b.x, b.y)) outside++;
    for (const e of run.events) events[e.type] = (events[e.type] || 0) + 1;
    if (run.phase === 'won' || run.phase === 'over') break;
  }
  assert.equal(outside, 0); assert.equal(run.world.escapes, 0);
  assert.equal(run.recalls, 0, 'the bot encounters no trapped ball');
  assert(events.flipper > 0 && events.pulse > 0, 'the run uses flippers and pulses');
  assert.equal(run.phase, 'won', 'a simple physical bot can reach and finish the sixth sector');
  assert.equal(run.relaysHit, 18);
  console.log(`ok: physical bot finished six sectors in ${run.clock.toFixed(1)} s; ${events.flipper} flipper hits, ${events.relay} relay charges, no escapes or traps`);
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
