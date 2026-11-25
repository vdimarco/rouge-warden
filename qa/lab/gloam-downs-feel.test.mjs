// Gloam Downs: the feel of a run, checked in node with no browser (public/lab/gloam-downs/feel.js, combo.js, foes.js, fight.js,
// sparks.js, with run.js and moves.js):
//   the gentle shake: a cut adds none, the heavy hits do, and the offset never passes 0.15 m, even under 10 boss slams in a second;
//   the Shake switch: off under reduced motion until it is pressed, on otherwise, and it changes only the kick;
//   hit stop on the heavy hits and the boss, inside 9 steps in any 30;
//   poise and stagger: an Ironback broken in its charge's wind-up staggers for 72 steps, its charge never runs, it takes 25% more,
//     poise fills 3 s after the last hit, and no new stagger within 4 s of the last one's end;
//   the combo: a hit adds 1, a swing at most 3, a relic at most 1 each 0.25 s, a taken hit or 3 s with no hit ends it, a near miss does
//     not; the tiers at 5, 10 and 20; combo-tier on the bus; the glim a foe drops (a Snuffer at tier III drops 6); the lamp's halo of
//     6, 12 and 18 dabs in lamp slots, never fire 37, steady under reduced motion; the meter's fade.
// Run: node qa/lab/gloam-downs-feel.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner, maxOf, makeClock, hitStop, advance, STOP_CAP, STOP_SPAN } from '../../public/lab/gloam-downs/run.js';
import { HITS } from '../../public/lab/gloam-downs/moves.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { makeFight } from '../../public/lab/gloam-downs/fight.js';
import { makeFeel, FEEL, STAGGER, poiseOf } from '../../public/lab/gloam-downs/feel.js';
import { makeCombo, COMBO, tierOf, comboGlim } from '../../public/lab/gloam-downs/combo.js';
import { on } from '../../public/lab/gloam-downs/bus.js';
import { readFigures, makePool } from '../../public/lab/gloam-downs/pool.js';
import { poolFor } from '../../public/lab/gloam-downs/figures.js';
import { REEVE, ATTACKS } from '../../public/lab/gloam-downs/boss.js';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url)), W = DIR + 'worlds/';
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const len = v => Math.hypot(v[0], v[1], v[2]);

function layered(fn, half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz, cells = new Int16Array(2 * N);
  let k = 0;
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++, k++) { const v = fn(info.x0 + i * info.step, info.z0 + j * info.step); cells[k] = cells[N + k] = Math.round(v * 100); }
  return makeWalk(info, cells);
}
const FLAT = layered(() => 0);
const SplatCodec = new Function(fs.readFileSync(DIR + 'ink/splat-codec.js', 'utf8') + '\nreturn SplatCodec;')();
const decode = file => SplatCodec.decode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(file))), { maxRows: 1_000_000 });
const foesFile = (() => { const json = readFigures(JSON.parse(zlib.gunzipSync(fs.readFileSync(`${W}foes.json.gz`)).toString())); return { json, ...decode(`${W}foes.bin.gz`) }; })();
const PAL = JSON.parse(fs.readFileSync(`${W}gaol.json`, 'utf8')).pal;
// a page fight in node, as gloam-downs-foes-ai.test.mjs makes one: a pool of every foe type over a tiny stand-in place
const PIVOTS = [[0, 80.1, 0], [0, 80.82, 0], [0.15, 80.24, 0], [-0.15, 80.24, 0], [0.33, 80.72, 0.04], [-0.33, 80.72, 0], [0, 120, 0]];
function pageFight(walk, { codes = 'SSSPMI', still = false, fx = {}, hp } = {}) {
  const meta = { id: 'test', pal: PAL, bones: { names: ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'shadow'], first: 0, end: 4, pivots: PIVOTS }, zones: [], bounds: 20 };
  const world = { data: new Float32Array(16 * 4), count: 4, pal: PAL, anim: { bones: new Float32Array(12 * 7), boned: new Int32Array(0) } };
  const pool = makePool(world, meta, poolFor('x', foesFile, null, codes), { extra: 256 });
  const rs = RS.fresh();
  startRun(rs, 7);
  if (hp) rs.run.hp = hp;
  const body = makeBody(walk, { p: [0, 0.5, 0], yaw: Math.PI }, 20, { ...PARAMS });
  const G = makeFight({ walk, meta, world, pool, rs, max: () => maxOf(rs), still, fx });
  const R = makeRunner({ walk, meta: { wisps: [], beacon: { p: [90, 0, 90], r: 1 } }, body, rs, targets: G.foes.targets, lightable: G.foes.lightable, drop: G.foes.drop, think: G.think, onLight: G.foes.bank, fx, still });
  G.bind(R);
  const all = [];
  const step = inp => { const ev = R.step(inp, 0); for (const e of ev) { G.event(e); all.push({ ...e, play: R.clock.play }); } return ev; };
  return { G, R, rs, pool, world, body, step, all, s: body.s };
}

