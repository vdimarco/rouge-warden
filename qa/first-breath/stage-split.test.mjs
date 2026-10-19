// First Breath: stage 3, The Embryo: first cells (`split`) (design.md 6.3, 4.1, 5.2 to 5.4, 7, 15, 16.4, 18; tasks 2.11
// to 2.14). The same seed and input give the same run; the scripted ideal input reaches Glowing; idle ends by the cap
// with the goal met; the shared bot at 0.7 completes (and at 1.0 glows); one live gesture per moment; every sub-goal
// ends done or auto; every target carries P and is shown at least its preview before; the moments match 4.1; every
// view is valid. Stage checks: 12 taps on her beats 2, 4 and 6 of Days 1 to 4; the split plays on beat 6 by itself;
// bloom and hatch release credits (In time 1, Close 0.5, a held Off release 0.25, never pressed 0, no mash, a fresh
// press); Off taps never reset a count; 250 per day all In time; the facts, sources and strings.
// node qa/first-breath/stage-split.test.mjs
import assert from "node:assert/strict";
import * as split from "../../public/first-breath/core/stages/split.js";
import { TUNE } from "../../public/first-breath/core/stages/split.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/split.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/split.text.js";
import { DEFAULT_CARRY } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate, LIMITS } from "../../public/first-breath/core/draw.js";
import { DT, label } from "../../public/first-breath/core/clock.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { check as checkTargets, previewS } from "../../public/first-breath/core/lib/track.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { say } from "../../public/first-breath/core/text.js";
import { label as factLabel, byId } from "../../public/first-breath/core/facts.js";
import { stream } from "../../public/first-breath/core/rng.js";

const FILE = "qa/first-breath/stage-split.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 10).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const PB = 60 / 72;
const PHASES = [0, 0.31, 0.8];
const MAX_STEPS = Math.ceil((split.meta.capS + 2) / DT);

// Beat n of the stage, read straight from her laid beats: beat 1 is her first beat at or after 1.0 s.
function beatOf(st, n) {
  const M = st.beats.mother;
  let i1 = 0;
  while (M[i1] < 1.0 - 1e-9) i1++;
  return M[i1 + n - 1];
}

// ---- drivers: each returns the intents for the step [st.t, st.t + DT) ----

const idle = () => () => makeIntents();

// Every tap on its time; each release target held from 2 s before and let go on its time.
function ideal({ tapErr = () => 0, holdLead = 2, relErr = () => 0, extra = null } = {}) {
  const mem = { pressed: {}, released: {}, lift: [] };
  return (st) => {
    const t0 = st.t, t1 = t0 + DT;
    const presses = [], releases = [];
    for (const x of split.targets(st, 3)) {
      if (x.kind === "tap") {
        const at = x.t + tapErr(x);
        if (!mem.pressed[x.id] && at < t1) { mem.pressed[x.id] = true; presses.push({ t: Math.max(at, t0), raw: Math.max(at, t0) }); mem.lift.push(Math.max(at, t0) + 0.08); }
      } else {
        if (!mem.pressed[x.id] && x.t - holdLead < t1 && split.prompt(st).gesture === "hold") {
          mem.pressed[x.id] = true; presses.push({ t: Math.max(t0, x.t - holdLead), raw: Math.max(t0, x.t - holdLead) });
        }
        const at = x.t + relErr(x);
        if (mem.pressed[x.id] && !mem.released[x.id] && at < t1) { mem.released[x.id] = true; releases.push({ t: Math.max(at, t0), raw: Math.max(at, t0) }); }
      }
    }
    mem.lift = mem.lift.filter((l) => { if (l < t1) { releases.push({ t: l, raw: l }); return false; } return true; });
    if (extra) extra(st, presses, releases, t0, t1);
    return makeIntents({ presses, releases, touching: presses.length > 0 });
  };
}

// A scripted list of { t, up } events (stage seconds), each delivered in its step.
function script(list) {
  const evs = list.slice().sort((a, b) => a.t - b.t);
  return (st) => {
    const t0 = st.t, t1 = t0 + DT;
    const presses = [], releases = [];
    for (const e of evs) if (e.t >= t0 && e.t < t1) (e.up ? releases : presses).push({ t: e.t, raw: e.t });
    return makeIntents({ presses, releases });
  };
}

function botDriver(skill, seed) {
  const bot = createBot(skill, seed);
  return (st) => bot.intents(split, st);
}

