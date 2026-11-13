# Design: appeals settlement

## Sources

- Lock Before You Talk (`github.com/vdimarco/near-hackathon-market`, `escrow/src/lib.rs`): `settle` calls `get_case` and a private callback pays only on a `Decided` outcome. This change keeps that callback and adds checks the sandbox escrow does not make.
- The same repository's jury (`contract/src/lib.rs`): a case commits, discusses, reveals, and rules by strict majority of the locked first reads. The demo deploys the wasm that is already running at `dev-20261111042208-14186395012630.testnet`.
- NEAR promise callbacks: the result a private callback receives is the callee's return value. The caller cannot substitute a ruling.
- No rendering technique is involved.

## Why a cross-contract call

Lock can also ask Chain Signatures to sign a ruling for a contract on another chain. This payment stays on NEAR. A signature would add the signer network and a second implementation of the ruling digest. The callback does not. The jury contract returns the case, and the runtime delivers that return value to `on_ruling`.

`on_ruling` pays only when all of these hold:

- the outcome is `Decided`
- the ruling is option 0 (`worker`) or option 1 (`buyer`)
- the case opener is this contract
- the evidence hash equals the hash of this failed delivery
- the policy hash and the option names are the ones this contract set

The jury chooses an option index. This contract chooses the account, from the worker and buyer stored when the dispute was opened. A failed transfer leaves the dispute ready so `settle` can run again. Any other outcome leaves the funds reserved.

## Why a second jury deployment

The published jury has no access keys, so its panel cannot commit a new case. The demo downloads that account's wasm and deploys those bytes under a new testnet account, with six new juror accounts. The verifier compares the two code hashes. The jury account's full-access key is deleted before the dispute is opened.

One operator holds the six juror keys for the demo. Lock Before You Talk states the same limit for its own panel. After the run, those full-access keys are deleted.

## What stays locked

The mainnet Pay on Proof account is not a party to these transactions. Its method list, keys, and receipts are unchanged. The appeal checks are the same functions as `pop/contract/src/checks.rs`, compiled into the appeals wasm by a path include. That file is not edited.
