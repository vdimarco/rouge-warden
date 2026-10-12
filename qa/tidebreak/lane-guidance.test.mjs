import assert from 'node:assert/strict';
import { guidanceLane, distanceToPath, nextObjective, objectiveText } from '../../public/tidebreak/objectives.js';
import { BASES, PATHS, laneFrom, pointAtArc, TOWER_POSITIONS } from '../../public/tidebreak/world.js';
import { createMatch, player } from '../../public/tidebreak/sim.js';

// Long and short sampled segments both represent a continuous road, including endpoints.
assert.equal(distanceToPath({ x: 500, y: 30 }, [{ x: 0, y: 0 }, { x: 1000, y: 0 }]), 30);
assert.equal(distanceToPath({ x: -40, y: 0 }, [{ x: 0, y: 0 }, { x: 1000, y: 0 }]), 40);
assert.equal(distanceToPath({ x: 3, y: 4 }, [{ x: 0, y: 0 }, { x: 0, y: 0 }]), 5);

// The shared home court defaults to Middle and retains an existing choice while all roads meet.
for (const base of BASES) {
  assert.equal(guidanceLane(base), 1);
  assert.equal(guidanceLane({ x: base.x - 120, y: base.y + 30 }), 1);
  assert.equal(guidanceLane(base, 0), 0);
  assert.equal(guidanceLane(base, 2), 2);
}

const s = createMatch(0, 49), p = player(s), assigned = p.lane;
for (const team of [0, 1]) for (const lane of [0, 1, 2]) {
  // Travel far enough from the shared court to choose the current road, irrespective of old guidance.
  const position = pointAtArc(laneFrom(team, lane), 3750);
  Object.assign(p, position);
  const current = guidanceLane(p, (lane + 1) % 3);
  assert.equal(current, lane, `team ${team}, lane ${lane}: guidance follows the current road`);
  assert.equal(p.lane, assigned, 'guidance does not mutate the simulator lane assignment');
  assert.equal(nextObjective(s, 1, current).lane, lane, 'Next tower uses the current lane');
  assert.match(objectiveText(s, current), new RegExp(`^${['West', 'Middle', 'East'][lane]} lane:`));
  for (const tower of TOWER_POSITIONS[team][lane]) assert.equal(guidanceLane(tower), lane, 'wards identify their own road');
}

// Find the jungle boundary between West and Middle. Small movement across it must not flicker the label.
const west = pointAtArc(laneFrom(0, 0), 1250), middle = pointAtArc(laneFrom(0, 1), 1250);
const between = t => ({ x: west.x + (middle.x - west.x) * t, y: west.y + (middle.y - west.y) * t });
let low = 0, high = 1;
for (let i = 0; i < 40; i++) {
  const t = (low + high) / 2, q = between(t);
  if (distanceToPath(q, PATHS[0]) < distanceToPath(q, PATHS[1])) low = t; else high = t;
}
for (const previous of [0, 1]) for (const shift of [-.005, .005, -.01, .01])
  assert.equal(guidanceLane(between((low + high) / 2 + shift), previous), previous, 'boundary jitter retains the current label');
assert.equal(guidanceLane(west, 1), 0, 'a clear move to West switches guidance');
assert.equal(guidanceLane(middle, 0), 1, 'a clear return to Middle switches guidance');
assert.equal(guidanceLane(null, 2), 2, 'unavailable position retains the current guidance');
assert.equal(guidanceLane(BASES[0], 9), 1, 'invalid previous lane falls back to Middle');
console.log('PASS: continuous lane distance, stable shared courts and boundary labels, current lane objectives, unchanged simulation lane.');
