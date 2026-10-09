// Pointer rays must hit the same triangles that actors stand on, including mirrored slopes and bridge decks.
import assert from 'node:assert/strict';
import * as world from '../../public/tidebreak/world.js';
import { buildRelief } from '../../public/tidebreak/relief.js';
import { bridgeSurface, intersectRelief, BRIDGE_DECK, waterMaskAt, cameraLift } from '../../public/tidebreak/surface.js';

const relief = buildRelief(world, { seed: 49 });
let queries = 0;
for (const x of [450, 1500, 2800, 4100, 6000, 7800, 9000]) for (const z of [650, 2100, 3800, 5600, 7300, 9000]) {
  const target = { x, y: relief.heightAt(x, z), z };
  const offset = { x: 120, y: 1100, z: 650 };
  offset.y += cameraLift(relief.heightAt, x, z, target.y, offset.x, offset.z, offset.y);
  const length = Math.hypot(offset.x, offset.y, offset.z);
  const ray = { origin: { x: x + offset.x, y: target.y + offset.y, z: z + offset.z }, direction: { x: -offset.x / length, y: -offset.y / length, z: -offset.z / length } };
  const hit = intersectRelief(ray, relief);
  assert(hit, 'downward pointer ray intersects the terrain');
  assert(Math.hypot(hit.x - target.x, hit.y - target.y, hit.z - target.z) < .001, 'pointer returns its projected surface point');
  assert(Math.abs(hit.y - relief.heightAt(hit.x, hit.z)) < .001, 'picked height matches the rendered triangle');
  queries++;
}
assert.equal(intersectRelief({ origin: { x: 0, y: 100, z: 0 }, direction: { x: 0, y: 1, z: 0 } }, relief), null, 'upward rays do not select ground behind the camera');
assert.equal(intersectRelief({ origin: { x: relief.origin - 20, y: 1000, z: 0 }, direction: { x: 0, y: -1, z: 0 } }, relief), null, 'parallel rays outside the mesh miss');
assert.equal(intersectRelief({ origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: -1, z: 0 } }, null), null, 'input remains safe before the landscape loads');
assert.equal(cameraLift(() => 0, 0, 0, 0, 0, 1200, 1930), 0, 'flat ground retains the normal camera');
assert(cameraLift((x, z) => z * 2.3, 0, 0, 0, 0, 1200, 1930) > 800, 'a steep shoulder raises the camera above its hero');

// Grid-boundary and corner rays exercise simultaneous cell advances and vertical traversal without a horizontal
// direction. Their first contacts are checked independently against the actual triangle planes below.
const vertices = relief.vertices, indices = relief.indices;
function triangleRayDistance(ray, offset) {
  const [a, b, c] = Array.from(indices.slice(offset, offset + 3), i => Array.from(vertices.slice(i * 3, i * 3 + 3)));
  const sub = (u, v) => u.map((n, i) => n - v[i]), cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], dot = (u, v) => u.reduce((n, x, i) => n + x * v[i], 0);
  const o = [ray.origin.x, ray.origin.y, ray.origin.z], d = [ray.direction.x, ray.direction.y, ray.direction.z], e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), determinant = dot(e1, p);
  if (Math.abs(determinant) < 1e-12) return Infinity;
  const delta = sub(o, a), u = dot(delta, p) / determinant, q = cross(delta, e1), v = dot(d, q) / determinant, t = dot(e2, q) / determinant;
  return u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9 && t >= 0 ? t : Infinity;
}
for (const ray of [
  // Keep the shallow ridge regression checked against the first actual triangle as the landforms evolve.
  { origin: { x: 5320.833333333334, y: 938.2070925711703, z: 3508.333333333334 }, direction: { x: 0, y: -.6156614753256582, z: -.7880107536067219 } },
  { origin: { x: 4800, y: 1000, z: 4800 }, direction: { x: 0, y: -1, z: 0 } },
  { origin: { x: 6000, y: 1700, z: 6000 }, direction: { x: -1, y: -1, z: -1 } },
  { origin: { x: 4800, y: 1300, z: 7300 }, direction: { x: 0, y: -.65, z: -1 } },
  { origin: { x: 4800, y: 1300, z: 2300 }, direction: { x: 0, y: -.65, z: 1 } },
]) {
  let first = Infinity; for (let offset = 0; offset < indices.length; offset += 3) first = Math.min(first, triangleRayDistance(ray, offset));
  const hit = intersectRelief(ray, relief); assert(hit && Number.isFinite(first), 'boundary ray hits the mesh');
  assert(Math.hypot(hit.x - ray.origin.x - ray.direction.x * first, hit.y - ray.origin.y - ray.direction.y * first, hit.z - ray.origin.z - ray.direction.z * first) < .001, 'cell traversal matches the first actual mesh triangle');
}

const angle = .65, b = { x: 3300, y: 4800, span: 400, dx: Math.cos(angle), dy: Math.sin(angle) };
assert.equal(bridgeSurface([b], b.x, b.y, -50), BRIDGE_DECK, 'bridge center stands on the deck rather than the river bed');
assert.equal(bridgeSurface([b], b.x + b.dx * 150, b.y + b.dy * 150, -30), BRIDGE_DECK, 'rotated bridge walk follows its deck');
assert.equal(bridgeSurface([b], b.x - b.dy * 160, b.y + b.dx * 160, -35), -35, 'water beside the bridge remains river bed');
assert.equal(bridgeSurface([b], b.x + b.dx * 300, b.y + b.dy * 300, 0), 0, 'bridge ends do not create an invisible platform');
assert.equal(bridgeSurface([b], b.x, b.y, 20), 20, 'an exposed higher surface is retained');
const mask = { size: 2, world: 1000, data: new Uint8Array(16) }; mask.data[3] = mask.data[7] = 255;
assert.equal(waterMaskAt(mask, 250, 250), true, 'water-covered lowered terrain lifts effects to the visible water surface');
assert.equal(waterMaskAt(mask, 250, 750), false, 'a dry depression keeps ground effects at its lowered surface');
assert.equal(waterMaskAt(mask, 250, 500), false, 'CPU threshold matches the GPU bilinear mask threshold');
assert.equal(waterMaskAt(mask, -10, 250), false, 'water mask does not extend outside the arena');
console.log(`PASS: ${queries} raised/low terrain pointer round trips, grazing first contact, exact boundary/corner intersections, safe misses and rotated bridge deck bounds.`);
