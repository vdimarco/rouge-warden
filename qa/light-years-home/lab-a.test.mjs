// Light Years Ahead (lab A): the pure core's contract. Replays are exact, the bots land where the design wants them
// (idle is caught, dodging without grazing is caught, grazing flies home fast, a novice is pushed and a mid player
// clears), alarms come early enough to act on, the first pass comes fast, a retry is quick and skips the intro, Coma
// always lights the Headlight, hairlines never stop the beat, the burst is a tug of war, no one hazard is a trap, and
// nothing breaks under random input.
// node qa/light-years-home/lab-a.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  TUNE, createState, step, restart, simulate, par, BOTS, resolve, secondsTo, ringPx, screenOf, summary, rankOf,
  INTRO_SKIP, RANKS,
} from '../../public/light-years-home/lab/a/core.js';
import { buildStage, gate, knot } from '../../public/light-years-home/lab/a/stage1.js';

const SEEDS = [1, 2, 3, 4, 5];
const DT = 1 / 120;
const NOVICE = { reactMs: 300, jitterDeg: 7, greed: 0.2 };
const MID = { reactMs: 200, jitterDeg: 3, greed: 0.6 };
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

// Run a bot and keep each step's sim time, beat and bearing alongside the events.
function trace(botName, opts, seed) {
  const s = createState({ seed });
  const bot = BOTS[botName]({ seed, ...opts });
  const events = [], steps = [];
  while (s.phase === 'play' && s.rt < 240) {
    const e = step(s, bot(s), DT);
    steps.push({ t: s.t, beat: s.beat, bearing: s.bearing });
    events.push(...e);
  }
  return { s, events, steps };
}

test('same seed and same inputs give the same events and score', () => {
  const a = simulate('human', { ...MID, seed: 3 }, { seed: 3 });
  const b = simulate('human', { ...MID, seed: 3 }, { seed: 3 });
  assert.equal(hash(a.events), hash(b.events));
  assert.equal(a.state.score, b.state.score);
  // and a scripted input stream replays exactly too
  const run = () => {
    const s = createState({ seed: 9 });
    const out = [];
    for (let i = 0; i < 3000 && s.phase === 'play'; i++) {
      out.push(...step(s, { aim: Math.sin(i / 50) * 1.2, turn: i % 400 < 30 ? 1 : 0 }, DT));
    }
    return { e: hash(out), score: s.score };
  };
  assert.deepEqual(run(), run());
  assert.notEqual(hash(buildStage(1)), hash(buildStage(2)), 'the seed changes the swarm');
});

test('idle is caught before beat 90 on seeds 1 to 5', () => {
  for (const seed of SEEDS) {
    const { state } = simulate('idle', {}, { seed });
    assert.equal(state.phase, 'caught', `seed ${seed}`);
    assert.ok(state.beat < 90, `seed ${seed}: caught at beat ${state.beat.toFixed(1)}`);
  }
});

// Changed from the design (dodge was to scrape home): grazes now win lead back, so you have to graze. A clean dodger
// gets past the walls and the rail before the burst catches it.
test('dodge, which never grazes or gets hit, is caught after the rail and scores under 25 % of par', () => {
  for (const seed of SEEDS) {
    const { state } = simulate('dodge', {}, { seed });
    assert.equal(state.phase, 'caught', `seed ${seed}`);
    assert.equal(state.stats.grazes + state.stats.hairs + state.stats.hits, 0, `seed ${seed}: dodge never touches`);
    assert.ok(state.progress > 0.45, `seed ${seed}: caught at ${(state.progress * 100).toFixed(0)} %`);
    assert.ok(state.score < 0.25 * par(seed), `seed ${seed}: ${state.score} vs par ${par(seed)}`);
  }
});

test('graze clears with over 6 s of lead, reaches the Headlight and scores 20 times idle', () => {
  for (const seed of SEEDS) {
    const { state, events } = simulate('graze', {}, { seed });
    const idle = simulate('idle', {}, { seed }).state;
    assert.equal(state.phase, 'clear', `seed ${seed}`);
    assert.ok(state.lead > 6, `seed ${seed}: lead ${state.lead.toFixed(2)}`);
    assert.ok(events.some((e) => e.type === 'headlight'), `seed ${seed}: no Headlight`);
    assert.ok(state.score >= 20 * Math.max(1, idle.score), `seed ${seed}: ${state.score} vs idle ${idle.score}`);
    assert.equal(rankOf(state.score, par(seed), state.stats.hits).letter, 'O');
  }
});