// Random presses and releases (seeded): a stress input.
function randomDriver(seed) {
  const r = stream(seed, "test-random");
  let down = false;
  return (st) => {
    const presses = [], releases = [];
    if (r() < 0.06) { const t = st.t + r() * DT; if (down) releases.push({ t, raw: t }); else presses.push({ t, raw: t }); down = !down; }
    return makeIntents({ presses, releases });
  };
}

// Play one stage to its end. `each(st, i)` sees the state after each step.
function play({ seed = 1, phase = 0, drive = idle(), assist = false, carry = DEFAULT_CARRY, each = null, viewsEvery = 0 } = {}) {
  const st = split.create(seed, carry, { assist, oneButton: false, motherPhase: phase });
  const evs = st.events.splice(0);
  const gestures = {};
  const note = () => { (gestures[st.moment] = gestures[st.moment] || new Set()).add(split.prompt(st).gesture); };
  note();
  const views = [];
  let i = 0;
  for (; i < MAX_STEPS && !split.result(st).done; i++) {
    if (viewsEvery && i % viewsEvery === 0) views.push({ t: st.t, moment: st.moment, v: split.view(st) });
    split.step(st, drive(st));
    for (const e of st.events) evs.push(e);
    st.events.length = 0;
    if (!split.result(st).done) note();
    if (each) each(st, i);
  }
  return { st, evs, gestures, views, res: split.result(st), steps: i };
}

const named = (evs, n) => evs.filter((e) => e.name === n);
const dayOf = (x) => Number(String(x.id).split(".")[2]);     // tap ids are split.<gen>.<day>.<beat>

// ---- meta and the clock ----

await check("meta: the 4.1 moments (24 and 6 of her beats), the 3.1 row and the Stage interface", () => {
  const m = split.meta;
  assert.deepEqual(m.moments.map((x) => x.id), ["split", "bloom", "hatch", "outro"]);
  assert.deepEqual(m.moments.map((x) => [...x.ga]), [[15, 19], [19, 20], [20, 20], [20, 20]]);
  near(m.moments[0].lenS, 24 * PB, 1e-9, "split lenS");
  near(m.moments[1].lenS, 6 * PB, 1e-9, "bloom lenS");
  assert.equal(m.moments[2].lenS, null);
  assert.equal(m.moments[3].lenS, null);
  assert.deepEqual([...m.families], ["tap", "hold"]);
  assert.deepEqual([m.id, m.index, m.orient, m.motherBpm, m.capS, m.parS, m.canFail, m.scored, m.fertilized],
    ["split", 2, "long", 72, 50, 34, false, true, true]);
  assert.deepEqual({ ...m.ga }, { start: 15, end: 20 });
  assert.deepEqual({ ...m.mm }, { start: 0.45, end: 0.45 });
  for (const f of ["create", "step", "view", "prompt", "targets", "botSteer", "probe", "result", "jump"]) assert.equal(typeof split[f], "function", f);
});

await check("the length is about 34 s for every input (less than one beat of phase), well under the 50 s cap", () => {
  for (const phase of PHASES) {
    for (const drive of [idle(), ideal(), botDriver(0.7, 3)]) {
      const { st, res } = play({ phase, drive });
      assert.equal(res.done, true);
      assert.ok(st.t >= 33.4 && st.t <= 34.6, `phase ${phase}: ${st.t.toFixed(2)} s`);
      assert.equal(st.how, "end");
    }
  }
});

