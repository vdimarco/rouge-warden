// Gloam Downs: growth across runs, checked in node with no browser (public/lab/gloam-downs/run.js, run-save.js, screens.js and
// growth.js; openspec/changes/gloam-downs-growth). Each block is a scenario of the change's spec:
//   Glim at risk: glim carried past a beacon, a death that keeps 10%, and a spend at the beacon (the glim carried first);
//   Patterns: the drops (2% a foe and 1% more a Keen eye level, at most 2 a run; 35% an elite), a pattern kept at a beacon, a pattern
//     lost with a death, and the same seed giving the same drops;
//   Kindle a pattern: Rime lamp kindled for 120 of 150, its row gone, and the start draw may take it;
//   The new wares: Belt 1 and Belt 2 at the start, and costs that grow, with the whole catalogue between 10,000 and 13,000 glim;
//   Sparks and the colours: Ward +1 at 80 of 100, Flame 7 (half a level after five), Edge 1 and Flame 2 on the first cut, Gloam's cooldown;
//   Lantern panes: the slots, a pane in one slot at most, Thick glass, Lead glass, Tallow glass and Clear glass;
//   Ash pocket at death, the lasting upgrades, the run in the save, and the save from v2 and with rubbish in v3;
//   the bus: pattern-found, pattern-kept, pattern-kindled and spark-take.
// Run: node qa/lab/gloam-downs-growth.test.mjs
import assert from 'node:assert/strict';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import {
  startRun, lightBeacon, die, buy, buyUnlock, maxOf, healNow, bladeBonus, makeRunner, UPGRADES, UNLOCKS, takeSpark, takeSparkPick, colourPower, coolShare,
  kindle, setPane, paneOf, paneSlots, kindledOf, drawPattern, dropPattern, groundPatterns, patternChance, startAbilities, chooseStartAbility, startPicks,
  keepShare, pay, reload, enter, goTo
} from '../../public/lab/gloam-downs/run.js';
import { makePost } from '../../public/lab/gloam-downs/moves.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { summaryOf, patternRows, paneRows, colourRow, colourLine, patternsMark, keptLine, glimLine, cardOnLoad } from '../../public/lab/gloam-downs/screens.js';
import { PATTERNS, PATTERN_IDS, STARTERS, ABILITIES, DROPS, SPARK } from '../../public/lab/gloam-downs/growth.js';
import { on } from '../../public/lab/gloam-downs/bus.js';
import { makeFoes } from '../../public/lab/gloam-downs/foes.js';

let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// flat ground at 0, 40 m wide (as gloam-downs-run.test.mjs makes its ground)
function flat(half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz;
  return makeWalk(info, new Int16Array(2 * N));
}
const FLAT = flat();
const META = { wisps: [], beacon: { p: [90, 0, 90], r: 1.2 } };
function runnerAt(o = {}) {
  const rs = o.rs || RS.fresh();
  if (!rs.run) startRun(rs, o.seed ?? 7);
  const body = makeBody(FLAT, { p: [0, 0.5, 0], yaw: o.yaw ?? Math.PI }, 20, { ...PARAMS }), posts = o.posts || [];
  const R = makeRunner({ walk: FLAT, meta: META, body, rs, targets: () => posts.filter(p => p.alive) });
  return { rs, R, body, s: body.s, posts };
}
const runFor = (R, count, inp = {}) => { const all = []; for (let i = 0; i < count; i++) all.push(...R.step(typeof inp === 'function' ? inp(i) : inp, 0)); return all; };
const heard = names => { const got = []; const offs = names.map(k => on(k, d => got.push([k, d]))); return { got, off: () => offs.forEach(f => f()) }; };

