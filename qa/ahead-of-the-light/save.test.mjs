// Ahead of the Light: saves (final.md 14.1, 21.3).
// SKELETON (WP0). WP5 fills this file. It passes now and lists, as todo tests, what it will check:
// node qa/ahead-of-the-light/save.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/save.js';

test('core/save.js exports its 18.4 API and imports in plain node', () => {
  for (const name of ['serialize', 'restoreSave', 'migrate']) assert.equal(typeof mod[name], 'function', name);
  assert.deepEqual(mod.restoreSave(mod.serialize({ v: 1, a: [1, 2] })), { v: 1, a: [1, 2] });
  assert.equal(mod.restoreSave('not json'), null);
});

test.todo('a save at every break restores a run whose next leg has the same hash');
test.todo('a version mismatch drops the run and keeps the meta');
test.todo('blocked storage plays without throwing');