await check("gaDay never decreases; Days 1 to 6 in order; 19 when bloom starts, 20 from hatch; each day turns half a beat after its split", () => {
  for (const phase of PHASES) {
    let prev = -Infinity, labels = [];
    const at = {};
    const { st } = play({ phase, each: (s) => {
      assert.ok(s.gaDay >= prev - 1e-12, `gaDay went back at ${s.t.toFixed(3)}`);
      prev = s.gaDay;
      const l = label(s.gaDay);
      if (labels[labels.length - 1] !== l) labels.push(l);
      if (!(s.moment in at)) at[s.moment] = s.gaDay;
    } });
    assert.deepEqual(labels.map((l) => l.split(" after")[0]), ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6"]);
    assert.ok(labels.every((l) => /after fertilization \(week 2\)$/.test(l)), labels.join(" | "));
    near(at.bloom, 19, 0.01, "bloom starts at gaDay 19");
    assert.equal(at.hatch, 20);
    assert.equal(st.gaDay, 20);
    for (let d = 1; d <= 4; d++) {
      const s2 = split.create(1, DEFAULT_CARRY, { motherPhase: phase });
      const t6 = beatOf(s2, 6 * d);
      while (s2.t < t6) split.step(s2, makeIntents());
      assert.equal(Math.floor(s2.gaDay), 14 + d, `day ${d} still on its beat 6`);
      while (s2.t < t6 + PB / 2 + DT) split.step(s2, makeIntents());
      assert.equal(Math.floor(s2.gaDay), 15 + d, `day ${d + 1} half a beat later`);
    }
  }
});

// ---- targets ----

await check("12 taps on her beats 2, 4 and 6 of Days 1 to 4, two releases on beat 6 of bloom and hatch; each carries P", () => {
  for (const phase of PHASES) {
    const st = split.create(5, DEFAULT_CARRY, { motherPhase: phase });
    const all = split.targets(st, 99);
    assert.deepEqual(checkTargets(all), [], "sorted, P ≥ 0.5 s, spaced ≥ 0.5 s");
    const taps = all.filter((x) => x.kind === "tap"), rels = all.filter((x) => x.kind === "release");
    assert.equal(taps.length, 12);
    assert.equal(rels.length, 2);
    const want = [];
    for (let d = 1; d <= 4; d++) for (const k of [2, 4, 6]) want.push(beatOf(st, 6 * (d - 1) + k));
    assert.deepEqual(taps.map((x) => x.t), want, "on her laid beats exactly");
    assert.ok(beatOf(st, 1) >= 1.0 && beatOf(st, 1) < 1.0 + PB, "beat 1 is her first beat at or after 1.0 s");
    assert.deepEqual(rels.map((x) => x.t), [beatOf(st, 30), beatOf(st, 36)]);
    assert.deepEqual(rels.map((x) => x.group), ["bloom", "hatch"]);
    near(taps[0].P, PB, 1e-9, "the first target's P is her beat period");
    for (const x of taps.slice(1)) near(x.P, 2 * PB, 1e-9, "2 beats apart");
    for (const x of rels) near(x.P, 6 * PB, 1e-9, "6 beats after the target before");
    for (const x of all) { assert.equal(x.heart, "mother"); assert.ok(Number.isFinite(x.P) && x.P >= 0.5); assert.ok(typeof x.id === "string"); }
    assert.ok(taps.every((x) => x.group === "split"));
  }
});

await check("every target is drawn at least max(2 beats, 1.2 s) before its time (approach and hold rings)", () => {
  for (const phase of PHASES) {
    const st = split.create(2, DEFAULT_CARRY, { motherPhase: phase });
    const all = split.targets(st, 99);
    const firstRing = {};
    for (let i = 0; i < MAX_STEPS && !split.result(st).done; i++) {
      for (const g of split.view(st).rings) {
        const id = String(g.id).replace(/^[th]:/, "");
        if (/^[th]:/.test(g.id) && !(id in firstRing)) firstRing[id] = st.t;
      }
      split.step(st, makeIntents());
      st.events.length = 0;
    }
    for (const x of all) {
      assert.ok(x.t - firstRing[x.id] >= previewS(PB) - 1e-9, `${x.id} drawn ${(x.t - firstRing[x.id]).toFixed(3)} s before`);
    }
  }
});

// ---- determinism ----

await check("the same seed and input give the same run (two seeds, the bot, random input, the ideal script)", () => {
  for (const seed of [1, 2]) {
    for (const mk of [() => botDriver(0.7, seed), () => randomDriver(seed), () => ideal()]) {
      const a = play({ seed, phase: 0.37, drive: mk(), viewsEvery: 45 });
      const b = play({ seed, phase: 0.37, drive: mk(), viewsEvery: 45 });
      assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs));
      assert.deepEqual(a.res, b.res);
      assert.equal(JSON.stringify(a.views.map((x) => x.v), (k, v) => (v instanceof Float32Array ? Array.from(v) : v)),
        JSON.stringify(b.views.map((x) => x.v), (k, v) => (v instanceof Float32Array ? Array.from(v) : v)));
    }
  }
  const v1 = split.view(split.create(1, DEFAULT_CARRY, { motherPhase: 0 })), v2 = split.view(split.create(2, DEFAULT_CARRY, { motherPhase: 0 }));
  assert.equal(v1.splats.length, 1, "one cell at the start");
  const late = (seed) => { const s = split.create(seed, DEFAULT_CARRY, { motherPhase: 0 }); while (s.t < 22) split.step(s, makeIntents()); return split.view(s).splats; };
  assert.notDeepEqual(late(1), late(2), "the seed sets the cleavage axes");
  assert.deepEqual(v1.rings, v2.rings, "the schedule follows her beat, not the seed");
});

