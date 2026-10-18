// First Breath: stage 5, First Trimester (`grow`), design.md 6.5, 4.1, 5.1 to 5.4, 7, 16.4 and 18; tasks 2.19 to 2.22.
// Plays the stage in node with no DOM (16.11): idle, the scripted ideal input, the shared bot at several skills and
// seeded random input. Asserts the meta and the 4.1 moments; determinism for two seeds; the ideal input reaching
// Glowing; idle ending by itself inside the cap with goalMet true; the skill 0.7 bot completing; one live gesture per
// moment; every sub-goal ending done or auto; targets that carry P, spaced at least 0.5 s (0.706 s at 170 bpm), with
// the weekly gap patterns and their preview (the cord lights at least 1.6 s and 2 targets ahead); the tempo curve of
// your heart along clock.bpmYou; the clock never running back; the pools red only from gaDay 84; the week 10 fetus
// line and the week 12 facts; the move cone, its 0.5 s hold and the move by itself at 3 s; Assist; botSteer (at the
// glow, memory only in r.mem); one-button play; misses that only add less; jump; the carry in; the points events
// adding up to the score; every view valid; the facts and strings; and that garbage input never throws.
// node qa/first-breath/stage-grow.test.mjs
import assert from "node:assert/strict";
import * as grow from "../../public/first-breath/core/stages/grow.js";
import { TUNE } from "../../public/first-breath/core/stages/grow.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/grow.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/grow.text.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { DT, bpmYou, week, label as clockLabel } from "../../public/first-breath/core/clock.js";
import { check as checkTargets, previewS } from "../../public/first-breath/core/lib/track.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { CARERS, fill, say } from "../../public/first-breath/core/text.js";

const FILE = "qa/first-breath/stage-grow.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 8).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const MAX_STEPS = Math.ceil((grow.meta.capS + 5) / DT);
const named = (evs, name) => evs.filter((e) => e.name === name);

// The 4.1 rows: beatN (N = 7 to 13) from 7N to 7N + 6 over 16 of your beats; moveN (N = 8 to 13) from 7N + 6 to
// min(7N + 7, 97) over 3 s. 16 beats at the week's mean rate, by a fine integral of clock.bpmYou (beat7 adds its 2 s
// lead).
const mean = (g0, g1) => { let s = 0; const n = 6000; for (let i = 0; i < n; i++) s += bpmYou(g0 + ((g1 - g0) * (i + 0.5)) / n); return s / n; };
const MOMENTS = [];
for (let n = 7; n <= 13; n++) {
  MOMENTS.push({ id: `beat${n}`, ga: [7 * n, 7 * n + 6], lenS: (n === 7 ? 2 : 0) + (16 * 60) / mean(7 * n, 7 * n + 6), beat: true, week: n });
  if (n >= 8) MOMENTS.push({ id: `move${n}`, ga: [7 * n + 6, Math.min(7 * n + 7, 97)], lenS: 3, beat: false, week: n });
}
const BY_ID = Object.fromEntries(MOMENTS.map((m) => [m.id, m]));
const GAPS = { 7: [2], 8: [2], 9: [2, 3], 10: [2, 3], 11: [2, 3, 4], 12: [2, 3, 4], 13: [2, 3, 4] };

// Play one attempt and record what a test needs: every event (with the gaDay after its step), the prompt at each step,
// each target as first listed by targets(st, 3), each approach ring and the cord lights as first drawn, every view's
// problems and the gaDay after each step.
function play({ seed = 1, carry = DEFAULT_CARRY, opts = {}, input = null, bot = null, every = 1, before = null } = {}) {
  const st = grow.create(seed, carry, { assist: false, oneButton: false, motherPhase: 0, ...opts });
  const evs = st.events.map((e) => ({ ...e, ga: st.gaDay }));
  st.events.length = 0;
  const seen = [], bad = [], ga = [], views = [];
  const firstSeen = new Map(), targets = new Map(), ringSeen = new Map();
  let n = 0;
  for (; n < MAX_STEPS && !grow.result(st).done; n++) {
    if (n % every === 0) {
      const v = grow.view(st);
      const out = validate(v);
      if (out.length) bad.push(`t ${st.t.toFixed(2)} ${st.moment}: ${out.join("; ")}`);
      for (const r of v.rings) if (r.kind === "approach" && !ringSeen.has(r.id)) ringSeen.set(r.id, st.t);
      views.push({ t: st.t, moment: st.moment, gaDay: st.gaDay, v });
    }
    for (const x of grow.targets(st, 3)) {
      if (!firstSeen.has(x.id)) firstSeen.set(x.id, st.t);
      targets.set(x.id, x);
    }
    if (before) before(st);
    seen.push({ moment: st.moment, gesture: grow.prompt(st).gesture, t: st.t });
    const it = bot ? bot.intents(grow, st) : input ? input(st) : makeIntents();
    grow.step(st, it);
    for (const e of st.events) evs.push({ ...e, ga: st.gaDay });
    st.events.length = 0;
    ga.push({ t: st.t, gaDay: st.gaDay, moment: st.moment, done: st.done });
  }
  const last = validate(grow.view(st));
  if (last.length) bad.push(`last view: ${last.join("; ")}`);
  const list = [...targets.values()].sort((a, b) => a.t - b.t);
  return { st, evs, seen, bad, ga, views, firstSeen, ringSeen, targets: list, res: grow.result(st), steps: n };
}

// The scripted ideal input: a press at each target's exact time, and in a move the full stick along the arrow.
function ideal(st) {
  const presses = grow.targets(st, 1).filter((x) => x.t >= st.t - 1e-12 && x.t < st.t + DT).map((x) => ({ t: x.t, raw: x.t }));
  const arrow = grow.view(st).marks.find((m) => m.kind === "arrow");
  const steer = arrow ? { x: Math.cos(arrow.ang), y: Math.sin(arrow.ang) } : { x: 0, y: 0 };
  return makeIntents({ presses, steer, touching: presses.length > 0 || !!arrow });
}

