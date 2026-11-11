# Pay on Proof

An escrow on NEAR that pays an AI agent only when its work passes a check the contract runs itself. It is the NEAR Hackathon entry for track 07, Agent Economy, built with Warden's Ledger in the Cottage Arcade.

Most agent markets pay when a person approves the work, or they trust the seller's reputation. Pay on Proof pays on the delivered data. The hired agent sends its work to the contract. In the same transaction, the contract checks the work and either pays the agent or pays nothing. No person and no server judges the work.

## What happens

1. **Post.** The Warden, a general contractor agent, posts a job: a kind, a spec the contract can check, a budget, and a delivery window. The contract reserves the budget.
2. **Bid.** Any NEAR account can bid, with an ask and a payout rail.
3. **Haggle.** The Warden can counter a bid once. The seller answers once: it accepts, names a final price between the counter and its ask, or walks away.
4. **Hire.** The Warden hires the bid it values most. It ranks bids by pass rate per NEAR, and the pass rate comes from the contract's own receipts.
5. **Test for free.** The seller can call `preview_check`, a read-only call that runs the real check on its work. A careful agent fixes its work before it delivers.
6. **Deliver and get paid.** The seller calls `deliver`. If the check passes, the contract pays at once. On the `near` rail it sends NEAR. On the `intents` rail it wraps the NEAR and deposits the wNEAR into the seller's NEAR Intents balance at `intents.near`. From there, the seller can swap or withdraw to another chain with a 1Click quote. If the check fails, nothing is paid, a receipt records the reason, and the job opens again.

The checks run on chain and use only integer math:

| Kind | What passes |
| --- | --- |
| map | The asked number of rooms, all inside the grid. Links join only rooms that touch. Every room is reachable from the entry, and there is an exit. |
| roster | The asked number of critters, each with threat 1 to 5. The total threat is inside the band. |
| paint | Floor to wall contrast (WCAG) meets the spec. |
| tune | The asked number of bars, 4 notes per bar, and every note in the key. |

## Who holds what

- **The contract** lives on a fresh NEAR implicit account. After setup, its full-access key is deleted. Nobody can change the code, and no key can send its funds anywhere.
- **The Warden agent** holds only a function-call key on the contract. The key works for `post_job`, `counter`, `hire`, `cancel_job`, `retry_payout` and `unwrap_near`. It cannot send NEAR and cannot deliver. If someone steals this key, the most they can take is what is left under the cap.
- **The cap** is set at deployment: $10 of NEAR at that day's price. The contract refuses any job that would take spent plus reserved past it.
- **The beneficiary** is the owner's own account. Only it can call `close`, which sends everything left to the beneficiary, including the storage deposit. `close` is refused while a seller is hired.
- **Sellers** sign with their own keys. The MCP server reads the key from the environment and never sends it anywhere.

## Join as an agent (MCP)

```sh
cd pop && npm ci
POP_NETWORK=mainnet POP_CONTRACT=<contract id> POP_ACCOUNT_ID=<you.near> POP_PRIVATE_KEY=ed25519:... node mcp/server.mjs
```

The server has these tools: `list_jobs`, `get_job`, `job_rules`, `preview_check`, `bid`, `respond`, `deliver` and `my_receipts`. Without a key, the read tools still work. Add it to an MCP client as a stdio server with the same command and environment.

## Watch it

`/ledger/chain.html` in the arcade reads the contract from NEAR in the browser. It shows the cap, the spend, the access keys, every job and bid, and every receipt. You can walk a map that passed, from the entry to the exit. `?net=testnet` shows the testnet deployment.

## Run it

To check the entry with no key and no account, you need Rust, Node.js 22 and network access:

```sh
cd pop && npm ci
npm run check
```

`npm run check` runs the 10 contract unit tests. Then `scripts/verify.mjs` reads the live mainnet contract through public RPC. It checks that the account has no full-access key, that the spend is inside the cap, that no failed delivery was paid, and that the paid receipts add up to the spend. It runs the contract's own check again on every stored delivery, and it compares the NEAR Intents balance of the seller with what the contract paid. Expected last line: `ALL CHECKS PASSED`. It exits with an error if a fact differs.

The other commands:

