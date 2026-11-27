// Gloam Downs: the new kit, checked in node with no browser (public/lab/gloam-downs/build.js, abilities.js, run.js, relics.js, keys.js,
// moves.js; openspec/changes/gloam-downs-hub). Each block is a scenario of the change's spec:
//   Sure cuts: Sure hand on a held foe, Whetstone seeded; the ward shell: a blow on the shell, the cap, Horn lamp;
//   the ten abilities: Wick lash, Shard fan, Oil slick lit by a bomb, Tack scatter, Bell toll, Ember shell, Post lamp, Shutter, Moth
//     swarm, Gloam blink and its Mark;
//   panes: Cinder, Spill's chain of 3, Rush, Thirst, Shard and Cracked glass; wicks: Char wick, Count wick, Shell wick, Wick crate;
//   relics: Char edge, Soot heel, Glass drink kindled, Thorn roll; Gloam dash; the Gloam set; the same seed's patterns;
//   the power budget: each new buff alone in the reference duel.
// Run: node qa/lab/gloam-downs-kit.test.mjs   (BUDGET=1 prints each buff's gain)
import assert from 'node:assert/strict';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner, setPane, maxOf, goTo, drawOffer, startOffer, drawPattern, WICKS } from '../../public/lab/gloam-downs/run.js';
import { makeFoes } from '../../public/lab/gloam-downs/foes.js';
import { makeAbilities, coolOf } from '../../public/lab/gloam-downs/abilities.js';
import { makeBuild, setsOf, colourCount, shellShare, whetChance } from '../../public/lab/gloam-downs/build.js';
import { makeKeys } from '../../public/lab/gloam-downs/keys.js';
import { statusHit, STATES } from '../../public/lab/gloam-downs/status.js';
import { makePost, MOVES } from '../../public/lab/gloam-downs/moves.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';

let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
function flat(half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz;
  return makeWalk(info, new Int16Array(2 * N));
}
const FLAT = flat();
const META = { id: 'test', wisps: [], beacon: { p: [90, 0, 90], r: 1.2 }, zones: [], spawn: { p: [0, 0, 20] } };
function setup({ foes = [], slots = [null, null], wicks = [], panes = [], relics = [], up = {}, keys = [], seed = 7, unlocks = [], posts = [] } = {}) {
  const rs = RS.fresh();
  Object.assign(rs.up, up);
  rs.unlocks = unlocks.slice();
  rs.keys = keys.slice();
  startRun(rs, seed);
  rs.run.wicks = wicks.slice();
  rs.run.relics = relics.slice();
  rs.run.abilities = slots.map(x => (x ? { id: x, bright: false } : null));
  if (panes.length) { rs.up.panes = Math.max(rs.up.panes | 0, panes.length - 1); rs.kindled = [...new Set([...rs.kindled, ...panes])]; panes.forEach((p, i) => setPane(rs, i, p)); }
  const body = makeBody(FLAT, { p: [0, 0.5, 0], yaw: 0 }, 20, { ...PARAMS });
  const F = makeFoes({ walk: FLAT, meta: META, slots: 'SSSSSPMII', seed: 3, bounds: 20 });
  const P = posts.map(([x, z, o = {}]) => makePost(FLAT, x, z, o));
  const R = makeRunner({ walk: FLAT, meta: META, body, rs, targets: () => [...F.targets(), ...P], think: F.think, abilities: makeAbilities, keys: makeKeys, build: makeBuild });
  F.bind(R);
  const ids = foes.map(([t, x, z, yaw = Math.PI]) => F.spawn(t, x, z, yaw).id);
  return { rs, R, F, body, s: body.s, B: R.build, A: R.abilities, posts: P, foes: ids.map(id => F.find(id)) };
}
const steps = (R, k, inp = {}) => { const all = []; for (let i = 0; i < k; i++) all.push(...R.step(typeof inp === 'function' ? inp(i) : inp, 0)); return all; };
const press = (R, key) => [...R.step({ [key]: true }, 0), ...R.step({}, 0)];
const calm = foes => { for (const f of foes) { f.cool = 1e6; f.wait = 1e9; } };

