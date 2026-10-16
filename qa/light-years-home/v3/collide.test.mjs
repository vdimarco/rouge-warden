// Light Years Home v3: collisions and proximity (final.md 18.1, 6.6, 6.4). Scripted passes through small test zones
// on the real game step with the flight slots wired.
// node qa/light-years-home/v3/collide.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNE } from '../../../public/light-years-home/core/tune.js';
import { createEventBuffer } from '../../../public/light-years-home/core/events.js';
import { createGame, step, wire, unwire } from '../../../public/light-years-home/core/game.js';
import { FLIGHT } from '../../../public/light-years-home/core/ship.js';
import {
  sweepCapsule, classifyHit, createGrid, addStatic, query, createNearTracker, trackNear, createCands, STATIC_BASE,
} from '../../../public/light-years-home/core/collide.js';

const DEG = Math.PI / 180;
const CAP = TUNE.COLLIDE.CAPSULE_R;

function zoneWith(bodies, extra = {}) {
  return { id: `z${Math.random().toString(36).slice(2, 8)}`, R: 700, band: 100, roads: [], swarms: [],
    bodies: bodies.map((b, i) => ({ id: b.id ?? `b${i}`, r: b.r ?? b.rc, ...b })), ...extra };
}

// Drive the ship from `at` heading `heading` for `secs` with one input; collect event counts.
function drive(zone, { at, heading = 0, speed = 30, secs = 2, input = {}, actors = null, each = null }) {
  unwire();
  wire(FLIGHT);
  const game = createGame({ seed: 1, zoneData: zone, mode: 'drive', at, heading, speed });
  if (actors) game.actors = actors;
  const ev = createEventBuffer();
  const count = {};
  const list = [];
  for (let i = 0; i < Math.round(secs * 120); i++) {
    ev.clear();
    if (each) each(game);
    step(game, typeof input === 'function' ? input(game) : { source: 'keys', ...input }, ev);
    for (let k = 0; k < ev.n; k++) {
      const e = ev.list[k];
      count[e.type] = (count[e.type] || 0) + 1;
      list.push({ ...e });
    }
  }
  return { game, count, list };
}

test('no tunnelling at 48 u/s through a 0.6 u dwarf', () => {
  // The sweep itself: one 0.4 u step straight through a 0.3 u sphere is a hit.
  const hit = sweepCapsule([0, -0.5, 0], [0, 0.5, 0], CAP, [0, 0, 0], 0.3);
  assert.ok(hit && hit.t >= 0 && hit.t < 1, 'the sweep catches it');
  assert.ok(sweepCapsule([0, -1, 0], [0, -0.7, 0], CAP, [0, 0, 0], 0.3) === null, 'short of it is no hit');
  assert.ok(sweepCapsule([2, -1, 0], [2, 1, 0], CAP, [0, 0, 0], 0.3) === null, 'beside it is no hit');
  // In the game, at the cap, from several offsets: every one touches (a scrape or a crash), none passes through.
  for (const lat of [0, 0.2, 0.45, 0.6]) {
    const zone = zoneWith([{ pos: [lat, 0, 0], rc: 0.3, r: 0.6 }]);
    const { count, game } = drive(zone, { at: [0, -60, 0], speed: 48, secs: 2, input: { boost: true } });
    assert.ok((count.scrape || 0) + (count.crash || 0) >= 1, `offset ${lat}: a contact`);
    assert.ok(game.ship.pos[1] > 0 || Math.abs(game.ship.pos[0]) > 0.5, 'and the ship goes on');
  }
});

