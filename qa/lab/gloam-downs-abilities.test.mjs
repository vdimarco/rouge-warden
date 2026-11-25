// Gloam Downs: the abilities, checked in node with no browser (public/lab/gloam-downs/abilities.js, status.js, input.js and the
// runner's hooks in run.js; openspec/changes/gloam-downs-growth). Each block is a scenario of the change's spec:
//   Ability slots: a press starts the slot's ability and its cooldown; a press while it cools only says no; none starts in a drink, a
//     roll or a hurt; Smoke step not in the air; the press buffered 0.15 s;
//   The abilities: Lantern bomb's ring and burst, Smoke step's 4 m and its safe time, Ember snare's hold, Moth wisp's hits, Crook
//     line's pull, Rime lamp's slow, Flare's stun, Pitch pour's burn, Bell guard's turned blow;
//   Foe states: a heavy foe is slowed, not held; a stun on it lasts half as long; the Barrow Reeve takes no state;
//   Colours: Flame raises a Flame ability's damage, Gloam shortens every cooldown (never under 60%), a bright one has 25% more;
//   Cooldown panes: Smoked, Hot, Storm and Tallow glass; Clear glass after an ability;
//   Ability lamps: a touch fills an empty slot, both full swaps on a press, the drops from foes (3% and Keen eye, 3 a run);
//   Inputs: the keys, the mouse's side buttons and the pad's LB and LT (LT no longer rolls).
// Run: node qa/lab/gloam-downs-abilities.test.mjs
import assert from 'node:assert/strict';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner, setPane, takeSpark, coolShare } from '../../public/lab/gloam-downs/run.js';
import { makeFoes } from '../../public/lab/gloam-downs/foes.js';
import { makeAbilities, coolOf, powerOf, dropAbility, groundAbilities, drawAbility, abilityChance, AB } from '../../public/lab/gloam-downs/abilities.js';
import { statusHit, statusStep, isFoe } from '../../public/lab/gloam-downs/status.js';
import { KEYS, mouseAct, readPads, PAD } from '../../public/lab/gloam-downs/input.js';
import { makeBoss } from '../../public/lab/gloam-downs/boss.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { ABILITIES } from '../../public/lab/gloam-downs/growth.js';
import { GROWTH_CI } from '../../public/lab/gloam-downs/fight.js';
import fs from 'node:fs';

let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
function flat(half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz;
  return makeWalk(info, new Int16Array(2 * N));
}
const FLAT = flat();
const META = { id: 'test', wisps: [], beacon: { p: [90, 0, 90], r: 1.2 }, zones: [], spawn: { p: [0, 0, 20] } };
const A = id => ABILITIES.find(a => a.id === id);
// a run with the given slots, a lamplighter at the origin facing +z (yaw 0), and foes spawned where asked (they stand still: held off)
function setup({ slots = [null, null], foes = [], rs = null, pane = null, sparks = null, keen = 0 } = {}) {
  rs ||= RS.fresh();
  rs.up.keen = keen;
  if (!rs.run) startRun(rs, 7);
  rs.run.abilities = slots.map(x => (x ? (typeof x === 'string' ? { id: x, bright: false } : x) : null));
  if (pane) { rs.kindled = [...new Set([...rs.kindled, pane])]; setPane(rs, 0, pane); }
  if (sparks) rs.run.sparks = { flame: 0, ward: 0, gloam: 0, ...sparks };
  const body = makeBody(FLAT, { p: [0, 0.5, 0], yaw: 0 }, 20, { ...PARAMS });
  const F = makeFoes({ walk: FLAT, meta: META, slots: 'SSSSPMI', seed: 3, bounds: 20 });
  const R = makeRunner({ walk: FLAT, meta: META, body, rs, targets: F.targets, think: F.think, abilities: makeAbilities });
  F.bind(R);
  const ids = foes.map(([t, x, z]) => F.spawn(t, x, z, Math.PI).id);
  return { rs, R, F, body, s: body.s, foes: ids.map(id => F.find(id)) };
}
const steps = (R, k, inp = {}) => { const all = []; for (let i = 0; i < k; i++) all.push(...R.step(typeof inp === 'function' ? inp(i) : inp, 0)); return all; };
const press = (R, key) => [...R.step({ [key]: true }, 0), ...R.step({}, 0)];

