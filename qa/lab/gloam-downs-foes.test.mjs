// Gloam Downs, the combat run's figures and zones, checked in node with no browser:
//   the foe files and the boss files (sizes, the splat counts against their targets, each figure's range, bones and pivots, every splat
//   on a bone, the Reeve's cloak weights in eighths, the markers' sizes and colours, the tells' and lights' colours), the clips (the
//   ones each figure needs, their lengths, their keys, a tell that grows over its wind-up), the pose (the feet where the body is put,
//   the facing, the hidden-bone rule), the pool in a place (bone ids after the lamplighter's, every slot parked at density 0 and off
//   the bones, a slot on the bones before its density comes back and off them after it goes, the hit flash and its colour back, the
//   candles moved as groups, each place with its pool under 275,000 splats), the zones (qa/lab/gloam-downs-zones.mjs on the baked walk
//   maps, and the slot and guard cases of the spec), the colour rule of lib/check.mjs in all five palettes, and the bake of the Gaol
//   with and without its zones (qa/lab/gloam-downs-bake-zones.mjs).
// Run: node qa/lab/gloam-downs-foes.test.mjs     (GLOAM_BAKE=0 skips the bake of the Gaol, about 20 s)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readFigures, makePool, poseFigure, sampleKey, PUT_AWAY } from '../../public/lab/gloam-downs/pool.js';
import { poolFor, LINEUP } from '../../public/lab/gloam-downs/figures.js';
import { ZONES, POOLS, zoneJson, poolTypes } from '../../games/gloam-downs/lib/zones.mjs';
import { survey, fits, makeRoom, walkRoute } from './gloam-downs-zones.mjs';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url)), W = DIR + 'worlds/';
const SplatCodec = new Function(fs.readFileSync(DIR + 'ink/splat-codec.js', 'utf8') + '\nreturn SplatCodec;')();
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;
const decode = file => SplatCodec.decode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(file))), { maxRows: 1_000_000 });
function figureFile(which) {
  const json = readFigures(JSON.parse(zlib.gunzipSync(fs.readFileSync(`${W}${which}.json.gz`)).toString()));
  return { json, ...decode(`${W}${which}.bin.gz`) };
}
const PLACES = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
const rgb = v => ((v & 255) << 16) | (((v >> 8) & 255) << 8) | ((v >> 16) & 255); // the renderer's packing: r in the low byte
const FIRE = [0x3a0f0c, 0x8a2814, 0xd2551c, 0xff9a32, 0xffd77a, 0xfff4cc], WISP = [0x2a6e6a, 0x8cf0cc, 0xeefff6];

/* ---------------- the files ---------------- */
const foes = figureFile('foes'), boss = figureFile('boss');
{
  const size = which => fs.statSync(`${W}${which}.bin.gz`).size + fs.statSync(`${W}${which}.json.gz`).size;
  assert.equal(foes.json.format, 'gloam-downs-foes/1');
  assert.equal(boss.json.format, 'gloam-downs-boss/1');
  assert.equal(foes.count, foes.json.count);
  assert.equal(boss.count, boss.json.count);
  assert(size('foes') <= 200 * 1024, `the foe files are ${size('foes')} bytes, over 200 KB`);
  assert(size('boss') <= 140 * 1024, `the boss files are ${size('boss')} bytes, over 140 KB`);
  assert.deepEqual(foes.json.pools, POOLS, 'foes.json.gz holds the pools of lib/zones.mjs');
  pass('the foe files and the boss files, within 200 KB and 140 KB', { foes: size('foes'), boss: size('boss') });
}

