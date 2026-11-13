#!/usr/bin/env node
// Read-only check of the recorded Pay on Proof hire run. No key, no install.
//   node pop/hire/scripts/verify.mjs
// It reads pop/hire/run.json for the testnet account ids and transaction hashes, then reads the chain.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PARENT_METHODS, WARDEN_METHODS } from "../lib/methods.mjs";

const RUN_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../run.json");
if (!fs.existsSync(RUN_PATH)) { console.error("missing pop/hire/run.json. The testnet run has not been recorded."); process.exit(2); }
const run = JSON.parse(fs.readFileSync(RUN_PATH, "utf8"));
if (run.network !== "testnet") { console.error("hire verify only reads a testnet run"); process.exit(2); }

const RPC = "https://rpc.testnet.fastnear.com";
const ARCHIVAL = "https://archival-rpc.testnet.fastnear.com";
const EXPLORER = "https://testnet.nearblocks.io";
const C = run.contract;

let fails = 0, passes = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? " · " + extra : ""}`); cond ? passes++ : fails++; };
const fmt = (y) => (Number(BigInt(y) / 10n ** 18n) / 1e6).toFixed(4);
const sameSet = (a, b) => a.length === b.length && a.every((m) => b.includes(m));

async function rpc(method, params, url = RPC) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 300));
      return j.result;
    } catch (e) {
      last = e;
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
    }
  }
  throw last;
}
const view = async (accountId, methodName, args = {}) => {
  const res = await rpc("query", { request_type: "call_function", finality: "final", account_id: accountId, method_name: methodName, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  return JSON.parse(Buffer.from(res.result).toString());
};
async function tx(hash, sender) {
  const params = { tx_hash: hash, sender_account_id: sender, wait_until: "NONE" };
  try { return await rpc("tx", params); }
  catch { return await rpc("tx", params, ARCHIVAL); }
}
function panicText(status) {
  return JSON.stringify(status || "");
}

console.log(`Pay on Proof hire on testnet: ${C}\n${EXPLORER}/address/${C}\n`);

const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: C })).keys;
const full = keys.filter((k) => k.access_key.permission === "FullAccess");
const fc = keys.filter((k) => k.access_key.permission.FunctionCall).map((k) => k.access_key.permission.FunctionCall);
ok("the contract account has no full-access key", full.length === 0, `${keys.length} key(s)`);
ok("the contract key is a function-call key for the Warden methods only",
  fc.length === keys.length && fc.every((p) => p.receiver_id === C && sameSet(p.method_names, WARDEN_METHODS)),
  fc.map((p) => p.method_names.join(",")).join(" | "));

const parentKeys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: run.parent })).keys;
const parentFull = parentKeys.filter((k) => k.access_key.permission === "FullAccess");
ok("the parent account has no full-access key", parentFull.length === 0 && parentKeys.length === 1, `${parentKeys.length} key(s)`);
const only = parentKeys[0];
const onlyPerm = only && only.access_key.permission.FunctionCall;
ok("the parent's only key calls this contract and cannot transfer",
  !!onlyPerm && onlyPerm.receiver_id === C && sameSet(onlyPerm.method_names, PARENT_METHODS) && only.public_key === run.publicKeys.parentFunctionCall,
  onlyPerm ? onlyPerm.method_names.join(",") : "none");

const subAccount = await rpc("query", { request_type: "view_account", finality: "final", account_id: run.sub }).catch(() => null);
ok("the worker is a sub-account of the parent", run.sub === `crew.${run.parent}` && !!subAccount, run.sub);

const cfg = await view(C, "get_config");
const job = await view(C, "get_job", { job_id: run.jobId });
const sub = await view(C, "get_sub", { sub_id: run.subId });
const receipts = await view(C, "get_receipts", {});
ok("spent plus reserved is inside the contract cap", BigInt(cfg.spent) + BigInt(cfg.reserved) <= BigInt(cfg.cap), `spent ${fmt(cfg.spent)} + reserved ${fmt(cfg.reserved)} of cap ${fmt(cfg.cap)}`);
ok("the parent job is done and the sub-job is done", job.state === "done" && sub.state === "done" && sub.worker === run.sub && job.parent === run.parent);

const subReceipt = receipts.find((r) => r.role === "sub" && r.sub === run.subId);
const parentReceipt = receipts.find((r) => r.role === "parent" && r.job === run.jobId && r.pass);
ok("the sub-agent was paid its price from the parent budget", !!subReceipt && subReceipt.pass && subReceipt.payout === "sent" && subReceipt.rail === "near" && subReceipt.seller === run.sub && BigInt(subReceipt.price) === BigInt(sub.price), subReceipt ? `${fmt(subReceipt.price)} ${subReceipt.payout}` : "missing");
ok("the parent was paid the remainder", !!parentReceipt && parentReceipt.payout === "sent" && parentReceipt.rail === "intents" && parentReceipt.seller === run.parent && BigInt(parentReceipt.price) + BigInt(subReceipt?.price || 0) === BigInt(job.price), parentReceipt ? `${fmt(parentReceipt.price)} ${parentReceipt.payout}` : "missing");
const paid = receipts.filter((r) => r.pass).reduce((s, r) => s + BigInt(r.price), 0n);
ok("spent equals the sum of the passing receipt prices", paid === BigInt(cfg.spent), fmt(paid));
ok("the sub price stayed under the parent's hire price", BigInt(sub.budget) <= BigInt(job.price) && BigInt(sub.price) <= BigInt(sub.budget));

const capView = await view(C, "get_parent_cap", { job_id: run.jobId });
ok("nothing is left under the parent's cap", capView.left === "0" && BigInt(capView.paid_out) === BigInt(job.price));

if (job.deliverable) {
  const again = await view(C, "preview_check", { job_id: run.jobId, data: job.deliverable });
  ok("the parent's delivery still passes the on-chain check", again.pass === true && again.reason === parentReceipt?.reason, again.reason);
}
if (sub.deliverable) {
  const again = await view(C, "preview_sub", { sub_id: run.subId, data: sub.deliverable });
  ok("the sub-agent's delivery still passes the on-chain check", again.pass === true && again.reason === subReceipt?.reason, again.reason);
}

const intentsBal = BigInt(await view(cfg.intents, "mt_balance_of", { account_id: run.parent, token_id: "nep141:" + run.wrap }));
ok("the parent's wNEAR in the intents contract covers its payout", intentsBal >= BigInt(parentReceipt?.price || 1), `balance ${fmt(intentsBal)}`);

const over = await tx(run.txs.overspend, run.parent);
const overCall = over.transaction.actions.map((a) => a.FunctionCall).find(Boolean);
const overArgs = JSON.parse(Buffer.from(overCall.args, "base64").toString());
const overFail = panicText(over.status) + panicText(over.receipts_outcome?.[0]?.outcome?.status);
ok("the overspend transaction was refused with over the cap",
  over.transaction.signer_id === run.parent && over.transaction.receiver_id === C && over.transaction.public_key === run.publicKeys.parentFunctionCall
  && overCall.method_name === "post_subjob" && BigInt(overArgs.budget) > BigInt(job.price) && overFail.includes("over the cap"),
  `${EXPLORER}/txns/${run.txs.overspend}`);

if (run.txs.deliverSub) {
  const delivered = await tx(run.txs.deliverSub, run.sub);
  let paidSub = false;
  for (const o of delivered.receipts_outcome || []) {
    const rec = await rpc("EXPERIMENTAL_receipt", { receipt_id: o.id });
    const acts = rec.receipt?.Action?.actions || [];
    if (rec.predecessor_id === C && rec.receiver_id === run.sub && acts.some((a) => a.Transfer && a.Transfer.deposit === subReceipt.price)) paidSub = true;
  }
  ok("the sub payment transaction transfers the sub price in NEAR",
    delivered.transaction.receiver_id === C && paidSub,
    `${EXPLORER}/txns/${run.txs.deliverSub}`);
}

let outsideRefused = false;
let outsideNote = run.outsideError || "";
if (run.txs.outside) {
  try {
    const outside = await tx(run.txs.outside, run.parent);
    const text = panicText(outside.status);
    outsideRefused = text.includes("Failure") || text.includes("AccessKey") || text.includes("FullAccess") || !("SuccessValue" in (outside.status || {}));
    outsideNote = text.slice(0, 180);
  } catch (e) {
    outsideRefused = /not found|unknown|does not exist|INVALID/i.test(String(e.message || e)) && /full access|access key|FullAccess|AccessKey|ReceiverMismatch|MethodNameMismatch|permission/i.test(run.outsideError || "");
    outsideNote = String(e.message || e).slice(0, 180);
  }
} else {
  outsideRefused = /full access|access key|FullAccess|AccessKey|ReceiverMismatch|MethodNameMismatch|permission/i.test(run.outsideError || "");
}
ok("a transfer signed by the parent key was refused", outsideRefused && parentFull.length === 0, String(outsideNote).split("\n")[0].slice(0, 160));

if (run.txs.parentLock) {
  const lock = await tx(run.txs.parentLock, run.parent);
  const acts = lock.transaction.actions.map((a) => (typeof a === "string" ? a : Object.keys(a)[0]));
  ok("the parent full-access key was deleted", lock.transaction.receiver_id === run.parent && acts.includes("DeleteKey") && "SuccessValue" in lock.status, `${EXPLORER}/txns/${run.txs.parentLock}`);
}
if (run.txs.contractLock) {
  const lock = await tx(run.txs.contractLock, C);
  const acts = lock.transaction.actions.map((a) => (typeof a === "string" ? a : Object.keys(a)[0]));
  ok("the contract full-access key was deleted", lock.transaction.receiver_id === C && acts.includes("DeleteKey") && "SuccessValue" in lock.status, `${EXPLORER}/txns/${run.txs.contractLock}`);
}

console.log(fails ? `\n${fails} of ${passes + fails} checks failed` : `\nall ${passes} checks passed`);
process.exit(fails ? 1 : 0);
