// Ahead of the Light: rivals and bosses (final.md 10; 21.3's rivals line, every part of it), plus the field on the
// grid, the leg-1 drifter, the Nemesis and the standings.
// node qa/ahead-of-the-light/rivals.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import * as mod from '../../public/ahead-of-the-light/core/rivals.js';
import { bossStep } from '../../public/ahead-of-the-light/core/bosses.js';
import { stepLight } from '../../public/ahead-of-the-light/core/survival.js';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import { createRace, stepRace, STEP, NO_INTENT, emit } from '../../public/ahead-of-the-light/core/race.js';
import { createRun, startLeg } from '../../public/ahead-of-the-light/core/run.js';
import { buildLeg } from '../../public/ahead-of-the-light/core/course/gen.js';
import { ROUTE } from '../../public/ahead-of-the-light/core/course/legs.js';
import { driverFor } from '../../public/ahead-of-the-light/core/bots.js';
import { courseSpeed, beatsPerS } from '../../public/ahead-of-the-light/core/ringmath.js';
import { skimOf } from '../../public/ahead-of-the-light/core/handle.js';
import { wrap } from '../../public/ahead-of-the-light/core/course/kinds.js';

const { ROSTER, pickRegulars, createField, rivalIntents, barkFor, legResult, hazardPast } = mod;
const NOLIGHT = Object.freeze({ ...TUNE, BLEED: 0 });
const rivalsOf = (race) => race.ships.slice(1);

// A run's leg n with its field, the regulars given (or the seed's), on the leg's first lane.
function legRace(seed, legNo, { tune = TUNE, racing = null, setup = null } = {}) {
  const run = createRun({ seed, tune });
  if (racing) run.field.racing = [...racing];
  run.leg = legNo;
  if (setup) setup(run);
  return { run, race: startLeg(run, tune) };
}
// A bare leg (items given, nothing else) with a field made by createField for that leg number.
function fieldRace({ seed = 1, legNo = 3, items = [], regulars = ['pike'], drifters = 0, boss = null, tune = NOLIGHT,
  type = ROUTE[legNo] } = {}) {
  const L = buildLeg({ type, validate: false });
  const its = items.map((it, id) => Object.freeze({ id, ...it }));
  const leg = Object.freeze({ ...L, legNo, items: Object.freeze(its), pickups: Object.freeze([]),
    wells: Object.freeze(its.filter((i) => i.kind === 'well')),
    field: { regulars: regulars.length, drifters, boss } });
  const run = createRun({ seed, tune });
  run.leg = legNo;
  run.field.racing = [...regulars];
  run.field.order = ['you', ...regulars];
  const race = createRace({ run, leg, tune });
  return { run, race, you: race.ships[0], T: tune };
}
function fly(race, drive = null, maxS = 120, each = null) {
  const ev = [];
  const you = race.ships[0];
  while (race.phase !== 'done' && race.real < maxS) {
    const out = stepRace(race, { you: drive ? drive(race, you) || NO_INTENT : NO_INTENT }, STEP);
    for (const e of out) ev.push(e);
    if (each) each(out);
  }
  return ev;
}

test('core/rivals.js exports its 18.4 API and imports in plain node; the roster is 7 named ships and the drifter', () => {
  for (const name of ['pickRegulars', 'createField', 'rivalIntents', 'barkFor', 'legResult']) {
    assert.equal(typeof mod[name], 'function', name);
  }
  for (const id of ['hound', 'pike', 'remora', 'moth', 'whale', 'mako', 'manta', 'drifter']) assert.ok(ROSTER[id], id);
  for (const r of Object.values(ROSTER)) {
    for (const [k, line] of Object.entries(r.barks)) {
      assert.ok(line.replace(/\{[A-Z]+\}/g, 'THREE').length <= TUNE.BARK_CHARS, `${r.id} ${k}: ${line}`);
      const words = line.split(/\s+/).length;
      assert.ok(words >= 1 && words <= 5, `${r.id} ${k}: 2 to 5 words`);
      assert.ok(!line.includes('—'));
    }
  }
  // three race, one waits, fixed by the seed
  for (let s = 1; s <= 30; s++) {
    const a = pickRegulars(s), b = pickRegulars(s);
    assert.deepEqual(a, b);
    assert.equal(a.racing.length, 3);
    assert.ok(!a.racing.includes(a.reserve));
    assert.deepEqual([...a.racing, a.reserve].sort(), ['hound', 'moth', 'pike', 'remora']);
  }
  assert.notDeepEqual(pickRegulars(1), pickRegulars(2));
  assert.deepEqual(createField({}), [], 'a bare leg races alone');
});

