// Replaces the contract code while the full-access key still exists (testnet, or mainnet before the lock).
//   node scripts/redeploy.mjs testnet [wasm]
import fs from "node:fs";
import { keyStore, account } from "../lib/near.mjs";
const net = process.argv[2] || "testnet";
const wasm = process.argv[3] || new URL("../contract/target/wasm32-unknown-unknown/release/pay_on_proof.wasm", import.meta.url).pathname;
const pop = keyStore(net).get("pop");
const out = await account(net, pop.accountId, pop.secretKey).deployContract(new Uint8Array(fs.readFileSync(wasm)));
console.log(`redeployed ${fs.statSync(wasm).size} bytes to ${pop.accountId}, tx ${out.transaction.hash}`);