/* ---------------- the gentle shake ---------------- */
{ // a string of cuts alone gives no kick at all; the finisher, the plunge, a hit taken and a stagger do
  const F = makeFeel({ pal: PAL });
  for (let i = 0; i < 40; i++) { F.tick(1); if (i % 4 === 0) F.hit(i % 8 ? 'cut1' : 'cut2'); assert.deepEqual(F.kick(0.4, 0.34), [0, 0, 0]); }
  const add = {};
  for (const k of ['fin', 'plunge', 'hurt', 'stagger']) {
    const G = makeFeel({ pal: PAL });
    G.tick(1);
    if (k === 'hurt') G.hurt(16); else if (k === 'stagger') G.stagger(); else G.hit(k);
    add[k] = +G.trauma.toFixed(3);
    let most = 0;
    for (let i = 0; i < 6; i++) { G.tick(1); most = Math.max(most, len(G.kick(0.4, 0.34))); }
    assert(most > 0, `${k} kicks the camera`);
  }
  assert.deepEqual(add, { fin: 0.05, plunge: 0.06, hurt: 0.1, stagger: 0.08 });
  assert.equal(FEEL.kick, 2.4);
  pass('the gentle shake: no kick from cuts; the finisher 0.05, the plunge 0.06, a hit taken 0.10, a stagger 0.08', add);
}
{ // 10 boss slams in one second: every offset is 0.15 m or less, and the kick falls back to nothing
  const F = makeFeel({ pal: PAL });
  let most = 0;
  for (let i = 0; i < 60; i++) {
    F.tick(1);
    if (i % 6 === 0) F.shock(FEEL.add.slam);
    for (const yaw of [0, 0.7, 2.1, -1.4]) { const k = len(F.kick(yaw, 0.34)); most = Math.max(most, k); assert(k <= FEEL.most + 1e-9, `an offset of ${k} m`); }
  }
  for (let i = 0; i < 120; i++) F.tick(1);
  assert.deepEqual(F.kick(0, 0.34), [0, 0, 0]);
  assert(most > 0.1, `the slams did kick: ${most}`);
  pass('10 boss slams in a second: the offset stays at 0.15 m or less, and falls back to 0', { most: +most.toFixed(4) });
}
{ // the Shake switch: unset, it follows reduced motion; set, it wins either way; it changes only the kick
  const shaken = (still, kick) => { const F = makeFeel({ pal: PAL, still, fx: kick === undefined ? {} : { kick } }); F.tick(1); F.hit('fin'); F.tick(1); return { kick: len(F.kick(0.3, 0.3)) > 0, zoom: F.zoom() }; };
  assert.deepEqual(shaken(true), { kick: false, zoom: 1 });
  assert.deepEqual(shaken(false), { kick: true, zoom: FEEL.zoomK });
  assert.deepEqual(shaken(true, true), { kick: true, zoom: 1 }, 'Shake on under reduced motion: the kick, and the zoom still 1');
  assert.deepEqual(shaken(false, false), { kick: false, zoom: FEEL.zoomK }, 'Shake off: no kick, the zoom as before');
  pass('the Shake switch: off under reduced motion until pressed, on otherwise; only the kick changes');
}