test('the field: leg 1 puts the regulars 0.6, 1.2 and 1.8 s ahead with three drifters; later legs keep order and meters', () => {
  const { race } = legRace('GRID', 0);
  const you = race.ships[0], bps = beatsPerS(you.eta);
  const regs = race.ships.filter((s) => s.kind === 'regular');
  assert.deepEqual(regs.map((s) => +(s.dist / bps).toFixed(6)), TUNE.LEG1_GAPS);
  assert.equal(race.ships.filter((s) => s.kind === 'drifter').length, 3);
  for (const s of rivalsOf(race)) {
    assert.equal(s.shield, s.shieldMax);
    assert.equal(s.type, s.kind === 'drifter' ? 'drifter' : s.id, 'a rival\'s type is its roster id');
    if (s.kind === 'regular') assert.equal(s.eta, TUNE.ETA0);
    if (s.kind === 'drifter') {
      assert.ok(s.dist / bps >= TUNE.DRIFT_START[0] - 1e-9 && s.dist / bps <= TUNE.DRIFT_START[1] + 1e-9);
      assert.ok(s.gap >= TUNE.DRIFT_GAP[0] - 1e-9 && s.gap <= TUNE.DRIFT_GAP[1] + 1e-9);
    }
  }
  // leg 3: the order of the last gate, GRID_GAP apart, you in your place; the Nemesis right behind you; a regular at
  // 1 hull docks (hull +2, η 0.8, 1.5 s of gap); every regular starts with RIVAL_FUEL_MIN fuel or more
  const { race: r2 } = legRace('GRID', 2, { racing: ['hound', 'pike', 'remora'], setup: (run) => {
    run.field.order = ['pike', 'you', 'hound', 'remora'];
    Object.assign(run.field.rivals.hound, { hull: 1, gap: 5, fuel: 0 });
    Object.assign(run.field.rivals.remora, { nemesis: true });
  } });
  const at = (id) => +(r2.ships.find((s) => s.id === id).dist / beatsPerS(r2.ships[0].eta)).toFixed(6);
  assert.equal(at('pike'), TUNE.GRID_GAP);
  assert.equal(at('remora'), -TUNE.GRID_GAP, 'the Nemesis lines up right behind you');
  assert.equal(at('hound'), -2 * TUNE.GRID_GAP);
  const h = r2.ships.find((s) => s.id === 'hound');
  assert.deepEqual([h.hull, h.eta, h.gap, h.fuel], [3, TUNE.LAUNCH_DOCK, 5 - TUNE.REPAIR_S, TUNE.RIVAL_FUEL_MIN]);
  assert.equal(r2.ships.find((s) => s.id === 'remora').fuel, TUNE.RIVAL_FUEL_MIN + 1, 'a Nemesis starts with +1 fuel');
  assert.equal(r2.ships.find((s) => s.id === 'pike').eta, TUNE.LAUNCH_THREAD);
  assert.ok(r2.ships.some((s) => s.id === 'whale'), 'the WHALE races leg 3');
  // the VOID has no rivals
  const v = createRun({ seed: 'VOID' });
  v.leg = 3;
  v.lanes[3] = v.chart[3].find((l) => l.kind === 'void');
  assert.equal(startLeg(v, TUNE).ships.length, 1);
  // Earth: MANTA, the bosses you did not beat, your Nemesis, then the regulars: four named at most
  const { race: e } = legRace('EARTH', 7, { racing: ['hound', 'pike', 'moth'], setup: (run) => {
    run.field.bosses = { whale: 'beaten', mako: 'lost', manta: null };
    run.field.rivals.moth.nemesis = true;
    run.field.order = ['pike', 'hound', 'you', 'moth'];
  } });
  assert.deepEqual(rivalsOf(e).filter((s) => s.kind !== 'drifter').map((s) => s.id), ['manta', 'mako', 'moth', 'pike']);
});

