// Gloam Downs' builds, checked in Node with no browser (public/lab/gloam-downs/run.js, run-save.js, moves.js, foes.js, elites.js,
// relics.js and screens.js): the names; Cinders and Ash pocket; the unlocks and the wicks they add; Last ember; Kindled flask; the
// relics' changes to the moves (Ember trail, Coal heel, Moth lamp, Tinder guard, Spark third, Hooked cut, Bellows cut, Echo blade) and
// the kindlings; Rising cut and Ember parry; the five elites and their special moves; a relic dropped and taken; the Ember levels and
// their rules; the seed's own streams for relics, the route and the Wick shelf; the v2 save and its one read of v1; and the screens'
// texts for unlocks, Ember and relics. design.md "B. Elites, relics and builds" and "C. Lasting upgrades and harder levels".
// Run: node qa/lab/gloam-downs-builds.test.mjs
import assert from 'node:assert/strict';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import * as RUN from '../../public/lab/gloam-downs/run.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { makeFoes, FOE_HARD } from '../../public/lab/gloam-downs/foes.js';
// these checks test the rules at the numbers of the foes' table; Ember 0's harder factors (FOE_HARD, REEVE.hard) are checked in gloam-downs-foes.test.mjs
FOE_HARD.dmg = 1; FOE_HARD.hp = 1;
import { makePost, HITS, MOVES, RISE, BUILD } from '../../public/lab/gloam-downs/moves.js';
import { ELITES, ELITE_LIST, eliteZone, specialSteps, dressOf } from '../../public/lab/gloam-downs/elites.js';
import { RELICS, KINDLE, drawRelic, kindled, relicLine, groundRelics, FIRE } from '../../public/lab/gloam-downs/relics.js';
import { on, emit, EVENTS } from '../../public/lab/gloam-downs/bus.js';
import { unlockRows, unlockRow, emberRow, relicMarks, summaryOf, winOf, routeOf, moveLines } from '../../public/lab/gloam-downs/screens.js';
import { ORDER } from '../../public/lab/gloam-downs/save.js';

const { startRun, lightBeacon, die, buy, buyUnlock, setEmber, makeRunner, WICKS, UPGRADES, UNLOCKS, drawOffer, startOffer, offerable, routeFor, chooseWick, goTo, enter, reload, glimFactor, flasksOf, maxOf, healNow } = RUN;
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;

/* ---------------- made-up ground ---------------- */
function layered(fn, half = 24) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz, cells = new Int16Array(2 * N);
  let k = 0;
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++, k++) { const v = fn(info.x0 + i * info.step, info.z0 + j * info.step); cells[k] = cells[N + k] = Math.round(v * 100); }
  return makeWalk(info, cells);
}
const FLAT = layered(() => 0);
const META = { wisps: [], beacon: { p: [90, 0, 90], r: 1 } };

// a run on flat ground with training posts as its targets (posts never move or hit back)
function postRun({ x = 0, z = 0, yaw = Math.PI, seed = 7, setup = null, posts = [] } = {}) {
  const rs = RS.fresh();
  setup?.pre?.(rs);
  startRun(rs, seed);
  setup?.(rs);
  const body = makeBody(FLAT, { p: [x, 0.5, z], yaw }, 24, { ...PARAMS });
  const P = posts.map((p, i) => makePost(FLAT, p[0], p[1], { id: `post${i + 1}`, ...(p[2] || {}) }));
  const R = makeRunner({ walk: FLAT, meta: META, body, rs, targets: () => P.filter(p => p.alive) });
  return { rs, R, s: body.s, posts: P };
}
/* a fight on flat ground: a place's zones and pool with its elite, the lamplighter at (x, z) facing -z (yaw π) */
function fightOn({ place = 'gaol', zones, slots = 'SSSSSPMMMI', seed = 7, x = 0, z = 0, hp = 1e4, ember = 0, unlocks = [], relics = [], wicks = [] } = {}) {
  const rs = RS.fresh();
  rs.unlocks = unlocks.slice();
  rs.emberTop = ember; rs.ember = ember;
  startRun(rs, seed);
  rs.run.offer = null;
  rs.run.hp = hp;
  rs.run.relics = relics.slice();
  rs.run.wicks = wicks.slice();
  const body = makeBody(FLAT, { p: [x, 0.5, z], yaw: Math.PI }, 24, { ...PARAMS });
  const F = makeFoes({ walk: FLAT, meta: { id: place, zones, bounds: 24, spawn: { p: [0, 0, 20] } }, slots, seed });
  const hurts = [];
  const R = makeRunner({ walk: FLAT, meta: META, body, rs, targets: F.targets, lightable: F.lightable, drop: F.drop, think: F.think, onLight: F.bank });
  const hurt = R.hurt;
  R.hurt = (...a) => { const safe = R.fighter.safe(); const r = hurt(...a); hurts.push({ r, dmg: a[0], play: R.clock.play, safe }); return r; };
  F.bind(R);
  return { rs, R, F, s: body.s, hurts, log: R.log };
}
function run(W, count, inp = {}, each = null) {
  const all = [];
  for (let i = 0; i < count; i++) {
    for (const e of W.R.step(typeof inp === 'function' ? inp(i) : inp, 0)) all.push({ ...e, i });
    if (each && each(i) === false) break;
  }
  return all;
}
// a zone of one foe, which is the place's elite (the first zone is never the elite's, so a far zone comes first)
const eliteZones = (type, at = [0, 0, -3]) => [{ id: 'Z0', c: [0, 0, 20], leash: 3, foes: 'S' }, { id: 'Z1', c: at, leash: 8, foes: type }];
// wake the elite's zone and step until it stands, aware of the lamplighter
function wakeElite(W) {
  const E = W.F.elite();
  assert(E, 'the place has an elite');
  assert(W.F.wake(E.zone.id).ok);
  run(W, 120, {}, () => !(E.state === 'chase' || E.special));
  return E;
}
// step until the elite starts its special move (it picks the special move every time here)
function untilSpecial(W, E, max = 600) {
  let k = 0;
  run(W, max, {}, () => { if (!E.special) E.pick = true; k++; return !E.special; });
  assert(E.special, `no special move in ${k} steps`);
  return k;
}

