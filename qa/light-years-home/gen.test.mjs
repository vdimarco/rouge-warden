// Light Years Home: checks of the seeded generators: the cosmic web, galaxies, the star field and open clusters.
// Same seed, same output; the cosmic web's stage mix and its knots at real clusters; tier counts; finite values; speed.
// node qa/light-years-home/gen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cosmicWeb, stageFractions, WEB_COUNTS, WEB_FRACTIONS, STAGES,
} from '../../public/light-years-home/core/gen/web.js';
import { galaxyParticles, GALAXY_COUNTS, GALAXY_TYPES, PARTS } from '../../public/light-years-home/core/gen/galaxy.js';
import {
  starField, openCluster, STAR_COUNTS, SPECTRAL_MIX, turnOffMass, mainSequence, fluxAt,
} from '../../public/light-years-home/core/gen/stars.js';

// Real clusters in heliocentric galactic Cartesian Mly (research/astro.md), with radii in Mly. Shapley is a
// supercluster drawn as sub-clumps, so it is left out of the knot-density check.
const MPC = 3.261564;
const CLUSTERS = [
  { id: 'coma', pos: [6.1, 9.8, 322.7], radius: 4.7, members: 1000, giants: 2 },
  { id: 'virgo', pos: [2.5, -14.2, 51.9], radius: 2.2 * MPC, members: 1500, giants: 1 },
  { id: 'fornax', pos: [-20.1, -30.6, -50.0], radius: 1 * MPC, members: 58 },
  { id: 'eridanus', pos: [-37.8, -23.1, -60.5], radius: 6, members: 200 },
  { id: 'leo', pos: [-61.6, -88.3, 352.5], radius: 5, members: 70 },
  { id: 'centaurus', pos: [85.2, -134.2, 62.8], radius: 6, members: 300 },
  { id: 'hydra', pos: [-1.2, -170.2, 84.8], radius: 5, members: 157 },
  { id: 'norma', pos: [180.3, -125.1, -27.4], radius: 6, members: 500 },
  { id: 'hercules', pos: [309.0, 190.0, 356.8], radius: 8, members: 250, clumps: 3 },
  { id: 'shapley', pos: [365.5, -412.7, 348.7], radius: 40, members: 8000, clumps: 6 },
];
// A box from the Sloan Great Wall start (386.5, -304.5, 870.6) to home, with Shapley and Hercules inside.
const BOX = { centre: [190, -150, 420], box: [900, 900, 1100] };
const LOCAL_VOID = { pos: [0, 30, 75], radius: 60 };
const KNOT_R = 3 * MPC;                                          // 3 Mpc ≈ 9.78 Mly

const sameArray = (a, b, what) => {
  assert.equal(a.length, b.length, `${what}: length`);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) assert.fail(`${what}: differs at ${i} (${a[i]} vs ${b[i]})`);
};
const allFinite = (a, what) => {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) assert.fail(`${what}: not finite at ${i}`);
};
const distTo = (pos, i, c = [0, 0, 0]) => Math.hypot(pos[i * 3] - c[0], pos[i * 3 + 1] - c[1], pos[i * 3 + 2] - c[2]);
const within = (pos, count, c, r) => {
  let k = 0;
  for (let i = 0; i < count; i++) {
    const dx = pos[i * 3] - c[0], dy = pos[i * 3 + 1] - c[1], dz = pos[i * 3 + 2] - c[2];
    if (dx * dx + dy * dy + dz * dz < r * r) k++;
  }
  return k;
};
// Best of 3 timed calls (the first one cold), so a busy machine does not fail the check.
function timed(fn) {
  const times = [];
  let out;
  for (let r = 0; r < 3; r++) {
    const t0 = performance.now();
    out = fn(r);
    times.push(performance.now() - t0);
  }
  return { out, best: Math.min(...times), times: times.map((t) => Math.round(t)) };
}

// ---------- cosmic web ----------

