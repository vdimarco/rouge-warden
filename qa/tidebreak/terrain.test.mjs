// Physical relief is deterministic and team-fair; ground sampling agrees with the triangles actors stand on.
import assert from 'node:assert/strict';
import * as world from '../../public/tidebreak/world.js';
import { buildRelief, heightAt, RELIEF_SEGMENTS, TERRAIN_HEIGHT_GLSL } from '../../public/tidebreak/relief.js';
import { createMatch } from '../../public/tidebreak/sim.js';
import { riverSample, riverCrossings } from '../../public/tidebreak/river.js';

const state = createMatch(0, 49), started = performance.now(), field = buildRelief(world, state), buildMs = performance.now() - started;
const { SIZE, BASES, CAMPS, PORTALS, PATHS } = world;
assert.equal(field.resolution, RELIEF_SEGMENTS + 1);
assert.equal(field.vertices.length / 3, field.heights.length);
assert.equal(field.indices.length / 3, RELIEF_SEGMENTS ** 2 * 2);
assert(field.heights.length < 40000, 'the sampled field stays bounded');
assert(field.landMax - field.landMin >= 900, `off-lane land has ${field.landMax - field.landMin} units of relief`);
assert(field.minHeight < 0 && field.maxHeight > 300, 'lowered beds and real raised landforms exist');
assert.deepEqual(buildRelief(world, state).heights, field.heights, 'identical geometry and seed produce identical relief');
assert.throws(() => buildRelief(world, state, { segments: 191 }), /even/, 'triangulation requires a mirror axis');

for (let row = 0; row < field.resolution; row++) for (let col = 0; col < field.resolution; col++) {
  const i = row * field.resolution + col;
  assert.equal(field.heights[i], field.heights[(field.segments - row) * field.resolution + col], 'vertex elevations mirror exactly');
  assert(Number.isFinite(field.heights[i]) && field.heights[i] >= field.minHeight && field.heights[i] <= field.maxHeight);
}
for (let i = 0; i < 800; i++) {
  const x = (i * 1493.213) % SIZE, z = (i * 1781.731 + 3.17) % SIZE;
  assert(Math.abs(field.heightAt(x, z) - field.heightAt(x, SIZE - z)) < 1e-8, 'arbitrary points also mirror, including triangle diagonals');
}

// Pads have enough level area for their real footprints, rather than just one coincidentally flat centre vertex.
for (const p of [...BASES, ...CAMPS, ...PORTALS, ...state.units.filter(u => u.kind === 'tower')]) {
  for (const [dx, dz] of [[0, 0], [80, 0], [-80, 0], [0, 80], [0, -80]]) {
    assert(Math.abs(field.heightAt(p.x + dx, p.y + dz)) < 1e-6, `important pad ${p.x},${p.y} stays level`);
  }
}
// Roads retain their shared topology and safe pads while dry ground now rises between defenses.
const laneRanges = PATHS.map(path => {
  const heights = path.filter(p => {
    const b = riverSample(p.x, state.seed);
    return Math.min(Math.max(b.north - p.y, p.y - b.south), Math.max(b.north - (SIZE - p.y), (SIZE - p.y) - b.south)) > 650;
  }).map(p => field.heightAt(p.x, p.y));
  return Math.max(...heights) - Math.min(...heights);
});
assert(laneRanges.every(range => range > 10), 'dry roads follow rolling ground instead of one level plane');
assert(laneRanges[0] > 300 && laneRanges[2] > 300, 'side lanes climb visibly into the highlands');
let flat = 0, sampled = 0;
for (let x = 0; x <= SIZE; x += 100) for (let z = 0; z <= SIZE; z += 100) { sampled++; flat += Math.abs(field.heightAt(x, z)) < 10; }
assert(flat / sampled < .4, 'level carving must not flatten most of the playable landscape');
for (const b of riverCrossings(PATHS, state.seed)) for (const sign of [-1, 1]) {
  const reach = (b.span * 1.08 + 60) / 2 + 30;
  assert(Math.abs(field.heightAt(b.x + sign * b.dx * reach, b.y + sign * b.dy * reach)) < 1e-6, 'bridge landings meet low dry approach pads');
}
for (const seed of [49, 7, 101]) {
  const f = seed === state.seed ? field : buildRelief(world, { ...state, seed });
  for (let x = 0; x <= SIZE; x += 37) {
    const b = riverSample(x, seed);
    for (const z of [b.north - 26, b.north, b.y, b.south, b.south + 26]) {
      assert(f.heightAt(x, z) < 3, `the actual water surface stays above the bed at seed ${seed}`);
    }
  }
}

// Independently read mesh indices and world-space vertices, find the triangle containing an interior point, and
// interpolate its plane. This catches bilinear samplers, inverted diagonals and incorrect row/coordinate mapping.
function meshHeight(col, row, x, z) {
  const offset = (row * field.segments + col) * 6;
  for (let tri = 0; tri < 2; tri++) {
    const ids = Array.from(field.indices.slice(offset + tri * 3, offset + tri * 3 + 3));
    const [a, b, c] = ids.map(i => Array.from(field.vertices.slice(i * 3, i * 3 + 3)));
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    const wa = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const wb = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det, wc = 1 - wa - wb;
    if (Math.min(wa, wb, wc) > 0) return wa * a[1] + wb * b[1] + wc * c[1];
  }
  throw new Error('sample must be inside a mesh triangle');
}
let meshError = 0;
for (let i = 0; i < 700; i++) {
  const col = (i * 71) % field.segments, row = (i * 53 + 17) % field.segments;
  for (const [u, v] of [[.21, .37], [.81, .72], [.77, .19], [.22, .83]]) {
    const x = field.origin + (col + u) * field.cell, z = field.origin + (row + v) * field.cell;
    const cpu = field.heightAt(x, z), mesh = meshHeight(col, row, x, z);
    meshError = Math.max(meshError, Math.abs(cpu - mesh));
    assert(Math.abs(cpu - mesh) < .001, 'CPU sampler agrees with the actual Float32 mesh plane');
  }
}
assert.equal(heightAt(field, -1e6, -1e6), field.heights[0], 'samples outside the render extent clamp safely');
assert.equal(field.heightAt(1e6, 1e6), field.heights.at(-1));
for (let i = 0; i < 1000; i++) {
  const x = (i * 791.43) % SIZE, z = (i * 617.17) % SIZE, epsilon = .001;
  assert(Math.abs(field.heightAt(x + epsilon, z + epsilon) - field.heightAt(x - epsilon, z - epsilon)) <= field.maxSlope * epsilon * 2 * Math.SQRT2 + 1e-6, 'the sampled surface is continuous across cells and triangles');
}
assert(field.maxSlope < 3.2, `highland banks have bounded slopes (${field.maxSlope.toFixed(3)})`);
assert(TERRAIN_HEIGHT_GLSL.includes('uTerrainHeight') && TERRAIN_HEIGHT_GLSL.includes('terrainHeightAt'), 'ground materials can share the sampled field');
console.log('PASS: deterministic mirrored terrain, varied land, rolling roads, level pads, stable banks/bridges and exact mesh sampling.', JSON.stringify({ laneRanges: laneRanges.map(n => +n.toFixed(1)), flatShare: +(flat / sampled).toFixed(3), buildMs: Math.round(buildMs), vertices: field.heights.length, landRange: +(field.landMax - field.landMin).toFixed(1), maxSlope: +field.maxSlope.toFixed(3), meshError: +meshError.toFixed(6) }));
