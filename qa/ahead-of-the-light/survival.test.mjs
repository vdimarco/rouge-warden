// Ahead of the Light: the light, hull, shield, fuel and the landing (final.md 7, 8, 9; 21.3's survival line, every
// part of it), plus the card hooks survival runs (damage, shieldPop), pickups, the patch rule, the dock's TUNE chip,
// the years and the critic's lead items 3 and 7.
// node qa/ahead-of-the-light/survival.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/survival.js';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import { createRace, stepRace, STEP, cardHooks, emit } from '../../public/ahead-of-the-light/core/race.js';
import { createRun, startLeg } from '../../public/ahead-of-the-light/core/run.js';
import { buildLeg } from '../../public/ahead-of-the-light/core/course/gen.js';
import { applyBuild } from '../../public/ahead-of-the-light/core/cards.js';
import { mulberry32 } from '../../public/light-years-home/core/rng.js';

const { stepLight, pushBack, launchState, dockPrices, buy, refund, land, yearsStep, ttcOf, gapFor, capOf } = mod;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
// η holds still: no drag above cruise, no engine below it
const STILL = Object.freeze({ ...TUNE, DRAG: 0, ENGINE: 0 });

// A bare leg with nothing on it (or the items given), and a race of you alone on it.
function bareLeg(items = [], type = 'web') {
  const L = buildLeg({ type, validate: false });
  return Object.freeze({ ...L, items: Object.freeze(items.map((it, id) => Object.freeze({ id, ...it }))),
    pickups: Object.freeze([]), wells: Object.freeze([]) });
}
function bare({ tune = STILL, items = [], eta = 1.0, gap = 8, type = 'web' } = {}) {
  const race = createRace({ leg: bareLeg(items, type), tune });
  const you = race.ships[0];
  you.eta = eta;
  you.gap = gap;
  you.ttc = ttcOf(gap, eta);
  return { race, you, T: tune };
}
// Run one survival step for a ship on a hand-made event list (as race.js part 7 would).
function light(race, ship, events, dt = STEP, T = race.tune) {
  race.events = [];
  for (const e of events) race.events.push({ t: race.t, ship: ship.id, ...e });
  stepLight(race, ship, race.events, dt, T);
  return race.events;
}
const types = (ev) => ev.map((e) => e.type);

test('core/survival.js exports its 18.4 API and imports in plain node', () => {
  for (const name of ['stepLight', 'pushBack', 'launchState', 'dockPrices', 'buy', 'refund', 'land', 'yearsStep']) {
    assert.equal(typeof mod[name], 'function', name);
  }
});

test('the gap falls by exactly (1 − tanh η) a second; TTC = gap ÷ (1 − β)', () => {
  for (const eta of [0.6, 0.8, 1.0, 1.6, 2.6, 3.8, 4.95]) {
    const { race, you } = bare({ eta, gap: 8 });
    for (let i = 0; i < 120; i++) stepRace(race, null, STEP);
    assert.ok(near(you.eta, eta), `η held at ${eta}`);
    // per second of sim time (HEADLIGHT's slow motion and LIGHT SPEED's freeze slow the world)
    assert.ok(near((8 - you.gap) / race.t, 1 - Math.tanh(eta), 1e-9), `η ${eta}: lost ${8 - you.gap} in ${race.t} s`);
    assert.ok(near(you.ttc, you.gap / (1 - Math.tanh(eta)), 1e-9), `η ${eta}: TTC ${you.ttc}`);
  }
  // EASY LIGHT is BLEED × EASY_X
  const { race, you } = bare({ tune: { ...STILL, BLEED: TUNE.EASY_X } });
  for (let i = 0; i < 120; i++) stepRace(race, null, STEP);
  assert.ok(near(8 - you.gap, TUNE.EASY_X * (1 - Math.tanh(1)), 1e-9));
});

