// Read-only check of the live Pay on Proof contract. It needs no key and no account.
//   node scripts/verify.mjs            the mainnet contract
//   POP_NETWORK=testnet POP_CONTRACT=<id> node scripts/verify.mjs
// It reads the contract through public RPC and exits with an error if a fact differs.
import fs from "node:fs";
import { view, provider, fmt, accountState } from "../lib/near.mjs";

const net = process.env.POP_NETWORK || "mainnet";
const MAINNET = "ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827";
const C = process.env.POP_CONTRACT || (net === "mainnet" ? MAINNET : null);
if (!C) { console.error("Set POP_CONTRACT for " + net); process.exit(2); }
const WARDEN_METHODS = ["post_job", "counter", "hire", "cancel_job", "retry_payout", "unwrap_near"];

let failures = 0;
function check(ok, what) {
  console.log(`   ${what.padEnd(78)} ${ok ? "ok" : "FAILED"}`);
  if (!ok) failures++;
}
async function all(method) {
  const out = [];
  for (let from = 0; ; from += 50) {
    const page = await view(net, C, method, { from, limit: 50 });
    out.push(...page);
    if (page.length < 50) return out;
  }
}

console.log(`Pay on Proof on ${net}: ${C}`);
console.log("== 1. The account and its keys");
const state = await accountState(net, C);
check(!!state && state.codeHash !== "11111111111111111111111111111111", "the account holds contract code");
const keys = (await provider(net).viewAccessKeyList({ accountId: C, finality: "optimistic" })).keys;
const perms = keys.map((k) => k.access_key.permission);
check(perms.every((p) => p !== "FullAccess"), `no full-access key (${keys.length} key${keys.length === 1 ? "" : "s"} on the account)`);
const fc = perms.filter((p) => p !== "FullAccess").map((p) => p.FunctionCall);
check(fc.length > 0 && fc.every((f) => f.receiver_id === C && f.method_names.length > 0 && f.method_names.every((m) => WARDEN_METHODS.includes(m))),
  "each key can call only the Warden methods on this contract");
check(fc.every((f) => !f.method_names.includes("deliver") && !f.method_names.includes("close")), "no key can deliver work or close the contract");

console.log("== 2. The cap and the spend");
const cfg = await view(net, C, "get_config");
const jobs = await all("get_jobs"), receipts = await all("get_receipts");
check(BigInt(cfg.spent) + BigInt(cfg.reserved) <= BigInt(cfg.cap), `spent ${fmt(cfg.spent)} plus reserved ${fmt(cfg.reserved)} is inside the cap ${fmt(cfg.cap)} NEAR`);
check(jobs.length === cfg.jobs && receipts.length === cfg.receipts, `${jobs.length} jobs and ${receipts.length} receipts, as the contract counts them`);
const pass = receipts.filter((r) => r.pass), fail = receipts.filter((r) => !r.pass);
const paid = pass.filter((r) => r.payout === "sent");
check(fail.every((r) => r.payout === "none"), `${fail.length} failed deliveries, and none of them was paid`);
check(paid.reduce((s, r) => s + BigInt(r.price), 0n) === BigInt(cfg.spent), `the ${paid.length} paid receipts add up to the spend, ${fmt(cfg.spent)} NEAR`);
const rails = { near: paid.filter((r) => r.rail === "near").length, intents: paid.filter((r) => r.rail === "intents").length };
console.log(`   paid in NEAR: ${rails.near}. paid through NEAR Intents: ${rails.intents}. pending or failed payouts: ${pass.length - paid.length}.`);

console.log("== 3. The contract's check, run again on the stored deliveries");
const kept = jobs.filter((j) => j.deliverable);
let again = 0;
for (const j of kept) {
  const v = await view(net, C, "preview_check", { job_id: j.id, data: j.deliverable });
  if (v.pass) again++; else console.log(`   job ${j.id} (${j.kind}): ${v.reason}`);
}
check(kept.length > 0 && again === kept.length, `the check accepts each of the ${kept.length} deliveries that the contract paid for`);

// Failed deliveries keep no data in the contract. demo/data.json holds the arguments of those transactions.
const recorded = new URL("../demo/data.json", import.meta.url);
if (net === "mainnet" && C === MAINNET && fs.existsSync(recorded)) {
  const data = JSON.parse(fs.readFileSync(recorded, "utf8"));
  let refused = 0;
  for (const f of data.failed) {
    const v = await view(net, C, "preview_check", { job_id: f.job, data: JSON.stringify(f.data) });
    const receipt = fail.find((r) => r.job === f.job && f.reason.endsWith(r.reason));
    if (!v.pass && receipt && v.reason === receipt.reason) refused++; else console.log(`   job ${f.job}: check says ${JSON.stringify(v)}`);
  }
  check(refused === data.failed.length, `the check refuses each of the ${data.failed.length} recorded failed deliveries, with the reason on its receipt`);

  console.log("== 4. The NEAR Intents payouts");
  const bySeller = {};
  for (const r of paid.filter((r) => r.rail === "intents")) bySeller[r.seller] = (bySeller[r.seller] || 0n) + BigInt(r.price);
  for (const [seller, sum] of Object.entries(bySeller)) {
    const bal = BigInt(await view(net, cfg.intents, "mt_balance_of", { account_id: seller, token_id: `nep141:${cfg.wrap}` }));
    check(bal >= sum, `seller ${seller.slice(0, 8)}… holds ${fmt(bal)} wNEAR in ${cfg.intents}; the contract paid it ${fmt(sum)}`);
  }
}

console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
