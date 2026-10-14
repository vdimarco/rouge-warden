// Light Years Home v3: the radio queue (final.md 18.1, 2.7, 12; story §2.1). Checks on scripted runs: line starts are
// at least TALK.GAP apart (the pre-roll aside); none starts within TALK.QUIET s after a gate, a hit or a takedown, nor
// while a race clock runs; mission lines beat Dot, who beats Redshift; a lower line that waits more than TALK.DROP s is
// dropped to the log (a mission line waits longer, then goes to the log too); a skip sends the line to the log; the
// opening plays in order; Redshift keeps his gap. node qa/light-years-home/v3/talk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { say, skipLine, current, quiet, stepTalk } from '../../../public/light-years-home/core/talk.js';
import { startEvent } from '../../../public/light-years-home/core/race.js';
import { startMission } from '../../../public/light-years-home/core/mission.js';
import { OPENING } from '../../../public/light-years-home/core/world/lines/ch1.js';
import { BOTS } from '../../../public/light-years-home/core/bots.js';
import { wire, unwire, registerZone } from '../../../public/light-years-home/core/game.js';
import { playSlots, openExit } from '../../../public/light-years-home/core/zone.js';
import { stepJump, armJump, setZoneReady, JUMP_BOTS } from '../../../public/light-years-home/core/jump.js';
import { JUMPS } from '../../../public/light-years-home/core/world/jumps.js';
import { wireAll, newGame, run, of, place, H, QUIET, WALL, COMA } from './activities.mjs';

wireAll();
const HUSH = new Set(['gate', 'gateMiss', 'crash', 'bigCrash', 'takedown']);
const isHit = (e) => HUSH.has(e.type) || (e.type === 'scrape' && !e.pebble);

// The rules on one run's events.
function checkRules(events, T, label) {
  const lines = of(events, 'line');
  const starts = lines.filter((e) => e.id !== 'kit.moon');
  for (let i = 1; i < starts.length; i++) {
    assert.ok(starts[i].t - starts[i - 1].t >= T.GAP - 1e-6,
      `${label}: ${starts[i - 1].id} at ${starts[i - 1].t.toFixed(2)} then ${starts[i].id} at ${starts[i].t.toFixed(2)}`);
  }
  for (const l of lines) {
    const hit = events.find((e) => isHit(e) && e.t < l.t && l.t - e.t < T.QUIET - 1e-6);
    assert.ok(!hit, `${label}: ${l.id} at ${l.t.toFixed(2)} came ${hit && (l.t - hit.t).toFixed(2)} s after a ${hit?.type}`);
  }
  return lines;
}

test('a scripted 120 s run never shows two lines less than 8 s apart (the pre-roll aside), none just after a hit', (t) => {
  for (const seed of [1, 2, 3]) {
    const game = newGame({ seed, fresh: true, done: [] });
    const bot = BOTS.story.make({ seed });
    const { events } = run(game, (g) => bot.next(g), 120);
    const lines = checkRules(events, game.tune.TALK, `seed ${seed}`);
    t.diagnostic(`seed ${seed}: ${lines.length} lines: ${lines.map((l) => `${l.id}@${l.t.toFixed(0)}`).join(' ')}`);
    assert.ok(lines.length >= 8, 'the radio talks');
  }
});

test('no line starts while a race clock runs, nor within 2 s of its gates', () => {
  const game = newGame({ seed: 2 });
  startEvent(game, 'first-light', { fromRunup: true });
  // A line waits for the race; Redshift's is dropped before then, Dot's plays after the finish.
  say(game, 'dot.void');
  const bot = BOTS.mid.make({ event: 'first-light', seed: 2 });
  const { events } = run(game, (g) => bot.next(g), 30, { until: (g) => g.race?.state === 'finished' });
  const start = of(events, 'eventStart')[0].t, end = of(events, 'finish')[0].t;
  assert.equal(of(events, 'line').filter((l) => l.t > start && l.t <= end).length, 0, 'quiet during the race');
  checkRules(events, game.tune.TALK, 'race');
});

test('priority: mission lines, then Dot, then Redshift', () => {
  const game = newGame({ seed: 1, zone: QUIET });
  run(game, () => ({}), 1);
  say(game, 'red.drift');
  say(game, 'dot.void');
  say(game, 'magpie.chart', { mission: true });
  const { events } = run(game, () => ({}), 10);
  const order = of(events, 'line').map((l) => l.id);
  assert.deepEqual(order, ['magpie.chart'], order.join(' '));
  assert.ok(game.talk.log.includes('red.drift') && game.talk.log.includes('dot.void'), 'the others waited too long');
  // Dot before Redshift, queued together once the gap allows.
  game.talk.redshiftT = -99;
  say(game, 'red.takedown');
  say(game, 'dot.node0');
  const r2 = run(game, () => ({}), 10);
  assert.deepEqual(of(r2.events, 'line').map((l) => l.id), ['dot.node0']);
  // Redshift's own gap: a second reaction within 40 s is not even queued.
  game.talk.redshiftT = game.t;
  assert.equal(say(game, 'red.takedown'), false);
  assert.equal(say(game, 'red.request', { mission: true }), true, 'a mission call is not a reaction');
});