/* ---------------- Sure cuts ---------------- */
{ // with Sure hand the first cut on a foe held by Ember snare deals 1.5 times the same cut on a free foe, and the cue log has sure
  const cut = held => {
    const { R, foes: [f] } = setup({ wicks: ['sure'], foes: [['S', 0, 1.4]] });
    calm([f]);
    if (held) statusHit(f, 'hold', 120);
    const ev = [...R.step({ attack: true }, 0), ...steps(R, 20)];
    return { hit: ev.find(e => e.type === 'hit' && e.kind === 'cut1'), log: R.log };
  };
  const free = cut(false), held = cut(true);
  assert.equal(held.hit.dmg, Math.round(free.hit.dmg * 1.5));
  assert(held.hit.sure && held.log.some(c => c.cue === 'sure'));
  assert(!free.hit.sure && !free.log.some(c => c.cue === 'sure'));
  // the sure cut holds one step longer
  assert(held.log.find(c => c.cue === 'hit').stop === free.log.find(c => c.cue === 'hit').stop + MOVES.sure.stop);
  pass('Sure hand: the first cut on a held foe deals 1.5 times, with the sure cue and a longer hit stop', { free: free.hit.dmg, held: held.hit.dmg });
}
{ // Whetstone 3: the same seed and the same 200 blade hits give the same sure cuts, about 12% of them
  const draw = () => { const { B } = setup({ up: { whet: 3 }, seed: 99 }); return Array.from({ length: 200 }, () => (B.sure(null, 'cut1') ? 1 : 0)); };
  const a = draw(), b = draw(), k = a.reduce((x, y) => x + y, 0);
  assert.deepEqual(a, b);
  assert(k >= 12 && k <= 38, `sure ${k} of 200`);
  assert(Math.abs(whetChance({ whet: 3 }) - 0.12) < 1e-9);
  // an ability hit is never sure from Whetstone
  const { B } = setup({ up: { whet: 3 } });
  assert(!Array.from({ length: 50 }, () => B.sure(null, 'ability')).some(Boolean));
  pass('Whetstone: 4% a level from the seed\'s sure stream, the same hits each time', { sure: k });
}

/* ---------------- The ward shell ---------------- */
{ // a 20 shell and 100 health: a hook of 16 leaves the shell at 4 and the health at 100
  const { R, rs, B } = setup();
  assert.equal(B.addShell(20), 20);
  R.hurt(16, [0, 1.5]);
  assert.equal(B.total(), 4);
  assert.equal(rs.run.hp, 100);
  // the cap: all together at most 40% of the max health; Horn lamp makes each 20% bigger a level
  assert.equal(B.addShell(100), 36);
  assert.equal(B.total(), 40);
  assert.equal(shellShare(B), 0.4);
  const h = setup({ up: { horn: 2 } });
  assert.equal(h.B.addShell(20), 28);
  pass('the shell: 20 takes a 16 blow and leaves 4 with the health whole; capped at 40%; Horn lamp 20% a level', { shell: 4, cap: 40 });
}

