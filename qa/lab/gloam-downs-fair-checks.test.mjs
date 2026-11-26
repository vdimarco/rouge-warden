// Gloam Downs: the fair fight's second pass (openspec/changes/gloam-downs-fair-fight, after the checker), in node with no browser, on
// made-up flat ground with the page's own foes.js, elites.js, run.js and moves.js:
//   an elite's special move cut off gives its token back (a death, a poise break, a stun, a guard that takes the slots); the blows on
//   their way count every active phase of a special and a lob until its coal leaves the hand; the snap once a step; a stun or a hold
//   lets the flinch count on; a knock-down in a wind-up counts as a cancel; a foe cut out of its attack comes back steeled; every wind-up
//   of a heavy foe is armored; the poise holds full in the 4 s after a stagger; the hook's ground tell.
// Run: node qa/lab/gloam-downs-fair-checks.test.mjs
import assert from 'node:assert/strict';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner } from '../../public/lab/gloam-downs/run.js';
import { HITS } from '../../public/lab/gloam-downs/moves.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { makeFoes, TYPES, FAIR, ARMOR, phaseOf, rimOf, armored, hookWind } from '../../public/lab/gloam-downs/foes.js';
import { STAGGER } from '../../public/lab/gloam-downs/feel.js';
import { specialPhase } from '../../public/lab/gloam-downs/elites.js';
import { statusHit } from '../../public/lab/gloam-downs/status.js';

let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };

function layered(fn, half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz, cells = new Int16Array(2 * N);
  let k = 0;
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++, k++) { const v = fn(info.x0 + i * info.step, info.z0 + j * info.step); cells[k] = cells[N + k] = Math.round(v * 100); }
  return makeWalk(info, cells);
}
const FLAT = layered(() => 0);
function fightOn({ x = 0, z = 0, yaw = Math.PI, slots = 'SSSSSPPPMI', zones = [], seed = 7, hp = 5000, id, tokens = 1 } = {}) {
  const rs = RS.fresh();
  startRun(rs, seed);
  rs.run.hp = hp;
  const body = makeBody(FLAT, { p: [x, 0.5, z], yaw }, 20, { ...PARAMS });
  const F = makeFoes({ walk: FLAT, meta: { zones, bounds: 20, id }, slots, seed, tokens });
  const hurts = [];
  const R = makeRunner({ walk: FLAT, meta: { wisps: [], beacon: { p: [90, 0, 90], r: 1 } }, body, rs, targets: F.targets, lightable: F.lightable, drop: F.drop, think: F.think, onLight: F.bank });
  R.fighter.maxHp = () => hp;
  const hurt = R.hurt;
  R.hurt = (...a) => { const r = hurt(...a); hurts.push({ r, dmg: a[0], step: F.step }); return r; };
  F.bind(R);
  return { rs, body, s: body.s, F, R, hurts };
}
function run(W, count, inp = {}, each = null) {
  const all = [];
  for (let i = 0; i < count; i++) {
    for (const e of W.R.step(typeof inp === 'function' ? inp(i) : inp, 0)) all.push({ ...e, i });
    if (each && each(i) === false) break;
  }
  return all;
}
const spawn = (W, type, x, z, yaw = 0) => { const r = W.F.spawn(type, x, z, yaw); assert(r.ok, JSON.stringify(r)); return W.F.find(r.id); };
const ph = f => (f.move ? phaseOf(f.T.moves[f.move], f.mt) : null);
const cut = (W, f, id) => { const h = HITS.find(x => x.id === id); return f.hit(h.dmg, { from: [W.s.x, W.s.z], push: h.push, knock: h.knock, stagger: !!h.stagger, kind: h.id }); };
const untilMove = (W, f, name, max = 400) => { for (let i = 0; i < max; i++) { if (f.move === name) return i; run(W, 1); } throw new Error(`${f.id} never started ${name}`); };
// an elite in its zone, awake, made to choose its special move at once
function eliteOn(place, type, zc = [0, 0, -3]) {
  const W = fightOn({ id: place, zones: [{ id: 'G1', c: [0, 0, -16], leash: 3, foes: type }, { id: 'G2', c: zc, leash: 6, foes: type, elite: 0 }] });
  W.F.wake('G2');
  run(W, 70);
  const E = W.F.elite();
  assert(E && E.elite, `the ${place} elite stands`);
  return { W, E };
}
function untilSpecial(W, E, max = 600) {
  for (let i = 0; i < max; i++) { if (E.special) return i; E.cool = 0; E.pick = true; E.wait = 0; run(W, 1); }
  throw new Error(`${E.id} never started its special move`);
}

