// First Breath: the core's CPU cost in node (design.md 17 "Core CPU", 18; tasks.md 5.2). Each of the 8 stages and
// the ending is played start to end by the reference bot (core/bots.js at skill 1, as in 16.11), with no DOM, and
// every call of the stage's step() is timed with process.hrtime. The gate: the 99th percentile of step() is at most
// 1 ms in every stage. The bot's own work and view() are left out of that number; view() is timed too and printed.
// A first warm-up run of each stage is not counted (the JIT). On a busy machine a stage over the budget is measured
// again, up to 3 times, and the best p99 counts (as perf.e2e.mjs does). The bot suite's 120 s wall time is in
// sim.test.mjs.
// node qa/first-breath/perf.test.mjs        (FB_PERF_SEED=N picks the seed, default 7)
import assert from "node:assert/strict";
import { STAGES, ENDING } from "../../public/first-breath/core/stages/index.js";
import { DEFAULT_CARRY } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { DT } from "../../public/first-breath/core/clock.js";

const FILE = "qa/first-breath/perf.test.mjs";
let passed = 0;
const failed = [];
function check(name, fn) {
  try { fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}

const BUDGET_MS = 1;
const TRIES = 3;
const SEED = Number.isFinite(Number(process.env.FB_PERF_SEED)) && process.env.FB_PERF_SEED ? Number(process.env.FB_PERF_SEED) >>> 0 : 7;
const MODS = [...STAGES, ENDING];

const ms = (a, b) => Number(b - a) / 1e6;
function pct(xs, p) {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
}

// One ref-bot run of a stage, every step and every 10th view timed.
function playOnce(mod, seed) {
  const st = mod.create(seed, DEFAULT_CARRY, { assist: false, oneButton: false, motherPhase: 0 });
  const bot = createBot(1, seed);
  const steps = [], views = [];
  const capSteps = Math.ceil((mod.meta.capS + 5) / DT);
  for (let i = 0; i < capSteps && !mod.result(st).done; i++) {
    const intents = bot.intents(mod, st);
    const a = process.hrtime.bigint();
    mod.step(st, intents);
    const b = process.hrtime.bigint();
    steps.push(ms(a, b));
    if (i % 10 === 0) {
      const c = process.hrtime.bigint();
      mod.view(st);
      views.push(ms(c, process.hrtime.bigint()));
    }
    st.events.length = 0;
  }
  return { done: mod.result(st).done, t: st.t, steps, views };
}

const rows = [];
for (const mod of MODS) {
  const id = mod.meta.id;
  check(`${id}: the ref run's p99 step() is at most ${BUDGET_MS} ms`, () => {
    playOnce(mod, SEED + 1000);                       // warm-up, not counted
    let best = null;
    for (let k = 0; k < TRIES; k++) {
      const r = playOnce(mod, SEED);
      assert.ok(r.done, `the ref run never ended (${r.t.toFixed(1)} s)`);
      const p99 = pct(r.steps, 0.99);
      if (!best || p99 < best.p99) best = { p99, max: Math.max(...r.steps), mean: r.steps.reduce((a, b) => a + b, 0) / r.steps.length,
        n: r.steps.length, view99: pct(r.views, 0.99), tries: k + 1 };
      if (best.p99 <= BUDGET_MS) break;
    }
    rows.push({ id, ...best });
    assert.ok(best.p99 <= BUDGET_MS, `p99 ${best.p99.toFixed(3)} ms over ${best.n} steps (max ${best.max.toFixed(2)} ms, ${best.tries} tries)`);
  });
}

const line = rows.map((r) => `${r.id} ${r.p99.toFixed(3)}`).join(", ");
if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const v = rows.map((r) => `${r.id} ${r.view99.toFixed(3)}`).join(", ");
  console.log(`PASS ${FILE}: ${passed} checks (p99 step ms: ${line}; p99 view ms: ${v})`);
}
