// Gloam Downs, the combat run's figures and zones, checked in node with no browser:
//   the foe files and the boss files (sizes, the splat counts against their targets, each figure's range, bones and pivots, every splat
//   on a bone, the Reeve's cloak weights in eighths, the markers' sizes and colours, the tells' and lights' colours, ember eyes on
//   three foes and no face on the Mirelight, the Reeve's hook outside its body at the end of each sweep wind-up), the clips (the ones
//   each figure needs, their lengths, their keys, a tell that grows over its wind-up), the pose (the feet where the body is put, the
//   facing, the hidden-bone rule, a child hidden with its parent, a tell posed from scale 0.05), the pool in a place (the place's rows
//   kept, bone ids after the lamplighter's, every bone put away, every slot parked at density 0 and off the bones, a slot on the bones
//   before its density comes back and off them after it goes, the hit flash and its colour back, the cloak's second bone, the candles
//   moved as groups, each place with its pool under 275,000 splats, Barrow Crown's reserved boss slots and fill()), the veils
//   (veil.js), the zones (qa/lab/gloam-downs-zones.mjs on the baked walk maps, the slot and guard cases of the spec, a zone that
//   sleeps beyond 16 m, the cap of 6, an Ironback wall that is no overhang), the colour rule of lib/check.mjs in all five palettes
//   (and the colours it must fail), the place checks (the pools counted, and a folder with no places said so), and the bake of the
//   Gaol with and without its zones (qa/lab/gloam-downs-bake-zones.mjs).
// Run: node qa/lab/gloam-downs-foes.test.mjs     (GLOAM_BAKE=0 skips the bake of the Gaol, about 20 s)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readFigures, makePool, poseFigure, sampleKey, PUT_AWAY, HIDDEN_KEY, REST_KEY } from '../../public/lab/gloam-downs/pool.js';
import { poolFor, LINEUP } from '../../public/lab/gloam-downs/figures.js';
import { findVeils, makeVeils, conicOf, coverOf, VEIL } from '../../public/lab/gloam-downs/veil.js';
import { makeCamera } from '../../public/lab/gloam-downs/ink/webgl/view.mjs';
import { ZONES, POOLS, zoneJson, poolTypes } from '../../games/gloam-downs/lib/zones.mjs';
import { survey, fits, makeRoom, walkRoute, walkPath, ironWalls } from './gloam-downs-zones.mjs';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { makeFoes, FOE_HARD, TYPES } from '../../public/lab/gloam-downs/foes.js';
import { REEVE } from '../../public/lab/gloam-downs/boss.js';
import { startRun, makeRunner, PACE, depthOf, foeScale, sparkCount, bossScale } from '../../public/lab/gloam-downs/run.js';
import { bossLines } from '../../public/lab/gloam-downs/boss.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';

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
  // (the Mirelight's core sits in a soot rim, the figures' ink, so that its edge meets dark and not the pale flame)
  for (const [code, bone] of Object.entries(TELL)) for (const c of colours(code, bone)) assert(FIRE.slice(2, 6).includes(c) || (code === 'M' && c === 0x020308), `${code}: its tell colour ${c.toString(16)}`);
  for (const [code, bone] of [['B', 'light'], ['L', 'light']]) for (const c of colours(code, bone)) assert(WISP.slice(0, 2).includes(c), `${code}: the light ${c.toString(16)}`);
  for (const c of colours('M', 'body')) assert(WISP.slice(0, 2).includes(c) || FIRE.includes(c) || (c >> 16) < 0x30, `the Mirelight's flame ${c.toString(16)}`);
  for (const code of ['S', 'P', 'M', 'I', 'L', 'B', 'C']) assert(!colours(code).includes(WISP[2]), `${code} uses wisp slot 40`);
  pass('the tells are fire, the lights wisp slots 38 and 39, and no figure uses slot 40');
}

