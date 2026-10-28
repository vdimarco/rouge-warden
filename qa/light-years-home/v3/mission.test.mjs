// Light Years Home v3: missions (final.md 18.1, 8; story §3). Round 1 plays the Wall's two (WHICH WAY HOME and FIRST
// SHOUT); Coma's PELICAN DOWN is data, and its tug, sinking and Magpie pushes are checked on their own. Checks: the
// story bot finishes WHICH WAY HOME from PLAY on 5 seeds and the Wall in under 3 minutes; the mission bot finishes
// FIRST SHOUT; the beginner takes down the chart thief within 30 s; a forced fail retries at the checkpoint 1.2 s later
// with the saved speed; SKIP after 3 fails finishes with no medal; cargo contacts count only above 6 u/s; the Pelican
// sinks to fail in 18 to 20 s; Magpie hits push the tug; the runner slows in Cruise when far ahead; tossed items can be
// caught head-on and after a miss; orBetter asks for one star more; the chapter bot rides J1 into Coma, the same twice.
// node qa/light-years-home/v3/mission.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { startMission, failMission, raisedFor, when, stepMission } from '../../../public/light-years-home/core/mission.js';
import { createEventBuffer } from '../../../public/light-years-home/core/events.js';
import { spawn, actorById, tossItem } from '../../../public/light-years-home/core/actors.js';
import { actionOf } from '../../../public/light-years-home/core/zone.js';
import { BOTS } from '../../../public/light-years-home/core/bots.js';
import { hashState } from '../../../public/light-years-home/core/hash.js';
import { wire, unwire, registerZone } from '../../../public/light-years-home/core/game.js';
import { playSlots } from '../../../public/light-years-home/core/zone.js';
import { stepJump, armJump, setZoneReady } from '../../../public/light-years-home/core/jump.js';
import { wireAll, newGame, run, of, place, WALL, COMA, H } from './activities.mjs';

wireAll();
const SEEDS = [1, 2, 3, 4, 5];

test('the story bot finishes WHICH WAY HOME from PLAY and leaves the Wall in under 3 minutes, 5 seeds', (t) => {
  const times = [];
  for (const seed of SEEDS) {
    const game = newGame({ seed, fresh: true });
    const bot = BOTS.story.make({ seed });
    const { events } = run(game, (g) => bot.next(g), 180, { until: (g) => g.mode === 'runup' });
    assert.equal(game.mode, 'runup', `seed ${seed}: the run-up started`);
    const p = game.progress.missions['which-way-home'];
    assert.equal(p?.done, true, `seed ${seed}: done`);
    assert.equal(game.zone.exitOpen, true);
    for (const type of ['missionStart', 'takedown', 'hook', 'farScan', 'exitOpen', 'fix', 'missionDone']) {
      assert.ok(of(events, type).length, `seed ${seed}: ${type}`);
    }
    assert.equal(of(events, 'farScan').length, 3);
    times.push(game.t);
  }
  t.diagnostic(`the Wall's story path: ${times.map((x) => x.toFixed(1)).join(', ')} s`);
  assert.ok(Math.max(...times) < 180);
});

test('the mission bot finishes FIRST SHOUT (a tier 2 drift at Sloan Bend, 44 u/s through Void Run) on 5 seeds', () => {
  for (const seed of SEEDS) {
    const game = newGame({ seed });
    place(game, [0, -150, 0], 0, 24);
    startMission(game, 'first-shout');
    const bot = BOTS.mission.make({ seed });
    const { events } = run(game, (g) => bot.next(g), 150, { until: (g) => !g.mission });
    const done = of(events, 'missionDone')[0];
    assert.ok(done, `seed ${seed}: done`);
    assert.ok(game.progress.tapes.includes('wake-up-call'), 'the tape');
    assert.ok(game.progress.stunts['sloan-bend'].stars >= 2 && game.progress.stunts['void-run'].stars >= 2);
  }
});

test("the beginner bot takes down the Wall's chart thief within 30 s, 5 seeds", (t) => {
  const times = [];
  for (const seed of SEEDS) {
    const game = newGame({ seed, at: [0, -120, 0], heading: 0, speed: 24, settings: { scheme: 'one-thumb' }, done: [] });
    run(game, () => ({ source: 'touch' }), 0.5);
    startMission(game, 'which-way-home');
    const bot = BOTS.mission.make({ skill: 'beginner', source: 'touch' });
    const t0 = game.t;
    let at = null;
    run(game, (g) => bot.next(g), 40, { onEvent: (e, g) => { if (e.type === 'takedown' && e.id === 'chart-thief') at = g.t - t0; },
      until: () => at !== null });
    assert.ok(at !== null && at <= 30, `seed ${seed}: ${at}`);
    times.push(at);
  }
  t.diagnostic(`takedowns at ${times.map((x) => x.toFixed(1)).join(', ')} s`);
});