test('web: the same seed gives the same web, another seed a different one', () => {
  const a = cosmicWeb({ seed: 7, ...BOX, clusters: CLUSTERS, tier: 'mid' });
  const b = cosmicWeb({ seed: 7, ...BOX, clusters: CLUSTERS, tier: 'mid' });
  for (const key of ['positions', 'stage', 'temperature', 'flux', 'knot']) sameArray(a[key], b[key], key);
  assert.equal(a.growth, b.growth);
  const c = cosmicWeb({ seed: 8, ...BOX, clusters: CLUSTERS, tier: 'mid' });
  let same = 0;
  for (let i = 0; i < c.positions.length; i++) if (c.positions[i] === a.positions[i]) same++;
  assert.ok(same < c.positions.length * 0.01, `seed 8 repeats seed 7 (${same} equal coordinates)`);
  assert.ok(cosmicWeb({ seed: 'start', ...BOX, count: 500 }).count === 500, 'string seeds work');
});

test('web: tier counts are honoured, and a lower tier is the start of a higher one', () => {
  assert.deepEqual(WEB_COUNTS, { high: 40000, mid: 16000, low: 8000 });
  const high = cosmicWeb({ seed: 3, ...BOX, clusters: CLUSTERS, tier: 'high' });
  for (const tier of ['high', 'mid', 'low']) {
    const w = tier === 'high' ? high : cosmicWeb({ seed: 3, ...BOX, clusters: CLUSTERS, tier });
    assert.equal(w.count, WEB_COUNTS[tier], tier);
    assert.equal(w.positions.length, 3 * WEB_COUNTS[tier]);
    for (const key of ['stage', 'temperature', 'flux', 'knot']) assert.equal(w[key].length, WEB_COUNTS[tier]);
    if (tier !== 'high') {
      sameArray(w.positions, high.positions.subarray(0, w.positions.length), `${tier} positions prefix`);
      sameArray(w.stage, high.stage.subarray(0, w.count), `${tier} stage prefix`);
    }
  }
  assert.equal(cosmicWeb({ seed: 3, ...BOX, count: 1234 }).count, 1234, 'explicit count');
  assert.equal(cosmicWeb({ seed: 3, ...BOX, count: 0 }).count, 0, 'zero count');
});

test('web: stage fractions are within 10 points of void 18 %, wall 27 %, filament 25 %, cluster 30 %', () => {
  assert.deepEqual(STAGES, ['void', 'wall', 'filament', 'cluster']);
  const runs = [
    { seed: 1, ...BOX, clusters: CLUSTERS, voids: [LOCAL_VOID] },
    { seed: 2, ...BOX, clusters: CLUSTERS },
    { seed: 3, ...BOX },
    { seed: 4, centre: [0, 0, 0], box: 300, clusters: CLUSTERS.slice(0, 4) },
  ];
  for (const opts of runs) {
    const w = cosmicWeb({ ...opts, tier: 'high' });
    const f = stageFractions(w.stage);
    const text = f.map((v) => (100 * v).toFixed(1)).join(' / ');
    f.forEach((v, s) => assert.ok(Math.abs(v - WEB_FRACTIONS[s]) <= 0.10, `seed ${opts.seed} ${STAGES[s]}: ${text}`));
    console.log(`# seed ${opts.seed}: void / wall / filament / cluster = ${text} %, growth ${w.growth.toFixed(2)}`);
  }
});

test('web: dense knots at the real clusters (at least 400 points within 3 Mpc at the high tier)', () => {
  for (const seed of [1, 2, 3]) {
    const w = cosmicWeb({ seed, ...BOX, clusters: CLUSTERS, voids: [LOCAL_VOID], tier: 'high' });
    const counts = {};
    CLUSTERS.forEach((k) => { counts[k.id] = within(w.positions, w.count, k.pos, KNOT_R); });
    for (const k of CLUSTERS) {
      if (k.id === 'shapley') continue;
      assert.ok(counts[k.id] >= 400, `seed ${seed}: ${k.id} has ${counts[k.id]} points within 3 Mpc`);
    }
    // Shapley is spread over sub-clumps, but its knot still lands around its position.
    let shapley = 0;
    for (let i = 0; i < w.count; i++) if (w.knot[i] === CLUSTERS.length - 1) shapley++;
    const near = within(w.positions, w.count, CLUSTERS[9].pos, 2 * CLUSTERS[9].radius);
    assert.ok(near >= shapley, 'Shapley inside 2 radii');
    if (seed === 1) console.log(`# points within 3 Mpc: ${JSON.stringify(counts)}`);
  }
  // Mid and low tiers keep the same share.
  const low = cosmicWeb({ seed: 1, ...BOX, clusters: CLUSTERS, tier: 'low' });
  for (const k of CLUSTERS.slice(0, 3)) {
    const c = within(low.positions, low.count, k.pos, KNOT_R);
    assert.ok(c >= 400 * WEB_COUNTS.low / WEB_COUNTS.high * 0.8, `low tier ${k.id}: ${c}`);
  }
});

