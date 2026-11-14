#!/usr/bin/env node
// Testnet only. One failed delivery that the jury pays, and one that it refunds.
// Full-access keys are deleted at the end. Secrets stay in pop/appeals/.keys/, which git ignores.
//   node pop/appeals/scripts/run.mjs
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { NETS, near, TGAS, freshKey, account, call, view, accountState, txLink } from "../../lib/near.mjs";
import { commitmentHash, evidenceHash, policyHash, sha256hex } from "../lib/hash.mjs";

const PUBLISHED = "dev-20261111042208-14186395012630.testnet";
if (process.argv.includes("mainnet") || process.env.POP_NETWORK === "mainnet") {
  console.error("appeals run on testnet only");
  process.exit(2);
}
const net = "testnet";
const STATE = fileURLToPath(new URL("../.keys/state.json", import.meta.url));
const RUN = fileURLToPath(new URL("../run.json", import.meta.url));
const WASM = fileURLToPath(new URL("../contract/target/wasm32-unknown-unknown/release/pay_on_proof_appeals.wasm", import.meta.url));
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function load() {
  if (!fs.existsSync(STATE)) return { txs: {}, jobs: {}, salts: {}, panels: {}, done: {}, accounts: {} };
  return JSON.parse(fs.readFileSync(STATE, "utf8"));
}
let state = load();
function save() {
  fs.mkdirSync(new URL("../.keys/", import.meta.url), { recursive: true, mode: 0o700 });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

async function rpc(method, params) {
  let last;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(NETS.testnet.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 300));
      return j.result;
    } catch (e) { last = e; await sleep(1000 * (i + 1)); }
  }
  throw last;
}
const acc = (entry) => account(net, entry.accountId, entry.secretKey);
async function bal(id) {
  const st = await accountState(net, id);
  return st ? BigInt(st.amount) : 0n;
}

async function must(fn, label) {
  let last;
  for (let i = 0; i < 4; i++) {
    const r = await fn();
    const later = (r.laterFailures || []).join(" | ");
    if (!r.failed && !later) { console.log(`ok  ${label}  ${txLink(net, r.tx)}`); return r; }
    last = r.failed || later;
    if (!/timeout|429|503|fetch|ECONN|socket|rate|Unknown/i.test(String(last)) || r.tx) break;
    console.log(`retry ${label}: ${String(last).slice(0, 160)}`);
    await sleep(2000 * (i + 1));
  }
  throw new Error(`${label}: ${last}`);
}

async function faucet(prefix) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const k = freshKey();
    const id = `${prefix}-${Date.now().toString(36)}.testnet`;
    const r = await fetch(NETS.testnet.faucet, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ newAccountId: id, newAccountPublicKey: k.publicKey }) });
    const text = await r.text();
    if (r.ok) {
      console.log("faucet", id);
      await sleep(2500);
      return { accountId: id, publicKey: k.publicKey, secretKey: k.secretKey };
    }
    console.log(`faucet ${r.status} ${text.slice(0, 160)}`);
    await sleep(4000 * (attempt + 1));
  }
  throw new Error("faucet failed for " + prefix);
}

async function waitFunded(id) {
  for (let i = 0; i < 30; i++) {
    const b = await bal(id);
    if (b > 0n) return b;
    await sleep(1000);
  }
  throw new Error("account was not funded: " + id);
}

if (!state.done.accounts) {
  state.accounts.appeals = await faucet("popa");
  state.accounts.jury = await faucet("popaj");
  state.accounts.worker = await faucet("popaw");
  state.accounts.buyer = await faucet("popab");
  state.accounts.jurors = [];
  const juryAcc = acc(state.accounts.jury);
  for (let i = 0; i < 6; i++) {
    const k = freshKey();
    const out = await juryAcc.transfer({ receiverId: k.accountId, amount: near(0.5) });
    console.log(`fund juror ${i} ${k.accountId} ${txLink(net, out.transaction.hash)}`);
    await waitFunded(k.accountId);
    state.accounts.jurors.push({ accountId: k.accountId, publicKey: k.publicKey, secretKey: k.secretKey });
    save();
  }
  state.accounts.warden = freshKey();
  state.done.accounts = true;
  save();
}

