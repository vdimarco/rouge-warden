// Gloam Downs: the Barrow Reeve, the boss of Barrow Crown, checked in node with no browser (public/lab/gloam-downs/boss.js, with
// run.js, moves.js, foes.js, fight.js, cameras.js and the baked boss files):
//   the choice of each attack from where the lamplighter stands (behind it, the slam; far in phase 2, the lunge; in front, the sweeps),
//     never the same three times in a row, the gaps and the walk speeds of the phases;
//   each attack's timing in whole steps at 30, 60, 120 and 144 Hz, its damage, and its ring, slices or lane: a hit only inside them,
//     and a step out of the warning once they stand still; the sweep's turn of 1.5 rad/s at most, held for its last 0.3 s;
//   the phases at 800 and 350 with a stumble of 2 s that takes no damage, the 50% more after the slam, set({ bossHp }) with one stop
//     and one stumble, leaving the arena and coming back;
//   the fall: its stop, its 30 glim into the glim carried, bossDown stored, the light that rises and rides at the lantern, the beacon
//     that lights only with it and banks the glim, the win stored at once, and a reload after the fall and on the win card;
//   on Barrow Crown's walk map, with the page's fight (fight.js) and the real boss files: the boss slot parked until the intro, the
//     other zones asleep and their slots parked in the fight, the candles lit, the markers laid, the light's slot after the fall and
//     after a reload with no boss file; and the boss camera with the real boss.
// Run: node qa/lab/gloam-downs-boss.test.mjs   (GLOAM_WORLDS=0 leaves out Barrow Crown's walk map and the boss files)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, makeCamera, camLayout, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { STEP, stepCount, startRun, makeRunner, maxOf, reload, goTo, BASE, ember } from '../../public/lab/gloam-downs/run.js';
import { HITS, clearLine } from '../../public/lab/gloam-downs/moves.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { makeBoss, bossLines, REEVE, REEVE_TEXT, ATTACKS, choose, phaseFor, segAt, segStart, inSlices, inLane, lengthOf, lightAt } from '../../public/lab/gloam-downs/boss.js';
import { inRing, FOE_HARD } from '../../public/lab/gloam-downs/foes.js';
// these checks test the rules at the numbers of the foes' table; Ember 0's harder factors (FOE_HARD, REEVE.hard) are checked in gloam-downs-foes.test.mjs
FOE_HARD.dmg = 1; FOE_HARD.hp = 1; REEVE.hard = 1;
import { makeFight } from '../../public/lab/gloam-downs/fight.js';
import { readFigures, makePool } from '../../public/lab/gloam-downs/pool.js';
import { poolFor } from '../../public/lab/gloam-downs/figures.js';
import { makeBossCam, makeCombat, BOSS, projector } from '../../public/lab/gloam-downs/cameras.js';
import { findOccluders, makeOccluders, OCCLUDE } from '../../public/lab/gloam-downs/veil.js';
import { fitRing } from '../../public/lab/gloam-downs/markers.js';
import { makeCamera as viewCamera } from '../../public/lab/gloam-downs/ink/webgl/view.mjs';
import { cardOnLoad, winOf } from '../../public/lab/gloam-downs/screens.js';
import { makeFeel, FEEL } from '../../public/lab/gloam-downs/feel.js';
import { POOLS } from '../../games/gloam-downs/lib/zones.mjs';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url)), W = DIR + 'worlds/';
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;
const DEG = Math.PI / 180, RATES = [30, 60, 120, 144];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const r2 = v => +v.toFixed(2);

/* ---------------- made-up ground ---------------- */
function layered(fn, half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz, cells = new Int16Array(2 * N);
  let k = 0;
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++, k++) { const v = fn(info.x0 + i * info.step, info.z0 + j * info.step); cells[k] = cells[N + k] = Math.round(v * 100); }
  return makeWalk(info, cells);
}
const FLAT = layered(() => 0);
const ARENA0 = { id: 'arena', c: [0, 0, 0], leash: 6.5, boss: true };

/* a boss on a walk map: a run in Barrow Crown with seed 7, the lamplighter at (x, z) facing yaw, the boss ready (its files in). hp sets
   the lamplighter's health; bossHp the boss's before the fight starts (its phase, with no stumble) */
function bossOn(walk = FLAT, { x = 0, z = 5, yaw = Math.PI, hp = 100, bossHp, arena = ARENA0, seed = 7, down = false, bounds = 20 } = {}) {
  const rs = RS.fresh();
  startRun(rs, seed);
  goTo(rs, 'barrows');
  rs.run.hp = hp;
  const body = makeBody(walk, { p: [x, walk.top(x, z) + 0.5, z], yaw }, bounds, { ...PARAMS });
  const B = makeBoss({ walk, arena, seed, bounds, down });
  B.ready = true;
  if (bossHp !== undefined) B.setHp(bossHp);
  const hurts = [];
  const R = makeRunner({ walk, meta: { wisps: [], beacon: { p: [90, 0, 90], r: 1 } }, body, rs, targets: () => (B.alive ? [B] : []), lightable: B.lightable, think: B.think });
  const hurt = R.hurt;
  R.hurt = (...a) => { const r = hurt(...a); hurts.push({ r, dmg: a[0], play: R.clock.play }); return r; };
  B.bind(R);
  return { rs, body, s: body.s, B, R, hurts, log: R.log };
}
// step n game steps; inp is a fixed input or a function of the step; each(i) runs after each step (false stops). -> every event
function run(Wd, count, inp = {}, each = null, cam = 0) {
  const all = [];
  for (let i = 0; i < count; i++) {
    for (const e of Wd.R.step(typeof inp === 'function' ? inp(i) : inp, cam)) all.push({ ...e, i });
    if (each && each(i) === false) break;
  }
  return all;
}
// the intro and its 2.4 s: the lamplighter is within 11 m, so the boss rises, and then the fight starts
function begin(Wd) {
  const ev = run(Wd, 1);
  assert(ev.some(e => e.type === 'boss' && e.what === 'intro'), 'the intro starts within 11 m');
  run(Wd, REEVE.intro, {}, () => !Wd.B.started);
  assert(Wd.B.started && Wd.B.alive, 'the fight has started');
}
// stand the boss at (bx, bz) facing byaw, and the lamplighter at (lx, lz); no gap, and the last attacks as given
function stand(Wd, { bx = 0, bz = 0, byaw = 0, lx, lz, last = [], gap = 0 }) {
  const { B } = Wd;
  B.body.place([bx, FLAT.top(bx, bz) + 0.3, bz], byaw);
  B.x = B.body.s.x; B.y = B.body.s.y; B.z = B.body.s.z; B.yaw = byaw;
  Wd.body.place([lx, Wd.body.s.y, lz], Wd.s.yaw);
  Wd.s.vx = Wd.s.vz = 0;
  Object.assign(B, { state: 'idle', move: null, mt: 0, mk: null, shards: [], gap, last: last.slice(), hold: null });
}
const cues = (Wd, name) => Wd.log.filter(c => c.cue === name).map(c => c.play);
const damage = Wd => Wd.hurts.filter(h => h.r === 'hit' || h.r === 'dead');
// a held lamplighter: it does not move while the boss attacks (its body stands; a hit still pushes it)
const still = () => ({});

/* ---------------- the numbers ---------------- */
{
  assert.equal(REEVE.hp, 1300);
  assert.deepEqual([phaseFor(1300), phaseFor(800), phaseFor(799), phaseFor(350), phaseFor(349), phaseFor(1)], [1, 1, 2, 2, 3, 3]);
  const steps = Object.fromEntries(Object.entries(ATTACKS).map(([k, A]) => [k, A.segs.map(g => `${g.kind} ${g.n}`)]));
  assert.deepEqual(steps.sweep, ['wind 48', 'act 12', 'rec 60']);
  assert.deepEqual(steps.slam, ['wind 60', 'act 9', 'rec 90']);
  assert.deepEqual(steps.shards, ['wind 54', 'act 12', 'rec 48']);
  assert.deepEqual(steps.lunge, ['wind 42', 'act 41', 'rec 60']);
  assert.deepEqual(steps.dsweep, ['wind 48', 'act 12', 'wind 36', 'act 12', 'rec 72']);
  // every boss wind-up is 0.60 s or more, and no boss hit takes more than 22
  for (const A of Object.values(ATTACKS)) for (const g of A.segs) if (g.kind === 'wind') assert(g.n >= 36, `a wind-up of ${g.n} steps`);
  assert(Math.max(...Object.values(ATTACKS).map(A => A.dmg)) <= 22);
  assert.deepEqual(REEVE.gap, [60, 45, 33]);
  assert.deepEqual([REEVE.intro, REEVE.stumble, BASE.boss], [144, 120, 30]);
  pass('the numbers: 1,300 health in phases to 800 and 350, the attacks in whole steps, wind-ups of 0.6 s or more, no hit over 22', steps);
}

