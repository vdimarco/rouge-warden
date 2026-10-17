// Ahead of the Light: the run, the chart, the offers and the cards (final.md 9, 11.3, 12, 13, 21.3).
// node qa/ahead-of-the-light/run.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/run.js';
import { createRun, startLeg, endLeg, follow, openBreak, breakOf, pick, skip, reroll, banish, chooseLane, resultOf,
  snapshot, restore, RUN_PHASES, RESULT_UNLOCK } from '../../public/ahead-of-the-light/core/run.js';
import { makeChart, chartView, chipOf, chipName, NODES } from '../../public/ahead-of-the-light/core/chart.js';
import { makeOffer, rarityChances, rollRarity, rowFor, baseRow, placeShift, riskRule, poolOf, FIRST_OFFER }
  from '../../public/ahead-of-the-light/core/offer.js';
import { CARDS, CARD, STARTERS, FUSIONS, LEGENDS, TROPHIES, FAMS, CAPS, applyBuild, faceOf, cardState, amountOf,
  fusionFor, legendsReady, tunable, tuneUp, tuneDown } from '../../public/ahead-of-the-light/core/cards.js';
import { causeOf, GOALS, RIVAL_GOALS } from '../../public/ahead-of-the-light/core/log.js';
import { createMeta, applyRun } from '../../public/ahead-of-the-light/core/meta.js';
import { ROUTE, LEG_TYPES, CONDITIONS } from '../../public/ahead-of-the-light/core/course/legs.js';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import { createShip } from '../../public/ahead-of-the-light/core/handle.js';
import { stepRace, STEP, NO_INTENT, E } from '../../public/ahead-of-the-light/core/race.js';
import { driverFor, playRun as botRun } from '../../public/ahead-of-the-light/core/bots.js';
import { mulberry32 } from '../../public/light-years-home/core/rng.js';

const RUN_KEYS = ['v', 'seed', 'daily', 'ship', 'redshift', 'easy', 'ranked', 'leg', 'phase', 'chart', 'lanes', 'you',
  'build', 'pending', 'pity', 'rerolls', 'banishes', 'banned', 'offer', 'dock', 'field', 'used', 'seen', 'legs',
  'streams'];
const SEEN = { pages: [], seen: { runs: 5, offered: true } };       // a player past the teaching runs

// Play a whole run with a bot driver and fixed choices: pick(choice) at each break, lane(choice) on each chart.
// Returns the run and the phases it went through.
// The run machine is under test here, not the handling: STUMBLE 0 keeps a bot that sits on a rail from gliding back
// for ever (contract.md, WP2's rail request), so every leg ends; BLEED 0 and a 99 hull keep the live light and a
// rail's hits from ending the run before Earth.
const RUN_TUNE = Object.freeze({ ...TUNE, STUMBLE: 0, BLEED: 0, HULL0: 99, HULL_MAX: 99, HULL_CAP: 99 });
function playRun(seed, { driver = 'dodge', choose = () => 0, lane = () => 0, maxLegS = 240, meta = null } = {}) {
  const run = createRun({ seed, meta, tune: RUN_TUNE });
  const phases = [run.phase];
  const see = (p) => { if (phases[phases.length - 1] !== p) phases.push(p); };
  for (let leg = 0; leg < 8; leg++) {
    const race = startLeg(run, RUN_TUNE);
    see(run.phase);
    const d = driverFor(driver, { seed: leg + 1 });
    let t = 0;
    while (race.phase !== 'done' && t < maxLegS) {
      stepRace(race, { you: d(race, race.ships[0]) || NO_INTENT }, STEP);
      see(follow(run, race));
      t += STEP;
    }
    if (race.phase !== 'done') break;
    endLeg(run, race);
    see(run.phase);
    if (run.phase !== 'break') break;
    while (run.phase === 'break' && run.offer) {
      const i = choose(run);
      if (i < 0 || !pick(run, i)) { skip(run); break; }
    }
    if (run.phase === 'break') skip(run);
    see(run.phase);
    if (!chooseLane(run, lane(run))) break;
    see(run.phase);
  }
  return { run, phases };
}

// The offers alone: open each break with a made-up leg record (no racing), as the offer sims do.
function offerRun(seed, { kind = 'family', policy = 'random', tune = TUNE, place = () => 2, boss = () => false,
  meta = SEEN, legs = 7 } = {}) {
  const r = mulberry32(seed * 101 + 7);
  const run = createRun({ seed, tune, meta });
  const offers = [];
  for (let leg = 0; leg < legs; leg++) {
    const lanes = run.chart[leg];
    const L = leg === 0 ? lanes[0] : lanes.find((l) => l.kind === kind) || lanes[0];
    run.leg = leg;
    run.legs.push({ legNo: leg, type: ROUTE[leg], lane: L.id, kind: L.kind, fam: L.fam, cond: L.cond, place: place(leg),
      bossBeaten: boss(leg), offered: [], took: [], lines: [], trophies: [], beat: [], eaten: [] });
    openBreak(run, tune);
    if (run.offer) offers.push(JSON.parse(JSON.stringify(run.offer)));
    while (run.phase === 'break' && run.offer) {
      const left = run.offer.cards.map((c, i) => i).filter((i) => !run.offer.taken.includes(i));
      const i = policy === 'first' ? left[0] : left[Math.floor(r() * left.length)];
      if (i === undefined || !pick(run, i)) { skip(run, tune); break; }
    }
    if (run.phase === 'break') skip(run, tune);
    if (leg < legs - 1) chooseLane(run, 0);
  }
  return { run, offers };
}

// A bare race for card hooks: you and one rival, no course.
function fakeRace(build = [], tune = TUNE) {
  const B = applyBuild(build, tune);
  const T = B.tune;
  const you = createShip({ id: 'you', kind: 'you', tune: T });
  const rival = createShip({ id: 'hound', kind: 'regular', type: 'hound', bearing: 30, tune: T });
  const race = { t: 0, real: 0, legNo: 1, leg: { items: [], burnCap: undefined, rules: {} }, ships: [you, rival],
    wells: {}, events: [], log: [], hooks: B.hooks, tune: T, slow: { x: 1, until: 0 }, stop: 0 };
  const run = (point, extra = {}) => {
    const ctx = { race, ship: you, tune: T, event: null, ...extra };
    for (const fn of B.hooks[point] || []) fn(ctx);
    return ctx;
  };
  return { race, you, rival, T, run, B };
}