// Changed from the design (mid was to end with 2 to 6 s): with grazes winning lead back, a mid player ends near
// LEAD_MAX. What matters is that they clear and that grazing visibly moved the burst.
test('a novice is pushed hard, and a mid player clears having won lead back by grazing', () => {
  let pushed = 0, midOk = 0;
  const rows = [];
  for (const seed of SEEDS) {
    const n = simulate('human', { ...NOVICE, seed }, { seed }).state;
    const m = simulate('human', { ...MID, seed }, { seed }).state;
    if (n.phase === 'caught' || n.lead < 2.5) pushed++;
    if (m.phase === 'clear' && m.stats.wonLead >= 3) midOk++;
    rows.push(`seed ${seed}: novice ${n.phase} ${n.lead.toFixed(2)} s, mid ${m.phase} ${m.lead.toFixed(2)} s`
      + ` won ${m.stats.wonLead.toFixed(1)}`);
  }
  assert.ok(pushed >= 3, `novice pushed on ${pushed} of 5\n${rows.join('\n')}`);
  assert.ok(midOk >= 4, `mid cleared well on ${midOk} of 5\n${rows.join('\n')}`);
});

test('every hit on a held bearing was alarmed 0.3 s ahead, and every pass lands on its beat', () => {
  for (const [name, opts] of [['idle', {}], ['human', NOVICE], ['human', MID], ['graze', {}]]) {
    for (const seed of [1, 2, 3]) {
      const { s, events, steps } = trace(name, opts, seed);
      const items = new Map(s.items.map((it) => [it.id, it]));
      const beatAt = (t) => {
        let i = steps.findIndex((x) => x.t >= t);
        if (i <= 0) return steps[Math.max(0, i)].beat;
        const a = steps[i - 1], b = steps[i];
        return b.t > a.t ? a.beat + ((t - a.t) / (b.t - a.t)) * (b.beat - a.beat) : b.beat;
      };
      for (const e of events) {
        if (e.type === 'hit' && e.kind !== 'rail') {
          const held = steps.filter((x) => x.t >= e.t - 0.3 && x.t <= e.t);
          const still = held.every((x) => Math.abs(x.bearing - held[held.length - 1].bearing) < 0.5);
          if (!still) continue;
          const alarm = events.find((a) => a.type === 'alarm' && a.id === e.id);
          assert.ok(alarm, `${name} seed ${seed}: hit on ${e.id} with no alarm`);
          assert.ok(alarm.t <= e.t - 0.3 + 1e-6, `${name} seed ${seed}: alarm ${(e.t - alarm.t).toFixed(3)} s ahead`);
        }
        if (['pass', 'graze', 'hair', 'thread'].includes(e.type) || (e.type === 'hit' && e.kind !== 'rail')) {
          const it = items.get(e.id % 1000);
          const gap = Math.abs(beatAt(e.t) - it.beat);
          assert.ok(gap <= 0.01, `${name} seed ${seed}: ${e.type} on ${e.id} is ${gap.toFixed(4)} beats off`);
        }
      }
    }
  }
});

test('the first scripted pass comes before 3.5 s, ticked at least 1.2 s ahead', () => {
  const s = createState({ seed: 1 });
  const events = [];
  while (s.t < 5) events.push(...step(s, { aim: null, turn: 0 }, DT));
  const first = events.find((e) => ['pass', 'graze', 'hair', 'hit', 'bump'].includes(e.type));
  assert.ok(first && first.t < 3.5, `first pass at ${first && first.t}`);
  const tick = events.find((e) => e.type === 'tick' && e.id === first.id);
  assert.ok(tick && first.t - tick.t >= 1.2, `tick ${tick && (first.t - tick.t).toFixed(2)} s ahead`);
  const alarm = events.find((e) => e.type === 'alarm' && e.id === first.id);
  assert.ok(alarm && first.t - alarm.t >= 0.3, 'the first knot is on your line and sounds the alarm');
});

