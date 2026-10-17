// Ahead of the Light: meta (final.md 13, 14, 21.3): pages count once and unlocks fire at their thresholds, ship
// feats unlock once, REDSHIFT opens step by step, medals and records, EASY LIGHT's offer, and the daily route.
// node qa/ahead-of-the-light/meta.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/meta.js';
import { pagesFor, unlocksAt, nextUnlock, shipUnlocks, applyRun, createMeta, runOptions, dailyFor, dayNumber, medalFor,
  shipTune, logLine, PAGES, ALL_PAGES, UNLOCKS, SHIPS, REDSHIFT_MAX, MEDAL_YEARS }
  from '../../public/ahead-of-the-light/core/meta.js';
import { createRun, openBreak, pick, skip, chooseLane, practiceRun } from '../../public/ahead-of-the-light/core/run.js';
import { CARDS } from '../../public/ahead-of-the-light/core/cards.js';
import { ROUTE } from '../../public/ahead-of-the-light/core/course/legs.js';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import { daySeed } from '../../public/lab/kit/rng.js';

const leg = (type, why, extra = {}) => ({ legNo: ROUTE.indexOf(type), type, lane: null, why, clean: false, years: 50,
  hits: 1, takedowns: 0, beat: [], eaten: [], ...extra });
const log = (legs, extra = {}) => ({ seed: 1, ship: 'lantern', ranked: true, redshift: 0, legs, cards: [],
  trophies: [], takedowns: 0, home: false, legNo: legs.length ? legs[legs.length - 1].legNo : 0, years: 30, ...extra });

test('core/meta.js exports its 18.4 API and imports in plain node', () => {
  for (const name of ['pagesFor', 'unlocksAt', 'shipUnlocks', 'applyRun', 'createMeta', 'dailyFor', 'shipTune']) {
    assert.equal(typeof mod[name], 'function', name);
  }
});

test('the log has 84 pages in four tabs', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, v.length])),
    { PLACES: 24, CARDS: 36, RIVALS: 14, ENDINGS: 10 });
  assert.equal(ALL_PAGES.length, 84);
  assert.equal(new Set(ALL_PAGES).size, 84);
  for (const c of CARDS) assert.ok(ALL_PAGES.includes(`card:${c.id}`));
  assert.equal(UNLOCKS[UNLOCKS.length - 1].at, 84);
});

test('pages count once; unlocks fire at their thresholds', () => {
  let meta = createMeta();
  const run1 = log([leg('web', 'gate', { lane: 'filament' }), leg('coma', 'caught', { lane: 'great-wall',
    eaten: ['moth'], beat: ['pike'] })], { cards: ['afterburner'] });
  const p1 = pagesFor(meta, run1);
  assert.deepEqual(p1, ['lane:filament', 'gate:web', 'lane:great-wall', 'caught:coma', 'eaten:moth', 'beat:pike',
    'card:afterburner']);
  let out = applyRun(meta, run1);
  meta = out.meta;
  assert.deepEqual(out.pages, p1);
  assert.deepEqual(out.unlocks, ['reroll-2'], '6 pages: REROLL +1');
  assert.deepEqual(pagesFor(meta, run1), [], 'the same run earns nothing again');
  out = applyRun(meta, run1);
  assert.deepEqual(out.pages, []);
  assert.equal(out.meta.pages.length, 7);
  assert.deepEqual(out.next, { id: 'banish-1', name: 'BANISH', at: 15, left: 8 });
  // the result card's log line (13, 14.2): what opened, or how far the next unlock is
  assert.equal(logLine(applyRun(createMeta(), run1)), 'LOG +7 PAGES · REROLL +1 UNLOCKED');
  assert.equal(logLine(out), 'LOG +0 PAGES · 8 PAGES TO BANISH');
  assert.equal(logLine({ pages: ['p'], unlocks: [], next: { id: 'lucky-star', name: 'LUCKY STAR', left: 2 } }),
    'LOG +1 PAGE · 2 PAGES TO LUCKY STAR');
  assert.equal(logLine({ pages: ['p'], unlocks: [], next: null }), 'LOG +1 PAGE · LOG FULL');
  assert.equal(logLine(out, true), null, 'a practice run has no log line');
  const before = JSON.stringify(meta);
  applyRun(meta, log([leg('virgo', 'caught', { lane: 'm87' })], { home: false }));
  assert.equal(JSON.stringify(meta), before, 'applyRun never changes the meta it is given');
  for (const u of UNLOCKS) {
    assert.ok(!unlocksAt(u.at - 1).includes(u.id), `${u.id} not at ${u.at - 1}`);
    assert.ok(unlocksAt(u.at).includes(u.id), `${u.id} at ${u.at}`);
  }
  assert.equal(nextUnlock(84), null);
  // rerolls, banishes and LUCKY STAR come from the page count
  const at = (n) => runOptions({ pages: new Array(n).fill('p') });
  assert.deepEqual([at(5).rerolls, at(6).rerolls, at(40).rerolls], [1, 2, 3]);
  assert.deepEqual([at(14).banishes, at(15).banishes, at(55).banishes], [0, 1, 2]);
  assert.deepEqual([at(24).lucky, at(25).lucky], [false, true]);
  assert.equal(createRun({ seed: 1, meta: { pages: new Array(40).fill('p') } }).rerolls, 3);
  // a practice run earns medals but no pages
  assert.deepEqual(pagesFor(createMeta(), { ...run1, practice: true }), []);
  assert.equal(practiceRun({ seed: 1, leg: 2 }).ranked, false);
});

