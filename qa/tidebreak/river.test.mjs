import assert from 'node:assert/strict';
import { riverGeometry, riverSample, riverCrossings, insideRiver } from '../../public/tidebreak/river.js';
import { PATHS, inWater, SIZE, CENTER } from '../../public/tidebreak/world.js';
import { createMatch, player, step } from '../../public/tidebreak/sim.js';

for (const seed of [1, 49, 91822, 0xffffffff]) {
  const river = riverGeometry(seed), same = riverGeometry(seed);
  assert.equal(river.samples.at(-1).x,SIZE,'water covers the full expanded arena');
  assert.deepEqual(river, same); assert.notDeepEqual(river.samples, riverGeometry(seed + 1).samples);
  const ys = river.samples.map(p => p.y), widths = river.samples.map(p => p.south - p.north);
  assert(Math.max(...ys) - Math.min(...ys) > 400, 'route has broad meanders');
  assert(Math.max(...widths) - Math.min(...widths) > 75, 'pools and narrows vary width');
  for (const p of river.samples) {
    assert(p.north < p.y && p.south > p.y && p.north > SIZE * .4 && p.south < SIZE * .6, 'the river stays in the middle band of the map');
    assert(insideRiver({ x: p.x, y: p.y }, seed));
    assert(!insideRiver({ x: p.x, y: p.north - 1 }, seed));
    assert(!insideRiver({ x: p.x, y: p.south + 1 }, seed));
    assert.equal(inWater({ x: p.x, y: p.y }, { seed }), true, 'Nessie uses the same water footprint');
  }
  const bridges = riverCrossings(PATHS, seed); assert.equal(bridges.length, 3);
  for (const b of bridges) { assert(Math.abs(b.y - riverSample(b.x, seed).y) < .01, 'bridge center lies on seeded river'); assert(b.span > riverSample(b.x, seed).south - riverSample(b.x, seed).north, 'bridge spans water and banks'); }
}
// Every lane crosses the river exactly once: one sign change against the centre line and one entry into water.
for (let seed = 0; seed < 128; seed++) for (const [lane, path] of PATHS.entries()) {
  let changes = 0, entries = 0, wet = false;
  for (let i = 0; i < path.length; i++) {
    if (i) { const a = path[i - 1].y - riverSample(path[i - 1].x, seed).y, b = path[i].y - riverSample(path[i].x, seed).y; if (a * b <= 0 && a !== b) changes++; }
    const now = insideRiver(path[i], seed); if (now && !wet) entries++; wet = now;
  }
  assert.equal(changes, 1, `lane ${lane} crosses the river centre once for seed ${seed}`); assert.equal(entries, 1, `lane ${lane} enters the water once for seed ${seed}`);
}
// Erosion must keep water connected, and bridges must land beyond both banks.
for (let seed = 0; seed < 128; seed++) {
  const river = riverGeometry(seed);
  for (const p of river.samples) {
    assert(p.north < p.y - 15 && p.south > p.y + 15, 'erosion keeps an open water channel');
    assert(Number.isFinite(p.northShelf) && Number.isFinite(p.southShelf));
  }
  for (const bridge of riverCrossings(PATHS, seed)) for (const sign of [-1, 1]) {
    const end = { x: bridge.x + sign * bridge.dx * bridge.span / 2, y: bridge.y + sign * bridge.dy * bridge.span / 2 };
    assert(!insideRiver(end, seed), `bridge ${bridge.lane} lands on dry ground for seed ${seed}`);
  }
}
// Measure real movement on a wide, unobstructed part of the central crossing.
const measure = y => {
  const s = createMatch(1, 49), p = player(s); s.units = [p]; s.nextWave = s.objectiveAt = Infinity; s.campTimers = [Infinity, Infinity];
  p.x = CENTER.x; p.y = y; p.revealedUntil = 10;
  step(s, { x: 1, attack: false }, .05); return p.x - CENTER.x;
};
assert(Math.abs(measure(riverSample(CENTER.x, 49).y) / measure(CENTER.y+700) - 1.4) < .001, 'water bonus follows the new channel');
console.log('PASS: river seed replay/variation, meanders, variable width, shared water boundaries, one crossing per lane, three aligned bridges and actual Nessie speed bonus.');