test('a forced fail retries at the checkpoint 1.2 s later with the saved speed', () => {
  const game = newGame({ seed: 2, at: [-100, -200, 0], heading: 40, speed: 27, done: [] });
  startMission(game, 'which-way-home');
  const cp = game.mission.checkpoint;
  assert.ok(cp, 'the start is a checkpoint');
  const speed = cp.ship.speed, pos = cp.ship.pos.slice();
  run(game, () => ({ steer: 0.4, gas: 1, source: 'keys' }), 3);
  failMission(game, 'gapOver', null, 'IT GOT AWAY');
  const t0 = game.t;
  let back = null;
  const { events } = run(game, () => ({}), 3, { onEvent: (e, g) => { if (e.type === 'retry') back = g.t; }, until: () => back !== null });
  assert.ok(back !== null);
  assert.ok(Math.abs(back - t0 - game.tune.MISSION.RETRY) <= 1.5 * H, `retry after ${(back - t0).toFixed(3)} s`);
  assert.equal(game.ship.speed, speed);
  assert.deepEqual(game.ship.pos.map((x) => +x.toFixed(6)), pos.map((x) => +x.toFixed(6)));
  const thief = actorById(game, 'chart-thief');
  assert.ok(thief && thief.state !== 'beaten', 'the thief is back');
  assert.equal(of(events, 'retry')[0].beat, 0);
  // It got away for real: 200 u for 6 s fails with its toast.
  const g2 = newGame({ seed: 2, at: [-100, -200, 0], heading: 40, speed: 27, done: [] });
  startMission(g2, 'which-way-home');
  const r2 = run(g2, (g) => ({ steer: 0, brake: g.ship.speed > 6 ? 1 : 0, source: 'keys' }), 30,
    { until: (g, e) => of(e, 'fail').length });
  const f = of(r2.events, 'fail')[0];
  assert.ok(f && f.reason === 'gapOver' && f.toast === 'IT GOT AWAY');
});

test('SKIP THIS PART appears after 3 fails at one checkpoint and finishes the mission with no medal', () => {
  const game = newGame({ seed: 3, at: [-100, -200, 0], heading: 40, speed: 27, done: [] });
  startMission(game, 'which-way-home');
  for (let k = 0; k < 3; k++) {
    failMission(game, 'gapOver');
    run(game, () => ({}), 1.3);
  }
  assert.equal(game.mission.skipOffered, true);
  assert.equal(actionOf(game)?.id, 'skip');
  const { events } = run(game, () => ({ action: true, source: 'keys' }), H);
  const done = of(events, 'missionDone')[0];
  assert.ok(done && done.medal === null && done.skipped, JSON.stringify(done));
  assert.ok(of(events, 'fix').length, 'the fix is never withheld');
  run(game, () => ({}), H);
  assert.equal(game.zone.exitOpen, true, 'the exit opens');
});

test('cargo contacts count only above 6 u/s', () => {
  const giant = WALL.bodies.find((b) => b.id === 'bend-giant');
  const counts = [];
  for (const speed of [4.5, 14]) {
    const game = newGame({ seed: 1 });
    game.ship.cargo = { kind: 'glass', contacts: 0, scratched: false };
    // Straight at the giant's core from 12 u out, at that speed, holding it there.
    place(game, [giant.pos[0], giant.pos[1] - 12, 0], 0, speed);
    run(game, (g) => { g.ship.speed = Math.min(g.ship.speed, speed); return { brake: speed < 6 ? 0.2 : 0, source: 'keys' }; }, 2);
    counts.push(game.ship.cargo.contacts);
  }
  assert.equal(counts[0], 0, `slow: ${counts[0]}`);
  assert.ok(counts[1] >= 1, `fast: ${counts[1]}`);
});

