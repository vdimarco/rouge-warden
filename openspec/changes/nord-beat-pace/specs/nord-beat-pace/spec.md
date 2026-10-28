## ADDED Requirements

### Requirement: The card states the beat
While a story beat or the terrace is open, the mission card SHALL say which stop this is and how many the beat has. When the next stop is a walk, it SHALL also say about how many seconds that leg takes at walking speed. A sprint MAY arrive sooner. The race SHALL keep its own clock and SHALL NOT add a walk.

#### Scenario: Opening the pond
- **WHEN** the pond is on its first stop
- **THEN** the card says 1 of 6
- **AND** it names a walk to the next stop

#### Scenario: Last stop
- **WHEN** the pond is on the picnic clamp
- **THEN** the card says 6 of 6
- **AND** it does not name a walk after the beat

#### Scenario: Either order
- **WHEN** the ovation is on the choice
- **THEN** the card says 2 of 4
- **AND** it does not name one walk

#### Scenario: Rescue
- **WHEN** no rescue group is free
- **THEN** the card says 1 of 3
- **AND** it does not name a walk

#### Scenario: Drive
- **WHEN** the terrace is on parking the car
- **THEN** the card says 4 of 5
- **AND** it does not count that leg as a walk