/* ---------------- an elite's special move cut off ---------------- */
{ // the Wardmother put out in her double hook's wind-up: the token goes back, and a new Snuffer hooks
  const { W, E } = eliteOn('gaol', 'S');
  untilSpecial(W, E);
  run(W, 5);
  assert.equal(specialPhase(E.special.def, E.special.t).ph, 'w');
  W.F.putOut(E.id);
  run(W, 2);
  assert.equal([...W.F.melee].length, 0, `the melee token is held by ${[...W.F.melee].map(g => `${g.id} ${g.state}`)}`);
  assert.equal(E.special, null, 'her special move ended');
  const S = spawn(W, 'S', 0, -2, 0);
  let hooked = -1;
  run(W, 600, {}, i => { if (hooked < 0 && S.move === 'hook') { hooked = i; return false; } });
  assert(hooked >= 0, 'a new Snuffer never hooked');
  pass('the Wardmother put out in her double hook: her token goes back and a new Snuffer hooks', { after: hooked });
}
{ // the Rookchief put out in its three coals' wind-up: the coal token goes back, and a Pitchrook lobs
  const { W, E } = eliteOn('ramparts', 'P', [0, 0, -6]);
  untilSpecial(W, E);
  run(W, 10);
  W.F.putOut(E.id);
  run(W, 2);
  assert.equal(W.F.coal, null, `the coal token is held by ${W.F.coal?.id}`);
  const P = spawn(W, 'P', 0, 6, Math.PI);
  let lobbed = -1;
  run(W, 900, {}, i => { if (lobbed < 0 && P.move === 'lob') { lobbed = i; return false; } });
  assert(lobbed >= 0, 'a new Pitchrook never lobbed');
  pass('the Rookchief put out in its three coals: the coal token goes back and a Pitchrook lobs', { after: lobbed });
}
{ // a poise break in the Wardmother's special move ends it at once, and gives the token back
  const { W, E } = eliteOn('gaol', 'S');
  untilSpecial(W, E);
  run(W, 3);
  E.hit(30, { from: [W.s.x, W.s.z], kind: 'cut2' });
  assert.equal(E.state, 'stagger', 'her poise broke');
  assert.equal(E.special, null, 'the special move ended at the break');
  assert.equal(W.F.melee.has(E), false, 'her token went back at the break');
  pass('a poise break in a special move ends it and gives the token back', { state: E.state });
}
{ // a Flare's stun in the special move ends it too
  const { W, E } = eliteOn('gaol', 'S');
  untilSpecial(W, E);
  run(W, 3);
  statusHit(E, 'stun', 60);
  run(W, 1);
  assert.equal(E.special, null, 'the stun ended the special move');
  assert.equal(W.F.melee.has(E), false, 'the token went back');
  pass('a stun in a special move ends it and gives the token back');
}
{ // a guard that takes the zone's slots while the elite is in its special move: the token goes back as its zone sinks
  const W = fightOn({ id: 'gaol', slots: 'SS', tokens: 2, zones: [{ id: 'G2', c: [0, 0, -3], leash: 6, foes: 'SS', elite: 0 }, { id: 'K', c: [0, 0, 15], leash: 4, foes: 'SS', guard: true, keeper: 'the keep' }] });
  W.F.wake('G2');
  run(W, 70);
  const E = W.F.elite(), other = W.F.foes.find(f => f.zone.id === 'G2' && f !== E);
  other.cool = 9999;
  untilSpecial(W, E);
  run(W, 3);
  assert.equal(W.F.wake('K').ok, true, 'the guard takes the slots');
  run(W, 2);
  assert.equal(E.special, null);
  assert.equal(W.F.melee.has(E), false, 'the token went back');
  pass('a guard that takes the slots in a special move: the token goes back');
}

