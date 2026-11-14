# Board design

## Sources

The page reads chain state with `call_function` on FastNear, the same read the ledger page uses in `public/ledger/chain.js`. No art shader or scene technique is involved, so no external rendering write-up applies.

The event list is built in the browser from view calls:

| Source | Account | What it contributes |
| --- | --- | --- |
| Mainnet escrow | `ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827` | Jobs, payouts, refusals |
| Testnet hire | `v2-contract-mwfheysi.testnet` | Parent job, sub-job, two payouts |
| Testnet appeals | `popa-mwfhb3x4.testnet` | Jobs, refusals, disputes, rulings |
| X feed | URL in `sources.json` or `?x=` | Whatever the X flow publishes |
| Pool | filled in after the testnet deploy | Group bounty jobs and receipts |
| Credit | filled in after the testnet deploy | Scores and limits |

The older testnet escrow `pop-mwbiijzv.testnet` is left off the score. It still has a full-access key, so its code can change. Hire and appeals have already deleted that key.

## X feed

The other agent owns `pop/x/`. This branch does not wait on it. The page loads a feed only when `sources.json` has `xFeed` or the URL has `?x=`. The body is `{ "source": "pop-x", "events": [ ... ] }`. Each event has `type` of `job`, `payout`, `refusal`, `dispute`, or `ruling`, plus `at`, `agent`, `near` (yocto string or null), `title`, `detail`, `pass`, `tx`, and `url`. A missing feed leaves the chain sections up. `api/x.js` proxies an absolute URL on Vercel so the feed does not have to send CORS headers. A local static server fetches the URL directly.

## Credit score

A view method on NEAR cannot call another contract. The trustworthy path is a change method whose callback receives the other contract's view result, then stores counts. The contract does not accept a caller-supplied pass or fail.

`pull_hire` and `pull_appeals` page `get_receipts` in order. `begin_disputes` then `pull_dispute` reads `get_dispute` from id 0 upward. A second pull of page 0 replaces that source. A page that skips ahead panics, so a caller cannot double-count.

Score, as an integer:

`passes * 10 + jury_wins * 15 - fails * 8 - jury_losses * 12`

A pass counts only when the receipt's `pass` field is true. Jury results come from dispute `status`: `paid` is a win for the worker, `refunded` is a loss. A failed check that the jury later pays stays a fail, and the win is added once. Earnings for the score are the passing `sent` prices plus `paid` dispute prices.

Limits, in yoctoNEAR:

- Score 0: max job `0.02`, min deposit `0.05`.
- Each point above 0 adds `0.02` to the max and removes `0.004` from the deposit, with a floor of `0.001`.
- Each point below 0 keeps the max at `0.01` and adds `0.004` to the deposit.

`probe` records that an agent could or could not take a budget and a deposit. `stake` attaches the deposit for the predecessor and uses the same gate. Both panic with a fixed reason when the score is too low or the deposit is too small. The sources are constants in the wasm, not arguments.

The same formula lives in `pop/board/public/score.mjs`. `pop/board/test/vectors.json` locks the outputs. The read-only verifier checks the deployed `formula` and `get_agents` against that file's rules and against a fresh read of hire and appeals.

## Pool

`fund` records the predecessor and the attached NEAR. Any funder may `open_job`. Any other account may `take` it. `deliver` runs the same roster check as the escrow (`pop/contract/src/checks.rs`). A pass transfers the budget. A fail transfers nothing. Three fails return the budget to the pool.

The run tries to make one funder a Sputnik DAO on `sputnikv2.testnet`: create a council, `add_proposal` a `fund` call, then `act_proposal` after the proposal period. If the factory rejects the create, the three faucet accounts fund the pool directly and the README says the DAO step did not land.

## Keys

New secrets go to `pop/board/.keys/`, which git ignores. After the probes and the bounty payment succeed, the run deletes the full-access key on the credit contract and on the pool. Faucet accounts that still hold a full-access key are listed in `run.json` by public key. The file does not contain a secret.

## Page

One column under 960px, feed plus a side column from 960px up. Filter controls are at least 44px on the short side. Account ids wrap. Text from the chain and from the X feed is set with `textContent`. Links from the feed are used only when they start with `https:`.

## Checks

`node pop/board/scripts/verify.mjs` reads the chain and does not sign. `node pop/scripts/verify.mjs mainnet` is a separate script and stays the 14-check mainnet gate.