// Press every target `errS` late (and steer like the ideal input).
const late = (errS) => (st) => {
  const presses = grow.targets(st, 1).filter((x) => x.t + errS >= st.t - 1e-12 && x.t + errS < st.t + DT).map((x) => ({ t: x.t + errS, raw: x.t + errS }));
  return makeIntents({ presses, steer: ideal(st).steer });
};

const IDEAL = [1, 2, 3, 4, 5].map((seed) => play({ seed, input: ideal }));
const IDLE = [1, 2, 3].map((seed) => play({ seed }));
const BOTS = {};
for (const skill of [1, 0.7, 0.5]) BOTS[skill] = Array.from({ length: 10 }, (_, i) => play({ seed: i + 1, bot: createBot(skill, i + 1), every: 6 }));

// ---- meta and moments ----

await check("meta: stage 5, fit, tap and steer, gaDay 49 to 97, 30 to 150 mm, her 72 bpm, cap 90 s, never fails", () => {
  const m = grow.meta;
  assert.equal(m.id, "grow");
  assert.equal(m.index, 4);
  assert.equal(m.name, "First Trimester");
  assert.equal(m.verb, "Grow");
  assert.equal(m.orient, "fit");
  assert.deepEqual([...m.families], ["tap", "steer"]);
  assert.deepEqual({ ...m.ga }, { start: 49, end: 97 });
  assert.deepEqual({ ...m.mm }, { start: 30, end: 150 });
  assert.equal(m.fertilized, true);
  assert.equal(m.motherBpm, 72);
  assert.equal(m.capS, 90);
  assert.ok(m.parS > 0 && m.parS <= m.capS);
  assert.equal(m.canFail, false);
  assert.equal(m.scored, true);
});

await check("meta.moments match the 4.1 table (ids, gaDay spans, lenS: 16 of your beats; moves 3 s)", () => {
  assert.deepEqual(grow.meta.moments.map((x) => x.id), MOMENTS.map((x) => x.id));
  grow.meta.moments.forEach((x, i) => {
    assert.deepEqual([...x.ga], MOMENTS[i].ga, `${x.id} ga`);
    near(x.lenS, MOMENTS[i].lenS, 0.01, `${x.id} lenS`);
  });
});

// ---- determinism ----

await check("determinism: the same seed and input give the same events and result, for two seeds", () => {
  for (const seed of [1, 2]) {
    const a = play({ seed, bot: createBot(0.7, seed), every: 30 }), b = play({ seed, bot: createBot(0.7, seed), every: 30 });
    assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs), `seed ${seed}: events`);
    assert.deepEqual(a.res, b.res, `seed ${seed}: result`);
    const c = play({ seed, input: ideal, every: 30 });
    assert.equal(JSON.stringify(c.evs), JSON.stringify(IDEAL[seed - 1].evs), `seed ${seed}: ideal events`);
  }
  const t1 = IDEAL[0].targets.map((x) => x.t.toFixed(4)).join(), t2 = IDEAL[1].targets.map((x) => x.t.toFixed(4)).join();
  assert.notEqual(t1, t2, "another seed lays other gaps");
});

// ---- the three gates: ideal, idle, the bot ----

await check("the scripted ideal input reaches Glowing: 10,000 with every tap In time and every move yours", () => {
  for (const r of IDEAL) {
    assert.equal(r.res.done, true);
    assert.equal(r.res.goalMet, true);
    assert.equal(r.res.score.total, 10000, `seed ${r.st.seed}: ${JSON.stringify(r.res.score)}`);
    assert.equal(gradeOf(r.res.score.total, true), "Glowing");
    assert.equal(r.res.metrics.accuracy, 1);
    assert.equal(r.res.metrics.movesYou, 6);
    const judges = named(r.evs, "judge");
    assert.equal(judges.length, r.res.metrics.targets, "each target judged once");
    assert.ok(judges.every((j) => j.grade === "in" && Math.abs(j.errMs) < 1e-6), "every tap In time");
    assert.ok(r.st.t <= grow.meta.capS);
  }
});

await check("idle ends by itself inside the cap with goalMet true: Goal only, every target missed, every move by itself", () => {
  for (const r of IDLE) {
    assert.equal(r.res.done, true);
    assert.equal(r.res.goalMet, true);
    assert.ok(r.st.t <= grow.meta.capS + 1e-9, `${r.st.t} s`);
    near(r.st.t, 62.5, 1.5, "idle length (2 + 7 phrases + 6 moves of 3 s)");
    assert.deepEqual({ ...r.res.score }, { goal: 3000, skill: 0, flourish: 0, total: 3000 });
    assert.equal(gradeOf(r.res.score.total, r.res.goalMet), "Good");
    const judges = named(r.evs, "judge");
    assert.equal(judges.length, r.res.metrics.targets);
    assert.ok(judges.every((j) => j.grade === "miss"));
    assert.equal(r.res.metrics.movesAuto, 6);
    assert.equal(named(r.evs, "done").length, 1);
    assert.equal(r.st.gaDay, 97, "the clock at the end of week 13");
  }
});

