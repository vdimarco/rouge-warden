#!/usr/bin/env node
// Testnet only. One X mention is funded with a meta-transaction, two agents bid, a passing
// delivery is paid, and a failed delivery is disputed through the appeals contract.
// Secrets stay in pop/x/.keys/, which git ignores. Replies are a dry run.
//   node pop/x/run.mjs
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { NETS, near, fmt, TGAS, freshKey, account, call, view, accountState, txLink } from "../lib/near.mjs";
import { commitmentHash, evidenceHash, policyHash } from "../appeals/lib/hash.mjs";
import { parseMention } from "./parse.mjs";
import { addEvent, createFeed } from "./events.mjs";
import { FUND_NEAR, fundJob } from "./fund.mjs";
import { replyText } from "./reply.mjs";
import { renderThread } from "./thread.mjs";
import { INK, CLAY, askOf, paintWork, BAD_MAP } from "./agents.mjs";

if (process.argv.includes("mainnet") || process.env.POP_NETWORK === "mainnet") {
  console.error("X hire signs on testnet only");
  process.exit(2);
}

const net = "testnet";
const PUBLISHED = "dev-20261111042208-14186395012630.testnet";
const LOGO = "@payonproof make me a logo, 0.2 NEAR";
const MAP = "@payonproof a 3 room map, 0.2 NEAR";
const logoJob = parseMention(LOGO);
const mapJob = parseMention(MAP);
if (logoJob.budgetNear !== 0.2 || mapJob.budgetNear !== 0.2) throw new Error("this run posts 0.2 NEAR jobs");
const BUDGET = near(0.2);
const FUND = near(Number(FUND_NEAR));
const WASM = fileURLToPath(new URL("../appeals/contract/target/wasm32-unknown-unknown/release/pay_on_proof_appeals.wasm", import.meta.url));
const STATE = fileURLToPath(new URL("./.keys/state.json", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../../public/x/", import.meta.url));
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function load() {
  if (!fs.existsSync(STATE)) return { done: {}, txs: {}, posts: [], feed: null, jobs: {}, salts: {}, panels: {} };
  return JSON.parse(fs.readFileSync(STATE, "utf8"));
}
let state = load();
function save() {
  fs.mkdirSync(new URL("./.keys/", import.meta.url), { recursive: true, mode: 0o700 });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2), { mode: 0o600 });
}
function publish() {
  fs.mkdirSync(PUBLIC, { recursive: true });
  if (state.feed) {
    const body = JSON.stringify(state.feed, null, 2) + "\n";
    fs.writeFileSync(fileURLToPath(new URL("./events.json", import.meta.url)), body);
    fs.writeFileSync(PUBLIC + "/events.json", body);
  }
  fs.writeFileSync(PUBLIC + "/thread.html", renderThread(state.posts));
}
function say(step, event) {
  const text = replyText(step);
  state.posts.push({ who: "bot", text, image: step.image || null });
  if (event) addEvent(state.feed, event);
  save();
  publish();
  console.log(text);
}
function person(text) {
  state.posts.push({ who: "you", text });
  save();
  publish();
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
const accOf = (name) => account(net, state.accounts[name].accountId, state.accounts[name].secretKey);
async function bal(id) {
  const st = await accountState(net, id);
  return st ? BigInt(st.amount) : 0n;
}
async function waitFunded(id) {
  for (let i = 0; i < 40; i++) {
    if (await bal(id) > 0n) return;
    await sleep(1000);
  }
  throw new Error("account was not funded: " + id);
}
function ref(r, sender) { return { hash: r.tx, sender }; }
async function must(fn, label) {
  let last;
  for (let i = 0; i < 4; i++) {
    const r = await fn();
    const later = (r.laterFailures || []).join(" | ");
    if (!r.failed && !later) { console.log(`ok  ${label}  ${txLink(net, r.tx)}`); return r; }
    last = r.failed || later;
    if (!/timeout|429|503|fetch|ECONN|socket|rate|Unknown/i.test(String(last)) || r.tx) break;
    console.log(`retry ${label}: ${String(last).slice(0, 180)}`);
    await sleep(2000 * (i + 1));
  }
  throw new Error(`${label}: ${last}`);
}
async function sendActions(acc, receiverId, actionList) {
  let out;
  try {
    out = await acc.signAndSendTransaction({ receiverId, actions: actionList, waitUntil: "FINAL", throwOnFailure: false });
  } catch (e) {
    const msg = String(e?.message || e);
    const hash = e?.context?.transactionHash || msg.match(/[1-9A-HJ-NP-Za-km-z]{43,44}/)?.[0] || null;
    return { result: null, tx: hash, logs: [], failed: msg.slice(0, 500), laterFailures: [] };
  }
  const logs = (out.receipts_outcome || []).flatMap((r) => r.outcome.logs || []);
  const first = out.receipts_outcome?.[0]?.outcome.status;
  const later = (out.receipts_outcome || []).slice(1).map((r) => r.outcome.status).filter((s) => s && s.Failure).map((s) => JSON.stringify(s.Failure).slice(0, 300));
  const txStatus = out.transaction_outcome?.outcome?.status;
  let result = null;
  if (first && first.SuccessValue) {
    try { result = JSON.parse(Buffer.from(first.SuccessValue, "base64").toString()); } catch { /* not JSON */ }
  }
  const failed = first?.Failure ? JSON.stringify(first.Failure).slice(0, 500) : (txStatus?.Failure ? JSON.stringify(txStatus.Failure).slice(0, 500) : null);
  return { result, tx: out.transaction.hash, logs, failed, laterFailures: later };
}
async function faucet(prefix) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const k = freshKey();
    const id = `${prefix}-${Date.now().toString(36)}.testnet`;
    const r = await fetch(NETS.testnet.faucet, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ newAccountId: id, newAccountPublicKey: k.publicKey }) });
    const text = await r.text();
    if (r.ok) {
      console.log("faucet", id);
      await sleep(2500);
      await waitFunded(id);
      return { accountId: id, publicKey: k.publicKey, secretKey: k.secretKey };
    }
    console.log(`faucet ${r.status} ${text.slice(0, 160)}`);
    await sleep(4000 * (attempt + 1));
  }
  throw new Error("faucet failed for " + prefix);
}
async function ensure(id, min) {
  const have = await bal(id);
  if (have >= min) return;
  const out = await accOf("relayer").transfer({ receiverId: id, amount: min - have + near(0.2) });
  console.log("top up", id, txLink(net, out.transaction.hash));
  await sleep(2000);
}
function money(y) { return fmt(y).replace(/0+$/, "").replace(/\.$/, ""); }
function yocto(v) { return BigInt(v); }