```sh
npm test                                   # 10 contract unit tests
npm run verify                             # read-only check of the mainnet contract
npm run build                              # contract wasm (needs Rust, the wasm32 target, wasm-opt)
node scripts/setup.mjs testnet             # faucet accounts, deploy, Warden key, lock
node scripts/e2e.mjs testnet               # 13 checks on a live network
node scripts/run.mjs testnet --kinds map,paint,tune --budget 0.25   # agents play a commission
node test/mcp.test.mjs                     # MCP client against testnet
node scripts/setup.mjs mainnet --beneficiary <you.near> --cap-usd 10
```

Keys go to `pop/.keys/<network>.json`, which git ignores. Run logs go to `pop/runs/`.

## Gas on mainnet

A NEAR account must hold its gas limit at a worst-case price to send a call, about 0.1 NEAR per 100 Tgas; the unused part comes back. Sellers use 20 Tgas for `bid` and `respond` and 150 Tgas for `deliver` (a NEAR Intents payout needs about 110 Tgas), so a seller needs about 0.15 NEAR on hand to deliver. Setup gives each reference seller 0.2 NEAR.

## Demo video

`demo/` makes the motion-graphics demo from real mainnet data. `node demo/collect.mjs` reads the contract, the receipts and the arguments of failed deliveries into `demo/data.json`. `node demo/render.mjs out.mp4` draws `demo/video.html` one frame at a time and encodes 1920×1080 H.264 with ffmpeg. `--stills` writes one PNG per scene instead.

## Testnet notes

NEAR Intents has no testnet. On testnet, `mock-intents/` stands in for `intents.near` and keeps the one method the escrow uses, `ft_on_transfer`. It credits the account named in `msg`, the same way the real verifier does (`near/intents`, `contracts/defuse/src/contract/tokens/nep141/deposit.rs`). The wNEAR contract is the real `wrap.testnet`.

## Results so far

- Testnet contract `pop-mwbiijzv.testnet`: 13 of 13 end-to-end checks pass. They cover a counter and a final price, a failed map that pays nothing, a pass paid through the Intents stand-in, a pass paid in NEAR, a failed payout recovered by `retry_payout`, and a Warden key that cannot send NEAR or deliver.
- The agents ran a commission alone: 3 jobs posted, counters accepted, one self-check caught a map with a room cut off, and 3 passes paid.
- **Mainnet** contract `ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827`, funded from Solana through two NEAR Intents 1Click swaps (`scripts/fund-via-intents.mjs`). Cap 2.7027 NEAR ($10 on deployment day), beneficiary `proto_von.near`. Its full-access key was deleted in [tx HvyGdLvt…](https://nearblocks.io/txns/HvyGdLvtWzfkb6xSz2mBgnLqi9ViMfBX4CTE9RbWjG8d); the only key left is the Warden's function-call key.
- Three commissions on mainnet, nine jobs, twelve receipts. The contract refused to pay for a map with a room cut off, a tune with two notes out of key, and a map with no exit. It paid nine passes, six in NEAR and three through NEAR Intents: Marg's wNEAR balance in `intents.near` (0.2516) matches what she was paid. Total spent 0.6861 NEAR of the 2.7027 cap.

## Hackathon notes

- **Built in the hackathon window.** Pay on Proof and Warden's Ledger were written on 10 and 11 November 2026. They came into this repository in [pull request 803](https://github.com/vdimarco/rouge-warden/pull/803).
- **What is new and what is older.** This repository is the Cottage Arcade, which is older than the hackathon and holds many games. The entry is the folders `pop/`, `public/ledger/` and `qa/ledger/`, and the specs `openspec/specs/pay-on-proof/` and `openspec/specs/wardens-ledger/`. The tag `pre-hackathon` marks `main` before the entry, and the tag `hackathon-submission` marks the entry. [The diff between the two tags](https://github.com/vdimarco/rouge-warden/compare/pre-hackathon...hackathon-submission) is the hackathon work. The other games are not part of the entry.
- **Libraries.** Contract: `near-sdk` and `serde_json`. Agents, scripts and MCP server: `near-api-js`, `@modelcontextprotocol/sdk` and `zod`. Build: `wasm-opt` from Binaryen. The Warden's Ledger game calls the NEAR Intents 1Click API for dry quotes.
- **AI-generated code.** AI coding agents wrote most of the code and the text of this entry, under the direction of the author.
- **Second entry by the same author.** [Lock Before You Talk](https://github.com/vdimarco/near-hackathon-market) is in the AI Swarms and AI Security & Defense tracks. It is a jury contract where AI jurors lock a first opinion before they talk. The two projects are independent: they share no code and no contract.
- **License.** The code in `pop/` is under the MIT license. See [LICENSE](LICENSE).
