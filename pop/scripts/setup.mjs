// Sets up Pay on Proof on a network, step by step. Each step is skipped when already done, so a run can resume.
//   node scripts/setup.mjs testnet            faucet accounts, mock intents, deploy, Warden key, lock
//   node scripts/setup.mjs mainnet --beneficiary <account> --cap-usd 10
// Mainnet stops after printing the contract's address until that address holds enough NEAR.
import fs from "node:fs";
import { NETS, near, fmt, TGAS, keyStore, freshKey, account, call, view, accountState, accountLink } from "../lib/near.mjs";

const net = process.argv[2];
if (!NETS[net]) { console.error("usage: node scripts/setup.mjs testnet|mainnet [--beneficiary id] [--cap-usd 10] [--wasm path] [--no-lock]"); process.exit(1); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(k);
const ks = keyStore(net);
const WASM = arg("--wasm", new URL("../contract/target/near/pay_on_proof.wasm", import.meta.url).pathname);
const WARDEN_METHODS = ["post_job", "counter", "hire", "cancel_job", "retry_payout", "unwrap_near"];
const step = (s) => console.log("\n== " + s);

async function faucet(name) {
  const have = ks.get(name);
  if (have) return have;
  const k = freshKey();
  const id = `${name}-${Date.now().toString(36)}.testnet`;
  const r = await fetch(NETS.testnet.faucet, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ newAccountId: id, newAccountPublicKey: k.publicKey }) });
  if (!r.ok) throw new Error(`faucet ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const entry = { accountId: id, publicKey: k.publicKey, secretKey: k.secretKey };
  ks.put(name, entry);
  console.log(`  ${name}: ${id}`);
  await new Promise((res) => setTimeout(res, 2500));
  return entry;
}

async function deployIfNeeded(acc, wasmPath, label) {
  const st = await accountState(net, acc.accountId);
  const code = fs.readFileSync(wasmPath);
  if (st && st.code_hash && st.code_hash !== "11111111111111111111111111111111") { console.log(`  ${label} already has code (${st.code_hash.slice(0, 10)}…)`); return false; }
  const out = await acc.deployContract(new Uint8Array(code));
  console.log(`  deployed ${label}: ${code.length} bytes, tx ${out.transaction.hash}`);
  return true;
}

async function main() {
  let pop, beneficiary, intents, sellers = [];
  if (net === "testnet") {
    step("Accounts from the testnet faucet");
    pop = await faucet("pop");
    beneficiary = (await faucet("ben")).accountId;
    const mi = await faucet("intents");
    intents = mi.accountId;
    sellers = [await faucet("seller-a"), await faucet("seller-b")];
    step("Mock intents (NEAR Intents has no testnet)");
    const miAcc = account(net, mi.accountId, mi.secretKey);
    if (await deployIfNeeded(miAcc, new URL("../mock-intents/target/wasm32-unknown-unknown/release/mock_intents.wasm", import.meta.url).pathname, "mock intents"))
      console.log("  init", (await call(miAcc, mi.accountId, "new", {})).failed || "ok");
    // intents.near is registered with wrap.near on mainnet; the stand-in has to register with wrap.testnet
    if (!(await view(net, NETS.testnet.wrap, "storage_balance_of", { account_id: mi.accountId })))
      console.log("  register mock intents with wNEAR", (await call(miAcc, NETS.testnet.wrap, "storage_deposit", { account_id: mi.accountId, registration_only: true }, { deposit: near(0.0125) })).failed || "ok");
  } else {
    beneficiary = arg("--beneficiary");
    intents = NETS.mainnet.intents;
    if (!ks.get("pop")) { const k = freshKey(); ks.put("pop", { ...k }); }
    pop = ks.get("pop");
    for (const name of ["seller-a", "seller-b"]) { if (!ks.get(name)) ks.put(name, freshKey()); sellers.push(ks.get(name)); }
    const st = await accountState(net, pop.accountId);
    const need = Number(arg("--need", "5.5")); // code storage ~2.1, the cap ~2.7, seller gas 0.1, buffer

    const have = st ? Number(BigInt(st.amount) / 10n ** 18n) / 1e6 : 0;
    step("Funding");
    console.log(`  contract account: ${pop.accountId}\n  ${accountLink(net, pop.accountId)}\n  balance ${have.toFixed(4)} NEAR, needs ${need}`);
    if (have < need) { console.log("  Send NEAR to the address above, then run this again."); return; }
    if (!beneficiary) throw new Error("--beneficiary <your NEAR account> is required on mainnet");
  }
  const popAcc = account(net, pop.accountId, pop.secretKey);
  const keys = await popAcc.getAccessKeyList();
  const full = keys.keys.some((k) => k.public_key === pop.publicKey && k.access_key.permission === "FullAccess");
  if (!full) { console.log("\nThe contract account has no full-access key any more: setup is finished and locked."); return; }

  step("Deploy Pay on Proof");
  await deployIfNeeded(popAcc, WASM, "pay-on-proof");
  let cfg = null;
  try { cfg = await view(net, pop.accountId, "get_config"); } catch (e) { /* not initialised */ }
  if (!cfg) {
    let capNear;
    if (net === "mainnet") {
      const usd = Number(arg("--cap-usd", "10"));
      const tokens = await (await fetch("https://1click.chaindefuser.com/v0/tokens")).json();
      const price = tokens.find((t) => t.assetId === "nep141:wrap.near").price;
      capNear = usd / price;
      console.log(`  cap $${usd} at $${price}/NEAR = ${capNear.toFixed(4)} NEAR`);
    } else capNear = Number(arg("--cap-near", "3"));
    const r = await call(popAcc, pop.accountId, "new", { beneficiary, cap: near(capNear).toString(), wrap: NETS[net].wrap, intents });
    console.log("  init", r.failed || "ok", r.tx);
    cfg = await view(net, pop.accountId, "get_config");
  }
  console.log("  config", JSON.stringify({ ...cfg, cap: fmt(cfg.cap), balance: fmt(cfg.balance) }));

  step("Register with wNEAR");
  const reg = await view(net, NETS[net].wrap, "storage_balance_of", { account_id: pop.accountId });
  if (!reg) console.log("  register_wrap", (await call(popAcc, pop.accountId, "register_wrap", {})).failed || "ok");
  else console.log("  already registered");

  if (net === "mainnet") {
    step("Gas money for the reference sellers");
    for (const s of sellers) {
      const st = await accountState(net, s.accountId);
      if (!st) { const out = await popAcc.transfer({ receiverId: s.accountId, amount: near(0.05) }); console.log(`  sent 0.05 NEAR to ${s.accountId}, tx ${out.transaction.hash}`); }
    }
  }

  step("Warden key: a function-call key that cannot move funds");
  if (!ks.get("warden")) { const k = freshKey(); ks.put("warden", { accountId: pop.accountId, publicKey: k.publicKey, secretKey: k.secretKey }); }
  const w = ks.get("warden");
  if (!keys.keys.some((k) => k.public_key === w.publicKey)) {
    const out = await popAcc.addFunctionCallAccessKey({ publicKey: w.publicKey, contractId: pop.accountId, methodNames: WARDEN_METHODS, allowance: near(0.5) });
    console.log(`  added ${w.publicKey.slice(0, 18)}… for ${WARDEN_METHODS.join(", ")}, tx ${out.transaction.hash}`);
  } else console.log("  already added");

  if (flag("--no-lock")) { console.log("\n--no-lock: the full-access key stays. Run again without it to lock."); return; }
  step("Lock: delete the full-access key, so nobody can change the code or move funds");
  const out = await popAcc.deleteKey(pop.publicKey);
  console.log(`  deleted, tx ${out.transaction.hash}`);
  const after = await account(net, pop.accountId).getAccessKeyList();
  console.log("  keys now:", after.keys.map((k) => `${k.public_key.slice(0, 18)}… ${k.access_key.permission === "FullAccess" ? "FULL" : "function-call " + k.access_key.permission.FunctionCall.method_names.join(",")}`).join(" | "));
  void TGAS;
}
main().catch((e) => { console.error("setup failed:", e.message || e); process.exit(1); });