const C = () => state.accounts.appeals.accountId;
const warden = () => accOf("warden");

if (!state.done.accounts) {
  state.accounts = {};
  for (const [name, prefix] of [["relayer", "xrel"], ["appeals", "xapp"], ["jury", "xjur"], ["ink", "xink"], ["clay", "xclay"]]) {
    state.accounts[name] = await faucet(prefix);
    save();
  }
  state.accounts.requester = freshKey();
  const w = freshKey();
  state.accounts.warden = { accountId: state.accounts.appeals.accountId, publicKey: w.publicKey, secretKey: w.secretKey };
  state.done.accounts = true;
  save();
}

if (!state.done.requester) {
  const id = state.accounts.requester.accountId;
  if (await bal(id) < near(0.7)) {
    const out = await accOf("relayer").transfer({ receiverId: id, amount: near(0.8) });
    console.log("create requester", id, txLink(net, out.transaction.hash));
    await waitFunded(id);
  }
  state.done.requester = true;
  save();
}

if (!state.done.jury) {
  await ensure(state.accounts.jury.accountId, near(6));
  const code = await rpc("query", { request_type: "view_code", finality: "final", account_id: PUBLISHED });
  const wasm = Buffer.from(code.code_base64, "base64");
  console.log(`published jury wasm ${wasm.length} bytes`);
  const juryAcc = accOf("jury");
  state.accounts.jurors = state.accounts.jurors || [];
  while (state.accounts.jurors.length < 6) {
    const i = state.accounts.jurors.length;
    const k = freshKey();
    const out = await juryAcc.transfer({ receiverId: k.accountId, amount: near(0.45) });
    console.log(`juror ${i}`, k.accountId, txLink(net, out.transaction.hash));
    await waitFunded(k.accountId);
    state.accounts.jurors.push({ accountId: k.accountId, publicKey: k.publicKey, secretKey: k.secretKey });
    save();
  }
  let jurors = null;
  try { jurors = await view(net, state.accounts.jury.accountId, "get_jurors"); } catch { /* not initialised */ }
  if (!jurors) {
    const deployed = await juryAcc.deployContract(new Uint8Array(wasm));
    console.log("deploy jury", txLink(net, deployed.transaction.hash));
    const ids = state.accounts.jurors.map((j) => j.accountId);
    await must(() => call(juryAcc, state.accounts.jury.accountId, "new", { jurors: ids }), "jury new");
  }
  const keys = await juryAcc.getAccessKeyList();
  if (keys.keys.some((k) => k.public_key === state.accounts.jury.publicKey && k.access_key.permission === "FullAccess")) {
    const locked = await juryAcc.deleteKey(state.accounts.jury.publicKey);
    state.txs.lockJury = { hash: locked.transaction.hash, sender: state.accounts.jury.accountId };
    console.log("lock jury", txLink(net, locked.transaction.hash));
  }
  if (!state.txs.lockJury) throw new Error("jury lock transaction was not recorded");
  state.done.jury = true;
  save();
}