/* ---------------- Glim at risk ---------------- */
{ // Carry glim past a beacon: 40 carried and 0 banked at the Gaol's beacon; in The Crow Wall 40 is still carried and the bank is 0
  const rs = RS.fresh();
  startRun(rs, 3);
  rs.run.carried = 40;
  const out = lightBeacon(rs);
  assert.deepEqual([out.next, rs.run.place, rs.run.carried, rs.bank, rs.run.banked, rs.run.entry.carried], ['ramparts', 'ramparts', 40, 0, 0, 40]);
  assert.match(glimLine(rs, 'beacon'), /^You carry 40 glim, and 0 is banked\. .*a death would keep only 4 of it \(10%\) and lose 36\.$/);
  pass('glim at risk: 40 carried past the Gaol\'s beacon is still carried in The Crow Wall, and the bank stays 0');
}
{ // A death keeps 10%: 125 carried and no Ash pocket -> the bank goes up by 12, "Glim kept 12 · lost 113"
  const rs = RS.fresh();
  rs.bank = 7;
  startRun(rs, 3);
  rs.run.carried = 125;
  const e = die(rs);
  assert.deepEqual([rs.bank, e.kept, e.lost], [19, 12, 113]);
  assert(summaryOf(e).lines.includes('Glim kept 12 · lost 113'), JSON.stringify(summaryOf(e).lines));
  pass('a death keeps 10%: 125 carried banks 12, and the summary shows "Glim kept 12 · lost 113"');
}
{ // Spend at the beacon: 50 carried and 30 banked, Mantle 1 for 40 -> 10 carried, 30 banked. A reload cannot give the 40 back
  const rs = RS.fresh();
  startRun(rs, 3);
  rs.run.carried = 50;
  lightBeacon(rs);
  rs.bank = 30;
  assert(buy(rs, 'mantle'));
  assert.deepEqual([rs.run.carried, rs.bank, rs.up.mantle, rs.run.entry.carried], [10, 30, 1, 10]);
  reload(rs.run);
  assert.equal(rs.run.carried, 10, 'a reload keeps the glim spent spent');
  // the rest goes from the bank once the glim carried is spent; too little in all buys nothing
  assert(buy(rs, 'ash'), 'Ash pocket 1 for 40: the 10 carried, then 30 of the bank');
  assert.deepEqual([rs.run.carried, rs.bank], [0, 0]);
  assert(!buy(rs, 'flask'));
  assert(!pay(rs, 1));
  pass('spend at the beacon: Mantle 1 takes the 40 from the 50 carried and leaves the 30 banked; then the carried glim, then the bank');
}

/* ---------------- Patterns ---------------- */
{ // the drop rules: 2% from a foe and 1% more a Keen eye level; foes give at most 2 a run; an elite 35%
  const rs = RS.fresh();
  assert(near(patternChance(rs), 0.02));
  rs.up.keen = 3;
  assert(near(patternChance(rs), 0.05));
  assert.deepEqual([DROPS.patternElite, DROPS.patternMax], [0.35, 2]);
  // a thousand foes put out: the drops stop at 2
  const { R, rs: r2 } = runnerAt({ seed: 11 });
  for (let i = 0; i < 1000; i++) R.foeOut(0, [i % 7, 0, 0]);
  assert.deepEqual([r2.run.foePatterns, r2.run.groundPatterns.length], [2, 2]);
  // over many rolls the share is near the chance, and each drop is one not found, not kindled and not on the ground
  const s = RS.fresh();
  startRun(s, 5);
  let hit = 0;
  for (let i = 0; i < 20000; i++) if (drawPattern(s, 0.02)) hit++;
  assert(hit > 300 && hit < 500, `2% of 20,000 rolls: ${hit}`);
  let elite = 0;
  for (let i = 0; i < 4000; i++) if (drawPattern(s, DROPS.patternElite)) elite++;
  assert(elite > 1250 && elite < 1550, `35% of 4,000: ${elite}`);
  s.patterns = ['rime'];
  s.kindled = [...STARTERS, 'snare'];
  for (let i = 0; i < 300; i++) { const p = drawPattern(s, 1); assert(p && !['rime', 'snare', ...STARTERS].includes(p)); }
  pass('the drops: 2% a foe (5% at Keen eye 3), at most 2 from foes a run, 35% an elite, never a pattern found or kindled', { hit, elite });
}
{ // Keep a pattern: Rime lamp dropped in the Gaol, taken, and the beacon lit -> kept; the card says "Kept: Rime lamp"
  const ears = heard(['pattern-found', 'pattern-kept']);
  const { R, rs, s } = runnerAt();
  assert.equal(dropPattern(R, [s.x + 0.3, s.y, s.z], 'rime'), 'rime');
  assert.deepEqual(groundPatterns(R).map(g => [g.id, g.kind, g.colour, g.name]), [['rime', 'ability', 'ward', 'Rime lamp']]);
  const ev = runFor(R, 2);
  assert(ev.some(e => e.type === 'pattern' && e.what === 'take' && e.id === 'rime') && ev.some(e => e.type === 'store'));
  assert.deepEqual([rs.run.carriedPatterns, rs.run.groundPatterns, patternsMark(rs.run)], [['rime'], [], '◇ 1']);
  assert.equal(R.notes[0], 'A pattern: <b>Rime lamp</b>. Light a beacon to keep it.');
  assert(R.log.some(c => c.cue === 'wisp' && c.pattern === 'rime'));
  const out = lightBeacon(rs);
  assert.deepEqual([out.kept, rs.patterns, rs.run.carriedPatterns, keptLine(rs.run.kept)], [['rime'], ['rime'], [], 'Kept: Rime lamp']);
  ears.off();
  assert.deepEqual(ears.got, [['pattern-found', { id: 'rime', place: 'gaol' }], ['pattern-kept', { ids: ['rime'] }]]);
  pass('keep a pattern: Rime lamp taken in the Gaol is carried ("◇ 1", a toast), and the lit beacon keeps it: "Kept: Rime lamp"');
}
{ // Lose a pattern: Rime lamp taken, then a death before the next beacon -> not in the save, "Patterns kept 0 · lost 1"
  const { R, rs, s } = runnerAt();
  dropPattern(R, [s.x, s.y, s.z], 'rime');
  runFor(R, 2);
  rs.run.carried = 10;
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const e = die(rs);
  RS.store(storage, rs);
  const back = RS.load(storage);
  assert.deepEqual([back.patterns, e.patternsKept, e.patternsLost], [[], 0, 1]);
  assert(summaryOf(back.ended).lines.includes('Patterns kept 0 · lost 1'));
  pass('lose a pattern: a death loses the Rime lamp carried, and the summary shows "Patterns kept 0 · lost 1"');
}
{ // Same seed, same drops: the same seed, wares and kindled list, the same foes in the same order
  const dropsOf = (seed, keen = 2) => {
    const rs = RS.fresh();
    rs.up.keen = keen;
    rs.kindled = [...STARTERS, 'flare'];
    const { R } = runnerAt({ rs: (startRun(rs, seed), rs) });
    const got = [];
    for (let i = 0; i < 400; i++) { R.foeOut(3, [i, 0, 0]); got.push(...(rs.run.groundPatterns || []).map(g => `${i}:${g.id}`)); rs.run.groundPatterns = []; }
    return got;
  };
  const a = dropsOf(31), b = dropsOf(31);
  assert.deepEqual(a, b);
  assert(a.length >= 1, 'some drops in 400 foes');
  const seeds = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(sd => dropsOf(sd).join()));
  assert(seeds.size >= 4, 'other seeds drop other patterns');
  pass('same seed, same drops: two runs with seed 31, Keen eye 2 and Flare kindled drop the same patterns from the same foes', { drops: a });
}
{ // a reload restarts the place with the patterns as they were at its entry
  const { R, rs, s } = runnerAt();
  enter(rs.run);
  dropPattern(R, [s.x, s.y, s.z], 'moth');
  runFor(R, 2);
  assert.deepEqual(rs.run.carriedPatterns, ['moth']);
  reload(rs.run);
  assert.deepEqual([rs.run.carriedPatterns, rs.run.groundPatterns], [[], []]);
  pass('a reload in a place gives back the patterns as they were at its entry: a Moth wisp taken there is not carried');
}

