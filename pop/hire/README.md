# Hire a second agent

Testnet only. This does not change the locked mainnet contract. `node pop/scripts/verify.mjs mainnet` still checks that contract.

One Pay on Proof job hires a second agent. The parent is hired at 0.5 NEAR. That price is a cap in the contract. The function-call key's allowance only pays gas. The parent account has one function-call key, for this contract only, and no full-access key. It posts a sub-job for 0.2 NEAR. The worker is the sub-account `crew.<parent>`. The contract checks the roster and pays the sub-agent 0.2 NEAR from the parent's cap. The parent then delivers a map. The contract checks it and pays the remaining 0.3 NEAR to an owner account named on the bid. The owner is not the locked parent. The owner has a full-access key and spends 0.05 NEAR of what it received. A sub-job of 0.6 NEAR is refused. The parent key cannot change the owner, and it cannot transfer.

## Do this, see this

| Do this | See this |
| --- | --- |
| `node pop/hire/scripts/verify.mjs` (Node 18 or newer, no install, no key) | 22 lines that start with `ok`, then `all 22 checks passed`. |
| Open [the refused overspend](https://testnet.nearblocks.io/txns/BEvVCHSzQBWcMU9Zq7t2giSd1kJACFJPSpmyLnvLhMi) | The parent asks for a 0.6 NEAR sub-job. The contract panics `over the cap`. Nothing is reserved and nothing is paid. The signer is the parent's function-call key. |
| Open [the parent account](https://testnet.nearblocks.io/address/v2-parent-mwfhf2kc.testnet) and its keys | One key. It is a function-call key for `bid`, `post_subjob`, `hire_sub`, `cancel_subjob`, and `deliver` on the hire contract. There is no full-access key. |
| Open [the sub-agent payment](https://testnet.nearblocks.io/txns/8waa1NgdgMZKHGr17s73hCwWmk5BrMQeP6TnNYSEGuzN) | The roster check passes. The contract transfers 0.2 NEAR to `crew.v2-parent-mwfhf2kc.testnet`. |
| Open [the owner payment](https://testnet.nearblocks.io/txns/A6VKi1eH7AYQUerWZZNikvTHEikwXXgNJD16nPLesiCd) | The map check passes. The contract transfers 0.3 NEAR to `v2-owner-mwfhf65k.testnet`. The parent's balance does not receive it. |
| Open [the owner's spend](https://testnet.nearblocks.io/txns/HqcztZQ5JCY2oZ6iobsTw5grsiu2Tvgg8PR3Rck6tFkJ) | The owner sends 0.05 NEAR to the beneficiary. The transfer succeeds. |
| Open [the contract](https://testnet.nearblocks.io/address/v2-contract-mwfheysi.testnet) | Spent 0.5000 NEAR, reserved 0, cap 1.0000. No full-access key. |

The parent key was also asked to transfer 0.01 NEAR. The protocol refused it before the transaction was included: `Access key requires full access`. There is no hash to open.

## Accounts and keys

| Account | Role | Key on chain |
| --- | --- | --- |
| `v2-contract-mwfheysi.testnet` | Hire contract | Function-call only. Full-access key deleted in [5f7H4wHi…](https://testnet.nearblocks.io/txns/5f7H4wHitCMZLSvkQ6GcjaaGixpCLyvaH7tEYQmLWbhy). Public key that was deleted: `ed25519:56CFAapVUzFwtTxQr8YhA4riWSKuevD4nwAbftRDHG8K`. |
| `v2-parent-mwfhf2kc.testnet` | Parent agent | Function-call only. Full-access key deleted in [GRGWUXm5…](https://testnet.nearblocks.io/txns/GRGWUXm5dpvTnW5a84x5a2a1FpnwGhxeKmAEPn5tBHqj). Public key that was deleted: `ed25519:GrtHfkv9mDrRzjocj1SRYB7oobgAYKV8o6KnMYT9xeaL`. Function-call public key: `ed25519:47uGSGgw7QNzuC9NSRdCXajzXGCa1FQ9xSwVLG6sp4CB`. |
| `v2-owner-mwfhf65k.testnet` | Owner, receives the parent's 0.3 NEAR | Full-access key `ed25519:7oea3M7RAgk17hfayUB8M1EfW71RTJh8SqqyTYgLshad`. |
| `crew.v2-parent-mwfhf2kc.testnet` | Sub-agent | Full-access key `ed25519:BWz6u14sJnmgEs4wvC7VkDLZk869SFtxkXxbpVBo6Tq6`, so it can deliver and hold the 0.2 NEAR. |
| `ben-mwfh2ybi.testnet` | Beneficiary | Full-access key `ed25519:GnadnU5xUmafTYK3dqLN1S5qHNHsJtohthZL8uyk8kxv`. It received the owner's 0.05 NEAR spend. It can call `close`. |
| `intents-mwfh31oc.testnet` | Mock NEAR Intents, unused by this payout | Full-access key `ed25519:4Lcyut4is8eN5rgQQv2fDckgQ5HxDgEKojkVNLiE8NMu`. |

No secret is in the repo. Every secret from this run is in `pop/hire/.keys/testnet.json`, which git ignores. That file includes the full-access secrets for the owner, the sub-agent, the beneficiary, and the mock intents account, and the deleted full-access secrets of the contract and the parent.

## Transactions

| Step | Hash |
| --- | --- |
| Create the sub-account | [FneoFhcf…](https://testnet.nearblocks.io/txns/FneoFhcf4MN9oi8vYtozNiPjdqWXgkZonnGRuX6QkHeV) |
| Add the parent's function-call key | [82XJq4TQ…](https://testnet.nearblocks.io/txns/82XJq4TQXSfVrbmaL4Xt8Brp52uh4xaCDkfRBcybehXK) |
| Delete the parent's full-access key | [GRGWUXm5…](https://testnet.nearblocks.io/txns/GRGWUXm5dpvTnW5a84x5a2a1FpnwGhxeKmAEPn5tBHqj) |
| Post the parent job (0.5 NEAR) | [A4Qv8tZM…](https://testnet.nearblocks.io/txns/A4Qv8tZM4QpyTiuQbLydbdiMnR6gvEbeLpTBT9iRTLHP) |
| Parent bids, naming the owner | [7y74Xjox…](https://testnet.nearblocks.io/txns/7y74XjoxFKr6seQcG1CN2Lh6LhdvqAd9eYF3z13F14Gq) |
| Warden hires the parent | [BdXeUQRi…](https://testnet.nearblocks.io/txns/BdXeUQRieHdkDQwMJKx8M7D27RBvngVa3SqSLnhE3Hfa) |
| Refused overspend (0.6 NEAR) | [BEvVCHSz…](https://testnet.nearblocks.io/txns/BEvVCHSzQBWcMU9Zq7t2giSd1kJACFJPSpmyLnvLhMi) |
| Post the sub-job (0.2 NEAR) | [DEVmAya3…](https://testnet.nearblocks.io/txns/DEVmAya3bKAaY8mPKPWtNmnGSEXpsLjnZWnqcnrReiEx) |
| Sub-account bids | [5jkS41gG…](https://testnet.nearblocks.io/txns/5jkS41gGmW7vrSd9bNaKuZvjGoG7ordh2tUKzLtsTZgW) |
| Parent hires the sub-account | [3UfRHDxp…](https://testnet.nearblocks.io/txns/3UfRHDxpcyzuaSZSqiBKzsrB94DBze8YeJAq636Prja9) |
| Sub-agent delivers and is paid 0.2 NEAR | [8waa1Ngd…](https://testnet.nearblocks.io/txns/8waa1NgdgMZKHGr17s73hCwWmk5BrMQeP6TnNYSEGuzN) |
| Parent delivers and the owner is paid 0.3 NEAR | [A6VKi1eH…](https://testnet.nearblocks.io/txns/A6VKi1eH7AYQUerWZZNikvTHEikwXXgNJD16nPLesiCd) |
| Owner spends 0.05 NEAR | [HqcztZQ5…](https://testnet.nearblocks.io/txns/HqcztZQ5JCY2oZ6iobsTw5grsiu2Tvgg8PR3Rck6tFkJ) |

`pop/hire/run.json` is the same record, read by the verifier.

## Checks

```sh
node pop/hire/scripts/verify.mjs
cd pop/hire/contract && cargo test
```

`cargo test` is 11 tests: both payouts, the owner as payee, the cap, a second sub-job past what is left, a stranger who is not a sub-account, a parent that cannot name itself as owner, a failed delivery that pays nothing, and the global cap.

To run the flow again on testnet, build the hire wasm and run the script. It refuses `mainnet`. A second run continues the v2 accounts in `pop/hire/.keys/`.

```sh
cd pop/hire/contract && RUSTFLAGS='--cfg near' cargo build --target wasm32-unknown-unknown --release
node pop/hire/scripts/run.mjs
```

The first recorded contract, `contract-mwfh2uli.testnet`, paid the parent in wNEAR on the locked account. That deployment is unchanged and is not what the verifier reads.
