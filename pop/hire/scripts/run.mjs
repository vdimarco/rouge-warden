#!/usr/bin/env node
// Testnet only. One Pay on Proof job hires a second agent.
// The parent keeps a function-call key and no full-access key. The contract refuses a sub-job over the parent's cap.
// The sub-account is paid from that cap. The parent's remainder is paid in NEAR to a separate owner account, which then spends some of it.
//
//   node pop/hire/scripts/run.mjs
//
// Secrets stay in pop/hire/.keys/. This writes the public record to pop/hire/run.json.
// It does not sign anything on mainnet.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { actions } from "near-api-js";
import { NETS, near, fmt, TGAS, freshKey, account, call, view, accountState, accountLink, txLink, provider } from "../../lib/near.mjs";
import { keyStore, loadProgress, saveProgress } from "../lib/keys.mjs";
import { PARENT_METHODS, WARDEN_METHODS } from "../lib/methods.mjs";

const net = "testnet";
if (process.argv.includes("mainnet")) {
  console.error("refusing to run on mainnet");
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const WASM = path.join(here, "../contract/target/wasm32-unknown-unknown/release/pay_on_proof_hire.wasm");
const MOCK = path.join(here, "../../mock-intents/target/wasm32-unknown-unknown/release/mock_intents.wasm");
const RUN = path.join(here, "../run.json");
const ks = keyStore();
let prog = loadProgress();
if (prog.generation !== "v2") { prog = { generation: "v2" }; saveProgress(prog); }
const step = (s) => console.log("\n== " + s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const G = 100n * TGAS;

const MAP_SPEC = JSON.stringify({ rooms: 3, cols: 4, rows: 3 });
const GOOD_MAP = JSON.stringify({
  rooms: [[0, 0], [1, 0], [1, 1]],
  links: [[[0, 0], [1, 0]], [[1, 0], [1, 1]]],
  entry: [0, 0],
  exit: [1, 1],
});
const ROSTER_SPEC = JSON.stringify({ lo: 8, hi: 12, size: 3 });
const GOOD_ROSTER = JSON.stringify({
  critters: [
    { name: "Goose", threat: 3 },
    { name: "Bear", threat: 5 },
    { name: "Raccoon", threat: 2 },
  ],
});

function save() { saveProgress(prog); }

async function faucet(name) {
  const have = ks.get(name);
  if (have) return have;
  let last = "no attempt";
  for (let i = 0; i < 6; i++) {
    const k = freshKey();
    const id = `${name}-${Date.now().toString(36)}.testnet`;
    const r = await fetch(NETS.testnet.faucet, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newAccountId: id, newAccountPublicKey: k.publicKey }),
    });
    if (r.ok) {
      const entry = { accountId: id, publicKey: k.publicKey, secretKey: k.secretKey };
      ks.put(name, entry);
      console.log(`  ${name}: ${id}`);
      await sleep(2000);
      return entry;
    }
    last = `${r.status} ${(await r.text()).slice(0, 180)}`;
    console.log(`  faucet ${name} retry ${i + 1}: ${last}`);
    await sleep(4000 * (i + 1));
  }
  throw new Error(`faucet ${name}: ${last}`);
}

async function deployIfNeeded(acc, wasmPath, label) {
  const st = await accountState(net, acc.accountId);
  const code = fs.readFileSync(wasmPath);
  if (st && st.code_hash && st.code_hash !== "11111111111111111111111111111111") {
    console.log(`  ${label} already has code`);
    return false;
  }
  const out = await acc.deployContract(new Uint8Array(code));
  console.log(`  deployed ${label}: ${code.length} bytes, ${txLink(net, out.transaction.hash)}`);
  prog[label + "DeployTx"] = out.transaction.hash;
  save();
  return true;
}

function acc(entry) { return account(net, entry.accountId, entry.secretKey); }

async function keyList(id) {
  const list = await provider(net).viewAccessKeyList({ accountId: id });
  return list.keys;
}

function fullKeys(keys) { return keys.filter((k) => k.access_key.permission === "FullAccess"); }
function fcKeys(keys) { return keys.filter((k) => k.access_key.permission && k.access_key.permission.FunctionCall); }

async function must(p, label) {
  const r = await p;
  if (r.failed) throw new Error(`${label}: ${r.failed}`);
  console.log(`  ${label} ${txLink(net, r.tx)}`);
  return r;
}