test('the Pelican sinks into NGC 4889 and fails the hook in 18 to 20 s if never hooked', () => {
  const game = newGame({ zone: COMA, seed: 1 });
  startMission(game, 'pelican-down');
  const tug = actorById(game, 'pelican');
  assert.ok(tug, 'the Pelican');
  // Find it (beat 0: within 60 u), then fly away and leave it.
  place(game, [tug.pos[0] - 40, tug.pos[1] - 30, 0], 50, 24);
  run(game, () => ({}), H * 2);
  assert.equal(game.mission.beat, 1);
  place(game, [-400, 300, 0], 0, 24);
  const t0 = game.t;
  let failAt = null;
  run(game, () => ({}), 30, { onEvent: (e, g) => { if (e.type === 'fail') failAt = g.t - t0; }, until: () => failAt !== null });
  assert.ok(failAt !== null && failAt >= 18 && failAt <= 20, `sank at ${failAt}`);
});

test('a Magpie hit pushes the tug toward NGC 4889', () => {
  const game = newGame({ zone: COMA, seed: 1 });
  spawn(game, { id: 'pelican', kind: 'towable', pos: [-160, 60, 0], state: 'parked', sinkTo: 'ngc4889', hookable: false });
  spawn(game, { id: 'magpie-1', kind: 'pursuer', target: 'pelican', pos: [-160, 140, 0], speedCap: 34, peelOff: 4 });
  place(game, [-400, 300, 0], 0, 24);
  const { events } = run(game, () => ({}), 8, { until: (g, e) => of(e, 'cargoHit').length });
  const hit = of(events, 'cargoHit')[0];
  assert.ok(hit && hit.by === 'magpie-1', 'a hit');
  const tug = actorById(game, 'pelican');
  const toward = [-57 - tug.pos[0], -3 - tug.pos[1]];
  const along = (tug.vel[0] * toward[0] + tug.vel[1] * toward[1]) / Math.hypot(...toward);
  assert.ok(along > 4, `pushed ${along.toFixed(2)} u/s toward the giant`);
});

test('the chart thief slows to its Cruise band when far ahead, and not in Pilot', () => {
  for (const assists of ['cruise', 'pilot']) {
    const game = newGame({ seed: 1, at: [-300, -300, 0], heading: 0, speed: 24, settings: { assists }, done: [] });
    startMission(game, 'which-way-home');
    const thief = actorById(game, 'chart-thief');
    // Far away, standing still: it joins its loop and runs.
    run(game, (g) => { g.ship.speed = 0; g.ship.vel.fill(0); return { brake: 1 }; }, 15);
    const want = assists === 'cruise' ? 22 : 27;
    assert.ok(Math.abs(thief.speed - want) < 0.5, `${assists}: ${thief.speed.toFixed(2)} u/s`);
  }
});

test('a tossed item can be caught head-on and, after a miss, by turning back', () => {
  // Head-on: tossed straight at the Tern.
  const game = newGame({ seed: 1, at: [0, -300, 0], heading: 0, speed: 24, done: [] });
  startMission(game, 'which-way-home');
  game.mission.beat = 1;
  tossItem(game, 'chart', [0, -250, 0], { along: [0, -1], speed: 6, kick: 0 });
  let got = null;
  run(game, () => ({ source: 'keys' }), 4, { onEvent: (e, g) => { if (e.type === 'hook' && e.actor === 'chart') got = g.t; }, until: () => got !== null });
  assert.ok(got !== null, 'caught head-on');
  // A miss: tossed 25 u to the side; the bot turns back for it.
  const g2 = newGame({ seed: 1, at: [0, -300, 0], heading: 0, speed: 28, done: [] });
  startMission(g2, 'which-way-home');
  g2.mission.beat = 1;
  tossItem(g2, 'chart', [25, -280, 0], { along: [1, 0], speed: 4, kick: 0 });
  run(g2, () => ({ source: 'keys' }), 2);
  assert.ok(actorById(g2, 'chart'), 'missed it at first');
  const bot = BOTS.mission.make({});
  let got2 = null;
  run(g2, (g) => bot.next(g), 15, { onEvent: (e, g) => { if (e.type === 'hook' && e.actor === 'chart') got2 = g.t; }, until: () => got2 !== null });
  assert.ok(got2 !== null, 'caught after turning back');
});

