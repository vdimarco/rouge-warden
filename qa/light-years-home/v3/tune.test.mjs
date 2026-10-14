// Light Years Home v3: the tuning table (final.md 6, 18.1). Every TUNE key has a default inside its range, the
// speeds and rates keep their order, and URL overrides parse and clamp. node qa/light-years-home/v3/tune.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNE, RANGES, GROUPS, withOverrides, tunePaths, tuneAt } from '../../../public/light-years-home/core/tune.js';

const isRange = (r) => Array.isArray(r) && r.length === 2 && typeof r[0] === 'number';

// [path, value, range] for every leaf; list keys give one leaf per element.
function leaves(t = TUNE, r = RANGES, prefix = '') {
  const out = [];
  for (const key of Object.keys(t)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const v = t[key], range = r[key];
    if (typeof v === 'number') out.push([path, v, range]);
    else if (Array.isArray(v)) v.forEach((x, i) => out.push([`${path}.${i}`, x, range?.[i]]));
    else out.push(...leaves(v, range || {}, path));
  }
  return out;
}

test('the groups of final.md 4.3 are all there, plus INPUT', () => {
  const want = ['SHIP', 'DRIFT', 'BAR', 'PROX', 'PLANE', 'COLLIDE', 'WELL', 'TOW', 'EDGE', 'CAM', 'FX', 'JUMP', 'RACE',
    'TALK', 'MISSION', 'ZONE', 'INPUT'];
  assert.deepEqual([...GROUPS].sort(), [...want].sort());
  assert.deepEqual(Object.keys(RANGES).sort(), [...want].sort());
});

test('every key is a finite number with a [min, max] range that holds its default', () => {
  const all = leaves();
  assert.ok(all.length > 300, `about 300+ values (has ${all.length})`);
  for (const [path, v, range] of all) {
    assert.ok(Number.isFinite(v), `${path} is a number`);
    assert.ok(isRange(range), `${path} has a range`);
    assert.ok(range[0] <= range[1], `${path}: min ${range[0]} <= max ${range[1]}`);
    assert.ok(v >= range[0] && v <= range[1], `${path}: ${v} inside [${range[0]}, ${range[1]}]`);
  }
});

test('RANGES has the same shape as TUNE, with nothing extra', () => {
  const t = leaves().map(([p]) => p).sort();
  const r = [];
  const walk = (o, prefix) => {
    for (const [key, v] of Object.entries(o)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (isRange(v)) r.push(path);
      else if (Array.isArray(v)) v.forEach((_, i) => r.push(`${path}.${i}`));
      else walk(v, path);
    }
  };
  walk(RANGES, '');
  assert.deepEqual(r.sort(), t);
  assert.equal(tunePaths().length, new Set(tunePaths()).size);
});

test('TUNE and RANGES are frozen all the way down', () => {
  assert.ok(Object.isFrozen(TUNE) && Object.isFrozen(TUNE.SHIP) && Object.isFrozen(TUNE.DRIFT.TIERS));
  assert.ok(Object.isFrozen(TUNE.CAM.portrait) && Object.isFrozen(TUNE.FX.TRAUMA.driftBoost));
  assert.ok(Object.isFrozen(RANGES) && Object.isFrozen(RANGES.SHIP.S_TOP));
  assert.throws(() => { 'use strict'; TUNE.SHIP.S_TOP = 99; });
});

test('lead decisions: S_CRUISE 24, a corridor jump with no ring keys', () => {
  assert.equal(TUNE.SHIP.S_CRUISE, 24);
  for (const gone of ['RING_RATE', 'RING_IN', 'RING_OUT', 'TOUCH_GAIN', 'TOUCH_TC', 'CAM_ROLL_MAX']) {
    assert.equal(TUNE.JUMP[gone], undefined, `JUMP.${gone} belongs to the ring and is gone`);
  }
  for (const key of ['TUBE_R', 'LAT_RATE', 'LAT_IN', 'LAT_OUT', 'SLIDE_X', 'SLIDE_GRIP', 'GRAZE', 'HAIRLINE']) {
    assert.ok(Number.isFinite(TUNE.JUMP[key]), `JUMP.${key}`);
  }
});

