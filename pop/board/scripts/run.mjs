#!/usr/bin/env node
// Testnet only. Deploys the credit contract and the bounty pool, runs the score gate and a
// paid delivery, and writes pop/board/run.json. Secrets stay in pop/board/.keys/.
// Refuses mainnet. Requires `npm ci` in pop/ so near-api-js is installed.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NETS, near, TGAS, freshKey, account, call, view, accountState, txLink } from "../../lib/near.mjs";
import { eventsFromAppeals, eventsFromHire } from "../public/events.mjs";
import { FORMULA, limitsFromScore, limitsOf, recordsFromEvents, scoreOf } from "../public/score.mjs";

if (process.argv.includes("mainnet") || process.env.POP_NETWORK === "mainnet") {
  console.error("refusing mainnet");
  process.exit(2);
}

const HIRE = "v2-contract-mwfheysi.testnet";
const APPEALS = "popa-mwfhb3x4.testnet";
const FACTORY = "sputnikv2.testnet";
const SPEC = JSON.stringify({ size: 2, lo: 4, hi: 8 });
const GOOD = JSON.stringify({ critters: [{ name: "A", threat: 2 }, { name: "B", threat: 3 }] });
const BAD = JSON.stringify({ critters: [{ name: "A", threat: 5 }, { name: "B", threat: 5 }] });
const KEYS = new URL("../.keys/testnet.json", import.meta.url);
const SOURCES = new URL("../public/sources.json", import.meta.url);
const RUN = new URL("../run.json", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function writeRun() {
  fs.writeFileSync(RUN, JSON.stringify(run, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n");
}

function loadKeys() {
  return fs.existsSync(KEYS) ? JSON.parse(fs.readFileSync(KEYS, "utf8")) : {};
}
function saveKeys(all) {
  fs.mkdirSync(path.dirname(KEYS.pathname), { recursive: true, mode: 0o700 });
  fs.writeFileSync(KEYS, JSON.stringify(all, null, 2), { mode: 0o600 });
}
function signer(entry) { return account("testnet", entry.accountId, entry.secretKey); }

async function faucet(prefix) {
  const all = loadKeys();
  if (all[prefix]) return all[prefix];
  const k = freshKey();
  const id = `${prefix}-${Date.now().toString(36)}.testnet`;
  const r = await fetch(NETS.testnet.faucet, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newAccountId: id, newAccountPublicKey: k.publicKey }),
  });
  if (!r.ok) throw new Error(`faucet ${prefix} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const entry = { accountId: id, publicKey: k.publicKey, secretKey: k.secretKey };
  all[prefix] = entry;
  saveKeys(all);
  console.log("faucet", prefix, id);
  for (let i = 0; i < 12; i++) {
    await sleep(2000);
    if (await accountState("testnet", id)) return entry;
  }
  throw new Error(`faucet account ${id} did not appear`);
}

function build(dir) {
  execSync("cargo build --target wasm32-unknown-unknown --release", {
    cwd: dir, stdio: "inherit", env: { ...process.env, RUSTFLAGS: "--cfg near" },
  });
}

async function hasFullAccess(entry) {
  const acc = signer(entry);
  const list = await acc.getAccessKeyList();
  return list.keys.some((k) => k.public_key === entry.publicKey && k.access_key.permission === "FullAccess");
}

async function deployIfOpen(entry, wasm) {
  if (!(await hasFullAccess(entry))) { console.log("locked, skip deploy", entry.accountId); return null; }
  const code = fs.readFileSync(wasm);
  const out = await signer(entry).deployContract(new Uint8Array(code));
  console.log("deploy", entry.accountId, code.length, out.transaction.hash);
  return out.transaction.hash;
}

function must(out, label) {
  if (out.failed) throw new Error(`${label}: ${out.failed}`);
  return out;
}

async function paged(contract, method) {
  const out = [];
  for (let from = 0; ; from += 50) {
    const page = await view("testnet", contract, method, { from, limit: 50 });
    out.push(...page);
    if (page.length < 50) return out;
  }
}

const run = { network: "testnet", recordedAt: new Date().toISOString(), txs: {}, notes: [] };

async function main() {
  const credit = await faucet("credit");
  const novice = await faucet("novice");
  const pool = await faucet("pool");
  const funderA = await faucet("funder-a");
  const funderB = await faucet("funder-b");
  const funderC = await faucet("funder-c");
  const worker = await faucet("worker");
  run.accounts = {
    credit: credit.accountId, novice: novice.accountId, pool: pool.accountId,
    funderA: funderA.accountId, funderB: funderB.accountId, funderC: funderC.accountId, worker: worker.accountId,
  };
  run.publicKeys = {
    credit: credit.publicKey, novice: novice.publicKey, pool: pool.publicKey,
    funderA: funderA.publicKey, funderB: funderB.publicKey, funderC: funderC.publicKey, worker: worker.publicKey,
  };

  const creditDir = new URL("../credit/contract/", import.meta.url).pathname;
  const poolDir = new URL("../pool/contract/", import.meta.url).pathname;
  build(creditDir);
  build(poolDir);
  const creditWasm = path.join(creditDir, "target/wasm32-unknown-unknown/release/pop_board_credit.wasm");
  const poolWasm = path.join(poolDir, "target/wasm32-unknown-unknown/release/pop_board_pool.wasm");

  run.txs.deployCredit = await deployIfOpen(credit, creditWasm);
  let cfg = null;
  try { cfg = await view("testnet", credit.accountId, "get_config"); } catch { /* not inited */ }
  if (!cfg) {
    const out = must(await call(signer(credit), credit.accountId, "new", {}, { gas: 50n * TGAS }), "credit new");
    run.txs.initCredit = out.tx;
    cfg = await view("testnet", credit.accountId, "get_config");
  }
  if (cfg.hire !== HIRE || cfg.appeals !== APPEALS) throw new Error(`credit sources ${cfg.hire} ${cfg.appeals}`);

  const hireCfg = await view("testnet", HIRE, "get_config");
  const appealCfg = await view("testnet", APPEALS, "get_config");
  run.txs.pullHire = [];
  for (let from = 0; from < Math.max(Number(hireCfg.receipts), 1); from += 50) {
    const out = must(await call(signer(novice), credit.accountId, "pull_hire", { from }, { gas: 250n * TGAS }), "pull_hire");
    run.txs.pullHire.push(out.tx);
    if (Number(hireCfg.receipts) === 0) break;
  }
  run.txs.pullAppeals = [];
  for (let from = 0; from < Math.max(Number(appealCfg.receipts), 1); from += 50) {
    const out = must(await call(signer(novice), credit.accountId, "pull_appeals", { from }, { gas: 250n * TGAS }), "pull_appeals");
    run.txs.pullAppeals.push(out.tx);
    if (Number(appealCfg.receipts) === 0) break;
  }
  run.txs.beginDisputes = must(await call(signer(novice), credit.accountId, "begin_disputes", {}, { gas: 50n * TGAS }), "begin_disputes").tx;
  run.txs.pullDispute = [];
  for (let id = 0; id < Number(appealCfg.disputes); id++) {
    const out = must(await call(signer(novice), credit.accountId, "pull_dispute", { id }, { gas: 200n * TGAS }), "pull_dispute");
    run.txs.pullDispute.push(out.tx);
  }

  const jobs = await paged(HIRE, "get_jobs");
  const subs = await paged(HIRE, "get_subs");
  const hireReceipts = await paged(HIRE, "get_receipts");
  const appealReceipts = await paged(APPEALS, "get_receipts");
  const disputes = [];
  for (let i = 0; i < Number(appealCfg.disputes); i++) disputes.push(await view("testnet", APPEALS, "get_dispute", { dispute_id: i }));
  const events = [
    ...eventsFromHire(jobs, subs, hireReceipts, ""),
    ...eventsFromAppeals([], appealReceipts, disputes, ""),
  ];
  const want = recordsFromEvents(events);
  const agents = await view("testnet", credit.accountId, "get_agents");
  const byAgent = new Map(agents.map((a) => [a.agent, a]));
  for (const [id, rec] of want) {
    const got = byAgent.get(id);
    if (!got) throw new Error(`missing agent ${id}`);
    const score = scoreOf(rec);
    if (Number(got.passes) !== rec.passes || Number(got.fails) !== rec.fails || Number(got.jury_wins) !== rec.juryWins || Number(got.jury_losses) !== rec.juryLosses) {
      throw new Error(`counts ${id} chain ${got.passes}/${got.fails}/${got.jury_wins}/${got.jury_losses}`);
    }
    if (BigInt(got.earned) !== rec.earned || Number(got.score) !== score) throw new Error(`score ${id} chain ${got.score} local ${score}`);
    const lim = limitsOf(rec);
    if (BigInt(got.max_budget) !== lim.maxBudget || BigInt(got.min_deposit) !== lim.minDeposit) throw new Error(`limits ${id}`);
  }
  console.log("credit rows match", want.size);

  let high = null;
  let low = null;
  for (const [id, rec] of want) {
    const score = scoreOf(rec);
    if (!high || score > high.score) high = { id, rec, score };
    if (!low || score < low.score) low = { id, rec, score };
  }
  run.scores = { novice: 0 };
  const zero = limitsFromScore(0);
  const big = zero.maxBudget + 1n;
  const over = await call(signer(novice), credit.accountId, "stake", { budget: big.toString() }, { gas: 50n * TGAS, deposit: zero.minDeposit });
  run.txs.stakeTooBig = { tx: over.tx, failed: over.failed };
  if (!over.failed || !over.failed.includes("score too low for this budget")) throw new Error(`expected score refusal, got ${over.failed}`);
  const short = await call(signer(novice), credit.accountId, "stake", { budget: zero.maxBudget.toString() }, { gas: 50n * TGAS, deposit: zero.minDeposit - 1n });
  run.txs.stakeShort = { tx: short.tx, failed: short.failed };
  if (!short.failed || !short.failed.includes("deposit too small for this score")) throw new Error(`expected deposit refusal, got ${short.failed}`);
  const okStake = must(await call(signer(novice), credit.accountId, "stake", { budget: zero.maxBudget.toString() }, { gas: 50n * TGAS, deposit: zero.minDeposit }), "stake");
  run.txs.stake = okStake.tx;
  const refund = must(await call(signer(novice), credit.accountId, "refund", {}, { gas: 50n * TGAS }), "refund");
  run.txs.refund = refund.tx;
  await sleep(2000);
  const stakes = await view("testnet", credit.accountId, "get_stakes");
  if (!stakes.some((s) => s.agent === novice.accountId && s.refunded === true)) throw new Error("stake was not refunded");

  if (high) {
    const lim = limitsOf(high.rec);
    const probe = must(await call(signer(novice), credit.accountId, "probe", {
      agent: high.id, budget: lim.maxBudget.toString(), deposit: lim.minDeposit.toString(),
    }, { gas: 50n * TGAS }), "probe high");
    run.txs.probeHigh = probe.tx;
    run.scores.high = { agent: high.id, score: high.score, max: lim.maxBudget.toString(), min: lim.minDeposit.toString() };
  }
  if (low && low.score < 0) {
    const lim = limitsOf(low.rec);
    const refused = await call(signer(novice), credit.accountId, "probe", {
      agent: low.id, budget: (lim.maxBudget + 1n).toString(), deposit: lim.minDeposit.toString(),
    }, { gas: 50n * TGAS });
    run.txs.probeLowRefused = { tx: refused.tx, failed: refused.failed };
    if (!refused.failed || !refused.failed.includes("score too low for this budget")) throw new Error(`expected low refusal, got ${refused.failed}`);
    const allowed = must(await call(signer(novice), credit.accountId, "probe", {
      agent: low.id, budget: lim.maxBudget.toString(), deposit: lim.minDeposit.toString(),
    }, { gas: 50n * TGAS }), "probe low");
    run.txs.probeLow = allowed.tx;
    run.scores.low = { agent: low.id, score: low.score, max: lim.maxBudget.toString(), min: lim.minDeposit.toString() };
  }

  if (await hasFullAccess(credit)) {
    const out = await signer(credit).deleteKey(credit.publicKey);
    run.txs.lockCredit = out.transaction.hash;
    console.log("locked credit", run.txs.lockCredit);
  }

  run.txs.deployPool = await deployIfOpen(pool, poolWasm);
  let poolCfg = null;
  try { poolCfg = await view("testnet", pool.accountId, "get_config"); } catch { /* not inited */ }
  if (!poolCfg) {
    const out = must(await call(signer(pool), pool.accountId, "new", { beneficiary: funderA.accountId }, { gas: 50n * TGAS }), "pool new");
    run.txs.initPool = out.tx;
  }

  run.dao = await tryDao(funderA, funderB, pool.accountId);
  const direct = [funderB, funderC];
  if (!run.dao.funded) direct.unshift(funderA);
  run.txs.fund = [];
  for (const entry of direct) {
    const out = must(await call(signer(entry), pool.accountId, "fund", {}, { gas: 40n * TGAS, deposit: near(0.2) }), `fund ${entry.accountId}`);
    run.txs.fund.push({ account: entry.accountId, tx: out.tx });
  }
  const funders = await view("testnet", pool.accountId, "get_funders");
  if (funders.length < 2) throw new Error(`expected several funders, got ${funders.length}`);
  run.funders = funders;

  const open = must(await call(signer(funderB), pool.accountId, "open_job", {
    kind: "roster", title: "Den watch", spec: SPEC, budget: near(0.15).toString(),
  }, { gas: 80n * TGAS }), "open_job");
  run.txs.openJob = open.tx;
  const jobId = open.result;
  const take = must(await call(signer(worker), pool.accountId, "take", { job_id: jobId }, { gas: 40n * TGAS }), "take");
  run.txs.take = take.tx;
  const before = BigInt((await accountState("testnet", worker.accountId)).amount);
  const bad = await call(signer(worker), pool.accountId, "deliver", { job_id: jobId, data: BAD }, { gas: 80n * TGAS });
  run.txs.deliverFail = { tx: bad.tx, result: bad.result, failed: bad.failed };
  if (bad.failed || bad.result !== false) throw new Error(`expected a failed check, got ${bad.failed || bad.result}`);
  const good = must(await call(signer(worker), pool.accountId, "deliver", { job_id: jobId, data: GOOD }, { gas: 100n * TGAS }), "deliver pass");
  run.txs.deliverPass = good.tx;
  let paid = null;
  for (let i = 0; i < 8; i++) {
    const receipts = await view("testnet", pool.accountId, "get_receipts", { from: 0, limit: 10 });
    paid = receipts.find((r) => r.pass);
    if (paid && paid.payout === "sent") break;
    await sleep(2000);
  }
  if (!paid || paid.payout !== "sent") throw new Error(`payout ${paid && paid.payout}`);
  const after = BigInt((await accountState("testnet", worker.accountId)).amount);
  if (after < before) throw new Error("worker balance fell");
  const preview = await view("testnet", pool.accountId, "preview_check", { job_id: jobId, data: GOOD });
  if (preview.pass !== true) throw new Error(`preview ${preview.reason}`);
  run.pool = { jobId, payout: paid.payout, reason: paid.reason, workerGain: (after - before).toString() };

  if (await hasFullAccess(pool)) {
    const out = await signer(pool).deleteKey(pool.publicKey);
    run.txs.lockPool = out.transaction.hash;
    console.log("locked pool", run.txs.lockPool);
  }

  const sources = JSON.parse(fs.readFileSync(SOURCES, "utf8"));
  const test = { rpc: NETS.testnet.rpc, explorer: NETS.testnet.explorer };
  sources.credit = { ...test, contract: credit.accountId, label: "Credit score" };
  sources.pool = { ...test, contract: pool.accountId, label: "Group pool" };
  fs.writeFileSync(SOURCES, JSON.stringify(sources, null, 2) + "\n");
  run.formula = {
    pass: FORMULA.pass, fail: FORMULA.fail, juryWin: FORMULA.juryWin, juryLoss: FORMULA.juryLoss,
  };
  run.links = {
    credit: `${NETS.testnet.explorer}/address/${credit.accountId}`,
    pool: `${NETS.testnet.explorer}/address/${pool.accountId}`,
    stakeTooBig: txLink("testnet", run.txs.stakeTooBig.tx),
    stake: txLink("testnet", run.txs.stake),
    deliverFail: txLink("testnet", run.txs.deliverFail.tx),
    deliverPass: txLink("testnet", run.txs.deliverPass),
  };
  run.fullAccessStillOnChain = [
    "novice", "funder-a", "funder-b", "funder-c", "worker",
  ].map((name) => `${name} ${loadKeys()[name].accountId} ${loadKeys()[name].publicKey}`);
  run.secrets = "pop/board/.keys/testnet.json is gitignored. It holds the testnet secrets for the accounts above, including the deleted full-access secrets of the credit contract and the pool.";
  writeRun();
  console.log("wrote", RUN.pathname);
}

async function tryDao(funderA, funderB, poolId) {
  const note = { funded: false };
  try {
    const bal = BigInt((await accountState("testnet", funderA.accountId)).amount);
    if (bal < near(7.5)) {
      note.skipped = `funder A holds ${bal} yocto, under 7.5 NEAR`;
      return note;
    }
    const name = `pb${Date.now().toString(36)}`;
    const policy = {
      roles: [{
        name: "council",
        kind: { Group: [funderA.accountId, funderB.accountId] },
        permissions: ["*:*"],
        vote_policy: {},
      }],
      default_vote_policy: { weight_kind: "RoleWeight", quorum: "0", threshold: [1, 2] },
      proposal_bond: near(0.01).toString(),
      proposal_period: "300000000000",
      bounty_bond: near(0.01).toString(),
      bounty_forgiveness_period: "86400000000000",
    };
    const args = Buffer.from(JSON.stringify({
      config: { name, purpose: "Fund a Pay on Proof pool that pays an agent only when a check passes", metadata: "" },
      policy,
    })).toString("base64");
    const created = await call(signer(funderA), FACTORY, "create", { name, args }, { gas: 200n * TGAS, deposit: near(6.5) });
    note.create = { tx: created.tx, failed: created.failed };
    if (created.failed) return note;
    const daoId = `${name}.${FACTORY}`;
    note.dao = daoId;
    await sleep(3000);
    const st = await accountState("testnet", daoId);
    const liquid = BigInt(st.amount) - BigInt(st.storage_usage) * 10n ** 19n;
    note.liquid = liquid.toString();
    if (liquid < near(0.4)) {
      const top = await signer(funderA).transfer({ receiverId: daoId, amount: near(0.5) });
      note.topUp = top.transaction.hash;
    }
    const proposal = await call(signer(funderA), daoId, "add_proposal", {
      proposal: {
        description: "Fund the Pay on Proof pool",
        kind: {
          FunctionCall: {
            receiver_id: poolId,
            actions: [{
              method_name: "fund",
              args: Buffer.from("{}").toString("base64"),
              deposit: near(0.2).toString(),
              gas: "30000000000000",
            }],
          },
        },
      },
    }, { gas: 80n * TGAS, deposit: near(0.01) });
    note.proposal = { tx: proposal.tx, failed: proposal.failed, result: proposal.result };
    if (proposal.failed) return note;
    const id = Number(proposal.result ?? 0);
    // With two council members, threshold 1/2 needs both votes. Vote during the period.
    // A vote after the period marks the proposal Expired and does not pay.
    const voteB = await call(signer(funderB), daoId, "act_proposal", { id, action: "VoteApprove" }, { gas: 80n * TGAS });
    const voteA = await call(signer(funderA), daoId, "act_proposal", { id, action: "VoteApprove" }, { gas: 250n * TGAS });
    note.vote = { tx: voteA.tx, failed: voteA.failed, first: voteB.tx, firstFailed: voteB.failed };
    await sleep(3000);
    const funders = await view("testnet", poolId, "get_funders");
    note.funded = funders.some((f) => f.account === daoId);
    try { note.proposalView = await view("testnet", daoId, "get_proposal", { id }); } catch (e) { note.proposalViewError = String(e.message || e).slice(0, 200); }
    return note;
  } catch (e) {
    note.error = String(e.message || e).slice(0, 400);
    return note;
  }
}

main().catch((e) => {
  run.error = String(e.message || e).slice(0, 500);
  writeRun();
  console.error(run.error);
  process.exit(1);
});