// ---- the goal, scores and grades ----

await check("the scripted ideal input reaches Glowing (10,000) at every phase, and every sub-goal is done by you", () => {
  for (const seed of [1, 2]) for (const phase of PHASES) {
    const { res, st, evs } = play({ seed, phase, drive: ideal() });
    assert.equal(res.goalMet, true);
    assert.deepEqual(res.score, { goal: 3000, skill: 6000, flourish: 1000, total: 10000 });
    assert.equal(gradeOf(res.score.total, res.goalMet), "Glowing");
    assert.deepEqual(st.subgoals, { split: "done", bloom: "done", hatch: "done" });
    assert.equal(res.metrics.daysInTime, 4);
    assert.deepEqual(res.metrics.release, [1, 1]);
    assert.equal(res.parts.reduce((a, p) => a + p.value, 0), res.score.total, "the parts add up");
    const pts = named(evs, "points");
    assert.equal(pts.reduce((a, e) => a + e.add, 0), res.score.total, "the HUD ticks add up to the total");
    assert.equal(named(evs, "judge").filter((e) => e.grade === "in").length, 14);
  }
});

await check("idle ends by the cap with the goal met: every split, the hollow and the hatch happen by themselves", () => {
  for (const phase of PHASES) {
    const { res, st, evs } = play({ seed: 4, phase, drive: idle() });
    assert.equal(res.done, true);
    assert.equal(res.goalMet, true);
    assert.ok(st.t <= split.meta.capS);
    assert.deepEqual(res.score, { goal: 3000, skill: 0, flourish: 0, total: 3000 });
    assert.equal(gradeOf(res.score.total, true), "Good");
    assert.deepEqual(st.subgoals, { split: "auto", bloom: "auto", hatch: "auto" });
    assert.equal(res.metrics.cells, 16);
    assert.equal(st.fill, 1);
    assert.equal(st.slipped, true);
    const pl = named(evs, "sfx").filter((e) => e.id === "pling");
    assert.deepEqual(pl.map((e) => e.pitch), [1, 2, 3, 4], "a pling per split, one step higher each time");
    pl.forEach((e, i) => near(e.at, beatOf(st, 6 * (i + 1)), 1e-9, `split ${i + 1} on beat 6 of its day`));
    assert.equal(named(evs, "judge").filter((e) => e.grade === "miss").length, 14);
    assert.equal(named(evs, "done").length, 1);
  }
});

await check("the cells: 1, then 2, 4, 8 and 16 on beat 6 of each day; the ball keeps its size while the cells get smaller", () => {
  const st = split.create(3, DEFAULT_CARRY, { motherPhase: 0.2 });
  const cellsOf = () => split.view(st).splats.filter((s) => s.k === "c" && s.hue === 0.02);
  assert.equal(cellsOf().length, 1);
  let lastR = Infinity;
  for (let d = 1; d <= 4; d++) {
    const t6 = beatOf(st, 6 * d);
    while (st.t < t6 + 0.05) split.step(st, makeIntents());
    assert.equal(split.result(st).metrics.cells, 2 ** d);
    const cs = cellsOf();
    assert.equal(cs.length, 2 ** d, `day ${d}`);
    const r = Math.max(...cs.map((c) => c.r));
    assert.ok(r < lastR, "smaller cells");
    lastR = r;
    const a = split.view(st).anchor;
    const reach = Math.max(...cs.map((c) => Math.hypot(c.x - a.x, c.y - a.y) + c.r));
    assert.ok(reach <= TUNE.ballR + 1.5, `day ${d}: the ball stays ${reach.toFixed(2)} u`);
  }
  // mid-pinch: two discs parting and a bridge capsule
  const s2 = split.create(3, DEFAULT_CARRY, { motherPhase: 0.2 });
  const t6 = beatOf(s2, 6);
  while (s2.t < t6 - PB / 2) split.step(s2, makeIntents());
  const sp = split.view(s2).splats;
  assert.equal(sp.filter((s) => s.k === "c").length, 2);
  assert.equal(sp.filter((s) => s.k === "s").length, 1, "the bridge capsule");
});

