# Appeals

Testnet only. A failed Pay on Proof delivery can be appealed to a [Lock Before You Talk](https://github.com/vdimarco/near-hackathon-market) jury. The appeals contract then pays the worker or refunds the buyer. It does not change the mainnet contract.

## Settlement

`dispute` is signed by the hired worker. The appeals contract, not the worker, calls `open_case` on the jury. The case opener is the appeals contract, and the evidence hash is computed here from the failed delivery.

`settle` calls `get_case`. The private callback `on_ruling` sees the jury's return value. It pays the stored worker when the ruling is option `worker`, and it transfers the same price to the stored buyer when the ruling is option `buyer`. It does not pay when the outcome is not Decided, or when the opener, the evidence hash, the policy hash, or the option names differ. The jury never names an account.

A Chain Signatures ruling is the path Lock uses for a payment on another chain. This payment is on NEAR, so the callback is the check that does not add another signer.

## The jury

The published jury is `dev-20261111042208-14186395012630.testnet`. It has no keys, so its panel cannot commit a new case. `scripts/run.mjs` downloads that account's wasm, deploys those bytes, and creates six juror accounts. Their full-access keys are deleted after they reveal. The verifier compares the code hash with the published jury.

The six jurors in the demo are operated together, which is the limit Lock states for its own panel. Each juror commits a hash of its first read before any reveal. The jury contract checks the reveal and applies its majority rule.

## Checks

| Do this | See this |
| --- | --- |
| `node pop/appeals/verify.mjs` | `all 42 checks passed`. The recorded testnet run, read from the chain, with no key. |
| `node pop/appeals/test/hash.test.mjs` | 3 passed. The commitment hash matches the Lock jury test vector. |
| `cd pop/appeals/contract && cargo test` | 10 passed. |

`node pop/appeals/scripts/run.mjs` repeats the live run with new faucet accounts. It refuses `mainnet`.

## This run

Recorded on 13 November 2026.

| | |
| --- | --- |
| Appeals contract | [`popa-mwfhb3x4.testnet`](https://testnet.nearblocks.io/address/popa-mwfhb3x4.testnet) |
| Jury (same wasm as the published Lock jury) | [`popaj-mwfhb7wi.testnet`](https://testnet.nearblocks.io/address/popaj-mwfhb7wi.testnet) |
| Failed delivery, worker wins, 0.15 NEAR paid | [ENnertbw2yt4EZQRpnNznNauZ1nz7zqFRCk3f7wWmyhT](https://testnet.nearblocks.io/txns/ENnertbw2yt4EZQRpnNznNauZ1nz7zqFRCk3f7wWmyhT) |
| Failed delivery, buyer wins, 0.15 NEAR refunded | [WNFCFi8hUcUnEMHmAyspSkjTRMn6uw5V1uBreyknTHX](https://testnet.nearblocks.io/txns/WNFCFi8hUcUnEMHmAyspSkjTRMn6uw5V1uBreyknTHX) |
| Jury full-access key deleted before the dispute | [AoD5xzgYP11Dgyc9KV1p1SaRpTguwwS9Z6TaH9QjsaFu](https://testnet.nearblocks.io/txns/AoD5xzgYP11Dgyc9KV1p1SaRpTguwwS9Z6TaH9QjsaFu) |
| Appeals full-access key deleted before the jobs | [3KDa2S5S1qpT1Mmuj3HmM2uJR7w5UMALeX29zaQwXUZD](https://testnet.nearblocks.io/txns/3KDa2S5S1qpT1Mmuj3HmM2uJR7w5UMALeX29zaQwXUZD) |

## Keys

The jury and the appeals contract delete their full-access keys before the jobs run. The appeals contract keeps one function-call key for `post_job`, `hire`, and `cancel_job`. That key cannot transfer NEAR. Its secret is not in this repository. After the run, the worker, the buyer, and the six jurors have no full-access key. The delete transactions are in `run.json`. Local secrets, if a run is still in progress, sit in `pop/appeals/.keys/`, which git ignores.
