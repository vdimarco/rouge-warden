// Light Years Home v3: determinism and allocation (final.md 18.1, 4.2). The same seed and inputs give the same state
// hash; a structuredClone of the state steps to the same hash as the original; the flight step allocates nothing in its
// hot loops (heap checked with the gc exposed).
// node qa/light-years-home/v3/determinism.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import v8 from 'node:v8';
import vm from 'node:vm';
import { PerformanceObserver } from 'node:perf_hooks';
import { createGame, step, wire, unwire, makeInput } from '../../../public/light-years-home/core/game.js';
import { FLIGHT } from '../../../public/light-years-home/core/ship.js';
import { hashState } from '../../../public/light-years-home/core/hash.js';
import { createEventBuffer } from '../../../public/light-years-home/core/events.js';
import { WALL as WALL_FIXTURE, COMA as COMA_FIXTURE } from './fixtures.mjs';

let WALL = WALL_FIXTURE;
try { WALL = (await import('../../../public/light-years-home/core/world/zones/wall.js')).default; } catch { /* WP6 not in yet */ }

// A scripted driver that uses every control: it follows the Wall's roads (pure pursuit round a loop of points) and
// mixes in gas, drifts, boosts, flicks, brakes and climbs on a timetable.
const LOOP = [[0, -300], [-30, -240], [-5, -110], [0, -40], [70, 110], [175, 240], [290, 320], [300, 132], [130, 55],
  [0, 0], [-170, -40], [-300, -70], [-60, -10], [0, -200]];
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const AIM = { k: 0 };
function inputAt(t, rec = makeInput(), game = null) {
  let steer = Math.sin(t * 0.9);
  if (game) {
    const p = game.ship.pos, w = LOOP[AIM.k % LOOP.length];
    if (Math.hypot(w[0] - p[0], w[1] - p[1]) < 30) AIM.k++;
    steer = Math.max(-1, Math.min(1, 2.5 * wrapA(Math.atan2(w[0] - p[0], w[1] - p[1]) - game.ship.yaw)));
  }
  rec.steer = t % 9 < 7 ? steer : Math.sin(t * 3);
  rec.gas = t % 6 < 3 ? 1 : 0;
  rec.drift = t % 11 > 9.5;
  rec.boost = t % 13 > 11.5;
  rec.boostBurst = Math.abs((t % 17) - 5) < 1 / 240;
  rec.brake = t % 23 > 22.4 ? 1 : 0;
  const c = Math.sin(t * 0.37);
  rec.climb = c > 0.95 ? 0.6 : c < -0.95 ? -0.6 : 0;          // up and back down, so it stays among the traffic
  rec.autoDrift = t > 60;
  rec.source = t > 60 ? 'touch' : 'keys';
  return rec;
}

function play(game, from, seconds, ev = null) {
  const rec = makeInput();
  if (from === 0) AIM.k = 0;
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    if (ev) ev.clear();
    step(game, inputAt(from + i / 120, rec, game), ev);
  }
  return game;
}

// Bytes allocated a step in a clean process (one zone, so every property load stays simple): 100 s of warm-up so the
// engine has optimised every path (crashes, drifts, boosts), then the best of six 10 s windows with no collector run.
async function allocChild(which) {
  const { PerformanceObserver: PO, performance } = await import('node:perf_hooks');
  const gc = globalThis.gc;
  const empty = { id: 'empty-zone', R: 700, band: 100, bodies: [], roads: [], swarms: [] };
  const dense = { ...COMA_FIXTURE, id: 'dense-coma', entry: { pos: [-60, -140, 0], heading: 90, speed: 30 } };
  unwire();
  wire(FLIGHT);
  const g = createGame({ seed: 2, zoneData: which === 'dense' ? dense : empty, mode: 'drive' });
  const r = makeInput();
  for (let i = 0; i < 12000; i++) step(g, inputAt(60 + i / 120, r));
  const stamps = [];
  const obs = new PO((list) => { for (const e of list.getEntries()) stamps.push(e.startTime); });
  obs.observe({ entryTypes: ['gc'] });
  const windows = [];
  for (let tries = 0; tries < 6; tries++) {
    gc();
    const w0 = performance.now();
    const h0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 1200; i++) step(g, inputAt(160 + tries * 10 + i / 120, r));
    const h1 = process.memoryUsage().heapUsed;
    windows.push([w0, performance.now(), (h1 - h0) / 1200]);
  }
  await new Promise((done) => setTimeout(done, 50));          // let the observer report
  let best = Infinity;
  for (const [w0, w1, bytes] of windows) if (!stamps.some((t) => t >= w0 && t <= w1)) best = Math.min(best, bytes);
  obs.disconnect();
  return best;
}