/* ---------------- Kindle a pattern ---------------- */
{ // Kindle the Rime lamp: found, 150 banked -> 120 spent, its row leaves the list, and the start draw may take it
  const ears = heard(['pattern-kindled']);
  const rs = RS.fresh();
  rs.patterns = ['rime', 'smoked'];
  rs.bank = 150;
  const rows = patternRows(rs);
  assert.deepEqual(rows.map(r => [r.label, r.buy]), [['Rime lamp · a cone slows foes · 120 glim', 'Kindle'], ['Smoked glass · ability cooldowns 15% shorter · 120 glim', 'Kindle']]);
  assert(kindle(rs, 'rime'));
  assert.deepEqual([rs.bank, rs.patterns, kindledOf(rs, 'ability').includes('rime'), patternRows(rs).map(r => r.id)], [30, ['smoked'], true, ['smoked']]);
  // the other row has too little now: "90 more glim", and its Kindle does nothing
  assert.deepEqual([patternRows(rs)[0].buy, patternRows(rs)[0].need], ['90 more glim', 90]);
  assert(!kindle(rs, 'smoked') && !kindle(rs, 'rime') && !kindle(rs, 'flare'), 'too little glim, kindled already, or not found');
  ears.off();
  assert.deepEqual(ears.got, [['pattern-kindled', { id: 'rime' }]]);
  // from then on the start draw (the seed's `start` stream) can draw it: some seed draws Rime lamp for slot 1
  let drew = 0;
  for (let sd = 1; sd <= 60; sd++) if (startAbilities(sd, rs).slots[0].id === 'rime') drew++;
  assert(drew > 5, `Rime lamp drawn for slot 1 by ${drew} of 60 seeds`);
  assert(!PATTERN_IDS.filter(p => p !== 'rime').some(p => startAbilities(3, rs).slots[0].id === p && !kindledOf(rs).includes(p)));
  pass('kindle the Rime lamp: 120 of 150 spent, its row leaves the list, and the start draw may take it from then on', { drew });
}