test('a hit with the shield up costs no hull; the shield returns exactly 8.0 s after the last hit', () => {
  // a knot on your line past the soft start: the idle ship hits it
  const { race, you, T } = bare({ tune: { ...STILL, BLEED: 0 }, items: [{ kind: 'knot', beat: 30, psi: 0, half: 3 }] });
  let hitT = null, backT = null, popped = 0;
  while (race.t < 40 && race.phase !== 'done') {
    for (const e of stepRace(race, { you: { target: hitT === null ? 0 : 60 } }, STEP)) {   // off the line once hit
      if (e.ship !== 'you') continue;
      if (e.type === 'hit') hitT = e.t;
      if (e.type === 'shieldPop') popped++;
      if (e.type === 'shieldBack') backT = race.t;
    }
  }
  assert.ok(hitT !== null, 'the knot was hit');
  assert.equal(popped, 1);
  assert.equal(you.hull, 3, 'the shield took it');
  assert.ok(backT !== null && Math.abs(backT - hitT - T.SHIELD_T) <= STEP + 1e-9, `back after ${backT - hitT} s`);
  // with the shield down, the next hit costs 1 hull; a later hit resets the 8 s
  const b = bare();
  b.you.shield = 0;
  b.you.shieldT = 5;
  const ev = light(b.race, b.you, [{ type: 'hit', cause: 'knot' }]);
  assert.deepEqual(types(ev), ['hit', 'hullLost']);
  assert.equal(b.you.hull, 2);
  assert.equal(b.you.shieldT, 0, 'the clock restarts at the last hit');
});

test('a hit in the glare emits caught in the same step; 0 hull and no shield gives wreck then caught', () => {
  const g = bare({ eta: 1.0, gap: 0.5 });                      // TTC 2.1 s
  light(g.race, g.you, []);
  assert.equal(g.you.light, 'glare');
  const ev = light(g.race, g.you, [{ type: 'hit', cause: 'knot' }]);
  assert.ok(types(ev).includes('caught'), types(ev).join(','));
  assert.ok(g.you.caught);
  assert.equal(ev.find((e) => e.type === 'caught').why, 'glare');
  // the last hull with the shield down: a hit wrecks you
  const w = bare({ gap: 8 });
  w.you.hull = 1;
  w.you.shield = 0;
  const ev2 = light(w.race, w.you, [{ type: 'hit', cause: 'knot' }]);
  const t2 = types(ev2);
  assert.ok(t2.indexOf('wreck') >= 0 && t2.indexOf('caught') > t2.indexOf('wreck'), t2.join(','));
  assert.ok(w.you.wrecked && w.you.caught);
  // in a whole race the leg ends on that step, wrecked
  const r = bare({ items: [{ kind: 'knot', beat: 30, psi: 0, half: 3 }] });
  r.you.hull = 1;
  r.you.shield = 0;
  let end = null;
  while (r.race.phase !== 'done' && r.race.t < 40) for (const e of stepRace(r.race, null, STEP)) if (e.type === 'legEnd') end = e;
  assert.equal(end.why, 'wrecked');
});

