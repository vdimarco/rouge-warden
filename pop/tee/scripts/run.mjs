// Deploys the testnet TEE escrow, runs one passing delivery and one failing delivery, then locks the account.
// Testnet only. Refuses any other network. Keys stay in pop/tee/.keys/, which git ignores.
//
//   node pop/tee/scripts/run.mjs testnet
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { NETS, near, fmt, TGAS, freshKey, account, call, view, accountState, txLink, accountLink } from "../../lib/near.mjs";
import { sha256hex } from "../lib/message.mjs";
import { sealDelivery } from "../lib/box.mjs";

const net = process.argv[2];
if (net !== "testnet") { console.error("usage: node pop/tee/scripts/run.mjs testnet"); process.exit(2); }
const RPC = NETS.testnet.rpc;
if (!RPC.includes("testnet")) { console.error("refusing a non-testnet RPC"); process.exit(2); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEYS = path.join(ROOT, ".keys", "testnet.json");
const GUEST = path.join(ROOT, "checker", "pop-tee-checker.wasm");
const CONTRACT_WASM = path.join(ROOT, "contract", "target", "wasm32-unknown-unknown", "release", "pay_on_proof_tee.wasm");
const OUTLAYER = "outlayer.testnet";
const WARDEN_METHODS = ["post_job", "hire", "cancel_job"];
const GOOD = '{"rooms":[[0,0],[1,0],[1,1]],"links":[[[0,0],[1,0]],[[1,0],[1,1]]],"entry":[0,0],"exit":[1,1]}';
const CUT = '{"rooms":[[0,0],[1,0],[3,2]],"links":[[[0,0],[1,0]]],"entry":[0,0],"exit":[1,0]}';
const SPEC = '{"rooms":3,"cols":4,"rows":3}';

const guestBytes = fs.readFileSync(GUEST);
const WASM_HASH = sha256hex(guestBytes);
const WASM_URLS = [
  process.env.POP_TEE_WASM_URL,
  `https://raw.githubusercontent.com/vdimarco/rouge-warden/near-hackathon-tee/pop/tee/checker/pop-tee-checker.wasm`,
  `https://cdn.jsdelivr.net/gh/vdimarco/rouge-warden@near-hackathon-tee/pop/tee/checker/pop-tee-checker.wasm`,
].filter(Boolean);

function loadKeys() { return fs.existsSync(KEYS) ? JSON.parse(fs.readFileSync(KEYS, "utf8")) : {}; }
function saveKeys(all) {
  fs.mkdirSync(path.dirname(KEYS), { recursive: true, mode: 0o700 });
  fs.writeFileSync(KEYS, JSON.stringify(all, null, 2), { mode: 0o600 });
}
async function faucet(all, name) {
  if (all[name]) return all[name];
  const k = freshKey();
  const id = `${name}-${Date.now().toString(36)}.testnet`;
  const r = await fetch(NETS.testnet.faucet, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ newAccountId: id, newAccountPublicKey: k.publicKey }) });
  if (!r.ok) throw new Error(`faucet ${r.status}: ${(await r.text()).slice(0, 200)}`);
  all[name] = { accountId: id, publicKey: k.publicKey, secretKey: k.secretKey };
  saveKeys(all);
  console.log(`  ${name}: ${id}`);
  await new Promise((res) => setTimeout(res, 2500));
  return all[name];
}
const acc = (e) => account("testnet", e.accountId, e.secretKey);
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function publishedUrl() {
  for (const url of WASM_URLS) {
    try {
      const r = await fetch(url);
      if (!r.ok) { console.log(`  ${url} -> ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      const hash = sha256hex(buf);
      if (hash === WASM_HASH) { console.log(`  wasm url ${url}`); return url; }
      console.log(`  ${url} hash ${hash.slice(0, 12)} does not match`);
    } catch (e) { console.log(`  ${url} ${e.message}`); }
  }
  throw new Error("the checker wasm is not published at a URL whose bytes match the local file");
}

function buildContract() {
  const r = spawnSync("cargo", ["build", "--manifest-path", path.join(ROOT, "contract", "Cargo.toml"), "--target", "wasm32-unknown-unknown", "--release"], {
    env: { ...process.env, RUSTFLAGS: "--cfg near" }, stdio: "inherit",
  });
  if (r.status !== 0) throw new Error("contract build failed");
}

async function waitReady(id, want) {
  for (let i = 0; i < 80; i++) {
    const tee = await view("testnet", id, "get_tee");
    const cfg = await view("testnet", id, "get_config");
    if (want === "ready" && tee.ready) return tee;
    if (want === "idle" && !cfg.inflight) return { tee, cfg };
    if (tee.tee_error && !cfg.inflight) return { tee, cfg };
    await sleep(3000);
  }
  throw new Error("timed out waiting for the checker");
}

async function oneJob(keys, title, plain, pass) {
  const w = acc(keys.warden);
  const seller = acc(keys.seller);
  const id = keys.contract.accountId;
  const posted = await call(w, id, "post_job", { kind: "map", title, spec: SPEC, budget: near(0.2).toString(), window_mins: 30 }, { gas: 80n * TGAS });
  if (posted.failed) throw new Error(`post_job ${posted.failed}`);
  const job = posted.result;
  console.log(`  post_job ${job} tx ${posted.tx}`);
  const bid = await call(seller, id, "bid", { job_id: job, ask: near(0.2).toString() }, { gas: 40n * TGAS });
  if (bid.failed) throw new Error(`bid ${bid.failed}`);
  const hired = await call(w, id, "hire", { job_id: job, bid: bid.result }, { gas: 40n * TGAS });
  if (hired.failed) throw new Error(`hire ${hired.failed}`);
  const tee = await view("testnet", id, "get_tee");
  const box = sealDelivery(tee.box_pk, plain);
  const before = await accountState("testnet", keys.seller.accountId);
  const delivered = await call(seller, id, "deliver", { job_id: job, box_b64: box }, { gas: 300n * TGAS, deposit: near(0.05) });
  console.log(`  deliver job ${job} tx ${delivered.tx} ${txLink("testnet", delivered.tx)}`);
  if (delivered.failed) throw new Error(`deliver ${delivered.failed}`);
  let settled = null;
  for (let i = 0; i < 80; i++) {
    const j = await view("testnet", id, "get_job", { job_id: job });
    const cfg = await view("testnet", id, "get_config");
    if (!j.awaiting && !cfg.inflight) { settled = { job: j, cfg }; break; }
    await sleep(3000);
  }
  if (!settled) throw new Error(`job ${job} still waiting`);
  if (settled.cfg.tee_error) throw new Error(`checker: ${settled.cfg.tee_error}`);
  const receipts = await view("testnet", id, "get_receipts", { from: 0, limit: 20 });
  const receipt = receipts.filter((r) => r.job === job).at(-1);
  if (!receipt || receipt.pass !== pass) throw new Error(`job ${job} receipt ${JSON.stringify(receipt)}`);
  if (pass) {
    for (let i = 0; i < 20; i++) {
      const again = (await view("testnet", id, "get_receipts", { from: 0, limit: 20 })).find((r) => r.id === receipt.id);
      if (again.payout === "sent") break;
      if (again.payout === "failed") throw new Error("payout failed");
      await sleep(2000);
    }
    const after = await accountState("testnet", keys.seller.accountId);
    console.log(`  seller balance ${fmt(before.amount)} -> ${fmt(after.amount)} NEAR`);
  } else {
    console.log(`  fail receipt ${receipt.id}: ${receipt.reason}`);
  }
  return { tx: delivered.tx, job, receipt };
}

async function main() {
  console.log(`checker ${WASM_HASH}`);
  buildContract();
  const wasmUrl = await publishedUrl();
  const keys = loadKeys();
  const prior = fs.existsSync(path.join(ROOT, "deployment.json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "deployment.json"), "utf8")) : { txs: {} };
  console.log("accounts");
  const contract = await faucet(keys, "contract");
  keys.contract = contract;
  const beneficiary = await faucet(keys, "beneficiary");
  keys.seller = await faucet(keys, "seller");
  if (!keys.warden) {
    const k = freshKey();
    keys.warden = { accountId: contract.accountId, publicKey: k.publicKey, secretKey: k.secretKey };
    saveKeys(keys);
  }
  const pop = acc(contract);
  const st = await accountState("testnet", contract.accountId);
  console.log(`  contract ${contract.accountId} balance ${st ? fmt(st.amount) : "0"}`);
  const codeHash = st && st.code_hash;
  if (!codeHash || codeHash === "11111111111111111111111111111111") {
    const out = await pop.deployContract(new Uint8Array(fs.readFileSync(CONTRACT_WASM)));
    console.log(`  deployed tx ${out.transaction.hash}`);
  } else console.log(`  code already deployed`);

  let cfg = null;
  try { cfg = await view("testnet", contract.accountId, "get_config"); } catch { /* not initialised */ }
  if (!cfg) {
    const r = await call(pop, contract.accountId, "new", {
      beneficiary: beneficiary.accountId, cap: near(2).toString(), outlayer: OUTLAYER, wasm_hash: WASM_HASH, wasm_url: wasmUrl,
    });
    if (r.failed) throw new Error(`new ${r.failed}`);
    console.log(`  new tx ${r.tx}`);
  }

  let tee = await view("testnet", contract.accountId, "get_tee");
  let initTx = null;
  if (!tee.ready) {
    const r = await call(pop, contract.accountId, "init_tee", { input: '{"op":"init"}' }, { gas: 300n * TGAS, deposit: near(0.05) });
    initTx = r.tx;
    console.log(`  init_tee tx ${r.tx} ${txLink("testnet", r.tx)}`);
    if (r.failed) throw new Error(`init_tee ${r.failed}`);
    const done = await waitReady(contract.accountId, "idle");
    tee = done.tee || await view("testnet", contract.accountId, "get_tee");
    if (!tee.ready) throw new Error(`init failed: ${tee.tee_error || "not ready"}`);
  }
  console.log(`  signing key ${tee.sign_pk}`);
  console.log(`  box key ${tee.box_pk}`);

  const listed = await pop.getAccessKeyList();
  if (!listed.keys.some((k) => k.public_key === keys.warden.publicKey)) {
    const out = await pop.addFunctionCallAccessKey({ publicKey: keys.warden.publicKey, contractId: contract.accountId, methodNames: WARDEN_METHODS, allowance: near(0.5) });
    console.log(`  warden key tx ${out.transaction.hash}`);
  }

  let passTx = prior.txs?.pass || null;
  let failTx = prior.txs?.fail || null;
  let have = await view("testnet", contract.accountId, "get_config");
  if (have.receipts < 1) passTx = (await oneJob(keys, "Dock", GOOD, true)).tx;
  have = await view("testnet", contract.accountId, "get_config");
  if (have.receipts < 2) failTx = (await oneJob(keys, "Cut", CUT, false)).tx;
  else console.log(`  both receipts already on the contract`);

  const full = (await pop.getAccessKeyList()).keys.some((k) => k.public_key === contract.publicKey && k.access_key.permission === "FullAccess");
  let lockTx = null;
  if (full) {
    const out = await pop.deleteKey(contract.publicKey);
    lockTx = out.transaction.hash;
    console.log(`  locked tx ${lockTx} ${txLink("testnet", lockTx)}`);
  } else console.log("  already locked");

  const deployment = {
    network: "testnet",
    contract: contract.accountId,
    beneficiary: beneficiary.accountId,
    seller: keys.seller.accountId,
    wasm_sha256: WASM_HASH,
    wasm_url: wasmUrl,
    outlayer: OUTLAYER,
    sign_pk: (await view("testnet", contract.accountId, "get_tee")).sign_pk,
    senders: { init: contract.accountId, pass: keys.seller.accountId, fail: keys.seller.accountId, lock: contract.accountId },
    txs: {
      init: initTx || prior.txs?.init || null,
      pass: passTx,
      fail: failTx,
      lock: lockTx || prior.txs?.lock || null,
    },
  };
  fs.writeFileSync(path.join(ROOT, "deployment.json"), JSON.stringify(deployment, null, 2) + "\n");
  console.log(accountLink("testnet", contract.accountId));
  console.log("wrote pop/tee/deployment.json");
}

main().catch((e) => { console.error(e.stack || e.message || e); process.exit(1); });
