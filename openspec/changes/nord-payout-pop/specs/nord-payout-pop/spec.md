## ADDED Requirements

### Requirement: A story purse shows on the play shell

When a story beat pays, the play page shows the amount and the word CHING, and it plays a short cue. The popup leaves after a few seconds. The amount is not saved.

#### Scenario: A purse

- **WHEN** a story beat pays 700
- **THEN** the play page shows +700 and CHING

#### Scenario: The popup leaves

- **WHEN** a few seconds pass after the purse
- **THEN** the popup leaves

#### Scenario: An offline frame

- **WHEN** the page shows a payout without a host
- **THEN** +700 and CHING are visible

#### Scenario: No purse

- **WHEN** no story beat has paid
- **THEN** the popup stays hidden
