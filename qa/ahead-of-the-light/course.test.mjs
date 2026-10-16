// Ahead of the Light: the course: kinds, pieces, the generator, the validator, the director and the strip (final.md
// 11, 21.3), on all 8 legs. Legs 1 and 2 and every gate are WP2's; legs 3 to 8, their bosses' sections, the VOID and
// the landing are WP8's. The two big sweeps (every leg × lane × family on seeds 1 to 500, and every condition on every
// lane it can land on, seeds 1 to 500) run on worker threads beside the other tests; AOTL_SEEDS=50 runs them on fewer
// seeds.
// node qa/ahead-of-the-light/course.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import { buildLeg, legSeed, PIECES, piecesOf, teaching, hashItems } from
  '../../public/ahead-of-the-light/core/course/gen.js';
import { validateLeg } from '../../public/ahead-of-the-light/core/course/validate.js';
import { LEG_TYPES, ROUTE, CONDITIONS, COMMON_FLOW, FAMILY_EDITS, laneOf } from
  '../../public/ahead-of-the-light/core/course/legs.js';
import { KINDS, resolve, blocked, inArcs, place, psiAt, halfAt, wrap, knot, rail, wall, pair, gate, well, pulse,
  fog, fuel } from '../../public/ahead-of-the-light/core/course/kinds.js';
import { stepDirector, isDropped } from '../../public/ahead-of-the-light/core/course/director.js';
import { stripSvg } from '../../public/ahead-of-the-light/core/course/strip.js';
import { makeChart } from '../../public/ahead-of-the-light/core/chart.js';
import { buildStage } from '../../public/light-years-home/lab/a/stage1.js';
import { mulberry32, hashSeed } from '../../public/light-years-home/core/rng.js';

const SEEDS = Math.max(1, +(process.env.AOTL_SEEDS || 500));
const COURSE = fileURLToPath(new URL('../../public/ahead-of-the-light/core/course/', import.meta.url));
const FIRST = Object.freeze({});                               // a player's first run: every teaching piece
const LATER = Object.freeze({ runs: 4, goodWhip: true });     // nothing left to teach
const FAMS = ['SKIM', 'WELL', 'SHIP', 'RIVAL'];
const lanesOf = (type) => Object.keys(LEG_TYPES[type].lanes);
const kindOf = (type, name) => LEG_TYPES[type].lanes[name].kind;
const idOf = (e) => (Array.isArray(e) ? e[0] : e);

// The lane variants a leg can fly: each lane, and a FAMILY lane once per family.
function variants(type) {
  const out = [];
  for (const name of lanesOf(type)) {
    if (kindOf(type, name) === 'family') for (const fam of [null, ...FAMS]) out.push({ name, fam });
    else out.push({ name, fam: null });
  }
  return out;
}

// ---------- the two sweeps, shared out over worker threads ----------
// 'rules': every leg × lane variant × seed builds valid (R1 to R13); 1 in 10 is validated again to check the report.
// 'conds': every condition on every lane it can land on (never the VOID), each seed against the same lane without it.
function cases(job) {
  const out = [];
  if (job === 'rules') {
    for (const type of ROUTE) for (const v of variants(type)) for (let s = 1; s <= SEEDS; s++) out.push([type, v, s]);
  } else {
    for (const type of ROUTE.slice(2)) {
      for (const name of lanesOf(type)) {
        if (kindOf(type, name) === 'void') continue;
        for (let s = 1; s <= SEEDS; s++) out.push([type, { name }, s]);
      }
    }
  }
  return out;
}

function runCase(job, [type, v, s]) {
  const bad = [];
  if (job === 'rules') {
    const L = buildLeg({ runSeed: s, type, lane: v, seen: s % 2 ? FIRST : LATER });
    if (!L.report.ok) bad.push(`${type} ${v.name} ${v.fam || ''} seed ${s}: ${JSON.stringify(L.report.errors)}`);
    if (s % 10 === 0) {
      const again = validateLeg(L);
      if (!again.ok) bad.push(`${type} ${v.name} seed ${s}: validateLeg disagrees with the build`);
      for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13']) {
        if (!again.rules[r]) bad.push(`${type} ${v.name} seed ${s}: ${r} did not run`);
      }
    }
    return bad;
  }
  const base = buildLeg({ runSeed: s, type, lane: { name: v.name }, validate: false });
  for (const cid of Object.keys(CONDITIONS)) {
    const at = `${cid} on ${type} ${v.name} seed ${s}`;
    const L = buildLeg({ runSeed: s, type, lane: { name: v.name, cond: cid } });
    if (!L.report.ok) bad.push(`${at}: ${JSON.stringify(L.report.errors)}`);
    if (L.lane.cond !== cid) bad.push(`${at}: the lane lost its condition`);
    if (L.beats !== base.beats) bad.push(`${at}: a condition changed the length`);
    for (const k of ['noDrag', 'burnCap']) if (L.rules[k] !== base.rules[k]) bad.push(`${at}: ${k} changed`);
    const fuelN = (x) => x.pickups.filter((p) => p.type === 'fuel').length;
    if (cid === 'dust' && !L.items.some((it) => it.kind === 'fog')) bad.push(`${at}: no dust`);
    if (cid === 'flares' && !L.items.some((it) => it.kind === 'pulse')) bad.push(`${at}: no pulses`);
    if (cid === 'rich' && !(fuelN(L) > fuelN(base))) bad.push(`${at}: no more fuel`);
    if (cid === 'tides') {
      const ids = L.sections.find((x) => x.role === 'build').ids;
      if (type === 'earth' ? !ids.includes('saturn') : !ids.includes('hub-hop')) bad.push(`${at}: build ${ids}`);
    }
  }
  return bad;
}

if (!isMainThread) {
  const { job, lo, hi } = workerData;
  const all = cases(job), bad = [];
  for (let i = lo; i < hi; i++) bad.push(...runCase(job, all[i]));
  parentPort.postMessage({ n: hi - lo, bad });
}

// Run a sweep over up to 3 workers, leaving the main thread a core for the other tests. → { n, bad }
async function sweep(job) {
  const n = cases(job).length;
  const k = Math.max(1, Math.min(3, (availableParallelism ? availableParallelism() : 2) - 1));
  const step = Math.ceil(n / k);
  const parts = [];
  for (let lo = 0; lo < n; lo += step) {
    parts.push(new Promise((ok, fail) => {
      const w = new Worker(new URL(import.meta.url), { workerData: { job, lo, hi: Math.min(n, lo + step) },
        env: { ...process.env } });
      w.once('message', ok);
      w.once('error', fail);
    }));
  }
  const res = await Promise.all(parts);
  return { n: res.reduce((a, r) => a + r.n, 0), bad: res.flatMap((r) => r.bad) };
}