await check("the shared bot: skill 1.0 Glowing in every seed; skill 0.7 completes every seed at Great on average; 0.5 meets the goal", () => {
  const mean = (rs) => rs.reduce((a, r) => a + r.res.score.total, 0) / rs.length;
  for (const r of BOTS[1]) assert.equal(gradeOf(r.res.score.total, r.res.goalMet), "Glowing", `seed ${r.st.seed}: ${r.res.score.total}`);
  for (const r of BOTS[0.7]) {
    assert.equal(r.res.done, true);
    assert.equal(r.res.goalMet, true);
    assert.ok(r.st.t <= grow.meta.capS);
    assert.ok(r.res.score.total >= 6500 - 1500, `seed ${r.st.seed}: ${r.res.score.total}`);
  }
  assert.ok(mean(BOTS[0.7]) >= 6500, `skill 0.7 mean ${mean(BOTS[0.7])}`);
  assert.ok(mean(BOTS[1]) >= 8500, `skill 1.0 mean ${mean(BOTS[1])}`);
  for (const r of BOTS[0.5]) assert.equal(r.res.goalMet, true);
  // lengths: the ref bot is about 54 s, the mid bot a little longer, idle 62.5 s
  const len = (rs) => rs.reduce((a, r) => a + r.st.t, 0) / rs.length;
  near(len(BOTS[1]), grow.meta.parS, 1.5, "ref length near parS");
  assert.ok(len(BOTS[1]) < len(BOTS[0.7]) && len(BOTS[0.7]) < len(IDLE), "moves you make end their moments early");
});

// ---- the interface rules ----

await check("one live gesture per moment: tap in each beat moment, drag in each move, none once done; moments in 4.1 order", () => {
  for (const r of [...IDEAL, ...IDLE, ...BOTS[0.7]]) {
    const by = new Map();
    for (const s of r.seen) { if (!by.has(s.moment)) by.set(s.moment, new Set()); by.get(s.moment).add(s.gesture); }
    for (const [m, set] of by) {
      assert.equal(set.size, 1, `${m}: ${[...set]}`);
      assert.equal([...set][0], BY_ID[m].beat ? "tap" : "drag", m);
    }
    assert.deepEqual(named(r.evs, "moment").map((e) => e.id), MOMENTS.map((x) => x.id), "every moment once, in order");
    const prompts = named(r.evs, "prompt");
    assert.deepEqual(prompts.map((p) => p.gesture), [...MOMENTS.map((x) => (x.beat ? "tap" : "drag")), "none"]);
    assert.ok(prompts.every((p) => p.keys === "steer"));
    assert.equal(grow.prompt(r.st).gesture, "none");
    for (const p of prompts.slice(0, -1)) assert.notEqual(say(p.text), p.text, `prompt text ${p.text} is a string`);
  }
});

await check("every sub-goal is shown, then ends done or auto, each with its events (heart and the 6 moves)", () => {
  for (const r of [...IDEAL, ...IDLE, ...BOTS[0.5]]) {
    assert.deepEqual(Object.keys(r.st.subgoals).sort(), ["heart", "move10", "move11", "move12", "move13", "move8", "move9"]);
    for (const [id, s] of Object.entries(r.st.subgoals)) {
      assert.ok(s === "done" || s === "auto", `${id}: ${s}`);
      const evs = named(r.evs, "subgoal").filter((e) => e.id === id);
      assert.deepEqual(evs.map((e) => e.state), ["shown", s], id);
      for (const e of evs) assert.notEqual(say(e.text), e.text, `${e.text} is a string`);
    }
  }
  assert.equal(IDEAL[0].st.subgoals.heart, "done");
  assert.equal(IDLE[0].st.subgoals.heart, "auto");
  assert.equal(IDEAL[0].st.subgoals.move8, "done");
  assert.equal(IDLE[0].st.subgoals.move8, "auto");
});

await check("targets carry P (>= 0.5 s, the spacing since the one before), spaced >= 0.5 s, taps on your heart, about 45", () => {
  const counts = [];
  for (const r of [...IDEAL, ...IDLE]) {
    const list = r.targets;
    assert.deepEqual(checkTargets(list), [], `seed ${r.st.seed}`);
    list.forEach((x, i) => {
      assert.equal(x.kind, "tap");
      assert.equal(x.heart, "you");
      assert.ok(BY_ID[x.group] && BY_ID[x.group].beat, `group ${x.group}`);
      const want = i ? x.t - list[i - 1].t : 60 / r.st.beats.bpm("you", x.t);
      near(x.P, Math.max(0.5, want), 1e-9, `${x.id} P`);
    });
    counts.push(list.length);
  }
  for (let seed = 1; seed <= 20; seed++) counts.push(play({ seed, every: 600 }).targets.length);
  assert.ok(Math.min(...counts) >= 36 && Math.max(...counts) <= TUNE.tickTargets, `targets ${Math.min(...counts)} to ${Math.max(...counts)}`);
});

await check("preview: each target is listed, ringed and lit on the cord at least 1.6 s (>= max(2 beats, 1.2 s)) before its time", () => {
  for (const r of IDEAL.slice(0, 3)) {
    for (const x of r.targets) {
      const need = Math.max(TUNE.lightS, previewS(60 / r.st.beats.bpm("you", x.t)));
      assert.ok(x.t - r.firstSeen.get(x.id) >= need - DT - 1e-9, `${x.id}: listed ${(x.t - r.firstSeen.get(x.id)).toFixed(3)} s ahead`);
      assert.ok(r.ringSeen.has("t:" + x.id), `${x.id} has an approach ring`);
      assert.ok(x.t - r.ringSeen.get("t:" + x.id) >= need - DT - 1e-9, `${x.id}: ringed ${(x.t - r.ringSeen.get("t:" + x.id)).toFixed(3)} s ahead`);
    }
    // the cord carries a light for every target due within 1.6 s, and the next two whenever two are laid
    for (const { t, v } of r.views) {
      const cord = v.strips.find((s) => s.kind === "cord");
      assert.ok(cord, "a cord in every view");
      const due = r.targets.filter((x) => x.t >= t && x.t - t <= TUNE.lightS - 1e-6 && r.firstSeen.get(x.id) <= t).length;
      const laid = r.targets.filter((x) => x.t >= t && r.firstSeen.get(x.id) <= t);
      assert.ok(cord.lights.length >= due, `t ${t.toFixed(2)}: ${cord.lights.length} lights, ${due} due`);
      if (laid.length >= 2 && laid[1].t - t <= TUNE.lightS) assert.ok(cord.lights.length >= 2, `t ${t.toFixed(2)}: two ahead`);
    }
  }
});