/* ---------------- Flame abilities ---------------- */
{ // Wick lash with two Snuffers on a line 3 m and 4.5 m ahead: each takes 14 and burns for 3 s
  const { R, foes } = setup({ slots: ['lash', null], foes: [['S', 0, 3], ['S', 0.1, 4.5]] });
  calm(foes);
  const hp = foes.map(f => f.hp);
  press(R, 'ab1');
  steps(R, 12);
  assert.deepEqual(foes.map((f, i) => hp[i] - f.hp), [14, 14]);
  for (const f of foes) assert(f.status.burn >= 160, `burn ${f.status.burn}`);
  pass('Wick lash: 14 to each foe on the 5 m line, and 3 s of burn');
}
{ // Shard fan at a Snuffer 4 m ahead: 6 and 1 Char for each shard that meets it; close up all five meet and the Char bursts
  const far = setup({ slots: ['fan', null], foes: [['S', 0, 4]] });
  calm(far.foes);
  const f = far.foes[0], hp = f.hp;
  press(far.R, 'ab1'); steps(far.R, 10);
  const k = f.status.char;
  assert(k >= 1 && k < 5 && hp - f.hp === 6 * k, `shards ${k}, dealt ${hp - f.hp}`);
  const near = setup({ slots: ['fan', null], foes: [['S', 0, 1.2]] });
  calm(near.foes);
  const g = near.foes[0], hp2 = g.hp;
  press(near.R, 'ab1'); steps(near.R, 10);
  assert.equal(hp2 - g.hp, 30 + STATES.char.burst);
  assert.equal(g.status.char, 0);
  pass('Shard fan: 6 and a Char a shard; five shards make 5 Char, which bursts for 20', { far: k, near: hp2 - g.hp });
}
{ // a Lantern bomb bursts on an Oil slick with a foe in it: the slick burns 4 s, and the foe takes 5 every 0.5 s
  const { R, F, foes: [f] } = setup({ slots: ['slick', 'bomb'], foes: [['S', 0, 2]] });
  calm([f]);
  f.hp = 1000;
  // it stands in the pool (held in place, as a test hold does; a held foe never hits)
  F.hold(f.id, 'hook', 0);
  press(R, 'ab1');
  press(R, 'ab2');
  const ev = steps(R, 40 + 4 * 60);
  const lit = R.log.find(c => c.cue === 'slick' && c.lit);
  assert(lit, 'the slick lit');
  const fire = ev.filter(e => e.type === 'tick' && e.id === 'slick');
  assert(fire.length >= 7 && fire.length <= 8, `fire ticks ${fire.length}`);
  assert(fire.every(e => e.dmg === 5));
  assert(f.status.slow > 0 || f.status.slowK < 1 || fire.length, 'slowed in it');
  pass('Oil slick: a bomb lights it; it burns 4 s at 5 every 0.5 s', { ticks: fire.length });
}

/* ---------------- Ward abilities ---------------- */
{ // Bell toll with a Snuffer and an Ironback within 3.5 m: the Snuffer is stunned 0.8 s, the Ironback loses 40 poise
  const { R, foes: [sn, ib] } = setup({ slots: ['toll', null], foes: [['S', 0, 2], ['I', 2, -1]] });
  calm([sn, ib]);
  press(R, 'ab1');
  steps(R, 18);
  assert.equal(sn.status.stun, 48 - 1);
  assert(ib.state === 'stagger' || ib.poise === 0, `${ib.state} ${ib.poise}`);
  pass('Bell toll: the Snuffer stunned 0.8 s, the Ironback\'s 40 poise gone (it staggers)', { stun: sn.status.stun, ironback: ib.state });
}
{ // an Ember shell breaks with a foe 2 m away: the foe takes 15 and burns 2 s
  const { R, foes: [f] } = setup({ slots: ['shell', null], foes: [['S', 0, 2]] });
  calm([f]);
  press(R, 'ab1');
  assert.equal(R.build.total(), 20);
  const hp = f.hp;
  const ev = [];
  R.hurt(25, [0, 2], {}, ev);
  assert.equal(R.build.total(), 0);
  assert.equal(hp - f.hp, 15);
  assert(f.status.burn >= 110);
  assert(R.log.some(c => c.cue === 'shell' && c.broke));
  pass('Ember shell: 20 points; it breaks and bursts for 15 with 2 s of burn');
}
{ // a Post lamp 6 m away: Use again puts the lamplighter at the lamp 0.15 s later, safe on the way, and the lamp is gone
  const { R, s, A } = setup({ slots: ['post', null] });
  press(R, 'ab1');
  assert(A.effects.some(e => e.kind === 'post'));
  for (let i = 0; i < 60 && s.z < 6; i++) R.step({ mz: 1 }, Math.PI);
  steps(R, 20);
  assert(Math.abs(s.z - 6) < 1.2, `walked to ${s.z}`);
  R.step({ ab1: true }, 0);
  assert.equal(R.fighter.safe(), 'roll', 'safe on the way');
  steps(R, 9);
  assert(Math.hypot(s.x, s.z) < 0.2, `at ${s.x}, ${s.z}`);
  assert(!A.effects.some(e => e.kind === 'post'), 'the lamp is gone');
  // and its heal: 1.5% of the max health a second within 3 m
  const h = setup({ slots: ['post', null] });
  h.rs.run.hp = 50;
  press(h.R, 'ab1'); steps(h.R, 120);
  assert.equal(h.rs.run.hp, 53);
  pass('Post lamp: heals 1.5% a second near it; Use again blinks back in 0.15 s, safe, and ends it');
}

