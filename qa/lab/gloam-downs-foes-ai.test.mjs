// Gloam Downs' foes in a run, checked in node with no browser (public/lab/gloam-downs/foes.js, fight.js, feel.js, sparks.js,
// markers.js, with run.js and moves.js):
//   each foe's moves against the spec's numbers: the Snuffer's hook (its 33 steps, 16 damage, the push, the safe time, a roll through
//     it), the wind-up rule (the finisher stops a hook, no endless flinch, hit it while it recovers), the Pitchrook's lob onto a ring
//     with one coal in the air, the Mirelight's pulse and its two cuts, the Ironback's charge (the wall stun, the ledge, the lane) and
//     its slam ring; bodies that push apart; a plunge onto a Pitchrook;
//   the same hook, string and roll on the same play steps at 30, 60, 120 and 144 Hz;
//   the tokens (two melee attacks, one coal) and the wait of a foe off screen; the leash and the way home; the ledge probe; foes off
//     their ground and knocked off the edge; glim motes;
//   zones on the baked walk maps: never more than six awake on every route with the foes' own minds, the wait for a free slot, sleep,
//     every guard wakes from every point near it, the guards of The Crow Wall, a cleared zone stays clear, the guard rule and the
//     keepers' toast, the terrace guard pushed off B4;
//   markers on the baked walk maps (90% of rim points within 0.15 m), and markers that stand still before the hit;
//   the feel: the hit flash and the hurt tint for 3 steps at 30 and 144 Hz, the kick, the zoom, the grade (slots 32 to 47 never
//     change), the heartbeat every 55 steps, reduced motion; the pool's slots woken and parked with their foes; the foe step bench.
// Run: node qa/lab/gloam-downs-foes-ai.test.mjs   (GLOAM_WORLDS=0 leaves out the baked places)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, PARAMS, reachable, camLayout, SWINGS } from '../../public/lab/gloam-downs/play.js';
import { STEP, stepCount, startRun, makeRunner, maxOf } from '../../public/lab/gloam-downs/run.js';
import { HITS, MOVES } from '../../public/lab/gloam-downs/moves.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { makeFoes, TYPES, RULES, phaseOf, ringAt, laneAt, keeperLine, fits, makeRoom, FOE_HARD } from '../../public/lab/gloam-downs/foes.js';
import { REEVE as REEVE_HARD } from '../../public/lab/gloam-downs/boss.js';
// these checks test the rules at the numbers of the foes' table; Ember 0's harder factors (FOE_HARD, REEVE.hard) are checked in gloam-downs-foes.test.mjs
FOE_HARD.dmg = 1; FOE_HARD.hp = 1; REEVE_HARD.hard = 1;
import { makeFight, tellGrow, TELL } from '../../public/lab/gloam-downs/fight.js';
import { makeFeel, FEEL } from '../../public/lab/gloam-downs/feel.js';
import { WATER, ringResiduals, laneResiduals } from '../../public/lab/gloam-downs/markers.js';
import { readFigures, makePool } from '../../public/lab/gloam-downs/pool.js';
import { poolFor } from '../../public/lab/gloam-downs/figures.js';
import { ZONES, POOLS, ROUTES } from '../../games/gloam-downs/lib/zones.mjs';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url)), W = DIR + 'worlds/';
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;
const RATES = [30, 60, 120, 144];
const DEG = Math.PI / 180;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------------- made-up ground ---------------- */
function layered(fn, half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz, cells = new Int16Array(2 * N);
  let k = 0;
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++, k++) { const v = fn(info.x0 + i * info.step, info.z0 + j * info.step); cells[k] = cells[N + k] = Math.round(v * 100); }
  return makeWalk(info, cells);
}
const FLAT = layered(() => 0);
// a wall 3 high across z 1..3 (behind a lamplighter at z 0 that faces -z)
const WALLED = layered((x, z) => (z >= 1 && z <= 3 ? 3 : 0));
// a trench 1 m wide and 3 deep across z -1..0
const TRENCH = layered((x, z) => (z >= -1 && z <= 0 ? -3 : 0));
// a ledge 2 high for z >= 3
const LEDGE = layered((x, z) => (z >= 3 ? 2 : 0));
// a terrace 4.5 high for z >= 3, as at The Bell Knoll
const TERRACE = layered((x, z) => (z >= 3 ? 4.5 : 0));
// a shelf at 0 for z <= 1, and a drop of 10 beyond it
const CLIFF = layered((x, z) => (z > 1 ? -10 : 0));

/* a fight on a walk map: a run with seed 7, the lamplighter at (x, z) facing yaw, the foes with these zones and pool slots, the
   runner stepping them. hp sets the health (over the maximum, so a long check does not end in death) */
function fightOn(walk, { x = 0, z = 0, yaw = Math.PI, slots = 'SSSSSPMI', zones = [], seed = 7, hp, meta = {}, onScreen } = {}) {
  const rs = RS.fresh();
  startRun(rs, seed);
  if (hp) rs.run.hp = hp;
  const bounds = meta.bounds ?? 20;
  const body = makeBody(walk, { p: [x, walk.top(x, z) + 0.5, z], yaw }, bounds, { ...PARAMS });
  const F = makeFoes({ walk, meta: { zones, bounds, id: meta.id, spawn: meta.spawn }, slots, seed, onScreen, water: WATER[meta.id] });
  const hurts = [];
  const R = makeRunner({ walk, meta: { wisps: meta.wisps || [], beacon: meta.beacon || { p: [90, 0, 90], r: 1 } }, body, rs, targets: F.targets, lightable: F.lightable, drop: F.drop, think: F.think, onLight: F.bank });
  const hurt = R.hurt;
  R.hurt = (...a) => { const r = hurt(...a); hurts.push({ r, dmg: a[0], play: R.clock.play }); return r; };
  F.bind(R);
  return { rs, body, s: body.s, F, R, hurts, log: R.log };
}
// step n game steps; inp is a fixed input or a function of the step; each(i) runs after each step. -> every event, with its step
function run(W, count, inp = {}, each = null, cam = 0) {
  const all = [];
  for (let i = 0; i < count; i++) {
    for (const e of W.R.step(typeof inp === 'function' ? inp(i) : inp, cam)) all.push({ ...e, i });
    if (each && each(i) === false) break;
  }
  return all;
}
const foe = (W, id) => W.F.find(id);
const spawn = (W, type, x, z, yaw = 0) => { const r = W.F.spawn(type, x, z, yaw); assert(r.ok, JSON.stringify(r)); return foe(W, r.id); };
const cueSteps = (W, name) => W.log.filter(c => c.cue === name).map(c => c.play);
const damage = W => W.hurts.filter(h => h.r === 'hit' || h.r === 'dead');

