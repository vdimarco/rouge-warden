// Gloam Downs' combat run, checked in node with no browser (public/lab/gloam-downs/run.js, moves.js, run-save.js, input.js):
//   the step: the step count at 30, 60, 120 and 144 Hz, 600 steps from 1,440 frames of 1/144 s, and a press read by the frame that
//     starts at k/6 s counting on step 10k + 1, with the same string and roll on the same play steps at every rate;
//   the two clocks and hit stop with its cap; the base values;
//   the lamplighter's moves against a training post held still: the string's timings, damage and lunges, the hold, the next hit of
//     the string, the string that starts again, a hit tested on each active step until it hits once, each hit's reach and arc, soft
//     aim (its range, windows, turn and weight; to the side, not through a wall or a wall 0.2 m thin, under an arch, the kept target,
//     the stop short) and the clear line; the roll (distance, safe time, cooldown, Quick heels, the ledge guard that the roll itself
//     passes with the stick, walls, what it cancels); the plunge (straight down, its hang, fall, cap and recovery, its ring, Heavy
//     fall); a move that holds the jump; a press kept through hit stop; the flask, and a drink that ends with no flask; a hit on the
//     lamplighter (push, a safe time of 54 play steps, blink, and no blink after death); falls back to the last firm ground;
//   the run's rules: wicks and buys that raise the entry (Long wick after a reload), a reload, how the bonuses add, Close shave after a
//     near miss, every upgrade, Ash pocket rounding down, the seed's wick offers (never one wick twice), death and the win, a beacon
//     that fills the flasks, and when the run asks to be stored;
//   the run's save with bad data (an offer of one wick twice), an old explorer page and blocked site data; the pads (two pads: the
//     stick tilted furthest; the keys win over a drifting stick) and the cards' focus (a way held when a card opens moves nothing);
//   the run's screens (screens.js): the wick buttons, every upgrade row, the Lamp-room's buttons, the HUD, the summary with and without
//     Ash pocket, the pause panel's places and questions, game time, and a reload at each card; the pose of each move;
//   and on the five baked places (skipped with GLOAM_WORLDS=0): the roll on real ground, the sight test's cost, a run through the
//     Gaol's wisps and beacon, and each place's three files within 1.5 MB.
// Run: node qa/lab/gloam-downs-run.test.mjs   (GLOAM_WORLDS=0 to leave out the baked places)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, pose, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { ORDER, KEY as EXPLORER_KEY, fresh as explorerFresh, store as explorerStore } from '../../public/lab/gloam-downs/save.js';
import {
  STEP, MAX_STEPS, steps, stepCount, makeClock, advance, hitStop, drawOffer, stream, startRun, enter, reload, goTo, chooseWick, buy,
  lightBeacon, die, maxOf, flasksOf, maxHp, flasksMax, healOf, bladeBonus, makeRunner, WICKS, UPGRADES
} from '../../public/lab/gloam-downs/run.js';
import { HITS, MOVES, clearLine, sees, makePost, makeFighter, nearest, faceYaw, dealt, yawFor } from '../../public/lab/gloam-downs/moves.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { readPads, navStep, heldNav, pickMove, PAD, WALK_MIN } from '../../public/lab/gloam-downs/input.js';
import { wickLine, upgradeRow, lampButtons, LAMP_LABELS, hudOf, summaryOf, routeOf, ASKS, stepsOf, INK, inkAt, TIMED, cardOnLoad } from '../../public/lab/gloam-downs/screens.js';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url));
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;
const RATES = [30, 60, 120, 144];
const DEG = Math.PI / 180;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------------- made-up ground ----------------
   From a function of (x, z): a height, [top, floor under its gap], or [top, floor, the gap's underside] (as in gloam-downs.test.mjs) */
function layered(fn, half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz, vals = [];
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) {
    const v = fn(info.x0 + i * info.step, info.z0 + j * info.step);
    vals.push(Array.isArray(v) ? v : [v, v]);
  }
  const three = vals.some(v => v.length > 2), cells = new Int16Array((three ? 3 : 2) * N);
  vals.forEach(([t, g, u], k) => {
    cells[k] = Math.round(t * 100);
    cells[N + k] = Math.round((g ?? t) * 100);
    if (three) cells[2 * N + k] = u === undefined ? 0 : Math.round(u * 100);
  });
  return makeWalk(info, cells);
}
// flat ground at 0, a 3-high wall at x 4..5 (z -6..6), and a 6-deep drop for z <= -9 when x > 6
const FLAT = layered((x, z) => (x >= 4 && x <= 5 && z > -6 && z < 6 ? 3 : z <= -9 && x > 6 ? -6 : 0));
// a hole 60 deep at x 3..6, z -1.5..1.5, in flat ground
const HOLE = layered((x, z) => (x >= 3 && x <= 6 && Math.abs(z) <= 1.5 ? -60 : 0));
// an arch over x 2..6 (|z| <= 1.5): its top at 3 and its underside at 2.2 over the floor at 0
const ARCH = layered((x, z) => (x >= 2 && x <= 6 && Math.abs(z) <= 1.5 ? [3, 0, 2.2] : 0));
// a ledge 2 high at z >= 3 over flat ground
const LEDGE = layered((x, z) => (z >= 3 ? 2 : 0));

// a body with its own PARAMS (a fighter drives that copy) and a fighter on it. camYaw 0 puts the eye at +z: forward is -z
const bodyAt = (walk, x, z, yaw = 0) => makeBody(walk, { p: [x, walk.top(x, z) + 0.5, z], yaw }, 20, { ...PARAMS });
function fighterAt(walk, x, z, yaw = 0, stats = {}) {
  const body = bodyAt(walk, x, z, yaw);
  return { body, s: body.s, F: makeFighter(body, walk, { stats: () => stats }) };
}
// step a fighter; inp is a fixed input or a function of the step index -> the events of every step, with the step index
function play(F, count, inp = {}, targets = [], camYaw = 0) {
  const all = [];
  for (let i = 0; i < count; i++) {
    const ev = [];
    F.step(typeof inp === 'function' ? inp(i) : inp, camYaw, targets, ev);
    for (const e of ev) all.push({ ...e, i });
  }
  return all;
}
const hits = ev => ev.filter(e => e.type === 'hit');
const swings = ev => ev.filter(e => e.type === 'cue' && e.cue === 'swing');
// a fresh run save with a run started, and a runner on made-up ground with no wisps and the beacon far off
const META = { wisps: [], beacon: { p: [90, 0, 90], r: 1.2 } };
function runnerAt(walk, x, z, yaw = Math.PI, o = {}) {
  const rs = RS.fresh();
  startRun(rs, o.seed ?? 7);
  const body = bodyAt(walk, x, z, yaw), posts = o.posts || [];
  const R = makeRunner({ walk, meta: o.meta || META, body, rs, targets: () => posts.filter(p => p.alive), still: !!o.still, think: o.think });
  return { rs, body, s: body.s, R, posts };
}
function runFor(R, count, inp = {}, camYaw = 0) {
  const all = [];
  for (let i = 0; i < count; i++) for (const e of R.step(typeof inp === 'function' ? inp(i) : inp, camYaw)) all.push({ ...e, i });
  return all;
}

/* ---------------- the step ---------------- */
{
  let acc = 0, total = 0;
  for (let i = 0; i < 1440; i++) { const c = stepCount(acc, 1 / 144); acc = c.acc; total += c.n; }
  assert.equal(total, 600, `1,440 frames of 1/144 s gave ${total} steps`);
  // a plain floor loses a step there
  let a2 = 0, t2 = 0;
  for (let i = 0; i < 1440; i++) { a2 += 1 / 144; const k = Math.floor(a2 * 60); a2 -= k / 60; t2 += k; }
  // frame i has time i/f and adds 1/f to acc: after the frame that ends at k/6 s, the total is 10k
  for (const hz of RATES) {
    let ac = 0, tot = 0;
    for (let i = 1; i <= hz * 10; i++) {
      const c = stepCount(ac, 1 / hz); ac = c.acc; tot += c.n;
      if ((i * 6) % hz === 0) assert.equal(tot, (10 * i * 6) / hz, `${hz} Hz: after the frame that ends at ${i / hz} s, ${tot} steps`);
    }
  }
  assert.deepEqual(stepCount(0, 1), { n: MAX_STEPS, acc: 0 }, 'a long frame takes 15 steps and drops the rest');
  assert.equal(stepCount(0, 0.25).n, 15);
  assert.equal(steps(0.08), 5);
  assert.equal(HITS[0].act, 5, 'a cut is active 0.08 s: 5 steps');
  assert.equal(HITS[1].rec, 16, "the second cut's recovery of 0.26 s: 16 steps");
  assert.equal(MOVES.roll.steps, 22, 'the roll of 0.36 s: 22 steps');
  pass('the step count: 600 steps from 1,440 frames of 1/144 s, 10k steps after the frame at k/6 s at every rate, at most 15 a frame', { plainFloor: t2 });
}
{ /* the same presses at 30, 60, 120 and 144 Hz. Each press is a tap read by frame k·f/6 + 1, the first frame after k/6 s: it counts on
     step 10k + 1. The string lands on the same play steps, and the roll's safe time starts and ends on the same play steps */
  const PRESSES = { 1: 'attack', 3: 'attack', 6: 'attack', 12: 'roll', 18: 'attack' };
  const runs = RATES.map(hz => {
    const post = makePost(FLAT, 0, -2.5, { r: 0.4 });
    const { R, s } = runnerAt(FLAT, 0, 0, Math.PI, { posts: [post] });
    let acc = 0, latch = {};
    const safe = [];
    for (let i = 1; i <= hz * 4; i++) {
      const start = (i - 1) / hz, k = Math.round(start * 6);
      if (Math.abs(start * 6 - k) < 1e-9 && PRESSES[k]) latch[PRESSES[k]] = true;
      const c = stepCount(acc, 1 / hz); acc = c.acc;
      for (let j = 0; j < c.n; j++) {
        R.step({ ...latch }, 0);
        const sf = R.fighter.safe() === 'roll';
        if (sf !== (safe.length % 2 === 1)) safe.push(R.clock.play);
      }
      if (c.n) latch = {};
    }
    const at = name => R.log.filter(c => c.cue === name).map(c => c.step);
    return { hz, swing: at('swing'), roll: at('roll'), hit: R.log.filter(c => c.cue === 'hit').map(c => c.play), safe, x: +s.x.toFixed(4), z: +s.z.toFixed(4), taken: post.taken };
  });
  for (const r of runs) {
    assert.deepEqual(r.swing.slice(0, 1), [11], `${r.hz} Hz: the press read after 1/6 s counts on step 11`);
    assert.equal(r.roll[0], 121, `${r.hz} Hz: the roll read after 2 s counts on step 121`);
    assert.equal(r.safe.length, 2);
    for (const k of ['swing', 'roll', 'hit', 'safe', 'x', 'z', 'taken']) assert.deepEqual(r[k], runs[0][k], `${r.hz} Hz: ${k} ${JSON.stringify(r[k])} against ${JSON.stringify(runs[0][k])}`);
  }
  pass('the same string and roll land on the same steps at 30, 60, 120 and 144 Hz', { swing: runs[0].swing, hits: runs[0].hit, safe: runs[0].safe });
}