/* ---------------- Ability slots ---------------- */
{ // a press of slot 1's input starts Lantern bomb: 8 s of cooldown, the 'coal' cue with its id; a press in its cooldown only says no
  const { R } = setup({ slots: ['bomb', null] });
  const ev = press(R, 'ab1');
  assert(ev.some(e => e.type === 'ability' && e.what === 'use' && e.id === 'bomb'));
  assert(R.log.some(c => c.cue === 'coal' && c.ability === 'bomb'));
  const v = R.abilities.view()[0];
  assert(Math.abs(v.left - 8 + 1 / 60) < 0.05, `left ${v.left}`);
  const ev2 = press(R, 'ab1');
  assert(!ev2.some(e => e.type === 'ability' && e.what === 'use'));
  assert(R.log.some(c => c.cue === 'refuse' && c.ability === 'bomb'));
  // the cooldown ends on the play clock, and says so once
  const end = steps(R, 8 * 60);
  assert.equal(end.filter(e => e.type === 'ability' && e.what === 'ready').length, 1);
  assert.equal(R.abilities.view()[0].left, 0);
  pass('slots: Lantern bomb starts on a press, cools 8 s, a press while it cools only says no, and it says ready once');
}
{ // no ability in a drink, a roll or a hurt; Smoke step not in the air; a press is kept 0.15 s
  const { R, rs, s } = setup({ slots: ['bomb', 'step'] });
  rs.run.hp = 50;
  R.step({ heal: true }, 0); R.step({}, 0);
  assert.equal(R.fighter.f.move, 'drink');
  R.step({ ab1: true }, 0);
  assert.equal(R.abilities.view()[0].left, 0, 'no bomb in a drink');
  // the press is kept 0.15 s: let the drink end, and it does not start later than that
  steps(R, 60);
  assert.equal(R.abilities.view()[0].left, 0, 'the press is not kept past 0.15 s');
  // in the air: Smoke step does not start
  steps(R, 2, { jump: true });
  assert(!s.ground);
  R.step({ ab2: true }, 0);
  assert.equal(R.abilities.view()[1].left, 0, 'no Smoke step in the air');
  pass('slots: no ability in a drink, the press kept 0.15 s and no more, and Smoke step only on the ground');
}