const it = isMainThread ? test : () => {};

// The sweeps start after the timing test (the first), one after the other, while the main thread runs the other
// tests; their tests come last.
const SWEEPS = {};
function startSweeps() {
  if (SWEEPS.rules) return;
  SWEEPS.rules = sweep('rules');
  SWEEPS.conds = SWEEPS.rules.then(() => sweep('conds'), () => sweep('conds'));
  for (const p of Object.values(SWEEPS)) p.catch(() => {});
}

it('buildLeg plus validateLeg under 40 ms a leg', () => {
  try {
    for (const type of ROUTE) {
      for (const name of lanesOf(type)) {
        const times = [];
        for (let s = 1; s <= 60; s++) {
          const t0 = performance.now();
          const L = buildLeg({ runSeed: s, type, lane: name, seen: s % 2 ? FIRST : LATER });
          validateLeg(L);
          times.push(performance.now() - t0);
        }
        times.sort((a, b) => a - b);
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        assert.ok(mean < 40, `${type} ${name}: ${mean.toFixed(1)} ms a leg`);
        assert.ok(times[Math.floor(times.length * 0.9)] < 40, `${type} ${name}: p90 ${times[54].toFixed(1)} ms`);
      }
    }
  } finally {
    startSweeps();
  }
});

// ---------- golden hashes (seeds 1 to 3, first run and later runs) ----------
const GOLDEN = {
  'web|THE FILAMENT|first': ['1j5hdeu', 'g62l4c', '1t74ph8'],
  'web|THE FILAMENT|later': ['tu8dos', '7egm4k', '1bbvtvs'],
  "coma|COMA'S HEART|first": ['1hd4vb3', '1sdohc2', 'hzf5xz'],
  "coma|COMA'S HEART|later": ['1ofg68o', '86z80d', '6lwrb8'],
  'coma|THE GREAT WALL|first': ['y67jl0', 'fjznc6', '1lvsl89'],
  'coma|THE GREAT WALL|later': ['dqrjor', '1y6ry2r', 'rp6uc1'],
  'virgo|M87|first': ['1jpronx', 'oa0t9', 'haxes1'],
  'virgo|M87|later': ['1jpronx', 'oa0t9', 'haxes1'],
  "virgo|MARKARIAN'S CHAIN|first": ['1vky21w', '10hb9uq', 'q7hjjx'],
  "virgo|MARKARIAN'S CHAIN|later": ['1vky21w', '10hb9uq', 'q7hjjx'],
  'local|THE LOCAL VOID|first': ['11qgxev', '12w4ruh', '19q4o63'],
  'local|THE LOCAL VOID|later': ['11qgxev', '12w4ruh', '19q4o63'],
  'local|ANDROMEDA|first': ['26xwbm', '11km15e', 'pu3e3p'],
  'local|ANDROMEDA|later': ['htbsez', '8ttmhj', '1dexvj3'],
  'local|TRIANGULUM|first': ['15s1cdz', '1n8fv9o', '13tykq3'],
  'local|TRIANGULUM|later': ['r6tvb9', 'ygzbkv', '1vtcefv'],
  'milkyway|THE GALACTIC CENTRE|first': ['196s10', '15vc3jw', 'bz9bs5'],
  'milkyway|THE GALACTIC CENTRE|later': ['196s10', '15vc3jw', 'bz9bs5'],
  'milkyway|THE OUTER DISC|first': ['6tdy26', '1dd8l1j', '10jtg6q'],
  'milkyway|THE OUTER DISC|later': ['6tdy26', '1dd8l1j', '10jtg6q'],
  'orion|THE ORION NEBULA|first': ['1lwoih', '16hzpup', '82beg3'],
  'orion|THE ORION NEBULA|later': ['1lwoih', '16hzpup', '82beg3'],
  "orion|ORION'S BELT|first": ['lhj9q6', '1x4xxd7', '1ytpkyt'],
  "orion|ORION'S BELT|later": ['lhj9q6', '1x4xxd7', '1ytpkyt'],
  'neighbours|ALDEBARAN AND THE HYADES|first': ['1lrczr3', '1h889iw', '14irvnk'],
  'neighbours|ALDEBARAN AND THE HYADES|later': ['1lrczr3', '1h889iw', '14irvnk'],
  'neighbours|ALPHA CENTAURI|first': ['18d79mg', '1x3w9u5', 'dtik5r'],
  'neighbours|ALPHA CENTAURI|later': ['18d79mg', '1x3w9u5', 'dtik5r'],
  'earth|JUPITER|first': ['1ig8qkp', '1r8rvz8', 's71y76'],
  'earth|JUPITER|later': ['1ig8qkp', '1r8rvz8', 's71y76'],
  'earth|THE ASTEROID BELT|first': ['1r1wfrg', 'mg9e1', '1686jtn'],
  'earth|THE ASTEROID BELT|later': ['1r1wfrg', 'mg9e1', '1686jtn'],
};

it('same seed, type, lane and mods give the same hash; golden hashes for seeds 1 to 3 of every leg and lane', () => {
  const now = {};
  for (const type of ROUTE) {
    for (const name of lanesOf(type)) {
      for (const [tag, seen] of [['first', FIRST], ['later', LATER]]) {
        const key = `${type}|${name}|${tag}`;
        now[key] = [1, 2, 3].map((s) => {
          const a = buildLeg({ runSeed: s, type, lane: name, seen });
          const b = buildLeg({ runSeed: s, type, lane: { name }, seen, mods: {}, used: new Set() });
          assert.equal(a.hash, b.hash, `${key} seed ${s} rebuilds the same`);
          assert.equal(a.hash, hashItems(a.items), 'the hash is the items\' hash');
          assert.ok(Object.isFrozen(a) && Object.isFrozen(a.items) && Object.isFrozen(a.items[0]), 'frozen');
          return a.hash;
        });
      }
    }
  }
  assert.deepEqual(now, GOLDEN, `golden hashes changed: ${JSON.stringify(now)}`);
  // a different lane, seed or mod gives a different leg; the seed comes from the lane's id
  const a = buildLeg({ runSeed: 1, type: 'coma', lane: "COMA'S HEART" });
  assert.notEqual(a.hash, buildLeg({ runSeed: 1, type: 'coma', lane: 'THE GREAT WALL' }).hash);
  assert.notEqual(a.hash, buildLeg({ runSeed: 2, type: 'coma', lane: "COMA'S HEART" }).hash);
  assert.equal(a.seed, legSeed(1, 'coma', 'comas-heart'));
  assert.notEqual(buildLeg({ runSeed: 1, type: 'web', mods: { gateWell: true } }).hash, buildLeg({ runSeed: 1,
    type: 'web' }).hash);
});

