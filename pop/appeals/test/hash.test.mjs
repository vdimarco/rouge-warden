// The evidence hash and the Lock jury commitment hash. No network, no key.
import { evidenceHash, policyHash, commitmentHash } from "../lib/hash.mjs";

let fails = 0;
const ok = (name, cond) => { console.log(`${cond ? "ok  " : "FAIL"} ${name}`); if (!cond) fails++; };

const evidence = evidenceHash({
  jobId: 1, receiptId: 2, kind: "map", worker: "worker.near", buyer: "buyer.near",
  price: 150000000000000000000000n,
  spec: '{"rooms":3,"cols":4,"rows":3}',
  reason: "room cut off",
  data: '{"rooms":[[0,0]]}',
});
ok("evidence hash matches the contract unit test", evidence === "4c0c2a031f631c5af4e7e110a777dc2da42bc2dabf4ae8723f5b8bc852940f15");
ok("policy hash matches the contract unit test", policyHash() === "23ed5e255785f07b0741cd473f2f40ffbcc0624c88bcd29209db0078d2d86b91");

// Vector from Lock Before You Talk, contract/src/lib.rs commitment_test_vector.
const commit = commitmentHash({
  contractId: "jury.near",
  caseId: 7,
  evidenceHash: "a".repeat(64),
  policyHash: "b".repeat(64),
  juror: "j1.jury.near",
  probs: [7000, 2000, 1000],
  rationaleHash: "c".repeat(64),
  salt: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
});
ok("commitment hash matches the Lock jury test vector", commit === "49cb452949724da1a78ea133ddb650af1b8cfd4ef3db6b648b565afd0214fd87");

console.log(fails ? `${fails} failed` : "all 3 checks passed");
process.exit(fails ? 1 : 0);
