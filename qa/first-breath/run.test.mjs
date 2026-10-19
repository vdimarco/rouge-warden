// First Breath: the run sequencer (design.md 3.2, 5.1, 7, 16.4, 16.8). The stage order and the screens of a whole
// run (no overlay after Birth); the families per stage; Try again recreates the stage at once and leaves earlier
// scores and carry alone; the better attempt is kept and the latest carry goes on; Go on (jump("carried")) gives no
// Goal and no grade word and stage 1 never runs past 120 s; practice (the goto path) of every stage with
// DEFAULT_CARRY; a press at stageStart + target.t (core time) is graded In time, with rawMs carrying the offset;
// stage events reach the host in core seconds; gaDay and mmPerShortAxis never decrease over a whole run (only a stage
// 1 retry restarts stage 1); her beats run on across overlays, the Almost card and cards with no gap and no jump (the
// ending's first 1.5 s are the one silence); one-button sets steer and dir from botSteer in every stage and clears
// turn and aim; stage 1's sperm.place reaches stage 2 and sets when your sperm comes in; exactly one sperm enters in
// a whole run; the overlay, card and crossfade timers; run.ms leaves out pause and the ending; the summary; every run
// view validates; the same seed plays the same run. The host's contract: only shown facts (checked, R or A) reach
// the host, the summary, the cards and the overlays; sound times (`at`) come in core seconds; the ending's run time
// line carries run.ms (none in practice); track feed() takes odd intents. Review fixes: with a +150 ms timing offset
// a late press that reaches the page late grades as with none, and a new offset takes effect at Resume (F1); fair
// resume, a target 0.3 s after Resume is left out of the score whatever the player does (F2); Try again from pause on
// the overlay, the card and in the ending (F3); a practice total has no Glowing bonus (F4); rim sparks in every stage
// from 2 on (F5).
// node qa/first-breath/run.test.mjs
import assert from "node:assert/strict";
import { createRun, stageSeed, TIMERS, RUN_EVENTS } from "../../public/first-breath/core/run.js";
import { createBot, playStep } from "../../public/first-breath/core/bots.js";
import { STAGES, ENDING } from "../../public/first-breath/core/stages/index.js";
import { DEFAULT_CARRY, mergeCarry } from "../../public/first-breath/core/carry.js";
import { DT, mmPerShortAxis } from "../../public/first-breath/core/clock.js";
import { makeIntents, shiftIntents } from "../../public/first-breath/core/intent.js";
import { runTotal } from "../../public/first-breath/core/score.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { FACTS, byId as factById, isShown } from "../../public/first-breath/core/facts.js";
import { minSec } from "../../public/first-breath/core/text.js";
import { createTrack, feed } from "../../public/first-breath/core/lib/track.js";

const FILE = "qa/first-breath/run.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const IDS = ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"];
// the action-layer stages (meta.action; contract.md): no timed targets, a press is a dash, a knock-out can fail them
const ACTION = new Set(STAGES.filter((m) => m.meta.action).map((m) => m.meta.id));
const TIMED = (ids) => ids.filter((id) => !ACTION.has(id));
const MAX_STEPS = 60 * 60 * 20;            // 20 game minutes
const live = (run) => run.screen === "stage" || run.screen === "ending";

// Play a run to its result: the bot (if any) chooses and plays; `intents(run)` may give the input instead; each(run,
// evs) sees every step's events. Returns the run and every event, in order.
function play(run, { bot = null, intents = null, each = null, before = null, max = MAX_STEPS } = {}) {
  const all = [];
  for (let n = 0; run.screen !== "result" && n < max; n++) {
    if (before) before(run);
    if (bot) playStep(run, bot);
    else {
      if (run.screen === "title") run.act("play");
      if (run.screen === "almost") run.act("goOn");
      if (run.screen === "card") run.act("skip");
      run.step(intents && live(run) ? intents(run) : makeIntents());
    }
    const evs = run.events.splice(0);
    all.push(...evs);
    if (each) each(run, evs);
  }
  assert.equal(run.screen, "result", "the run reaches its result");
  return all;
}
const named = (evs, name) => evs.filter((e) => e.name === name);

// One whole run with the idle bot (skill 0): stage 1 reaches its 117 s cap, so it passes the Almost card and Go on.
const IDLE = (() => {
  const run = createRun({ seed: 7, settings: {}, start: "new" });
  const evs = play(run, { bot: createBot(0, 7) });
  return { run, evs };
})();

// One whole run with the ref bot, shared by several checks.
const REF = (() => {
  const run = createRun({ seed: 7, settings: {}, start: "new" });
  const bot = createBot(1, 7);
  const beats = [], ga = [], views = [];
  let n = 0;
  const evs = play(run, {
    bot,
    before: (r) => {
      beats.push(...r.beats(r.t, r.t + DT));
      const meta = r.mod ? r.mod.meta : STAGES[0].meta;
      ga.push({ t: r.t, screen: r.screen, gaDay: r.gaDay, mm: mmPerShortAxis(meta, r.gaDay) });
      if (n++ % 60 === 0) views.push({ screen: r.screen, t: r.t, bad: validate(r.view()) });
    },
  });
  return { run, evs, beats, ga, views };
})();

