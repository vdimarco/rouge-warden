// First Breath: whole runs played by the shared bot (design.md 16.11, 18). SKELETON (wave 0): it plays whole runs
// through createRun with createBot at skills 1.0, 0.7, 0.4 and 0 over a few seeds, and asserts that every run
// reaches its result without throwing, that every stage ends by its cap (stage 1 by 120 s with its carry), that each
// run has its 8 stage scores, that the same seed plays the same run, that skill 1.0 outscores skill 0, and that the
// suite stays under 120 s of wall time. Its PASS line gives, per skill, the mean run total and game time.
// The full gates of design.md 18 come with the wave-1 stages (task 2.x and group 6): skill 1.0 mean ≥ 8,500 per
// stage, skill 0.5 reaching the goal in ≥ 90% of runs in stages 2 to 8, skill 0.7 in the top 3 in ≥ 90% of stage 1
// runs, and skill 0.7 runs taking 8 to 12 min of game time, over 20 seeds.
// node qa/first-breath/sim.test.mjs        (FB_SIM_SEEDS=N sets the seeds per skill; default 3)
import assert from "node:assert/strict";
import { createRun } from "../../public/first-breath/core/run.js";
import { createBot, playStep } from "../../public/first-breath/core/bots.js";
import { STAGES, ENDING } from "../../public/first-breath/core/stages/index.js";
import { DT } from "../../public/first-breath/core/clock.js";

const FILE = "qa/first-breath/sim.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const SKILLS = [1.0, 0.7, 0.4, 0];
const SEEDS = Math.max(1, Number(process.env.FB_SIM_SEEDS) || 3);
const MAX_STEPS = 60 * 60 * 20;          // 20 game minutes: a run that has not ended by then is stuck
const CAP = Object.fromEntries([...STAGES, ENDING].map((m) => [m.meta.id, m.meta.capS + (m.meta.id === "swim" ? 3 : 0)]));
const wall0 = process.hrtime.bigint();

// One whole run: the bot's choices and input, step by step, to the result. Records the longest stage time each
// stage attempt reached (stage seconds).
function playRun(skill, seed) {
  const run = createRun({ seed, settings: {}, start: "new" });
  const bot = createBot(skill, seed);
  const longest = {};
  const evs = [];
  let steps = 0;
  for (; run.screen !== "result" && steps < MAX_STEPS; steps++) {
    playStep(run, bot);
    if ((run.screen === "stage" || run.screen === "ending") && run.state) {
      const key = run.stageId;
      longest[key] = Math.max(longest[key] || 0, run.state.t);
    }
    for (const e of run.events) if (e.name === "stageStart" || e.name === "stageEnd" || e.name === "screen") evs.push(e);
    run.events.length = 0;
  }
  return { run, steps, longest, evs, summary: run.summary() };
}

const RUNS = [];
for (const skill of SKILLS) {
  for (let seed = 1; seed <= SEEDS; seed++) {
    await check(`skill ${skill}, seed ${seed}: the run reaches its result and every stage ends by its cap`, () => {
      let out;
      assert.doesNotThrow(() => { out = playRun(skill, seed); }, "the run never throws");
      const { run, longest, summary } = out;
      assert.equal(run.screen, "result", `stuck on ${run.screen} (${run.stageId}) at ${run.t.toFixed(1)} s`);
      assert.equal(summary.done, true);
      assert.deepEqual(summary.stages.map((s) => s.id), STAGES.map((m) => m.meta.id), "8 stage scores");
      for (const [id, t] of Object.entries(longest)) assert.ok(t <= CAP[id] + 2 * DT, `${id} ran ${t.toFixed(2)} s (cap ${CAP[id]})`);
      assert.ok(Number.isFinite(summary.total) && summary.total >= 0);
      assert.ok(summary.ms > 0 && summary.ms <= run.t * 1000);
      RUNS.push({ skill, seed, total: summary.total, gameS: run.t, grades: summary.stages.map((s) => s.grade || "-") });
    });
  }
}

await check("the same seed and skill play the same run", () => {
  const a = playRun(0.7, 1), b = playRun(0.7, 1);
  assert.deepEqual(a.summary, b.summary);
  assert.equal(JSON.stringify(a.evs), JSON.stringify(b.evs));
});

await check("skill 1.0 outscores skill 0", () => {
  const mean = (s) => { const xs = RUNS.filter((r) => r.skill === s).map((r) => r.total); return xs.reduce((a, b) => a + b, 0) / xs.length; };
  assert.ok(mean(1) > mean(0), `skill 1.0 ${mean(1)} vs skill 0 ${mean(0)}`);
});

const wallS = Number(process.hrtime.bigint() - wall0) / 1e9;
await check("the suite stays under 120 s of wall time", () => {
  assert.ok(wallS < 120, `${wallS.toFixed(1)} s`);
});

// Per skill: the mean run total and game time (printed in the PASS line; FB_VERBOSE=1 adds the grades).
const means = SKILLS.map((skill) => {
  const rs = RUNS.filter((r) => r.skill === skill);
  if (!rs.length) return `skill ${skill.toFixed(1)} -`;
  const mean = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  if (process.env.FB_VERBOSE) console.log(`  skill ${skill.toFixed(1)}: grades ${rs.map((r) => r.grades.join(" ")).join(" | ")}`);
  return `skill ${skill.toFixed(1)} ${Math.round(mean((r) => r.total))} in ${(mean((r) => r.gameS) / 60).toFixed(1)} min`;
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks (skeleton, ${SEEDS} seeds per skill, ${wallS.toFixed(1)} s; ${means.join("; ")})`);
}