await check("gap patterns on your beats: 2 (weeks 7, 8), 2 or 3 (weeks 9, 10), 2 to 4 (weeks 11 to 13), seeded; 0.706 s at 170 bpm", () => {
  const used = {};
  let min910 = Infinity;
  for (let seed = 1; seed <= 12; seed++) {
    const r = seed <= 5 ? IDEAL[seed - 1] : play({ seed, input: ideal, every: 600 });
    const B = r.st.beats.you;
    const idx = (t) => { for (let j = 0; j < B.length; j++) if (Math.abs(B[j] - t) < 1e-9) return j; return -1; };
    const list = r.targets;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      const wa = BY_ID[a.group].week, wb = BY_ID[b.group].week;
      assert.ok(idx(a.t) >= 0 && idx(b.t) >= 0, `${a.id} and ${b.id} sit on your beats`);
      if (wa !== wb && !(wa === 7 && wb === 8)) continue;          // a move lies between
      const gap = idx(b.t) - idx(a.t);
      assert.ok(GAPS[wa].includes(gap), `${a.id} → ${b.id}: a gap of ${gap} beats in week ${wa}`);
      (used[wa] ||= new Set()).add(gap);
      if (wa === 9 || wa === 10) min910 = Math.min(min910, b.t - a.t);
    }
  }
  for (const w of [9, 10, 11, 12, 13]) assert.deepEqual([...used[w]].sort(), GAPS[w], `week ${w} uses every gap over the seeds`);
  near(min910, (2 * 60) / 170, 0.004, "the shortest gap at 170 bpm");
  assert.ok(min910 >= 0.5);
});

await check("the tempo curve: your heart follows clock.bpmYou (130 at week 7, 170 at weeks 9 and 10, about 155 at week 13)", () => {
  for (const r of [IDEAL[0], BOTS[0.7][0], IDLE[0]]) {
    const st = grow.create(r.st.seed, DEFAULT_CARRY, { motherPhase: 0 });
    const input = r === IDLE[0] ? null : r === IDEAL[0] ? ideal : null;
    const bot = r === BOTS[0.7][0] ? createBot(0.7, r.st.seed) : null;
    let n = 0;
    while (!grow.result(st).done && n++ < MAX_STEPS) {
      const want = bpmYou(st.gaDay), got = st.beats.bpm("you", st.t + 1e-6);     // just past a moment's first instant
      const beat = BY_ID[st.moment].beat;
      assert.ok(Math.abs(got - want) <= (beat ? 0.05 : 3.0), `${st.moment} gaDay ${st.gaDay.toFixed(2)}: ${got} vs ${want}`);
      grow.step(st, bot ? bot.intents(grow, st) : input ? input(st) : makeIntents());
      st.events.length = 0;
    }
  }
  near(bpmYou(49), 130, 1e-9, "week 7");
  near(bpmYou(63), 170, 1e-9, "week 9");
  near(bpmYou(70), 170, 1e-9, "week 10");
  near(bpmYou(91), 155, 1e-9, "week 13");
  // measured: the beats inside week 9 come every 60 / 170 s
  const st = IDEAL[0].st;
  const s9 = named(IDEAL[0].evs, "moment").find((e) => e.id === "beat9").t;
  const b = st.beats.between("you", s9 + 0.01, s9 + 5);
  const per = (b[b.length - 1] - b[0]) / (b.length - 1);
  near(60 / per, 170, 0.6, "week 9 measured bpm");
});

await check("the clock: gaDay never runs back, stays in each moment's span, jumps to the end of a move made early, ends at 97", () => {
  for (const r of [...IDEAL, ...IDLE, ...BOTS[0.7].slice(0, 3)]) {
    for (let i = 1; i < r.ga.length; i++) assert.ok(r.ga[i].gaDay >= r.ga[i - 1].gaDay - 1e-12, `gaDay back at ${r.ga[i].t}`);
    for (const g of r.ga) {
      if (g.done) continue;
      const m = BY_ID[g.moment];
      assert.ok(g.gaDay >= m.ga[0] - 1e-9 && g.gaDay <= m.ga[1] + 1e-9, `${g.moment}: ${g.gaDay}`);
      if (m.beat) assert.equal(week(g.gaDay), m.week, `${g.moment} reads week ${m.week}`);
    }
    assert.equal(r.st.gaDay, 97);
    assert.equal(clockLabel(r.st.gaDay), "Week 13");
  }
  // a move made early ends its moment early: the next phrase starts at the move's own end gaDay
  const r = IDEAL[0];
  const starts = named(r.evs, "moment");
  for (let i = 0; i < starts.length - 1; i++) {
    const m = BY_ID[starts[i].id];
    if (m.beat) continue;
    const len = starts[i + 1].t - starts[i].t;
    assert.ok(len < 2, `${m.id} ended after ${len.toFixed(2)} s`);
    near(starts[i + 1].ga, m.ga[1], 0.05, `${m.id} jumped to its end`);
  }
});

// ---- the picture and the facts on the clock ----

await check("the pools turn red (wavy rim, the linked colour, her pulse) only from gaDay 84; the thin layer rings them then", () => {
  for (const r of [IDEAL[0], IDLE[0]]) {
    let pulseMax = 0, pulseMin = 1, sawRed = false;
    for (const { gaDay, v } of r.views) {
      const pools = v.marks.filter((m) => m.kind === "pool");
      assert.equal(pools.length, 5);
      const layer = v.strips.find((s) => s.kind === "ripples");
      const rings = layer ? layer.items.length : 0;
      if (gaDay < 84) {
        for (const p of pools) assert.ok(p.rim === "dotted" && p.on === false && p.pulse === 0, `gaDay ${gaDay}: ${JSON.stringify(p)}`);
        assert.ok(rings <= 1, "no layer rings before week 12");
      } else {
        sawRed = true;
        for (const p of pools) { assert.ok(p.rim === "wavy" && p.on === true); pulseMax = Math.max(pulseMax, p.pulse); pulseMin = Math.min(pulseMin, p.pulse); }
        assert.ok(rings >= 5, "the thin layer rings each pool");
      }
    }
    assert.ok(sawRed);
    assert.ok(pulseMax > 0.5 && pulseMin < 0.1, `the pools pulse with her heart (${pulseMin}..${pulseMax})`);
  }
});

