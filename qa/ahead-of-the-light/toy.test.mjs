// Ahead of the Light: THE TOY's bot pass (final.md 24.2, ?toy=30), seeds 1 to 20. The handling half: novice grazes
// by 3.5 s on every seed, whips GOOD or better on 40 % and slingshots on 30 %; mid whips GOOD or better on 75 %,
// slingshots on 70 % and takes REMORA down on 30 %. It is judged with the light held after the 9 s drop (BLEED 0), as
// it was tuned, so a seed the light catches early still shows its handling (contract.md). The light's half runs on
// the live light: it presses to TTC 4 s at 9 s, dodge ends under TTC 4 s, idle is caught before 30 s, and the light
// takes REMORA when you reach 30 s without taking it down (THE LIGHT TOOK REMORA). Also: the stretch is
// well-formed, captions show once each, the toy replays exactly, and accidental grabs (a grab then a latch cancel or
// a WIDE release within 0.6 s) are counted.
// node qa/ahead-of-the-light/toy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as bots from '../../public/ahead-of-the-light/core/bots.js';
import { STEP, createRace, stepRace } from '../../public/ahead-of-the-light/core/race.js';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import {
  createToy, stepToy, toyLeg, toySummary, TOY_CAPTIONS, TOY_S, TOY_TTC0,
} from '../../public/ahead-of-the-light/core/toy.js';
import { KINDS } from '../../public/ahead-of-the-light/core/course/kinds.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const HELD = Object.freeze({ ...TUNE, BLEED: 0 });          // the handling half: the light holds after the drop
const pct = (rows, f) => Math.round((100 * rows.filter(f).length) / rows.length);
const good = (g) => g === 'GOOD' || g === 'PERFECT';

// Play the toy once with a driver (on the live light unless a tune is given). → { game, ev, firstGraze, accidental,
// grabs, ttc9 (TTC just after the 9 s drop) }.
function play(name, seed, { tune = TUNE, ...opts } = {}) {
  const game = createToy({ seed, tune });
  const race = game.race, you = race.ships[0];
  const drive = bots.driverFor(name, { seed, ...opts });
  const ev = [];
  let firstGraze = null, grabT = null, accidental = 0, grabs = 0, ttc9 = null, light9 = null;
  while (race.t < TOY_S && race.real < 90 && race.phase !== 'done' && !you.caught && !you.wrecked) {
    const before = race.t;
    for (const e of stepToy(game, { you: drive(race, you) }, STEP)) {
      ev.push(e);
      if (e.ship !== 'you') continue;
      if ((e.type === 'graze' || e.type === 'hair') && firstGraze === null) firstGraze = e.t;
      if (e.type === 'grab') { grabT = race.real; grabs++; }
      if ((e.type === 'latchCancel' || (e.type === 'release' && e.grade === 'WIDE')) && grabT !== null
        && race.real - grabT <= 0.6) accidental++;
    }
    if (ttc9 === null && before >= 9) { ttc9 = you.ttc; light9 = you.light; }
  }
  return { game, ev, firstGraze, accidental, grabs, ttc9, light9, sum: game.sum || toySummary(game) };
}
const passes = new Map();
const pass = (name, tune = HELD) => {
  const key = `${name}:${tune === HELD ? 'held' : 'live'}`;
  if (!passes.has(key)) passes.set(key, SEEDS.map((seed) => ({ seed, ...play(name, seed, { tune }) })));
  return passes.get(key);
};
const live = (name) => pass(name, TUNE);

// Is survival.js still a stub? (Its light never moves: a second at launch speed leaves the gap where it was.)
const survivalStub = (() => {
  const race = createRace({});
  const g0 = race.ships[0].gap;
  for (let i = 0; i < 120; i++) stepRace(race, null, STEP);
  return race.ships[0].gap === g0;
})();
const LIGHT = survivalStub ? 'survival.js is still a stub (the tune agent completes the light\'s half)' : false;