test('core/run.js exports its 18.4 API and imports in plain node', () => {
  const api = ['createRun', 'startLeg', 'endLeg', 'breakOf', 'pick', 'skip', 'reroll', 'banish', 'chooseLane',
    'resultOf', 'snapshot', 'restore', 'follow', 'openBreak', 'suspend', 'resume', 'practiceRun'];
  for (const name of api) assert.equal(typeof mod[name], 'function', name);
  const run = createRun({ seed: 'KOMAZI' });
  assert.deepEqual(Object.keys(run).sort(), [...RUN_KEYS].sort(), 'the run keeps 18.2\'s keys');
  assert.deepEqual(restore(snapshot(run)), run);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(run))), JSON.stringify(run), 'the run is JSON-safe');
});

test('ships: each starts with its own meters and card; the daily route picks its seed and ship', () => {
  const tug = createRun({ seed: 1, ship: 'tug' });
  assert.deepEqual([tug.you.hull, tug.you.fuel, tug.you.fuelCap, tug.you.shieldMax], [5, 3, 5, 1]);
  const needle = createRun({ seed: 1, ship: 'needle' });
  assert.deepEqual(needle.build, [{ id: 'hair-trigger', r: 0 }]);
  assert.deepEqual([needle.you.hull, needle.you.fuel, needle.you.fuelCap], [2, 1, 3]);
  const ghost = createRun({ seed: 1, ship: 'ghost' });
  assert.deepEqual([ghost.you.hull, ghost.you.shieldMax], [1, 2]);
  const race = startLeg(needle);
  assert.equal(race.ships[0].half, 2.5);
  assert.equal(race.ships[0].turnMax, 700);
  assert.equal(race.tune.HIT_ETA, 0.8);
  assert.equal(race.tune.HAIR, 3.5, 'NEEDLE\'s HAIR TRIGGER is in its build');
  const a = createRun({ daily: '2026-10-14' }), b = createRun({ daily: '2026-10-14' });
  assert.equal(a.seed, b.seed);
  assert.equal(a.ship, b.ship);
  assert.equal(createRun({ seed: 'X' }).ship, 'lantern');
});

test('the state machine: launch → leg → gate → vista → break → chart → launch, to home', () => {
  const { run, phases } = playRun('MACHINE');
  for (const p of phases) assert.ok(RUN_PHASES.includes(p), p);
  assert.equal(run.phase, 'home', `phases ${phases.join(' ')}`);
  assert.equal(run.legs.length, 8);
  const one = phases.slice(0, 7);
  assert.deepEqual(one, ['launch', 'leg', 'gate', 'vista', 'break', 'chart', 'launch']);
  assert.equal(phases.filter((p) => p === 'break').length, 7, 'a break after legs 1 to 7');
  assert.ok(run.you.earth > 0 && run.you.years <= run.you.earth, 'you aged no more than Earth');
  const res = resultOf(run);
  assert.equal(res.home, true);
  assert.match(res.yearsLine, /^HOME IN \d+ YEARS · EARTH WAITED \d+$/);
  assert.ok(['LIGHTKEEPER', 'NAVIGATOR', 'WAYFINDER', 'DRIFTER'].includes(res.rank));
  assert.equal(chooseLane(run, 0), false, 'no lane after Earth');
  assert.equal(pick(run, 0), false);
});

test('same seed and choices give the same chart, offers and run; another seed differs', () => {
  const a = playRun('SAME', { choose: (r) => r.offer.cards.length - 1, lane: (r) => (r.chart[r.leg + 1].length > 1 ? 1 : 0) });
  const b = playRun('SAME', { choose: (r) => r.offer.cards.length - 1, lane: (r) => (r.chart[r.leg + 1].length > 1 ? 1 : 0) });
  assert.equal(JSON.stringify(a.run), JSON.stringify(b.run));
  for (let s = 1; s <= 20; s++) {
    const x = offerRun(s, { kind: 'risk' }), y = offerRun(s, { kind: 'risk' });
    assert.deepEqual(x.offers, y.offers, `seed ${s}`);
    assert.deepEqual(x.run.build, y.run.build);
  }
  assert.notDeepEqual(makeChart('SAME'), makeChart('OTHER'));
  assert.notDeepEqual(offerRun(1).offers, offerRun(2).offers);
});

test('chart rules (11.3)', () => {
  for (let s = 1; s <= 200; s++) {
    const chart = makeChart(s, TUNE);
    assert.equal(chart.length, ROUTE.length);
    const kinds = chart.map((lanes) => lanes.map((l) => l.kind).sort().join(','));
    assert.deepEqual(kinds, ['fixed', 'family,risk', 'family,risk', 'family,risk,void', 'family,risk', 'family,risk',
      'family,risk', 'long,short']);
    chart.forEach((lanes, i) => {
      const ids = Object.values(LEG_TYPES[ROUTE[i]].lanes).map((l) => l.id).sort();
      assert.deepEqual(lanes.map((l) => l.id).sort(), ids, `leg ${i + 1} has its own lanes`);
      assert.ok(['fixed', 'family', 'long'].includes(lanes[0].kind), 'lane 0 is the plain lane');
      for (const l of lanes) assert.ok(l.tag !== undefined && l.icon);
    });
    const fams = chart.slice(1, 7).map((lanes) => lanes.find((l) => l.kind === 'family').fam);
    assert.deepEqual([...new Set(fams)].sort(), [...FAMS].sort(), `seed ${s}: all four families on legs 2 to 7`);
    for (let i = 1; i < fams.length; i++) assert.notEqual(fams[i], fams[i - 1], `seed ${s}: a family twice in a row`);
    let prev = null;
    chart.forEach((lanes, i) => {
      const conds = lanes.filter((l) => l.cond).map((l) => l.cond);
      assert.equal(conds.length, i < 2 ? 0 : 1, `seed ${s} leg ${i + 1}: one condition from leg 3`);
      for (const l of lanes) if (l.kind === 'void') assert.equal(l.cond, null);
      for (const c of conds) { assert.ok(CONDITIONS[c]); assert.notEqual(c, prev); }
      prev = conds[0] || null;
    });
  }
  const run = createRun({ seed: 3 });
  const v = chartView(run);
  assert.equal(v.nodes.length, 9);
  assert.deepEqual(v.nodes.map((n) => n.name), [...NODES]);
  assert.match(v.launch.line, /^THE LIGHT AT LAUNCH: (\d+ S|\d+ MIN|HOURS)$/);
  assert.equal(makeChart(3)[2].find((l) => l.kind === 'risk').tag, 'PICK 1 OF 4 · RARE+');
  // chip names: 14 characters at most, whole words only
  for (const lanes of makeChart(3)) {
    for (const l of lanes) {
      const c = chipOf(l);
      assert.ok(c.short.length <= 14 && c.short.length > 0, `${l.name} → ${c.short}`);
      assert.ok(!/[ .]$/.test(c.short), `${l.name} → ${c.short} ends on a whole word`);
      for (const w of c.short.split(' ')) assert.ok(l.name.split(' ').includes(w), `${l.name} → ${c.short}`);
    }
  }
  assert.deepEqual(['THE GREAT WALL', 'THE GALACTIC CENTRE', 'ALDEBARAN AND THE HYADES', 'THE ORION NEBULA',
    'THE ASTEROID BELT', 'MARKARIAN\'S CHAIN'].map((n) => chipName(n)),
  ['THE GREAT WALL', 'THE CENTRE', 'THE HYADES', 'ORION NEBULA', 'ASTEROID BELT', 'MARKARIAN\'S']);
});

