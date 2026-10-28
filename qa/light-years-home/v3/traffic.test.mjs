// Light Years Home v3: traffic as pure functions of time (final.md 18.1, tech §3.4).
// node qa/light-years-home/v3/traffic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTraffic, posAt, velAt, fillPositions, KIND } from '../../../public/light-years-home/core/traffic.js';
import { createGrid, rebuildTraffic, query } from '../../../public/light-years-home/core/collide.js';
import { mulberry32 } from '../../../public/light-years-home/core/rng.js';
import { WALL as WALL_FIXTURE, COMA as COMA_FIXTURE } from './fixtures.mjs';

// The real zone data once WP6 has written it, else the design's copy in fixtures.mjs.
async function zone(id, fallback) {
  try { return (await import(`../../../public/light-years-home/core/world/zones/${id}.js`)).default; } catch { return fallback; }
}
const WALL = await zone('wall', WALL_FIXTURE);
const COMA = await zone('coma', COMA_FIXTURE);

test('positions are pure functions of time', () => {
  const tr = buildTraffic(COMA, 7);
  const n = (COMA.roads || []).reduce((a, r) => a + r.count + (r.seeded?.length || 0), 0)
    + COMA.swarms.reduce((a, s) => a + s.count, 0);
  assert.equal(tr.n, n, 'one body per road and swarm count, plus the seeded galaxies');
  const a = [0, 0, 0], b = [0, 0, 0], v = [0, 0, 0];
  for (let i = 0; i < tr.n; i += 37) {
    posAt(tr, i, 12.5, a);
    posAt(tr, i, 3, b);                                   // another time in between changes nothing
    posAt(tr, i, 12.5, b);
    assert.deepEqual(a, b, `body ${i}`);
    // The velocity is the derivative of the position (away from a road's wrap point).
    const f0 = posAt(tr, i, 20, a), f1 = posAt(tr, i, 20.001, b);
    if (f0 === 1 && f1 === 1) {
      velAt(tr, i, 20, v);
      const tol = 0.05 + 0.03 * Math.hypot(...v);
      for (let k = 0; k < 3; k++) assert.ok(Math.abs((b[k] - a[k]) / 0.001 - v[k]) < tol, `body ${i} axis ${k}`);
    }
  }
  // The same zone and seed build the same traffic; another seed builds other traffic.
  const again = buildTraffic(COMA, 7), other = buildTraffic(COMA, 8);
  const out1 = fillPositions(tr, 33, new Float32Array(tr.n * 3));
  assert.deepEqual(fillPositions(again, 33, new Float32Array(tr.n * 3)), out1);
  assert.notDeepEqual(fillPositions(other, 33, new Float32Array(tr.n * 3)), out1);
  // Ring roads turn the right way at the right speed.
  const inner = COMA.roads.find((r) => r.id === 'inner');
  for (let i = 0; i < tr.n; i++) {
    if (tr.kind[i] !== KIND.orbit || tr.road[i] !== COMA.roads.filter((r) => r.kind === 'orbit').indexOf(inner)) continue;
    velAt(tr, i, 0, v);
    posAt(tr, i, 0, a);
    const cw = (a[0] - inner.centre[0]) * v[1] - (a[1] - inner.centre[1]) * v[0] < 0;
    assert.equal(cw, inner.dir === -1, 'dir −1 runs clockwise');
    assert.ok(Math.abs(Math.hypot(v[0], v[1]) - inner.speed) < 1e-6);
  }
});

test('roads fade at their ends, and the Wall opening keeps its line clear', () => {
  const tr = buildTraffic(WALL, 1);
  const p = [0, 0, 0];
  let faded = 0;
  for (let t = 0; t < 60; t += 0.5) {
    for (let i = 0; i < tr.n; i++) if (tr.kind[i] === KIND.road && posAt(tr, i, t, p) < 1) faded++;
  }
  assert.ok(faded > 0, 'some road bodies fade in or out');
  // The three seeded galaxies sit on the entry line: ahead along the heading, to its right by `lateral`.
  const sloan = WALL.roads.find((r) => r.seeded);
  const parked = [];
  for (let i = 0; i < tr.n; i++) if (tr.kind[i] === KIND.parked) parked.push(i);
  assert.equal(parked.length, sloan.seeded.length);
  sloan.seeded.forEach((s, k) => {
    posAt(tr, parked[k], 99, p);
    assert.ok(Math.abs(p[0] - (WALL.entry.pos[0] + s.lateral)) < 1e-9);
    assert.ok(Math.abs(p[1] - (WALL.entry.pos[1] + s.ahead)) < 1e-9);
    assert.ok(Math.abs(tr.rc[parked[k]] - 0.5 * s.r) < 1e-6, 'collider is CORE_X × the drawn radius');
  });
  // No dwarf of the swarm sits in the opening lane (toy.test checks the idle ship touches nothing in the opening).
  for (let i = 0; i < tr.n; i++) {
    if (tr.kind[i] !== KIND.swarm) continue;
    posAt(tr, i, 0, p);
    const ahead = p[1] - WALL.entry.pos[1];
    // Placed outside the 3.5 u lane; a dwarf's slow drift (up to 3 u) may lean in a little.
    if (ahead > 0 && ahead < 150) assert.ok(Math.abs(p[0] - WALL.entry.pos[0]) > 3.5 - 3, `dwarf ${i} in the lane`);
  }
});

test('the grid finds every body within 22 u (against brute force) at 1,000 random points in Coma', () => {
  const tr = buildTraffic(COMA, 3);
  const g = createGrid(32, COMA.R + 300);
  const rng = mulberry32(99);
  const out = new Int32Array(4096);
  const pos = new Float32Array(tr.n * 3), fade = new Float32Array(tr.n);
  let checked = 0, maxCand = 0;
  for (let k = 0; k < 1000; k++) {
    const tq = Math.floor(rng() * 3000) / 30;              // the grid is built on the 30 Hz tick
    rebuildTraffic(g, tr, tq);
    const t = tq + rng() / 30;                             // and asked at any time before the next tick
    const a = rng() * Math.PI * 2, r = COMA.R * Math.sqrt(rng());
    const at = [r * Math.cos(a), r * Math.sin(a), (rng() - 0.5) * 60];
    const n = query(g, at, 22 + tr.maxSpeed / 30 + 0.5, out);
    maxCand = Math.max(maxCand, n);
    const got = new Set(out.subarray(0, n));
    fillPositions(tr, t, pos, fade);
    for (let i = 0; i < tr.n; i++) {
      if (tr.rc[i] <= 0 || fade[i] < 0.999) continue;
      if (Math.hypot(pos[i * 3] - at[0], pos[i * 3 + 1] - at[1]) > 22) continue;
      checked++;
      assert.ok(got.has(i), `point ${k}: body ${i} missed`);
    }
  }
  assert.ok(checked > 1000, `checked ${checked} pairs`);
  assert.ok(maxCand < 1500, `at most ${maxCand} candidates`);
});
