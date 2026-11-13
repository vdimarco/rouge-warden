# Hire a second agent

Testnet only. This does not change the locked mainnet contract. `node pop/scripts/verify.mjs mainnet` still checks that contract.

One Pay on Proof job hires a second agent. The parent is hired at 0.5 NEAR. That price is a cap in the contract. The function-call key's allowance only pays gas. The parent account has one function-call key, for this contract only, and no full-access key. It posts a sub-job for 0.2 NEAR. The worker is the sub-account `crew.<parent>`. The contract checks the roster and pays the sub-agent 0.2 NEAR from the parent's cap. The parent then delivers a map. The contract checks it and pays the parent the remaining 0.3 NEAR as wNEAR in a testnet stand-in for NEAR Intents. A sub-job of 0.6 NEAR is refused.

## Do this, see this

| Do this | See this |
| --- | --- |
| `node pop/hire/scripts/verify.mjs` (Node 18 or newer, no install, no key) | 20 lines that start with `ok`, then `all 20 checks passed`. |
| Open [the refused overspend](https://testnet.nearblocks.io/txns/993mdvTjAZr8q9vDL31i9zH2VtAH3UTrc1h8WcX9X4WX) | The parent asks for a 0.6 NEAR sub-job. The contract panics `over the cap`. Nothing is reserved and nothing is paid. The signer is the parent's function-call key. |
| Open [the parent account](https://testnet.nearblocks.io/address/parent-mwfh35a0.testnet) and its keys | One key. It is a function-call key for `bid`, `post_subjob`, `hire_sub`, `cancel_subjob`, and `deliver` on the hire contract. There is no full-access key. |
| Open [the sub-agent payment](https://testnet.nearblocks.io/txns/G58fD5znJH6iDJENURKCJ9PRcoamhNTrWkTYFVPyq3DF) | The roster check passes. The contract transfers 0.2 NEAR to `crew.parent-mwfh35a0.testnet`. |
| Open [the parent payment](https://testnet.nearblocks.io/txns/9mZpdSrtDfXTrixodZB1Vkz5qYhjQKyMqNjrA7M4DXwD) | The map check passes. The contract wraps 0.3 NEAR and the intents stand-in credits the parent. |
| Open [the contract](https://testnet.nearblocks.io/address/contract-mwfh2uli.testnet) | Spent 0.5000 NEAR, reserved 0, cap 1.0000. No full-access key. |

The parent key was also asked to transfer 0.01 NEAR to the beneficiary. The protocol refused it before the transaction was included: `Access key requires full access`. There is no hash to open. The key list above is the check that it cannot spend outside the contract.

## Accounts and keys

| Account | Role | Key on chain |
| --- | --- | --- |
| `contract-mwfh2uli.testnet` | Hire contract | Function-call only. Full-access key deleted in [GmqqUHCQ…](https://testnet.nearblocks.io/txns/GmqqUHCQ9ztvVeCyoFXYik4z8Hn1p17oLoL1qTyLCtpr). Public key that was deleted: `ed25519:FCg2Q9ogqj4tWDiiSe1owMjcekqN2HtzZXpwgUnjHHxH`. |
| `parent-mwfh35a0.testnet` | Parent agent | Function-call only. Full-access key deleted in [FKnweN2c…](https://testnet.nearblocks.io/txns/FKnweN2cydpgyQNAuKZbabRrnWq8pM6TPr3J1Z5p45L1). Public key that was deleted: `ed25519:HHVMhMy3Sp4EnSH7yoA4esDmfLKBz2QHevLEAPaANSop`. Function-call public key: `ed25519:5UAGhV3kxu9JH569jWrapF7FPzckE4JirxqJRombFNr`. |
| `crew.parent-mwfh35a0.testnet` | Sub-agent | Full-access key `ed25519:HUfAXXHAjxMDRxVTPohKsE1D9nuCp3dP7YRThW7hxYTh`, so it can deliver and hold the 0.2 NEAR. |
| `ben-mwfh2ybi.testnet` | Beneficiary | Full-access key `ed25519:GnadnU5xUmafTYK3dqLN1S5qHNHsJtohthZL8uyk8kxv`. It can call `close`. |
| `intents-mwfh31oc.testnet` | Mock NEAR Intents | Full-access key `ed25519:4Lcyut4is8eN5rgQQv2fDckgQ5HxDgEKojkVNLiE8NMu`. |

No secret is in the repo. Every secret from this run is in `pop/hire/.keys/testnet.json`, which git ignores. That file includes the full-access secrets for the sub-agent, the beneficiary, and the mock intents account, and the deleted full-access secrets of the contract and the parent.

## Transactions

| Step | Hash |
| --- | --- |
| Create the sub-account | [8Qfa6zBT…](https://testnet.nearblocks.io/txns/8Qfa6zBT8oony2PdJ8is1Qiv5ZiQjR4Fbo2532B8Tqk2) |
| Add the parent's function-call key | [9QS6z4bN…](https://testnet.nearblocks.io/txns/9QS6z4bNMp5tGKMys5qajQLZNxgFZgnXJSuwBsjWqrDX) |
| Delete the parent's full-access key | [FKnweN2c…](https://testnet.nearblocks.io/txns/FKnweN2cydpgyQNAuKZbabRrnWq8pM6TPr3J1Z5p45L1) |
| Post the parent job (0.5 NEAR) | [6CacHMav…](https://testnet.nearblocks.io/txns/6CacHMavRfHL2ftKwJf4LF5PtddghWGa2aP4B7wkMCg5) |
| Parent bids with the function-call key | [C4AbCgMu…](https://testnet.nearblocks.io/txns/C4AbCgMub5aVWHZwDzRGoPZFZCUp4MCgBJo1Agmdz6fg) |
| Warden hires the parent | [99QCMcus…](https://testnet.nearblocks.io/txns/99QCMcusgxzLm65RYz6EZgR8Nsr93coBVwbjaVCx4yZ5) |
| Refused overspend (0.6 NEAR) | [993mdvTj…](https://testnet.nearblocks.io/txns/993mdvTjAZr8q9vDL31i9zH2VtAH3UTrc1h8WcX9X4WX) |
| Post the sub-job (0.2 NEAR) | [DFoMuAJd…](https://testnet.nearblocks.io/txns/DFoMuAJdMp7Ux2Ci2ZFHdrWmcQWywGSK9SUXbQsWdbf8) |
| Sub-account bids | [B3ht3aMc…](https://testnet.nearblocks.io/txns/B3ht3aMcxGi1Dog3yjx1v6R4FwGCyg8w3uXxGqQFmfkc) |
| Parent hires the sub-account | [7V3DS5fZ…](https://testnet.nearblocks.io/txns/7V3DS5fZZVGMAC36oGgmqCxSAvgEjPtFFZcMuy8NnNBQ) |
| Sub-agent delivers and is paid 0.2 NEAR | [G58fD5zn…](https://testnet.nearblocks.io/txns/G58fD5znJH6iDJENURKCJ9PRcoamhNTrWkTYFVPyq3DF) |
| Parent delivers and is paid 0.3 NEAR | [9mZpdSrt…](https://testnet.nearblocks.io/txns/9mZpdSrtDfXTrixodZB1Vkz5qYhjQKyMqNjrA7M4DXwD) |

`pop/hire/run.json` is the same record, read by the verifier.

## Checks

```sh
node pop/hire/scripts/verify.mjs
cd pop/hire/contract && cargo test
```

`cargo test` is 10 tests: both payouts, the cap, a second sub-job past what is left, a stranger who is not a sub-account, a failed delivery that pays nothing, and the global cap.

To run the flow again on testnet, build both wasm files and run the script. It refuses `mainnet`.

```sh
cd pop/hire/contract && RUSTFLAGS='--cfg near' cargo build --target wasm32-unknown-unknown --release
cd pop/mock-intents && RUSTFLAGS='--cfg near' cargo build --target wasm32-unknown-unknown --release --locked
node pop/hire/scripts/run.mjs
```

A second run needs an empty `pop/hire/.keys/`, or it continues the recorded accounts. NEAR Intents has no testnet, so the parent payout uses `mock-intents` and `wrap.testnet`.
