// Ground warnings must follow whole terrain triangles, with separate water/deck planes at their boundaries.
// Load the committed browser Three module directly; this CPU check needs neither npm packages nor WebGL.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import * as world from '../../public/tidebreak/world.js';
import { buildRelief } from '../../public/tidebreak/relief.js';

const threeURL = new URL('../../public/vr/lib/three.module.min.js', import.meta.url).href;
const hook = `export async function resolve(specifier, context, next) {
  return specifier === 'three' ? { url: ${JSON.stringify(threeURL)}, shortCircuit: true } : next(specifier, context);
}`;
register('data:text/javascript,' + encodeURIComponent(hook), import.meta.url);
const THREE = await import('three');
const { Effects } = await import('../../public/tidebreak/render3d/effects.js');

const field = buildRelief(world, { seed: 49 });
const heightData = new Float32Array(field.heights.length * 4);
for (let i = 0; i < field.heights.length; i++) heightData[i * 4] = field.heights[i];
const heightUniforms = {
  uTerrainHeight: { value: new THREE.DataTexture(heightData, field.resolution, field.resolution, THREE.RGBAFormat, THREE.FloatType) },
  uTerrainOrigin: { value: new THREE.Vector2(field.origin, field.origin) },
  uTerrainSpan: { value: field.span }, uTerrainSegments: { value: field.segments },
};
const mask = new Uint8Array(32 * 32 * 4);
for (let z = 15; z <= 17; z++) for (let x = 0; x < 32; x++) mask[(z * 32 + x) * 4 + 3] = 255;
const surfaceUniforms = {
  uSurfaceMask: { value: new THREE.DataTexture(mask, 32, 32) }, uSurfaceSize: { value: world.SIZE },
};
const effects = new Effects(new THREE.Scene(), {}, { heightUniforms, surfaceUniforms });
const decals = effects.decals;
let triangles = 0, maxError = 0;
function layers() {
  return Array.from(decals.mesh.geometry.getAttribute('aSurface').array.subarray(0, decals.vertices));
}
function checkTerrainInteriors() {
  const a = decals.mesh.geometry.attributes;
  for (let j = 0; j < decals.vertices; j += 3) {
    const layer = a.aSurface.array[j];
    assert.equal(layer, a.aSurface.array[j + 1], 'a triangle stays on one surface');
    assert.equal(layer, a.aSurface.array[j + 2]);
    if (layer !== 0) continue;
    let x = 0, z = 0, planeHeight = 0;
    for (const [k, weight] of [[0, .21], [1, .33], [2, .46]]) {
      const px = a.position.array[(j + k) * 3], pz = a.position.array[(j + k) * 3 + 2];
      x += px * weight; z += pz * weight; planeHeight += field.heightAt(px, pz) * weight;
    }
    const error = Math.abs(planeHeight - field.heightAt(x, z));
    maxError = Math.max(maxError, error);
    assert(error < .005, `the whole decal triangle follows its terrain plane (${error})`);
    triangles++;
  }
}

// These large rings previously lost parts of their rims underneath a ridge between independently sampled vertices.
for (const radius of [450, 600]) {
  decals.begin(0); decals.circle(5343.635, 7553.635, radius, { outline: 1, line: 8 }); decals.end();
  checkTerrainInteriors();
  assert.equal(decals.n, 1); assert.equal(decals.mesh.count, 1);
  assert.equal(decals.mesh.geometry.drawRange.count, decals.vertices);
  const a = decals.mesh.geometry.attributes;
  for (let i = 0; i < decals.vertices; i++) if (a.aSurface.array[i] === 0) {
    assert(Math.abs(a.uv.array[i * 2] - (a.position.array[i * 3] - 5343.635) / radius) < 1e-5, 'circle mask retains its horizontal radius');
    assert(Math.abs(a.uv.array[i * 2 + 1] + (a.position.array[i * 3 + 2] - 7553.635) / radius) < 1e-5, 'circle mask retains its vertical radius');
  }
}

