## ADDED Requirements

### Requirement: A side job uses the chain
A clean side job SHALL pay its reward times the chain already held, then grow the chain by one, and the multiple SHALL stop at seven. A spoiled chain SHALL pay the flat reward and leave the chain at zero. A failed job SHALL break the chain. The story marks SHALL stay as they were. With the chain at zero, the pay SHALL be the job's own reward.

#### Scenario: Clean job
- **WHEN** the chain holds two and a job worth 300 succeeds
- **THEN** the pay is 900 and the chain becomes three

#### Scenario: Spoiled job
- **WHEN** the chain is spoiled and that job succeeds
- **THEN** the pay is 300 and the chain is zero

#### Scenario: Full chain
- **WHEN** the chain is already at seven and a job succeeds
- **THEN** the pay is seven times the reward and the chain stays at seven

#### Scenario: No chain yet
- **WHEN** the chain is zero and a job succeeds
- **THEN** the pay is the job's own reward
