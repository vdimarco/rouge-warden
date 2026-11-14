# Pay on Proof

An escrow on NEAR mainnet that pays an AI agent only when its work passes a check the contract runs itself. NEAR Hackathon entry for Agent Economy (`agents`), AI Security & Defense (`security`) and AI Swarms (`swarms`). It was built with Warden's Ledger in the Cottage Arcade.

Most agent markets pay when a person approves the work, or they trust the seller's reputation. Pay on Proof pays on the delivered data. The hired agent sends its work to the contract. In the same transaction, the contract checks the work and either pays the agent or pays nothing. No person and no server judges the work.

Live, read from mainnet in the browser: https://arcade.uptick.systems/ledger/chain.html

## For judges: four checks

| Do this | See this |
| --- | --- |
| Open https://arcade.uptick.systems/ledger/chain.html | The mainnet contract, read in your browser: the cap, the spend, the one function-call key, every job and bid, and every receipt with its reason. |
| `node pop/scripts/verify.mjs` (Node 18 or newer, no install, no key) | 14 lines that start with `ok`, then `all 14 checks passed`. It reads the mainnet contract and checks the keys, the deployed methods, the books, every paid and every failed delivery, and the NEAR Intents payouts. |
| `cd pop/contract && cargo test` | `10 passed` |
| `cd pop && npm ci && node test/mcp-read.test.mjs` | 8 lines that start with `ok`. An MCP client uses the server with no key: it reads mainnet jobs, runs the on-chain check, and a tool that signs refuses. |

GitHub runs the last three on each change to `pop/` ([workflow](../.github/workflows/pop.yml)).

## For judges: an appeal on testnet

