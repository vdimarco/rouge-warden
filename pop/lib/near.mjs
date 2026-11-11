// A small NEAR client for the Pay on Proof agents and scripts, on near-api-js.
// Keys live in pop/.keys/<network>.json, which git ignores. Nothing here logs a private key.
import fs from "node:fs";
import path from "node:path";
import { Account, JsonRpcProvider, KeyPair, keyToImplicitAddress, getTransactionLastResult, actions } from "near-api-js";

export const NETS = {
  testnet: { rpc: "https://rpc.testnet.fastnear.com", wrap: "wrap.testnet", explorer: "https://testnet.nearblocks.io", faucet: "https://helper.nearprotocol.com/account" },
  mainnet: { rpc: "https://rpc.mainnet.fastnear.com", wrap: "wrap.near", intents: "intents.near", explorer: "https://nearblocks.io" },
};
export const NEAR = 10n ** 24n;
export const TGAS = 10n ** 12n;
export const near = (x) => BigInt(Math.round(x * 1e6)) * 10n ** 18n; // decimal NEAR to yocto
export const fmt = (y, d = 4) => (Number(BigInt(y) / 10n ** 18n) / 1e6).toFixed(d);

const KEYDIR = new URL("../.keys/", import.meta.url).pathname;
export function keyStore(net) {
  const file = path.join(KEYDIR, net + ".json");
  const read = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {});
  return {
    file,
    get: (name) => read()[name],
    put(name, entry) { fs.mkdirSync(KEYDIR, { recursive: true, mode: 0o700 }); const all = read(); all[name] = entry; fs.writeFileSync(file, JSON.stringify(all, null, 2), { mode: 0o600 }); },
    all: read,
  };
}

// A fresh ed25519 key and the implicit account id it controls.
export function freshKey() {
  const kp = KeyPair.fromRandom("ed25519");
  const pub = kp.getPublicKey().toString();
  return { accountId: keyToImplicitAddress(pub), publicKey: pub, secretKey: kp.toString() };
}

export function provider(net) { return new JsonRpcProvider({ url: NETS[net].rpc }); }
export function account(net, accountId, secretKey) { return new Account(accountId, provider(net), secretKey); }

export async function view(net, contractId, method, args = {}) {
  return provider(net).callFunction({ contractId, method, args, finality: "optimistic" });
}

// A function call that waits for the whole receipt tree and returns { result, tx, logs, failed }.
export async function call(acc, contractId, methodName, args = {}, { gas = 100n * TGAS, deposit = 0n } = {}) {
  let out;
  try { out = await acc.signAndSendTransaction({ receiverId: contractId, actions: [actions.functionCall(methodName, args, BigInt(gas), BigInt(deposit))], waitUntil: "FINAL", throwOnFailure: false }); }
  catch (e) {
    // near-api-js throws on a failed call; keep the panic text and the hash, drop the rest
    const msg = String(e?.message || e);
    const hash = e?.context?.transactionHash || e?.transaction_outcome?.id || msg.match(/[1-9A-HJ-NP-Za-km-z]{43,44}/)?.[0] || null;
    return { result: null, tx: hash, logs: [], failed: msg.slice(0, 400) };
  }
  const logs = out.receipts_outcome.flatMap((r) => r.outcome.logs);
  // the call itself is the first receipt; later failures belong to promises it started, such as a payout
  const first = out.receipts_outcome[0]?.outcome.status;
  const later = out.receipts_outcome.slice(1).map((r) => r.outcome.status).filter((s) => s && s.Failure).map((s) => JSON.stringify(s.Failure).slice(0, 300));
  let result = null;
  if (first && first.SuccessValue !== undefined && first.SuccessValue !== "") { try { result = JSON.parse(Buffer.from(first.SuccessValue, "base64").toString()); } catch (e) { /* not JSON */ } }
  else if (!first?.Failure) { try { result = getTransactionLastResult(out); } catch (e) { /* no return value */ } }
  return { result, tx: out.transaction.hash, logs, failed: first?.Failure ? JSON.stringify(first.Failure).slice(0, 400) : null, laterFailures: later, raw: out };
}

export async function accountState(net, accountId) {
  try { return await provider(net).viewAccount({ accountId, finality: "optimistic" }); } catch (e) { return null; }
}
export const txLink = (net, hash) => `${NETS[net].explorer}/txns/${hash}`;
export const accountLink = (net, id) => `${NETS[net].explorer}/address/${id}`;
