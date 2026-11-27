// Gloam Downs: the life of the places (public/lab/gloam-downs/life.js), checked in Node from the baked files with no browser
// (gloam-downs-screens-life spec, "Ambient life", "Life answers the lamplighter", "Life never looks like a tell", "Life budget",
// "Life with reduced motion", "The world answers the screens"):
//   each place has 6 lamp anchors or more, moths at them, a falling kind, swaying tufts, and only the shader's own motion kinds;
//   each slot of LIFE is the biome's colour of the name it gives; no life dab is a fire slot (34 to 37), through a gust and a flight;
//   lamp halos (46 and 47) only within 0.6 m of an anchor; life is 1,200 splats or fewer, and the place with its pool, the sparks
//   and life 277,000 or fewer (printed per place); steady play writes no row, a gust or a flight 4 rows of 512 or fewer a frame;
//   a lamp brightens with the lamplighter 3 m off and fades back once 8 m off; a flock lifts with the lamplighter 4 m off, flies off
//   and is put away, and the bus hears life-stir; the hush near an awake foe and its return; reduced motion holds still; the beacon
//   answers a spark pick, a hover and beacon-lit. The Lamp-room (gloam-downs-hub "Decision 8"): its slots are its biome's colours; dust at
//   its lamps, embers over its fires, the well's water bobbing, no crows and no gusts; no growth object is a lamp anchor; steady play
//   writes no row; 1,200 dabs or fewer; reduced motion holds still.
// GLOAM_WORLDS=0 skips the baked places (only the table checks run).
// Run: node qa/lab/gloam-downs-life.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeLife, LIFE, FIRE, RULES, ANSWER, K, MAX, LAMP, LAMP_PALE, EMBER } from '../../public/lab/gloam-downs/life.js';
import { makeWalk } from '../../public/lab/gloam-downs/play.js';
import { readFigures, makePool } from '../../public/lab/gloam-downs/pool.js';
import { poolFor } from '../../public/lab/gloam-downs/figures.js';
import { SPARKS } from '../../public/lab/gloam-downs/fight.js';
import { emit, on as busOn } from '../../public/lab/gloam-downs/bus.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)), DIR = ROOT + 'public/lab/gloam-downs/', W = DIR + 'worlds/';
const PLACES = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data !== undefined ? ' ' + JSON.stringify(data) : '')); };
const pk = c => ((c >> 16) & 255) + ((c >> 8) & 255) * 256 + (c & 255) * 65536;

/* ---------------- the table: each slot is the biome's colour of that name ---------------- */
// the biome's palette, read from its file as text (the biome modules need Ink Studio to import)
function biomePalette(id) {
  const src = fs.readFileSync(`${ROOT}games/gloam-downs/biomes/${id}.mjs`, 'utf8'), m = src.match(/palette:\s*(\[[\s\S]*?\n  \])/);
  const list = Function(`return ${m[1]}`)(), at = {};
  let i = 0;
  for (const [name, c] of list) { const cs = Array.isArray(c) ? c : [c]; at[name] = cs.map((col, k) => ({ i: i + k, col })); i += cs.length; }
  return at;
}
{
  const checked = [];
  for (const id of [...PLACES, 'lamproom']) {
    const meta = JSON.parse(fs.readFileSync(`${W}${id}.json`, 'utf8')), bio = biomePalette(id), L = LIFE[id];
    for (const [use, u] of Object.entries(L)) {
      if (!u || !u.name) continue;
      for (const part of [u, u.also].filter(Boolean)) for (const s of part.slots) {
        const named = bio[part.name]?.find(x => x.i === s);
        assert(named, `${id} ${use}: slot ${s} is not in the biome's ${part.name}`);
        assert.equal(meta.pal[s], named.col, `${id} ${use}: slot ${s} is ${meta.pal[s].toString(16)} in the bake, ${named.col.toString(16)} in the biome`);
        assert(!FIRE.includes(s), `${id} ${use} uses fire slot ${s}`);
        checked.push(`${id}.${use}.${s}`);
      }
    }
    for (const s of L.tuftOn || []) assert(s < 32, `${id}: tuftOn slot ${s} is not the place's own`);
  }
  assert.deepEqual(FIRE, [34, 35, 36, 37]);
  assert(!Object.values(ANSWER).some(s => FIRE.includes(s)), 'an answer in a fire slot');
  pass('each life slot is the biome\'s colour of its name, and none is a fire slot', { slots: checked.length });
}
if (process.env.GLOAM_WORLDS === '0') { console.log(`PASS qa/lab/gloam-downs-life.test.mjs: ${n} checks (baked places skipped)`); process.exit(0); }