await check("week 10: milestone fetus once with the fetus line at gaDay 70; week 12: grow.w12, grow.flow, grow.never; captions on their weeks", () => {
  const capFacts = FACTS.filter((f) => f.where === "caption");
  for (const r of [IDEAL[0], IDLE[0], BOTS[0.7][1]]) {
    const ms = named(r.evs, "milestone");
    assert.deepEqual(ms.map((e) => e.id), ["fetus"]);
    near(ms[0].ga, 70, 0.01, "fetus at gaDay 70");
    const caps = named(r.evs, "caption");
    assert.deepEqual(caps.map((c) => c.id).sort(), capFacts.map((f) => f.id).sort(), "each caption fact once");
    const fetus = caps.find((c) => c.id === "grow.fetus");
    near(fetus.t, ms[0].t, 1e-9, "the line comes with the milestone");
    for (const c of caps) {
      const f = FACTS.find((x) => x.id === c.id);
      assert.equal(week(c.ga), week(f.gaDay), `${c.id} shows in week ${week(f.gaDay)} (gaDay ${c.ga.toFixed(2)})`);
      const i = r.evs.indexOf(c);
      assert.ok(r.evs[i - 1].name === "fact" && r.evs[i - 1].id === c.id, `${c.id}: a fact event goes with it`);
    }
    for (const id of ["grow.w12", "grow.flow", "grow.never"]) assert.ok(caps.find((c) => c.id === id).ga >= 84, id);
  }
});

await check("every view is valid, with a fit camera, the anchor on you and the cue on your heart (taps) or the arrow (moves)", () => {
  for (const r of [...IDEAL, ...IDLE, ...BOTS[1], ...BOTS[0.7]]) assert.deepEqual(r.bad, [], `seed ${r.st.seed}`);
  for (const { moment, v } of IDEAL[0].views) {
    assert.equal(v.camera.orient, "fit");
    assert.equal(v.stage, "grow");
    assert.ok(v.anchor && Math.hypot(v.anchor.x, v.anchor.y) < 1, "the anchor is you, at the camera point");
    assert.ok(v.cue, "a cue");
    assert.ok(v.splats.length >= 8 && v.splats.length <= 14, "the figure: 8 splats with buds, 12 with limbs");
    assert.ok(v.splats.some((s) => s.v === 1), "your heart");
    const heart = v.rings.find((g) => g.id === "you");
    assert.ok(heart && heart.dashed === true);
    assert.ok(v.rings.find((g) => g.id === "mother"), "her ring");
    assert.ok(v.strips.some((s) => s.kind === "tree") && v.strips.some((s) => s.kind === "cord"));
    assert.ok(v.marks.some((m) => m.kind === "lake"), "the placenta disc");
    const arrow = v.marks.find((m) => m.kind === "arrow");
    if (BY_ID[moment].beat) assert.ok(Math.hypot(v.cue.x - heart.x, v.cue.y - heart.y) < 1e-9, `${moment}: cue on your heart`);
    else if (arrow) assert.ok(Math.hypot(v.cue.x - arrow.x, v.cue.y - arrow.y) < 1e-9, `${moment}: cue on the arrow`);
  }
  // to scale: your NHS length over the short axis's real mm, about a third at week 7 and over half at week 13
  const r = IDEAL[0];
  const at = (g) => r.views.find((w) => w.gaDay >= g).v;
  const tall = (v) => (Math.max(...v.splats.map((s) => Math.max(s.y, s.y2 ?? s.y) + s.r)) - Math.min(...v.splats.map((s) => Math.min(s.y, s.y2 ?? s.y) - s.r))) / v.camera.span;
  assert.ok(tall(at(49)) > 0.25 && tall(at(49)) < 0.4, `week 7: ${tall(at(49)).toFixed(2)} of the short axis`);
  assert.ok(tall(at(91)) > 0.45 && tall(at(91)) < 0.7, `week 13: ${tall(at(91)).toFixed(2)} of the short axis`);
  assert.ok(at(49).camera.mmPerU < at(91).camera.mmPerU, "the camera pulls back as you grow (mm per u rises)");
  near(at(49).camera.mmPerU * at(49).camera.span, 30, 0.1, "30 mm across at week 7");
});

// ---- moves ----

// Steer `offDeg` off the glow at magnitude `mag` in every move; report each move's sub-goal and its length.
function moveRun({ offDeg = 0, mag = 1, assist = false, seed = 3 } = {}) {
  const r = play({ seed, opts: { assist }, every: 600, input: (st) => {
    const arrow = grow.view(st).marks.find((m) => m.kind === "arrow");
    if (!arrow) return makeIntents();
    const a = arrow.ang + (offDeg * Math.PI) / 180;
    return makeIntents({ steer: { x: mag * Math.cos(a), y: mag * Math.sin(a) }, touching: true });
  } });
  const ms = named(r.evs, "moment");
  const lens = {};
  for (let i = 0; i < ms.length; i++) if (!BY_ID[ms[i].id].beat) lens[ms[i].id] = (i + 1 < ms.length ? ms[i + 1].t : r.st.t) - ms[i].t;
  return { r, lens };
}

