// The bytes the appeals contract hashes, and the bytes a Lock juror commits.
// Both are checked against known vectors in test/hash.test.mjs.
import { createHash } from "node:crypto";

export const POLICY = "Pay on Proof appeal v1. Options are worker and buyer. A decided ruling for worker pays the hired price to the worker. A decided ruling for buyer refunds that price to the buyer. Any other outcome holds the funds. The evidence is the failed delivery, the spec, and the check's reason.";
export const PROTOCOL_VERSION = 2;

const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(Number(n)); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const u128 = (n) => {
  let x = BigInt(n);
  const b = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) { b[i] = Number(x & 0xffn); x >>= 8n; }
  return b;
};
const lp = (s) => Buffer.concat([u32(Buffer.byteLength(s, "utf8")), Buffer.from(s, "utf8")]);

export function sha256hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

// Same layout as evidence_hash in contract/src/lib.rs.
export function evidenceHash({ jobId, receiptId, kind, worker, buyer, price, spec, reason, data }) {
  const preimage = Buffer.concat([
    Buffer.from("pay-on-proof-appeal/v1"),
    u32(jobId),
    u32(receiptId),
    lp(kind), lp(worker), lp(buyer),
    u128(price),
    lp(spec), lp(reason), lp(data),
  ]);
  return sha256hex(preimage);
}

export function policyHash() { return sha256hex(Buffer.from(POLICY, "utf8")); }

// Borsh of the Lock jury's Commitment struct. scripts/commit_hash.py in that repo uses the same layout.
export function commitmentHash({ contractId, caseId, evidenceHash: evid, policyHash: pol, juror, probs, rationaleHash, salt }) {
  const body = Buffer.concat([
    u32(PROTOCOL_VERSION),
    lp(contractId),
    u64(caseId),
    lp(evid),
    lp(pol),
    lp(juror),
    u32(probs.length),
    ...probs.map((p) => u32(p)),
    lp(rationaleHash),
    lp(salt),
  ]);
  return sha256hex(body);
}