{ // ember eyes: the Snuffer, the Pitchrook and the Ironback each show at least 12 splats of fire slot 35 on the head (a hood or a mask
  // that one sculptor makes into one surface with the face swallows them)
  const eyes = {};
  for (const code of ['S', 'P', 'I']) {
    const T = foes.json.types[code], h = T.index.head;
    let k = 0;
    for (let i = T.first; i < T.end; i++) if (foes.data[i * 16 + 12] === h && rgb(foes.data[i * 16 + 7]) === FIRE[3]) k++;
    eyes[code] = k;
    assert(k >= 12, `${T.title}: ${k} eye splats of fire slot 35 on its head`);
  }
  // the Mirelight has no face: no ink over its heart (the soot rim round the heart is no higher than 1.32 m)
  const M = foes.json.types.M, mb = M.index.body;
  let face = 0;
  for (let i = M.first; i < M.end; i++) if (foes.data[i * 16 + 12] === mb && rgb(foes.data[i * 16 + 7]) === 0x020308 && foes.data[i * 16 + 1] - M.feet[1] > 1.32) face++;
  assert.equal(face, 0, `the Mirelight's ink face: ${face} splats`);
  pass('ember eyes on the Snuffer, the Pitchrook and the Ironback; no face on the Mirelight', eyes);
}
{ // the Reeve's crook sweeps: at the end of each wind-up the hook's glow is outside the body's box, seen from 12 m in front
  const T = boss.json.types.B, out = new Float32Array(12 * T.bones.length);
  const app = (w, p) => [0, 1, 2].map(r => w.A[r * 3] * p[0] + w.A[r * 3 + 1] * p[1] + w.A[r * 3 + 2] * p[2] + w.t[r]);
  const view = p => [(12 * p[0]) / (12 - p[2]), (12 * (p[1] - 1.7)) / (12 - p[2])];
  const body = new Set(['body', 'cloak', 'head', 'legL', 'legR'].map(nm => T.index[nm])), got = {};
  for (const name of ['sweep.windup', 'dsweep.windup']) {
    const w = poseFigure(out, 0, T, { x: 0, y: 0, z: 0, yaw: 0 }, name, T.clips[name].dur);
    const tip = view(app(w[T.index.crookTip], T.bones[T.index.crookTip].pivot));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = T.first; i < T.end; i++) {
      const b = boss.data[i * 16 + 12];
      if (!body.has(b) || w[b].hidden) continue;
      const q = view(app(w[b], [boss.data[i * 16], boss.data[i * 16 + 1], boss.data[i * 16 + 2]]));
      x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    }
    got[name] = tip.map(v => +v.toFixed(2));
    assert(tip[0] < x0 || tip[0] > x1 || tip[1] < y0 || tip[1] > y1, `${name}: the hook (${tip}) is inside the body's box (${[x0, x1, y0, y1]})`);
  }
  pass('the Reeve\'s hook glows outside its body at the end of each sweep wind-up, seen from the front', got);
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
  // a hidden parent hides its child: the Pitchrook's tell rides its coal, and with the coal put away the tell is put away too
  const P = foes.json.types.P, outP = new Float32Array(12 * P.bones.length), tl = P.index.tell;
  poseFigure(outP, 0, P, at, null, 0, { keys: { coal: HIDDEN_KEY, tell: REST_KEY } });
  assert(outP.slice(12 * tl, 12 * tl + 9).every(v => v === 0) && outP[12 * tl + 10] === -500, 'a child of a hidden bone is put away');
  // a tell that has just begun to grow (scale 0.05) is posed, not put away
  poseFigure(out, 0, T, at, null, 0, { keys: { tell: [0, 0, 0, 0.05, 0.05, 0.05, 0, 0, 0] } });
  const col = Math.hypot(out[12 * tb], out[12 * tb + 3], out[12 * tb + 6]);
  assert(near(col, 0.05, 1e-4) && out[12 * tb + 10] > -100, `a tell at scale 0.05 is posed (scale ${col}, y ${out[12 * tb + 10]})`);
  pass('the pose: the feet, the facing, the hidden-bone rule, a child bone that follows its parent and hides with it, a tell posed from 0.05');
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
  // the place's own rows are kept, every number of them
  const fresh = decode(`${W}gaol.bin.gz`).data.subarray(0, placeCount * 16), mine = world.data.subarray(0, placeCount * 16);
  assert(Buffer.compare(Buffer.from(fresh.buffer, fresh.byteOffset, fresh.byteLength), Buffer.from(mine.buffer, mine.byteOffset, mine.byteLength)) === 0, 'the place\'s rows are the place');
  assert.equal(world.count, placeCount + 5 * (T.end - T.first));
  // every bone of every slot starts put away
  for (const sl of pool.slots) for (let b = 0; b < T.bones.length; b++) {
    const o = 12 * (sl.base + b);
    assert(pool.bones.slice(o, o + 9).every(v => v === 0) && pool.bones[o + 10] === -500, `slot ${sl.i} bone ${b} starts put away`);
  }
  // a slot joins the bones before its density comes back, and leaves them after its density goes to 0
  const s = pool.slots[2], seen = [];
  let boned = world.anim.boned;
  Object.defineProperty(world.anim, 'boned', { get: () => boned, set: v => { seen.push({ len: v.length, dense: d[s.first * 16 + 3] > 0 }); boned = v; }, configurable: true });
  pool.wake(s, { x: 1, y: -2.2, z: 1, yaw: Math.PI }, 'rest', 0);
  assert.deepEqual(seen.at(-1), { len: lamp + (T.end - T.first), dense: false }, 'on the bones first, still at density 0');
  // after a wake the hidden bones (the tell) stay put away; the shadow is laid on the floor
  for (const b of T.bones.map((x, k) => k).filter(k => T.bones[k].hidden)) assert.equal(pool.bones[12 * (s.base + b) + 10], -500, `${T.bones[b].name} stays put away after the wake`);
  assert(pool.bones[12 * (s.base + T.index.shadow) + 10] > -100, 'the shadow is laid');
  for (let k = s.first; k < s.end; k++) assert.equal(d[k * 16 + 3], foes.data[(k - s.first + T.first) * 16 + 3], 'its density back');
  assert(pool.rows.size >= 6 && [...pool.rows].every(r => r >= s.first >> 9 && r <= (s.end - 1) >> 9), 'only its rows to upload');
  assert(world.anim.boned.includes(s.first) && world.anim.boned.includes(s.end - 1));
  // the hit flash: fire slot 35 on the figure, the shadow keeps its colour; then its own colour back
  pool.rows.clear();
  pool.flash(s, true);
  const sh = T.index.shadow;
  for (let k = s.first; k < s.end; k++) {
    const o = k * 16, own = foes.data[(k - s.first + T.first) * 16 + 7];
    assert.equal(rgb(d[o + 7]), d[o + 12] - s.base === sh ? rgb(own) : 0xff9a32);
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
      // the cloak's second bone (the body) is moved after the bones before it, as its first bone is
      let shared = 0;
      for (let k = B.first; k < B.end; k++) {
        const o = k * 16, so = (k - B.first + B.type.first) * 16;
        if (boss.data[so + 14] <= 0) continue;
        shared++;
        assert.equal(world.data[o + 13], B.base + boss.data[so + 13], 'a cloak splat\'s second bone is the Reeve\'s own');
        assert.equal(world.data[o + 12], B.base + boss.data[so + 12]);
      }
      assert(shared > 100, `${shared} cloak splats share a second bone`);
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
{ /* Barrow Crown's pool before the boss files come in: the Reeve's and the candles' rows and bones are reserved (foes.json.gz holds
     their counts), so fill() copies them in later and the pool is never built twice. A beacon put out and a slot awake keep their
     state */
  const R = foes.json.reserve;
  assert.deepEqual(R, { B: { count: boss.json.types.B.end - boss.json.types.B.first, bones: 46 }, C: { count: boss.json.types.C.end - boss.json.types.C.first, bones: 0 } }, 'foes.json.gz reserves the boss files\' counts');
  const { meta, world } = place('barrows'), slots = poolFor('barrows', foes, null);
  assert.equal(slots.map(s => s.code).join(''), POOLS.barrows, 'every slot is there before the boss files');
  const pool = makePool(world, meta, slots), B = pool.slots.find(s => s.code === 'B'), C = pool.slots.find(s => s.code === 'C');
  assert(!B.type && !C.type && B.end - B.first === R.B.count && B.nbones === 46, 'the Reeve\'s slot is reserved');
  for (let k = B.first; k < B.end; k++) assert.equal(world.data[k * 16 + 3], 0, 'a reserved row is empty');
  assert.equal(pool.free('B'), null, 'a reserved slot cannot wake');
  const count = world.count;
  // the page puts the beacon out and a Snuffer wakes; then the boss files come in
  const [a, b] = meta.beacon.fire[0];
  for (let k = a; k < b; k++) world.data[k * 16 + 3] = 0;
  const S = pool.slots.find(s => s.code === 'S');
  pool.wake(S, { x: 1, y: 0.2, z: 3.5, yaw: 0 }, 'rest', 0);
  const boned = world.anim.boned.length;
  pool.fill('B', boss); pool.fill('C', boss);
  assert.equal(world.count, count, 'the pool keeps its size');
  for (let k = a; k < b; k++) assert.equal(world.data[k * 16 + 3], 0, 'the beacon stays out');
  assert(S.awake && world.data[S.first * 16 + 3] > 0 && world.anim.boned.length === boned, 'the awake Snuffer stays awake and on the bones');
  assert(B.type === boss.json.types.B && pool.free('B') === B, 'the Reeve is in, parked');
  for (let k = B.first; k < B.end; k++) {
    const o = k * 16, so = (k - B.first + B.type.first) * 16;
    assert.equal(world.data[o + 3], 0);
    assert(world.data[o] === boss.data[so] && world.data[o + 12] === B.base + boss.data[so + 12], 'its rows are the boss file\'s, on its own bones');
  }
  pool.wake(B, { x: 18, y: 0.68, z: -22, yaw: 0 }, 'rest', 0);
  assert(world.anim.boned.includes(B.first) && world.data[B.first * 16 + 3] > 0, 'and wakes');
  pass('Barrow Crown reserves the Reeve\'s rows: fill() copies the boss files in, and the beacon and an awake Snuffer keep their state', R);
}
{ /* the veils (veil.js): a see-through sheet whose centre is nearer the eye than a figure, and that covers the figure on the screen,
     fades out over 15 steps; one behind the figure, or beside it on the screen, stays; with no figure it fades back. Lights (the
     shared slots), solid splats, the sky dome's splats and the ranges the page lights are never veils */
  const cam = makeCamera({ cam: {}, radius: 20 }, { camera: { target: [0, 1, 0], dist: 8.5, yaw: 0, pitch: 0.32 } }, 320, 180);
  const focal = 180 / 2 / cam.tangent, V = cam.view;
  const pack = c => ((c >> 16) & 255) + ((c >> 8) & 255) * 256 + (c & 255) * 65536;
  const rows = [
    // x, y, z, density, xx, yy, zz, colour: a fog sheet 3 m in front of the figure (toward the eye), one 3 m behind it, one far off
    // to the side, a lit ember glow, a solid stone, a sky dome splat, and a sheet in a range the page lights
    [0, 0.5, 3, 0.3, 4, 0.04, 2, 0x2c5550], [0, 0.5, -3, 0.3, 4, 0.04, 2, 0x2c5550], [9, 0.5, 2, 0.3, 1, 0.04, 1, 0x2c5550],
    [0, 1, 3, 0.2, 2, 2, 2, 0xd2551c], [0, 1, 3, 3, 0.01, 0.01, 0.01, 0x372720], [0, 50, 0, 0.5, 900, 1, 900, 0x03050a], [0, 0.5, 3, 0.3, 4, 0.04, 2, 0x2c5550]
  ];
  const data = new Float32Array(rows.length * 16);
  rows.forEach(([x, y, z, a, xx, yy, zz, c], i) => { const o = i * 16; data.set([x, y, z, a, xx, 0, 0, pack(c), yy, 0, zz, 0], o); });
  const world = { data, count: rows.length };
  const list = findVeils(world, { skip: [[6, 7]], shared: [pack(0xd2551c)] });
  assert.deepEqual(list.map(v => v.i), [0, 1, 2], 'the three fog sheets are veils');
  const veils = makeVeils(world, list), fig = [[0, 0.3, 0], [0, 1.0, 0], [0, 1.6, 0]];
  const q = conicOf(V, focal, list[0]), sc = { x: 0, y: 0 };
  assert(q && coverOf(q, { x: q.x, y: q.y }, 0.3) > 0.29, 'a sheet covers its own centre on the screen');
  for (let k = 0; k < VEIL.FADE; k++) veils.step(V, focal, fig);
  assert.deepEqual([data[3], data[16 + 3], data[32 + 3]].map(v => +v.toFixed(3)), [0, 0.3, 0.3], 'the sheet in front fades out; the one behind and the one aside stay');
  assert(near(data[6 * 16 + 3], 0.3, 1e-6), 'the range the page lights is left alone');
  veils.step(V, focal, []);
  assert(near(data[3], 0.02, 1e-6), 'with no figure it fades back, a step at a time');
  for (let k = 0; k < VEIL.FADE; k++) veils.step(V, focal, []);
  assert(near(data[3], 0.3, 1e-6) && sc.x === 0, 'and is whole again');
  pass('veils: a see-through sheet drawn over an awake figure fades out over 0.25 s, and comes back when the figure goes');
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
  // two zones that help: R1 and R2 hold the four Snuffer slots, and R4 needs two; R1 is farther from the lamplighter and goes first
  const room3 = makeRoom(Z('ramparts', 'R4'), [Z('ramparts', 'R1'), Z('ramparts', 'R2')], poolTypes('ramparts'), -14, -11.5);
  assert.deepEqual(room3.gone.map(z => z.id), ['R1'], `the farthest of two that help goes: ${room3.gone.map(z => z.id)}`);
  // a zone sleeps beyond 16 m: a walk from the Gaol's G1 out to 18 m and back wakes it twice (a runner does not clear it)
  const g1 = Z('gaol', 'G1'), out = [g1.c[0], g1.c[1], g1.c[2] + 4], far = [g1.c[0], g1.c[1], g1.c[2] + 22];
  const there = walkPath('gaol', [out, far, out], 'runner');
  assert.equal(there.order.filter(id => id === 'G1').length, 2, `G1 sleeps beyond 16 m and wakes again: ${there.order}`);
  assert.equal(walkPath('gaol', [out, [g1.c[0], g1.c[1], g1.c[2] + 15], out], 'runner').order.filter(id => id === 'G1').length, 1, 'within 16 m it stays awake');
  // the cap is 6: no place's zones and pool may ever wake 7, whatever slots the pool has
  assert(Object.keys(ZONES).every(id => walkRoute(id, 'runner').most <= 6 && walkRoute(id, 'fighter').most <= 6));
  assert(fits({ foes: 'SSS' }, [{ foes: 'SSS' }], { S: 9 }) && !fits({ foes: 'SSSS' }, [{ foes: 'SSS' }], { S: 9 }), 'six fit, seven do not');
  pass('the slot cases: B3 waits for B2\'s Mirelight slot, R3 gives its Pitchrook slot to R4 and R2 keeps its own; a zone sleeps beyond 16 m');
}
{ /* the Ironback's walls: a face counts only where the floor under any gap rises 2 m, so a roof over open floor (which a charging body
     runs under) is no wall, and a solid face is */
  const grid = fn => {
    const info = { x0: -12, z0: -12, step: 0.25, nx: 97, nz: 97, layers: ['T', 'G', 'U'] }, N = info.nx * info.nz, cells = new Int16Array(3 * N);
    for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) {
      const [t, g, u] = fn(info.x0 + i * info.step, info.z0 + j * info.step), k = j * info.nx + i;
      cells[k] = Math.round(t * 100); cells[N + k] = Math.round(g * 100); cells[2 * N + k] = Math.round((u ?? 0) * 100);
    }
    return makeWalk(info, cells);
  };
  const zone = { c: [0, 0, 0], leash: 4 };
  const roof = grid((x, z) => (x > 5 && x < 9 ? [4, 0, 2.6] : [0, 0])), wall = grid((x, z) => (x > 5 && x < 9 ? [4, 4] : [0, 0]));
  const step = grid((x, z) => (x > 5 && x < 9 ? [1, 1] : [0, 0]));
  assert.deepEqual(ironWalls(roof, zone), [], 'a roof over open floor is no wall');
  assert.deepEqual(ironWalls(step, zone), [], 'nor is a step of 1 m');
  assert(ironWalls(wall, zone).some(([a]) => a === 90), 'a solid face is');
  pass('the Ironback\'s walls: a solid face of 2 m counts, the top of an overhang does not');
}

