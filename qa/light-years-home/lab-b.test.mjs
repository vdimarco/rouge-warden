// Lab B, Slingshot Home: the pure core and its bots (design 4.11). Run alone: node qa/light-years-home/lab-b.test.mjs
// The bots wobble, so the skill-spread checks look at five seeds: every seed must clear, and the medians must sit in
// the bands the design asks for.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TUNE, NINES, createState, step, restart, preview, runBot, summary, judgeLine, speedText, rankOf, clockRate,
  holdWindows, letGoTimes, reachAhead,
} from '../../public/light-years-home/lab/b/core.js';
import { COURSE1 } from '../../public/light-years-home/lab/b/course1.js';
import { mulberry32 } from '../../public/light-years-home/core/rng.js';

const H = 1 / 120;
const SEEDS = [1, 2, 3, 4, 5];
const median = (v) => { const a = v.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
const runs = new Map();
function run(name, opts = {}, seed = 1, seconds = 180, tutorial = true) {
  const key = `${name}:${JSON.stringify(opts)}:${seed}:${seconds}:${tutorial}`;
  if (!runs.has(key)) runs.set(key, runBot(name, opts, { seed, seconds, tutorial }));
  return runs.get(key);
}
const cleared = (r) => r.state.phase === 'clear';
const firstOf = (r, type) => r.events.find((e) => e.type === type);
const netGain = (r) => r.state.stats.gained - r.state.stats.grabCost;

// A state flying straight at (x, y) heading dir, with the first mass placed by the test. No tutorial, clock running.
function lab(masses, { pos = [0, 0], dir = [0, 1], eta = 1 } = {}) {
  const course = { name: 'TEST', start: { x: pos[0], y: pos[1] }, masses };
  const s = createState({ course, tutorial: false });
  s.dir = dir.slice();
  s.eta = eta;
  s.started = true;
  s.clockOn = true;
  return s;
}

test('1. the same seed and inputs give the same events and clock', () => {
  const a = runBot('greedy', { jitterMs: 60 }, { seed: 7, seconds: 90 });
  const b = runBot('greedy', { jitterMs: 60 }, { seed: 7, seconds: 90 });
  assert.deepEqual(a.events, b.events);
  assert.equal(a.state.clock, b.state.clock);
  const c = runBot('greedy', { jitterMs: 60 }, { seed: 8, seconds: 90 });
  assert.notDeepEqual(a.events, c.events, 'another seed wobbles differently');
});

test('2. idle makes no progress past mass 1; holder burns at mass 1 again and again', () => {
  const idle = run('idle', {}, 1, 60);
  assert.equal(idle.state.stats.grabs, 0);
  assert.ok(idle.state.stats.reached < 1, 'idle never grabs past mass 1');
  assert.ok(Number.isFinite(idle.state.clock));
  // the first swing runs at half speed until a clean release, so a holder burns more slowly with the tutorial on
  for (const [tutorial, least] of [[false, 5], [true, 3]]) {
    const holder = run('holder', {}, 1, 60, tutorial);
    const burns = holder.events.filter((e) => e.type === 'burn');
    assert.ok(burns.length >= least, `holder (tutorial ${tutorial}) burned ${burns.length} times in 60 s`);
    assert.ok(burns.every((e) => e.mass === 0), 'every burn is at mass 1');
    assert.ok(holder.events.filter((e) => e.type === 'resume').length >= burns.length - 1, 'each burn rewinds');
    assert.equal(holder.state.stats.releases, 0);
  }
});

test('3. exact clears in 40 to 65 s, reaches LIGHT SPEED before mass 12, ends Lightkeeper, rewinds at most once', () => {
  for (const seed of SEEDS) {
    const r = run('exact', {}, seed);
    const sum = r.summary;
    assert.ok(cleared(r), `seed ${seed} clears`);
    assert.ok(sum.time >= 40 && sum.time <= 65, `seed ${seed}: ${sum.time} s`);
    const ls = firstOf(r, 'lightspeed');
    assert.ok(ls && ls.mass < 11, `seed ${seed}: LIGHT SPEED at mass ${ls ? ls.mass + 1 : '-'}`);
    assert.ok(sum.clock <= 1.2, `seed ${seed}: clock ${sum.clock}`);
    assert.equal(sum.rank, 'LIGHTKEEPER');
    assert.ok(r.state.stats.rewinds <= 1, `seed ${seed}: ${r.state.stats.rewinds} rewinds`);
  }
});

test('4. greedy (60 ms, depth 0.8) clears with at most 4 rewinds and a median clock of 1.5 to 3 years', () => {
  const clocks = [];
  for (const seed of SEEDS) {
    const r = run('greedy', { jitterMs: 60, depthMax: 0.8 }, seed);
    assert.ok(cleared(r), `seed ${seed} clears`);
    assert.ok(r.state.stats.rewinds <= 4, `seed ${seed}: ${r.state.stats.rewinds} rewinds`);
    clocks.push(r.summary.clock);
  }
  const m = median(clocks);
  assert.ok(m >= 1.5 && m <= 3, `median clock ${m} (${clocks.join(', ')})`);
});

test('5. first (110 ms) clears within 120 s with at most 8 rewinds, ages 4 years or more, no LIGHT SPEED', () => {
  for (const seed of SEEDS) {
    const r = run('first', { jitterMs: 110 }, seed, 120);
    assert.ok(cleared(r), `seed ${seed} clears within 120 s`);
    assert.ok(r.state.stats.rewinds <= 8, `seed ${seed}: ${r.state.stats.rewinds} rewinds`);
    assert.ok(r.summary.clock >= 4, `seed ${seed}: clock ${r.summary.clock}`);
    const ls = firstOf(r, 'lightspeed');
    assert.ok(!ls || ls.mass === COURSE1.masses.length - 1, 'LIGHT SPEED, if at all, only from Coma');
  }
});

test('6. the exact clock is at most a third of the first clock', () => {
  const ex = median(SEEDS.map((s) => run('exact', {}, s).summary.clock));
  const fi = median(SEEDS.map((s) => run('first', { jitterMs: 110 }, s, 120).summary.clock));
  assert.ok(ex <= fi / 3, `exact ${ex}, first ${fi}`);
});

test('7. pressing at closest approach gains at least 25 % more speed than pressing at reach entry', () => {
  let near = 0, early = 0;
  for (const seed of SEEDS) {
    near += netGain(run('greedy', { jitterMs: 60, depthMax: 0.8 }, seed));
    early += netGain(run('greedy', { jitterMs: 60, depthMax: 0.8, pressAtClosest: false }, seed));
  }
  assert.ok(near >= 1.25 * early, `net η gained: closest ${near.toFixed(2)}, entry ${early.toFixed(2)}`);
});

test('8. every burn was warned at least 0.45 s ahead; mass 1 is in reach by 0.5 s; the first grab comes before 3 s', () => {
  const all = [run('holder', {}, 1, 60), ...SEEDS.map((s) => run('greedy', { jitterMs: 60, depthMax: 0.8 }, s)),
    ...SEEDS.map((s) => run('exact', {}, s)), ...SEEDS.map((s) => run('first', { jitterMs: 110 }, s, 120))];
  let burns = 0;
  for (const r of all) {
    for (let i = 0; i < r.events.length; i++) {
      const e = r.events[i];
      if (e.type !== 'burn') continue;
      burns++;
      let warn = null;
      for (let k = i - 1; k >= 0 && !warn; k--) {
        const w = r.events[k];
        if (w.type === 'resume' || w.type === 'release' && w.t < e.t - 3) break;
        if (w.type === 'warn' && w.mass === e.mass) warn = w;
      }
      assert.ok(warn, `burn at ${e.t} s had a warning`);
      assert.ok(e.t - warn.t >= 0.45 - 1e-6, `burn at ${e.t} s warned ${(e.t - warn.t).toFixed(3)} s ahead`);
    }
  }
  assert.ok(burns > 5, `${burns} burns checked`);
  const s = createState();
  let reachAt = null;
  for (let i = 0; i < 120 && reachAt === null; i++) {
    for (const e of step(s, { down: false }, H)) if (e.type === 'reach' && e.mass === 0) reachAt = e.t;
  }
  assert.ok(reachAt !== null && reachAt <= 0.5, `mass 1 in reach at ${reachAt} s`);
  for (const seed of SEEDS) {
    const g = firstOf(run('exact', {}, seed), 'grab');
    assert.ok(g.t < 3, `exact grabs first at ${g.t} s`);
  }
});

test('9. from a burn to the first frame that takes input is at most 1.3 s', () => {
  const s = createState();
  let burnAt = null, resumeAt = null, held = 0;
  for (let i = 0; i < 120 * 20 && resumeAt === null; i++) {
    const near = s.near >= 0;
    if (s.phase === 'hold') held++;
    for (const e of step(s, { down: s.phase === 'hold' || (near && burnAt === null) }, H)) {
      if (e.type === 'burn') burnAt = e.t;
      if (e.type === 'resume') resumeAt = e.t;
    }
  }
  assert.ok(burnAt !== null && resumeAt !== null);
  assert.ok(resumeAt - burnAt <= 1.3 + 1e-6, `input back after ${(resumeAt - burnAt).toFixed(3)} s`);
  assert.equal(s.phase, 'fly');
  // a fresh press now is taken: fly on into reach, then press
  for (let i = 0; i < 240 && s.near < 0; i++) step(s, { down: false }, H);
  step(s, { down: true }, H);
  assert.equal(s.phase, 'hold', 'the press after the rewind grabs');
});

test('10. 10,000 steps of random presses and random dt give no NaN and no error', () => {
  let r = 12345;
  const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  for (const toy of [false, true]) {
    const s = createState({ seed: 3, toy });
    for (let i = 0; i < 10000; i++) {
      step(s, { down: rnd() < 0.5 }, rnd() < 0.05 ? rnd() * 0.4 : rnd() * 0.03);
      for (const v of [s.pos[0], s.pos[1], s.dir[0], s.dir[1], s.eta, s.clock, s.depth, s.t, s.real]) {
        assert.ok(Number.isFinite(v), `step ${i}: ${JSON.stringify({ pos: s.pos, eta: s.eta, clock: s.clock })}`);
      }
      if (s.phase === 'clear') restart(s);
      preview(s);
    }
  }
});

// ---------- the spec's scenarios ----------

test('a press alongside costs nothing; a press heading straight in costs 0.35 and starts wide', () => {
  const side = lab([{ kind: 'medium', x: 5, y: 0 }], { eta: 2 });
  step(side, { down: true }, H);
  assert.equal(side.phase, 'hold');
  assert.ok(2 - side.eta < 0.005, `cost ${2 - side.eta}`);
  const head = lab([{ kind: 'medium', x: 0, y: 10 }], { eta: 2 });
  step(head, { down: true }, H);
  assert.equal(head.phase, 'hold');
  assert.ok(Math.abs(2 - head.eta - 0.35) < 0.01, `cost ${2 - head.eta}`);
  assert.ok(head.depth < 0, 'the orbit starts outside the latch ring');
});

test('deep is slow: at depth 0.8 the world runs at 52 %', () => {
  const s = lab([{ kind: 'medium', x: 6, y: 0 }]);
  step(s, { down: true }, H);
  s.depth = 0.8;
  step(s, { down: true }, H);
  assert.ok(Math.abs(s.timeScale - 0.52) < 1e-9, `time scale ${s.timeScale}`);
});

test('a deep PERFECT off a medium mass pays about 0.54 with no chain and no skip', () => {
  const s = lab([{ kind: 'medium', x: 0, y: 0 }, { kind: 'medium', x: 0, y: 30 }], { pos: [-6, 0] });
  step(s, { down: true }, H);
  assert.equal(s.phase, 'hold');
  // put the ship at depth 0.8 where the tangent runs through the next ring's band, then lift
  const m = s.course.masses[0], n = s.course.masses[1];
  s.depth = 0.8;
  const r = m.R * (1 - 0.7 * 0.8);
  const mid = 0.5 * (TUNE.BAND_IN + TUNE.BAND_OUT) * n.R;
  let best = null;
  for (let a = -Math.PI; a < Math.PI; a += 0.0005) {
    const pos = [m.x + r * Math.cos(a), m.y + r * Math.sin(a)];
    const dir = [-Math.sin(a) * s.orbitSign, Math.cos(a) * s.orbitSign];
    const j = judgeLine(s, pos, dir, m.to);
    if (j.target === 1 && (!best || j.lat < best.lat)) best = { a, lat: j.lat };
  }
  assert.ok(best && best.lat < 0.05);
  s.ang = best.a - s.orbitSign * 0.5 * (180 + 60 * 0.8) * Math.PI / 180 * H;
  s.depth = 0.8 - TUNE.REEL * H;
  step(s, { down: true }, H);
  const ev = step(s, { down: false }, H).find((e) => e.type === 'release');
  assert.equal(ev.grade, 'PERFECT');
  assert.ok(Math.abs(ev.gain - 0.54) < 0.03, `gain ${ev.gain}`);
});

test('the first nine-up fires at η 1.472 and shows 0.9000c with the 9 hot', () => {
  assert.ok(Math.abs(NINES[0] - 1.472) < 0.001 && Math.abs(NINES[3] - 4.952) < 0.001);
  assert.equal(speedText(1).text, '0.7615c');
  const t = speedText(NINES[0] + 1e-6);
  assert.equal(t.text, '0.9000c');
  assert.equal(t.text[t.hot], '9');
  assert.equal(speedText(TUNE.LS_ETA).text, '0.99990c');
  const r = run('exact', {}, 1);
  const nine = firstOf(r, 'nine');
  assert.ok(nine && nine.level === 1 && nine.eta >= NINES[0]);
});

test('a WIDE at LIGHT SPEED drops you to η 3.8; burns keep the clock running', () => {
  const s = lab([{ kind: 'medium', x: 6, y: 0 }, { kind: 'medium', x: 60, y: 60 }], { eta: 5 });
  s.ls = true;
  step(s, { down: true }, H);
  const ev = step(s, { down: false }, H);
  const rel = ev.find((e) => e.type === 'release');
  assert.ok(rel.grade === 'WIDE' || rel.grade === 'MISS');
  assert.ok(ev.some((e) => e.type === 'dropout'));
  assert.ok(Math.abs(s.eta - 3.8) < 1e-9 && !s.ls);
  // hold into the core: the clock keeps running through the burn and the rewind
  const b = lab([{ kind: 'medium', x: 6, y: 0 }], { eta: 2 });
  step(b, { down: true }, H);
  let atBurn = null;
  for (let i = 0; i < 120 * 12 && b.phase !== 'fly' || atBurn === null; i++) {
    for (const e of step(b, { down: b.phase === 'hold' }, H)) if (e.type === 'burn') atBurn = b.clock;
    if (i > 120 * 20) break;
  }
  assert.ok(atBurn !== null && b.clock > atBurn, `clock ${b.clock} after the rewind, ${atBurn} at the burn`);
});

test('a burn at η 2 comes back at η 1.7 on the approach, after a hold and a 0.9 s rewind', () => {
  const s = lab([{ kind: 'medium', x: 6, y: 20 }], { eta: 2 });
  const seen = [];
  for (let i = 0; i < 120 * 12 && !seen.some((e) => e.type === 'resume'); i++) {
    // press as the mass comes alongside (no grab cost), then hold into the core
    for (const e of step(s, { down: (s.near >= 0 && s.nearC < 0.1) || s.phase === 'hold' }, H)) seen.push(e);
  }
  const burn = seen.find((e) => e.type === 'burn'), rw = seen.find((e) => e.type === 'rewind');
  const back = seen.find((e) => e.type === 'resume');
  assert.ok(burn && rw && back);
  assert.ok(Math.abs(back.t - rw.t - TUNE.REWIND_S) < 0.02);
  assert.ok(Math.abs(s.eta - 1.7) < 0.02, `η ${s.eta}`);
});

test('Coma ends the stage with the vista; ranks and the clock rate', () => {
  const r = run('exact', {}, 2);
  const types = r.events.map((e) => e.type);
  const i = types.lastIndexOf('release');
  assert.deepEqual(types.slice(i + 1).filter((t) => t === 'vista' || t === 'clear'), ['vista', 'clear']);
  assert.equal(r.events[i].mass, COURSE1.masses.length - 1);
  assert.equal(rankOf(1.2), 'LIGHTKEEPER');
  assert.equal(rankOf(2.4), 'NAVIGATOR');
  assert.equal(rankOf(4.9), 'WAYFINDER');
  assert.equal(rankOf(5.1), 'DRIFTER');
  assert.ok(clockRate(1, TUNE) > 10 * clockRate(4, TUNE));
  const sum = summary(r.state);
  for (const k of ['clock', 'rank', 'top', 'perfectPct', 'maxChain', 'burns', 'losts', 'time', 'branch']) assert.ok(k in sum);
});

test('the preview line runs 70 u ahead and marks a skip', () => {
  const s = createState();
  for (let i = 0; i < 240 && s.phase === 'fly'; i++) step(s, { down: s.near >= 0 && s.nearC < 0.3 }, H);
  assert.equal(s.phase, 'hold');
  const p = preview(s);
  assert.ok(Math.abs(Math.hypot(p.line[2] - p.line[0], p.line[3] - p.line[1]) - 70) < 1e-6);
  let skip = false;
  for (let i = 0; i < 400 && s.phase === 'hold'; i++) {
    step(s, { down: true }, H);
    if (s.phase === 'hold' && preview(s).skip) skip = true;
  }
  assert.ok(skip, 'some line on the orbit lines up with the mass after next');
});

// ---------- playtest fixes ----------

test('a press at the core catches at depth 0.6, and its burn is warned at least a second ahead', () => {
  const s = lab([{ kind: 'medium', x: 2, y: 0 }]);               // the ship 2 u from the centre: depth 0.95
  const grab = step(s, { down: true }, H).find((e) => e.type === 'grab');
  assert.ok(grab && grab.caught, 'the catch is clamped');
  assert.ok(Math.abs(s.depth - TUNE.GRAB_DMAX) < 0.01, `depth ${s.depth}`);
  let warn = null, burn = null;
  for (let i = 0; i < 120 * 10 && !burn; i++) {
    for (const e of step(s, { down: true }, H)) {
      if (e.type === 'warn') warn = e;
      if (e.type === 'burn') burn = e;
    }
  }
  assert.ok(warn && burn);
  assert.ok(warn.t - grab.t >= 1, `warned ${(warn.t - grab.t).toFixed(2)} s after the grab`);
  assert.ok(burn.t - warn.t >= 0.45, `burned ${(burn.t - warn.t).toFixed(2)} s after the warning`);
});

test('a line into a core grades MISS, a line inside 0.45 R is WIDE at best, the band is PERFECT', () => {
  const s = lab([{ kind: 'medium', x: 0, y: 30 }]);
  const at = (x) => judgeLine(s, [x, 0], [0, 1], [0]);
  const into = at(0);
  assert.equal(into.grade, 'MISS');
  assert.ok(into.core);
  assert.equal(at(0.4 * 6).grade, 'WIDE');
  assert.equal(at(0.74 * 6).grade, 'PERFECT');
  // another core in the way spoils a line that would be PERFECT on its target
  const t = lab([{ kind: 'medium', x: 0, y: 60 }, { kind: 'small', x: 4.44, y: 30 }]);
  assert.equal(judgeLine(t, [4.44, 0], [0, 1], [0]).grade, 'MISS');
});

test('a line that reaches nothing is lost at once; a long line toward a mass is never lost early', () => {
  const far = lab([{ kind: 'medium', x: 0, y: 60 }]);              // 3.3 s of flight before its reach
  const seen = [];
  for (let i = 0; i < 120 * 4 && far.near < 0; i++) seen.push(...step(far, { down: false }, H));
  assert.ok(!seen.some((e) => e.type === 'lost'), 'not lost on the way');
  assert.ok(far.near === 0, 'it reaches the mass');
  const off = lab([{ kind: 'medium', x: 0, y: 60 }], { dir: [1, 0] });
  assert.equal(reachAhead(off), -1);
  let lostAt = null;
  for (let i = 0; i < 120 * 3 && lostAt === null; i++) {
    for (const e of step(off, { down: false }, H)) if (e.type === 'lost') lostAt = e.t;
  }
  assert.ok(lostAt !== null && lostAt <= TUNE.LOST_GRACE + 0.05, `lost at ${lostAt}`);
});

test('the nine-up fanfare is for a new best only, and a press that costs a nine says so', () => {
  let again = 0;
  for (const seed of SEEDS) {
    let best = 0;
    for (const e of run('greedy', { jitterMs: 60, depthMax: 0.8 }, seed).events) {
      if (e.type !== 'nine') continue;
      assert.equal(e.first, e.level > best, `seed ${seed}: nine ${e.level} (best ${best}) first ${e.first}`);
      if (!e.first) again++;
      best = Math.max(best, e.level);
    }
  }
  assert.ok(again > 0, 'some runs climb back to a nine they had');
  const s = lab([{ kind: 'medium', x: 0, y: 10 }], { eta: 1.6 });
  s.nines = s.bestNines = 1;
  const ev = step(s, { down: true }, H);
  assert.ok(ev.some((e) => e.type === 'ninedrop' && e.level === 0), 'a press heading straight in drops below 0.9c');
});

test('the first swing runs at half speed with wide windows; a retry without the tutorial does not', () => {
  const press = (s) => {
    for (let i = 0; i < 480 && s.phase === 'fly'; i++) step(s, { down: s.near >= 0 && s.nearC < 0.3 }, H);
  };
  const a = createState();
  press(a);
  assert.equal(a.phase, 'hold');
  assert.equal(a.holdX, TUNE.TUT_HOLD_X);
  assert.ok(Math.abs(a.sweep - 0.5 * (TUNE.SWEEP0 + TUNE.SWEEP_DEEP * Math.max(0, a.depth))) < 1);
  assert.equal(a.clock, 0, 'the clock waits for the first fling');
  const b = createState({ tutorial: false });
  let slowed = false;
  for (let i = 0; i < 480 && b.phase === 'fly'; i++) {
    step(b, { down: b.near >= 0 && b.nearC < 0.3 }, H);
    if (b.phase === 'fly' && b.timeScale < 0.9) slowed = true;
  }
  assert.ok(!slowed, 'no slow world at mass 1');
  assert.equal(b.holdX, 1);
});

test('LET GO shows a quarter second before a window, never in the first 0.4 s; a lift on the aim is clean', () => {
  for (const seed of SEEDS) {
    for (const tutorial of [true, false]) {
      const s = createState({ seed, tutorial });
      for (let i = 0; i < 480 && s.phase === 'fly'; i++) step(s, { down: s.near >= 0 && s.nearC < 0.2 }, H);
      const w = holdWindows(s);
      const cues = letGoTimes(w);
      assert.ok(cues.length > 0, `seed ${seed}: some window to call`);
      for (const c of cues) {
        assert.ok(c.at >= TUNE.LETGO_MIN - 1e-9);
        assert.ok(Math.abs(c.w.aim - c.at - TUNE.LETGO_LEAD) < 1e-9);
      }
      const t0 = s.real;
      while (s.real - t0 < cues[0].w.aim - 1e-6) step(s, { down: true }, H);
      const rel = step(s, { down: false }, H).find((e) => e.type === 'release');
      assert.ok(rel && (rel.grade === 'PERFECT' || rel.grade === 'GOOD'), `seed ${seed}: ${rel && rel.grade}`);
    }
  }
});

// A first-timer who only reacts to what the screen says: press a reaction after HOLD (mass 1), the alongside tick or
// GRAB, and lift a reaction after LET GO.
function novice(seed, react) {
  const s = createState({ seed });
  const rnd = mulberry32(seed * 31 + Math.round(react * 1000));
  const wobble = () => (rnd() - 0.5) * 0.08;
  let down = false, pressAt = null, liftAt = null, cues = null, t0 = 0, k = 0;
  const rel = [];
  for (let i = 0; i < 60 / H && s.phase !== 'clear'; i++) {
    if (s.phase === 'fly') {
      liftAt = null; cues = null;
      if (!s.armed && down) down = false;
      if (pressAt === null && !down && !s.started && s.near >= 0 && s.timeScale < 0.85) pressAt = s.real + react + wobble();
      if (pressAt !== null && s.real >= pressAt) { down = true; pressAt = null; }
    } else if (s.phase === 'hold') {
      pressAt = null;
      if (!cues) { cues = letGoTimes(holdWindows(s)); t0 = s.real; k = 0; }
      while (liftAt === null && k < cues.length) {
        const at = t0 + cues[k++].at;
        if (at >= s.real - 1e-9) liftAt = at + react + wobble();
      }
      if (liftAt !== null && s.real >= liftAt) { down = false; liftAt = null; }
    } else { down = false; pressAt = null; liftAt = null; cues = null; }
    for (const e of step(s, { down }, H)) {
      if (e.type === 'release') rel.push(e);
      if (s.phase !== 'fly' || down) continue;
      if (e.type === 'alongside' && s.started && pressAt === null) pressAt = s.real + react + wobble();
      if (e.type === 'warn' && e.flight && e.save) pressAt = Math.min(pressAt ?? Infinity, s.real + react + wobble());
    }
  }
  return { s, rel };
}

test('a first-timer reacting 200 to 300 ms late to the cues gets past the fork within a minute', () => {
  const reached = [];
  for (const react of [0.2, 0.25, 0.3]) {
    for (const seed of [1, 2, 3]) {
      const { s, rel } = novice(seed, react);
      assert.ok(rel[0] && (rel[0].grade === 'PERFECT' || rel[0].grade === 'GOOD'),
        `react ${react} seed ${seed}: the first fling is ${rel[0] && rel[0].grade}`);
      reached.push(s.phase === 'clear' ? COURSE1.masses.length : s.stats.reached + 1);
    }
  }
  assert.ok(Math.min(...reached) >= 11, `masses reached in 60 s: ${reached.join(' ')}`);
});

test('a skip counts two links of the chain; the clock starts at the first fling', () => {
  let skips = 0;
  for (const seed of SEEDS) {
    let chain = 0;
    for (const e of run('exact', {}, seed).events) {
      if (e.type === 'burn' || e.type === 'lost') chain = 0;
      if (e.type !== 'release') continue;
      const clean = e.grade === 'PERFECT' || e.grade === 'GOOD';
      if (clean && e.skip) { skips++; assert.equal(e.chain, chain + 2); }
      chain = e.chain;
    }
  }
  assert.ok(skips > 0, 'the exact bot skips somewhere');
  const r = run('exact', {}, 1);
  const first = r.events.find((e) => e.type === 'release');
  assert.ok(first && first.t > 1, 'the first fling comes after a swing');
});

test('a retry never starts on a line that skims a core', () => {
  const s = lab([{ kind: 'medium', x: 1, y: 30 }]);                // straight at the core, 0.17 R off
  let resume = null;
  for (let i = 0; i < 120 * 20 && !resume; i++) {
    for (const e of step(s, { down: false }, H)) if (e.type === 'resume') resume = e;
  }
  assert.ok(resume, 'the flight burned and rewound');
  assert.equal(resume.nudged, 0);
  const m = s.course.masses[0];
  const pass = Math.abs(s.dir[0] * (m.y - s.pos[1]) - s.dir[1] * (m.x - s.pos[0])) / m.R;
  assert.ok(pass >= TUNE.CORE_SAFE, `the retry line passes at ${pass.toFixed(2)} R`);
});

test('?toy keeps only the masses near the ship, however long you fly', () => {
  const s = createState({ seed: 4, toy: true, tutorial: false });
  let lift = null;
  for (let i = 0; i < 600 / H; i++) {
    let down = false;
    if (s.phase === 'fly') { lift = null; down = s.near >= 0 && s.nearC < 0.1; } else if (s.phase === 'hold') {
      // let go on the first window's aim, or after a second if there is none
      if (lift === null) { const c = holdWindows(s).cues.find((w) => w.aim > 0.2); lift = s.holdT + (c ? c.aim : 1); }
      down = s.holdT < lift - 1e-6;
    }
    step(s, { down }, H);
  }
  const live = s.course.masses.length - s.lo;
  assert.ok(s.course.masses.length > 100, `${s.course.masses.length} masses made`);
  assert.ok(live < 40, `${live} masses still checked each step`);
});
