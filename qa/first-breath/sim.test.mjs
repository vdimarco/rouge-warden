// First Breath: whole runs played by the shared bot, and the bot gates of design.md 18 (16.11; tasks.md 5.2).
// 20 seeds × skills 1.0, 0.7, 0.5 and 0, each a whole run through core/run.js with core/bots.js (qa/first-breath/
// bot.mjs playRun: Play, Go on at the Almost card, the card skipped from 1.0 s), and the gates:
// - every run reaches its result without throwing, with its 8 stage scores, and every stage (and the ending) ends by
//   its cap: stage 1 by 120 s (the 117 s cap plus the carried 3 s after Go on);
// - skill 1.0: the mean total of every stage over the 20 runs is ≥ 8,500;
// - skill 0.5 reaches the goal in ≥ 90% of runs in each of stages 2 to 8; in stage 1 it may get the Almost card, and
//   then Go on leads on with no grade word (and no Goal) and the run goes on to the result;
// - the stage 1 race gate: skill 0.7 is in the top 3 at the meeting place in ≥ 90% of runs;
// - skill 0.7 runs take 8 to 12 min of game time (core time from Play to the run result: stages, overlays, cards and
//   the ending, no pause), every run;
// - skill 0 never throws, ends every stage by its cap, and its stage 1 ends at the cap with no goal;
// - the same seed and skill play the same run; skill 1.0 outscores 0.7, 0.7 outscores 0.5, and 0.5 outscores 0;
// - the whole suite stays under 120 s of wall time.
// The PASS line gives, per skill, the mean run total, game time and the stage 1 top-3 count.
// node qa/first-breath/sim.test.mjs        (FB_SIM_SEEDS=N sets the seeds per skill, default 20; FB_VERBOSE=1 prints
// the per-stage means)
import assert from "node:assert/strict";
import { playRun } from "./bot.mjs";
import { STAGES, ENDING } from "../../public/first-breath/core/stages/index.js";
import { DT } from "../../public/first-breath/core/clock.js";

const FILE = "qa/first-breath/sim.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const SKILLS = [1.0, 0.7, 0.5, 0];
const SEEDS = Math.max(1, Number(process.env.FB_SIM_SEEDS) || 20);
const IDS = STAGES.map((m) => m.meta.id);
const CAP = Object.fromEntries([...STAGES, ENDING].map((m) => [m.meta.id, m.meta.capS + (m.meta.id === "swim" ? 3 : 0)]));
const GATE = { refMean: 8500, goalShare: 0.9, raceTop3: 0.9, minS: 8 * 60, maxS: 12 * 60, wallS: 120 };
const wall0 = process.hrtime.bigint();

const RUNS = [];
for (const skill of SKILLS) {
  for (let seed = 1; seed <= SEEDS; seed++) {
    await check(`skill ${skill}, seed ${seed}: the run reaches its result and every stage ends by its cap`, () => {
      let out;
      assert.doesNotThrow(() => { out = playRun(skill, seed, { keepEvents: false }); }, "the run never throws");
      const { run, longest, summary, stages } = out;
      assert.equal(run.screen, "result", `stuck on ${run.screen} (${run.stageId}) at ${run.t.toFixed(1)} s`);
      assert.equal(summary.done, true);
      assert.deepEqual(summary.stages.map((s) => s.id), IDS, "8 stage scores");
      for (const [id, t] of Object.entries(longest)) assert.ok(t <= CAP[id] + 2 * DT, `${id} ran ${t.toFixed(2)} s (cap ${CAP[id]})`);
      assert.ok(Number.isFinite(summary.total) && summary.total >= 0);
      assert.ok(summary.ms > 0 && summary.ms <= out.gameS * 1000 + 1, `run.ms ${summary.ms} within the game time`);
      RUNS.push({ skill, seed, total: summary.total, gameS: out.gameS, stages });
    });
  }
}

const of = (skill) => RUNS.filter((r) => r.skill === skill);
const stageOf = (r, id) => r.stages.find((s) => s.id === id);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

await check("skill 1.0: every stage's mean total is at least 8,500", () => {
  const rs = of(1);
  assert.equal(rs.length, SEEDS);
  const low = IDS.map((id) => [id, mean(rs.map((r) => stageOf(r, id).total))]).filter(([, m]) => !(m >= GATE.refMean));
  assert.deepEqual(low, [], `stages under ${GATE.refMean}: ${low.map(([id, m]) => `${id} ${Math.round(m)}`).join(", ")}`);
});