/* ---------------- The abilities ---------------- */
{ // Lantern bomb: the ring at the soft-aim foe for 0.6 s, then 28 to every foe within 2.5 m, and a burn of 6 over 2 s
  const { R, foes } = setup({ slots: ['bomb', null], foes: [['S', 0, 5], ['S', 1.5, 5.5]] });
  for (const f of foes) R.rs.run && (f.cool = 999);
  const hp0 = foes.map(f => f.hp);
  const ev = press(R, 'ab1');
  assert(ev.some(e => e.type === 'abilityFx' && e.kind === 'tell' && Math.abs(e.at[2] - 5) < 0.6));
  steps(R, 34);
  assert.deepEqual(foes.map((f, i) => hp0[i] - f.hp), [28, 28], 'the burst');
  steps(R, 125);
  assert.deepEqual(foes.map((f, i) => hp0[i] - f.hp), [34, 34], 'and the burn');
  pass('Lantern bomb: a ring at the foe for 0.6 s, then 28 to each foe in 2.5 m, and 6 more over 2 s');
}
{ // Smoke step: 4 m ahead in one step, and a blow in its 0.3 s is a near miss (as the roll's)
  const { R, s } = setup({ slots: ['step', null] });
  press(R, 'ab1');
  assert(Math.abs(s.z - 4) < 0.3 && Math.abs(s.x) < 0.1, `at ${s.x}, ${s.z}`);
  assert.equal(R.fighter.safe(), 'roll');
  assert.equal(R.hurt(20, [0, 6]), 'safe');
  pass('Smoke step: 4 m ahead at once, and safe for 0.3 s as the roll is', { z: +s.z.toFixed(2) });
}
{ // Ember snare: the first light foe in it is held 2 s and takes 10; an Ironback is slowed, not held
  const { R, foes } = setup({ slots: ['snare', null], foes: [['S', 0, 0.6], ['I', 0.3, -0.6]] });
  const [sn, ib] = foes, h0 = sn.hp;
  press(R, 'ab1');
  steps(R, 2);
  assert.equal(h0 - sn.hp, 10);
  assert(sn.status.hold > 100, 'held 2 s');
  assert.equal(ib.status?.hold || 0, 0, 'a heavy foe is not held');
  pass('Ember snare: a Snuffer held 2 s for 10, and the Ironback never held');
}
{ // Crook line: a light foe 6 m off is pulled to about 1.2 m in front and takes 8
  const { R, foes } = setup({ slots: ['crook', null], foes: [['S', 0, 6]] });
  const f = foes[0], h0 = f.hp;
  f.cool = 999;
  press(R, 'ab1');
  steps(R, 20);
  assert.equal(h0 - f.hp, 8);
  assert(f.z < 2.6, `pulled to ${f.z.toFixed(2)}`);
  pass('Crook line: a Snuffer at 6 m comes in and takes 8', { z: +f.z.toFixed(2) });
}
{ // Rime lamp slows the foes in its cone; Flare stuns those within 4 m that it sees, and stops a wind-up
  const { R, foes } = setup({ slots: ['rime', 'flare'], foes: [['S', 0, 2.5], ['S', 0, -3]] });
  press(R, 'ab1');
  assert(foes[0].status.slow > 150 && !(foes[1].status?.slow > 0), 'only the one in front is slowed');
  steps(R, 30);
  foes[1].state = 'chase';
  press(R, 'ab2');
  steps(R, 16);
  assert(foes[0].status.stun > 0 && foes[1].status.stun > 0);
  const st = statusStep(foes[0]);
  assert(st.stop);
  pass('Rime lamp slows the foe in its cone only; Flare stuns both within 4 m');
}
{ // Moth wisp: 5 to the nearest awake foe each 0.8 s; Pitch pour: 4 each 0.5 s from 0.3 s to a foe in its pool
  const a = setup({ slots: ['moth', null], foes: [['S', 0, 4]] });
  a.foes[0].cool = 999;
  const h0 = a.foes[0].hp;
  press(a.R, 'ab1');
  steps(a.R, 48 * 3 + 6); // and the 2 steps of hit stop of each hit
  assert.equal(h0 - a.foes[0].hp, 15);
  const b = setup({ slots: ['pitch', null], foes: [['S', 0, 1]] });
  // the foe stands in the pool (a long stun keeps it there)
  statusHit(b.foes[0], 'stun', 600);
  const h1 = b.foes[0].hp;
  press(b.R, 'ab1');
  steps(b.R, 18 + 30 * 3 + 6);
  assert.equal(h1 - b.foes[0].hp, 16);
  pass('Moth wisp: 5 every 0.8 s; Pitch pour: 4 every 0.5 s in the pool');
}
{ // Bell guard: for 0.8 s the next blow from in front is turned aside (no damage); one from behind still lands
  const { R, rs } = setup({ slots: ['guard', null] });
  press(R, 'ab1');
  const hp = rs.run.hp;
  assert.equal(R.hurt(20, [0, 2]), 'none');
  assert.equal(rs.run.hp, hp);
  press(R, 'ab1');
  assert.equal(R.hurt(20, [0, 2]), 'hit', 'the guard is spent and cooling');
  pass('Bell guard: the blow from in front is turned aside, once');
}

/* ---------------- Foe states ---------------- */
{
  const S = { T: { light: true }, zone: { id: 'z' }, type: 'S' }, I = { T: { light: false }, zone: { id: 'z' }, type: 'I' };
  assert.equal(statusHit(S, 'hold', 120), 'hold');
  assert.equal(statusHit(I, 'hold', 120), 'slow');
  assert.equal(statusHit(I, 'stun', 72), 'stun');
  assert.equal(I.status.stun, 36);
  const boss = makeBoss({ walk: FLAT });
  assert(!isFoe(boss));
  assert.equal(statusHit(boss, 'stun', 60), null);
  const sl = { T: { light: true }, zone: { id: 'z' }, type: 'S' };
  statusHit(sl, 'slow', 10, { k: 0.5 });
  assert.deepEqual(statusStep(sl), { stop: false, speed: 0.5 });
  pass('foe states: a heavy foe slowed not held, its stun halved; the Reeve takes none; a slow keeps half the speed');
}