test('scrape and head-on rules (35°, keep 90%, keep 40% with a 6 u/s floor)', () => {
  const n = [0, -1, 0];                                       // the surface faces the ship coming from −y
  const at = (deg, s = 30) => [s * Math.cos(deg * DEG), s * Math.sin(deg * DEG), 0];
  assert.equal(classifyHit(at(20), n, 30, null), 'scrape');
  assert.equal(classifyHit(at(34), n, 30, null), 'scrape');
  assert.equal(classifyHit(at(36), n, 30, null), 'headon');
  assert.equal(classifyHit(at(90), n, 30, null), 'headon');
  // In the game: speeds kept.
  for (const [speed, want] of [[30, 12], [12, 6], [42, 16.8]]) {
    const zone = zoneWith([{ pos: [0, 0, 0], rc: 3 }]);
    const res = drive(zone, { at: [0, -20, 0], speed, secs: 1, input: { gas: speed > 24 ? 1 : 0 } });
    const crash = res.list.find((e) => e.type === 'crash');
    assert.ok(crash, `head-on at ${speed}`);
    const after = res.list.filter((e) => e.type === 'crash').length;
    assert.equal(after, 1, 'the flicker stops a second head-on at once');
  }
  // The speed right after a head-on, measured on one step.
  unwire();
  wire(FLIGHT);
  for (const [speed, want] of [[30, 12], [12, 6]]) {
    const zone = zoneWith([{ pos: [0, 0, 0], rc: 3 }]);
    const game = createGame({ seed: 1, zoneData: zone, mode: 'drive', at: [0, -3.4 - CAP - speed / 120, 0], speed });
    const ev = createEventBuffer();
    let after = null;
    for (let i = 0; i < 20 && after === null; i++) {
      ev.clear();
      step(game, { gas: 1, source: 'keys' }, ev);
      if (ev.list.slice(0, ev.n).some((e) => e.type === 'crash')) after = game.ship.speed;
    }
    assert.ok(after !== null && Math.abs(after - want) < 0.6, `${speed} u/s leaves at ${after?.toFixed(2)}, want ${want}`);
    assert.ok(game.ship.bar <= TUNE.BAR.START + TUNE.BAR.CRASH + 1e-9, 'a head-on costs a bar segment');
  }
});

test('a big crash slows time and lets you bend the rebound; a scrape keeps the chain', () => {
  const zone = zoneWith([{ pos: [0, 0, 0], rc: 3 }]);
  const res = drive(zone, { at: [0, -40, 0], speed: 42, secs: 1.5,
    input: (g) => ({ boost: true, steer: g.timeScale < 1 ? 1 : 0, source: 'keys' }) });
  assert.ok(res.count.bigCrash === 1, 'a big crash');
  assert.ok(res.game.ship.afterBend > 0, 'steering bent the rebound');
  assert.ok(Math.abs(res.game.ship.afterBend) <= TUNE.COLLIDE.AFTERTOUCH * DEG + 1e-9);
  // The slow motion and the hit-stop are game time controls.
  unwire();
  wire(FLIGHT);
  const g = createGame({ seed: 1, zoneData: zone, mode: 'drive', at: [0, -10, 0], speed: 40 });
  const scales = new Set();
  for (let i = 0; i < 240; i++) { step(g, { gas: 1, source: 'keys' }); scales.add(g.timeScale); }
  assert.ok(scales.has(0), 'hit-stop');
  assert.ok(scales.has(TUNE.COLLIDE.BIG_X), 'slow motion');
  // Two NEARs start a chain; a 20° scrape on the next body keeps it (a head-on would lose it).
  const off = 1.5 + 1 + CAP;
  const scrapeAt = 7 + CAP;
  const run = zoneWith([{ pos: [off, 0, 0], rc: 1 }, { pos: [-off, 25, 0], rc: 1 },
    { pos: [scrapeAt * Math.cos(20 * DEG), 60, 0], rc: 7, r: 7 }]);
  const res2 = drive(run, { at: [0, -30, 0], speed: 30, secs: 3.5, input: { gas: 1 } });
  assert.equal(res2.count.near, 2);
  assert.equal(res2.count.scrape, 1);
  assert.equal(res2.count.chainLost, undefined, 'the scrape keeps the chain');
  assert.equal(res2.count.chainBank, undefined, 'still running');
  assert.equal(res2.game.ship.chain.n, 2);
});