/* ---------------- figures, bones and splats ---------------- */
const SIX = p => [1, 2, 3, 4, 5, 6].map(i => `${p}${i}`);
const EIGHT = ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'shadow', 'tell'];
const BONES = {
  S: EIGHT,
  P: [...EIGHT, 'coal', ...SIX('ring')],
  M: ['body', 'core', 'tails', 'shadow', ...SIX('ring')],
  I: [...EIGHT, 'lane1', 'lane2', 'lane3', 'lane4', 'lane5', ...SIX('ring')],
  L: ['light'],
  B: ['body', 'cloak', 'head', 'cage', 'light', 'armL', 'handL', 'armR', 'crook', 'crookTip', 'legL', 'legR', 'shadow',
    ...SIX('ring'), ...SIX('lane'), 'shard1', 'shard2', 'shard3', ...[1, 2, 3].flatMap(r => SIX(`shardRing${r}_`))]
};
const TARGET = { S: 3300, P: 3700, M: 1300, I: 4600, L: 60, B: 12600 };
const TELL = { S: 'tell', P: 'tell', M: 'core', I: 'tell', B: 'crookTip' };
const figure = code => (code === 'B' || code === 'C' ? boss : foes);
for (const [code, names] of Object.entries(BONES)) {
  const F = figure(code), T = F.json.types[code], d = F.data;
  assert.deepEqual(T.bones.map(b => b.name), names, `${code}: its bones`);
  const count = T.end - T.first;
  assert(count > 0 && count <= TARGET[code] * 1.1, `${T.title}: ${count} splats, more than 10% over its target of ${TARGET[code]}`);
  assert(T.bones.every(b => b.pivot.length === 3 && b.pivot.every(Number.isFinite)), `${code}: pivots`);
  assert(T.bones.filter(b => b.parent === 'ground').every(b => b.name === 'shadow' || b.hidden), `${code}: markers are hidden until laid`);
  if (TELL[code]) assert(T.bones[T.index[TELL[code]]].hidden, `${code}: the tell is hidden unless a clip shows it`);
  const per = new Array(names.length).fill(0), weights = new Set();
  for (let i = T.first; i < T.end; i++) {
    const o = i * 16, kind = d[o + 11] % 16;
    assert(kind === 12, `${code}: splat ${i} rides no bone (kind ${kind})`);
    assert(d[o + 12] >= 0 && d[o + 12] < names.length, `${code}: splat ${i} on bone ${d[o + 12]}`);
    per[d[o + 12]]++;
    if (d[o + 14] > 0) { weights.add(d[o + 14]); assert(d[o + 13] < names.length, `${code}: second bone`); }
  }
  assert(per.every(c => c > 0), `${code}: every bone carries splats (${per})`);
  if (code === 'B') {
    assert(weights.size > 1 && [...weights].every(w => near(w * 8, Math.round(w * 8), 1e-6) && w > 0 && w <= 1), `the Reeve's cloak weights are in steps of 1/8 (${[...weights]})`);
    for (let i = T.first; i < T.end; i++) if (d[i * 16 + 14] > 0) assert.equal(T.bones[d[i * 16 + 12]].name, 'cloak', 'only the cloak shares a second bone');
  } else assert.equal(weights.size, 0, `${code}: no second bone`);
  pass(`${T.title}: ${count} splats on ${names.length} bones, every splat on a bone`);
}
{
  const ranges = Object.values(foes.json.types).map(T => [T.first, T.end]).sort((a, b) => a[0] - b[0]);
  assert.equal(ranges[0][0], 0);
  for (let i = 1; i < ranges.length; i++) assert.equal(ranges[i][0], ranges[i - 1][1], 'the foe ranges follow each other');
  assert.equal(ranges.at(-1)[1], foes.count);
  const C = boss.json.types.C;
  assert.equal(C.bones.length, 0);
  assert.equal(C.groups.length, 12, 'twelve grave candles');
  assert.equal(C.end, boss.count, 'the candles end the boss file');
  for (const [a, b] of C.groups) {
    let flame = 0;
    for (let i = a; i < b; i++) { const o = i * 16, c = rgb(boss.data[o + 7]); assert.notEqual(boss.data[o + 11] % 16, 12, 'a candle rides no bone'); if (FIRE.includes(c)) flame++; }
    assert.equal(flame, 5, 'each candle has a flame of 5 splats');
  }
  pass('the figure ranges, and the twelve grave candles of 5 flame splats each');
}