await check("the stage order and the screens of a whole run; no overlay after Birth", () => {
  assert.deepEqual(STAGES.map((m) => m.meta.id), IDS);
  STAGES.forEach((m, i) => assert.equal(m.meta.index, i, `${m.meta.id} index`));
  assert.equal(ENDING.meta.id, "ending");
  assert.equal(ENDING.meta.scored, false);
  assert.deepEqual(named(REF.evs, "stageStart").map((e) => e.id), [...IDS, "ending"]);
  const screens = named(REF.evs, "screen").map((e) => e.screen + (e.data && e.data.id ? ":" + e.data.id : ""));
  const want = ["title", "stage:swim", "overlay:swim"];
  for (const id of IDS.slice(1)) want.push(`card:${id}`, `stage:${id}`, ...(id === "birth" ? [] : [`overlay:${id}`]));
  want.push("ending:ending", "result");
  assert.deepEqual(screens, want, "the ref bot reaches the meeting place 1st, so stage 1 goes straight to its overlay");
  const idle = named(IDLE.evs, "screen").map((e) => e.screen + (e.data && e.data.id ? ":" + e.data.id : "")).slice(0, 5);
  assert.deepEqual(idle, ["title", "stage:swim", "almost:swim", "stage:swim", "overlay:swim"], "idle: the cap, the Almost card, Go on");
  assert.ok(!screens.includes("overlay:birth"), "no overlay after Birth");
  assert.equal(REF.run.done, true);
  assert.equal(REF.run.summary().done, true);
  assert.deepEqual(RUN_EVENTS, ["screen", "stageStart", "carryIn", "crossfade", "stageEnd", "runEnd"]);
  assert.equal(named(REF.evs, "runEnd").length, 1);
});

await check("families per stage (16.4): at most 2, 3 for egg, from steer, tap, hold and rotate", () => {
  const want = { swim: ["steer"], egg: ["tap", "rotate", "hold"], split: ["tap", "hold"], root: ["steer", "tap"],
    grow: ["steer", "tap"], answer: ["tap", "steer"], turn: ["hold", "rotate"], birth: ["hold"], ending: ["hold"] };
  for (const m of [...STAGES, ENDING]) {
    assert.deepEqual([...m.meta.families], want[m.meta.id], m.meta.id);
    assert.ok(m.meta.families.length <= (m.meta.id === "egg" ? 3 : 2));
    for (const f of m.meta.families) assert.ok(["steer", "tap", "hold", "rotate"].includes(f));
    // the race can fail, and so can every action-layer stage (a knock-out; contract.md)
    assert.equal(m.meta.canFail, m.meta.id === "swim" || !!m.meta.action, `${m.meta.id} canFail`);
    assert.ok(Number.isFinite(m.meta.motherBpm) && m.meta.parS > 0 && m.meta.capS >= m.meta.parS, `${m.meta.id} meta numbers`);
  }
});

await check("seeds: each stage's seed is fnv1a(runSeed + \":\" + id) >>> 0", () => {
  for (const e of named(REF.evs, "stageStart")) assert.equal(e.seed, stageSeed(7, e.id), e.id);
  assert.notEqual(stageSeed(7, "egg"), stageSeed(8, "egg"));
  assert.notEqual(stageSeed(7, "egg"), stageSeed(7, "split"));
});

await check("Try again from pause recreates the stage at once; earlier scores and carry are unchanged", () => {
  const run = createRun({ seed: 11, start: "new" });
  const bot = createBot(1, 11);
  const evs = [];
  while (!(run.stageId === "split" && run.screen === "stage" && run.state.t >= 10)) { playStep(run, bot); evs.push(...run.events.splice(0)); }
  const before = run.summary().stages.map((s) => JSON.stringify(s));
  const carry = run.carry;
  const first = named(evs, "stageStart").find((e) => e.id === "split");
  assert.equal(run.act("pause"), true);
  const t = run.t;
  run.step(makeIntents({ touching: true, presses: [{ t, raw: t }] }));
  assert.equal(run.t, t, "a paused step does nothing");
  assert.equal(run.act("retry"), true);
  assert.equal(run.paused, false);
  assert.equal(run.stageId, "split");
  assert.equal(run.state.t, 0, "recreated at once");
  assert.equal(run.stageStart, run.t);
  const again = named(run.events.splice(0), "stageStart")[0];
  assert.equal(again.id, "split");
  assert.equal(again.attempt, 2);
  assert.equal(again.seed, first.seed, "the same seed");
  assert.deepEqual(again.carry, first.carry, "the same carry-in");
  assert.deepEqual(run.summary().stages.map((s) => JSON.stringify(s)), before, "earlier stages' scores unchanged");
  assert.deepEqual(run.carry, carry, "the carry unchanged");
  play(run, { bot });
  const split = run.summary().stages.find((s) => s.id === "split");
  assert.equal(split.attempts, 2);
  assert.equal(run.act("retry"), false, "nothing to retry on the result");
});

// Stage 1 attempts that both end at the Almost card: "idle" reaches the 117 s cap (place 20, no points); "late"
// waits 62 s, then swims as the ref bot and reaches the meeting place outside the top 3 (with points).
function swimAttempts(order) {
  const run = createRun({ seed: 5, start: "new" });
  run.act("play");
  const evs = [];
  for (const how of order) {
    const bot = createBot(1, 5);
    while (run.screen === "stage") {
      const late = how === "late" && run.state.t >= 62;
      run.step(late ? shiftIntents(bot.intents(run.mod, run.state), -run.stageStart) : makeIntents());
      evs.push(...run.events.splice(0));
    }
    assert.equal(run.screen, "almost", "the cap, or a finish outside the top 3, ends stage 1 with goalMet false");
    if (how !== order[order.length - 1]) { assert.equal(run.act("retry"), true); evs.push(...run.events.splice(0)); }
  }
  assert.equal(run.act("goOn"), true);
  while (run.stageId === "swim" || run.screen === "card") {
    run.step(makeIntents());
    evs.push(...run.events.splice(0));
    if (run.screen === "card") run.act("skip");
  }
  evs.push(...run.events.splice(0));
  return { run, evs };
}