/* ---------------- the Snuffer's hook ---------------- */
{ // the scrape on the first step of the wind-up, and the hook 33 play steps later for 16, pushing the lamplighter 1.2 m back
  const W = fightOn(FLAT);
  const S = spawn(W, 'S', 0, -2.5, 0);
  const z0 = W.s.z;
  let blink = 0;
  run(W, 33 + 15 + 54, {}, () => { if (W.s.hide) blink++; });
  const scrape = cueSteps(W, 'scrape')[0], hurt = cueSteps(W, 'hurt')[0];
  assert.equal(hurt - scrape, 33, `the hook lands ${hurt - scrape} play steps after the scrape`);
  assert.equal(W.rs.run.hp, 84);
  assert(near(W.s.z - z0, 1.2, 0.15), `pushed ${(W.s.z - z0).toFixed(3)} m`);
  assert(blink > 4, 'the figure blinks in the safe time');
  assert.equal(S.T.moves.hook.wind, 33);
  pass('the hook: the scrape on the first step of its wind-up, 16 damage 33 play steps later, a push of 1.2 m, and the blink', { scrape, hurt, push: +(W.s.z - z0).toFixed(3), blink });
}
{ // a second hook within 0.9 s does no damage: it passes in the safe time, and tests its later active steps
  const W = fightOn(FLAT);
  spawn(W, 'S', -0.6, -2.4, 0);
  const B = spawn(W, 'S', 0.6, -2.4, 0);
  W.F.hold(B.id, 'hook', 0);
  run(W, 10);
  W.F.hold(B.id, null);
  run(W, 60);
  const dmg = damage(W), safe = W.hurts.filter(h => h.r === 'safe');
  assert.equal(dmg.length, 1, `${dmg.length} hooks took health`);
  assert(safe.length >= 1, 'the second hook tried, in the safe time');
  assert.equal(W.rs.run.hp, 84);
  pass('a second hook within 0.9 s does no damage: it tries on its active steps and passes', { safe: safe.length });
}
{ // walk into a Snuffer that is not attacking: no damage, and the two push apart
  const W = fightOn(FLAT);
  const S = spawn(W, 'S', 0, -2.0, 0);
  S.cool = 1e6;
  let least = Infinity;
  run(W, 120, { mz: 1 }, () => { least = Math.min(least, Math.hypot(W.s.x - S.x, W.s.z - S.z)); });
  assert.equal(W.rs.run.hp, 100);
  assert(least >= S.T.r + PARAMS.radius - 0.2, `they came within ${least.toFixed(2)} m`);
  pass('walk into a foe that is not attacking: no damage, and the two push apart', { least: +least.toFixed(3) });
}
{ /* roll through a hook: a Snuffer 2.0 m in front winds up, and the roll starts 0.2 s before the hook lands. No damage, it comes out
     behind the Snuffer, and when its safe time ends it is outside the hook's arc */
  const W = fightOn(FLAT);
  const S = spawn(W, 'S', 0, -2.0, 0);
  run(W, 1);
  assert.equal(S.move, 'hook');
  let outAt = null, was = false;
  run(W, 80, i => ({ roll: i === 32 - 12, mz: i === 32 - 12 ? 1 : 0 }), () => {
    const safe = W.R.fighter.safe() === 'roll';
    if (was && !safe && outAt === null) outAt = { a: Math.abs(wrap(Math.atan2(W.s.x - S.x, W.s.z - S.z) - S.yaw)) / DEG, behind: W.s.z < S.z };
    was = safe;
  });
  assert.equal(W.rs.run.hp, 100, 'no damage');
  assert(outAt && outAt.behind && outAt.a > 60, JSON.stringify(outAt));
  pass('roll through a hook: no damage, out behind the Snuffer and outside its arc when the safe time ends', { angle: +outAt.a.toFixed(1) });
}
{ /* the finisher stops a hook: a Snuffer held in its wind-up takes the two cuts; let go, the finisher lands in its wind-up and knocks
     it down for 0.6 s, and the hook never lands */
  const W = fightOn(FLAT);
  const S = spawn(W, 'S', 0, -1.6, 0);
  W.F.hold(S.id, 'hook', 0);
  let downFor = 0, play = W.R.clock.play;
  // Attack held through the string (the hit stops of the two cuts put the finisher's start past game step 40); the knock-down counts
  // play steps, which hit stop holds
  run(W, 140, i => { if (i === 30) W.F.hold(S.id, null); return { attack: i < 60 }; }, () => { if (S.state === 'down' && W.R.clock.play > play) downFor++; play = W.R.clock.play; });
  assert.equal(W.rs.run.hp, 100, 'the hook did not land');
  assert.equal(downFor, 36, `down for ${downFor} steps`);
  pass('the finisher stops a hook: knocked down for 0.6 s, and the hook does not land', { downFor, hp: S.hp });
}
{ // no endless flinch: a bot with seed 7 swings at three Snuffers for 10 s and never rolls: at least 3 hooks take health
  const W = fightOn(FLAT, { hp: 1000 });
  for (let k = 0; k < 3; k++) spawn(W, 'S', Math.sin((k * 2 * Math.PI) / 3) * 2.6, Math.cos((k * 2 * Math.PI) / 3) * 2.6, (k * 2 * Math.PI) / 3 + Math.PI);
  run(W, 600, { attack: true });
  const n3 = damage(W).length;
  assert(n3 >= 3, `${n3} hooks took health`);
  pass('no endless flinch: at least 3 hooks hit a bot that swings at three Snuffers for 10 s', { hooks: n3, out: W.rs.run.foes });
}
{ /* hit it while it recovers: a hook misses (the lamplighter steps back in the wind-up); 1.5 m from the Snuffer's edge the player
     holds Attack. It stands open for 0.7 s, two cuts land in that time, the finisher lands after it and knocks it down for 0.6 s, and
     the next cut puts it out */
  const W = fightOn(FLAT);
  const S = spawn(W, 'S', 0, -3.0, 0);
  run(W, 1);
  run(W, 30, { mz: -1, slow: true });
  run(W, 3 + 9, {});
  assert.equal(W.rs.run.hp, 100, 'the hook missed');
  assert.equal(phaseOf(S.T.moves.hook, S.mt), 'rec');
  // stand 1.5 m from its edge, facing it
  const ux = Math.sin(S.yaw), uz = Math.cos(S.yaw);
  W.body.place([S.x + ux * (S.T.r + 1.5), 0, S.z + uz * (S.T.r + 1.5)], S.yaw + Math.PI);
  const recLeft = S.T.moves.hook.wind + S.T.moves.hook.act + S.T.moves.hook.rec - S.mt;
  const hits = [];
  run(W, 120, { attack: true }, i => { if (S.out && hits.at(-1) !== 'out') hits.push('out'); });
  const ev = W.log.filter(c => c.cue === 'hit').map(c => c.play), first = ev[0];
  const at = ev.map(p => p - first + 6);
  assert(at[0] <= recLeft && at[1] <= recLeft, `two cuts land in its recovery of ${recLeft} steps: ${at}`);
  assert(at[2] > recLeft, `the finisher lands after it: ${at}`);
  assert(S.out, 'the next cut puts it out');
  assert.equal(at.length, 4);
  pass('hit it while it recovers: two cuts in its 0.7 s, the finisher after, and the next cut puts it out', { hits: at, recovery: recLeft });
}