/* ---------------- The new wares ---------------- */
{ // Belt 1: two abilities offered for slot 1; Belt 2: slot 2 drawn by the seed too; Belt 3: bright
  const rs = RS.fresh();
  rs.kindled = [...STARTERS, 'rime', 'flare'];
  rs.up.belt = 2;
  startRun(rs, 9);
  const offer = rs.run.abilityOffer;
  assert(offer.length === 2 && offer[0] !== offer[1], 'two abilities offered');
  assert(rs.run.abilities[0] === null && rs.run.abilities[1] && !offer.includes(rs.run.abilities[1].id), 'slot 2 holds a third one');
  assert(startPicks(rs.run) && rs.run.shelf && cardOnLoad(rs) === 'beacon', 'the start card asks');
  assert(chooseStartAbility(rs, offer[1]));
  assert.deepEqual([rs.run.abilities[0], rs.run.abilityOffer, startPicks(rs.run)], [{ id: offer[1], bright: false }, null, false]);
  // with only the two starters and Belt 2, the one not chosen fills slot 2
  const two = RS.fresh();
  two.up.belt = 2;
  startRun(two, 4);
  chooseStartAbility(two, two.run.abilityOffer[0]);
  assert.deepEqual(two.run.abilities.map(a => a.id).sort(), ['bomb', 'step']);
  // Belt 0: slot 1 alone, from the seed; Belt 3: the start abilities are bright
  const none = RS.fresh();
  startRun(none, 4);
  assert(none.run.abilities[0] && none.run.abilities[1] === null && none.run.abilityOffer === null);
  const b3 = RS.fresh();
  b3.up.belt = 3;
  startRun(b3, 4);
  chooseStartAbility(b3, b3.run.abilityOffer[0]);
  assert(b3.run.abilities.every(a => a.bright));
  pass('Belt: two abilities offered for slot 1, slot 2 drawn by the seed at Belt 2, bright at Belt 3, slot 1 alone without Belt', { offer, two: rs.run.abilities[1].id });
}
{ // Costs grow: each level costs more; the whole catalogue with the unlocks and the patterns is 10,000 to 13,000 glim
  for (const u of UPGRADES) for (let k = 1; k < u.costs.length; k++) assert(u.costs[k] > u.costs[k - 1], `${u.name} ${k + 1}`);
  const wares = UPGRADES.reduce((a, u) => a + u.costs.reduce((x, y) => x + y, 0), 0), unlocks = UNLOCKS.reduce((a, u) => a + u.cost, 0), pats = PATTERNS.reduce((a, p) => a + p.cost, 0);
  const all = wares + unlocks + pats;
  assert.deepEqual([wares, unlocks, pats], [9115, 990, 1620]);
  assert(all >= 10000 && all <= 13000, `${all}`);
  // Keen eye, Lantern panes and First spark do what they say
  const rs = RS.fresh();
  rs.up.first = 2;
  startRun(rs, 1);
  assert.equal(rs.run.sparkPicks, 2, 'First spark 2: two picks at the start');
  assert.equal(paneSlots(rs), 1);
  rs.up.panes = 2;
  assert.equal(paneSlots(rs), 3);
  pass('costs grow with each level; the wares 9,115, the unlocks 990 and the patterns 1,620: 11,725 glim in all', { all });
}

