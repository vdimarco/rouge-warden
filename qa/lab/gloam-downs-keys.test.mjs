// Gloam Downs: the keys and the hidden ground, checked in node with no browser (public/lab/gloam-downs/keys.js and the runner's
// prizes in run.js; openspec/changes/gloam-downs-growth). Each block is a scenario of the change's spec:
//   Keys: the Rookchief's first fall gives Crow step and the Bellwether's Bell drop, saved at once with a toast and key-found, once;
//   Crow step: a second jump in the air from 0.1 s after the take-off, once until the feet land, and 1.1 m more of rise;
//   Hidden ledges: each place's ledges, played on its real walk map from their stand, are reached with Crow step and not without;
//   Sealed stones: a plunge of 2 m or more with Bell drop cracks one; without the key, or from a lower fall, nothing;
//   Caches: each prize (glim with the Ember factor, a spark pick, a pattern lamp, an ability lamp, a flask), once a run;
//   The save: keys and caches kept, and rubbish dropped.
// Run: node qa/lab/gloam-downs-keys.test.mjs
import assert from 'node:assert/strict';
import { makeWalk, makeBody, PARAMS, JUMP } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner, flasksOf, groundPatterns } from '../../public/lab/gloam-downs/run.js';
import { makeKeys, leap, SPOTS, groundSpots, keysLine } from '../../public/lab/gloam-downs/keys.js';
import { makeAbilities, groundAbilities } from '../../public/lab/gloam-downs/abilities.js';
import { tryLedge, tryStone, load } from './gloam-downs-ledges.mjs';
import { LAMP_KEYS } from '../../public/lab/gloam-downs/growth.js';
import { on } from '../../public/lab/gloam-downs/bus.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';

let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
function flat(half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz;
  return makeWalk(info, new Int16Array(2 * N));
}
const FLAT = flat();
const META = { wisps: [], beacon: { p: [90, 0, 90], r: 1.2 } };
function setup({ keys = [], place = 'gaol', spots = null, ember = 0 } = {}) {
  const rs = RS.fresh();
  rs.keys = keys.slice();
  rs.emberTop = ember;
  startRun(rs, 9, ember);
  rs.run.place = place;
  if (spots) SPOTS[place] = spots;
  const body = makeBody(FLAT, { p: [0, 0.5, 0], yaw: 0 }, 20, { ...PARAMS });
  const R = makeRunner({ walk: FLAT, meta: META, body, rs, abilities: makeAbilities, keys: makeKeys });
  return { rs, R, s: body.s, body };
}
const steps = (R, k, inp = {}) => { const all = []; for (let i = 0; i < k; i++) all.push(...R.step(typeof inp === 'function' ? inp(i) : inp, 0)); return all; };
const SAVED = JSON.parse(JSON.stringify(SPOTS));

/* ---------------- Keys ---------------- */
{
  const got = []; const off = on('key-found', d => got.push(d.id));
  const { R, rs } = setup();
  assert.equal(R.keys.eliteOut('gaol', []), null, 'the Wardmother holds no key');
  const ev = [];
  assert.equal(R.keys.eliteOut('ramparts', ev), 'leap');
  assert(ev.some(e => e.type === 'store'), 'saved at once');
  assert.deepEqual(rs.keys, ['leap']);
  assert(R.notes.some(t => /A key: <b>Crow step<\/b>\. Jump again in the air\./.test(t)));
  assert.equal(R.keys.eliteOut('ramparts', []), null, 'once');
  assert.equal(R.keys.eliteOut('bells', []), 'drop');
  off();
  assert.deepEqual(got, ['leap', 'drop']);
  assert.equal(keysLine(rs), 'Keys: Crow step · Bell drop');
  assert.match(keysLine(RS.fresh()), /none yet/);
  pass('keys: the Rookchief gives Crow step and the Bellwether Bell drop, each once, saved at once, with a toast and key-found');
}

/* ---------------- Crow step ---------------- */
{ // the rule: in the air, from 0.1 s, on a fresh press, once until the feet land
  const s = { ground: false, airTime: 0.05, vy: 2, events: [] }, st = { used: false, was: false };
  assert(!leap(s, st, true), 'not before 0.1 s');
  leap(s, st, false);
  s.airTime = 0.2;
  assert(leap(s, st, true) && s.vy === LAMP_KEYS[0].v);
  leap(s, st, false);
  assert(!leap(s, st, true), 'once');
  s.ground = true; leap(s, st, false); s.ground = false;
  assert(leap(s, st, true), 'again after the feet land');
  // the controller: a held jump, then the second at its top: the feet rise about 1.14 m more than one jump
  const top = second => {
    const body = makeBody(FLAT, { p: [0, 0.5, 0], yaw: 0 }, 20, { ...PARAMS }), b = body.s, k = { used: false, was: false };
    let hi = 0;
    for (let i = 0; i < 120; i++) {
      const t = i / 60, jump = t < 0.33 || (second && t >= 0.35 && t < 0.9);
      body.step(1 / 60, { jump }, 0);
      if (second) leap(b, k, jump);
      hi = Math.max(hi, b.y);
    }
    return hi;
  };
  const one = top(false), two = top(true);
  assert(Math.abs(one - JUMP) < 0.06 && two - one > 1.0 && two - one < 1.25, `one ${one}, two ${two}`);
  // in a run, with the key, a fresh press in the air jumps again; without it, nothing
  for (const keys of [['leap'], []]) {
    const { R, s: b } = setup({ keys });
    let hi = 0;
    steps(R, 120, i => { hi = Math.max(hi, b.y); return { jump: i < 20 || (i >= 21 && i < 60) }; });
    assert(keys.length ? hi > 2 : hi < 1.5, `${keys}: ${hi}`);
  }
  pass('Crow step: a second jump in the air from 0.1 s, once until the feet land; the feet rise 1.1 m more', { one: +one.toFixed(2), two: +two.toFixed(2) });
}

