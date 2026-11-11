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

```sh
cd pop && npm ci
npm test                                   # 10 contract unit tests
npm run build                              # contract wasm (needs Rust, the wasm32 target, wasm-opt)
node scripts/setup.mjs testnet             # faucet accounts, deploy, Warden key, lock
node scripts/e2e.mjs testnet               # 13 checks on a live network
node scripts/run.mjs testnet --kinds map,paint,tune --budget 0.25   # agents play a commission
node test/mcp.test.mjs                     # MCP client against testnet
node scripts/setup.mjs mainnet --beneficiary <you.near> --cap-usd 10
```

Keys go to `pop/.keys/<network>.json`, which git ignores. Run logs go to `pop/runs/`.

## Testnet notes

NEAR Intents has no testnet. On testnet, `mock-intents/` stands in for `intents.near` and keeps the one method the escrow uses, `ft_on_transfer`. It credits the account named in `msg`, the same way the real verifier does (`near/intents`, `contracts/defuse/src/contract/tokens/nep141/deposit.rs`). The wNEAR contract is the real `wrap.testnet`.

## Results so far

- Testnet contract `pop-mwbiijzv.testnet`: 13 of 13 end-to-end checks pass. They cover a counter and a final price, a failed map that pays nothing, a pass paid through the Intents stand-in, a pass paid in NEAR, a failed payout recovered by `retry_payout`, and a Warden key that cannot send NEAR or deliver.
- The agents ran a commission alone: 3 jobs posted, counters accepted, one self-check caught a map with a room cut off, and 3 passes paid.
- Mainnet: see the On chain page.