if (!state.done.appeals) {
  if (!fs.existsSync(WASM)) throw new Error("missing appeals wasm; build pop/appeals/contract first");
  const wasm = fs.readFileSync(WASM);
  await ensure(C(), BigInt(wasm.length) * 10n ** 19n + near(1));
  const appealsAcc = accOf("appeals");
  let cfg = null;
  try { cfg = await view(net, C(), "get_config"); } catch { /* not initialised */ }
  if (!cfg) {
    const deployed = await appealsAcc.deployContract(new Uint8Array(wasm));
    console.log("deploy appeals", txLink(net, deployed.transaction.hash));
    await must(() => call(appealsAcc, C(), "new", { buyer: state.accounts.requester.accountId, cap: near(1).toString(), jury: state.accounts.jury.accountId }), "appeals new");
  }
  const keys = await appealsAcc.getAccessKeyList();
  if (!keys.keys.some((k) => k.public_key === state.accounts.warden.publicKey)) {
    const added = await appealsAcc.addFunctionCallAccessKey({
      publicKey: state.accounts.warden.publicKey,
      contractId: C(),
      methodNames: ["post_job", "hire", "cancel_job"],
      allowance: near(1),
    });
    console.log("warden key", txLink(net, added.transaction.hash));
  }
  if (!state.done.sweep) {
    const st = await accountState(net, C());
    const proto = await rpc("EXPERIMENTAL_protocol_config", { finality: "final" });
    const byte = BigInt(proto.runtime_config.storage_amount_per_byte);
    const keep = BigInt(st.storage_usage) * byte + near(0.08);
    const have = BigInt(st.amount);
    if (have > keep + near(0.01)) {
      const out = await appealsAcc.transfer({ receiverId: state.accounts.relayer.accountId, amount: have - keep });
      state.txs.sweep = { hash: out.transaction.hash, sender: C() };
      console.log("sweep", txLink(net, out.transaction.hash));
      await sleep(2000);
    }
    state.done.sweep = true;
    save();
  }
  const fresh = await appealsAcc.getAccessKeyList();
  if (fresh.keys.some((k) => k.public_key === state.accounts.appeals.publicKey && k.access_key.permission === "FullAccess")) {
    const locked = await appealsAcc.deleteKey(state.accounts.appeals.publicKey);
    state.txs.lockAppeals = { hash: locked.transaction.hash, sender: C() };
    console.log("lock appeals", txLink(net, locked.transaction.hash));
  }
  if (!state.txs.lockAppeals) throw new Error("appeals lock transaction was not recorded");
  state.feed = state.feed || createFeed(C());
  state.done.appeals = true;
  save();
}

if (!state.done.saidLogo) {
  person(LOGO);
  state.done.saidLogo = true;
  save();
}

const specOf = (job) => JSON.stringify(job.spec);

if (!state.done.refused) {
  // This wasm links log_utf8 and not panic_utf8, so a require! failure is an unreachable trap
  // with no message. The proof is that the job count does not move, and the same call works after funding.
  const before = Number((await view(net, C(), "get_config")).jobs);
  const r = await call(warden(), C(), "post_job", {
    kind: logoJob.kind, title: logoJob.title, spec: specOf(logoJob), budget: BUDGET.toString(), window_mins: 180,
  }, { gas: 50n * TGAS });
  const after = Number((await view(net, C(), "get_config")).jobs);
  const trapped = !!r.failed && /unreachable|balance too low|FunctionCallError/.test(String(r.failed));
  if (!trapped || !r.tx || after !== before) throw new Error("expected the unpaid post to fail, got " + JSON.stringify({ failed: r.failed, tx: r.tx, before, after }).slice(0, 500));
  state.txs.refused = ref(r, C());
  say({ kind: "refused", reason: "the call failed and no job was created", txUrl: txLink(net, r.tx) });
  state.done.refused = true;
  save();
}

