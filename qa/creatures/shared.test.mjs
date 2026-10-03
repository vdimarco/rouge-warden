import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CREATURES, FAMILIES, chooseCreature } from '../../public/arcade/creatures/catalog.js';
import { clipFrame, direction8, CreatureBank } from '../../public/arcade/creatures/player.js';
const root = new URL('../../public/arcade/creatures/assets/', import.meta.url);
assert.equal(CREATURES.length, 18); assert.equal(new Set(CREATURES.map(c => c.family)).size, 9);
for (const c of CREATURES) {
  const meta = JSON.parse(fs.readFileSync(new URL(c.id + '.json', root)));
  assert.equal(meta.format, 'ppc.spritesheet'); assert.equal(meta.creature.family, c.family);
  for (const state of ['idle', 'walk', 'action', 'hit']) for (let dir = 0; dir < 8; dir++) {
    assert(meta.clips.some(clip => clip.state === state && clip.direction === dir));
    const frame = clipFrame(meta, state, -dir * Math.PI / 4, 1);
    assert(frame && frame.durationMs > 0);
  }
  for (const clip of meta.clips) for (const frame of clip.frames) {
    const page = meta.pages[frame.page]; assert(page);
    assert(frame.x >= 0 && frame.y >= 0 && frame.x + meta.frameWidth <= page.width && frame.y + meta.frameHeight <= page.height);
    assert(fs.statSync(new URL(page.file, root)).size > 0);
  }
}
const timingMeta = { clips: [{ state: 'action', direction: 0, loop: false, frames: [{ x: 0, durationMs: 200 }, { x: 1, durationMs: 600 }] }] };
assert.equal(clipFrame(timingMeta, 'action', 0, .15, .4).x, 1, 'action clips fit each game attack duration');
assert.equal(clipFrame(timingMeta, 'action', 0, 5, .4).x, 1, 'non-looping animation holds its final frame');
assert.equal(direction8(0), 0); assert.equal(direction8(-Math.PI / 2), 2); assert.equal(direction8(Math.PI / 2), 6);
for (const role of ['lane', 'siege', 'neutral', 'boss', 'aquatic', 'any']) {
  const picks = new Set();
  for (let seed = 1; seed < 200; seed++) { const a = chooseCreature(seed, 'test', role); assert.deepEqual(a, chooseCreature(seed, 'test', role)); picks.add(a.id); if (role === 'neutral' || role === 'lane') assert.notEqual(a.family, 'aquatic'); }
  assert(picks.size > 1);
}
assert.throws(() => chooseCreature(1, 'test', 'invalid'));
// Loading deduplicates requests; failures resolve to the game's existing art.
let requests = 0;
const meta = JSON.parse(fs.readFileSync(new URL('amorphous-101.json', root)));
const bank = new CreatureBank({ fetcher: async () => { requests++; return { ok: true, json: async () => meta }; }, imageLoader: async () => ({}) });
await Promise.all([bank.load('amorphous-101'), bank.load('amorphous-101')]); assert.equal(requests, 1);
const resident = new CreatureBank({ limit: 1, fetcher: async () => ({ ok: true, json: async () => meta }), imageLoader: async () => ({}) });
await resident.load('amorphous-101'); await resident.load('amorphous-202');
resident.retain(['amorphous-202']); assert.equal(resident.stats().loaded, 1); assert(!resident.cache.has('amorphous-101'));
const calls = []; const context = { save() {}, restore() {}, drawImage(...args) { calls.push(args); } };
const box = bank.draw(context, 'amorphous-101', { x: 100, y: 100, height: 58, facing: 0, elapsed: 0 });
assert.equal(calls.length, 1); assert.equal(box.x, 100 - meta.originX * 2); assert.equal(box.y, 100 - meta.originY * 2);
const failed = new CreatureBank({ fetcher: async () => ({ ok: false, status: 404 }) });
assert.equal(await failed.load('amorphous-101'), null); assert.equal(await failed.load('amorphous-101'), null); assert.equal(failed.failed, 1);
assert.equal(await failed.load('../invalid'), null);
console.log('PASS: all 18 original exports, nine families, four clips in eight directions, frame bounds, seeded roles, pivots, request deduplication and visible-art fallback.');