await check("Try again at the Almost card: the better attempt's score is kept, the latest attempt's carry goes on", () => {
  for (const order of [["late", "idle"], ["idle", "late"]]) {
    const { run, evs } = swimAttempts(order);
    const swim = run.summary().stages.find((s) => s.id === "swim");
    assert.equal(swim.attempts, 2, order.join(" then "));
    const ends = named(evs, "stageEnd").filter((e) => e.id === "swim");
    const lateEnd = ends[order.indexOf("late")];
    assert.ok(lateEnd.result.score.total > 0 && !lateEnd.result.metrics.capped && lateEnd.result.metrics.place > 3, "the late attempt finishes outside the top 3");
    assert.equal(swim.score.total, lateEnd.result.score.total, `${order.join(" then ")}: the better attempt is kept`);
    assert.equal(ends.length, 2, "each closed attempt reports its end");
    const last = ends[ends.length - 1].result.carryOut.sperm.place;
    const egg = named(evs, "stageStart").find((e) => e.id === "egg");
    assert.equal(egg.carry.sperm.place, last, "the latest attempt's carry");
    assert.equal(last, order[1] === "idle" ? 20 : lateEnd.result.metrics.place);
    const swimStarts = named(evs, "stageStart").filter((e) => e.id === "swim");
    assert.deepEqual(swimStarts[0].carry, swimStarts[1].carry, "Try again keeps the carry-in");
    assert.equal(swimStarts[0].seed, swimStarts[1].seed, "and the seed");
  }
});

await check("Go on after the cap plays the 3 s carry: no Goal, no grade word, never past 120 s", () => {
  assert.ok(!named(REF.evs, "screen").some((e) => e.screen === "almost"), "the ref run never sees the Almost card");
  const almost = named(IDLE.evs, "screen").find((e) => e.screen === "almost");
  assert.equal(almost.data.capped, true);
  assert.equal(almost.data.place, 20, "idle is 20th at the cap");
  assert.equal(almost.data.of, 20);
  near(almost.t, 117, 1e-6, "the cap");
  const carried = named(IDLE.evs, "moment").find((e) => e.stage === "swim" && e.id === "carried");
  assert.ok(carried, "jump(\"carried\")");
  near(carried.t, almost.t, 1e-6, "Go on at once (the bot chooses it)");
  const end = named(IDLE.evs, "stageEnd").find((e) => e.id === "swim");
  assert.equal(end.result.goalMet, false);
  assert.equal(end.result.score.goal, 0);
  near(end.t - almost.t, 3, 1e-6, "3 s carried");
  const ov = named(IDLE.evs, "screen").find((e) => e.screen === "overlay" && e.data.id === "swim");
  assert.equal(ov.data.grade, null, "no grade word");
  const swim = IDLE.run.summary().stages[0];
  assert.equal(swim.grade, null);
  assert.equal(swim.score.goal, 0);
  assert.equal(swim.goalMet, false);
  const start = named(IDLE.evs, "stageStart")[0];
  assert.ok(end.t - start.t <= 120 + 1e-6, "stage 1 never runs past 120 s of stage time");
  // the Almost card waits for a choice; Go on then resumes the stage on a moved time base
  const run = createRun({ seed: 2, start: "new" });
  run.act("play");
  while (run.screen === "stage") run.step(makeIntents());
  for (let i = 0; i < 120; i++) run.step(makeIntents());
  assert.equal(run.screen, "almost", "the Almost card has no timer");
  run.events.length = 0;
  const at = run.t;
  assert.equal(run.act("goOn"), true);
  assert.equal(run.screen, "stage");
  assert.equal(run.state.moment, "carried");
  near(run.stageStart, at - 117, 1e-6, "the time base moves on by the card's 2 s");
  const evs = [];
  while (run.stageId === "swim" && run.screen === "stage") {
    near(run.state.t, run.t - run.stageStart, 1e-6, "state.t = run.t − stageStart in the carry");
    run.step(makeIntents());
    evs.push(...run.events.splice(0));
  }
  assert.equal(run.screen, "overlay");
  near(named(evs, "stageEnd")[0].t, at + 3, 1e-6, "the carry ends 3 s after Go on (core time)");
  near(run.state.t, 120, 1e-6, "at 120 s of stage time");
});

await check("practice (the goto path) of every stage works with DEFAULT_CARRY", () => {
  for (const id of [...IDS, "ending"]) {
    const run = createRun({ seed: 3, start: { practice: id } });
    assert.equal(run.screen, id === "ending" ? "ending" : "stage", `${id} starts at once, with no card`);
    assert.equal(run.stageId, id);
    assert.equal(run.practice, id);
    const evs = [...run.events.splice(0), ...play(run, { bot: createBot(1, 3) })];
    const st = named(evs, "stageStart");
    assert.equal(st.length, 1, id);
    assert.deepEqual(st[0].carry, mergeCarry(DEFAULT_CARRY, null), `${id} starts with DEFAULT_CARRY`);
    assert.equal(st[0].motherPhase, 0);
    assert.equal(named(evs, "carryIn").length, 0, "practice stores no carry-in");
    assert.equal(named(evs, "card").length + named(evs, "screen").filter((e) => e.screen === "card").length, 0, "no card");
    assert.equal(named(evs, "runEnd").length, 0, "practice is not a run");
    const sum = run.summary();
    assert.equal(sum.done, false);
    assert.equal(sum.stages.length, id === "ending" ? 0 : 1);
    if (id === "birth") assert.ok(!named(evs, "screen").some((e) => e.screen === "overlay"), "no overlay after Birth");
    assert.equal(run.result().done, true, `${id} reached its end`);
  }
  assert.equal(createRun({ start: { practice: 3 } }).stageId, "split", "a stage number works too");
  const save = { carryIn: { egg: mergeCarry(DEFAULT_CARRY, { sperm: { place: 1 } }) } };
  const fromSave = createRun({ seed: 3, save, start: { practice: "egg" } });
  assert.equal(named(fromSave.events, "stageStart")[0].carry.sperm.place, 1, "practice reads save.carryIn");
  const given = createRun({ seed: 3, save, start: { practice: "egg", carry: { sperm: { place: 9 } } } });
  assert.equal(named(given.events, "stageStart")[0].carry.sperm.place, 9, "start.carry wins");
  assert.equal(createRun({ start: { practice: "moon" } }).screen, "title", "an unknown id is a new run");
});