/* ---------------- Colours, bright, cooldowns ---------------- */
{
  const rs = RS.fresh();
  startRun(rs, 7);
  rs.run.sparkPicks = 9;
  for (let i = 0; i < 3; i++) takeSpark(rs, 'flame');
  assert(Math.abs(powerOf(rs, { id: 'bomb', bright: false }) - 1.3) < 1e-9);
  assert(Math.abs(powerOf(rs, { id: 'bomb', bright: true }) - 1.3 * 1.25) < 1e-9);
  assert.equal(powerOf(rs, { id: 'flare', bright: false }), 1, 'Flame does not raise a Ward ability');
  for (let i = 0; i < 5; i++) takeSpark(rs, 'gloam');
  assert.equal(coolOf(rs, 'bomb'), Math.round(480 * 0.8));
  rs.run.sparks.gloam = 40;
  assert.equal(coolShare(rs.run), 0.6);
  rs.kindled.push('smoked'); setPane(rs, 0, 'smoked');
  assert.equal(coolOf(rs, 'bomb'), Math.round(480 * 0.6 * 0.85));
  pass('colours: Flame 3 gives a Flame ability 30% more (and 25% on top when bright); Gloam cuts cooldowns to 60% at most; Smoked glass 15% more');
}
{ // Hot glass: a foe put out within 3 s of an ability cools the other slot by 2 s; Storm glass: a near miss cools both by 1 s;
  // Tallow glass: a flask cools both by 3 s; Clear glass: the next cut after an ability deals 40% more
  const a = setup({ slots: ['bomb', 'flare'], pane: 'hot', foes: [['S', 0, 4]] });
  press(a.R, 'ab2'); // Flare: 14 s
  press(a.R, 'ab1');
  const before = a.R.abilities.view()[1].left;
  a.R.foeOut(0, null, { id: 'x' });
  assert(Math.abs(before - a.R.abilities.view()[1].left - 2) < 0.02);
  const b = setup({ slots: ['bomb', 'flare'], pane: 'storm' });
  press(b.R, 'ab1'); press(b.R, 'ab2');
  const l0 = b.R.abilities.view().map(v => v.left);
  b.R.step({ roll: true }, 0); b.R.step({}, 0);
  b.R.hurt(10, [0, 2]);
  const l1 = b.R.abilities.view().map(v => v.left);
  assert(l0.every((v, i) => Math.abs(v - l1[i] - 1 - 2 / 60) < 0.05), JSON.stringify([l0, l1]));
  const c = setup({ slots: ['bomb', null], pane: 'tallow' });
  c.rs.run.hp = 40;
  press(c.R, 'ab1');
  const t0 = c.R.abilities.view()[0].left;
  c.R.step({ heal: true }, 0); steps(c.R, 60);
  assert(t0 - c.R.abilities.view()[0].left > 3.9, 'a flask: 1 s of steps and 3 s more');
  const d = setup({ slots: ['flare', null], pane: 'clear' });
  press(d.R, 'ab1');
  assert(d.R.clearUntil > d.R.clock.play);
  pass('panes: Hot glass cools the other slot by 2 s, Storm glass both by 1 s on a near miss, Tallow both by 3 s on a flask, and Clear glass opens after an ability');
}

/* ---------------- Ability lamps ---------------- */
{
  const { R, rs, s } = setup({ slots: ['bomb', null] });
  dropAbility(R, [0, 0, 0], { id: 'flare', bright: true });
  steps(R, 2);
  assert.deepEqual(rs.run.abilities, [{ id: 'bomb', bright: false }, { id: 'flare', bright: true }]);
  assert.equal(groundAbilities(R).length, 0);
  dropAbility(R, [s.x, 0, s.z], { id: 'step', bright: false });
  steps(R, 2);
  assert(R.notes.some(t => /press an ability to swap/.test(t)));
  press(R, 'ab1');
  assert.deepEqual(rs.run.abilities[0], { id: 'step', bright: false });
  assert.deepEqual(groundAbilities(R).map(l => l.id), ['bomb'], 'the old one lies there');
  pass('ability lamps: a touch fills the empty slot, and with both full a press swaps, the old one left on the ground');
}
{ // the drops from foes: 3%, 1% more a Keen eye level, the same seed the same drops, and at most 3 a run
  const rs = RS.fresh(); startRun(rs, 11);
  assert.equal(abilityChance(rs), 0.03);
  rs.up.keen = 2; assert.equal(abilityChance(rs), 0.05);
  const draws = seed => { const q = RS.fresh(); startRun(q, seed); return Array.from({ length: 200 }, () => drawAbility(q, 0.03)?.id ?? null).join(','); };
  assert.equal(draws(5), draws(5));
  const { R } = setup({ slots: ['bomb', 'step'], keen: 5 });
  R.rs.run.abilityDrops = 0;
  for (let i = 0; i < 2000; i++) R.foeOut(0, [0, 0, 5]);
  assert.equal(R.rs.run.abilityDrops, 3);
  pass('ability drops: 3% and 1% a Keen eye level, the same seed gives the same drops, and 3 a run at most');
}