test('web: values are finite and in range; giants come first and are warm and bright', () => {
  const w = cosmicWeb({ seed: 5, ...BOX, clusters: CLUSTERS, voids: [LOCAL_VOID], tier: 'high' });
  allFinite(w.positions, 'positions');
  allFinite(w.temperature, 'temperature');
  allFinite(w.flux, 'flux');
  for (let i = 0; i < w.count; i++) {
    assert.ok(w.stage[i] <= 3, 'stage 0..3');
    assert.ok(w.temperature[i] > 3000 && w.temperature[i] < 10000, `temperature ${w.temperature[i]}`);
    assert.ok(w.flux[i] > 0 && w.flux[i] < 20, `flux ${w.flux[i]}`);
    assert.ok(w.knot[i] >= -1 && w.knot[i] < CLUSTERS.length, 'knot index');
    if (w.knot[i] >= 0) assert.equal(w.stage[i], 3, 'knot points are cluster stage');
  }
  // Coma's 2 giants and Virgo's 1 sit first, near their centres.
  assert.deepEqual([...w.knot.subarray(0, 3)], [0, 0, 1]);
  for (let i = 0; i < 3; i++) {
    const k = CLUSTERS[w.knot[i]];
    assert.ok(w.flux[i] >= 10 && w.temperature[i] === 4500, 'giant flux and colour');
    assert.ok(within(w.positions.subarray(i * 3, i * 3 + 3), 1, k.pos, k.radius) === 1, 'giant near the heart');
  }
  // Galaxies in clusters are redder on average than galaxies in voids.
  const mean = [0, 0, 0, 0], num = [0, 0, 0, 0];
  for (let i = 0; i < w.count; i++) { mean[w.stage[i]] += w.temperature[i]; num[w.stage[i]]++; }
  assert.ok(mean[3] / num[3] < mean[0] / num[0] - 1000, 'clusters red, voids blue');
  // The web stays near its box.
  for (let i = 0; i < w.count; i++) {
    for (let a = 0; a < 3; a++) {
      const p = w.positions[i * 3 + a], lo = BOX.centre[a] - BOX.box[a] / 2 - 2 * w.cell;
      assert.ok(p > lo && p < lo + BOX.box[a] + 4 * w.cell, `axis ${a}: ${p}`);
    }
  }
});

test('web: a named void is emptier than the web around it', () => {
  const w = cosmicWeb({ seed: 6, ...BOX, voids: [LOCAL_VOID], tier: 'high' });
  const inner = within(w.positions, w.count, LOCAL_VOID.pos, 0.6 * LOCAL_VOID.radius);
  const vol = BOX.box[0] * BOX.box[1] * BOX.box[2];
  const expected = w.count * (4 / 3) * Math.PI * (0.6 * LOCAL_VOID.radius) ** 3 / vol;
  assert.ok(inner < 0.5 * expected, `${inner} points in the void core, ${expected.toFixed(1)} for an even spread`);
});

test('web: junk options fall back instead of throwing', () => {
  const w = cosmicWeb({
    seed: 9, count: 2000, centre: 'x', box: [-1, NaN, 50], cells: 0, growth: -2,
    clusters: [null, { pos: [1, 2] }, { pos: [0, 0, 0], radius: NaN, members: 'many' }], voids: [{ pos: [0, 0, 0] }],
  });
  assert.equal(w.count, 2000);
  allFinite(w.positions, 'positions');
  assert.ok(Number.isFinite(w.growth) && w.growth > 0);
  assert.equal(cosmicWeb().count, WEB_COUNTS.high, 'no options at all');
});

