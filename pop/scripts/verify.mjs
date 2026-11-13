#!/usr/bin/env node
// Checks a live Pay on Proof deployment from the chain alone. Read-only: no wallet, no key, no npm install.
// It needs Node 18 or newer, for fetch and WebAssembly.
//
//   node pop/scripts/verify.mjs            the mainnet contract
//   node pop/scripts/verify.mjs testnet    the testnet contract
//
// Each line starts with "ok" or "FAIL". The script exits 1 if any check fails.
import fs from "node:fs";

const NETS = {
  mainnet: {
    rpc: "https://rpc.mainnet.fastnear.com",
    archival: "https://archival-rpc.mainnet.fastnear.com",
    explorer: "https://nearblocks.io",
    contract: "ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827",
    wrap: "wrap.near",
    // the transaction that deleted the contract's full-access key after setup
    lockTx: "HvyGdLvtWzfkb6xSz2mBgnLqi9ViMfBX4CTE9RbWjG8d",
    locked: true,
  },
  testnet: {
    rpc: "https://rpc.testnet.fastnear.com",
    archival: "https://archival-rpc.testnet.fastnear.com",
    explorer: "https://testnet.nearblocks.io",
    contract: "pop-mwbiijzv.testnet",
    wrap: "wrap.testnet",
    // the first testnet deployment was set up with --no-lock, so it still has its full-access key
    locked: false,
  },
};
const WARDEN_METHODS = ["post_job", "counter", "hire", "cancel_job", "retry_payout", "unwrap_near"];
const net = process.argv[2] || "mainnet";
const N = NETS[net];
if (!N) { console.error("usage: node pop/scripts/verify.mjs [mainnet|testnet]"); process.exit(2); }
const C = process.env.POP_CONTRACT || N.contract;

