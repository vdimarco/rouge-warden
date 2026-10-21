## ADDED Requirements

### Requirement: A clean chain pays more than a spoiled run
Each later story beat SHALL have a higher base than the one before it. A clean bank SHALL pay that base times the chain already held, then grow the chain by one. A spoiled bank SHALL pay the flat base and leave the chain at zero. A beat SHALL pay only once.

#### Scenario: Clean run
- **WHEN** all seven beats bank clean
- **THEN** each pay is the base times the chain it grew from, and the total is more than twice a run where every beat was spoiled

#### Scenario: A miss
- **WHEN** the chain holds two and the court is spoiled before it banks
- **THEN** the court pays its flat base, and the next clean beat starts the chain at one

#### Scenario: One pay
- **WHEN** a beat that already paid is banked again
- **THEN** the pay is zero and the chain stays where it was

### Requirement: The open beat shows its stake
Before the lap banks, the stake SHALL be the terrace. An open story beat SHALL take the stake. When every beat is banked, there SHALL be no open stake. A spoil SHALL drop the shown stake to the flat base.

#### Scenario: Open picnic
- **WHEN** the lap is banked and the picnic is open
- **THEN** the stake is the picnic

#### Scenario: City clear
- **WHEN** the lap is banked and no story beat is open
- **THEN** there is no stake

#### Scenario: Broken chain
- **WHEN** the chain is spoiled
- **THEN** the open beat's stake is its flat base