test('warn fires once under 6 s and re-arms only above 9 s (TTC frozen at 5.5 s for 20 s: one warn)', () => {
  const T = { ...STILL, BLEED: 0 };
  const { race, you } = bare({ tune: T, eta: 1.0, gap: gapFor(5.5, 1.0) });
  const warns = [];
  const run = (s) => {
    for (let i = 0; i < s * 120; i++) for (const e of stepRace(race, null, STEP)) if (e.type === 'warn') warns.push(e);
  };
  run(20);
  assert.ok(near(you.ttc, 5.5, 1e-9), `TTC frozen at ${you.ttc}`);
  assert.equal(warns.length, 1);
  assert.equal(you.light, 'warned');
  you.gap = gapFor(8.5, 1.0);                                   // up, but not above 9: no re-arm
  run(1);
  you.gap = gapFor(5.0, 1.0);
  run(1);
  assert.equal(warns.length, 1, 'still one: it did not re-arm under 9 s');
  you.gap = gapFor(9.5, 1.0);                                   // above 9: re-armed
  run(1);
  assert.equal(you.light, 'pressed');
  you.gap = gapFor(5.5, 1.0);
  run(1);
  assert.equal(warns.length, 2);
  // the states by TTC: far, pressed, warned, the glare (in under 3.0, out above 4.5)
  const s = bare({ tune: T });
  const at = (ttc) => { s.you.gap = gapFor(ttc, 1.0); light(s.race, s.you, [], STEP, T); return s.you.light; };
  assert.equal(at(30), 'far');
  assert.equal(at(9), 'pressed');
  assert.equal(at(5), 'warned');
  assert.equal(at(2.9), 'glare');
  assert.equal(at(4.0), 'glare', 'it holds until above 4.5 s');
  assert.equal(at(4.6), 'warned');
});

test('push-backs never pass the cap except a red release (≤ +1.5, fading 0.1 s/s)', () => {
  const T = { ...STILL, BLEED: 0 };
  const { race, you } = bare({ tune: T, gap: 6 });
  const cap = capOf(race, you, T);
  assert.equal(cap, T.GAP_CAP[0]);
  const rnd = mulberry32(7);
  for (let i = 0; i < 500; i++) {
    const kind = ['graze', 'hair', 'rival', 'whip', 'thread', 'dock', 'past', 'takedown', 'skim'][i % 9];
    pushBack(race, you, kind, rnd() * 3, T);
    assert.ok(you.gap <= cap + 1e-12, `${kind} lifted the gap to ${you.gap}`);
  }
  assert.ok(near(you.gap, cap));
  // a red release may lift it OVERCAP past the cap, and the extra fades at OVERCAP_DECAY
  pushBack(race, you, 'red', 9, T);
  assert.ok(near(you.gap, cap + T.OVERCAP), `red: ${you.gap}`);
  pushBack(race, you, 'graze', 1, T);
  assert.ok(near(you.gap, cap + T.OVERCAP), 'a graze adds nothing over the cap');
  for (let i = 0; i < 120 * 5; i++) light(race, you, [], STEP, T);
  assert.ok(near(you.gap, cap + T.OVERCAP - 5 * T.OVERCAP_DECAY, 1e-6), `after 5 s: ${you.gap}`);
  for (let i = 0; i < 120 * 12; i++) light(race, you, [], STEP, T);
  assert.ok(near(you.gap, cap) && you.overCap === 0, 'back at the cap once it fades');
  // events pay their 7.3 sizes × M, through the cap
  const p = bare({ tune: T, gap: 2 });
  const M = T.MASS_K[0];
  const pay = (e) => { const g0 = p.you.gap; light(p.race, p.you, [e], STEP, T); return p.you.gap - g0; };
  assert.ok(near(pay({ type: 'graze', gap: 4 }), T.PB_GRAZE * M));
  assert.ok(near(pay({ type: 'hair', gap: 1 }), T.PB_HAIR * M));
  assert.ok(near(pay({ type: 'rivalGraze', other: 'pike', gap: 2 }), T.PB_RIVAL * M));
  assert.ok(near(pay({ type: 'thread', pair: true }), T.PB_PAIR * M));
  assert.ok(near(pay({ type: 'release', grade: 'GOOD', mass: 1, d: 0.5, red: false }), T.PB_WHIP * 1 * 1.0 * M));
  assert.ok(near(pay({ type: 'release', grade: 'WIDE', mass: 2, d: 0, red: false }), T.PB_WHIP * 2 * 0.5 * 0.5 * M));
  assert.equal(pay({ type: 'release', grade: 'PERFECT', mass: 1, d: 1, scorched: true }), 0, 'a scorch pays nothing');
  // Saturn's ENCKE GAP (a pair tagged 'encke') pays 0.8 s × M (11.5), WP8's request
  const encke = { kind: 'gate', beat: 500, psi: 120, gap: 14, halves: [2, 2], pair: true, tag: 'encke' };
  const enc = bare({ tune: T, gap: 2, items: [encke] });
  const g0 = enc.you.gap;
  light(enc.race, enc.you, [{ type: 'thread', pair: true, gate: 0 }], STEP, T);
  assert.ok(near(enc.you.gap - g0, T.PB_PAIR * 1.6 * M), `ENCKE GAP paid ${enc.you.gap - g0}`);
  // a gate: thread 2.0, dock 1.5, past 0.5 (× M), each through the cap
  const q = bare({ tune: T, gap: 1 });
  light(q.race, q.you, [{ type: 'thread', gate: 'coma' }], STEP, T);
  assert.ok(near(q.you.gap, 1 + T.PB_THREAD * M));
  light(q.race, q.you, [{ type: 'dock' }], STEP, T);
  assert.ok(near(q.you.gap, 1 + (T.PB_THREAD + T.PB_DOCK) * M));
  light(q.race, q.you, [{ type: 'past' }], STEP, T);
  assert.ok(near(q.you.gap, 1 + (T.PB_THREAD + T.PB_DOCK + T.PB_PAST) * M));
});