test('ship feats unlock once', () => {
  let meta = createMeta();
  assert.deepEqual(meta.ships, ['lantern']);
  // NEEDLE: a clean leg on leg 3 or later; a clean leg 1 or 2 does not count
  assert.deepEqual(shipUnlocks(meta, log([leg('web', 'gate', { clean: true }), leg('coma', 'gate', { clean: true })])),
    []);
  const clean3 = log([leg('web', 'gate'), leg('coma', 'gate'), leg('virgo', 'gate', { clean: true })]);
  assert.deepEqual(shipUnlocks(meta, clean3), ['needle']);
  meta = applyRun(meta, clean3).meta;
  assert.deepEqual(shipUnlocks(meta, clean3), [], 'once');
  // TUG: 3 takedowns in one run
  assert.deepEqual(shipUnlocks(meta, log([leg('web', 'caught')], { takedowns: 2 })), []);
  const tug = log([leg('web', 'caught')], { takedowns: 3 });
  assert.deepEqual(shipUnlocks(meta, tug), ['tug']);
  meta = applyRun(meta, tug).meta;
  // GHOST: get home
  const home = log(ROUTE.map((t) => leg(t, t === 'earth' ? 'home' : 'gate')), { home: true, legNo: 7 });
  const out = applyRun(meta, home);
  assert.deepEqual(out.ships, ['ghost']);
  assert.deepEqual(out.meta.ships, ['lantern', 'needle', 'tug', 'ghost']);
  assert.deepEqual(applyRun(out.meta, home).ships, []);
  // each ship's numbers ride into its leg's tuning; LANTERN changes nothing
  assert.equal(shipTune('lantern', TUNE), TUNE);
  assert.equal(shipTune('tug', TUNE).HULL_MAX, 5);
  assert.equal(shipTune('tug', TUNE).SLAM_V, 140);
  assert.equal(shipTune('needle', TUNE).HIT_ETA, 0.8);
  assert.equal(shipTune('ghost', TUNE).SHIELD_T, 5);
  assert.equal(shipTune('needle', { ...TUNE, HIT_ETA: 0.7 }).HIT_ETA, 0.7, 'a URL override wins');
  assert.deepEqual(Object.keys(SHIPS), ['lantern', 'needle', 'tug', 'ghost']);
});

test('REDSHIFT opens step by step', () => {
  let meta = createMeta();
  const home = (redshift, extra = {}) => log(ROUTE.map((t) => leg(t, t === 'earth' ? 'home' : 'gate')),
    { home: true, legNo: 7, redshift, ...extra });
  const caught = log([leg('web', 'caught')]);
  assert.equal(applyRun(meta, caught).meta.redshift.open, 0, 'a caught run opens nothing');
  for (let n = 0; n < REDSHIFT_MAX; n++) {
    const out = applyRun(meta, home(n));
    assert.equal(out.redshift, n + 1);
    meta = out.meta;
    assert.equal(meta.redshift.open, n + 1);
    assert.equal(applyRun(meta, home(Math.max(0, n - 1))).redshift, 0, 'a lower level opens nothing new');
  }
  assert.equal(applyRun(meta, home(6)).meta.redshift.open, 6, 'never past step 6');
  let m2 = createMeta();
  m2 = applyRun(m2, home(0, { easy: true })).meta;
  assert.equal(m2.redshift.open, 0, 'EASY LIGHT runs are not ranked');
  // the steps' rules in the leg's tuning
  assert.equal(shipTune('lantern', TUNE, 1).SHIELD_T, 12);
  assert.deepEqual(shipTune('lantern', TUNE, 4).GAP_CAP, TUNE.GAP_CAP.map((c) => c - 1));
  assert.equal(shipTune('lantern', TUNE, 6).LAND_S, TUNE.LAND_S + 2);
  assert.equal(shipTune('lantern', TUNE, 0, true).BLEED, TUNE.BLEED * TUNE.EASY_X);
});