/* ---------------- the two clocks ---------------- */
{
  const c = makeClock();
  hitStop(c, 3);
  const plays = [];
  for (let i = 0; i < 5; i++) plays.push(advance(c));
  assert.deepEqual(plays, [false, false, false, true, true], 'hit stop holds the play clock for 3 steps');
  assert.deepEqual([c.step, c.play], [5, 2]);
  // the cap: no more than 9 stop steps in any 30
  const d = makeClock(), held = [];
  for (let i = 0; i < 90; i++) { if (i % 6 === 0) hitStop(d, 5); held.push(advance(d) ? 0 : 1); }
  for (let i = 0; i + 30 <= held.length; i++) assert(held.slice(i, i + 30).reduce((a, b) => a + b, 0) <= 9, `steps ${i}..${i + 29} held more than 9`);
  pass('two clocks: hit stop holds the play clock and the game clock goes on; no more than 9 stop steps in any 30');
}
{ /* a cut lands during a wind-up of 0.55 s (33 play steps) by a stand-in foe that counts the play clock: the hook still lands 33 play
     steps after its wind-up starts, 3 game steps later than with no hit stop */
  const post = makePost(FLAT, 0, -1.6);
  let start = null, landed = null;
  const think = (ev, played) => {
    const k = R.clock;
    if (start === null && k.play === 2) start = { play: k.play, step: k.step };
    if (start && landed === null && played && k.play - start.play === 33) landed = { play: k.play, step: k.step };
  };
  const { R } = runnerAt(FLAT, 0, 0, Math.PI, { posts: [post], think });
  runFor(R, 60, i => ({ attack: i === 3 }));
  assert(post.taken === 10, 'the cut landed');
  assert.equal(landed.play - start.play, 33);
  assert.equal(landed.step - start.step, 36, 'the 3 steps of hit stop are game steps only');
  pass('a cut in a wind-up: the hook lands 33 play steps after its wind-up starts, 36 game steps');
}

{ // a press that comes and goes only inside hit stop is kept, and swings on the next play step
  const { R } = runnerAt(FLAT, 0, 0);
  R.hurt(16, [0, 1], {}, []);
  runFor(R, 40);
  hitStop(R.clock, 4);
  const play0 = R.clock.play;
  const ev = runFor(R, 8, i => ({ attack: i === 1 }));
  const sw = ev.filter(e => e.type === 'cue' && e.cue === 'swing');
  assert.equal(sw.length, 1, 'the press in hit stop swings');
  assert.equal(R.log.filter(c => c.cue === 'swing').at(-1).play, play0 + 1, 'on the first play step after the stop');
  pass('a press inside hit stop waits for the next play step');
}

/* ---------------- base values ---------------- */
{
  const rs = RS.fresh();
  startRun(rs, 1);
  assert.deepEqual([rs.run.hp, maxOf(rs), rs.run.flasks, flasksOf(rs)], [100, 100, 2, 2]);
  assert.equal(healOf(rs.up, 100), 35);
  assert.equal(bladeBonus(rs.up, []), 0);
  assert.equal(dealt(HITS[0].dmg * (1 + bladeBonus(rs.up, []))), 10);
  assert.equal(MOVES.roll.cool, 15, 'the next roll 0.25 s after one ends');
  assert.equal(MOVES.plunge.r, 1.6);
  pass('a run with no upgrade and no wick: 100 health, 2 flasks, a cut of 10, a drink of 35, a roll cooldown of 0.25 s, a plunge of 1.6 m');
}

/* ---------------- the blade ---------------- */
{ // three presses at 0, 0.3 and 0.6 s, 2.1 m from the edge of a post held still
  const { s, F } = fighterAt(FLAT, 0, 0, Math.PI);
  const post = makePost(FLAT, 0, -2.5, { r: 0.4 });
  const z0 = s.z, at = [];
  const ev = play(F, 70, i => ({ attack: i === 0 || i === 18 || i === 36 }), [post]);
  for (const h of hits(ev)) at.push({ i: h.i, dmg: h.dmg, moved: +(z0 - s.z).toFixed(3) });
  const moved = [];
  let last = z0;
  // where the lamplighter stood at each hit
  const { s: s2, F: F2 } = fighterAt(FLAT, 0, 0, Math.PI);
  const post2 = makePost(FLAT, 0, -2.5, { r: 0.4 });
  for (let i = 0; i < 70; i++) {
    const e = [];
    F2.step({ attack: i === 0 || i === 18 || i === 36 }, 0, [post2], e);
    if (e.some(x => x.type === 'hit')) { moved.push(+(last - s2.z).toFixed(3)); last = s2.z; }
  }
  assert.deepEqual(hits(ev).map(h => h.dmg), [10, 11, 22], 'three hits land for 10, 11 and 22');
  [0.45, 0.45, 0.8].forEach((L, i) => assert(near(moved[i], L, 0.15), `lunge ${i + 1}: ${moved[i]}`));
  assert(near(s.z - (post.z + post.r), 0.4, 0.05), `the finisher lands 0.40 from the edge: ${s.z - (post.z + post.r)}`);
  pass('three presses: 10, 11 and 22 damage, lunges of 0.45, 0.45 and 0.8 m', { at, moved });
}
{ // hold Attack for 2 s: full strings follow, each hit 0.10 s into the recovery of the hit before
  const { F } = fighterAt(FLAT, 0, 0, Math.PI);
  const post = makePost(FLAT, 0, -1.2, { r: 0.4 });
  const ev = play(F, 120, { attack: true }, [post]);
  const sw = swings(ev);
  const order = sw.map(e => e.hit);
  assert.deepEqual(order.slice(0, 6), ['cut1', 'cut2', 'fin', 'cut1', 'cut2', 'fin'], `the string goes on: ${order}`);
  for (let k = 1; k < sw.length; k++) {
    const h = HITS.find(x => x.id === sw[k - 1].hit), want = sw[k - 1].i + h.wind + h.act + MOVES.chain;
    assert(Math.abs(sw[k].i - want) <= 1, `hit ${k + 1} starts at step ${sw[k].i}, want ${want}`);
  }
  // from the first press: the cuts land at 0.10 and 0.38 s, the finisher at 0.76 and the next cut at 1.06 (play time)
  assert.deepEqual(hits(ev).slice(0, 4).map(h => h.i), [6, 23, 46, 64], 'the hits land at 0.10, 0.38, 0.77 and 1.07 s of play');
  pass('holding Attack: full strings, each hit 0.10 s into the recovery before', { starts: sw.slice(0, 7).map(e => e.i), lands: hits(ev).slice(0, 4).map(h => h.i) });
}
{ // the next hit of the string (run().combo): 1, 2 and 0 while cut1, cut2 and the finisher play with Attack held, the next one while
  // the string holds after a recovery, and 0 once it has reset (0.35 s) or in the air
  const { F, s } = fighterAt(FLAT, 0, 0, Math.PI);
  const post = makePost(FLAT, 0, -1.2, { r: 0.4 });
  const seen = new Map();
  for (let i = 0; i < 60; i++) {
    F.step({ attack: true }, 0, [post], []);
    if (F.f.move === 'hit' && !seen.has(F.f.hit)) seen.set(F.f.hit, F.nextHit());
  }
  assert.deepEqual([...seen.entries()].sort(), [[0, 1], [1, 2], [2, 0]], `the next hit during cut1, cut2 and fin: ${JSON.stringify([...seen])}`);
  const b = fighterAt(FLAT, 0, 0, Math.PI);
  play(b.F, 1, { attack: true }, [post]);
  while (b.F.f.move) play(b.F, 1, {}, [post]);
  assert.equal(b.F.nextHit(), 1, 'after cut1 ends, the next is cut2');
  play(b.F, MOVES.reset, {}, [post]);
  assert.equal(b.F.nextHit(), 1, 'still cut2 at 0.35 s');
  play(b.F, 1, {}, [post]);
  assert.equal(b.F.nextHit(), 0, 'then the string resets');
  b.s.y = 2; b.s.ground = false; b.F.f.since = 0; b.F.f.next = 2;
  assert.equal(b.F.nextHit(), 0, 'in the air the first cut (or a plunge) comes next');
  assert(s.ground);
  pass('the next hit of the string: 1, 2 and 0 during the three hits, the next after a recovery until 0.35 s, then 0');
}
{ // the string starts again 0.35 s after the recovery of the last hit ends
  const two = delay => {
    const { F } = fighterAt(FLAT, 0, 0, Math.PI);
    const post = makePost(FLAT, 0, -1.2, { r: 0.4 });
    // cut1 at 0, cut2 at its chain point (17), whose recovery ends at 17 + 6 + 5 + 16 = 44
    const end = 17 + HITS[1].wind + HITS[1].act + HITS[1].rec;
    const ev = play(F, end + steps(delay) + 30, i => ({ attack: i === 0 || i === 17 || i === end + steps(delay) }), [post]);
    return swings(ev).map(e => e.hit);
  };
  assert.deepEqual(two(0.7), ['cut1', 'cut2', 'cut1'], 'a press 0.7 s after the recovery: the first cut');
  assert.deepEqual(two(0.2), ['cut1', 'cut2', 'fin'], 'a press 0.2 s after the recovery: the finisher');
  pass('the string starts again after 0.35 s');
}
{ // each attack tests its hit on each active step until it hits once: a post that comes into reach on the third active step
  const { F } = fighterAt(FLAT, 0, 0, Math.PI);
  const post = makePost(FLAT, 0, -3.0, { r: 0.4 });
  const ev = play(F, 30, i => {
    if (i === 8) post.z = -0.45 - 1.8 + 0.4 + 0.05 - 0.45; // in reach from the third active step (the lunge is done by then)
    return { attack: i === 0 };
  }, [post]);
  assert.equal(hits(ev).length, 1, 'it hits once');
  assert.equal(hits(ev)[0].i, 8, `on the step it came into reach: ${hits(ev)[0].i}`);
  const miss = play(fighterAt(FLAT, 0, 0, Math.PI).F, 30, i => ({ attack: i === 0 }), [makePost(FLAT, 0, -4, { r: 0.4 })]);
  assert.equal(hits(miss).length, 0, 'out of reach: no hit');
  pass('an attack tests each active step until it hits once');
}