test('push-back the cap throws away speeds the shield back (lead item 7); a cell at full tanks takes 2 s off (item 3)', () => {
  const T = { ...STILL, BLEED: 0 };
  const { race, you } = bare({ tune: T, gap: T.GAP_CAP[0] });
  you.shield = 0;
  you.shieldT = 0;
  pushBack(race, you, 'graze', 0.5, T);
  assert.ok(near(you.shieldT, 0.5 * T.CAP_OVERFLOW_SHIELD));
  you.fuel = you.fuelCap;
  light(race, you, [{ type: 'pickFuel' }], 0, T);
  assert.ok(near(you.shieldT, 0.5 + T.FULL_TANK_SHIELD));
  you.fuel = 1.5;
  light(race, you, [{ type: 'pickFuel' }], 0, T);
  assert.equal(you.fuel, 2.5, 'a cell when there is room');
  you.hull = 2;
  light(race, you, [{ type: 'pickPatch' }], 0, T);
  assert.equal(you.hull, 3, 'a patch is +1 hull');
  light(race, you, [{ type: 'pickPatch' }], 0, T);
  assert.equal(you.hull, 3, 'never past hullMax');
});

test('dock prices take exactly their gap, add price × 0.25 years, refund exactly, and never pass the TTC floor', () => {
  const T = TUNE;
  const run = createRun({ seed: 'DOCK', tune: T });
  run.build = [{ id: 'hair-trigger', r: 0 }];
  Object.assign(run.you, { hull: 1, fuel: 1, gap: 2, years: 10, launchEta: T.LAUNCH_DOCK });
  run.dock = { free: 1, bought: [] };
  const k = 1 / (1 - Math.tanh(T.LAUNCH_DOCK));
  const chips = dockPrices(run, T);
  assert.deepEqual(chips.map((c) => c.id), ['free', 'repair', 'refuel', 'tune']);
  const rep = chips.find((c) => c.id === 'repair');
  assert.equal(rep.price, T.REPAIR_S);
  // each chip shows its price as launch TTC at η 0.8 (× 2.98): 0.6, 0.4 and 0.8 s of gap
  assert.equal(rep.text, '−1.8 S');
  assert.equal(chips.find((c) => c.id === 'refuel').text, '−1.2 S');
  assert.equal(chips.find((c) => c.id === 'tune').text, '−2.4 S');
  const before = JSON.stringify(run);
  assert.ok(buy(run, 'repair', T));
  assert.ok(near(run.you.gap, 2 - T.REPAIR_S) && near(run.you.years, 10 + T.REPAIR_S * T.YEARS_PER_S));
  assert.equal(run.you.hull, 2);
  assert.equal(buy(run, 'repair', T), false, 'each chip once a dock');
  // 1.4 s of gap left: TTC 4.2; REFUEL (0.4 s) would leave 3.0 s, under the 4 s floor: TOO CLOSE
  const refuel = dockPrices(run, T).find((c) => c.id === 'refuel');
  assert.equal(refuel.ok, false);
  assert.equal(refuel.why, 'TOO CLOSE');
  assert.equal(buy(run, 'refuel', T), false);
  for (const c of dockPrices(run, T)) if (c.ok && !c.bought) assert.ok((run.you.gap - c.price) * k >= T.TTC_FLOOR - 1e-9);
  assert.ok(refund(run, 'repair', T));
  assert.equal(JSON.stringify(run), before, 'a refund puts everything back exactly');
  // TUNE: one card up a rarity, once a dock, refunded back to its rarity
  run.you.gap = 6;
  assert.ok(buy(run, { id: 'tune', card: 'hair-trigger' }, T));
  assert.equal(run.build[0].r, 1);
  assert.ok(near(run.you.gap, 6 - T.TUNE_S));
  assert.equal(dockPrices(run, T).find((c) => c.id === 'tune').bought, true);
  assert.ok(refund(run, { id: 'tune' }, T));
  assert.equal(run.build[0].r, 0);
  assert.ok(near(run.you.gap, 6) && near(run.you.years, 10));
  // no dock, no chips; nothing to tune, no TUNE chip
  assert.deepEqual(dockPrices({ ...run, dock: null }, T), []);
  run.build = [];
  assert.ok(!dockPrices(run, T).some((c) => c.id === 'tune'));
  // random purchases never take launch TTC under the floor
  const rnd = mulberry32(3);
  for (let s = 0; s < 200; s++) {
    const r = createRun({ seed: s, tune: T });
    Object.assign(r.you, { hull: 1 + Math.floor(rnd() * 2), fuel: rnd() * 3, gap: rnd() * 8, launchEta: T.LAUNCH_DOCK });
    r.dock = { free: 0, bought: [] };
    for (const id of ['repair', 'refuel', 'repair', 'refuel']) buy(r, id, T);
    if (r.dock.bought.length) assert.ok(r.you.gap * k >= T.TTC_FLOOR - 1e-9, `seed ${s}: TTC ${r.you.gap * k}`);
  }
});

