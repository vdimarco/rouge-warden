// First Breath: whole runs played by the shared bot, as a report (design.md 16.11, 18).
//
//   node qa/first-breath/bot.mjs <runs> <skill> <seed>        e.g. node qa/first-breath/bot.mjs 20 0.7 1
//
// It plays <runs> whole runs through core/run.js with core/bots.js at <skill> (0 = idle, 1 = the reference bot), with
// run seeds <seed>, <seed> + 1, …, the way a player would: Play on the title, Go on at the Almost card, the card
// skipped from 1.0 s, the overlays and the ending left to run their course. For each run it prints, per stage, the
// stage time (stage start to stage end, core seconds; stage 1 with Go on includes its carried 3 s), the stage total,
// the grade, the timing accuracy (In time 1, Close 0.5, miss 0, over the targets judged in that stage's last
// attempt) and whether the goal was met, and in stage 1 the place. Then the run total, the run time (run.ms, Play
// to the end of Birth) and the game time (Play to the run result, the ending included). A last block gives the means
// over the runs. Exit code 0; a run that throws or never reaches its result prints FAIL and exits 1.
//
// sim.test.mjs imports playRun() from this file, so the report and the gates read the same runs.
import { pathToFileURL } from "node:url";
import { createRun } from "../../public/first-breath/core/run.js";
import { createBot, playStep } from "../../public/first-breath/core/bots.js";
import { STAGES } from "../../public/first-breath/core/stages/index.js";

export const MAX_STEPS = 60 * 60 * 20;    // 20 game minutes: a run that has not ended by then is stuck
const CREDIT = { in: 1, close: 0.5, miss: 0 };

// One whole run, played step by step to its result. → { run, summary, stages, gameS, runMs, steps, longest, evs }
// stages: one row per stage in run order (the kept attempt's score, the last attempt's time and accuracy):
//   { id, timeS, total, grade, accuracy, judged, goalMet, place, of, attempts, wentOn }
// longest: the longest stage time any attempt of each stage (and the ending) reached, in stage seconds.
// evs: the run's stageStart, stageEnd and screen events, for the determinism check.
export function playRun(skill, seed, { settings = {}, keepEvents = true } = {}) {
  const run = createRun({ seed, settings, start: "new" });
  const bot = createBot(skill, seed);
  const longest = {};
  const evs = [];
  const rows = {};
  let cur = null, playAt = null, steps = 0;
  for (; run.screen !== "result" && steps < MAX_STEPS; steps++) {
    playStep(run, bot);
    if ((run.screen === "stage" || run.screen === "ending") && run.state) {
      longest[run.stageId] = Math.max(longest[run.stageId] || 0, run.state.t);
    }
    for (const e of run.events) {
      if (e.name === "stageStart") {
        if (playAt === null) playAt = e.t;
        cur = { id: e.id, t0: e.t, judged: 0, credit: 0, attempt: e.attempt };
        if (e.id !== "ending") rows[e.id] = { ...(rows[e.id] || {}), id: e.id, t0: e.t, judged: 0, credit: 0, attempts: e.attempt };
      } else if (e.name === "judge" && cur && rows[cur.id] && e.grade in CREDIT) {
        rows[cur.id].judged++;
        rows[cur.id].credit += CREDIT[e.grade];
      } else if (e.name === "screen" && e.screen === "almost" && cur && rows[cur.id]) {
        rows[cur.id].almost = true;
      } else if (e.name === "stageEnd" && rows[e.id]) {
        const r = rows[e.id], m = (e.result && e.result.metrics) || {};
        r.timeS = e.t - r.t0;
        r.goalMet = !!(e.result && e.result.goalMet);
        if (Number.isFinite(m.place)) { r.place = m.place; r.of = m.of; }
      }
      if (keepEvents && (e.name === "stageStart" || e.name === "stageEnd" || e.name === "screen")) evs.push(e);
    }
    run.events.length = 0;
  }
  const summary = run.summary();
  const kept = Object.fromEntries(summary.stages.map((s) => [s.id, s]));
  const stages = STAGES.map((m) => m.meta.id).filter((id) => rows[id]).map((id) => {
    const r = rows[id], k = kept[id];
    return {
      id, timeS: r.timeS ?? null, total: k ? k.score.total : null, grade: k ? k.grade : null,
      accuracy: r.judged ? r.credit / r.judged : null, judged: r.judged, goalMet: k ? k.goalMet : !!r.goalMet,
      place: r.place ?? null, of: r.of ?? null, attempts: r.attempts || 1, wentOn: !!r.almost && !(k && k.goalMet),
    };
  });
  const gameS = playAt === null ? 0 : run.t - playAt;
  return { run, summary, stages, gameS, runMs: summary.ms, steps, longest, evs };
}