await check("a move: the stick within 35° at >= 50% for 0.5 s plays it (then 0.8 s), else it plays by itself at 3 s; Assist 50°", () => {
  const inCone = moveRun({ offDeg: 30 });
  for (const w of [8, 9, 10, 11, 12, 13]) {
    assert.equal(inCone.r.st.subgoals["move" + w], "done", `move${w} within the cone`);
    near(inCone.lens["move" + w], TUNE.move.holdS + TUNE.playS, 2 * DT + 1e-9, `move${w} ends 0.8 s after its 0.5 s hold`);
  }
  assert.equal(inCone.r.res.metrics.movesYou, 6);
  const out = moveRun({ offDeg: 40 });
  for (const w of [8, 9, 10, 11, 12, 13]) {
    assert.equal(out.r.st.subgoals["move" + w], "auto", `move${w} outside the cone`);
    near(out.lens["move" + w], TUNE.moveS, DT + 1e-9, `move${w} plays by itself at 3 s`);
  }
  assert.equal(moveRun({ offDeg: -40 }).r.res.metrics.movesYou, 0, "the cone is the same on both sides");
  assert.equal(moveRun({ offDeg: 45, assist: true }).r.res.metrics.movesYou, 6, "Assist widens the cone to 50°");
  assert.equal(moveRun({ offDeg: 55, assist: true }).r.res.metrics.movesYou, 0);
  assert.equal(moveRun({ mag: 0.45 }).r.res.metrics.movesYou, 0, "under half deflection does not count");
  assert.equal(moveRun({ mag: 0.55 }).r.res.metrics.movesYou, 6);
  // 6.5's directions: 8 up, 9 left or right (seeded), 10 the other side, 11 and 12 down, 13 up
  const sides = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const st = grow.create(seed, DEFAULT_CARRY, { motherPhase: 0 });
    const dirs = Object.values(st.moves).map((m) => m.dir);
    assert.equal(dirs[0], "up"); assert.equal(dirs[3], "down"); assert.equal(dirs[4], "down"); assert.equal(dirs[5], "up");
    assert.ok((dirs[1] === "left" && dirs[2] === "right") || (dirs[1] === "right" && dirs[2] === "left"), dirs.join());
    assert.deepEqual(Object.values(st.moves).map((m) => m.pose), ["uncurl", dirs[1] === "left" ? "stretchL" : "stretchR", "startle", "kick", "kick", "thumb"]);
    sides.add(dirs[1]);
  }
  assert.equal(sides.size, 2, "both sides over the seeds");
});

await check("a short aim does not play a move: the hold builds only while aimed and eases back otherwise", () => {
  let k = 0;
  const r = play({ seed: 2, every: 600, input: (st) => {
    const arrow = grow.view(st).marks.find((m) => m.kind === "arrow");
    if (!arrow) return makeIntents();
    const on = Math.floor(k++ / 15) % 2 === 0;           // 0.25 s aimed, 0.25 s let go
    return on ? makeIntents({ steer: { x: Math.cos(arrow.ang), y: Math.sin(arrow.ang) }, touching: true }) : makeIntents();
  } });
  assert.equal(r.res.metrics.movesYou, 0, "on and off never adds up to 0.5 s");
});

await check("Assist widens the timing windows 1.6 times: 90 ms late is Close without it and In time with it", () => {
  const plain = play({ seed: 4, input: late(0.09), every: 600 }), assisted = play({ seed: 4, opts: { assist: true }, input: late(0.09), every: 600 });
  assert.ok(named(plain.evs, "judge").every((j) => j.grade === "close"));
  assert.ok(named(assisted.evs, "judge").every((j) => j.grade === "in"));
  near(plain.res.metrics.accuracy, 0.5, 1e-9, "Close is half credit");
});

await check("botSteer: full stick at the glow at skill 1, nothing in a beat moment, memory only in r.mem, the state untouched", () => {
  const st = grow.create(5, DEFAULT_CARRY, { motherPhase: 0 });
  const r0 = stream(1, "x"); r0.mem = {};
  assert.deepEqual(grow.botSteer(st, 1, r0), { steer: { x: 0, y: 0 }, dir: null, hold: false }, "a beat moment");
  assert.ok(grow.jump(st, "move9"));
  st.events.length = 0;
  for (let i = 0; i < 30; i++) grow.step(st, makeIntents());
  const a = grow.botSteer(st, 1, Object.assign(stream(2, "y"), { mem: {} }));
  const b = grow.botSteer(st, 1, Object.assign(stream(3, "z"), { mem: {} }));
  assert.deepEqual(a, b, "skill 1 needs no memory and no draws (one-button is the same every call)");
  const want = st.moves[Object.keys(st.moves).find((k) => st.moves[k].week === 9)].dir;
  assert.equal(a.dir, want);
  near(Math.hypot(a.steer.x, a.steer.y), 1, 1e-12, "full stick");
  assert.equal(a.hold, false);
  const r = stream(4, "w"); r.mem = {};
  for (let i = 0; i < 200; i++) grow.step(st, makeIntents());
  const j = grow.create(5, DEFAULT_CARRY, { motherPhase: 0 });
  grow.jump(j, "move10");
  for (let i = 0; i < 150; i++) grow.step(j, makeIntents());
  const c1 = grow.botSteer(j, 0.5, r), c2 = grow.botSteer(j, 0.5, r);
  assert.deepEqual(c1, c2, "the aim error is drawn once per move");
  assert.equal(Object.keys(r.mem).length, 1, "kept in r.mem");
  near(Math.hypot(c1.steer.x, c1.steer.y), 0.4 + 0.6 * 0.5, 1e-12, "stick 0.4 + 0.6 x skill");
  const early = grow.create(5, DEFAULT_CARRY, { motherPhase: 0 });
  grow.jump(early, "move10");
  assert.deepEqual(grow.botSteer(early, 0.5, r).steer, { x: 0, y: 0 }, "it waits its reaction time");
  const s2 = grow.create(5, DEFAULT_CARRY, { motherPhase: 0 });
  grow.jump(s2, "move8");
  for (let i = 0; i < 40; i++) grow.step(s2, makeIntents());
  const before = JSON.stringify(s2, (k, v) => (typeof v === "function" ? "[fn]" : ArrayBuffer.isView(v) ? Array.from(v) : v));
  grow.botSteer(s2, 0.3, Object.assign(stream(9, "q"), { mem: {} }));
  assert.equal(JSON.stringify(s2, (k, v) => (typeof v === "function" ? "[fn]" : ArrayBuffer.isView(v) ? Array.from(v) : v)), before, "botSteer leaves the state alone");
});