test('core/bots.js exports its 18.4 API and imports in plain node', () => {
  for (const name of ['playRun', 'driverFor', 'upcoming', 'candidates', 'worth', 'plan']) {
    assert.equal(typeof bots[name], 'function', name);
  }
  for (const d of ['idle', 'dodge', 'graze', 'whipper', 'human']) assert.equal(typeof bots.DRIVERS[d], 'function', d);
  for (const p of ['weak', 'novice', 'mid', 'expert']) assert.ok(bots.PRESETS[p], p);
});

test('the toy is a well-formed 30 s stretch with Coma, a fuel cell, the slam knot and a caption script', () => {
  const leg = toyLeg();
  const items = leg.items;
  assert.ok(Object.isFrozen(leg) && Object.isFrozen(items));
  items.forEach((it, i) => {
    assert.equal(it.id, i);
    assert.ok(KINDS.includes(it.kind), it.kind);
    if (i) assert.ok(it.beat >= items[i - 1].beat, 'in beat order');
  });
  const well = items.find((i) => i.kind === 'well');
  assert.equal(well.size, 'landmark');
  assert.equal(well.exits.length, 2);
  assert.ok(items.some((i) => i.kind === 'pickup' && i.type === 'fuel'));
  assert.ok(items.some((i) => i.tag === 'slam'));
  const wall = items.find((i) => i.kind === 'wall');
  for (const e of well.exits) assert.ok(wall.gaps.some((g) => Math.abs(g.psi - e) < 1), 'the wall\'s gaps lie on the exits');
  // the start: 3 hull, the shield, 2 fuel, the light about 12 s away, REMORA ahead
  const { race } = createToy();
  const you = race.ships[0];
  assert.deepEqual([you.hull, you.shield, you.fuel], [3, 1, 2]);
  assert.ok(Math.abs(you.ttc - TOY_TTC0) < 1e-9);
  assert.equal(race.ships[1].id, 'remora');
  assert.ok(race.ships[1].dist > you.dist);
  for (const c of TOY_CAPTIONS) {
    assert.ok(c.text && c.text.length <= 48 && !c.text.includes('—'), c.text);
    assert.ok(c.t !== undefined || c.on, c.id);
  }
});

test('the toy replays exactly for a seed and a driver', () => {
  const h = (r) => createHash('sha256').update(JSON.stringify(r.ev)).digest('hex');
  assert.equal(h(play('mid', 3)), h(play('mid', 3)));
});

test('novice grazes by 3.5 s on every seed, whips GOOD or better on 40 % and slingshots on 30 %', () => {
  const rows = pass('novice');
  const late = rows.filter((r) => r.firstGraze === null || r.firstGraze > 3.5).map((r) => r.seed);
  assert.deepEqual(late, [], 'seeds with no graze by 3.5 s');
  const g = pct(rows, (r) => good(r.sum.grade)), s = pct(rows, (r) => r.sum.slingshot);
  assert.ok(g >= 40, `GOOD or better on ${g} %`);
  assert.ok(s >= 30, `slingshot on ${s} %`);
});

test('mid whips GOOD or better on 75 %, slingshots on 70 % and takes REMORA down on 30 %', () => {
  const rows = pass('mid');
  const g = pct(rows, (r) => good(r.sum.grade)), s = pct(rows, (r) => r.sum.slingshot);
  const t = pct(rows, (r) => r.sum.takedown);
  assert.ok(g >= 75, `GOOD or better on ${g} %`);
  assert.ok(s >= 70, `slingshot on ${s} %`);
  assert.ok(t >= 30, `REMORA taken down on ${t} %`);
});

test('the toy\'s handling beats land on time for a mid player', () => {
  const rows = pass('mid');
  for (const r of rows) {
    const at = (type) => { const e = r.ev.find((x) => x.ship === 'you' && x.type === type); return e ? e.t : null; };
    const zip = r.firstGraze;
    assert.ok(zip !== null && zip < 2.6, `seed ${r.seed}: first zip at ${zip}`);
    const w = at('window');
    assert.ok(w !== null && w > 10 && w < 13.5, `seed ${r.seed}: Coma's window at ${w}`);
    assert.ok(r.ev.some((e) => e.type === 'burn' && e.ship === 'you' && e.t >= 9 && e.t < 11.5),
      `seed ${r.seed}: a burn as the light presses at 9 s`);
  }
});