/* ---------------- Sparks and the colours ---------------- */
{ // Pick Ward: at a beacon with 80 of 100 and Ward 0 -> 90/110, and the colour row shows Ward 1
  const ears = heard(['spark-take']);
  const rs = RS.fresh();
  startRun(rs, 2);
  rs.run.hp = 80;
  lightBeacon(rs);
  assert.equal(rs.run.sparkPicks, 1, 'a lit beacon offers one spark pick');
  assert(cardOnLoad(rs) === 'beacon');
  rs.run.offer = null;
  assert(takeSpark(rs, 'ward'));
  assert.deepEqual([rs.run.hp, maxOf(rs), rs.run.entry.hp, rs.run.sparkPicks], [90, 110, 90, 0]);
  // the colours' marks are their names, so they never share the wisps' ◆ or the glim's ● on the count line
  assert.deepEqual(colourRow(rs.run).map(c => c.text), ['Flame 0', 'Ward 1', 'Gloam 0']);
  assert.equal(colourLine(rs.run), 'Flame 0 · Ward 1 · Gloam 0');
  assert(!takeSpark(rs, 'ward'), 'no pick left');
  ears.off();
  assert.deepEqual(ears.got, [['spark-take', { colour: 'ward' }]]);
  // a cache's pick: offered at once, on the small card
  assert(takeSparkPick(rs));
  assert.deepEqual([rs.run.sparkPicks, rs.run.sparkNow], [1, true]);
  takeSpark(rs, 'gloam');
  assert.equal(rs.run.sparkNow, false);
  // the last beacon is the win: no spark pick
  pass('pick Ward: 80/100 becomes 90/110, the colour row reads "◆ 1", and a cache\'s pick opens at once');
}
{ // Half after five: Flame 7 -> Flame moves deal 60% more (5 × 10% + 2 × 5%); every colour gives half a level after five
  const run = { sparks: { flame: 7, ward: 7, gloam: 3 } };
  assert(near(bladeBonus({}, [], run.sparks), 0.6));
  assert(near(colourPower(run, 'flame'), 1.6));
  assert.equal(maxOf({ up: {}, run: { ...run, wicks: [] } }), 160, 'Ward 7: 60 more health');
  // Gloam 3: every cooldown is 88% (Lantern bomb 8 s -> 7.04 s), never under 60%
  assert(near(coolShare(run) * ABILITIES[0].cool, 7.04));
  assert(near(coolShare({ sparks: { gloam: 40 } }), SPARK.gloam.coolMin));
  pass('half after five: Flame 7 gives +60%, Ward 7 +60 health, Gloam 3 leaves 88% of each cooldown (7.04 s for Lantern bomb), never under 60%');
}
{ // Flame and Edge: Edge 1 and Flame 2 land the first cut (10) on a post for 13 (10 × 1.32, rounded once)
  const posts = [];
  const { R, rs, s } = runnerAt({ posts });
  rs.up.edge = 1;
  rs.run.sparks = { flame: 2, ward: 0, gloam: 0 };
  posts.push(makePost(FLAT, s.x + Math.sin(s.yaw) * 1.2, s.z + Math.cos(s.yaw) * 1.2));
  runFor(R, 40, i => ({ attack: i === 0 }));
  assert.equal(posts[0].hits[0]?.dmg, 13);
  pass('Flame and Edge: the first cut with Edge 1 and Flame 2 deals 13 (10 × 1.32)');
}

/* ---------------- Lantern panes ---------------- */
{ // the slots: one at first, a pane in one slot at most, only a kindled pane; the second row leaves out the pane set in the first
  const rs = RS.fresh();
  assert(setPane(rs, 0, 'thick'));
  assert(!setPane(rs, 1, 'hot'), 'no second slot yet');
  assert(!setPane(rs, 0, 'storm'), 'Storm glass is not kindled');
  rs.up.panes = 1;
  const rows = paneRows(rs);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].panes.map(p => p.id), rows[1].panes.map(p => p.id)], [['thick', 'hot'], ['hot']]);
  assert(!setPane(rs, 1, 'thick'), 'a pane is set in one slot at most');
  assert(setPane(rs, 1, 'hot'));
  assert(paneOf(rs, 'thick') && paneOf(rs, 'hot'));
  assert(setPane(rs, 0, null) && !paneOf(rs, 'thick'));
  pass('pane slots: one at first and two with Lantern panes 1, a pane in one slot at most, and only kindled panes');
}
{ // Thick glass: set, at 50 of 100, a foe put out -> 53/100
  const { R, rs } = runnerAt();
  setPane(rs, 0, 'thick');
  rs.run.hp = 50;
  R.foeOut(0, [1, 0, 1]);
  assert.equal(rs.run.hp, 53);
  for (let i = 0; i < 30; i++) R.foeOut(0);
  assert.equal(rs.run.hp, 100, 'never over the maximum');
  pass('Thick glass: a foe put out at 50/100 gives 53/100');
}
{ // Lead glass: the first hit of each fight deals half; Tallow glass: a flask heals 10% more; Clear glass: +40% on the next blade hit
  const posts = [];
  const { R, rs, s } = runnerAt({ posts });
  rs.kindled = [...STARTERS, 'lead', 'tallow', 'clear'];
  rs.up.panes = 2;
  setPane(rs, 0, 'lead');
  posts.push(makePost(FLAT, s.x + Math.sin(s.yaw) * 1.2, s.z + Math.cos(s.yaw) * 1.2));
  // the fight: a target that sees the lamplighter (a foe asleep at home or homing is not in it)
  posts[0].aware = true;
  runFor(R, 1);
  assert.equal(R.hurt(20, [s.x, s.z - 1], {}, []), 'hit');
  assert.equal(rs.run.hp, 90, 'the first hit of the fight: 10 of 20');
  runFor(R, 70);
  R.hurt(20, [s.x, s.z - 1], {}, []);
  assert.equal(rs.run.hp, 70, 'the next hit while the post stands: all 20');
  // the post no longer sees the lamplighter: the fight is over, and the next one starts with a half hit again
  posts[0].aware = false;
  runFor(R, 70);
  posts[0].aware = true;
  R.hurt(20, [s.x, s.z - 1], {}, []);
  assert.equal(rs.run.hp, 60, 'a new fight: half again');
  rs.run.hp = 70;
  setPane(rs, 1, 'tallow');
  assert.equal(healNow(rs), 39, 'Tallow glass: 35% of 100 × 1.1, rounded once');
  setPane(rs, 2, 'clear');
  runFor(R, 70);
  posts.length = 0;
  posts.push(makePost(FLAT, s.x + Math.sin(s.yaw) * 1.2, s.z + Math.cos(s.yaw) * 1.2));
  // an ability's use (abilities.js puts ability-use in the runner's events) opens 2 s for the next blade hit
  let use = true;
  R.think = ev => { if (use) { ev.push({ type: 'ability-use', id: 'bomb', slot: 0 }); use = false; } };
  runFor(R, 1);
  assert(R.clearUntil > R.clock.play, 'the use opens the window');
  runFor(R, 40, i => ({ attack: i === 0 }));
  assert.equal(posts[0].hits[0]?.dmg, 14, 'Clear glass: the cut deals 14 (10 × 1.4)');
  assert.equal(R.clearUntil, -1, 'the blade hit takes it');
  pass('Lead glass halves the first hit of a fight, Tallow glass heals 39 of 100, and Clear glass makes the next cut deal 14');
}

