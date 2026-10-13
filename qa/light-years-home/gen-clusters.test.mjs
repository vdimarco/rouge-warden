// Light Years Home: the cosmic web grows dense knots at the real clusters. gen/web.js runs with the positions, radii,
// member counts and giants of every galaxy cluster in objects.js (converted to Mly, as the renderer passes them) over
// a box from the Sloan Great Wall to home, with and without the Local Void, and Coma, Virgo and Fornax each end up
// with at least 400 points within 3 Mpc (9.78 Mly) at the high tier, and the same share at the lower tiers.
// node qa/light-years-home/gen-clusters.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { cosmicWeb, WEB_COUNTS } from '../../public/light-years-home/core/gen/web.js';
import { OBJECTS, LY_PER_MPC } from '../../public/light-years-home/core/objects.js';

const MLY = 1e6;
const KNOT_R = (3 * LY_PER_MPC) / MLY;                     // 3 Mpc = 9.78 Mly
const TARGETS = ['coma', 'virgo', 'fornax'];
// Every cluster in the catalogue. Laniakea is a basin, not a knot. Shapley spreads over sub-clumps and Hercules is
// lumpy (final.md 2.11); objects.js carries no member count for Shapley, so it gets the thousands its card names.
const CLUSTERS = Object.entries(OBJECTS)
  .filter(([id, o]) => (o.kind === 'cluster' || o.kind === 'supercluster') && id !== 'laniakea')
  .map(([id, o]) => ({
    id, pos: o.pos.map((v) => v / MLY), radius: o.radiusLy / MLY, members: o.members ?? 8000, giants: o.giants ?? 0,
    ...(id === 'shapley' ? { clumps: 6 } : id === 'hercules' ? { clumps: 3 } : {}),
  }));
const VOIDS = [{ pos: OBJECTS['local-void'].pos.map((v) => v / MLY), radius: OBJECTS['local-void'].radiusLy / MLY }];
// From the start (386, −304, 871 Mly) to home, with Shapley and Hercules inside.
const BOX = { centre: [190, -150, 420], box: [900, 900, 1100] };

function within(w, c, r) {
  let k = 0;
  for (let i = 0; i < w.count; i++) {
    const dx = w.positions[i * 3] - c[0], dy = w.positions[i * 3 + 1] - c[1], dz = w.positions[i * 3 + 2] - c[2];
    if (dx * dx + dy * dy + dz * dz < r * r) k++;
  }
  return k;
}

test('the catalogue gives the generator what it needs', () => {
  for (const id of TARGETS) {
    const k = CLUSTERS.find((c) => c.id === id);
    assert.ok(k, `${id} is a cluster in objects.js`);
    assert.ok(k.radius > 1 && k.radius < 10, `${id}: radius ${k.radius} Mly`);
    assert.ok(k.members >= 50, `${id}: members`);
    assert.ok(Math.abs(KNOT_R - 9.78) < 0.01);
  }
  // The box holds every target.
  for (const id of TARGETS) {
    const p = OBJECTS[id].pos.map((v) => v / MLY);
    p.forEach((v, a) => assert.ok(Math.abs(v - BOX.centre[a]) < BOX.box[a] / 2, `${id} inside the box`));
  }
});

test('Coma, Virgo and Fornax each have at least 400 points within 3 Mpc at the high tier', () => {
  const report = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const voids of [VOIDS, []]) {
      const w = cosmicWeb({ seed, tier: 'high', ...BOX, clusters: CLUSTERS, voids });
      assert.equal(w.count, WEB_COUNTS.high);
      const counts = Object.fromEntries(TARGETS.map((id) => [id, within(w, OBJECTS[id].pos.map((v) => v / MLY), KNOT_R)]));
      for (const id of TARGETS) {
        assert.ok(counts[id] >= 400, `seed ${seed}${voids.length ? ' with the Local Void' : ''}: ${id} has ${counts[id]}`);
      }
      // Each knot sits on its cluster's real position: none of its points are more than twice the radius away.
      TARGETS.forEach((id) => {
        const j = CLUSTERS.findIndex((c) => c.id === id), k = CLUSTERS[j];
        let members = 0;
        for (let i = 0; i < w.count; i++) {
          if (w.knot[i] !== j) continue;
          members++;
          const d = Math.hypot(w.positions[i * 3] - k.pos[0], w.positions[i * 3 + 1] - k.pos[1],
            w.positions[i * 3 + 2] - k.pos[2]);
          assert.ok(d <= 2 * k.radius * (1 + 1e-5), `${id}: a knot point ${d.toFixed(2)} Mly out`);
        }
        assert.ok(members > 0, `${id}: knot has points`);
      });
      report.push(`seed ${seed}${voids.length ? ' void' : ''}: ${JSON.stringify(counts)}`);
    }
  }
  console.log(`# points within 3 Mpc (high tier):\n# ${report.join('\n# ')}`);
});

test('the lower tiers keep the same share near each cluster', () => {
  for (const tier of ['mid', 'low']) {
    for (const seed of [1, 2]) {
      const w = cosmicWeb({ seed, tier, ...BOX, clusters: CLUSTERS, voids: VOIDS });
      const want = 400 * (WEB_COUNTS[tier] / WEB_COUNTS.high) * 0.8;
      for (const id of TARGETS) {
        const n = within(w, OBJECTS[id].pos.map((v) => v / MLY), KNOT_R);
        assert.ok(n >= want, `${tier} seed ${seed}: ${id} has ${n}, want ${Math.ceil(want)}`);
      }
    }
  }
});
