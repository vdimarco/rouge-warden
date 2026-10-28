## ADDED Requirements

### Requirement: The pedalo paddles on the water and creeps off it
A pedalo on the water SHALL top out at 650 cm/s going forward and 220 cm/s in reverse. Off the water it SHALL top out at 140 cm/s. Letting go SHALL coast to a stop. A car SHALL NOT use this rule, and a pedalo SHALL NOT handbrake-slide.

#### Scenario: Open water
- **WHEN** the pedalo holds full gas on the water
- **THEN** it reaches 650 cm/s and does not pass it

#### Scenario: The berth
- **WHEN** the pedalo holds full gas off the water
- **THEN** it reaches 140 cm/s and does not pass it

#### Scenario: A car
- **WHEN** the ride is a car
- **THEN** it is not a pedalo and it still slides

### Requirement: The berth is beside the bridge
The pedalo SHALL wait 280 cm from the north-pond footbridge, inside the 450 cm door reach and off the deck.

#### Scenario: The deck
- **WHEN** the berth is measured from the bridge
- **THEN** the gap is 280 cm, which boards from the deck and does not sit on it
