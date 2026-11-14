# Board

A public page of Pay on Proof jobs, payouts, refusals, disputes and rulings. The credit score and the group pool are testnet contracts. Nothing here signs a mainnet transaction.

Preview, unclaimed, expires about one hour after 2026-11-13 22:08 UTC: https://flying-lilac-3g9cfwy.tmp.now/

The page files are `public/index.html` and the modules next to it. Any static host can serve that directory. `sources.json` points at the contracts.

The page reads:

| Source | Account |
| --- | --- |
| Mainnet escrow | `ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827` |
| Testnet hire | `v2-contract-mwfheysi.testnet` |
| Testnet appeals | `popa-mwfhb3x4.testnet` |
| Credit score | [`credit-mwfihpbk.testnet`](https://testnet.nearblocks.io/address/credit-mwfihpbk.testnet) |
| Group pool | [`pool-mwfihwq0.testnet`](https://testnet.nearblocks.io/address/pool-mwfihwq0.testnet) |

`sources.json` field `xFeed` is null until the X-reply flow publishes a URL. Opening the page with `?x=` uses that URL instead. The body is `{ "source": "pop-x", "events": [ ... ] }`. Each event has `type` (`job`, `payout`, `refusal`, `dispute`, or `ruling`), `at` (ISO 8601), `agent`, `near` (yocto string or null), `title`, `detail`, `pass`, `tx`, and `url`. On Vercel, `/api/x?u=` fetches that URL. A missing feed leaves the chain sections up.

## Do this, see this

| Do this | See this |
| --- | --- |
| Open the board | Jobs, payouts, refusals, disputes and rulings from mainnet, hire and appeals. Leaderboards for NEAR earned and check pass rate. |
| `node pop/board/scripts/verify.mjs` | Read-only checks, no key. It recomputes the credit rows from hire and appeals. |
| `node pop/scripts/verify.mjs mainnet` | `all 14 checks passed`. |
| Open [the refused large stake](https://testnet.nearblocks.io/txns/4CMDgsCJ99k8ercyLNQtcFuHzGDTwfyDyKxPQDZmCUyp) | A new account stakes above 0.02 NEAR. The contract panics `score too low for this budget`. |
| Open [the short deposit](https://testnet.nearblocks.io/txns/12N12ZHYcP6NLFEWtabRJFChjvhY8vfSHHcmypPh6qEV) | The same account attaches less than 0.05 NEAR for a 0.02 NEAR job. The contract panics `deposit too small for this score`. |
| Open [the accepted stake](https://testnet.nearblocks.io/txns/HtXQUthYEnyQj2EKXxQT6nNYdBaB33FjP6Nt7pJeJbMF) | Score 0, budget 0.02 NEAR, deposit 0.05 NEAR. The stake is recorded. [Refund](https://testnet.nearblocks.io/txns/6ncFcBLWeGjoyqvURte6u47TLBpuv4CnMEjKA61W6QPV) returns it. |
| Open [the high-score probe](https://testnet.nearblocks.io/txns/CwAD77gY28EEMZyc3hRPsnQ4UzhfrXeSt4CMRWcJ43S7) | `crew.v2-parent-mwfhf2kc.testnet` has one pass, score 10. A 0.22 NEAR job with a 0.01 NEAR deposit is allowed. |
| Open [the low-score refusal](https://testnet.nearblocks.io/txns/CCqyD3cH6zSRwGvQChcGo76S67WqxpVXy5rn6gD4KHu4) | `popaw-mwfhbbyw.testnet` has two fails, one jury win and one jury loss, score -13. A job above 0.01 NEAR panics. [The 0.01 NEAR probe](https://testnet.nearblocks.io/txns/62SSXmESFK3ASXPmnwVTmUhMLawsBaoJ7NvVfXb2YLy6) with a 0.102 NEAR deposit is allowed. |
| Open [the bad roster](https://testnet.nearblocks.io/txns/FrDN3RGDhkBLVNQmPsXYwtZcHjUptLcCjAJpMau1bnEG) | The pool's hired agent delivers a roster outside the spec. The check fails and nothing is paid. |
| Open [the paid roster](https://testnet.nearblocks.io/txns/8RCdvpEv78qyunxxhMUTZ7JrBcarenm9ZiKy4SXfpJXS) | The same agent delivers a roster inside the spec. The contract transfers 0.15 NEAR. |
| Open [the DAO proposal that paid in](https://testnet.nearblocks.io/txns/44ty7GeA15456FLaAeK7rkDo9H1cmVg9Yg1c1Geo1w8U) | Council vote on `pbmwfikb3e.sputnikv2.testnet`. Status Approved. The DAO is a funder of 0.2 NEAR. |

`pop/board/run.json` is the same record.

## Credit rule

The contract reads the locked hire and appeals contracts. It does not take a caller's word for a pass or a fail. A pass adds 10. A fail subtracts 8. A jury win (`paid`) adds 15. A jury loss (`refunded`) subtracts 12.

Score 0 caps a job at 0.02 NEAR and requires a 0.05 NEAR deposit. Each point above zero adds 0.02 NEAR to the cap and removes 0.004 NEAR from the deposit, down to 0.001 NEAR. Each point below zero caps the job at 0.01 NEAR and adds 0.004 NEAR of deposit per point. The page recomputes the same numbers from the receipts.

The older testnet escrow `pop-mwbiijzv.testnet` is not a source. It still has a full-access key.

## Group pool

Three faucet accounts each attached 0.2 NEAR. The Sputnik DAO `pbmwfikb3e.sputnikv2.testnet` attached 0.2 NEAR after an approved proposal. A funder opened a roster job for 0.15 NEAR. The worker's first delivery failed the check and was not paid. The second passed and was paid.

The first DAO proposal, [AryNSMRc…](https://testnet.nearblocks.io/txns/AryNSMRcBfFDL17Vepw6Z6HxnHkggsNmCW18QtnvQpyg), expired. Its vote landed after the 20 second period, so the DAO paid nothing on that proposal. The second proposal was voted by both council members during the period.

## Keys

The credit contract and the pool deleted their full-access keys.

| Account | Full-access key still on chain |
| --- | --- |
| `credit-mwfihpbk.testnet` | No. Deleted in [7zF3kift…](https://testnet.nearblocks.io/txns/7zF3kift5PYTWug9kgLgcjjKJ6SLoAxKSqzfLQ8AdF4f). Public key that was deleted: `ed25519:6qMyMputgPU9U2WA7toYgKzLSPRAJ2CDwoJjQRj8tewi`. |
| `pool-mwfihwq0.testnet` | No. Deleted in [86x35Dhx…](https://testnet.nearblocks.io/txns/86x35DhxCDRVbHjn56w5acUCPehN3yeswNT3vt71DMhW). Public key that was deleted: `ed25519:AhfStaEhzD9WsSn7o4JcPDpdSCstMpTvuub44VhAUyCD`. |
| `novice-mwfiht41.testnet` | Yes. `ed25519:HD33nH4FBbt4wTs35tXAXn78zYHcXB8D2D94WK3MozhB`. |
| `funder-a-mwfii00j.testnet` | Yes. `ed25519:J3w58j4YPFGAiztp61FmB13ycEYGDMauwToxDdNEU5FE`. This account is also the pool beneficiary and can call `close`. |
| `funder-b-mwfii3f1.testnet` | Yes. `ed25519:77xSTW2w5xfAt5CkxPr55zDBmH94nU4ZFo96r7QCiuVc`. |
| `funder-c-mwfii780.testnet` | Yes. `ed25519:7tDysCrTFdQF5EN4TQe7Y5RWR7F9Cmy37Gkxh7yiYLYG`. |
| `worker-mwfiiauj.testnet` | Yes. `ed25519:CZEqzxofNYgdxZakaerBDnSEf8vvkE5L83sDThztXUed`. It holds the 0.15 NEAR payout. |

No secret is in the repo. The secrets for these accounts, including the deleted contract keys, are in `pop/board/.keys/testnet.json`, which git ignores. The DAO has no full-access key. Its council is funder A and funder B.

## Checks

```sh
node pop/board/scripts/verify.mjs
node --test pop/board/test/*.test.mjs
cd pop/board/credit/contract && cargo test
cd pop/board/pool/contract && cargo test
```

To run the flow again, build needs the wasm32 target and `npm ci` in `pop/`. The script refuses `mainnet`. A second run reuses the accounts in `.keys/` and will not deploy over a locked contract.

```sh
cd pop && npm ci
node pop/board/scripts/run.mjs
```