test('offers never show an owned or banished card; a form for a filled slot says REPLACES', () => {
  for (let s = 1; s <= 60; s++) {
    for (const kind of ['family', 'risk']) {
      const run = createRun({ seed: s, meta: SEEN });
      const r = mulberry32(s);
      for (let leg = 0; leg < 7; leg++) {
        const lanes = run.chart[leg], L = lanes.find((l) => l.kind === kind) || lanes[0];
        run.leg = leg;
        run.legs.push({ legNo: leg, lane: L.id, kind: L.kind, fam: L.fam, place: 1 + (leg % 4), offered: [], took: [],
          lines: [], trophies: [], beat: [], eaten: [] });
        openBreak(run);
        const owned = new Set(run.build.map((b) => b.id));
        const ids = run.offer.cards.map((c) => c.id);
        assert.equal(new Set(ids).size, ids.length, 'no card twice in an offer');
        for (const c of run.offer.cards) {
          assert.ok(!owned.has(c.id), `seed ${s}: owned ${c.id} offered`);
          assert.ok(!run.banned.includes(c.id), `seed ${s}: banished ${c.id} offered`);
          const card = CARD[c.id];
          const filled = card.kind === 'form' && run.build.find((b) => CARD[b.id].kind === 'form'
            && CARD[b.id].fam === card.fam);
          const face = faceOf(c.id, c.r, run.build);
          if (filled) {
            assert.equal(c.replaces, filled.id);
            assert.equal(face.tag, `REPLACES ${CARD[filled.id].name}`);
          } else assert.equal(c.replaces, null);
        }
        if (run.banishes === 0 && leg === 2) run.banishes = 1;
        if (leg === 2) {
          const i = run.offer.cards.findIndex((c) => CARD[c.id].pack === 'starter');
          const gone = run.offer.cards[i].id;
          assert.ok(banish(run, i));
          assert.ok(!run.offer.cards.some((c) => c.id === gone));
        }
        const left = run.offer.cards.map((c, i) => i);
        const i = left[Math.floor(r() * left.length)];
        const before = run.build.length;
        const c = run.offer.cards[i];
        assert.ok(pick(run, i));
        if (CARD[c.id].kind === 'form') {
          assert.equal(run.build.filter((b) => CARD[b.id].kind === 'form' && CARD[b.id].fam === CARD[c.id].fam).length,
            1, 'one form per family');
        } else assert.equal(run.build.length, before + 1);
        if (run.phase === 'break') skip(run);
        if (leg < 6) chooseLane(run, 0);
      }
    }
  }
});

test('a fusion appears in the next offer after both halves, and never before', () => {
  for (const f of FUSIONS) {
    const [a, b] = CARD[f].halves;
    assert.equal(fusionFor(a[0]), f);
    for (const x of a) assert.equal(CARD[x].tag, CARD[b[0]].fam, `${x}'s tag`);
    // both halves at break 1: not yet (fusions from break 2); at break 2: slot 3
    const run = createRun({ seed: 9, meta: SEEN });
    run.build = [{ id: a[0], r: 0 }, { id: b[0], r: 0 }];
    run.legs.push({ legNo: 0, kind: 'fixed', place: 2, offered: [], took: [], lines: [], trophies: [] });
    openBreak(run);
    assert.ok(!run.offer.cards.some((c) => c.id === f), `${f} before break 2`);
    skip(run);
    chooseLane(run, 0);
    run.legs.push({ legNo: 1, kind: 'risk', place: 2, offered: [], took: [], lines: [], trophies: [] });
    openBreak(run);
    const c = run.offer.cards.find((x) => x.id === f);
    assert.ok(c, `${f} at break 2`);
    assert.equal(c.slot, 3);
    assert.equal(c.why, 'special');
    // one half only: never
    const half = createRun({ seed: 9, meta: SEEN });
    half.build = [{ id: a[0], r: 0 }];
    for (let leg = 0; leg < 7; leg++) {
      half.leg = leg;
      half.legs.push({ legNo: leg, kind: 'risk', place: 2, offered: [], took: [], lines: [], trophies: [] });
      openBreak(half);
      assert.ok(!half.offer.cards.some((x) => x.id === f));
      assert.ok(faceOf(b[0], 0, half.build).tag.startsWith('COMPLETES'), 'the partner\'s tag turns to COMPLETES');
      skip(half);
      if (leg < 6) chooseLane(half, 0);
    }
  }
});