test('honesty: every change in a rival\'s η matches its events; every gap change matches course speeds, tows, surges and logged stumbles', () => {
  const T = TUNE;
  let steps = 0;
  for (const [seed, legNo] of [[1, 0], [2, 1], [3, 2], [4, 3], [5, 5], [6, 7]]) {
    const { race } = legRace(seed, legNo, { tune: NOLIGHT });
    const drive = driverFor('mid', { seed });
    const prev = new Map();
    const snap = () => { for (const s of rivalsOf(race)) prev.set(s.id, { eta: s.eta, dist: s.dist, stumble: s.stumble,
      lead: s.draft.lead, tow: s.draft.tow, surgeX: s.surge.x, surgeUntil: s.surge.until, burnT: s.burn.t,
      burnRate: s.burn.rate, skim: skimOf(s), gear: s.gear, breach: s.ai && s.ai.breachLeft > 0, back: s.ai && s.ai.backOff,
      out: s.caught || s.wrecked, push: s.ai ? s.ai.push || 0 : 0 }); };
    snap();
    while (race.phase !== 'done' && race.real < 90) {
      const t0 = race.t;
      const ev = stepRace(race, { you: drive(race, race.ships[0]) || NO_INTENT }, STEP);
      const sdt = race.t - t0;
      steps++;
      for (const s of rivalsOf(race)) {
        const p = prev.get(s.id);
        if (!p || p.out || s.caught || s.wrecked) continue;
        // η: the discrete changes its events report, then the continuous ones its state allows
        let lo = 0, hi = 0, wild = false, burnNow = 0;
        for (const e of ev) {
          const mine = e.ship === s.id;
          if (mine && e.type === 'graze') hi += T.KICK;
          else if (mine && e.type === 'hair') hi += T.KICK_HAIR;
          else if (mine && e.type === 'rivalGraze') hi += T.KICK_RIVAL;
          else if (mine && (e.type === 'release' || e.type === 'slingshot')) hi += e.gain;
          else if (mine && e.type === 'grab') lo -= e.cost;
          else if (mine && e.type === 'latchCancel') hi += T.GRAB_COST;
          else if (mine && e.type === 'hit') lo -= T.HIT_ETA;
          else if (mine && e.type === 'dirtyAir') lo -= e.loss;
          else if (mine && e.type === 'thread') { if (e.pair) hi += T.PAIR_ETA; else wild = true; }
          else if (e.type === 'contact' && e.kind === 'rear' && e.by === s.id) lo -= T.REAR_ETA;
          else if (mine && (e.type === 'burn' || e.type === 'oberth')) {
            burnNow = (e.type === 'oberth' ? T.OBERTH_ETA : T.BURN_ETA) / T.BURN_S;
          }
        }
        const gear = Math.max(p.gear, s.gear);
        const drag = T.DRAG * (1 + T.DRAG_GEAR * gear) * 1.5 + T.MANTA.sailDrag;
        const up = (p.burnT > 0 ? p.burnRate : 0) + burnNow + T.ENGINE + T.WHALE.suction + T.SKIM * Math.max(1, p.skim)
          + (p.breach || s.ai.breachLeft > 0 ? T.WHALE.breachEta / T.WHALE.breachS : 0) + Math.max(p.push, s.ai.push || 0)
          + (ev.some((e) => e.ship === s.id && e.type === 'breach' && !e.soon) ? T.WHALE.breachEta / T.WHALE.breachS : 0);
        const d = s.eta - p.eta;
        const capped = s.eta >= T.RIVAL_ETA_MAX - 1e-9 || s.eta <= T.ETA_MIN + 1e-9;
        if (!wild) {
          const at = `seed ${seed} leg ${legNo} ${s.id} at ${race.t.toFixed(3)}`;
          assert.ok(d <= hi + up * sdt + 1e-9 || capped && d <= 0, `${at}: +${d} unexplained (events ${hi}, steady ${up * sdt})`);
          assert.ok(d >= lo - drag * sdt - 1e-9 || capped, `${at}: ${d} lost (events ${lo})`);
        }
        // the course: course speed × surge × tow × dt, less the stumble's glide (MAKO's back-off is logged)
        if (p.back || s.ai.backOff) continue;
        const base0 = courseSpeed(p.eta, T, false), base1 = courseSpeed(s.eta, T, false);
        const x = (p.surgeUntil > race.t ? p.surgeX : 1) * (p.lead ? p.tow || T.TOW : 1);
        const g = Math.min(p.stumble, sdt);
        const want = (b) => (b * x * sdt - (T.STUMBLE / T.STUMBLE_S) * b * g) / T.BEAT_R;
        const moved = s.dist - p.dist;
        const a = want(base0), b = want(base1);
        assert.ok(moved >= Math.min(a, b) - 1e-4 && moved <= Math.max(a, b) + 1e-4,
          `seed ${seed} leg ${legNo} ${s.id} at ${race.t.toFixed(3)}: moved ${moved}, course says ${a} to ${b}`);
      }
      snap();
    }
  }
  assert.ok(steps > 20000);
});

test('no rival reaches η 3.80 + 1e-9; a stumble moves exactly 1.0 s over 0.4 s', () => {
  let top = 0;
  for (const [seed, legNo] of [[11, 2], [12, 4], [13, 6], [14, 7]]) {
    const { race } = legRace(seed, legNo, { tune: NOLIGHT });
    const drive = driverFor('expert', { seed });
    fly(race, drive, 90, () => { for (const s of rivalsOf(race)) top = Math.max(top, s.eta); });
  }
  assert.ok(top <= TUNE.RIVAL_ETA_MAX + 1e-9, `top ${top}`);
  assert.ok(top > 2.6, `the field does climb (top ${top})`);
  // a rival's stumble: STUMBLE s of its course back over STUMBLE_S
  const { race, T } = fieldRace({ legNo: 1, regulars: ['pike'] });
  const p = race.ships[1];
  p.fuel = 0;
  p.eta = T.ETA0;                                  // cruise: no drag, no engine, no burn
  p.dist = race.ships[0].dist + 5 * beatsPerS(p.eta);   // alone, far ahead: no wake, no tow
  for (let i = 0; i < 120; i++) stepRace(race, null, STEP);
  const twin = { eta: p.eta };
  const d0 = p.dist;
  p.stumble = T.STUMBLE_S;
  for (let i = 0; i < 48; i++) stepRace(race, null, STEP);
  const bps = courseSpeed(twin.eta, T) / T.BEAT_R;
  assert.ok(Math.abs(p.dist - d0 - (0.4 - T.STUMBLE) * bps) < 1e-3, `moved ${p.dist - d0}, want ${(0.4 - T.STUMBLE) * bps}`);
});

// PIKE's block (5.4 and 10.4): you draft PIKE 0.3 s behind at full charge, then pull out (or feint).
function pikeTrial(seed, legNo, plan) {
  const { race, you, T } = fieldRace({ seed, legNo, regulars: ['pike'] });
  const pike = race.ships[1];
  const bps = beatsPerS(T.ETA0);
  pike.dist = 0.3 * bps;
  pike.bearing = pike.target = 0;
  pike.ai.intent.target = 0;
  you.bearing = you.target = 0;
  pike.ai.knobs = { ...pike.ai.knobs, jitterDeg: 0, ramBias: 0 };               // the block alone, no slams
  pike.eta = you.eta = T.ETA0;                                                    // the same speed, as cruising
  pike.fuel = 0;
  for (let i = 0; i < 24; i++) stepRace(race, { you: { target: 0 } }, STEP);    // settle into its wake
  you.dist = pike.dist - 0.3 * beatsPerS(you.eta);                                // 0.3 s behind it, at full charge
  you.draft.charge = 1;
  const t0 = race.t;
  let contact = false;
  while (race.t - t0 < 1.6) {
    const tgt = plan(race.t - t0);
    for (const e of stepRace(race, { you: { target: tgt } }, STEP)) {
      const pair = (e.by === 'you' && e.victim === 'pike') || (e.by === 'pike' && e.victim === 'you');
      if (e.type === 'contact' && pair) contact = true;
    }
  }
  return { blocked: contact, ahead: you.dist > pike.dist, slung: you.stats.slings > 0 };
}