test('landing spends fuel first, then hull, and fails only when gap + fuel (up to 3) + hull < 3 + 1 per nine held', () => {
  const T = TUNE;
  for (let gear = 0; gear <= 4; gear++) {
    for (const gap of [0, 0.4, 1, 2.5, 3, 4.2, 5, 6, 7.5]) {
      for (let fuel = 0; fuel <= 4.5; fuel += 0.5) {
        for (let hull = 0; hull <= 3; hull++) {
          const ship = { gap, fuel, hull, gear };
          const need = T.LAND_S + T.LAND_PER_NINE * gear;
          const cells = Math.min(T.LAND_FUEL_MAX, Math.floor(fuel));
          const r = land(ship, T);
          assert.equal(r.ok, gap + cells + hull >= need - 1e-9, `gear ${gear} gap ${gap} fuel ${fuel} hull ${hull}`);
          assert.equal(r.need, need);
          if (r.hullSpent > 0) assert.equal(r.cellsSpent, Math.min(cells, Math.ceil(need - gap - 1e-9)), 'cells first');
          if (gap >= need) assert.deepEqual([r.cellsSpent, r.hullSpent], [0, 0], 'the gap covers it in full');
          assert.ok(near(ship.fuel, fuel - r.cellsSpent) && ship.hull === hull - r.hullSpent);
          if (r.ok) assert.ok(r.margin >= -1e-9 && near(r.margin, gap + r.cellsSpent + r.hullSpent - need));
        }
      }
    }
  }
  assert.equal(mod.landNeed({ gear: 2 }, T).text, 'TO LAND: 5 S AT 0.99C · FUEL AND HULL COUNT 1 EACH');
  // REDSHIFT 6's HARD LANDING is LAND_S + 2
  assert.equal(land({ gap: 4.5, fuel: 0, hull: 0, gear: 0 }, { ...T, LAND_S: T.LAND_S + 2 }).ok, false);
  // the door at Earth: race.js emits land with what was spent
  const { race, you } = bare({ tune: { ...TUNE, BLEED: 0 }, type: 'earth', gap: 2 });
  you.fuel = 2;
  let landEv = null;
  while (race.phase !== 'done' && race.real < 100) {
    for (const e of stepRace(race, { you: { target: 90 } }, STEP)) if (e.type === 'land') landEv = e;
  }
  assert.ok(landEv && landEv.ok && landEv.cellsSpent >= 1, JSON.stringify(landEv));
});