test('orBetter stunt goals ask for one star more than the player holds (at most 3), and the call says so', () => {
  const game = newGame({ seed: 1 });
  assert.equal(raisedFor(game, 'first-shout'), false);
  game.progress.stunts['sloan-bend'] = { stars: 2, best: 2 };
  game.progress.stunts['void-run'] = { stars: 3, best: 48 };
  assert.equal(raisedFor(game, 'first-shout'), true);
  startMission(game, 'first-shout');
  assert.equal(game.mission.target['sloan-bend'], 3);
  assert.equal(game.mission.target['void-run'], 3);
  // A result below the target does not count, one at it does (the goal reads this step's stuntResult events).
  const feed = (id, stars) => {
    const buf = createEventBuffer();
    buf.t = game.t;
    buf.push('stuntResult', { id, stars });
    stepMission(game, H, buf);
    return buf.last();
  };
  feed('sloan-bend', 2);
  assert.ok(!game.mission.sub[0], 'two stars is not enough when you held two');
  feed('sloan-bend', 3);
  assert.equal(game.mission.sub[0], true);
  assert.equal(game.mission.count, 1);
  const last = feed('void-run', 3);
  assert.ok(last.some((e) => e.type === 'missionDone'), 'both done');
});

test('starting by itself, by TAKE JOB after a call, and the opening ending at the chase', () => {
  // WHICH WAY HOME starts by itself: driving into Node 0's ring (the first orange objective) from 12 s, near Node 0
  // from 25 s, or anywhere at 80 s; the opening's lines left go to the log.
  const since = (g) => g.t - g.story.playAt;
  // Straight up the Sloan road with no input: into the ring at about 13 s, and the Magpie comes at once.
  let game = newGame({ seed: 1, fresh: true });
  let r = run(game, () => ({ source: 'keys' }), 30, { until: (g) => !!g.mission });
  assert.equal(game.mission?.id, 'which-way-home');
  assert.ok(since(game) >= 12 - 1e-6 && since(game) < 20, `into the ring: started at ${since(game).toFixed(1)}`);
  assert.ok(Math.hypot(game.ship.pos[0], game.ship.pos[1]) <= 40 + 1, 'inside Node 0 ring');
  // Circling 70 to 140 u from Node 0, outside its ring: at 25 s.
  game = newGame({ seed: 1, fresh: true, at: [0, -70, 0], heading: 90, speed: 24 });
  r = run(game, (g) => ({ steer: 0.4, source: 'keys' }), 40, { until: (g) => !!g.mission });
  assert.ok(since(game) >= 25 - 1e-6 && since(game) < 26, `near Node 0: started at ${since(game).toFixed(1)}`);
  // Far away, circling near the drop-out: at 80 s, wherever you are.
  game = newGame({ seed: 1, fresh: true });
  r = run(game, (g) => ({ steer: since(g) > 1 ? 0.3 : 0, source: 'keys' }), 85, { until: (g) => !!g.mission });
  assert.equal(game.mission?.id, 'which-way-home');
  assert.ok(since(game) >= 80 - 1e-6 && since(game) < 81, `anywhere: started at ${since(game).toFixed(1)}`);
  assert.equal(of(r.events, 'missionStart').length, 1);
  assert.ok(game.talk.log.includes('dot.samedist'), 'the toLog premise lines are in the log');
  // FIRST SHOUT is offered by Redshift's call after red.woke; TAKE JOB starts it.
  const g2 = newGame({ seed: 1 });
  g2.talk.heard = { 'red.woke': g2.t };
  assert.ok(when(g2, 'line:red.woke'));
  const r2 = run(g2, () => ({}), 12, { until: (g) => actionOf(g)?.id === 'take' });
  assert.equal(actionOf(g2)?.id, 'take');
  assert.ok(of(r2.events, 'missionOffer').length);
  run(g2, () => ({ action: true, source: 'keys' }), H);
  assert.equal(g2.mission?.id, 'first-shout');
});

test('a mission run is deterministic', () => {
  const play = () => {
    const game = newGame({ seed: 4, at: [0, -120, 0], heading: 0, speed: 24, done: [] });
    startMission(game, 'which-way-home');
    const bot = BOTS.mission.make({});
    run(game, (g) => bot.next(g), 30);
    return hashState(game);
  };
  assert.equal(play(), play());
});

test('the timed missions of later zones are data for now', { todo: 'Round 2: PELICAN DOWN and FRAGILE with the mission bot and the beginner inside their limits' }, () => {
  assert.fail('Round 2');
});