/* ---------------- names ---------------- */
{
  assert.deepEqual(WICKS.map(w => w.name), ['Long wick', 'Keen edge', 'Quick heels', 'Heavy fall', 'Spare oil', 'Close shave', 'Ember tongue', 'Glim heart', 'Last ember']);
  assert.deepEqual(UPGRADES.map(u => u.name), ['Mantle', 'Flask', 'Edge', 'Draught', 'Ash pocket', 'Belt', 'Keen eye', 'Lantern panes', 'First spark']);
  assert.deepEqual(UNLOCKS.map(u => u.name), ['Ember tongue', 'Glim heart', 'Last ember', 'Wick shelf', 'Kindled flask', 'Rising cut', 'Ember parry']);
  assert.deepEqual(RELICS.map(r => r.name), ['Ember trail', 'Spark third', 'Coal heel', 'Hooked cut', 'Bellows cut', 'Moth lamp', 'Tinder guard', 'Echo blade']);
  assert.deepEqual(ELITE_LIST.map(e => e.name), ['The Wardmother', 'The Rookchief', 'The Fen-wick', 'The Bellwether', 'The Cairnwarden']);
  assert.deepEqual(UNLOCKS.map(u => u.cost), [90, 100, 220, 160, 80, 140, 200]);
  assert.equal(UNLOCKS.reduce((a, u) => a + u.cost, 0), 990, 'the unlocks cost 990 glim in all');
  pass('names: nine wicks, nine wares, seven unlocks, eight relics and five elites, with these names and no others');
}

/* ---------------- a death keeps 10%, and Ash pocket 8% more a level (gloam-downs-growth) ---------------- */
{
  const rs = RS.fresh();
  startRun(rs, 3);
  rs.run.carried = 20;
  const e = die(rs);
  assert.deepEqual([e.banked, e.lost, rs.bank], [2, 18, 2]);
  // the glim banked is the glim kept here, so it is not said twice
  assert.deepEqual(summaryOf(e).rows.slice(3, 5), [['Glim', 'kept 2 · lost 18'], ['Patterns', 'kept 0 · lost 0']]);
  const a = RS.fresh();
  a.up.ash = 1;
  startRun(a, 3);
  a.run.carried = 20;
  const e2 = die(a);
  assert.deepEqual([e2.banked, e2.lost], [3, 17]);
  pass('a death in the Gaol with 20 glim banks 2 and loses 18; with Ash pocket 1 it banks 3 and loses 17');
}

