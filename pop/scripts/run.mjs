// Runs one commission: the Warden posts jobs and the reference sellers compete for them, all on chain.
//   node scripts/run.mjs testnet --kinds map,roster,paint,tune --budget 0.3
// Every action goes to the console and to pop/runs/<net>-<time>.jsonl.
import fs from "node:fs";
import { keyStore, view, fmt, txLink } from "../lib/near.mjs";
import { Warden } from "../agents/warden.mjs";
import { Seller, PERSONAS } from "../agents/seller.mjs";
import { rng, specFor } from "../lib/make.mjs";

const net = process.argv[2] || "testnet";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const kinds = arg("--kinds", "map,roster,paint,tune").split(",");
const budget = Number(arg("--budget", "0.3"));
const timeoutMs = Number(arg("--minutes", "12")) * 60_000;
const ks = keyStore(net), pop = ks.get("pop"), C = pop.accountId;
fs.mkdirSync(new URL("../runs/", import.meta.url), { recursive: true });
const logFile = new URL(`../runs/${net}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`, import.meta.url);
const log = (e) => {
  const line = { t: new Date().toISOString(), ...e };
  fs.appendFileSync(logFile, JSON.stringify(line) + "\n");
  const { t, who, act, tx, ...rest } = line;
  console.log(`${t.slice(11, 19)} ${who.padEnd(7)} ${act.padEnd(10)} ${JSON.stringify(rest)}${tx ? "  " + txLink(net, tx) : ""}`);
};

const warden = new Warden({ net, contract: C, secretKey: ks.get("warden").secretKey, log });
const sellers = Object.entries(PERSONAS).map(([key, persona], i) => new Seller({ net, contract: C, accountId: ks.get(key).accountId, secretKey: ks.get(key).secretKey, persona, log, seed: Date.now() + i * 7919 }));

const cfg = await view(net, C, "get_config");
log({ who: "run", act: "start", contract: C, cap: fmt(cfg.cap), spent: fmt(cfg.spent), reserved: fmt(cfg.reserved), kinds, budget });
const r = rng(Date.now());
const TITLES = { map: "The dock", roster: "Who bites at dusk", paint: "The cabin", tune: "Campfire" };
// --jobs 3,4 picks up jobs already posted instead of posting new ones
const ids = arg("--jobs") ? arg("--jobs").split(",").map(Number) : [];
if (!ids.length) for (const k of kinds) ids.push(await warden.post(k, TITLES[k], specFor(k, r), budget, 20));

const t0 = Date.now();
while (Date.now() - t0 < timeoutMs) {
  const jobs = await warden.step(ids);
  for (const s of sellers) await s.step(jobs.length ? await view(net, C, "get_jobs", { from: Math.min(...ids), limit: ids.length }) : jobs);
  const left = (await view(net, C, "get_jobs", { from: Math.min(...ids), limit: ids.length })).filter((j) => j.state === "open" || j.state === "hired");
  if (!left.length) break;
  await new Promise((res) => setTimeout(res, 4000));
}
const end = await view(net, C, "get_config");
const recs = (await view(net, C, "get_receipts", { from: Math.max(0, end.receipts - 30), limit: 30 })).filter((x) => ids.includes(x.job));
log({ who: "run", act: "end", spent: fmt(end.spent), reserved: fmt(end.reserved), cap: fmt(end.cap), receipts: recs.map((x) => `${x.job}:${x.kind}:${x.seller.slice(0, 12)}:${x.pass ? "pass" : "fail"}:${fmt(x.price, 3)}:${x.payout}`) });
console.log("log:", logFile.pathname);