await check("the shared bot: skill 0.7 completes every one of 20 seeds (mostly Great); skill 1.0 glows in every seed", () => {
  const totals = [];
  for (let seed = 1; seed <= 20; seed++) {
    const { res, st } = play({ seed, phase: (seed * 0.137) % PB, drive: botDriver(0.7, seed) });
    assert.equal(res.done, true);
    assert.equal(res.goalMet, true);
    assert.notEqual(st.how, "error");
    for (const v of Object.values(st.subgoals)) assert.ok(v === "done" || v === "auto");
    totals.push(res.score.total);
    const ref = play({ seed, phase: (seed * 0.137) % PB, drive: botDriver(1, seed) }).res;
    assert.ok(ref.score.total >= 8500, `skill 1.0 seed ${seed}: ${ref.score.total}`);
  }
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  assert.ok(mean >= 6500, `skill 0.7 mean ${mean.toFixed(0)}`);
  assert.ok(totals.filter((x) => x >= 6500).length >= 12, `Great or better in ${totals.filter((x) => x >= 6500).length} of 20`);
});

// ---- gestures and sub-goals ----

await check("one live gesture per moment: tap, hold, hold, none; prompts name it from 0 s; a gesture per prompt event", () => {
  const want = { split: "tap", bloom: "hold", hatch: "hold", outro: "none" };
  for (const drive of [idle(), ideal(), botDriver(0.7, 9), randomDriver(9)]) {
    const { gestures, evs } = play({ seed: 9, phase: 0.5, drive });
    assert.deepEqual(Object.keys(gestures), Object.keys(want));
    for (const [m, set] of Object.entries(gestures)) assert.deepEqual([...set], [want[m]], m);
    const prompts = named(evs, "prompt");
    assert.equal(prompts[0].t, 0);
    assert.equal(prompts[0].gesture, "tap");
    assert.deepEqual(prompts.map((p) => p.gesture), ["tap", "hold", "hold", "none", "none"]);
    for (const p of prompts) { assert.equal(p.keys, "steer"); if (p.text) assert.notEqual(say(p.text), p.text, `${p.text} is a string`); }
  }
});

await check("every sub-goal is shown, then ends done or auto, for every input", () => {
  for (const drive of [idle(), ideal(), botDriver(0.4, 2), randomDriver(3)]) {
    const { st, evs } = play({ seed: 2, drive });
    assert.deepEqual(Object.keys(st.subgoals).sort(), ["bloom", "hatch", "split"]);
    for (const v of Object.values(st.subgoals)) assert.ok(v === "done" || v === "auto", v);
    for (const id of Object.keys(st.subgoals)) {
      const seq = named(evs, "subgoal").filter((e) => e.id === id).map((e) => e.state);
      assert.equal(seq[0], "shown", id);
      assert.equal(seq.length, 2, id);
    }
    for (const e of named(evs, "subgoal")) assert.notEqual(say(e.text), e.text, `${e.text} is a string`);
  }
});

// ---- the release credit ----

// Play to the end with scripted events relative to the bloom (k = 0) or hatch (k = 1) release target.
function releaseRun(events, { phase = 0.25, assist = false } = {}) {
  const st0 = split.create(1, DEFAULT_CARRY, { motherPhase: phase });
  const T = [beatOf(st0, 30), beatOf(st0, 36)];
  const B = (n) => beatOf(st0, n);
  return play({ phase, assist, drive: script(events(T, B)) });
}

await check("bloom and hatch: In time 1, Close 0.5, a held Off release 0.25, never pressed 0", () => {
  const cases = [
    ["in", (T, B) => [{ t: B(25) }, { t: T[0], up: true }, { t: B(31) }, { t: T[1] + 0.03, up: true }], [1, 1]],
    ["close", (T, B) => [{ t: B(26) }, { t: T[0] + 0.12, up: true }, { t: B(32) }, { t: T[1] - 0.15, up: true }], [0.5, 0.5]],
    ["held off", (T, B) => [{ t: B(25) }, { t: T[0] - 1.0, up: true }, { t: B(31) }, { t: T[1] + 0.3, up: true }], [0.25, 0.25]],
    ["held off, then in", (T, B) => [{ t: B(25) }, { t: T[0] - 1.6, up: true }, { t: T[0] - 1.2 }, { t: T[0], up: true }], [1, 0]],
    ["held past the end of bloom, released on the hatch glow", (T, B) => [{ t: B(25) }, { t: T[1], up: true }], [0.25, 1]],
    ["never pressed", () => [], [0, 0]],
  ];
  for (const [name, evs, want] of cases) {
    const { res } = releaseRun(evs);
    assert.deepEqual(res.metrics.release, want, name);
  }
});