/* ---------------- markers: sizes and colours ---------------- */
{
  const spread = (code, names) => {
    const F = figure(code), T = F.json.types[code], d = F.data, want = new Set(names.map(nm => T.index[nm]));
    let r = 0, zmin = Infinity, zmax = -Infinity, xmax = 0;
    const cols = new Set();
    for (let i = T.first; i < T.end; i++) {
      const o = i * 16;
      if (!want.has(d[o + 12])) continue;
      const x = d[o] - T.feet[0], z = d[o + 2] - T.feet[2];
      r = Math.max(r, Math.hypot(x, z)); zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); xmax = Math.max(xmax, Math.abs(x));
      cols.add(rgb(d[o + 7]));
      assert(near(d[o + 1], T.feet[1], 0.001), `${code} ${names[0]}: a marker lies flat at the feet`);
    }
    for (const c of cols) assert(c === FIRE[2] || c === FIRE[3], `${code} ${names[0]}: marker colour ${c.toString(16)} is not fire slot 34 or 35`);
    return { r, zmin, zmax, xmax };
  };
  const ring = (code, names, R) => { const s = spread(code, names); assert(near(s.r, R, 0.08), `${code}: a ring of ${R} m (${s.r.toFixed(2)})`); };
  ring('P', SIX('ring'), 1.4);
  ring('M', SIX('ring'), 2.2);
  ring('I', SIX('ring'), 3.0);
  ring('B', SIX('ring'), 3.4);
  for (const r of [1, 2, 3]) ring('B', SIX(`shardRing${r}_`), 1.3);
  const laneOf = (code, names, piece, width) => {
    names.forEach((nm, i) => { const s = spread(code, [nm]); assert(s.zmin >= i * piece - 0.01 && s.zmax <= (i + 1) * piece + 0.01, `${code} ${nm}: a piece of ${piece} m`); });
    const s = spread(code, names);
    assert(near(s.zmax, names.length * piece, 0.06) && near(s.xmax, width / 2, 0.06), `${code}: a lane ${width} m wide and ${names.length * piece} m long`);
  };
  laneOf('I', ['lane1', 'lane2', 'lane3', 'lane4', 'lane5'], 1.4, 1.6);
  laneOf('B', SIX('lane'), 1.5, 1.6);
  pass('the markers: rings of 1.4, 2.2, 3.0, 3.4 and 1.3 m in six slices, lanes of 7 m and 9 m in pieces of 1.5 m or less, in fire slots 34 and 35');
}
{
  // the tells are fire; the Mirelight's flame, the caged light and the carried light are wisp slots 38 and 39; nothing is slot 40
  const colours = (code, bone) => {
    const F = figure(code), T = F.json.types[code], b = T.index[bone], out = new Set();
    for (let i = T.first; i < T.end; i++) if (bone === undefined || F.data[i * 16 + 12] === b) out.add(rgb(F.data[i * 16 + 7]));
    return [...out];
  };
  for (const [code, bone] of Object.entries(TELL)) for (const c of colours(code, bone)) assert(FIRE.slice(2, 6).includes(c), `${code}: its tell colour ${c.toString(16)}`);
  for (const [code, bone] of [['B', 'light'], ['L', 'light']]) for (const c of colours(code, bone)) assert(WISP.slice(0, 2).includes(c), `${code}: the light ${c.toString(16)}`);
  for (const c of colours('M', 'body')) assert(WISP.slice(0, 2).includes(c) || FIRE.includes(c) || (c >> 16) < 0x30, `the Mirelight's flame ${c.toString(16)}`);
  for (const code of ['S', 'P', 'M', 'I', 'L', 'B', 'C']) assert(!colours(code).includes(WISP[2]), `${code} uses wisp slot 40`);
  pass('the tells are fire, the lights wisp slots 38 and 39, and no figure uses slot 40');
}

