# Pay on Proof, checked in a TEE

A testnet escrow. The hired seller encrypts a delivery to a key that exists only inside an Intel TDX worker. The worker runs one pinned binary, signs `(job id, delivery hash, verdict)`, and the contract pays only when that signature verifies. The contract never stores the delivery.

This does not change the mainnet Pay on Proof contract. `node pop/scripts/verify.mjs mainnet` still reads that contract.

## What is attested

OutLayer (`outlayer.testnet`) runs `pop/tee/checker/pop-tee-checker.wasm` inside an Intel TDX worker. The worker is registered on `worker.outlayer.testnet`, which checks the worker's TDX quote with Intel's DCAP library and keeps the approved measurements (`MRTD`, `RTMR0` through `RTMR3`).

The guest does not hold the signing key. It asks the host interface `outlayer:signing-keys` to sign. That key is derived inside the TEE for this wasm sha256 and for the contract account (`bind: wasm`, `caller: predecessor`). A different binary, or a call that does not come from this contract, gets a different key. The contract pins the public key at init and will not replace it.

The delivery is an X25519 + XChaCha20-Poly1305 box to a second key. That key's secret is sealed with `outlayer:encryption-keys` under the same wasm and the same contract, and the seal is stored on the contract. The guest opens the seal, opens the box, hashes the plaintext, runs the same map check as the mainnet contract, and signs the verdict. The plaintext is not in the output.

The contract checks the ed25519 signature. It does not check the Intel quote itself. Per-call quote checks are too heavy for a NEAR receipt. `scripts/verify.mjs` reads the quote from OutLayer's attestation API, checks that the quote names this wasm, and checks that the quote's measurements are on `worker.outlayer.testnet`'s approved list. This script does not repeat Intel's ECDSA chain check. That check already happened when the worker registered.

NEAR AI Cloud's public attestation endpoint answers without an API key and returns an Intel quote for a model environment. It does not run this binary. A model judges whatever prompt the caller sends, so the caller can change the check. This path uses OutLayer because the check is the pinned binary.

## What you can still see

The ciphertext and the sealed key are on the testnet transaction. The plaintext is not. The OutLayer coordinator receives the ciphertext in order to pass it into the worker. The coordinator does not receive the plaintext, and the guest does not write it out.

The operator of this contract cannot swap the checker after `init_tee`. The wasm hash and the signing key are fixed, and the full-access key is deleted. Publishing a different wasm produces a signature the contract rejects.

## Do this, see this

| Do this | See this |
| --- | --- |
| `cd pop/tee && npm ci && npm test` | Checker tests, contract tests (`5 passed`), and the codec test. No network and no key. |
| `node pop/tee/scripts/verify.mjs` | 36 lines that start with `ok`, then `all 36 checks passed`. It reads testnet only. |
| Open [contract-mwfh7y7n.testnet](https://testnet.nearblocks.io/address/contract-mwfh7y7n.testnet) | No full-access key. One function-call key, for `post_job`, `hire`, and `cancel_job`. |
| Open [the pass](https://testnet.nearblocks.io/txns/Cvzq7ubLYuUime1Y8MUy5AWQyJJW5sUF9c7fdwe4JHBp) | `tee pass job 0 receipt 0`, then a NEAR transfer. The delivery argument is ciphertext. |
| Open [the fail](https://testnet.nearblocks.io/txns/ESV8jwR9H7a9h9EEme93W2UTXppFG9ekV43abg8PezP1) | `tee fail job 1 receipt 1: room cut off`. No transfer. |
| Open [the init](https://testnet.nearblocks.io/txns/63L2iNKpftkynUP6KAasqqHJF5kTyDGdZeH8fFk3zLFA) | `tee ready` and the signing key `13f8eaab…c59e`. |
| Open [the lock](https://testnet.nearblocks.io/txns/4TJDKjAAC9SeqvhbNBb1C8kKjuBpsokbubCHSoZTy89m) | The full-access key deleted. |

The three Intel TDX quotes are at `https://testnet-api.outlayer.ai/attestations/by-tx/` plus the init, pass, and fail transaction hashes. Each quote is version 4 with TEE type `0x81` (TDX). Its report data is the SHA-256 of this run's task id, wasm hash, input hash, output hash, caller, block, and timestamp. `worker.outlayer.testnet` `is_measurements_approved` returns true for the five measurements in the quote. That contract checked Intel's signature when the worker registered. This script recomputes the report data and checks that approval. It does not repeat Intel's certificate check itself.

The checker wasm sha256 is `b3ad2ebd4b314b278b60af0bf9bdb8799d17c4f76abb305103ec05b7a42ae594`.

`node pop/tee/scripts/run.mjs testnet` is how this deployment was made. It creates faucet accounts, deploys, inits the TEE key, runs both jobs, and deletes the full-access key. Keys go to `pop/tee/.keys/`, which git ignores.

Build the guest before publishing a new binary:

```sh
cargo +1.90.0 build --manifest-path pop/tee/checker/Cargo.toml --target wasm32-wasip2 --release --features guest
wasm-tools strip --delete '^(\.debug_.*|producers|target_features|linking|reloc\..*|sourceMappingURL|external_debug_info|component-name)$' \
  pop/tee/checker/target/wasm32-wasip2/release/pop-tee-checker.wasm -o pop/tee/checker/pop-tee-checker.wasm
```

Rust 1.90 emits WASI 0.2.3 imports. OutLayer's worker is wasmtime 36, which provides WASI 0.2.6, and a newer import does not instantiate. The contract pins the sha256 of the committed file. The worker fetches those bytes from the URL stored at init.