test('PIKE: in Act II a 25° pull-out passes and 20° is blocked; in Act III a 35° pull-out is blocked and a feint crossing 0.15 s after passes (seeds 1 to 20)', () => {
  for (let s = 1; s <= 20; s++) {
    const a25 = pikeTrial(s, 3, () => 25), a20 = pikeTrial(s, 3, () => 20);
    assert.ok(a25.slung && a20.slung, `seed ${s}: both pulled out into a slingshot`);
    assert.ok(!a25.blocked && a25.ahead, `seed ${s}: Act II, 25° should pass`);
    assert.ok(a20.blocked, `seed ${s}: Act II, 20° should be blocked`);
    const b35 = pikeTrial(s, 6, () => 35);
    const feint = pikeTrial(s, 6, (t) => (t < 0.15 ? 15 : -15));
    assert.ok(b35.blocked, `seed ${s}: Act III, 35° should be blocked`);
    assert.ok(!feint.blocked && feint.ahead, `seed ${s}: Act III, the feint should pass`);
  }
});

test('the tow: mid passes a cruising rival from 0.8 s within 6.0 s', () => {
  for (let s = 1; s <= 10; s++) {
    const { race, you, T } = fieldRace({ seed: s, legNo: 0, regulars: ['pike'] });
    const r = race.ships[1];
    r.dist = 0.8 * beatsPerS(T.ETA0);
    r.bearing = r.target = r.ai.intent.target = 0;
    r.ai.knobs = { ...r.ai.knobs, jitterDeg: 0, greed: 0 };
    r.eta = you.eta = T.ETA0;                     // cruising: the same speed, no fuel to burn
    r.fuel = 0;
    const drive = driverFor('mid', { seed: s, draftSkill: 1 });
    let passed = null;
    while (race.t < 8 && passed === null) {
      stepRace(race, { you: drive(race, you) }, STEP);
      if ((you.dist - r.dist) / beatsPerS(you.eta) > T.CONTACT_Z) passed = race.t;
    }
    assert.ok(passed !== null && passed <= 6.0, `seed ${s}: passed at ${passed}`);
  }
});

// The trap (5.5, 10.2): you lead with a rival 0.3 s behind in your wake, and dodge a knot on your line late.
function trapTrial(seed, who, legNo) {
  const T = NOLIGHT, bps = beatsPerS(T.ETA0);
  const K = 1.2 * bps;                             // the knot passes you 1.2 s in
  const { race, you } = fieldRace({ seed, legNo, regulars: [who], items: [{ kind: 'knot', beat: K, psi: 0, half: 3.5 }] });
  const r = race.ships[1];
  r.dist = -0.3 * bps;
  r.bearing = r.target = r.ai.intent.target = 0;
  r.eta = you.eta = T.ETA0;                        // the same speed, so it stays tucked in
  r.fuel = 0;
  r.draft.lead = 'you';                            // already in your wake
  r.draft.charge = 0.5;
  you.bearing = you.target = 0;
  let hit = false;
  while (race.t < 3) {
    const t = (K - you.dist) / beatsPerS(you.eta);                     // seconds until you pass the knot
    for (const e of stepRace(race, { you: { target: t > 0.3 ? 0 : 12 } }, STEP)) {
      if (e.type === 'hit' && e.ship === r.id) hit = true;
    }
  }
  return { hit, drafted: r.stats.slings >= 0 };
}

test('trap: REMORA drafting at 0.3 s hits a knot the leader dodges late in 80 % of seeds; HOUND in CRUISE dodges it in 80 %', () => {
  let remora = 0, hound = 0;
  for (let s = 1; s <= 20; s++) {
    if (trapTrial(s, 'remora', 3).hit) remora++;
    if (!trapTrial(s, 'hound', 0).hit) hound++;
  }
  assert.ok(remora >= 16, `REMORA hit it on ${remora} of 20`);
  assert.ok(hound >= 16, `HOUND dodged it on ${hound} of 20`);
});

// Every rival SLAM in a set of legs: { e (the contact), lean (its lean, or null), race state at the slam }.
function slamsOf(seeds, legs, name = 'mid') {
  const out = [];
  for (const seed of seeds) {
    for (const legNo of legs) {
      const { race } = legRace(seed, legNo, { tune: NOLIGHT });
      const drive = driverFor(name, { seed });
      const leans = [];
      fly(race, drive, 90, (ev) => {
        for (const e of ev) {
          if (e.type === 'lean') {
            leans.push({ ...e, past: e.target === 'you' ? hazardPast(race, race.ships[0], e.side, race.tune) : null });
          }
          if (e.type !== 'contact' || e.kind !== 'slam' || e.by === 'you') continue;
          const r = race.ships.find((s) => s.id === e.by), v = race.ships.find((s) => s.id === e.victim);
          if (r.type === 'whale') continue;                                   // contact with the WHALE is always its SLAM
          if (r.shove && r.shove.by !== v.id && r.shove.slam !== undefined && race.t - r.shove.t0 < 0.3) continue;
          const lean = leans.filter((l) => l.ship === r.id && l.target === v.id && e.t - l.t >= TUNE.LEAN_S - 1e-6
            && e.t - l.t <= 1.2).at(-1) || null;
          out.push({ e, lean, legNo, seed, side: Math.sign(wrap(v.bearing - r.bearing)) || 1,
            pastNow: v.id === 'you' ? hazardPast(race, v, Math.sign(wrap(v.bearing - r.bearing)) || 1, race.tune) : null });
        }
      });
    }
  }
  return out;
}