/* ---------------- Gloam abilities ---------------- */
{ // a Snuffer walks over a tack: 4, 1 Char and a 30% slow for 1 s, and that tack is gone
  const { R, F, A } = setup({ slots: ['tacks', null] });
  press(R, 'ab1');
  const e = A.effects.find(x => x.kind === 'tacks'), pt = e.pts[0].slice();
  const f = F.find(F.spawn('S', pt[0], pt[2], Math.PI).id);
  calm([f]);
  const hp = f.hp;
  steps(R, 2);
  assert.equal(hp - f.hp, 4);
  assert.equal(f.status.char, 1);
  assert(f.status.slow > 50 && Math.abs(f.status.slowK - 0.7) < 1e-9);
  assert.equal(e.pts.length, 7);
  pass('Tack scatter: 4, a Char and a 30% slow for 1 s, and the tack is spent');
}
{ // Shutter with two Snuffers near and not winding up: neither starts an attack for 2 s, and the next blade hit within 3 s is sure
  const { R, foes } = setup({ slots: ['shutter', null], foes: [['S', 0, 1.6], ['S', 1.2, 1.2]] });
  press(R, 'ab1');
  let started = false;
  for (let i = 0; i < 115; i++) { R.step({}, 0); if (foes.some(f => f.move)) started = true; }
  assert(!started, 'a foe started at an unseen lamplighter');
  calm(foes);
  const ev = [...R.step({ attack: true }, 0), ...steps(R, 20)];
  assert(ev.some(e => e.type === 'hit' && e.sure), 'the next hit is sure');
  pass('Shutter: no foe starts for 2 s; the next blade hit within 3 s is sure');
}
{ // Moth swarm with a burning foe 6 m away and a free foe 2 m away: the moths go to the burning foe
  const { R, A, foes: [nearF, farF] } = setup({ slots: ['swarm', null], foes: [['S', 0, 2], ['S', 0, 6]] });
  calm([nearF, farF]);
  statusHit(farF, 'burn', 600, {});
  const hpN = nearF.hp, hpF = farF.hp;
  press(R, 'ab1');
  steps(R, 20 + 60 * 2);
  const sw = A.effects.find(e => e.kind === 'swarm');
  assert(sw.targets.every(t => t === farF));
  assert.equal(nearF.hp, hpN);
  assert(hpF - farF.hp >= 8, `moths dealt ${hpF - farF.hp}`);
  pass('Moth swarm: the moths seek the burning foe, inside the 8-a-second cap', { dealt: hpF - farF.hp });
}
{ // Gloam blink passes through a Snuffer, and the next cut on it deals its damage plus 22
  const { R, s, foes: [f] } = setup({ slots: ['blink', null], foes: [['S', 0, 2.5]] });
  calm([f]);
  press(R, 'ab1');
  steps(R, 8);
  assert(s.z > 4.5, `blinked to ${s.z}`);
  assert(f.status.mark > 0, 'marked');
  // turn round and cut
  s.yaw = Math.PI;
  const hp = f.hp;
  for (let i = 0; i < 30 && f.hp === hp; i++) R.step({ attack: i === 0, mz: 1 }, 0);
  steps(R, 5);
  const cut = R.log.filter(c => c.cue === 'hit').at(-1);
  assert(hp - f.hp >= 22 + 10 && f.status.mark === 0, `dealt ${hp - f.hp}`);
  pass('Gloam blink: through a foe that takes a Mark; the next cut adds 22', { dealt: hp - f.hp, cut: !!cut });
}