test('captions show once each, the first time their moment comes', () => {
  const r = pass('mid')[0];
  const ids = r.game.captions.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'once each');
  assert.equal(ids[0], 'steer');
  assert.equal(r.game.captions[0].t, 0);
  for (const id of ['skim', 'light', 'coma', 'press', 'hold', 'letgo', 'tuck', 'slam']) assert.ok(ids.includes(id), id);
  const light = r.game.captions.find((c) => c.id === 'light');
  assert.ok(light.t >= 9 && light.t < 9.02);
  const desk = createToy({ desk: true });
  assert.equal(desk.captions[0].text, TOY_CAPTIONS[0].desk);
});

test('accidental grabs are counted (critic risk 8): a grab then a latch cancel or a WIDE release within 0.6 s', () => {
  let grabs = 0, accidental = 0;
  for (const name of ['novice', 'mid']) for (const r of pass(name)) { grabs += r.grabs; accidental += r.accidental; }
  assert.ok(grabs > 0);
  assert.ok(accidental / grabs <= 0.1, `${accidental} of ${grabs} grabs were accidental`);
});

test('the light presses to TTC 4 s at 9 s and warns you', { skip: LIGHT }, () => {
  for (const name of ['novice', 'mid', 'dodge']) {
    for (const r of live(name)) {
      if (r.ttc9 === null) continue;                                   // caught before 9 s
      assert.ok(r.ttc9 <= 4 + 1e-6, `${name} seed ${r.seed}: TTC ${r.ttc9.toFixed(2)} at 9 s`);
      // warned (under 6 s): the warning plays at 9 s, unless it already played and has not re-armed
      assert.ok(['warned', 'glare'].includes(r.light9), `${name} seed ${r.seed}: the light is ${r.light9} at 9 s`);
      const warned = r.ev.some((e) => e.type === 'warn' && e.ship === 'you' && e.t <= 9.05);
      assert.ok(warned, `${name} seed ${r.seed}: no warning by 9 s`);
    }
  }
});

test('dodge ends under TTC 4 s', { skip: LIGHT }, () => {
  for (const r of live('dodge')) assert.ok(r.game.race.ships[0].ttc < 4, `seed ${r.seed}: TTC ${r.game.race.ships[0].ttc}`);
});

test('idle is caught before 30 s', { skip: LIGHT }, () => {
  for (const r of live('idle')) assert.ok(r.game.race.ships[0].caught, `seed ${r.seed}`);
});

test('the light takes REMORA if you leave it be: THE LIGHT TOOK REMORA', { skip: LIGHT }, () => {
  const left = [...live('novice'), ...live('mid')].filter((r) => {
    const you = r.game.race.ships[0];
    return r.game.race.t >= TOY_S - 1e-6 && !you.caught && !r.sum.takedown;
  });
  assert.ok(left.length >= 10, `${left.length} plays reach 30 s without a takedown`);
  for (const r of left) {
    const e = r.ev.find((x) => x.type === 'eaten' && x.id === 'remora');
    assert.ok(e && e.t >= 24 && e.t < TOY_S, `seed ${r.seed}: REMORA ${e ? `eaten at ${e.t.toFixed(1)} s` : 'not eaten'}`);
    assert.equal(e.line, e.fedBy === 'you' ? 'FED TO THE LIGHT' : 'THE LIGHT TOOK REMORA');   // a slam of yours feeds it
    assert.ok(r.game.captions.some((c) => c.id === 'took' && c.text === 'THE LIGHT TOOK REMORA'), `seed ${r.seed}`);
  }
});

test('the toy\'s constants are the tuning table\'s', () => {
  assert.equal(TOY_S, 30);
  assert.equal(TUNE.TEACH_SWEEP, 0.5, 'the toy\'s first whip sweeps at half speed');
});