let fails = 0, passes = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? " · " + extra : ""}`); cond ? passes++ : fails++; };
const fmt = (y, d = 4) => (Number(BigInt(y) / 10n ** 18n) / 1e6).toFixed(d);

async function rpc(method, params, url = N.rpc) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error.cause || j.error).slice(0, 200));
      return j.result;
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
}
const view = async (account_id, method_name, args = {}) => {
  const res = await rpc("query", { request_type: "call_function", finality: "final", account_id, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  return JSON.parse(Buffer.from(res.result).toString());
};
const all = async (method) => { const out = []; for (let from = 0; ; from += 50) { const p = await view(C, method, { from, limit: 50 }); out.push(...p); if (p.length < 50) return out; } };

console.log(`Pay on Proof on ${net}: ${C}\n${N.explorer}/address/${C}\n`);

// 1. Who can act for the contract
const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: C })).keys;
const full = keys.filter((k) => k.access_key.permission === "FullAccess").length;
const fc = keys.filter((k) => k.access_key.permission.FunctionCall).map((k) => k.access_key.permission.FunctionCall);
if (N.locked || full === 0) {
  ok("the contract account has no full-access key", full === 0, `${keys.length} key(s)`);
  ok("every key is a function-call key on the contract itself", fc.length === keys.length && fc.every((p) => p.receiver_id === C));
} else {
  console.log(`note this ${net} contract is not locked: it keeps ${full} full-access key(s) so it can be redeployed. Only the mainnet contract is locked.`);
}
ok("no key can call deliver, bid, close or anything outside the Warden's six methods",
  fc.every((p) => p.method_names.length > 0 && p.method_names.every((m) => WARDEN_METHODS.includes(m))), fc.map((p) => p.method_names.join(",")).join(" | "));
if (N.lockTx) {
  const tx = await rpc("tx", { tx_hash: N.lockTx, sender_account_id: C, wait_until: "NONE" }, N.archival);
  const acts = tx.transaction.actions.map((a) => (typeof a === "string" ? a : Object.keys(a)[0]));
  ok("the lock transaction deleted a key on this account", tx.transaction.receiver_id === C && acts.includes("DeleteKey") && "SuccessValue" in tx.status, `${N.explorer}/txns/${N.lockTx}`);
}

// 2. The deployed code is this source
const code = await rpc("query", { request_type: "view_code", finality: "final", account_id: C });
const exportsOnChain = WebAssembly.Module.exports(new WebAssembly.Module(Buffer.from(code.code_base64, "base64"))).map((e) => e.name).filter((n) => n !== "memory" && n !== "contract_source_metadata").sort();
const libPath = new URL("../contract/src/lib.rs", import.meta.url);
if (fs.existsSync(libPath)) {
  const src = fs.readFileSync(libPath, "utf8");
  const pub = [...src.matchAll(/^\s*pub fn (\w+)\s*\(/gm)].map((m) => m[1]).sort();
  ok("the deployed methods are exactly the public methods in contract/src/lib.rs", JSON.stringify(pub) === JSON.stringify(exportsOnChain), `${exportsOnChain.length} methods`);
}
const meta = await view(C, "contract_source_metadata").catch(() => null);
ok("NEP-330 source metadata points at this repository", !!meta && meta.link === "https://github.com/vdimarco/rouge-warden", meta ? `${meta.link} v${meta.version}` : "none");

// 3. Money: the cap and the books
const cfg = await view(C, "get_config");
const jobs = await all("get_jobs");
const receipts = await all("get_receipts");
const [spent, reserved, cap] = [BigInt(cfg.spent), BigInt(cfg.reserved), BigInt(cfg.cap)];
ok("spent plus reserved is inside the cap", spent + reserved <= cap, `spent ${fmt(spent)} + reserved ${fmt(reserved)} of cap ${fmt(cap)} NEAR`);
const passed = receipts.filter((r) => r.pass), failed = receipts.filter((r) => !r.pass);
const paidSum = passed.reduce((s, r) => s + BigInt(r.price), 0n);
ok("spent equals the sum of the prices on passing receipts", paidSum === spent, `${passed.length} passes, ${fmt(paidSum)} NEAR`);
ok("every pass was paid out", passed.every((r) => r.payout === "sent"), passed.map((r) => r.payout).filter((p) => p !== "sent").join(",") || "all sent");
ok("no failed delivery was paid", failed.every((r) => r.payout === "none"), `${failed.length} fails`);
const openReserved = jobs.filter((j) => j.state === "open" || j.state === "hired").reduce((s, j) => s + BigInt(j.budget), 0n);
ok("reserved equals the budgets of open and hired jobs", openReserved === reserved, `${fmt(openReserved)} NEAR`);

// 4. Re-run the contract's own check on every paid delivery
let reran = 0, same = 0;
for (const r of passed) {
  const job = jobs.find((j) => j.id === r.job);
  if (!job || !job.deliverable) continue;
  const v = await view(C, "preview_check", { job_id: job.id, data: job.deliverable });
  reran++;
  if (v.pass && v.reason === r.reason) same++;
}
ok("each paid delivery still passes the on-chain check with the same reason", reran === passed.length && same === reran, `${same} of ${passed.length}`);

// 5. Re-run the check on the failed deliveries, with the data read from each transaction
const dataPath = new URL("../demo/data.json", import.meta.url);
if (net === "mainnet" && fs.existsSync(dataPath)) {
  const rec = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  let checked = 0, agree = 0;
  for (const f of rec.failed || []) {
    const rid = Number((f.reason.match(/receipt (\d+)/) || [])[1]);
    const r = receipts.find((x) => x.id === rid);
    if (!r) continue;
    const tx = await rpc("tx", { tx_hash: f.tx, sender_account_id: r.seller, wait_until: "NONE" }, N.archival);
    const call = tx.transaction.actions[0].FunctionCall;
    const args = JSON.parse(Buffer.from(call.args, "base64").toString());
    const v = await view(C, "preview_check", { job_id: r.job, data: args.data });
    checked++;
    if (tx.transaction.receiver_id === C && call.method_name === "deliver" && tx.transaction.signer_id === r.seller && !v.pass && v.reason === r.reason) agree++;
  }
  ok("each failed delivery, read back from its transaction, still fails with the same reason", checked === failed.length && agree === checked, `${agree} of ${failed.length}`);
}

// 6. NEAR Intents payouts landed in the sellers' intents balances
const intentsBySeller = {};
for (const r of passed.filter((r) => r.rail === "intents")) intentsBySeller[r.seller] = (intentsBySeller[r.seller] || 0n) + BigInt(r.price);
for (const [seller, sum] of Object.entries(intentsBySeller)) {
  const bal = BigInt(await view(cfg.intents, "mt_balance_of", { account_id: seller, token_id: "nep141:" + N.wrap }));
  ok(`seller ${seller.slice(0, 8)}… holds at least what it was paid through ${cfg.intents}`, bal >= sum, `paid ${fmt(sum)}, balance ${fmt(bal)} wNEAR`);
}

const kinds = [...new Set(receipts.map((r) => r.kind))].join(", ");
console.log(`\n${cfg.jobs} jobs, ${receipts.length} receipts (${passed.length} pass: ${passed.filter((r) => r.rail === "near").length} in NEAR, ${passed.filter((r) => r.rail === "intents").length} through ${cfg.intents}; ${failed.length} fail). Kinds: ${kinds}.`);
console.log(fails ? `${fails} of ${passes + fails} checks failed` : `all ${passes} checks passed`);
process.exit(fails ? 1 : 0);