await check("a press at stageStart + target.t (core time) is graded In time; rawMs keeps the 90 ms offset", () => {
  const run = createRun({ seed: 2, start: "new" });
  const pressed = new Map();
  const judged = new Map();
  play(run, {
    intents: (r) => {
      const s = r.state;
      const x = r.mod.targets(s, 1).find((y) => (y.kind === "tap" || y.kind === "press") && y.t >= s.t && y.t < s.t + DT
        && !pressed.has(r.stageId + ":" + y.id));
      if (!x) return makeIntents();
      const t = r.stageStart + x.t;
      pressed.set(r.stageId + ":" + x.id, { t, stage: r.stageId });
      // stage 6 notes have a lane: be in it (dir names the lane to be in, as the bot does)
      const dir = Number.isInteger(x.lane) && x.lane >= 0 ? ["left", "up", "right"][x.lane] : null;
      return makeIntents({ touching: true, presses: [{ t, raw: t + 0.09 }], dir });
    },
    each: (r, evs) => { for (const e of named(evs, "judge")) judged.set(e.stage + ":" + e.target, e); },
  });
  assert.ok(pressed.size >= 40, `pressed ${pressed.size} targets`);
  const stages = new Set();
  for (const [key, p] of pressed) {
    const j = judged.get(key);
    assert.ok(j, `${key} was judged`);
    assert.equal(j.grade, "in", key);
    near(j.errMs, 0, 1e-6, `${key} errMs`);
    near(j.rawMs, 90, 1e-6, `${key} rawMs`);
    near(j.t, p.t, 1e-6, `${key} judge time in core seconds`);
    stages.add(p.stage);
  }
  assert.deepEqual([...stages].sort(), IDS.filter((id) => id !== "swim" && !ACTION.has(id)).sort(), "every stage with timed targets");
});

await check("stage events reach the host in core seconds, tagged with their stage", () => {
  const starts = named(REF.evs, "stageStart");
  for (const s of starts) {
    const first = REF.evs.find((e) => e.name === "moment" && e.stage === s.id);
    near(first.t, s.t, 1e-9, `${s.id}: its first moment at its start`);
    const p = REF.evs.find((e) => e.name === "prompt" && e.stage === s.id);
    near(p.t, s.t, 1e-9, `${s.id}: its first prompt`);
  }
  const done = REF.evs.filter((e) => e.name === "done");
  assert.equal(done.length, 9, "8 stages and the ending (the ref run is never carried)");
  assert.equal(IDLE.evs.filter((e) => e.name === "done").length, 10, "idle: 8 stages, the carried swim again, and the ending");
});

await check("gaDay and mmPerShortAxis never decrease over a whole run", () => {
  for (let i = 1; i < REF.ga.length; i++) {
    const a = REF.ga[i - 1], b = REF.ga[i];
    assert.ok(b.gaDay >= a.gaDay - 1e-9, `gaDay ${a.gaDay} → ${b.gaDay} at ${b.t.toFixed(2)} s (${b.screen})`);
    assert.ok(b.mm >= a.mm - 1e-9, `mm ${a.mm} → ${b.mm} at ${b.t.toFixed(2)} s (${b.screen})`);
  }
  assert.equal(REF.ga[REF.ga.length - 1].gaDay, 280);
  // the one reset allowed: a stage 1 Try again restarts stage 1, which stays at gaDay 14
  const { run } = swimAttempts(["idle", "idle"]);
  assert.ok(run.gaDay >= 14);
});

await check("her beats run on across overlays, the Almost card and cards: no gap, no jump", () => {
  const b = REF.beats;
  const ending = named(REF.evs, "stageStart").find((e) => e.id === "ending").t;
  let silence = 0;
  for (let i = 1; i < b.length; i++) {
    const gap = b[i] - b[i - 1];
    if (b[i - 1] < ending && b[i] >= ending) {
      assert.ok(b[i] >= ending + 1.5 - 1e-9, "the ending's first 1.5 s are silent");
      assert.ok(gap <= 1.5 + 0.87, `the ending's gap ${gap}`);
      silence++;
      continue;
    }
    assert.ok(gap >= 0.62 && gap <= 0.87, `gap ${gap.toFixed(4)} s at ${b[i].toFixed(2)} s`);
  }
  assert.equal(silence, 1);
  assert.ok(b.length > 500, `${b.length} beats`);
  // each stage's first beat is the run clock's next beat: motherPhase is under one period
  for (const s of named(REF.evs, "stageStart")) assert.ok(s.motherPhase >= 0 && s.motherPhase < 0.87, `${s.id} motherPhase ${s.motherPhase}`);
});

await check("one-button sets steer and dir from botSteer in every stage, and clears turn and aim", () => {
  const held = { steer: { x: 1, y: 0 }, turn: 1, aim: { x: 3, y: 4 }, dir: "left" };
  const seen = new Set();
  let n = 0;
  const run = createRun({ seed: 4, settings: { oneButton: true }, start: "new", stageOpts: { stubS: 8 } });
  play(run, {
    intents: (r) => {
      const touching = Math.floor(n++ / 30) % 2 === 0;
      const rr = stream(1, "probe");
      rr.mem = {};
      r.expect = { touching, a: r.mod.botSteer(r.state, 1, rr) };
      return makeIntents({ ...held, touching });
    },
    each: (r) => {
      if (!r.expect || !r.lastIntents) return;
      const li = r.lastIntents, one = r.lastOneButton, { touching, a } = r.expect;
      r.expect = null;
      const id = r.stageId || "ending";
      assert.ok(one, `${id}: botSteer ran`);
      assert.deepEqual({ steer: one.steer, dir: one.dir }, { steer: a.steer, dir: a.dir }, `${id}: botSteer at skill 1`);
      assert.equal(li.turn, 0, `${id}: turn cleared`);
      assert.equal(li.aim, null, `${id}: aim cleared`);
      assert.equal(li.dir, a.dir || null, `${id}: dir from botSteer`);
      assert.deepEqual(li.steer, touching ? a.steer : { x: 0, y: 0 }, `${id}: steer from botSteer only while touching`);
      seen.add(r.mod.meta.id);
    },
  });
  assert.deepEqual([...seen], [...IDS, "ending"]);
  assert.equal(run.summary().marks.oneButton, true, "the One-button mark");
  const plain = createRun({ seed: 4, start: { practice: "root" } });
  plain.step(makeIntents({ ...held, touching: true }));
  assert.deepEqual(plain.lastIntents.steer, held.steer, "off: the intents pass through");
  assert.equal(plain.lastIntents.turn, 1);
  assert.deepEqual(plain.lastIntents.aim, held.aim);
  assert.equal(plain.lastOneButton, null);
  assert.equal(plain.summary().marks.oneButton, false);
});