test('every rival SLAM has a lean at least 0.3 s before it, on the side it comes from', () => {
  const slams = slamsOf([1, 2, 3, 4, 5, 6], [3, 4, 5]);
  assert.ok(slams.length >= 10, `${slams.length} rival slams`);
  for (const s of slams) {
    assert.ok(s.lean, `seed ${s.seed} leg ${s.legNo}: ${s.e.by} slammed ${s.e.victim} at ${s.e.t.toFixed(2)} with no lean`);
    assert.equal(s.lean.side, s.side, 'the lean shows the side it comes from');
  }
});

test('in legs 2 and 3 no rival SLAM on you starts with a hazard within 30° past you, and none in leg 1', () => {
  const early = slamsOf([1, 2, 3, 4, 5, 6, 7, 8], [1, 2]).filter((s) => s.e.victim === 'you');
  assert.ok(early.length >= 2, `${early.length} slams on you in legs 2 and 3`);
  for (const s of early) {
    assert.ok(s.lean && s.lean.past === false, `seed ${s.seed} leg ${s.legNo}: a hazard lay past you as the lean began`);
    assert.equal(s.pastNow, false, `seed ${s.seed} leg ${s.legNo}: a hazard lay past you at the slam`);
  }
  const first = slamsOf([1, 2, 3, 4, 5, 6, 7, 8], [0]);
  assert.equal(first.filter((s) => s.e.victim === 'you').length, 0, 'no rival slams you in leg 1');
});

test('DIRTY AIR\'s speed loss shows as a dirtyAir event', () => {
  const run = createRun({ seed: 'DIRTY', tune: NOLIGHT });
  run.build = [{ id: 'dirty-air', r: 0 }];
  run.leg = 1;
  const race = startLeg(run, NOLIGHT);
  const you = race.ships[0], r = race.ships.find((s) => s.kind === 'regular');
  r.dist = you.dist - 0.3 * beatsPerS(you.eta);
  r.bearing = r.target = r.ai.intent.target = you.bearing;
  r.ai.knobs = { ...r.ai.knobs, jitterDeg: 0, draftSkill: 1 };
  let ev = null, before = null;
  for (let i = 0; i < 360 && !ev; i++) {
    before = new Map(race.ships.map((s) => [s.id, s.eta]));
    for (const e of stepRace(race, { you: { target: you.bearing } }, STEP)) if (e.type === 'dirtyAir') ev = e;
  }
  assert.ok(ev, 'a ship in your wake for 1 s');
  const v = race.ships.find((s) => s.id === ev.ship);
  assert.equal(v.draft.lead === null || v.draft.lead === 'you', true);
  assert.equal(ev.by, 'you');
  assert.ok(Math.abs(ev.loss - TUNE.BURN_ETA) < 1e-9 || v.eta === TUNE.ETA_MIN, `a burn's worth: ${ev.loss}`);
  assert.ok(before.get(v.id) - v.eta >= ev.loss - 0.02, 'the η it lost is the event\'s');
});

// Personalities are judged over whole legs: you (mid) are kept in the race to the gate, hull and gap topped up, so a
// leg is not cut short by your wreck. REMORA's share counts the time a ship is in front of it: 0.08 to 0.8 s ahead
// (a wake's reach) and within 45° (not round the far side of the ring).
test('personalities from leg 4: HOUND rams 1 to 3 a leg; REMORA in a wake 50 % of a leg; MOTH at least twice HOUND\'s hits', () => {
  let legs = 0, rams = 0, mothHits = 0, houndHits = 0, wake = 0, ahead = 0;
  for (let s = 1; s <= 12; s++) {
    for (const legNo of [3, 4]) {
      const { race } = legRace(s, legNo, { tune: NOLIGHT, racing: ['hound', 'remora', 'moth'] });
      const drive = driverFor('mid', { seed: s });
      legs++;
      const you = race.ships[0];
      const rem = race.ships.find((x) => x.id === 'remora');
      fly(race, drive, 90, (ev) => {
        you.hull = you.hullMax;
        you.gap = Math.max(you.gap, 20);
        for (const e of ev) if (e.type === 'contact' && e.kind === 'slam' && e.by === 'hound') rams++;
        if (rem && !rem.caught && !rem.wrecked) {
          const bps = beatsPerS(rem.eta);
          const lead = race.ships.some((o) => o !== rem && !o.caught && !o.wrecked
            && (o.dist - rem.dist) / bps >= TUNE.WAKE_NEAR && (o.dist - rem.dist) / bps <= TUNE.WAKE_FAR
            && Math.abs(wrap(o.bearing - rem.bearing)) <= 45);
          if (lead) { ahead++; if (rem.draft.lead) wake++; }
        }
      });
      mothHits += race.ships.find((x) => x.id === 'moth').stats.hits;
      houndHits += race.ships.find((x) => x.id === 'hound').stats.hits;
    }
  }
  const ramRate = rams / legs;
  assert.ok(ramRate >= 1 && ramRate <= 3, `HOUND rams ${ramRate.toFixed(2)} a leg`);
  assert.ok(wake / ahead >= 0.5, `REMORA rides a wake ${(100 * wake / ahead).toFixed(0)} % of the time a ship is in front of it`);
  assert.ok(mothHits >= 2 * houndHits, `MOTH ${mothHits} hits, HOUND ${houndHits}`);
});