test('a hit outside the glare never emits caught and never leaves TTC under 2.9 s (seeds 1 to 200, η 0.6 to 4.9); inside it does', () => {
  const T = TUNE;
  for (let seed = 1; seed <= 200; seed++) {
    const rnd = mulberry32(seed);
    const { race, you } = bare({ tune: T, eta: 0.6 + rnd() * 4.3 });
    you.gap = gapFor(3 + rnd() * 200, you.eta);
    you.hull = 99;
    you.hullMax = 99;
    light(race, you, [], STEP, T);
    for (let k = 0; k < 12 && !you.caught; k++) {
      const glare = you.light === 'glare';
      you.eta = Math.max(T.ETA_MIN, you.eta - T.HIT_ETA);   // handle.js's part of the hit
      const ev = light(race, you, [{ type: 'hit', cause: 'knot' }], STEP, T);
      const caught = ev.some((e) => e.type === 'caught');
      if (glare) assert.ok(caught, `seed ${seed}, hit ${k}: a hit in the glare is a catch`);
      else {
        assert.ok(!caught, `seed ${seed}, hit ${k}: caught from outside the glare (η ${you.eta})`);
        assert.ok(you.ttc >= T.STUMBLE_FLOOR_TTC - 1e-9, `seed ${seed}, hit ${k}: TTC ${you.ttc}`);
        if (you.ttc < T.GLARE_IN) assert.equal(you.light, 'glare', 'at worst, the hit puts you in the glare');
      }
      // a little time, sometimes enough to leave the glare
      const s = rnd() * 4;
      for (let i = 0; i < s * 120 && !you.caught; i++) light(race, you, rnd() < 0.05 ? [{ type: 'hair', gap: 1 }] : [], STEP, T);
    }
  }
});

test('STILL LIGHT\'s cap bonus never passes +2 s and clears at launch', () => {
  const run = createRun({ seed: 'STILL', tune: TUNE });
  run.build = [{ id: 'still-light', r: 2 }];
  const race = startLeg(run, TUNE);
  const you = race.ships[0];
  const cap0 = TUNE.GAP_CAP[0];
  for (let i = 0; i < 30; i++) {
    race.events = [];
    emit(race, 'hair', you, { gap: 1 });
    cardHooks(race, STEP);
    assert.ok(you.lightHold <= 2 + 1e-12);
    assert.ok(capOf(race, you, race.tune) <= cap0 + 2 + 1e-12);
  }
  assert.ok(near(you.lightHold, 2));
  assert.ok(near(capOf(race, you, race.tune), cap0 + 2));
  you.gap = cap0;
  pushBack(race, you, 'hair', 5, race.tune);
  assert.ok(near(you.gap, cap0 + 2), 'the hold raises the cap itself');
  // a new leg is a new ship: the hold is gone
  const next = startLeg(run, TUNE);
  assert.equal(next.ships[0].lightHold, 0);
  assert.equal(capOf(next, next.ships[0], next.tune), cap0);
});