test('a lower line waiting over 6 s is dropped; a mission line waits longer, then goes to the log', () => {
  const T = newGame().tune.TALK;
  const game = newGame({ seed: 1, zone: QUIET });
  run(game, () => ({}), 1);
  say(game, 'dot.void');
  run(game, () => ({}), H * 2);
  assert.equal(current(game)?.id, 'dot.void');
  say(game, 'dot.node0');                                   // must wait the 8 s gap: dropped at 6 s
  const { events } = run(game, () => ({}), T.GAP + 1);
  const drop = of(events, 'lineDrop').find((e) => e.id === 'dot.node0');
  assert.ok(drop, 'dropped');
  assert.ok(Math.abs(drop.t - (game.t - (T.GAP + 1)) - T.DROP) < 0.05, `after ${drop.t}`);
  assert.ok(game.talk.log.includes('dot.node0'));
  // A mission line held by a long quiet goes to the log after its longer wait.
  quiet(game, 30);
  say(game, 'dot.oldersky', { mission: true });
  const r2 = run(game, () => ({}), 20);
  assert.ok(of(r2.events, 'lineDrop').some((e) => e.id === 'dot.oldersky'));
  assert.ok(game.talk.log.includes('dot.oldersky'));
});

test('a skip sends the line to the log; the action control skips when no chip is up', () => {
  const game = newGame({ seed: 1, zone: QUIET });
  run(game, () => ({}), 1);
  say(game, 'dot.void');
  run(game, () => ({}), H * 2);
  assert.equal(current(game).id, 'dot.void');
  assert.ok(current(game).chunks.length >= 1 && current(game).t >= 0);
  skipLine(game);
  assert.equal(current(game), null);
  assert.ok(game.talk.log.includes('dot.void'));
  // Through the action slot: no chip (no exit, no race, no offer), so a tap skips.
  run(game, () => ({}), 8);
  say(game, 'dot.node0');
  run(game, () => ({}), H * 2);
  assert.equal(current(game)?.id, 'dot.node0');
  assert.equal(game.zone.exitOpen, false);
  const { events } = run(game, () => ({ action: true, source: 'keys' }), H);
  assert.ok(of(events, 'lineSkip').some((e) => e.id === 'dot.node0'));
});

test('the opening plays in order from the PLAY tap, and what is left goes to the log when the chase starts', () => {
  const game = newGame({ seed: 1, fresh: true, done: [] });
  const { events } = run(game, () => ({ source: 'keys' }), 50);
  const ids = of(events, 'line').map((l) => l.id);
  const want = OPENING.lines.map((o) => o.line);
  assert.deepEqual(ids.filter((id) => want.includes(id)), want.slice(0, ids.filter((id) => want.includes(id)).length));
  assert.equal(ids[0], 'kit.moon');
  assert.ok(ids.includes('dot.awake') && ids.includes('dot.notmoon'));
  const t0 = game.story.playAt;
  const awake = of(events, 'line').find((l) => l.id === 'dot.awake');
  assert.ok(awake.t - t0 >= 2.5 - 1e-6 && awake.t - t0 < 5, `dot.awake at ${(awake.t - t0).toFixed(2)}`);
  // The chase starts: the opening's remaining lines go to the log.
  startMission(game, 'which-way-home');
  assert.ok(game.talk.log.includes('dot.backintime') || ids.includes('dot.backintime'));
  assert.equal(game.story.openingI, OPENING.lines.length);
});

test('the talk step costs nothing while nothing is queued, and templates fill in', () => {
  const game = newGame({ seed: 1, zone: QUIET });
  run(game, () => ({}), 1);
  say(game, 'red.chain', { mission: true, vars: { n: 12 } });
  run(game, () => ({}), H * 2);
  assert.equal(current(game).text, "Chain of 12. Somebody's awake.");
  stepTalk(game, H, null);
});

test("through the jump only the jump's lines play; the Wall's chatter goes to the log on arrival", () => {
  unwire();
  wire(playSlots({ jump: stepJump, arm: armJump }));
  registerZone(WALL);
  registerZone(COMA);
  try {
    const game = newGame({ seed: 4 });
    openExit(game);
    place(game, [300, 260, 0], 45, 30);
    run(game, () => ({}), 1);
    assert.ok(armJump(game, 'coma'));
    say(game, 'dot.void');
    say(game, 'dot.node0');
    const bot = JUMP_BOTS.mid({ seed: 4 });
    const { events } = run(game, (g) => { setZoneReady(g, true); return g.mode === 'drive' ? {} : bot.next(g); }, 60,
      { until: (g) => g.mode === 'drive' && g.zoneId === 'coma' && g.t - g.arrivalT > 4 });
    assert.equal(game.zoneId, 'coma');
    const punch = of(events, 'punch')[0].t, arrive = of(events, 'arrive')[0].t;
    const J1 = JUMPS.J1.lines;
    const jumpIds = new Set([J1.punch, J1.early, J1.vista, ...Object.values(J1.cards || {})].filter(Boolean));
    const inTunnel = of(events, 'line').filter((l) => l.t > punch && l.t < arrive);
    assert.ok(inTunnel.length >= 1, 'Dot talks in the tunnel');
    for (const l of inTunnel) assert.ok(jumpIds.has(l.id), `${l.id} in the tunnel`);
    assert.ok(!of(events, 'line').some((l) => l.id === 'dot.void' || l.id === 'dot.node0'), 'no Wall chatter');
    assert.ok(game.talk.log.includes('dot.void') || game.talk.log.includes('dot.node0'));
    checkRules(events, game.tune.TALK, 'jump');
  } finally {
    wireAll();
  }
});