/* ---------------- unlocks ---------------- */
{
  const rs = RS.fresh();
  rs.bank = 150;
  assert.equal(unlockRow(rs, 'rising').label, 'Rising cut · attack as a roll ends · 140 glim');
  assert(buyUnlock(rs, 'rising'));
  assert.equal(rs.bank, 10);
  assert.equal(unlockRow(rs, 'rising').label, 'Rising cut · bought');
  assert.equal(unlockRow(rs, 'rising').buy, null);
  assert(!buyUnlock(rs, 'rising'), 'each unlock is bought once');
  assert(moveLines(rs).some(l => /Rising cut/.test(l)), 'the run help has a line for it');
  const poor = RS.fresh();
  poor.bank = 30;
  for (const row of unlockRows(poor)) assert(row.need > 0 && row.buy === `${row.cost - 30} more glim`, row.label);
  assert(!buyUnlock(poor, 'kflask'));
  pass('unlocks: Rising cut with 150 banked leaves 10 and reads "bought"; with 30 every Buy says how much more is needed');
}
{ // the three wicks from unlocks join the offers once bought, and never before
  for (let seed = 1; seed <= 200; seed++) for (let k = 0; k < 4; k++) assert(drawOffer(seed, k, []).every(id => !['tongue', 'heart', 'last'].includes(id)));
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) for (const id of drawOffer(seed, 0, [], ['tongue', 'heart', 'last'])) seen.add(id);
  assert(['tongue', 'heart', 'last'].every(id => seen.has(id)));
  assert.equal(offerable(['tongue']).length, 7);
  pass('the wicks from unlocks: never offered before they are bought; each offered once bought');
}
{ // Last ember: at 0 health the run goes on with 25, and the next hit to 0 ends it
  const W = postRun({ setup: rs => { rs.run.wicks = ['last']; } });
  W.rs.run.hp = 10;
  const ev = [];
  assert.equal(W.R.hurt(16, [0, -1], {}, ev), 'hit');
  assert.equal(W.rs.run.hp, 25);
  assert(ev.some(e => e.type === 'relic' && e.what === 'last'));
  W.R.fighter.f.safe = 0;
  W.rs.run.hp = 10;
  assert.equal(W.R.hurt(16, [0, -1], {}, []), 'dead');
  assert.equal(W.rs.run, null);
  pass('Last ember: a hit to 0 of 100 leaves 25, and the next hit to 0 ends the run');
}
{ // Ember tongue: a cut burns for 6 more over 2 s; Glim heart heals 1 a mote
  const W = postRun({ posts: [[0, -1.6]], setup: rs => { rs.run.wicks = ['tongue']; } });
  run(W, 150, i => ({ attack: i === 0 }));
  assert.deepEqual(W.posts[0].hits.map(h => h.dmg), [10, 2, 2, 2]);
  const H = postRun({ setup: rs => { rs.run.wicks = ['heart']; } });
  H.rs.run.hp = 50;
  H.R.relics.scan([{ type: 'glim' }, { type: 'glim' }]);
  assert.equal(H.rs.run.hp, 52);
  pass('Ember tongue: a cut of 10 burns for 2, 2 and 2 more; Glim heart: two motes heal 2');
}
{ // Wick shelf: Begin the run offers two wicks from the seed's start stream; the chosen one is never offered again
  const rs = RS.fresh();
  rs.unlocks = ['shelf'];
  startRun(rs, 12);
  const offer = rs.run.offer.slice();
  assert.deepEqual(offer, startOffer(12, rs.unlocks));
  assert.equal(rs.run.place, 'gaol');
  assert(chooseWick(rs, offer[0]));
  for (let i = 0; i < 4; i++) { rs.run.carried = 0; const r = lightBeacon(rs); if (r.won) break; assert(!r.offer.includes(offer[0])); chooseWick(rs, r.offer[0]); }
  pass('Wick shelf: the run starts in the Gaol with a choice of two, and no beacon offers the one chosen', { offer });
}