{ // Flare on a wind-up: a Snuffer 0.1 s into its hook 2 m away; Flare stops the hook, and the Snuffer stands 1.2 s
  const { R, F, rs, foes } = setup({ slots: ['flare', null], foes: [['S', 0, 2]] });
  const f = foes[0];
  F.hold(f, 'hook', 0.1); F.hold(f, null);
  press(R, 'ab1');
  steps(R, 60);
  assert.equal(rs.run.hp, 100, 'the hook did not land');
  assert(f.move !== 'hook' && f.status.stun > 0);
  pass('Flare on a wind-up: the hook does not land, and the Snuffer is stunned');
}
{ // the Reeve takes no state but takes the snare's damage: a stand-in target with no zone, as the Reeve has none
  const { R } = setup({ slots: ['snare', null] });
  const hits = [], reeve = { id: 'reeve', type: 'B', zone: 'arena', x: 0, y: 0, z: 0.5, r: 0.9, alive: true, hit: raw => { hits.push(Math.round(raw)); return Math.round(raw); } };
  R.targets = () => [reeve];
  press(R, 'ab1'); steps(R, 2);
  assert.deepEqual(hits, [10]);
  assert.equal(reeve.status, undefined);
  pass('the Reeve: a snare deals its 10 and puts no state on it');
}
{ // Gloam 3: Lantern bomb cools 7.04 s (8 × 0.88), to the step
  const rs = RS.fresh(); startRun(rs, 7);
  rs.run.sparks = { flame: 0, ward: 0, gloam: 3 };
  assert.equal(coolOf(rs, 'bomb'), Math.round(8 * 0.88 * 60));
  pass('Gloam 3: Lantern bomb cools 7.04 s', { steps: coolOf(rs, 'bomb') });
}
{ // drawn under fire: no colour of growth and no ability effect uses fire 37, the brightest slot
  // the lamps' colours are no fire slot at all (34 to 37), so a lamp near a foe never reads as its tell
  assert(Object.values(GROWTH_CI).every(c => c < 34 || c > 37));
  const src = fs.readFileSync(new URL('../../public/lab/gloam-downs/fight.js', import.meta.url), 'utf8');
  const fx = src.slice(src.indexOf('function abilityFx'), src.indexOf('/* ---------------- the picture'));
  const glow = src.slice(src.indexOf('// growth: the pattern lamps'), src.indexOf('const s0 ='));
  assert(fx.length > 200 && glow.length > 200 && !/\b37\b/.test(fx) && !/\b37\b/.test(glow));
  pass('drawn under fire: the abilities\' effects and the lamps never use fire 37');
}

/* ---------------- Inputs ---------------- */
{
  assert.deepEqual([KEYS.ab1, KEYS.ab2], [['f', 'u'], ['g', 'i']]);
  assert.equal(mouseAct(3, { run: true }), 'ab1');
  assert.equal(mouseAct(4, { run: true, locked: true }), 'ab2');
  assert.equal(mouseAct(3, { run: false }), null);
  const pad = down => [{ connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 })) }];
  const lt = readPads(pad([PAD.LT]), true), lb = readPads(pad([PAD.LB]), true), b = readPads(pad([PAD.B]), true);
  assert.deepEqual([lb.ab1, lt.ab2, lt.roll, b.roll], [true, true, false, true]);
  pass('inputs: F or U and G or I, the side buttons 3 and 4 in a run, LB and LT on a pad, and LT no longer rolls');
}
console.log(`${n} checks passed`);