/* ---------------- the Pitchrook, the Mirelight and the Ironback ---------------- */
{ // the lob: wind-up 0.8 s, then the coal flies 0.65 s onto a ring of 1.4 m fixed where the lamplighter stood; a walk of 2 m away
  const W = fightOn(FLAT);
  const P = spawn(W, 'P', 0, -6, 0);
  let lob = null;
  const ev = run(W, 200, i => (lob !== null && i > lob + 10 ? { mx: 1, slow: false } : {}), i => { if (lob === null && P.move === 'lob') lob = i; });
  const land = ev.find(e => e.type === 'burst' && e.kind === 'coal');
  assert(land, 'the coal landed');
  assert.equal(land.r, 1.4);
  assert(Math.hypot(land.x - 0, land.z - 0) < 0.05, `on the ring laid where it stood: ${land.x}, ${land.z}`);
  assert.equal(damage(W).length, 0, 'no damage');
  assert.equal(land.i - lob, 48 + 4 + 39, `the coal lands ${land.i - lob} steps after the wind-up starts`);
  pass('the Pitchrook: the coal lands on its ring, fixed where the lamplighter stood, and a walk of 2 m out of it takes no damage', { flight: land.i - lob });
}
{ // the Pitchrook's coal hits a lamplighter that stays in its ring: 18
  const W = fightOn(FLAT);
  spawn(W, 'P', 0, -6, 0);
  run(W, 160);
  assert.equal(damage(W)[0]?.dmg, 18);
  pass('the lob hits a lamplighter that stays in its ring for 18');
}
{ // the Mirelight: it swells 0.7 s and pulses a ring of 2.2 m for 18; two cuts put it out
  const W = fightOn(FLAT);
  const M = spawn(W, 'M', 0, -1.6, 0);
  run(W, 60);
  assert.equal(damage(W)[0]?.dmg, 18, 'the pulse hits for 18');
  assert.equal(cueSteps(W, 'pulse')[0] - cueSteps(W, 'hum')[0], 42);
  const W2 = fightOn(FLAT);
  const M2 = spawn(W2, 'M', 0, -1.6, 0);
  let cuts = 0;
  run(W2, 60, { attack: true }, () => { if (M2.out) return false; }), cuts = W2.log.filter(c => c.cue === 'hit').length;
  assert(M2.out && cuts === 2, `out ${M2.out} after ${cuts} cuts`);
  assert(M.T.hp === 14);
  pass('the Mirelight: a pulse of 18 on a ring of 2.2 m after 0.7 s, and two cuts put it out', { cuts });
}
{ /* the Ironback's charge into a wall: the lamplighter stands with a wall behind it and rolls aside as the Ironback charges. The
     Ironback hits the wall, stands stunned for 2 s, and each hit on it deals 50% more */
  const W = fightOn(WALLED, { z: 0 });
  const I = spawn(W, 'I', 0, -6, 0);
  let start = null, stunned = 0;
  run(W, 200, i => ({ roll: start !== null && i === start + 40, mx: start !== null && i === start + 40 ? 1 : 0 }), i => { if (start === null && I.move === 'charge') start = i; if (I.state === 'stun') stunned++; });
  assert.equal(W.rs.run.hp, 100, 'rolled aside');
  assert(I.stunned || stunned >= 100, `stunned ${stunned}`);
  assert(I.z > -1.2 && I.z < 1.0, `it stopped at the wall: z ${I.z.toFixed(2)}`);
  const hp = I.hp, d = I.hit(10, { from: [W.s.x, W.s.z], kind: 'cut1' });
  assert.equal(d, 15, 'a cut of 10 deals 15 on a stunned Ironback');
  assert.equal(hp - I.hp, 15);
  // it stays stunned for 2 s
  const W2 = fightOn(WALLED, { z: 0 });
  const I2 = spawn(W2, 'I', 0, -6, 0);
  let s0 = null, s1 = null;
  run(W2, 400, i => ({ roll: i === 94, mx: i === 94 ? 1 : 0 }), i => { if (I2.state === 'stun') { s0 ??= i; s1 = i; } });
  assert.equal(s1 - s0 + 1, 120, `stunned for ${s1 - s0 + 1} steps`);
  pass('the Ironback charges into a wall: stunned for 2 s, and a hit deals 50% more', { stun: s1 - s0 + 1, at: +I.z.toFixed(2) });
}
{ // the charge at a ledge: it stops dead at the edge of a drop of 3 m and does not fall
  const W = fightOn(TRENCH, { z: 2.5 });
  const I = spawn(W, 'I', 0, -5, 0);
  let lowest = 0, charged = false;
  run(W, 160, {}, () => { lowest = Math.min(lowest, I.y); if (I.move === 'charge' && phaseOf(I.T.moves.charge, I.mt) === 'act') charged = true; });
  assert(charged, 'it charged');
  assert(lowest > -0.05, `it fell to ${lowest}`);
  assert(I.z < -1 && I.z > -2.2, `it stopped at the edge: z ${I.z.toFixed(2)}`);
  pass('the Ironback stops dead at the edge of a drop of 3 m and does not fall', { z: +I.z.toFixed(2) });
}
{ // the charge stops dead 3 m past the leash: from the edge of its leash it runs no farther than 7 m from its zone's centre
  const W = fightOn(FLAT, { z: 6 });
  const I = spawn(W, 'I', 0, -5, 0);
  I.body.place([0, 0, -1.2], 0); I.z = -1.2; // 3.8 m out from its centre, on the side of the lamplighter
  let most = 0, charged = false;
  run(W, 150, {}, () => { most = Math.max(most, Math.hypot(I.x - I.zone.c[0], I.z - I.zone.c[2])); if (I.move === 'charge' && phaseOf(I.T.moves.charge, I.mt) === 'act') charged = true; });
  assert(charged, 'it charged');
  assert(most <= I.zone.leash + 3 + 0.05 && most > I.zone.leash + 2.5, `it ran to ${most.toFixed(2)} m from its centre`);
  pass('the charge stops dead 3 m past the leash', { most: +most.toFixed(2) });
}
{ // the slam: a fire ring grows to 3.0 m over 0.75 s, and it hits only inside
  const W = fightOn(FLAT);
  const I = spawn(W, 'I', 0, -2.4, 0);
  run(W, 1);
  assert.equal(I.move, 'slam');
  const M = I.T.moves.slam, sizes = [0, 22, 44].map(mt => +ringAt(M, mt).toFixed(2));
  assert(sizes[0] < 0.1 && near(sizes[2], 3.0, 0.08), JSON.stringify(sizes));
  // the lamplighter steps back to 3.3 m before the slam lands
  run(W, 44, i => (i < 25 ? { mz: -1, slow: true } : {}));
  run(W, 10);
  assert.equal(damage(W).length, 0, 'outside the ring, no damage');
  const W2 = fightOn(FLAT);
  spawn(W2, 'I', 0, -2.4, 0);
  run(W2, 60);
  assert.equal(damage(W2)[0]?.dmg, 20, 'inside it, 20');
  pass('the slam: its ring grows to 3.0 m over 0.75 s, and it hits only inside it, for 20', { sizes });
}
{ /* step out of the lane: when the charge's lane stops moving (0.3 s before the run), the lamplighter walks 1.5 m to the side and
     takes no damage; the lane is 1.6 m wide and stands still from then on */
  const W = fightOn(FLAT);
  const I = spawn(W, 'I', 0, -4.5, 0);
  run(W, 1);
  assert.equal(I.move, 'charge');
  const M = I.T.moves.charge;
  run(W, M.grow - 1);
  const lane = { ...I.lane };
  let moved = false, x0 = W.s.x;
  run(W, M.wind - M.grow, { mx: 1 }, () => { if (Math.abs(I.lane.yaw - lane.yaw) > 1e-9 || I.lane.x !== lane.x) moved = true; });
  run(W, 60, i => ({ mx: Math.abs(W.s.x - x0) < 1.5 ? 1 : 0 }));
  assert(!moved, 'the lane stands still for the last 0.3 s');
  assert.equal(damage(W).length, 0, 'no damage');
  assert.equal(M.width, 1.6);
  assert(near(laneAt(M, M.grow), 7, 1e-9));
  pass('step out of the lane: it stands still 0.3 s before the run, and 1.5 m to the side is safe', { side: +(W.s.x - x0).toFixed(2) });
}
{ // a plunge from a ledge 2 m above a Pitchrook: straight down, 19 damage or more, knocked down, a ring of sparks
  const W = fightOn(LEDGE, { z: 4, yaw: Math.PI });
  const P = spawn(W, 'P', 0, 1.6, Math.PI);
  W.F.hold(P.id, 'lob', 0);
  let pressed = false, x0 = null, plunge = null, after = null;
  const ev = run(W, 120, () => {
    const over = W.s.z < P.z + 0.3, air = !W.s.ground && W.s.y - W.s.floor >= 0.8;
    if (!pressed && over && air) { pressed = true; x0 = [W.s.x, W.s.z]; W.F.hold(P.id, null); return { attack: true }; }
    return pressed ? {} : { mz: 1, jump: true };
  }, () => { if (W.R.fighter.f.move === 'plunge') plunge ??= [W.s.x, W.s.z]; if (W.R.fighter.f.move === 'land') after ??= P.state; });
  const hit = ev.find(e => e.type === 'hit' && e.kind === 'plunge'), ring = ev.find(e => e.type === 'ring');
  assert(hit && hit.dmg >= 19, `the plunge dealt ${hit?.dmg}`);
  assert(ring, 'a ring of sparks on the ground');
  assert.equal(after, 'down', 'the Pitchrook is knocked down');
  assert(Math.hypot(plunge[0] - x0[0], plunge[1] - x0[1]) < 0.05, 'it falls straight down');
  pass('a plunge from a ledge 2 m above a Pitchrook: 19 or more, knocked down, a ring of sparks', { dmg: hit.dmg });
}