/* ---------------- relics ---------------- */
{ // Ember trail: a roll through a post leaves fire that deals 4 each 0.25 s, at most 12 a roll; Quick heels kindles it to 150 steps
  const W = postRun({ posts: [[0, -1.5]], setup: rs => { rs.run.relics = ['trail']; } });
  run(W, 200, i => ({ roll: i === 0, mz: i === 0 ? 1 : 0 }));
  assert.equal(W.posts[0].taken, 12, `the post took ${W.posts[0].taken}`);
  const life = wicks => {
    const K = postRun({ setup: rs => { rs.run.relics = ['trail']; rs.run.wicks = wicks; } });
    let most = 0;
    run(K, 300, i => ({ roll: i === 0, mz: i === 0 ? 1 : 0 }), () => { for (const f of K.R.relics.fires) most = Math.max(most, f.life); });
    return most;
  };
  assert.deepEqual([life([]), life(['heels'])], [90, 150]);
  pass('Ember trail: a roll through a still target deals 12; the trail lasts 90 steps, or 150 kindled with Quick heels');
}
{ // Coal heel: the plunge's landing leaves a ring of 2 m for 120 steps, 5 each 0.5 s; Heavy fall kindles it to 2.5 m for 180 steps
  const ring = wicks => {
    const W = postRun({ posts: [[0, -1.9, { y: 0 }]], setup: rs => { rs.run.relics = ['heel']; rs.run.wicks = wicks; } });
    W.R.relics.scan([{ type: 'ring', x: 0, y: 0, z: 0, r: 1.6 }]);
    const f = W.R.relics.fires[0];
    run(W, 200);
    return { r: f.r, life: f.life, taken: W.posts[0].taken };
  };
  const a = ring([]), b = ring(['heavy']);
  assert.deepEqual([a.r, a.life, a.taken], [2, 120, 20]);
  assert.deepEqual([b.r, b.life, b.taken], [2.5, 180, 30]);
  pass('Coal heel: a ring of 2 m for 120 steps (20 to a post in it), kindled 2.5 m for 180 steps (30)', { a, b });
}
{ // Moth lamp: a drink sends a 3 m pulse of 10; Spare oil kindles it to 4.5 m
  const pulse = wicks => {
    const W = postRun({ posts: [[0, -2.5], [0, -4.0]], setup: rs => { rs.run.relics = ['moth']; rs.run.wicks = wicks; } });
    W.rs.run.hp = 50;
    run(W, 70, i => ({ heal: i === 0 }));
    return W.posts.map(p => p.taken);
  };
  assert.deepEqual(pulse([]), [10, 0]);
  assert.deepEqual(pulse(['oil']), [10, 10]);
  pass('Moth lamp: a drink deals 10 within 3 m, and within 4.5 m kindled with Spare oil');
}
{ // Spark third: the finisher throws a spark that deals 12 to the first target in 6 m; Keen edge kindles it to pass on to a second
  const spark = wicks => {
    const W = postRun({ posts: [[0, -1.8], [0, -4.0], [0, -5.0]], setup: rs => { rs.run.relics = ['spark']; rs.run.wicks = wicks; } });
    W.R.fighter.f.next = 2; W.R.fighter.f.since = 0;
    run(W, 80, i => ({ attack: i === 0 }));
    return W.posts.map(p => p.hits.filter(h => h.kind === 'relic').map(h => h.dmg));
  };
  const a = spark([]), b = spark(['keen']);
  assert.deepEqual(a, [[12], [], []]);
  assert.deepEqual(b, [[14], [14], []], 'kindled, it passes on (12 with Keen edge is 14)');
  pass('Spark third: 12 to the first target; kindled with Keen edge it hits a second', { a, b });
}
{ // Echo blade: with no damage bonus, the finisher hits a post for 22, and again for 11 18 steps later
  const W = postRun({ posts: [[0, -1.8]], setup: rs => { rs.run.relics = ['echo']; } });
  W.R.fighter.f.next = 2; W.R.fighter.f.since = 0;
  const at = [];
  run(W, 80, i => ({ attack: i === 0 }), () => { if (W.posts[0].hits.length > at.length) at.push(W.R.clock.play); });
  assert.deepEqual(W.posts[0].hits.map(h => h.dmg), [22, 11]);
  assert.equal(at[1] - at[0], 18);
  pass('Echo blade: the finisher deals 22, then 11 again 18 steps later', { at });
}
{ // Tinder guard: a hook that passes in the roll's safe time readies the finisher; Attack 0.5 s later plays it
  const W = postRun({ setup: rs => { rs.run.relics = ['tinder']; } });
  run(W, 5, i => ({ roll: i === 0 }));
  assert.equal(W.R.hurt(16, [0, -1], {}, []), 'safe');
  run(W, 30);
  const ev = run(W, 3, i => ({ attack: i === 0 }));
  assert.equal(W.R.fighter.f.hit, 2, 'the finisher plays');
  assert(ev.some(e => e.type === 'cue' && e.cue === 'swing' && e.hit === 'fin'));
  const P = postRun();
  run(P, 5, i => ({ roll: i === 0 }));
  P.R.hurt(16, [0, -1], {}, []);
  run(P, 30);
  run(P, 3, i => ({ attack: i === 0 }));
  assert.equal(P.R.fighter.f.hit, 0, 'without it, the first cut');
  pass('Tinder guard: Attack 0.5 s after a near miss plays the finisher, not the first cut');
}
{ // Hooked cut pulls a light foe within 4 m to 1.2 m in front; Bellows cut pushes 2.5 m and stops a light foe's wind-up
  const W = fightOn({ zones: [], relics: ['hooked'] });
  const r = W.F.spawn('S', 0, -3.6, 0), S = W.F.find(r.id);
  S.cool = 1e6;
  run(W, 12, i => ({ attack: i === 0 }));
  const d = Math.hypot(S.x - W.s.x, S.z - W.s.z);
  assert(d < 2.0 && S.hp < 50, `pulled to ${d.toFixed(2)} m, hp ${S.hp}`);
  const B = fightOn({ zones: [], relics: ['bellows'] });
  const r2 = B.F.spawn('S', 0, -1.8, 0), S2 = B.F.find(r2.id);
  run(B, 1);
  assert.equal(S2.move, 'hook');
  const z0 = S2.z;
  B.R.fighter.f.next = 1; B.R.fighter.f.since = 0;
  run(B, 30, i => ({ attack: i === 0 }));
  assert(S2.state === 'down' || S2.move !== 'hook', 'the wind-up stops');
  assert(z0 - S2.z > 1.8, `pushed ${(z0 - S2.z).toFixed(2)} m`);
  pass('Hooked cut pulls a Snuffer from 3.6 m into the cut; Bellows cut pushes one 2.5 m back out of its wind-up', { pulled: +d.toFixed(2), pushed: +(z0 - S2.z).toFixed(2) });
}
{ // Kindlings: two runs play apart
  const a = { relics: ['trail'], wicks: ['heels'] }, b = { relics: ['heel'], wicks: ['heavy'] };
  assert(kindled(a, 'trail') && kindled(b, 'heel') && !kindled(a, 'heel') && !kindled({ relics: ['trail'], wicks: [] }, 'trail'));
  assert.equal(relicLine('trail', a), 'Ember trail · the roll leaves fire · Kindled');
  assert.equal(KINDLE.length, 4);
  pass('kindlings: Quick heels with Ember trail and Heavy fall with Coal heel kindle, and the toast says "Kindled"');
}
{ // the relic draw: from the seed's own stream, never one the run holds; the same seed gives the same relics
  for (let seed = 1; seed <= 200; seed++) {
    const held = [];
    for (let k = 0; k < 5; k++) { const r = drawRelic(seed, k, held); assert(r && !held.includes(r)); held.push(r); }
    assert.deepEqual(held, (() => { const h = []; for (let k = 0; k < 5; k++) h.push(drawRelic(seed, k, h)); return h; })());
  }
  pass('the relic draw: five different relics a run, the same for the same seed');
}

