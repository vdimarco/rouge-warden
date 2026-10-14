// Ahead of the Light: meta: pages, unlocks, ships, REDSHIFT and the daily route (final.md 14, 21.3).
// SKELETON (WP0). WP5 fills this file. It passes now and lists, as todo tests, what it will check:
// node qa/ahead-of-the-light/meta.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/meta.js';

test('core/meta.js exports its 18.4 API and imports in plain node', () => {
  for (const name of ['pagesFor', 'unlocksAt', 'shipUnlocks']) assert.equal(typeof mod[name], 'function', name);
});

test.todo('pages count once; unlocks fire at their thresholds');
test.todo('ship feats unlock once');
test.todo('REDSHIFT opens step by step');
test.todo('two daily runs on the same date with the same choices match; different dates differ');