await check("stage 1's sperm.place reaches stage 2 and sets when your sperm comes in", () => {
  const swimEnd = named(REF.evs, "stageEnd").find((e) => e.id === "swim");
  const place = swimEnd.result.carryOut.sperm.place;
  const egg = named(REF.evs, "stageStart").find((e) => e.id === "egg");
  assert.equal(egg.carry.sperm.place, place);
  const guard = REF.evs.find((e) => e.name === "moment" && e.stage === "egg" && e.id === "guard");
  const gold = named(REF.evs, "goldIn");
  assert.equal(gold.length, 1);
  near(gold[0].t - guard.t, 27 + 0.3 * (place - 1), 1e-6, "goldIn at 27 + 0.3 (place − 1) s into the guard");
  const at = (p) => {
    const run = createRun({ seed: 3, start: { practice: "egg", carry: { sperm: { place: p } } } });
    const evs = play(run, {});
    const g = evs.find((e) => e.name === "moment" && e.id === "guard");
    return named(evs, "goldIn")[0].t - g.t;
  };
  near(at(1), 27, 1e-6, "1st");
  near(at(3), 27.6, 1e-6, "3rd");
  near(at(20), 32.7, 1e-6, "20th");
});

await check("exactly one sperm enters in a whole run", () => {
  assert.equal(named(REF.evs, "enter").length, 1, "the ref run");
  assert.equal(named(IDLE.evs, "enter").length, 1, "an idle run");
  assert.equal(named(IDLE.evs, "milestone").filter((e) => e.id === "fertilized").length, 1);
});

await check("timers: overlay 2.5 s (linger holds it), card skippable from 1.0 s and gone at 3.5 s, crossfade 0.8 s", () => {
  const run = createRun({ seed: 6, start: "new", stageOpts: { stubS: 4 } });
  run.act("play");
  const stepTo = (pred, max = 60 * 130) => { for (let i = 0; i < max && !pred(); i++) run.step(makeIntents()); };
  stepTo(() => run.screen === "almost");
  assert.equal(run.act("goOn"), true);
  stepTo(() => run.screen === "overlay");
  let t0 = run.t;
  stepTo(() => run.screen !== "overlay");
  near(run.t - t0, TIMERS.overlayS, DT + 1e-9, "the overlay goes by itself at 2.5 s");
  assert.equal(run.screen, "card");
  const evs = run.events.splice(0);
  const cf = named(evs, "crossfade").pop();
  assert.equal(cf.seconds, 0.8);
  assert.equal(named(evs, "carryIn").pop().id, "egg", "the card emits the next stage's carry-in");
  const cardData = named(evs, "screen").pop().data;
  assert.deepEqual([cardData.id, cardData.n, cardData.name, cardData.verb, cardData.label], ["egg", 2, "The Egg", "Guard", "Week 2"]);
  assert.deepEqual(validate(run.view()), [], "the card shows the next stage's first frame");
  t0 = run.t;
  stepTo(() => run.screen !== "card");
  near(run.t - t0, TIMERS.cardS, DT + 1e-9, "the card goes by itself at 3.5 s");
  assert.equal(run.stageId, "egg");
  stepTo(() => run.screen === "overlay");
  assert.equal(run.act("linger"), true);
  t0 = run.t;
  stepTo(() => run.screen !== "overlay", 600);
  assert.equal(run.screen, "overlay", "linger holds the overlay");
  assert.equal(run.act("next"), true);
  assert.equal(run.screen, "card");
  t0 = run.t;
  for (let i = 0; i < 30; i++) run.step(makeIntents());
  assert.equal(run.act("skip"), false, "not before 1.0 s");
  assert.equal(run.act("next"), false);
  for (let i = 0; i < 30; i++) run.step(makeIntents());
  assert.equal(run.act("skip"), true, "skippable from 1.0 s");
  assert.equal(run.stageId, "split");
  assert.equal(run.screen, "stage");
  assert.equal(run.act("goOn"), false, "no Almost card here");
  assert.equal(run.act("play"), false);
  assert.equal(run.act("bogus"), false);
});

await check("run.ms counts the stages, overlays, Almost card and cards, never pause or the ending", () => {
  const evs = REF.evs;
  const play0 = named(evs, "stageStart")[0].t, endingStart = named(evs, "stageStart").find((e) => e.id === "ending").t;
  near(REF.run.ms, (endingStart - play0) * 1000, 1, "from Play to the end of Birth");
  const run = createRun({ seed: 7, start: { practice: "split" }, stageOpts: { stubS: 5 } });
  for (let i = 0; i < 60; i++) run.step(makeIntents());
  assert.equal(run.act("pause"), true);
  assert.equal(run.act("pause"), false);
  const ms = run.ms, t = run.t, st = JSON.stringify({ t: run.state.t, gaDay: run.state.gaDay });
  for (let i = 0; i < 120; i++) run.step(makeIntents());
  assert.equal(run.ms, ms, "pause adds nothing");
  assert.equal(run.t, t);
  assert.equal(JSON.stringify({ t: run.state.t, gaDay: run.state.gaDay }), st, "and the stage holds still");
  assert.equal(run.act("resume"), true);
  for (let i = 0; i < 60; i++) run.step(makeIntents());
  near(run.ms, 2000, 1, "two seconds of stage");
});