await check("no mash: a release after a hold under 1 beat counts for nothing, also on the glow", () => {
  const { res, evs } = releaseRun((T) => {
    const out = [];
    for (let k = -8; k <= 4; k++) { out.push({ t: T[0] + k * 0.15 }); out.push({ t: T[0] + k * 0.15 + 0.1, up: true }); }
    out.push({ t: T[1] - 0.3 }, { t: T[1], up: true });               // 0.3 s on the hatch glow
    return out;
  });
  assert.deepEqual(res.metrics.release, [0, 0]);
  assert.equal(named(evs, "judge").filter((e) => e.target.startsWith("bloom") || e.target.startsWith("hatch")).every((e) => e.grade === "miss"), true);
});

await check("a hold needs a fresh press: a press from the tap moment held into bloom counts for nothing", () => {
  const { res } = releaseRun((T, B) => [{ t: B(24) + 0.3 }, { t: T[0], up: true }]);
  assert.deepEqual(res.metrics.release, [0, 0]);
  const again = releaseRun((T, B) => [{ t: B(24) + 0.3 }, { t: B(25) + PB / 2, up: true }, { t: B(26) }, { t: T[0], up: true }]);
  assert.deepEqual(again.res.metrics.release, [1, 0], "a fresh press after letting go counts");
  const lost = releaseRun((T, B) => [{ t: B(24) + 0.3 }, { t: B(26) }, { t: T[0], up: true }]);
  assert.deepEqual(lost.res.metrics.release, [1, 0], "a stale press whose release input.js dropped never blocks the next hold");
});

await check("the hollow fills while you hold, and by itself from bloom beat 2; you slip out on hatch beat 6 by itself", () => {
  const st0 = split.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  const b25 = beatOf(st0, 25), b26 = beatOf(st0, 26), b36 = beatOf(st0, 36);
  const fillAt = (drive, t) => { const st = split.create(1, DEFAULT_CARRY, { motherPhase: 0 }); while (st.t < t) split.step(st, drive(st)); return st; };
  assert.ok(fillAt(idle(), b26).fill < 0.01, "nothing before beat 2 by itself");
  const held = fillAt(script([{ t: b25 - 0.3 }]), b26);
  assert.ok(held.fill > 0.3, `holding fills it: ${held.fill.toFixed(2)}`);
  const late = fillAt(idle(), b36 + 0.1);
  assert.equal(late.slipped, true);
  assert.ok(split.view(late).strips.some((s) => s.kind === "arc" && s.a1 - s.a0 < Math.PI * 2 - 1e-6), "the shell opens");
});

// ---- the taps ----

await check("Off taps never reset a count: an Off press before each target, then an In-time press, scores as the ideal", () => {
  const { res, evs } = play({ seed: 6, phase: 0.4, drive: ideal({ extra: (st, presses, releases, t0, t1) => {
    for (const x of split.targets(st, 3)) {
      if (x.kind !== "tap") continue;
      const at = x.t - 0.3;
      if (at >= t0 && at < t1) presses.push({ t: at, raw: at });
    }
  } }) });
  assert.equal(named(evs, "judge").filter((e) => e.grade === "off").length, 12, "12 Off presses, each shown");
  assert.deepEqual(res.score, { goal: 3000, skill: 6000, flourish: 1000, total: 10000 });
  assert.equal(res.metrics.cells, 16);
  assert.equal(res.metrics.daysInTime, 4);
  // Off presses alone: no credit, and nothing else changes
  const offOnly = play({ seed: 6, phase: 0.4, drive: ideal({ tapErr: () => -0.3 }) });
  assert.equal(offOnly.res.metrics.accuracy, 0);
  assert.equal(offOnly.res.metrics.taps.miss, 12);
  assert.equal(offOnly.res.metrics.cells, 16);
});