{ /* the reach and the arc of each hit, with the lunge out of the way: the post stands out of reach and out of the aim while the hit
     winds up, and comes to its place on the first active step */
  const at = (i, d, deg) => {
    const { F, s } = fighterAt(FLAT, 0, 0, Math.PI);
    const post = makePost(FLAT, 0, -9, { r: 0.4 });
    let n = 0;
    const ev = play(F, 70, k => {
      if (F.f.move === 'hit' && F.f.hit === i && F.f.t === HITS[i].wind && n++ === 0) {
        const a = s.yaw + deg * DEG, c = d + post.r;
        post.x = s.x + Math.sin(a) * c; post.z = s.z + Math.cos(a) * c;
      }
      // cut1 at once; cut2 at its chain point; the finisher after both
      return { attack: k === 0 || (i >= 1 && k === 17) || (i === 2 && k === 34) };
    }, [post]);
    return hits(ev).some(h => h.target === post && h.kind === HITS[i].id);
  };
  assert(at(0, 1.75, 0) && !at(0, 1.85, 0), 'cut1 reaches 1.8 m');
  assert(at(2, 2.05, 0) && !at(2, 2.15, 0), 'the finisher reaches 2.1 m, past a cut and short of 2.5');
  assert(at(0, 1.2, 43) && !at(0, 1.2, 47), 'cut1 sweeps ±45°');
  assert(at(1, 1.2, 48) && !at(1, 1.2, 52), 'cut2 sweeps ±50°');
  assert(at(2, 1.2, 68) && !at(2, 1.2, 72), 'the finisher sweeps ±70°');
  pass('each hit\'s reach and arc: 1.8 m for the cuts and 2.1 m for the finisher; ±45°, ±50° and ±70°');
}
{ // soft aim's numbers: 4.5 m to the edge, ±70° of a held direction or ±100° of the facing, a turn of at most 75°, 2 per radian of turn
  const aimAt = (d, deg, dir = null) => {
    const { F, s } = fighterAt(FLAT, 0, 0, Math.PI);
    const a = Math.PI + deg * DEG, post = makePost(FLAT, Math.sin(a) * (d + 0.4), Math.cos(a) * (d + 0.4), { r: 0.4 });
    // camera yaw 0: mz 1 is -z, the facing; mx -1 turns the held direction to -x
    play(F, 1, { attack: true, ...(dir || {}) }, [post]);
    return { got: F.f.target === post, yaw: s.yaw };
  };
  assert(aimAt(4.4, 0).got && !aimAt(4.6, 0).got, 'a candidate is within 4.5 m of its edge');
  assert(aimAt(2, 98).got && !aimAt(2, 102).got, '±100° of the facing with no direction held');
  const held = { mz: 1 };
  assert(aimAt(2, 68, held).got && !aimAt(2, 72, held).got, '±70° of a held direction');
  const turned = aimAt(2, 95);
  assert(near(wrap(turned.yaw - Math.PI), 75 * DEG, 1e-6), `the lamplighter turns at most 75° toward it (${(wrap(turned.yaw - Math.PI) / DEG).toFixed(1)}°)`);
  const pick = (dA, degA) => {
    const { F } = fighterAt(FLAT, 0, 0, Math.PI);
    const a = Math.PI + degA * DEG, A = makePost(FLAT, Math.sin(a) * (dA + 0.4), Math.cos(a) * (dA + 0.4), { r: 0.4 });
    const B = makePost(FLAT, 0, -(3 + 0.4), { r: 0.4 });
    play(F, 1, { attack: true }, [A, B]);
    return F.f.target === A ? 'A' : F.f.target === B ? 'B' : null;
  };
  // A at 2.0 m and 30° scores 2 + 2 × 0.524 = 3.05 against B at 3.0 m straight ahead; at 25° it scores 2.87
  assert.equal(pick(2, 30), 'B', 'the score adds 2 per radian of turn: B is nearer the facing');
  assert.equal(pick(2, 25), 'A', 'and A wins when it is close enough to the facing');
  pass('soft aim: 4.5 m, ±70° held or ±100° free, a turn of 75°, 2 per radian of turn');
}
{ // a wall 0.2 m thin: the sight test steps 0.25 m, so a post behind it is neither aimed at nor hit, even when it comes into the
  // blade's reach after the aim (the blade tests the sight line itself)
  const THIN = layered((x, z) => (x >= 3 && x < 3.2 ? 3 : 0));
  const a = fighterAt(THIN, 1.2, 0, Math.PI / 2);
  const behind = makePost(THIN, 4.2, 0, { r: 0.4 });
  assert(!sees(THIN, a.s, behind), 'the thin wall hides the post');
  const ev = play(a.F, 30, i => ({ attack: i === 0 }), [behind]);
  assert(a.F.f.target !== behind && hits(ev).length === 0, 'not aimed at and not hit');
  const b = fighterAt(THIN, 1.6, 0, Math.PI / 2);
  const post = makePost(THIN, 1.6, -9, { r: 0.4 });
  const ev2 = play(b.F, 30, i => {
    if (b.F.f.move === 'hit' && b.F.f.t === HITS[0].wind) { post.x = 3.6; post.z = b.s.z; }
    return { attack: i === 0 };
  }, [post]);
  assert(Math.hypot(post.x - b.s.x, post.z - b.s.z) - post.r < HITS[0].reach, 'the post is in reach');
  assert.equal(hits(ev2).length, 0, 'the blade does not cut through the wall');
  pass('the sight test finds a wall 0.2 m thin: no aim and no hit through it');
}

/* ---------------- soft aim and the clear line ---------------- */
{ // a post 2 m to its edge at 60° right of the facing, no direction held: the lamplighter turns to it and the cut hits it
  const yaw = Math.PI, { s, F } = fighterAt(FLAT, 0, 0, yaw);
  // facing -z (yaw π); 60° to its right is toward -x
  const a = yaw - 60 * DEG, post = makePost(FLAT, Math.sin(a) * 2.4, Math.cos(a) * 2.4, { r: 0.4 });
  const ev = play(F, 30, i => ({ attack: i === 0 }), [post]);
  assert.equal(hits(ev).length, 1, 'the cut hits the post to the side');
  assert(Math.abs(wrap(Math.atan2(post.x - s.x, post.z - s.z) - s.yaw)) < 1 * DEG, 'it turned to the post');
  pass('soft aim: a foe 60° to the side is turned to and hit');
}
{ // one post behind the wall 2 m away, another in the open 3.5 m away: the hit turns to the one in the open
  // the wall stands at x 4..5 and ends at z 6: one post is behind it, the other past its end
  const { s, F } = fighterAt(FLAT, 2.6, 5.5, Math.PI / 2);
  const behind = makePost(FLAT, 5.3, 5.5, { r: 0.4 }), open = makePost(FLAT, 4.5, 8.4, { r: 0.4 });
  assert(!sees(FLAT, s, behind), 'the wall hides the first post');
  play(F, 2, i => ({ attack: i === 0 }), [behind, open]);
  assert.equal(F.f.target, open, 'the aim chose the post in the open');
  assert(Math.abs(wrap(Math.atan2(open.x - s.x, open.z - s.z) - s.yaw)) < 2 * DEG);
  pass('no aim through a wall');
}
{ // under an arch with 2.2 m of clearance: the line from the eye to the chest is clear, and the cut turns to the post
  const { s, F } = fighterAt(ARCH, -0.5, 0.8, Math.PI / 2);
  // the post stands on the floor under the arch, not on its roof (y 3): the line runs under the underside
  const post = makePost(ARCH, 2.5, 0, { r: 0.4, y: 0 });
  assert(post.y < 2.2, `the post stands on the floor under the arch (y ${post.y})`);
  assert(makePost(ARCH, 2.5, 0).y === 3, 'with no height given, makePost stands a post on the top');
  assert(Math.hypot(post.x - s.x, post.z - s.z) > 2.9, 'the post stands 3 m away');
  assert(clearLine(ARCH, s.x, s.y + 1.2, s.z, post.x, post.y + 0.9, post.z), 'the line under the arch is clear');
  assert(!clearLine(ARCH, -1, 2.6, 0, 3, 2.6, 0), 'a line through the arch between its underside and its top is not');
  assert(!clearLine(FLAT, 2, 1.2, 0, 7, 0.9, 0), 'nor one through a wall');
  assert(clearLine(FLAT, 0, 1.2, 0, 0, 0.9, 10), 'flat ground is clear');
  play(F, 2, i => ({ attack: i === 0 }), [post]);
  assert.equal(F.f.target, post);
  pass('a clear line under an arch, and none through a wall or a roof');
}
{ // keep the target: 2.0 m ahead, a second foe comes to 1.6 m at the same angle; at 1.1 m the next hit turns to it
  const { F, s } = fighterAt(FLAT, 0, 0, Math.PI);
  const t1 = makePost(FLAT, 0, -2.4, { r: 0.4 }), t2 = makePost(FLAT, 0.01, -9, { r: 0.4 });
  const press = i => ({ attack: i === 0 });
  play(F, 1, press, [t1, t2]);
  assert.equal(F.f.target, t1);
  play(F, 50, {}, [t1, t2]);
  s.x = 0; s.z = 0; s.yaw = Math.PI;
  t2.z = -2.0;
  play(F, 1, press, [t1, t2]);
  assert.equal(F.f.target, t1, 'the second is better by only 0.4: the target stays');
  play(F, 50, {}, [t1, t2]);
  s.x = 0; s.z = 0; s.yaw = Math.PI;
  t2.z = -1.5;
  play(F, 1, press, [t1, t2]);
  assert.equal(F.f.target, t2, 'better by 0.9: the next hit turns to it');
  pass('the aim keeps its target within 0.75 of the best');
}
{ // stop short: the first cut 0.5 m from the edge moves 0.25 m and stops 0.25 m from the edge
  const { F, s } = fighterAt(FLAT, 0, 0, Math.PI);
  const post = makePost(FLAT, 0, -0.9, { r: 0.4 });
  play(F, 20, i => ({ attack: i === 0 }), [post]);
  assert(near(-s.z, 0.25, 0.05), `moved ${-s.z}`);
  assert(near(s.z - (post.z + post.r), 0.25, 0.05), `stood ${s.z - (post.z + post.r)} from the edge`);
  pass('the lunge stops 0.25 m short of the target');
}

