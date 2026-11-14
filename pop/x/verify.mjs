#!/usr/bin/env node
// Re-reads the X hire run from testnet. No key.
//   node pop/x/verify.mjs
import fs from "node:fs";
import { evidenceHash, policyHash } from "../appeals/lib/hash.mjs";
import { feedErrors } from "./events.mjs";

const RUN_PATH = new URL("./run.json", import.meta.url);
const FEED_PATH = new URL("./events.json", import.meta.url);
const THREAD_PATH = new URL("../../public/x/thread.html", import.meta.url);
const PUBLISHED = "dev-20261111042208-14186395012630.testnet";
const MAINNET = "ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827";
const RPC = "https://rpc.testnet.fastnear.com";
const ARCHIVAL = "https://archival-rpc.testnet.fastnear.com";
const EXPLORER = "https://testnet.nearblocks.io";

if (!fs.existsSync(RUN_PATH)) { console.error("missing pop/x/run.json"); process.exit(2); }
const run = JSON.parse(fs.readFileSync(RUN_PATH, "utf8"));
const feed = JSON.parse(fs.readFileSync(FEED_PATH, "utf8"));
const thread = fs.readFileSync(THREAD_PATH, "utf8");

let fails = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!cond) fails++; };

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
async function txOf(ref) {
  const params = { tx_hash: ref.hash, sender_account_id: ref.sender, wait_until: "NONE" };
  try { return await rpc("tx", params, ARCHIVAL); } catch { return await rpc("tx", params, RPC); }
}
function failedText(tx) {
  const rows = [tx.status, tx.transaction_outcome?.outcome?.status, ...(tx.receipts_outcome || []).map((r) => r.outcome?.status)];
  return JSON.stringify(rows);
}
function success(tx) {
  const rows = [tx.status, ...(tx.receipts_outcome || []).map((r) => r.outcome?.status)];
  return !JSON.stringify(rows).includes("Failure");
}
function fullAccess(key) {
  const p = key.access_key?.permission;
  return p === "FullAccess" || (p && Object.hasOwn(p, "FullAccess"));
}

console.log(`X hire on testnet\n${EXPLORER}/address/${run.contract}\n`);

ok("the run is testnet", run.network === "testnet" && run.contract.endsWith(".testnet") && run.contract !== MAINNET);
ok("the requester is an implicit account", /^[0-9a-f]{64}$/.test(run.requester));

const cfg = await view(run.contract, "get_config");
ok("the buyer is the requester and the jury is the one in the run", cfg.buyer === run.requester && cfg.jury === run.jury);
ok("the cap is 1 NEAR", BigInt(cfg.cap) === 10n ** 24n);

const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: run.contract })).keys;
ok("the contract has no full-access key", keys.every((k) => !fullAccess(k)));
const warden = keys.find((k) => k.public_key === run.wardenPublicKey);
const methods = warden ? (warden.access_key.permission.FunctionCall || warden.access_key.permission.function_call) : null;
const names = methods?.method_names || methods?.methodNames || [];
ok("the warden key can post and hire and cannot transfer", !!warden && names.includes("post_job") && names.includes("hire") && !names.includes("dispute"));

const publishedCode = await rpc("query", { request_type: "view_code", finality: "final", account_id: PUBLISHED });
const juryCode = await rpc("query", { request_type: "view_code", finality: "final", account_id: run.jury });
ok("the jury wasm matches the published Lock jury", publishedCode.hash === juryCode.hash && run.publishedJury === PUBLISHED);

const refused = await txOf(run.txs.refused);
ok("posting before funding failed and created no job", refused.transaction.signer_id === run.contract && !success(refused) && failedText(refused).includes("FunctionCallError"), run.txs.refused.hash);

const fund = await txOf(run.txs.fund);
const fundJson = JSON.stringify(fund.transaction?.actions || []);
ok("the requester signed the funding transfer", success(fund) && fund.transaction.signer_id === run.requester && fund.transaction.receiver_id === run.contract && fundJson.includes("Transfer") && fundJson.includes(run.fundYocto), run.txs.fund.hash);