test('speeds, rates and thresholds keep their order', () => {
  const S = TUNE.SHIP;
  assert.ok(S.S_CRUISE < S.S_TOP && S.S_TOP < S.S_TOP * S.S_DB_X && S.S_TOP * S.S_DB_X < S.S_BOOST);
  assert.ok(S.S_BOOST <= S.S_CAP && S.PIVOT_S < S.S_CRUISE);
  assert.ok(S.YAW_HI < S.YAW_LO && S.GRIP_HI < S.GRIP_LO && S.STEER_OUT < S.STEER_IN);
  assert.ok(TUNE.DRIFT.AUTO_S < S.S_CRUISE && TUNE.DRIFT.MIN_S < TUNE.DRIFT.AUTO_S);
  for (const list of [TUNE.DRIFT.TIERS, TUNE.DRIFT.DB_DUR, TUNE.DRIFT.TIER_BAR, TUNE.PROX.CHAIN_STEPS,
    TUNE.PROX.CHAIN_MULT, TUNE.JUMP.RUNUP_RINGS, TUNE.JUMP.G_DB, TUNE.CAM.DB_KICK]) {
    for (let i = 1; i < list.length; i++) assert.ok(list[i] > list[i - 1], `${list} rises`);
  }
  assert.ok(TUNE.PROX.HAIRLINE < TUNE.PROX.NEAR && TUNE.PROX.SKIM < TUNE.PROX.SKIM_OFF);
  assert.ok(TUNE.JUMP.ETA_FLOOR < TUNE.JUMP.ETA_ENTRY && TUNE.JUMP.ETA_ENTRY < TUNE.JUMP.ETA_CAP);
  assert.ok(TUNE.JUMP.HAIRLINE < TUNE.JUMP.GRAZE && TUNE.JUMP.GRAZE < TUNE.JUMP.GRAZE_SOFT);
  assert.ok(TUNE.JUMP.GRAZE < TUNE.JUMP.TUBE_R);
  assert.ok(TUNE.RACE.GOLD_X < TUNE.RACE.SILVER_X && TUNE.RACE.SILVER_X < TUNE.RACE.BRONZE_X);
  const G = TUNE.RACE.GATE_R;
  assert.ok(G.needle < G.standard && G.standard < G.wide);
  assert.ok(TUNE.ZONE.FAR_CONE < TUNE.ZONE.FAR_CONE_CRUISE && TUNE.ZONE.FAR_CONE_CRUISE < TUNE.ZONE.SCAN_CONE);
  assert.ok(TUNE.ZONE.RADAR_NEAR < TUNE.ZONE.RADAR && TUNE.ZONE.RADAR < TUNE.ZONE.RADAR_BOOST);
  assert.ok(TUNE.INPUT.STICK_DEAD < TUNE.INPUT.STICK_FULL && TUNE.INPUT.CLIMB_DEAD < TUNE.INPUT.CLIMB_FULL);
  assert.ok(TUNE.INPUT.CLIMB_DEAD > TUNE.INPUT.STICK_DEAD, 'a wandering steering thumb does not pitch');
});

test('the jump length formula gives J2 26 s and J3 25 s (final.md 11.3)', () => {
  const J = TUNE.JUMP;
  const L = (ly) => Math.round(Math.min(J.LEN_MAX, Math.max(J.LEN_MIN, J.LEN_A + J.LEN_B * Math.log10(ly))));
  assert.equal(L(2.72e8), 26);
  assert.equal(L(5.5e7), 25);
  assert.equal(L(4.24), 16, 'short hops stop at the floor');
});

test('each layout kind has the same camera keys', () => {
  const keys = Object.keys(TUNE.CAM.portrait).sort();
  assert.deepEqual(Object.keys(TUNE.CAM.landscape).sort(), keys);
  assert.deepEqual(Object.keys(TUNE.CAM.desktop).sort(), keys);
  assert.equal(TUNE.CAM.portrait.DRIFT_LOOK_IN, 14);
  assert.equal(TUNE.CAM.portrait.SHIP_Y, 0.6);
});