test('from caught, the ship steers again within 1.2 s of the retry', () => {
  const { state } = simulate('idle', {}, { seed: 2 });
  assert.equal(state.phase, 'caught');
  // input unlocks after CAUGHT_LOCK; the card asks for a tap then
  let waited = 0;
  while (state.phaseT < TUNE.CAUGHT_LOCK) { step(state, null, DT); waited += DT; }
  restart(state);
  const t0 = state.rt;
  while (state.rt - t0 < 2) {
    const b = state.bearing;
    step(state, { aim: null, turn: 1 }, DT);
    if (state.phase === 'play' && state.bearing !== b) break;
  }
  assert.ok(state.rt - t0 <= 1.2, `steerable after ${(state.rt - t0).toFixed(3)} s`);
  assert.ok(waited <= 0.45);
  // two catches in a row give a head start
  const s2 = createState({ seed: 4 });
  s2.meta.catches = 2;
  restart(s2);
  assert.equal(s2.lead, TUNE.LEAD0 + TUNE.MERCY);
  step(s2, null, DT);
  assert.ok(s2.lead > TUNE.LEAD0 + TUNE.MERCY - 0.01, 'the head start survives the lead cap');
});

test('10,000 steps of random input and random dt make no NaN and throw nothing', () => {
  let x = 12345;
  const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  const s = createState({ seed: 7 });
  for (let i = 0; i < 10000; i++) {
    const r = rnd();
    const input = r < 0.3 ? { aim: (rnd() - 0.5) * 40, turn: 0 } : r < 0.6 ? { aim: null, turn: Math.floor(rnd() * 3) - 1 }
      : r < 0.62 ? null : r < 0.64 ? { aim: NaN, turn: 'x' } : { aim: null, turn: 0 };
    step(s, input, 0.001 + rnd() * 0.049);
    if (s.phase !== 'play') restart(s, { newSeed: rnd() < 0.3 });
    for (const k of ['t', 'beat', 'bpm', 'eta', 'phiHaz', 'phiSky', 'bearing', 'target', 'score', 'lead', 'progress']) {
      assert.ok(Number.isFinite(s[k]), `${k} is ${s[k]} at step ${i}`);
    }
    for (const h of s.hazards) {
      if (h.kind === 'cue') continue;
      const p = screenOf(s, h, 390);
      assert.ok(!Number.isNaN(p.r) && Number.isFinite(p.D), `screenOf ${h.id}`);
    }
  }
});

test('geometry: the ring is 42 % of the short side at cruise and never under the floor', () => {
  const s = createState({ seed: 1 });
  assert.ok(Math.abs(ringPx(s, 390) / 390 - 0.42) < 0.01);
  s.eta = TUNE.ETA_TOP;
  assert.ok(Math.abs(ringPx(s, 390) - 117) < 1.5, `floor ${ringPx(s, 390)}`);
  s.eta = TUNE.ETA_CAP;
  assert.ok(ringPx(s, 390) >= 112);
  // a hazard beside the ship sits on the ring
  const h = { kind: 'knot', beat: s.beat, psi: 30, half: 3.5 };
  assert.ok(Math.abs(screenOf(s, h, 390).r - ringPx(s, 390)) < 1e-6);
  // the pass check: a 7° graze band outside a 3.5° ship and a 3.5° knot
  assert.equal(resolve({ kind: 'knot', psi: 0, half: 3.5 }, 6.9).hit, true);
  assert.ok(resolve({ kind: 'knot', psi: 0, half: 3.5 }, 8).gaps[0].g < TUNE.HAIR);
  assert.ok(secondsTo(s, s.beat + 1) > 0);
});

test('par runs fast enough to compute at a stage start, and the summary is plain data', () => {
  par(11);
  const t0 = performance.now();
  const p = par(12);
  const ms = performance.now() - t0;
  assert.ok(p > 1000);
  assert.ok(ms < 150, `par took ${ms.toFixed(0)} ms`);
  const { state } = simulate('human', { ...MID, seed: 12 }, { seed: 12 });
  const sm = summary(state, p);
  assert.equal(typeof JSON.stringify(sm), 'string');
  assert.ok('ABFGKMO'.includes(sm.rank));
});