/* ---------------- Ash pocket at death, the lasting upgrades ---------------- */
{ // Ash pocket 2: 100 carried -> 26 kept, 74 lost; each level 8% more, up to 50%
  const rs = RS.fresh();
  rs.up.ash = 2;
  startRun(rs, 4);
  rs.run.carried = 100;
  const e = die(rs);
  assert.deepEqual([e.kept, e.lost, rs.bank, summaryOf(e).lines[0]], [26, 74, 26, 'Glim kept 26 · lost 74']);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(a => Math.round(keepShare({ ash: a }) * 100)), [10, 18, 26, 34, 42, 50]);
  pass('Ash pocket 2: a death with 100 carried keeps 26 and loses 74; 10% to 50% in 8% steps');
}
{ // All upgrades at Ember 0 with no sparks: 220 health, 6 flasks, 65% heals, the blade +60%, 50% kept
  const rs = RS.fresh();
  for (const u of UPGRADES) rs.up[u.id] = u.costs.length;
  startRun(rs, 9);
  assert.deepEqual([rs.run.hp, maxOf(rs), rs.run.flasks, healNow(rs), Math.round(bladeBonus(rs.up, []) * 100), Math.round(keepShare(rs.up) * 100)], [220, 220, 6, 143, 60, 50]);
  pass('all upgrades: 220 health, 6 flasks, a flask heals 65%, the blade +60%, a death keeps 50%');
}
{ // the win banks all the glim carried and keeps the patterns carried
  const rs = RS.fresh();
  startRun(rs, 5);
  goTo(rs, 'barrows');
  Object.assign(rs.run, { carried: 58, carriedPatterns: ['pitch'] });
  rs.bank = 100;
  lightBeacon(rs);
  assert.deepEqual([rs.bank, rs.ended.kept, rs.ended.patternsKept, rs.patterns], [158, 58, 1, ['pitch']]);
  pass('the win banks all 58 carried and keeps the Pitch pour pattern');
}