/* ---------------- the colour rule and the budgets of lib/check.mjs, and the bake with and without zones ---------------- */
let check = null;
try { check = await import('../../games/gloam-downs/lib/check.mjs'); } catch (err) { console.log(`SKIP the colour rule and the bake: ${err.message.split('\n')[0]} (npm ci --prefix games/gloam-downs)`); }
if (check) {
  const types = Object.fromEntries(Object.entries(foes.json.types).map(([k, T]) => [k, T]));
  const res = [...check.fileChecks(W), ...check.colourChecks(foes.data, types, W), ...check.colourChecks(boss.data, boss.json.types, W), ...check.placeChecks(W)];
  const bad = res.filter(r => !r.ok);
  assert(!bad.length, bad.map(r => r.what).join('\n'));
  // each place's pool is counted: its slots' splats, from the figure files
  for (const id of PLACES) {
    const want = [...POOLS[id]].reduce((n, c) => { const T = (c === 'B' || c === 'C' ? boss : foes).json.types[c]; return n + T.end - T.first; }, 0);
    assert(res.some(r => r.what.startsWith(`${id}: `) && r.what.includes(` + pool ${want} = `)), `${id}: the pool of ${want} splats is counted`);
  }
  // the rule fails a colour that snaps to wisp slot 40, to a cloak slot, or to a bright colour of a place's own (the Crow Wall's tan)
  const made = new Float32Array(3 * 16);
  [0xeefff6, 0x461a1e, 0x987456].forEach((c, i) => { made[i * 16 + 7] = ((c >> 16) & 255) + ((c >> 8) & 255) * 256 + (c & 255) * 65536; });
  const fake = { A: { title: 'slot 40', first: 0, end: 1 }, B: { title: 'a cloak', first: 1, end: 2 }, C: { title: 'a tan', first: 2, end: 3 } };
  const fails = check.colourChecks(made, fake, W).filter(r => !r.ok).map(r => r.what.split(':')[0]);
  assert(PLACES.every(id => fails.includes(`slot 40 colours in ${id}`)), 'slot 40 fails in every palette');
  assert(PLACES.every(id => fails.includes(`a cloak colours in ${id}`)), 'a cloak slot fails in every palette');
  assert(fails.includes('a tan colours in ramparts'), "the Crow Wall's own tan fails there");
  // a bake into a folder with no place files says so, for each place
  const empty = fs.mkdtempSync(`${os.tmpdir()}/gloam-noplaces-`);
  try {
    fs.copyFileSync(`${W}foes.json.gz`, `${empty}/foes.json.gz`);
    fs.copyFileSync(`${W}foes.bin.gz`, `${empty}/foes.bin.gz`);
    const none = check.placeChecks(empty);
    assert(PLACES.every(id => none.some(r => r.what.startsWith(`${id}:`) && /not checked/.test(r.what))), 'each place says it was not checked');
    assert(check.placeChecks(empty, W).filter(r => /splats <= 275000/.test(r.what)).length === 5, 'and with the committed places, all five are');
  } finally { fs.rmSync(empty, { recursive: true, force: true }); }
  pass('lib/check.mjs: the figure files\' sizes, every figure colour in all five palettes, each place with its pool and the foe files', { checks: res.length });
  if (process.env.GLOAM_BAKE !== '0') {
    const { bakeTwice } = await import('./gloam-downs-bake-zones.mjs');
    const t = Date.now(), r = bakeTwice('gaol'), bad2 = r.filter(q => !q.ok);
    assert(!bad2.length, bad2.map(q => q.what).join('\n'));
    pass('the Gaol baked with and without its zones: the same splat and walk files, the JSON differs only in zones', { s: ((Date.now() - t) / 1000).toFixed(1) });
  }
}
{ /* the guard's second wave (mix.js mixWave, foes.js): on the baked Gaol, the lamplighter puts out G5's three Snuffers one by one; 1.5 s
     (90 play steps) later two Snuffers rise at the keep, cracks first, and the beacon stays dark until they are out too. A zone put out
     whole by the test hook has no second wave, and the arena has none */
  const { loadWalk } = await import('./gloam-downs-zones.mjs');
  const { makeFoes } = await import('../../public/lab/gloam-downs/foes.js');
  const { startRun, makeRunner } = await import('../../public/lab/gloam-downs/run.js');
  const RS = await import('../../public/lab/gloam-downs/run-save.js');
  const { makeBody, PARAMS } = await import('../../public/lab/gloam-downs/play.js');
  const { meta, walk } = loadWalk('gaol');
  const rs = RS.fresh();
  startRun(rs, 3);
  rs.run.hp = 1e5;
  const g5 = meta.zones.find(z => z.id === 'G5');
  const body = makeBody(walk, { p: [g5.c[0], g5.c[1] + 0.5, g5.c[2] + 6], yaw: 0 }, meta.bounds, { ...PARAMS });
  const F = makeFoes({ walk, meta, slots: POOLS.gaol, seed: 3 });
  const R = makeRunner({ walk, meta: { wisps: [], beacon: { p: [90, 0, 90], r: 1 } }, body, rs, targets: F.targets, lightable: F.lightable, drop: F.drop, think: F.think, onLight: F.bank });
  F.bind(R);
  const run = k => { const all = []; for (let i = 0; i < k; i++) all.push(...R.step({}, 0)); return all; };
  assert(F.wake('G5').ok);
  run(60);
  const Z = F.zones.find(z => z.id === 'G5');
  for (const f of Z.members.slice()) F.putOut(f.id);
  assert.equal(F.lightable().ok, false, 'dark while the wave waits');
  const early = run(88);
  assert(!early.some(e => e.type === 'wave'), 'not before 1.5 s');
  const ev = run(4);
  const wave = Z.members.filter(f => !f.out);
  assert.equal(wave.length, 2, `${wave.length} foes rose again`);
  assert(wave.every(f => f.type === 'S'));
  assert(ev.some(e => e.type === 'cracks' && e.zone === 'G5'), 'the ember cracks come first');
  assert(ev.some(e => e.type === 'wave' && e.zone === 'G5' && e.n === 2));
  assert.equal(F.lightable().ok, false, 'the beacon stays dark');
  run(100);
  assert(wave.every(f => f.alive), `the wave has risen: ${wave.map(f => f.state)}`);
  for (const f of wave) F.putOut(f.id);
  run(200);
  assert.equal(Z.members.filter(f => !f.out).length, 0, 'no third wave');
  assert.equal(F.lightable().ok, true, 'the beacon lights once the wave is out');
  // the test hook putting out a whole zone skips its wave
  const F2 = makeFoes({ walk, meta, slots: POOLS.gaol, seed: 3 });
  assert.equal(F2.putOut('G5'), 3);
  assert.equal(F2.lightable().ok, true);
  pass('the guard\'s second wave: G5\'s three Snuffers out, two rise 1.5 s later with cracks first, and the beacon waits for them');
}