await check("the summary: the run total, sparks, marks and the carry's sparks", () => {
  const sum = REF.run.summary();
  assert.equal(sum.stages.length, 8);
  assert.deepEqual(sum.stages.map((s) => s.id), IDS);
  assert.equal(sum.total, runTotal(sum.stages));
  const glowing = sum.stages.filter((s) => s.grade === "Glowing").length;
  assert.equal(sum.sparks, glowing);
  assert.equal(sum.total, sum.stages.reduce((a, s) => a + s.score.total, 0) + 500 * glowing);
  assert.deepEqual(sum.marks, { assist: false, oneButton: false });
  assert.ok(Array.isArray(sum.facts));
  let g = 0;
  for (const s of named(REF.evs, "stageStart")) {
    assert.equal(s.carry.sparks, g, `${s.id} starts with ${g} sparks`);
    const k = sum.stages.find((x) => x.id === s.id);
    if (k && k.grade === "Glowing") g++;
  }
  const end = named(REF.evs, "runEnd")[0].summary;
  assert.deepEqual(end, sum);
  const assisted = createRun({ seed: 1, settings: { assist: true }, start: { practice: "egg" } });
  play(assisted, { bot: createBot(1, 1) });
  assert.equal(assisted.summary().marks.assist, true, "the Assist mark");
});

await check("every run view validates (title, stage, overlay, Almost card, card, ending, result)", () => {
  const screens = new Set(REF.views.map((v) => v.screen));
  for (const s of ["title", "stage", "overlay", "almost", "card", "ending"]) assert.ok(screens.has(s) || s === "almost", `saw ${s}`);
  for (const v of REF.views) assert.deepEqual(v.bad, [], `${v.screen} at ${v.t.toFixed(2)} s`);
  assert.deepEqual(validate(REF.run.view()), [], "the result");
  assert.deepEqual(validate(createRun({ seed: 1 }).view()), [], "the title");
});

await check("the shared bot (16.11): σ = 15 + 135 (1 − skill) ms, skip = 0.4 (1 − skill), skill 0 idle, its choices", () => {
  // a tap stage's presses (stage 6); the action stages have no timed targets
  const answer = STAGES.find((m) => m.meta.id === "answer");
  // presses against the targets they aim at, played the 16.11 way (stage time, no run)
  const sample = (skill) => {
    const errs = [];
    let targets = 0;
    for (let seed = 1; seed <= 14; seed++) {
      for (const mod of [answer]) {
        const st = mod.create(seed, DEFAULT_CARRY, { assist: false, oneButton: false, motherPhase: 0 });
        const bot = createBot(skill, seed);
        const all = [];
        while (!mod.result(st).done) {
          for (const x of mod.targets(st, 5)) if (!all.some((y) => y.id === x.id)) all.push(x);
          const it = bot.intents(mod, st);
          for (const p of it.presses) {
            const x = all.reduce((a, y) => (Math.abs(y.t - p.t) < Math.abs(a.t - p.t) ? y : a));
            errs.push((p.t - x.t) * 1000);
          }
          mod.step(st, it);
          st.events.length = 0;
        }
        targets += all.length;
      }
    }
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    const sd = Math.sqrt(errs.reduce((a, b) => a + (b - mean) ** 2, 0) / errs.length);
    return { sd, pressed: errs.length / targets, n: targets };
  };
  const ref = sample(1), mid = sample(0.4);
  assert.ok(ref.n > 300, `${ref.n} targets`);
  near(ref.sd, 15, 2.5, "skill 1.0: σ 15 ms");
  near(ref.pressed, 1, 1e-9, "skill 1.0 skips nothing");
  near(mid.sd, 96, 12, "skill 0.4: σ 96 ms");
  near(mid.pressed, 1 - 0.24, 0.05, "skill 0.4 skips 24%");
  // skill 0 is idle
  const idle = createBot(0, 1), egg = STAGES[1];
  const st = egg.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  while (!egg.result(st).done) {
    const it = idle.intents(egg, st);
    assert.deepEqual(it, makeIntents(), "skill 0 gives no input");
    egg.step(st, it);
  }
  // steer comes from the stage's botSteer at the bot's skill; a release target gets a fresh press
  const root = STAGES[3];
  const rs = root.create(1, DEFAULT_CARRY, { motherPhase: 0 });
  const b = createBot(0.5, 1).intents(root, rs);
  assert.deepEqual(b.steer, root.botSteer(rs, 0.5, stream(0, "x")).steer);
  assert.equal(b.touching, true, "a stick off centre is touching");
  const turn = STAGES[6];
  const ts = turn.create(2, DEFAULT_CARRY, { motherPhase: 0 });
  const tb = createBot(1, 2);
  let held = false, sawRelease = false;
  while (!turn.result(ts).done && ts.moment === "breathe") {
    const it = tb.intents(turn, ts);
    if (it.presses.length) { assert.equal(held, false, "a press only after a release"); held = true; }
    if (it.releases.length) { assert.equal(held, true); held = false; sawRelease = true; }
    turn.step(ts, it);
    ts.events.length = 0;
  }
  assert.ok(sawRelease);
  const c = createBot(0.7, 1);
  assert.deepEqual(["title", "almost", "card", "overlay", "stage", "ending", "result"].map((s) => c.choose(s)),
    ["play", "goOn", "skip", null, null, null, null]);
  assert.equal(createBot(0, 1).choose("almost"), "goOn", "even idle goes on");
});

// ---- the host's contract (integration): facts, sound times, the ending's run time
await check("every fact the run passes on or lists is a shown one (checked, access R or A), and card and overlay facts too", () => {
  for (const { run, evs } of [REF, IDLE]) {
    for (const e of named(evs, "fact")) assert.ok(isShown(factById(e.id)), `fact ${e.id} (${e.stage}) is shown`);
    for (const id of run.summary().facts) assert.ok(isShown(factById(id)), `summary fact ${id}`);
    for (const e of named(evs, "screen")) {
      const d = e.data || {};
      if (e.screen === "card") for (const id of d.facts || []) assert.ok(isShown(factById(id)), `card fact ${id}`);
      if (e.screen === "overlay" && d.fact) assert.ok(isShown(factById(d.fact)), `overlay fact ${d.fact}`);
    }
  }
  // a fact table entry with checked: false (turn.weight, 15.1) is never picked
  for (const f of FACTS) if (f.checked !== true) assert.ok(!REF.run.summary().facts.includes(f.id), `${f.id} stays out`);
});

