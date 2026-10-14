// Ahead of the Light: whole-run targets for the bots (final.md 21.2), 200 runs per model, seeds 1 to 200.
// SKELETON (WP0). WP9 fills this file. It passes now and lists, as todo tests, what it will check:
// node qa/ahead-of-the-light/sim.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/bots.js';

test('core/bots.js exports its 18.4 API and imports in plain node', () => {
  for (const name of ['playRun']) assert.equal(typeof mod[name], 'function', name);
  const s = mod.playRun({ seed: 1, maxS: 5 });
  assert.equal(typeof s.home, 'boolean');
});

test.todo('weak: caught by leg 3 in at least 80 %');
test.todo('novice: median catch on leg 3 or 4; median run 3 to 5 minutes; leg-1 catches at most 5 %; home at most '
  + '10 %');
test.todo('mid: home in 25 to 45 %; median catch on leg 5 or later; TTC under 10 s in at least 50 % of legs; the '
  + 'glare in at least 15 % of runs');
test.todo('expert: home in at least 85 %; reaches LIGHT SPEED in most legs from leg 3');
test.todo('skill spread: expert years at most half the mid; mid furthest leg 1.5 legs past the novice; expert '
  + 'first in 50 % of legs');
test.todo('decisions matter: burning, docking, the red zone, keeping 2 cells for the landing, fuel into the VOID');
test.todo('the light for experts: TTC under 10 s in 5 % of legs at REDSHIFT 0 and 25 % at REDSHIFT 3; no catch '
  + 'without a glareIn first');
test.todo('variety: offered at most 75 % of the starters; no starter in more than 50 % of builds; a legendary in '
  + '30 to 80 % of mid runs');
test.todo('rivals: places, one regular eaten per mid run, a drifter eaten before 30 s of leg 1, boss win rates');
test.todo('handling: 0.9c and HEADLIGHT by share of leg; wells grabbed and graded; scorches a leg');
test.todo('course: no piece takes more than 3 times its share of hits per pass over 200 mid runs');
test.todo('timing: mid leg times within ±15 % of 11.1');
