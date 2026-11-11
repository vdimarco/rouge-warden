// Pulls the real mainnet facts the demo video shows: config, keys, jobs, receipts, and the data a failed delivery sent.
import fs from "node:fs";
import { keyStore, view, provider, fmt } from "../lib/near.mjs";
const net = "mainnet", ks = keyStore(net), C = ks.get("pop").accountId;
const cfg = await view(net, C, "get_config");
const jobs = await view(net, C, "get_jobs", { from: 0, limit: 50 });
const receipts = await view(net, C, "get_receipts", { from: 0, limit: 50 });
const keys = (await provider(net).viewAccessKeyList({ accountId: C, finality: "optimistic" })).keys;
const runs = fs.readdirSync(new URL("../runs/", import.meta.url)).filter((f) => f.startsWith("mainnet")).flatMap((f) => fs.readFileSync(new URL("../runs/" + f, import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l)));
// failed deliveries keep no data in the contract; the transaction's own arguments do
async function txArgs(hash, sender) {
  const r = await fetch("https://rpc.mainnet.fastnear.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tx", params: { tx_hash: hash, sender_account_id: sender, wait_until: "NONE" } }) });
  const t = (await r.json()).result.transaction;
  return JSON.parse(Buffer.from(t.actions[0].FunctionCall.args, "base64").toString());
}
const failed = [];
for (const e of runs.filter((e) => e.act === "deliver" && e.pass === false && e.tx)) {
  const seller = ks.get(e.who === "Gravel" ? "seller-b" : "seller-a").accountId;
  const a = await txArgs(e.tx, seller);
  failed.push({ job: e.job, kind: e.kind, reason: e.reason, tx: e.tx, data: JSON.parse(a.data) });
}
const intents = await view(net, "intents.near", "mt_balance_of", { account_id: ks.get("seller-a").accountId, token_id: "nep141:wrap.near" });
const out = { contract: C, cfg: { ...cfg, cap_near: fmt(cfg.cap), spent_near: fmt(cfg.spent) }, keys: keys.map((k) => ({ key: k.public_key, perm: k.access_key.permission === "FullAccess" ? "full" : k.access_key.permission.FunctionCall.method_names })),
  jobs, receipts, failed, margIntents: fmt(intents, 4), log: runs.filter((e) => e.tx).map(({ t, who, act, job, tx, pass, reason }) => ({ t, who, act, job, tx, pass, reason })) };
fs.writeFileSync(new URL("./data.json", import.meta.url), JSON.stringify(out, null, 1));
const pass = receipts.filter((r) => r.pass);
console.log(`jobs ${jobs.length} receipts ${receipts.length} pass ${pass.length} (near ${pass.filter((r) => r.rail === "near").length}, intents ${pass.filter((r) => r.rail === "intents").length}) fail ${receipts.length - pass.length} spent ${fmt(cfg.spent)} margIntents ${out.margIntents} failedData ${failed.length} keys ${JSON.stringify(out.keys.map((k) => k.perm))}`);
