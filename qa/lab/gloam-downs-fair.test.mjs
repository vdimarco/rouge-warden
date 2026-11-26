// Gloam Downs: the fair fight (openspec/changes/gloam-downs-fair-fight), checked in node with no browser, on made-up flat ground with
// the page's own foes.js, elites.js, run.js and moves.js:
//   the weights and the hit stun; a cut into a hook cancels it (the token back, the stun, the wait); a coal never thrown; ticks that
//   do not interrupt; a blow already falling and hits in the recovery; the brace (the third flinch, and no endless flinch for a bot
//   that mashes three Snuffers); the armor rim and the armored charge; an elite that holds; blow spacing and the wait after a hurt;
//   backing off; the off-screen tell; the foes' growth with sparks and a spark that is worth it.
// Run: node qa/lab/gloam-downs-fair.test.mjs
import assert from 'node:assert/strict';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner, foeScale, tokensOf, PACE } from '../../public/lab/gloam-downs/run.js';
import { SPARK, levelGain } from '../../public/lab/gloam-downs/growth.js';
import { HITS } from '../../public/lab/gloam-downs/moves.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { makeFoes, TYPES, FAIR, FOE_HARD, ARMOR, phaseOf, rimOf, armored } from '../../public/lab/gloam-downs/foes.js';
import { STAGGER } from '../../public/lab/gloam-downs/feel.js';
import { ELITES } from '../../public/lab/gloam-downs/elites.js';

let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;

function layered(fn, half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz, cells = new Int16Array(2 * N);
  let k = 0;
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++, k++) { const v = fn(info.x0 + i * info.step, info.z0 + j * info.step); cells[k] = cells[N + k] = Math.round(v * 100); }
  return makeWalk(info, cells);
}
const FLAT = layered(() => 0);

/* a fight on flat ground: a run with seed 7, the lamplighter at (x, z) facing yaw (π faces -z), the foes with these zones and slots,
   tokens and scale, stepped by the runner. hp sets the health */