it('every leg is never empty and brings a line choice every 5 to 10 s', () => {
  const SET = new Set(['wall', 'gate', 'well', 'rail', 'pickup']);
  for (const type of ROUTE) {
    // legs 1 and 2: 5 beats of nothing at most and a line choice every 18 beats (9.6 s at cruise, 8.5 s at 0.9c);
    // the later legs run faster, so 6 and 20 beats are the same seconds or fewer
    const early = ROUTE.indexOf(type) < 2, quietMax = early ? 5 : 6, gapMax = early ? 18 : 20;
    for (const v of variants(type)) {
      for (let s = 1; s <= 100; s++) {
        const L = buildLeg({ runSeed: s, type, lane: v, seen: s % 2 ? FIRST : LATER });
        assert.ok(L.report.quiet <= quietMax, `${type} ${v.name} seed ${s}: ${L.report.quiet} beats with nothing at `
          + `${L.report.quietAt}`);
        // a line choice: a wall, a gate or pair, a well, a rail, a pickup, or THREAD OR DOCK (Earth: the door)
        const launch = L.sections[0].b1;
        const at = L.items.filter((x) => SET.has(x.kind) || (x.kind === 'cue' && (x.name === 'gateCall'
          || x.name === 'door'))).flatMap((x) => (x.end !== undefined ? [x.beat, x.end] : [x.beat]))
          .filter((b) => b >= launch).sort((a, b) => a - b);
        let prev = launch;
        for (const b of at) {
          assert.ok(b - prev <= gapMax, `${type} ${v.name} seed ${s}: ${b - prev} beats from ${prev} with no set piece`);
          prev = Math.max(prev, b);
        }
      }
    }
  }
});

it('the trap check fails a fixture of lab A\'s old P1-4 layout and passes today\'s', () => {
  const conv = (x) => {
    if (x.kind === 'knot') return knot(x.beat, x.psi, x.half);
    if (x.kind === 'rail') return rail(x.beat, x.end, x.psi, x.half);
    if (x.kind === 'wall') return wall(x.beat, [{ psi: x.psi, w: 2 * x.gap }]);
    if (x.kind === 'gate') return { kind: 'gate', beat: x.beat, psi: x.psi, gap: 2 * x.gap,
      halves: [x.half, x.half], pair: !!x.pair };
    return null;
  };
  for (let seed = 1; seed <= 8; seed++) {
    const now = buildStage(seed).map(conv).filter(Boolean);
    const old = buildStage(seed).map((x) => (x.plan ? { ...x, beat: 54.5 } : x)).map(conv).filter(Boolean);
    const a = validateLeg({ beats: 125, items: now }, { rules: ['R3', 'R4'] });
    const b = validateLeg({ beats: 125, items: old }, { rules: ['R3', 'R4'] });
    assert.ok(a.ok, `seed ${seed}: today's layout passes`);
    assert.equal(a.trap.worst, 0);
    assert.ok(!b.ok, `seed ${seed}: the old layout fails`);
    assert.ok(b.trap.worst >= 0.1 && b.trap.worst <= 0.25, `the old wall dooms ${b.trap.worst}`);
    assert.equal(b.trap.beat, 54.5, 'at the wall behind the rail');
  }
});

it('the validator catches unfair layouts', () => {
  const R = (items, beats, rules) => validateLeg({ beats, items }, { rules });
  // a knot inside a highway: whoever rides it is doomed
  const hw = [rail(4, 14, -10, 1.5), rail(4, 14, 10, 1.5), knot(10, 0, 3)];
  assert.ok(!R(hw, 16, ['R3', 'R4']).ok, 'a knot in the highway');
  assert.ok(R(hw.slice(0, 2), 16, ['R3', 'R4']).ok, 'the highway alone');
  // a wall closing every way: no path
  assert.ok(!R([wall(6, [{ psi: 0, w: 4 }])], 10, ['R3']).ok, 'a gap narrower than the ship');
  // two walls a beat apart 150° round with no preview
  const swing = [wall(6, [{ psi: -90, w: 50 }]), wall(7.5, [{ psi: 90, w: 50 }])];
  assert.ok(!R(swing, 12, ['R5']).ok, 'a long turn with no preview');
  assert.ok(R([swing[0], { ...swing[1], preview: true }], 12, ['R5']).ok, 'with a preview');
  // wells too close, a band pointing at nothing, a pickup in the open
  assert.ok(!R([well(4, 50, 'medium', [-60, -120]), well(10, -50, 'medium', [60, 120])], 16, ['R6']).ok);
  assert.ok(!R([well(4, 50, 'medium', [-60, -120])], 16, ['R7']).ok, 'bands at nothing');
  assert.ok(R([well(4, 50, 'medium', [-60, -120]), wall(10, [{ psi: -60, w: 60 }]),
    fuel(9, -120, { band: true })], 16, ['R7']).ok, 'bands on a gap and a fuel line');
  // R7's later-leg targets: a rail's riding line (M87's jet), a target knot (Titan), Earth's door within 16 beats
  const jet = rail(6, 20, -130, 2, { skimBand: 9 });
  assert.ok(R([well(4, 50, 'medium', [-120, -60]), jet, fuel(9, -60, { band: true })], 22, ['R7']).ok, 'on the jet');
  assert.ok(!R([well(4, 50, 'medium', [-100, -60]), jet, fuel(9, -60, { band: true })], 22, ['R7']).ok, 'off it');
  assert.ok(R([well(4, 50, 'medium', [-60, -120]), knot(8, -71, 3.5, { target: true }),
    fuel(9, -120, { band: true })], 16, ['R7']).ok, 'a target knot');
  assert.ok(!R([well(4, 50, 'medium', [-60, -120]), knot(8, -71, 3.5), fuel(9, -120, { band: true })], 16,
    ['R7']).ok, 'a plain knot is no target');
  const door = { kind: 'cue', beat: 19, name: 'door', data: { psi: -60, w: 60 } };
  assert.ok(R([well(4, 50, 'medium', [-60, -120]), door, fuel(9, -120, { band: true })], 22, ['R7']).ok, 'the door');
  assert.ok(!R([well(2, 50, 'medium', [-60, -120]), { ...door, beat: 21 }, fuel(7, -120, { band: true })], 24,
    ['R7']).ok, 'a door 19 beats on is too far');
  assert.ok(!R([fuel(6, 0)], 10, ['R10']).ok, 'a fuel cell on the safe line');
  assert.ok(R([knot(6, 7.5, 3), fuel(6, 0)], 10, ['R10']).ok, 'a fuel cell a hairline from a knot');
  assert.ok(!R([knot(6, 2, 3), fuel(6, 0)], 10, ['R10']).ok, 'a fuel cell inside a knot');
  // Saturn's Keeler cell: a secret in a gap you hairline, not inside the wall
  const rings = wall(6, [{ psi: 0, w: 40 }, { psi: 120, w: 10 }]);
  assert.ok(R([rings, fuel(6, 120, { secret: true })], 10, ['R10']).ok, 'the Keeler cell');
  assert.ok(!R([rings, fuel(6, 120)], 10, ['R10']).ok, 'the same cell, not secret');
  assert.ok(!R([rings, fuel(6, 90, { secret: true })], 10, ['R10']).ok, 'a secret inside the wall');
  // R1: eight knots inside the ring at once
  assert.ok(!R([0, 1, 2, 3, 4, 5, 6, 7].map((k) => knot(6 + k * 0.25, -150 + k * 40, 2)), 12, ['R1']).ok);
});