/* ---------------- the roll ---------------- */
{ // on flat ground with no direction held: 3.3 to 3.7 m straight back from the facing, then it stands
  for (const yaw of [0, Math.PI / 3, Math.PI, -2]) {
    const { F, s } = fighterAt(FLAT, -10, 10, yaw);
    play(F, 90, i => ({ roll: i === 0 }));
    const d = Math.hypot(s.x + 10, s.z - 10), back = ((s.x + 10) * -Math.sin(yaw) + (s.z - 10) * -Math.cos(yaw)) / d;
    assert(d >= 3.3 && d <= 3.7, `rolled ${d}`);
    assert(back > 0.999, 'straight back');
    assert(Math.hypot(s.vx, s.vz) < 1e-6, 'and stands');
    assert(near(s.yaw, yaw, 1e-9), 'a roll back keeps the facing');
  }
  // with a direction held it rolls that way (camera at yaw 0: mx 1 is +x)
  const { F, s } = fighterAt(FLAT, -10, 10, 0);
  play(F, 40, i => ({ roll: i === 0, mx: i < 2 ? 1 : 0 }));
  assert(s.x + 10 > 3.2 && Math.abs(s.z - 10) < 0.05, `rolled right to ${s.x}, ${s.z}`);
  pass('the roll: 3.3 to 3.7 m back from the facing, or in the held direction');
}
{ // safe from 0.02 to 0.30 s; a hit then passes, and a hit after it lands
  const out = [];
  // a hit tested after `at` play steps of the roll (0: no roll); the roll's first step ends at 0.017 s and its 18th at 0.30 s
  for (const at of [0, 1, 18, 19]) {
    const { R, rs } = runnerAt(FLAT, 0, 0);
    runFor(R, at, i => ({ roll: i === 0 }));
    out.push([at, R.hurt(16, [0, -2], {}, []), rs.run.hp]);
  }
  assert.deepEqual(out.map(o => o[1]), ['hit', 'safe', 'safe', 'hit'], JSON.stringify(out));
  // a roll through a post 2 m in front: it passes through and comes out behind
  const { F, s } = fighterAt(FLAT, 0, 0, Math.PI);
  play(F, 40, i => ({ roll: i === 0, mz: i < 2 ? 1 : 0 }), [makePost(FLAT, 0, -2)], 0);
  assert(s.z < -3, `came out behind: ${s.z}`);
  pass('the roll is safe from step 1 to step 18 (0.02 to 0.30 s) and passes through foes', { out });
}
{ // the next roll 0.25 s after one ends with Roll held; 0.12 s with Quick heels
  for (const [quick, want] of [[false, 15], [true, 7]]) {
    const { F } = fighterAt(FLAT, 0, 0, 0, { quick });
    const ev = play(F, 80, { roll: true });
    const r = ev.filter(e => e.cue === 'roll').map(e => e.i);
    assert(Math.abs(r[1] - (r[0] + MOVES.roll.steps) - want) <= 1, `${quick ? 'Quick heels' : 'plain'}: the second roll ${r[1] - r[0] - MOVES.roll.steps} steps after the first ends`);
  }
  pass('the roll cooldown: 0.25 s, and 0.12 s with Quick heels');
}
{ // the ledge guard: a 6 m drop 1 m away, no direction held: it stops at the edge; with the stick toward the drop it rolls off
  const guard = stickDown => {
    // facing +z (yaw 0) at z -8, so a roll back goes toward -z, where the drop is past z -9. The stick is held only during the roll's
    // 22 steps: the roll itself must go over the edge, not a walk after it
    const { F, s } = fighterAt(FLAT, 8, -8, 0);
    let left = null;
    for (let i = 0; i < 90; i++) {
      F.step({ roll: i === 0, mz: stickDown && i < MOVES.roll.steps ? -1 : 0 }, Math.PI, [], []);
      if (left === null && !s.ground) left = { i, move: F.f.move };
    }
    return { y: s.y, z: s.z, ground: s.ground, left };
  };
  const a = guard(false), b = guard(true);
  assert(a.ground && a.y === 0 && a.z > -9.05 && a.z < -8.5 && a.left === null, `it stopped at the edge: ${JSON.stringify(a)}`);
  assert(b.left && b.left.move === 'roll', `with the stick toward it, the roll itself left the ground: ${JSON.stringify(b.left)}`);
  assert(b.y < -5, `and it fell: ${JSON.stringify(b)}`);
  // into a wall 1.5 m away it stops at the wall; at 30° it slides along it
  const { F, s } = fighterAt(FLAT, 2.2, 0, 0);
  play(F, 40, i => ({ roll: i === 0, mx: i < 2 ? 1 : 0 }));
  assert(s.x < 4 - 0.29 && s.x > 3.5, `stopped at the wall: ${s.x}`);
  const w = fighterAt(FLAT, 3.4, -3, 0);
  play(w.F, 40, i => ({ roll: i === 0, ...(i < 2 ? { mx: Math.sin(Math.PI / 6), mz: -Math.cos(Math.PI / 6) } : {}) }));
  assert(w.s.x < 3.71 && w.s.z - -3 > 2, `slid along the wall: ${w.s.x}, ${w.s.z}`);
  pass('the roll stops at a drop of more than 3 m unless the stick pushes over, and stops at and slides along walls', { a, b });
}
{ // a roll cancels a wind-up (the hit is lost) or a recovery, never active time
  const at = when => {
    const { F } = fighterAt(FLAT, 0, 0, Math.PI);
    const post = makePost(FLAT, 0, -1.2);
    const ev = play(F, 40, i => ({ attack: i === 0, roll: i === when }), [post]);
    return { rolled: ev.find(e => e.cue === 'roll')?.i ?? null, hit: hits(ev).length };
  };
  assert.deepEqual(at(3), { rolled: 3, hit: 0 }, 'in the wind-up: the roll, and the hit is lost');
  const act = at(7);
  assert(act.hit === 1 && act.rolled > 7, `in active time: no roll until it ends (${JSON.stringify(act)})`);
  assert.deepEqual(at(14), { rolled: 14, hit: 1 }, 'in the recovery: the roll');
  pass('a roll cancels a wind-up or a recovery, not active time');
}

/* ---------------- the plunge ---------------- */
{ // jump off a ledge 2 m above a post and press Attack over it: it falls straight down, deals 19 or more and knocks it down
  const { F, s } = fighterAt(LEDGE, 0, 3.4, Math.PI);
  const post = makePost(LEDGE, 0, 1.6, { r: 0.4 });
  let pressedAt = null, x0 = 0, z0 = 0;
  const ev = play(F, 120, i => {
    if (pressedAt === null && !s.ground && s.y - s.floor >= 0.8 && s.z < 2.0) { pressedAt = i; x0 = s.x; z0 = s.z; return { attack: true }; }
    return pressedAt === null ? { mz: 1, jump: i < 2 } : {};
  }, [post]);
  const h = hits(ev).find(e => e.kind === 'plunge');
  assert(h && h.dmg >= 19, `the plunge dealt ${h?.dmg}`);
  assert(post.hits[0].stagger && post.hits[0].knock > 0, 'it knocks down a light foe and stops its wind-up');
  assert(near(s.x, x0, 1e-6) && near(s.z, z0, 1e-6), 'straight down');
  assert(ev.some(e => e.type === 'ring' && e.r === 1.6), 'a ring of sparks on the ground');
  pass('the plunge falls straight down and hits for 19 or more', { dmg: h.dmg });
}
{ // Heavy fall: a plunge lands with a post's edge 1.9 m from the landing point, and hits it; with no Heavy fall it misses
  const drop = heavy => {
    const { F, s } = fighterAt(FLAT, 0, 0, 0, { heavy });
    s.y = 3; s.ground = false; s.floor = 0;
    const post = makePost(FLAT, 2.3, 0, { r: 0.4 });
    const ev = play(F, 40, i => ({ attack: i === 0 }), [post]);
    return hits(ev).length;
  };
  assert.equal(drop(true), 1);
  assert.equal(drop(false), 0);
  // lower than 0.8 m: the first cut, with no lunge
  const { F, s } = fighterAt(FLAT, 0, 0, Math.PI);
  s.y = 0.5; s.ground = false; s.floor = 0;
  const ev = play(F, 2, i => ({ attack: i === 0 }));
  assert.deepEqual(swings(ev).map(e => e.hit), ['cut1']);
  assert.equal(F.f.lungeV, 0);
  pass('Heavy fall reaches 2.0 m; under 0.8 m Attack does the first cut with no lunge');
}

{ // the plunge's numbers: it hangs 5 steps, falls 16 m/s (16/60 m a step), deals at most 28, and recovers 0.30 s after it lands
  const { F, s } = fighterAt(FLAT, 0, 0, 0);
  s.y = 2; s.ground = false; s.floor = 0; s.vy = 0;
  const ys = [], moves = [];
  for (let i = 0; i < 40; i++) { F.step({ attack: i === 0 }, 0, [], []); ys.push(s.y); moves.push(F.f.move); }
  // the press starts the hang and is its first step: 5 steps at 2 m, the last of which turns it into the plunge
  assert.equal(ys.findIndex(y => y < 2 - 1e-9), 5, `it hangs 5 steps: ${ys.slice(0, 7).map(y => y.toFixed(3))}`);
  assert.deepEqual([moves[0], moves[3], moves[4]], ['hang', 'hang', 'plunge']);
  assert(near(ys[5] - ys[6], 16 / 60, 1e-6) && near(ys[6] - ys[7], 16 / 60, 1e-6), `then 16/60 m a step: ${ys[5] - ys[6]}`);
  const landed = moves.indexOf('land');
  assert.equal(moves.slice(landed).filter(m => m === 'land').length, MOVES.plunge.rec, 'the landing recovers 18 steps');
  const deep = fighterAt(FLAT, 0, 0, 0);
  deep.s.y = 6; deep.s.ground = false; deep.s.floor = 0;
  const post = makePost(FLAT, 0.5, 0, { r: 0.4 });
  play(deep.F, 60, i => ({ attack: i === 0 }), [post]);
  assert.equal(post.taken, 28, `a plunge of 6 m deals the cap of 28 (${post.taken})`);
  pass('the plunge hangs 5 steps, falls at 16 m/s, deals at most 28 and recovers 0.30 s');
}
{ // a move holds the jump: a jump held through a roll does not fire when the roll ends
  const { F, s } = fighterAt(FLAT, 0, 0, 0);
  let jumped = false;
  for (let i = 0; i < 50; i++) { F.step({ roll: i === 0, jump: i >= 5 }, 0, [], []); if (!s.ground) jumped = true; }
  assert(!jumped, 'the jump held through the roll does not fire after it');
  pass('a move holds the jump');
}

/* ---------------- the flask ---------------- */
{
  const { R, rs } = runnerAt(FLAT, 0, 0);
  rs.run.hp = 40;
  const ev = runFor(R, 48, i => ({ heal: i === 0 }));
  assert.deepEqual([rs.run.hp, rs.run.flasks], [75, 1], 'after 0.8 s: 75 health and 1 flask');
  assert(ev.some(e => e.type === 'store'), 'a drink stores the run at once');
  // a hit 0.5 s into a drink stops it: the damage is taken and the flask kept
  const b = runnerAt(FLAT, 0, 0);
  b.rs.run.hp = 40;
  runFor(b.R, 30, i => ({ heal: i === 0 }));
  assert.equal(b.R.hurt(16, [0, -2], {}, []), 'hit');
  runFor(b.R, 60);
  assert.deepEqual([b.rs.run.hp, b.rs.run.flasks], [24, 2]);
  // a roll stops a drink too, and keeps the flask
  const r = runnerAt(FLAT, 0, 0);
  r.rs.run.hp = 40;
  runFor(r.R, 60, i => ({ heal: i === 0, roll: i === 20 }));
  assert.deepEqual([r.rs.run.hp, r.rs.run.flasks], [40, 2]);
  // full health keeps the flask and says so; no flask says that a lit beacon fills them
  const c = runnerAt(FLAT, 0, 0);
  const full = runFor(c.R, 60, i => ({ heal: i === 0 }));
  assert(full.some(e => e.type === 'toast' && e.what === 'full') && c.rs.run.flasks === 2);
  c.rs.run.flasks = 0; c.rs.run.hp = 50;
  const none = runFor(c.R, 60, i => ({ heal: i === 0 }));
  assert(none.some(e => e.type === 'toast' && e.what === 'empty') && c.rs.run.hp === 50);
  // the drink walks slowly: 1.5 m/s at most
  const d = runnerAt(FLAT, 0, 0);
  d.rs.run.hp = 40;
  runFor(d.R, 48, i => ({ heal: i === 0, mz: 1 }));
  assert(Math.hypot(d.s.x, d.s.z) <= 1.5 * 0.8 + 0.02, `walked ${Math.hypot(d.s.x, d.s.z)} while drinking`);
  pass('the flask: 0.8 s heals 35, a hit stops it and keeps the flask, full health and no flask keep it');
}
{ // a drink that ends after the flasks went to 0 (a test hook during the drink) heals nothing and takes nothing
  const { R, rs } = runnerAt(FLAT, 0, 0);
  rs.run.hp = 40;
  runFor(R, 20, i => ({ heal: i === 0 }));
  assert.equal(R.fighter.f.move, 'drink');
  rs.run.flasks = 0;
  const ev = runFor(R, 40);
  assert.deepEqual([rs.run.flasks, rs.run.hp], [0, 40], `no flask below 0 and no heal: ${rs.run.flasks}, ${rs.run.hp}`);
  assert(!ev.some(e => e.type === 'store'), 'nothing to store');
  pass('a drink that ends with no flask left takes none and heals nothing');
}
{ // the fifth wisp of a place fills one flask, and each wisp gives 4 glim
  const meta = { wisps: [0, 1, 2, 3, 4].map(i => ({ p: [i * 3 - 6, 0.8, 5], ids: [0, 0] })), beacon: { p: [90, 0, 90], r: 1.2 } };
  const { R, rs, body } = runnerAt(FLAT, 0, 0, 0, { meta });
  rs.run.flasks = 1;
  for (let i = 0; i < 5; i++) { body.place([i * 3 - 6, 0, 5], 0); runFor(R, 2); }
  assert.deepEqual([R.wisps.size, rs.run.carried, rs.run.flasks], [5, 20, 2]);
  pass('five wisps: 20 glim, and the fifth fills a flask');
}