/* ---------------- the same at every frame rate ---------------- */
{ /* a Snuffer's hook, the lamplighter's string and its roll land on the same play steps at 30, 60, 120 and 144 Hz. Each press is a
     tap read by frame k·f/6 + 1, the first frame after k/6 s */
  const PRESSES = { 3: 'attack', 4: 'attack', 9: 'roll', 15: 'attack' };
  const runs = RATES.map(hz => {
    const W = fightOn(FLAT);
    spawn(W, 'S', 0, -2.6, 0);
    let acc = 0, latch = {};
    for (let i = 1; i <= hz * 4; i++) {
      const start = (i - 1) / hz, k = Math.round(start * 6);
      if (Math.abs(start * 6 - k) < 1e-9 && PRESSES[k]) latch[PRESSES[k]] = true;
      const c = stepCount(acc, 1 / hz); acc = c.acc;
      for (let j = 0; j < c.n; j++) W.R.step({ ...latch }, 0);
      if (c.n) latch = {};
    }
    const at = name => W.log.filter(c => c.cue === name).map(c => c.play);
    return { hz, swing: at('swing'), hit: at('hit'), roll: at('roll'), scrape: at('scrape'), hurt: at('hurt'), hp: W.rs.run.hp, x: +W.s.x.toFixed(4), z: +W.s.z.toFixed(4) };
  });
  for (const r of runs) for (const k of ['swing', 'hit', 'roll', 'scrape', 'hurt', 'hp', 'x', 'z']) assert.deepEqual(r[k], runs[0][k], `${r.hz} Hz: ${k} ${JSON.stringify(r[k])} against ${JSON.stringify(runs[0][k])}`);
  assert(runs[0].scrape.length && runs[0].swing.length && runs[0].roll.length);
  pass('the same hook, string and roll on the same play steps at 30, 60, 120 and 144 Hz', { scrape: runs[0].scrape, hurt: runs[0].hurt, swing: runs[0].swing, roll: runs[0].roll });
}

/* ---------------- tokens, leash, home, ledges, the edge, glim ---------------- */
{ // a group: three Snuffers and a Pitchrook. No more than two hooks wind up or land at once, and one coal in the air
  const W = fightOn(FLAT, { hp: 1e4 });
  for (let k = 0; k < 3; k++) spawn(W, 'S', Math.sin(k * 2.1) * 3, Math.cos(k * 2.1) * 3, 0);
  spawn(W, 'P', 0, -7, 0);
  let most = 0, coals = 0, hooks = 0;
  run(W, 1200, {}, () => {
    const now = W.F.foes.filter(f => f.move === 'hook' && ['wind', 'act'].includes(phaseOf(f.T.moves.hook, f.mt))).length;
    most = Math.max(most, now);
    coals = Math.max(coals, W.F.coals.length);
    hooks += now ? 1 : 0;
  });
  assert(most <= 2 && most >= 2, `at most ${most} hooks at once`);
  assert.equal(coals, 1);
  pass('a group: no more than two hooks wind up or land at once, and only one coal is in the air', { most, coals });
}
{ // a foe off screen waits 0.4 s longer for its token
  const starts = [true, false].map(seen => {
    const W = fightOn(FLAT, { onScreen: () => seen });
    const S = spawn(W, 'S', 0, -2.5, 0);
    let at = null;
    run(W, 60, {}, i => { if (at === null && S.move === 'hook') at = i; });
    return at;
  });
  assert.equal(starts[1] - starts[0], RULES.offWait, `on screen at ${starts[0]}, off screen at ${starts[1]}`);
  pass('a foe whose chest is off screen waits 0.4 s longer before it takes an attack token', { onScreen: starts[0], offScreen: starts[1] });
}
{ // foes that wait for a token hold 3.2 to 3.8 m away and spread round the lamplighter: both melee tokens are taken
  const W = fightOn(FLAT, { hp: 1e4 });
  for (let k = 0; k < 4; k++) { const f = spawn(W, 'S', Math.sin(k * 0.3) * 6, -Math.cos(k * 0.3) * 6, 0); f.zone.leash = 9; }
  W.F.melee.add({}).add({ id: 'held' });
  run(W, 240);
  const ds = W.F.foes.map(f => Math.hypot(f.x - W.s.x, f.z - W.s.z));
  const b = W.F.foes.map(f => Math.atan2(f.x - W.s.x, f.z - W.s.z)).sort((p, q) => p - q);
  const gaps = b.map((v, i) => (i < b.length - 1 ? b[i + 1] - v : b[0] + 2 * Math.PI - v));
  assert(ds.every(d => d >= 3.2 && d <= 3.8), `distances ${ds.map(d => d.toFixed(2))}`);
  assert(Math.min(...gaps) >= 35 * DEG, `bearings ${gaps.map(g => (g / DEG).toFixed(0))}`);
  assert(W.F.foes.every(f => !f.move), 'no wind-up without a token');
  pass('foes that wait for a token hold 3.2 to 3.8 m away and spread round', { d: ds.map(d => +d.toFixed(2)), gaps: gaps.map(g => Math.round(g / DEG)) });
}
{ // the leash: a foe never walks out of it; it chases within the leash plus 8 m, and walks home 4 s after the lamplighter is farther
  const W = fightOn(FLAT, { hp: 1e4 });
  const S = spawn(W, 'S', 0, -4, 0);
  S.hp = 30;
  let out = 0;
  // it chases a lamplighter 6 m from its zone's centre, inside the leash plus 8 m, but never walks out of its leash of 4 m
  W.body.place([0, 0, 2], Math.PI);
  run(W, 240, {}, () => { if (Math.hypot(S.x - S.zone.c[0], S.z - S.zone.c[2]) > S.zone.leash + 0.05) out++; });
  W.body.place([0, 0, 13], Math.PI);
  let homeAt = null, home = null;
  run(W, 600, {}, i => { if (homeAt === null && S.state === 'home') homeAt = i; if (home === null && S.state === 'idle') home = i; });
  assert.equal(out, 0, 'never out of its leash');
  assert(homeAt >= RULES.home - 1 && homeAt <= RULES.home + 1, `walks home after ${homeAt} steps`);
  assert(home !== null && W.F.atHome(S), 'it gets home');
  assert.equal(S.hp, 30, 'with the same health');
  pass('leave a fight: the hurt Snuffer walks home after 4 s, with the same health, and never out of its leash', { homeAt, home });
}
{ // the ledge probe: a Snuffer chasing toward a pit stops before the edge
  const W = fightOn(TRENCH, { z: 3.5, hp: 1e4 });
  const S = spawn(W, 'S', 0, -3.5, 0);
  S.zone.leash = 8;
  let lowest = 0, nearest = Infinity;
  run(W, 300, {}, () => { lowest = Math.min(lowest, S.y); nearest = Math.min(nearest, -1 - S.z); });
  assert(lowest > -0.05, `it fell to ${lowest}`);
  pass('a Snuffer that chases toward a pit stops before the edge', { gap: +(nearest - S.T.r).toFixed(2) });
}
{ // knocked off: a plunge pushes a Snuffer off a ledge, it falls more than 6 m under its zone, goes out, and its 3 glim drop on the ledge
  const W = fightOn(CLIFF, { z: -3, hp: 1e4 });
  const S = spawn(W, 'S', 0, 0.6, 0);
  run(W, 2);
  const firm = S.firm.slice();
  S.hit(16, { from: [0, -0.5], push: 1.5, knock: 36, stagger: true, kind: 'plunge' });
  let at = null;
  run(W, 120, {}, () => { if (S.out && at === null) at = W.F.motes.map(m => [m.x, m.y, m.z]); });
  assert(S.out, 'it went out');
  assert.equal(at.length, 3);
  assert(at.every(([x, y, z]) => Math.hypot(x - firm[0], z - firm[2]) < 0.5 && near(y, firm[1] + 0.35, 0.1) && z <= 1), JSON.stringify(at));
  assert.equal(W.rs.run.foes, 1);
  pass('a Snuffer knocked off a ledge, more than 6 m under its zone, goes out and its 3 glim drop on the ledge', { firm });
}
{ // a foe off its ground that is not home 4 s later sinks over 0.6 s and rises at home over 0.9 s, with its health
  const W = fightOn(TERRACE, { z: -7, hp: 1e4 }); // out of its hook's reach, so no hit stop holds the play clock
  const S = spawn(W, 'S', 0, 4, Math.PI);
  run(W, 2);
  S.hit(10, { from: [0, 6], push: 1.2, knock: 0, kind: 'cut1' });
  S.body.place([0, 0, 2], S.yaw); // pushed down off its ground
  let sink = null, rise = null, back = null;
  run(W, 420, {}, i => { if (S.state === 'sink') sink ??= i; if (sink !== null && S.state === 'rise') rise ??= i; if (rise !== null && S.state !== 'rise') back ??= i; });
  assert(near(sink, RULES.off, 2), `sank after ${sink}`);
  assert.equal(rise - sink, RULES.sink);
  assert.equal(back - rise, RULES.rise);
  assert(near(S.y, 4.5, 0.05) && S.hp === 40, `${S.y} ${S.hp}`);
  pass('a foe off its ground sinks 4 s later over 0.6 s and rises at home over 0.9 s, with its health', { sink, rise, back });
}
{ // glim: put out a Snuffer 3 m away; three motes fly in after 0.4 s, and the glim carried goes up by 3
  const W = fightOn(FLAT);
  const S = spawn(W, 'S', 0, -3, 0);
  S.cool = 1e6;
  W.F.putOut(S.id);
  run(W, 23);
  assert.equal(W.rs.run.carried, 0, 'the motes wait 0.4 s');
  run(W, 60);
  assert.equal(W.rs.run.carried, 3);
  // a mote farther than 6 m waits for the lamplighter
  W.F.drop(2, [0, 0, -12]);
  run(W, 120);
  assert.equal(W.rs.run.carried, 3);
  W.body.place([0, 0, -8], 0);
  run(W, 90);
  assert.equal(W.rs.run.carried, 5);
  pass('glim: the motes of a Snuffer put out fly in from 3 m after 0.4 s, and a mote out of reach waits');
}

