// Gloam Downs: the new foe states, checked in node with no browser (public/lab/gloam-downs/status.js and its three hooks in foes.js;
// openspec/changes/gloam-downs-hub). Each block is a scenario of the change's spec:
//   Char and Soot: five stacks burst for 20 and clear; stacks tick 1 a second each and fade 4 s after the last; Soot ticks 2 a second
//     for 6 s; a sooted foe put out passes 4 s of Soot to each foe within 2.5 m, once; the Reeve takes only Char's burst;
//   Blind and Mark: a blind hook plays and deals 0; a heavy foe is blind half as long; a Mark bursts for 22 on the next hit;
//   Ticks never interrupt: a ticking foe's hook lands on its own step, with no flinch and no poise worn, and ticks deal at most 8 in a
//     second on one foe, the bomb's burn among them.
// Run: node qa/lab/gloam-downs-states.test.mjs
import assert from 'node:assert/strict';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner } from '../../public/lab/gloam-downs/run.js';
import { makeFoes } from '../../public/lab/gloam-downs/foes.js';
import { makeAbilities } from '../../public/lab/gloam-downs/abilities.js';
import { makeBuild } from '../../public/lab/gloam-downs/build.js';
import { statusHit, statusTick, statusOut, blindMiss, tickHit, STATES } from '../../public/lab/gloam-downs/status.js';
import { makeBoss } from '../../public/lab/gloam-downs/boss.js';
import { poiseOf } from '../../public/lab/gloam-downs/feel.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';

let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
function flat(half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz;
  return makeWalk(info, new Int16Array(2 * N));
}
const FLAT = flat();
const META = { id: 'test', wisps: [], beacon: { p: [90, 0, 90], r: 1.2 }, zones: [], spawn: { p: [0, 0, 20] } };
// a run with a lamplighter at the origin facing +z, and foes spawned where asked (each held still unless asked to fight)
function setup({ foes = [], slots = 'SSSSPMI', wicks = [] } = {}) {
  const rs = RS.fresh();
  startRun(rs, 7);
  rs.run.wicks = wicks.slice();
  const body = makeBody(FLAT, { p: [0, 0.5, 0], yaw: 0 }, 20, { ...PARAMS });
  const F = makeFoes({ walk: FLAT, meta: META, slots, seed: 3, bounds: 20 });
  const R = makeRunner({ walk: FLAT, meta: META, body, rs, targets: F.targets, think: F.think, abilities: makeAbilities, build: makeBuild });
  F.bind(R);
  const ids = foes.map(([t, x, z, yaw = Math.PI]) => F.spawn(t, x, z, yaw).id);
  return { rs, R, F, body, s: body.s, foes: ids.map(id => F.find(id)) };
}
const steps = (R, k, inp = {}) => { const all = []; for (let i = 0; i < k; i++) all.push(...R.step(typeof inp === 'function' ? inp(i) : inp, 0)); return all; };
// keep foes from attacking (a long cooldown) so a test reads only the states
const calm = foes => { for (const f of foes) { f.cool = 1e6; f.wait = 1e9; } };