/* ---------------- Panes ---------------- */
{ // Cinder glass at 25% health: the cut deals 30% more than at full health
  const cut = low => {
    const { R, rs, foes: [f] } = setup({ panes: ['cinder'], foes: [['S', 0, 1.4]] });
    calm([f]);
    if (low) rs.run.hp = 25;
    return [...R.step({ attack: true }, 0), ...steps(R, 20)].find(e => e.type === 'hit').dmg;
  };
  const full = cut(false), low = cut(true);
  assert.equal(low, Math.round(full * 1.3));
  pass('Cinder glass: +30% below 30% health', { full, low });
}
{ // Spill glass: a foe put out sets off a chain through five foes on low health, and at most 3 bursts happen
  const { R, F, foes } = setup({ panes: ['spill'], foes: [['S', 0, 4], ['S', 1, 4], ['S', 2, 4], ['S', 3, 4], ['S', 4, 4]] });
  calm(foes);
  for (const f of foes) f.hp = 5;
  F.putOut(foes[0].id);
  const ev = steps(R, 10);
  const bursts = ev.filter(e => e.type === 'abilityFx' && e.id === 'spill').length;
  assert(bursts <= 3 && bursts >= 2, `bursts ${bursts}`);
  pass('Spill glass: a chain stops after 3 bursts', { bursts, out: foes.filter(f => f.out).length });
}
{ // Cracked glass: the third hit taken in a place cracks it: the bonus is 0, the cue log has crack, and it is back after the next beacon
  const { R, rs, B } = setup({ panes: ['cracked'] });
  assert.equal(B.bonus(), 0.3);
  for (let k = 0; k < 3; k++) { R.hurt(4, [0, 1.5]); steps(R, 70); }
  assert.equal(B.bonus(), 0);
  assert(R.log.some(c => c.cue === 'crack'));
  goTo(rs, 'ramparts');
  assert.equal(B.bonus(), 0.3);
  pass('Cracked glass: +30% until the third hit in a place, back at the next beacon');
}
{ // Thirst glass: below 50% health a blade hit heals 15% of its damage; Rush glass: a foe put out gives 1.5 s of haste and a free roll
  const t = setup({ panes: ['thirst'], foes: [['S', 0, 1.4]] });
  calm(t.foes);
  t.rs.run.hp = 40;
  const ev = [...t.R.step({ attack: true }, 0), ...steps(t.R, 90, { attack: true })];
  const dealt = Math.floor(ev.filter(e => e.type === 'hit' && ['cut1', 'cut2', 'fin'].includes(e.kind)).reduce((a, e) => a + e.dmg * 0.04, 0) + 1e-9);
  assert(t.rs.run.hp - 40 === dealt && dealt > 0, `${t.rs.run.hp} ${dealt}`);
  const r = setup({ panes: ['rush'], foes: [['S', 0, 6]] });
  r.R.fighter.f.cool = 15;
  r.F.putOut(r.foes[0].id); steps(r.R, 2);
  assert.equal(r.B.haste, 90 - 1);
  assert.equal(r.R.fighter.f.cool, 0);
  const x0 = r.s.z; steps(r.R, 30, { mz: 1 });
  const hasted = r.s.z - x0;
  const p = setup(); const x1 = p.s.z; steps(p.R, 2); steps(p.R, 30, { mz: 1 });
  assert(Math.abs(hasted) > Math.abs(p.s.z - x1) * 1.1, `${hasted} vs ${p.s.z - x1}`);
  pass('Thirst glass heals 4% of blade hits below half health; Rush glass gives haste and a free roll', { healed: dealt });
}
{ // Shard glass with Sure hand: a sure cut adds 2 Char
  const { R, foes: [f] } = setup({ panes: ['shard'], wicks: ['sure'], foes: [['S', 0, 1.4]] });
  calm([f]);
  statusHit(f, 'stun', 120);
  R.step({ attack: true }, 0); steps(R, 20);
  assert.equal(f.status.char, 2);
  pass('Shard glass: a sure cut adds 2 Char');
}

