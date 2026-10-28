## ADDED Requirements

### Requirement: A close call pays beside the chain
A clean close call SHALL pay 50 times one more than the chain held, and that multiple SHALL stop at a chain of six. A spoiled chain SHALL pay nothing for a close call. A bank outside the close slice SHALL pay no close bonus. The story bank's own pay SHALL stay as it was.

The court close slice SHALL be the first quarter-second the ball spends on the middle panel, once the ink is clear. The taught sample SHALL be a close call at chain 0 and not at chain 6. A later clear bank SHALL still land at chain 6.

The convoy close slice SHALL be the first quarter-second after the beam. The pull at 1.5 seconds SHALL bank at chain 0 and SHALL not be a close call.

#### Scenario: Taught court sample
- **WHEN** the chain is zero and the ball is on the taught bank sample
- **THEN** the bank lands and it is a close call

#### Scenario: Full court chain
- **WHEN** the chain is six and the ball is on that same sample
- **THEN** the bank misses

#### Scenario: Later court bank
- **WHEN** the chain is six and the ball is later on the middle panel, still clear of the ink
- **THEN** the bank lands and it is not a close call

#### Scenario: Convoy pull
- **WHEN** the chain is zero and the feeder is pulled at 1.5 seconds
- **THEN** the feed stalls and it is not a close call

#### Scenario: Spoiled
- **WHEN** the chain is spoiled
- **THEN** the close bonus is nothing