/* ---------------- a hit on the lamplighter, and falls ---------------- */
{ // a hook of 16 on 100 health: 84, a push of 1.2 m, a blink; a second hook within 0.9 s does nothing
  const { R, rs, s } = runnerAt(FLAT, 0, 0);
  const ev = [];
  assert.equal(R.hurt(16, [0, -1], {}, ev), 'hit');
  assert(ev.some(e => e.type === 'store'), 'a hit stores the run at once');
  assert.equal(rs.run.hp, 84);
  assert.equal(R.clock.stop, 5, 'a hurt holds the game for 5 steps');
  const blink = [], at = [];
  for (let i = 0; i < 40; i++) { R.step({ mx: 1, attack: true }, 0); blink.push(s.hide ? 1 : 0); at.push([s.x, s.z]); }
  // 5 steps of hit stop, then 15 of the push with no control: the stick and Attack do nothing until step 20
  assert(near(at[19][1], 1.2, 0.15) && near(at[19][0], 0, 1e-6), `pushed back 1.2 m with no control: ${at[19]}`);
  assert(at[39][0] > 0.1, 'and then the stick moves it again');
  // the blink on the game clock: hidden on steps 0..3 after the hit, shown on 4..7 (step 1 of the loop is game step 1)
  assert.deepEqual(blink.slice(0, 12), [1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0]);
  assert.equal(R.hurt(16, [0, -1], {}, []), 'safe', 'within 0.9 s');
  runFor(R, 60);
  assert.equal(R.hurt(16, [0, -1], {}, []), 'hit', 'after it');
  // the safe time is 54 play steps: a hit 53 play steps after the last one passes, one 55 steps after lands
  const p0 = R.clock.play;
  while (R.clock.play - p0 < 53) R.step({}, 0);
  assert.equal(R.hurt(16, [0, -1], {}, []), 'safe', '53 play steps after a hit: still safe');
  while (R.clock.play - p0 < 55) R.step({}, 0);
  assert.equal(R.hurt(16, [0, -1], {}, []), 'hit', '55 play steps after: the hit lands');
  // the Ironback's charge pushes 3 m
  const b = runnerAt(FLAT, -10, 10);
  b.R.hurt(24, [-10, 9], { push: 3 }, []);
  runFor(b.R, 30);
  assert(near(b.s.z - 10, 3, 0.2), `a charge pushed ${b.s.z - 10}`);
  // reduced motion: the blink changes every 8 steps
  const c = runnerAt(FLAT, 0, 0, 0, { still: true });
  c.R.hurt(16, [0, -1], {}, []);
  const bl = [];
  for (let i = 0; i < 20; i++) { c.R.step({}, 0); bl.push(c.s.hide ? 1 : 0); }
  assert.deepEqual(bl.slice(0, 17), [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
  pass('a hit: its damage, a push of 1.2 m (3 m from a charge), 0.25 s without control, 0.9 s safe, the blink every 4 steps (8 with reduced motion)');
}
{ // after a lethal hit the blink stops: the figure shows through the whole death fade (72 steps) and after it
  const { R, rs, s } = runnerAt(FLAT, 0, 0);
  rs.run.hp = 10;
  runFor(R, 5);
  assert.equal(R.hurt(16, [0, -1], {}, []), 'dead');
  const hidden = [];
  for (let i = 0; i < 80; i++) { R.step({}, 0); hidden.push(s.hide ? 1 : 0); }
  assert.equal(hidden.reduce((a, b) => a + b, 0), 0, `the figure shows after death: ${hidden.join('')}`);
  pass('the hurt blink stops at death');
}
{ // a fall below y -25: back on the ground it left, at least 1 m from the edge, with 10 health less
  const { R, rs, s } = runnerAt(HOLE, 0, 0);
  rs.run.hp = 50;
  let fell = null;
  for (let i = 0; i < 400 && !fell; i++) for (const e of R.step({ mx: 1 }, 0)) if (e.type === 'fall') fell = { x: s.x, z: s.z, y: s.y };
  assert(fell, 'it fell');
  assert.equal(rs.run.hp, 40);
  assert(fell.y === 0 && fell.x <= 3 - 1 + 1e-6, `back on firm ground: ${JSON.stringify(fell)}`);
  // then safe for 0.9 s, as after a hit
  assert.equal(R.hurt(16, [s.x + 1, s.z], {}, []), 'safe', 'a hit just after the fall does nothing');
  assert.equal(rs.run.hp, 40);
  // never below 1
  rs.run.hp = 5;
  for (let i = 0; i < 400; i++) R.step({ mx: 1 }, 0);
  assert.equal(rs.run.hp, 1);
  pass('a fall below y -25: back on the last firm ground, 1 m from the edge, 10 health lost, never below 1, then safe', fell);
}
{ // feet put below y -25 (a test's teleport, or a body placed there) are never taken as firm ground, at any step of the firm check
  for (let lead = 0; lead < 4; lead++) {
    const { R, rs, body, s } = runnerAt(FLAT, 0, 0);
    runFor(R, 8 + lead);
    body.place([0, -30, 0], s.yaw);
    const ev = runFor(R, 12);
    assert.equal(ev.filter(e => e.type === 'fall').length, 1, `one fall (lead ${lead})`);
    assert(s.y > -1 && rs.run.hp === 90, `back on the ground with 90: y ${s.y}, ${rs.run.hp}`);
  }
  pass('feet below y -25 are never firm ground: one fall, back on the ground');
}

/* ---------------- the run's rules ---------------- */
{ // Long wick: 60 of 100 becomes 80 of 120. Mantle at a beacon: 60 of 100 becomes 75 of 115, and a reload keeps it
  const rs = RS.fresh();
  startRun(rs, 3);
  rs.run.hp = 60;
  lightBeacon(rs);
  rs.run.offer = ['long', 'keen'];
  assert(chooseWick(rs, 'long'));
  assert.deepEqual([rs.run.hp, maxOf(rs)], [80, 120]);
  assert(!chooseWick(rs, 'keen'), 'one wick a beacon');
  const lw = RS.clean(JSON.parse(JSON.stringify(rs)));
  reload(lw.run);
  assert.deepEqual([lw.run.hp, maxOf(lw)], [80, 120], 'Long wick after a reload: 80 of 120');
  const b = RS.fresh();
  b.bank = 50;
  startRun(b, 3);
  b.run.hp = 60;
  lightBeacon(b);
  assert(buy(b, 'mantle'));
  assert.deepEqual([b.run.hp, maxOf(b), b.bank], [75, 115, 10 + 0]);
  const again = RS.clean(JSON.parse(JSON.stringify(b)));
  reload(again.run);
  assert.deepEqual([again.run.hp, maxOf(again), again.run.place], [75, 115, 'ramparts'], 'after Walk on and a reload');
  // Spare oil: 3 of 3 flasks after Walk on and a reload, and Spare oil stays chosen
  const c = RS.fresh();
  startRun(c, 3);
  lightBeacon(c);
  c.run.offer = ['oil', 'keen'];
  chooseWick(c, 'oil');
  const c2 = RS.clean(JSON.parse(JSON.stringify(c)));
  reload(c2.run);
  assert.deepEqual([c2.run.flasks, flasksOf(c2), c2.run.wicks], [3, 3, ['oil']]);
  // a Flask bought in a run adds a full flask
  const d = RS.fresh();
  d.bank = 60;
  startRun(d, 3);
  buy(d, 'flask');
  assert.deepEqual([d.run.flasks, flasksOf(d), d.run.entry.flasks], [3, 3, 3]);
  pass('a wick or a buy raises the run and its entry: Long wick 80/120, Mantle 75/115 and Spare oil 3/3 after a reload');
}
{ // a reload: enter the Fen with 80 health and 12 glim, drop to 50 and gain 10, reload: 50 health and 12 glim
  const rs = RS.fresh();
  startRun(rs, 3);
  Object.assign(rs.run, { hp: 80, carried: 12, foes: 4 });
  goTo(rs, 'fen');
  Object.assign(rs.run, { hp: 50, carried: 22, foes: 7, flasks: 1 });
  const back = RS.clean(JSON.parse(JSON.stringify(rs)));
  reload(back.run);
  assert.deepEqual([back.run.place, back.run.hp, back.run.carried, back.run.foes, back.run.flasks], ['fen', 50, 12, 4, 1]);
  // and one that took a drink after the last store cannot heal: the lower of the two
  Object.assign(back.run, { hp: 90 });
  reload(back.run);
  assert.equal(back.run.hp, 80);
  pass('a reload restarts the place with the lower health and flasks, and the entry glim and foes');
}
{ // the bonuses add; a foe's factor and Heavy fall multiply; damage rounds once
  const up = { mantle: 0, flask: 0, edge: 3, draught: 0, ash: 0 }, bonus = bladeBonus(up, ['keen']);
  assert(near(bonus, 0.51, 1e-9));
  assert.deepEqual([dealt(10 * (1 + bonus)), dealt(22 * (1 + bonus))], [15, 33]);
  // a plunge of 2 m with Edge 3, Keen edge and Heavy fall on a stunned Ironback (factor 1.5): 19 × 1.51 × 1.5 × 1.5 = 64.55, so 65
  const { F, s } = fighterAt(FLAT, 0, 0, 0, { bonus, heavy: true });
  s.y = 2; s.ground = false; s.floor = 0;
  const post = makePost(FLAT, 0.5, 0, { r: 0.7, factor: 1.5 });
  play(F, 40, i => ({ attack: i === 0 }), [post]);
  assert.equal(post.taken, 65);
  // Keen edge: every blade hit deals 15% more
  assert.equal(dealt(10 * (1 + bladeBonus({ edge: 0 }, ['keen']))), 12);
  // Edge bought at a beacon works at once
  const rs = RS.fresh();
  rs.bank = 50;
  startRun(rs, 2);
  buy(rs, 'edge');
  assert(near(bladeBonus(rs.up, rs.run.wicks), 0.12, 1e-9));
  pass('bonuses add: 15 and 33 with Edge 3 and Keen edge; every factor on a plunge gives 65');
}
{ // Close shave: a hook that meets the roll's safe time is a near miss, and a cut that lands 0.5 s later deals 15 (10 × 1.5). With no
  // Close shave it deals 10. The bonuses of Edge 3, Keen edge and Close shave add: 10 × (1 + 0.36 + 0.15 + 0.5) = 20.1, so 20
  const cutAfterNearMiss = (wicks, up = {}) => {
    const { R, rs, s, posts } = runnerAt(FLAT, 0, 0);
    rs.run.wicks = wicks;
    Object.assign(rs.up, up);
    const ev = [];
    let missAt = -1;
    for (let i = 0; i < 90; i++) {
      // the roll starts on step 0; the hook meets it on step 5, in its safe time; the cut is pressed so that it lands 30 steps later
      if (i === 5) { assert.equal(R.hurt(16, [s.x + Math.sin(s.yaw), s.z + Math.cos(s.yaw)], {}, ev), 'safe'); missAt = i; }
      if (i === 28) posts.push(makePost(FLAT, s.x + Math.sin(s.yaw) * 1.5, s.z + Math.cos(s.yaw) * 1.5));
      for (const e of R.step({ roll: i === 0, attack: i === 29 }, 0)) ev.push({ ...e, i });
    }
    const hit = ev.find(e => e.type === 'hit');
    return { dmg: posts[0].hits[0]?.dmg, after: hit ? hit.i - missAt : null, miss: ev.some(e => e.type === 'miss'), hp: rs.run.hp };
  };
  const shave = cutAfterNearMiss(['shave']), plain = cutAfterNearMiss([]), all = cutAfterNearMiss(['shave', 'keen'], { edge: 3 });
  assert(shave.miss && shave.hp === 100, 'the hook passes in the safe time');
  assert(Math.abs(shave.after - 30) <= 1, `the cut lands ${shave.after} steps after the near miss`);
  assert.deepEqual([shave.dmg, plain.dmg, all.dmg], [15, 10, 20]);
  pass('Close shave: a cut 0.5 s after a near miss deals 15 (10 without it), and Edge 3, Keen edge and Close shave add to 20', { shave, plain, all });
}
{ // every upgrade: 145 health, 4 flasks, each flask heals 55% (80 of 145), the blade +36%, a death keeps 30% of the glim
  const rs = RS.fresh();
  rs.bank = UPGRADES.reduce((a, u) => a + u.costs.reduce((x, y) => x + y, 0), 0);
  assert.equal(rs.bank, 1065, 'all of them cost 1,065 glim');
  for (const u of UPGRADES) for (let k = 0; k < u.costs.length; k++) assert(buy(rs, u.id));
  assert(!buy(rs, 'mantle'), 'no level past the top');
  assert.equal(rs.bank, 0);
  startRun(rs, 9);
  assert.deepEqual([rs.run.hp, rs.run.flasks, healOf(rs.up, maxOf(rs))], [145, 4, 80]);
  assert(near(bladeBonus(rs.up, []), 0.36, 1e-9));
  rs.run.carried = 25;
  const e = die(rs);
  assert.deepEqual([e.lost, e.banked, rs.bank, rs.deaths, rs.runs, rs.run], [18, 7, 7, 1, 1, null], 'Ash pocket banks 7 of 25 (30% rounded down) and 18 are lost');
  pass('every upgrade: 145 health, 4 flasks, 55% heals, +36% blade, Ash pocket keeps 30% rounded down');
}
{ // the wick offers: the seed and the wicks chosen decide them; a wick chosen never comes back
  const runTo = (seed, picks) => {
    const offers = [];
    const rs = RS.fresh();
    startRun(rs, seed);
    for (let k = 0; k < 4; k++) {
      lightBeacon(rs);
      offers.push(rs.run.offer.slice());
      chooseWick(rs, picks(rs.run.offer, k));
    }
    return { offers, wicks: rs.run.wicks };
  };
  const a = runTo(7, o => o[0]), b = runTo(7, o => o[0]);
  assert.deepEqual(a.offers, b.offers, 'the same seed, the same choices: the same offers');
  for (let k = 0; k < 4; k++) for (const w of a.offers[k]) assert(!a.wicks.slice(0, k).includes(w), `offer ${k} holds a wick already chosen`);
  assert.equal(new Set(a.wicks).size, 4);
  // the Gaol's offer depends on the seed alone, and the draw does not use the foes' stream
  const foes = stream(7, 'foes');
  for (let i = 0; i < 50; i++) foes();
  assert.deepEqual(drawOffer(7, 0, []), a.offers[0]);
  // the third beacon (The Bell Knoll's card) offers two of the four not yet chosen; the fourth two of the three left
  assert(a.offers[3].every(w => !a.wicks.slice(0, 3).includes(w)));
  for (let sd = 1; sd <= 500; sd++) for (let k = 0; k < 4; k++) { const o = drawOffer(sd, k, []); assert(o.length === 2 && o[0] !== o[1], `seed ${sd}, beacon ${k}: two different wicks (${o})`); }
  const seeds = new Set();
  for (let sd = 1; sd < 60; sd++) seeds.add(drawOffer(sd, 0, []).join());
  assert(seeds.size >= 10, `the seeds give different offers: ${seeds.size}`);
  pass('the wick offers: the same seed gives the same offers, and no wick is offered twice', { offers: a.offers });
}
{ // the last beacon is the win; death and the win end the run and keep their summary
  const rs = RS.fresh();
  startRun(rs, 5);
  goTo(rs, 'barrows');
  rs.run.carried = 58; rs.bank = 100; rs.run.time = 400;
  const w = lightBeacon(rs);
  assert(w.won && rs.run === null);
  assert.deepEqual([rs.bank, rs.wins, rs.runs, rs.bestWin, rs.ended.won, rs.ended.banked], [158, 1, 1, 400, true, 58]);
  // a death on The Crow Wall carrying 20 with 44 banked from the Gaol
  const d = RS.fresh();
  startRun(d, 5);
  d.run.carried = 44;
  lightBeacon(d);
  d.run.offer = null;
  d.run.carried = 20;
  const { R, rs: rr } = runnerAt(FLAT, 0, 0);
  Object.assign(rr, d);
  const ev = [];
  rr.run.hp = 10;
  R.hurt(16, [0, -1], {}, ev);
  assert(ev.some(e => e.type === 'dead') && ev.some(e => e.type === 'store'), 'death stores the run at once');
  assert.deepEqual(rr.ended, { won: false, place: 'ramparts', time: 0, foes: 0, lost: 20, banked: 44 });
  assert.equal(R.clock.stop, 9, 'death holds the game for 9 steps');
  pass('the win at the last beacon and a death end the run and keep their figures');
}
{ // the runner asks for a store at once on a hit, a drink, a fall, a lit beacon and at 0 health
  const meta = { wisps: [], beacon: { p: [3, 0, 0], r: 1.2 } };
  const { R, rs, body } = runnerAt(FLAT, 0, 0, 0, { meta });
  rs.run.carried = 9;
  rs.run.flasks = 1;
  body.place([3, 0, 0], 0);
  const ev = runFor(R, 2);
  assert(ev.some(e => e.type === 'beacon') && ev.some(e => e.type === 'store'));
  assert.deepEqual([rs.bank, rs.run.carried, rs.run.place, rs.run.offer.length, rs.run.entry.hp], [9, 0, 'ramparts', 2, 100]);
  assert.deepEqual([rs.run.flasks, rs.run.entry.flasks], [2, 2], 'the beacon fills the flasks: 1 of 2 becomes 2');
  // a beacon whose keepers stand stays dark (the guard rule comes with the foes)
  const g = runnerAt(FLAT, 0, 0, 0, { meta });
  g.R.lightable = () => ({ ok: false, why: 'The beacon will not catch while its keepers stand in the keep' });
  g.body.place([3, 0, 0], 0);
  const dark = runFor(g.R, 2);
  assert(dark.some(e => e.type === 'dark') && g.rs.run.place === 'gaol');
  pass('a lit beacon banks, fills the flasks, moves the run on with two wicks and stores it; a guarded one stays dark');
}

{ // a reload on the next frame after a hit goes on with the health it left; a reload in the death fade shows the summary
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const { R, rs } = runnerAt(FLAT, 0, 0);
  rs.run.hp = 60;
  enter(rs.run);
  RS.store(storage, rs);
  const ev = [];
  R.hurt(16, [0, -1], {}, ev);
  // the page stores on each 'store' event at once
  for (const e of ev) if (e.type === 'store') RS.store(storage, rs);
  const after = RS.load(storage);
  reload(after.run);
  assert.equal(after.run.hp, 44);
  // at 0 health the ended run is stored at once: a reload in the fade has no run and shows the same figures
  runFor(R, 80);
  rs.run.carried = 20;
  rs.run.hp = 10;
  const ev2 = [];
  R.hurt(16, [0, -1], {}, ev2);
  for (const e of ev2) if (e.type === 'store') RS.store(storage, rs);
  const fade = RS.load(storage);
  assert.equal(fade.run, null);
  assert.deepEqual({ ...fade.ended, time: +fade.ended.time.toFixed(2) }, { won: false, place: 'gaol', time: 1.25, foes: 0, lost: 20, banked: 0 });
  assert.equal(fade.deaths, 1);
  pass('a reload just after a hit keeps the hit, and a reload in the death fade shows the summary');
}

/* ---------------- the run's save ---------------- */
{
  const bad = [
    null, 5, 'x', [], { bank: -4, up: 'all', runs: 'many' },
    { bank: 1e99, up: { mantle: 9, flask: -2, edge: 2.6, sword: 3 }, furthest: 12, bestWin: -1, sound: 0, run: { place: 'moon' } },
    { run: { place: 'fen', hp: 'full', flasks: 99, wicks: ['keen', 'keen', 'sword', 'long'], offer: ['keen', 'oil'], entry: 'x', seed: -1 } },
    { run: { place: 'gaol', offer: ['sword', 'oil'] }, ended: { place: 'nowhere' } }
  ];
  for (const raw of bad) {
    const s = RS.clean(raw);
    assert.deepEqual(Object.keys(s).sort(), Object.keys(RS.fresh()).sort());
    assert(Number.isInteger(s.bank) && s.bank >= 0);
    for (const u of UPGRADES) assert(Number.isInteger(s.up[u.id]) && s.up[u.id] >= 0 && s.up[u.id] <= u.costs.length);
    assert(!('sword' in s.up));
    if (s.run) {
      assert(ORDER.includes(s.run.place));
      assert(s.run.hp >= 1 && s.run.hp <= maxHp(s.up, s.run.wicks) && s.run.flasks <= flasksMax(s.up, s.run.wicks));
      assert(!s.run.offer || s.run.offer.every(w => !s.run.wicks.includes(w) && WICKS.some(x => x.id === w)));
      assert(s.run.entry && Number.isFinite(s.run.entry.hp));
    }
  }
  const s = RS.clean(bad[6]);
  assert.deepEqual(s.run.wicks, ['keen', 'long']);
  assert.equal(s.run.offer, null, 'an offer that holds a wick already chosen is dropped');
  assert.equal(RS.clean(bad[5]).up.mantle, 3, 'a level is clamped');
  assert.equal(RS.clean(bad[7]).ended, null);
  assert.equal(RS.clean({ run: { place: 'ramparts', offer: ['oil', 'oil'] } }).run.offer, null, 'an offer of one wick twice is dropped');
  // a run in Lantern Fen that banked 30 and put out 7 comes back with its entry
  const rs = RS.fresh();
  startRun(rs, 11);
  goTo(rs, 'fen');
  Object.assign(rs.run, { banked: 30, foes: 7, hp: 70 });
  enter(rs.run);
  const back = RS.clean(JSON.parse(JSON.stringify(rs)));
  assert.deepEqual([back.run.place, back.run.banked, back.run.foes, back.run.entry], ['fen', 30, 7, { hp: 70, flasks: 2, carried: 0, foes: 7 }]);
  pass('the run save: bad fields are dropped, levels clamped, a bad offer dropped, and a run comes back with its entry');
}
{ // an old explorer page stores its own save while a run save exists: the bank and the upgrades stay
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const rs = RS.fresh();
  rs.bank = 77; rs.up.edge = 2;
  assert(RS.store(storage, rs));
  explorerStore(storage, { ...explorerFresh(), done: 1 });
  assert(mem.has(EXPLORER_KEY) && EXPLORER_KEY !== RS.KEY);
  const again = RS.load(storage);
  assert.deepEqual([again.bank, again.up.edge], [77, 2]);
  // blocked site data: storage is null, or every call throws; nothing throws out of load or store
  const thrower = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(RS.load(null), RS.fresh());
  assert.deepEqual(RS.load(thrower), RS.fresh());
  assert.equal(RS.store(null, rs), false);
  assert.equal(RS.store(thrower, rs), false);
  pass('the run save keeps its own key past an old explorer page, and blocked site data throws nothing');
}

/* ---------------- facing a foe, the pads and the cards ---------------- */
{
  const s = { x: 0, z: 0 };
  const a = makePost(FLAT, 0, 6), b = makePost(FLAT, 9, 9);
  assert.equal(nearest([a, b], s), a);
  assert.equal(nearest([b], s), null, 'none within 10 m');
  b.alive = false;
  assert.equal(nearest([b], s), null);
  // the yaw that faces a foe 6 m behind: the view's forward points at it
  const yaw = faceYaw(s, a), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  assert(near(Math.atan2(fx, fz), Math.atan2(a.x, a.z), 1e-9));
  assert(near(yawFor(0, 1), faceYaw(s, a), 1e-9));
  pass('R, Look and RB face the nearest awake foe within 10 m');
}
{
  const pad = (buttons = [], axes = [0, 0, 0, 0]) => ({ connected: true, axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })) });
  const two = readPads([pad([PAD.START]), pad([PAD.START])], true);
  assert(two.pause && two.down.size === 1, 'two pads holding Start make one press');
  const run = readPads([pad([PAD.X, PAD.B, PAD.Y, PAD.RB])], true);
  assert(run.attack && run.roll && run.heal && run.face && !run.slow);
  assert(readPads([pad([PAD.RT])], true).attack && readPads([pad([PAD.LT])], true).roll && readPads([pad([PAD.BACK])], true).pause);
  const wander = readPads([pad([PAD.X, PAD.RT, PAD.B, PAD.LT, PAD.Y])], false);
  assert(wander.slow && !wander.attack && !wander.roll && !wander.heal, 'in Wander X walks, and RT, B, LT and Y do nothing');
  assert(!readPads([pad([PAD.BACK])], false).pause);
  const sw = readPads([pad([PAD.A])], true, i => i === PAD.A);
  assert(!sw.jump && sw.nav.a, 'a swallowed A does not jump, but the cards still see it');
  const tilt = readPads([pad([], [0.3, -0.25, 0, 0])], true);
  assert(near(Math.hypot(tilt.mx, tilt.mz), Math.hypot(0.3, 0.25), 1e-9), 'a light tilt is passed as it is, so step walks');
  // two pads: each stick is the one tilted furthest, whatever the order, so a pad whose stick drifts does not take over
  for (const order of [0, 1]) {
    const list = [pad([], [0.25, 0, 0.3, 0]), pad([], [0, -0.9, 0, 0.8])];
    const two2 = readPads(order ? list.reverse() : list, true);
    assert(near(two2.mz, 0.9, 1e-9) && two2.mx === 0 && near(two2.oy, 0.8, 1e-9), `the furthest stick wins (order ${order}): ${two2.mx}, ${two2.mz}`);
  }
  // the keys or the touch stick win while the pad's left stick is under the walk threshold; a pad tilted past it wins
  assert.deepEqual(pickMove({ mx: 0, mz: 1 }, { mx: 0.19, mz: 0 }), { mx: 0, mz: 1 }, 'a drifting stick does not take over the keys');
  assert.deepEqual(pickMove({ mx: 0, mz: 1 }, { mx: -0.6, mz: 0 }), { mx: -0.6, mz: 0 }, 'a real tilt wins');
  assert.deepEqual(pickMove({ mx: 0, mz: 0 }, { mx: 0.19, mz: 0 }), { mx: 0.19, mz: 0 }, 'with no key held a light tilt is passed on');
  assert.equal(WALK_MIN, 0.2);
  // a card that opens with the stick held: no move, at once or held, until it comes back to centre
  const held = heldNav({ dir: 0, t: 0 }, { next: false, prev: true }), got = [];
  for (let i = 0; i < 60; i++) got.push(navStep(held, { next: false, prev: true }, 1 / 60));
  assert(got.every(m => m === 0), 'a way held when the card opens moves nothing');
  assert.equal(navStep(held, { next: false, prev: false }, 1 / 60), 0);
  assert.equal(navStep(held, { next: false, prev: true }, 1 / 60), -1, 'back to centre, then a new press moves');
  // the focus: a tilt past half moves one button, and again every 0.3 s while held
  const st = { dir: 0, t: 0 }, moves = [];
  for (let i = 0; i < 60; i++) moves.push(navStep(st, { next: true, prev: false }, 1 / 60));
  assert.deepEqual(moves.map((m, i) => (m ? i : -1)).filter(i => i >= 0), [0, 18, 36, 54]);
  assert.equal(navStep(st, { next: false, prev: false }, 1 / 60), 0);
  assert.equal(navStep(st, { next: false, prev: true }, 1 / 60), -1);
  pass('the pads: one press across all pads, the run and Wander mappings, a swallowed button, the focus every 0.3 s');
}