if (!state.done.funded) {
  const before = await bal(state.accounts.requester.accountId);
  const r = await must(() => fundJob({
    net, requester: state.accounts.requester, contractId: C(), amount: FUND, send: sendActions,
  }), "fund");
  const after = await bal(state.accounts.requester.accountId);
  const paid = before - after;
  if (paid < FUND || paid > FUND + near(0.02)) throw new Error(`requester paid ${paid}, expected ${FUND}`);
  state.txs.fund = ref(r, state.accounts.requester.accountId);
  say({ kind: "funded", amount: FUND_NEAR, txUrl: txLink(net, r.tx) });
  state.done.funded = true;
  save();
}

async function openJob(slot, parsed) {
  const job = state.jobs[slot] || (state.jobs[slot] = {});
  if (job.id === undefined) {
    const r = await must(() => call(warden(), C(), "post_job", {
      kind: parsed.kind, title: parsed.title, spec: specOf(parsed), budget: BUDGET.toString(), window_mins: 180,
    }, { gas: 100n * TGAS }), "post " + slot);
    job.id = r.result;
    job.open = ref(r, C());
    say({
      kind: "opened", jobId: job.id, title: parsed.title, kindName: parsed.kind, budget: parsed.budgetNear,
      fundUrl: `index.html?job=${job.id}`, txUrl: txLink(net, r.tx),
    }, {
      type: "job_opened", job_id: job.id, tx: r.tx, tx_url: txLink(net, r.tx), account: state.accounts.requester.accountId,
      data: { mention: parsed.raw, kind: parsed.kind, title: parsed.title, spec: parsed.spec, budget_yocto: BUDGET.toString(), fund_tx: state.txs.fund.hash, requester: state.accounts.requester.accountId },
    });
    save();
  }
  return job;
}

async function bid(slot, agentName, agent) {
  const job = state.jobs[slot];
  job.bids = job.bids || {};
  if (job.bids[agentName]) return job.bids[agentName];
  const ask = askOf(agent, BUDGET);
  const who = accOf(agentName);
  const r = await must(() => call(who, C(), "bid", { job_id: job.id, ask: ask.toString() }, { gas: 20n * TGAS }), `bid ${agentName} ${slot}`);
  const row = { index: r.result, ask: ask.toString(), tx: ref(r, state.accounts[agentName].accountId) };
  job.bids[agentName] = row;
  say({ kind: "bid", name: agent.name, ask: money(ask), jobId: job.id, txUrl: txLink(net, r.tx) }, {
    type: "bid", job_id: job.id, tx: r.tx, tx_url: txLink(net, r.tx), account: state.accounts[agentName].accountId,
    data: { name: agent.name, ask_yocto: ask.toString(), bid: r.result },
  });
  save();
  return row;
}