/* ---------------- the save ---------------- */
{ // The run in the save: Lantern Fen with Ember trail, Flame 2, Lantern bomb in slot 1, Rime lamp carried and one cache opened
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const rs = RS.fresh();
  startRun(rs, 21);
  goTo(rs, 'fen');
  Object.assign(rs.run, { relics: ['trail'], sparks: { flame: 2, ward: 0, gloam: 0 }, abilities: [{ id: 'bomb', bright: true }, null], carriedPatterns: ['rime'], caches: ['fen-ledge-1'], sparkPicks: 1 });
  rs.run.abilityLamps = [{ id: 'step', bright: false, place: 'fen', x: 1, y: 2, z: 3 }];
  enter(rs.run);
  RS.store(storage, rs);
  assert(mem.has('gloam-downs.run.v3'));
  const back = RS.load(storage);
  for (const k of ['relics', 'sparks', 'abilities', 'carriedPatterns', 'caches', 'sparkPicks', 'abilityLamps']) {
    assert.deepEqual(back.run[k], rs.run[k], k);
    assert.deepEqual(back.run.entry[k], rs.run.entry[k], `entry ${k}`);
  }
  pass('the run in the save: Ember trail, Flame 2, Lantern bomb in slot 1, the Rime lamp carried, a cache and a lamp come back with the entry');
}
{ // From v2: Mantle 3, Ash pocket 1 and 70 banked -> Mantle 3, Ash pocket 2, 70, the four starters kindled, and v3 written
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const v2 = { v: 2, bank: 70, up: { mantle: 3, ash: 1, flask: 1 }, unlocks: ['shelf'], runs: 6, run: { place: 'fen', seed: 99, hp: 80, carried: 12, wicks: ['keen'] } };
  mem.set('gloam-downs.run.v2', JSON.stringify(v2));
  mem.set('gloam-downs.run.v1', JSON.stringify({ bank: 5 }));
  const s = RS.load(storage);
  assert.deepEqual([s.v, s.up.mantle, s.up.ash, s.up.flask, s.bank, s.kindled, s.unlocks], [3, 3, 2, 1, 70, ['bomb', 'step', 'thick', 'hot'], ['shelf']]);
  assert(mem.has('gloam-downs.run.v3'));
  // the run in progress keeps its place, with sparks 0 and slot 1 from the seed's start stream
  assert.deepEqual([s.run.place, s.run.carried, s.run.sparks, s.run.abilities], ['fen', 12, { flame: 0, ward: 0, gloam: 0 }, startAbilities(99, s).slots]);
  assert(s.run.abilities[0] && STARTERS.includes(s.run.abilities[0].id));
  // a later v2 write by a cached page changes nothing
  mem.set('gloam-downs.run.v2', JSON.stringify({ bank: 1 }));
  assert.equal(RS.load(storage).bank, 70);
  pass('from v2: Mantle 3, Ash pocket 1 becomes 2, 70 glim, the four starters kindled, v3 written; the run keeps its place with slot 1 drawn');
}
{ // Rubbish in v3: an unknown pattern, an unknown key, Flame 900, a slot with an ability not kindled -> dropped, 40, and empty
  const raw = {
    patterns: ['rime', 'sword', 'rime', 'bomb'], kindled: ['flare', 'dragon'], keys: ['leap', 'moon'], panes: ['thick', 'thick', 'storm'],
    up: { belt: 9, keen: -1, panes: 1.4, first: 'x' },
    run: { place: 'gaol', seed: 5, sparks: { flame: 900, ward: -3, gloam: 'x' }, abilities: [{ id: 'moth', bright: true }, { id: 'flare', bright: 1 }], carriedPatterns: ['rime', 'flare', 'nope'], sparkPicks: 99, caches: ['ok-1', 'Bad Spot', 7], abilityLamps: [{ id: 'step', place: 'fen', x: 0, y: 0, z: 0 }, { id: 'nope', place: 'gaol', x: 0, y: 0, z: 0 }] },
    ended: { place: 'gaol', kept: -2, patternsKept: 'x' }
  };
  const s = RS.clean(raw);
  assert.deepEqual([s.patterns, s.kindled, s.keys, s.panes], [['rime'], ['bomb', 'step', 'thick', 'hot', 'flare'], ['leap'], ['thick']]);
  assert.deepEqual([s.up.belt, s.up.keen, s.up.panes, s.up.first], [3, 0, 1, 0]);
  assert.deepEqual([s.run.sparks, s.run.abilities, s.run.carriedPatterns, s.run.sparkPicks, s.run.caches, s.run.abilityLamps], [{ flame: 40, ward: 0, gloam: 0 }, [null, { id: 'flare', bright: false }], [], 9, ['ok-1'], []]);
  assert.deepEqual([s.ended.kept, s.ended.patternsKept], [0, 0]);
  assert(s.run.hp <= maxOf(s) && maxOf(s) === 100, 'Ward is 0, so the maximum is 100');
  for (const bad of [null, 3, 'x', [], { run: { place: 'gaol', abilities: 'x', sparks: [] } }]) { const c = RS.clean(bad); assert.deepEqual(Object.keys(c).sort(), Object.keys(RS.fresh()).sort()); }
  pass('rubbish in v3: unknown ids dropped, Flame 900 is 40, a slot with Moth wisp (not kindled) is empty, a pattern kindled cannot be carried');
}