/* ---------------- the run's screens: what the cards show, and a reload at each card ---------------- */
{ // the six wick buttons and the five upgrades, with their names and no others
  assert.deepEqual(WICKS.map(w => wickLine(w.id)), [
    'Long wick · +20 health', 'Keen edge · +15% blade damage', 'Quick heels · roll again after 0.12 s', 'Heavy fall · plunge ×1.5 and wider',
    'Spare oil · +1 flask', 'Close shave · +50% after a near miss'
  ]);
  assert.deepEqual(UPGRADES.map(u => u.name), ['Mantle', 'Flask', 'Edge', 'Draught', 'Ash pocket']);
  // every level of every upgrade, bought in turn with enough glim: what the next level gives, then "all bought" and no Buy button
  const rs = RS.fresh();
  rs.bank = 1065;
  const seen = [];
  for (const u of UPGRADES) {
    for (let k = 0; k < u.costs.length; k++) {
      const row = upgradeRow(rs, u.id);
      assert.equal(row.buy, 'Buy');
      seen.push(row.label);
      assert(buy(rs, u.id));
    }
    const top = upgradeRow(rs, u.id);
    assert(top.top && top.buy === null, `${u.name} at its top level has no Buy button`);
    seen.push(top.label);
  }
  assert.deepEqual(seen, [
    'Mantle 1 · +15 health · 40 glim', 'Mantle 2 · +15 health · 80 glim', 'Mantle 3 · +15 health · 140 glim', 'Mantle 3 · all bought',
    'Flask 1 · +1 flask · 60 glim', 'Flask 2 · +1 flask · 150 glim', 'Flask 2 · all bought',
    'Edge 1 · +12% blade damage · 50 glim', 'Edge 2 · +12% blade damage · 100 glim', 'Edge 3 · +12% blade damage · 170 glim', 'Edge 3 · all bought',
    'Draught 1 · heal 45% · 45 glim', 'Draught 2 · heal 55% · 110 glim', 'Draught 2 · all bought',
    'Ash pocket · keep 30% of glim · 120 glim', 'Ash pocket · all bought'
  ]);
  // not enough glim: the Buy button is off and says how much more is needed; Mantle with 50 banked leaves 10 and level 1
  const poor = RS.fresh();
  poor.bank = 30;
  assert.deepEqual([upgradeRow(poor, 'flask').buy, upgradeRow(poor, 'flask').need], ['30 more glim', 30]);
  poor.bank = 50;
  assert(buy(poor, 'mantle'));
  assert.deepEqual([poor.bank, poor.up.mantle, upgradeRow(poor, 'mantle').label], [10, 1, 'Mantle 2 · +15 health · 80 glim']);
  startRun(poor, 3);
  assert.equal(poor.run.hp, 115, 'the next run starts with 115 health');
  pass('the wick buttons and the Lamp-room rows: every level, "all bought" at the top, and "30 more glim" when the bank is short');
}
{ // the Lamp-room's own buttons: from a beacon card Back to the beacon alone; with a run in progress Go on with the run; from Wander's
  // Map Back to Wander as its back action; Wander once it is open, but never from a beacon card
  const rs = RS.fresh();
  assert.deepEqual(lampButtons(rs), { list: ['begin'], main: 'begin', back: null });
  assert.deepEqual(lampButtons(rs, null, true).list, ['begin', 'wander']);
  startRun(rs, 2);
  assert.deepEqual(lampButtons(rs, 'beacon', true), { list: ['back'], main: 'back', back: 'back' });
  assert.deepEqual(lampButtons(rs, 'wander', true), { list: ['goon', 'toWander'], main: 'goon', back: 'toWander' });
  assert.deepEqual(lampButtons(rs).list, ['goon']);
  assert.deepEqual(Object.values(LAMP_LABELS), ['Back to the beacon', 'Begin the run', 'Go on with the run', 'Back to Wander', 'Wander']);
  pass('the Lamp-room shows Back to the beacon, Begin the run or Go on with the run, and Back to Wander, as the spec says');
}
{ // the HUD: "74/100" beside a bar filled 74% with one full pip and one empty; the widest HUD; the fire edge below 30%
  const rs = RS.fresh();
  startRun(rs, 1);
  Object.assign(rs.run, { hp: 74, flasks: 1, carried: 18 });
  let h = hudOf(rs, 2);
  assert.deepEqual([h.text, h.share, h.pips, h.count, h.low], ['74/100', 0.74, [true, false], '◆ 2/5 wisps · ● 18 glim', false]);
  rs.run.hp = 29;
  assert(hudOf(rs).low);
  rs.run.hp = 30;
  assert(!hudOf(rs).low);
  rs.up.mantle = 3; rs.up.flask = 2; rs.run.wicks = ['long', 'oil'];
  Object.assign(rs.run, { hp: 165, flasks: 5, carried: 254 });
  h = hudOf(rs, 5);
  assert.deepEqual([h.text, h.pips.length, h.pips.every(Boolean), h.count], ['165/165', 5, true, '◆ 5/5 wisps · ● 254 glim']);
  rs.run = null;
  assert.equal(hudOf(rs), null, 'no health line without a run');
  pass('the HUD: 74/100 and its pips, 165/165 with 5 flasks at its widest, the fire edge below 30%');
}
{ // the summary of a death on The Crow Wall carrying 20 with 44 banked; Ash pocket; the pause panel's places and questions
  const rs = RS.fresh();
  startRun(rs, 5);
  rs.run.carried = 44;
  lightBeacon(rs);
  chooseWick(rs, rs.run.offer[0]);
  Object.assign(rs.run, { carried: 20, time: 125.4, foes: 3 });
  const e = die(rs);
  assert.deepEqual(summaryOf(e), {
    title: 'The lamp goes out',
    rows: [['Reached', 'II · The Crow Wall'], ['Time', '2:05'], ['Foes put out', '3'], ['Glim lost', '20 glim'], ['Glim banked', '44 glim']]
  });
  const ash = RS.fresh();
  ash.up.ash = 1;
  startRun(ash, 5);
  ash.run.carried = 20;
  const a = summaryOf(die(ash)).rows;
  assert.deepEqual([a[3][1], a[4][1], ash.bank], ['14 glim', '6 glim', 6]);
  assert.deepEqual(routeOf('fen').map(p => p.state), ['passed', 'passed', 'here', 'ahead', 'ahead']);
  assert.deepEqual(routeOf('fen').map(p => `${p.n} ${p.name}`), ['I The Sunken Gaol', 'II The Crow Wall', 'III Lantern Fen', 'IV The Bell Knoll', 'V Barrow Crown']);
  assert.equal(ASKS.restart.line('ramparts'), 'Back to the start of The Crow Wall? The glim you found here is lost.');
  for (const q of Object.values(ASKS)) assert(!/\b(north|south|east|west)\b/i.test(q.line('fen')));
  pass('the summary: "II · The Crow Wall", 20 lost and 44 banked; Ash pocket shows 14 lost and 6 banked; the pause panel\'s places');
}
{ // game time: a toast of 1.8 s is 108 steps; the fade to ink is 72 steps, half at 36
  assert.deepEqual([stepsOf(1800), stepsOf(2600), stepsOf(3200), INK], [108, 156, 192, 72]);
  assert.deepEqual([inkAt(-1), inkAt(0), inkAt(36), inkAt(72), inkAt(500)], [0, 0, 0.5, 1, 1]);
  assert.deepEqual(TIMED, ['play', 'dying', 'lit', 'won']);
  pass('toasts, the arrival card and the fade to ink count steps of the game clock');
}
{ // a reload at each card: the page reads the save and opens the same card, with the same figures
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const reloadAt = rs => { RS.store(storage, rs); const s = RS.load(storage); if (s.run) reload(s.run); return { s, card: cardOnLoad(s) }; };
  const rs = RS.fresh();
  assert.equal(reloadAt(rs).card, 'help', 'a first visit: the help card');
  rs.seen = true;
  assert.equal(reloadAt(rs).card, 'lamp', 'a later visit with no run: the Lamp-room');
  // the beacon card before the choice: the same two wicks, over the next place
  startRun(rs, 7);
  Object.assign(rs.run, { hp: 60, carried: 30 });
  lightBeacon(rs);
  const offer = rs.run.offer.slice();
  let r = reloadAt(rs);
  assert.deepEqual([r.card, r.s.run.offer, r.s.run.place, r.s.bank], ['beacon', offer, 'ramparts', 30]);
  // the Lamp-room from the beacon card after the choice and a buy (each stored at once): play at the next place, the buy kept
  rs.bank = 50;
  chooseWick(rs, 'heavy');
  buy(rs, 'mantle');
  r = reloadAt(rs);
  assert.deepEqual([r.card, r.s.run.place, r.s.run.wicks, r.s.run.hp, maxOf(r.s), r.s.bank], [null, 'ramparts', ['heavy'], 75, 115, 10]);
  // the pause panel: the run as stored, and the sound switch
  rs.sound = false;
  r = reloadAt(rs);
  assert.deepEqual([r.card, r.s.sound], [null, false]);
  // Back to the start is a reload: health and flasks no higher than at the place's start, the glim carried and the foes as they were
  Object.assign(rs.run, { hp: 90, carried: 12, foes: 2 });
  const back = JSON.parse(JSON.stringify(rs.run));
  reload(back);
  assert.deepEqual([back.hp, back.carried, back.foes], [75, 0, 0]);
  // in the death fade: the summary with the same figures, and no run that goes on
  rs.run.carried = 12;
  die(rs);
  const ended = { ...rs.ended };
  r = reloadAt(rs);
  assert.deepEqual([r.card, r.s.run, r.s.ended], ['summary', null, ended]);
  // the summary closed: the ended run is gone, and the Lamp-room opens; Begin the run starts the Gaol with the upgrades bought
  rs.ended = null;
  r = reloadAt(rs);
  assert.deepEqual([r.card, r.s.bank, r.s.up.mantle], ['lamp', 10, 1]);
  startRun(r.s, 9);
  assert.deepEqual([r.s.run.place, r.s.run.hp, r.s.run.wicks, r.s.run.carried], ['gaol', 115, [], 0]);
  pass('a reload at each card: the help card, the Lamp-room, the beacon card with the same two wicks, play after the choice and a buy, the summary in the fade');
}

