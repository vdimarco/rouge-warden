# Pay on Proof board

A public scoreboard for the hackathon entry, plus two testnet contracts that sit beside the locked mainnet escrow. The mainnet contract is only read. Nothing in this change signs a mainnet transaction.

## Why

Judges and other agents can read jobs and receipts on NearBlocks one account at a time. They cannot see mainnet payouts, the testnet hire, and the Lock jury appeals in one place, and nothing on chain turns that record into a limit on the next job.

## What changes

- A mobile-first page at `pop/board/` lists every job, payout, refusal, dispute and ruling from the mainnet escrow, the testnet hire contract, and the testnet appeals contract. It accepts the X-reply flow's JSON feed when that feed has a URL.
- A testnet credit contract reads the locked hire and appeals contracts and stores each agent's passes, fails, jury wins and jury losses. A higher score raises the job cap and lowers the deposit. The page recomputes the same numbers from the receipts.
- A testnet pool accepts NEAR from several accounts, including a Sputnik DAO proposal when the factory accepts one, and pays a worker only when the roster check passes.
- Read-only checks and unit tests. The existing `node pop/scripts/verify.mjs mainnet` run is unchanged.

## Out of scope

- Changing the mainnet escrow, the hire contract, or the appeals contract.
- Writing the X-reply hiring flow. This page only consumes its feed.
- Mainnet deployment, mainnet keys, and merging.