await check("Flourish: 250 for each day with all 3 taps In time; a Close tap costs only its day", () => {
  const { res } = play({ seed: 6, drive: ideal({ tapErr: (x) => (dayOf(x) === 2 && x.id.endsWith(".4") ? 0.12 : 0) }) });
  assert.equal(res.score.flourish, 750);
  assert.equal(res.metrics.daysInTime, 3);
  assert.equal(res.parts.find((p) => p.id === "splits").value, Math.round(4000 * (11.5 / 12)));
  const missDay = play({ seed: 6, drive: ideal({ tapErr: (x) => (dayOf(x) === 4 ? 0.5 : 0) }) });
  assert.equal(missDay.res.score.flourish, 750);
  assert.equal(missDay.res.metrics.cells, 16, "the split still happens");
  const sparkles = named(missDay.evs, "sfx").filter((e) => e.id === "sparkle");
  assert.equal(sparkles.length, 9, "no sparkle for the missed day's taps");
});

await check("Assist widens the windows 1.6 times: a tap 200 ms late is Close with Assist, and missed without", () => {
  const late = () => ideal({ tapErr: () => 0.2 });
  assert.equal(play({ drive: late() }).res.metrics.accuracy, 0);
  assert.equal(play({ drive: late(), assist: true }).res.metrics.accuracy, 0.5);
});

// ---- views ----

await check("every view is valid (every step of idle, ideal, bot and random runs), with an anchor, a cue and the limits", () => {
  for (const drive of [idle(), ideal(), botDriver(0.7, 4), randomDriver(4)]) {
    let cues = 0, n = 0;
    play({ seed: 4, phase: 0.6, drive, carry: { ...DEFAULT_CARRY, sparks: 3 }, each: (st) => {
      const v = split.view(st);
      assert.deepEqual(validate(v), [], `t ${st.t.toFixed(2)} ${st.moment}`);
      assert.ok(v.splats.length <= LIMITS.splats && v.rings.length <= LIMITS.rings && v.marks.length <= LIMITS.marks);
      assert.equal(v.stage, "split");
      assert.equal(v.camera.orient, "long");
      near(v.camera.mmPerU, 0.45 / 100, 1e-12, "0.45 mm across the short axis");
      assert.deepEqual(v.anchor, { x: v.camera.x, y: v.camera.y }, "you are the subject");
      if (v.cue) cues++;
      n++;
    } });
    assert.ok(cues > n * 0.3, `a cue in ${cues} of ${n} views`);
  }
  const st = split.create(1, { ...DEFAULT_CARRY, sparks: 3 }, { motherPhase: 0 });
  const v = split.view(st);
  assert.equal(v.strips.find((s) => s.kind === "ripples").items.length, 3, "a rim spark per Glowing so far");
  for (const k of ["course", "cilia", "arc"]) assert.ok(v.strips.some((s) => s.kind === k), k);
  assert.ok(v.points && v.points.n > 0, "motes flow past");
  assert.deepEqual(split.view(st), split.view(st), "view is pure");
});

// ---- facts and strings ----

const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|NICU|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
const PRONOUN = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
const words = (s) => s.split(/\s+/).filter((w) => /\w/.test(w));

await check("facts (15.2): ids, gaDays, where, allow-listed sources read (R), no label in the text, ≤ 20 words", () => {
  const want = { "split.two": [15, "card"], "split.small": [16, "caption"], "split.carried": [16, "caption"],
    "split.morula": [18, "caption"], "split.inner": [19, "result"], "split.hatch": [20, "overlay"] };
  assert.deepEqual(FACTS.map((f) => f.id), Object.keys(want));
  for (const f of FACTS) {
    assert.deepEqual([f.gaDay, f.where], want[f.id], f.id);
    assert.equal(f.stage, "split");
    assert.equal(f.checked, true);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.ok(f.src.length > 0 && f.src.every((k) => SOURCES[k]), `${f.id} sources ${f.src}`);
    assert.ok(!/^(Week|Day)/.test(f.text), f.id);
    assert.ok(words(f.text).length <= 20, f.id);
    for (const s of sentences(f.text)) assert.ok(words(s).length <= 16, `${f.id}: ${s}`);
    assert.ok(!BANNED.test(f.text) && !PRONOUN.test(f.text), f.id);
    assert.ok(byId(f.id), `${f.id} is gathered by core/facts.js`);
  }
});

await check("caption facts show once each, in order, while the clock reads the fact's own day", () => {
  for (const phase of PHASES) {
    const st = split.create(1, DEFAULT_CARRY, { motherPhase: phase });
    const got = [];
    while (!split.result(st).done) {
      split.step(st, makeIntents());
      for (const e of st.events) if (e.name === "fact") got.push({ id: e.id, where: e.where, clock: label(st.gaDay), fact: factLabel(byId(e.id)) });
      st.events.length = 0;
    }
    // split.inner has no room to show whole before the stage ends (design.md 12): a "What was real" fact
    assert.deepEqual(got.map((g) => g.id), ["split.small", "split.carried", "split.morula"]);
    for (const g of got) { assert.equal(g.where, "caption"); assert.equal(g.clock, g.fact, `${g.id} at ${g.clock}`); }
  }
});

