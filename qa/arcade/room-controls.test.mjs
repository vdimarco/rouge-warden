// Movement rules for the 3D arcade: floating stick, strafing, tap targets, collision and the hall layout.
import assert from 'node:assert/strict';
import { hallLayout, collider, moveDelta, yawToward, turnToward, stickVector, zoneFor, isTap, standPoint, tapTarget, stepToward, STICK } from '../../public/arcade/room/controls.js';
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

// the hall grows with the catalog: no cabinet stands past the lounge or the back wall
for (const n of [2, 23, 32, 41]) {
  const l = hallLayout(n), clear = collider(l);
  assert.equal(l.cabinets.length, n);
  assert.ok(Math.min(...l.cabinets.map(c => c.z)) - 1.02 > l.back + 3.2, `room for ${n} cabinets`);
  for (const c of l.cabinets) { const s = standPoint(c); assert.ok(clear(s.x, s.z), 'stand point is free'); assert.ok(!clear(c.x, c.z), 'cabinet is solid'); }
}
// stick: up walks forward, sideways strafes, a small wobble does nothing, a long pull is capped at full speed
assert.deepEqual(stickVector(2, 3), { forward: 0, strafe: 0, mag: 0 });
let v = stickVector(0, -STICK); near(v.forward, 1); near(v.strafe, 0);
v = stickVector(STICK * 3, 0); near(v.strafe, 1); near(v.forward, 0);
v = stickVector(-STICK / 2, 0); assert.ok(v.strafe < -0.3 && v.strafe > -0.6);
// strafing right while facing down the hall moves along +x only; facing a side wall it moves along z
let d = moveDelta(0, 0, 1, 1); near(d.dx, 1); near(d.dz, 0);
d = moveDelta(0, 1, 0, 1); near(d.dx, 0); near(d.dz, -1);
d = moveDelta(Math.PI / 2, 0, 1, 1); near(d.dx, 0, 1e-12); near(d.dz, -1);
// touch splits the screen; a mouse always looks
assert.equal(zoneFor('touch', 100, 390), 'move'); assert.equal(zoneFor('touch', 300, 390), 'look'); assert.equal(zoneFor('mouse', 10, 390), 'look'); assert.equal(zoneFor('pen', 10, 390), 'move');
assert.ok(isTap(4)); assert.ok(!isTap(14));
// facing and turning take the short way round
near(yawToward(0, 0, -1, 0), Math.PI / 2); near(yawToward(0, 0, 0, -1), 0);
near(turnToward(3, -3, 0.1), 3.1); near(turnToward(0, 0.05, 0.1), 0.05);
// tap targets: a cabinet walks to its front and faces it; the floor walks there; walls are clamped
const l = hallLayout(32), clear = collider(l), c = l.cabinets[3];
let t = tapTarget(l, clear, c.x, c.z); assert.equal(t.cabinet, c); near(t.yaw, yawToward(t.x, t.z, c.x, c.z));
t = tapTarget(l, clear, 1, 4); assert.deepEqual(t, { x: 1, z: 4 });
t = tapTarget(l, clear, 40, 4); assert.equal(t.x, 5.1);
assert.equal(tapTarget(l, clear, 0, l.back + 1.5), null, 'the lounge sofa is not a target');
// walking: arrives, slides along a cabinet instead of stopping dead
let p = { x: 0, z: 9 }; for (let i = 0; i < 400 && !p.arrived; i++) p = stepToward(p, standPoint(c), 0.05, clear);
assert.ok(p.arrived); near(p.x, standPoint(c).x); near(p.z, c.z);
p = stepToward({ x: -4.9, z: c.z + 1.4 }, { x: -6.2, z: c.z - 3 }, 0.1, clear); assert.ok(p.z < c.z + 1.4, 'slides along the cabinet');
console.log('PASS room controls: hall layout, stick strafing, touch zones, taps, facing, tap targets, arrival and sliding');
