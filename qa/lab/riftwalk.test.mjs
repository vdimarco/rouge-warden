// Riftwalk rules (public/lab/riftwalk/rules.js): where the rifts stand, the walk circle, the rays that catch a wisp
// or pick the rift, and the clock. Run: node qa/lab/riftwalk.test.mjs
import assert from 'node:assert/strict';
import { WORLDS, EYE, SPACING, RIFT_RADIUS, RIFT_Y, WISPS, LANE, nextIndex, direction, centre, outRift, inRift, wispPlace, walk, rayNear, rayThroughRift, clock } from '../../public/lab/riftwalk/rules.js';
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
let n = 0; const pass = name => { n++; console.log('PASS ' + name); };

// Four worlds in a loop that ends where it starts.
assert.equal(WORLDS.length, 4); assert.deepEqual(WORLDS.map(w => w.id), ['cottage', 'shore', 'ice', 'moonwell']);
assert.deepEqual([0, 1, 2, 3].map(nextIndex), [1, 2, 3, 0]);
for (const w of WORLDS) { assert.equal(w.wisps.length, WISPS); assert.match(w.file, /^[a-z]+\.spz$/); }
pass('four worlds loop back to the cottage, with three wisps each');

// Compass directions.
assert(near(direction(0).z, -1) && near(direction(90).x, 1) && near(direction(180).z, 1) && near(direction(270).x, -1));
// Worlds stand far apart: no world's splats (the largest reaches about 85 m) show in another.
assert(SPACING >= 2 * 85 + 100);
pass('compass directions and world spacing');

for (let i = 0; i < WORLDS.length; i++) {
  const w = WORLDS[i], c = centre(i), out = outRift(i), back = inRift(i);
  // The out rift fronts the centre: its +z axis points from the rift to the centre.
  const front = { x: Math.sin(out.yaw), z: Math.cos(out.yaw) }, toCentre = { x: (c.x - out.x) / w.outDist, z: (c.z - out.z) / w.outDist };
  assert(near(front.x, toCentre.x, 1e-9) && near(front.z, toCentre.z, 1e-9), w.id + ': the out rift fronts the centre');
  // The in rift fronts away from the centre, so a walker who leaves by the back of one arrives walking to the centre.
  const inFront = { x: Math.sin(back.yaw), z: Math.cos(back.yaw) }, away = { x: (back.x - c.x) / w.inDist, z: (back.z - c.z) / w.inDist };
  assert(near(inFront.x, away.x, 1e-9) && near(inFront.z, away.z, 1e-9), w.id + ': the in rift fronts away from the centre');
  // The eye passes inside the disc, and the disc clears the floor.
  assert(Math.abs(EYE - RIFT_Y) < RIFT_RADIUS * 0.5 && RIFT_Y - RIFT_RADIUS > 0);
  // The two rifts of a world do not stand in the same place, and the out rift is outside the walk circle.
  assert(Math.hypot(out.x - back.x, out.z - back.z) > 2 * RIFT_RADIUS, w.id + ': the two rifts are apart');
  assert(w.outDist > w.walk, w.id + ': the out rift is past the walk circle');
  // Every wisp can be seen and tapped from the centre: not behind the out rift's disc, not under the floor.
  for (let k = 0; k < WISPS; k++) {
    const p = wispPlace(i, k), eye = { x: c.x, y: EYE, z: c.z }, d = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z }, l = Math.hypot(d.x, d.y, d.z), dir = { x: d.x / l, y: d.y / l, z: d.z / l };
    assert(p.y > 0.3 && p.y < 3, w.id + ': wisp height'); assert(rayNear(eye, dir, p), w.id + ': a ray at the wisp catches it');
    assert.equal(rayThroughRift(eye, dir, out), null, w.id + ': wisp ' + k + ' is not in front of the rift');
    for (let j = 0; j < k; j++) { const q = wispPlace(i, j); assert(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) > 1.2, w.id + ': wisps are apart'); }
  }
}
pass('rifts face the right way, and wisps are apart, in reach and clear of the rift');