// the curve's numbers (gloam-downs-fair-fight design.md "A natural curve"), as the spec's scenarios quote them
const CURVE = { hard: [1.1, 1.15, 1.2], pace: [1, 0.1, 0.2, 1, 0.015, 0.03, 12, 0.05], hook0: 18, crow: { hp: 69, hook: 19 }, crown: { hook: 25, hp: 103 } };
{ // Harder Ember 0: a Snuffer's hook deals 18 (16 × 1.1, rounded), it has 58 health (50 × 1.15), and the Reeve's blows deal 20% more
  assert.deepEqual([FOE_HARD.dmg, FOE_HARD.hp, REEVE.hard], CURVE.hard);
  const info = { x0: -20, z0: -20, step: 0.25, nx: 161, nz: 161 }, walk = makeWalk(info, new Int16Array(2 * 161 * 161));
  const rs = RS.fresh(); startRun(rs, 3);
  const body = makeBody(walk, { p: [0, 0.5, 0], yaw: 0 }, 20, { ...PARAMS });
  const F = makeFoes({ walk, meta: { zones: [], spawn: { p: [0, 0, 10] } }, slots: 'S', seed: 3, bounds: 20 });
  const R = makeRunner({ walk, meta: { wisps: [], beacon: { p: [90, 0, 90], r: 1 } }, body, rs, targets: F.targets, think: F.think });
  F.bind(R);
  const f = F.find(F.spawn('S', 0, 1.6, Math.PI).id);
  assert.equal(f.hp, Math.round(TYPES.S.hp * 1.15));
  let hurt = null;
  for (let i = 0; i < 240 && !hurt; i++) hurt = R.step({}, 0).find(e => e.type === 'hurt') || null;
  assert(hurt && hurt.dmg === CURVE.hook0, `the hook dealt ${hurt?.dmg}`);
  pass(`Harder Ember 0: a Snuffer has 58 health and its hook deals ${CURVE.hook0}; the Reeve deals 20% more`, { hook: hurt.dmg, hp: f.hp });
}

