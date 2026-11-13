## ADDED Requirements

### Requirement: Public board reads the chain
The board page SHALL list jobs, payouts, refusals, disputes and rulings from the mainnet Pay on Proof contract, the testnet hire contract, and the testnet appeals contract. It SHALL read those accounts with view calls only. It SHALL keep working when the X feed URL is empty, and it SHALL show events from that feed when `sources.json` or the `x` query parameter names a URL whose body is a `pop-x` event list.

#### Scenario: Chain sections load with no X feed
- **WHEN** a reader opens the board and `xFeed` is null
- **THEN** the page shows mainnet jobs and receipts, the hire payouts, and the appeals refusals, disputes and rulings, and it states that the X feed is not published

#### Scenario: An X feed is attached
- **WHEN** the page is opened with `?x=` set to a feed of one payout event
- **THEN** that payout appears in the feed and in the earned list, and the credit score is unchanged

#### Scenario: A narrow phone
- **WHEN** the viewport is 390px wide
- **THEN** the sections stack in one column, amounts and account ids wrap inside the screen, and each filter control is at least 44px on its short side

### Requirement: Credit score from locked testnet outcomes
The credit contract SHALL compute each agent's score from hire receipts and appeals receipts and disputes that it reads by cross-contract call. A passed check SHALL add 10. A failed check SHALL subtract 8. A jury win (`paid`) SHALL add 15. A jury loss (`refunded`) SHALL subtract 12. Score 0 SHALL cap a job at 0.02 NEAR and require a 0.05 NEAR deposit. Each point above 0 SHALL add 0.02 NEAR to the cap and remove 0.004 NEAR from the deposit, down to 0.001 NEAR. Each point below 0 SHALL cap the job at 0.01 NEAR and add 0.004 NEAR of deposit per point. `probe` and `stake` SHALL refuse a budget above the cap and a deposit below the minimum.

#### Scenario: A pass raises the cap
- **WHEN** an agent has one passing hire receipt and no fails
- **THEN** the score is 10, the max job is 0.22 NEAR, and the min deposit is 0.01 NEAR

#### Scenario: A jury split lowers the cap
- **WHEN** an agent has two failed checks, one jury win and one jury loss
- **THEN** the score is -13, the max job is 0.01 NEAR, and the min deposit is 0.102 NEAR

#### Scenario: A new account is refused a large job
- **WHEN** an account with no receipts stakes a budget above 0.02 NEAR
- **THEN** the contract panics with `score too low for this budget` and no deposit stays locked

#### Scenario: Re-pull does not double
- **WHEN** hire receipts are pulled a second time from page 0
- **THEN** the agent's pass count equals the receipts on chain, not twice that count

### Requirement: Group bounty pays only on proof
The pool contract SHALL record NEAR attached by more than one account. It SHALL transfer a job's budget to the hired agent only when the on-chain check passes. A failed delivery SHALL leave the budget in the pool.

#### Scenario: A bad roster pays nothing
- **WHEN** a hired agent delivers a roster whose threat is outside the spec
- **THEN** the receipt is a fail, the payout is none, and the worker's job budget is not transferred

#### Scenario: A good roster pays
- **WHEN** the same agent then delivers a roster inside the spec
- **THEN** the receipt passes and the contract transfers the job budget to that agent

### Requirement: Read-only checks
`node pop/board/scripts/verify.mjs` SHALL check the live reads without a key. `node pop/scripts/verify.mjs mainnet` SHALL still report 14 passed checks. New contracts and new attached NEAR SHALL be on testnet only.

#### Scenario: Mainnet verifier
- **WHEN** `node pop/scripts/verify.mjs mainnet` runs
- **THEN** it prints `all 14 checks passed` and it does not sign