test('web: under 150 ms at 40,000 galaxies', () => {
  const { best, times } = timed((r) => cosmicWeb({ seed: 11 + r, ...BOX, clusters: CLUSTERS, tier: 'high' }));
  console.log(`# cosmicWeb 40k: ${times.join(', ')} ms`);
  assert.ok(best < 150, `best of 3 took ${best.toFixed(0)} ms`);
});

// ---------- galaxies ----------

const MILKY_WAY = {
  type: 'spiral', radius: 50000, thickness: 1000, arms: [1, 0.45, 1, 0.45], pitch: 12.5,
  barLength: 16000, barAngle: -30, bulge: 0.1, bar: 0.15, arm: 0.55,
};
const VARIANTS = {
  spiral: MILKY_WAY,
  elliptical: { type: 'elliptical', radius: 60000, axes: [1, 0.8, 0.6] },
  lane: { type: 'lane', radius: 60000, axes: [1, 0.95, 0.9] },
  irregular: { type: 'irregular', radius: 16000, barLength: 5000, barAngle: 20, clumps: 6 },
};

test('galaxy: the same seed gives the same particles for every type', () => {
  assert.deepEqual(GALAXY_TYPES, ['spiral', 'elliptical', 'lane', 'irregular']);
  for (const [name, opts] of Object.entries(VARIANTS)) {
    const a = galaxyParticles({ seed: 4, ...opts, tier: 'low' });
    const b = galaxyParticles({ seed: 4, ...opts, tier: 'low' });
    assert.equal(a.type, name);
    for (const key of ['positions', 'temperature', 'flux', 'size', 'kind']) sameArray(a[key], b[key], `${name} ${key}`);
    sameArray(a.dust.positions, b.dust.positions, `${name} dust`);
    sameArray(a.hii.positions, b.hii.positions, `${name} hii`);
    const c = galaxyParticles({ seed: 5, ...opts, tier: 'low' });
    assert.notDeepEqual(c.positions.subarray(0, 30), a.positions.subarray(0, 30), `${name}: seed 5 differs`);
  }
});

test('galaxy: tier counts are honoured, with dust and H II knots in proportion', () => {
  assert.deepEqual(GALAXY_COUNTS, { high: 80000, mid: 30000, low: 15000 });
  for (const tier of ['high', 'mid', 'low']) {
    const g = galaxyParticles({ seed: 1, ...MILKY_WAY, tier });
    assert.equal(g.count, GALAXY_COUNTS[tier]);
    for (const key of ['temperature', 'flux', 'size', 'kind']) assert.equal(g[key].length, g.count, key);
    assert.equal(g.positions.length, 3 * g.count);
    assert.equal(g.dust.count, Math.round(0.25 * g.count), 'default spiral dust');
    assert.equal(g.hii.count, Math.round(0.004 * g.count), 'default spiral knots');
    assert.equal(g.dust.positions.length, 3 * g.dust.count);
    assert.equal(g.hii.size.length, g.hii.count);
  }
  const custom = galaxyParticles({ seed: 1, count: 1000, counts: { high: 5 }, dust: 0.5, knots: 0.01 });
  assert.equal(custom.count, 1000);
  assert.equal(custom.dust.count, 500);
  assert.equal(custom.hii.count, 10);
  assert.equal(galaxyParticles({ tier: 'high', counts: { high: 1234 } }).count, 1234, 'counts table');
  const e = galaxyParticles({ seed: 1, ...VARIANTS.elliptical, tier: 'low', dust: 1, knots: 1 });
  assert.equal(e.dust.count, 0, 'an elliptical has no dust');
  assert.equal(e.hii.count, 0, 'an elliptical has no H II knots');
});