const A = state.accounts.appeals;
const J = state.accounts.jury;
const W = state.accounts.worker;
const B = state.accounts.buyer;

if (!state.done.jury) {
  const code = await rpc("query", { request_type: "view_code", finality: "final", account_id: PUBLISHED });
  const wasm = Buffer.from(code.code_base64, "base64");
  console.log(`published jury wasm ${wasm.length} bytes ${code.hash}`);
  const juryAcc = acc(J);
  const ids = state.accounts.jurors.map((j) => j.accountId);
  let jurors = null;
  try { jurors = await view(net, J.accountId, "get_jurors"); } catch { /* not initialised */ }
  if (!jurors) {
    const deployed = await juryAcc.deployContract(new Uint8Array(wasm));
    console.log("deploy jury", txLink(net, deployed.transaction.hash));
    await must(() => call(juryAcc, J.accountId, "new", { jurors: ids }), "jury new");
    jurors = await view(net, J.accountId, "get_jurors");
  }
  if (JSON.stringify(jurors) !== JSON.stringify(ids)) throw new Error("jurors not stored");
  const keyList = await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: J.accountId });
  const stillFull = keyList.keys.some((k) => k.public_key === J.publicKey && k.access_key.permission === "FullAccess");
  if (stillFull) {
    const locked = await juryAcc.deleteKey(J.publicKey);
    state.txs.lockJury = { hash: locked.transaction.hash, sender: J.accountId };
    console.log("lock jury", txLink(net, locked.transaction.hash));
  }
  if (!state.txs.lockJury) throw new Error("jury lock transaction was not recorded");
  const again = await rpc("query", { request_type: "view_code", finality: "final", account_id: J.accountId });
  if (again.hash !== code.hash) throw new Error(`jury code hash ${again.hash} != ${code.hash}`);
  state.done.jury = true;
  save();
}

if (!state.done.appeals) {
  if (!fs.existsSync(WASM)) throw new Error("missing appeals wasm; cargo build --release --target wasm32-unknown-unknown");
  const wasm = fs.readFileSync(WASM);
  const appealsAcc = acc(A);
  const have = await bal(A.accountId);
  const need = BigInt(wasm.length) * 10n ** 19n + near(2);
  if (have < need) {
    const top = await acc(B).transfer({ receiverId: A.accountId, amount: need - have + near(0.5) });
    console.log("top up appeals", txLink(net, top.transaction.hash));
    await sleep(3000);
  }
  let cfg = null;
  try { cfg = await view(net, A.accountId, "get_config"); } catch { /* not initialised */ }
  if (!cfg) {
    const deployed = await appealsAcc.deployContract(new Uint8Array(wasm));
    console.log("deploy appeals", txLink(net, deployed.transaction.hash));
    await must(() => call(appealsAcc, A.accountId, "new", { buyer: B.accountId, cap: near(2).toString(), jury: J.accountId }), "appeals new");
  }
  const keyList = await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: A.accountId });
  const haveWarden = keyList.keys.some((k) => k.public_key === state.accounts.warden.publicKey);
  if (!haveWarden) {
    const added = await appealsAcc.addFunctionCallAccessKey({
      publicKey: state.accounts.warden.publicKey,
      contractId: A.accountId,
      methodNames: ["post_job", "hire", "cancel_job"],
      allowance: near(0.5),
    });
    console.log("warden key", txLink(net, added.transaction.hash));
  }
  const stillFull = keyList.keys.some((k) => k.public_key === A.publicKey && k.access_key.permission === "FullAccess");
  if (stillFull || !state.txs.lockAppeals) {
    const fresh = await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: A.accountId });
    if (fresh.keys.some((k) => k.public_key === A.publicKey && k.access_key.permission === "FullAccess")) {
      const locked = await appealsAcc.deleteKey(A.publicKey);
      state.txs.lockAppeals = { hash: locked.transaction.hash, sender: A.accountId };
      console.log("lock appeals", txLink(net, locked.transaction.hash));
    }
  }
  if (!state.txs.lockAppeals) throw new Error("appeals lock transaction was not recorded");
  state.done.appeals = true;
  save();
}