/* ---------------- the pose of each move ---------------- */
{ // every move keeps the body's numbers finite: a move drives it with run = walk = its speed, 0 too
  const { F, s, body } = fighterAt(LEDGE, 0, 1, Math.PI);
  const post = makePost(LEDGE, 0, -1);
  play(F, 200, i => ({ attack: i < 60 || (i > 150 && i < 152), roll: i === 70, heal: i === 100, jump: i > 140 && i < 143, mz: i > 140 ? -1 : 0 }), [post], Math.PI);
  F.knock([0, 0]);
  play(F, 30, {}, [post]);
  for (const [k, v] of Object.entries(s)) if (typeof v === 'number') assert(Number.isFinite(v), `s.${k} is ${v}`);
  const rig = { names: ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'shadow'], pivots: [[0, 80.1, 0], [0, 80.82, 0], [0.15, 80.24, 0], [-0.15, 80.24, 0], [0.33, 80.72, 0.04], [-0.33, 80.72, 0], [0, 120, 0]] };
  assert(pose(new Float32Array(84), rig, body.s).every(Number.isFinite));
  pass("the body's numbers stay finite through every move");
}
{
  const rig = { names: ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'shadow'], pivots: [[0, 80.1, 0], [0, 80.82, 0], [0.15, 80.24, 0], [-0.15, 80.24, 0], [0.33, 80.72, 0.04], [-0.33, 80.72, 0], [0, 120, 0]] };
  const s = { x: 1, y: 2, z: 3, yaw: 0.4, phase: 0, moveK: 0, runK: 0, landK: 0, landAge: 9, ground: true, vy: 0, floor: 2 };
  const out = new Float32Array(12 * 7);
  const where = () => {
    // where the body's pivot lands
    const p = rig.pivots[0];
    return [0, 1, 2].map(r => out[r * 3] * p[0] + out[r * 3 + 1] * p[1] + out[r * 3 + 2] * p[2] + out[9 + r]);
  };
  pose(out, rig, s);
  const rest = where();
  for (const move of ['cut1', 'cut2', 'fin', 'roll', 'hang', 'plunge', 'land', 'drink', 'hurt'])
    for (const ph of ['wind', 'act', 'rec', move]) for (const k of [0, 0.3, 0.5, 1]) {
      s.act = { move, ph, k };
      pose(out, rig, s);
      assert(out.every(Number.isFinite), `${move} ${ph} ${k}`);
    }
  // a roll turns over round the middle of the figure: half way, the middle stays where it was
  s.act = { move: 'roll', ph: 'roll', k: 0.5 };
  pose(out, rig, s);
  const mid = [0, 1, 2].map(r => out[r * 3] * rig.pivots[0][0] + out[r * 3 + 1] * (rig.pivots[0][1] - 0.1 + 0.45) + out[r * 3 + 2] * rig.pivots[0][2] + out[9 + r]);
  assert(near(mid[0], s.x, 1e-3) && near(mid[2], s.z, 1e-3), `the middle stays: ${mid}`);
  s.act = null;
  s.hide = true;
  pose(out, rig, s);
  for (let b = 0; b < 6; b++) assert(out[12 * b] === 0 && out[12 * b + 4] === 0 && out[12 * b + 10] === -500, `bone ${b} hides`);
  assert(out[12 * 6] !== 0, 'the shadow stays');
  assert(rest.every(Number.isFinite));
  pass('the pose of each move is finite, the roll turns round the middle, and the blink hides every bone but the shadow');
}