decals.begin(0); decals.capsule(5100, 7000, 6100, 8100, 70, { outline: 1, fill: .2, line: 5 }); decals.end();
checkTerrainInteriors(); assert.equal(decals.shape[0], 1);
const dx = 1000, dz = 1100, distance = Math.hypot(dx, dz), half = 70, length = distance / 2 + half;
for (let i = 0; i < decals.vertices; i++) {
  const a = decals.mesh.geometry.attributes; if (a.aSurface.array[i] !== 0) continue;
  const x = a.position.array[i * 3] - 5600, z = a.position.array[i * 3 + 2] - 7550;
  const along = (x * dx + z * dz) / distance, across = (-x * dz + z * dx) / distance;
  assert(Math.abs(a.uv.array[i * 2] - along / length) < 1e-5, 'a rotated capsule retains its length');
  assert(Math.abs(a.uv.array[i * 2 + 1] + across / half) < 1e-5, 'a rotated capsule retains its half width');
}

decals.begin(0); decals.circle(5000, 4800, 300); decals.end();
assert(layers().includes(3), 'a warning over wet ground includes a horizontal water layer');
decals.begin(0); decals.circle(5000, 7500, 300); decals.end();
assert(!layers().includes(3), 'a dry warning has no water layer');
effects.setBridges([{ x: 5000, y: 4800, dx: .6, dy: .8, span: 500 }]);
decals.begin(0); decals.circle(5000, 4800, 450); decals.end();
let deckVertices = 0;
for (let i = 0; i < decals.vertices; i++) {
  const a = decals.mesh.geometry.attributes; if (a.aSurface.array[i] !== 12) continue;
  const x = a.position.array[i * 3] - 5000, z = a.position.array[i * 3 + 2] - 4800;
  assert(Math.abs(x * .6 + z * .8) <= 300.001, 'deck overlays stop at the rotated bridge ends');
  assert(Math.abs(-x * .8 + z * .6) <= 135.001, 'deck overlays stop at the rotated bridge sides');
  deckVertices++;
}
assert(deckVertices >= 6, 'a bridge crossing gets its own deck triangles');

const originalPosition = decals.mesh.geometry.getAttribute('position').array;
decals.begin(0); decals.circle(5000, 4800, 450); decals.end();
assert.equal(decals.mesh.geometry.getAttribute('position').array, originalPosition, 'successive frames reuse the batch');
const beforeGrowth = Array.from(originalPosition.subarray(0, decals.vertices * 3));
assert(decals.reserve(decals.capacity + 1));
assert.deepEqual(Array.from(decals.mesh.geometry.getAttribute('position').array.subarray(0, decals.vertices * 3)), beforeGrowth, 'growing the batch preserves active geometry');
decals.begin(0); decals.end();
assert.equal(decals.mesh.visible, false); assert.equal(decals.mesh.geometry.drawRange.count, 0);
decals.begin(0); decals.circle(4800, 4800, 1e6);
const beforeLimit = decals.vertices;
decals.circle(4800, 4800, 1e6); decals.end();
assert.equal(decals.n, 1, 'the vertex budget rejects an entire excess decal');
assert.equal(decals.vertices, beforeLimit); assert(decals.capacity <= 262144, 'batch storage has a fixed upper bound');

const flat = new Effects(new THREE.Scene(), {}).decals;
flat.begin(0); for (let i = 0; i < 350; i++) flat.circle(100, 200, 60); flat.end();
assert.equal(flat.n, 320); assert.equal(flat.vertices, 1920); assert.equal(flat.mesh.count, 320, 'flat fallback retains combat diagnostics');
console.log(`PASS: ${triangles} conforming decal triangles (maximum error ${maxError.toFixed(6)}), circle/capsule masks, water/deck layers, reusable bounded batches and flat diagnostics.`);