const spec = JSON.stringify({ rooms: 3, cols: 4, rows: 3 });
const bad = JSON.stringify({ rooms: [[0, 0], [1, 0], [3, 2]], links: [[[0, 0], [1, 0]]], entry: [0, 0], exit: [1, 0] });

async function panel(caseId, probs) {
  const key = String(caseId);
  if (!state.salts[key]) {
    state.salts[key] = state.accounts.jurors.map(() => randomBytes(32).toString("hex"));
    state.panels[key] = { commits: [], audits: [], reveals: [] };
    save();
  }
  const salts = state.salts[key];
  const rec = state.panels[key];
  const cse0 = await view(net, J.accountId, "get_case", { case_id: caseId });
  for (let i = 0; i < 6; i++) {
    if (cse0.jurors[i].committed && rec.commits[i]) continue;
    if (cse0.jurors[i].committed) continue;
    const juror = state.accounts.jurors[i];
    const rationaleHash = sha256hex(Buffer.from(`pay on proof appeal juror ${i} case ${caseId}`));
    const hash = commitmentHash({
      contractId: J.accountId, caseId, evidenceHash: cse0.evidence_hash, policyHash: cse0.policy_hash,
      juror: juror.accountId, probs, rationaleHash, salt: salts[i],
    });
    const r = await must(() => call(acc(juror), J.accountId, "commit", { case_id: caseId, hash }, { gas: 40n * TGAS }), `commit ${caseId} j${i + 1}`);
    rec.commits[i] = { hash: r.tx, sender: juror.accountId };
    save();
  }
  for (let i = 0; i < 6; i++) {
    const now = await view(net, J.accountId, "get_case", { case_id: caseId });
    if (now.jurors[i].audit_posted) continue;
    if (now.phase !== "Discuss") throw new Error(`case ${caseId} phase ${now.phase}, expected Discuss`);
    const juror = state.accounts.jurors[i];
    const r = await must(() => call(acc(juror), J.accountId, "final_read", { case_id: caseId, probs }, { gas: 40n * TGAS }), `audit ${caseId} j${i + 1}`);
    rec.audits[i] = { hash: r.tx, sender: juror.accountId };
    save();
  }
  for (let i = 0; i < 6; i++) {
    const now = await view(net, J.accountId, "get_case", { case_id: caseId });
    if (now.jurors[i].first) continue;
    if (now.phase !== "Reveal") throw new Error(`case ${caseId} phase ${now.phase}, expected Reveal`);
    const juror = state.accounts.jurors[i];
    const rationaleHash = sha256hex(Buffer.from(`pay on proof appeal juror ${i} case ${caseId}`));
    const r = await must(() => call(acc(juror), J.accountId, "reveal", {
      case_id: caseId, probs, rationale_hash: rationaleHash, salt: salts[i],
    }, { gas: 80n * TGAS }), `reveal ${caseId} j${i + 1}`);
    rec.reveals[i] = { hash: r.tx, sender: juror.accountId };
    save();
  }
  const done = await view(net, J.accountId, "get_case", { case_id: caseId });
  if (done.outcome !== "Decided") throw new Error(`case ${caseId} outcome ${done.outcome} ruling ${done.ruling}`);
  return done;
}

