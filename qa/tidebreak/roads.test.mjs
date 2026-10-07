// Winding lane roads: the meander is fixed and deterministic, mirrored between the teams, bounded, clear of the map's
// features, and it keeps the lane lengths and the ward spacing within their limits.
import assert from 'node:assert/strict';
import { SIZE, PATHS, WINDING, windLane, BASES, OBSTACLES, CAMPS, PORTALS, TOWER_POSITIONS, arcLength, distance } from '../../public/tidebreak/world.js';
import { mirror } from '../../public/tidebreak/arena.js';
import { LANE_MEANDER, LANE_KNOTS } from '../../public/tidebreak/layout.js';
import { meanderWave, bendRadius } from '../../public/tidebreak/roads.js';
import { TIERS } from '../../public/tidebreak/sim.js';

const rectGap = (p, r) => Math.hypot(Math.max(0, Math.abs(p.x - r.x) - r.w / 2), Math.max(0, Math.abs(p.y - r.y) - r.h / 2));
const walk = path => path.reduce((list, p, i) => (list.push(i ? list[i - 1] + distance(p, path[i - 1]) : 0), list), []);
// Total turning in degrees, and how often the road changes from a left bend to a right bend.
function bends(path) {
  let turn = 0, flips = 0, last = 0;
  for (let i = 4; i < path.length - 4; i += 2) {
    const a = path[i - 4], b = path[i], c = path[i + 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), d = Math.atan2(cross, (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y));
    turn += Math.abs(d) / 2;
    if (Math.abs(d) > .04) { const sign = Math.sign(d); if (last && sign !== last) flips++; last = sign; }
  }
  return { turn: turn * 180 / Math.PI, flips };
}

// Determinism: the same map always winds the same roads, and the meander wave depends on its seed.
for (let lane = 0; lane < 3; lane++) assert.deepEqual(windLane(lane).path, WINDING[lane].path, `lane ${lane} winds the same way every time`);
const wave = meanderWave(LANE_MEANDER.seed, 5000, LANE_MEANDER.wavelength), again = meanderWave(LANE_MEANDER.seed, 5000, LANE_MEANDER.wavelength), other = meanderWave(LANE_MEANDER.seed + 1, 5000, LANE_MEANDER.wavelength);
assert.equal(wave(1234), again(1234)); assert.notEqual(wave(1234), other(1234), 'a different seed gives a different meander');
for (let s = 0; s <= 5000; s += 50) assert(Math.abs(wave(s)) <= 1 + 1e-9, 'the meander wave is scaled to [-1, 1]');

const report = [];
for (const [lane, path] of PATHS.entries()) {
  const { spline, path: half } = WINDING[lane], n = path.length, middle = (n - 1) / 2;
  // Fairness: team 1's half is the exact mirror of team 0's half, end to end.
  assert.deepEqual(path[0], BASES[0]); assert.deepEqual(path.at(-1), BASES[1]);
  for (let i = 0; i < n; i++) assert.deepEqual(path[n - 1 - i], mirror(path[i]), `lane ${lane} is mirrored at sample ${i}`);
  assert.equal(path[middle].y, SIZE / 2, 'the lane meets the river axis at its halfway sample');
  assert(Math.abs(path[middle].x - LANE_KNOTS[lane].at(-1)[0] * SIZE) < 1e-6, 'the river crossing stays at the knot on the axis');
  // The meander fades out at the base court and before the river, and never swings wider than its amplitude.
  const at = walk(half), length = at.at(-1);
  let widest = 0;
  for (let i = 0; i < half.length; i++) {
    const offset = distance(half[i], spline[i]); widest = Math.max(widest, offset);
    assert(offset <= LANE_MEANDER.amplitude[lane] + 1e-6, `lane ${lane} swings no wider than its amplitude`);
    if (at[i] < LANE_MEANDER.calmBase[0] || at[i] > length - LANE_MEANDER.calmRiver[0] * .97) assert(offset < 1, `lane ${lane} runs straight out of the court and onto the bridge`);
  }
  // Organic: a real sideways swing, more turning than the spline, at least one change of bend (an S) on each half.
  const wound = bends(half), plain = bends(spline.slice(0, middle + 1));
  assert(widest >= (lane === 1 ? 60 : 150), `lane ${lane} swings ${widest.toFixed(0)} units off its spline`);
  assert(wound.turn >= plain.turn * 1.4, `lane ${lane} turns more than the plain spline (${wound.turn.toFixed(0)} against ${plain.turn.toFixed(0)} degrees)`);
  assert(wound.flips >= 2, `lane ${lane} bends left and right (${wound.flips} changes)`);
  // Gentle: no kink tighter than the rule (or than the plain spline already had there).
  for (let i = 3; i < half.length - 3; i++) assert(bendRadius(half[i - 3], half[i], half[i + 3]) >= Math.min(LANE_MEANDER.minBend, .95 * bendRadius(spline[i - 3], spline[i], spline[i + 3])) - 1e-6, `lane ${lane} bends gently at sample ${i}`);
  // Length: the winding adds a little walk, within the stretch limit.
  const before = arcLength(spline), after = arcLength(path);
  assert(after >= before && after <= before * LANE_MEANDER.maxStretch, `lane ${lane} length ${after.toFixed(0)} stays within ${LANE_MEANDER.maxStretch} of ${before.toFixed(0)}`);
  // Clear of cover (both realms), camps and river gates.
  for (const p of path) {
    for (const phase of [0, 1]) for (const r of OBSTACLES[phase]) assert(rectGap(p, r) >= LANE_MEANDER.coverClear - 1e-6, `lane ${lane} keeps ${LANE_MEANDER.coverClear} units from cover`);
    for (const c of [...CAMPS, ...PORTALS.filter(g => g.base === undefined)]) assert(distance(p, c) >= LANE_MEANDER.spotClear - 1e-6, `lane ${lane} keeps ${LANE_MEANDER.spotClear} units from camps and river gates`);
  }
  // Wards stay at least 2.5 tower ranges apart in a straight line, for both teams.
  for (const team of [0, 1]) for (let tier = 1; tier < 3; tier++) {
    const gap = distance(TOWER_POSITIONS[team][lane][tier], TOWER_POSITIONS[team][lane][tier - 1]);
    assert(gap >= 2.5 * Math.max(TIERS[tier].range, TIERS[tier - 1].range), `lane ${lane} wards ${tier - 1} and ${tier} are ${gap.toFixed(0)} apart`);
  }
  report.push({ lane, spline: Math.round(before), road: Math.round(after), stretch: +(after / before).toFixed(3), widest: Math.round(widest), turn: [Math.round(plain.turn), Math.round(wound.turn)], flips: wound.flips });
}
const [west, middle, east] = PATHS.map(arcLength);
assert(Math.abs(west - east) / west < .02, 'the two side lanes are about the same length');
assert(middle >= .75 * Math.max(west, east), 'the middle lane is not much shorter than the side lanes');
console.log('PASS: deterministic, mirrored winding roads with gentle bends, bounded swing and length, clear of cover, camps and gates, and wards still spaced.', JSON.stringify(report));
