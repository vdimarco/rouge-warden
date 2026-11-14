# tee-checked-payment

## Purpose

A testnet escrow pays a seller only when a TEE-signed verdict for that job verifies, and it does not keep the delivery.

## Requirements

### Requirement: Pinned checker
The contract SHALL store one wasm sha256 and one ed25519 public key. It SHALL refuse a second init. A verdict SHALL be paid only when the signature verifies under that key, the job id matches, and the input hash matches the ciphertext the contract submitted.

#### Scenario: Bad signature
- **WHEN** a callback carries a verdict whose signature does not verify under the pinned key
- **THEN** nothing is paid, no receipt is written, and the job stays hired

#### Scenario: Passing verdict
- **WHEN** the callback carries a passing verdict with a valid signature for that job and that input
- **THEN** the seller is paid the agreed price and the receipt stores the delivery hash, not the delivery

#### Scenario: Failing verdict
- **WHEN** the callback carries a failing verdict with a valid signature
- **THEN** nothing is paid, the receipt records the reason, and the job opens again

### Requirement: Private delivery
The seller SHALL submit ciphertext. The contract SHALL NOT store the plaintext and SHALL NOT log it.

#### Scenario: Stored job
- **WHEN** a player reads the job after a delivery
- **THEN** the job has no copy of the delivery body

### Requirement: Testnet only
The new contract SHALL be deployed on testnet. The mainnet contract and its verifier SHALL stay as they are.

#### Scenario: Mainnet verifier
- **WHEN** `node pop/scripts/verify.mjs mainnet` runs
- **THEN** it reports 14 checks passed