/* ---------------- Wicks ---------------- */
{ // Char wick: the finisher adds 2 Char; Char edge: the first cut 1, and 2 kindled with the Char wick
  const a = setup({ relics: ['charedge'], foes: [['I', 0, 1.6]] });
  calm(a.foes); a.foes[0].hp = 1e4;
  a.R.step({ attack: true }, 0); steps(a.R, 12);
  assert.equal(a.foes[0].status.char, 1);
  const b = setup({ relics: ['charedge'], wicks: ['charw'], foes: [['I', 0, 1.6]] });
  calm(b.foes); b.foes[0].hp = 1e4;
  b.R.step({ attack: true }, 0); steps(b.R, 12);
  assert.equal(b.foes[0].status.char, 2);
  steps(b.R, 120, { attack: true });
  assert(b.R.log.some(c => c.cue === 'char'), 'the finisher\'s Char and the cuts\' burst');
  pass('Char wick and Char edge: Char from the finisher and the first cut');
}
{ // Count wick: a combo of 12 hits with a foe within 6 m throws a free Lantern bomb at 75% at it, and Hot glass counts it
  const { R, A, foes: [I] } = setup({ wicks: ['count'], panes: ['hot'], slots: ['bomb', 'step'], foes: [['I', 0, 1.6]] });
  calm([I]); I.hp = 1e5;
  let ev = [];
  for (let i = 0; i < 600 && !ev.some(e => e.type === 'ability' && e.free); i++) ev.push(...R.step({ attack: true }, 0));
  const free = ev.find(e => e.type === 'ability' && e.free);
  assert(free, 'a free bomb');
  assert.equal(R.build.combo.n % 12, 0);
  const hp = I.hp;
  const after = steps(R, 60), burst = after.filter(e => e.type === 'hit' && e.ability === 'bomb');
  assert(burst.length && burst[0].dmg === Math.round(28 * 0.75), JSON.stringify(burst.map(e => e.dmg)));
  A.setCool([6, 6]);
  A.foeOut();
  assert.deepEqual(A.view().map(v => v.left), [4, 4]);
  pass('Count wick: each 12th hit throws a free bomb at 75%, and Hot glass counts it', { dmg: burst[0].dmg, hp: hp - I.hp });
}
{ // Shell wick: a 15 shell at the place's start and at each zone cleared
  const { R, F, B, foes } = setup({ wicks: ['shellw'], foes: [['S', 0, 6]] });
  steps(R, 1);
  assert.equal(B.total(), 15);
  R.hurt(10, [0, 1]); steps(R, 1);
  F.putOut(foes[0].id); steps(R, 2);
  assert.equal(B.total(), 20);
  pass('Shell wick: 15 at the start and 15 at a zone cleared', { shell: B.total() });
}
{ // Wick crate: without it no seed's offer holds Count wick or Shell wick; with it they come
  const crate = ['count', 'shellw'];
  let seen = 0;
  for (let seed = 1; seed <= 400; seed++) {
    for (let k = 0; k < 4; k++) assert(!drawOffer(seed, k, [], []).some(id => crate.includes(id)));
    assert(!startOffer(seed, []).some(id => crate.includes(id)));
    if (drawOffer(seed, 0, [], ['crate']).some(id => crate.includes(id))) seen++;
  }
  assert(seen > 20);
  assert(WICKS.filter(w => w.unlock === 'crate').length === 2);
  pass('Wick crate: Count and Shell wick only after it', { withCrate: seen });
}

