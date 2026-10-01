// Headless BREAKTHROUGH balance harness.
//   node qa/breakthrough2/sim.mjs
//   node qa/breakthrough2/sim.mjs 500
import { createRun, ENDINGS, lagAlpha } from "../../public/breakthrough2/model.js";
import { greedyClean, randomPolicy } from "./policies.mjs";

const N = Number(process.argv[2] || 500);
const IDS = ENDINGS.map((ending) => ending.id);

function play(seed, policy) {
  const run = createRun(seed);
  let guard = 0;
  while (run.state().phase !== "end") {
    const offers = run.offers();
    const id = policy(offers, run.state());
    const result = run.choose(id);
    if (!result.ok) {
      if (offers.event && offers.event.options) {
        const backup = offers.event.options.find((option) => option.affordable !== false);
        if (backup && backup.id !== id) {
          run.choose(backup.id);
          continue;
        }
      }
      if (id !== "pass") run.choose("pass");
    }
    guard += 1;
    if (guard > 80) break;
  }
  return run;
}

function summarize(name, runs) {
  const counts = Object.fromEntries(IDS.map((id) => [id, 0]));
  const stats = { warming: [], prosperity: [], ecology: [], trust: [], emissions: [], energy: [] };
  let soft = 0;
  for (const run of runs) {
    const state = run.state();
    if (!state.ending) soft += 1;
    else counts[state.ending] += 1;
    for (const key of Object.keys(stats)) stats[key].push(state[key]);
  }
  const total = runs.length;
  const pct = (id) => (100 * counts[id]) / total;
  const avg = (key) => stats[key].reduce((sum, n) => sum + n, 0) / total;
  return { name, counts, pct, avg, soft, total };
}

function line(summary) {
  const cells = IDS.map((id) => {
    const n = summary.counts[id];
    return `${id} ${n} (${summary.pct(id).toFixed(1)}%)`;
  });
  return `${summary.name.padEnd(14)} ${cells.join("  ")}`;
}

function means(summary) {
  const keys = ["warming", "emissions", "energy", "prosperity", "ecology", "trust"];
  return "  avg " + keys.map((key) => `${key} ${summary.avg(key).toFixed(2)}`).join("  ");
}

const randomRuns = [];
const greedyRuns = [];
for (let seed = 1; seed <= N; seed += 1) {
  randomRuns.push(play(seed, randomPolicy(seed)));
  greedyRuns.push(play(seed, greedyClean));
}

const random = summarize("random", randomRuns);
const greedy = summarize("greedy-clean", greedyRuns);

console.log(`BREAKTHROUGH sim  seeds 1-${N}`);
console.log(`lag alpha 6y ${lagAlpha(6).toFixed(3)}   10y ${lagAlpha(10).toFixed(3)}`);
console.log("");
console.log(line(random));
console.log(means(random));
console.log(line(greedy));
console.log(means(greedy));
console.log("");
console.log("targets (random, seeds 1-500):");
console.log("  Hot Growth <= 45%");
console.log("  Fractured + Long Emergency 15-25%");
console.log("  Managed Transition 20-30%");
console.log("  Regeneration 3-6%");
console.log("  Abundance 1-3%");
console.log("  greedy-clean Abundance >= 15%");

const hot = random.pct("hotgrowth");
const fail = random.pct("fractured") + random.pct("emergency");
const managed = random.pct("managed");
const regen = random.pct("regeneration");
const abundance = random.pct("abundance");
const greedyAbundance = greedy.pct("abundance");
const checks = [
  ["hot growth <= 45", hot <= 45],
  ["fractured + emergency 15-25", fail >= 15 && fail <= 25],
  ["managed 20-30", managed >= 20 && managed <= 30],
  ["regeneration 3-6", regen >= 3 && regen <= 6],
  ["abundance 1-3", abundance >= 1 && abundance <= 3],
  ["greedy abundance >= 15", greedyAbundance >= 15],
];
console.log("");
for (const [label, ok] of checks) console.log(`${ok ? "ok  " : "MISS"} ${label}`);
const missed = checks.filter((item) => !item[1]).length;
if (missed) {
  console.log(`\n${missed} band(s) missed`);
  process.exitCode = 1;
} else {
  console.log("\nall bands met");
}