/* ---------------- clips ---------------- */
const CLIPS = {
  S: { rest: 0, walk: 0, 'hook.windup': 0.55, 'hook.attack': 0.15, 'hook.recover': 0.7, hurt: 0.4, down: 0.6, rise: 0.9 },
  P: { rest: 0, walk: 0, 'lob.windup': 0.8, 'lob.attack': 0.15, 'lob.recover': 0.4, hurt: 0.4, down: 0.6, rise: 0.9 },
  M: { rest: 0, walk: 0, 'pulse.windup': 0.7, 'pulse.attack': 0.15, 'pulse.recover': 0.6, hurt: 0.4, down: 0.6, rise: 0.9 },
  I: { rest: 0, walk: 0, 'charge.windup': 0.9, 'charge.attack': 0, 'charge.recover': 1.4, 'slam.windup': 0.75, 'slam.attack': 0.12, 'slam.recover': 1.1, stun: 2.0, rise: 0.9 },
  L: { rest: 0 },
  B: { rest: 0, walk: 0, 'sweep.windup': 0.8, 'sweep.attack': 0.2, 'sweep.recover': 1.0, 'dsweep.windup': 0.6, 'dsweep.attack': 0.2, 'dsweep.recover': 1.2, 'slam.windup': 1.0, 'slam.attack': 0.15, 'slam.recover': 1.5, 'shards.windup': 0.9, 'shards.attack': 0.2, 'shards.recover': 0.8, 'lunge.windup': 0.7, 'lunge.attack': 0.69, 'lunge.recover': 1.0, stumble: 2.0, intro: 2.4, fall: 0.6 }
};
const LOOPS = { rest: 1, walk: 1, 'charge.attack': 1 };
for (const [code, want] of Object.entries(CLIPS)) {
  const T = figure(code).json.types[code];
  for (const [name, dur] of Object.entries(want)) {
    const c = T.clips[name];
    assert(c, `${code}: no clip ${name}`);
    assert.equal(!!c.loop, !!LOOPS[name], `${code} ${name}: loops`);
    if (dur) assert(near(c.dur, dur, 1e-9), `${code} ${name}: ${c.dur} s, the design's ${dur} s`);
    assert(c.at[0] === 0 && c.at.at(-1) === 1 && c.at.every((u, i) => i === 0 || u > c.at[i - 1]), `${code} ${name}: keys from 0 to 1`);
    for (const [bone, rows] of Object.entries(c.keys)) {
      assert(T.index[bone] !== undefined && T.bones[T.index[bone]].parent !== 'ground', `${code} ${name}: keys bone ${bone}`);
      assert(rows.length === c.at.length && rows.every(r => r.length === 9 && r.every(Number.isFinite)), `${code} ${name} ${bone}: one row of 9 a key`);
    }
  }
  // the tell grows from nothing over each wind-up, and is gone at rest
  const tell = TELL[code];
  if (tell) {
    const k = new Float32Array(9);
    // the Reeve's hook glows in the sweep and the lunge; its slam and its shards are told by the cage (lifted, pulsing)
    const told = code === 'B' ? ['sweep.windup', 'lunge.windup'] : Object.keys(want).filter(nm => nm.endsWith('.windup'));
    for (const name of told) {
      const c = T.clips[name];
      assert(c.keys[tell], `${code} ${name}: keys its tell`);
      sampleKey(k, c, tell, 0);
      assert(k[3] < 0.05, `${code} ${name}: the tell starts from nothing (${k[3]})`);
      sampleKey(k, c, tell, c.dur);
      assert(k[3] > 0.95, `${code} ${name}: the tell is full at the end of the wind-up (${k[3]})`);
    }
    assert(!T.clips.rest.keys[tell], `${code}: no tell at rest`);
    if (code === 'B') for (const name of ['slam.windup', 'shards.windup']) assert(T.clips[name].keys.cage && T.clips[name].keys.light, `the Reeve's ${name}: the cage and its light move`);
  }
  pass(`${T.title}: its clips and their lengths`, Object.keys(T.clips).length);
}
{
  // a loop's key at its end is its key at its start, and between keys the blend is smooth
  const c = foes.json.types.S.clips.walk, a = new Float32Array(9), b = new Float32Array(9);
  sampleKey(a, c, 'legL', 0); sampleKey(b, c, 'legL', c.dur * 3);
  assert(a.every((v, i) => near(v, b[i], 1e-6)), 'a loop wraps');
  sampleKey(a, c, 'legL', c.dur * 0.3); sampleKey(b, c, 'legL', c.dur * 0.3001);
  assert(near(a[0], b[0], 1e-3), 'a clip is smooth');
  pass('clips loop and blend smoothly');
}