/* ---------------- Rising cut and Ember parry ---------------- */
{ // Attack 0.05 s before a roll ends, next to a Snuffer: a rising cut of 14 that knocks it down for 36 steps
  const W = fightOn({ zones: [], unlocks: ['rising'] });
  const r = W.F.spawn('S', 0, -4.6, 0), S = W.F.find(r.id);
  S.cool = 1e6;
  const roll = MOVES.roll.steps;
  let down = null;
  run(W, 40, i => ({ roll: i === 0, mz: i === 0 ? 1 : 0, attack: i === roll - 3 }), () => { if (S.state === 'down' && down === null) down = S.downFor; });
  assert.equal(50 - S.hp, 14, `the Snuffer took ${50 - S.hp}`);
  assert.equal(down, 36);
  const P = fightOn({ zones: [] });
  const r2 = P.F.spawn('S', 0, -4.6, 0), S2 = P.F.find(r2.id);
  S2.cool = 1e6;
  run(P, 40, i => ({ roll: i === 0, mz: i === 0 ? 1 : 0, attack: i === roll - 3 }));
  assert.equal(50 - S2.hp, 10, 'without it, the first cut');
  pass('Rising cut: Attack 0.05 s before a roll ends deals 14 and knocks a Snuffer down for 36 steps; without it, the first cut');
}
{ // Ember parry: Attack 3 steps before a hook lands, facing it: no damage, and the Snuffer staggers for 60 steps
  const W = fightOn({ zones: [], unlocks: ['parry'], hp: 100 });
  const r = W.F.spawn('S', 0, -2.0, 0), S = W.F.find(r.id);
  run(W, 1);
  assert.equal(S.move, 'hook');
  let down = null;
  run(W, 60, i => ({ attack: i === S.T.moves.hook.wind - 1 - 3 }), () => { if (S.state === 'down' && down === null) down = S.downFor; });
  assert.equal(W.rs.run.hp, 100, 'no damage');
  assert.equal(down, 60);
  const P = fightOn({ zones: [], hp: 100 });
  const r2 = P.F.spawn('S', 0, -2.0, 0), S2 = P.F.find(r2.id);
  run(P, 1);
  run(P, 60, i => ({ attack: i === S2.T.moves.hook.wind - 1 - 3 }));
  assert.equal(P.rs.run.hp, 84, 'without it, the hook lands');
  pass('Ember parry: a hook that lands in the first cut\'s wind-up does no damage and staggers the Snuffer 60 steps');
}
{ // Ember parry on a heavy foe: an Ironback's charge turned aside staggers it for 60 steps, whatever its poise
  const land = (unlocks, at) => {
    const W = fightOn({ zones: [], unlocks, hp: 100 });
    const r = W.F.spawn('I', 0, -5, 0), I = W.F.find(r.id);
    let hitAt = null, stag = null, k = 0;
    run(W, 240, i => ({ attack: at !== null && i === at }), i => {
      if (hitAt === null && W.hurts.length) hitAt = i;
      if (I.state === 'stagger' && stag === null) stag = { i, left: W.F.list().find(f => f.id === I.id).stagger };
      k = i;
      return !(hitAt !== null && at === null) && !(stag && i > stag.i + 70);
    });
    return { W, I, hitAt, stag, move: I.move, hp: W.rs.run.hp, k };
  };
  const plain = land([], null);
  assert(plain.hitAt !== null && plain.hp < 100, `without the parry the charge lands (${plain.hp})`);
  const p = land(['parry'], plain.hitAt - 3);
  assert.equal(p.hp, 100, 'no damage');
  assert(p.stag, 'the Ironback staggers');
  assert.equal(p.stag.left, 60, 'for 60 steps');
  assert.equal(p.I.state, 'chase', 'and then goes on');
  pass('Ember parry: an Ironback\'s charge turned aside does no damage and staggers it 60 steps', { lands: plain.hitAt, hp: plain.hp });
}