/* ---------------- fixes after the merge pass (each failed before its fix) ---------------- */
{ // the elite's pattern lamp lies on floor the lamplighter can reach: never in a wall 1.8 m in +x, and on the ground under a flier
  const info = { x0: -20, z0: -20, step: 0.25, nx: 161, nz: 161 }, N = info.nx * info.nz, cells = new Int16Array(2 * N);
  // a wall 3 m high from x 1.5 to 2.5
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) { const x = info.x0 + i * info.step; if (x >= 1.5 && x <= 2.5) { cells[j * info.nx + i] = 300; cells[N + j * info.nx + i] = 300; } }
  const walk = makeWalk(info, cells);
  const was = DROPS.patternElite;
  DROPS.patternElite = 1;
  for (const y0 of [0, 1.4]) {
    const rs = RS.fresh(); startRun(rs, 5);
    const body = makeBody(walk, { p: [-6, 0.5, 0], yaw: 0 }, 20, { ...PARAMS });
    let once = true;
    const R = makeRunner({ walk, meta: META, body, rs, think: ev => { if (once) { once = false; ev.push({ type: 'foeOut', foe: 'E1', x: 0.3, y: y0, z: 0 }); } } });
    R.elite = { id: 'E1', elite: { name: 'The test elite' } };
    runFor(R, 2);
    const g = groundPatterns(R)[0], relic = R.relics.view().ground[0];
    assert(g && Math.abs(g.y) < 0.01 && !(g.x >= 1.4 && g.x <= 2.6), `the lamp at ${g?.x}, ${g?.y}`);
    assert(relic && Math.abs(relic.y) < 0.01, `the relic at height ${relic?.y}`);
  }
  DROPS.patternElite = was;
  pass('the elite\'s pattern lamp and relic lie on the floor: not in a wall beside it, and under a flier, not in the air');
}
{ // a pattern lamp left lying when the beacon lights is taken with it, kept, and the summary of a later death counts it as kept
  const rs = RS.fresh(); startRun(rs, 3);
  rs.run.groundPatterns = [{ id: 'rime', x: 1, y: 0, z: 1 }];
  rs.run.foePatterns = 1;
  const out = lightBeacon(rs);
  assert.deepEqual([out.kept, rs.patterns, rs.run.groundPatterns], [['rime'], ['rime'], []]);
  pass('a lit beacon takes the pattern lamps still lying in the place, as it takes the glim motes');
}
{ // a flier's drops fall to the ground under it: a Mirelight put out 1.8 m up drops its glim and pattern at the floor
  const rs = RS.fresh(); startRun(rs, 3);
  const body = makeBody(FLAT, { p: [0, 0.5, 0], yaw: 0 }, 20, { ...PARAMS });
  const F = makeFoes({ walk: FLAT, meta: { zones: [], spawn: { p: [0, 0, 10] } }, slots: 'M', seed: 3, bounds: 20 });
  const R = makeRunner({ walk: FLAT, meta: META, body, rs, targets: F.targets, think: F.think });
  F.bind(R);
  const m = F.find(F.spawn('M', 0, 3).id);
  m.y = 1.8;
  let at = null;
  const out0 = R.foeOut;
  R.foeOut = (g, a, f) => { at = a; return out0(g, a, f); };
  m.hit(999, {});
  assert(at && Math.abs(at[1]) < 0.01, `dropped at height ${at?.[1]}`);
  pass('a Mirelight put out in the air drops at the floor under it', { y: at[1] });
}
{ // a foe put out in the same step after the elite still rolls for its pattern (the check is whether this foe is the elite)
  const { R, rs } = runnerAt();
  R.elite = { id: 'E1', out: true };
  const before = rs.run.patternRolls | 0;
  R.foeOut(0, [1, 0, 1], { id: 'S9' });
  assert.equal((rs.run.patternRolls | 0) - before, 1, 'another foe rolls');
  R.foeOut(0, [1, 0, 1], { id: 'E1' });
  assert.equal((rs.run.patternRolls | 0) - before, 1, 'the elite does not roll here (eliteOut does)');
  pass('the 2% pattern roll is skipped only for the elite itself, not for every foe after it in the same step');
}
{ // a summary from an old save with no kept count shows what it banked, not "kept 0"; a death whose banked is its kept says it once
  const old = RS.clean({ ended: { won: false, place: 'fen', time: 100, foes: 3, lost: 40, banked: 55 } });
  assert.equal(old.ended.kept, null);
  const rows = summaryOf(old.ended).rows.map(r => r[0]);
  assert(!rows.includes('Glim') && rows.includes('Glim banked'));
  const now = summaryOf({ won: false, place: 'fen', time: 100, foes: 3, kept: 30, lost: 270, banked: 30 }).rows;
  assert.deepEqual(now.filter(r => r[0].startsWith('Glim')), [['Glim', 'kept 30 · lost 270']]);
  pass('the summary: an old save shows the glim banked and no "kept 0"; a death says its glim once');
}
console.log(`${n} checks passed`);