{ // The walk circle.
  const w = WORLDS[1], d = direction(w.out), o = { x: 0, z: 0 };
  assert.deepEqual(walk(w, o, { x: 0.5, z: 0.5 }, false), { x: 0.5, z: 0.5 });
  // A step out of the circle is refused or slid along the circle.
  const edge = { x: w.walk, z: 0 }, out = walk(w, edge, { x: w.walk + 0.4, z: 0.3 }, false);
  assert(Math.hypot(out.x, out.z) <= w.walk + 1e-6, 'the walker stays in the circle: ' + JSON.stringify(out));
  // The lane to the rift is shut while the rift is shut, and open when it is open.
  const lip = { x: d.x * w.walk, z: d.z * w.walk }, step = { x: d.x * (w.walk + 0.3), z: d.z * (w.walk + 0.3) };
  assert(Math.hypot(...Object.values(walk(w, lip, step, false))) <= w.walk + 1e-6, 'no lane while the rift is shut');
  assert.deepEqual(walk(w, lip, step, true), step, 'the lane is open with the rift');
  const wide = { x: step.x + d.z * (LANE + 0.3), z: step.z - d.x * (LANE + 0.3) };
  assert.notDeepEqual(walk(w, step, wide, true), wide, 'the lane has sides');
  // The lane reaches past the rift, so the walker can cross its plane.
  const past = { x: d.x * (w.outDist + 0.4), z: d.z * (w.outDist + 0.4) };
  assert.deepEqual(walk(w, { x: d.x * w.outDist, z: d.z * w.outDist }, past, true), past);
  // After an arrival the walker is outside the circle and can only come nearer.
  const arrive = direction(w.in), at = { x: arrive.x * w.inDist, z: arrive.z * w.inDist };
  const inward = { x: at.x * 0.9, z: at.z * 0.9 }, outward = { x: at.x * 1.1, z: at.z * 1.1 };
  assert.deepEqual(walk(w, at, inward, false), inward); assert.notDeepEqual(walk(w, at, outward, false), outward);
  // A walk of many small steps in one direction never leaves the circle.
  let p = { x: 0, z: 0 }; for (let i = 0; i < 400; i++) p = walk(w, p, { x: p.x + 0.03, z: p.z + 0.011 }, false);
  assert(Math.hypot(p.x, p.z) <= w.walk + 1e-6);
}
pass('the walk circle, the lane to an open rift, and the walk in after an arrival');

{ // Rays.
  const eye = { x: 0, y: EYE, z: 0 };
  assert(rayNear(eye, { x: 0, y: 0, z: -1 }, { x: 0.1, y: EYE, z: -2 }));
  assert.equal(rayNear(eye, { x: 0, y: 0, z: -1 }, { x: 1.2, y: EYE, z: -2 }), null, 'a wide miss');
  assert.equal(rayNear(eye, { x: 0, y: 0, z: 1 }, { x: 0, y: EYE, z: -2 }), null, 'behind the eye');
  const rift = outRift(1);
  assert(rayThroughRift(eye, { x: 0, y: 0, z: -1 }, { ...rift, x: 0, z: -2.3 }));
  assert.equal(rayThroughRift(eye, { x: 0.7, y: 0, z: -0.714 }, { ...rift, x: 0, z: -2.3 }), null, 'past the rim');
  assert.equal(rayThroughRift(eye, { x: 0, y: 0, z: 1 }, { ...rift, x: 0, z: -2.3 }), null, 'looking away');
}
pass('look rays catch a wisp and pick the rift');

assert.equal(clock(0), '0:00'); assert.equal(clock(59.9), '0:59'); assert.equal(clock(61), '1:01'); assert.equal(clock(600), '10:00'); assert.equal(clock(-3), '0:00');
pass('the clock');
console.log(n + ' checks passed');