// A one-hazard course: the ship holds bearing b; returns the events up to and including the pass.
function oneHazard(item, b, setup) {
  const s = createState({ seed: 1, script: [{ ...item, id: 0 }] });
  s.bearing = s.target = b;
  if (setup) setup(s);
  const out = [];
  while (s.phase === 'play' && s.beat < item.beat + 0.5) {
    const ev = step(s, { aim: b * Math.PI / 180, turn: 0 }, DT);
    out.push(ev);
  }
  return { s, steps: out };
}

test('threading Coma\'s gate lights the Headlight in the same step, and fires the peak again if already lit', () => {
  const g = gate(24, 0, 30, 9, { coma: true });
  for (const eta of [1.0, 1.8, 2.4]) {
    const { s, steps } = oneHazard(g, 0, (st) => { st.eta = eta; });
    const at = steps.find((ev) => ev.some((e) => e.type === 'thread'));
    assert.ok(at, `eta ${eta}: threaded`);
    assert.ok(at.some((e) => e.type === 'headlight'), `eta ${eta}: Headlight in the same step`);
    assert.ok(s.headlight && s.stats.headlightS > 0, `eta ${eta}: still lit after the step`);
  }
  const { steps } = oneHazard(g, 0, (st) => { st.eta = 2.9; st.headlight = true; });
  const at = steps.find((ev) => ev.some((e) => e.type === 'thread'));
  const peak = at.find((e) => e.type === 'headlight');
  assert.ok(peak && peak.again && peak.coma, 'already lit: the peak fires again');
  // and the bots: every novice and mid who reaches Coma gets the Headlight on the thread
  for (const opts of [NOVICE, MID]) {
    for (const seed of SEEDS) {
      const { events } = simulate('human', { ...opts, seed }, { seed });
      const thr = events.find((e) => e.type === 'thread' && e.coma);
      if (!thr) continue;
      assert.ok(events.some((e) => e.type === 'headlight' && Math.abs(e.t - thr.t) < 0.02), `seed ${seed}: lit on Coma`);
    }
  }
});

test('a hairline never stops the beat clock (the music stays on time); a hit does', () => {
  // knot at bearing 0, ship 8° off: the edge gap is 1°, a hairline
  const { steps, s } = oneHazard(knot(24, 0), 8);
  assert.ok(steps.flat().some((e) => e.type === 'hair'), 'a hairline');
  assert.equal(s.stats.hits, 0);
  assert.equal(s.freeze, 0, 'no hit-stop');
  const before = createState({ seed: 1, script: [] });
  const t0 = before.beat;
  for (let i = 0; i < 300; i++) step(before, null, DT);
  // the same number of steps advances the hairline course exactly as far as an empty one at the same speed
  const empty = createState({ seed: 1, script: [] });
  for (let i = 0; i < steps.length; i++) step(empty, null, DT);
  assert.ok(Math.abs(empty.beat - s.beat) < 0.02 + (s.eta - empty.eta) * 2, `beat ${s.beat} vs ${empty.beat}`);
  assert.ok(before.beat > t0);
  const hitRun = oneHazard(knot(40, 0), 0);
  assert.ok(hitRun.steps.flat().some((e) => e.type === 'hit'));
});

test('the burst is a tug of war: grazes win lead back up to LEAD_MAX, and it warns on time to catch, not on lead', () => {
  const g = oneHazard(knot(30, 0), 12, (st) => { st.lead = 5; });
  const graze = g.steps.flat().find((e) => e.type === 'graze');
  assert.ok(graze, 'a graze');
  assert.ok(g.s.stats.wonLead >= TUNE.LEAD_GRAZE - 1e-9, 'it won lead back');
  const capped = oneHazard(knot(30, 0), 12, (st) => { st.lead = TUNE.LEAD_MAX; });
  assert.ok(capped.s.lead <= TUNE.LEAD_MAX + 1e-9);
  // 2 s of lead at the Headlight's speed is safe (the light gains 0.01 s a second, and a hit leaves 0.5 s): no warning
  const fast = createState({ seed: 1, script: [] });
  fast.eta = 2.8; fast.headlight = true; fast.lead = 2;
  const evFast = [];
  for (let i = 0; i < 240; i++) evFast.push(...step(fast, null, DT));
  assert.ok(!evFast.some((e) => e.type === 'warn'), 'no fake warning at top speed');
  // at cruise, one hit from caught warns at once
  const slow = createState({ seed: 1, script: [] });
  slow.lead = TUNE.HIT_LEAD;
  const evSlow = step(slow, null, DT);
  assert.ok(evSlow.some((e) => e.type === 'warn'), 'a real warning when slow');
  // a hit costs HIT_LEAD
  const h = oneHazard(knot(40, 0), 0, (st) => { st.lead = 6; });
  assert.ok(h.s.stats.lostLead === TUNE.HIT_LEAD);
});

