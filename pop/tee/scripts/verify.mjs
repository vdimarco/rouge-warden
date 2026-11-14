// Read-only checks of the testnet TEE escrow. No key. Node 18 or newer.
//
//   node pop/tee/scripts/verify.mjs
//
// Each line starts with "ok" or "FAIL". Exits 1 if any check fails.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { ed25519Ok, initMessage, sha256hex, verdictMessage } from "../lib/message.mjs";

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

// Offsets in an Intel TDX quote v4. RTMR3 starts at 520. Report data starts at 568.
const QUOTE = { mrtd: 184, rtmr0: 376, rtmr1: 424, rtmr2: 472, rtmr3: 520, report: 568 };

// OutLayer's V1 report-data binding. Absent optional fields are skipped.
function reportData(a) {
  const h = createHash("sha256");
  h.update(Buffer.from(a.task_type));
  const tid = Buffer.alloc(8); tid.writeBigInt64LE(BigInt(a.task_id)); h.update(tid);
  if (a.repo) h.update(Buffer.from(a.repo));
  if (a.commit) h.update(Buffer.from(a.commit));
  if (a.build_target) h.update(Buffer.from(a.build_target));
  if (a.wasm_hash) h.update(Buffer.from(a.wasm_hash));
  if (a.input_hash) h.update(Buffer.from(a.input_hash));
  h.update(Buffer.from(a.output_hash));
  if (a.block_height !== undefined && a.block_height !== null) {
    const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(a.block_height)); h.update(b);
  }
  if (a.caller_account_id) h.update(Buffer.from(a.caller_account_id));
  if (a.project_id) h.update(Buffer.from(a.project_id));
  if (a.secrets_ref) h.update(Buffer.from(a.secrets_ref));
  const ts = Buffer.alloc(8); ts.writeBigInt64LE(BigInt(a.timestamp)); h.update(ts);
  if (a.attached_usd !== undefined && a.attached_usd !== null) h.update(Buffer.from(String(a.attached_usd)));
  return h.digest();
}

async function attestation(tx) {
  const url = `https://testnet-api.outlayer.ai/attestations/by-tx/${tx}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) return { url, error: `${r.status} ${text.slice(0, 180)}` };
  try { return { url, body: JSON.parse(text) }; }
  catch { return { url, error: "not JSON" }; }
}

async function txOutputs(tx, sender) {
  const res = await rpc("EXPERIMENTAL_tx_status", { tx_hash: tx, sender_account_id: sender, wait_until: "NONE" });
  const outs = [];
  for (const o of res.receipts_outcome || []) {
    const v = o.outcome?.status?.SuccessValue;
    if (!v) continue;
    const raw = Buffer.from(v, "base64");
    if (raw.length) outs.push(raw);
  }
  return outs;
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
    const sender = file.senders?.[name];
    if (!tx || !sender) { ok(`${name} attestation`, false, "no tx"); continue; }
    const got = await attestation(tx);
    const a = got.body;
    ok(`${name} attestation fetched`, !!a && a.transaction_hash === tx, a ? `request ${a.request_id}` : (got.error || ""));
    if (!a) continue;
    ok(`${name} wasm`, a.wasm_hash === localHash && a.executed_wasm_sha256 === localHash && a.caller_account_id === sender);
    const quote = Buffer.from(a.tdx_quote || "", "base64");
    const tdx = quote.length > QUOTE.report + 64 && quote.readUInt16LE(0) === 4 && quote.readUInt32LE(4) === 0x81;
    ok(`${name} TDX quote`, tdx, `${quote.length} bytes`);
    if (!tdx) continue;
    const meas = {
      mrtd: quote.subarray(QUOTE.mrtd, QUOTE.mrtd + 48).toString("hex"),
      rtmr0: quote.subarray(QUOTE.rtmr0, QUOTE.rtmr0 + 48).toString("hex"),
      rtmr1: quote.subarray(QUOTE.rtmr1, QUOTE.rtmr1 + 48).toString("hex"),
      rtmr2: quote.subarray(QUOTE.rtmr2, QUOTE.rtmr2 + 48).toString("hex"),
      rtmr3: quote.subarray(QUOTE.rtmr3, QUOTE.rtmr3 + 48).toString("hex"),
    };
    ok(`${name} quote RTMR3`, meas.rtmr3 === a.worker_measurement);
    const approved = await view("worker.outlayer.testnet", "is_measurements_approved", { measurements: meas });
    ok(`${name} measurements approved`, approved === true, meas.mrtd.slice(0, 16));
    const report = quote.subarray(QUOTE.report, QUOTE.report + 64);
    const bound = reportData(a);
    ok(`${name} report data`, report.subarray(0, 32).equals(bound) && report.subarray(32).every((b) => b === 0));
    const outputs = await txOutputs(tx, sender);
    const hashed = outputs.filter((raw) => sha256hex(raw) === a.output_hash);
    ok(`${name} output hash`, hashed.length === 1, a.output_hash.slice(0, 16));
    if (hashed.length === 1) {
      const guest = JSON.parse(hashed[0].toString());
      if (name === "init") {
        const msg = initMessage(guest.box_pk);
        ok("init signature in the quote output", ed25519Ok(msg, guest.signature, guest.sign_pk) && guest.sign_pk === tee.sign_pk);
      } else {
        const msg = verdictMessage(guest.job, guest.delivery, guest.input, guest.pass, guest.reason);
        ok(`${name} signature in the quote output`, ed25519Ok(msg, guest.signature, tee.sign_pk));
      }
    }
  }

  console.log(`\n${fails ? "FAILED" : "all " + passes + " checks passed"}`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e.stack || e.message || e); process.exit(1); });
