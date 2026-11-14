#!/usr/bin/env node
// Re-reads the testnet appeal run from the chain. No wallet, no key, no npm install.
//   node pop/appeals/verify.mjs
import { evidenceHash, policyHash, POLICY } from "./lib/hash.mjs";
import fs from "node:fs";

const RUN_PATH = new URL("./run.json", import.meta.url);
const PUBLISHED = "dev-20261111042208-14186395012630.testnet";
const MAINNET_CONTRACT = "ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827";
const RPC = "https://rpc.testnet.fastnear.com";
const ARCHIVAL = "https://archival-rpc.testnet.fastnear.com";
const EXPLORER = "https://testnet.nearblocks.io";
const WARDEN_METHODS = ["post_job", "hire", "cancel_job"];

if (!fs.existsSync(RUN_PATH)) { console.error("missing pop/appeals/run.json"); process.exit(2); }
const run = JSON.parse(fs.readFileSync(RUN_PATH, "utf8"));

let fails = 0, passes = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? " · " + extra : ""}`); cond ? passes++ : fails++; };

async function rpc(method, params, url = RPC) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 240));
      return j.result;
    } catch (e) {
      last = e;
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
    }
  }
  throw last;
}
const view = async (account_id, method_name, args = {}) => {
  const res = await rpc("query", { request_type: "call_function", finality: "final", account_id, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  return JSON.parse(Buffer.from(res.result).toString());
};
async function keysOf(id) {
  return (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: id })).keys;
}
async function txOf(ref) {
  const params = { tx_hash: ref.hash, sender_account_id: ref.sender, wait_until: "NONE" };
  try { return await rpc("tx", params, ARCHIVAL); }
  catch { return await rpc("tx", params, RPC); }
}
function logsOf(tx) {
  return (tx.receipts_outcome || []).flatMap((r) => r.outcome?.logs || []);
}
async function heightOf(tx) {
  const id = tx.transaction_outcome?.block_hash;
  const block = await rpc("block", { block_id: id }, ARCHIVAL).catch(() => rpc("block", { block_id: id }, RPC));
  return block.header.height;
}
function topCall(tx) {
  const action = tx.transaction?.actions?.[0];
  if (!action || !action.FunctionCall) return null;
  return action.FunctionCall;
}
function majority(reads) {
  if (!reads.length || reads.some((r) => !r)) return null;
  const sums = reads[0].map((_, i) => reads.reduce((s, r) => s + r[i], 0));
  const half = 5000 * reads.length;
  const found = sums.findIndex((s) => s > half);
  return { sums, ruling: found >= 0 ? found : null };
}

console.log(`Pay on Proof appeals on testnet\n${EXPLORER}/address/${run.appeals}\n`);

ok("the run is on testnet and is not the mainnet contract", run.network === "testnet" && run.appeals !== MAINNET_CONTRACT && run.jury !== PUBLISHED, run.appeals);
ok("the published Lock jury is the one named in the run", run.publishedJury === PUBLISHED);

const publishedKeys = await keysOf(PUBLISHED);
ok("the published Lock jury still has no keys", publishedKeys.length === 0, `${publishedKeys.length} key(s)`);
const publishedCode = await rpc("query", { request_type: "view_code", finality: "final", account_id: PUBLISHED });
const juryCode = await rpc("query", { request_type: "view_code", finality: "final", account_id: run.jury });
ok("the demo jury runs the published Lock jury wasm", publishedCode.hash === juryCode.hash, publishedCode.hash);

const juryKeys = await keysOf(run.jury);
ok("the demo jury has no full-access key", juryKeys.every((k) => k.access_key.permission !== "FullAccess"), `${juryKeys.length} key(s)`);

const appealKeys = await keysOf(run.appeals);
const full = appealKeys.filter((k) => k.access_key.permission === "FullAccess");
const fc = appealKeys.filter((k) => k.access_key.permission.FunctionCall).map((k) => k.access_key.permission.FunctionCall);
ok("the appeals contract has no full-access key", full.length === 0, `${appealKeys.length} key(s)`);
ok("the only appeals key is the recorded function-call key for post, hire and cancel",
  fc.length === appealKeys.length && fc.length === 1 && appealKeys[0].public_key === run.wardenPublicKey && fc[0].receiver_id === run.appeals && fc[0].method_names.length === WARDEN_METHODS.length && WARDEN_METHODS.every((m) => fc[0].method_names.includes(m)),
  (fc[0]?.method_names || []).join(","));

for (const id of run.jurors) {
  const ks = await keysOf(id);
  ok(`juror ${id.slice(0, 8)}… has no full-access key`, ks.every((k) => k.access_key.permission !== "FullAccess"), `${ks.length} key(s)`);
}
for (const [name, id] of [["worker", run.worker], ["buyer", run.buyer]]) {
  const ks = await keysOf(id);
  ok(`${name} has no full-access key`, ks.every((k) => k.access_key.permission !== "FullAccess"), `${ks.length} key(s)`);
}

const lockJury = await txOf(run.txs.lockJury);
const lockAppeals = await txOf(run.txs.lockAppeals);
const lockActs = (tx) => (tx.transaction?.actions || []).map((a) => (typeof a === "string" ? a : Object.keys(a)[0]));
ok("the jury lock transaction deleted a key", lockJury.transaction.receiver_id === run.jury && lockActs(lockJury).includes("DeleteKey") && "SuccessValue" in lockJury.status, `${EXPLORER}/txns/${run.txs.lockJury.hash}`);
ok("the appeals lock transaction deleted a key", lockAppeals.transaction.receiver_id === run.appeals && lockActs(lockAppeals).includes("DeleteKey") && "SuccessValue" in lockAppeals.status, `${EXPLORER}/txns/${run.txs.lockAppeals.hash}`);
const hJury = await heightOf(lockJury);
const hAppeals = await heightOf(lockAppeals);

const appealCode = await rpc("query", { request_type: "view_code", finality: "final", account_id: run.appeals });
const exportsOnChain = WebAssembly.Module.exports(new WebAssembly.Module(Buffer.from(appealCode.code_base64, "base64"))).map((e) => e.name);
ok("the appeals wasm exports dispute, settle and the private callbacks",
  ["dispute", "settle", "on_opened", "on_ruling", "on_appeal_paid", "evidence_of"].every((m) => exportsOnChain.includes(m)));

const cfg = await view(run.appeals, "get_config");
ok("config names this jury and this buyer", cfg.jury === run.jury && cfg.buyer === run.buyer && cfg.contract === run.appeals);
ok("the policy string is the one this repository hashes", cfg.policy === POLICY);
ok("spent plus refunded plus reserved is inside the cap",
  BigInt(cfg.spent) + BigInt(cfg.refunded) + BigInt(cfg.reserved) <= BigInt(cfg.cap),
  `spent ${cfg.spent} refunded ${cfg.refunded} reserved ${cfg.reserved}`);

async function checkSide(side, expectRuling, payout, status, logNeedle) {
  const meta = run.jobs[side];
  const job = await view(run.appeals, "get_job", { job_id: meta.jobId });
  const receipt = await view(run.appeals, "get_receipt", { receipt_id: meta.receiptId });
  const dispute = await view(run.appeals, "get_dispute", { dispute_id: meta.disputeId });
  const cse = await view(run.jury, "get_case", { case_id: meta.caseId });
  const local = evidenceHash({
    jobId: job.id, receiptId: receipt.id, kind: receipt.kind, worker: receipt.seller, buyer: cfg.buyer,
    price: receipt.price, spec: job.spec, reason: receipt.reason, data: receipt.data,
  });
  const chainHash = await view(run.appeals, "evidence_of", { job_id: meta.jobId });
  ok(`${side}: the delivery failed the check`, receipt.pass === false && receipt.reason === "room cut off" && receipt.seller === run.worker, receipt.reason);
  const preview = await view(run.appeals, "preview_check", { job_id: meta.jobId, data: receipt.data });
  ok(`${side}: preview_check still fails with the same reason`, preview.pass === false && preview.reason === receipt.reason, preview.reason);
  ok(`${side}: evidence hash matches the stored delivery`, local === chainHash && local === dispute.evidence_hash && local === cse.evidence_hash);
  ok(`${side}: the jury case was opened by the appeals contract`, cse.opener === run.appeals && cse.policy_hash === policyHash() && JSON.stringify(cse.options) === JSON.stringify(["worker", "buyer"]));
  const reads = cse.jurors.map((j) => j.first);
  const maj = majority(reads);
  ok(`${side}: six reveals and the majority rule agree with the ruling`,
    cse.outcome === "Decided" && cse.ruling === expectRuling && maj && maj.ruling === expectRuling && reads.length === 6,
    `ruling ${cse.ruling} sums ${(maj && maj.sums || []).join("+")}`);
  ok(`${side}: the contract ${payout === "sent" ? "paid the worker" : "refunded the buyer"}`,
    dispute.case_id === meta.caseId && dispute.status === status && dispute.ruling === expectRuling && receipt.payout === payout && BigInt(receipt.price) === BigInt(dispute.price));

  const names = { worker: ["deliverWorker", "disputeWorker", "settleWorker"], buyer: ["deliverBuyer", "disputeBuyer", "settleBuyer"] }[side];
  const deliver = await txOf(run.txs[names[0]]);
  const disputeTx = await txOf(run.txs[names[1]]);
  const settle = await txOf(run.txs[names[2]]);
  const deliverCall = topCall(deliver);
  ok(`${side}: the deliver transaction is the worker calling deliver`,
    deliver.transaction.signer_id === run.worker && deliver.transaction.receiver_id === run.appeals && deliverCall?.method_name === "deliver" && logsOf(deliver).some((l) => l.includes(`fail job ${meta.jobId}`) && l.includes("room cut off")));
  ok(`${side}: the dispute transaction opened jury case ${meta.caseId}`,
    disputeTx.transaction.signer_id === run.worker && topCall(disputeTx)?.method_name === "dispute" && logsOf(disputeTx).some((l) => l === `case_opened:${meta.caseId}`) && logsOf(disputeTx).some((l) => l.includes(`evidence ${local}`)));
  const settleLogs = logsOf(settle);
  ok(`${side}: settle called the contract and the callback logged the ${payout === "sent" ? "payout" : "refund"}`,
    settle.transaction.signer_id === run.buyer && settle.transaction.receiver_id === run.appeals && topCall(settle)?.method_name === "settle"
    && settleLogs.some((l) => l.startsWith(`appeal ${logNeedle} job ${meta.jobId} `) && l.endsWith(String(receipt.price)))
    && settleLogs.some((l) => l === `appeal ${payout === "sent" ? "worker" : "buyer"} job ${meta.jobId} amount ${receipt.price}`));
  const hDeliver = await heightOf(deliver);
  const hDispute = await heightOf(disputeTx);
  const hSettle = await heightOf(settle);
  ok(`${side}: the jury was locked before the dispute, and settle is after the dispute`,
    hJury < hDispute && hAppeals < hDeliver && hDeliver < hDispute && hDispute < hSettle,
    `lock ${hJury} deliver ${hDeliver} dispute ${hDispute} settle ${hSettle}`);
  return BigInt(receipt.price);
}

const paid = await checkSide("worker", 0, "sent", "paid", "pay");
const refunded = await checkSide("buyer", 1, "refunded", "refunded", "refund");
ok("spent equals the worker payout and refunded equals the buyer refund", BigInt(cfg.spent) === paid && BigInt(cfg.refunded) === refunded && BigInt(cfg.reserved) === 0n);

console.log(`\n${EXPLORER}/txns/${run.txs.settleWorker.hash}`);
console.log(`${EXPLORER}/txns/${run.txs.settleBuyer.hash}`);
console.log(fails ? `\n${fails} of ${passes + fails} checks failed` : `\nall ${passes} checks passed`);
process.exit(fails ? 1 : 0);
