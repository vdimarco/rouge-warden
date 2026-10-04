import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, emptyInput, updateGame } from '../src/game/engine.js';
import { createMotion, advanceMotion } from '../src/game/motion.js';

test('pose and event effects freeze with simulation time and reset for a new run', () => {
  const g = createGame(2), m = createMotion(g);
  g.time = 0.05; g.wasReaching = true; g.event = 'hit'; g.eventId++;
  advanceMotion(m, g);
  assert.ok(m.reach > 0 && m.reach < 1);
  assert.equal(m.effects.length, 1);
  const frozen = structuredClone(m);
  for (let i = 0; i < 30; i++) advanceMotion(m, g);
  assert.deepEqual(m, frozen);
  g.time += 1.4; advanceMotion(m, g);
  assert.equal(m.effects.length, 0);
  const fresh = createMotion(createGame(2));
  assert.equal(fresh.effects.length, 0); assert.equal(fresh.reach, 0);
});

test('reduced motion selects the correct pose immediately and effects stay bounded', () => {
  const g = createGame(4), m = createMotion(g);
  g.wasReaching = true; advanceMotion(m, g, true); assert.equal(m.reach, 1);
  for (let i = 0; i < 20; i++) {
    g.time += 0.02; g.event = 'key'; g.eventId++;
    advanceMotion(m, g);
  }
  assert.equal(m.effects.length, 6);
});

test('Surge accelerates once per press, costs balance and is blocked while falling', () => {
  const g = createGame(1), plain = createGame(1), input = { ...emptyInput(), boost: true };
  g.charge = 100; g.rocks = []; plain.rocks = [];
  updateGame(g, input, 0.05); updateGame(plain, emptyInput(), 0.05);
  assert.ok(g.distance > plain.distance * 1.4); assert.ok(g.balance < plain.balance);
  assert.ok(g.charge >= 65 && g.charge < 66);
  for (let i = 0; i < 45; i++) updateGame(g, input, 0.05);
  assert.equal(g.surge, 0); assert.ok(g.charge > 65);
  updateGame(g, emptyInput(), 0.05); updateGame(g, input, 0.05);
  assert.ok(g.surge > 0 && g.charge < 40);
  const fallen = createGame(1); fallen.falling = 2;
  updateGame(fallen, input, 0.05); assert.equal(fallen.surge, 0);
  const tapped = createGame(1), tapInput = { ...emptyInput(), boostTap: true };
  updateGame(tapped, tapInput, 0.05); assert.ok(tapped.surge > 0); assert.equal(tapInput.boostTap, false);
});

test('clear near misses grant one reward, build combos and collisions break them', () => {
  const g = createGame(1); g.x = 500; g.rocks = [{ x: 360, d: 0, radius: 50, hit: false }]; g.distance = 56;
  updateGame(g, emptyInput(), 0.01);
  assert.equal(g.closeCalls, 1); assert.equal(g.combo, 1); assert.equal(g.score, 60);
  updateGame(g, emptyInput(), 0.01); assert.equal(g.score, 60);
  g.rocks.push({ x: 360, d: g.distance - 56, radius: 50, hit: false });
  updateGame(g, emptyInput(), 0.01); assert.equal(g.combo, 2); assert.equal(g.score, 180);
  g.rocks.push({ x: 500, d: g.distance + 2, radius: 50, hit: false });
  updateGame(g, emptyInput(), 0.01); assert.equal(g.combo, 0);
});