const ord = (n) => { const t = n % 100, u = n % 10; return n + (t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"); };
const mmss = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;
const pct = (v) => (v === null || v === undefined ? "  -  " : `${Math.round(v * 100)}%`.padStart(5));

function report(runs, skill, seed0) {
  const all = [];
  let bad = 0;
  for (let k = 0; k < runs; k++) {
    const seed = seed0 + k;
    let out;
    try { out = playRun(skill, seed, { keepEvents: false }); } catch (e) {
      console.log(`FAIL run seed ${seed}: ${e.stack || e.message}`);
      bad++;
      continue;
    }
    if (out.run.screen !== "result") { console.log(`FAIL run seed ${seed}: stuck on ${out.run.screen} (${out.run.stageId})`); bad++; continue; }
    all.push(out);
    console.log(`run ${k + 1} of ${runs}: skill ${skill}, seed ${seed}`);
    console.log("  stage    time      total  grade    acc   goal  place");
    for (const s of out.stages) {
      const place = s.id === "swim" && s.place ? `${ord(s.place)} of ${s.of}${s.wentOn ? " (Go on)" : ""}` : "";
      console.log(`  ${s.id.padEnd(7)} ${(s.timeS === null ? "-" : s.timeS.toFixed(1) + " s").padStart(7)}  ${String(s.total ?? "-").padStart(6)}  ${(s.grade || "-").padEnd(7)} ${pct(s.accuracy)}  ${s.goalMet ? "yes " : "no  "}  ${place}`);
    }
    console.log(`  total ${out.summary.total.toLocaleString("en-US")}; run time ${mmss(out.runMs / 1000)} (run.ms ${out.runMs}); game time ${mmss(out.gameS)}`);
  }
  if (all.length > 1) {
    const mean = (f) => all.reduce((a, o) => a + f(o), 0) / all.length;
    console.log(`means over ${all.length} runs (skill ${skill}, seeds ${seed0} to ${seed0 + runs - 1}):`);
    for (const m of STAGES) {
      const rs = all.map((o) => o.stages.find((s) => s.id === m.meta.id)).filter(Boolean);
      if (!rs.length) continue;
      const avg = (f) => { const xs = rs.map(f).filter((v) => Number.isFinite(v)); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
      const grades = {};
      for (const s of rs) grades[s.grade || "-"] = (grades[s.grade || "-"] || 0) + 1;
      const places = m.meta.id === "swim" ? `  top 3 in ${rs.filter((s) => s.place && s.place <= 3).length} of ${rs.length}, mean place ${avg((s) => s.place).toFixed(1)}` : "";
      console.log(`  ${m.meta.id.padEnd(7)} ${avg((s) => s.timeS).toFixed(1).padStart(6)} s  ${String(Math.round(avg((s) => s.total))).padStart(6)}  ${pct(avg((s) => s.accuracy))}  goal ${rs.filter((s) => s.goalMet).length} of ${rs.length}  ${Object.entries(grades).map(([g, n]) => `${g} ${n}`).join(", ")}${places}`);
    }
    const games = all.map((o) => o.gameS);
    console.log(`  total ${Math.round(mean((o) => o.summary.total)).toLocaleString("en-US")}; run time ${mmss(mean((o) => o.runMs) / 1000)}; game time ${mmss(mean((o) => o.gameS))} (${mmss(Math.min(...games))} to ${mmss(Math.max(...games))})`);
  }
  return bad;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runs = Math.max(1, Math.floor(Number(process.argv[2]) || 1));
  const skill = Number.isFinite(Number(process.argv[3])) && process.argv[3] !== undefined ? Number(process.argv[3]) : 0.7;
  const seed = Number.isFinite(Number(process.argv[4])) && process.argv[4] !== undefined ? Number(process.argv[4]) >>> 0 : 1;
  const bad = report(runs, skill, seed);
  process.exitCode = bad ? 1 : 0;
}
