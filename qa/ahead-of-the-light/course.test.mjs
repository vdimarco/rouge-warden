// Ahead of the Light: the course: kinds, pieces, the generator, the validator, the director and the strip (final.md
// 11, 21.3). Legs 1 and 2 and every gate are WP2's; legs 3 to 8 build from their pools as WP8 writes their pieces,
// and until then from the common fallbacks, so here they run on fewer seeds (AOTL_FULL=1 runs them on 1 to 500).
// node qa/ahead-of-the-light/course.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import { buildLeg, legSeed, PIECES, piecesOf, passCount, teaching, hashItems } from
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

const FULL = process.env.AOTL_FULL === '1';
const COURSE = fileURLToPath(new URL('../../public/ahead-of-the-light/core/course/', import.meta.url));
const FIRST = Object.freeze({});                               // a player's first run: every teaching piece
const LATER = Object.freeze({ runs: 4, goodWhip: true });     // nothing left to teach
const FAMS = ['SKIM', 'WELL', 'SHIP', 'RIVAL'];
const OURS = ['web', 'coma'];                                  // the legs WP2 owns
const lanesOf = (type) => Object.keys(LEG_TYPES[type].lanes);

// The lane variants a leg can fly: each lane, and a FAMILY lane once per family.
function variants(type) {
  const out = [];
  for (const name of lanesOf(type)) {
    const L = LEG_TYPES[type].lanes[name];
    if (L.kind === 'family') for (const fam of [null, ...FAMS]) out.push({ name, fam });
    else out.push({ name, fam: null });
  }
  return out;
}

// ---------- golden hashes (seeds 1 to 3, first run and later runs) ----------
const GOLDEN = {
  'web|THE FILAMENT|first': ['1j5hdeu', 'g62l4c', '1t74ph8'],
  'web|THE FILAMENT|later': ['tu8dos', '7egm4k', '1bbvtvs'],
  "coma|COMA'S HEART|first": ['1hd4vb3', '1sdohc2', 'hzf5xz'],
  "coma|COMA'S HEART|later": ['1ofg68o', '86z80d', '6lwrb8'],
  'coma|THE GREAT WALL|first': ['y67jl0', 'fjznc6', '1lvsl89'],
  'coma|THE GREAT WALL|later': ['dqrjor', '1y6ry2r', 'rp6uc1'],
};