test('a legendary only with 3 of its family including a form, from break 4, and never a second one in a run', () => {
  // SKIM: three traits are not enough; a form makes it
  assert.deepEqual(legendsReady([{ id: 'hair-trigger' }, { id: 'still-light' }, { id: 'far-sight' }]), []);
  assert.deepEqual(legendsReady([{ id: 'hair-trigger' }, { id: 'still-light' }, { id: 'scrape' }]), ['cherenkov']);
  assert.deepEqual(legendsReady([{ id: 'slow-orbit' }, { id: 'kick-out' }, { id: 'lensed-lane' }]), [],
    'fusions do not count');
  assert.deepEqual(legendsReady([{ id: 'battering-prow' }, { id: 'hounds-bite' }, { id: 'pikes-door' }]),
    ['pack-leader'], 'trophies count');
  const legs = [];
  for (let leg = 0; leg < 7; leg++) {
    const run = createRun({ seed: 4, meta: SEEN });
    run.build = [{ id: 'hair-trigger', r: 0 }, { id: 'still-light', r: 0 }, { id: 'scrape', r: 0 }];
    run.leg = leg;
    run.legs.push({ legNo: leg, kind: 'family', fam: 'SHIP', place: 2, offered: [], took: [], lines: [], trophies: [] });
    openBreak(run);
    legs.push(run.offer.cards.some((c) => c.id === 'cherenkov'));
  }
  assert.deepEqual(legs, [false, false, false, true, false, false, false].map((x, i) => i >= 3),
    'from break 4 on (each break here is a fresh run, so the first offer of it)');
  // a whole run: never two legendaries, in any build or any offer
  for (let s = 1; s <= 300; s++) {
    for (const kind of ['risk', 'family']) {
      const { run, offers } = offerRun(s, { kind, policy: 'random', tune: { ...TUNE, RISK_PICKS: 3 } });
      assert.ok(run.build.filter((b) => CARD[b.id].kind === 'legend').length <= 1, `seed ${s}`);
      for (const o of offers) assert.ok(o.cards.filter((c) => CARD[c.id].kind === 'legend').length <= 1);
    }
  }
  // a second legendary cannot be picked
  const run = createRun({ seed: 5, meta: SEEN });
  run.build = [{ id: 'lifeboat', r: 0 }];
  run.legs.push({ legNo: 0, kind: 'fixed', place: 2, offered: [], took: [], lines: [], trophies: [] });
  openBreak(run);
  run.offer.cards[0] = { id: 'cherenkov', r: 0, slot: 1, why: 'pool' };
  assert.equal(pick(run, 0), false);
});

test('the first offer ever is HAIR TRIGGER, SLOW ORBIT and AFTERBURNER, all Common', () => {
  const run = createRun({ seed: 1 });
  run.legs.push({ legNo: 0, kind: 'fixed', place: 4, offered: [], took: [], lines: [], trophies: [] });
  openBreak(run);
  assert.deepEqual(run.offer.cards.map((c) => c.id), [...FIRST_OFFER]);
  assert.deepEqual(FIRST_OFFER, ['hair-trigger', 'slow-orbit', 'afterburner']);
  assert.ok(run.offer.cards.every((c) => c.r === 0));
  assert.equal(run.offer.caption, 'PICK ONE · IT CHANGES HOW YOU FLY');
  assert.equal(reroll(run), false, 'the first offer cannot be rerolled');
  pick(run, 2);
  assert.equal(run.seen.offered, true);
  // after it: a normal offer
  const later = createRun({ seed: 1, meta: { pages: [], seen: { offered: true } } });
  later.legs.push({ legNo: 0, kind: 'fixed', place: 2, offered: [], took: [], lines: [], trophies: [] });
  openBreak(later);
  assert.notDeepEqual(later.offer.cards.map((c) => c.id), [...FIRST_OFFER]);
  // teaching: no RIVAL card at break 1 in the first runs
  for (let s = 1; s <= 50; s++) {
    const t = createRun({ seed: s, meta: { pages: [], seen: { runs: 1, offered: true } } });
    t.legs.push({ legNo: 0, kind: 'fixed', place: 2, offered: [], took: [], lines: [], trophies: [] });
    openBreak(t);
    assert.ok(t.offer.cards.every((c) => CARD[c.id].fam !== 'RIVAL'), `seed ${s}`);
  }
});

test('pity: after n Commons the next Rare chance is the row\'s + 4n points; a Rare resets it', () => {
  for (let row = 0; row < 5; row++) {
    for (let n = 0; n <= 6; n++) {
      const [c, r, e] = rarityChances(row, 4 * n);
      const R = TUNE.RARITY[row];
      assert.equal(r, R[1] + Math.min(R[0], 4 * n));
      assert.equal(c + r + e, 100);
    }
  }
  const low = () => 0.001, high = () => 0.999;
  let pity = 0;
  for (let n = 1; n <= 5; n++) {
    const out = rollRarity(0, pity, low);
    assert.equal(out.r, 0);
    pity = out.pity;
    assert.equal(pity, 4 * n);
    assert.deepEqual(rarityChances(0, pity), [75 - 4 * n, 25 + 4 * n, 0]);
  }
  const rare = rollRarity(0, pity, () => (75 - pity + 1) / 100);
  assert.equal(rare.r, 1);
  assert.equal(rare.pity, 0);
  assert.equal(rollRarity(4, 12, high).r, 2);
  assert.equal(rollRarity(0, 0, low, TUNE, 1).r, 1, 'a Rare-only card shows as Rare');
  // the run's pity follows the Commons it was shown
  const { run } = offerRun(11, { legs: 1 });
  assert.equal(typeof run.pity, 'number');
});

test('RISK offers use the next row and are pick 1 of 4, Rare or better (lead item 2)', () => {
  assert.deepEqual(riskRule(TUNE), { four: true, picks: 1 });
  assert.deepEqual(riskRule({ ...TUNE, RISK_PICKS: 3 }), { four: false, picks: 3 });
  for (let b = 1; b <= 7; b++) {
    const run = createRun({ seed: b });
    run.leg = b - 1;
    run.legs.push({ kind: 'risk', place: 2 });
    assert.equal(rowFor(run, b), Math.min(4, baseRow(b) + 1));
    run.legs[0].kind = 'family';
    assert.equal(rowFor(run, b), baseRow(b));
  }
  for (let s = 1; s <= 100; s++) {
    const { offers } = offerRun(s, { kind: 'risk' });
    for (const o of offers.slice(1)) {
      assert.equal(o.risk, true);
      assert.equal(o.cards.length, 4);
      assert.equal(o.picks, 1);
      for (const c of o.cards) if (CARD[c.id].pack === 'starter') assert.ok(c.r >= 1, `seed ${s}: ${c.id} is Common`);
    }
    const legacy = offerRun(s, { kind: 'risk', tune: { ...TUNE, RISK_PICKS: 3 } });
    for (const o of legacy.offers.slice(1)) {
      assert.ok(o.cards.some((c) => c.r >= 1), 'n of 3: at least one Rare or better');
      assert.equal(o.picks, Math.min(3, o.cards.length));
    }
  }
});