/* ---------------- the choice ---------------- */
{ // from where the lamplighter stands: behind within 3.5 m the slam, in front within 4 m a sweep, from 3.5 to 9 m in phase 2 the shards,
  // over 6 m the lunge, and beyond 9 m only the lunge; none three times in a row
  const r = () => 0.1;
  assert.equal(choose(1, 2.5, Math.PI, [], r), 'slam');
  assert.equal(choose(1, 2.5, 0, [], r), 'sweep');
  assert.equal(choose(1, 3.9, 95 * DEG, [], r), 'sweep');
  assert.equal(choose(1, 6, 0, [], r), null, 'phase 1 has nothing at 6 m');
  assert.equal(choose(1, 2.5, Math.PI, ['slam', 'slam'], r), null, 'no third slam: it turns');
  assert.equal(choose(1, 2.5, 0, ['sweep', 'sweep'], r), 'slam', 'after two sweeps, the slam');
  assert.equal(choose(2, 5, 0, [], r), 'shards');
  assert.deepEqual([...new Set(Array.from({ length: 40 }, (_, k) => choose(2, 7.5, 0, [], () => k / 40)))].sort(), ['lunge', 'shards'], 'at 6 to 9 m both come');
  assert.equal(choose(2, 10, 0, [], r), 'lunge');
  assert.equal(choose(2, 10, 0, ['lunge', 'lunge'], r), null);
  assert.deepEqual([...new Set(Array.from({ length: 40 }, (_, k) => choose(3, 2, 0, [], () => k / 40)))].sort(), ['dsweep', 'sweep'], 'phase 3 adds the double sweep');
  assert.equal(choose(3, 2, 0, ['sweep', 'sweep'], r), 'dsweep');
  pass('the choice by position: behind, the slam; in front, a sweep; 3.5 to 9 m in phase 2, the shards; over 6 m, the lunge; none three times');
}
{ // Behind the boss: within 3.5 m, its last two attacks not slams: the cage slam, and a ring grows to 3.4 m at its feet over 1.0 s
  const Wd = bossOn(FLAT, { z: 5 });
  begin(Wd);
  stand(Wd, { byaw: 0, lx: 0, lz: -2.5, last: ['sweep', 'sweep'] });
  run(Wd, 1);
  assert.equal(Wd.B.move, 'slam');
  const R = [];
  run(Wd, 59, still, () => { R.push(Wd.B.mk.R); });
  assert(near(R[29], 1.7, 0.06) && near(R.at(-1), 3.4, 1e-9), `the ring at 0.5 s ${R[29]}, at 1.0 s ${R.at(-1)}`);
  assert.deepEqual([Wd.B.mk.x, Wd.B.mk.z].map(r2), [0, 0], 'the ring lies at its feet');
  pass('behind the boss: the cage slam, its ring growing to 3.4 m at its feet over 1.0 s', { at05: r2(R[29]), at10: R.at(-1) });
}
{ // Far from the boss: at the arena's edge in phase 2, the lamplighter 10 m away in the arena: the stalking lunge, its lane growing
  // toward the lamplighter over 0.7 s
  const Wd = bossOn(FLAT, { z: 4, bossHp: 700 });
  begin(Wd);
  stand(Wd, { bz: -6, byaw: 0.3, lx: 0, lz: 4 });
  run(Wd, 1);
  assert.equal(Wd.B.move, 'lunge');
  const L = [];
  run(Wd, 41, still, () => { L.push(Wd.B.mk.len); });
  const toward = Math.abs(wrap(Wd.B.mk.yaw - Math.atan2(0, 10)));
  assert(near(L.at(-1), 9, 1e-9) && near(L[20], 4.5, 0.25), `the lane at 0.35 s ${L[20]}, at 0.7 s ${L.at(-1)}`);
  assert(toward < 0.1, `the lane points ${(toward / DEG).toFixed(1)}° off the lamplighter`);
  pass('far from the boss in phase 2: the stalking lunge, its lane of 9 m growing toward the lamplighter over 0.7 s', { off: r2(toward / DEG) });
}
{ // never the same attack three times in a row, in a long fight with the lamplighter standing in front, and in phase 3 with both sweeps;
  // the gaps of the phases between one attack's end and the next one's start
  for (const [bossHp, phase] of [[1300, 1], [700, 2], [200, 3]]) {
    const Wd = bossOn(FLAT, { z: 2.6, hp: 1e7, bossHp });
    begin(Wd);
    const seq = [], gaps = [];
    let ended = -1;
    // the lamplighter stands at 2.6 m from the arena's centre, put back each step (each hit would push it out of the arena)
    run(Wd, 60 * 60, still, () => {
      const B = Wd.B;
      if (B.state === 'move' && B.mt === 0 && seq.length < 200) { seq.push(B.move); if (ended >= 0) gaps.push(Wd.R.clock.play - ended); }
      if (B.state === 'idle' && B.move === null && B.gap === REEVE.gap[phase - 1] - 1) ended = Wd.R.clock.play - 1;
      Wd.body.place([0, 0.01, 2.6], Math.PI);
    });
    for (let i = 2; i < seq.length; i++) assert(!(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]), `${seq[i]} three times in a row in phase ${phase}`);
    assert(seq.length >= 12, `${seq.length} attacks in 60 s`);
    const g = REEVE.gap[phase - 1];
    assert(gaps.length && gaps.every(x => x >= g), `the gaps ${gaps.slice(0, 6)} in phase ${phase}`);
    if (phase === 1) assert(seq.includes('slam') && seq.includes('sweep'));
    if (phase === 3) assert(seq.includes('dsweep'));
    pass(`phase ${phase}: never the same attack three times in a row, and a gap of ${g} steps or more between attacks`, { attacks: seq.length, kinds: [...new Set(seq)], gap: Math.min(...gaps) });
  }
}
{ // the walk: 1.8 m/s in phases 1 and 2, 2.4 in phase 3, toward a lamplighter it cannot reach, and never out of its leash
  const speeds = [];
  for (const bossHp of [1300, 200]) {
    const Wd = bossOn(FLAT, { z: 6.9, bossHp });
    begin(Wd);
    stand(Wd, { bz: -5, byaw: 0, lx: 0, lz: 6.9, last: ['lunge', 'lunge'], gap: 1e6 });
    let most = 0, out = 0;
    run(Wd, 120, still, () => { most = Math.max(most, Wd.B.walking); out = Math.max(out, Math.hypot(Wd.B.x, Wd.B.z)); Wd.s.vx = Wd.s.vz = 0; });
    speeds.push(r2(most));
    assert(out <= 6.5 + 0.05, `the boss walked ${out.toFixed(2)} m from the centre`);
  }
  assert(near(speeds[0], 1.8, 0.05) && near(speeds[1], 2.4, 0.05), `walk speeds ${speeds}`);
  pass('the walk: 1.8 m/s, and 2.4 m/s in phase 3, inside the leash of 6.5 m', { speeds });
}

