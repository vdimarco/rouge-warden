// node qa/pingpong/winrate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateWinRate } from '../../public/pingpong/sim.js';

test('the casual Neighbour takes 20 to 40 percent of points and loses most games', () => {
  const result = simulateWinRate(1, 1000);
  assert.ok(result.pointsPlayed >= 1000, result.pointsPlayed);
  assert.ok(result.rate >= 0.2 && result.rate <= 0.4, result.rate);
  assert.ok(result.gameRate < 0.5, result.gameRate);
});