/* ---------------- Char and Soot ---------------- */
{ // five stacks in 1 s burst for 20 at the 5th, and none are left after
  const { R, foes: [f] } = setup({ foes: [['S', 0, 6]] });
  calm([f]);
  for (let k = 0; k < 4; k++) { statusHit(f, 'char', 1); steps(R, 12); }
  assert.equal(f.status.char, 4);
  const hp = f.hp, ev = [];
  assert.equal(statusHit(f, 'char', 1, { ev }), 'burst');
  assert.equal(hp - f.hp, 20, 'the burst is 20');
  assert.equal(f.status.char, 0);
  assert(ev.some(e => e.type === 'hit' && e.state === 'char') && ev.some(e => e.type === 'cue' && e.cue === 'char'), 'the burst is a hit with its cue');
  pass('Char: 5 stacks in 1 s burst for 20 at the 5th, and none are left', { stacks: f.status.char });
}
{ // a stack deals 1 a second; stacks fade 4 s after the last one added
  const { R, foes: [f] } = setup({ foes: [['S', 0, 6]] });
  calm([f]);
  statusHit(f, 'char', 3);
  const hp = f.hp;
  steps(R, 120);
  assert.equal(hp - f.hp, 6, '3 stacks for 2 s');
  steps(R, 120);
  assert.equal(f.status.char, 0, 'gone 4 s after the last stack');
  const hp2 = f.hp;
  steps(R, 60);
  assert.equal(f.hp, hp2);
  pass('Char: each stack 1 a second, all fade 4 s after the last added', { two: hp - hp2 });
}
{ // Soot: 2 a second for 6 s; a new Soot renews it
  const { R, foes: [f] } = setup({ foes: [['S', 0, 6]] });
  calm([f]);
  statusHit(f, 'soot', STATES.soot.life);
  const hp = f.hp;
  steps(R, 300);
  statusHit(f, 'soot', STATES.soot.life);
  steps(R, 400);
  assert.equal(hp - f.hp, 22, '5 s, then the renewed 6 s');
  pass('Soot: 2 a second for 6 s, renewed by a new Soot', { dealt: hp - f.hp });
}
{ // a sooted Snuffer put out passes 4 s of Soot to the two foes 2 m away and not the one 3 m away; passed Soot does not pass again
  const { R, F, foes: [a, b, c, d] } = setup({ foes: [['S', 0, 6], ['S', 2, 6], ['S', -2, 6], ['S', 0, 9]] });
  calm([a, b, c, d]);
  statusHit(a, 'soot', STATES.soot.life);
  F.putOut(a.id);
  assert.equal(b.status?.soot, STATES.soot.pass);
  assert.equal(c.status?.soot, STATES.soot.pass);
  assert.equal(d.status?.soot || 0, 0, 'the foe 3 m away');
  F.putOut(b.id);
  assert(c.status.soot <= STATES.soot.pass, 'passed Soot is not passed again');
  assert.equal(d.status?.soot || 0, 0);
  pass('Soot: a foe put out passes 4 s to each foe within 2.5 m, once', { b: b.status.soot, d: d.status?.soot || 0 });
}
{ // the Reeve takes only Char's burst: no state, no tick, and the 5th stack bursts on it
  const boss = makeBoss({ walk: FLAT });
  for (const k of ['soot', 'blind', 'mark', 'burn']) assert.equal(statusHit(boss, k, 60), null, k);
  let took = 0;
  boss.alive = true;
  boss.hit = raw => { took += raw; return raw; };
  for (let k = 0; k < 4; k++) assert.equal(statusHit(boss, 'char', 1), 'char');
  assert.equal(took, 0);
  assert.equal(statusHit(boss, 'char', 1), 'burst');
  assert.equal(took, STATES.char.burst);
  statusTick(boss);
  assert.equal(took, STATES.char.burst, 'no ticks on the Reeve');
  pass('the Reeve: no Soot, Blind, Mark or tick; Char counts and bursts at 5');
}

/* ---------------- Blind and Mark ---------------- */
{ // a blind Snuffer's hook plays in reach and deals 0; its next hook after the blind is spent lands
  const { R, rs, foes: [f] } = setup({ foes: [['S', 0, 1.6]] });
  statusHit(f, 'blind', STATES.blind.life);
  const hp = rs.run.hp;
  let ev = [], hooked = false;
  for (let i = 0; i < 120 && !hooked; i++) { const e = R.step({}, 0); ev.push(...e); if (f.move === 'hook') hooked = true; }
  assert(hooked, 'the hook started');
  ev.push(...steps(R, 60));
  assert(R.log.some(c => c.cue === 'scrape'), 'the hook played its tell');
  assert(ev.some(e => e.type === 'blindMiss'), 'the blow came and missed');
  assert.equal(rs.run.hp, hp, 'no damage');
  assert.equal(f.status.blind, 0, 'the blind is spent');
  pass('Blind: a blind hook plays in reach and deals 0', { hp: rs.run.hp });
}
{ // a heavy foe is blind half as long; blindMiss spends it
  const { foes: [I] } = setup({ foes: [['I', 0, 6]] });
  statusHit(I, 'blind', STATES.blind.life);
  assert.equal(I.status.blind, STATES.blind.life / 2);
  assert.equal(blindMiss(I), true);
  assert.equal(blindMiss(I), false);
  pass('Blind: 1.5 s on a heavy foe, and spent by one attack');
}
{ // a Mark: the next cut deals its damage plus 22, and only once
  const { R, foes: [f] } = setup({ foes: [['S', 0, 1.4]] });
  calm([f]);
  statusHit(f, 'mark', STATES.mark.life);
  const hp = f.hp;
  const ev = [...R.step({ attack: true }, 0), ...steps(R, 30)];
  const cut = ev.find(e => e.type === 'hit' && e.kind === 'cut1');
  assert(cut, 'the cut hit');
  assert.equal(hp - f.hp, cut.dmg + STATES.mark.burst);
  assert.equal(f.status.mark, 0);
  pass('Mark: the next hit deals its damage plus 22', { cut: cut.dmg, total: hp - f.hp });
}
{ // a Mark lasts 4 s
  const { R, foes: [f] } = setup({ foes: [['S', 0, 6]] });
  calm([f]);
  statusHit(f, 'mark', STATES.mark.life);
  steps(R, STATES.mark.life + 1);
  assert.equal(f.status.mark, 0);
  pass('Mark: gone after 4 s');
}