await check("sound times reach the host in core seconds: an sfx's and a song's `at` sit by its core t", () => {
  let n = 0;
  for (const e of REF.evs) {
    if ((e.name !== "sfx" && e.name !== "song") || !Number.isFinite(e.at)) continue;
    n++;
    assert.ok(e.at >= e.t - 10 && e.at <= e.t + 15, `${e.stage} ${e.name} ${e.id}: at ${e.at.toFixed(2)} vs t ${e.t.toFixed(2)}`);
  }
  assert.ok(n > 50, `${n} timed sounds`);
});

await check("the ending's run time line: run.ms from Play to the end of Birth in a run, and none in practice", () => {
  const start = named(REF.evs, "stageStart").find((e) => e.id === "ending");
  const line = named(REF.evs, "caption").find((e) => e.id === "ending.time");
  assert.ok(start && line, "the ending starts and says the run time");
  assert.equal(line.ms, REF.run.ms, "the line's ms is run.ms (which stops when the ending starts)");
  assert.equal(line.vars && line.vars.time, minSec(REF.run.ms));
  const p = createRun({ seed: 7, start: { practice: "ending" } });
  const pe = play(p, {});
  const pl = named(pe, "caption").find((e) => e.id === "ending.time");
  assert.equal(p.ms, 0, "practice counts no run time");
  assert.ok(!pl || (pl.ms === null && !pl.vars), "in practice the ending leaves the time to the host, which shows none");
});

await check("feed() takes odd intents without throwing", () => {
  const tr = createTrack([{ id: 1, t: 1, P: 0.8, kind: "tap" }, { id: 2, t: 2, P: 0.8, kind: "release" }]);
  for (const odd of [null, undefined, {}, { presses: 5 }, { presses: {}, releases: "x" }, { presses: [null, { t: "a" }], releases: [{}] }]) {
    assert.doesNotThrow(() => feed(tr, odd, 0.5));
  }
  assert.deepEqual(feed(tr, { presses: [{ t: 1.01, raw: 1.01 }] }, 1.1).map((r) => r.grade), ["in"]);
});

// ---- review fixes (F1 to F5)

// Practice one stage with the perfect bot. Each press and release is made `late` s after the bot's time and reaches
// the page at its raw time (t + the offset) plus one frame, as in the page (ui/input.js stamps t = raw − offset).
// pauseAt (stage s): pause there, two steps, resume; skip: the target id whose press (or release) is never made.
function practise(id, { offsetMs = 0, late = 0, pauseAt = null, skip = null, seed = 7 } = {}) {
  const run = createRun({ seed, settings: { offsetMs }, start: { practice: id } });
  const bot = createBot(1, seed);
  const offS = offsetMs / 1000, q = [], grades = {}, seen = new Map();
  let paused = false;
  for (let n = 0; run.screen !== "result" && n < MAX_STEPS; n++) {
    const c = bot.choose(run.screen);
    if (c) run.act(c);
    let it = makeIntents();
    if (live(run) && run.state) {
      for (const x of run.mod.targets(run.state, 3) || []) if (!seen.has(x.id)) seen.set(x.id, { ...x });
      if (pauseAt !== null && !paused && run.state.t >= pauseAt - 1e-9) {
        assert.equal(run.act("pause"), true);
        run.step(makeIntents()); run.step(makeIntents());
        assert.equal(run.act("resume"), true);
        paused = true;
      }
      const s = bot.intents(run.mod, run.state);
      if (skip) {
        const w = 0.45 * skip.P;
        if (skip.kind === "release") s.releases = s.releases.filter((p) => Math.abs(p.t - skip.t) > w);
        else s.presses = s.presses.filter((p) => Math.abs(p.t - skip.t) > w);
      }
      it = shiftIntents(s, -run.stageStart);
      for (const k of ["presses", "releases"]) for (const p of it[k]) q.push({ k, t: p.t + late, raw: p.t + late + offS });
      it.presses = []; it.releases = [];
    }
    const tEnd = run.t + DT;
    for (let i = 0; i < q.length; i++) {
      const e = q[i];
      if (e.raw + DT <= tEnd && e.t < tEnd) { it[e.k].push({ t: e.t, raw: e.raw }); q.splice(i--, 1); }
    }
    it.presses.sort((a, b) => a.t - b.t);
    it.releases.sort((a, b) => a.t - b.t);
    run.step(it);
    for (const ev of run.events.splice(0)) if (ev.name === "judge") grades[ev.grade] = (grades[ev.grade] || 0) + 1;
  }
  assert.equal(run.screen, "result", `${id} reaches its result`);
  const s = run.summary().stages[0];
  return { run, total: s.score.total, grade: s.grade, grades, seen };
}

await check("F1: with a +150 ms timing offset, presses 100 ms late that reach the page 150 ms later grade as with none", () => {
  for (const id of TIMED(["egg", "split", "root", "grow", "answer", "turn", "birth"])) {
    const a = practise(id, { late: 0.1 }), b = practise(id, { offsetMs: 150, late: 0.1 });
    assert.ok(!a.grades.miss, `${id}: no miss with no offset (${JSON.stringify(a.grades)})`);
    assert.deepEqual(b.grades, a.grades, `${id}: the same grades with +150 ms`);
    assert.equal(b.total, a.total, `${id}: the same total with +150 ms`);
  }
  // an offset set in Settings while paused takes effect at Resume, on every track the stage holds
  for (const id of TIMED(["egg", "split", "root", "grow", "answer", "turn", "birth"])) {
    const run = createRun({ seed: 7, settings: { offsetMs: 0 }, start: { practice: id } });
    for (let i = 0; i < 60; i++) run.step(makeIntents());
    run.act("pause");
    run.settings.offsetMs = 120;
    run.act("resume");
    const tracks = [];
    for (const v of Object.values(run.state)) {
      if (v && Array.isArray(v.targets) && Array.isArray(v.results)) tracks.push(v);
      else if (v && typeof v === "object" && !Array.isArray(v)) for (const w of Object.values(v)) if (w && Array.isArray(w.targets) && Array.isArray(w.results)) tracks.push(w);
    }
    assert.ok(tracks.length >= 1, `${id} holds a track`);
    for (const tr of tracks) near(tr.lag, 0.12, 1e-12, `${id}: a track's lag after Resume`);
    near(run.state.lag, 0.12, 1e-12, `${id}: the stage's lag after Resume`);
  }
});

