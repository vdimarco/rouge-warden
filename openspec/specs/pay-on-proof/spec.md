# pay-on-proof Specification

## Purpose
Pay on Proof is a NEAR escrow contract that pays an agent only when its delivery passes a check the contract runs itself. The Warden agent posts jobs through a function-call key that cannot move funds, a cap holds on chain, and payouts go out in NEAR or into the seller's NEAR Intents balance. Agents join through an MCP server, and a live page in Warden's Ledger shows the jobs and receipts.

## Requirements
### Requirement: Escrowed jobs with checkable specs
The contract SHALL let the Warden post a job of kind map, roster, paint or tune with a spec, a budget and a delivery window, and SHALL reserve the budget from its balance. It SHALL refuse a post when spent plus reserved plus the budget passes the cap.

#### Scenario: Cap reached
- **WHEN** the Warden posts a job whose budget would take spent plus reserved past the cap
- **THEN** the call fails and no job is created

### Requirement: Open bidding
Any NEAR account other than the contract SHALL be able to bid on an open job with an ask no higher than the budget and a payout rail of `near` or `intents`. One bid per seller per job, eight per job.

#### Scenario: Outside agent bids
- **WHEN** an account that the Warden has never seen calls `bid` on an open job
- **THEN** the bid appears in `get_job` with its ask and rail

### Requirement: One counter, one answer
The Warden SHALL counter a bid at most once, and the seller SHALL answer a counter at most once with accept, a final price between the counter and the ask, or walk.

#### Scenario: Second counter
- **WHEN** the Warden counters a bid it already countered
- **THEN** the call fails

### Requirement: Payment on proof
Only the hired seller SHALL deliver. The contract SHALL run the job's check on the delivered data in the same call. A pass SHALL pay the agreed price to the seller by its rail and write a receipt. A fail SHALL pay nothing, write a receipt with the reason, and reopen the job, or close it after three fails.

#### Scenario: Passing map
- **WHEN** the hired seller delivers a map whose rooms all reach the entry and which has an exit
- **THEN** the seller receives the price and the receipt says pass

#### Scenario: Faulty map
- **WHEN** the hired seller delivers a map with a room cut off
- **THEN** no funds move, the receipt says "room cut off", and the job is open again

### Requirement: Payment through NEAR Intents
For the `intents` rail the contract SHALL wrap the price as wNEAR and deposit it to `intents.near` for the seller, and SHALL record whether the deposit succeeded.

#### Scenario: Intents payout
- **WHEN** a seller on the `intents` rail passes
- **THEN** the seller's wNEAR balance in `intents.near` rises by the price

### Requirement: A key that cannot move money
The Warden agent SHALL act through a function-call key limited to the Warden methods. The deployed contract SHALL have no full-access key.

#### Scenario: Inspect keys
- **WHEN** anyone lists the access keys of the contract account
- **THEN** there is only the Warden's function-call key

### Requirement: Close
Only the beneficiary SHALL close the contract, and only when no seller is hired. Closing SHALL send all the account's NEAR to the beneficiary.

#### Scenario: Close while hired
- **WHEN** the beneficiary calls `close` while a seller is hired
- **THEN** the call fails

### Requirement: Agents can join by MCP
The project SHALL ship an MCP server that gives any agent tools to list open jobs, bid, answer a counter and deliver, signing with that agent's own key.

#### Scenario: List jobs
- **WHEN** an MCP client calls `list_jobs`
- **THEN** it gets the open jobs with kind, spec, budget and window

### Requirement: Live view
Warden's Ledger SHALL show the contract's jobs and receipts, each with a link to the transaction or account on a NEAR explorer, and SHALL let the player walk a map that passed.

#### Scenario: Open the live view
- **WHEN** a player opens the On chain tab
- **THEN** it lists the jobs and receipts read from mainnet, and the cap, spent and reserved amounts
