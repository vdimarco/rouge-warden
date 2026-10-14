// Ahead of the Light: the light, hull, shield, fuel and the landing (final.md 7, 8, 9, 21.3).
// SKELETON (WP0). WP3 fills this file. It passes now and lists, as todo tests, what it will check:
// node qa/ahead-of-the-light/survival.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/survival.js';

test('core/survival.js exports its 18.4 API and imports in plain node', () => {
  const api = [
    'stepLight', 'pushBack', 'launchState', 'dockPrices', 'buy', 'refund', 'land', 'yearsStep'
  ];
  for (const name of api) assert.equal(typeof mod[name], 'function', name);
  assert.equal(mod.launchState(null, 'thread').eta, 1.6);
  assert.equal(mod.launchState(null, 'past').eta, 1.0);
  assert.equal(mod.launchState(null, 'dock').eta, 0.8);
});

test.todo('the gap falls by exactly (1 − tanh η) a second; TTC = gap ÷ (1 − β)');
test.todo('a hit with the shield up costs no hull; the shield returns exactly 8.0 s after the last hit');
test.todo('a hit in the glare emits caught in the same step; 0 hull and no shield gives wreck then caught');
test.todo('warn fires once under 6 s and re-arms only above 9 s (TTC frozen at 5.5 s for 20 s: one warn)');
test.todo('push-backs never pass the cap except a red release (≤ +1.5, fading 0.1 s/s)');
test.todo('dock prices take exactly their gap, add price × 0.25 years, refund exactly, and never pass the 6 s floor');
test.todo('landing spends fuel first, then hull, and fails only when gap + fuel (up to 3) + hull < 3 + 1 per nine '
  + 'held');
test.todo('a hit outside the glare never emits caught and never leaves TTC under 2.9 s (seeds 1 to 200, η 0.6 to '
  + '4.9); inside it does');
test.todo('STILL LIGHT\'s cap bonus never passes +2 s and clears at launch');
test.todo('a rival at gap 0 emits eaten with its id; at most one eaten caption a leg');
test.todo('launch η is 1.6 / 1.0 / 0.8 by gate choice (1.0 / 1.0 / 0.6 at REDSHIFT 3)');