test('bosses: the WHALE cannot be taken down; its bow wave moves a ship 40°/s; a breach gives × 1.3 in its wake', () => {
  const knot = { kind: 'knot', beat: 200, psi: 0, half: 3 };
  const { race, you, T } = fieldRace({ legNo: 2, regulars: [], boss: 'whale', items: [knot] });
  const w = race.ships.find((s) => s.id === 'whale');
  assert.equal(w.half, T.WHALE.half);
  assert.equal(w.turnMax, T.WHALE.turn);
  // a shove into a hazard is no takedown for the WHALE
  w.shove = { v: 100, left: 20, until: race.t + 0.15, by: 'you', t0: race.t, slam: true };
  race.events = [];
  // the bow wave: beside it, 20° off and abreast, a ship drifts away at bowRate
  const bps = beatsPerS(you.eta);
  you.dist = w.dist = 5 * bps;
  w.bearing = w.target = w.ai.intent.target = 0;
  you.bearing = you.target = 20;
  const b0 = you.bearing;
  race.events = [];
  bossStep(race, w, 0.25, T);
  assert.ok(Math.abs(you.bearing - b0 - T.WHALE.bowRate * 0.25) < 1e-9, `moved ${you.bearing - b0}°`);
  assert.ok(race.events.some((e) => e.type === 'bowWave' && e.ship === 'you'));
  // a breach: its song 1 s before, 2 fuel, +0.6 η over 1 s, and the wake tows × 1.3 meanwhile
  const r2 = fieldRace({ legNo: 2, regulars: [], boss: 'whale' });
  const w2 = r2.race.ships.find((s) => s.id === 'whale');
  const y2 = r2.you;
  const breach = [];
  let tow = null, plain = null;
  fly(r2.race, (rc) => {
    // hold you 0.5 s behind it on its line, so you sit in its wake whatever its speed
    y2.eta = w2.eta;
    y2.dist = w2.dist - 0.5 * beatsPerS(y2.eta);
    return { target: w2.bearing };
  }, 8, (ev) => {
    for (const e of ev) if (e.type === 'breach') breach.push(e);
    if (y2.draft.lead === 'whale') { if (w2.ai.breachUntil > r2.race.t) tow = y2.draft.tow; else plain = y2.draft.tow; }
  });
  assert.ok(Math.abs(plain - T.WHALE.tow) < 1e-9, `its wake tows × ${plain}`);
  assert.ok(breach.find((e) => e.soon) && breach.find((e) => !e.soon), 'the song, then the breach');
  assert.ok(Math.abs(breach.find((e) => !e.soon).t - breach.find((e) => e.soon).t - 1) < 0.02);
  assert.ok(Math.abs(tow - T.WHALE.tow * T.WHALE.breachTow) < 1e-9, `tow ${tow}`);
  // contact with it is always its SLAM on you, and your shoves never take it down
  const r3 = fieldRace({ legNo: 2, regulars: [], boss: 'whale', items: [{ kind: 'knot', beat: 3, psi: 30, half: 3 }] });
  const w3 = r3.race.ships.find((s) => s.id === 'whale');
  w3.dist = 3 - 0.1;
  w3.bearing = w3.target = w3.ai.intent.target = 18;
  w3.shove = { v: 400, left: 30, until: r3.race.t + 0.15, by: 'you', t0: r3.race.t, slam: true };
  const ev3 = fly(r3.race, null, 1);
  assert.ok(!ev3.some((e) => e.type === 'takedown' && e.victim === 'whale'));
  // it cannot graze (10.3): knots brushing its 10° half pay it nothing; and its light never takes it (its gap holds)
  const brush = [];
  for (let b = 6; b < 60; b += 3) brush.push({ kind: 'knot', beat: b, psi: (b % 2 ? 1 : -1) * 16, half: 3 });
  const r4 = fieldRace({ legNo: 2, regulars: [], boss: 'whale', items: brush });
  const w4 = r4.race.ships.find((s) => s.id === 'whale');
  w4.gap = 0.5;
  const ev4 = fly(r4.race, () => ({ target: 120 }), 30, () => { w4.bearing = w4.target = w4.ai.intent.target = 0; });
  const mine = ev4.filter((e) => e.ship === 'whale');
  assert.ok(!mine.some((e) => e.type === 'graze' || e.type === 'hair' || e.type === 'rivalGraze'),
    mine.map((e) => e.type).join(','));
  assert.ok(!w4.caught && w4.gap >= 2 - 1e-9, `the WHALE's gap ${w4.gap}`);
});

