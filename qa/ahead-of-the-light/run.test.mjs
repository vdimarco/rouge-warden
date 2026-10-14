// Ahead of the Light: the run, chart, offers and cards (final.md 9, 11.3, 12, 21.3).
// SKELETON (WP0). WP5 fills this file. It passes now and lists, as todo tests, what it will check:
// node qa/ahead-of-the-light/run.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/run.js';

test('core/run.js exports its 18.4 API and imports in plain node', () => {
  const api = [
    'createRun', 'startLeg', 'endLeg', 'breakOf', 'pick', 'skip', 'reroll', 'banish', 'chooseLane', 'resultOf',
    'snapshot', 'restore'
  ];
  for (const name of api) assert.equal(typeof mod[name], 'function', name);
  const run = mod.createRun({ seed: 'KOMAZI' });
  assert.deepEqual(mod.restore(mod.snapshot(run)), run);
});

test.todo('same seed and choices give the same chart, offers and run');
test.todo('chart rules (11.3)');
test.todo('offers never show an owned card; a form for a filled slot says REPLACES');
test.todo('a fusion appears in the next offer after both halves and never before');
test.todo('a legendary only with 3 of its family including a form, from break 4, and never a second one in a run');
test.todo('the first offer ever is HAIR TRIGGER, SLOW ORBIT and AFTERBURNER');
test.todo('pity: after n Commons the next Rare chance is the row\'s + 4n points; a Rare resets it');
test.todo('RISK offers use the next row and hold a Rare or better');
test.todo('first place and a beaten boss show 4 cards; a trophy takes the random slot');
test.todo('applyBuild respects 12.6\'s caps for every card alone and with every other card');
test.todo('every card\'s face fits 14 and 68 characters (text.test.mjs checks it too)');