/* ---------------- the pose ---------------- */
{
  const T = foes.json.types.S, out = new Float32Array(12 * T.bones.length), at = { x: 3, y: 1.5, z: -2, yaw: 0.7 };
  poseFigure(out, 0, T, at, null);
  const apply = (b, p) => [0, 1, 2].map(r => out[12 * b + r * 3] * p[0] + out[12 * b + r * 3 + 1] * p[1] + out[12 * b + r * 3 + 2] * p[2] + out[12 * b + 9 + r]);
  const feet = apply(0, T.feet), ahead = apply(0, [T.feet[0], T.feet[1], T.feet[2] + 1]);
  assert(near(feet[0], at.x, 1e-5) && near(feet[1], at.y, 1e-5) && near(feet[2], at.z, 1e-5), 'the feet stand where the body is put');
  assert(near(ahead[0] - at.x, Math.sin(at.yaw), 1e-5) && near(ahead[2] - at.z, Math.cos(at.yaw), 1e-5), 'yaw 0 faces +z, as sculpted');
  const tb = T.index.tell;
  assert(out.slice(12 * tb, 12 * tb + 9).every(v => v === 0) && out[12 * tb + 10] === -500, 'a hidden bone: scale 0, moved to y -500');
  // the tell rides the pole: at the end of the wind-up it is where the pole's cup is, over the head
  poseFigure(out, 0, T, at, 'hook.windup', 0.55);
  const cup = apply(tb, T.bones[tb].pivot), head = apply(T.index.head, T.bones[T.index.head].pivot);
  assert(cup[1] > head[1], `the cup is over the head at the end of the wind-up (${cup[1].toFixed(2)} over ${head[1].toFixed(2)})`);
  pass('the pose: the feet, the facing, the hidden-bone rule, and a child bone that follows its parent');
}