test('galaxy: values are finite, inside the radius, and the disc is thin', () => {
  for (const [name, opts] of Object.entries(VARIANTS)) {
    const g = galaxyParticles({ seed: 2, ...opts, tier: 'mid' });
    const R = opts.radius;
    for (const arr of [g.positions, g.temperature, g.flux, g.size, g.dust.positions, g.hii.positions]) {
      allFinite(arr, name);
    }
    let far = 0;
    for (let i = 0; i < g.count; i++) {
      const r = Math.hypot(g.positions[i * 3], g.positions[i * 3 + 1], g.positions[i * 3 + 2]);
      if (r > 1.25 * R) far++;
      assert.ok(g.temperature[i] >= 2000 && g.temperature[i] <= 40000, `${name} T ${g.temperature[i]}`);
      assert.ok(g.flux[i] > 0 && g.size[i] > 0, `${name} flux and size`);
      assert.ok(g.kind[i] < PARTS.length, `${name} kind`);
    }
    assert.ok(far < 0.002 * g.count, `${name}: ${far} particles beyond 1.25 radii`);
    if (name === 'spiral' || name === 'irregular') {
      const z = [];
      for (let i = 0; i < g.count; i++) if (g.kind[i] >= 2) z.push(Math.abs(g.positions[i * 3 + 2]));
      z.sort((a, b) => a - b);
      assert.ok(z[z.length >> 1] < 0.05 * R, `${name}: median |z| ${z[z.length >> 1]} of radius ${R}`);
    }
    if (name === 'elliptical') {
      for (let i = 0; i < g.count; i++) assert.ok(g.temperature[i] < 5000, 'an elliptical is old and red');
    }
  }
});