/* ---------------- hooks and holds ---------------- */
{ // spawn: risen, no cracks, no cooldown, a zone of its own with a leash of 4 m; no free slot, no spawn; a held foe does not hit
  const W = fightOn(FLAT, { slots: 'SS' });
  const ev = [];
  const a = W.F.spawn('S', 0, -1.5, 0), b = W.F.spawn('S', 2, -1.5, 0), c = W.F.spawn('S', -2, -1.5, 0);
  assert(a.ok && b.ok && !c.ok && /slot/.test(c.why), JSON.stringify(c));
  const A = foe(W, a.id);
  assert.equal(A.state, 'chase');
  assert.equal(A.zone.leash, 4);
  assert.deepEqual([A.zone.c[0], A.zone.c[2]], [0, -1.5]);
  W.F.hold(a.id, 'hook', 0.54);
  W.F.hold(b.id, 'hook', 0.54);
  ev.push(...run(W, 60));
  assert.equal(W.rs.run.hp, 100, 'held foes do not hit');
  assert.equal(foe(W, a.id).mt, 32);
  assert(!ev.some(e => e.type === 'cracks'));
  // a cut on the next step hurts a spawned foe
  const W2 = fightOn(FLAT);
  const s2 = W2.F.spawn('S', 0, -1.5, 0);
  run(W2, 1);
  run(W2, 8, i => ({ attack: i === 0 }));
  assert.equal(foe(W2, s2.id).hp, 40);
  pass('spawn: risen with no cracks and no cooldown, its own zone with a leash of 4 m, none with no free slot; a held foe does not hit');
}