function fightOn({ x = 0, z = 0, yaw = Math.PI, slots = 'SSSSSPMI', zones = [], seed = 7, hp, id, tokens = 1, scale = null, onScreen, tellFree } = {}) {
  const rs = RS.fresh();
  startRun(rs, seed);
  if (hp) rs.run.hp = hp;
  const body = makeBody(FLAT, { p: [x, 0.5, z], yaw }, 20, { ...PARAMS });
  const F = makeFoes({ walk: FLAT, meta: { zones, bounds: 20, id }, slots, seed, tokens, scale, onScreen, tellFree });
  const hurts = [];
  const R = makeRunner({ walk: FLAT, meta: { wisps: [], beacon: { p: [90, 0, 90], r: 1 } }, body, rs, targets: F.targets, lightable: F.lightable, drop: F.drop, think: F.think, onLight: F.bank });
  const hurt = R.hurt;
  R.hurt = (...a) => { const r = hurt(...a); hurts.push({ r, dmg: a[0], play: R.clock.play, step: F.step }); return r; };
  F.bind(R);
  return { rs, body, s: body.s, F, R, hurts, log: R.log };
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
const damage = W => W.hurts.filter(h => h.r === 'hit' || h.r === 'dead');
const ph = f => (f.move ? phaseOf(f.T.moves[f.move], f.mt) : null);
// play until the foe starts a move (or n steps)
const untilMove = (W, f, name, max = 300) => { for (let i = 0; i < max; i++) { if (f.move === name) return i; run(W, 1); } throw new Error(`${f.id} never started ${name}`); };
// a hit as the blade's: from the lamplighter, its id's push and knock
const cut = (W, f, id) => { const h = HITS.find(x => x.id === id); return f.hit(h.dmg, { from: [W.s.x, W.s.z], push: h.push, knock: h.knock, stagger: !!h.stagger, kind: h.id }); };

/* ---------------- Foe weights ---------------- */
{
  const want = { S: ['medium', 21, 0.4], P: ['light', 27, 0.6], M: ['light', 30, 0.8] };
  for (const [t, [w, stun, knock]] of Object.entries(want)) assert.deepEqual([TYPES[t].weight, TYPES[t].stun, TYPES[t].knock], [w, stun, knock], t);
  assert.equal(TYPES.I.weight, 'heavy');
  // every elite counts as heavy, whatever its type
  const W = fightOn({ id: 'gaol', zones: [{ id: 'G1', c: [0, 0, -12], leash: 3, foes: 'S' }, { id: 'G2', c: [0, 0, -3], leash: 6, foes: 'S', elite: 0 }] });
  W.F.wake('G2');
  run(W, 70);
  const E = W.F.elite();
  assert(E && E.elite, 'the Wardmother stands');
  assert.equal(W.F.list().find(f => f.id === E.id).weight, 'heavy');
  pass('the weights: the Snuffer medium with 21 steps of stun, the Pitchrook light with 27, the Mirelight light with 30, the Ironback and each elite heavy', want);
}

/* ---------------- A hit interrupts ---------------- */
{ // cut into a hook: the Snuffer 1.6 m in front starts its hook; Attack 0.2 s later; the cut lands in the wind-up and the hook never lands
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  untilMove(W, S, 'hook');
  run(W, 12);
  const hp0 = W.rs.run.hp;
  let landedAt = -1, stunAfter = -1, tokens = -1;
  run(W, 20, i => ({ attack: i === 0 }), i => { if (landedAt < 0 && S.flash > 0) { landedAt = i; stunAfter = S.flinch; tokens = W.F.melee.size; } });
  assert(landedAt >= 0, 'the cut landed');
  assert.equal(S.move, null, 'the hook is cancelled');
  assert.equal(stunAfter, 21, `stun ${stunAfter}`);
  assert.equal(tokens, 0, 'the token came back at once');
  assert.equal(S.cancels, 1);
  const cue = W.log.find(c => c.cue === 'snap');
  assert(cue && cue.kind === 'S', 'the snap cue with the foe type');
  run(W, 60);
  assert.equal(W.rs.run.hp, hp0, 'no health lost in the next 1.0 s');
  pass('cut into a hook: the hook is cancelled, 21 steps of stun, the token back, the snap, and no health lost in the next 1.0 s', { landedAt, stunAfter });
}
{ // the wait after a cancel: its next wind-up starts no sooner than 57 steps after the cancel
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  untilMove(W, S, 'hook');
  run(W, 8);
  cut(W, S, 'cut1');
  const at = W.F.step;
  let next = -1;
  run(W, 200, {}, () => { if (next < 0 && S.move === 'hook') next = W.F.step; });
  assert(next - at >= 57, `the next wind-up ${next - at} steps after the cancel`);
  pass('the wait after a cancel: the next wind-up no sooner than 57 steps (0.35 s stun and 0.6 s wait)', { after: next - at });
}
{ // a coal never thrown: a cut 0.5 s into a lob
  const W = fightOn();
  const P = spawn(W, 'P', 0, -1.4, 0);
  W.F.hold(P.id, 'lob', 0.5);
  assert.equal(W.F.coal, null);
  W.F.coal = P; // as startMove takes it
  W.F.hold(P.id, null);
  cut(W, P, 'cut1');
  assert.equal(P.move, null, 'the lob is cancelled');
  run(W, 40);
  assert.equal(W.F.coals.length, 0, 'no coal flies');
  assert.equal(P.marker, null, 'its ring goes from the ground');
  assert.equal(W.F.coal === P, false, 'the coal token is free');
  pass('a coal never thrown: no coal, no ring, the coal token free', { coal: W.F.coal ? W.F.coal.id : null });
}
{ // ticks do not interrupt: a pitch tick in the hook's wind-up hurts it, and the hook still lands
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  untilMove(W, S, 'hook');
  run(W, 5);
  const hp = S.hp;
  S.hit(3, { from: [W.s.x, W.s.z], push: 0, knock: 0, kind: 'ability', ability: 'pitch' });
  S.hit(3, { from: [W.s.x, W.s.z], push: 0, knock: 0, kind: 'ability', ability: 'bomb' });
  assert(S.hp < hp && S.move === 'hook', 'hurt, and the hook goes on');
  run(W, 40);
  assert.equal(damage(W).length, 1, 'the hook landed');
  // an ability hit with interrupt cancels
  const W2 = fightOn();
  const S2 = spawn(W2, 'S', 0, -1.6, 0);
  untilMove(W2, S2, 'hook');
  S2.hit(5, { from: [W2.s.x, W2.s.z], push: 0, knock: 0, kind: 'ability', ability: 'moth', interrupt: true });
  assert.equal(S2.move, null, 'Moth wisp cancels');
  pass('ticks do not interrupt: a pitch tick hurts and the hook lands; a Moth wisp hit cancels');
}

/* ---------------- Hits in every state ---------------- */
const recOf = (W, S) => { let rec = 0; run(W, 200, {}, () => { if (S.move === 'hook' && ph(S) === 'rec') rec++; if (!S.move) return false; }); return rec; };
{ // a blow already falling: a cut in the active time; the hook may still land, and the recovery is 0.9 s
  const once = hit => {
    const W = fightOn({ hp: 500 });
    const S = spawn(W, 'S', 0, -1.6, 0);
    W.F.hold(S.id, 'hook', 34 / 60);
    W.F.hold(S.id, null);
    if (hit) cut(W, S, 'cut1');
    assert.equal(ph(S), 'act', 'the blow goes on');
    const rec = recOf(W, S);
    assert.equal(damage(W).length, 1, 'the hook landed');
    return rec;
  };
  const plain = once(false), rec = once(true);
  assert.equal(plain, 42, `a plain recovery ${plain} steps`);
  assert.equal(rec, 54, `recovery ${rec} steps`);
  pass('a blow already falling: the hook lands, and its recovery is 0.9 s, not 0.7 s', { plain, rec });
}
{ // three cuts in the recovery: 1.1 s
  const W = fightOn({ x: 0, z: 5 });
  const S = spawn(W, 'S', 0, -1.6, 0);
  W.F.hold(S.id, 'hook', 45 / 60);
  W.F.hold(S.id, null);
  for (const id of ['cut1', 'cut2', 'cut1']) cut(W, S, id);
  const rec = recOf(W, S) + (45 - 42 + 1);
  assert.equal(S.recAdd, 0);
  assert.equal(rec, 66, `recovery ${rec} steps`);
  pass('hits in recovery: three cuts make it 1.1 s (0.7 s and at most 0.4 s more)', { rec });
}

/* ---------------- The brace ---------------- */
{ // the third flinch: cut1, cut2 and the finisher within 1 s; braced for the rest of the 1.0 s after the knock-down, and it glows
  const W = fightOn();
  const S = spawn(W, 'S', 0, -1.6, 0);
  cut(W, S, 'cut1'); run(W, 20);
  cut(W, S, 'cut2'); run(W, 20);
  cut(W, S, 'fin');
  assert.equal(S.state, 'down');
  assert.equal(S.braced, FAIR.brace);
  run(W, 37);
  assert.notEqual(S.state, 'down');
  const v = W.F.list().find(f => f.id === S.id);
  // the brace counts while it stands, so it gets up with nearly all of its 1.0 s left
  assert(v.braced >= FAIR.brace - 2 && v.braced <= FAIR.brace, `braced ${v.braced}`);
  assert.equal(rimOf(S, W.F.step)?.n, ARMOR.braced, 'the rim of a braced foe');
  // braced: a plain cut does not flinch it, and does not cancel its wind-up
  S.wait = 0; S.cool = 0;
  W.F.hold(S.id, 'hook', 0.1); W.F.hold(S.id, null); W.F.melee.add(S);
  assert(armored(S), 'a braced wind-up is armored');
  cut(W, S, 'cut1');
  assert.equal(S.move, 'hook', 'a braced wind-up goes on');
  assert.equal(S.flinch, 0);
  pass('the third flinch: braced for the rest of its 1.0 s after the knock-down, with the rim, and a braced wind-up holds', { braced: v.braced });
}
{ /* no endless flinch: seed 7, three Snuffers with 500 health each (so none goes out), the bot turned to the nearest and Attack mashed
     for 10 s with no pause and no roll: at least 2 hooks hit, each from a braced Snuffer or one the bot had not hit in the second before */
  const W = fightOn({ hp: 1000 });
  const S = [0, 1, 2].map(k => spawn(W, 'S', Math.sin((k * 2 * Math.PI) / 3) * 2.6, Math.cos((k * 2 * Math.PI) / 3) * 2.6, (k * 2 * Math.PI) / 3 + Math.PI));
  for (const f of S) f.hp = 500;
  const lastHit = new Map(), from = [];
  const mash = () => {
    const t = S.filter(f => f.alive).sort((a, b) => Math.hypot(a.x - W.s.x, a.z - W.s.z) - Math.hypot(b.x - W.s.x, b.z - W.s.z))[0];
    if (!t) return { attack: true };
    const dx = t.x - W.s.x, dz = t.z - W.s.z, d = Math.hypot(dx, dz) || 1;
    return { attack: true, mx: dx / d, mz: -dz / d, slow: true };
  };
  run(W, 600, mash, () => {
    for (const f of S) if (f.flash === 3) lastHit.set(f, W.F.step);
    const h = W.hurts.at(-1);
    if (h && h.step === W.F.step && (h.r === 'hit' || h.r === 'dead') && !h.seen) {
      h.seen = true;
      const f = S.filter(g => g.move === 'hook' && ph(g) === 'act').sort((a, b) => Math.hypot(a.x - W.s.x, a.z - W.s.z) - Math.hypot(b.x - W.s.x, b.z - W.s.z))[0];
      from.push(f ? { braced: f.braced > 0, unhit: W.F.step - (lastHit.get(f) ?? -1e9) > 60 } : null);
    }
  });
  const hooks = damage(W).length;
  assert(hooks >= 2, `${hooks} hooks hit`);
  assert.equal(from.length, hooks);
  assert(from.every(x => x && (x.braced || x.unhit)), JSON.stringify(from));
  pass('no endless flinch: at least 2 hooks hit a bot that mashes three Snuffers, each from a braced or an unhit Snuffer', { hooks, from });
}

/* ---------------- Armor that shows, Armored attacks ---------------- */
{ // the rim drains: 4 dabs at 40 poise, 2 after 21 damage, in slot 39
  const W = fightOn({ hp: 500 });
  const I = spawn(W, 'I', 0, -6, 0);
  assert.equal(rimOf(I, W.F.step).n, 4);
  I.hit(21, { from: [W.s.x, W.s.z], push: 0.4, knock: 0, kind: 'cut1' });
  assert.equal(rimOf(I, W.F.step).n, 2);
  assert.equal(ARMOR.slot, 39);
  assert(ARMOR.slot < 34 || ARMOR.slot > 37);
  pass('the rim drains: 4 dabs to 2 in slot 39 after 21 damage', { slot: ARMOR.slot });
}
{ // cut into a charge: it runs, and the poise is 20 lower; 8 dabs in the armored wind-up
  const W = fightOn({ hp: 500 });
  const I = spawn(W, 'I', 0, -6, 0);
  untilMove(W, I, 'charge');
  run(W, 5);
  assert(armored(I));
  assert.equal(rimOf(I, W.F.step).n, 8, 'the rim doubles');
  cut(W, I, 'cut1');
  assert.equal(I.move, 'charge', 'the charge goes on');
  assert.equal(I.poise, 20);
  let ran = false;
  run(W, 120, {}, () => { if (I.move === 'charge' && ph(I) === 'act') ran = true; });
  assert(ran, 'the charge ran');
  pass('cut into a charge: it runs and its poise is 20 lower; the rim shows 8 dabs in the armored wind-up', { poise: 20 });
}
{ // an elite holds: one cut on the Wardmother as it chases: no flinch, poise 10 lower
  const W = fightOn({ id: 'gaol', zones: [{ id: 'G1', c: [0, 0, -12], leash: 3, foes: 'S' }, { id: 'G2', c: [0, 0, -6], leash: 6, foes: 'S', elite: 0 }] });
  W.F.wake('G2');
  run(W, 100);
  const E = W.F.elite();
  E.cool = 999;
  run(W, 2);
  assert.equal(E.state, 'chase');
  cut(W, E, 'cut1');
  assert.equal(E.flinch, 0);
  assert.equal(E.poise, 30);
  assert.equal(ELITES.gaol.special.phases.length, 5);
  pass('an elite holds: no flinch, and its poise is 10 lower', { poise: E.poise });
}

/* ---------------- Blow spacing, Backing off ---------------- */
{ // at depth 2 (two tokens): two Snuffers and a Pitchrook, a lamplighter who stands still for 30 s
  const W = fightOn({ hp: 5000, tokens: 2 });
  const foes = [spawn(W, 'S', -1, -2.6, 0), spawn(W, 'S', 1, -2.6, 0), spawn(W, 'P', 0, -6, 0)];
  const blows = [], starts = [], hurtAt = [];
  let coalCues = 0;
  run(W, 1800, {}, () => {
    for (const f of foes) {
      if (f.move && f.T.moves[f.move].kind === 'melee' && f.mt === f.T.moves[f.move].wind) blows.push(W.F.step);
      if (f.move && f.mt === 0 - (f.windAdd | 0)) starts.push(W.F.step);
    }
    const c = W.log.filter(x => x.cue === 'coal').length;
    if (c > coalCues) { blows.push(W.F.step); coalCues = c; }
    const h = W.hurts.at(-1);
    if (h && h.step === W.F.step && h.r === 'hit' && hurtAt.at(-1) !== W.F.step) hurtAt.push(W.F.step);
  });
  const sorted = [...new Set(blows)].sort((a, b) => a - b), gaps = sorted.slice(1).map((v, i) => v - sorted[i]);
  assert(sorted.length >= 10, `${sorted.length} blows`);
  assert(gaps.every(g => g >= 36), `gaps ${gaps}`);
  const bad = starts.filter(s => hurtAt.some(h => s > h && s - h < 60));
  assert.equal(bad.length, 0, `wind-ups within 60 steps of a hurt: ${bad}`);
  pass('blow spacing: no two blows under 36 steps apart in 30 s, and no wind-up in the 60 steps after a hurt', { blows: sorted.length, least: Math.min(...gaps), hurts: hurtAt.length });
}
{ // a hook lands: in the next 24 steps the Snuffer moves 1.0 m away (±0.2), and its next wind-up is 72 steps or more after the hit
  const W = fightOn({ hp: 500 });
  const S = spawn(W, 'S', 0, -1.6, 0);
  let hitAt = -1, p0 = null, p24 = null, next = -1;
  run(W, 400, {}, () => {
    if (hitAt < 0 && damage(W).length) { hitAt = W.F.step; p0 = [S.x, S.z]; }
    if (hitAt >= 0 && W.F.step === hitAt + 24) p24 = [S.x, S.z];
    if (hitAt >= 0 && next < 0 && S.move === 'hook' && W.F.step > hitAt + 5 && S.mt <= 0) next = W.F.step;
  });
  const moved = Math.hypot(p24[0] - p0[0], p24[1] - p0[1]);
  assert(near(moved, 1.0, 0.2), `backed off ${moved.toFixed(2)} m`);
  assert(next - hitAt >= 72, `next wind-up ${next - hitAt} steps after the hit`);
  pass('a hook lands: the Snuffer backs off 1.0 m in 24 steps, and waits 72 steps or more', { moved: +moved.toFixed(2), next: next - hitAt });
}
{ // waiting foes circle 3.2 to 3.8 m away at 0.8 m/s
  const W = fightOn({ hp: 5000 });
  const A = spawn(W, 'S', 0, -1.8, 0), B = spawn(W, 'S', 2.4, -2.4, 0);
  W.F.hold(A.id, 'hook', 0); W.F.melee.add(A);
  let moved = 0, ring = [];
  run(W, 240, {}, i => { if (i >= 120) { ring.push(Math.hypot(B.x - W.s.x, B.z - W.s.z)); moved += B.walking / 60; } });
  const speed = moved / 2;
  assert(ring.every(d => d > 3.1 && d < 3.9), `ring ${Math.min(...ring).toFixed(2)} to ${Math.max(...ring).toFixed(2)}`);
  assert(near(speed, 0.8, 0.2), `circles at ${speed.toFixed(2)} m/s`);
  pass('waiting foes circle 3.2 to 3.8 m away at about 0.8 m/s', { speed: +speed.toFixed(2) });
}

/* ---------------- Tells from off screen (the Node half) ---------------- */
{ // a Snuffer off screen: its hook's wind-up lasts 48 steps, and its tell plays at its first step, marked off
  const W = fightOn({ hp: 500, onScreen: () => false });
  const S = spawn(W, 'S', 1.6, 0, 0);
  untilMove(W, S, 'hook');
  const start = W.F.step, cue = W.log.find(c => c.cue === 'scrape');
  let act = -1;
  run(W, 80, {}, () => { if (act < 0 && ph(S) === 'act') act = W.F.step; });
  assert.equal(act - start, 48, `wind-up ${act - start} steps`);
  assert(cue && cue.off === true, 'the tell is marked off screen');
  // a tell that cannot be heard: it waits
  const W2 = fightOn({ hp: 500, onScreen: () => false, tellFree: () => false });
  const S2 = spawn(W2, 'S', 1.6, 0, 0);
  run(W2, 120);
  assert.equal(S2.move, null, 'no wind-up without its tell');
  pass('a Snuffer off screen: a 48-step wind-up with its tell marked off; with no voice free it waits', { wind: act - start });
}

/* ---------------- Foe growth with sparks ---------------- */
{ // eight sparks at The Fen, depth 2: a Snuffer has 137 health (50 × 1.3 × 1.7 × 1.24), a hook deals 39 (16 × 1.25 × 1.72 × 1.12)
  const run8 = { place: 'fen', route: ['gaol', 'ramparts', 'fen', 'bells', 'barrows'], sparks: { flame: 4, ward: 3, gloam: 1 } };
  const sc = foeScale(run8);
  assert.equal(Math.round(TYPES.S.hp * FOE_HARD.hp * sc.hp), 137);
  assert.equal(Math.round(TYPES.S.moves.hook.dmg * FOE_HARD.dmg * sc.dmg), 39);
  assert.equal(tokensOf(run8), 2);
  assert.deepEqual(PACE.tokens, [1, 1, 2, 2, 2]);
  // more than 12 sparks count as 12
  const sc20 = foeScale({ ...run8, sparks: { flame: 20 } });
  assert(near(sc20.hp, 1.7 * (1 + 0.03 * 12), 1e-9));
  pass('eight sparks at The Fen: a Snuffer has 137 health and its hook deals 39; sparks count up to 12', { hp: 137, hook: 39 });
}
{ // a spark is worth it: after a Flame spark the hits a Snuffer takes do not rise, and after a Ward spark the hooks to go down do not fall
  const route = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
  const rows = [];
  for (let d = 0; d < 5; d++) for (let s = 0; s < 12; s++) {
    for (const colour of ['flame', 'ward']) {
      const before = { flame: Math.ceil(s / 2), ward: Math.floor(s / 2) }, after = { ...before, [colour]: before[colour] + 1 };
      const at = sp => {
        const sc = foeScale({ place: route[d], route, sparks: sp }), hp = Math.round(TYPES.S.hp * FOE_HARD.hp * sc.hp), hook = Math.round(TYPES.S.moves.hook.dmg * FOE_HARD.dmg * sc.dmg);
        const blade = 10 * (1 + SPARK.flame.power * levelGain(sp.flame)), health = 100 + SPARK.ward.hp * levelGain(sp.ward);
        return { hits: Math.ceil(hp / blade), hooks: Math.ceil(health / hook) };
      };
      const a = at(before), b = at(after);
      if (colour === 'flame') assert(b.hits <= a.hits, `depth ${d}, ${s} sparks, Flame: ${a.hits} to ${b.hits} hits`);
      else assert(b.hooks >= a.hooks, `depth ${d}, ${s} sparks, Ward: ${a.hooks} to ${b.hooks} hooks`);
      if (s === 8) rows.push([d, colour, a, b]);
    }
  }
  pass('a spark is worth it: a Flame spark never adds a hit to put a Snuffer out, a Ward spark never takes a hook off going down', { at8: rows.length });
}

console.log(`${n} checks passed`);