/* ---------------- timings, damage, and the markers' hits ---------------- */
// one attack on a still lamplighter at each frame rate: frames of 1/rate s through stepCount, as the page steps. -> the play steps from
// the wind-up's cue to the hurt, and the damage
function attackAt(rate, setup) {
  const Wd = bossOn(FLAT, { z: 5, ...setup.o });
  begin(Wd);
  stand(Wd, setup.stand);
  let acc = 0, kind = null;
  for (let f = 0; f < rate * 4 && !damage(Wd).length; f++) {
    const c = stepCount(acc, 1 / rate);
    acc = c.acc;
    for (let i = 0; i < c.n; i++) { Wd.R.step({}, 0); Wd.s.vx = Wd.s.vz = 0; kind ??= Wd.B.move; }
  }
  const cue = cues(Wd, setup.cue)[0], hit = damage(Wd)[0];
  return { steps: hit ? hit.play - cue : null, dmg: hit?.dmg, kind };
}
{
  const CASES = {
    sweep: { cue: 'crook', stand: { byaw: 0, lx: 0, lz: 2.5 }, steps: 48, dmg: 18 },
    slam: { cue: 'cage', stand: { byaw: 0, lx: 0, lz: -2.5 }, steps: 60, dmg: 22 },
    shards: { cue: 'chime', o: { bossHp: 700 }, stand: { byaw: 0, lx: 0, lz: 5 }, steps: 54 + 36, dmg: 14 },
    lunge: { cue: 'crouch', o: { bossHp: 700 }, stand: { bz: -3, byaw: 0, lx: 0, lz: 4, last: ['shards', 'shards'] }, dmg: 20 },
    dsweep: { cue: 'crook', o: { bossHp: 200 }, stand: { byaw: 0, lx: 0, lz: 2.5, last: ['sweep', 'sweep'] }, steps: 48, dmg: 16 }
  };
  const got = {};
  for (const [name, c] of Object.entries(CASES)) {
    const r = RATES.map(rate => attackAt(rate, c));
    for (const x of r) assert.equal(x.kind, name, `${name}: it chose ${x.kind}`);
    assert(r.every(x => x.steps === r[0].steps && x.dmg === c.dmg), `${name} at ${RATES}: ${JSON.stringify(r)}`);
    if (c.steps) assert.equal(r[0].steps, c.steps, `${name} lands ${r[0].steps} play steps after its cue`);
    got[name] = { steps: r[0].steps, dmg: r[0].dmg };
  }
  // the lunge: 42 steps of wind-up, then 13 m/s until it reaches the lamplighter 7 m away (its centre within the two radii)
  assert(got.lunge.steps > 42 && got.lunge.steps < 42 + 41, `the lunge landed ${got.lunge.steps} steps after its cue`);
  pass('each attack lands on the same play step at 30, 60, 120 and 144 Hz, with its damage', got);
}
{ // the sweep's turn: at 1.5 rad/s at most in its wind-up, and none in its last 0.3 s; its slices stop with it; a lamplighter 1 m outside
  // the slices from then on takes nothing, and one inside takes 18
  const Wd = bossOn(FLAT, { z: 5 });
  begin(Wd);
  stand(Wd, { byaw: 0, lx: 0, lz: 2.5 });
  run(Wd, 1);
  assert.equal(Wd.B.move, 'sweep');
  let fastest = 0, late = 0, face = null;
  for (let i = 1; i < 48; i++) {
    const a = 2.4 * i / 60, y0 = Wd.B.yaw, f0 = Wd.B.mk.face;
    Wd.body.place([Math.sin(a) * 2.5, 0.01, Math.cos(a) * 2.5], 0);
    Wd.R.step({}, 0);
    const d = Math.abs(wrap(Wd.B.yaw - y0));
    if (Wd.B.mt < 30) fastest = Math.max(fastest, d * 60);
    else { late = Math.max(late, d, Math.abs(wrap(Wd.B.mk.face - f0))); face ??= Wd.B.yaw; }
  }
  assert(fastest <= 1.5 + 1e-9 && fastest > 1.4, `the turn ${fastest.toFixed(3)} rad/s`);
  assert.equal(late, 0, 'the facing and the slices hold for the last 0.3 s');
  // 1 m outside the slices: 5.0 m in front of the held facing, or 1 m behind the boss
  for (const [x, z, want] of [[Math.sin(face) * 5, Math.cos(face) * 5, 0], [-Math.sin(face) * 1, -Math.cos(face) * 1, 0], [Math.sin(face) * 3, Math.cos(face) * 3, 18]]) {
    const Q = bossOn(FLAT, { z: 5 });
    begin(Q);
    stand(Q, { byaw: face, lx: Math.sin(face) * 2.5, lz: Math.cos(face) * 2.5 });
    run(Q, 30, still);
    Q.body.place([x, 0.01, z], 0);
    run(Q, 40, () => ({}), () => { Q.s.vx = Q.s.vz = 0; });
    assert.equal(damage(Q).reduce((s, h) => s + h.dmg, 0), want, `at (${x.toFixed(2)}, ${z.toFixed(2)}): ${JSON.stringify(Q.hurts)}`);
  }
  pass('the sweep turns at 1.5 rad/s at most, holds its facing and its slices for the last 0.3 s, and hits only inside them', { rate: r2(fastest) });
}
{ // the double sweep: the second sweep grows its own three slices over its 0.6 s wind-up, turns, holds its last 0.3 s, and hits for 16
  const Wd = bossOn(FLAT, { z: 5, hp: 1000, bossHp: 200 });
  begin(Wd);
  stand(Wd, { byaw: 0, lx: 0, lz: 2.5, last: ['sweep', 'sweep'] });
  run(Wd, 1);
  assert.equal(Wd.B.move, 'dsweep');
  // by the boss's own move time (the first sweep's hit stops the game for 5 steps)
  const R = new Map();
  run(Wd, 300, still, () => { if (Wd.B.mt >= 60 && Wd.B.mt < 96) R.set(Wd.B.mt, Wd.B.mk?.R ?? 0); return Wd.B.mt < 95; });
  assert(near(R.get(60), 4.0 / 36, 1e-6) && near(R.get(95), 4.0, 1e-9), `the second slices ${R.get(60)} to ${R.get(95)}`);
  run(Wd, 14, still);
  // each sweep hits for 16: the second tests its later active steps, and lands once the 0.9 s of safe time after the first are over
  assert.deepEqual(damage(Wd).map(h => h.dmg), [16, 16]);
  const [h1, h2] = damage(Wd), safe = Wd.hurts.filter(h => h.r === 'safe').length;
  assert(h2.play - h1.play === 54 && safe >= 1, `the second sweep landed ${h2.play - h1.play} play steps after the first, ${safe} tries in the safe time`);
  pass('the double sweep: its second sweep grows its own slices over 0.6 s, and each sweep hits for 16', { apart: h2.play - h1.play });
}
{ // step out of the warning: once the shard rings stand still (0.6 s of 0.9 s), a walk of 1.5 m away from the boss leaves all three;
  // once the lunge's lane stands still (0.4 s of 0.7 s), a walk of 1.5 m to its side leaves it. Standing still, each hits
  const walkOut = (Wd, ux, uz) => { const x0 = Wd.s.x, z0 = Wd.s.z; Wd.body.place([x0 + ux * 1.5, 0.01, z0 + uz * 1.5], Wd.s.yaw); };
  const out = {};
  for (const step of [false, true]) {
    const A = bossOn(FLAT, { z: 5, bossHp: 700 });
    begin(A);
    stand(A, { byaw: 0, lx: 0, lz: 5 });
    run(A, 1);
    assert.equal(A.B.move, 'shards');
    run(A, 36, still);
    assert.deepEqual(A.B.mk.rings.map(p => [r2(p[0]), r2(p[2])]), [[0, 5], [2.5, 5], [-2.5, 5]], 'three rings: at the lamplighter and 2.5 m to each side');
    if (step) walkOut(A, 0, 1);
    run(A, 70, () => ({}), () => { A.s.vx = A.s.vz = 0; });
    out[`shards ${step ? 'out' : 'still'}`] = damage(A).reduce((s, h) => s + h.dmg, 0);
    const L = bossOn(FLAT, { z: 5, bossHp: 700 });
    begin(L);
    stand(L, { bz: -3, byaw: 0, lx: 0, lz: 4, last: ['shards', 'shards'] });
    run(L, 1);
    assert.equal(L.B.move, 'lunge');
    run(L, 24, still);
    if (step) walkOut(L, 1, 0);
    run(L, 100, () => ({}), () => { L.s.vx = L.s.vz = 0; });
    out[`lunge ${step ? 'out' : 'still'}`] = damage(L).reduce((s, h) => s + h.dmg, 0);
  }
  assert.deepEqual(out, { 'shards still': 14, 'lunge still': 20, 'shards out': 0, 'lunge out': 0 });
  // the tests themselves: the centre inside the ring, the slices or the lane
  const s = (x, z, y = 0) => ({ x, y, z });
  assert(inRing(s(1.29, 0), 0, 0, 0, 1.3, 1.6) && !inRing(s(1.31, 0), 0, 0, 0, 1.3, 1.6) && !inRing(s(0, 0, 1.7), 0, 0, 0, 1.3, 1.6));
  const m = { x: 0, y: 0, z: 0, face: 0, R: 4 };
  assert(inSlices(s(0, 3.99), m) && inSlices(s(3.9, 0.01), m) && !inSlices(s(0, 4.01), m) && !inSlices(s(1, -0.1), m));
  const lane = { x: 0, y: 0, z: 0, yaw: 0 };
  assert(inLane(s(0.79, 3), lane, 9) && !inLane(s(0.81, 3), lane, 9) && !inLane(s(0, 9.4), lane, 9) && !inLane(s(0, 5), lane, 2));
  pass('step out of the warning: 1.5 m from the boss leaves the shard rings, 1.5 m to the side leaves the lane; each hits only inside', out);
}
{ // the slam hits only inside its ring of 3.4 m, for 22 and a stop of 6 steps and a kick; then the boss is open for 1.5 s and takes 50%
  // more: a first cut of 10 deals 15
  const In = bossOn(FLAT, { z: 5 });
  begin(In);
  stand(In, { byaw: 0, lx: 0, lz: -3.3 });
  const ev = run(In, 62, still);
  assert.deepEqual(damage(In).map(h => h.dmg), [22]);
  assert(ev.some(e => e.type === 'stop' && e.n === 6) && ev.some(e => e.type === 'boss' && e.what === 'slam' && e.kick === 0.25));
  const Out = bossOn(FLAT, { z: 5 });
  begin(Out);
  stand(Out, { byaw: 0, lx: 0, lz: -3.5 });
  run(Out, 62, still);
  assert.equal(damage(Out).length, 0, 'outside the ring');
  // open after the slam: the lamplighter beside it with the first cut
  const O = bossOn(FLAT, { z: 5, hp: 1000 });
  begin(O);
  stand(O, { byaw: 0, lx: 0, lz: -2.2 });
  run(O, 61 + 30, still);
  assert.equal(O.B.seg().kind, 'rec');
  const hp0 = O.B.hp;
  O.body.place([0, 0.01, -1.9], 0); // the slam pushed it away: back beside the boss, facing its back
  run(O, 12, i => ({ attack: i === 0 }), () => { O.s.vx = O.s.vz = 0; });
  assert.equal(hp0 - O.B.hp, 15, `a cut of 10 dealt ${hp0 - O.B.hp} while it was open`);
  pass('the slam: 22 only inside its 3.4 m ring, a stop of 6 steps and a kick of 0.25; open for 1.5 s after, a cut of 10 deals 15');
}