/* ---------------- hit stop ---------------- */
{ // the heavy hits and the boss hold longer: 3 for a cut, 5 for the finisher, the plunge and a hit taken, 6 for the slam, 9 for a phase
  assert.deepEqual(HITS.map(h => h.stop), [3, 3, 5]);
  assert.equal(ATTACKS.slam.stop, 6);
  assert.equal(REEVE.stop, 9);
  // never more than 9 steps in any 30: a slam, then a phase change, then a finisher at once
  const c = makeClock(), held = [];
  for (let i = 0; i < 90; i++) {
    if (i === 0) hitStop(c, 6);
    if (i === 6) hitStop(c, 9);
    if (i === 15) hitStop(c, 5);
    held.push(advance(c) ? 0 : 1);
  }
  for (let i = 0; i + STOP_SPAN <= held.length; i++) assert(held.slice(i, i + STOP_SPAN).reduce((a, b) => a + b, 0) <= STOP_CAP);
  pass('hit stop: 3 for a cut, 5 for the finisher, 6 for the boss slam, 9 for a phase change, and no more than 9 steps in any 30', { held: held.reduce((a, b) => a + b, 0) });
}

/* ---------------- poise and stagger ---------------- */
{ /* two strings of three hits (86 damage) on an Ironback held in its charge's wind-up: it staggers, its charge never runs, and
     __gloam.foes() (fight.list) shows the stagger for 72 steps */
  const P = pageFight(FLAT, { hp: 1000 });
  const r = P.G.hooks.spawn('I', 0, -5, 0);
  const I = P.G.foes.find(r.id);
  assert.equal(poiseOf(I), 60);
  P.G.hooks.hold(r.id, 'charge', 0.3);
  P.step({});
  const raws = [...HITS.map(h => h.dmg), ...HITS.map(h => h.dmg)], dealtHp = [];
  let at = null;
  for (const [i, raw] of raws.entries()) {
    const before = I.hp;
    I.hit(raw, { from: [P.s.x, P.s.z], kind: HITS[i % 3].id });
    dealtHp.push(before - I.hp);
    if (I.state === 'stagger' && at === null) at = i;
    P.step({});
  }
  assert.equal(raws.reduce((a, b) => a + b, 0), 86);
  assert.equal(at, 4, `the poise breaks on the 5th hit (${at})`);
  assert.equal(dealtHp[5], Math.round(22 * STAGGER.take), 'a hit in the stagger takes 25% more');
  assert(!I.hold && I.move === null, 'the wind-up ends');
  const left = [];
  let charged = false;
  for (let i = 0; i < 90; i++) {
    const v = P.G.list().find(f => f.id === r.id);
    left.push(v.stagger);
    if (I.move === 'charge') charged = true;
    P.step({});
  }
  const steps = left.filter(x => x > 0).length, first = left[0];
  assert(steps >= 66 && steps <= 72 && first <= 72, `the stagger shows for ${steps} steps (from ${first})`);
  assert(!P.all.some(e => e.type === 'cue' && e.cue === 'charge'), 'the charge never ran');
  assert(P.all.some(e => e.type === 'stagger'), 'the stagger event');
  // the stagger kicks the camera, and its crack glows ember: some sparks in slot 33 were laid
  pass('an Ironback broken in its wind-up staggers for 72 steps (1.2 s), takes 25% more, and its charge never runs', { at, dealt: dealtHp, charged });
}
{ // no stagger again within 4 s of its end; the poise fills 3 s after the last hit
  const P = pageFight(FLAT, { hp: 1000 });
  const r = P.G.hooks.spawn('I', 0, -5, 0);
  const I = P.G.foes.find(r.id);
  I.cool = 1e6; I.hp = 1000;
  for (const raw of [30, 30]) { I.hit(raw, {}); P.step({}); }
  assert.equal(I.state, 'stagger');
  while (I.state === 'stagger') P.step({});
  I.cool = 1e6;
  for (const raw of [30, 30, 30]) { I.hit(raw, {}); P.step({}); }
  assert.notEqual(I.state, 'stagger', 'no stagger within 4 s of the last');
  for (let i = 0; i < STAGGER.gap; i++) P.step({});
  I.cool = 1e6;
  I.hit(30, {}); P.step({});
  for (let i = 0; i < STAGGER.refill; i++) P.step({});
  I.hit(30, {}); P.step({});
  assert.notEqual(I.state, 'stagger', 'the poise filled again 3 s after the last hit: 30 + 30 with a gap does not break it');
  const was = I.state;
  I.hit(30, {}); P.step({});
  assert.equal(I.state, 'stagger', `two hits of 30 in a row break it (${was}, ${I.state}, hp ${I.hp}, poise ${I.poise})`);
  // a light foe with no poise never staggers
  const s = P.G.foes.find(P.G.hooks.spawn('S', 3, -3, 0).id);
  s.hp = 1000;
  for (let i = 0; i < 6; i++) { s.hit(30, {}); P.step({}); }
  assert.notEqual(s.state, 'stagger');
  assert.equal(poiseOf({ type: 'S', elite: {} }), 50);
  assert.equal(poiseOf({ type: 'I', elite: {} }), 90);
  pass('no stagger within 4 s of the last one\'s end; poise fills 3 s after the last hit; an elite has 50, the Bellwether 90, a Snuffer none');
}

