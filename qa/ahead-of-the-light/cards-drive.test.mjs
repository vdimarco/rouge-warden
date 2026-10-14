// Ahead of the Light: the 20 % rule (final.md 12.1, 21.3).
// SKELETON (WP0). WP9 fills this file. It passes now and lists, as todo tests, what it will check:
// node qa/ahead-of-the-light/cards-drive.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/cards.js';

test('core/cards.js exports its 18.4 API and imports in plain node', () => {
  for (const name of ['applyBuild']) assert.equal(typeof mod[name], 'function', name);
  assert.ok(Array.isArray(mod.CARDS));
});

test.todo('force each base card at break 1 for the mid driver over 50 seeds (legs 2 to 4) and compare with no card');
test.todo('each must move hairlines a minute, whips a leg, PERFECT share, burns a leg, drafts a leg, slams a leg, '
  + 'takedowns a run, glare time or time near hazard edges by 20 % or more');
test.todo('a forced base card keeps the mid home rate within −5 to +15 points');