// A piece alone in a leg: 6 empty beats, the piece placed at `angle` (mirrored or not), 6 beats after. A piece whose
// bands aim into the next piece (the Moon at the landing's door: pc.after) is tested with that piece after it.
function pieceLeg(pc, { angle = 0, m = 1, seed = 1, safe = true } = {}) {
  const chain = [pc, ...(pc.after ? [PIECES[pc.after]] : [])];
  const items = [], sections = [{ role: 'launch', b0: 0, b1: 6, ids: [] }];
  let b0 = 6, anchor = angle;
  chain.forEach((q, i) => {
    const len = q.beats === 'rest' ? 24 : q.beats[1];
    const rnd = mulberry32(hashSeed('piece', q.id, seed));
    const p = {};
    for (const [k, [lo, hi]] of Object.entries(q.params)) {
      p[k] = safe || i > 0 ? q.safe[k] : lo + Math.floor(rnd() * (hi - lo + 1));
    }
    const ctx = { len, p, rnd, density: 1, opts: {}, legNo: 1, type: 'coma', skin: 'coma', T: TUNE, mods: {},
      first: false, lane: null, gate: 'gate-virgo' };
    const built = q.build(ctx);
    for (const x of built.items) {
      if (x.beat < len + 1e-9 || x.kind === 'cue') items.push({ ...place(x, b0, anchor, m), piece: q.id });
    }
    sections.push({ role: q.roles[0], id: q.id, ids: [q.id], b0, b1: b0 + len });
    anchor = wrap(anchor + m * (built.exit || 0));
    b0 += len;
  });
  items.sort((a, b) => a.beat - b.beat);
  return { beats: b0 + 6, items, sections };
}

it('every piece\'s safe params pass alone, mirrored and at every angle', () => {
  const rules = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R10'];
  for (const pc of Object.values(PIECES)) {
    assert.ok(Object.keys(pc.params).length <= 3, `${pc.id}: at most three params`);
    for (const k of Object.keys(pc.params)) {
      const [lo, hi] = pc.params[k];
      assert.ok(Number.isInteger(lo) && Number.isInteger(hi) && lo <= hi, `${pc.id}.${k} is an integer range`);
      assert.ok(pc.safe[k] >= lo && pc.safe[k] <= hi, `${pc.id}.${k}: its safe value is in range`);
    }
    if (pc.after) assert.ok(PIECES[pc.after], `${pc.id}: ${pc.after} is written`);
    for (let angle = 0; angle < 360; angle += 15) {
      for (const m of [1, -1]) {
        const L = pieceLeg(pc, { angle, m });
        const r = validateLeg(L, { rules });
        assert.ok(r.ok, `${pc.id} at ${angle}° ${m < 0 ? 'mirrored' : ''}: ${JSON.stringify(r.errors)}`);
      }
    }
  }
});

it('no piece repeats in a run unless its pool is spent; teaching pieces appear only while unseen', () => {
  for (let s = 1; s <= 100; s++) {
    const used = new Set();
    for (const type of ROUTE) {
      const lane = lanesOf(type)[s % lanesOf(type).length];
      const L = buildLeg({ runSeed: s, type, lane, seen: LATER, used });
      const here = piecesOf(L);
      for (const id of here) {
        if (used.has(id)) {
          // a pool `used` empties may repeat a common piece (11.9): every piece it could have drawn was flown
          const sec = L.sections.find((x) => x.ids.includes(id));
          const pool = LEG_TYPES[type].sections.find((x) => x[0] === sec.role)[2];
          const able = (Array.isArray(pool) ? pool : []).map(idOf).filter((p) => PIECES[p] && !PIECES[p].teach);
          assert.ok(COMMON_FLOW.includes(id), `seed ${s}: ${id} repeats on ${type}`);
          assert.ok(able.every((p) => used.has(p) || here.includes(p)), `seed ${s}: ${id} repeats on ${type} with `
            + `${able.filter((p) => !used.has(p))} unflown`);
        }
      }
      for (const id of here) used.add(id);
    }
  }
  const ids = (L) => L.sections.flatMap((x) => x.ids);
  for (let s = 1; s <= 50; s++) {
    const first = buildLeg({ runSeed: s, type: 'web', seen: FIRST });
    assert.equal(first.sections[1].id, 'web-first-knots');
    assert.deepEqual(first.sections[2].ids, ['first-well']);
    const third = buildLeg({ runSeed: s, type: 'web', seen: { runs: 2 } });
    assert.ok(ids(third).includes('web-first-knots') && ids(third).includes('first-well'));
    const later = buildLeg({ runSeed: s, type: 'web', seen: { runs: 3 } });
    assert.ok(!ids(later).includes('web-first-knots'), 'the intro is gone after 3 runs');
    assert.ok(ids(later).includes('first-well'), 'the first well stays until a GOOD whip');
    const whipped = buildLeg({ runSeed: s, type: 'web', seen: { runs: 0, goodWhip: true } });
    assert.ok(!ids(whipped).includes('first-well'));
    assert.equal(whipped.sections[2].ids.length, 2, 'two flow pieces take the build');
    const c1 = buildLeg({ runSeed: s, type: 'coma', seen: FIRST });
    const c2 = buildLeg({ runSeed: s, type: 'coma', seen: LATER });
    assert.ok(ids(c1).includes('rumble') && !ids(c2).includes('rumble'), 'rumble on the first 3 runs only');
    assert.ok(ids(c2).includes('open-road'));
  }
  assert.ok(teaching(PIECES['web-first-knots'], {}) && !teaching(PIECES['web-first-knots'], { runs: 3 }));
});