{ /* Harder later places: at place depth d foes deal ×(1 + 0.1 d) and have ×(1 + 0.2 d) health, the Gaol is as before, and the Reeve
     has 5% more health for each spark the run holds */
  assert.deepEqual([PACE.blade, PACE.depthDmg, PACE.depthHp, PACE.depthPow, PACE.sparkDmg, PACE.sparkHp, PACE.sparkCap, PACE.bossSpark], CURVE.pace);
  const rs = RS.fresh(); startRun(rs, 3);
  assert.deepEqual([depthOf(rs.run), foeScale(rs.run)], [0, { dmg: 1, hp: 1 }], 'the Gaol: no change');
  rs.run.place = 'barrows';
  const top = foeScale(rs.run);
  assert.equal(depthOf(rs.run), 4);
  assert.equal(Math.round(16 * FOE_HARD.dmg * top.dmg), CURVE.crown.hook, 'Barrow Crown: the hook');
  assert.equal(Math.round(50 * FOE_HARD.hp * top.hp), CURVE.crown.hp, 'Barrow Crown: a Snuffer');
  assert(Math.ceil(100 / CURVE.crown.hook) >= 4, 'four hooks or more to go down from 100');
  rs.run.sparks = { flame: 4, ward: 2, gloam: 2 };
  assert.deepEqual([sparkCount(rs.run), +bossScale(rs.run).toFixed(2), bossLines(bossScale(rs.run)).max], [8, 1.4, 1820], 'the Reeve with 8 sparks: 1,820 health');
  // a Snuffer in The Crow Wall (the second place), no spark
  rs.run.place = 'ramparts'; rs.run.sparks = { flame: 0, ward: 0, gloam: 0 };
  const sc = foeScale(rs.run);
  const info = { x0: -20, z0: -20, step: 0.25, nx: 161, nz: 161 }, walk = makeWalk(info, new Int16Array(2 * 161 * 161));
  const body = makeBody(walk, { p: [0, 0.5, 0], yaw: 0 }, 20, { ...PARAMS });
  const F = makeFoes({ walk, meta: { zones: [], spawn: { p: [0, 0, 10] } }, slots: 'S', seed: 3, bounds: 20, scale: sc });
  const R = makeRunner({ walk, meta: { wisps: [], beacon: { p: [90, 0, 90], r: 1 } }, body, rs, targets: F.targets, think: F.think });
  F.bind(R);
  const f = F.find(F.spawn('S', 0, 1.6, Math.PI).id);
  assert.equal(f.hp, CURVE.crow.hp);
  let hurt = null;
  for (let i = 0; i < 240 && !hurt; i++) hurt = R.step({}, 0).find(e => e.type === 'hurt') || null;
  assert(hurt && hurt.dmg === CURVE.crow.hook, `the hook dealt ${hurt?.dmg}`);
  pass(`Harder later places: the Gaol as before; a Crow Wall Snuffer has ${CURVE.crow.hp} health and its hook deals ${CURVE.crow.hook}; at Barrow Crown a hook deals ${CURVE.crown.hook} and a Snuffer has ${CURVE.crown.hp}; the Reeve +5% a spark`, { hook: hurt.dmg, hp: f.hp });
}
console.log(`${n} checks passed`);