test('medals, records and EASY LIGHT', () => {
  for (const t of ROUTE) {
    const [g, s, b] = MEDAL_YEARS[t];
    assert.ok(g < s && s < b, t);
    assert.equal(medalFor(t, g), 'gold');
    assert.equal(medalFor(t, (g + s) / 2), 'silver');
    assert.equal(medalFor(t, b), 'bronze');
    assert.equal(medalFor(t, b + 1), null);
  }
  let meta = createMeta();
  const fast = log([leg('web', 'gate', { years: 0.5 })]);
  let out = applyRun(meta, fast);
  assert.deepEqual(out.medals, [{ type: 'web', medal: 'gold' }]);
  assert.equal(out.record, true);
  meta = out.meta;
  out = applyRun(meta, log([leg('web', 'gate', { years: 3 })]));
  assert.deepEqual(out.medals, [], 'a worse medal changes nothing');
  assert.equal(out.meta.medals.web, 'gold');
  // records: furthest leg first, then fewer years
  meta = createMeta();
  meta = applyRun(meta, log([leg('web', 'gate'), leg('coma', 'caught')], { legNo: 1, years: 20 })).meta;
  out = applyRun(meta, log([leg('web', 'caught')], { legNo: 0, years: 5 }));
  assert.equal(out.record, false);
  out = applyRun(meta, log([leg('web', 'gate'), leg('coma', 'caught')], { legNo: 1, years: 10 }));
  assert.equal(out.record, true);
  // EASY LIGHT is offered after 3 runs caught on leg 1 or 2, once
  meta = createMeta();
  const early = log([leg('web', 'caught')], { legNo: 0 });
  const offered = [];
  for (let i = 0; i < 5; i++) { out = applyRun(meta, early); meta = out.meta; offered.push(out.easy); }
  assert.deepEqual(offered, [false, false, true, false, false]);
  assert.equal(meta.easy.on, false, 'never automatic');
  assert.equal(meta.runs, 5);
  assert.equal(meta.seen.runs, 5);
});

test('two daily runs on the same date with the same choices match; different dates differ', () => {
  assert.equal(dayNumber('1970-01-01'), 0);
  assert.equal(dayNumber('2026-10-14') - dayNumber('2026-10-13'), 1);
  assert.equal(dayNumber('2027-01-01') - dayNumber('2026-12-31'), 1);
  assert.equal(dayNumber('2024-03-01') - dayNumber('2024-02-28'), 2, 'a leap day');
  const a = dailyFor('2026-10-14'), b = dailyFor('2026-10-15');
  assert.equal(a.seed, daySeed('race', '2026-10-14'));
  assert.notEqual(a.seed, b.seed);
  assert.notEqual(a.ship, b.ship, 'one ship a day, cycling');
  const ships = new Set();
  for (let d = 10; d < 14; d++) ships.add(dailyFor(`2026-10-${d}`).ship);
  assert.equal(ships.size, 4);
  assert.equal(dailyFor('2026-10-14', createMeta()).borrowed, a.ship !== 'lantern');
  const play = (date) => {
    const run = createRun({ daily: date, meta: { pages: [], seen: { runs: 5, offered: true } } });
    for (let i = 0; i < 7; i++) {
      run.leg = i;
      const lane = run.chart[i][run.chart[i].length - 1];
      run.legs.push({ legNo: i, kind: lane.kind, fam: lane.fam, place: 2, offered: [], took: [], lines: [], trophies: [] });
      openBreak(run);
      if (run.offer) pick(run, 0);
      if (run.phase === 'break') skip(run);
      if (i < 6) chooseLane(run, 0);
    }
    return JSON.stringify({ chart: run.chart, build: run.build, legs: run.legs, ship: run.ship, seed: run.seed });
  };
  assert.equal(play('2026-10-14'), play('2026-10-14'));
  assert.notEqual(play('2026-10-14'), play('2026-10-15'));
  const run = createRun({ daily: '2026-10-14' });
  assert.equal(run.daily, '2026-10-14');
  assert.equal(run.ranked, true);
});