/* ---------------- elites ---------------- */
{ // each place has its elite, in a zone that is not the first or a guard, at 1.25 times the size
  const zones = { gaol: 'S', ramparts: 'P', fen: 'M', bells: 'I', barrows: 'S' };
  for (const [place, type] of Object.entries(zones)) {
    const W = fightOn({ place, zones: [{ id: 'A', c: [0, 0, 20], leash: 3, foes: 'S' }, { id: 'G', c: [8, 0, 0], leash: 3, foes: 'SS', guard: true }, { id: 'B', c: [-8, 0, 0], leash: 4, foes: place === 'bells' ? 'SS' : type }] });
    const E = W.F.elite();
    assert(E && E.zone.id === 'B', `${place}: the elite is in zone B`);
    assert.deepEqual([E.type, E.size, E.hp, E.T.glim, dressOf(E).crown, dressOf(E).slot], [type, 1.25, ELITES[place].hp, 15, true, 34]);
  }
  // the seed picks the zone among those that can hold it
  const picks = new Set();
  for (let seed = 1; seed <= 50; seed++) picks.add(eliteZone([{ foes: 'S' }, { foes: 'SS' }, { foes: 'SS' }, { foes: 'SSS', guard: true }], 'gaol', seed));
  assert.deepEqual([...picks].sort(), [1, 2]);
  pass('elites: one a place, never in the first zone or a guard zone, 1.25 times the size with 15 glim and a crown in slot 34; the seed picks the zone');
}
{ // the Wardmother: a second hook 21 steps after the first; a roll 0.2 s after the first lands passes the second in its safe time
  const W = fightOn({ zones: eliteZones('S', [0, 0, -2.0]) });
  const E = wakeElite(W);
  untilSpecial(W, E);
  assert.equal(specialSteps(E.special.def), 33 + 9 + 21 + 9 + 42);
  // after the first hook, the lamplighter is ready again (no safe time from it) and stands 1.6 m in front
  run(W, 200, {}, () => E.special.t < 42);
  W.R.fighter.f.safe = 0; W.R.fighter.f.move = null;
  W.R.fighter.body.place([E.x + Math.sin(E.yaw) * 1.6, 0.3, E.z + Math.cos(E.yaw) * 1.6], E.yaw + Math.PI);
  const hp = W.rs.run.hp;
  run(W, 12);
  const at = W.hurts.length;
  run(W, 30, i => ({ roll: i === 0, mz: i === 0 ? 1 : 0 }));
  const second = W.hurts.slice(at);
  assert(second.length >= 1 && second.every(h => h.r === 'safe' && h.safe === 'roll'), JSON.stringify(second));
  assert.equal(W.rs.run.hp, hp);
  pass('the Wardmother: a double hook of 0.9 s of warning; a roll 0.2 s after the first hook passes the second', { tries: second.length });
}
{ // the Rookchief: three ring markers 2.5 m apart for 1.0 s before the coals land
  const W = fightOn({ place: 'ramparts', zones: eliteZones('P', [0, 0, -7]) });
  const E = wakeElite(W);
  E.cool = 0;
  untilSpecial(W, E);
  let shown = 0, landed = null;
  run(W, 200, {}, i => { if (E.markers?.length === 3) shown++; if (landed === null && W.F.coals.length === 0 && E.special === null) landed = i; return landed === null; });
  const m = E.special?.aims;
  assert(shown >= 60, `the rings showed ${shown} steps`);
  pass('the Rookchief: three ring markers stand at least 1.0 s before the coals land', { shown });
}
{ // the Fen-wick: at 20 health with two Mirelight slots free it goes out, and two Mirelights of 14 stand in its place
  const W = fightOn({ place: 'fen', zones: eliteZones('M', [0, 0, -3]) });
  const E = wakeElite(W);
  E.hp = 20;
  const ev = run(W, 2);
  const ms = W.F.foes.filter(f => f.type === 'M' && !f.out && f !== E);
  assert(E.out, 'the Fen-wick goes out');
  assert.deepEqual(ms.map(m => m.hp), [14, 14]);
  assert(ev.some(e => e.type === 'elite' && e.what === 'fall'), 'its fall drops the relic');
  pass('the Fen-wick: at half health it splits into two Mirelights of 14');
}
{ // the Bellwether: the lane shows both its parts at least 0.4 s before the charge moves
  const W = fightOn({ place: 'bells', zones: eliteZones('I', [0, 0, -6]), x: 2 });
  const E = wakeElite(W);
  untilSpecial(W, E);
  let still = 0, moved = false, both = 0;
  const x0 = { x: E.x, z: E.z };
  run(W, 120, {}, () => {
    if (E.marker?.kind === 'lane' && E.marker.bend) both++;
    if (!moved && Math.hypot(E.x - x0.x, E.z - x0.z) > 0.05) moved = true;
    if (!moved && E.lane && E.special && E.special.t >= 54 - BUILD.parry.steps * 4) still++;
    return !moved;
  });
  assert(both >= 54, `both parts showed ${both} steps before the run`);
  pass('the Bellwether: both parts of the bent lane show before it moves', { both });
}
{ // the Cairnwarden: a jump 0.6 s into the sweep's wind-up, 2 m away, passes it; standing, it hits
  const sweep = jump => {
    const W = fightOn({ place: 'barrows', zones: eliteZones('S', [0, 0, -2]) });
    const E = wakeElite(W);
    W.R.fighter.body.place([E.x, 0.3, E.z + 2], Math.PI);
    untilSpecial(W, E);
    // the lamplighter is ready (no safe time left from an earlier hook) with 100 health, 2 m from the Cairnwarden
    W.R.fighter.f.safe = 0; W.R.fighter.f.move = null;
    W.R.fighter.body.place([E.x, 0.3, E.z + 2], Math.PI);
    W.rs.run.hp = 100;
    const t0 = E.special.t;
    run(W, 70, i => ({ jump: jump && i === 36 - t0 }));
    return W.rs.run.hp;
  };
  assert.equal(sweep(true), 100, 'a jump passes it');
  assert(sweep(false) < 100, 'standing, it hits');
  pass('the Cairnwarden: a jump 0.6 s into the sweep\'s wind-up passes it');
}
{ // an elite put out drops its relic; a touch takes it, with its toast; Kindled flask fills one flask
  const W = fightOn({ zones: eliteZones('S', [0, 0, -3]), unlocks: ['kflask'] });
  W.rs.run.flasks = 0;
  const heard = [];
  const off = [on('elite-fall', d => heard.push(['fall', d.relic])), on('relic-take', d => heard.push(['take', d.id]))];
  const E = wakeElite(W);
  const glim0 = W.F.motes.length;
  W.F.putOut(E.id);
  const ev = run(W, 2);
  assert.equal(W.rs.run.flasks, 1, '0 of 2 flasks becomes 1');
  assert.equal(W.F.motes.length - glim0, 15, '15 glim drop');
  const g = groundRelics(W.R);
  assert.equal(g.length, 1);
  W.R.fighter.body.place([g[0].x, 0.3, g[0].z], 0);
  const ev2 = run(W, 2);
  assert.deepEqual(W.rs.run.relics, [g[0].id]);
  assert(ev2.some(e => e.type === 'relic' && e.what === 'take' && e.text === relicLine(g[0].id)));
  assert.deepEqual(heard, [['fall', g[0].id], ['take', g[0].id]]);
  assert(ev.some(e => e.type === 'elite' && e.what === 'fall' && e.flask));
  off.forEach(f => f());
  pass('an elite put out drops 15 glim and a relic, a touch takes it, and Kindled flask fills a flask', { relic: g[0].id });
}
{ // Ember 4: a hit on the lamplighter deals 20% more (16 -> 19), and an elite picks its special move twice as often (40% -> 80%)
  const hit = em => {
    const setup = Object.assign(() => {}, { pre: rs => { rs.emberTop = em; rs.ember = em; } });
    const W = postRun({ setup });
    W.rs.run.ember = em; W.rs.run.hp = 100;
    W.R.hurt(16, [0, -1], {}, []);
    return 100 - W.rs.run.hp;
  };
  assert.deepEqual([hit(3), hit(4), hit(5)], [16, 19, 19]);
  assert.deepEqual([RUN.ember(3).special, RUN.ember(4).special], [1, 2]);
  pass('Ember 4: a hit of 16 takes 19, and the special-move share doubles', { e3: hit(3), e4: hit(4) });
}
{ // Ember 1: the elite has 30% more health. Ember 2: a Snuffer's hook winds up 33 steps, and its cooldown is 15% shorter
  const W = fightOn({ zones: eliteZones('S', [0, 0, -3]), ember: 1 });
  const E = wakeElite(W);
  assert.equal(E.hp, Math.round(120 * 1.3));
  const cool = em => {
    const X = fightOn({ zones: [], ember: em, seed: 3 });
    const r = X.F.spawn('S', 0, -2, 0), S = X.F.find(r.id);
    let wind = null, cd = null;
    run(X, 200, {}, () => { if (S.move === 'hook' && wind === null) wind = S.T.moves.hook.wind; if (S.cool > 0 && cd === null) cd = S.cool; return cd === null; });
    return { wind, cd, range: S.T.cool };
  };
  const a = cool(0), b = cool(2);
  assert.deepEqual([a.wind, b.wind], [33, 33]);
  assert.deepEqual(b.range.map(v => +v.toFixed(3)), a.range.map(v => +(v * 0.85).toFixed(3)));
  pass('Ember 1: the Wardmother has 156 health; Ember 2: the hook still winds up 33 steps, and the cooldown is 15% shorter', { a: a.range, b: b.range });
}