test('the floor assist lifts a shallow meeting with a big body; a steep dive still hits', () => {
  const big = zoneWith([{ id: 'planet', pos: [0, 0, -40], rc: 36, r: 36 }]);
  // Flying level 2 u above the top of the planet, then a gentle dive into it.
  const shallow = drive(big, { at: [0, -60, -1.5], speed: 26, secs: 4, input: { climb: -0.15, source: 'pad' } });
  assert.equal(shallow.count.crash || 0, 0, 'no head-on when skimming in');
  const steep = drive(big, { at: [0, -60, 20], speed: 26, secs: 3, input: { climb: -1, source: 'pad' } });
  assert.ok((steep.count.crash || 0) + (steep.count.scrape || 0) >= 1, 'a steep dive meets the surface');
});

test('near, hairline, thread, skim and draft counts on scripted passes', () => {
  // A single pass at a given gap: under 2.0 u is a NEAR, under 0.6 a hairline, over 2.0 nothing.
  const pass = (gap, speed = 30, rc = 1) => {
    const zone = zoneWith([{ pos: [gap + rc + CAP, 0, 0], rc }]);
    return drive(zone, { at: [0, -30, 0], speed, secs: 2.5 }).count;
  };
  let c = pass(1.5);
  assert.equal(c.near, 1); assert.equal(c.hairline, undefined);
  c = pass(0.4);
  assert.equal(c.hairline, 1); assert.equal(c.near, undefined);
  c = pass(2.4);
  assert.equal(c.near, undefined); assert.equal(c.hairline, undefined);
  // A body going your way: 1.5 u off, but only 6 u/s faster than it, is too slow to count.
  const slow = { id: 'slow', kind: 'racer', pos: [1.5 + 0.6 + CAP, 6, 0], vel: [0, 18, 0], yaw: 0, speed: 18, rc: 0.6, r: 1 };
  c = drive(zoneWith([]), { at: [0, 0, 0], speed: 24, secs: 3, actors: [slow], each: () => { slow.pos[1] += 18 / 120; } }).count;
  assert.equal(c.near, undefined, 'too slow to count');

  // A thread: two bodies on opposite sides, each within 3 u, passed together.
  const thread = zoneWith([{ pos: [-(2.5 + 1 + CAP), 0, 0], rc: 1 }, { pos: [2.5 + 1 + CAP, 0.5, 0], rc: 1 }]);
  c = drive(thread, { at: [0, -30, 0], speed: 30, secs: 2.5 }).count;
  assert.equal(c.thread, 1);

  // Bar and chain: three NEARs in a row start a ×2 chain, which banks 3 s later and pays the bar 2 × CHAIN_BAR.
  const row = zoneWith([0, 1, 2].map((i) => ({ pos: [(i % 2 ? -1 : 1) * (1.5 + 1 + CAP), i * 25, 0], rc: 1 })));
  const r = drive(row, { at: [0, -30, 0], speed: 30, secs: 8 });
  assert.equal(r.count.near, 3);
  assert.equal(r.count.chainUp, 1);
  assert.equal(r.count.chainBank, 1);
  assert.ok(Math.abs(r.game.ship.bar - (TUNE.BAR.START + 3 * TUNE.BAR.NEAR + 2 * TUNE.PROX.CHAIN_BAR)) < 1e-9,
    'each NEAR pays the bar, and so does the banked chain');

  // A skim: along a skim surface within 3 u for 0.4 s or more, then away.
  const skim = zoneWith([{ id: 'giant', pos: [30 + 2 + CAP, 0, 0], rc: 30, r: 30, skim: true }]);
  const s = drive(skim, { at: [0, -40, 0], speed: 24, secs: 4 });
  assert.equal(s.count.skimStart, 1);
  assert.equal(s.count.skimEnd, 1);
  const end = s.list.find((e) => e.type === 'skimEnd');
  assert.ok(end.t > 0.3 && end.body === 'giant', `skimmed ${end.t?.toFixed(2)} s`);

  // A draft: 8 u behind a big ship going your way at 24 u/s.
  const lead = { id: 'lead', kind: 'racer', pos: [0, 8, 0], vel: [0, 24, 0], yaw: 0, speed: 24, rc: 0.6, r: 2 };
  const d = drive(zoneWith([]), { at: [0, 0, 0], speed: 24, secs: 2, actors: [lead],
    each: () => { lead.pos[1] += 24 / 120; } });
  assert.equal(d.count.draftStart, 1);
  assert.ok(d.game.ship.draft.on && d.game.ship.draft.target === 'lead');
  assert.ok(d.game.ship.bar > TUNE.BAR.START + 0.1, 'the draft fills the bar');
});

