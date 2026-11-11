# wardens-ledger Specification

## Purpose
Warden's Ledger is a Lab game and the arcade's NEAR Hackathon Agent Economy entry: a contractor agent that takes commissions, haggles once with bidding agents, hires inside a wNEAR budget, checks each delivery, and pays sellers through dry-run NEAR Intents 1Click quotes, with a receipt for every task.

## Requirements
### Requirement: Commission day
The game SHALL open each day on a client commission with a wNEAR budget, a payout, and three or four tasks taken from map, roster, paint and tune, and SHALL give the day 8 work hours.

#### Scenario: Start a season
- **WHEN** a player opens `/ledger/` and presses Start
- **THEN** day 1 shows the client, the brief, the budget, the payout, the open tasks and 8 hours left

#### Scenario: Day ends
- **WHEN** every task is paid or the hours run out
- **THEN** the day closes, the client pays the Warden by the share of passed tasks, and the day summary shows payout, spend and profit

### Requirement: Bids and one counter-offer
Each open task SHALL show bids from agents that do that skill, each with name, reputation, hours, and price in the seller's own token and chain with a wNEAR estimate. The Warden SHALL make at most one counter per bid.

#### Scenario: Counter accepted
- **WHEN** the Warden counters at or above the agent's floor
- **THEN** the bid price changes to the counter and the counter control is gone for that bid

#### Scenario: Final price
- **WHEN** the counter is below the floor but close to it
- **THEN** the agent names one final price that the Warden can take or leave, and no second counter is offered

#### Scenario: Walk away
- **WHEN** the counter is far below the floor
- **THEN** the bid is withdrawn and cannot be hired

### Requirement: Budget and escrow
Hiring SHALL lock the bid's estimated wNEAR cost plus 3%. The game SHALL refuse a hire whose lock does not fit in the free balance. Spent plus locked SHALL never exceed the budget.

#### Scenario: Too dear
- **WHEN** a bid's lock is larger than the free balance
- **THEN** its Hire button is disabled and says the budget is short

### Requirement: Checked delivery
After the agent's hours pass, the game SHALL show the delivered data and the result of a check run on that data. A pass SHALL pay the seller. A fail SHALL free the lock, pay nothing, and reopen the task if hours remain.

#### Scenario: Faulty map
- **WHEN** a map delivery has a room that the entry cannot reach
- **THEN** the check fails with the reason "room cut off", and no payment is made

### Requirement: NEAR Intents settlement
A pass SHALL ask the 1Click API for a dry `EXACT_OUTPUT` quote from wNEAR to the seller's asset for the agreed amount, and SHALL debit the quoted wNEAR. When the API cannot be reached the game SHALL use the bundled price list and mark the payment as an offline estimate. The page SHALL hold no keys and SHALL say that no funds move.

#### Scenario: Online quote
- **WHEN** a delivery passes and the 1Click API answers
- **THEN** the receipt shows the wNEAR in, the amount out, the destination chain, the quote's correlation id and signature, and "dry run, no funds moved"

#### Scenario: Offline
- **WHEN** a delivery passes and the API does not answer
- **THEN** the receipt shows the estimate from the bundled prices and the mode chip reads Offline

### Requirement: Agents that spend and hire
Some agents SHALL spend part of their fee on paid API calls, and one SHALL hire another agent. These purchases SHALL appear in the task's receipt, marked simulated, and in each agent's earnings and spend on the Agents tab.

#### Scenario: Subcontract
- **WHEN** the Warden pays an agent that subcontracts
- **THEN** that receipt lists the subcontractor, its price and its own check result

### Requirement: Receipts
The game SHALL keep one receipt for each finished task with what was bought, from whom, the price, the check result and the payment, and SHALL export every receipt as a JSON file.

#### Scenario: Export
- **WHEN** the player presses Export on the Receipts tab
- **THEN** the browser saves `ledger-receipts.json` with one entry per receipt

### Requirement: Autopilot
An Auto switch SHALL let the Warden pick bids, counter and hire by itself without passing the budget. On the live site it SHALL ask Jev through `/api/warden`; elsewhere it SHALL use a local stand-in.

#### Scenario: Auto season
- **WHEN** Auto is on from day 1
- **THEN** the season plays to its end with no input, and no day spends more than its budget

### Requirement: Layouts and controls
The page SHALL fit at 1280, 390 and 320 pixels wide with no horizontal scroll, every control SHALL be at least 44 pixels on its shorter side, and the menu SHALL have a Switch game button. The page SHALL work with mouse, touch and keyboard (Tab and Enter).

#### Scenario: Phone
- **WHEN** the page is 390 or 320 pixels wide
- **THEN** Board, Receipts and Agents show one at a time behind tabs and nothing scrolls sideways

### Requirement: Warden's Ledger machine
The arcade SHALL show a Warden's Ledger cabinet at the end of the Lab row, the Lab page SHALL link it, and the switcher SHALL list it as Lab-only.

#### Scenario: Start from the hall
- **WHEN** a player opens the Lab group and starts the Warden's Ledger cabinet
- **THEN** `/ledger/` loads