test('MAKO\'s fin moves to a ship with fewer fuel cells within 1.0 s; it backs off after 2 takedowns', () => {
  const { race, you, T } = fieldRace({ legNo: 5, regulars: ['remora'], boss: 'mako' });
  const m = race.ships.find((s) => s.id === 'mako'), rem = race.ships.find((s) => s.id === 'remora');
  const bps = beatsPerS(you.eta);
  you.dist = 10 * bps;
  m.dist = you.dist - 0.5 * bps;
  rem.dist = you.dist + 0.5 * bps;
  you.fuel = 3;
  rem.fuel = 3;
  const fins = [];
  const step = (s) => {
    for (let i = 0; i < s * 120; i++) for (const e of stepRace(race, { you: { target: 0 } }, STEP)) if (e.type === 'fin') fins.push(e);
  };
  step(1.1);
  assert.equal(m.ai.target, 'you', 'a tie goes to the nearest ship (lead item 8): here you are as near, and first');
  rem.fuel = 1;
  const t0 = race.t;
  step(1.05);
  assert.equal(m.ai.target, 'remora', 'the fin moved to the ship with fewer cells');
  assert.ok(fins.at(-1).target === 'remora' && fins.at(-1).t - t0 <= 1.0 + 1e-9);
  // two takedowns on it: it backs off (and counts as beaten)
  for (let k = 0; k < 2; k++) {
    race.events = [];
    emit(race, 'takedown', m, { by: 'you', victim: 'mako' });
    rivalIntents(race, STEP, race.tune);
  }
  assert.ok(m.ai.backOff, 'it backs off');
  const d0 = m.dist;
  step(2);
  assert.ok(m.dist - d0 < 0, 'it falls back');
  assert.equal(legResult(race).boss.id, 'mako');
});

test('MANTA\'s push is zero while shadowed; its lane shows 1.0 s before it passes; a takedown near the light ends in eaten', () => {
  const { race, you, T } = fieldRace({ legNo: 7, regulars: [], boss: 'manta', tune: TUNE });
  const m = race.ships.find((s) => s.id === 'manta');
  const bps = beatsPerS(you.eta);
  you.gap = 6;
  m.gap = 2;
  m.dist = you.dist - 1.0 * bps;
  m.bearing = m.target = m.ai.intent.target = 0;
  you.bearing = you.target = 40;
  race.events = [];
  bossStep(race, m, STEP, T);
  assert.ok(m.ai.push > 0, 'lit, the light pushes it');
  // a ship behind it within 2 s and 10°: shadowed, no push
  you.dist = m.dist - 1.0 * beatsPerS(m.eta);
  you.bearing = you.target = m.bearing + 4;
  race.events = [];
  bossStep(race, m, STEP, T);
  assert.equal(m.ai.push, 0);
  assert.ok(race.events.some((e) => e.type === 'shadow' && e.on));
  // its lane: a ship it will pass lights 1.0 s before
  const r2 = fieldRace({ legNo: 7, regulars: [], boss: 'manta', tune: NOLIGHT });
  const m2 = r2.race.ships.find((s) => s.id === 'manta'), y2 = r2.you;
  m2.eta = 3.8;
  m2.dist = y2.dist - 2.5 * beatsPerS(y2.eta);
  y2.bearing = y2.target = 60;
  let lane = null, passT = null;
  fly(r2.race, () => ({ target: 60 }), 12, (ev) => {
    for (const e of ev) if (e.type === 'lane' && e.target === 'you' && !lane) lane = e;
    if (passT === null && m2.dist > y2.dist) passT = r2.race.t;
  });
  assert.ok(lane && passT !== null, 'it lit a lane and passed you');
  assert.ok(passT - lane.t >= 1.0 - 0.05, `the lane lit ${(passT - lane.t).toFixed(2)} s before it passed`);
  assert.ok(Math.abs(Math.abs(wrap(lane.psi - 60)) - T.MANTA.laneOff) < 1e-6);
  // a takedown near the light: the sail tears (no push, no floor) and the stumble ends in THE LIGHT TOOK MANTA
  const r3 = fieldRace({ legNo: 7, regulars: [], boss: 'manta', tune: TUNE });
  const m3 = r3.race.ships.find((s) => s.id === 'manta');
  m3.eta = 1.4;
  m3.gap = T.MANTA.floor;
  r3.race.events = [];
  emit(r3.race, 'takedown', m3, { by: 'you', victim: 'manta' });
  emit(r3.race, 'hit', m3, { cause: 'takedown', by: 'you' });
  stepLight(r3.race, m3, r3.race.events, STEP, r3.race.tune);
  rivalIntents(r3.race, STEP, r3.race.tune);
  assert.ok(m3.ai.tornUntil > r3.race.t, 'the sail is torn');
  let eaten = null;
  fly(r3.race, () => ({ target: 90 }), 10, (ev) => {
    for (const e of ev) if (e.type === 'eaten' && e.id === 'manta') eaten = e;
  });
  assert.ok(eaten, 'THE LIGHT TOOK MANTA');
  assert.equal(legResult(r3.race).boss.beaten, true, 'a boss the light takes counts as beaten');
});