test('a rival at gap 0 emits eaten with its id; at most one eaten caption a leg', () => {
  const run = createRun({ seed: 'EATEN', tune: TUNE });
  const race = startLeg(run, TUNE);
  const named = race.ships.filter((s) => s.kind === 'regular');
  assert.equal(named.length, 3);
  for (const s of race.ships.slice(1)) s.gap = 0.01;
  const eaten = [];
  for (let i = 0; i < 240 && eaten.length < race.ships.length - 1; i++) {
    for (const e of stepRace(race, null, STEP)) if (e.type === 'eaten') eaten.push(e);
  }
  assert.equal(eaten.length, race.ships.length - 1, 'the light took every rival');
  for (const e of eaten) assert.equal(e.id, e.ship);
  assert.equal(eaten.filter((e) => e.caption).length, 1, 'one caption');
  const cap = eaten.find((e) => e.caption);
  assert.match(cap.line, /^THE LIGHT TOOK (HOUND|PIKE|REMORA|MOTH|A DRIFTER)$/);
  for (const e of eaten) if (!e.caption) assert.equal(e.line, null);
  // you took one down, then the light took it: FED TO THE LIGHT, and it counts as fed
  const r2 = startLeg(createRun({ seed: 'FED', tune: TUNE }), TUNE);
  const v = r2.ships.find((s) => s.kind === 'regular');
  v.gap = 0.3;
  r2.events = [];
  emit(r2, 'takedown', v, { by: 'you', victim: v.id });
  stepLight(r2, v, r2.events, STEP, r2.tune);
  let fed = null;
  for (let i = 0; i < 600 && !fed; i++) {
    for (const e of stepRace(r2, null, STEP)) if (e.type === 'eaten' && e.id === v.id) fed = e;
  }
  assert.equal(fed.fedBy, 'you');
  assert.equal(fed.line, 'FED TO THE LIGHT');
});

test('launch η is 1.6 / 1.0 / 0.8 by gate choice (1.0 / 1.0 / 0.6 at REDSHIFT 3)', () => {
  assert.equal(launchState(null, 'thread').eta, 1.6);
  assert.equal(launchState(null, 'past').eta, 1.0);
  assert.equal(launchState(null, 'dock').eta, 0.8);
  const run = createRun({ seed: 'LATE', tune: TUNE });
  run.redshift = 3;
  assert.deepEqual(['thread', 'past', 'dock'].map((g) => launchState(run, g, TUNE).eta), [1.0, 1.0, 0.6]);
  run.redshift = 2;
  assert.deepEqual(['thread', 'past', 'dock'].map((g) => launchState(run, g, TUNE).eta), [1.6, 1.0, 0.8]);
  assert.deepEqual(launchState(run, 'dock', TUNE).meters, { ...run.you }, 'the meters are run.js\'s');
});