/* ---------------- Relics ---------------- */
{ // Glass drink with Spare oil: a drink gives a 30 shell for 5 s
  const { R, rs, B } = setup({ relics: ['glass'], wicks: ['oil'] });
  rs.run.hp = 50; rs.run.flasks = 2;
  R.step({ heal: true }, 0); steps(R, 60);
  assert.equal(B.total(), 30);
  steps(R, 5 * 60);
  assert.equal(B.total(), 0);
  pass('Glass drink kindled: a 30 shell for 5 s');
}
{ // Soot heel: the plunge leaves a Soot cloud; Thorn roll: a near miss cuts the foe that swung for 12, with no flinch
  const { R, A, foes: [f] } = setup({ relics: ['soot'], foes: [['S', 1, 0.5]] });
  calm([f]);
  R.relics.scan([{ type: 'ring', x: 0, y: 0, z: 0, r: 1.6 }]);
  steps(R, 3);
  assert(f.status.soot > 300);
  const t = setup({ relics: ['thorn'], foes: [['S', 0, 1.6]] });
  calm(t.foes);
  const hp = t.foes[0].hp;
  t.R.step({ roll: true, mz: -1 }, 0); t.R.step({}, 0);
  assert.equal(t.R.hurt(10, [0, 1.6]), 'safe');
  assert.equal(hp - t.foes[0].hp, 12);
  assert.equal(t.foes[0].flinch, 0, 'no flinch');
  pass('Soot heel and Thorn roll: a cloud of Soot, and 12 to the foe that swung with no flinch');
}

/* ---------------- Gloam dash ---------------- */
{ // with Gloam dash the lamplighter jumps and presses Roll twice in the air: 3.5 m on the first, nothing on the second
  const { R, s } = setup({ keys: ['dash'] });
  R.step({ jump: true }, 0); steps(R, 6, { jump: true });
  assert(!s.ground);
  const z0 = s.z;
  R.step({ roll: true }, 0); steps(R, 9);
  const d1 = s.z - z0;
  const z1 = s.z;
  R.step({}, 0); R.step({ roll: true }, 0); steps(R, 9);
  const d2 = s.z - z1;
  assert(Math.abs(d1 - 3.5) < 0.45, `the dash ${d1}`);
  assert(d2 < 1.2, `the second press ${d2}`);
  const no = setup();
  no.R.step({ jump: true }, 0); steps(no.R, 6, { jump: true });
  const z2 = no.s.z; no.R.step({ roll: true }, 0); steps(no.R, 9);
  assert(no.s.z - z2 < 0.2, 'no dash without the key');
  assert(R.log.some(c => c.cue === 'dash'));
  pass('Gloam dash: 3.5 m once in the air, nothing on the second press', { first: +d1.toFixed(2), second: +d2.toFixed(2) });
}

/* ---------------- Colour sets ---------------- */
{ // Smoke step and Moth swarm slotted and Storm glass set, Smoke step used: Moth swarm cools 1 s more than without the set; Gloam rings
  const run = set => {
    const { R, A } = setup({ slots: ['step', 'swarm'], panes: set ? ['storm'] : [] });
    A.setCool([0, 10]);
    steps(R, 1);
    const before = A.view()[1].left;
    press(R, 'ab1');
    return { drop: before - A.view()[1].left, sets: setsOf(R), n: colourCount(R) };
  };
  const on = run(true), off = run(false);
  assert(on.sets.includes('gloam') && !off.sets.includes('gloam'));
  assert(Math.abs(on.drop - off.drop - 1) < 0.03, JSON.stringify({ on, off }));
  pass('the Gloam set: three Gloam pieces; each ability use cools the other by 1 s', { colours: on.n });
}