if (process.env.LYH_ALLOC_CHILD) {
  process.stdout.write(`ALLOC ${await allocChild(process.env.LYH_ALLOC_CHILD)}\n`);
  process.exit(0);
}

test('same seed and inputs give the same hash after 120 s', () => {
  unwire();
  wire(FLIGHT);
  const a = play(createGame({ seed: 5, zoneData: WALL, mode: 'drive' }), 0, 120, createEventBuffer());
  const b = play(createGame({ seed: 5, zoneData: WALL, mode: 'drive' }), 0, 120, createEventBuffer());
  assert.equal(hashState(a), hashState(b));
  const st = a.stats;
  assert.ok(st.near + st.hairline > 0 && st.drifts[0] + st.drifts[1] + st.drifts[2] > 0, `the run did things: ${JSON.stringify(st)}`);
  const c = play(createGame({ seed: 6, zoneData: WALL, mode: 'drive' }), 0, 120);
  assert.notEqual(hashState(a), hashState(c), 'another seed is another run');
});

test('a structuredClone of the state steps to the same hash', () => {
  unwire();
  wire(FLIGHT);
  const a = play(createGame({ seed: 9, zoneData: WALL, mode: 'drive' }), 0, 30);
  const b = structuredClone(a);
  assert.equal(hashState(b), hashState(a), 'the clone hashes the same');
  // Step them in turns, so both share the zone's traffic grid as the live game and a test would.
  const ra = makeInput(), rb = makeInput();
  for (let i = 0; i < 60 * 120; i++) {
    const t = 30 + i / 120;
    step(a, inputAt(t, ra));                                  // the timetable alone: both see the same records
    step(b, inputAt(t, rb));
  }
  assert.equal(hashState(b), hashState(a));
});

test('the hash ignores key order and rounds below 1e-6', () => {
  assert.equal(hashState({ a: 1, b: [1, 2] }), hashState({ b: [1, 2], a: 1 }));
  assert.equal(hashState({ x: 0.1 + 0.2 }), hashState({ x: 0.3 }));
  assert.notEqual(hashState({ x: 0.3 }), hashState({ x: 0.300002 }));
  assert.equal(hashState({ x: -0 }), hashState({ x: 0 }));
  assert.equal(hashState({ tune: 1, x: 2 }), hashState({ tune: 5, x: 2 }), 'the top-level tune is skipped');
  assert.equal(hashState({ f: new Float32Array([1, 2]) }), hashState({ f: [1, 2] }));
});

test('the flight step allocates nothing in its hot loops (gc exposed)', async () => {
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  unwire();
  wire(FLIGHT);
  const game = createGame({ seed: 2, zoneData: WALL, mode: 'drive' });
  const rec = makeInput();
  play(game, 0, 5);                                           // warm up: grids, trackers, JIT
  // 1. Retained heap: 10,000 steps grow the heap by under 2 MB (final.md 4.2).
  gc(); gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 10000; i++) step(game, inputAt(5 + i / 120, rec));
  gc(); gc();
  const grown = process.memoryUsage().heapUsed - before;
  assert.ok(grown < 2 * 1024 * 1024, `heap grew ${(grown / 1024).toFixed(0)} KB`);

  // 2. Allocation rate, each in its own process: an empty zone, and Coma's downtown with dozens of bodies near the
  // ship every step. The per-body loops (traffic, grid, sweeps, gaps, near misses) box no number, so downtown costs
  // about what empty space does; what is left is a few numbers the engine boxes once a step.
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const run = (which) => {
    const out = spawnSync(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url)],
      { env: { ...process.env, LYH_ALLOC_CHILD: which }, encoding: 'utf8' });
    const m = /ALLOC (\S+)/.exec(out.stdout || '');
    assert.ok(m, `child ${which} reported: ${out.stdout} ${out.stderr}`);
    return Number(m[1]);
  };
  const a = run('empty'), b = run('dense');
  assert.ok(b < 1024, `downtown: about ${b.toFixed(0)} bytes a step`);
  assert.ok(b - a < 256, `downtown adds ${(b - a).toFixed(0)} bytes a step to empty space's ${a.toFixed(0)}`);
});
