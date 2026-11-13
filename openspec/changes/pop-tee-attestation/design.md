# Design

## Choice of TEE

NEAR AI Cloud returns an Intel TDX quote for a model environment from `GET /v1/attestation/report` with no API key. That quote attests the model, not a program we wrote. The caller supplies the prompt, so the caller can change what "pass" means.

OutLayer runs a wasm binary in Intel TDX and publishes a quote whose report data commits to the wasm sha256, the input hash, and the output hash. Workers register on `worker.outlayer.testnet` after an on-chain DCAP check of five measurements. That is the environment this change uses.

Source: OutLayer's TEE attestation and signing-keys docs (`https://app.outlayer.ai/docs/tee-attestation`, `https://app.outlayer.ai/docs/signing-keys`), and the WIT in `fastnear/near-outlayer` `sdk/outlayer/wit`.

## Trust that is real, and trust that is not

- The contract verifies one ed25519 signature. The key is derived in the TEE for this wasm and this contract. The contract does not verify the Intel quote on the receipt.
- `worker.outlayer.testnet` already verified the worker quote at registration. The read-only script checks the execution quote's measurements against that approved list.
- The script recomputes the quote's report data (task id, wasm hash, input hash, output hash, caller, block, timestamp) and checks the five measurements against `worker.outlayer.testnet`. It does not re-check Intel's certificate chain. That check already ran when the worker registered. Saying this script repeated it would be false.
- The ciphertext is visible on chain. The plaintext is not, unless the guest is changed. A changed guest is a different wasm hash and a different signing key, which the locked contract rejects.

## Payment

Testnet NEAR only. NEAR Intents has no testnet, and this contract does not pretend otherwise. The cap and the Warden function-call key follow the mainnet contract's shape, with a shorter method list.