/* ---------------- the pool in a place ---------------- */
function place(id) {
  const meta = JSON.parse(fs.readFileSync(`${W}${id}.json`, 'utf8')), dec = decode(`${W}${id}.bin.gz`);
  const nb = meta.bones.names.length;
  return { meta, world: { data: dec.data, count: dec.count, anim: { bones: new Float32Array(12 * nb), boned: Int32Array.from({ length: meta.bones.end - meta.bones.first }, (_, i) => meta.bones.first + i) } } };
}
{
  const { meta, world } = place('gaol'), placeCount = world.count, lamp = meta.bones.end - meta.bones.first;
  const slots = poolFor('gaol', foes, boss);
  assert.equal(slots.map(s => s.code).join(''), 'SSSSS');
  const pool = makePool(world, meta, slots), T = foes.json.types.S, d = world.data;
  pool.slots.forEach((s, i) => {
    assert.equal(s.base, meta.bones.names.length + i * T.bones.length, 'bone ids after the lamplighter\'s');
    assert.equal(s.first, placeCount + i * (T.end - T.first));
    for (let k = s.first; k < s.end; k++) {
      assert.equal(d[k * 16 + 3], 0, 'a slot starts at density 0');
      assert(d[k * 16 + 12] >= s.base && d[k * 16 + 12] < s.base + T.bones.length, 'its splats ride its own bones');
    }
  });
  assert.equal(world.anim.boned.length, lamp, 'only the lamplighter rides the bones');
  assert(world.data.subarray(0, placeCount * 16).every((v, i) => true) && world.count === placeCount + 5 * (T.end - T.first));
  // a slot joins the bones before its density comes back, and leaves them after its density goes to 0
  const s = pool.slots[2], seen = [];
  let boned = world.anim.boned;
  Object.defineProperty(world.anim, 'boned', { get: () => boned, set: v => { seen.push({ len: v.length, dense: d[s.first * 16 + 3] > 0 }); boned = v; }, configurable: true });
  pool.wake(s, { x: 1, y: -2.2, z: 1, yaw: Math.PI }, 'rest', 0);
  assert.deepEqual(seen.at(-1), { len: lamp + (T.end - T.first), dense: false }, 'on the bones first, still at density 0');
  for (let k = s.first; k < s.end; k++) assert.equal(d[k * 16 + 3], foes.data[(k - s.first + T.first) * 16 + 3], 'its density back');
  assert(pool.rows.size >= 6 && [...pool.rows].every(r => r >= s.first >> 9 && r <= (s.end - 1) >> 9), 'only its rows to upload');
  assert(world.anim.boned.includes(s.first) && world.anim.boned.includes(s.end - 1));
  // the hit flash: fire step 5 on the figure, the shadow keeps its colour; then its own colour back
  pool.rows.clear();
  pool.flash(s, true);
  const sh = T.index.shadow;
  for (let k = s.first; k < s.end; k++) {
    const o = k * 16, own = foes.data[(k - s.first + T.first) * 16 + 7];
    assert.equal(rgb(d[o + 7]), d[o + 12] - s.base === sh ? rgb(own) : 0xfff4cc);
  }
  assert(pool.rows.size > 0);
  pool.flash(s, false);
  for (let k = s.first; k < s.end; k++) assert.equal(d[k * 16 + 7], foes.data[(k - s.first + T.first) * 16 + 7], 'its colour back');
  seen.length = 0;
  pool.park(s);
  assert.deepEqual(seen.at(-1), { len: lamp, dense: false }, 'off the bones after its density is 0');
  for (let k = s.first; k < s.end; k++) assert.equal(d[k * 16 + 3], 0);
  for (let b = 0; b < T.bones.length; b++) assert.equal(pool.bones[12 * (s.base + b) + 10], -500, 'a parked slot\'s bones are put away');
  pass('the pool: bone ids after the lamplighter\'s, parked slots at density 0 and off the bones, wake and park in order, the hit flash');
}
{
  // every place with its pool, the boss and candles at Barrow Crown, and the lineup pool
  for (const id of PLACES) {
    const { meta, world } = place(id), slots = poolFor(id, foes, boss), pool = makePool(world, meta, slots);
    assert.equal(slots.map(s => s.code).join(''), POOLS[id]);
    assert(world.count <= 275000, `${id}: ${world.count} splats with its pool`);
    if (id === 'barrows') {
      const C = pool.slots.find(s => s.code === 'C'), B = pool.slots.find(s => s.code === 'B');
      assert.equal(B.type.bones.length, 46);
      pool.wake(C, { x: 18, y: 0.68, z: -22, yaw: 0 }, null);
      assert(!world.anim.boned.includes(C.first), 'the candles ride no bone');
      const pts = C.type.groups.map((g, k) => [18 + 7 * Math.sin(k), 1, -22 + 7 * Math.cos(k)]);
      pool.placeGroups(C, pts);
      C.type.groups.forEach(([a, , x, y, z], k) => {
        const o = (a - C.type.first + C.first) * 16, so = a * 16;
        assert(near(world.data[o] - pts[k][0], boss.data[so] - x, 1e-4) && near(world.data[o + 1] - pts[k][1], boss.data[so + 1] - y, 1e-4), 'a candle stands at its point');
        assert.equal(world.data[o + 12], boss.data[so + 12], 'a candle keeps its flicker');
      });
    }
  }
  const { meta, world } = place('gaol'), pool = makePool(world, meta, poolFor('gaol', foes, boss, LINEUP));
  assert.equal(pool.slots.map(s => s.code).join(''), LINEUP);
  pass('each place with its pool under 275,000 splats; the Reeve on 46 bones; the candles placed as groups; the lineup pool');
}