/* ---------------- the Ember levels ---------------- */
{
  const rs = RS.fresh();
  assert(!setEmber(rs, 1), 'Ember 1 is not open before a win');
  startRun(rs, 4);
  goTo(rs, 'barrows');
  rs.run.time = 1500;
  lightBeacon(rs);
  assert.deepEqual([rs.emberTop, rs.ember, rs.bestByEmber[0], rs.ended.opened], [1, 0, 1500, 1]);
  assert.deepEqual(emberRow(rs).map(b => [b.label, b.on]), [['Ember 0', true], ['Ember 1', false]]);
  assert(setEmber(rs, 1));
  rs.ended = null;
  startRun(rs, 4);
  assert.equal(rs.run.ember, 1);
  // Ember 1: the route orders places II to IV; the Gaol first and Barrow Crown last
  const routes = new Set();
  for (let seed = 1; seed <= 60; seed++) { const r = routeFor(seed, 1); assert(r[0] === 'gaol' && r[4] === 'barrows' && new Set(r).size === 5); routes.add(r.join()); }
  assert(routes.size >= 4, `${routes.size} orders`);
  assert.deepEqual(routeFor(9, 0), ORDER);
  // the run goes through its route: Walk on after the first beacon loads the route's second place
  const r2 = rs.run.route;
  rs.run.offer = null;
  lightBeacon(rs);
  assert.equal(rs.run.place, r2[1]);
  assert.deepEqual(routeOf(rs.run.place, r2).map(p => p.id), r2);
  // 15% more glim a level: a Snuffer's 3 is 3 at Ember 1 (rounded down), a wisp's 4 is 4, the elite's 15 is 17
  assert.deepEqual([1, 2, 5].map(glimFactor).map(k => Math.floor(15 * k + 1e-9)), [17, 19, 26]);
  // Ember 2: one flask fewer; Ember 3: flasks heal 10% less; the win card shows the level and its best
  const e2 = RS.fresh();
  e2.emberTop = 3; e2.ember = 2;
  startRun(e2, 5);
  assert.equal(e2.run.flasks, 1);
  e2.ember = 3;
  startRun(e2, 5);
  assert.equal(healNow(e2), 25);
  e2.ended = { won: true, place: 'barrows', time: 1300, foes: 40, lost: 0, banked: 300, ember: 3 };
  e2.bestByEmber[3] = 1300;
  assert.deepEqual(winOf(e2).rows.slice(0, 2), [['Ember', 'Ember 3'], ['Time', '21:40']]);
  pass('Ember: a win opens the next level; the route orders places II to IV; one flask fewer at 2; 25% heals at 3; the win card shows the level', { routes: routes.size });
}