test('place sets the rarity row (lead item 5); first place and a beaten boss show 4 cards; a trophy takes the random slot', () => {
  assert.deepEqual([1, 2, 3, 4, 5, null].map(placeShift), [1, 0, 0, -1, -1, 0]);
  const run = createRun({ seed: 2 });
  run.leg = 3;
  for (const [place, row] of [[1, 4], [2, 3], [3, 3], [4, 2]]) {
    run.legs = [{ kind: 'family', place }];
    assert.equal(rowFor(run, 4), row, `place ${place}`);
  }
  run.ship = 'ghost';
  run.legs = [{ kind: 'family', place: 2 }];
  assert.equal(rowFor(run, 4), 4, 'GHOST rolls one row up');
  for (let s = 1; s <= 40; s++) {
    const first = offerRun(s, { place: () => 1, legs: 3 });
    for (const o of first.offers.slice(1)) { assert.equal(o.cards.length, 4); assert.equal(o.bonus, 'first'); }
    const boss = offerRun(s, { place: () => 3, boss: (leg) => leg === 2, legs: 3 });
    assert.equal(boss.offers[2].cards.length, 4);
    assert.equal(boss.offers[2].bonus, 'boss');
    assert.equal(boss.offers[1].cards.length, 3);
  }
  // a trophy: slot 3, always Rare
  const t = createRun({ seed: 6, meta: SEEN });
  t.legs.push({ legNo: 0, kind: 'family', fam: 'SKIM', place: 2, offered: [], took: [], lines: [], trophies: [] });
  t.pending.push({ id: 'hounds-bite', kind: 'trophy' });
  openBreak(t);
  const c = t.offer.cards.find((x) => x.id === 'hounds-bite');
  assert.ok(c);
  assert.equal(c.slot, 3);
  assert.equal(c.why, 'trophy');
  assert.equal(c.r, 1);
  skip(t);
  assert.equal(t.pending.length, 0, 'shown once, then in the pool');
  assert.ok(poolOf(t, 2).includes('hounds-bite'));
});

test('applyBuild respects 12.6\'s caps for every card alone and with every other card', () => {
  assert.equal(applyBuild([], TUNE).tune, TUNE, 'an empty build changes nothing');
  const check = (build, why) => {
    const { tune: T } = applyBuild(build, TUNE);
    assert.ok(T.GRAZE <= CAPS.GRAZE, `${why}: graze ${T.GRAZE}`);
    assert.ok(T.HAIR <= CAPS.HAIR, `${why}: hair ${T.HAIR}`);
    assert.ok(T.SHIELD_MAX <= CAPS.SHIELD_MAX, `${why}: shield`);
    assert.ok(T.FUEL_CAP <= TUNE.FUEL_CAP_MAX && T.HULL_MAX <= TUNE.HULL_CAP, why);
    assert.ok(T.WHIP_GAIN_X * Math.max(1, T.RED_X) <= CAPS.WHIP_X + 1e-9, `${why}: whip × ${T.WHIP_GAIN_X * T.RED_X}`);
    assert.ok(Object.isFrozen(T));
  };
  for (const a of CARDS) {
    for (let r = 0; r < 3; r++) {
      check([{ id: a.id, r }], a.id);
      for (const b of CARDS) if (b !== a) check([{ id: a.id, r }, { id: b.id, r: 2 }], `${a.id} + ${b.id}`);
    }
  }
  check(CARDS.map((c) => ({ id: c.id, r: 2 })), 'every card');
  assert.deepEqual(applyBuild([{ id: 'slingshot-home', r: 0 }]).mods, { gateWell: true });
  // the caps that live in the hooks: STILL LIGHT +2 s at most; STEADY HAND's band 12° at most; BUSSARD 2 cells a leg,
  // 3 with STAR LIFTER
  const still = fakeRace([{ id: 'still-light', r: 2 }]);
  for (let i = 0; i < 100; i++) still.run('hair', { event: { type: 'hair' } });
  assert.equal(still.you.lightHold, 2);
  const steady = fakeRace([{ id: 'steady-hand', r: 2 }], { ...TUNE, GRAZE: 10 });
  steady.you.turnRate = 0;
  for (let i = 0; i < 1000; i++) steady.run('step', { dt: STEP });
  assert.equal(cardState(steady.race).steady, 2, 'the band stops at 12°');
  const scoop = fakeRace([{ id: 'bussard-scoop', r: 2 }]);
  scoop.you.fuel = 0;
  scoop.you.fuelCap = 6;
  for (let i = 0; i < 100; i++) scoop.run('hair', { event: { type: 'hair' } });
  assert.ok(Math.abs(scoop.you.fuel - 2) < 1e-9);
  const both = fakeRace([{ id: 'bussard-scoop', r: 2 }, { id: 'star-lifter', r: 0 }]);
  both.you.fuel = 0;
  both.you.fuelCap = 6;
  for (let i = 0; i < 100; i++) both.run('hair', { event: { type: 'hair' } });
  for (let i = 0; i < 10; i++) both.run('release', { event: { type: 'release', angle: 200, scorched: false, gain: 0.3 } });
  assert.ok(Math.abs(both.you.fuel - 3) < 1e-9, `fuel ${both.you.fuel}`);
});

