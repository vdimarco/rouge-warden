// Read-only checks of the testnet TEE escrow. No key. Node 18 or newer.
//
//   node pop/tee/scripts/verify.mjs
//
// Each line starts with "ok" or "FAIL". Exits 1 if any check fails.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ed25519Ok, sha256hex, verdictMessage } from "../lib/message.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC = "https://rpc.testnet.fastnear.com";
const file = JSON.parse(fs.readFileSync(path.join(ROOT, "deployment.json"), "utf8"));
if (file.network !== "testnet") { console.error("deployment.json is not testnet"); process.exit(2); }
const C = file.contract;
const guest = fs.readFileSync(path.join(ROOT, "checker", "pop-tee-checker.wasm"));
const localHash = sha256hex(guest);

let fails = 0, passes = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? "  " + extra : ""}`); cond ? passes++ : fails++; };

async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 300));
  return j.result;
}
const view = async (account, method, args = {}) => {
  const res = await rpc("query", { request_type: "call_function", finality: "final", account_id: account, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  if (res.error) throw new Error(res.error);
  return JSON.parse(Buffer.from(res.result).toString());
};

function walk(v, acc) {
  if (!v || typeof v !== "object") return;
  if (typeof v.mrtd === "string" && typeof v.rtmr0 === "string" && typeof v.rtmr3 === "string") acc.measurements.push(v);
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") acc.strings.push([k, val]);
    else walk(val, acc);
  }
}

async function attestation(tx) {
  const urls = [
    `https://api.outlayer.ai/attestations/by-tx/${tx}`,
    `https://api.outlayer.ai/attestations/by-request/${tx}`,
  ];
  for (const url of urls) {
    const r = await fetch(url);
    if (r.status === 404) continue;
    const text = await r.text();
    if (!r.ok) return { url, error: `${r.status} ${text.slice(0, 180)}` };
    try { return { url, body: JSON.parse(text) }; }
    catch { return { url, error: "not JSON" }; }
  }
  return { error: "no attestation" };
}

function quoteBytes(strings) {
  const hit = strings.find(([k, v]) => /quote/i.test(k) && v.length > 500);
  if (!hit) return null;
  const raw = hit[1].replace(/\s/g, "");
  try { return Buffer.from(raw, /^[0-9a-fA-F]+$/.test(raw) ? "hex" : "base64"); }
  catch { return null; }
}

async function main() {
  const tee = await view(C, "get_tee");
  const cfg = await view(C, "get_config");
  const receipts = await view(C, "get_receipts", { from: 0, limit: 20 });
  const keys = await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: C });
  const full = keys.keys.filter((k) => k.access_key.permission === "FullAccess");
  const warden = keys.keys.filter((k) => k.access_key.permission.FunctionCall);
  ok("no full-access key", full.length === 0, `${keys.keys.length} key(s)`);
  const methods = warden[0]?.access_key.permission.FunctionCall.method_names || [];
  ok("warden key cannot deliver", warden.length === 1 && methods.includes("post_job") && methods.includes("hire") && !methods.includes("deliver"), methods.join(","));
  ok("wasm hash pinned", tee.wasm_hash === localHash && tee.wasm_hash === file.wasm_sha256, tee.wasm_hash.slice(0, 16));
  ok("signing key matches the file", tee.sign_pk === file.sign_pk && /^[0-9a-f]{64}$/.test(tee.sign_pk));
  ok("box key is set", /^[0-9a-f]{64}$/.test(tee.box_pk));
  ok("outlayer is testnet", tee.wasm_url.startsWith("https://") && cfg.outlayer === "outlayer.testnet");

  const paid = receipts.filter((r) => r.pass);
  const failed = receipts.filter((r) => !r.pass);
  ok("one pass and one fail", paid.length === 1 && failed.length === 1, `${receipts.length} receipts`);
  for (const r of receipts) {
    let signed = false;
    try {
      const msg = verdictMessage(r.job, r.delivery_hash, r.input_hash, r.pass, r.reason);
      signed = ed25519Ok(msg, r.signature, tee.sign_pk);
    } catch { signed = false; }
    ok(`receipt ${r.id} signature`, signed, r.pass ? "pass" : r.reason);
  }
  ok("pass paid", paid[0] && paid[0].payout === "sent" && cfg.spent !== "0");
  ok("fail paid nothing", failed[0] && failed[0].payout === "none" && failed[0].reason === "room cut off");
  const job0 = await view(C, "get_job", { job_id: paid[0]?.job ?? 0 });
  const stored = JSON.stringify({ job0, receipts });
  ok("delivery body is not stored", job0 && !stored.includes("links") && !stored.includes("[0,0]"));

  for (const name of ["init", "pass", "fail"]) {
    const tx = file.txs?.[name];
    if (!tx) { ok(`${name} attestation`, false, "no tx"); continue; }
    const got = await attestation(tx);
    if (!got.body) { ok(`${name} attestation fetched`, false, got.error || ""); continue; }
    ok(`${name} attestation fetched`, true, got.url.replace("https://api.outlayer.ai", ""));
    const acc = { measurements: [], strings: [] };
    walk(got.body, acc);
    const quote = quoteBytes(acc.strings);
    ok(`${name} quote bytes`, !!quote && quote.length > 1000, quote ? `${quote.length} bytes` : "missing");
    const wasmField = acc.strings.find(([k, v]) => /wasm_hash|wasmHash/i.test(k) && v.toLowerCase() === localHash);
    ok(`${name} quote names this wasm`, !!wasmField);
    const meas = acc.measurements[0];
    let approved = false;
    if (meas) {
      try { approved = await view("worker.outlayer.testnet", "is_measurements_approved", { measurements: { mrtd: meas.mrtd, rtmr0: meas.rtmr0, rtmr1: meas.rtmr1, rtmr2: meas.rtmr2, rtmr3: meas.rtmr3 } }); }
      catch (e) { approved = false; }
    }
    ok(`${name} measurements approved on chain`, approved === true);
    fs.mkdirSync(path.join(ROOT, "run"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "run", `${name}-attestation.json`), JSON.stringify(got.body));
  }

  console.log(`\n${fails ? "FAILED" : "all " + passes + " checks passed"}`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e.stack || e.message || e); process.exit(1); });
