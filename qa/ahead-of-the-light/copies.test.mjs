// Ahead of the Light: the copies of light-years-home's data (final.md 18.1, 21.3).
// SKELETON (WP0). WP5 fills this file. It passes now and lists, as todo tests, what it will check:
// node qa/ahead-of-the-light/copies.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/route.js';

test('core/route.js exports its 18.4 API and imports in plain node', () => {
  assert.ok(Array.isArray(mod.STOPS) && Array.isArray(mod.FACTS));
});

test.todo('the copied route and facts match light-years-home\'s originals (0.5 % on distances; card ids exist)');
test.todo('copied keys (CHAPTER_KEYS, ENDING_TUNE) and perf helpers match their originals');