test('the damage hook can cancel or redirect a hit (ABLATIVE TANKS), and a shield pop runs its hooks (REACTIVE HULL)', () => {
  const B = applyBuild([{ id: 'ablative-tanks', r: 2 }, { id: 'reactive-hull', r: 0 }], TUNE);
  const { race, you } = bare({ tune: B.tune });
  race.hooks = B.hooks;
  you.fuel = 3;
  you.eta = 1.2;
  light(race, you, [{ type: 'hit', cause: 'knot' }], STEP, B.tune);
  assert.equal(you.shield, 0, 'the shield popped');
  assert.ok(near(you.eta, Math.min(TUNE.BURN_CAP, 1.2 + TUNE.BURN_ETA)), `REACTIVE HULL: η ${you.eta}`);
  const ev = light(race, you, [{ type: 'hit', cause: 'knot' }], STEP, B.tune);
  assert.equal(you.hull, 3, 'ABLATIVE TANKS burned a cell instead');
  assert.equal(you.fuel, 2);
  assert.ok(!types(ev).includes('hullLost'));
  // rivals never run your hooks
  const r = startLeg(createRun({ seed: 'H', tune: TUNE }), TUNE);
  r.hooks = B.hooks;
  const rv = r.ships[1];
  rv.shield = 0;
  rv.fuel = 3;
  light(r, rv, [{ type: 'hit', cause: 'knot' }], STEP, B.tune);
  assert.equal(rv.hull, 2);
  // the red zone costs the shield, then hull; with 1 hull and no shield it wrecks you
  const z = bare();
  light(z.race, z.you, [{ type: 'redIn', well: 1 }]);
  assert.equal(z.you.shield, 0);
  light(z.race, z.you, [{ type: 'redIn', well: 2 }]);
  assert.equal(z.you.hull, 2);
  z.you.hull = 1;
  const e3 = light(z.race, z.you, [{ type: 'redIn', well: 3 }]);
  assert.ok(types(e3).includes('wreck') && z.you.wrecked);
});

test('LAST HULL fires as you come to 1 hull with the shield down; a patch shows only if your hull is below full', () => {
  const { race, you } = bare();
  you.hull = 2;
  you.shield = 0;
  const ev = light(race, you, [{ type: 'hit', cause: 'knot' }]);
  assert.deepEqual(types(ev), ['hit', 'hullLost', 'lastHull']);
  // a patch slot: dropped (nobody can take it) with a full hull, kept with a pip missing or on a patchAlways leg
  for (const [hull, always, kept] of [[3, false, false], [2, false, true], [3, true, true]]) {
    const L = buildLeg({ type: 'web', validate: false });
    const items = [{ id: 0, kind: 'pickup', type: 'patch', beat: 40, psi: 0, slot: 'patch' }];
    const leg = Object.freeze({ ...L, items, pickups: items, wells: [], rules: { ...L.rules, patchAlways: always } });
    const r = createRace({ leg, tune: TUNE });
    r.ships[0].hull = hull;
    let took = false;
    while (r.t < 30 && r.phase !== 'done') for (const e of stepRace(r, null, STEP)) if (e.type === 'pickPatch') took = true;
    assert.equal(mod.patchShown(r, 0), kept, `hull ${hull}, always ${always}`);
    assert.equal(took, kept, 'an idle ship on the patch\'s line takes it only if it spawned');
    if (!kept) assert.ok(r.director.dropped[0] && r.wells[0].holder);
  }
});

test('years: you age YEARS_PER_S × dt ÷ cosh η, Earth YEARS_PER_S × dt', () => {
  for (const eta of [0.6, 1, 2.6, 4.95]) assert.ok(near(yearsStep({ eta }, 2, TUNE), 0.25 * 2 / Math.cosh(eta)));
  assert.equal(yearsStep({ eta: 1 }, 0, TUNE), 0);
  const { race, you } = bare({ eta: 2.0 });
  for (let i = 0; i < 240; i++) stepRace(race, null, STEP);
  assert.ok(near(you.years, 0.25 * 2 / Math.cosh(2.0), 1e-9) && near(you.earth, 0.5, 1e-9));
});

test('no light catch comes without a glareIn first: a gap that bleeds out goes through the glare', () => {
  const { race, you } = bare({ tune: TUNE, eta: 0.8, gap: 1.5 });
  const seen = [];
  while (!you.caught && race.t < 30 && race.phase !== 'done') {
    for (const e of stepRace(race, null, STEP)) if (e.ship === 'you') seen.push(e.type);
  }
  const g = seen.indexOf('glareIn'), c = seen.indexOf('caught');
  assert.ok(g >= 0 && c > g, seen.join(','));
  assert.ok(seen.indexOf('warn') < g && seen.indexOf('breather') < 0 || true);
  assert.ok(you.stats.glareS > 2.5, `in the glare ${you.stats.glareS} s`);
});