it('fuel count and spacing per leg; no pickup within 6° of the safe line', () => {
  for (const type of ROUTE) {
    for (const v of variants(type)) {
      const L0 = laneOf(type, v.name);
      for (let s = 1; s <= 120; s++) {
        const L = buildLeg({ runSeed: s, type, lane: v, seen: LATER });
        const at = `${type} ${v.name} ${v.fam || ''} seed ${s}`;
        if (L0.kind === 'void') { assert.equal(L.pickups.length, 0, `${at}: the VOID has no pickups`); continue; }
        const groups = new Map();
        for (const p of L.pickups) if (p.type === 'fuel') groups.set(p.group || `id${p.id}`, p.beat);
        let want = TUNE.FUEL_PER_LEG[ROUTE.indexOf(type)];
        if (v.fam && FAMILY_EDITS[v.fam].fuel) want += FAMILY_EDITS[v.fam].fuel;
        const must = L.pickups.filter((p) => p.type === 'fuel' && p.must);
        const mustGroups = new Set(must.map((p) => p.group || `id${p.id}`)).size;
        assert.equal(groups.size, Math.max(want, mustGroups), `${at}: fuel groups`);
        // one per third where the third has a slot, so cells are spread, never bunched
        if (want >= 3) {
          const beats = [...groups.values()].sort((a, b) => a - b);
          for (let i = 1; i < beats.length; i++) assert.ok(beats[i] - beats[i - 1] >= 3, `${at}: cells ${beats}`);
        }
        const patches = L.pickups.filter((p) => p.type === 'patch');
        assert.equal(patches.length, LEG_TYPES[type].patch ? 1 : 0, `${at}: the patch`);
        if (patches.length) assert.ok(Math.abs(patches[0].beat - L.beats * TUNE.PATCH_AT) <= L.beats * 0.3);
        const r = validateLeg(L, { rules: ['R10'] });
        assert.ok(r.ok, `${at}: ${JSON.stringify(r.errors)}`);
      }
    }
  }
  // the burn lesson: on a first run the leg's fuel cell sits a hairline from the beat-12 knot of the intro
  const first = buildLeg({ runSeed: 7, type: 'web', seen: FIRST });
  const cell = first.pickups.find((p) => p.piece === 'web-first-knots');
  assert.ok(cell && cell.must, 'the intro\'s cell always spawns');
  const burn = first.items.find((x) => x.kind === 'cue' && x.name === 'burn');
  assert.ok(burn && burn.beat > cell.beat, 'FLICK UP TO BURN comes right after it');
});

it('RISK adds exactly 16 beats; VOID has no pickups, wells or rivals, is × 0.6, and sets no drag and no burn cap; '
  + 'FAMILY edits touch only the build', () => {
  for (let s = 1; s <= 30; s++) {
    for (const type of ROUTE.slice(1)) {
      const names = lanesOf(type);
      const risk = names.find((n) => kindOf(type, n) === 'risk'), plain = names.find((n) => kindOf(type, n) === 'family');
      if (!risk || !plain) continue;
      const R = buildLeg({ runSeed: s, type, lane: risk }), F = buildLeg({ runSeed: s, type, lane: plain });
      assert.equal(R.beats - F.beats, TUNE.RISK_BEATS, `${type}: RISK is 16 beats longer`);
      assert.equal(F.beats, LEG_TYPES[type].beats, `${type}: FAMILY keeps the leg's length`);
    }
    const risk = buildLeg({ runSeed: s, type: 'coma', lane: "COMA'S HEART" });
    const fam = buildLeg({ runSeed: s, type: 'coma', lane: 'THE GREAT WALL' });
    // the 16 beats go to the crescendo, at density × 1.25: the crescendo takes what the other sections leave
    const cr = (L) => L.sections.find((x) => x.role === 'crescendo');
    const rest = (L) => L.sections.filter((x) => x.role !== 'crescendo').reduce((a, x) => a + x.b1 - x.b0, 0);
    assert.equal(cr(risk).b1 - cr(risk).b0, risk.beats - rest(risk));
    assert.ok(cr(risk).b1 - cr(risk).b0 >= LEG_TYPES.coma.beats - 86 + TUNE.RISK_BEATS - 4, 'more crescendo');
    const v = buildLeg({ runSeed: s, type: 'local', lane: 'THE LOCAL VOID' });
    assert.equal(v.beats, Math.round(LEG_TYPES.local.beats * TUNE.VOID_X));
    assert.equal(v.pickups.length, 0);
    assert.equal(v.wells.length, 0);
    assert.equal(v.field.regulars + v.field.drifters, 0);
    assert.equal(v.field.boss, null);
    assert.equal(v.rules.noDrag, true);
    assert.equal(v.rules.burnCap, null);
    assert.ok(v.report.ok, JSON.stringify(v.report.errors));
    assert.equal(v.items.filter((x) => x.kind === 'wall' && x.piece === 'local-void').length, 3, 'three far sheets');
    assert.ok(v.items.some((x) => x.kind === 'cue' && x.name === 'void'), 'NO GAS · NO DRAG · BURN IT ALL');
    for (const [type, plain] of [['coma', 'THE GREAT WALL'], ['virgo', "MARKARIAN'S CHAIN"], ['local', 'TRIANGULUM'],
      ['milkyway', 'THE OUTER DISC'], ['orion', "ORION'S BELT"], ['neighbours', 'ALPHA CENTAURI']]) {
      const base = buildLeg({ runSeed: s, type, lane: plain });
      for (const f of FAMS) {
        const e = buildLeg({ runSeed: s, type, lane: { name: plain, fam: f } });
        const same = (a, b) => a.role === b.role && a.ids.join() === b.ids.join() && JSON.stringify(a.params)
          === JSON.stringify(b.params) && a.b1 - a.b0 === b.b1 - b.b0;
        e.sections.forEach((sec, i) => {
          const b = base.sections[i];
          if (f === 'RIVAL') {
            if (sec.role === 'open') assert.equal((sec.b1 - sec.b0) - (b.b1 - b.b0), FAMILY_EDITS.RIVAL.open);
            else assert.ok(same(sec, b), `${type}: RIVAL touches only the open road (${sec.role})`);
          } else if (sec.role === 'build') {
            assert.equal(sec.ids[0], FAMILY_EDITS[f].piece, `${type}: ${f} puts its piece in the build`);
          } else assert.ok(same(sec, b), `${type}: ${f} touches only the build (${sec.role}: ${sec.ids} vs ${b.ids})`);
        });
        if (f === 'RIVAL') {
          const add = LEG_TYPES[type].field.boss ? 0 : FAMILY_EDITS.RIVAL.drifters;
          assert.equal(e.field.drifters, base.field.drifters + add, `${type}: RIVAL's drifters (none on boss legs)`);
        }
        if (f === 'SHIP') assert.equal(e.rules.patchAlways, true);
      }
    }
  }
});

