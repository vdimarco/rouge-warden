// First Breath: the save and the cabinet line (design.md 10, 7). Broken JSON, old versions and blocked storage give
// defaults and never throw; bad fields fall back one by one; the best run only improves (a tie goes to the faster
// time) and an unfinished run never counts; each stage keeps its best; carryIn is kept per stage; the cabinet line
// reads "BEST 61,240" for a finished best run above 0 and RACE · GUARD · GROW · BREATHE otherwise. Also the score
// rules the save relies on (clampScore, grade, runTotal) and mergeCarry.
// node qa/first-breath/save.test.mjs
import assert from "node:assert/strict";
import { SAVE_KEY, STAGE_IDS, defaults, parse, recordStage, recordRun, recordCarryIn, cabinetLine }
  from "../../public/first-breath/core/save.js";
import { PARTS, clampScore, grade, runTotal } from "../../public/first-breath/core/score.js";
import { DEFAULT_CARRY, DEFAULT_SONG, mergeCarry } from "../../public/first-breath/core/carry.js";

const FILE = "qa/first-breath/save.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const PLAIN = "RACE · GUARD · GROW · BREATHE";
const result = (total, goalMet = true) => ({ done: true, goalMet, score: { goal: 3000, skill: total - 3000, flourish: 0, total } });
const summary = (total, ms, extra = {}) => ({
  total, ms, sparks: 0, facts: [], marks: { assist: false, oneButton: false },
  stages: STAGE_IDS.map((id, i) => ({ id, score: 7000, grade: i === 2 ? "Glowing" : "Great", parts: [] })), ...extra,
});