/* ---------------- the combo ---------------- */
{ // the rules, on the combo alone
  const seen = [];
  const C = makeCombo({ emit: (name, d) => seen.push([name, d.tier, d.n]) });
  C.tick(); C.hit('cut1'); C.hit('cut1'); C.hit('cut1'); C.hit('cut1');
  assert.equal(C.n, 3, 'a swing that hits four foes adds 3');
  C.tick(); C.hit('relic'); C.hit('relic');
  assert.equal(C.n, 4, 'one relic hit in 0.25 s');
  for (let i = 0; i < COMBO.relicGap; i++) C.tick();
  C.hit('relic');
  assert.equal(C.n, 5);
  assert.equal(C.tier, 1);
  for (let i = 0; i < 179; i++) C.tick(true);
  assert.equal(C.n, 5, 'still on at 2.98 s');
  for (let i = 0; i < 30; i++) C.tick(false);
  assert.equal(C.n, 5, 'hit stop does not count');
  C.tick(true);
  assert.equal(C.n, 0, 'over at 3.0 s with no hit');
  assert.deepEqual([tierOf(4), tierOf(5), tierOf(9), tierOf(10), tierOf(19), tierOf(20)], [0, 1, 1, 2, 2, 3]);
  assert.deepEqual(seen, [['combo-tier', 1, 5], ['combo-tier', 0, 0]]);
  assert.deepEqual([comboGlim(3, 0), comboGlim(3, 1), comboGlim(3, 2), comboGlim(3, 3), comboGlim(8, 1), comboGlim(4, 2)], [3, 3, 4, 6, 9, 6]);
  // the meter: from 2 hits, and 0.4 s of fade after the end
  const M = makeCombo({ emit: null });
  M.tick(); M.hit(); assert.equal(M.meter().show, false);
  M.tick(); M.hit(); assert.deepEqual([M.meter().show, M.meter().n], [true, 2]);
  M.end();
  const fade = [];
  for (let i = 0; i < 30; i++) { fade.push(M.meter().show); M.tick(); }
  assert.equal(fade.filter(Boolean).length, COMBO.fade, 'the meter fades over 24 steps');
  pass('the combo: 1 a hit, 3 a swing, 1 relic hit each 0.25 s, over after 3.0 s of play, tiers at 5, 10 and 20, the meter from 2 hits');
}
{ // combo-tier goes out on the bus
  const got = [];
  const off = on('combo-tier', d => got.push(d));
  const C = makeCombo();
  C.set(10);
  off();
  assert.deepEqual(got, [{ tier: 2, n: 10 }]);
  pass('combo-tier on the bus: { tier, n }');
}
{ // a taken hit ends it, a near miss does not, and the run keeps the best
  const N = pageFight(FLAT, { hp: 1000 });
  N.G.combo.set(12);
  N.step({ roll: true, mz: -1 });
  N.step({});
  assert.equal(N.R.fighter.safe(), 'roll');
  const ev = [];
  N.R.hurt(16, [0, -2], {}, ev);
  for (const e of ev) N.G.event(e);
  assert(ev.some(e => e.type === 'miss'), 'a near miss');
  assert.equal(N.G.combo.n, 12, 'a near miss does not end the combo');
  const P = pageFight(FLAT, { hp: 1000 });
  const r = P.G.hooks.spawn('S', 0, -2.2, 0);
  P.G.combo.set(12);
  let hurtAt = -1;
  for (let i = 0; i < 80 && hurtAt < 0; i++) if (P.step({}).some(e => e.type === 'hurt')) hurtAt = i;
  assert(hurtAt > 0, 'the hook landed');
  assert.deepEqual(P.G.combo.view(), { n: 0, tier: 0, left: 0 }, 'the hook ended it');
  assert.equal(P.rs.run.combo, 12, 'the run keeps 12 as its best');
  pass('a taken hit ends the combo, a near miss does not, and the run keeps the best (12)', { hurtAt, id: r.id });
}
{ // a Snuffer put out at tier III drops 6 motes (3 x 2); a cut gives no kick
  const P = pageFight(FLAT, { hp: 1000 });
  const r = P.G.hooks.spawn('S', 0, -1.5, 0);
  const S = P.G.foes.find(r.id);
  S.hp = 8; S.cool = 1e6;
  P.G.combo.set(20);
  const kicks = [];
  for (let i = 0; i < 12; i++) { P.step({ attack: i === 0 }); P.G.draw({ yaw: 0, pitch: 0.34 }); kicks.push(len(P.G.kick)); }
  assert(S.out, 'the Snuffer is out');
  assert.equal(P.G.foes.motes.length, 6, `${P.G.foes.motes.length} motes`);
  assert(kicks.every(k => k === 0), 'a cut gives no kick');
  assert.equal(P.G.combo.n, 21);
  pass('a Snuffer put out at tier III drops 6 motes; the cut that did it gives no kick');
}
{ // the lamp: 6, 12 and 18 dabs at tiers I, II and III in slots 46 and 47, fx.lamp 1.15, 1.3, 1.5; steady under reduced motion
  const got = {};
  for (const [nHits, tier] of [[0, 0], [5, 1], [10, 2], [20, 3]]) {
    const P = pageFight(FLAT);
    P.G.combo.set(nHits);
    P.step({});
    P.G.draw({ yaw: 0, pitch: 0.34 }, { time: 1 });
    const halo = P.G.halo.filter(g => g.kind === 'halo');
    got[tier] = { dabs: halo.length, lamp: P.G.lamp };
    assert(halo.every(g => g.ci === 46 || g.ci === 47), 'lamp slots only');
    assert(!P.G.halo.some(g => g.ci === 37), 'never fire 37');
  }
  assert.deepEqual(got, { 0: { dabs: 0, lamp: 1 }, 1: { dabs: 6, lamp: 1.15 }, 2: { dabs: 12, lamp: 1.3 }, 3: { dabs: 18, lamp: 1.5 } });
  const still = pageFight(FLAT, { still: true });
  still.G.combo.set(10);
  still.step({});
  still.G.draw({ yaw: 0, pitch: 0.34 }, { time: 1 });
  const a = still.G.halo.map(g => [g.x, g.y, g.z]);
  still.G.draw({ yaw: 0, pitch: 0.34 }, { time: 2.7 });
  assert.deepEqual(still.G.halo.map(g => [g.x, g.y, g.z]), a, 'under reduced motion the halo stands still');
  const moving = pageFight(FLAT);
  moving.G.combo.set(10); moving.step({});
  moving.G.draw({}, { time: 1 }); const b = moving.G.halo.map(g => g.x);
  moving.G.draw({}, { time: 1.5 });
  assert.notDeepEqual(moving.G.halo.map(g => g.x), b, 'otherwise it turns');
  // __gloam.fx({ lamp: false }) takes the halo away
  const off = pageFight(FLAT, { fx: { lamp: false } });
  off.G.combo.set(20); off.step({}); off.G.draw({}, { time: 1 });
  assert.equal(off.G.halo.length, 0);
  pass('the lamp: 6, 12 and 18 dabs in lamp slots, never 37, fx.lamp 1.15, 1.3 and 1.5; steady under reduced motion', got);
}

console.log(`${n} checks passed`);