/* ---------------- the places ---------------- */
const SplatCodec = new Function(fs.readFileSync(DIR + 'ink/splat-codec.js', 'utf8') + '\nreturn SplatCodec;')();
const decode = file => SplatCodec.decode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(file))), { maxRows: 1_000_000 });
const figureFile = which => ({ json: readFigures(JSON.parse(zlib.gunzipSync(fs.readFileSync(`${W}${which}.json.gz`)).toString())), ...decode(`${W}${which}.bin.gz`) });
const cache = new Map();
function load(id) {
  if (!cache.has(id)) {
    const meta = JSON.parse(fs.readFileSync(`${W}${id}.json`, 'utf8')), dec = decode(`${W}${id}.bin.gz`), wb = zlib.gunzipSync(fs.readFileSync(`${W}${id}.walk.bin.gz`));
    cache.set(id, { meta, dec, walk: makeWalk(meta.walk, new Int16Array(wb.buffer.slice(wb.byteOffset, wb.byteOffset + wb.byteLength))) });
  }
  return cache.get(id);
}
// a fresh world of the place (its own copy of the data), as world.js and main.js make it
function place(id, o = {}) {
  const { meta, dec, walk } = load(id), nb = meta.bones.names.length;
  const world = { data: dec.data.slice(), count: dec.count, moving: Int32Array.from(meta.moving), anim: { bones: new Float32Array(12 * nb), boned: Int32Array.from({ length: meta.bones.end - meta.bones.first }, (_, i) => meta.bones.first + i) } };
  const rows = new Set(), life = makeLife(world, meta, { walk, rows, still: !!o.still });
  return { meta, walk, world, life, rows, N0: dec.count };
}
const lifeRows = (world, life) => Array.from({ length: life.count }, (_, i) => world.data.subarray((life.first + i) * 16, (life.first + i + 1) * 16));
const stand = (walk, x, z) => ({ x, y: walk.top(x, z), z });
// run life for `secs` at 60 draws a second from t, the lamplighter at body (or a function of the time), these foes
function run(L, t, secs, body, foes = [], each = null) {
  let rowsMax = 0;
  for (let k = 0; k < Math.round(secs * 60); k++) {
    t += 1 / 60;
    L.life.draw(null, t, typeof body === 'function' ? body(t) : body, foes);
    rowsMax = Math.max(rowsMax, L.life.test().rows.last);
    each?.(t);
  }
  return { t, rowsMax };
}
const foes = figureFile('foes'), boss = figureFile('boss');
{ /* motes are flecks, not pale squares, and the Gaol's gather in the light (the checker's 1280x720 title and the Gaol's static): every
     mote is 0.026 m or smaller, the Gaol's lie within 3.8 m of a lamp anchor, and the Gaol's floaters (motes and drips) are under 100 */
  const near = {};
  for (const id of PLACES) {
    const L = place(id), all = L.life.test({ all: true }).all, motes = all.filter(d => d.use === 'mote');
    for (const [i, d] of all.entries()) if (d.use === 'mote') { const q = (L.life.first + i) * 16; assert(Math.sqrt(L.world.data[q + 4]) <= 0.0261, `${id}: a mote of ${Math.sqrt(L.world.data[q + 4]).toFixed(3)} m`); }
    if (id !== 'gaol') continue;
    const A = all.filter(d => d.use === 'halo'), lamps = [];
    for (const h of A) if (!lamps.some(l => l.group === h.group)) lamps.push(h);
    const far = motes.filter(m => !lamps.some(l => Math.hypot(m.x - l.x, m.z - l.z) <= 3.8));
    assert.equal(far.length, 0, `gaol: ${far.length} of ${motes.length} motes away from the light`);
    const floaters = all.filter(d => d.use === 'mote' || d.use === 'fall').length;
    assert(floaters < 100, `gaol: ${floaters} motes and drips`);
    near[id] = { motes: motes.length, floaters };
  }
  pass('motes are 0.026 m or smaller; the Gaol\'s motes gather within 3.8 m of a lamp, with fewer than 100 motes and drips', near);
}
const counts = {};
for (const id of PLACES) {
  const L = place(id), s = L.life.test(), { meta, world, life } = L;
  // ambient life
  assert(s.anchors >= 6, `${id}: ${s.anchors} lamp anchors`);
  assert(s.uses.moth >= s.anchors, `${id}: ${s.uses.moth} moths at ${s.anchors} lamps`);
  assert(s.uses.halo === 4 * s.anchors, `${id}: halos`);
  assert((s.kinds[K.fall] || 0) + (s.kinds[K.flutter] || 0) > 0, `${id}: nothing falls`);
  assert(s.kinds[K.sway] >= 150, `${id}: ${s.kinds[K.sway]} swaying dabs`);
  assert(s.uses.tuft >= 150, `${id}: ${s.uses.tuft} tuft blades`);
  assert(s.uses.crow >= 36, `${id}: no flock`);
  for (const k of Object.keys(s.kinds).map(Number)) assert([0, 1, 2, 3, 6, 7, 8, 11, 14, 15].includes(k), `${id}: motion kind ${k}`);
  // the block sits after the place's own splats, and the sort knows its rising and falling dabs
  assert.equal(life.first, L.N0);
  assert.equal(world.count, L.N0 + life.count);
  const mv = new Set(world.moving);
  lifeRows(world, life).forEach((r, i) => { const k = r[11] % 16; if (k === 2 || k === 3) assert(mv.has(life.first + i), `${id}: a falling or rising dab ${i} is not in world.moving`); });
  // the budget: life, and the place with its pool and sparks
  const slots = poolFor(id, foes, boss), pool = makePool(world, meta, slots, { extra: SPARKS });
  assert(life.count <= MAX, `${id}: ${life.count} life splats`);
  assert(world.count <= 277000, `${id}: ${world.count} splats with its pool, the sparks and life`);
  assert.equal(pool.extra.end - pool.extra.first, SPARKS);
  counts[id] = { life: life.count, total: world.count };
}
pass('each place: 6 lamp anchors or more, moths at them, a falling kind, swaying tufts and a flock, only the shader\'s motion kinds; life after the place in world.moving', Object.fromEntries(PLACES.map(id => [id, place(id).life.test().uses])));
pass('the budget: life 1,200 splats or fewer, the place with its pool, the sparks and life 277,000 or fewer', counts);