test('same seed, type, lane and mods give the same hash; golden hashes for seeds 1 to 3 of every leg and lane', () => {
  const now = {};
  for (const type of OURS) {
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

test('every leg type × every lane × seeds 1 to 500 passes R1 to R13 (legs 1 and 2; legs 3 to 8 on fewer seeds)', () => {
  for (const type of ROUTE) {
    const n = OURS.includes(type) || FULL ? 500 : 12;
    for (const v of variants(type)) {
      for (let s = 1; s <= n; s++) {
        const seen = s % 2 ? FIRST : LATER;
        const L = buildLeg({ runSeed: s, type, lane: v, seen });
        assert.ok(L.report.ok, `${type} ${v.name} ${v.fam || ''} seed ${s}: ${JSON.stringify(L.report.errors)}`);
        const again = validateLeg(L);
        assert.ok(again.ok, 'validateLeg agrees with the build');
        for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13']) {
          assert.ok(again.rules[r], `${r} ran`);
        }
      }
    }
  }
});

test('legs 1 and 2 are never empty and bring a set piece every 5 to 10 s', () => {
  const SET = new Set(['wall', 'gate', 'well', 'rail', 'pickup']);
  for (const type of OURS) {
    for (const v of variants(type)) {
      for (let s = 1; s <= 100; s++) {
        const L = buildLeg({ runSeed: s, type, lane: v, seen: s % 2 ? FIRST : LATER });
        assert.ok(L.report.quiet <= 5, `${type} seed ${s}: ${L.report.quiet} beats with nothing at ${L.report.quietAt}`);
        // a line choice (a wall, a gate or pair, a well, a rail, a pickup, or THREAD OR DOCK) at least every 18 beats:
        // 9.6 s at cruise, 8.5 s at 0.9c
        const launch = L.sections[0].b1;
        const at = L.items.filter((it) => SET.has(it.kind) || (it.kind === 'cue' && it.name === 'gateCall'))
          .flatMap((it) => (it.end !== undefined ? [it.beat, it.end] : [it.beat])).filter((b) => b >= launch)
          .sort((a, b) => a - b);
        let prev = launch;
        for (const b of at) {
          assert.ok(b - prev <= 18, `${type} seed ${s}: ${b - prev} beats from ${prev} with no set piece`);
          prev = Math.max(prev, b);
        }
      }
    }
  }
});

test('the trap check fails a fixture of lab A\'s old P1-4 layout and passes today\'s', () => {
  const conv = (it) => {
    if (it.kind === 'knot') return knot(it.beat, it.psi, it.half);
    if (it.kind === 'rail') return rail(it.beat, it.end, it.psi, it.half);
    if (it.kind === 'wall') return wall(it.beat, [{ psi: it.psi, w: 2 * it.gap }]);
    if (it.kind === 'gate') return { kind: 'gate', beat: it.beat, psi: it.psi, gap: 2 * it.gap,
      halves: [it.half, it.half], pair: !!it.pair };
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

test('the validator catches unfair layouts', () => {
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
  assert.ok(!R([fuel(6, 0)], 10, ['R10']).ok, 'a fuel cell on the safe line');
  assert.ok(R([knot(6, 7.5, 3), fuel(6, 0)], 10, ['R10']).ok, 'a fuel cell a hairline from a knot');
  assert.ok(!R([knot(6, 2, 3), fuel(6, 0)], 10, ['R10']).ok, 'a fuel cell inside a knot');
  // R1: eight knots inside the ring at once
  assert.ok(!R([0, 1, 2, 3, 4, 5, 6, 7].map((k) => knot(6 + k * 0.25, -150 + k * 40, 2)), 12, ['R1']).ok);
});

// A piece alone in a leg: 6 empty beats, the piece placed at `angle` (mirrored or not), 6 beats after.
function pieceLeg(pc, { angle = 0, m = 1, seed = 1, safe = true } = {}) {
  const len = pc.beats === 'rest' ? 24 : pc.beats[1];
  const rnd = mulberry32(hashSeed('piece', pc.id, seed));
  const p = {};
  for (const [k, [lo, hi]] of Object.entries(pc.params)) p[k] = safe ? pc.safe[k] : lo + Math.floor(rnd() * (hi - lo + 1));
  const ctx = { len, p, rnd, density: 1, opts: {}, legNo: 1, type: 'coma', skin: 'coma', T: TUNE, mods: {}, first: false,
    lane: null, gate: 'gate-virgo' };
  const built = pc.build(ctx);
  const items = built.items.filter((it) => it.beat < len + 1e-9 || it.kind === 'cue')
    .map((it) => ({ ...place(it, 6, angle, m), piece: pc.id }));
  items.sort((a, b) => a.beat - b.beat);
  return { beats: len + 12, items, sections: [{ role: 'launch', b0: 0, b1: 6, ids: [] },
    { role: pc.roles[0], id: pc.id, ids: [pc.id], b0: 6, b1: 6 + len }] };
}

test('every piece\'s safe params pass alone, mirrored and at every angle', () => {
  const rules = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R10'];
  for (const pc of Object.values(PIECES)) {
    assert.ok(Object.keys(pc.params).length <= 3, `${pc.id}: at most three params`);
    for (const k of Object.keys(pc.params)) {
      const [lo, hi] = pc.params[k];
      assert.ok(Number.isInteger(lo) && Number.isInteger(hi) && lo <= hi, `${pc.id}.${k} is an integer range`);
      assert.ok(pc.safe[k] >= lo && pc.safe[k] <= hi, `${pc.id}.${k}: its safe value is in range`);
    }
    for (let angle = 0; angle < 360; angle += 15) {
      for (const m of [1, -1]) {
        const L = pieceLeg(pc, { angle, m });
        const r = validateLeg(L, { rules });
        assert.ok(r.ok, `${pc.id} at ${angle}° ${m < 0 ? 'mirrored' : ''}: ${JSON.stringify(r.errors)}`);
      }
    }
  }
});

test('no piece repeats in a run; teaching pieces appear only while unseen', () => {
  for (let s = 1; s <= 100; s++) {
    const used = new Set();
    for (const type of ROUTE) {
      const lane = lanesOf(type)[s % lanesOf(type).length];
      const L = buildLeg({ runSeed: s, type, lane, seen: LATER, used });
      for (const id of piecesOf(L)) {
        assert.ok(!used.has(id) || !OURS.includes(type), `seed ${s}: ${id} repeats on ${type}`);
        used.add(id);
      }
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

test('fuel count and spacing per leg; no pickup within 6° of the safe line', () => {
  for (const type of OURS) {
    for (const v of variants(type)) {
      for (let s = 1; s <= 200; s++) {
        const L = buildLeg({ runSeed: s, type, lane: v, seen: LATER });
        const groups = new Map();
        for (const p of L.pickups) if (p.type === 'fuel') groups.set(p.group || `id${p.id}`, p.beat);
        let want = TUNE.FUEL_PER_LEG[ROUTE.indexOf(type)];
        if (v.fam && FAMILY_EDITS[v.fam].fuel) want += FAMILY_EDITS[v.fam].fuel;
        const must = L.pickups.filter((p) => p.type === 'fuel' && p.must);
        const mustGroups = new Set(must.map((p) => p.group || `id${p.id}`)).size;
        assert.equal(groups.size, Math.max(want, mustGroups), `${type} ${v.name} ${v.fam} seed ${s}: fuel groups`);
        // one per third where the third has a slot, so cells are spread, never bunched
        if (want >= 3) {
          const beats = [...groups.values()].sort((a, b) => a - b);
          for (let i = 1; i < beats.length; i++) assert.ok(beats[i] - beats[i - 1] >= 3, `${type} seed ${s}: cells ${beats}`);
        }
        const patches = L.pickups.filter((p) => p.type === 'patch');
        assert.equal(patches.length, LEG_TYPES[type].patch ? 1 : 0, `${type} seed ${s}: the patch`);
        if (patches.length) assert.ok(Math.abs(patches[0].beat - L.beats * TUNE.PATCH_AT) <= L.beats * 0.3);
        const r = validateLeg(L, { rules: ['R10'] });
        assert.ok(r.ok, `${type} seed ${s}: ${JSON.stringify(r.errors)}`);
      }
    }
  }
  // the burn lesson: on a first run the leg's fuel cell sits a hairline from the beat-12 knot of the intro
  const first = buildLeg({ runSeed: 7, type: 'web', seen: FIRST });
  const cell = first.pickups.find((p) => p.piece === 'web-first-knots');
  assert.ok(cell && cell.must, 'the intro\'s cell always spawns');
  const burn = first.items.find((it) => it.kind === 'cue' && it.name === 'burn');
  assert.ok(burn && burn.beat > cell.beat, 'FLICK UP TO BURN comes right after it');
});

test('RISK adds exactly 16 beats; VOID has no pickups, wells or rivals, is × 0.6, and sets no drag and no burn cap; '
  + 'FAMILY edits touch only the build', () => {
  for (let s = 1; s <= 30; s++) {
    const risk = buildLeg({ runSeed: s, type: 'coma', lane: "COMA'S HEART" });
    const fam = buildLeg({ runSeed: s, type: 'coma', lane: 'THE GREAT WALL' });
    assert.equal(risk.beats - fam.beats, TUNE.RISK_BEATS);
    assert.equal(fam.beats, LEG_TYPES.coma.beats);
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
    for (const f of FAMS) {
      const e = buildLeg({ runSeed: s, type: 'coma', lane: { name: 'THE GREAT WALL', fam: f } });
      const same = (a, b) => a.role === b.role && a.ids.join() === b.ids.join() && JSON.stringify(a.params)
        === JSON.stringify(b.params) && a.b1 - a.b0 === b.b1 - b.b0;
      e.sections.forEach((sec, i) => {
        const base = fam.sections[i];
        if (f === 'RIVAL') {
          if (sec.role === 'open') assert.equal((sec.b1 - sec.b0) - (base.b1 - base.b0), FAMILY_EDITS.RIVAL.open);
          else assert.ok(same(sec, base), `RIVAL touches only the open road (${sec.role})`);
        } else if (sec.role === 'build') {
          assert.equal(sec.ids[0], FAMILY_EDITS[f].piece, `${f} puts its piece in the build`);
        } else assert.ok(same(sec, base), `${f} touches only the build (${sec.role}: ${sec.ids} vs ${base.ids})`);
      });
      if (f === 'RIVAL') assert.equal(e.field.drifters, fam.field.drifters + FAMILY_EDITS.RIVAL.drifters);
      if (f === 'SHIP') assert.equal(e.rules.patchAlways, true);
    }
  }
});

test('every leg\'s opener and build pools hold at least 3 pieces (Earth excepted)', () => {
  for (const type of ROUTE) {
    const def = LEG_TYPES[type];
    for (const role of ['opener', 'build']) {
      const sec = def.sections.find((x) => x[0] === role);
      const ids = new Set(sec[2].map((e) => (Array.isArray(e) ? e[0] : e)));
      if (type !== 'earth') assert.ok(ids.size >= 3, `${type} ${role}: ${[...ids]}`);
      if (OURS.includes(type)) for (const id of ids) assert.ok(PIECES[id], `${type} ${role}: ${id} is written`);
    }
    for (const name of lanesOf(type)) assert.equal(laneOf(type, name).name, name);
  }
  for (const id of COMMON_FLOW) assert.ok(PIECES[id], `common ${id}`);
  for (const id of ['gate-coma', 'gate-virgo', 'gate-local', 'gate-milky-way', 'gate-orion-arm', 'gate-bubble',
    'gate-sun']) assert.ok(PIECES[id], id);
  for (const type of ROUTE) if (type !== 'earth') assert.ok(PIECES[LEG_TYPES[type].gate], `${type}'s gate`);
});

test('each condition builds, validates on every lane it can land on, and never touches the light', () => {
  const LIGHT = ['GAP', 'BLEED', 'TTC', 'GLARE', 'CAP', 'gap', 'bleed', 'ttc', 'cap', 'light'];
  const n = FULL ? 500 : 6;
  for (const [cid, C] of Object.entries(CONDITIONS)) {
    for (const r of Object.keys(C.rules || {})) assert.ok(!LIGHT.some((w) => r.includes(w)), `${cid}: ${r}`);
    for (const type of ROUTE.slice(2)) {
      for (const name of lanesOf(type)) {
        if (LEG_TYPES[type].lanes[name].kind === 'void') continue;
        for (let s = 1; s <= n; s++) {
          const L = buildLeg({ runSeed: s, type, lane: { name, cond: cid } });
          assert.ok(L.report.ok, `${cid} on ${type} ${name} seed ${s}: ${JSON.stringify(L.report.errors)}`);
          assert.equal(L.lane.cond, cid);
          const base = buildLeg({ runSeed: s, type, lane: { name } });
          assert.equal(L.beats, base.beats, 'a condition never changes the length');
          for (const k of ['noDrag', 'burnCap']) assert.equal(L.rules[k], base.rules[k]);
          if (cid === 'dust') assert.ok(L.items.some((it) => it.kind === 'fog'));
          if (cid === 'flares') assert.ok(L.items.some((it) => it.kind === 'pulse'));
          if (cid === 'rich') assert.ok(L.pickups.filter((p) => p.type === 'fuel').length
            > base.pickups.filter((p) => p.type === 'fuel').length);
          if (cid === 'tides') assert.ok(L.sections.find((x) => x.role === 'build').ids.includes('hub-hop'));
        }
      }
    }
  }
});

test('makeChart never puts a condition on the VOID or the same one on two legs in a row', () => {
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

test('gateWell changes only the gate', () => {
  for (const type of OURS) {
    for (let s = 1; s <= 30; s++) {
      const a = buildLeg({ runSeed: s, type });
      const b = buildLeg({ runSeed: s, type, mods: { gateWell: true } });
      const g = b.sections.findIndex((x) => x.role === 'gate');
      const before = (L) => L.items.filter((it) => it.sec !== g).map(({ id, ...rest }) => rest);
      assert.deepEqual(before(b), before(a), 'everything before the gate is the same');
      const wa = a.items.filter((it) => it.sec === g), wb = b.items.filter((it) => it.sec === g);
      assert.equal(wb.length, wa.length + 1);
      const W = b.wells.find((w) => w.gateWell);
      assert.ok(W && W.size === 'landmark', 'the larger giant is a landmark well');
      assert.ok(Math.abs(wrap(W.exits[0] - b.gate.psi)) < 1e-6, 'its first band is the THREAD line');
      assert.ok(b.report.ok, JSON.stringify(b.report.errors));
    }
  }
});

// A point strictly inside an arc list, or strictly outside, more than eps from any end.
const nearEdge = (arcs, b, eps = 1e-6) => arcs.some(([f, t]) => Math.abs(wrap(b - f)) < eps || Math.abs(wrap(b - t)) < eps);

test('resolve and blocked agree on 10,000 random samples', () => {
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
    const it = make();
    const beat = it.kind === 'rail' ? r(1, 10) : it.beat;
    const b = r(-180, 180);
    const arcs = blocked(it, beat, [], TUNE.SHIP_HALF, TUNE);
    if (nearEdge(arcs, b)) continue;
    const res = resolve(it, b, beat, TUNE);
    assert.equal(res.hit, inArcs(arcs, b), `${JSON.stringify(it)} at ${b} (beat ${beat})`);
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

test('no Math.sin, cos, tan, exp, pow or random in gen.js and the pieces', () => {
  const files = ['gen.js', ...readdirSync(COURSE + 'pieces').map((f) => 'pieces/' + f)];
  for (const f of files) {
    const src = readFileSync(COURSE + f, 'utf8').replace(/\/\/.*$/gm, '');
    for (const w of ['sin', 'cos', 'tan', 'exp', 'pow', 'random', 'sinh', 'cosh', 'tanh', 'atan2', 'log']) {
      assert.ok(!new RegExp(`Math\\.${w}\\b`).test(src), `${f} calls Math.${w}`);
    }
    assert.ok(!/\*\*/.test(src), `${f} uses **`);
  }
});

test('buildLeg plus validateLeg under 40 ms a leg', () => {
  for (const type of OURS) {
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
});

test('stripSvg writes every leg and lane without throwing', () => {
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

test('the director drops optional items 1.3 to 5 s ahead after your breather, and nothing else', () => {
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
  for (const it of L.items) {
    if (it.beat > lo && it.beat < hi && it.opt) { assert.ok(isDropped(race, it), `${it.id} dropped`); dropped++; }
    if (it.beat <= lo || it.beat >= hi) assert.ok(!isDropped(race, it), `${it.id} kept outside the window`);
    if (!it.opt && it.kind !== 'knot' && it.kind !== 'pulse') assert.ok(!isDropped(race, it), 'structure stays');
  }
  assert.ok(dropped > 3);
  const kept = L.items.filter((it) => it.beat > lo && it.beat < hi && (it.kind === 'knot' || it.kind === 'pulse')
    && !isDropped(race, it));
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
