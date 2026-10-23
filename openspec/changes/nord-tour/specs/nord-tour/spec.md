## ADDED Requirements

### Requirement: Mission 9 rides, then paddles, then swims
After the blank page is banked, the card SHALL ask for the park bike at the east mark, then the pedalo at the north buoy, then a swim to the south-pond float. The purse SHALL be 360 session cash, paid once when the swim banks. The wrong vehicle SHALL NOT advance the step. A later place SHALL NOT skip an earlier one. The seven story banks SHALL stay seven.

#### Scenario: The bike
- **WHEN** the park bike reaches the east mark
- **THEN** the tour opens the pedalo step and does not pay

#### Scenario: The pedalo
- **WHEN** the pedalo reaches the north buoy
- **THEN** the tour opens the swim step and does not pay

#### Scenario: The swim
- **WHEN** a swimmer reaches the south-pond float
- **THEN** the tour is home and the purse is 360 once

#### Scenario: The wrong way
- **WHEN** a walker, a pedalo, or a bike visits a place that is not the current step
- **THEN** the tour stays where it is and does not pay

### Requirement: The three legs are a trip apart
The east mark SHALL sit more than 50 m from the bike stand. The buoy and the float SHALL stay the places the pedalo and the wade already use. Recover for each leg SHALL sit outside that leg's reach.

#### Scenario: The gaps
- **WHEN** the east mark, its recover point, and the stand are measured
- **THEN** the mark is more than 50 m from the stand and the recover point is outside the mark's reach

### Requirement: The tour is session-only
The tour SHALL open only after the campaign and missions 3 through 8 are banked. A race replay SHALL NOT rewind it. The v1 save SHALL still store completed missions 0–2.

#### Scenario: Before the blank page
- **WHEN** the blank page is still open
- **THEN** the tour does not offer

#### Scenario: After it is home
- **WHEN** the tour is banked
- **THEN** the card no longer offers the three legs