test('card hooks do what their faces say', () => {
  // HAIR TRIGGER: a hairline adds 2 to the chain (handle adds 1, the card 1)
  let f = fakeRace([{ id: 'hair-trigger', r: 0 }]);
  f.you.chain = 4;
  f.run('hair', { event: { type: 'hair' } });
  assert.equal(f.you.chain, 5);
  assert.equal(f.T.HAIR, 3.5);
  // SCRAPE: a hit by the outer edge with the shield up is a hairline and a shield pop
  f = fakeRace([{ id: 'scrape', r: 0 }]);
  const res = { hit: true, overlap: -1.2, gaps: [], thread: false, tag: null };
  f.run('pass', { item: { id: 7, kind: 'knot', psi: 5, piece: 'swarm' }, res, bearing: 0 });
  assert.equal(res.hit, false);
  assert.equal(res.gaps[0].g, 0);
  assert.equal(f.you.shield, 0);
  assert.ok(f.race.events.some((e) => e.type === E.shieldPop));
  const deep = { hit: true, overlap: -3, gaps: [] };
  f.run('pass', { item: { id: 8, kind: 'knot', psi: 5 }, res: deep, bearing: 0 });
  assert.equal(deep.hit, true, 'too deep, or the shield is down: still a hit');
  // CHERENKOV: chain 15+, a knot touched is a hairline for 10 chain; walls still hit
  f = fakeRace([{ id: 'cherenkov', r: 0 }]);
  f.you.chain = 16;
  const k = { hit: true, overlap: -2, gaps: [] };
  f.run('pass', { item: { id: 1, kind: 'knot', psi: 0 }, res: k, bearing: 1 });
  assert.equal(k.hit, false);
  assert.equal(f.you.chain, 6);
  const w = { hit: true, overlap: -2, gaps: [] };
  f.you.chain = 20;
  f.run('pass', { item: { id: 2, kind: 'wall', gaps: [] }, res: w, bearing: 1 });
  assert.equal(w.hit, true);
  // AFTERBURNER: a hit during a burn costs no speed; a graze in it pays twice
  f = fakeRace([{ id: 'afterburner', r: 1 }]);
  assert.equal(f.T.BURN_S, 1.5);
  f.you.burn.t = 0.5;
  f.you.eta = 1.5;
  f.run('hit', { event: { type: 'hit', cause: 'knot' } });
  assert.ok(Math.abs(f.you.eta - (1.5 + f.T.HIT_ETA)) < 1e-9);
  const c0 = f.you.chain;
  f.run('graze', { event: { type: 'graze' } });
  assert.equal(f.you.chain, c0 + 1);
  // ABLATIVE TANKS, TIDAL FRAME, LIFEBOAT: the damage hook (survival calls it)
  f = fakeRace([{ id: 'ablative-tanks', r: 1 }]);
  f.you.fuel = 2;
  let ctx = f.run('damage', { event: { type: 'hit' }, use: 'hull', amount: 1, cancel: false });
  assert.equal(ctx.cancel, true);
  assert.equal(f.you.fuel, 1);
  ctx = f.run('damage', { event: { type: 'hit' }, use: 'hull', amount: 1, cancel: false });
  assert.equal(ctx.cancel, false, 'under 2 cells the hull pays');
  f = fakeRace([{ id: 'tidal-frame', r: 0 }]);
  assert.equal(f.run('damage', { event: { type: 'redIn' }, use: 'hull', amount: 1, cancel: false }).cancel, true);
  assert.equal(f.run('damage', { event: { type: 'redIn' }, use: 'shield', amount: 1, cancel: false }).cancel, false);
  assert.equal(f.run('damage', { event: { type: 'hit' }, use: 'hull', amount: 1, cancel: false }).cancel, false);
  f = fakeRace([{ id: 'lifeboat', r: 0 }]);
  f.you.hull = 1;
  f.you.shield = 0;
  const half = f.you.half;
  ctx = f.run('damage', { event: { type: 'hit' }, use: 'hull', amount: 1, cancel: false });
  assert.equal(ctx.cancel, true);
  assert.deepEqual([f.you.hull, f.you.shieldMax, f.you.half], [1, 0, half / 2]);
  assert.equal(f.run('damage', { event: { type: 'hit' }, use: 'hull', amount: 1, cancel: false }).cancel, false,
    'the next hit wrecks you');
  // REACTIVE HULL: a pop is a burn's worth of speed, never past the burn cap
  f = fakeRace([{ id: 'reactive-hull', r: 0 }]);
  f.you.eta = 1.2;
  f.run('shieldPop', { event: { type: 'shieldPop' } });
  assert.ok(Math.abs(f.you.eta - 1.6) < 1e-9);
  f.you.eta = 2.5;
  f.run('shieldPop', { event: { type: 'shieldPop' } });
  assert.ok(Math.abs(f.you.eta - TUNE.BURN_CAP) < 1e-9);
  // PHASE HULL: through a rival, a hairline and a stolen half cell
  f = fakeRace([{ id: 'phase-hull', r: 0 }]);
  assert.equal(f.T.PHASE_HULL, 1);
  f.you.fuel = 1;
  f.rival.fuel = 2;
  f.run('rivalPass', { other: f.rival, gap: -2 });
  assert.deepEqual([f.you.fuel, f.rival.fuel], [1.5, 1.5]);
  assert.ok(f.race.events.some((e) => e.type === E.hair && e.other === 'hound'));
  // CLOSE QUARTERS: a rival passed within 2.5° is a hairline
  f = fakeRace([{ id: 'close-quarters', r: 0 }]);
  f.run('rivalPass', { other: f.rival, gap: 1.0 });
  f.run('rivalPass', { other: f.rival, gap: 3.0 });
  assert.equal(f.race.events.filter((e) => e.type === E.hair).length, 1);
  // LEECH LINE: a full wake takes a cell from the ship ahead every 2 s
  f = fakeRace([{ id: 'leech-line', r: 0 }]);
  f.you.draft.lead = 'hound';
  f.you.draft.charge = 1;
  f.you.fuel = 0;
  f.rival.fuel = 3;
  for (let i = 0; i < Math.round(4.05 / STEP); i++) f.run('step', { dt: STEP });
  assert.deepEqual([f.you.fuel, f.rival.fuel], [2, 1]);
  // DIRTY AIR: a ship in your wake for 1 s loses a burn of speed
  f = fakeRace([{ id: 'dirty-air', r: 0 }]);
  f.rival.draft.lead = 'you';
  f.rival.eta = 2;
  for (let i = 0; i < Math.round(1.01 / STEP); i++) f.run('step', { dt: STEP });
  assert.ok(Math.abs(f.rival.eta - 1.6) < 1e-9);
  assert.ok(f.race.events.some((e) => e.type === E.dirtyAir));
  // WRECKER: a takedown repairs 1 hull and brings the shield back
  f = fakeRace([{ id: 'wrecker', r: 0 }]);
  f.you.hull = 1;
  f.you.shield = 0;
  f.run('takedown', { event: { type: 'takedown', by: 'you', victim: 'hound' } });
  assert.deepEqual([f.you.hull, f.you.shield], [2, 1]);
  // PIKE'S DOOR: a ship that rear-ends you loses a burn of speed
  f = fakeRace([{ id: 'pikes-door', r: 1 }]);
  f.rival.eta = 2;
  f.run('contact', { event: { type: 'contact', kind: 'rear', by: 'hound', victim: 'you' } });
  assert.ok(Math.abs(f.rival.eta - (2 - (TUNE.BURN_ETA - TUNE.REAR_ETA))) < 1e-9);
  // MOTH'S DANCE: in the glare a hairline fills a cell
  f = fakeRace([{ id: 'moths-dance', r: 1 }]);
  f.you.fuel = 0;
  f.you.light = 'glare';
  f.run('hair', { event: { type: 'hair' } });
  assert.equal(f.you.fuel, 1);
  // KICK OUT: a burn past 90° of a whip lets go PERFECT at once
  f = fakeRace([{ id: 'kick-out', r: 0 }]);
  f.race.wells.w1 = { holder: 'you' };
  f.you.whip = { well: 'w1', angle: 120, latched: false, red: false, mass: 1 };
  f.you.burn.left = TUNE.BURN_ETA;
  f.run('burn', { event: { type: 'burn' } });
  assert.equal(f.you.whip, null);
  assert.ok(f.race.events.some((e) => e.type === E.release && e.grade === 'PERFECT'));
  // BOUNTY: the nearest named rival wears it; taking it down pays a pick
  f = fakeRace([{ id: 'bounty', r: 1 }]);
  f.run('step', { dt: STEP });
  assert.equal(cardState(f.race).bounty, 'hound');
  f.run('takedown', { event: { type: 'takedown', by: 'you', victim: 'hound' } });
  assert.equal(cardState(f.race).bountyPaid, true);
  assert.equal(amountOf('bounty', 1), 1);
});