/* ---------------- Hidden ledges and sealed stones on the real places ---------------- */
{
  const out = {};
  for (const [id, list] of Object.entries(SAVED)) {
    const { meta, walk } = load(id);
    // two ledges a place where the scan found two that its way opens from the rounded numbers; Barrow Crown has one (design.md)
    assert(list.filter(s => s.kind === 'ledge').length >= (id === 'barrows' ? 1 : 2) && list.some(s => s.kind === 'stone'), `${id}: its ledges and a stone`);
    for (const sp of list) {
      if (sp.kind === 'ledge') {
        assert(tryLedge(walk, meta.bounds, sp.from, sp.at, sp.way, true).ok, `${id} ${sp.id}: reached with Crow step`);
        assert(!tryLedge(walk, meta.bounds, sp.from, sp.at, sp.way, false).ok, `${id} ${sp.id}: not without it`);
      } else {
        const r = tryStone(walk, meta.bounds, sp.from, sp.at, sp.way, false);
        assert(r && r.fallen >= 2 && Math.hypot(r.at[0] - sp.at[0], r.at[2] - sp.at[2]) < 0.3, `${id} ${sp.id}: a plunge from its stand falls ${r?.fallen} onto it`);
      }
    }
    out[id] = list.map(s => s.id.split('-')[1]).join(' ');
  }
  pass('hidden ground: every ledge is reached from its stand with Crow step and not without, and every stone takes a plunge of 2 m or more', out);
}
{ // the stone rule in a run: a plunge from a second jump's top (2 m or more) with Bell drop cracks the stone under it; without Bell
  // drop, or from one jump's top (1.4 m), nothing
  const plunge = (keys, second) => {
    const { R, rs, s } = setup({ keys, place: 'gaol', spots: [{ id: 'gaol-test', kind: 'stone', at: [0, 0, 0], from: [0, 0, 0], prize: 'glim', n: 20 }] });
    rs.run.carried = 0;
    steps(R, 150, i => ({ jump: i < 20 || (second && i >= 22 && i < 50), attack: i === 40 }));
    return rs.run.caches.includes('gaol-test') ? rs.run.carried : 0;
  };
  assert.equal(plunge(['leap', 'drop'], true), 20);
  assert.equal(plunge(['leap'], true), 0, 'no Bell drop');
  assert.equal(plunge(['leap', 'drop'], false), 0, 'one jump is not 2 m');
  pass('sealed stones: a plunge of 2 m with Bell drop cracks the stone; without the key or from a lower fall, nothing');
}

/* ---------------- Caches ---------------- */
{
  const at = [0, 0, 0.3];
  const open = (prize, o = {}) => {
    const { R, rs } = setup({ keys: ['leap'], place: 'fen', spots: [{ id: 'fen-test', kind: 'ledge', at, from: at, prize, n: 30 }], ember: o.ember ?? 0 });
    if (o.flasks !== undefined) rs.run.flasks = o.flasks;
    const ev = steps(R, 3);
    return { R, rs, ev };
  };
  const g = open('glim', { ember: 2 });
  assert.equal(g.rs.run.carried, Math.floor(30 * 1.3));
  assert(g.ev.some(e => e.type === 'cache' && e.spot === 'fen-test'));
  steps(g.R, 10);
  assert.equal(g.rs.run.carried, 39, 'once a run');
  const sp = open('spark');
  assert.deepEqual([sp.rs.run.sparkPicks, sp.rs.run.sparkNow], [1, true]);
  const pt = open('pattern');
  assert.equal(groundPatterns(pt.R).length + pt.rs.run.carriedPatterns.length, 1);
  const ab = open('ability');
  assert(groundAbilities(ab.R).length + ab.rs.run.abilities.filter(Boolean).length >= 2);
  const fl = open('flask', { flasks: 0 });
  assert.equal(fl.rs.run.flasks, 1);
  const full = open('flask');
  assert.equal(full.rs.run.flasks, flasksOf(full.rs));
  assert.equal(full.rs.run.carried, 30, 'flasks full: the glim instead');
  assert.equal(groundSpots(full.R).length, 0, 'an opened cache is not drawn again');
  pass('caches: glim with the Ember factor, a spark pick at once, a pattern lamp, an ability lamp, a flask (or its glim when full), once a run');
}

/* ---------------- The save ---------------- */
{
  const { rs } = setup({ keys: ['leap', 'drop'] });
  rs.run.caches = ['gaol-ledge1'];
  const back = RS.clean(JSON.parse(JSON.stringify(rs)));
  assert.deepEqual([back.keys, back.run.caches], [['leap', 'drop'], ['gaol-ledge1']]);
  const bad = RS.clean({ keys: ['leap', 'fly', 3, 'leap'], run: { place: 'gaol', caches: ['ok-1', 'Not ok!', 7] } });
  assert.deepEqual([bad.keys, bad.run.caches], [['leap'], ['ok-1']]);
  pass('the save: keys and caches kept, unknown keys and bad cache ids dropped');
}
Object.assign(SPOTS, SAVED);
console.log(`${n} checks passed`);