if (!state.done.logo) {
  const job = await openJob("logo", logoJob);
  await bid("logo", "ink", INK);
  await bid("logo", "clay", CLAY);
  if (!job.sample) {
    let found = null;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const inkData = JSON.stringify(paintWork(seed, false));
      const clayData = JSON.stringify(paintWork(seed + 500, true));
      const ip = await view(net, C(), "preview_check", { job_id: job.id, data: inkData });
      const cp = await view(net, C(), "preview_check", { job_id: job.id, data: clayData });
      if (ip.pass && !cp.pass) found = { inkData, clayData, ink: ip, clay: cp };
    }
    if (!found) throw new Error("no paint sample pair");
    job.sample = found;
    save();
  }
  if (!job.hire) {
    const r = await must(() => call(warden(), C(), "hire", { job_id: job.id, bid: job.bids.ink.index }, { gas: 80n * TGAS }), "hire ink");
    job.hire = ref(r, C());
    say({
      kind: "hired", name: "Ink", jobId: job.id, ask: money(job.bids.ink.ask),
      note: "Ink's sample passed preview. Clay's sample failed preview.", txUrl: txLink(net, r.tx),
    });
    save();
  }
  if (!job.deliver) {
    const r = await must(() => call(accOf("ink"), C(), "deliver", { job_id: job.id, data: job.sample.inkData }, { gas: 150n * TGAS }), "deliver logo");
    if (r.result !== true) throw new Error("logo deliver did not pass: " + JSON.stringify(r).slice(0, 300));
    const line = r.logs.find((l) => l.startsWith("pass job")) || "";
    const payout = r.logs.find((l) => l.startsWith("payout")) || "";
    if (!payout.includes("Sent")) {
      const rec = await view(net, C(), "get_receipt", { receipt_id: Number(line.match(/receipt (\d+)/)?.[1] || 0) });
      if (rec.payout !== "sent") throw new Error("payout not sent: " + payout + " " + JSON.stringify(rec.payout));
    }
    const colors = JSON.parse(job.sample.inkData);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="160" height="180" fill="${colors.floor}"/><rect x="160" width="160" height="180" fill="${colors.wall}"/></svg>\n`;
    fs.writeFileSync(PUBLIC + "/logo.svg", svg);
    job.colors = { floor: colors.floor, wall: colors.wall };
    job.deliver = ref(r, state.accounts.ink.accountId);
    job.receiptId = Number(line.match(/receipt (\d+)/)?.[1]);
    const url = txLink(net, r.tx);
    say({ kind: "delivered", name: "Ink", jobId: job.id, note: `Floor ${colors.floor}, wall ${colors.wall}. Swatch: logo.svg`, txUrl: url, image: "logo.svg" }, {
      type: "delivered", job_id: job.id, tx: r.tx, tx_url: url, account: state.accounts.ink.accountId,
      data: { colors: job.colors, swatch: "logo.svg" },
    });
    say({ kind: "checked", jobId: job.id, pass: true, reason: line.replace(/^pass job \d+ receipt \d+: /, "") || "pass", txUrl: url }, {
      type: "checked", job_id: job.id, tx: r.tx, tx_url: url, account: C(), data: { pass: true, reason: line },
    });
    say({ kind: "paid", amount: money(job.bids.ink.ask), name: "Ink", jobId: job.id, txUrl: url }, {
      type: "paid", job_id: job.id, tx: r.tx, tx_url: url, account: state.accounts.ink.accountId,
      data: { amount_yocto: job.bids.ink.ask, to: state.accounts.ink.accountId },
    });
    save();
  }
  state.done.logo = true;
  save();
}

async function panel(caseId) {
  const key = String(caseId);
  if (!state.salts[key]) {
    state.salts[key] = state.accounts.jurors.map(() => randomBytes(32).toString("hex"));
    state.panels[key] = { commits: [], audits: [], reveals: [] };
    save();
  }
  const J = state.accounts.jury.accountId;
  const salts = state.salts[key];
  const rec = state.panels[key];
  const probs = [2000, 8000];
  const cse0 = await view(net, J, "get_case", { case_id: caseId });
  rec.rationales = rec.rationales || [];
  for (let i = 0; i < 6; i++) {
    if (cse0.jurors[i].committed && rec.rationales[i]) continue;
    if (cse0.jurors[i].committed) throw new Error("juror " + i + " committed without a saved rationale");
    const juror = state.accounts.jurors[i];
    const rationaleHash = rec.rationales[i] || randomBytes(32).toString("hex");
    rec.rationales[i] = rationaleHash;
    save();
    const hash = commitmentHash({
      contractId: J, caseId, evidenceHash: cse0.evidence_hash, policyHash: cse0.policy_hash,
      juror: juror.accountId, probs, rationaleHash, salt: salts[i],
    });
    const r = await must(() => call(account(net, juror.accountId, juror.secretKey), J, "commit", { case_id: caseId, hash }, { gas: 40n * TGAS }), `commit ${i}`);
    rec.commits[i] = r.tx;
    save();
  }
  for (let i = 0; i < 6; i++) {
    const now = await view(net, J, "get_case", { case_id: caseId });
    if (now.jurors[i].audit_posted) continue;
    if (now.phase !== "Discuss") throw new Error("phase " + now.phase + ", expected Discuss");
    const juror = state.accounts.jurors[i];
    const r = await must(() => call(account(net, juror.accountId, juror.secretKey), J, "final_read", { case_id: caseId, probs }, { gas: 40n * TGAS }), `audit ${i}`);
    rec.audits[i] = r.tx;
    save();
  }
  for (let i = 0; i < 6; i++) {
    const now = await view(net, J, "get_case", { case_id: caseId });
    if (now.jurors[i].first) continue;
    if (now.phase !== "Reveal") throw new Error("phase " + now.phase + ", expected Reveal");
    const juror = state.accounts.jurors[i];
    const rationaleHash = rec.rationales[i];
    const r = await must(() => call(account(net, juror.accountId, juror.secretKey), J, "reveal", {
      case_id: caseId, probs, rationale_hash: rationaleHash, salt: salts[i],
    }, { gas: 80n * TGAS }), `reveal ${i}`);
    rec.reveals[i] = r.tx;
    save();
  }
  const done = await view(net, J, "get_case", { case_id: caseId });
  if (done.outcome !== "Decided" || done.ruling !== 1) throw new Error("ruling " + done.outcome + " " + done.ruling);
  return done;
}

if (!state.done.map) {
  if (!state.done.saidMap) { person(MAP); state.done.saidMap = true; save(); }
  const job = await openJob("map", mapJob);
  await bid("map", "ink", INK);
  await bid("map", "clay", CLAY);
  if (!job.hire) {
    const inkAsk = yocto(job.bids.ink.ask);
    const clayAsk = yocto(job.bids.clay.ask);
    if (!(clayAsk < inkAsk)) throw new Error("Clay should be the lower ask");
    const r = await must(() => call(warden(), C(), "hire", { job_id: job.id, bid: job.bids.clay.index }, { gas: 80n * TGAS }), "hire clay");
    job.hire = ref(r, C());
    say({ kind: "hired", name: "Clay", jobId: job.id, ask: money(clayAsk), note: "Lower ask.", txUrl: txLink(net, r.tx) });
    save();
  }
  if (!job.deliver) {
    const data = JSON.stringify(BAD_MAP);
    const preview = await view(net, C(), "preview_check", { job_id: job.id, data });
    if (preview.pass || preview.reason !== "room cut off") throw new Error("preview " + JSON.stringify(preview));
    const before = await bal(state.accounts.clay.accountId);
    const r = await must(() => call(accOf("clay"), C(), "deliver", { job_id: job.id, data }, { gas: 80n * TGAS }), "deliver map");
    if (r.result !== false) throw new Error("map deliver should fail");
    if (await bal(state.accounts.clay.accountId) >= before) throw new Error("failed delivery paid the worker");
    const line = r.logs.find((l) => l.startsWith("fail job")) || "";
    job.deliver = ref(r, state.accounts.clay.accountId);
    job.receiptId = Number(line.match(/receipt (\d+)/)?.[1]);
    const url = txLink(net, r.tx);
    say({ kind: "delivered", name: "Clay", jobId: job.id, note: "Map JSON.", txUrl: url }, {
      type: "delivered", job_id: job.id, tx: r.tx, tx_url: url, account: state.accounts.clay.accountId, data: { pass: false },
    });
    say({ kind: "checked", jobId: job.id, pass: false, reason: "room cut off", txUrl: url }, {
      type: "checked", job_id: job.id, tx: r.tx, tx_url: url, account: C(), data: { pass: false, reason: "room cut off" },
    });
    save();
  }
  if (job.caseId === undefined) {
    await ensure(state.accounts.clay.accountId, near(0.4));
    let onChain = await view(net, C(), "get_job", { job_id: job.id });
    let r = { tx: job.dispute?.hash };
    if (onChain.state === "appealable") {
      r = await must(() => call(accOf("clay"), C(), "dispute", { job_id: job.id }, { gas: 250n * TGAS }), "dispute");
      onChain = await view(net, C(), "get_job", { job_id: job.id });
    }
    for (let i = 0; i < 6 && onChain.state === "opening"; i++) { await sleep(2000); onChain = await view(net, C(), "get_job", { job_id: job.id }); }
    if (onChain.state !== "disputed") throw new Error("dispute state " + onChain.state);
    const d = await view(net, C(), "get_dispute", { dispute_id: onChain.dispute });
    const receipt = await view(net, C(), "get_receipt", { receipt_id: d.receipt });
    const local = evidenceHash({
      jobId: onChain.id, receiptId: receipt.id, kind: receipt.kind, worker: receipt.seller, buyer: state.accounts.requester.accountId,
      price: receipt.price, spec: onChain.spec, reason: receipt.reason, data: receipt.data,
    });
    if (d.evidence_hash !== local) throw new Error("evidence hash mismatch");
    if (policyHash() !== (await view(net, state.accounts.jury.accountId, "get_case", { case_id: d.case_id })).policy_hash) throw new Error("policy hash mismatch");
    job.dispute = ref(r, state.accounts.clay.accountId);
    job.caseId = d.case_id;
    job.disputeId = onChain.dispute;
    say({ kind: "disputed", name: "Clay", jobId: job.id, caseId: d.case_id, txUrl: txLink(net, r.tx) }, {
      type: "disputed", job_id: job.id, tx: r.tx, tx_url: txLink(net, r.tx), account: state.accounts.clay.accountId,
      data: { case_id: d.case_id, evidence_hash: local },
    });
    save();
  }
  if (!job.ruled) {
    await panel(job.caseId);
    job.ruled = true;
    save();
  }
  if (!job.settle) {
    const before = await bal(state.accounts.requester.accountId);
    const r = await must(() => call(accOf("relayer"), C(), "settle", { job_id: job.id }, { gas: 300n * TGAS }), "settle");
    const d = await view(net, C(), "get_dispute", { dispute_id: job.disputeId });
    if (d.status !== "refunded") throw new Error("dispute status " + d.status + " " + r.logs.join(" | "));
    const after = await bal(state.accounts.requester.accountId);
    if (after - before !== yocto(job.bids.clay.ask)) throw new Error(`refund ${after - before}`);
    job.settle = ref(r, state.accounts.relayer.accountId);
    const url = txLink(net, r.tx);
    say({ kind: "ruled", side: "buyer", jobId: job.id, detail: `Refunded ${money(job.bids.clay.ask)} NEAR to the requester.`, txUrl: url }, {
      type: "ruled", job_id: job.id, tx: r.tx, tx_url: url, account: state.accounts.requester.accountId,
      data: { side: "buyer", amount_yocto: job.bids.clay.ask, status: "refunded" },
    });
    save();
  }
  state.done.map = true;
  save();
}

const run = {
  network: "testnet",
  publishedJury: PUBLISHED,
  contract: C(),
  jury: state.accounts.jury.accountId,
  requester: state.accounts.requester.accountId,
  relayer: state.accounts.relayer.accountId,
  ink: state.accounts.ink.accountId,
  clay: state.accounts.clay.accountId,
  wardenPublicKey: state.accounts.warden.publicKey,
  mentions: [LOGO, MAP],
  fundNear: FUND_NEAR,
  fundYocto: FUND.toString(),
  colors: state.jobs.logo.colors,
  jobs: {
    logo: { id: state.jobs.logo.id, receiptId: state.jobs.logo.receiptId, ask: state.jobs.logo.bids.ink.ask },
    map: { id: state.jobs.map.id, receiptId: state.jobs.map.receiptId, ask: state.jobs.map.bids.clay.ask, caseId: state.jobs.map.caseId, disputeId: state.jobs.map.disputeId },
  },
  txs: {
    refused: state.txs.refused,
    fund: state.txs.fund,
    lockJury: state.txs.lockJury,
    lockAppeals: state.txs.lockAppeals,
    openLogo: state.jobs.logo.open,
    bidInkLogo: state.jobs.logo.bids.ink.tx,
    bidClayLogo: state.jobs.logo.bids.clay.tx,
    hireLogo: state.jobs.logo.hire,
    deliverLogo: state.jobs.logo.deliver,
    openMap: state.jobs.map.open,
    bidInkMap: state.jobs.map.bids.ink.tx,
    bidClayMap: state.jobs.map.bids.clay.tx,
    hireMap: state.jobs.map.hire,
    deliverMap: state.jobs.map.deliver,
    dispute: state.jobs.map.dispute,
    settle: state.jobs.map.settle,
  },
};
fs.writeFileSync(fileURLToPath(new URL("./run.json", import.meta.url)), JSON.stringify(run, null, 2) + "\n");
fs.writeFileSync(PUBLIC + "/run.json", JSON.stringify(run, null, 2) + "\n");
publish();
console.log("contract", C());
console.log("fund", txLink(net, state.txs.fund.hash));
console.log("paid", txLink(net, state.jobs.logo.deliver.hash));
console.log("ruled", txLink(net, state.jobs.map.settle.hash));
