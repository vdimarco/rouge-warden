## ADDED Requirements

### Requirement: Mission 10 rides home, then paddles home, then walks the bank
After the tour is banked, the card SHALL ask for the park bike at the stand, then the pedalo at the berth, then a dry walk onto the south bank. The purse SHALL be 420 session cash, paid once when the walk banks. The wrong way of moving SHALL NOT advance the step. A later place SHALL NOT skip an earlier one. The seven story banks SHALL stay seven.

#### Scenario: The bike
- **WHEN** the park bike reaches the stand
- **THEN** the beat opens the pedalo step and does not pay

#### Scenario: The pedalo
- **WHEN** the pedalo reaches the berth
- **THEN** the beat opens the walk and does not pay

#### Scenario: The bank
- **WHEN** a dry walker reaches the south bank
- **THEN** the day is home and the purse is 420 once

#### Scenario: The wrong way
- **WHEN** a walker, a pedalo, or a bike visits a place that is not the current step
- **THEN** the beat stays where it is and does not pay

### Requirement: Recover sits outside the current door
Each recover point SHALL sit outside that leg's reach. The berth recover SHALL be south of the channel. The bank recover SHALL be farther from the float than the bank is.

#### Scenario: The gaps
- **WHEN** the stand, the berth, the bank, and their recover points are measured
- **THEN** each recover point is outside its door, and each leg is more than 50 m from the next

### Requirement: The beat is session-only
The beat SHALL open only after the tour is banked. A race replay SHALL NOT rewind it. The v1 save SHALL still store completed missions 0–2.

#### Scenario: Before the tour
- **WHEN** the tour is still open
- **THEN** the beat does not offer

#### Scenario: After it is home
- **WHEN** the beat is banked
- **THEN** the card no longer offers the three legs