/* ---------------- on the baked places ---------------- */
const skipWorlds = process.env.GLOAM_WORLDS === '0';
const placeOf = id => {
  const meta = JSON.parse(fs.readFileSync(`${DIR}worlds/${id}.json`, 'utf8'));
  const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${DIR}worlds/${id}.walk.bin.gz`)));
  return { meta, walk: makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1)) };
};
if (!skipWorlds && ORDER.every(id => fs.existsSync(`${DIR}worlds/${id}.json`))) {
  { // each place's three files within 1.5 MB
    const sizes = {};
    for (const id of ORDER) {
      const b = ['.bin.gz', '.walk.bin.gz', '.json'].reduce((a, e) => a + fs.statSync(`${DIR}worlds/${id}${e}`).size, 0);
      assert(b <= 1.5e6, `${id}: ${b} bytes`);
      sizes[id] = +(b / 1e6).toFixed(3);
    }
    pass("each place's three files are 1.5 MB or less", sizes);
  }
  { // the roll on real ground: 8 directions at the yards measured in design.md
    const got = {};
    for (const [id, c] of [['gaol', [-5.5, 4.5]], ['bells', [-0.5, 12]], ['barrows', [18, -22]]]) {
      const { meta, walk } = placeOf(id), d = [];
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, body = makeBody(walk, { p: [c[0], walk.top(c[0], c[1]) + 0.5, c[1]], yaw: a + Math.PI }, meta.bounds, { ...PARAMS });
        const F = makeFighter(body, walk);
        const x0 = body.s.x, z0 = body.s.z;
        for (let i = 0; i < 90; i++) F.step({ roll: i === 0 }, 0, [], []);
        d.push(+Math.hypot(body.s.x - x0, body.s.z - z0).toFixed(2));
      }
      got[id] = d;
      assert(d.every(v => v >= 3.3 && v <= 3.7), `${id}: rolls ${d}`);
    }
    pass('the roll on real ground: 3.3 to 3.7 m in 8 directions in the Gaol, The Bell Knoll and Barrow Crown', got);
  }
  { // the sight test: 10,000 lines of about 9 m across the Gaol's yard
    const { walk } = placeOf('gaol');
    const a = { x: 0.3, y: walk.top(0.3, 11.8), z: 11.8 };
    let k = 0;
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) { const x = -5.5 + (i % 7), z = 4.5; if (sees(walk, a, { x, y: walk.top(x, z), z })) k++; }
    const ms = performance.now() - t0;
    assert(ms < 300, `10,000 sight tests took ${ms} ms`);
    pass('the sight test: 10,000 lines across the Gaol', { ms: +ms.toFixed(1), clear: k });
  }
  { // a run through the Gaol: the five wisps, then the beacon
    const { meta, walk } = placeOf('gaol');
    const rs = RS.fresh();
    startRun(rs, 4);
    rs.run.flasks = 1;
    const body = makeBody(walk, meta.spawn, meta.bounds, { ...PARAMS });
    const R = makeRunner({ walk, meta, body, rs });
    for (const w of meta.wisps) { body.place([w.p[0], w.p[1] - 0.5, w.p[2]], 0); R.step({}, 0); R.step({}, 0); }
    assert.deepEqual([R.wisps.size, rs.run.carried, rs.run.flasks], [5, 20, 2]);
    body.place([meta.beacon.p[0], meta.beacon.p[1], meta.beacon.p[2]], 0);
    const ev = runFor(R, 3);
    const lit = ev.find(e => e.type === 'beacon');
    assert(lit && lit.next === 'ramparts' && lit.offer.length === 2, JSON.stringify(ev.map(e => e.type)));
    assert.deepEqual([rs.bank, rs.run.carried, rs.run.place], [20, 0, 'ramparts']);
    pass('a run through the Gaol: five wisps give 20 glim and a flask, and the beacon banks it and offers two wicks', { offer: lit.offer });
  }
}
console.log(`${n} checks passed`);