it('every leg\'s opener and build pools hold at least 3 pieces (Earth excepted), every one of them written', () => {
  for (const type of ROUTE) {
    const def = LEG_TYPES[type];
    for (const role of ['opener', 'build']) {
      const sec = def.sections.find((x) => x[0] === role);
      const ids = new Set(sec[2].map(idOf));
      if (type !== 'earth') assert.ok(ids.size >= 3, `${type} ${role}: ${[...ids]}`);
      for (const id of ids) assert.ok(PIECES[id], `${type} ${role}: ${id} is written`);
    }
    for (const [role, , pool] of def.sections) {
      if (Array.isArray(pool)) for (const e of pool) assert.ok(PIECES[idOf(e)], `${type} ${role}: ${idOf(e)} is written`);
    }
    for (const name of lanesOf(type)) {
      assert.equal(laneOf(type, name).name, name);
      const L = def.lanes[name];
      for (const id of [...(Array.isArray(L.piece) ? L.piece : [L.piece]), ...(L.seq || [])].filter(Boolean)) {
        assert.ok(PIECES[id], `${type} ${name}: its signature ${id} is written`);
      }
    }
  }
  for (const id of COMMON_FLOW) assert.ok(PIECES[id], `common ${id}`);
  for (const id of ['gate-coma', 'gate-virgo', 'gate-local', 'gate-milky-way', 'gate-orion-arm', 'gate-bubble',
    'gate-sun', 'landing']) assert.ok(PIECES[id], id);
  for (const type of ROUTE) assert.ok(PIECES[LEG_TYPES[type].gate], `${type}'s gate`);
});

it('every lane flies its signature, its leg\'s boss section and its gate', () => {
  const sig = (L) => L.sections.find((x) => x.role === 'signature');
  const ids = (L, role) => L.sections.filter((x) => x.role === role).flatMap((x) => x.ids);
  for (let s = 1; s <= 40; s++) {
    for (const type of ROUTE) {
      for (const name of lanesOf(type)) {
        const def = LEG_TYPES[type], ln = def.lanes[name];
        const L = buildLeg({ runSeed: s, type, lane: name, seen: s % 2 ? FIRST : LATER });
        const at = `${type} ${name} seed ${s}`;
        if (ln.kind === 'void') { assert.deepEqual(ids(L, 'void'), ['local-void'], at); continue; }
        if (ln.seq) assert.deepEqual(sig(L).ids, ln.seq, at);
        else assert.ok((Array.isArray(ln.piece) ? ln.piece : [ln.piece]).includes(sig(L).id), `${at}: ${sig(L).id}`);
        assert.deepEqual(ids(L, 'gate'), [def.gate], at);
        if (type === 'virgo') assert.deepEqual(ids(L, 'open'), ['whale-road'], `${at}: the WHALE's road`);
        if (type === 'orion') assert.ok(ids(L, 'crescendo').includes('mako-field'), `${at}: MAKO's field`);
        if (type === 'earth') {
          const zone = ln.kind === 'short' ? 'belt-dense' : 'asteroids';
          assert.ok(L.sections.flatMap((x) => x.ids).includes(zone), `${at}: MANTA's push zone`);
          assert.ok(L.items.some((x) => x.kind === 'cue' && x.name === 'manta'), at);
        }
        if (def.field.boss) assert.equal(L.field.boss, def.field.boss, at);
      }
    }
  }
});

it('Earth runs the planets in order and lands at the door on the Moon\'s band line', () => {
  const order = ['launch', 'opener', 'build', 'breather', 'signature', 'crescendo', 'open', 'moon', 'gate'];
  for (let s = 1; s <= 60; s++) {
    for (const name of lanesOf('earth')) {
      const L = buildLeg({ runSeed: s, type: 'earth', lane: name, seen: LATER });
      const at = `${name} seed ${s}`;
      const short = kindOf('earth', name) === 'short';
      assert.deepEqual(L.sections.map((x) => x.role), short ? order.filter((r) => r !== 'crescendo' && r !== 'open')
        : order, at);
      assert.deepEqual(L.sections.map((x) => x.ids[0]).slice(1, 3), ['kuiper', 'saturn'], at);
      if (short) assert.equal(L.beats, Math.round(LEG_TYPES.earth.beats * TUNE.BELT_X), at);
      assert.equal(L.items.some((x) => x.name === 'JUPITER'), !short, `${at}: Jupiter only the long way`);
      // the door: a cue (no THREAD pay, no hazard), the leg's gate at L − 4, DOOR_DEG wide
      const g = L.gate;
      assert.ok(g.door && g.id === 'landing' && Number.isFinite(g.psi), `${at}: ${JSON.stringify(g)}`);
      assert.equal(g.beat, L.beats - 4, at);
      assert.equal(g.gap, TUNE.DOOR_DEG, at);
      assert.ok(!L.items.some((x) => x.kind === 'gate' && !x.pair), `${at}: no gate item on Earth`);
      const moon = L.wells.find((w) => w.name === 'THE MOON');
      assert.ok(moon && Math.abs(wrap(moon.exits[0] - g.psi)) <= 10, `${at}: the Moon's band A is on the door`);
      assert.ok(L.gate.beat - moon.beat <= 16, at);
      // Saturn's rings: three gaps, the Encke pair, the secret Keeler cell
      const rings = L.items.find((x) => x.kind === 'wall' && x.piece === 'saturn');
      assert.deepEqual(rings.gaps.map((x) => x.tag), ['cassini', 'encke', 'keeler'], at);
      assert.ok(Math.abs(wrap(rings.gaps[0].psi - L.sections[2].anchor)) <= 25, `${at}: Cassini near your line`);
      assert.ok(L.items.some((x) => x.kind === 'gate' && x.pair && x.tag === 'encke'), `${at}: Encke's thread`);
      const keeler = L.pickups.find((p) => p.secret);
      assert.ok(keeler && keeler.type === 'fuel' && Math.abs(wrap(keeler.psi - rings.gaps[2].psi)) < 1e-6, at);
    }
  }
  // TIDES never takes Saturn's place
  const t = buildLeg({ runSeed: 3, type: 'earth', lane: { name: 'JUPITER', cond: 'tides' } });
  assert.deepEqual(t.sections[2].ids, ['saturn']);
  assert.equal(t.rules.redSpan, CONDITIONS.tides.rules.redSpan);
});

