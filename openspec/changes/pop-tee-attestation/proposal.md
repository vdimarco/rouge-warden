# TEE-checked payment on testnet

## Why

Pay on Proof on mainnet runs its check inside the contract, so the delivery is public and the check is the contract code. The hackathon's privacy and security hints ask for a check that runs in a TEE, with an attestation over the verdict, where the operator cannot change the check or read the delivery.

## What changes

A second escrow under `pop/tee/`, deployed on testnet only. It pays when an ed25519 signature over `(job id, delivery hash, verdict)` verifies against a key bound to one wasm binary inside an Intel TDX worker. The mainnet contract is not modified.

## Scope

- In: the guest binary, the testnet contract, a read-only verifier, unit tests, one testnet run.
- Out: mainnet, the existing `pop/contract`, appeals, and hire.
