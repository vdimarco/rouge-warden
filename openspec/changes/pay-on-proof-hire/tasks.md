## 1. Contract

- [x] Add the testnet hire contract under `pop/hire/contract`, reusing the Pay on Proof checks.
- [x] Cover the cap, the sub-account rule, a failed delivery, and both payouts with `cargo test`.

## 2. Testnet run

- [x] Deploy only on testnet. Do not sign a mainnet transaction.
- [x] Create the sub-account, lock the parent to a function-call key, and delete the contract full-access key.
- [x] Record the refused overspend, the sub payment, and the parent payment.

## 3. Read-only check

- [x] Add `pop/hire/scripts/verify.mjs` and a README section with do-this, see-this steps.
- [x] Confirm `node pop/scripts/verify.mjs mainnet` still passes 14 of 14.
- [x] Pay the parent's remainder to an owner account, and show that owner spending it on testnet.
