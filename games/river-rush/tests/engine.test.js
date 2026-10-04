import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, emptyInput, updateGame, releaseReach, COURSE_LENGTH, RUN_SECONDS } from '../src/game/engine.js';

function advance(g, input, seconds) { for (let i = 0; i < seconds * 60; i++) updateGame(g, input, 1 / 60); }

test('steering moves raft and a fresh run resets progress', () => {
  const g = createGame(4); advance(g, { ...emptyInput(), right: true }, 0.8);
  assert.ok(g.x > 600); assert.ok(g.distance > 90);
  const clean = createGame(4); assert.equal(clean.x, 500); assert.equal(clean.hasKey, false); assert.equal(clean.time, 0);
});
test('a timed release catches the nearby key, early release does not', () => {
  const g = createGame(2); g.x = g.keys[0].x; g.distance = g.keys[0].d - 80;
  advance(g, { ...emptyInput(), reach: true }, 0.35); releaseReach(g);
  assert.equal(g.hasKey, true); assert.equal(g.score, 300);
  const early = createGame(2); advance(early, { ...emptyInput(), reach: true }, 0.4); releaseReach(early);
  assert.equal(early.hasKey, false); assert.equal(early.keys[0].consumed, false);
});
test('opening requires a key and sustained action; reaching reduces steering', () => {
  const g = createGame(3); advance(g, { ...emptyInput(), unlock: true }, 2.1); assert.equal(g.unlocked, false);
  g.hasKey = true; advance(g, { ...emptyInput(), unlock: true }, 2.1); assert.equal(g.unlocked, true);
  const paddle = createGame(6), reach = createGame(6);
  advance(paddle, { ...emptyInput(), right: true }, 0.7);
  advance(reach, { ...emptyInput(), right: true, reach: true }, 0.7);
  assert.ok(paddle.x - 500 > (reach.x - 500) * 2);
});
test('collision drains balance and overboard recovery restores it', () => {
  const g = createGame(7); g.rocks = [{ x: 500, d: 5, radius: 52, hit: false }]; g.balance = 20;
  advance(g, emptyInput(), 0.1); assert.ok(g.falling > 0); assert.equal(g.falls, 1);
  advance(g, emptyInput(), 3); assert.equal(g.falling, 0); assert.ok(g.balance > 60);
});
test('finish requires treasure, the escape lane and beating the rival', () => {
  const make = () => { const g = createGame(8); g.distance = COURSE_LENGTH - 1; g.x = 350; g.hasKey = true; g.unlocked = true; g.rivalDistance = COURSE_LENGTH - 100; g.rocks = []; return g; };
  const winner = make(); updateGame(winner, emptyInput(), 0.02); assert.equal(winner.phase, 'won'); assert.ok(winner.score > 0);
  const wrongLane = make(); wrongLane.x = 650; updateGame(wrongLane, emptyInput(), 0.02); assert.equal(wrongLane.phase, 'lost');
  const noChest = make(); noChest.unlocked = false; updateGame(noChest, emptyInput(), 0.02); assert.equal(noChest.phase, 'lost');
  const late = make(); late.rivalDistance = COURSE_LENGTH + 3; updateGame(late, emptyInput(), 0.02); assert.equal(late.phase, 'lost');
});
test('waterfall deadline ends the run and terminal states stop simulation', () => {
  const g = createGame(9); g.time = RUN_SECONDS - 0.01; updateGame(g, emptyInput(), 0.02);
  assert.equal(g.phase, 'lost'); const d = g.distance; advance(g, emptyInput(), 5); assert.equal(g.distance, d);
});
