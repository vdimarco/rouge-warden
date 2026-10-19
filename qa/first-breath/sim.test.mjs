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
// - skill 0 never throws, ends every stage by its cap, and its stage 1 ends at the cap with no goal; an action-layer
//   stage (meta.action) may knock it out, and then Go on leads on with no grade word;
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
// the action-layer stages (meta.action; openspec/changes/first-breath-action-genres/contract.md): a knock-out ends one
// with its goal unmet, the Almost card offers Try again or Go on, and the bot goes on
const ACTION = new Set(STAGES.filter((m) => m.meta.action).map((m) => m.meta.id));
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

// stage 6, the rhythm stage (first-breath-action-genres, design.md 4.5 and 5.6): no hp, so every bot completes it
await check("stage 6 (answer): skill 1.0 is Great or better in at least 18 of 20; skill 0.5 and idle meet the goal every run", () => {
  const great = of(1).filter((r) => ["Great", "Glowing"].includes(stageOf(r, "answer").grade)).length;
  assert.ok(great >= Math.ceil(0.9 * of(1).length), `skill 1.0 Great or better in ${great} of ${of(1).length}`);
  for (const skill of [0.5, 0]) {
    const miss = of(skill).filter((r) => !stageOf(r, "answer").goalMet).map((r) => r.seed);
    assert.deepEqual(miss, [], `skill ${skill}: goal unmet in seeds ${miss.join(", ")}`);
  }
  assert.ok(mean(of(0.5).map((r) => stageOf(r, "answer").total)) > mean(of(0).map((r) => stageOf(r, "answer").total)), "skill 0.5 outscores idle");
});

// stage 5, the shooter (first-breath-action-genres, design.md 4.5, contract.md 8): hp and a knock-out
await check("stage 5 (grow): skill 1.0 is Great or better in at least 18 of 20 and knocked out in at most 1; skill 0.5 is not knocked out in at least 16 of 20; idle is knocked out or completes, and the run goes on", () => {
  const n = of(1).length;
  const great = of(1).filter((r) => ["Great", "Glowing"].includes(stageOf(r, "grow").grade)).length;
  assert.ok(great >= Math.ceil(0.9 * n), `skill 1.0 Great or better in ${great} of ${n}`);
  const refKo = of(1).filter((r) => stageOf(r, "grow").ko).length;
  assert.ok(refKo <= Math.floor(n / 20), `skill 1.0 knocked out in ${refKo} of ${n}`);
  const midKo = of(0.5).filter((r) => stageOf(r, "grow").ko).length;
  assert.ok(of(0.5).length - midKo >= Math.ceil(0.8 * of(0.5).length), `skill 0.5 knocked out in ${midKo} of ${of(0.5).length}`);
  for (const r of of(0)) {
    const s = stageOf(r, "grow");
    if (s.goalMet) continue;
    assert.ok(s.ko && s.wentOn && s.grade === null, `seed ${r.seed}: idle knocked out, Go on taken, no grade word`);
  }
  assert.ok(mean(of(0.5).map((r) => stageOf(r, "grow").total)) > mean(of(0).map((r) => stageOf(r, "grow").total)), "skill 0.5 outscores idle");
});

// stage 2, the brick breaker (first-breath-action-genres, design.md 4.5 and 5.2): shell pips, a knock-out and Go on to
// your sperm's entry; exactly one enter in every run
await check("stage 2 (egg): skill 1.0 is Great or better in at least 18 of 20 and knocked out in at most 1; skill 0.5 is not knocked out in at least 16 of 20; idle is knocked out or completes, and the run goes on", () => {
  const n = of(1).length;
  const great = of(1).filter((r) => ["Great", "Glowing"].includes(stageOf(r, "egg").grade)).length;
  assert.ok(great >= Math.ceil(0.9 * n), `skill 1.0 Great or better in ${great} of ${n}`);
  const refKo = of(1).filter((r) => stageOf(r, "egg").ko).length;
  assert.ok(refKo <= Math.floor(n / 20), `skill 1.0 knocked out in ${refKo} of ${n}`);
  const midKo = of(0.5).filter((r) => stageOf(r, "egg").ko).length;
  assert.ok(of(0.5).length - midKo >= Math.ceil(0.8 * of(0.5).length), `skill 0.5 knocked out in ${midKo} of ${of(0.5).length}`);
  for (const r of of(0)) {
    const s = stageOf(r, "egg");
    if (s.goalMet) continue;
    assert.ok(s.ko && s.wentOn && s.grade === null, `seed ${r.seed}: idle knocked out, Go on taken, no grade word`);
  }
  assert.ok(mean(of(0.5).map((r) => stageOf(r, "egg").total)) > mean(of(0).map((r) => stageOf(r, "egg").total)), "skill 0.5 outscores idle");
});

