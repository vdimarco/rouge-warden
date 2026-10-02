// Headless BREAKTHROUGH balance harness.
//   node qa/breakthrough2/sim.mjs
//   node qa/breakthrough2/sim.mjs 500
import { createRun, ENDINGS, lagAlpha, readIndicators, advanceWorld, spanYears, round2, TIP_LEVEL, OUTLOOK_POLICIES } from "../../public/breakthrough2/model.js";
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

function checkIndicators() {
  const run = createRun(123);
  const state = run.state();
  const ind = readIndicators(state, run.log());
  const again = readIndicators(state, run.log());
  const problems = [];
  if (JSON.stringify(ind) !== JSON.stringify(again)) problems.push("indicators are not stable");
  const sim = {
    capital: state.capital,
    research: state.research,
    political: state.political,
    industry: state.industry,
    trust: state.trust,
    emissions: state.emissions,
    energy: state.energy,
    prosperity: state.prosperity,
    ecology: state.ecology,
    warming: state.warming,
  };
  const owned = state.owned.slice();
  for (let i = 0; i < ind.forward.length; i += 1) {
    advanceWorld(sim, owned, spanYears(state.turnIndex + i));
    const point = ind.forward[i];
    if (sim.warming !== point.warming || sim.emissions !== point.emissions || sim.ecology !== point.ecology) {
      problems.push(`hold step ${i} diverges from advanceWorld`);
      break;
    }
    if (point.lo - 1e-9 > point.warming || point.warming > point.hi + 1e-9) {
      problems.push(`band misses the hold path at ${point.year}`);
      break;
    }
  }
  const sum = ind.outlook.reduce((total, row) => total + row.n, 0);
  if (sum !== OUTLOOK_POLICIES.length || ind.outlookTotal !== OUTLOOK_POLICIES.length) {
    problems.push(`outlook sums to ${sum}`);
  }
  if (ind.tip.level !== TIP_LEVEL) problems.push("tip level is not the prosperity heat line");
  if (ind.stock.alpha !== round2(lagAlpha(state.span))) problems.push("lag alpha does not match this step");
  if (!ind.history.length || ind.history[0].year !== 2026) problems.push("history does not start at 2026");
  if (ind.heading.id !== "emergency" && ind.heading.id !== "managed" && !ENDINGS.some((ending) => ending.id === ind.heading.id)) {
    problems.push("heading is not an ending");
  }
  if (!ENDINGS.some((ending) => ending.id === ind.heading.id)) problems.push(`unknown heading ${ind.heading.id}`);
  console.log("");
  console.log(`indicators seed 123: heading ${ind.heading.id}, tip ${ind.tip.crossed ? ind.tip.year : "under"}, outlook ${sum}`);
  if (problems.length) {
    for (const problem of problems) console.log(`MISS ${problem}`);
    process.exitCode = 1;
  } else {
    console.log("indicators match the live world step");
  }
}

checkIndicators();

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
console.log("targets (seeds 1-500):");
console.log("  random Hot Growth <= 42%");
console.log("  random Managed 30-33%");
console.log("  random Fractured + Long Emergency 15-25%");
console.log("  greedy-clean Hot Growth < 2%");
console.log("  Regeneration 3-6%");
console.log("  Abundance 1-3%");
console.log("  greedy-clean Abundance >= 15%");

const hot = random.pct("hotgrowth");
const fail = random.pct("fractured") + random.pct("emergency");
const managed = random.pct("managed");
const regen = random.pct("regeneration");
const abundance = random.pct("abundance");
const greedyHot = greedy.pct("hotgrowth");
const greedyAbundance = greedy.pct("abundance");
const checks = [
  ["hot growth <= 42", hot <= 42],
  ["managed 30-33", managed >= 30 && managed <= 33],
  ["fractured + emergency 15-25", fail >= 15 && fail <= 25],
  ["greedy-clean hot growth < 2", greedyHot < 2],
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