const logo = await view(run.contract, "get_job", { job_id: run.jobs.logo.id });
const logoReceipt = await view(run.contract, "get_receipt", { receipt_id: run.jobs.logo.receiptId });
ok("job 0 is a paid paint delivery from Ink", logo.kind === "paint" && logo.state === "done" && logo.bids.length === 2 && logoReceipt.pass === true && logoReceipt.payout === "sent" && logoReceipt.seller === run.ink && BigInt(logoReceipt.price) === BigInt(run.jobs.logo.ask));
const paint = JSON.parse(logoReceipt.data);
ok("the paid delivery is the swatch on the page", paint.floor === run.colors.floor && paint.wall === run.colors.wall);

const map = await view(run.contract, "get_job", { job_id: run.jobs.map.id });
const mapReceipt = await view(run.contract, "get_receipt", { receipt_id: run.jobs.map.receiptId });
const dispute = await view(run.contract, "get_dispute", { dispute_id: run.jobs.map.disputeId });
const cse = await view(run.jury, "get_case", { case_id: run.jobs.map.caseId });
const local = evidenceHash({
  jobId: map.id, receiptId: mapReceipt.id, kind: mapReceipt.kind, worker: mapReceipt.seller, buyer: run.requester,
  price: mapReceipt.price, spec: map.spec, reason: mapReceipt.reason, data: mapReceipt.data,
});
ok("job 1 failed the map check and was refunded to the requester", map.kind === "map" && map.state === "refunded" && map.bids.length === 2 && mapReceipt.pass === false && mapReceipt.reason === "room cut off" && mapReceipt.seller === run.clay && dispute.status === "refunded" && dispute.buyer === run.requester);
ok("the jury ruled for the buyer on this delivery", cse.outcome === "Decided" && cse.ruling === 1 && cse.opener === run.contract && cse.evidence_hash === local && local === dispute.evidence_hash && cse.policy_hash === policyHash());

const deliver = await txOf(run.txs.deliverLogo);
ok("the pass, the check, and the payment are one transaction", success(deliver) && deliver.transaction.signer_id === run.ink && JSON.stringify(deliver.receipts_outcome).includes("pass job"), run.txs.deliverLogo.hash);
const settle = await txOf(run.txs.settle);
ok("the ruling transaction refunds the requester", success(settle) && JSON.stringify(settle.receipts_outcome).includes("appeal buyer"), run.txs.settle.hash);

const errors = feedErrors(feed);
ok("the event feed has the seven types and only testnet links", errors.length === 0, errors.join("; "));
ok("the feed has two jobs, four bids, one payment, one dispute, and one ruling",
  feed.events.filter((e) => e.type === "job_opened").length === 2 &&
  feed.events.filter((e) => e.type === "bid").length === 4 &&
  feed.events.filter((e) => e.type === "paid").length === 1 &&
  feed.events.filter((e) => e.type === "disputed").length === 1 &&
  feed.events.filter((e) => e.type === "ruled").length === 1);
const shown = ["refused", "fund", "openLogo", "bidInkLogo", "bidClayLogo", "hireLogo", "deliverLogo", "openMap", "bidInkMap", "bidClayMap", "hireMap", "deliverMap", "dispute", "settle"];
ok("the thread contains every step's transaction", shown.every((k) => thread.includes(run.txs[k].hash)) && thread.includes("Dry run"));
ok("the thread does not mention proto_von", !thread.toLowerCase().includes("proto_von"));

console.log(fails ? `\n${fails} failed` : "\nall checks passed");
if (!fails) {
  console.log(`${EXPLORER}/txns/${run.txs.fund.hash}`);
  console.log(`${EXPLORER}/txns/${run.txs.deliverLogo.hash}`);
  console.log(`${EXPLORER}/txns/${run.txs.settle.hash}`);
}
process.exit(fails ? 1 : 0);