test('a retry after a run past the intro starts at the skip, and its first pass is still fair', () => {
  const { state } = simulate('human', { ...MID, seed: 3 }, { seed: 3 });
  restart(state);
  assert.equal(state.startBeat, INTRO_SKIP);
  assert.equal(state.beat, INTRO_SKIP);
  const events = [];
  while (state.t < 4) events.push(...step(state, null, DT));
  const first = events.find((e) => ['pass', 'graze', 'hair', 'hit', 'bump', 'thread'].includes(e.type));
  assert.ok(first && first.t >= 0.5 && first.t < 2, `first pass at ${first && first.t.toFixed(2)} s`);
  assert.ok(!events.some((e) => e.type === 'hit'), 'the intro knots are still soft');
  // a fresh state (or a run that never got past the intro) starts at 0
  const s2 = createState({ seed: 3 });
  for (let i = 0; i < 400; i++) step(s2, null, DT);
  restart(s2);
  assert.equal(s2.startBeat, 0);
  // and par is measured from the same start
  assert.notEqual(par(3, TUNE, INTRO_SKIP), 0);
});

test('no single hazard is a trap: none causes more than 20 % of novice or mid hits on seeds 1 to 10', () => {
  for (const [name, opts] of [['novice', NOVICE], ['mid', MID]]) {
    const by = new Map();
    let total = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { events } = simulate('human', { ...opts, seed }, { seed });
      for (const e of events) {
        if (e.type !== 'hit') continue;
        total++;
        by.set(`${seed}:${e.id}`, 1);
        const key = `beat ${createState({ seed }).items[e.id % 1000].beat}`;
        by.set(key, (by.get(key) || 0) + 1);
      }
    }
    const worst = [...by.entries()].filter(([k]) => k.startsWith('beat')).sort((a, b) => b[1] - a[1])[0];
    assert.ok(total > 0, `${name}: some hits`);
    assert.ok(worst[1] <= Math.max(2, 0.2 * total), `${name}: ${worst[0]} causes ${worst[1]} of ${total} hits`);
  }
});

test('the soft start: a first-knot pass 10° clear is a graze, so the first zip is easy', () => {
  const { steps } = oneHazard(knot(6, 0), 3.5 + 3.5 + 10);
  assert.ok(steps.flat().some((e) => e.type === 'graze'), 'graze inside GRAZE_SOFT');
  const late = oneHazard(knot(30, 0), 3.5 + 3.5 + 10);
  assert.ok(!late.steps.flat().some((e) => e.type === 'graze'), 'no graze at 10° after the soft start');
});

test('ranks are stars against a human par: experts reach O, mid lands F or better, each class has a next goal', () => {
  let oCount = 0, midOk = 0;
  for (const seed of SEEDS) {
    const e = simulate('human', { reactMs: 140, jitterDeg: 1.2, greed: 0.95, seed }, { seed }).state;
    if (rankOf(e.score, par(seed), e.stats.hits).letter === 'O') oCount++;
    const m = simulate('human', { ...MID, seed }, { seed }).state;
    if ('OBAF'.includes(rankOf(m.score, par(seed), m.stats.hits).letter)) midOk++;
  }
  assert.ok(oCount >= 3, `expert O on ${oCount} of 5`);
  assert.ok(midOk >= 4, `mid F or better on ${midOk} of 5`);
  for (const r of RANKS) assert.ok(r.line, `${r.letter} has a star line`);
  const low = rankOf(100, 100000, 0);
  assert.equal(low.letter, 'M');
  assert.ok(low.next && low.next.letter === 'K' && low.next.score > 100);
  assert.equal(rankOf(200000, 100000, 0).next, null);
});
