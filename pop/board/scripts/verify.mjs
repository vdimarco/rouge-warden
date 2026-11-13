#!/usr/bin/env node
// Read-only check of the Pay on Proof board. No key and no install.
//   node pop/board/scripts/verify.mjs
import fs from "node:fs";
import { collect } from "../public/chain.mjs";
import { counts, leaderboards, parseXFeed } from "../public/events.mjs";
import { FORMULA } from "../public/score.mjs";

const sources = JSON.parse(fs.readFileSync(new URL("../public/sources.json", import.meta.url), "utf8"));
let fails = 0;
let passes = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? " · " + extra : ""}`);
  cond ? passes++ : fails++;
};

const model = await collect(sources);
for (const err of model.errors) ok(`${err.source} loaded`, false, err.message);
ok("mainnet config loaded", !!model.loaded.mainnet, model.loaded.mainnet ? `${model.loaded.mainnet.jobs} jobs` : "missing");
ok("hire config loaded", !!model.loaded.hire);
ok("appeals config loaded", !!model.loaded.appeals);

const events = model.events;
const n = counts(events);
const mainJobs = events.filter((e) => e.source === "mainnet" && e.type === "job");
const mainPaid = events.filter((e) => e.source === "mainnet" && e.type === "payout" && e.payout === "sent");
const mainFail = events.filter((e) => e.source === "mainnet" && e.type === "refusal");
ok("mainnet lists the locked jobs", mainJobs.length >= 9, String(mainJobs.length));
ok("mainnet lists passes and refusals", mainPaid.length >= 9 && mainFail.length >= 3, `${mainPaid.length} paid, ${mainFail.length} refused`);
if (model.loaded.mainnet) {
  const sum = mainPaid.reduce((s, e) => s + BigInt(e.near), 0n);
  ok("mainnet spent equals the paid receipts", sum === BigInt(model.loaded.mainnet.spent), sum.toString());
}
ok("hire payouts are on the board", events.filter((e) => e.source === "hire" && e.type === "payout" && e.payout === "sent").length >= 2);
ok("appeals refusals are on the board", events.filter((e) => e.source === "appeals" && e.type === "refusal").length >= 2);
ok("appeals disputes and rulings are on the board", n.dispute >= 2 && n.ruling >= 2, `${n.dispute} disputes, ${n.ruling} rulings`);
const rulings = events.filter((e) => e.source === "appeals" && e.type === "ruling");
ok("one ruling pays the worker and one refunds the buyer", rulings.some((e) => e.earned === true) && rulings.some((e) => e.earned !== true));

const book = leaderboards(events);
ok("earned leaderboard is sorted", book.earned.every((row, i) => i === 0 || BigInt(book.earned[i - 1].near) >= BigInt(row.near)));
ok("pass rate uses only checks", book.rate.every((row) => row.pass + row.fail > 0 && row.rate >= 0 && row.rate <= 1));

const sample = parseXFeed({ source: "pop-x", events: [{ type: "job", at: "2026-11-14T00:00:00.000Z", title: "Reply" }] });
ok("x feed parser accepts a job", sample.length === 1 && sample[0].source === "x");
ok("x feed is absent or loaded", model.x.state === "missing" || model.x.state === "ok", model.x.message);

if (sources.credit) {
  ok("credit contract answered", !!model.credit, model.errors.find((e) => e.source === "credit")?.message || "");
  if (model.credit) {
    const f = model.credit.config.formula;
    ok("on-chain formula matches score.mjs",
      f.pass === FORMULA.pass && f.fail === FORMULA.fail && f.jury_win === FORMULA.juryWin && f.jury_loss === FORMULA.juryLoss
      && BigInt(f.base_budget) === FORMULA.baseBudget && BigInt(f.step_budget) === FORMULA.stepBudget
      && BigInt(f.neg_budget) === FORMULA.negBudget && BigInt(f.deposit_at_zero) === FORMULA.depositAtZero
      && BigInt(f.deposit_step) === FORMULA.depositStep && BigInt(f.deposit_floor) === FORMULA.depositFloor);
    ok("credit rows match a fresh read of hire and appeals", model.credit.match.ok, model.credit.match.diffs.join("; "));
    ok("credit sources are the locked hire and appeals contracts",
      model.credit.config.hire === sources.hire.contract && model.credit.config.appeals === sources.appeals.contract);
  }
} else ok("credit contract is not set yet", true, "sources.json credit is null");

if (sources.pool) {
  ok("pool config loaded", !!model.pool);
  if (model.pool) {
    ok("pool has more than one funder", (model.pool.funders || []).length >= 2, String(model.pool.funders.length));
    const poolEvents = events.filter((e) => e.source === "pool");
    ok("pool shows a refusal and a payout", poolEvents.some((e) => e.type === "refusal") && poolEvents.some((e) => e.type === "payout" && e.payout === "sent"));
  }
} else ok("pool contract is not set yet", true, "sources.json pool is null");

console.log(fails ? `${fails} of ${passes + fails} checks failed` : `all ${passes} checks passed`);
process.exit(fails ? 1 : 0);