/* ---------------- the phases, set({ bossHp }), and the arena ---------------- */
{ // Phase change: below 800 it stumbles for 2 s, with a stop of 9 steps, and hits do nothing in it; then the lamp-shards come
  const Wd = bossOn(FLAT, { z: 5, hp: 1000 });
  begin(Wd);
  Wd.B.setHp(805);
  stand(Wd, { byaw: Math.PI, lx: 0, lz: 1.7, gap: 1e6 });
  Wd.s.yaw = Math.PI;
  const ev = run(Wd, 8, i => ({ attack: i === 0 }), () => { Wd.s.vx = Wd.s.vz = 0; });
  assert.equal(Wd.B.hp, 795);
  assert(ev.some(e => e.type === 'stop' && e.n === 9) && ev.some(e => e.type === 'boss' && e.what === 'phase' && e.phase === 2));
  assert.equal(Wd.B.state, 'stumble');
  const t0 = Wd.R.clock.play;
  run(Wd, 40, i => ({ attack: i % 20 === 0 }), () => { Wd.s.vx = Wd.s.vz = 0; });
  assert.equal(Wd.B.hp, 795, 'no damage in the stumble');
  run(Wd, 200, still, () => Wd.B.state === 'stumble');
  const steps = Wd.R.clock.play - t0 + 1;
  assert(near(steps, 120, 2), `the stumble lasted ${steps} play steps`);
  // then, at 5 m, the lamp-shards come
  stand(Wd, { byaw: 0, lx: 0, lz: 5 });
  run(Wd, 1);
  assert.equal(Wd.B.move, 'shards');
  pass('a phase change: a stop of 9 steps and a stumble of 2 s with no damage, and then the lamp-shards come', { stumble: steps });
}
{ // set({ bossHp: 10 }) in phase 1: phase 3 at once, after one stop of 9 steps and one stumble of 120; within 129 steps a cut deals 10
  // and the boss falls; its light rises to the lantern
  const Wd = bossOn(FLAT, { z: 5 });
  begin(Wd);
  stand(Wd, { byaw: Math.PI, lx: 0, lz: 1.7, gap: 1e6 });
  Wd.s.yaw = Math.PI;
  Wd.B.setHp(10);
  const ev = run(Wd, Math.round(2.2 * 60), still, () => { Wd.s.vx = Wd.s.vz = 0; });
  assert.equal(Wd.B.phase, 3);
  assert.equal(ev.filter(e => e.type === 'boss' && e.what === 'phase').length, 1, 'one stumble');
  assert.equal(ev.filter(e => e.type === 'stop' && e.n === 9).length, 1, 'one stop of 9');
  assert.notEqual(Wd.B.state, 'stumble', 'the stumble is over within 129 steps');
  Wd.B.gap = 1e6;
  const carried = Wd.rs.run.carried, foes = Wd.rs.run.foes;
  const ev2 = run(Wd, 10, i => ({ attack: i === 0 }), () => { Wd.s.vx = Wd.s.vz = 0; });
  const hit = ev2.find(e => e.type === 'hit');
  assert.equal(hit?.dmg, 10);
  assert(ev2.some(e => e.type === 'boss' && e.what === 'fall') && ev2.some(e => e.type === 'stop' && e.n === 9) && ev2.some(e => e.type === 'store'));
  assert.deepEqual([Wd.rs.run.carried - carried, Wd.rs.run.foes - foes, Wd.rs.run.bossDown, Wd.B.up, Wd.B.alive], [30, 1, true, false, false]);
  // the fall's 36 steps, its parts, and the light: it rises 0.5 s, flies 0.5 s, and rides at the lantern
  const states = [];
  const ev3 = run(Wd, 9 + 36 + 30 + 30 + 2, still, () => { if (states.at(-1) !== Wd.B.light.state) states.push(Wd.B.light.state); });
  assert.deepEqual(states, ['cage', 'rise', 'fly', 'carried']);
  assert(ev3.some(e => e.type === 'boss' && e.what === 'light'));
  const p = lightAt(Wd.B.light, [Wd.s.x, Wd.s.y + 0.35, Wd.s.z]);
  assert(near(p[1], Wd.s.y + 0.35 + REEVE.light.over, 0.05) && near(p[0], Wd.s.x, 1e-9), 'the light rides just over the lantern');
  pass('set({ bossHp: 10 }): phase 3 after one stop and one stumble; a cut of 10 fells it; its 30 glim carried; the light rides at the lantern', { light: states });
}
{ // Leave and come back: at 900 health the lamplighter leaves the arena: the boss walks back to its centre, and is at 900 when it comes back
  const Wd = bossOn(FLAT, { z: 5 });
  begin(Wd);
  Wd.B.setHp(900);
  stand(Wd, { bx: 3, bz: 3, byaw: 0, lx: 3, lz: 7.5, gap: 1e6 });
  run(Wd, 240, still, () => { Wd.s.vx = Wd.s.vz = 0; });
  assert(Math.hypot(Wd.B.x, Wd.B.z) < 0.35, `the boss is ${Math.hypot(Wd.B.x, Wd.B.z).toFixed(2)} m from the centre`);
  assert.equal(Wd.B.hp, 900);
  Wd.body.place([0, 0.01, 3], 0);
  Wd.B.gap = 0;
  run(Wd, 2, still);
  assert.equal(Wd.B.state, 'move', 'it fights again');
  assert.equal(Wd.B.hp, 900);
  pass('leave the arena at 900 health: the boss walks back to its centre, and fights on at 900 when the lamplighter comes back');
}