it('the signature set pieces keep their shape', () => {
  for (let s = 1; s <= 40; s++) {
    const m = buildLeg({ runSeed: s, type: 'virgo', lane: 'M87', seen: LATER });
    const jet = m.items.find((x) => x.kind === 'rail' && x.tag === 'jet');
    const knots = m.items.filter((x) => x.kind === 'pulse' && x.tag === 'jet');
    assert.deepEqual(knots.map((x) => x.name), ['HST-1', 'D', 'E', 'F', 'I', 'A', 'B', 'C'], `M87 seed ${s}`);
    assert.ok(knots.every((x) => Math.abs(wrap(x.psi - jet.psi)) < 1e-6 && x.half1 === 12), 'the knots bulge the jet');
    assert.equal(jet.skimX, 2);
    const m87 = m.wells.find((w) => w.name === 'M87');
    assert.equal(m87.size, 'landmark');
    assert.ok(Math.abs(Math.abs(wrap(m87.exits[0] - jet.psi)) - 10) < 0.02, 'band A on the jet\'s riding line');
    assert.equal(m.pickups.filter((p) => p.piece === 'm87-jet' && p.band).length, 3, 'band B: three cells');
    const a = buildLeg({ runSeed: s, type: 'local', lane: 'ANDROMEDA', seen: LATER });
    const [m31, m33] = ['ANDROMEDA', 'TRIANGULUM'].map((n) => a.wells.find((w) => w.name === n));
    assert.ok(m31 && m33 && m33.beat - m31.beat === 12, `ANDROMEDA seed ${s}`);
    assert.ok(Math.abs(wrap(m31.exits[0] - m33.psi)) <= 40, 'band A on Triangulum\'s reach');
    assert.ok(['M32', 'M110'].every((n) => a.items.some((x) => x.name === n)));
    const b = buildLeg({ runSeed: s, type: 'orion', lane: "ORION'S BELT", seen: LATER });
    const belt = ['ALNITAK', 'ALNILAM', 'MINTAKA'].map((n) => b.wells.find((w) => w.name === n));
    assert.ok(belt.every(Boolean), `ORION'S BELT seed ${s}`);
    for (let i = 0; i < 2; i++) {
      assert.ok(Math.abs(wrap(belt[i].exits[0] - belt[i + 1].psi)) <= 40, 'each band A on the next well\'s reach');
    }
    const n = buildLeg({ runSeed: s, type: 'orion', lane: 'THE ORION NEBULA', seen: LATER });
    assert.ok(n.items.some((x) => x.kind === 'gate' && x.tag === 'trapezium' && x.gap === 10), 'the Trapezium');
    assert.ok(n.items.filter((x) => x.kind === 'pulse' && x.piece === 'nursery').length >= 20, 'the nursery flares');
    const c = buildLeg({ runSeed: s, type: 'milkyway', lane: 'THE GALACTIC CENTRE', seen: LATER });
    assert.ok(c.items.some((x) => x.kind === 'rail' && x.tag === 'bar' && x.half === 50), 'the bar');
    const h = buildLeg({ runSeed: s, type: 'neighbours', lane: 'ALDEBARAN AND THE HYADES', seen: LATER });
    assert.equal(h.items.filter((x) => x.tag === 'hyades' && x.kind === 'knot').length, 10, 'the V');
    assert.ok(h.items.some((x) => x.name === 'ALDEBARAN' && x.half === 8));
    const p = buildLeg({ runSeed: s, type: 'neighbours', lane: 'ALPHA CENTAURI', seen: LATER });
    const prox = p.wells.find((w) => w.name === 'PROXIMA'), ab = p.items.find((x) => x.name === 'ALPHA CENTAURI');
    assert.ok(Math.abs(wrap(prox.exits[0] - ab.psi)) <= 10, 'Proxima flings you onto Alpha Centauri\'s line');
    const w = buildLeg({ runSeed: s, type: 'virgo', lane: "MARKARIAN'S CHAIN", seen: LATER });
    assert.ok(w.items.filter((x) => x.piece === 'whale-road' && x.kind === 'rail').length === 2, 'the WHALE\'s road');
  }
});

it('makeChart never puts a condition on the VOID or the same one on two legs in a row', () => {
  for (let s = 1; s <= 200; s++) {
    const chart = makeChart(s, TUNE);
    let prev = null;
    chart.forEach((lanes, i) => {
      const conds = (lanes || []).map((l) => l.cond).filter(Boolean);
      for (const l of lanes || []) if (l.kind === 'void') assert.ok(!l.cond, `seed ${s}: a condition on the VOID`);
      if (i < 2) assert.equal(conds.length, 0, 'no conditions before leg 3');
      for (const c of conds) assert.notEqual(c, prev, `seed ${s}: ${c} on two legs in a row`);
      prev = conds[0] || null;
    });
  }
});

it('gateWell changes only the gate', () => {
  for (const type of ROUTE.filter((t) => t !== 'earth')) {
    for (let s = 1; s <= 30; s++) {
      const a = buildLeg({ runSeed: s, type });
      const b = buildLeg({ runSeed: s, type, mods: { gateWell: true } });
      const g = b.sections.findIndex((x) => x.role === 'gate');
      const before = (L) => L.items.filter((x) => x.sec !== g).map(({ id, ...rest }) => rest);
      assert.deepEqual(before(b), before(a), `${type}: everything before the gate is the same`);
      const wa = a.items.filter((x) => x.sec === g), wb = b.items.filter((x) => x.sec === g);
      assert.equal(wb.length, wa.length + 1);
      const W = b.wells.find((w) => w.gateWell);
      assert.ok(W && W.size === 'landmark', 'the larger giant is a landmark well');
      assert.ok(Math.abs(wrap(W.exits[0] - b.gate.psi)) < 1e-6, 'its first band is the THREAD line');
      assert.ok(b.report.ok, `${type} seed ${s}: ${JSON.stringify(b.report.errors)}`);
    }
  }
});

// A point strictly inside an arc list, or strictly outside, more than eps from any end.
const nearEdge = (arcs, b, eps = 1e-6) => arcs.some(([f, t]) => Math.abs(wrap(b - f)) < eps || Math.abs(wrap(b - t)) < eps);