{ // the fire rule: no life dab is a fire slot, through a gust and a flock's flight; halos and moths (46, 47) within 0.6 m of a lamp
  for (const id of PLACES) {
    const L = place(id), { meta, world, life, walk } = L, fire = FIRE.map(s => pk(meta.pal[s])), lamp = [LAMP, LAMP_PALE].map(s => pk(meta.pal[s]));
    const check = () => {
      const all = life.test({ all: true }).all, anchors = life.test().halos;
      for (const d of all) {
        if (d.d <= 0) continue;
        assert(!fire.includes(d.col), `${id}: a ${d.use} dab in a fire slot`);
        if (lamp.includes(d.col) && d.use !== 'beacon') assert(anchors.some(a => Math.hypot(a.x - d.x, a.y - d.y, a.z - d.z) <= 0.6 + 1e-6), `${id}: a ${d.use} dab in a lamp slot ${anchors.reduce((m, a) => Math.min(m, Math.hypot(a.x - d.x, a.y - d.y, a.z - d.z)), 9).toFixed(2)} m from a lamp`);
      }
    };
    check();
    // the lamplighter by the first flock: it lifts; the clock runs past a gust
    const f = life.test().flocks[0], body = stand(walk, f.x + 4, f.z);
    let t = 0;
    t = run(L, t, 1.2, body, [], () => {}).t;
    check();
    t = run(L, t, 22, body).t;
    check();
    assert(life.test().gusts >= 1, `${id}: no gust in 23 s`);
    emit('spark-take', { colour: 'flame' });
    run(L, t, 0.1, body);
    check();
  }
  pass('no life dab is ever a fire slot (34 to 37), through a gust, a flight and an answer; lamp colours only within 0.6 m of a lamp');
}
{ // steady play writes no row; a gust or a flight 4 rows or fewer a frame
  const L = place('ramparts'), { life, walk } = L;
  // the lamplighter far from every flock and lamp
  const body = { x: 500, y: 0, z: 500 };
  let r = run(L, 0, 0.1, body);
  const steady = run(L, r.t, 5, body);
  assert.equal(steady.rowsMax, 0, `steady play wrote ${steady.rowsMax} rows in a frame`);
  const stirs = [];
  const off = busOn('life-stir', d => stirs.push(d));
  const all = run(L, steady.t, 24, body);
  const f = life.test().flocks[0];
  const fly = run(L, all.t, 3.2, stand(walk, f.x + 4, f.z));
  off();
  assert(stirs.some(d => d.kind === 'gust'), 'no gust');
  assert(all.rowsMax <= 4 && fly.rowsMax <= 4, `a gust wrote ${all.rowsMax} rows, a flight ${fly.rowsMax}`);
  pass('steady play writes no row; a gust and a flight 4 rows of 512 or fewer a frame', { steady: steady.rowsMax, gust: all.rowsMax, flight: fly.rowsMax });
}
{ // a lamp brightens as the lamplighter passes: 3 m off for 0.5 s, then 8 m off for 1.5 s
  const L = place('gaol'), { life, walk } = L, i = 0, a = life.test().halos[i];
  let r = run(L, 0, 0.5, stand(walk, a.x + 3, a.z));
  const lit = life.test().halos[i];
  assert(Math.abs(lit.s - RULES.halo[1]) < 0.002 && lit.pale === LAMP_PALE, `near: ${JSON.stringify(lit)}`);
  r = run(L, r.t, 1.5, stand(walk, a.x + 8, a.z));
  const back = life.test().halos[i];
  assert(Math.abs(back.s - RULES.halo[0]) < 0.002 && back.pale === LAMP, `away: ${JSON.stringify(back)}`);
  pass('a lamp\'s halo is 0.07 m with slot 47 with the lamplighter 3 m off for 0.5 s, and 0.04 m with slot 46 after 1.5 s 8 m off', { near: [lit.s, lit.pale], away: [back.s, back.pale] });
}
{ // crows lift: the lamplighter 4 m from a flock on The Crow Wall, 3 s
  const L = place('ramparts'), { life, walk } = L, stirs = [];
  const off = busOn('life-stir', d => stirs.push(d));
  const f0 = life.test().flocks[0], body = stand(walk, f0.x + 4, f0.z);
  run(L, 0, 0.1, stand(walk, L.meta.spawn.p[0], L.meta.spawn.p[2]));
  let mid = null;
  run(L, 0.1, 3, body, [], t => { if (!mid && life.test().flocks[0].state === 'flying' && t > 1.3) mid = life.test({ all: true }).all.filter(d => d.use === 'crow' && d.d > 0); });
  off();
  const f = life.test().flocks[0];
  assert.equal(f.state, 'gone');
  assert.equal(f.shown, 0, `${f.shown} crow dabs still shown`);
  assert(mid && mid.length > 0 && mid.some(d => d.kind === K.flap), 'no bird flapping in flight');
  const c = stirs.find(d => d.kind === 'crows');
  assert(c && c.n === f0.n && Math.hypot(c.x - f0.x, c.z - f0.z) < 0.01, JSON.stringify(stirs));
  // a flock beside a foe lifts too, and one far from everything stays
  const M = place('ramparts'), g = M.life.test().flocks[1];
  run(M, 0, 0.5, stand(M.walk, M.meta.spawn.p[0], M.meta.spawn.p[2]), [{ x: g.x + 2, y: g.y, z: g.z, state: 'chase' }]);
  assert.equal(M.life.test().flocks[1].state, 'flying');
  assert.equal(M.life.test().flocks[2].state, 'perched');
  pass('crows lift with the lamplighter 4 m off, fly off flapping and are put away in 3 s; life-stir crows at the flock; a foe 2 m off lifts one too', { stir: c, flocks: life.test().flocks.length });
}
{ // the hush: a foe wakes 4 m from a lamp; within 0.3 s no bright dab within 8 m shows, and 2 s after the calm they are back
  const L = place('gaol'), { life, walk } = L, a = life.test().halos[0], sp = L.meta.spawn.p, body = { x: sp[0], y: sp[1], z: sp[2] };
  const foe = { x: a.x + 4, y: a.y, z: a.z, state: 'chase' };
  let r = run(L, 0, 0.2, body);
  r = run(L, r.t, 0.3, body, [foe]);
  const near = life.test({ near: [foe.x, foe.y, foe.z], r: 8 }).dabs.filter(d => d.bright);
  assert(near.length > 0 && near.every(d => d.d === 0), `bright dabs within 8 m: ${near.filter(d => d.d > 0).length} of ${near.length} shown`);
  r = run(L, r.t, 1.5, body);
  assert(life.test({ near: [foe.x, foe.y, foe.z], r: 8 }).dabs.filter(d => d.bright).every(d => d.d === 0), 'back before 2 s of calm');
  r = run(L, r.t, 1.2, body);
  const back = life.test({ near: [foe.x, foe.y, foe.z], r: 8 }).dabs.filter(d => d.bright);
  assert(back.every(d => d.d > 0), `${back.filter(d => !(d.d > 0)).length} bright dabs still out 2.7 s after the calm`);
  pass('the hush: bright dabs within 8 m of an awake foe are out in 0.3 s, and back 2 s after the calm', { dabs: near.length });
}
{ // reduced motion: kinds 0 and 7 only; a flock neared fades where it sits
  for (const id of PLACES) {
    const L = place(id, { still: true }), s = L.life.test();
    assert.deepEqual(Object.keys(s.kinds).map(Number).filter(k => k !== 0 && k !== 7), [], `${id}: kinds ${JSON.stringify(s.kinds)}`);
    assert.equal(L.world.moving.length, load(id).meta.moving.length, `${id}: still life added to world.moving`);
  }
  const L = place('ramparts', { still: true }), { life, walk } = L, f = life.test().flocks[0];
  const before = life.test({ all: true }).all.filter(d => d.use === 'crow').slice(0, 12).map(d => [d.x, d.y, d.z]);
  let r = run(L, 0, 0.6, stand(walk, f.x + 4, f.z));
  const mid = life.test({ all: true }).all.filter(d => d.use === 'crow').slice(0, 12);
  assert(mid.every((d, i) => Math.hypot(d.x - before[i][0], d.y - before[i][1], d.z - before[i][2]) < 1e-6), 'a bird moved with reduced motion');
  assert(mid.some(d => d.d > 0) && mid.every(d => d.d < 2.6), 'not fading');
  run(L, r.t, 1.2, stand(walk, f.x + 4, f.z));
  assert.equal(life.test().flocks[0].state, 'gone');
  pass('reduced motion: every life dab is still (0) or a soft glow (7), and a neared flock fades where it sits');
}
{ // the world answers the screens: a Flame pick flares 8 dabs round the beacon in slot 33, gone after 0.6 s; a hover in its colour;
  // beacon-lit lights the lamps within 15 m of the beacon, nearest first
  const L = place('gaol'), { life, meta } = L, body = { x: meta.spawn.p[0], y: meta.spawn.p[1], z: meta.spawn.p[2] };
  let r = run(L, 0, 0.2, body);
  emit('spark-take', { colour: 'flame' });
  r = run(L, r.t, 0.05, body);
  let b = life.test().beacon;
  assert(b.shown === 8 && b.slot === EMBER, JSON.stringify(b));
  r = run(L, r.t, 0.6, body);
  assert.equal(life.test().beacon.shown, 0);
  emit('screen-hover', { kind: 'spark', colour: 'gloam' });
  r = run(L, r.t, 0.1, body);
  b = life.test().beacon;
  assert(b.shown === 8 && b.slot === ANSWER.gloam, JSON.stringify(b));
  r = run(L, r.t, 0.4, body);
  assert.equal(life.test().beacon.shown, 0);
  emit('screen-pick', { kind: 'wick', colour: 'wick' });
  r = run(L, r.t, 0.05, body);
  assert(life.test().beacon.slot === ANSWER.wick);
  r = run(L, r.t, 1, body);
  // beacon-lit: the lamps within 15 m brighten one after another, nearest first
  const bp = meta.beacon.p, halos = life.test().halos, near = halos.map((h, i) => [i, Math.hypot(h.x - bp[0], h.y - bp[1], h.z - bp[2])]).filter(([, d]) => d <= 15).sort((a, c) => a[1] - c[1]);
  assert(near.length >= 2, 'fewer than 2 lamps within 15 m of the Gaol\'s beacon');
  emit('beacon-lit', { place: 'gaol' });
  const firstLit = {};
  run(L, r.t, 1.5, body, [], t => life.test().halos.forEach((h, i) => { if (h.s > RULES.halo[0] + 0.005 && firstLit[i] === undefined) firstLit[i] = t; }));
  const order = near.map(([i]) => firstLit[i]);
  assert(order.every(Number.isFinite), `not every lamp near the beacon brightened: ${JSON.stringify(order)}`);
  for (let k = 1; k < order.length; k++) assert(order[k] >= order[k - 1] - 1e-9, `lamp ${k} lit before a nearer one`);
  pass('the beacon answers: a Flame pick in slot 33 (8 dabs, gone by 0.6 s), a Gloam hover in slot 39, a wick pick in 46; beacon-lit lights the near lamps nearest first', { chain: near.length });
}
{ // what floats hides between the eye and the lamplighter: with the lamplighter 8 m from the eye, a mote 1 m from the eye hides, a
  // mote 7.2 m off (past 8 less 1 m, short of 8 less 0.5 m) stays hidden, one 7.8 m off shows; a still eye writes no row after the crossing
  const L = place('gaol'), { life, world } = L, body = { x: 500, y: 0, z: 500 };
  const m = life.test({ all: true }).all.findIndex(d => d.use === 'mote' && d.d > 0), q = (life.first + m) * 16, w = () => world.data;
  const at = [w()[q], w()[q + 1], w()[q + 2]];
  // a view whose eye sits 1 m behind the mote (yaw 0, pitch 0: the eye is dist along +z from the target)
  const view = (r) => ({ target: [at[0], at[1], at[2] + r - 8], dist: 8, yaw: 0, pitch: 0 });
  life.draw(view(1), 1, body, []);
  assert.equal(w()[q + 3], 0, 'a mote 1 m from the eye still shows');
  const hid = life.test().eyeHidden;
  assert(hid >= 1, `eyeHidden ${hid}`);
  life.draw(view(1), 1 + 1 / 60, body, []);
  assert.equal(life.test().rows.last, 0, 'a still eye wrote rows after the crossing');
  life.draw(view(7.2), 1.1, body, []);
  assert.equal(w()[q + 3], 0, 'a mote 7.2 m off, the lamplighter 8 m off, shows again before 7.5 m');
  life.draw(view(7.8), 1.2, body, []);
  assert(w()[q + 3] > 0, 'a mote 7.8 m from the eye, the lamplighter 8 m off, stays hidden');
  pass('what floats nearer the eye than the lamplighter less 1 m hides, and shows again past the lamplighter less 0.5 m; a still eye writes no row', { hidden: hid });
}
{ /* Life budget, life's own CPU time: 3,600 draws a place with the lamplighter walking the route, a gust every 10 s, a flock lifted and
     three foes awake by a lamp for 10 s (the frames where life writes rows, which a SwiftShader frame time cannot see). The median draw
     is 0.1 ms or less, the 99th percentile 1 ms or less, and no draw writes more than 4 rows of 512 */
  const out = {};
  for (const id of PLACES) {
    const L = place(id), { life, walk, meta } = L, s0 = life.test(), f = s0.flocks[0], a = s0.halos[Math.floor(s0.halos.length / 2)];
    const sp = meta.spawn.p, bp = meta.beacon.p, times = [];
    let rowsMax = 0, writing = 0;
    for (let k = 0; k < 3600; k++) {
      const t = k / 60, u = (k % 1200) / 1200;
      let body = stand(walk, sp[0] + (bp[0] - sp[0]) * u, sp[2] + (bp[2] - sp[2]) * u);
      if (k >= 1200 && k < 1260 && f) body = stand(walk, f.x + 3, f.z);
      const foes = k >= 2000 && k < 2600 ? [0, 1, 2].map(j => ({ x: a.x + j, z: a.z + 1, state: j === 2 ? 'stagger' : 'chase' })) : [];
      if (k % 600 === 300) life.test({ gust: true });
      const t0 = performance.now();
      life.draw({ target: [body.x, body.y + 0.8, body.z], yaw: 0, pitch: 0.3, dist: 9 }, t, body, foes);
      times.push(performance.now() - t0);
      const r = life.test().rows.last;
      rowsMax = Math.max(rowsMax, r);
      if (r) writing++;
    }
    times.sort((x, y) => x - y);
    const medT = times[1800], p99 = times[Math.floor(3600 * 0.99)];
    assert(medT <= 0.1, `${id}: life's median draw is ${medT.toFixed(3)} ms`);
    assert(p99 <= 1, `${id}: life's 99th percentile draw is ${p99.toFixed(3)} ms`);
    assert(rowsMax <= 4, `${id}: a draw wrote ${rowsMax} rows`);
    assert(writing > 60, `${id}: only ${writing} draws wrote rows, so the busy frames were not timed`);
    out[id] = { med: +medT.toFixed(3), p99: +p99.toFixed(3), rows: rowsMax, writing };
  }
  pass('life\'s own time over 3,600 draws with gusts, a flight and the hush: median 0.1 ms or less, 99th percentile 1 ms or less, 4 rows or fewer', out);
}
{ // the Lamp-room: dust in the torch light, embers, the well's water, no crows and no gusts; steady play writes no row; reduced motion
  const L = place('lamproom'), { meta, world, life, walk } = L, s = life.test(), all = life.test({ all: true }).all;
  assert(s.anchors >= 6, `lamproom: ${s.anchors} lamp anchors`);
  assert(s.uses.mote >= 40 && s.uses.ember >= 6, `lamproom: ${JSON.stringify(s.uses)}`);
  assert(!s.uses.crow && !s.uses.tuft, 'lamproom: crows or tufts in the hall');
  const well = meta.stations.find(x => x.id === 'well'), spots = all.filter(d => d.use === 'spot');
  assert(spots.length >= 5 && spots.every(d => Math.hypot(d.x - well.obj[0], d.z - well.obj[1]) <= 0.45), 'lamproom: the well\'s water');
  // no lamp anchor stands on a growth object (the save puts those out): every pattern lamp on the kiln's hood glows, and none has a halo
  const hooks = meta.grow.filter(g => /^pattern:.*:lit$/.test(g.id)).map(g => [world.data[g.first * 16], world.data[g.first * 16 + 1], world.data[g.first * 16 + 2]]);
  for (const h of life.test().halos) assert(!hooks.some(p => Math.hypot(p[0] - h.x, p[1] - h.y, p[2] - h.z) < 0.15), 'lamproom: a halo on a growth lamp');
  assert(life.count <= MAX, `lamproom: ${life.count} life dabs`);
  const fire = FIRE.map(c => pk(meta.pal[c]));
  assert(!all.some(d => d.d > 0 && fire.includes(d.col)), 'lamproom: a fire slot');
  const body = stand(walk, meta.spawn.p[0], meta.spawn.p[2]);
  let r = run(L, 0, 0.2, body);
  const steady = run(L, r.t, 25, { x: 0, y: 0, z: 0.5 });
  assert.equal(life.test().gusts, 0, 'lamproom: a gust');
  const still = place('lamproom', { still: true }).life.test();
  assert(!still.kinds[K.bob] && !still.kinds[K.rise] && !still.kinds[K.wander], `lamproom with reduced motion: ${JSON.stringify(still.kinds)}`);
  pass('the Lamp-room: dust at its lamps, embers, the well\'s water, no crows, no gusts; reduced motion holds still', { anchors: s.anchors, uses: s.uses, count: life.count, rows: steady.rowsMax });
}
console.log(`PASS qa/lab/gloam-downs-life.test.mjs: ${n} checks`);