/* ---------------- the fall, the light, the win, and the stored states ---------------- */
{ // before the fall the beacon stays dark, with the toast and a notch to the arena; after the fall, only once the light is at the lantern
  const Wd = bossOn(FLAT, { z: 5 });
  const dark = Wd.B.lightable();
  assert.deepEqual(dark, { ok: false, why: REEVE_TEXT.dark, at: [0, 0, 0], zone: 'arena' });
  assert(!/\b(north|south|east|west)\b/i.test(dark.why) && !/\bthe crown\b/i.test(dark.why), dark.why);
  begin(Wd);
  Wd.B.setHp(0);
  run(Wd, 9 + 36 + 1, still);
  assert.equal(Wd.B.lightable().ok, false, 'the light has not come to the lantern yet');
  run(Wd, 60, still);
  assert.equal(Wd.B.lightable().ok, true);
  pass('the beacon of Barrow Crown lights only with the light carried to it; before the fall the toast names the ground below the stones');
}
{ /* the far points each marker gives the boss camera (camView marks), on flat ground: the shard rings' centres and four points on each
     rim at 1.3 m, the lane's far end with a least pitch of 0.6, the sweeps' two side ends and front, and four points round the slam's ring */
  const W = bossOn(FLAT, { x: 0, z: 5, bossHp: 700 }), got = {};
  W.B.started = true;
  for (const name of ['shards', 'lunge', 'sweep', 'slam']) {
    W.B.holdAt(name, 0.5);
    const v = W.B.camView(), m = W.B.view().marker;
    got[name] = { marks: v.marks.length, look: v.look };
    if (name === 'shards') {
      assert.equal(v.marks.length, 15);
      m.rings.forEach((r, k) => {
        const [c, ...rims] = v.marks.slice(k * 5, k * 5 + 5);
        assert(Math.hypot(c[0] - r[0], c[2] - r[2]) < 1e-9 && Math.abs(c[1] - r[1] - 0.3) < 1e-9, 'a ring centre, 0.3 m up');
        for (const q of rims) assert(Math.abs(Math.hypot(q[0] - r[0], q[2] - r[2]) - ATTACKS.shards.ring) < 1e-9, 'a rim point at 1.3 m');
      });
    } else assert.equal(v.marks.length, { lunge: 1, sweep: 3, slam: 4 }[name]);
    assert.equal(v.look, name === 'lunge' ? 0.6 : 0);
    // the attack under way keeps the boss camera on outside the arena; the page's fade of the scenery reads the marker's ground points
    assert.equal(v.busy, true, `${name}: busy while under way`);
    assert.equal(W.B.markPoints().length, { shards: 27, lunge: 11, sweep: 27, slam: 16 }[name], `${name}: its ground points`);
    got[name].points = W.B.markPoints().length;
    W.B.holdAt(null);
  }
  W.B.state = 'idle'; W.B.move = null; W.B.mk = null; W.B.shards = [];
  assert.equal(W.B.camView().busy, false, 'idle with no marker: not busy');
  assert.equal(W.B.markPoints().length, 0);
  pass("each marker's far points for the boss camera: three ring centres and four rim points each, the lane's end with a pitch of 0.6, the sweeps' ends and front, the slam's four; busy while an attack is under way, and the ground points for the fade", got);
}
{ /* the run stored at the fall with bossDown; a reload after the fall: the boss stays down, the light rides from the start, and the glim
     carried is the entry value plus 30. Then the beacon banks it, the win is stored at once (wins + 1, the best time, run null), and a
     reload on the win card shows it again with the same figures */
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const Wd = bossOn(FLAT, { z: 5 });
  Wd.rs.bank = 100;
  Wd.rs.run.carried = 28;
  Wd.rs.run.entry.carried = 20;
  begin(Wd);
  Wd.B.setHp(0);
  for (const e of run(Wd, 2, still)) if (e.type === 'store') RS.store(storage, Wd.rs);
  const after = RS.load(storage);
  assert.equal(after.run.bossDown, true, 'stored at once with bossDown');
  assert.equal(after.run.carried, 58);
  reload(after.run);
  assert.deepEqual([after.run.carried, after.run.foes], [20 + 30, 1], 'a reload: the entry value plus the boss\'s 30');
  // the page's boss after the reload: down, with the light at the lantern at once
  const B2 = makeBoss({ walk: FLAT, arena: ARENA0, seed: 7, down: after.run.bossDown });
  assert.deepEqual([B2.state, B2.up, B2.light.state, B2.lightable().ok, B2.fighting()], ['down', false, 'carried', true, false]);
  // the win at the beacon: the bank goes up by the glim carried, and the win is stored at once
  const R2 = bossOn(FLAT, { z: 30, down: true });
  Object.assign(R2.rs, { bank: 100, runs: 2, deaths: 2 });
  R2.rs.run.carried = 58;
  R2.rs.run.time = 400;
  R2.R.meta.beacon = { p: [R2.s.x, R2.s.y, R2.s.z], r: 1.2 };
  R2.R.onBeacon = false;
  const ev = run(R2, 1);
  assert(ev.some(e => e.type === 'win') && ev.some(e => e.type === 'store'));
  // (the step that lights the beacon runs the clock once more first)
  assert.deepEqual([R2.rs.bank, R2.rs.wins, R2.rs.runs, R2.rs.run, R2.rs.ended.won, R2.rs.ended.banked, Math.round(R2.rs.bestWin)], [158, 1, 3, null, true, 58, 400]);
  RS.store(storage, R2.rs);
  const card = RS.load(storage);
  assert.equal(cardOnLoad(card), 'win');
  assert.deepEqual(winOf(card).rows, [['Time', '6:40'], ['Best winning time', '6:40'], ['Glim banked', '58 glim'], ['Runs', '3'], ['Deaths', '2']]);
  // a second reload on the card: the same figures, and wins went up by one only
  const again = RS.load(storage);
  assert.deepEqual([cardOnLoad(again), again.wins, winOf(again).rows], ['win', 1, winOf(card).rows]);
  pass('stored at the fall with bossDown; a reload keeps the boss down with the light carried and 30 glim; the win stored at once and shown again', { bank: R2.rs.bank });
}

{ // the feel of the boss: the intro's zoom of 1.15 goes through feel, so reduced motion keeps it at 1; the fall's pull toward fire slot 37
  // (up to 50% on slots 1 to 31 for 6 steps, slots 32 to 47 as they are), none with reduced motion; the bars are no motion and stay
  const pal = Array.from({ length: 48 }, (_, i) => (i * 0x050403) & 0xffffff), tick = (F, k) => { for (let i = 0; i < k; i++) F.tick(1); };
  const F = makeFeel({ pal }), Q = makeFeel({ pal, still: true });
  for (const f of [F, Q]) { f.intro(true); f.barsTo([FEEL.bars, 30]); }
  tick(F, 30); tick(Q, 30);
  assert.deepEqual([F.zoom(), Q.zoom(), F.bars(), Q.bars()], [1.15, 1, 0.12, 0.12]);
  F.fall(); Q.fall();
  tick(F, 1); tick(Q, 1);
  const g = F.grade(), slot = (c, k) => (c >> k) & 255;
  assert(g && g.slice(32).every((c, i) => c === pal[32 + i]), 'fire, wisp, cloak, iron and lamp keep their colours');
  assert(g.slice(1, 32).every((c, i) => slot(c, 16) >= slot(pal[1 + i], 16) - 1), 'slots 1 to 31 pull toward fire slot 37');
  assert.equal(Q.grade(), null, 'no pull with reduced motion');
  tick(F, 6);
  assert.equal(F.grade(), null, 'the pull lasts 6 steps');
  pass('the intro\'s zoom of 1.15 is 1 with reduced motion; the fall pulls slots 1 to 31 toward fire for 6 steps, and not with reduced motion');
}