test('the arrival: dock, free repair, clean leg, a beaten boss, the VOID and SKIP', () => {
  const arrive = (setup) => {
    const run = createRun({ seed: 'ARRIVE', meta: SEEN });
    const race = startLeg(run);
    const you = race.ships[0];
    race.phase = 'done';
    race.order.push('you');
    setup(run, race, you);
    race.events = [{ t: race.t, type: 'legEnd', ship: 'you', why: 'gate', place: 1 }];
    endLeg(run, race);
    return run;
  };
  let run = arrive((r, race, you) => { you.gate = 'dock'; you.hull = 1; you.stats.hits = 2; });
  assert.equal(run.phase, 'break');
  assert.equal(run.you.hull, 2, 'FREE REPAIR +1');
  assert.deepEqual(run.dock, { free: 1, bought: [] });
  assert.equal(run.you.launchEta, TUNE.LAUNCH_DOCK);
  assert.ok(breakOf(run).dock);
  run = arrive((r, race, you) => { you.gate = 'thread'; you.hull = 2; you.stats.hits = 0; });
  assert.equal(run.you.hull, 3, 'CLEAN LEG +1 hull');
  assert.equal(run.you.launchEta, TUNE.LAUNCH_THREAD);
  assert.equal(run.dock, null);
  run = arrive((r, race, you) => { you.gate = 'past'; you.fuel = 1; you.stats.hits = 0; });
  assert.equal(run.you.fuel, 2, 'CLEAN LEG +1 fuel at full hull');
  const b = breakOf(run);
  assert.match(b.header, /^COMA · LEG 1 OF 8 · YOU AGED \+\d+\.\d YR · 1ST$/);
  assert.match(b.light.line, /^LEAD AT LAUNCH (\d+ S|\d+ MIN|HOURS)$/);
  assert.ok(b.lines.includes('CLEAN LEG +1'));
  // SKIP: +1 fuel, or +1 reroll with full tanks
  const fuel = run.you.fuel, rr = run.rerolls;
  assert.ok(skip(run));
  assert.equal(run.you.fuel, fuel + 1);
  assert.equal(run.phase, 'chart');
  run = arrive((r, race, you) => { you.gate = 'past'; you.fuel = 4; you.stats.hits = 1; });
  skip(run);
  assert.equal(run.rerolls, rr + 1);
  // REROLL: a new offer, once
  run = arrive((r, race, you) => { you.gate = 'past'; you.stats.hits = 1; });
  const before = run.offer.cards.map((c) => c.id).join();
  run.rerolls = 1;
  assert.ok(reroll(run));
  assert.equal(run.rerolls, 0);
  assert.notEqual(run.offer.cards.map((c) => c.id).join(), before);
  assert.equal(reroll(run), false);
  // GHOST cannot dock
  const g = createRun({ seed: 'G', ship: 'ghost', meta: SEEN });
  const gr = startLeg(g);
  gr.phase = 'done';
  gr.ships[0].gate = 'dock';
  gr.events = [{ type: 'legEnd', why: 'gate', place: null }];
  endLeg(g, gr);
  assert.equal(g.dock, null);
  assert.equal(g.legs[0].gate, 'past');
  // TUNE at a dock (9.2): one starter up a rarity, C → R → E; a refund puts it back; one-rarity cards never tune
  const build = [{ id: 'hair-trigger', r: 0 }, { id: 'twin-deflector', r: 0 }, { id: 'spark-gap', r: 0 },
    { id: 'hounds-bite', r: 1 }, { id: 'afterburner', r: 2 }];
  assert.deepEqual(tunable(build), ['hair-trigger', 'twin-deflector']);
  assert.equal(tuneUp(build, 'hair-trigger'), 1);
  assert.equal(amountOf('hair-trigger', build[0].r), 4);
  assert.equal(tuneUp(build, 'twin-deflector'), 2, 'a Rare-only card that rolled Common tunes from Rare to Epic');
  for (const id of ['spark-gap', 'hounds-bite', 'afterburner', 'far-sight']) assert.equal(tuneUp(build, id), null, id);
  assert.equal(tuneDown(build, 'hair-trigger', 0), 0);
  assert.equal(tuneDown(build, 'twin-deflector'), 1);
  assert.equal(faceOf('hair-trigger', build[0].r).num, '3.5');
});