/* ---------------- the save ---------------- */
{ // bad v2 fields are dropped
  const bad = [
    { unlocks: ['rising', 'sword', 'rising', 5], ember: 4, emberTop: 2, bestByEmber: [10, 'x', -4], shake: 'yes' },
    { emberTop: 99, ember: 3, run: { place: 'fen', relics: ['trail', 'trail', 'ring', 'echo'], route: ['gaol', 'gaol', 'fen', 'bells', 'barrows'], ember: 9, elitesDown: ['moon', 'gaol'] } }
  ];
  const a = RS.clean(bad[0]);
  assert.deepEqual([a.unlocks, a.ember, a.emberTop, a.bestByEmber.slice(0, 3), a.shake], [['rising'], 0, 2, [10, 0, 0], null]);
  const b = RS.clean(bad[1]);
  assert.deepEqual([b.emberTop, b.ember, b.run.relics, b.run.ember, b.run.elitesDown, b.run.route[0], new Set(b.run.route).size], [5, 3, ['trail', 'echo'], 5, ['gaol'], 'gaol', 5]);
  pass('the save: unknown unlocks and relics, a level over emberTop, a bad route and bad bests are dropped');
}
{ // from v1 (with no v2): the bank and levels come over, v3 is stored at once, and a later v1 write changes nothing
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  mem.set(RS.OLD_KEY, JSON.stringify({ v: 1, bank: 300, up: { mantle: 2 }, runs: 4 }));
  const s = RS.load(storage);
  assert.deepEqual([s.bank, s.up.mantle, s.v, mem.has(RS.KEY)], [300, 2, 3, true]);
  mem.set(RS.OLD_KEY, JSON.stringify({ v: 1, bank: 5, up: {} }));
  assert.deepEqual([RS.load(storage).bank, RS.load(storage).up.mantle], [300, 2]);
  assert.deepEqual(RS.load(null), RS.fresh());
  pass('from v1: 300 glim and Mantle 2 come over and v3 is stored; a later v1 write does not change v3');
}
{ // a run at Ember 1 in Lantern Fen with Ember trail, 30 banked and 7 foes comes back from the save
  const rs = RS.fresh();
  rs.emberTop = 1; rs.ember = 1;
  startRun(rs, 21);
  goTo(rs, 'fen');
  Object.assign(rs.run, { banked: 30, foes: 7, relics: ['trail'], elitesDown: ['gaol'] });
  enter(rs.run);
  const back = RS.clean(JSON.parse(JSON.stringify(rs)));
  assert.deepEqual([back.run.route, back.run.place, back.run.relics, back.run.banked, back.run.foes, back.run.ember, back.run.entry.relics], [rs.run.route, 'fen', ['trail'], 30, 7, 1, ['trail']]);
  // a reload restarts the place with the relics it was entered with
  back.run.relics.push('echo');
  reload(back.run);
  assert.deepEqual(back.run.relics, ['trail']);
  pass('the run in the save: the route, the place, Ember trail, 30 banked, 7 foes and the entry come back');
}

/* ---------------- screens and the bus ---------------- */
{
  const rs = RS.fresh();
  startRun(rs, 2);
  rs.run.relics = ['trail', 'echo'];
  rs.run.wicks = ['heels'];
  assert.deepEqual(relicMarks(rs.run).map(m => [m.mark, m.kindled]), [['Tr', true], ['Ec', false]]);
  // a listener that throws does not stop the next
  let got = 0;
  const off = [on('foes-alert', () => { throw new Error('boom'); }), on('foes-alert', () => { got++; })];
  const err = console.error;
  console.error = () => {};
  emit('foes-alert', {});
  console.error = err;
  off.forEach(f => f());
  assert.equal(got, 1);
  assert.equal(EVENTS.length, 24); // with life-stir (gloam-downs-screens-life)
  pass('the screens: relic marks with Kindled; the bus: a listener that throws does not stop the next');
}

/* ---------------- the elite wakes again ---------------- */
{
  // wake the Wardmother, walk out of its leash until its zone sleeps, come back: the toast's event and elite-alert come again
  const W = fightOn({ zones: eliteZones('S', [0, 0, -6]) });
  const alerts = [], off = on('elite-alert', d => alerts.push(d.name));
  const E = wakeElite(W);
  let toasts = run(W, 2).filter(e => e.type === 'elite' && e.what === 'alert').length;
  assert.equal(alerts.length, 1, 'the first wake sends elite-alert once');
  W.s.x = 0; W.s.z = 22; W.s.vx = W.s.vz = 0;
  let k = 0;
  run(W, 3000, {}, () => { k++; return E.zone.awake; });
  assert(!E.zone.awake, `the elite's zone sleeps once the lamplighter is far (${k} steps)`);
  W.s.z = 0;
  toasts += run(W, 600, {}, () => !E.zone.awake || alerts.length < 2).filter(e => e.type === 'elite' && e.what === 'alert').length;
  off();
  assert(E.zone.awake, 'the zone wakes when the lamplighter comes back');
  assert.equal(alerts.length, 2, 'the second wake sends elite-alert again');
  pass('the elite wakes again: its zone sleeps when the lamplighter leaves, and the next wake sends elite-alert and the toast again', { sleepSteps: k, toasts: toasts + 1 });
}

console.log(`${n} checks passed`);
