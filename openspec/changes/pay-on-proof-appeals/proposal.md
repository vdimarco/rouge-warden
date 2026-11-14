# Proposal: Pay on Proof appeals

## Why

A failed delivery on Pay on Proof pays nothing and the job opens again. A worker who believes the check is wrong has no path to a second ruling. Lock Before You Talk already runs a commit-reveal jury on NEAR testnet. This change connects a failed delivery to that jury and settles the escrow from the ruling.

## What

A testnet-only escrow under `pop/appeals/`. It posts a job, hires a worker, and runs the same delivery checks as Pay on Proof. On a failure the worker can open a dispute. The contract opens a case on a Lock jury and later reads that case with a cross-contract call. A private callback pays the worker or refunds the buyer. The mainnet contract is not modified, redeployed, or signed.

## Scope

- New contract, scripts, tests, and a read-only verifier in `pop/appeals/`.
- A short section in `pop/README.md`.
- One CI job that runs the appeals tests and the read-only verifier.
- No changes under `pop/contract/`, `pop/tee/`, or `pop/hire/`.
- No mainnet transaction.