// stage 3, the roguelike (first-breath-action-genres, design.md 4.5 and 5.3): hp, a knock-out and Go on to the hatch
await check("stage 3 (split): skill 1.0 is Great or better in at least 18 of 20 and knocked out in at most 1; skill 0.5 is not knocked out in at least 16 of 20; idle is knocked out or completes, and the run goes on", () => {
  const n = of(1).length;
  const great = of(1).filter((r) => ["Great", "Glowing"].includes(stageOf(r, "split").grade)).length;
  assert.ok(great >= Math.ceil(0.9 * n), `skill 1.0 Great or better in ${great} of ${n}`);
  const refKo = of(1).filter((r) => stageOf(r, "split").ko).length;
  assert.ok(refKo <= Math.floor(n / 20), `skill 1.0 knocked out in ${refKo} of ${n}`);
  const midKo = of(0.5).filter((r) => stageOf(r, "split").ko).length;
  assert.ok(of(0.5).length - midKo >= Math.ceil(0.8 * of(0.5).length), `skill 0.5 knocked out in ${midKo} of ${of(0.5).length}`);
  for (const r of of(0)) {
    const s = stageOf(r, "split");
    if (s.goalMet) continue;
    assert.ok(s.ko && s.wentOn && s.grade === null, `seed ${r.seed}: idle knocked out, Go on taken, no grade word`);
  }
  assert.ok(mean(of(0.5).map((r) => stageOf(r, "split").total)) > mean(of(0).map((r) => stageOf(r, "split").total)), "skill 0.5 outscores idle");
});

// stage 4, the action-adventure (first-breath-action-genres, design.md 4.5 and 5.4): hp, a knock-out and Go on to the
// heart
await check("stage 4 (root): skill 1.0 is Great or better in at least 18 of 20 and knocked out in at most 1; skill 0.5 is not knocked out in at least 16 of 20; idle is knocked out or completes, and the run goes on", () => {
  const n = of(1).length;
  const great = of(1).filter((r) => ["Great", "Glowing"].includes(stageOf(r, "root").grade)).length;
  assert.ok(great >= Math.ceil(0.9 * n), `skill 1.0 Great or better in ${great} of ${n}`);
  const refKo = of(1).filter((r) => stageOf(r, "root").ko).length;
  assert.ok(refKo <= Math.floor(n / 20), `skill 1.0 knocked out in ${refKo} of ${n}`);
  const midKo = of(0.5).filter((r) => stageOf(r, "root").ko).length;
  assert.ok(of(0.5).length - midKo >= Math.ceil(0.8 * of(0.5).length), `skill 0.5 knocked out in ${midKo} of ${of(0.5).length}`);
  for (const r of of(0)) {
    const s = stageOf(r, "root");
    if (s.goalMet) continue;
    assert.ok(s.ko && s.wentOn && s.grade === null, `seed ${r.seed}: idle knocked out, Go on taken, no grade word`);
  }
  assert.ok(mean(of(0.5).map((r) => stageOf(r, "root").total)) > mean(of(0).map((r) => stageOf(r, "root").total)), "skill 0.5 outscores idle");
});

// stage 7, the survivor stage (first-breath-action-genres, design.md 4.5 and 5.7): hp, a knock-out and Go on to the turn
// and the rest
await check("stage 7 (turn): skill 1.0 is Great or better in at least 18 of 20 and knocked out in at most 1; skill 0.5 is not knocked out in at least 16 of 20; idle is knocked out or completes, and the run goes on", () => {
  const n = of(1).length;
  const great = of(1).filter((r) => ["Great", "Glowing"].includes(stageOf(r, "turn").grade)).length;
  assert.ok(great >= Math.ceil(0.9 * n), `skill 1.0 Great or better in ${great} of ${n}`);
  const refKo = of(1).filter((r) => stageOf(r, "turn").ko).length;
  assert.ok(refKo <= Math.floor(n / 20), `skill 1.0 knocked out in ${refKo} of ${n}`);
  const midKo = of(0.5).filter((r) => stageOf(r, "turn").ko).length;
  assert.ok(of(0.5).length - midKo >= Math.ceil(0.8 * of(0.5).length), `skill 0.5 knocked out in ${midKo} of ${of(0.5).length}`);
  for (const r of of(0)) {
    const s = stageOf(r, "turn");
    if (s.goalMet) continue;
    assert.ok(s.ko && s.wentOn && s.grade === null, `seed ${r.seed}: idle knocked out, Go on taken, no grade word`);
  }
  assert.ok(mean(of(0.5).map((r) => stageOf(r, "turn").total)) > mean(of(0).map((r) => stageOf(r, "turn").total)), "skill 0.5 outscores idle");
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

await check("skill 0: stage 1 ends at its cap with no goal; every later stage completes by itself, or (an action stage) is knocked out and Go on leads on", () => {
  for (const r of of(0)) {
    const s = stageOf(r, "swim");
    assert.equal(s.goalMet, false, `seed ${r.seed}`);
    assert.equal(s.place, 20, `seed ${r.seed}: place ${s.place}`);
    for (const id of IDS.slice(1)) {
      const x = stageOf(r, id);
      if (ACTION.has(id) && !x.goalMet) {
        assert.equal(x.wentOn, true, `seed ${r.seed} ${id}: the Almost card came and Go on was taken`);
        assert.equal(x.grade, null, `seed ${r.seed} ${id}: no grade word`);
      } else assert.equal(x.goalMet, true, `seed ${r.seed} ${id}`);
    }
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