/* ---------------- Ticks never interrupt ---------------- */
{ // a Snuffer with 5 s of Soot and 4 Char starts its hook: it lands on the same step as a Snuffer with none, with no flinch; the ticks
  // deal at most 8 in that second
  const hookAt = states => {
    const { R, rs, foes: [f] } = setup({ foes: [['S', 0, 1.6]] });
    if (states) { statusHit(f, 'soot', 300); statusHit(f, 'char', 4); }
    let started = -1, landed = -1, flinch = 0;
    const hp0 = f.hp;
    for (let i = 0; i < 160 && landed < 0; i++) {
      const ev = R.step({}, 0);
      if (started < 0 && f.move === 'hook') started = i;
      flinch = Math.max(flinch, f.flinch);
      if (ev.some(e => e.type === 'hurt')) landed = i;
      if (started >= 0 && i - started === 59 && states) var inSecond = hp0 - f.hp;
    }
    return { started, landed, flinch, hp: rs.run.hp, ticked: hp0 - f.hp, inSecond };
  };
  const a = hookAt(false), b = hookAt(true);
  assert(a.landed > 0 && b.landed > 0, JSON.stringify({ a, b }));
  assert.equal(b.landed - b.started, a.landed - a.started, 'the hook lands on its own step');
  assert.equal(b.flinch, 0, 'no flinch');
  assert(b.ticked > 0 && b.ticked <= 8 * Math.ceil((b.landed + 1) / 60), JSON.stringify(b));
  pass('ticks never interrupt: a sooted, charred Snuffer hooks on time with no flinch', { plain: a.landed - a.started, ticking: b.landed - b.started, ticked: b.ticked });
}
{ // ticks never wear an Ironback's poise; the cap: Char 5... 4 stacks, Soot and a 3-a-second burn ask 9 a second, and 8 is dealt
  const { R, foes: [I] } = setup({ foes: [['I', 0, 6]] });
  calm([I]);
  statusHit(I, 'char', 4); statusHit(I, 'soot', 600); statusHit(I, 'burn', 600, { dps: 3 });
  steps(R, 2);
  const hp = I.hp;
  steps(R, 60);
  assert.equal(hp - I.hp, STATES.cap, 'capped at 8');
  assert(I.poise === undefined || I.poise === poiseOf(I), `poise ${I.poise}`);
  assert.equal(I.state, 'chase');
  // a bomb's burn tick shares the cap: with the cap spent, it deals nothing
  const before = I.hp;
  for (let k = 0; k < 4; k++) tickHit(I, 3);
  assert(before - I.hp <= STATES.cap, 'still inside the cap in this second');
  pass('ticks: at most 8 a second on one foe, and no poise worn', { second: hp - I.hp });
}
{ // a tick does not give a hit event the combo counts, and a burst does
  const { R, foes: [f] } = setup({ foes: [['S', 0, 6]] });
  calm([f]);
  statusHit(f, 'soot', 300);
  const ev = steps(R, 90);
  assert(ev.some(e => e.type === 'tick'), 'ticks happened');
  assert(!ev.some(e => e.type === 'hit'), 'no hit from a tick');
  assert(!ev.some(e => e.type === 'snap'), 'no cancel');
  pass('ticks: no hit for the combo, no snap');
}
{ // statusOut with no Soot passes nothing
  const { foes: [a, b] } = setup({ foes: [['S', 0, 6], ['S', 1, 6]] });
  assert.deepEqual(statusOut(a, [a, b]), []);
  pass('Soot: a foe with none passes none');
}
console.log(`PASS qa/lab/gloam-downs-states.test.mjs: ${n} checks`);