/* ---------------- the zones ---------------- */
{
  for (const id of PLACES) assert.deepEqual(JSON.parse(fs.readFileSync(`${W}${id}.json`, 'utf8')).zones, ZONES[id].map(zoneJson), `${id}: the baked zones are lib/zones.mjs`);
  const res = survey();
  const bad = res.filter(r => !r.ok);
  assert(!bad.length, bad.map(r => r.what).join('\n'));
  const d = (id, zone) => res.find(r => r.place === id && r.zone === zone).d;
  assert(near(d('ramparts', 'R4'), 14.0, 0.15) && near(d('fen', 'F4'), 9.2, 0.15) && near(d('barrows', 'arena'), 14.9, 0.15), 'the guard zones\' distances to their beacons');
  pass('the zones on the baked walk maps: the table, reach, the routes, every guard, the Ironback walls, the distances', { checks: res.length });
  const Z = (id, zid) => ZONES[id].find(z => z.id === zid);
  // B3 waits while B2's Mirelight holds the pool's one Mirelight slot
  assert(!fits(Z('bells', 'B3'), [Z('bells', 'B2')], poolTypes('bells')) && fits(Z('bells', 'B3'), [], poolTypes('bells')), 'B3 waits for a free slot');
  // R4 takes the slot of R3's Pitchrook
  const room = makeRoom(Z('ramparts', 'R4'), [Z('ramparts', 'R3')], poolTypes('ramparts'), -14, -11.5);
  assert(room && room.gone.map(z => z.id).join() === 'R3' && !fits(Z('ramparts', 'R4'), [Z('ramparts', 'R3')], poolTypes('ramparts')), 'R3 gives up its slot to R4');
  // a zone that does not help keeps its slots: R2's Snuffers stay when R4 needs only the Pitchrook
  const room2 = makeRoom(Z('ramparts', 'R4'), [Z('ramparts', 'R2'), Z('ramparts', 'R3')], poolTypes('ramparts'), -14, -11.5);
  assert.deepEqual(room2.gone.map(z => z.id), ['R3'], 'only a zone whose slots help gives them up');
  assert(walkRoute('ramparts', 'runner').gaveUp.includes('R3'));
  pass('the slot cases: B3 waits for B2\'s Mirelight slot, R3 gives its Pitchrook slot to R4 and R2 keeps its own');
}

/* ---------------- the colour rule and the budgets of lib/check.mjs, and the bake with and without zones ---------------- */
let check = null;
try { check = await import('../../games/gloam-downs/lib/check.mjs'); } catch (err) { console.log(`SKIP the colour rule and the bake: ${err.message.split('\n')[0]} (npm ci --prefix games/gloam-downs)`); }
if (check) {
  const types = Object.fromEntries(Object.entries(foes.json.types).map(([k, T]) => [k, T]));
  const res = [...check.fileChecks(W), ...check.colourChecks(foes.data, types, W), ...check.colourChecks(boss.data, boss.json.types, W), ...check.placeChecks(W)];
  const bad = res.filter(r => !r.ok);
  assert(!bad.length, bad.map(r => r.what).join('\n'));
  pass('lib/check.mjs: the figure files\' sizes, every figure colour in all five palettes, each place with its pool and the foe files', { checks: res.length });
  if (process.env.GLOAM_BAKE !== '0') {
    const { bakeTwice } = await import('./gloam-downs-bake-zones.mjs');
    const t = Date.now(), r = bakeTwice('gaol'), bad2 = r.filter(q => !q.ok);
    assert(!bad2.length, bad2.map(q => q.what).join('\n'));
    pass('the Gaol baked with and without its zones: the same splat and walk files, the JSON differs only in zones', { s: ((Date.now() - t) / 1000).toFixed(1) });
  }
}
console.log(`${n} checks passed`);