/* ---------------- the blows on their way ---------------- */
{ // the Wardmother's second hook is counted, also once her first hook's active time has begun
  const { W, E } = eliteOn('gaol', 'S');
  untilSpecial(W, E);
  for (let i = 0; i < 200 && specialPhase(E.special.def, E.special.t).i < 1; i++) run(W, 1);
  const P = specialPhase(E.special.def, E.special.t), d = E.special.def;
  assert.equal(P.ph, 'a');
  const second = d.phases.slice(0, 3).reduce((a, [, k]) => a + k, 0);
  const want = W.F.step + (second - E.special.t);
  assert(W.F.due().some(t => Math.abs(t - want) <= 1), `due ${W.F.due()} wants ${want}`);
  pass('the blows on their way: the Wardmother\'s second hook counts', { want });
}
{ // a lob between its first active step and its release: its coal's landing counts
  const W = fightOn();
  const P = spawn(W, 'P', 0, -6, 0);
  untilMove(W, P, 'lob');
  const M = P.T.moves.lob;
  while (P.mt < M.wind + 1) run(W, 1);
  assert.equal(W.F.coals.length, 0, 'the coal has not left the hand');
  const want = W.F.step + (M.wind + M.release - P.mt) + M.flight;
  assert(W.F.due().some(t => Math.abs(t - want) <= 1), `due ${W.F.due()} wants ${want}`);
  pass('the blows on their way: a lob before its release counts its coal', { want });
}
{ // a foe put out has no blow on its way
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  untilMove(W, S, 'hook');
  const before = W.F.due().length;
  S.special = { def: { kind: 'hooks', phases: [['w', 30], ['a', 9], ['r', 40]] }, t: 0 };
  S.out = true;
  assert(W.F.due().length < before, 'a foe put out counts no blow');
  pass('the blows on their way: none from a foe put out');
}

/* ---------------- the snap once a step ---------------- */
{
  const W = fightOn({ tokens: 2 });
  const A = spawn(W, 'S', -0.6, -1.5, 0), B = spawn(W, 'S', 0.6, -1.5, 0);
  for (const f of [A, B]) { W.F.hold(f.id, 'hook', 0.1); W.F.hold(f.id, null); W.F.melee.add(f); }
  cut(W, A, 'cut1');
  cut(W, B, 'cut1');
  const ev = run(W, 1);
  const stops = ev.filter(e => e.type === 'stop' && e.n === FAIR.snapStop).length, snaps = ev.filter(e => e.type === 'snap');
  const cues = W.R.log.filter(c => c.cue === 'snap').length;
  assert.equal(A.move, null); assert.equal(B.move, null);
  assert.equal(snaps.length, 2, 'two foes stopped');
  assert.equal(snaps.filter(e => e.first !== false).length, 1, 'one snap feels');
  assert.equal(stops, 1, `${stops} hit stops`);
  assert.equal(cues, 1, `${cues} snap cues`);
  pass('the snap once a step: one hit stop, one cue and one kick for two foes stopped', { stops, cues });
}

/* ---------------- a stun or a hold, and a knock-down in a wind-up ---------------- */
{ // a flinch counts on in a hold
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  S.cool = 999;
  run(W, 2);
  cut(W, S, 'cut1');
  assert.equal(S.flinch, TYPES.S.stun);
  statusHit(S, 'hold', 120);
  run(W, 40);
  assert.equal(S.flinch, 0, `flinch ${S.flinch} after 40 steps held`);
  pass('a hold lets the flinch count on', { flinch: S.flinch });
}
{ // the finisher in a hook's wind-up is a cancel
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  untilMove(W, S, 'hook');
  run(W, 4);
  cut(W, S, 'fin');
  assert.equal(S.state, 'down');
  assert.equal(S.cancels, 1);
  pass('a knock-down in a wind-up counts as a cancel', { cancels: S.cancels });
}

/* ---------------- the brace holds ---------------- */
{ // a braced Snuffer takes the finisher standing: no knock-down, the damage, and it stays braced for its 1.5 s
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  S.cool = 999; S.hp = 500;
  cut(W, S, 'cut1'); run(W, 20);
  cut(W, S, 'cut2'); run(W, 20);
  cut(W, S, 'fin');
  assert.equal(S.state, 'down');
  assert.equal(S.braced, FAIR.brace, 'braced for 1.5 s');
  run(W, 200, {}, () => S.state === 'down');
  const hp = S.hp;
  cut(W, S, 'fin');
  assert.notEqual(S.state, 'down', 'a braced foe is not knocked down');
  assert(S.hp < hp, 'it takes the damage');
  pass('the brace holds: a braced Snuffer takes the finisher standing', { brace: FAIR.brace });
}