await check("skill 0.5 reaches the goal in at least 90% of runs in each of stages 2 to 8", () => {
  const rs = of(0.5);
  assert.equal(rs.length, SEEDS);
  for (const id of IDS.slice(1)) {
    const met = rs.filter((r) => stageOf(r, id).goalMet).length;
    assert.ok(met >= Math.ceil(GATE.goalShare * rs.length), `${id}: ${met} of ${rs.length}`);
  }
});

await check("skill 0.5 in stage 1: a finish outside the top 3 gets Go on, with no grade word, and the run goes on", () => {
  for (const r of of(0.5)) {
    const s = stageOf(r, "swim");
    if (s.goalMet) { assert.ok(s.place <= 3, `seed ${r.seed}: goal met in place ${s.place}`); continue; }
    assert.equal(s.grade, null, `seed ${r.seed}: Go on shows no grade word`);
    assert.equal(s.wentOn, true, `seed ${r.seed}: the Almost card came and Go on was taken`);
  }
});

await check("the stage 1 race gate: skill 0.7 is in the top 3 in at least 90% of runs", () => {
  const rs = of(0.7);
  const top = rs.filter((r) => { const s = stageOf(r, "swim"); return s.goalMet && s.place >= 1 && s.place <= 3; }).length;
  assert.ok(top >= Math.ceil(GATE.raceTop3 * rs.length), `top 3 in ${top} of ${rs.length}`);
});

await check("skill 0.7 runs take 8 to 12 min of game time", () => {
  const rs = of(0.7);
  const out = rs.filter((r) => !(r.gameS >= GATE.minS && r.gameS <= GATE.maxS));
  assert.deepEqual(out.map((r) => `seed ${r.seed}: ${(r.gameS / 60).toFixed(2)} min`), []);
});

await check("skill 0: stage 1 ends at its cap with no goal, and every later stage completes by itself", () => {
  for (const r of of(0)) {
    const s = stageOf(r, "swim");
    assert.equal(s.goalMet, false, `seed ${r.seed}`);
    assert.equal(s.place, 20, `seed ${r.seed}: place ${s.place}`);
    for (const id of IDS.slice(1)) assert.equal(stageOf(r, id).goalMet, true, `seed ${r.seed} ${id}`);
  }
});

await check("the same seed and skill play the same run", () => {
  const a = playRun(0.7, 1), b = playRun(0.7, 1);
  assert.deepEqual(a.summary, b.summary);
  assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs));
});

await check("more skill scores more: 1.0 > 0.7 > 0.5 > 0 (mean run totals)", () => {
  const m = SKILLS.map((s) => mean(of(s).map((r) => r.total)));
  for (let i = 1; i < m.length; i++) assert.ok(m[i - 1] > m[i], `skill ${SKILLS[i - 1]} ${Math.round(m[i - 1])} vs ${SKILLS[i]} ${Math.round(m[i])}`);
});

const wallS = Number(process.hrtime.bigint() - wall0) / 1e9;
await check("the suite stays under 120 s of wall time", () => {
  assert.ok(wallS < GATE.wallS, `${wallS.toFixed(1)} s`);
});

const lines = SKILLS.map((skill) => {
  const rs = of(skill);
  if (!rs.length) return `skill ${skill.toFixed(1)} -`;
  const top = rs.filter((r) => { const s = stageOf(r, "swim"); return s.goalMet && s.place <= 3; }).length;
  const g = rs.map((r) => r.gameS / 60);
  if (process.env.FB_VERBOSE) {
    console.log(`  skill ${skill.toFixed(1)}: ` + IDS.map((id) => `${id} ${mean(rs.map((r) => stageOf(r, id).timeS)).toFixed(1)} s ${Math.round(mean(rs.map((r) => stageOf(r, id).total)))}`).join("; "));
  }
  return `skill ${skill.toFixed(1)} ${Math.round(mean(rs.map((r) => r.total)))} in ${mean(g).toFixed(2)} min (${Math.min(...g).toFixed(2)} to ${Math.max(...g).toFixed(2)}), top 3 ${top}/${rs.length}`;
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks (${SEEDS} seeds per skill, ${wallS.toFixed(1)} s; ${lines.join("; ")})`);
}