When a delivery fails the check, the hired worker can open a dispute. A separate testnet contract asks [Lock Before You Talk](https://github.com/vdimarco/near-hackathon-market) to rule, then pays the worker or refunds the buyer. The mainnet contract is unchanged, and `node pop/scripts/verify.mjs mainnet` still reports 14 of 14.

The settlement is a cross-contract call. `settle` calls `get_case` on the jury. A private callback reads the return value. It pays only when the outcome is Decided, the case opener is this contract, and the evidence hash is the hash of this failed delivery. The jury picks an option, worker or buyer. This contract picks the account. A signed ruling is what Lock uses to settle on another chain. On NEAR the callback is the jury's own answer, so there is no extra signer.

The published jury `dev-20261111042208-14186395012630.testnet` has no keys left, so this demo deploys that contract's wasm again with a new panel. `node pop/appeals/verify.mjs` checks that the two code hashes match. Details and the transaction list are in [pop/appeals/README.md](appeals/README.md).

| Do this | See this |
| --- | --- |
| `node pop/appeals/verify.mjs` | `all 42 checks passed`. A failed delivery, a jury ruling for the worker and a payout, then a ruling for the buyer and a refund. No key. |
| Open the two settle transactions printed by that script | The appeals contract calls `get_case`, then transfers the hired price. |
| `cd pop/appeals/contract && cargo test` | 10 passed. A mismatched evidence hash or opener does not pay. |

## For judges: hire from a reply on X

Testnet only. A mention such as `@payonproof make me a logo, 0.2 NEAR` becomes a job. The requester funds it with a meta-transaction, without installing a wallet. Two agents bid. A passing paint delivery is paid by the contract's check. A failed map is disputed through the appeals contract, and the Lock jury rules. The X bidders are separate accounts. They do not use the parent and sub-account contract in `pop/hire/`.

The replies are a dry run in `public/x/thread.html`. Nothing is posted to X, and nothing is posted as `proto_von`. The mainnet contract is unchanged.

NEAR Auth (`https://auth.near.org/`) is the social login (Google, Apple, email, or a passkey). It needs an Auth0 application, which this run does not create. Meteor, HOT, and Intear are installed wallets. A NEP-366 delegate on this testnet took the deposit from the relayer, so the recorded funding is a transfer signed by the requester's own key. The page can create that kind of key in the browser. Details, the credential list for a live bot, and the event feed for `pop/board/` are in [pop/x/README.md](x/README.md).

| Do this | See this |
| --- | --- |
| Open `public/x/thread.html` | Each step the bot would reply, with a testnet transaction link. The page says it is a dry run. |
| Open `public/x/index.html` | The funding page. Create a key in the browser. The recorded funding transaction is linked. |
| `node pop/x/verify.mjs` | `all checks passed`, then the funding, payment, and ruling links. No key. |
| `node pop/x/test/all.mjs` | Parser, dry run, and the refusals of mainnet and of `proto_von`. |
| Open the [funding transfer](https://testnet.nearblocks.io/txns/CheMxrh738vqBJ2L1iX5xmRqQRN5E1Ng7XV8qwyZvnX1) | The requester signed it. 0.6 NEAR moved to the testnet contract. |
| Open the [logo payment](https://testnet.nearblocks.io/txns/BPv5jiz9FYSuW4YP6wEaGX2tBcSu8t3fngQh6qi5ZZab) | One transaction. The check passes. Ink is paid 0.16 NEAR. |
| Open the [ruling](https://testnet.nearblocks.io/txns/ENMZX6cDMqTsjtnq2pzzTfgfdi1Pkxrkkd4w8p6yQgou) | The jury ruled for the buyer. 0.11 NEAR is refunded. |

### Get only this folder

This folder lives in a large game repository. To check out only Pay on Proof and its viewer:

```sh
git clone --filter=blob:none --sparse https://github.com/vdimarco/rouge-warden
cd rouge-warden
git sparse-checkout set pop public/ledger .github
node pop/scripts/verify.mjs
```

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

## Board

`pop/board/` is one public page of jobs, payouts, refusals, disputes and rulings. It reads the mainnet escrow, the testnet hire contract, and the testnet appeals contract. It shows the X-reply feed when that feed's URL is set. The credit score and the group bounty pool are testnet contracts. This page does not sign, and it does not change the mainnet escrow. The steps and the transaction hashes are in `pop/board/README.md`.

| Do this | See this |
| --- | --- |
| Open https://flying-lilac-3g9cfwy.tmp.now/ | The board. This unclaimed preview expires about one hour after 2026-11-13 22:08 UTC. `pop/board/public/` is the same page. |
| `node pop/board/scripts/verify.mjs` | Read-only checks of the board sources, no key |
| `node pop/scripts/verify.mjs mainnet` | `all 14 checks passed` |

## Run it

```sh
cd pop && npm ci
node scripts/verify.mjs mainnet            # 14 read-only checks of the live contract, no key
npm test                                   # 10 contract unit tests
npm run build                              # contract wasm (needs Rust, the wasm32 target, wasm-opt)
node scripts/setup.mjs testnet             # faucet accounts, deploy, Warden key, lock
node scripts/e2e.mjs testnet               # 13 checks on a live network
node scripts/run.mjs testnet --kinds map,paint,tune --budget 0.25   # agents play a commission
node test/mcp.test.mjs                     # MCP client against your testnet deployment (uses .keys)
node test/mcp-read.test.mjs                # MCP client against mainnet, no key
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

`node pop/scripts/verify.mjs` checks every mainnet line below from the chain.

- **Mainnet** contract [`ee4994a5…cde827`](https://nearblocks.io/address/ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827), funded from Solana through two NEAR Intents 1Click swaps (`scripts/fund-via-intents.mjs`). Cap 2.7027 NEAR ($10 on deployment day), beneficiary `proto_von.near`. Its full-access key was deleted in [tx HvyGdLvt…](https://nearblocks.io/txns/HvyGdLvtWzfkb6xSz2mBgnLqi9ViMfBX4CTE9RbWjG8d); the only key left is the Warden's function-call key.
- Three commissions on mainnet, nine jobs, twelve receipts. The contract refused to pay for a map with a room cut off, a tune with two notes out of key, and a map with no exit. It paid nine passes, six in NEAR and three through NEAR Intents: Marg's wNEAR balance in `intents.near` (0.2516) equals what she was paid (0.068 + 0.102 + 0.0816). Total spent 0.6861 NEAR of the 2.7027 cap.
- Testnet contract `pop-mwbiijzv.testnet`: 14 jobs and 16 receipts. It was set up with `--no-lock`, so it keeps its full-access key; the mainnet contract does not.
- **Reproduced from a clean checkout on 13 November 2026:** `node scripts/setup.mjs testnet` made fresh faucet accounts, deployed and locked [`pop-mwffvzkt.testnet`](https://testnet.nearblocks.io/address/pop-mwffvzkt.testnet), and `node scripts/e2e.mjs testnet` passed 13 of 13 checks. They cover a counter and a final price, a failed map that pays nothing, a pass paid through the Intents stand-in, a pass paid in NEAR, and a Warden key that cannot send NEAR or deliver. `node test/mcp.test.mjs` then passed against it.

## See it on mainnet

| Do this | See this |
| --- | --- |
| Open [the contract](https://nearblocks.io/address/ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827) and its keys | One key. It is a function-call key for six Warden methods. |
| Open [a delivery that paid through NEAR Intents](https://nearblocks.io/txns/F56bnoHEG9oYZEFyeUTctWXbVu69AHu1opG9mY4Mtm5L) | One transaction: the contract logs `pass job 0 receipt 2`, wraps 0.068 NEAR at `wrap.near`, sends it to `intents.near`, and `intents.near` mints it to the seller (`mt_mint`, NEP-245). Then `payout receipt 2: Sent`. |
| Open [a delivery that failed](https://nearblocks.io/txns/9uLPekAWkQjqy5chTKpQiFEzGRoaiT21v7pRiQYe8tJG) | `fail job 0 receipt 0: room cut off`, and no payment. The job opened again, and another seller passed it. |
| Open [a counter-offer](https://nearblocks.io/txns/2mXKd75i4eJ8jMbZzKi7jeAgeJpqeMpZRZmob19pN3cy) | The Warden counters a bid once, signed with its function-call key. |
| Call `contract_source_metadata` on the contract | NEP-330 metadata with `link: https://github.com/vdimarco/rouge-warden`. |

## Track hints

The organizers list hints for each track. This table says which ones this project uses.

| Track | Hint | Here |
| --- | --- | --- |
| Agent Economy | Agent commerce: earn, spend, negotiate, hire | Yes. The Warden posts jobs, counters once, and hires. Sellers bid, answer, deliver, and earn. Any agent can join through the MCP server. |
| Agent Economy | NEAR Intents | Yes. A pass on the `intents` rail lands as wNEAR in the seller's `intents.near` balance, ready for a 1Click swap or withdrawal. The contract was funded from Solana through 1Click. |
| Agent Economy | Chain Signatures | No. |
| AI Security & Defense | Spending limits, policy engine | Yes. The cap is in the contract: `spent + reserved` can never pass it. Pay only on a passing check. |
| AI Security & Defense | Function call keys, sandboxed wallets | Yes. The contract account has no full-access key. The Warden's key can call six methods and cannot send NEAR or deliver. |
| AI Security & Defense | TEE attestation | No. |
| AI Swarms | Coordination markets, bidding | Yes. Up to eight bids per job, one counter per bid, one answer, and the Warden ranks sellers by their pass rate in the contract's own receipts. |
| AI Swarms | Sub-accounts | No. Sellers are implicit accounts. Yes, on testnet. `pop/hire/` hires `crew.<parent>` and pays it from the parent's cap. The mainnet sellers are still implicit accounts. |

## Limits

- **Both sellers so far are the author's reference agents** (Marg and Gravel, `agents/seller.mjs`). No outside agent has bid on mainnet yet. The contract and the MCP server accept any NEAR account.
- **The agents are scripts, not language models.** The Warden and the sellers follow fixed rules. A model can act as a seller through the MCP server.
- **The checks test structure, not quality.** A map passes when its rooms connect; a tune passes when every note is in key. Four kinds exist: map, roster, paint, tune.
- **No bond to bid.** Any account can fill a job's eight bid slots, and the contract pays the storage for bids and receipts from a 0.2 NEAR buffer.
- **If the Warden's key is stolen,** a thief can post jobs, hire its own bid, and be paid for passing work up to what is left under the cap.
- **The deployed code is not a reproducible build.** `verify.mjs` checks that the deployed methods are exactly the public methods in `contract/src/lib.rs`, and the NEP-330 metadata names this repository, but the code hash was not rebuilt and compared.
- **NEAR Intents has no testnet.** On testnet, `mock-intents/` stands in for `intents.near`.
- **Payouts are wNEAR or NEAR.** A seller who wants USDC on another chain swaps its intents balance itself.

## Hire a second agent (testnet)

`pop/hire/` is a separate testnet contract. It does not change the locked mainnet contract. One job hires a parent agent that holds only a function-call key. The parent posts a sub-job, a sub-account delivers, and both are paid from the parent's cap. The parent's remainder goes to an owner account that can spend it. The steps and the transaction hashes are in [pop/hire/README.md](hire/README.md). `node pop/hire/scripts/verify.mjs` reads that run and does not use a key.

## What was built, when

- This repository was created on 22 September 2026 for the Cottage Arcade, a set of browser games. That is earlier work, and it is not part of this entry.
- Pay on Proof (`pop/`) and Warden's Ledger (`public/ledger/`) were added in the hackathon window, in [pull request #803](https://github.com/vdimarco/rouge-warden/pull/803) on 11 November 2026, with ledger fixes in #810 and #815. Everything under `pop/` was written in the window.
- Libraries: `near-sdk` 5.30 and `serde_json` in the contract; `near-api-js`, `@modelcontextprotocol/sdk` and `zod` in the agents and the MCP server.
- **Second entry by the same author (rule Q-015).** [Lock Before You Talk](https://github.com/vdimarco/near-hackathon-market) is in the AI Swarms and AI Security & Defense tracks. It is a jury of six AI jurors who lock their first opinions on NEAR before they talk. The two projects are independent: they share no code and no contract.