/* ---------------- the feel ---------------- */
// a page fight in node: a pool of every foe type over a tiny stand-in place, so fight.js wakes, parks and flashes real slots
const SplatCodec = new Function(fs.readFileSync(DIR + 'ink/splat-codec.js', 'utf8') + '\nreturn SplatCodec;')();
const decode = file => SplatCodec.decode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(file))), { maxRows: 1_000_000 });
const foesFile = (() => { const json = readFigures(JSON.parse(zlib.gunzipSync(fs.readFileSync(`${W}foes.json.gz`)).toString())); return { json, ...decode(`${W}foes.bin.gz`) }; })();
const PAL = JSON.parse(fs.readFileSync(`${W}gaol.json`, 'utf8')).pal;
function pageFight(walk, { codes = 'SSSPMI', still = false, fx = {}, x = 0, z = 0, pivots = undefined } = {}) {
  const meta = { id: 'test', pal: PAL, bones: { names: ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'shadow'], first: 0, end: 4, pivots }, zones: [], bounds: 20 };
  const world = { data: new Float32Array(16 * 4), count: 4, pal: PAL, anim: { bones: new Float32Array(12 * 7), boned: new Int32Array(0) } };
  const pool = makePool(world, meta, poolFor('x', foesFile, null, codes), { extra: 256 });
  const rs = RS.fresh();
  startRun(rs, 7);
  const body = makeBody(walk, { p: [x, 0.5, z], yaw: Math.PI }, 20, { ...PARAMS });
  const G = makeFight({ walk, meta, world, pool, rs, max: () => maxOf(rs), still, fx });
  const R = makeRunner({ walk, meta: { wisps: [], beacon: { p: [90, 0, 90], r: 1 } }, body, rs, targets: G.foes.targets, lightable: G.foes.lightable, drop: G.foes.drop, think: G.think, onLight: G.foes.bank, fx, still });
  G.bind(R);
  const step = inp => { const ev = R.step(inp, 0); for (const e of ev) G.event(e); return ev; };
  return { G, R, rs, pool, world, body, step };
}
{ /* the hit flash and the hurt tint each last 3 game steps at 30 and at 144 frames a second: the same cut on a Snuffer, and the same
     hook. Frames at the rate step the game as the page does (stepCount), and draw once a frame */
  const out = [30, 144].map(hz => {
    const P = pageFight(FLAT);
    const r = P.G.hooks.spawn('S', 0, -1.6, 0);
    const S = P.G.foes.find(r.id);
    P.G.hooks.hold(r.id, 'hook', 0);
    let acc = 0, steps = 0, flashSteps = 0, tintSteps = 0, flashWhenDrawn = 0;
    const slot = P.pool.slots[S.slot];
    for (let f = 0; f < hz * 2; f++) {
      const c = stepCount(acc, 1 / hz); acc = c.acc;
      for (let j = 0; j < c.n; j++) {
        steps++;
        if (steps === 50) P.G.hooks.hold(r.id, null);
        P.step({ attack: steps === 2 });
        if (slot.flash) flashSteps++;
        if (P.G.feel.grade()) tintSteps++;
      }
      P.G.draw({ yaw: 0, pitch: 0.34 });
      if (slot.flash) flashWhenDrawn++;
    }
    return { hz, flashSteps, tintSteps, hp: P.rs.run.hp, foeHp: S.hp };
  });
  for (const o of out) {
    assert.equal(o.flashSteps, 3, `${o.hz} Hz: the flash lasts ${o.flashSteps} steps`);
    assert.equal(o.tintSteps, 3, `${o.hz} Hz: the tint lasts ${o.tintSteps} steps`);
    assert.equal(o.foeHp, 40);
    assert.equal(o.hp, 84);
  }
  pass('the hit flash and the hurt tint each last 3 steps (0.05 s) at 30 and at 144 frames a second', out);
}
{ /* the swing's trail (fight.js trail, sparks.js smear): smears are laid from the strike to the hit step + 1 only, the last one is gone
     8 game steps or less after that step at 60 Hz (hit stop included: the first build's lingered 13 to 17), and each step's three rows
     join into one band (each ribbon spans half the gap to its neighbour along the blade), with the inner row fading first */
  // the stand-in place takes the lamplighter's bone pivots, so the trail is laid
  const pivots = [[0, 80.1, 0], [0, 80.82, 0], [0.15, 80.24, 0], [-0.15, 80.24, 0], [0.33, 80.72, 0.04], [-0.33, 80.72, 0], [0, 120, 0]];
  const P = pageFight(FLAT, { codes: 'SSS', pivots });
  P.G.hooks.spawn('S', 0, -1.6, 0);
  const laid = [], parts = [], smear = P.G.sparks.smear;
  let step = 0, start = -1, hitAt = -1, lastAlive = -1;
  // the swing's own step (play steps: hit stop holds it) on which each piece is laid
  P.G.sparks.smear = (...a) => { const q = smear(...a); laid.push(step); parts.push({ step, t: P.R.fighter.body.s.act?.t, q, life: a[4], along: a[5], span: a[6] }); return q; };
  for (; step < 60; step++) {
    const ev = P.step({ attack: step === 2 });
    for (const e of ev) { if (e.type === 'cue' && e.cue === 'swing' && start < 0) start = step; if (e.type === 'hit' && hitAt < 0) hitAt = step; }
    if (parts.some(p => p.q.life > 0)) lastAlive = step;
  }
  assert(start >= 0 && hitAt > start, `the cut swung (${start}) and hit (${hitAt})`);
  assert(laid.length > 0, 'the trail laid smears');
  const S = SWINGS.cut1;
  const lastT = Math.max(...parts.map(p => p.t));
  assert(lastT <= S.hit + 1 && Math.min(...parts.map(p => p.t)) > S.strike, `smears laid on swing steps ${[...new Set(parts.map(p => p.t))]}, not from the strike (${S.strike}) to the hit step + 1 (${S.hit + 1})`);
  const gone = lastAlive - Math.max(...laid);
  assert(gone <= 8, `the trail lingers ${gone} steps after its last piece`);
  for (const st of new Set(laid)) {
    const ps = parts.filter(p => p.step === st);
    for (const p of ps) assert(p.along && p.span > 0, 'each piece is a ribbon along the blade');
  }
  const inner = parts.filter(p => p.life < Math.max(...parts.map(q => q.life)));
  assert(inner.length > 0 && inner.length < parts.length, 'the inner row fades first');
  pass('the trail: laid from the strike to the hit step + 1, gone within 8 steps of its last piece, one band of ribbons whose inner row fades first', { swingSteps: [...new Set(parts.map(p => p.t))], gameSteps: [...new Set(laid)].map(x => x - start), hit: hitAt - start, gone });
}
{ // the pool's slots: a foe's slot wakes when it rises, flashes on a hit, and parks when its parts have fallen
  const P = pageFight(FLAT, { codes: 'SS' });
  const r = P.G.hooks.spawn('S', 0, -2.2, 0), S = P.G.foes.find(r.id), slot = P.pool.slots[S.slot];
  assert(slot.awake, 'awake at once');
  const boned0 = P.world.anim.boned.length;
  P.G.foes.putOut(r.id);
  P.step({});
  assert(slot.awake && S.state === 'dying', 'its parts fall');
  P.G.draw({});
  for (let i = 0; i < RULES.dying; i++) P.step({});
  assert(!slot.awake && P.world.anim.boned.length < boned0, 'its slot parks');
  pass('a foe put out breaks into its bone parts for 0.6 s, then its slot parks and leaves the bones', { boned: [boned0, P.world.anim.boned.length] });
}
{ /* a tell on a small screen: the tell bones grow so that a metre covers no fewer art pixels than at 1280x720, up to 2 times. At
     1280x720 and 800x600 they keep their size; at 390x844 (art 147x317, about 46,000 px at device scale 3) the Snuffer's cup grows
     about 1.5 times, and the bone's scale in the pool follows */
  const view = (w, h) => { const L = camLayout(w, h); return { dist: L.dist, fov: L.fov }; };
  const desk = tellGrow(view(1280, 720), 180), wide = tellGrow(view(800, 600), 219), phone = tellGrow(view(390, 844), 317), small = tellGrow(view(320, 640), 120);
  assert(near(TELL.px, 23.8, 0.1), `the reference: ${TELL.px} art px a metre`);
  assert.equal(desk, 1);
  assert.equal(wide, 1);
  assert(phone > 1.4 && phone < 1.6, `390x844: ${phone}`);
  assert(small <= TELL.max && small > phone, `320x640 at a low art size: ${small}`);
  assert.equal(tellGrow({}, 317), 1, 'no view, no growth');
  const P = pageFight(FLAT, { codes: 'S' });
  const r = P.G.hooks.spawn('S', 0, -2.2, 0), S = P.G.foes.find(r.id), slot = P.pool.slots[S.slot], b = slot.base + slot.type.index.tell;
  P.G.hooks.hold(r.id, 'hook', 0.54);
  P.step({});
  const scale = () => Math.hypot(P.pool.bones[12 * b], P.pool.bones[12 * b + 1], P.pool.bones[12 * b + 2]);
  P.G.draw({ yaw: 0, pitch: 0.3, ...view(1280, 720) }, { art: 180 });
  const s1 = scale();
  P.G.draw({ yaw: 0, pitch: 0.3, ...view(390, 844) }, { art: 317 });
  const s2 = scale();
  assert(s1 > 0.5 && near(s2 / s1, phone, 0.01), `the cup's scale: ${s1} at 1280x720, ${s2} at 390x844`);
  pass('on a small screen the tells grow to keep the art pixels a metre of 1280x720, up to 2 times', { phone: +phone.toFixed(3), small: +small.toFixed(3), cup: +(s2 / s1).toFixed(3) });
}
{ // the kick, the zoom and the grade: slots 32 to 47 never change; with reduced motion there is no kick and no zoom
  // as on the page: the step runs (and ticks), its hit is felt, and the picture is drawn
  const F = makeFeel({ pal: PAL });
  const kicks = [], zooms = [];
  for (let i = 0; i < 30; i++) {
    F.tick(1);
    if (i === 0) { F.hit('fin'); F.hurt(24); }
    kicks.push(Math.hypot(...F.kick(0.4, 0.34))); zooms.push(F.zoom());
  }
  assert(kicks[0] > 0 && kicks.at(-1) === 0, `the kick falls to 0: ${kicks[0]} .. ${kicks.at(-1)}`);
  assert.equal(zooms.filter(z => z > 1).length, FEEL.zoom, 'the zoom lasts 7 steps, from the step of the hit');
  assert.deepEqual(zooms.slice(0, 8).map(z => z > 1), [true, true, true, true, true, true, true, false]);
  const S = makeFeel({ pal: PAL, still: true });
  S.hit('fin'); S.hurt(24);
  for (let i = 0; i < 10; i++) { S.tick(1); assert.deepEqual(S.kick(0.3, 0.3), [0, 0, 0]); assert.equal(S.zoom(), 1); }
  const off = makeFeel({ pal: PAL, fx: { kick: false, zoom: false, grade: false } });
  off.hurt(24); off.tick(0.1);
  assert.deepEqual(off.kick(0, 0), [0, 0, 0]); assert.equal(off.zoom(), 1); assert.equal(off.grade(), null);
  pass('the camera kick falls to nothing, the zoom lasts 7 steps; none with reduced motion or with the effect turned off', { kick: +kicks[0].toFixed(4) });
}
{ // low health: below 30% the heart beats every 55 steps, the place's colours pull up to 25% toward red, and fire never changes
  const F = makeFeel({ pal: PAL });
  const beats = [];
  let most = 0;
  for (let i = 0; i < 300; i++) {
    const share = i < 40 ? 0.4 : 0.25;
    if (F.tick(share).includes('heart')) beats.push(i);
    const g = F.grade();
    if (g) {
      for (let k = 32; k < 48; k++) assert.equal(g[k], PAL[k], `slot ${k} changed`);
      assert.equal(g[0], PAL[0]);
      const d = Math.max(...g.slice(1, 32).map((c, k) => Math.abs(((c >> 16) & 255) - ((PAL[k + 1] >> 16) & 255)) + Math.abs(((c >> 8) & 255) - ((PAL[k + 1] >> 8) & 255))));
      most = Math.max(most, d);
    }
  }
  assert.equal(beats[0], 40);
  assert(beats.slice(1).every((b, i) => b - beats[i] === FEEL.beat), JSON.stringify(beats));
  assert(most > 0);
  assert(F.pull() <= FEEL.pull + 1e-9);
  const S = makeFeel({ pal: PAL, still: true });
  const pulls = [];
  for (let i = 0; i < 120; i++) { S.tick(0.2); pulls.push(S.pull()); }
  assert(pulls.every(p => p === FEEL.still), 'steady at 15% with reduced motion');
  // the fall's white is fire slot 37 at no more than 50%, and never with reduced motion; the fade goes to ink over 72 steps
  const B = makeFeel({ pal: PAL });
  B.fall(); B.tick(1);
  const g = B.grade();
  assert(g && g.slice(32).every((c, k) => c === PAL[32 + k]));
  S.fall(); S.tick(0.2);
  B.dead();
  for (let i = 0; i < 72; i++) B.tick(1);
  assert(B.grade().every(c => c === PAL[0]));
  pass('low health: a heartbeat every 55 steps, a pull toward red on slots 1 to 31 only, steady at 15% with reduced motion; the fade to ink', { beats: beats.slice(0, 4) });
}
{ // effects turned off: the run still plays, and a Snuffer goes out
  const fx = { stop: false, flash: false, kick: false, zoom: false, grade: false, shake: false };
  const P = pageFight(FLAT, { fx });
  const r = P.G.hooks.spawn('S', 0, -2.0, 0);
  for (let i = 0; i < 600; i++) P.step({ attack: true });
  P.G.draw({});
  assert(P.G.foes.find(r.id).out, 'the Snuffer is out');
  assert.equal(P.R.clock.step, P.R.clock.play, 'no hit stop');
  pass('with every feel effect off, the run plays and the lamplighter puts out a Snuffer');
}
{ // the foe step bench: 6 awake foes with their sight tests and bodies, 600 steps; the median step 0.5 ms or less
  const W = fightOn(FLAT, { hp: 1e7, slots: 'SSSSPMI' });
  for (let k = 0; k < 6; k++) spawn(W, 'SSSSPM'[k], Math.sin(k) * 4, Math.cos(k) * 4, 0);
  const t = [];
  for (let i = 0; i < 600; i++) { const a = performance.now(); W.F.think([], true); t.push(performance.now() - a); W.R.step({}, 0); }
  t.sort((a, b) => a - b);
  const med = t[300];
  assert(med <= 0.5, `the median foe step took ${med.toFixed(3)} ms`);
  pass('the foe step bench: 6 awake foes, median step', { ms: +med.toFixed(3) });
}