test('galaxy: a barred spiral has its parts in the asked shares, a long bar and stars along log-spiral arms', () => {
  const g = galaxyParticles({ seed: 3, ...MILKY_WAY, tier: 'high' });
  const n = [0, 0, 0, 0, 0];
  for (let i = 0; i < g.count; i++) n[g.kind[i]]++;
  const share = n.map((c) => c / g.count);
  assert.ok(Math.abs(share[0] - 0.10) < 0.01 && Math.abs(share[1] - 0.15) < 0.01, `bulge, bar ${share}`);
  assert.ok(Math.abs(share[2] - 0.55) < 0.015 && Math.abs(share[3] - 0.20) < 0.015, `arm, disc ${share}`);
  // The bar lies along -30°: its spread along that axis is much larger than across it.
  const a = -30 * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
  let along = 0, across = 0;
  for (let i = 0; i < g.count; i++) {
    if (g.kind[i] !== 1) continue;
    const x = g.positions[i * 3], y = g.positions[i * 3 + 1];
    along += (x * ux + y * uy) ** 2; across += (-x * uy + y * ux) ** 2;
  }
  assert.ok(along > 6 * across, `bar elongation ${(along / across).toFixed(1)}`);
  // Arm stars sit close to one of the arms: θ = k ln(r / r0) + bar angle + a·90°.
  const k = 1 / Math.tan(12.5 * Math.PI / 180), r0 = 16000;
  let near = 0, arm = 0;
  for (let i = 0; i < g.count; i++) {
    if (g.kind[i] !== 2) continue;
    const x = g.positions[i * 3], y = g.positions[i * 3 + 1], r = Math.hypot(x, y);
    if (r < r0 * 1.1) continue;
    arm++;
    const t = Math.atan2(y, x) - (k * Math.log(r / r0) + a);
    const d = Math.min(...[0, 1, 2, 3].map((j) => {
      const e = (((t - j * Math.PI / 2) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      return Math.abs(e);
    }));
    if (d < 3 * 0.16 + 0.1) near++;
  }
  assert.ok(near > 0.9 * arm, `${near} of ${arm} arm stars near an arm`);
  // Young blue stars are in the arms, not in the bulge.
  let hotArm = 0, hotBulge = 0;
  for (let i = 0; i < g.count; i++) {
    if (g.temperature[i] > 9000) { if (g.kind[i] === 2) hotArm++; if (g.kind[i] === 0) hotBulge++; }
  }
  assert.ok(hotArm > 0.1 * n[2] && hotBulge === 0, `hot stars: ${hotArm} in arms, ${hotBulge} in the bulge`);
});

test('galaxy: dust sits on the inner edge of the arms; a lane galaxy has a thin, warped dust disc', () => {
  const g = galaxyParticles({ seed: 3, ...MILKY_WAY, tier: 'mid' });
  const k = 1 / Math.tan(12.5 * Math.PI / 180), r0 = 16000, a = -30 * Math.PI / 180;
  let ahead = 0, total = 0;
  for (let i = 0; i < g.dust.count; i++) {
    const x = g.dust.positions[i * 3], y = g.dust.positions[i * 3 + 1], r = Math.hypot(x, y);
    if (r < r0 * 1.1) continue;
    const t = Math.atan2(y, x) - (k * Math.log(r / r0) + a);
    const e = [0, 1, 2, 3].map((j) => (((t - j * Math.PI / 2) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI)
      .sort((p, q) => Math.abs(p) - Math.abs(q))[0];
    total++;
    if (e > 0) ahead++;                               // +θ from the arm is its concave side when winding is +1
  }
  assert.ok(ahead > 0.95 * total, `${ahead} of ${total} dust particles on the concave side`);
  const lane = galaxyParticles({ seed: 3, ...VARIANTS.lane, tier: 'low' });
  let maxR = 0;
  for (let i = 0; i < lane.dust.count; i++) {
    maxR = Math.max(maxR, distTo(lane.dust.positions, i));
  }
  assert.ok(maxR <= 0.6 * 60000, `lane dust out to ${maxR.toFixed(0)} ly`);
});

test('galaxy: junk options fall back instead of throwing', () => {
  const g = galaxyParticles({
    seed: 1, type: 'blob', count: 500, radius: -5, arms: [], pitch: NaN, barLength: 'x', barWidth: 'x', armWidth: NaN,
    axes: 'no', dust: -1, knots: NaN, thickness: Infinity,
  });
  assert.equal(g.type, 'spiral');
  assert.equal(g.count, 500);
  for (const arr of [g.positions, g.temperature, g.flux, g.size, g.dust.positions, g.hii.positions]) {
    allFinite(arr, 'junk');
  }
  const h = galaxyParticles({ type: 'irregular', count: 300, clumps: 0, barLength: 2000, barWidth: -3 });
  allFinite(h.positions, 'irregular junk');
  assert.equal(galaxyParticles().count, GALAXY_COUNTS.high, 'no options at all');
});

test('galaxy: under 150 ms at 80,000 particles for every type', () => {
  for (const [name, opts] of Object.entries(VARIANTS)) {
    const { best, times } = timed((r) => galaxyParticles({ seed: 20 + r, ...opts, tier: 'high' }));
    console.log(`# galaxyParticles ${name} 80k: ${times.join(', ')} ms`);
    assert.ok(best < 150, `${name}: best of 3 took ${best.toFixed(0)} ms`);
  }
});

// ---------- stars ----------

test('stars: the same seed gives the same field; tier counts are honoured', () => {
  assert.deepEqual(STAR_COUNTS, { high: 20000, mid: 10000, low: 5000 });
  const a = starField({ seed: 4, tier: 'mid' }), b = starField({ seed: 4, tier: 'mid' });
  for (const key of ['positions', 'temperature', 'absMag', 'lum', 'flux', 'cls']) sameArray(a[key], b[key], key);
  assert.notDeepEqual(starField({ seed: 5, tier: 'mid' }).positions.subarray(0, 30), a.positions.subarray(0, 30));
  for (const tier of ['high', 'mid', 'low']) {
    const f = starField({ seed: 1, tier });
    assert.equal(f.count, STAR_COUNTS[tier]);
    assert.equal(f.positions.length, 3 * f.count);
  }
  assert.equal(starField({ count: 77 }).count, 77);
});

test('stars: the field has the solar-neighbourhood mix, mostly red dwarfs, inside its sphere', () => {
  const centre = [-140, 0, -58], radius = 120;
  const sun = { pos: [0, 0, 0], radius: 4 };
  const f = starField({ seed: 2, tier: 'high', centre, radius, avoid: [{ pos: centre, radius: 3 }] });
  const total = SPECTRAL_MIX.reduce((s, m) => s + m.share, 0);
  const n = SPECTRAL_MIX.map(() => 0);
  for (let i = 0; i < f.count; i++) n[f.cls[i]]++;
  SPECTRAL_MIX.forEach((m, k) => {
    const want = m.share / total, got = n[k] / f.count;
    assert.ok(Math.abs(got - want) < Math.max(0.01, 0.15 * want), `${m.cls}: ${got.toFixed(4)} vs ${want.toFixed(4)}`);
  });
  assert.ok(n[SPECTRAL_MIX.findIndex((m) => m.cls === 'M')] / f.count > 0.65, 'mostly red dwarfs');
  for (const arr of [f.positions, f.temperature, f.absMag, f.lum, f.flux]) allFinite(arr, 'field');
  for (let i = 0; i < f.count; i++) {
    const d = distTo(f.positions, i, centre);
    assert.ok(d <= radius * 1.0001 && d >= 3, `star ${i} at ${d.toFixed(2)} ly from the centre`);
    assert.ok(f.temperature[i] >= 2000 && f.temperature[i] <= 31000, 'temperature');
    const m = SPECTRAL_MIX[f.cls[i]];
    assert.ok(f.temperature[i] <= m.t[0] && f.temperature[i] >= m.t[1], `${m.cls} temperature in its class`);
    assert.ok(Math.abs(f.flux[i] - fluxAt(f.absMag[i], d)) <= 1e-4 * f.flux[i], 'flux from the centre');
  }
  // Red dwarfs are faint and cool; the sun-like G stars sit near magnitude 5.
  const g = SPECTRAL_MIX.findIndex((m) => m.cls === 'G');
  let gMag = 0, gN = 0;
  for (let i = 0; i < f.count; i++) if (f.cls[i] === g) { gMag += f.absMag[i]; gN++; }
  assert.ok(Math.abs(gMag / gN - 5.15) < 0.3, `mean G magnitude ${(gMag / gN).toFixed(2)}`);
  const holeFree = starField({ seed: 3, count: 4000, centre: [0, 0, 0], radius: 30, avoid: [sun] });
  for (let i = 0; i < holeFree.count; i++) {
    assert.ok(distTo(holeFree.positions, i) >= 4, 'no field star within 4 ly of the Sun');
  }
});

test('stars: main-sequence physics and turn-off masses', () => {
  const sun = mainSequence(1);
  assert.ok(Math.abs(sun.T - 5772) < 1 && Math.abs(sun.mv - 4.83) < 1e-9, 'the Sun');
  let lastT = 0;
  for (const m of [0.1, 0.2, 0.5, 1, 2, 4, 8]) {
    const s = mainSequence(m);
    assert.ok(s.T > lastT, `hotter with mass at ${m}`);
    lastT = s.T;
  }
  assert.ok(mainSequence(0.2).T < 3200 && mainSequence(0.2).mv > 11, 'a red dwarf is cool and faint');
  assert.ok(turnOffMass(125e6) > 4 && turnOffMass(125e6) < 5.5, `Pleiades turn-off ${turnOffMass(125e6)}`);
  assert.ok(turnOffMass(625e6) > 2.2 && turnOffMass(625e6) < 3, `Hyades turn-off ${turnOffMass(625e6)}`);
});

test('stars: the Pleiades are young, hot and blue; the Hyades are older, with orange giants', () => {
  // Centres in heliocentric galactic Cartesian ly (research/astro.md).
  const pleiades = { seed: 2, centre: [-395.96, 95.37, -177.36], count: 1000, core: 8, tidal: 43, age: 125e6 };
  const P = openCluster(pleiades);
  const H = openCluster({
    seed: 2, centre: [-141.53, -0.20, -58.12], count: 500, core: 8.8, tidal: 33, age: 625e6, giants: 4, whiteDwarfs: 8,
  });
  const again = openCluster(pleiades);
  sameArray(P.positions, again.positions, 'cluster positions');
  sameArray(P.temperature, again.temperature, 'cluster temperatures');
  const stats = (c, centre, tidal) => {
    let maxMsT = 0, lw = 0, lwT = 0, giants = 0;
    const radii = [];
    for (let i = 0; i < c.count; i++) {
      const r = distTo(c.positions, i, centre);
      assert.ok(r <= tidal * 1.0001, `member inside the tidal radius (${r.toFixed(1)})`);
      radii.push(r);
      if (c.giant[i] === 0) maxMsT = Math.max(maxMsT, c.temperature[i]);
      if (c.giant[i] === 1) giants++;
      if (c.giant[i] !== 0 || c.mass[i] > 0) { lw += c.lum[i]; lwT += c.lum[i] * c.temperature[i]; }
    }
    radii.sort((p, q) => p - q);
    return { maxMsT, lightT: lwT / lw, giants, half: radii[radii.length >> 1] };
  };
  const p = stats(P, [-395.96, 95.37, -177.36], 43), h = stats(H, [-141.53, -0.20, -58.12], 33);
  for (const c of [P, H]) {
    for (const arr of [c.positions, c.temperature, c.absMag, c.lum, c.flux, c.mass]) allFinite(arr, 'cluster');
  }
  assert.equal(P.count, 1000);
  assert.equal(H.count, 500);
  assert.ok(p.maxMsT > 12000, `Pleiades hottest ${p.maxMsT.toFixed(0)} K`);
  assert.ok(h.maxMsT < p.maxMsT - 2000, `Hyades hottest main-sequence star ${h.maxMsT.toFixed(0)} K`);
  assert.ok(p.lightT > 9000, `Pleiades light is blue (${p.lightT.toFixed(0)} K)`);
  assert.ok(h.lightT < 7500, `Hyades light is yellow (${h.lightT.toFixed(0)} K)`);
  assert.equal(h.giants, 4);
  for (let i = 0; i < H.count; i++) {
    if (H.giant[i] !== 1) continue;
    assert.ok(H.temperature[i] > 4500 && H.temperature[i] < 5300 && H.absMag[i] < 1.5, 'orange giant');
  }
  // Most members are red dwarfs, as in any cluster.
  let red = 0;
  for (let i = 0; i < P.count; i++) if (P.temperature[i] < 3900) red++;
  assert.ok(red > 0.5 * P.count, `${red} red dwarfs in the Pleiades`);
  // Plummer half-mass radius is 1.305 core radii (a little less with the tidal cut).
  assert.ok(p.half > 0.8 * 8 && p.half < 1.4 * 8, `Pleiades half radius ${p.half.toFixed(1)} ly`);
  // Giants can be put at given positions, for a known shape.
  const placed = [[-141, 0, -58], [-142, 1, -57]];
  const V = openCluster({ seed: 3, centre: [-141.53, -0.20, -58.12], count: 50, giants: placed, age: 625e6 });
  assert.deepEqual([...V.positions.subarray(0, 3)].map((v) => Math.round(v)), placed[0]);
  assert.equal(V.giant[1], 1);
  assert.equal(V.giant[2], 0);
});

test('stars: junk options fall back instead of throwing', () => {
  const f = starField({ seed: 'x', count: 300, centre: 'x', radius: -1, avoid: [null, { pos: [0, 0] }], mix: [] });
  assert.equal(f.count, 300);
  for (const arr of [f.positions, f.temperature, f.absMag, f.lum, f.flux]) allFinite(arr, 'field junk');
  const c = openCluster({ count: 100, core: -1, tidal: NaN, age: 'old', giants: 'x', minMass: 99, observer: null });
  assert.equal(c.count, 100);
  for (const arr of [c.positions, c.temperature, c.absMag, c.lum, c.flux, c.mass]) allFinite(arr, 'cluster junk');
  assert.equal(starField().count, STAR_COUNTS.high, 'no options at all');
});

test('stars: under 150 ms at 20,000 field stars and a 2,000-member cluster', () => {
  const field = timed((r) => starField({ seed: 30 + r, tier: 'high' }));
  const cluster = timed((r) => openCluster({ seed: 30 + r, count: 2000, age: 125e6 }));
  console.log(`# starField 20k: ${field.times.join(', ')} ms; openCluster 2k: ${cluster.times.join(', ')} ms`);
  assert.ok(field.best < 150 && cluster.best < 150);
});
