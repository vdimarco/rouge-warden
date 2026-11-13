# Hire design

## Decision

The new contract lives in `pop/hire/contract` and is deployed to a fresh testnet account. `pop/contract/src/lib.rs` stays as it is, because `pop/scripts/verify.mjs` requires the mainnet wasm exports to match the public methods in that file. The mainnet account has no full-access key, so it cannot be upgraded.

The hire contract reuses the checker by compiling `pop/contract/src/checks.rs` into the new crate. The checks are the same integer rules (map, roster, paint, tune). No separate art or rendering source applies here. The escrow shape follows the existing Pay on Proof contract: reserve a budget, pay only when `check` passes, and keep `spent + reserved <= cap`. Function-call keys follow the NEAR access-key rules already used for the Warden: a key names one receiver and a method list, and it cannot sign a transfer.

## Accounts

- The contract account is a faucet account. After init it receives a function-call key for `post_job`, `hire`, `cancel_job`, `retry_payout`, and `unwrap_near`. Its full-access key is then deleted.
- The parent agent is a faucet account. It creates `crew.<parent>` and gives that sub-account a full-access key plus gas NEAR. It then adds a function-call key on itself for `bid`, `post_subjob`, `hire_sub`, `cancel_subjob`, and `deliver`, and deletes its own full-access key.
- The sub-agent signs `bid_sub` and `deliver_sub` with the sub-account's full-access key. The contract accepts a sub-job bid only from an account whose id is a sub-account of the hired parent.

## Money

The parent job's hire price is the parent's cap. `post_subjob` adds the sub budget to `sub_reserved`. It panics with `over the cap` when `paid_out + sub_reserved + new budget` would pass the hire price. A passing sub delivery moves the sub price from `reserved` to `spent` and pays the sub-agent. A passing parent delivery pays `hire price - paid_out` and releases the rest of that job's reserve. The global cap still bounds `post_job`.

The sub-agent is paid in NEAR so the transfer is visible. The parent is paid through the testnet wNEAR wrapper into a mock NEAR Intents contract, the same `ft_on_transfer` path as `pop/mock-intents`. NEAR Intents has no testnet. Nothing in this flow is signed on mainnet.

## Keys and secrets

Secret keys stay in `pop/hire/.keys/`, which git ignores. The committed run file records account ids, public keys, and transaction hashes. Full-access keys that remain (beneficiary, mock intents, sub-agent) are named there. The contract's full-access key and the parent's full-access key are deleted on testnet.

## Checks

`cargo test` in `pop/hire/contract` covers the cap, the sub-account rule, a failed delivery, and the two payouts. `node pop/hire/scripts/verify.mjs` reads the recorded testnet run and does not sign. `node pop/scripts/verify.mjs mainnet` must stay 14 of 14.
