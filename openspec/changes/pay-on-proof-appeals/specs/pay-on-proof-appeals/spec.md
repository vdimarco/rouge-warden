# pay-on-proof-appeals Specification

## Purpose

A testnet escrow that runs a Pay on Proof check and, when the check fails, asks a Lock Before You Talk jury to rule. The escrow pays the worker or refunds the buyer from that ruling. The mainnet Pay on Proof contract is unchanged.

## Requirements

### Requirement: A failed check opens an appeal

The contract SHALL run the delivery check in `deliver`. A pass SHALL pay the hired price and SHALL refuse a dispute. A fail SHALL pay nothing, keep the budget reserved, and SHALL let the hired worker call `dispute` until the appeal window ends.

#### Scenario: Faulty map

- **WHEN** the hired worker delivers a map with a room cut off
- **THEN** the receipt says "room cut off", no payment is sent, and the job is appealable

#### Scenario: Someone else disputes

- **WHEN** an account other than the hired worker calls `dispute`
- **THEN** the call fails and the job stays appealable

### Requirement: The contract opens the jury case

`dispute` SHALL call the configured jury's `open_case`. The opener SHALL be this contract. The evidence hash SHALL be the hash of the job, the receipt, the worker, the buyer, the price, the spec, the check reason, and the delivery. The options SHALL be `worker` and `buyer`.

#### Scenario: Dispute stores the case

- **WHEN** the jury accepts `open_case`
- **THEN** the dispute records that case id and the evidence hash, and the job is disputed

### Requirement: Settlement follows the jury

`settle` SHALL call `get_case` on the stored case. The private callback SHALL pay the hired price to the worker when the ruling is `worker`, and SHALL transfer that price to the buyer when the ruling is `buyer`. It SHALL leave the funds reserved when the outcome is not `Decided`, or when the opener, evidence hash, policy hash, or option names do not match.

#### Scenario: Worker wins

- **WHEN** the jury case is `Decided` for option `worker` and the evidence hash matches this delivery
- **THEN** the worker's balance rises by the hired price, `spent` rises by that price, and the receipt payout is `sent`

#### Scenario: Buyer wins

- **WHEN** the jury case is `Decided` for option `buyer` and the evidence hash matches this delivery
- **THEN** the buyer receives the hired price, `refunded` rises by that price, and the receipt payout is `refunded`

#### Scenario: The case is not this delivery

- **WHEN** `get_case` returns a decided case whose evidence hash or opener does not match
- **THEN** no payment is sent and the dispute stays ready

### Requirement: A reader can check the run without a key

`pop/appeals/verify.mjs` SHALL re-read the recorded testnet run from NEAR and SHALL fail if the jury wasm differs from the published Lock jury, if a full-access key remains on the contracts, or if either settlement does not match the jury ruling.

#### Scenario: Read the recorded run

- **WHEN** someone runs `node pop/appeals/verify.mjs` with no key
- **THEN** every check passes and the script prints the settle transactions