/* ---------------- on the baked places ---------------- */
const placeOf = id => {
  const meta = JSON.parse(fs.readFileSync(`${W}${id}.json`, 'utf8'));
  const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${W}${id}.walk.bin.gz`)));
  return { meta, walk: makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1)) };
};
const placeFight = (id, x, z, o = {}) => {
  const { meta, walk } = placeOf(id);
  return { ...fightOn(walk, { x, z, zones: meta.zones, slots: POOLS[id], meta, ...o }), meta, walk };
};
const zoneOf = (W, id) => W.F.zones.find(z => z.id === id);
const awakeCount = W => W.F.zones.filter(z => z.awake).reduce((s, z) => s + z.members.filter(f => !f.out).length, 0);
if (process.env.GLOAM_WORLDS !== '0') {
  { // the hook in the Gaol: health 84, a push of 1.2 m, ±0.15
    // on the yard's flat strip (x -0.5 to 5.5 at z 11), the push running along it
    const W = placeFight('gaol', 3.0, 11, { zones: [], yaw: -Math.PI / 2 });
    spawn(W, 'S', 0.7, 11, Math.PI / 2);
    const x0 = W.s.x;
    run(W, 34 + 5 + 15 + 5); // the hook, the hurt's hit stop of 5 steps, and the push of 0.25 s
    assert.equal(W.rs.run.hp, 84);
    assert(near(W.s.x - x0, 1.2, 0.15), `pushed ${(W.s.x - x0).toFixed(3)}`);
    pass('hit by a hook in the Gaol: 84 health and a push of 1.2 m', { push: +(W.s.x - x0).toFixed(3) });
  }
  { // never more than six awake: each route walked as a runner (who clears only the guard) and as a fighter, with the foes' own minds
    const most = {};
    for (const id of ['gaol', 'ramparts', 'fen', 'bells', 'barrows']) {
      for (const mode of ['runner', 'fighter']) {
        const wp = ROUTES[id], W = placeFight(id, wp[0][0], wp[0][2], { hp: 1e9 });
        const pts = [];
        for (let k = 0; k < wp.length - 1; k++) {
          const a = wp[k], b = wp[k + 1], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.1));
          for (let i = 0; i < m; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / m, a[1] + ((b[1] - a[1]) * i) / m, a[2] + ((b[2] - a[2]) * i) / m]);
        }
        let top = 0;
        const types = {};
        // the runner moves 6 m/s (0.1 m a step); at each zone that wakes, it waits for the rise and clears it as its mode says
        // ... and at the end it stands by the beacon for 2 s, while a guard that woke last rises
        const end = pts[pts.length - 1];
        for (let k = 0; k < 120; k++) pts.push(end);
        for (let i = 0; i < pts.length; i++) {
          W.body.place(pts[i], 0);
          W.R.step({}, 0);
          for (const Z of W.F.zones) if (Z.awake && Z.members.every(f => f.out || !['cracks', 'rise', 'sink'].includes(f.state)) && (mode === 'fighter' || Z.guard)) W.F.putOut(Z.id);
          top = Math.max(top, awakeCount(W));
          for (const t of 'SPMI') types[t] = Math.max(types[t] || 0, W.F.foes.filter(f => f.type === t && f.slot >= 0).length);
        }
        assert(top <= 6, `${id} ${mode}: ${top} awake`);
        for (const t of 'SPMI') assert((types[t] || 0) <= [...POOLS[id]].filter(c => c === t).length, `${id} ${mode}: ${types[t]} ${t} slots held`);
        const guard = W.F.zones.find(z => z.guard && !z.boss);
        if (guard) assert(guard.members.every(f => f.out), `${id} ${mode}: the guard zone ${guard.id} woke and was cleared`);
        most[`${id} ${mode}`] = top;
      }
    }
    pass('never more than six awake on every route, as a runner and as a fighter, with the foes\' own minds and the pool\'s slots', most);
  }
  { // wait for a free slot: with B2's Mirelight awake, B3 stays asleep until that Mirelight is put out
    const W = placeFight('bells', 9.5, 4, { hp: 1e9 });
    W.F.wake('B2');
    run(W, 100);
    W.body.place([-4, 0, 12], 0);
    run(W, 120);
    const B3 = zoneOf(W, 'B3');
    assert(!B3.awake, 'B3 waits for the Mirelight slot');
    W.F.putOut(zoneOf(W, 'B2').members.find(f => f.type === 'M').id);
    run(W, 40);
    assert(B3.awake, 'B3 wakes once the Mirelight is out');
    pass('wait for a free slot: B3 stays asleep while B2\'s Mirelight holds the one Mirelight slot');
  }
  { // a zone sleeps: 20 m from the Gaol's south yard while its Snuffer is home, the zone sleeps and its slot is free
    const W = placeFight('gaol', 0.3, 21.3);
    run(W, 30);
    const G1 = zoneOf(W, 'G1');
    assert(G1.awake, 'the yard woke within 10 m');
    run(W, 120);
    W.body.place([0.3, 0, 31.8], 0);
    run(W, 30);
    assert(!G1.awake && W.F.holders.every(h => !h), 'it sleeps and frees its slot');
    pass('a zone sleeps 16 m away with its foes home, and frees its slot');
  }
  { // come back to a cleared zone: the yard stays empty, and no cracks show
    const W = placeFight('gaol', 0.3, 18);
    run(W, 100);
    W.F.putOut('G1');
    run(W, 60);
    W.body.place([0.3, 0, 31.8], 0);
    run(W, 30);
    W.body.place([0.3, 0, 16], 0);
    const ev = run(W, 120);
    assert(!ev.some(e => e.type === 'cracks' && e.zone === 'G1'), 'no cracks');
    assert(!zoneOf(W, 'G1').awake);
    pass('come back to a cleared zone: it stays empty and shows no cracks');
  }
  { // the guards of The Crow Wall: R3's Pitchrook sinks over 0.6 s while R4's cracks show, then R4's two Snuffers and Pitchrook rise
    const W = placeFight('ramparts', -14.3, -2, { hp: 1e9 });
    run(W, 120);
    const R3 = zoneOf(W, 'R3'), R4 = zoneOf(W, 'R4');
    assert(R3.awake && R3.members[0].state !== 'cracks', 'R3 is awake');
    W.body.place([-15, 0, -8.5], 0);
    let sink = null, cracks = null, rise = null, asleep = null;
    run(W, 120, {}, i => {
      if (R3.members[0].state === 'sink') sink ??= i;
      if (R4.members.every(f => f.state === 'cracks')) cracks ??= i;
      if (R4.members.every(f => f.state === 'rise')) rise ??= i;
      if (R3.members[0].state === 'asleep') asleep ??= i;
    });
    assert(sink !== null && sink === cracks, `the sink and the cracks start together (${sink}, ${cracks})`);
    assert.equal(asleep - sink, RULES.sink);
    assert(rise - cracks >= RULES.cracks && rise - cracks <= RULES.cracks + 1, `the rise ${rise - cracks} steps after the cracks`);
    assert.equal(R3.members[0].hp, R3.members[0].T.hp, 'it sinks with its health (the Rookchief, the elite, stands in R3)');
    pass("the guards of The Crow Wall: R3's Pitchrook sinks while R4's cracks show, then R4 rises", { sink, rise });
  }
  { /* every guard can wake: from points 2 m apart within 10 m of each guard zone's centre that can be reached, with the other zones
       within 16 m awake as they fit, the guard's cracks show within 1 s and its foes rise within 1.6 s */
    const out = {};
    for (const id of ['gaol', 'ramparts', 'fen', 'bells']) {
      const { meta, walk } = placeOf(id), g = meta.zones.find(z => z.guard), R = reachable(walk, meta.spawn, meta.bounds);
      let points = 0, worst = 0;
      for (let x = g.c[0] - 10; x <= g.c[0] + 10; x += 2) for (let z = g.c[2] - 10; z <= g.c[2] + 10; z += 2) {
        if (Math.hypot(x - g.c[0], z - g.c[2]) >= 10) continue;
        const y = walk.support(x, z, walk.top(x, z) + 0.01);
        if (y === null || !R.near([x, y + 0.5, z], 0.6)) continue;
        points++;
        const W = fightOn(walk, { x, z, zones: meta.zones, slots: POOLS[id], meta, hp: 1e9 });
        for (const q of meta.zones.filter(q => !q.guard && Math.hypot(q.c[0] - x, q.c[2] - z) <= 16).sort((a, b) => Math.hypot(a.c[0] - x, a.c[2] - z) - Math.hypot(b.c[0] - x, b.c[2] - z))) W.F.wake(q.id);
        const G = zoneOf(W, g.id);
        let cracks = null, rise = null;
        run(W, 100, {}, i => { if (G.members.some(f => f.state === 'cracks')) cracks ??= i; if (G.members.every(f => ['rise', 'idle', 'chase', 'move'].includes(f.state))) { rise ??= i; return false; } });
        assert(cracks !== null && cracks < 60 && rise !== null && rise < 96, `${id} ${g.id} from (${x}, ${z}): cracks ${cracks}, rise ${rise}`);
        worst = Math.max(worst, rise);
      }
      out[g.id] = { points, worst };
    }
    pass('every guard wakes from every point within 10 m: cracks within 1 s, the rise within 1.6 s', out);
  }
  { // the guard rule: the Gaol's beacon stays dark while the keep's Snuffers stand, the toast names the keep; out('G5') then light()
    const W = placeFight('gaol', 3, 25.5);
    const ev = [];
    W.R.light(ev);
    const dark = ev.find(e => e.type === 'dark');
    assert(dark && /in the keep/.test(dark.why), JSON.stringify(dark));
    assert.deepEqual(dark.at.map(v => +v.toFixed(2)), [2.3, 4.21, -23.8]);
    const bank = W.rs.bank, carried = W.rs.run.carried;
    W.F.putOut('G5');
    const lit = W.R.light([]);
    assert(lit.some(e => e.type === 'beacon'), 'the beacon lights');
    // gloam-downs-growth: a lit beacon no longer banks; the 9 glim of its keepers stay carried
    assert.equal(W.rs.run.carried - carried, 9, 'the 9 glim of its keepers are carried');
    assert.equal(W.rs.bank, bank, 'the beacon banks nothing');
    for (const z of Object.values(ZONES).flat().filter(z => z.keeper)) assert(!/\b(north|south|east|west)\b/i.test(keeperLine(z.keeper)), keeperLine(z.keeper));
    pass("the guard rule: the beacon stays dark while its keepers stand, and the toast names where; out('G5') and light() carry their 9 glim on", { why: dark.why });
  }
  { /* pushed off the terrace: a finisher knocks a Snuffer of the terrace guard (B4) off the terrace. On the committed walk map the
       terrace (y 4.5) falls in shelves of 3.9 and 3.6 to the ground at 2.3, so the Snuffer lands there, 2.2 m below and outside its
       leash: off its ground. Within 7 s it is back on its ground (inside its leash and less than 2 m under its centre: here it climbs
       onto the terrace's lower shelf), with the health it had after the hit. Where it cannot climb back, it sinks 4 s after it went off
       its ground and rises at home, 5.5 s in all (the made-up terrace above) */
    const W = placeFight('bells', 3, -14, { hp: 1e9 });
    W.F.wake('B4');
    run(W, 100);
    const S = zoneOf(W, 'B4').members.find(f => f.type === 'S'), c = S.zone.c, a = 120 * DEG, r = 5.5;
    const ground = W.walk.support(c[0] + Math.sin(a) * r, c[2] + Math.cos(a) * r, c[1]);
    assert(ground < c[1] - 2, `the ground below is at ${ground}`);
    S.hit(22, { from: [c[0], c[2]], push: 1.2, knock: 36, stagger: true, kind: 'fin' });
    S.body.place([c[0] + Math.sin(a) * r, ground, c[2] + Math.cos(a) * r], S.yaw);
    let home = null;
    run(W, 7 * 60, {}, i => { if (home === null && S.y > c[1] - RULES.below && Math.hypot(S.x - c[0], S.z - c[2]) <= S.zone.leash + 0.25 && ['idle', 'chase', 'move', 'home'].includes(S.state)) home = i; });
    assert(home !== null && home <= 420, `home at ${home}`);
    assert.equal(S.hp, 28);
    pass('a Snuffer of the terrace guard knocked off B4 is back on its ground within 7 s, with its health', { home: +(home / 60).toFixed(2), below: +(c[1] - ground).toFixed(2) });
  }
  { // markers on rolling ground: at 36 points across each leash, 90% of rim points within 0.15 m of the ground
    const cases = [['bells', 'B1 slam ring', [-0.5, -0.04, 12], 4.5, 3.0, 'ring'], ['bells', 'B1 lane', [-0.5, -0.04, 12], 4.5, 7, 'lane'],
      ['barrows', 'W2 slam ring', [1, 0.18, 3.5], 5.5, 3.0, 'ring'], ['barrows', 'W2 lane', [1, 0.18, 3.5], 5.5, 7, 'lane'],
      ['fen', 'F1 pulse ring', [4.5, -0.49, 7.6], 3, 2.2, 'ring'], ['fen', 'F2 pulse ring', [7, -0.49, -3.8], 3, 2.2, 'ring'],
      ['ramparts', 'R3 coal ring', [-14.3, 0.18, -4.8], 4.4, 1.4, 'ring'],
      ['barrows', 'arena cage ring', [18, 0.68, -22], 6.5, 3.4, 'ring'], ['barrows', 'arena shard ring', [18, 0.68, -22], 6.5, 1.3, 'ring'], ['barrows', 'arena lane', [18, 0.68, -22], 6.5, 9, 'lane9']];
    const shares = {}, walks = {};
    for (const [id, name, c, L, R, kind] of cases) {
      const walk = (walks[id] ||= placeOf(id).walk), all = [];
      for (let a = 0; a < 360; a += 30) for (const r of [0, L * 0.5, L]) {
        const x = c[0] + r * Math.sin(a * DEG), z = c[2] + r * Math.cos(a * DEG), y0 = walk.support(x, z, c[1] + 2.5) ?? walk.top(x, z);
        if (kind === 'ring') all.push(...ringResiduals(walk, x, z, R, y0, WATER[id]));
        else for (let b = 0; b < 360; b += 45) all.push(...laneResiduals(walk, x, z, b * DEG, R, 1.6, kind === 'lane9' ? 1.5 : 1.4, kind === 'lane9' ? 6 : 5, y0, WATER[id]));
      }
      const share = all.filter(v => v <= 0.15).length / all.length;
      shares[name] = +(share * 100).toFixed(1);
      assert(share >= 0.9, `${id} ${name}: ${(share * 100).toFixed(1)}% of rim points within 0.15 m`);
    }
    pass('markers on rolling ground: at least 90% of rim points within 0.15 m of the ground, on the baked walk maps', shares);
  }
}
console.log(`${n} checks passed`);