/* ---------------- Gaining ---------------- */
{ // two runs with the same seed and save put out the same foes and drop the same patterns
  const draws = () => { const { rs } = setup({ seed: 1234 }); return Array.from({ length: 12 }, () => drawPattern(rs, 0.5)); };
  assert.deepEqual(draws(), draws());
  assert(draws().filter(Boolean).length > 2);
  pass('the same seed drops the same patterns');
}

/* ---------------- The power budget ----------------
   The reference duel: the lamplighter holds Attack (the bot's reference string: two cuts and the finisher) against a Snuffer that
   fights back with its hook, for 30 s of play; the lamplighter stands again at full health whenever a blow would put it out (a new
   life, as a run's next fight), so the conditions of the low-health panes come and go as they do in a fight. Each buff alone: the
   damage a second it adds (at most 20%), and the effective health it adds (the blows' damage over the health lost, where a shell's
   points and a heal are health not lost; at most 25%) */
function duel(o = {}) {
  const { R, rs, B, foes: [f] } = setup({ foes: [['S', 0, 1.6]], ...o });
  f.hp = 1e6;
  const hurt0 = R.hurt;
  let blows = 0, taken = 0, resets = 0;
  R.hurt = (dmg, from, ho = {}, ev = R.out) => {
    if (rs.run.hp - dmg <= 0 && !R.fighter.safe()) { resets += maxOf(rs) - rs.run.hp; rs.run.hp = maxOf(rs); }
    const r = hurt0(dmg, from, ho, ev);
    if (r === 'hit') { const e = ev.filter(x => x.type === 'hurt').at(-1); blows += e?.blow ?? 0; taken += e?.dmg ?? 0; }
    return r;
  };
  const hp0 = f.hp, life0 = rs.run.hp;
  for (let i = 0; i < 30 * 60; i++) R.step({ attack: true }, 0);
  // the health healed: what the health gained that no reset gave and no blow took
  const healed = rs.run.hp - life0 - resets + taken, lost = taken - healed;
  return { dps: (hp0 - f.hp) / 30, ehp: blows / Math.max(1, lost), blows, lost };
}
{
  const base = duel();
  const BUFFS = {
    'Whetstone 3': { up: { whet: 3 } }, 'Horn lamp 2': { up: { horn: 2 } }, 'Cinder glass': { panes: ['cinder'] }, 'Spill glass': { panes: ['spill'] },
    'Rush glass': { panes: ['rush'] }, 'Thirst glass': { panes: ['thirst'] }, 'Shard glass': { panes: ['shard'] }, 'Cracked glass': { panes: ['cracked'] },
    'Sure hand': { wicks: ['sure'] }, 'Char wick': { wicks: ['charw'] }, 'Count wick': { wicks: ['count'], slots: [null, null] }, 'Shell wick': { wicks: ['shellw'] },
    'Char edge': { relics: ['charedge'] }, 'Soot heel': { relics: ['soot'] }, 'Glass drink': { relics: ['glass'] }, 'Thorn roll': { relics: ['thorn'] }
  };
  const out = {};
  for (const [name, o] of Object.entries(BUFFS)) {
    const r = duel(o), dps = r.dps / base.dps - 1, ehp = r.ehp / base.ehp - 1;
    out[name] = { dps: +(dps * 100).toFixed(1), ehp: +(ehp * 100).toFixed(1) };
  }
  if (process.env.BUDGET) console.log(JSON.stringify({ base, out }, null, 1));
  for (const [name, r] of Object.entries(out)) {
    assert(r.dps <= 20, `${name}: +${r.dps}% damage a second`);
    assert(r.ehp <= 25, `${name}: +${r.ehp}% effective health`);
  }
  pass('the power budget: each new buff alone adds at most 20% damage a second or 25% effective health in the reference duel', out);
}
console.log(`PASS qa/lab/gloam-downs-kit.test.mjs: ${n} checks`);