await check("one-button: holding points the stick at the glow (botSteer at skill 1), so a held button plays each move", () => {
  const rOne = stream(7, "oneButton"); rOne.mem = {};
  const r = play({ seed: 7, opts: { oneButton: true }, every: 600, input: (st) => {
    const a = grow.botSteer(st, 1, rOne);
    const touching = grow.prompt(st).gesture === "drag";
    const presses = grow.targets(st, 1).filter((x) => x.t >= st.t && x.t < st.t + DT).map((x) => ({ t: x.t, raw: x.t }));
    return makeIntents({ steer: touching ? a.steer : { x: 0, y: 0 }, dir: a.dir, touching: touching || presses.length > 0, presses });
  } });
  assert.equal(r.res.metrics.movesYou, 6);
  assert.equal(gradeOf(r.res.score.total, r.res.goalMet), "Glowing");
});

await check("misses only add less: the light enters dimly, the stage goes on, the moves play anyway", () => {
  const r = IDLE[0];
  const dim = r.views.filter(({ t, v }) => r.targets.some((x) => t > x.t && t - x.t < 0.2)).map(({ v }) => v.marks.filter((m) => m.kind === "glow"));
  assert.ok(dim.length > 10);
  for (const gs of dim) {
    const heartGlow = gs.find((m) => m.r === 8);
    assert.ok(heartGlow && heartGlow.on <= 0.3 + 1e-9, "a dim light after a miss");
  }
  const bright = IDEAL[0].views.filter(({ t }) => IDEAL[0].targets.some((x) => t > x.t && t - x.t < 0.1)).map(({ v }) => v.marks.find((m) => m.kind === "glow" && m.r === 8));
  assert.ok(bright.every((m) => m && m.on > 0.7), "a bright one when in time");
  assert.equal(named(r.evs, "points").filter((p) => p.part === "skill").length, 0);
  assert.equal(r.res.metrics.movesAuto, 6);
});

await check("the points events add up to the stage total (HUD ticks, then the rest, the Goal and the Flourish at the end)", () => {
  for (const r of [...IDEAL, ...IDLE, ...BOTS[0.7], ...BOTS[0.5]]) {
    const pts = named(r.evs, "points");
    assert.ok(pts.every((p) => Number.isInteger(p.add) && p.add > 0));
    assert.equal(pts.reduce((a, p) => a + p.add, 0), r.res.score.total, `seed ${r.st.seed}`);
  }
});

await check("jump: starts a named moment now, lays its targets with their preview, keeps the clock going forward", () => {
  const st = grow.create(3, DEFAULT_CARRY, { motherPhase: 0.2 });
  for (let i = 0; i < 300; i++) { grow.step(st, makeIntents()); }
  st.events.length = 0;
  assert.equal(grow.jump(st, "nope"), false);
  const t = st.t;
  assert.equal(grow.jump(st, "beat12"), true);
  assert.equal(st.moment, "beat12");
  assert.equal(st.gaDay, 84);
  assert.equal(named(st.events, "moment")[0].id, "beat12");
  const ts = grow.targets(st, 10);
  assert.ok(ts.length >= 3 && ts.every((x) => x.t >= t + TUNE.lightS - 1e-9 && x.group === "beat12"), "laid with their preview");
  let n = 0, ga = st.gaDay;
  while (!grow.result(st).done && n++ < MAX_STEPS) { grow.step(st, makeIntents()); assert.ok(st.gaDay >= ga); ga = st.gaDay; }
  assert.equal(grow.result(st).goalMet, true);
  for (const [id, s] of Object.entries(st.subgoals)) assert.ok(s === "done" || s === "auto", id);
  // jumping out of a shown move settles it by itself
  const m = grow.create(3, DEFAULT_CARRY, { motherPhase: 0 });
  grow.jump(m, "move8");
  grow.step(m, makeIntents());
  grow.jump(m, "beat9");
  assert.equal(m.subgoals.move8, "auto");
});

await check("carry in: the placenta sits on the side you nestled, its villi grow from treeSeed; carry out is empty", () => {
  const disc = (carry) => grow.view(grow.create(1, mergeCarry(DEFAULT_CARRY, carry), { motherPhase: 0 })).marks.find((m) => m.kind === "lake");
  assert.ok(disc({ nestleX: 0.6 }).x > 20 && disc({ nestleX: -0.6 }).x < -20, "right and left");
  assert.ok(disc({ nestleX: 1 }).x > disc({ nestleX: 0 }).x, "further out the further you nestled");
  const tree = (seed) => Array.from(grow.view(grow.create(1, mergeCarry(DEFAULT_CARRY, { treeSeed: seed }), { motherPhase: 0 })).strips.find((s) => s.kind === "tree").nodes);
  assert.deepEqual(tree(11), tree(11), "the same seed, the same villi");
  assert.notDeepEqual(tree(11), tree(12));
  assert.ok(tree(11).length / 4 > 30, `${tree(11).length / 4} nodes`);
  assert.deepEqual(IDEAL[0].res.carryOut, {});
  // her beats start at motherPhase
  const st = grow.create(1, DEFAULT_CARRY, { motherPhase: 0.4 });
  near(st.beats.mother[0], 0.4, 1e-12, "her first beat");
  near(st.beats.mother[1] - st.beats.mother[0], 60 / 72, 1e-9, "at 72 bpm, no jitter");
});