test('the result card: one cause, one goal (13)', () => {
  const rec = (why, end, extra = {}) => ({ why, type: 'virgo', legNo: 2, end: { t: 30, fuel: 0, slowFor: 0, ...end },
    ...extra });
  assert.equal(causeOf(rec('doorstep', {})).goal, GOALS.doorstep);
  const td = causeOf(rec('caught', { takedownBy: 'mako', takedownT: 25 }));
  assert.equal(td.goal, RIVAL_GOALS.mako);
  assert.equal(td.by, 'mako');
  assert.equal(causeOf(rec('wrecked', {}), { gate: 'thread', hullOut: 1 }).goal, GOALS.threadLow);
  assert.equal(causeOf(rec('wrecked', { red: true })).goal, GOALS.red);
  assert.equal(causeOf(rec('wrecked', {})).goal, GOALS.wrecked);
  assert.equal(causeOf(rec('caught', { hitCatch: true, fuel: 2 })).goal, GOALS.glareFuel);
  const dry = causeOf(rec('caught', { hitCatch: true, fuel: 0 }));
  assert.equal(dry.goal, GOALS.glareDry);
  assert.equal(dry.line, 'Hit in the glare with no fuel left');
  assert.equal(causeOf(rec('caught', { t: 9 }), { gate: 'dock', bought: 2 }).goal, GOALS.dock);
  assert.equal(causeOf(rec('caught', { slowFor: 11 })).goal, GOALS.slow);
  assert.equal(causeOf(rec('caught', { piece: 'dust-road', slowFor: 11 })).place, 'IN THE DUST');
  const run = createRun({ seed: 'R' });
  run.legs = [{ legNo: 0, type: 'web', why: 'gate', beats: 96, dist: 96, years: 2, took: [], end: {} },
    { legNo: 1, type: 'coma', why: 'gate', beats: 120, dist: 120, took: [], end: {} },
    { legNo: 2, type: 'virgo', why: 'caught', beats: 128, dist: 115, took: [], end: { t: 40, fuel: 0, hitCatch: true } }];
  run.leg = 2;
  run.phase = 'caught';
  const r = resultOf(run, { records: { best: { home: false, legNo: 3, years: 20 } } });
  assert.equal(r.title, 'THE LIGHT CAUGHT YOU');
  assert.equal(r.where, 'VIRGO · LEG 3 OF 8 · 31 % HOME');
  assert.equal(r.cause, 'Hit in the glare with no fuel left');
  assert.equal(r.goal, 'NEXT TIME: FUEL SITS AT THE GAP EDGES');
  assert.equal(r.best, 'BEST: THE LOCAL GROUP');
  assert.equal(r.unlock, RESULT_UNLOCK);
  assert.equal(RESULT_UNLOCK, 0.9, '16: the result card takes input at 0.9 s');
  // the log line previews applyRun on the meta from before the run, and leaves that meta alone
  const meta = createMeta();
  const was = JSON.stringify(meta);
  const withLog = resultOf(run, meta);
  assert.match(withLog.log, /^LOG \+\d+ PAGES? · /);
  assert.equal(JSON.stringify(meta), was);
  const applied = applyRun(meta, withLog.summary);
  assert.equal(resultOf(run, applied.meta, TUNE, applied).log, withLog.log, 'the same line once the page applied it');
  assert.equal(resultOf(run).log, null, 'no meta, no log line');
});

test('every card\'s face fits 14 and 68 characters; there are 36 cards', () => {
  assert.equal(CARDS.length, 36);
  assert.equal(STARTERS.length, 22);
  assert.equal(FUSIONS.length, 6);
  assert.equal(LEGENDS.length, 4);
  assert.equal(TROPHIES.length, 4);
  for (const f of FAMS) {
    const forms = STARTERS.filter((id) => CARD[id].fam === f && CARD[id].kind === 'form').length;
    assert.equal(forms, f === 'WELL' ? 1 : 2, `${f} forms`);
  }
  for (const c of CARDS) {
    assert.ok(c.name.length <= 14, c.name);
    for (let r = 0; r < 3; r++) {
      const face = faceOf(c.id, r, []);
      assert.ok(face.text.length <= 68, `${c.id}: ${face.text}`);
      assert.ok(!/\{v\}/.test(face.text));
      assert.ok(!/η|\bls\b/.test(face.text), 'no η or ls on a face');
    }
    assert.ok(c.rule && c.tell, c.id);
    assert.ok(c.patch || c.hooks || c.mods, `${c.id} changes a rule`);
  }
  // values read as 12.3 writes them: a whole number in a row with fractions keeps one decimal
  assert.equal(faceOf('slow-orbit', 2).text, 'Whips sweep 30 % slower: wider windows, gains × 1.0.');
  assert.equal(faceOf('afterburner', 0).num, '1.0');
  assert.equal(faceOf('steady-hand', 0).num, '3');
  assert.equal(faceOf('bussard-scoop', 1).num, '⅙');
  assert.deepEqual(['cherenkov', 'wrecker', 'hounds-bite', 'twin-deflector'].map((id) => faceOf(id, 0).rarity),
    ['LEGENDARY', 'FUSION', 'RARE', 'RARE']);
});

test('a build\'s hooks run inside real legs: HAIR TRIGGER\'s hairlines add 2 to the chain', () => {
  const run = createRun({ seed: 'HOOKED', meta: SEEN });
  run.build = [{ id: 'hair-trigger', r: 2 }];
  const race = startLeg(run);
  const d = driverFor('graze', { seed: 1 });
  let hairs = 0, ok = 0;
  while (race.phase !== 'done' && race.real < 60) {
    const before = race.ships[0].chain;
    const ev = stepRace(race, { you: d(race, race.ships[0]) || NO_INTENT }, STEP);
    const h = ev.filter((e) => e.type === 'hair' && e.ship === 'you').length;
    const g = ev.filter((e) => (e.type === 'graze' || e.type === 'rivalGraze' || (e.type === 'thread' && e.pair))
      && e.ship === 'you').length;
    const broke = ev.some((e) => e.type === 'chainEnd' && e.ship === 'you');
    if (h && !broke) { hairs += h; if (race.ships[0].chain === before + 2 * h + g) ok += h; }
  }
  assert.ok(hairs > 5, `${hairs} hairlines`);
  assert.equal(ok, hairs);
  assert.equal(race.tune.HAIR, 4.5);
});

test('each leg\'s cap holds from its launch: the gap a gate leaves you, and every rival, is at most the next cap', () => {
  for (const seed of [1, 2, 3]) {
    const r = botRun({ seed, driver: 'mid', legs: 1, keep: true });
    assert.equal(r.run.phase, 'break', `seed ${seed} reached the first break`);
    const cap = TUNE.GAP_CAP[1];
    assert.ok(r.run.you.gap <= cap + 1e-9, `seed ${seed}: your gap ${r.run.you.gap} over leg 2's cap ${cap}`);
    for (const [id, f] of Object.entries(r.run.field.rivals)) {
      assert.ok(f.gap <= cap + 1e-9, `seed ${seed}: ${id}'s gap ${f.gap} over the cap`);
    }
    const b = breakOf(r.run, TUNE);
    assert.match(b.light.line, /^LEAD AT LAUNCH (\d+ S|\d+ MIN|HOURS)$/);
  }
});