function txErrorText(e) {
  const bits = [];
  const push = (v) => { if (v != null) bits.push(typeof v === "string" ? v : JSON.stringify(v)); };
  push(e?.message);
  push(e?.type);
  push(e?.kind);
  if (e?.context) push(e.context);
  try { push(JSON.stringify(e, Object.getOwnPropertyNames(e))); } catch { /* circular */ }
  return bits.join("\n").slice(0, 2000);
}

function hashFrom(text) {
  const m = text.match(/[1-9A-HJ-NP-Za-km-z]{43,44}/);
  return m ? m[0] : null;
}

async function main() {
  if (!fs.existsSync(WASM)) throw new Error("missing hire wasm. Build pop/hire/contract for wasm32-unknown-unknown release first.");
  if (!fs.existsSync(MOCK)) throw new Error("missing mock-intents wasm. Build pop/mock-intents first.");

  step("Accounts from the testnet faucet");
  const contract = await faucet("v2-contract");
  const ben = await faucet("ben");
  const intents = await faucet("intents");
  const parent = await faucet("v2-parent");
  const owner = await faucet("v2-owner");
  if (!ks.get("v2-parent-fc")) {
    const k = freshKey();
    ks.put("v2-parent-fc", { accountId: parent.accountId, publicKey: k.publicKey, secretKey: k.secretKey });
  }
  if (!ks.get("v2-warden")) {
    const k = freshKey();
    ks.put("v2-warden", { accountId: contract.accountId, publicKey: k.publicKey, secretKey: k.secretKey });
  }
  if (!ks.get("v2-sub")) {
    const k = freshKey();
    ks.put("v2-sub", { accountId: `crew.${parent.accountId}`, publicKey: k.publicKey, secretKey: k.secretKey });
  }
  const parentFc = ks.get("v2-parent-fc");
  const warden = ks.get("v2-warden");
  const sub = ks.get("v2-sub");
  const C = contract.accountId;
  console.log(`  contract ${accountLink(net, C)}`);
  console.log(`  parent   ${accountLink(net, parent.accountId)}`);
  console.log(`  owner    ${accountLink(net, owner.accountId)}`);
  console.log(`  sub      ${sub.accountId}`);

  step("Mock intents (NEAR Intents has no testnet)");
  const mi = acc(intents);
  if (await deployIfNeeded(mi, MOCK, "mock")) {
    console.log("  init", (await call(mi, intents.accountId, "new", {})).failed || "ok");
  }
  if (!(await view(net, NETS.testnet.wrap, "storage_balance_of", { account_id: intents.accountId }).catch(() => null))) {
    const reg = await call(mi, NETS.testnet.wrap, "storage_deposit", { account_id: intents.accountId, registration_only: true }, { deposit: near(0.0125) });
    console.log("  register mock with wNEAR", reg.failed || txLink(net, reg.tx));
    if (reg.failed) throw new Error(reg.failed);
  } else console.log("  mock already registered with wNEAR");

  step("Deploy the hire contract");
  const pop = acc(contract);
  const contractKeys = await keyList(C);
  const contractLocked = fullKeys(contractKeys).length === 0 && contractKeys.length > 0;
  if (!contractLocked) {
    await deployIfNeeded(pop, WASM, "hire");
    let cfg = null;
    try { cfg = await view(net, C, "get_config"); } catch { /* not initialised */ }
    if (!cfg) {
      const bal = BigInt((await accountState(net, C)).amount);
      if (bal < near(4)) throw new Error(`contract balance ${fmt(bal)} NEAR is too low to hold code, a 1 NEAR cap, and storage`);
      const init = await call(pop, C, "new", { beneficiary: ben.accountId, cap: near(1).toString(), wrap: NETS.testnet.wrap, intents: intents.accountId });
      console.log("  init", init.failed || txLink(net, init.tx));
      if (init.failed) throw new Error(init.failed);
      prog.initTx = init.tx;
      save();
    }
    const reg = await view(net, NETS.testnet.wrap, "storage_balance_of", { account_id: C }).catch(() => null);
    if (!reg) {
      const r = await call(pop, C, "register_wrap", {}, { gas: 80n * TGAS });
      console.log("  register_wrap", r.failed || txLink(net, r.tx));
      if (r.failed) throw new Error(r.failed);
    }
    if (!contractKeys.some((k) => k.public_key === warden.publicKey)) {
      const out = await pop.addFunctionCallAccessKey({ publicKey: warden.publicKey, contractId: C, methodNames: WARDEN_METHODS, allowance: near(1) });
      prog.wardenKeyTx = out.transaction.hash;
      save();
      console.log(`  warden key ${txLink(net, out.transaction.hash)}`);
    }
    const lock = await pop.deleteKey(contract.publicKey);
    prog.contractLockTx = lock.transaction.hash;
    save();
    console.log(`  deleted contract full-access key ${txLink(net, lock.transaction.hash)}`);
  } else console.log("  contract is already locked");

  const wardenAcc = account(net, C, warden.secretKey);
  const parentAcc = acc(parent);
  const parentKeyNow = await keyList(parent.accountId);
  const parentHasFull = fullKeys(parentKeyNow).some((k) => k.public_key === parent.publicKey);

  step("Sub-account");
  const subState = await accountState(net, sub.accountId);
  if (!subState) {
    if (!parentHasFull) throw new Error("parent full-access key is already gone, and the sub-account was not created");
    const bal = BigInt((await accountState(net, parent.accountId)).amount);
    const gift = bal > near(2) ? near(0.8) : near(0.45);
    if (bal < gift + near(0.4)) throw new Error(`parent balance ${fmt(bal)} NEAR is too low to fund the sub-account and keep gas`);
    const out = await parentAcc.createSubAccount({ accountOrPrefix: "crew", publicKey: sub.publicKey, nearToTransfer: gift });
    prog.createSubTx = out.transaction.hash;
    save();
    console.log(`  created ${sub.accountId} ${txLink(net, out.transaction.hash)}`);
  } else console.log(`  ${sub.accountId} exists, balance ${fmt((await accountState(net, sub.accountId)).amount)}`);

  step("Parent function-call key, then delete full access");
  const parentKeys2 = await keyList(parent.accountId);
  if (!parentKeys2.some((k) => k.public_key === parentFc.publicKey)) {
    if (!fullKeys(parentKeys2).length) throw new Error("cannot add the function-call key: the parent has no full-access key");
    const out = await parentAcc.addFunctionCallAccessKey({ publicKey: parentFc.publicKey, contractId: C, methodNames: PARENT_METHODS, allowance: near(2) });
    prog.parentKeyTx = out.transaction.hash;
    save();
    console.log(`  added function-call key ${txLink(net, out.transaction.hash)}`);
  } else console.log("  function-call key already on the parent");

  const parentFcAcc = account(net, parent.accountId, parentFc.secretKey);
  const subAcc = acc(sub);

  step("Post the parent job and bid with the function-call key");
  let jobs = await view(net, C, "get_jobs", {});
  let job = jobs[0];
  if (!job) {
    const posted = await must(call(wardenAcc, C, "post_job", {
      kind: "map", title: "The dock", spec: MAP_SPEC, budget: near(0.5).toString(), window_mins: 60,
    }, { gas: G }), "post_job");
    prog.postJobTx = posted.tx;
    save();
    job = await view(net, C, "get_job", { job_id: posted.result });
  }
  const jobId = job.id;
  console.log(`  job ${jobId} state ${job.state} budget ${fmt(job.budget)}`);
  if (job.bids.length === 0) {
    const bid = await must(call(parentFcAcc, C, "bid", {
      job_id: jobId, ask: near(0.5).toString(), rail: "near", owner: owner.accountId, note: "Pay the owner, who can spend it.",
    }, { gas: G }), "bid");
    prog.bidTx = bid.tx;
    save();
  }

  const beforeLock = await keyList(parent.accountId);
  if (fullKeys(beforeLock).length) {
    const lock = await parentAcc.deleteKey(parent.publicKey);
    prog.parentLockTx = lock.transaction.hash;
    save();
    console.log(`  deleted parent full-access key ${txLink(net, lock.transaction.hash)}`);
  } else console.log("  parent full-access key is already gone");

  job = await view(net, C, "get_job", { job_id: jobId });
  if (job.state === "open") {
    const hired = await must(call(wardenAcc, C, "hire", { job_id: jobId, bid: 0 }, { gas: G }), "hire parent");
    prog.hireTx = hired.tx;
    save();
  }

  step("Refused overspend");
  if (!prog.overspendTx) {
    const over = await call(parentFcAcc, C, "post_subjob", {
      job_id: jobId, kind: "roster", title: "Too much", spec: ROSTER_SPEC, budget: near(0.6).toString(), window_mins: 60,
    }, { gas: G });
    console.log(`  overspend ${over.tx ? txLink(net, over.tx) : "no hash"}`);
    if (!over.failed || !over.failed.includes("over the cap")) throw new Error(`expected over the cap, got ${over.failed || "success"} tx ${over.tx}`);
    prog.overspendTx = over.tx;
    prog.overspendError = over.failed;
    save();
  } else console.log(`  already refused ${txLink(net, prog.overspendTx)}`);

  step("Sub-job, delivery, parent delivery");
  let subs = await view(net, C, "get_subs", {});
  let subJob = subs.find((s) => s.parent_job === jobId && s.state !== "cancelled");
  if (!subJob) {
    const posted = await must(call(parentFcAcc, C, "post_subjob", {
      job_id: jobId, kind: "roster", title: "The hands", spec: ROSTER_SPEC, budget: near(0.2).toString(), window_mins: 60,
    }, { gas: G }), "post_subjob");
    prog.postSubTx = posted.tx;
    save();
    subJob = await view(net, C, "get_sub", { sub_id: posted.result });
  }
  if (subJob.bids.length === 0) {
    const bid = await must(call(subAcc, C, "bid_sub", {
      sub_id: subJob.id, ask: near(0.2).toString(), rail: "near", note: "Roster from the parent's sub-account.",
    }, { gas: G }), "bid_sub");
    prog.bidSubTx = bid.tx;
    save();
  }
  subJob = await view(net, C, "get_sub", { sub_id: subJob.id });
  if (subJob.state === "open") {
    const hired = await must(call(parentFcAcc, C, "hire_sub", { sub_id: subJob.id, bid: 0 }, { gas: G }), "hire_sub");
    prog.hireSubTx = hired.tx;
    save();
  }
  subJob = await view(net, C, "get_sub", { sub_id: subJob.id });
  if (subJob.state === "hired") {
    const before = BigInt((await accountState(net, sub.accountId)).amount);
    const delivered = await must(call(subAcc, C, "deliver_sub", { sub_id: subJob.id, data: GOOD_ROSTER }, { gas: 200n * TGAS }), "deliver_sub");
    prog.deliverSubTx = delivered.tx;
    save();
    const after = BigInt((await accountState(net, sub.accountId)).amount);
    console.log(`  sub balance ${fmt(before)} -> ${fmt(after)} (${fmt(after - before)})`);
    prog.subPaidNear = (after - before).toString();
  }

  job = await view(net, C, "get_job", { job_id: jobId });
  const ownerAcc = acc(owner);
  if (job.state === "hired") {
    const before = BigInt((await accountState(net, owner.accountId)).amount);
    const delivered = await must(call(parentFcAcc, C, "deliver", { job_id: jobId, data: GOOD_MAP }, { gas: 200n * TGAS }), "deliver parent");
    prog.deliverParentTx = delivered.tx;
    save();
    const after = BigInt((await accountState(net, owner.accountId)).amount);
    console.log(`  owner balance ${fmt(before)} -> ${fmt(after)} (${fmt(after - before)})`);
    prog.ownerGain = (after - before).toString();
  }
  if (!prog.spendTx) {
    const spent = await ownerAcc.signAndSendTransaction({
      receiverId: ben.accountId,
      actions: [actions.transfer(near(0.05))],
      waitUntil: "FINAL",
      throwOnFailure: false,
    });
    const failed = spent.status?.Failure;
    if (failed) throw new Error(`owner spend failed: ${JSON.stringify(failed).slice(0, 300)}`);
    prog.spendTx = spent.transaction.hash;
    prog.spendYocto = near(0.05).toString();
    save();
    console.log(`  owner spent 0.05 NEAR ${txLink(net, prog.spendTx)}`);
  }

  step("The parent key cannot send NEAR");
  if (!prog.outsideTx && !prog.outsideError) {
    let outside = {};
    try {
      const out = await parentFcAcc.signAndSendTransaction({
        receiverId: ben.accountId,
        actions: [actions.transfer(near(0.01))],
        waitUntil: "FINAL",
        throwOnFailure: false,
      });
      outside = { tx: out.transaction?.hash || null, status: JSON.stringify(out.status).slice(0, 500) };
    } catch (e) {
      const text = txErrorText(e);
      outside = { tx: e?.context?.transactionHash || e?.transaction_outcome?.id || hashFrom(text), error: String(e?.message || text).split("\n")[0].slice(0, 200) };
    }
    prog.outsideTx = outside.tx || null;
    prog.outsideError = outside.error || outside.status || "no error text";
    save();
    console.log(`  transfer refused ${outside.tx || "no hash"}`);
    console.log(`  ${String(prog.outsideError).slice(0, 400)}`);
  }

  const cfg = await view(net, C, "get_config");
  let receipts = await view(net, C, "get_receipts", {});
  for (let i = 0; i < 8 && receipts.some((r) => r.pass && r.payout === "pending"); i++) {
    await sleep(2000);
    receipts = await view(net, C, "get_receipts", {});
  }
  job = await view(net, C, "get_job", { job_id: jobId });
  subJob = await view(net, C, "get_sub", { sub_id: subJob.id });
  const parentKeys = await keyList(parent.accountId);
  const finalContractKeys = await keyList(C);
  const run = {
    network: "testnet",
    recordedAt: new Date().toISOString(),
    contract: C,
    parent: parent.accountId,
    owner: owner.accountId,
    sub: sub.accountId,
    beneficiary: ben.accountId,
    intents: intents.accountId,
    wrap: NETS.testnet.wrap,
    jobId,
    subId: subJob.id,
    capYocto: cfg.cap,
    budgetYocto: job.budget,
    parentPriceYocto: job.price,
    subBudgetYocto: near(0.2).toString(),
    overspendBudgetYocto: near(0.6).toString(),
    publicKeys: {
      contractDeletedFullAccess: contract.publicKey,
      wardenFunctionCall: warden.publicKey,
      parentDeletedFullAccess: parent.publicKey,
      parentFunctionCall: parentFc.publicKey,
      subFullAccess: sub.publicKey,
      ownerFullAccess: owner.publicKey,
      beneficiaryFullAccess: ben.publicKey,
      intentsFullAccess: intents.publicKey,
    },
    fullAccessStillOnChain: {
      contract: fullKeys(finalContractKeys).map((k) => k.public_key),
      parent: fullKeys(parentKeys).map((k) => k.public_key),
      note: "The owner, the sub-agent, the beneficiary, and the mock intents account still have full-access keys. Their secrets are only in pop/hire/.keys/testnet.json, which git ignores. The contract account and the parent account do not. The parent's pay goes to the owner.",
    },
    txs: {
      init: prog.initTx || null,
      contractLock: prog.contractLockTx || null,
      wardenKey: prog.wardenKeyTx || null,
      createSub: prog.createSubTx || null,
      parentKey: prog.parentKeyTx || null,
      postJob: prog.postJobTx || null,
      bid: prog.bidTx || null,
      parentLock: prog.parentLockTx || null,
      hire: prog.hireTx || null,
      overspend: prog.overspendTx || null,
      postSub: prog.postSubTx || null,
      bidSub: prog.bidSubTx || null,
      hireSub: prog.hireSubTx || null,
      deliverSub: prog.deliverSubTx || null,
      deliverParent: prog.deliverParentTx || null,
      ownerSpend: prog.spendTx || null,
      outside: prog.outsideTx || null,
    },
    spendYocto: prog.spendYocto || near(0.05).toString(),
    overspendError: prog.overspendError || null,
    outsideError: prog.outsideError || null,
    parentKeyCount: parentKeys.length,
    contractKeyCount: finalContractKeys.length,
    jobState: job.state,
    subState: subJob.state,
    spent: cfg.spent,
    reserved: cfg.reserved,
    receipts: receipts.map((r) => ({ id: r.id, role: r.role, pass: r.pass, price: r.price, payout: r.payout, rail: r.rail, reason: r.reason })),
    secrets: "pop/hire/.keys/testnet.json is gitignored. It holds every testnet secret from this run, including full-access keys for the owner, the sub-agent, the beneficiary, and the mock intents account, plus the deleted full-access secrets of the contract and the parent.",
  };
  fs.writeFileSync(RUN, JSON.stringify(run, null, 2) + "\n");
  console.log("\nWrote pop/hire/run.json");
  console.log(`spent ${fmt(cfg.spent)} reserved ${fmt(cfg.reserved)} cap ${fmt(cfg.cap)} job ${job.state} sub ${subJob.state}`);
  const bad = receipts.filter((r) => r.pass && r.payout !== "sent");
  if (job.state !== "done" || subJob.state !== "done" || bad.length) {
    throw new Error(`run did not finish cleanly: job ${job.state} sub ${subJob.state} unpaid ${JSON.stringify(bad)}`);
  }
}

main().catch((e) => { console.error("\nhire run failed:", e.message || e); process.exit(1); });