it('resolve and blocked agree on 10,000 random samples', () => {
  const rnd = mulberry32(42);
  const r = (lo, hi) => lo + rnd() * (hi - lo);
  const make = () => {
    const k = Math.floor(rnd() * 7);
    const psi = r(-180, 180);
    if (k === 0) return knot(5, psi, r(1, 9));
    if (k === 1) return pulse(5, psi, r(0, 4), r(4, 12), r(1, 3), { phase: rnd() });
    if (k === 2) return well(5, psi, ['small', 'medium', 'large', 'landmark'][Math.floor(rnd() * 4)], [0, 90]);
    if (k === 3) {
      const n = 1 + Math.floor(rnd() * 3), gaps = [];
      for (let i = 0; i < n; i++) gaps.push({ psi: psi + i * (360 / n) + r(-20, 20), w: r(4, 70) });
      return wall(5, gaps);
    }
    if (k === 4) return rnd() < 0.5 ? pair(5, psi, r(2, 30), r(1, 6))
      : gate(5, psi, r(10, 35), [r(3, 10), r(3, 10)], ['A', 'B'], { psi: psi + 160, w: 60 });
    if (k === 5) return rail(2, 9, psi, r(0.5, 90), { omega: r(-10, 10), breaks: [[4, 4.5]] });
    return knot(5, psi, r(0.2, 2));
  };
  let checked = 0;
  for (let i = 0; i < 10000; i++) {
    const x = make();
    const beat = x.kind === 'rail' ? r(1, 10) : x.beat;
    const b = r(-180, 180);
    const arcs = blocked(x, beat, [], TUNE.SHIP_HALF, TUNE);
    if (nearEdge(arcs, b)) continue;
    const res = resolve(x, b, beat, TUNE);
    assert.equal(res.hit, inArcs(arcs, b), `${JSON.stringify(x)} at ${b} (beat ${beat})`);
    checked++;
  }
  assert.ok(checked > 9900);
  // psiAt turns a rail; halfAt peaks a pulse at its beat by default
  assert.equal(psiAt(rail(2, 9, 10, 1, { omega: 4 }), 5), 22);
  assert.equal(halfAt(pulse(5, 0, 2, 12, 0.5)), 12);
  assert.deepEqual([...KINDS].sort(), ['cue', 'fog', 'gate', 'knot', 'pickup', 'pulse', 'rail', 'wall', 'well']);
  assert.equal(resolve(fog(1, 5, [[-30, 30]]), 0, 2).tag, 'dust');
  assert.equal(resolve(fuel(3, 10), 15, 3).take, true);
  assert.equal(resolve(fuel(3, 10), 30, 3).take, false);
});

it('no Math.sin, cos, tan, exp, pow or random in gen.js and the pieces', () => {
  const files = ['gen.js', ...readdirSync(COURSE + 'pieces').map((f) => 'pieces/' + f)];
  for (const f of files) {
    const src = readFileSync(COURSE + f, 'utf8').replace(/\/\/.*$/gm, '');
    for (const w of ['sin', 'cos', 'tan', 'exp', 'pow', 'random', 'sinh', 'cosh', 'tanh', 'atan2', 'log']) {
      assert.ok(!new RegExp(`Math\\.${w}\\b`).test(src), `${f} calls Math.${w}`);
    }
    assert.ok(!/\*\*/.test(src), `${f} uses **`);
  }
});

it('stripSvg writes every leg and lane without throwing', () => {
  for (const type of ROUTE) {
    for (const name of lanesOf(type)) {
      const L = buildLeg({ runSeed: 3, type, lane: name });
      const rep = validateLeg(L, { keep: true });
      const svg = stripSvg(L, [{ name: 'test', points: [{ beat: 0, bearing: 0 }, { beat: 10, bearing: 170 },
        { beat: 12, bearing: -170 }], hits: [{ beat: 12, bearing: -170 }] }], { corridor: rep.corridor });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${type} ${name}`);
      assert.ok(svg.includes(`data-leg="${type}"`));
      assert.ok(svg.length > 2000);
    }
  }
  assert.ok(stripSvg(null).startsWith('<svg'));
});

it('the director drops optional items 1.3 to 5 s ahead after your breather, and nothing else', () => {
  const L = buildLeg({ runSeed: 5, type: 'coma', lane: "COMA'S HEART", seen: LATER });
  const you = { id: 'you', dist: 80, eta: 1, lightspeed: false };
  const race = { t: 10, leg: L, ships: [you], win: { lo: 0, hi: L.items.length }, director: { breatherUntil: 0 } };
  stepDirector(race, [{ type: 'breather', ship: 'rival1' }], TUNE);
  assert.equal(race.director.breatherUntil, 0, 'a rival\'s breather changes nothing');
  stepDirector(race, [{ type: 'breather', ship: 'you' }], TUNE);
  assert.equal(race.director.breatherUntil, 10 + TUNE.BREATHER_S);
  const bps = 1.605 / 0.86;
  const lo = you.dist + 1.3 * bps, hi = you.dist + 5 * bps;
  let dropped = 0;
  for (const x of L.items) {
    if (x.beat > lo && x.beat < hi && x.opt) { assert.ok(isDropped(race, x), `${x.id} dropped`); dropped++; }
    if (x.beat <= lo || x.beat >= hi) assert.ok(!isDropped(race, x), `${x.id} kept outside the window`);
    if (!x.opt && x.kind !== 'knot' && x.kind !== 'pulse') assert.ok(!isDropped(race, x), 'structure stays');
  }
  assert.ok(dropped > 3);
  const kept = L.items.filter((x) => x.beat > lo && x.beat < hi && (x.kind === 'knot' || x.kind === 'pulse')
    && !isDropped(race, x));
  for (const a of kept) for (const b of kept) {
    if (a !== b && Math.abs(a.beat - b.beat) <= 2) assert.ok(Math.abs(wrap(a.psi - b.psi)) >= 30, 'knots 30° apart');
  }
  // the same steps give the same drops (deterministic), and after BREATHER_S nothing new is dropped
  const again = { ...race, director: { breatherUntil: 0 } };
  stepDirector(again, [{ type: 'breather', ship: 'you' }], TUNE);
  assert.deepEqual(again.director.dropped, race.director.dropped);
  race.t += TUNE.BREATHER_S + 0.01;
  you.dist += 20;
  const before = Object.keys(race.director.dropped).length;
  stepDirector(race, [], TUNE);
  assert.equal(Object.keys(race.director.dropped).length, before);
});

it(`every leg type × every lane × seeds 1 to ${SEEDS} passes R1 to R13`, async () => {
  startSweeps();
  const { n, bad } = await SWEEPS.rules;
  assert.equal(n, cases('rules').length);
  assert.deepEqual(bad.slice(0, 10), [], `${bad.length} of ${n} legs fail`);
});

it(`each condition builds, validates on seeds 1 to ${SEEDS} on every lane it can land on, and never touches the light`,
  async () => {
    const LIGHT = ['GAP', 'BLEED', 'TTC', 'GLARE', 'CAP', 'gap', 'bleed', 'ttc', 'cap', 'light'];
    for (const [cid, C] of Object.entries(CONDITIONS)) {
      for (const r of Object.keys(C.rules || {})) assert.ok(!LIGHT.some((w) => r.includes(w)), `${cid}: ${r}`);
    }
    startSweeps();
    const { n, bad } = await SWEEPS.conds;
    assert.equal(n, cases('conds').length);
    assert.deepEqual(bad.slice(0, 10), [], `${bad.length} failures over ${n} lane seeds`);
  });