await check("strings: every id the stage shows exists; no banned words or carer pronouns; sentences ≤ 16 words", () => {
  for (const [id, text] of Object.entries(TEXT)) {
    assert.ok(id.startsWith("split."), id);
    assert.ok(!BANNED.test(text), `${id}: ${text}`);
    assert.ok(!PRONOUN.test(text), `${id}: ${text}`);
    for (const s of sentences(text)) assert.ok(words(s).length <= 16, `${id}: ${s}`);
    for (const carer of ["mother", "mum", "mom", "parent"]) assert.ok(!PRONOUN.test(say(id, {}, { carer })));
  }
  const { res } = play({ drive: ideal() });
  for (const p of res.parts) assert.notEqual(say(p.label), p.label, p.label);
  for (const id of ["pling", "sparkle", "tone", "slip"]) assert.ok(TEXT[`split.sfx.${id}`], id);
});

// ---- robustness, probe, botSteer, jump ----

await check("never throws: garbage intents, odd times and no intents at all; it still ends by the cap", () => {
  const junk = [null, undefined, 5, {}, { presses: 5 }, { presses: [null, { t: NaN }, { t: Infinity }] }, { releases: [{ t: -50 }, {}] },
    { presses: [{ t: 1e9 }], releases: [{ t: -1e9 }] }, makeIntents({ touching: true })];
  const st = split.create(1, null, { motherPhase: NaN });
  let i = 0;
  assert.doesNotThrow(() => { for (; i < MAX_STEPS && !split.result(st).done; i++) split.step(st, junk[i % junk.length]); });
  assert.equal(split.result(st).done, true);
  assert.equal(split.result(st).goalMet, true);
  assert.notEqual(st.how, "error");
  assert.deepEqual(validate(split.view(st)), []);
  const s2 = split.create(2, undefined, undefined);
  assert.doesNotThrow(() => { for (let k = 0; k < 120; k++) split.step(s2); });
  assert.deepEqual(validate(split.view(s2)), []);
});

await check("probe is null; botSteer is still and never touches r.mem; the carry out is empty", () => {
  const st = split.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  assert.equal(split.probe(st), null);
  const r = stream(1, "x");
  r.mem = {};
  assert.deepEqual(split.botSteer(st, 1, r), { steer: { x: 0, y: 0 }, dir: null, hold: false });
  assert.deepEqual(r.mem, {});
  assert.deepEqual(play({ drive: idle() }).res.carryOut, {});
});

await check("jump(moment) starts each moment now on her beat grid, lays its targets and plays on to the end", () => {
  for (const m of ["split", "bloom", "hatch", "outro"]) {
    const st = split.create(1, DEFAULT_CARRY, { motherPhase: 0.2 });
    for (let k = 0; k < 90; k++) split.step(st, makeIntents());
    st.events.length = 0;
    const t = st.t;
    assert.equal(split.jump(st, m), true);
    assert.equal(st.moment, m);
    assert.equal(st.t, t, "stage time does not move");
    assert.ok(named(st.events, "moment").some((e) => e.id === m));
    assert.equal(split.prompt(st).gesture, { split: "tap", bloom: "hold", hatch: "hold", outro: "none" }[m]);
    const upcoming = split.targets(st, 99);
    assert.deepEqual(checkTargets(upcoming), []);
    assert.ok(upcoming.every((x) => x.t >= t), "no target left behind");
    if (m === "bloom") assert.deepEqual(upcoming.map((x) => x.group), ["bloom", "hatch"]);
    if (m === "outro") assert.equal(upcoming.length, 0);
    if (m !== "split") assert.equal(split.result(st).metrics.cells, 16);
    let n = 0;
    for (; n < MAX_STEPS && !split.result(st).done; n++) { split.step(st, makeIntents()); assert.deepEqual(validate(split.view(st)), []); }
    assert.equal(split.result(st).done, true, m);
    for (const v of Object.values(st.subgoals)) assert.ok(v === "done" || v === "auto", `${m}: ${v}`);
  }
  assert.equal(split.jump(split.create(1, DEFAULT_CARRY, {}), "nowhere"), false);
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks`);
}
