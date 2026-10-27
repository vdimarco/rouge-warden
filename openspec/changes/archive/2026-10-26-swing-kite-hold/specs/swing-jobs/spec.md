## ADDED Requirements

### Requirement: Hold the kite
An odd job SHALL send a kite up from the street. The card SHALL name the kite and tell the player to stay above it. Time in the air above the kite, within 8 m, SHALL fill a 4 s hold, and the first moment above it SHALL tug the hero upward. Standing on the ground, or hanging under the kite, SHALL NOT fill the hold, and leaving it SHALL slip the hold. Filling the hold SHALL catch the kite and launch the hero. The clock SHALL be 22 s, and running it out SHALL miss as risen. The kite SHALL NOT replace a flush.

#### Scenario: The kite is up
- **WHEN** the player takes the kite
- **THEN** the card says to stay above it, and the kite is rising

#### Scenario: On the ground
- **WHEN** the hero stands on the ground under the kite
- **THEN** the hold does not grow, and the card still says to stay above it

#### Scenario: Above it
- **WHEN** the hero is in the air above the kite and close
- **THEN** the hold grows and the kite tugs the hero up

#### Scenario: It slips
- **WHEN** the hero leaves the air above the kite
- **THEN** the hold slips and the card says to get back above it

#### Scenario: Four seconds
- **WHEN** the hero stays above the kite for 4 s
- **THEN** the kite is caught and the hero is launched

#### Scenario: It rises away
- **WHEN** the 22 s clock runs out first
- **THEN** the lesson card says the kite rose away
