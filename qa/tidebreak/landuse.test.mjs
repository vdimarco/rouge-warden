// Land use on the Shore map (makeLandUse in scenery.js): vineyards, meadows, cypress, rock outcrops and stream rocks.
// It is the same for the same seed, mirrored for the two teams, and stays clear of lanes, water, cover and objectives.
// Scenery trees leave the vineyards and outcrops open. Run: node qa/tidebreak/landuse.test.mjs
import assert from 'node:assert/strict';
import { makeLandUse, makeScenery, laneDistance, inField } from '../../public/tidebreak/scenery.js';
import { SIZE, BASES, OBSTACLES } from '../../public/tidebreak/world.js';
import { outsideRiver, riverCrossings } from '../../public/tidebreak/river.js';
import { PATHS } from '../../public/tidebreak/world.js';

const corner = (f, u, v) => { const c = Math.cos(f.angle), s = Math.sin(f.angle), x = u * f.w / 2, y = v * f.h / 2; return { x: f.x + x * c - y * s, y: f.y + x * s + y * c }; };
const inCover = p => OBSTACLES.some(set => set.some(b => Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.y - b.y) < b.h / 2));
for (const seed of [1, 49, 91822, 557079271]) {
  const use = makeLandUse(seed);
  assert.deepEqual(JSON.parse(JSON.stringify(use)), JSON.parse(JSON.stringify(makeLandUse(seed))), 'the same seed gives the same land use');
  assert.ok(use.fields.length >= 6 && use.meadows.length >= 4 && use.cypress.length >= 40 && use.outcrops.length >= 4 && use.stones.length >= 20, `${seed}: enough of each kind ${JSON.stringify(Object.fromEntries(Object.entries(use).map(([k, v]) => [k, v.length])))}`);
  // Mirrored: every southern field has a northern twin.
  for (const list of ['fields', 'meadows', 'cypress', 'outcrops']) {
    const half = use[list].length / 2;
    for (let i = 0; i < half; i++) { const a = use[list][i], b = use[list][i + half]; assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - (SIZE - b.y)) < 1e-6, `${seed}: ${list} mirror`); }
  }
  for (const f of use.fields) {
    assert.ok(f.rows >= 3, 'a vineyard has rows');
    for (let u = -1; u <= 1; u += .25) for (let v = -1; v <= 1; v += .5) {
      const p = corner(f, u, v);
      assert.ok(laneDistance(p) > 150 && outsideRiver(p, seed) > 170 && !inCover(p) && BASES.every(b => Math.hypot(p.x - b.x, p.y - b.y) > 1000), `${seed}: vineyard ground is open at ${Math.round(p.x)},${Math.round(p.y)}`);
    }
  }
  for (const t of use.cypress) assert.ok(laneDistance(t) > 120 && outsideRiver(t, seed) > 90 && !inCover(t) && !inField(t, use, 0), `${seed}: cypress stand clear of lanes, water, cover and vines`);
  for (const o of use.outcrops) assert.ok(laneDistance(o) > 200 + o.r && !inCover(o), `${seed}: outcrops leave the lanes open`);
  const crossings = riverCrossings(PATHS, seed);
  for (const p of use.stones) assert.ok(laneDistance(p) > 230 && crossings.every(c => Math.abs(c.x - p.x) > c.span / 2 + 280), `${seed}: stream rocks keep the crossings clear`);
  // Scenery trees leave the vineyards open.
  for (const phase of [0, 1]) {
    const tall = makeScenery(seed, phase).props.filter(p => !p.solid && p.canopy);
    assert.equal(tall.filter(p => inField(p, use, 200)).length, 0, `${seed}/${phase}: no tall tree stands in or beside a vineyard`);
  }
}
console.log('PASS: land use is seeded, mirrored, enough of each kind, and clear of lanes, water, cover, bases and crossings.');