test('takedown rules for ships and for a towed load', () => {
  const n = [1, 0, 0];                                         // the hitter comes from +x
  // A side hit at 10 u/s of sideways closing speed, at least as fast: a takedown.
  assert.equal(classifyHit([-10, 20, 0], n, 22.4, [0, 20, 0]), 'takedown');
  assert.equal(classifyHit([-5, 20, 0], n, 20.6, [0, 20, 0]), 'scrape', 'too gentle');
  assert.equal(classifyHit([-10, 0, 0], n, 10, [0, 20, 0]), 'headon', 'slower than the target');
  // A towed load whipped into a Magpie uses the same rule (actors.js calls classifyHit with the load as the hitter).
  assert.equal(classifyHit([-12, 4, 0], n, 26, [0, 22, 0]), 'takedown');

  // In the game: the ship side-swipes a Magpie.
  const magpie = { id: 'magpie', kind: 'runner', pos: [0, 0, 0], vel: [0, 20, 0], yaw: 0, speed: 20, rc: 0.6, r: 1, hits: 0,
    spinT: 0 };
  const res = drive(zoneWith([]), { at: [-3, 0, 0], heading: 60, speed: 30, secs: 0.6, actors: [magpie],
    each: () => { magpie.pos[1] += 20 / 120; } });
  assert.equal(res.count.takedown, 1);
  assert.ok(magpie.spinT > 0 && magpie.hits === 1, `the Magpie spins out (hits ${magpie.hits}, ${JSON.stringify(res.count)})`);
  assert.ok(Math.abs(res.game.ship.bar - (TUNE.BAR.START + TUNE.BAR.TAKEDOWN)) < 1e-6, 'a takedown pays +0.25');
  assert.ok(res.game.ship.speed >= 0.9 * 24, 'you keep your speed');
});

test('the grid and the tracker on their own', () => {
  const g = createGrid(32, 500);
  addStatic(g, 0, [100, 100, 0], 40);
  addStatic(g, 1, [-300, 0, 0], 2);
  const out = new Int32Array(16);
  let n = query(g, [130, 130, 0], 5, out);
  assert.deepEqual([...out.slice(0, n)], [STATIC_BASE + 0], 'a big body fills every cell it covers, once');
  n = query(g, [0, 0, 0], 20, out);
  assert.equal(n, 0);
  // The tracker: a pass that closes to 1.0 u then opens is one NEAR; cooled, a second pass counts again.
  const tr = createNearTracker(8);
  const cands = createCands(4);
  const ev = createEventBuffer();
  const feed = (gap) => {
    cands.n = 1; cands.ids[0] = 7; cands.gap[0] = gap; cands.rel[0] = 20; cands.side[0] = 1;
    trackNear(tr, null, cands, 1 / 120, ev);
  };
  for (const gap of [5, 3, 1.5, 1.0, 1.2, 3, 6]) feed(gap);
  assert.equal(ev.count('near'), 1);
  for (const gap of [3, 1.0, 1.3]) feed(gap);
  assert.equal(ev.count('near'), 1, 'inside the cooldown');
  for (let i = 0; i < 130; i++) feed(8);
  for (const gap of [3, 0.5, 1.3]) feed(gap);
  assert.equal(ev.count('hairline'), 1, 'after the cooldown a new pass counts');
});