/* ---------------- on Barrow Crown, with the page's fight and the real boss files ---------------- */
if (process.env.GLOAM_WORLDS !== '0') {
  const meta = JSON.parse(fs.readFileSync(`${W}barrows.json`, 'utf8'));
  const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${W}barrows.walk.bin.gz`)));
  const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
  const SplatCodec = new Function(fs.readFileSync(DIR + 'ink/splat-codec.js', 'utf8') + '\nreturn SplatCodec;')();
  const fileOf = which => {
    const json = readFigures(JSON.parse(zlib.gunzipSync(fs.readFileSync(`${W}${which}.json.gz`)).toString()));
    return { json, ...SplatCodec.decode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${W}${which}.bin.gz`))), { maxRows: 1_000_000 }) };
  };
  const foesFile = fileOf('foes'), bossFile = fileOf('boss');
  const arena = meta.zones.find(z => z.boss);
  // a page fight at Barrow Crown: a stand-in place of 4 splats with the lamplighter's bones, its pool of 'SSSIPMBCL', its zones
  function pageBoss({ x, z, yaw = 0, boss = bossFile, down = false, hp = 100 } = {}) {
    const m = { ...meta, bones: { names: meta.bones.names, pivots: meta.bones.pivots, first: 0, end: 4 } };
    const world = { data: new Float32Array(16 * 4), count: 4, pal: meta.pal, anim: { bones: new Float32Array(12 * 7), boned: new Int32Array(0) } };
    const pool = makePool(world, m, poolFor('barrows', foesFile, boss, POOLS.barrows), { extra: 256 });
    const rs = RS.fresh();
    startRun(rs, 7);
    goTo(rs, 'barrows');
    rs.run.hp = hp;
    rs.run.bossDown = down;
    const y = walk.support(x, z, 20) ?? walk.top(x, z);
    const body = makeBody(walk, { p: [x, y + 0.3, z], yaw }, meta.bounds, { ...PARAMS });
    const G = makeFight({ walk, meta: m, world, pool, rs, max: () => maxOf(rs) });
    const R = makeRunner({ walk, meta: m, body, rs, targets: G.targets, lightable: G.lightable, drop: G.foes.drop, think: G.think, onLight: G.foes.bank });
    G.bind(R);
    const evs = [];
    const step = (inp = {}, k = 1) => { for (let i = 0; i < k; i++) for (const e of R.step(inp, yaw + Math.PI)) { G.event(e); evs.push(e); } };
    return { G, R, rs, pool, world, body, s: body.s, step, evs, B: G.boss };
  }
  const slot = (P, code) => P.pool.slots.find(s => s.code === code);
  const awakeFoes = P => P.pool.slots.filter(s => 'SPMI'.includes(s.code) && s.awake).length;
  { /* Other zones at the intro: W4 (before the gate) awake, the lamplighter comes within 11 m of the arena: W4's foes sink over 0.6 s,
       their slots park, and only the boss is awake in the fight. The boss slot is parked until the intro, and the candles light */
    const P = pageBoss({ x: -0.5, z: -2.5 });
    assert(!slot(P, 'B').awake && !slot(P, 'C').awake && !slot(P, 'L').awake, 'every slot of the boss starts parked');
    P.step({}, 150); // every foe of the zones near the gate has risen
    const before = awakeFoes(P);
    assert(P.G.foes.zones.find(z => z.id === 'W4').awake && before >= 2, `W4 is awake, with ${before} foes in all`);
    // to 10.5 m from the arena's centre
    const a = Math.atan2(-0.5 - arena.c[0], -4.8 - arena.c[2]), tx = arena.c[0] + Math.sin(a) * 10.5, tz = arena.c[2] + Math.cos(a) * 10.5;
    P.body.place([tx, (walk.support(tx, tz, 9) ?? walk.top(tx, tz)) + 0.3, tz], a + Math.PI);
    P.step({}, 2);
    assert.equal(P.B.state, 'intro');
    assert(slot(P, 'B').awake && slot(P, 'C').awake, 'the boss slot wakes at the intro, and the candles light');
    const sinking = P.G.foes.foes.filter(f => f.state === 'sink').length;
    P.step({}, 37);
    assert(sinking === before && awakeFoes(P) === 0 && !P.G.foes.zones.find(z => z.id === 'W4').awake, `${sinking} of ${before} sank, ${awakeFoes(P)} awake`);
    // the boss slot rides the bones, the other foe slots do not
    const boned = new Set(P.world.anim.boned), B = slot(P, 'B');
    assert(boned.has(B.first) && !P.pool.slots.filter(s => 'SPMI'.includes(s.code)).some(s => boned.has(s.first)));
    // the bars ease in and the zoom goes to 1.15; the intro ends 144 steps after it began, and the bars ease out
    P.G.draw({ yaw: 0, pitch: 0.3, dist: 15, fov: 1.15 }, { art: 317 });
    assert(near(P.G.feel.bars(), 0.12, 1e-9) && near(P.G.feel.zoom(), 1.15, 1e-9));
    P.step({}, 144 - 39 + 1);
    assert(P.B.started && P.evs.some(e => e.type === 'boss' && e.what === 'start'));
    P.step({}, 31);
    assert.equal(P.G.feel.bars(), 0);
    assert.equal(P.G.feel.zoom(), 1);
    // no zone wakes in the boss fight, even back near W4
    P.body.place([-0.5, 1.9, -2.5], 0);
    P.step({}, 60);
    assert.equal(awakeFoes(P), 0, 'no zone wakes in the boss fight');
    pass('the intro on Barrow Crown: W4 sinks over 0.6 s and parks, the boss slot wakes and rides the bones, the candles light, the bars and the zoom', { sinking });
  }
  { // the markers on the real arena, posed by the page: the sweeps' front three slices (and the back three hidden), the slam's six, the
    // shards' three rings, and the lunge's six pieces; the targets hold the boss while it is up
    const c = arena.c, P = pageBoss({ x: c[0], z: c[2] + 4, yaw: Math.PI });
    P.step({}, 2);
    P.step({}, REEVE.intro);
    assert(P.G.targets().includes(P.B) && P.B.started, 'the boss is among the targets in the fight');
    const B = slot(P, 'B'), bone = name => B.bones.subarray(12 * B.type.index[name], 12 * B.type.index[name] + 12);
    const shown = name => bone(name)[10] > -100 && Math.abs(bone(name)[0]) + Math.abs(bone(name)[4]) > 1e-3;
    const pose = (move, t) => { P.G.hooks.hold('reeve', move, t); P.step({}, 1); P.G.draw({ yaw: 0, pitch: 0.3, dist: 15, fov: 1.15 }, { art: 317 }); };
    pose('sweep', 0.79);
    assert.deepEqual([1, 2, 3, 4, 5, 6].map(i => shown(`ring${i}`)), [true, true, true, false, false, false], 'the sweep: the front three slices');
    pose('slam', 0.99);
    assert([1, 2, 3, 4, 5, 6].every(i => shown(`ring${i}`)), 'the slam: six slices');
    P.G.hooks.hold('reeve', null);
    P.step({}, 200);
    P.B.setHp(700);
    P.step({}, 130);
    pose('shards', 0.89);
    assert([1, 2, 3].every(r => [1, 2, 3, 4, 5, 6].every(i => shown(`shardRing${r}_${i}`))) && !shown('ring1'), 'the shards: three rings');
    pose('lunge', 0.69);
    assert([1, 2, 3, 4, 5, 6].every(i => shown(`lane${i}`)) && !shown('shardRing1_1'), 'the lunge: six pieces');
    // the lane's pieces lie on the ground: 90% of their rim points within 0.15 m (the marker fit of foes-ai checks it across the arena)
    P.G.hooks.hold('reeve', null);
    pass('the boss\'s markers on the arena: the sweep\'s front three slices, the slam\'s six, three shard rings and the lunge\'s six pieces');
  }
  { /* the fall on the real arena: the boss slot parks after its parts, the light's slot wakes and rides at the lantern; after a reload
       (bossDown) the light's slot is awake at once and needs no boss file: the boss and candle slots stay reserved */
    const c = arena.c, P = pageBoss({ x: c[0], z: c[2] + 3, yaw: Math.PI });
    P.step({}, 2 + REEVE.intro + 31);
    P.B.setHp(0);
    // the bars come in over the 9 steps of hit stop, then ease out over 30 (gone 0.65 s after the fall)
    const bars = [];
    for (let i = 0; i < 9 + 36 + 36 + 2; i++) { P.step({}, 1); bars.push(P.G.feel.bars()); }
    assert(near(bars[9], 0.12, 1e-9) && bars[40] === 0 && bars.slice(40).every(b => b === 0), `the bars at the fall: ${bars.slice(0, 12).map(r2)}`);
    assert(!slot(P, 'B').awake && slot(P, 'L').awake && P.rs.run.bossDown, 'the boss parked, the light awake');
    P.step({}, 60);
    P.G.draw({ yaw: 0, pitch: 0.3, dist: 15, fov: 1.15 }, { art: 317 });
    const L = slot(P, 'L'), lb = L.bones, pv = L.type.bones[0].pivot, at = [lb[0] * pv[0] + lb[1] * pv[1] + lb[2] * pv[2] + lb[9], lb[3] * pv[0] + lb[4] * pv[1] + lb[5] * pv[2] + lb[10], lb[6] * pv[0] + lb[7] * pv[1] + lb[8] * pv[2] + lb[11]];
    assert(Math.hypot(at[0] - P.s.x, at[2] - P.s.z) < 0.8 && near(at[1], P.s.y + 0.35 + REEVE.light.over, 0.3), `the light at ${at.map(r2)}, the lamplighter at ${[P.s.x, P.s.y, P.s.z].map(r2)}`);
    // the last beacon: the bars come in again over 30 steps, and the light flies into the beacon's fire and is gone
    P.G.event({ type: 'win' });
    P.step({}, 31);
    assert(near(P.G.feel.bars(), 0.12, 1e-9) && P.B.light.state === 'gone' && !slot(P, 'L').awake, 'the bars at the last beacon, and the light into the fire');
    // the reload after the fall, with no boss file
    const Q = pageBoss({ x: c[0], z: c[2], boss: null, down: true });
    assert(!slot(Q, 'B').type && !slot(Q, 'C').type, 'no boss file: the boss and candle slots stay reserved');
    Q.step({}, 1);
    assert(slot(Q, 'L').awake && Q.B.state === 'down' && Q.G.lightable().ok, 'the light rides at once, and the beacon can light');
    Q.step({}, 600);
    assert.equal(awakeFoes(Q), 0, 'no zone wakes after the fall');
    assert.equal(Q.G.foes.quiet, true, 'the zones are hushed from the load');
    pass('the fall on the arena: the boss parks after its parts and the light rides at the lantern; after a reload it rides with no boss file', { light: at.map(r2) });
  }
  { /* the boss camera with the real boss on the arena (390x844): after the intro, at 9 m the combat camera has the boss, at 6 m the boss
       camera is on; at the fall it eases back over 1 s */
    const c = arena.c, P = pageBoss({ x: c[0] + 9.5, z: c[2], yaw: -Math.PI / 2 });
    const L = camLayout(390, 844), cam = makeCamera(walk, { yaw: -Math.PI / 2 + Math.PI, auto: true, ...L });
    cam.snap(P.s, -Math.PI / 2 + Math.PI);
    const screen = { w: 390, h: 844, bar: 52, rects: [[290, 664, 84, 84], [214, 750, 64, 64], [302, 756, 72, 72], [226, 682, 52, 52], [10, 60, 250, 88], [268, 60, 112, 44]] };
    const bc = makeBossCam(cam, { screen, boss: () => P.B.camView(), centre: P.B.c, ground: (x, z) => walk.support(x, z, P.s.y + 1) ?? walk.top(x, z) });
    const combat = makeCombat({ foes: () => P.G.bossFoe(P.s) });
    const turn = (q, s, dt, looked) => bc.turn(q, s, dt, looked) || combat.turn(q, s, dt, looked);
    const stepCam = () => bc.step(P.s, STEP, cam.follow(P.s, STEP, {}, turn));
    P.step({}, 2 + REEVE.intro);
    P.body.place([c[0] + 9, (walk.support(c[0] + 9, c[2], 9) ?? walk.top(c[0] + 9, c[2])) + 0.3, c[2]], -Math.PI / 2);
    P.B.gap = 1e6;
    for (let i = 0; i < 10; i++) { P.step({}, 1); stepCam(); }
    assert.equal(combat.foe?.id, 'reeve', 'at 9 m the combat camera has the boss');
    assert(!bc.b.on);
    P.body.place([c[0] + 6, (walk.support(c[0] + 6, c[2], 9) ?? walk.top(c[0] + 6, c[2])) + 0.3, c[2]], -Math.PI / 2);
    let v;
    for (let i = 0; i < 60; i++) { P.step({}, 1); v = stepCam(); }
    assert(bc.b.on && v.dist >= Math.max(12, L.dist) - 0.01, `at 6 m the boss camera is on, ${v.dist.toFixed(2)} m back`);
    P.B.setHp(0);
    for (let i = 0; i < 61; i++) { P.step({}, 1); v = stepCam(); }
    assert(!bc.b.on && bc.b.w === 0, 'at the fall it eases back over 1 s');
    assert.deepEqual(P.G.bossFoe({ x: c[0] + 9, z: c[2] }), [], 'after the fall the boss is no foe of the combat camera');
    pass('the boss camera with the real boss: the combat camera has it at 9 m, the boss camera at 6 m, and it eases back at the fall', { dist: r2(v.dist) });
  }
  { /* the boss camera over the whole arena, at 1280x720 and 390x844: the lamplighter on a grid of 1.5 m within 6.6 m of the centre,
       facing the boss 2.6 m and 5 m toward the centre. After 2.5 s the camera stands at its least distance and the boss's head and feet
       are on the screen at every point. A raise only to a pitch of 0.55 left it 1.85 to 5.65 m out, with the head off the top, at 20 of
       122 points: south of the arena the grave stones are 3.3 to 4.6 m tall 3 m behind the lamplighter. The three shard rings of a
       lamp-shards are on the screen, and in sight of the eye at all but a very few pairs (a mound beside the eye hid them). Each ring
       whole (8 points on its rim of 1.3 m) lies inside the middle 94% of the width, below the Lab bar row and under no control, and the
       ground hides at most 5% of the rim points (the boss gives the camera 4 rim points of each ring as marks, as boss.js camView) */
    const c = arena.c, g = (x, z, y = 3) => walk.support(x, z, y) ?? walk.top(x, z), out = {};
    const sees = (a, b) => clearLine(walk, a[0], a[1], a[2], b[0], b[1], b[2]);
    const LAY = {
      '1280x720': { w: 1280, h: 720, rects: [[10, 60, 262, 91], [1136, 60, 134, 44]] },
      '390x844': { w: 390, h: 844, rects: [[290, 664, 84, 84], [214, 750, 64, 64], [302, 756, 72, 72], [226, 682, 52, 52], [10, 60, 250, 88], [268, 60, 112, 44]] }
    };
    for (const [tag, S] of Object.entries(LAY)) {
      const L = camLayout(S.w, S.h), screen = { w: S.w, h: S.h, bar: 52, rects: S.rects }, least = Math.max(12, L.dist);
      let pairs = 0, top = 0, hidden = 0, rimHid = 0, rimAll = 0;
      for (let gx = -6; gx <= 6; gx += 1.5) for (let gz = -6; gz <= 6; gz += 1.5) {
        if (Math.hypot(gx, gz) > 6.6) continue;
        for (const bd of [2.6, 5]) {
          const lx = c[0] + gx, lz = c[2] + gz;
          let dx = c[0] - lx, dz = c[2] - lz, l = Math.hypot(dx, dz);
          if (l < 0.5) { dx = 0; dz = -1; l = 1; }
          const bx = lx + (dx / l) * bd, bz = lz + (dz / l) * bd;
          // the three shard rings of a lamp-shards at the lamplighter, as the marks the camera keeps in sight
          const rx = (lz - bz) / bd, rz = -(lx - bx) / bd, ring = k => [lx + rx * k, g(lx + rx * k, lz + rz * k) + 0.3, lz + rz * k];
          const rimOf = (r, a) => { const x = r[0] + Math.sin(a) * ATTACKS.shards.ring, z = r[2] + Math.cos(a) * ATTACKS.shards.ring; return [x, g(x, z, r[1]) + 0.3, z]; };
          const centres = [ring(0), ring(2.5), ring(-2.5)], rims = centres.flatMap(r => Array.from({ length: 8 }, (_, i) => rimOf(r, (i * Math.PI) / 4)));
          const s = { x: lx, y: g(lx, lz), z: lz }, B = { x: bx, y: g(bx, bz), z: bz, up: true, started: true, marks: centres.flatMap((r, k) => [r, ...rims.slice(k * 8, k * 8 + 8).filter((_, i) => i % 2 === 0)]) };
          const cam = makeCamera(walk, { yaw: Math.atan2(-(bx - lx), -(bz - lz)), auto: true, ...L });
          const bc = makeBossCam(cam, { screen, boss: () => B, centre: c, ground: (x, z) => g(x, z, s.y + 1), sees });
          let v;
          // 2.5 s to settle, then 1 s that must hold still: the frame is solved at the raised pitch, and the two must not rock
          let p0 = Infinity, p1 = -Infinity;
          for (let i = 0; i < 210; i++) { v = bc.step(s, STEP, cam.follow(s, STEP, {}, bc.turn)); if (i >= 150) { p0 = Math.min(p0, v.pitch); p1 = Math.max(p1, v.pitch); } }
          assert(p1 - p0 <= 0.01, `${tag}: at (${lx}, ${lz}) the pitch rocks by ${(p1 - p0).toFixed(3)}`);
          const pr = projector(v, S.w, S.h), on = p => !!p && p[0] >= 0 && p[0] <= S.w && p[1] >= 0 && p[1] <= S.h;
          assert(v.dist >= least - 0.01, `${tag}: at (${lx}, ${lz}) the boss camera is ${v.dist.toFixed(2)} m out`);
          const head = pr([bx, B.y + REEVE.height, bz]);
          assert(on(head) && head[1] >= screen.bar && on(pr([bx, B.y, bz])), `${tag}: at (${lx}, ${lz}) the boss is on the screen, its head below the Lab bar row`);
          const eye = [v.target[0] + Math.sin(v.yaw) * Math.cos(v.pitch) * v.dist, v.target[1] + Math.sin(v.pitch) * v.dist, v.target[2] + Math.cos(v.yaw) * Math.cos(v.pitch) * v.dist];
          hidden += centres.filter(m => !sees(eye, m)).length;
          assert(centres.every(m => on(pr(m))), `${tag}: at (${lx}, ${lz}) the shard rings are on the screen`);
          const inR = ([x, y], [rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
          for (const p of rims.map(m => pr([m[0], m[1] - 0.3, m[2]]))) assert(p && p[0] >= 0.03 * S.w && p[0] <= 0.97 * S.w && p[1] >= screen.bar && p[1] <= S.h && !S.rects.some(r => inR(p, r)), `${tag}: at (${lx}, ${lz}, ${bd}) a shard ring's rim at ${p} is at the edge or under a control`);
          rimHid += rims.filter(m => !sees(eye, m)).length; rimAll += rims.length;
          pairs++; top = Math.max(top, v.pitch);
        }
      }
      // a stone beside the eye may still hide a ring at a very few pairs (2 of 366 rings when measured; 24 to 32 with a raise to 0.55)
      assert(hidden <= 6, `${tag}: ${hidden} shard rings hidden behind the ground`);
      assert(rimHid <= 0.05 * rimAll, `${tag}: ${rimHid} of ${rimAll} rim points hidden behind the ground`);
      out[tag] = { pairs, least, pitch: r2(top), hidden, rims: `${rimHid}/${rimAll}` };
    }
    pass('the boss camera over the arena stands at its least distance with the boss and the shard rings on the screen and in sight, raised over the grave stones', out);
  }
  { /* the scenery in front of a marker (veil.js makeOccluders). The e2e's lamp-shards at 1280x720: the boss at (18, −20.65) facing
       south, the lamplighter 5.5 m in front of it, the boss camera at 12 m and a pitch of 1.063 (yaw 0). The west ring's near rim lies
       behind the yew at (17, −13.5): the walk map's sight test hides it at every pitch to 1.1, and sees it only from 1.4. Round the arena
       the pieces that may fade are things standing on the ground, none more than 4 m across; the yew's crown is one of them, and it fades
       out over 15 steps while the ring is laid and comes back over 15 when it is gone. The ground and the boss's own ranges never fade */
    const place = SplatCodec.decode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${W}barrows.bin.gz`))), { maxRows: 1_000_000 });
    const world = { data: place.data, count: place.count, radius: meta.radius, cam: meta.cam };
    const pack = c => ((c >> 16) & 255) + ((c >> 8) & 255) * 256 + (c & 255) * 65536;
    const list = findOccluders(world, walk, { skip: [...meta.beacon.fire, ...meta.wisps.map(w => w.ids)], shared: meta.pal.slice(32).map(pack), centre: arena.c, r: 20 });
    assert(list.length >= 1 && list.every(o => o.r <= OCCLUDE.WIDEST), 'pieces round the arena, none more than 4 m across');
    const yew = list.find(o => Math.hypot(o.c[0] - 17, o.c[2] + 13.5) < 0.5);
    assert(yew && yew.ids.length > 500, 'the yew at (17, −13.5) is a piece');
    const ground = (x, z, y) => walk.support(x, z, y + 2.5) ?? walk.top(x, z);
    const rings = [[18, -15.145], [20.5, -15.145], [15.5, -15.145]].map(([x, z]) => [x, ground(x, z, 0.9), z]), pts = [];
    for (const r of rings) { pts.push([r[0], r[1] + 0.1, r[2]]); for (let k = 0; k < 8; k++) { const x = r[0] + Math.sin(k * Math.PI / 4) * 1.3, z = r[2] + Math.cos(k * Math.PI / 4) * 1.3; pts.push([x, ground(x, z, r[1]) + 0.1, z]); } }
    const aim = [18, 2.016, -16.596], near = pts[2 * 9 + 1];
    const eyeAt = p => [aim[0], aim[1] + Math.sin(p) * 12, aim[2] + Math.cos(p) * 12];
    for (const p of [0.9, 1.0, 1.1]) assert(!clearLine(walk, ...eyeAt(p), ...near), `at a pitch of ${p} the yew hides the west ring's near rim`);
    assert(clearLine(walk, ...eyeAt(1.4), ...near), 'from 1.4 the eye sees it');
    const c = viewCamera(world, { camera: { target: aim, dist: 12, pitch: 1.063, yaw: 0, fov: 0.838 } }, 320, 180), focal = 180 / 2 / c.tangent;
    const occ = makeOccluders(world, list), a0 = world.data[yew.ids[0] * 16 + 3];
    let k = 0;
    while (yew.k > 0 && k < 40) { occ.step(c.view, focal, pts); k++; }
    assert.equal(k, OCCLUDE.FADE, `the yew's crown fades out over ${OCCLUDE.FADE} steps (${k})`);
    assert(yew.ids.every(i => world.data[i * 16 + 3] === 0), 'every splat of the crown at density 0');
    const others = occ.faded().filter(o => o !== yew && Math.hypot(o.c[0] - 17, o.c[2] + 13.5) >= 0.5);
    let back = 0;
    while (yew.k < OCCLUDE.FADE && back < 40) { occ.step(c.view, focal, []); back++; }
    assert.equal(back, OCCLUDE.FADE, 'and comes back over 15 steps with no marker');
    assert.equal(world.data[yew.ids[0] * 16 + 3], a0, 'at its baked density');
    pass('the scenery in front of a marker fades: the yew that hides the west shard ring from the south fades out over 0.25 s and back after', { pieces: list.length, crown: yew.ids.length, alsoFaded: others.length });
    // with the crown faded the ring under its edge shows: its slices lie on the ground (0.83 m), not on the crown's top that the walk
    // map keeps there (1.4 to 3.3 m), at every size it grows through
    // (two places of the west ring: this view's, and the e2e's after the slam, 1.37 m from the yew's trunk with two slices wholly under it)
    const worst = [];
    for (const west of [rings[2], [16.525, ground(16.525, -14.786, 1), -14.786]])
      for (const R of [0.6, 1.0, 1.2, 1.3]) for (const sl of fitRing(walk, west[0], west[2], R, west[1])) worst.push(Math.abs(sl.y - west[1]), Math.abs(sl.tilt[0]) * R, Math.abs(sl.tilt[1]) * R);
    assert(Math.max(...worst) <= 0.35, `the west ring lies on the ground beside the yew (worst ${Math.max(...worst).toFixed(2)} m)`);
    pass("the shard ring beside the yew lies on the ground under the crown's edge, not on its top", { worst: Math.round(Math.max(...worst) * 100) / 100 });
  }
}

{ // Ember 5: the Barrow Reeve has 25% more health, phase 2 starts at the same share as ever, and phase 3 starts at 40%
  assert.deepEqual(bossLines(), { max: 1300, lines: [800, 350] }, 'below Ember 5 the lines stand as they were');
  const E = ember(5), B = makeBoss({ walk: FLAT, arena: ARENA0, seed: 3, hpScale: E.bossHp, phase3: E.phase3 });
  assert.deepEqual([B.hp, B.max, B.lines], [1625, 1625, [1000, 650]]);
  const at = hp => { B.setHp(hp); return B.phase; };
  assert.deepEqual([at(1625), at(1001), at(999), at(651), at(649)], [1, 1, 2, 2, 3]);
  const E4 = ember(4), B4 = makeBoss({ walk: FLAT, arena: ARENA0, seed: 3, hpScale: E4.bossHp, phase3: E4.phase3 });
  assert.deepEqual([B4.max, B4.lines], [1300, [800, 350]], 'Ember 4 keeps the boss as it was');
  pass('at Ember 5 the Barrow Reeve has 1,625 health, phase 2 at 1,000 and phase 3 at 650 (40%); Ember 4 keeps 1,300', { lines: B.lines });
}

console.log(`\n${n} checks passed`);