test('the chapter bot plays the Wall, rides J1 and drives on in Coma, the same twice', () => {
  unwire();
  wire(playSlots({ jump: stepJump, arm: armJump }));
  registerZone(WALL);
  registerZone(COMA);
  try {
    const hashes = [];
    for (let k = 0; k < 2; k++) {
      const game = newGame({ seed: 5, fresh: true, done: [] });
      const bot = BOTS.chapter.make({ seed: 5 });
      const { events } = run(game, (g) => { if (g.mode !== 'drive') setZoneReady(g, true); return bot.next(g); }, 240,
        { until: (g) => g.zoneId === 'coma' && g.mode === 'drive' && g.t - g.arrivalT > 3 });
      assert.equal(game.zoneId, 'coma');
      assert.equal(of(events, 'jumpMedal').length, 1);
      assert.ok(game.t < 180 + 30, `${game.t.toFixed(1)} s`);
      hashes.push(hashState(game));
    }
    assert.equal(hashes[0], hashes[1]);
  } finally {
    wireAll();
  }
});

// ---------------------------------------------------------------- Round 1 playtest fixes

test('on auto-cruise (no gas, no boost) a chaser takes the thief down within 30 s, 5 seeds; GAS is quicker', (t) => {
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const chase = (seed, extra) => {
    const game = newGame({ seed, at: [-16, 89, 0], heading: 180, speed: 24, done: [] });
    startMission(game, 'which-way-home');
    let at = null;
    run(game, (g) => {
      const a = actorById(g, 'chart-thief'), s = g.ship;
      if (!a) return {};
      const d = Math.hypot(a.pos[0] - s.pos[0], a.pos[1] - s.pos[1]), lead = Math.min(1, d / 40);
      const want = Math.atan2(a.pos[0] + a.vel[0] * lead - s.pos[0], a.pos[1] + a.vel[1] * lead - s.pos[1]);
      return { steer: Math.max(-1, Math.min(1, 3 * wrap(want - Math.atan2(s.vel[0], s.vel[1])))), source: 'touch',
        ...extra };
    }, 60, { onEvent: (e, g) => { if (e.type === 'takedown' && e.id === 'chart-thief' && at === null) at = g.t; },
      until: () => at !== null });
    return at;
  };
  const cruise = SEEDS.map((seed) => chase(seed, {})), gas = SEEDS.map((seed) => chase(seed, { gas: 1 }));
  t.diagnostic(`no gas: ${cruise.map((x) => x?.toFixed(1)).join(', ')} s; gas held: ${gas.map((x) => x?.toFixed(1)).join(', ')} s`);
  for (const [i, x] of cruise.entries()) assert.ok(x !== null && x <= 30, `seed ${SEEDS[i]}: ${x}`);
  const mean = (l) => l.reduce((a, b) => a + b, 0) / l.length;
  assert.ok(mean(gas) < mean(cruise), 'holding GAS still pays');
});

test('Cruise: within 60 u behind the thief it runs 3 u/s slower than you (never under 18); Pilot keeps 27', () => {
  for (const assists of ['cruise', 'pilot']) {
    const game = newGame({ seed: 1, at: [-300, -300, 0], heading: 0, speed: 24, settings: { assists }, done: [] });
    startMission(game, 'which-way-home');
    const thief = actorById(game, 'chart-thief');
    run(game, () => ({}), 4);                                    // it bolts and joins its loop
    // Put the Tern 30 u behind it on its line, at cruise.
    const yaw = thief.yaw, back = [thief.pos[0] - Math.sin(yaw) * 30, thief.pos[1] - Math.cos(yaw) * 30, 0];
    place(game, back, (yaw * 180) / Math.PI, 24);
    run(game, () => ({}), 1.5);
    const want = assists === 'cruise' ? Math.max(18, game.ship.speed - 3) : 27;
    assert.ok(Math.abs(thief.speed - want) < 1.2, `${assists}: ${thief.speed.toFixed(2)} u/s, want ${want.toFixed(1)}`);
  }
});

test('a towed load is never taken down: ramming the Pelican only bumps it (Round 2 data)', () => {
  unwire();
  wire(playSlots());
  registerZone(COMA);
  const game = newGame({ zone: COMA, seed: 1, at: [-110, 25, 0], heading: 0, speed: 30, done: [] });
  spawn(game, { id: 'pelican', kind: 'towable', pos: [-110, 45, 0], state: 'holding', hull: 'pelican', label: 'PELICAN' },
    null);
  const { events } = run(game, () => ({ gas: 1 }), 2);
  assert.equal(of(events, 'takedown').filter((e) => e.id === 'pelican').length, 0);
  wireAll();
});