async function oneJob(side, title, probs) {
  if (state.jobs[side]?.settled) return;
  const warden = acc({ accountId: A.accountId, secretKey: state.accounts.warden.secretKey });
  const worker = acc(W);
  const buyer = acc(B);
  const C = A.accountId;
  const job = state.jobs[side] || (state.jobs[side] = {});
  if (job.jobId === undefined) {
    const r = await must(() => call(warden, C, "post_job", { kind: "map", title, spec, budget: near(0.2).toString(), window_mins: 180 }), "post " + side);
    job.jobId = r.result;
    job.post = { hash: r.tx, sender: C };
    save();
  }
  if (job.bid === undefined) {
    const r = await must(() => call(worker, C, "bid", { job_id: job.jobId, ask: near(0.15).toString() }), "bid " + side);
    job.bid = r.result;
    job.bidTx = { hash: r.tx, sender: W.accountId };
    save();
  }
  if (!job.hired) {
    const r = await must(() => call(warden, C, "hire", { job_id: job.jobId, bid: job.bid }), "hire " + side);
    job.hire = { hash: r.tx, sender: C };
    job.hired = true;
    save();
  }
  if (!job.delivered) {
    const preview = await view(net, C, "preview_check", { job_id: job.jobId, data: bad });
    if (preview.pass || preview.reason !== "room cut off") throw new Error("preview " + JSON.stringify(preview));
    const before = await bal(W.accountId);
    const r = await must(() => call(worker, C, "deliver", { job_id: job.jobId, data: bad }, { gas: 80n * TGAS }), "deliver " + side);
    if (r.result !== false) throw new Error("deliver should fail the check, got " + r.result);
    const after = await bal(W.accountId);
    if (after >= before) throw new Error("a failed delivery must not pay");
    job.deliver = { hash: r.tx, sender: W.accountId };
    job.delivered = true;
    save();
  }
  if (job.caseId === undefined) {
    let onChain = await view(net, C, "get_job", { job_id: job.jobId });
    let r = { tx: job.dispute?.hash };
    if (onChain.state === "appealable") {
      r = await must(() => call(worker, C, "dispute", { job_id: job.jobId }, { gas: 250n * TGAS }), "dispute " + side);
      onChain = await view(net, C, "get_job", { job_id: job.jobId });
    }
    for (let i = 0; i < 5 && onChain.state === "opening"; i++) { await sleep(2000); onChain = await view(net, C, "get_job", { job_id: job.jobId }); }
    if (onChain.state !== "disputed") throw new Error(`dispute did not open, state ${onChain.state}`);
    const d = await view(net, C, "get_dispute", { dispute_id: onChain.dispute });
    const receipt = await view(net, C, "get_receipt", { receipt_id: d.receipt });
    const local = evidenceHash({
      jobId: onChain.id, receiptId: receipt.id, kind: receipt.kind, worker: receipt.seller, buyer: B.accountId,
      price: receipt.price, spec: onChain.spec, reason: receipt.reason, data: receipt.data,
    });
    if (d.case_id === null || d.case_id === undefined) throw new Error("no case id " + JSON.stringify(d));
    if (d.evidence_hash !== local) throw new Error(`evidence hash ${d.evidence_hash} != ${local}`);
    const cse = await view(net, J.accountId, "get_case", { case_id: d.case_id });
    if (cse.opener !== C || cse.evidence_hash !== local || cse.policy_hash !== policyHash()) throw new Error("jury case does not match the delivery");
    job.dispute = { hash: r.tx, sender: W.accountId };
    job.disputeId = onChain.dispute;
    job.receiptId = d.receipt;
    job.caseId = d.case_id;
    job.evidence = local;
    save();
  }
  if (!job.ruled) {
    const done = await panel(job.caseId, probs);
    const expect = side === "worker" ? 0 : 1;
    if (done.ruling !== expect) throw new Error(`case ${job.caseId} ruling ${done.ruling}, expected ${expect}`);
    job.ruled = true;
    save();
  }
  if (!job.settled) {
    const before = await bal(side === "worker" ? W.accountId : B.accountId);
    const r = await must(() => call(buyer, C, "settle", { job_id: job.jobId }, { gas: 300n * TGAS }), "settle " + side);
    const d = await view(net, C, "get_dispute", { dispute_id: job.disputeId });
    const want = side === "worker" ? "paid" : "refunded";
    if (d.status !== want) throw new Error(`dispute status ${d.status}, logs ${r.logs.join(" | ")}`);
    const after = await bal(side === "worker" ? W.accountId : B.accountId);
    if (side === "worker" && after - before !== near(0.15)) throw new Error(`worker balance +${after - before}, expected ${near(0.15)}`);
    job.settle = { hash: r.tx, sender: B.accountId };
    job.settled = true;
    job.logs = r.logs;
    save();
    console.log(side, "settled", d.status, r.logs.filter((l) => l.startsWith("appeal")).join(" | "));
  }
}