await check("the key and the defaults (design.md 10)", () => {
  assert.equal(SAVE_KEY, "first-breath.save.v1");
  assert.deepEqual(defaults(), {
    v: 1, best: null, reached: 0, stages: {}, carryIn: {},
    settings: { carer: "mother", assist: false, oneButton: false, motion: "auto", captions: true, largeText: false, offsetMs: 0 },
  });
  assert.notEqual(defaults(), defaults(), "a fresh object each time");
  assert.deepEqual(STAGE_IDS, ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"]);
});

await check("broken JSON, junk and old versions give defaults and never throw", () => {
  const junk = [null, undefined, "", "not json", "{", "[]", "3", "\"x\"", "null", "true", "{\"v\":0}", "{\"v\":2}",
    "{\"best\":{\"score\":5}}", 42, [], { v: "1" }, { v: 0, best: { score: 9, ms: 1, done: true } }];
  for (const raw of junk) assert.deepEqual(parse(raw), defaults(), `parse(${JSON.stringify(raw)})`);
  const hostile = { v: 1 };
  Object.defineProperty(hostile, "settings", { get() { throw new Error("boom"); }, enumerable: true });
  assert.deepEqual(parse(hostile), defaults(), "a getter that throws");
  assert.deepEqual(parse("{\"v\":1,\"__proto__\":{\"best\":1},\"stages\":{\"__proto__\":{\"best\":1}}}"), defaults(),
    "no prototype tricks");
});

await check("blocked storage: a store that throws reads as nothing, and the game gets defaults", () => {
  const blocked = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceeded"); } };
  // ui/store.js wraps every read in try/catch and falls back to null; core/save.js takes it from there
  let raw = "unused";
  try { raw = blocked.getItem(SAVE_KEY); } catch (e) { raw = null; }
  assert.deepEqual(parse(raw), defaults());
  assert.equal(cabinetLine(raw), PLAIN);
  const s = recordRun(raw, summary(50000, 500000));
  assert.equal(s.best.score, 50000, "records still work on top of nothing");
});

await check("bad fields fall back one by one; a good save round-trips", () => {
  const raw = {
    v: 1,
    best: { score: 61240, ms: 588000, done: true, assist: true, oneButton: false, grades: ["Great", "Good", "x"] },
    reached: 99,
    stages: { swim: { best: 8420, grade: "Great" }, egg: { best: "lots" }, moon: { best: 1, grade: "Good" }, split: { best: 12000, grade: "Shiny" } },
    carryIn: { egg: { sperm: { place: 5, hue: 0.2, glow: 1 }, extra: 1 }, moon: {} },
    settings: { carer: "mum", assist: "yes", oneButton: true, motion: "reduced", captions: false, largeText: true, offsetMs: 400 },
  };
  const s = parse(JSON.stringify(raw));
  assert.deepEqual(s.best, { score: 61240, ms: 588000, done: true, assist: true, oneButton: false,
    grades: ["Great", "Good", null, null, null, null, null, null] });
  assert.equal(s.reached, 8, "clamped to 8 stages");
  assert.deepEqual(Object.keys(s.stages), ["swim", "split"], "a bad entry and an unknown stage are dropped");
  assert.deepEqual(s.stages.split, { best: 10000, grade: null, assist: false, oneButton: false }, "clamped; unknown grade");
  assert.deepEqual(Object.keys(s.carryIn), ["egg"]);
  assert.deepEqual(s.carryIn.egg.sperm, { hue: 0.2, place: 5, glow: 1 });
  assert.ok(!("extra" in s.carryIn.egg), "unknown carry fields are dropped");
  assert.deepEqual(s.settings, { carer: "mum", assist: false, oneButton: true, motion: "reduced", captions: false, largeText: true, offsetMs: 150 });
  assert.deepEqual(parse(JSON.stringify(s)), s, "round trip");
  assert.deepEqual(parse({ v: 1, settings: { carer: "auntie", motion: "fast", offsetMs: -37.6 } }).settings,
    { ...defaults().settings, offsetMs: -38 }, "an unknown carer word and motion fall back");
});

await check("the best run only improves; a tie goes to the faster time; unfinished runs never count", () => {
  let s = recordRun(defaults(), summary(40000, 600000));
  assert.deepEqual(s.best, { score: 40000, ms: 600000, done: true, assist: false, oneButton: false,
    grades: ["Great", "Great", "Glowing", "Great", "Great", "Great", "Great", "Great"] });
  assert.equal(s.reached, 8);
  const before = JSON.stringify(s);
  assert.equal(recordRun(s, summary(39999, 100000)).best.score, 40000, "lower total: kept");
  assert.equal(recordRun(s, summary(40000, 610000)).best.ms, 600000, "tie, slower: kept");
  assert.equal(recordRun(s, summary(40000, 590000)).best.ms, 590000, "tie, faster: replaced");
  assert.equal(recordRun(s, summary(40001, 900000)).best.score, 40001, "higher total: replaced");
  assert.equal(recordRun(s, summary(80000, 1, { done: false })).best.score, 40000, "an unfinished run is ignored");
  assert.equal(JSON.stringify(s), before, "records never change the save they are given");
  s = recordRun(s, summary(50000, 500000, { marks: ["Assist", "One-button"] }));
  assert.equal(s.best.assist, true); assert.equal(s.best.oneButton, true, "marks as a list");
  s = recordRun(s, summary(60000, 500000, { marks: { assist: false, oneButton: true } }));
  assert.equal(s.best.assist, false); assert.equal(s.best.oneButton, true, "marks as an object");
  assert.equal(recordRun(s, null).best.score, 60000);
  assert.equal(recordRun(s, { total: NaN, ms: 1 }).best.score, 60000);
});

await check("each stage keeps its best (runs and practice), its grade and marks", () => {
  let s = recordStage(defaults(), "egg", result(7000), { assist: true });
  assert.deepEqual(s.stages.egg, { best: 7000, grade: "Great", assist: true, oneButton: false });
  assert.equal(s.reached, 2, "the stage counts as reached");
  s = recordStage(s, "egg", result(6000), {});
  assert.equal(s.stages.egg.best, 7000, "a lower score never replaces");
  s = recordStage(s, "egg", result(9000), { oneButton: true });
  assert.deepEqual(s.stages.egg, { best: 9000, grade: "Glowing", assist: false, oneButton: true });
  s = recordStage(s, "swim", result(4000, false), {});
  assert.deepEqual(s.stages.swim, { best: 4000, grade: null, assist: false, oneButton: false }, "Go on: points, no grade");
  s = recordStage(s, "swim", result(4000, true), {});
  assert.equal(s.stages.swim.grade, "Good", "the same total with the goal met takes the grade");
  assert.equal(s.reached, 2);
  assert.deepEqual(recordStage(s, "moon", result(9000), {}), s, "an unknown stage changes nothing");
  assert.deepEqual(recordStage(s, "grow", { done: true, score: null }, {}).stages.grow, undefined, "no score, no best");
});

await check("carryIn is kept per stage, merged onto the defaults", () => {
  let s = recordCarryIn(defaults(), "egg", { sperm: { hue: 0.11, place: 1, glow: 1 }, junk: true });
  s = recordCarryIn(s, "grow", { nestleX: -0.4, treeSeed: 1234 });
  assert.deepEqual(s.carryIn.egg, { ...mergeCarry(DEFAULT_CARRY, {}), sperm: { hue: 0.11, place: 1, glow: 1 } });
  assert.equal(s.carryIn.grow.nestleX, -0.4);
  assert.equal(s.carryIn.grow.treeSeed, 1234);
  assert.equal(s.carryIn.egg.nestleX, 0, "stages keep their own carry");
  assert.equal(s.reached, 5, "grow is stage 5");
  s = recordCarryIn(s, "egg", { sperm: { place: 7 } });
  assert.deepEqual(s.carryIn.egg.sperm, { hue: 0.11, place: 7, glow: 0.5 }, "the latest start wins, from the defaults");
  assert.deepEqual(parse(JSON.stringify(s)).carryIn, s.carryIn, "carry survives the round trip");
});

await check("cabinetLine: BEST with commas for a finished best above 0, else the plain line", () => {
  const best = (b) => ({ v: 1, best: b, reached: 8, stages: {}, carryIn: {}, settings: defaults().settings });
  assert.equal(cabinetLine(best({ score: 61240, ms: 588000, done: true, grades: [] })), "BEST 61,240");
  assert.equal(cabinetLine(JSON.stringify(best({ score: 61240, ms: 1, done: true }))), "BEST 61,240", "from the stored text");
  assert.equal(cabinetLine(best({ score: 84000, done: true })), "BEST 84,000");
  assert.equal(cabinetLine(best({ score: 999, done: true })), "BEST 999");
  assert.equal(cabinetLine({ v: 1, reached: 6, best: null }), PLAIN, "no finished run, 6 stages reached");
  assert.equal(cabinetLine(best({ score: 61240, done: false })), PLAIN, "not finished");
  assert.equal(cabinetLine(best({ score: 0, done: true })), PLAIN, "a score of 0");
  assert.equal(cabinetLine(best({ score: "61240", done: true })), PLAIN, "a score that is not a number");
  assert.equal(cabinetLine(best({ score: NaN, done: true })), PLAIN);
  assert.equal(cabinetLine(best({ score: 61240, done: "yes" })), PLAIN, "done must be true");
  for (const raw of [null, undefined, "", "not json", "[]", "{\"best\":null}", 7]) assert.equal(cabinetLine(raw), PLAIN, String(raw));
  assert.equal(cabinetLine(recordRun(defaults(), summary(61240, 588000))), "BEST 61,240", "after a recorded run");
});

await check("score: parts clamp to integers, grades at 6,500 and 8,500, the run total adds 500 per Glowing", () => {
  assert.deepEqual(PARTS, { goal: 3000, skill: 6000, flourish: 1000 });
  assert.deepEqual(clampScore({ goal: 3000, skill: 4999.6, flourish: 250.4 }), { goal: 3000, skill: 5000, flourish: 250, total: 8250 });
  assert.deepEqual(clampScore({ goal: 9000, skill: 9000, flourish: -5 }), { goal: 3000, skill: 6000, flourish: 0, total: 9000 });
  assert.deepEqual(clampScore({ goal: NaN }), { goal: 0, skill: 0, flourish: 0, total: 0 });
  assert.equal(grade(3000, true), "Good");
  assert.equal(grade(6499, true), "Good");
  assert.equal(grade(6500, true), "Great");
  assert.equal(grade(8499, true), "Great");
  assert.equal(grade(8500, true), "Glowing");
  assert.equal(grade(9500, false), null, "goal not met (a stage 1 Go on): no grade word");
  const eight = (g, t) => STAGE_IDS.map((id) => ({ id, score: t, grade: g }));
  assert.equal(runTotal(eight("Glowing", 10000)), 84000, "the most a run can score");
  assert.equal(runTotal(eight("Great", 7000)), 56000);
  assert.equal(runTotal([{ total: 9000, grade: "Glowing" }, { score: { total: 4000 }, grade: null }]), 13500, "every entry shape");
  assert.equal(runTotal([]), 0);
});

await check("mergeCarry: defaults, then prev, then out; unknown or bad fields are dropped", () => {
  assert.deepEqual(mergeCarry(), { sparks: 0, sperm: { hue: 0.11, place: 3, glow: 0.5 }, nestleX: 0, treeSeed: null,
    song: { notes: [...DEFAULT_SONG], lit: 0 }, turnDir: 1 });
  assert.equal(DEFAULT_SONG.length, 16);
  const c = mergeCarry({ sparks: 2, sperm: { place: 1 }, song: { lit: 5 } }, { sperm: { glow: 1 }, turnDir: -1, nestleX: 4, zzz: 1 });
  assert.deepEqual(c, { sparks: 2, sperm: { hue: 0.11, place: 1, glow: 1 }, nestleX: 1, treeSeed: null,
    song: { notes: [...DEFAULT_SONG], lit: 5 }, turnDir: -1 });
  const bad = mergeCarry({ sperm: { place: 0 }, turnDir: 2, song: { notes: [1, 2] }, treeSeed: -4 }, null);
  assert.deepEqual(bad, mergeCarry(), "out-of-range values are ignored");
  c.song.notes[0] = 99;
  assert.equal(DEFAULT_SONG[0], 55, "a new object: the defaults are never shared");
  assert.ok(Object.isFrozen(DEFAULT_CARRY) && Object.isFrozen(DEFAULT_CARRY.sperm));
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks`);
}