await check("F2: fair resume: resume 0.3 s before a target, then never press it, and the stage scores as if unpaused", () => {
  for (const id of TIMED(["egg", "split", "root", "grow", "answer", "turn"])) {
    const a = practise(id);
    // the egg's opening taps come first (a missed one there costs Skill); elsewhere the 3rd target after 4 s
    const x = id === "egg" ? [...a.seen.values()].sort((p, q) => p.t - q.t)[0]
      : [...a.seen.values()].filter((v) => v.t > 4).sort((p, q) => p.t - q.t)[2];
    const b = practise(id, { pauseAt: x.t - 0.3, skip: x });
    assert.equal(b.total, a.total, `${id}: ${x.id} (${x.kind} at ${x.t.toFixed(2)} s) is left out of accuracy`);
    assert.ok(b.grades.miss >= 1, `${id}: the skipped target was missed (${JSON.stringify(b.grades)})`);
    const c = practise(id, { pauseAt: x.t - 0.3 });
    assert.equal(c.total, a.total, `${id}: pressed after the resume, it changes nothing either`);
    const late = practise(id, { pauseAt: x.t - 1.5, skip: x });
    assert.ok(late.total < a.total, `${id}: a target 1.5 s after the resume still counts (${late.total} vs ${a.total})`);
  }
});

await check("F3: Try again from pause on the overlay and the card plays the stage that just ended; in the ending, the ending", () => {
  const run = createRun({ seed: 3, start: "new" });
  run.act("play");
  const toOverlay = () => {
    run.finish();
    if (run.screen === "almost") run.act("goOn");
    for (let n = 0; run.screen !== "overlay" && n < 600; n++) run.step(makeIntents());
    assert.equal(run.screen, "overlay");
  };
  toOverlay();
  const kept = run.summary().stages[0].score.total;
  for (const where of ["overlay", "card"]) {
    if (where === "card") { toOverlay(); run.act("next"); assert.equal(run.screen, "card"); }
    assert.equal(run.act("pause"), true);
    run.events.length = 0;
    assert.equal(run.act("retry"), true, `retry on the ${where}`);
    assert.equal(run.paused, false);
    assert.equal(run.screen, "stage");
    assert.equal(run.stageId, "swim", `the ${where}: the stage that just ended`);
    assert.equal(run.state.t, 0);
    const start = named(run.events, "stageStart")[0];
    assert.ok(start && start.id === "swim" && start.attempt === (where === "overlay" ? 2 : 3), `a new attempt on the ${where}`);
    assert.equal(run.summary().stages[0].score.total, kept, "the kept score stays");
  }
  const end = createRun({ seed: 3, start: { practice: "ending" } });
  for (let i = 0; i < 120; i++) end.step(makeIntents());
  end.act("pause");
  assert.equal(end.act("retry"), true, "retry in the ending");
  assert.equal(end.screen, "ending");
  assert.equal(end.state.t, 0, "the ending starts again");
  assert.equal(end.paused, false);
});

await check("F4: a practice result's total is the stage's own, with no Glowing bonus", () => {
  const p = practise("answer");
  assert.equal(p.grade, "Glowing");
  const sum = p.run.summary();
  assert.equal(sum.total, sum.stages[0].score.total, "no +500 in practice");
  assert.ok(sum.total <= 10000);
  assert.equal(REF.run.summary().total, runTotal(REF.run.summary().stages), "a run keeps its +500 per Glowing");
});

await check("F5: rim sparks: every stage from 2 on draws carry.sparks round you, within the draw limits", () => {
  // the spark-sized ripples (0.008 × span): an action stage's own rings (a growth ring) are larger, and its sparks
  // are also shield pips, so its runs with and without them part ways
  const ripples = (d) => d.strips.filter((s) => s.kind === "ripples")
    .reduce((a, s) => a + s.items.filter((it) => it.r <= 0.0081 * d.camera.span).length, 0);
  for (const m of [...STAGES.slice(1), ENDING]) {
    const mk = (n) => m.create(7, mergeCarry(DEFAULT_CARRY, { sparks: n }), { motherPhase: 0 });
    const a = mk(0), b = mk(5), c = mk(12);
    for (let i = 0; i < 30 / DT; i++) {
      for (const s of [a, b, c]) { m.step(s, makeIntents()); s.events.length = 0; }
      if (i % 60) continue;
      const va = m.view(a), vb = m.view(b), vc = m.view(c);
      assert.notEqual(JSON.stringify(vb), JSON.stringify(va), `${m.meta.id} at ${a.t.toFixed(1)} s: the sparks show`);
      if (["egg", "root", "grow", "turn", "birth"].includes(m.meta.id)) {
        assert.equal(ripples(vb) - ripples(va), 5, `${m.meta.id} at ${a.t.toFixed(1)} s: five sparks`);
        assert.equal(ripples(vc) - ripples(va), 8, `${m.meta.id}: at most 8`);
      }
      assert.deepEqual(validate(vc), [], `${m.meta.id} at ${a.t.toFixed(1)} s with 12 sparks`);
    }
  }
});

await check("the same seed and bot play the same run", () => {
  const a = createRun({ seed: 7, start: "new" });
  const evs = play(a, { bot: createBot(1, 7) });
  assert.deepEqual(a.summary(), REF.run.summary());
  assert.equal(JSON.stringify(evs), JSON.stringify(REF.evs), "the same events");
  const c = createRun({ seed: 8, start: "new" });
  play(c, { bot: createBot(0.7, 8) });
  const d = createRun({ seed: 8, start: "new" });
  play(d, { bot: createBot(0.7, 8) });
  assert.deepEqual(c.summary(), d.summary());
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks`);
}