test('URL overrides parse, clamp and report', () => {
  const report = [];
  const t = withOverrides(TUNE, '?bot=idle&tune.SHIP.S_TOP=32&tune.SHIP.S_BOOST=99&tune.DRIFT.TIERS.1=1.7'
    + '&tune.CAM.portrait.FOV=88&tune.JUMP.MEDAL_BAR=0.4,0.7,1,1&tune.NOPE.X=1&tune.SHIP.K_LOW=fast', report);
  assert.equal(t.SHIP.S_TOP, 32);
  assert.equal(t.SHIP.S_BOOST, RANGES.SHIP.S_BOOST[1], 'clamped to the top of its range');
  assert.deepEqual([...t.DRIFT.TIERS], [0.8, 1.7, 2.4]);
  assert.equal(t.CAM.portrait.FOV, 88);
  assert.deepEqual([...t.JUMP.MEDAL_BAR], [0.4, 0.7, 1, 1]);
  assert.equal(t.SHIP.K_LOW, TUNE.SHIP.K_LOW, 'junk leaves the default');
  assert.equal(TUNE.SHIP.S_TOP, 30, 'the base is untouched');
  assert.ok(Object.isFrozen(t) && Object.isFrozen(t.DRIFT.TIERS));
  const by = Object.fromEntries(report.map((r) => [r.path, r]));
  assert.equal(by['SHIP.S_BOOST'].clamped, true);
  assert.equal(by['SHIP.S_TOP'].clamped, false);
  assert.ok(by['NOPE.X'].ignored && by['SHIP.K_LOW'].ignored);
  assert.equal(report.length, 7, 'the bot switch is not a tune key');
});

test('a bare key works when its name is unique, and only then', () => {
  const report = [];
  const t = withOverrides(TUNE, 'tune.S_TOP=31&tune.HAIRLINE=0.5&tune.FOV=80', report);
  assert.equal(t.SHIP.S_TOP, 31);
  assert.equal(t.PROX.HAIRLINE, TUNE.PROX.HAIRLINE, 'HAIRLINE is in PROX, BAR and JUMP: ignored');
  assert.equal(report.filter((r) => r.ignored).length, 2);
});

test('lists need every element; indexes must exist; groups cannot be set', () => {
  const report = [];
  const t = withOverrides(TUNE, 'tune.DRIFT.TIERS=1,2&tune.DRIFT.TIERS.7=1&tune.DRIFT=1&tune.SHIP.S_TOP.0=1', report);
  assert.deepEqual([...t.DRIFT.TIERS], [...TUNE.DRIFT.TIERS]);
  assert.equal(report.filter((r) => r.ignored).length, 4);
});

test('overrides also come as an object (the hook), URLSearchParams or a Map', () => {
  assert.equal(withOverrides(TUNE, { 'SHIP.S_TOP': 33 }).SHIP.S_TOP, 33);
  assert.equal(withOverrides(TUNE, { 'tune.SHIP.S_TOP': '34' }).SHIP.S_TOP, 34);
  assert.equal(withOverrides(TUNE, new URLSearchParams('tune.SHIP.S_TOP=29&x=1')).SHIP.S_TOP, 29);
  assert.equal(withOverrides(TUNE, new Map([['tune.SHIP.S_TOP', '27']])).SHIP.S_TOP, 27);
  assert.equal(withOverrides(TUNE, { 'DRIFT.TIERS': [0.7, 1.5, 2.3] }).DRIFT.TIERS[2], 2.3);
  assert.equal(withOverrides(TUNE, 'tune.SHIP.S_TOP=3%32').SHIP.S_TOP, 32, 'decodes %xx');
  assert.equal(withOverrides(TUNE, ''), TUNE, 'nothing to do gives the same object');
  assert.equal(withOverrides(TUNE, null), TUNE);
  const twice = withOverrides(withOverrides(TUNE, { 'SHIP.S_TOP': 33 }), { 'SHIP.S_BOOST': 45 });
  assert.equal(twice.SHIP.S_TOP, 33);
  assert.equal(twice.SHIP.S_BOOST, 45);
});

test('tuneAt reads by path', () => {
  assert.equal(tuneAt(TUNE, 'SHIP.S_TOP'), 30);
  assert.equal(tuneAt(TUNE, 'DRIFT.TIERS.2'), 2.4);
  assert.equal(tuneAt(TUNE, 'CAM.landscape.DIST'), 6);
  assert.equal(tuneAt(TUNE, 'SHIP.NOPE'), undefined);
  assert.equal(tuneAt(TUNE, 'SHIP.S_TOP.X'), undefined);
});