/* ---------------- steeled ---------------- */
{ /* a Snuffer cut out of its hook shows 2 rim dabs; its next hook, begun within 4 s, is armored (8 dabs), a cut does not stop it, and it
     lands; the hook after that is plain again and a cut stops it */
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  untilMove(W, S, 'hook');
  run(W, 6);
  cut(W, S, 'cut1');
  assert.equal(S.move, null, 'the first hook is cancelled');
  const at = W.F.step;
  assert.equal(rimOf(S, W.F.step)?.n, ARMOR.steeled, 'steeled: 2 rim dabs');
  untilMove(W, S, 'hook');
  assert(W.F.step - at < FAIR.steel, 'the next hook within 4 s');
  run(W, 4);
  assert.equal(armored(S), true, 'the steeled hook is armored');
  assert.equal(rimOf(S, W.F.step)?.n, ARMOR.braced * 2, 'the rim doubles');
  const hurts0 = W.hurts.length;
  cut(W, S, 'cut1');
  assert.equal(S.move, 'hook', 'a cut does not stop a steeled hook');
  run(W, 40);
  assert(W.hurts.length > hurts0, 'the steeled hook landed');
  assert.equal(rimOf(S, W.F.step), null, 'the steel is spent');
  run(W, 200, {}, () => S.move !== null);
  S.wait = 0; S.cool = 0;
  untilMove(W, S, 'hook');
  run(W, 4);
  assert.equal(armored(S), false, 'the hook after is plain');
  cut(W, S, 'cut1');
  assert.equal(S.move, null, 'a cut stops it again');
  pass('steeled: the hook after a cancel is armored and lands, the one after is plain', { steel: FAIR.steel });
}
{ // the steel lapses after 4 s
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  untilMove(W, S, 'hook');
  run(W, 6);
  cut(W, S, 'cut1');
  S.cool = 999;
  const at = W.F.step;
  run(W, 400, {}, () => W.F.step < at + FAIR.steel + 1);
  assert.equal(rimOf(S, W.F.step), null, 'no rim after 4 s');
  S.cool = 0; S.wait = 0;
  untilMove(W, S, 'hook');
  run(W, 3);
  assert.equal(armored(S), false, 'a hook after the steel lapsed is plain');
  pass('steeled: the steel lapses after 4 s');
}

/* ---------------- every wind-up of a heavy foe is armored ---------------- */
{
  const W = fightOn();
  const I = spawn(W, 'I', 0, -2.2, 0);
  untilMove(W, I, 'slam');
  run(W, 3);
  assert.equal(armored(I), true, 'the slam is armored');
  assert.equal(rimOf(I, W.F.step).n, 8, 'the slam\'s rim doubles');
  const { W: W2, E } = eliteOn('gaol', 'S');
  E.pick = false; E.cool = 0;
  let k = 0;
  for (; k < 400 && E.move !== 'hook'; k++) { E.pick = false; run(W2, 1); }
  assert.equal(E.move, 'hook', 'the Wardmother hooks');
  run(W2, 3);
  assert.equal(armored(E), true, 'her plain hook is armored');
  assert.equal(rimOf(E, W2.F.step).n, 8, 'her rim doubles');
  pass('every heavy wind-up is armored: the Ironback\'s slam and the Wardmother\'s plain hook show 8 dabs');
}

/* ---------------- the poise holds after a stagger ---------------- */
{
  const W = fightOn();
  const I = spawn(W, 'I', 0, -6, 0);
  I.cool = 999;
  I.hit(45, { from: [W.s.x, W.s.z], kind: 'fin' });
  assert.equal(I.state, 'stagger');
  for (let i = 0; i < STAGGER.steps + 20 && I.state === 'stagger'; i++) { I.cool = 999; run(W, 1); }
  run(W, 2);
  assert.notEqual(I.state, 'stagger');
  I.hit(21, { from: [W.s.x, W.s.z], kind: 'cut2' });
  I.hit(21, { from: [W.s.x, W.s.z], kind: 'cut2' });
  assert.notEqual(I.state, 'stagger', 'no second stagger in 4 s');
  assert.equal(rimOf(I, W.F.step)?.n, 4, `the rim holds 4 dabs (${rimOf(I, W.F.step)?.n})`);
  pass('the poise holds full in the 4 s after a stagger, and its rim with it');
}

/* ---------------- the hook's ground tell ---------------- */
{
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  assert.equal(hookWind(S), null);
  untilMove(W, S, 'hook');
  run(W, 10);
  const k = hookWind(S);
  assert(k > 0.2 && k < 0.4, `k ${k}`);
  run(W, 30);
  assert.equal(ph(S), 'act');
  assert.equal(hookWind(S), null);
  pass('the hook\'s ground tell shows in the wind-up only', { k: +k.toFixed(2) });
}

console.log(`${n} checks passed`);