await check("garbage input never throws, and the stage still ends by its cap", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const r = stream(seed, "garbage");
    const st = grow.create(seed, seed % 2 ? undefined : { nestleX: "x", treeSeed: -4 }, seed % 3 ? undefined : { motherPhase: NaN });
    let n = 0;
    assert.doesNotThrow(() => {
      while (!grow.result(st).done && n++ < MAX_STEPS) {
        const k = r();
        const it = k < 0.1 ? null : k < 0.2 ? { steer: { x: NaN, y: 5 } } : makeIntents({
          steer: { x: 4 * r() - 2, y: 4 * r() - 2 }, touching: r() < 0.5,
          presses: r() < 0.3 ? [{ t: st.t + DT * r(), raw: st.t }] : [], releases: r() < 0.2 ? [{ t: st.t }] : [], dir: "up",
        });
        grow.step(st, it);
        st.events.length = 0;
        if (n % 37 === 0) { assert.deepEqual(validate(grow.view(st)), []); grow.botSteer(st, r(), r); }
      }
    });
    assert.equal(grow.result(st).done, true);
    assert.ok(st.t <= grow.meta.capS + 1e-9);
  }
});

// ---- facts and strings ----

function sentences(text) { return text.split(/(?<=[.!?])\s+/).filter(Boolean); }
function words(text) { return text.split(/\s+/).filter((w) => /[\w{]/.test(w)).length; }
const BANNED = /\b(die|dies|died|dying|dead|death|lose|loses|losing|lost|loser|nicu)\b|\b(kill|fail|miscarr|abort|sex|pain|hurt|danger|sick|viab|prematur|invad|invas|attack|destroy|defeat|conquer|enem|fight|battle)/i;
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;

await check("facts: the 15.2 rows, allow-listed sources, access R or A, checked, short, no Week or Day start, sizes say the NHS", () => {
  assert.deepEqual(FACTS.map((f) => f.id), ["grow.w7", "grow.tri", "grow.w8", "grow.arms", "grow.peak", "grow.fetus", "grow.w11",
    "grow.w11kick", "grow.w12", "grow.flow", "grow.never", "grow.w13"]);
  for (const f of FACTS) {
    assert.equal(f.stage, "grow");
    assert.ok(f.gaDay >= 49 && f.gaDay <= 97, f.id);
    assert.ok(f.src.length && f.src.every((k) => SOURCES[k]), `${f.id}: ${f.src}`);
    assert.ok(f.access === "R" || f.access === "A", f.id);
    assert.equal(f.checked, true);
    assert.ok(["card", "caption", "overlay"].includes(f.where), f.id);
    assert.ok(!/^(Week|Day)\b/.test(f.text), f.id);
    for (const c of Object.keys(CARERS)) {
      const text = fill(f.text, {}, { carer: c });
      assert.ok(words(text) <= 20, `${f.id}: ${words(text)} words`);
      for (const s of sentences(text)) assert.ok(words(s) <= 16, `${f.id}: "${s}"`);
      assert.ok(!BANNED.test(text) && !PRONOUNS.test(text), `${f.id} (${c})`);
    }
    if (/\d+(\.\d+)?\s?(mm|cm)/.test(f.text)) assert.ok(/the NHS says/.test(f.text), `${f.id} names the NHS`);
  }
  assert.ok(/about/.test(FACTS.find((f) => f.id === "grow.tri").text), "the trimester card says about");
  assert.deepEqual(FACTS.filter((f) => f.where === "card").map((f) => f.id), ["grow.w7", "grow.tri"]);
  assert.deepEqual(FACTS.filter((f) => f.where === "overlay").map((f) => f.id), ["grow.w13"]);
  assert.equal(clockLabel(FACTS.find((f) => f.id === "grow.fetus").gaDay), "Week 10");
});

await check("strings: every id the stage emits is a string; no banned word, no pronoun, short sentences, every carer", () => {
  const ids = new Set();
  for (const r of [IDEAL[0], IDLE[0]]) {
    for (const e of r.evs) {
      if (e.name === "prompt" && e.text) ids.add(e.text);
      if (e.name === "subgoal") ids.add(e.text);
    }
    for (const p of r.res.parts) ids.add(p.label);
  }
  for (const id of ids) assert.notEqual(say(id), id, `${id} is registered`);
  for (const [id, s] of Object.entries(TEXT)) {
    assert.ok(id.startsWith("grow."), id);
    for (const c of Object.keys(CARERS)) {
      const text = fill(s, {}, { carer: c });
      assert.ok(!BANNED.test(text), `banned word in "${text}"`);
      assert.ok(!PRONOUNS.test(text), `pronoun in "${text}"`);
      for (const x of sentences(text)) assert.ok(words(x) <= 16, `"${x}"`);
    }
  }
  for (const id of Object.keys(TEXT)) if (!/^grow\.part\./.test(id)) assert.ok(ids.has(id) || /^grow\.sub\./.test(id), `${id} is used`);
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const mean = (rs) => Math.round(rs.reduce((a, r) => a + r.res.score.total, 0) / rs.length);
  const len = (rs) => (rs.reduce((a, r) => a + r.st.t, 0) / rs.length).toFixed(1);
  console.log(`PASS ${FILE}: ${passed} checks (ideal ${IDEAL[0].res.score.total} in ${IDEAL[0].st.t.toFixed(1)} s; ref mean ${mean(BOTS[1])} in ${len(BOTS[1])} s; `
    + `mid mean ${mean(BOTS[0.7])} in ${len(BOTS[0.7])} s; idle ${IDLE[0].res.score.total} in ${IDLE[0].st.t.toFixed(1)} s; ${IDEAL[0].res.metrics.targets} targets)`);
}