await oneJob("worker", "Appeal dock", [8000, 2000]);
await oneJob("buyer", "Appeal shed", [2000, 8000]);

const cfg = await view(net, A.accountId, "get_config");
if (BigInt(cfg.spent) !== near(0.15) || BigInt(cfg.refunded) !== near(0.15) || BigInt(cfg.reserved) !== 0n) {
  throw new Error(`books spent ${cfg.spent} refunded ${cfg.refunded} reserved ${cfg.reserved}`);
}

async function dropKey(entry, label) {
  const key = label === "juror" ? `drop-${entry.accountId}` : `drop-${label}`;
  if (state.txs[key]) return state.txs[key];
  const out = await acc(entry).deleteKey(entry.publicKey);
  const ref = { hash: out.transaction.hash, sender: entry.accountId };
  state.txs[key] = ref;
  entry.secretKey = "deleted-on-chain";
  save();
  console.log("delete", label, txLink(net, ref.hash));
  return ref;
}

const droppedJurors = [];
for (const juror of state.accounts.jurors) {
  if (juror.secretKey === "deleted-on-chain") continue;
  droppedJurors.push(await dropKey(juror, "juror"));
}
if (W.secretKey !== "deleted-on-chain") await dropKey(W, "worker");
if (B.secretKey !== "deleted-on-chain") await dropKey(B, "buyer");
state.accounts.warden.secretKey = "not-committed";
save();

const run = {
  network: "testnet",
  publishedJury: PUBLISHED,
  appeals: A.accountId,
  jury: J.accountId,
  buyer: B.accountId,
  worker: W.accountId,
  jurors: state.accounts.jurors.map((j) => j.accountId),
  wardenPublicKey: state.accounts.warden.publicKey,
  jobs: {
    worker: { jobId: state.jobs.worker.jobId, receiptId: state.jobs.worker.receiptId, disputeId: state.jobs.worker.disputeId, caseId: state.jobs.worker.caseId },
    buyer: { jobId: state.jobs.buyer.jobId, receiptId: state.jobs.buyer.receiptId, disputeId: state.jobs.buyer.disputeId, caseId: state.jobs.buyer.caseId },
  },
  txs: {
    lockJury: state.txs.lockJury,
    lockAppeals: state.txs.lockAppeals,
    deliverWorker: state.jobs.worker.deliver,
    disputeWorker: state.jobs.worker.dispute,
    settleWorker: state.jobs.worker.settle,
    deliverBuyer: state.jobs.buyer.deliver,
    disputeBuyer: state.jobs.buyer.dispute,
    settleBuyer: state.jobs.buyer.settle,
    deleteWorker: state.txs["drop-worker"],
    deleteBuyer: state.txs["drop-buyer"],
  },
  panels: {
    worker: state.panels[String(state.jobs.worker.caseId)],
    buyer: state.panels[String(state.jobs.buyer.caseId)],
  },
};
fs.writeFileSync(RUN, JSON.stringify(run, null, 2) + "\n");
console.log("wrote", RUN);
console.log("worker payout", txLink(net, run.txs.settleWorker.hash));
console.log("buyer refund", txLink(net, run.txs.settleBuyer.hash));