test('barks: one per 8 s at most, none in quiet windows, none over 24 characters', () => {
  let total = 0;
  for (const [seed, legNo] of [[1, 0], [2, 1], [3, 2], [4, 3], [5, 5], [6, 7], [7, 1], [8, 4]]) {
    const { race } = legRace(seed, legNo, { tune: NOLIGHT });
    const drive = driverFor('mid', { seed });
    const barks = [], quiet = [], lines = new Set();
    fly(race, drive, 90, (ev) => {
      for (const e of ev) {
        const QUIET = ['hit', 'release', 'thread', 'dock', 'past', 'gateLine', 'caught'];
        if (e.ship === 'you' && QUIET.includes(e.type)) quiet.push(e.t);
        if (e.type === 'bark') barks.push(e);
      }
    });
    const cues = race.leg.items.filter((it) => it.kind === 'cue' && (it.name === 'landmark' || it.name === 'gate'));
    for (let i = 0; i < barks.length; i++) {
      const b = barks[i];
      total++;
      assert.ok(b.text.length <= TUNE.BARK_CHARS, b.text);
      if (i) assert.ok(b.t - barks[i - 1].t >= TUNE.BARK_GAP - 1e-6, `${b.t - barks[i - 1].t} s between barks`);
      assert.ok(!quiet.some((q) => b.t - q >= -1e-9 && b.t - q < TUNE.BARK_QUIET), `a bark ${b.text} in a quiet window`);
      assert.ok(!(legNo === 0 && b.t < TUNE.BARK_START), 'none in the first 20 s of leg 1');
      const key = `${b.speaker}:${b.key}`;
      assert.ok(!lines.has(key), `each line once a leg (${key})`);
      lines.add(key);
      assert.ok(ROSTER[race.ships.find((s) => s.id === b.speaker).type].barks[b.key], 'a line from its roster');
    }
    void cues;
  }
  assert.ok(total >= 8, `${total} barks`);
  assert.equal(barkFor({ ships: [] }, null), null);
});

test('the light takes a drifter before 30 s of leg 1 on every seed; the Nemesis forms and is settled by the rules', () => {
  for (let s = 1; s <= 20; s++) {
    const { race } = legRace(s, 0, { tune: TUNE });
    const mid = driverFor('mid', { seed: s });
    let first = null;
    const you = race.ships[0];
    fly(race, (rc, y) => { y.gap = Math.max(y.gap, 6); y.hull = 3; return mid(rc, y); }, 32, (ev) => {
      for (const e of ev) {
        if (e.type === 'eaten' && race.ships.find((x) => x.id === e.id).kind === 'drifter' && first === null) first = e.t;
      }
    });
    void you;
    assert.ok(first !== null && first < 30, `seed ${s}: first drifter eaten at ${first}`);
  }
  // you take a regular down: it becomes your Nemesis; take it down again: SETTLED
  const { race } = legRace('NEM', 3, { tune: NOLIGHT });
  const r = race.ships.find((s) => s.kind === 'regular');
  const down = () => {
    race.events = [];
    emit(race, 'takedown', r, { by: 'you', victim: r.id });
    rivalIntents(race, STEP, race.tune);
    return race.events;
  };
  assert.ok(down().some((e) => e.type === 'nemesis' && e.id === r.id));
  assert.ok(r.ai.nemesis);
  assert.equal(legResult(race).nemesis, r.id);
  assert.ok(down().some((e) => e.type === 'settled' && e.id === r.id));
  assert.equal(legResult(race).settled, r.id);
  assert.equal(r.ai.nemesis, false);
  assert.ok(!down().some((e) => e.type === 'nemesis'), 'never again this run');
  // nor in a later leg: the run's record carries SETTLED into the next field
  const later = legRace('NEM', 4, { tune: NOLIGHT, racing: ['hound', 'pike', 'remora'], setup: (run) => {
    run.field.rivals.hound = { hull: 3, fuel: 2, gap: 3, alive: true, nemesis: false, settled: true };
  } }).race;
  const h = later.ships.find((x) => x.type === 'hound');
  assert.ok(h && h.ai.settled, 'HOUND is on the grid, settled');
  const ram = (type, fields) => {
    later.events = [];
    emit(later, type, h, fields);
    rivalIntents(later, STEP, later.tune);
    return later.events;
  };
  const ev = [...ram('contact', { kind: 'slam', by: h.id, victim: 'you' }), ...ram('contact', { kind: 'slam', by: h.id,
    victim: 'you' }), ...ram('takedown', { by: h.id, victim: 'you' }), ...ram('takedown', { by: 'you', victim: h.id })];
  assert.ok(!ev.some((e) => e.type === 'nemesis'), 'a ship settled in an earlier leg is never your Nemesis again');
  assert.equal(h.ai.nemesis, false);
});

test('AI time under 1 ms per 120 Hz step for six ships', () => {
  const times = [];
  for (const [seed, legNo] of [[1, 0], [2, 1], [3, 3]]) {
    const { race } = legRace(seed, legNo, { tune: NOLIGHT });
    assert.equal(rivalsOf(race).length >= 4, true);
    const drive = driverFor('dodge', { seed });
    let k = 0;
    while (race.phase !== 'done' && race.real < 40) {
      stepRace(race, { you: drive(race, race.ships[0]) || NO_INTENT }, STEP);
      // the AI part alone, as part 8 runs it: one rival's think a step (the ticks are staggered) and every fast path
      const rs = rivalsOf(race).filter((s) => !s.caught && !s.wrecked);
      if (rs.length) rs[k++ % rs.length].ai.nextTick = 0;
      const t0 = performance.now();
      rivalIntents(race, STEP, race.tune);
      times.push(performance.now() - t0);
    }
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p99 = times[Math.floor(times.length * 0.99)];
  assert.ok(mean < 1, `mean ${mean.toFixed(3)} ms`);
  assert.ok(p99 < 1, `p99 ${p99.toFixed(3)} ms`);
});
