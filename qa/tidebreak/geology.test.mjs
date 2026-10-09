import assert from 'node:assert/strict';
import * as world from '../../public/tidebreak/world.js';
import { cliffGeometry, caveGeometry, geologySites, rockHeightAt } from '../../public/tidebreak/geology.js';
import { makeScenery, laneDistance } from '../../public/tidebreak/scenery.js';
import { buildRelief } from '../../public/tidebreak/relief.js';

const cliff = cliffGeometry(), cave = caveGeometry();
for (const mesh of [cliff, cave.shell, cave.inside, cave.floor, cave.rear]) {
  assert(mesh.positions.every(Number.isFinite)); assert(mesh.colors.every(Number.isFinite));
  assert.equal(mesh.colors.length, mesh.positions.length);
  assert(mesh.indices.length / 3 < 1200, 'each reusable rock mesh stays small');
  for (let i = 0; i < mesh.positions.length; i += 3) {
    assert(Math.abs(mesh.positions[i]) <= .501 && Math.abs(mesh.positions[i + 2]) <= .501, 'rock stays within its collision rectangle');
    assert(mesh.positions[i + 1] >= 0 && mesh.positions[i + 1] < 1.06, 'the authored height remains bounded');
  }
  assert(Math.max(...mesh.indices) < mesh.positions.length / 3);
}
// Test actual triangle contact through the entrance. A stone shell must not seal it with a front-facing polygon.
function firstZ(mesh, x, y) {
  let nearest = -Infinity;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = Array.from(mesh.indices.subarray(i, i + 3), index => Array.from(mesh.positions.subarray(index * 3, index * 3 + 3)));
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(det) < 1e-10) continue;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det, w = 1 - u - v;
    if (Math.min(u, v, w) >= -1e-7) nearest = Math.max(nearest, u * a[2] + v * b[2] + w * c[2]);
  }
  return nearest;
}
for (const [x, y] of [[0, .12], [0, .38], [-.1, .3], [.1, .3]]) {
  assert(firstZ(cave.shell, x, y) < -.4, 'the shell leaves the cave mouth open');
  assert(firstZ(cave.inside, x, y) < 0, 'inner walls recede behind the entrance');
  assert(Math.abs(firstZ(cave.rear, x, y) + .44) < .01, 'the dark rear lies deep inside the rock');
}
assert(firstZ(cave.shell, -.43, .25) > .4, 'solid rock frames the entrance');
assert(rockHeightAt(cliff, .18, -.3) > .9, 'the rock shelf supports trees');
assert(rockHeightAt(cave.shell, -.18, -.3) > .7, 'trees stand on the cave roof');
assert(Math.abs(rockHeightAt(cliff, .18, -.3, (x, z) => 2 + x * .2 + z * .1) - rockHeightAt(cliff, .18, -.3) - (2 + .18 * .2 - .3 * .1)) < 1e-7, 'roof support includes the sampled terrain at each vertex');

const relief = buildRelief(world, { seed: 49 });
const densities = [];
for (const phase of [0, 1]) {
  const sites = geologySites(world, phase);
  assert.equal(sites.length, 8); assert.equal(sites.filter(s => s.cave).length, 6);
  for (const site of sites) {
    const cover = world.OBSTACLES[phase].find(b => b.id === site.id);
    assert(site.w <= cover.w && site.d <= cover.h, 'rocks use shared cover in each realm');
    assert(site.height >= 760 && site.height <= 1100, 'rock faces have a major silhouette');
    const mirror = sites.find(s => s.x === site.x && Math.abs(s.z - (world.SIZE - site.z)) < 1e-6);
    assert(mirror && mirror.height === site.height && mirror.cave === site.cave, 'both teams get the same geological features');
    // The CPU roof sampler follows the same vertex displacement as the 3D material.
    const data = site.cave ? cave.shell : cliff;
    const groundAt = (x, z) => relief.heightAt(site.x + x * site.w, site.z + z * site.d) / site.height;
    const h = rockHeightAt(data, .18, -.3, groundAt) * site.height;
    assert(Number.isFinite(h) && h > relief.heightAt(site.x + .18 * site.w, site.z - .3 * site.d) + 450);
  }
  for (const seed of [1, 49, 91822]) {
    const scenery = makeScenery(seed, phase), trees = scenery.props.filter(p => p.canopy && !p.solid);
    assert(trees.length > 450 && trees.length < 1600, 'dense forest stays within the instance budget');
    assert(trees.reduce((sum, p) => sum + p.height, 0) / trees.length > 400, 'groves use mature tree silhouettes');
    assert(trees.every(p => laneDistance(p) >= 200), 'trees preserve the route core');
    densities.push({ seed, phase, trees: trees.length });
  }
}
console.log('PASS: eight mirrored rock bluffs, six open caves in both realms, real recessed interiors, bounded rock geometry, grounded roof trees and mature forest.', JSON.stringify(densities));
