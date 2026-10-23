## ADDED Requirements

### Requirement: The bike pedals on land and creeps in the water
A bike on land SHALL top out at 900 cm/s going forward and 200 cm/s in reverse. In the water it SHALL top out at 90 cm/s. Letting go SHALL coast to a stop. A car SHALL NOT use this rule, and a bike SHALL NOT handbrake-slide.

#### Scenario: Dry park
- **WHEN** the bike holds full gas on land
- **THEN** it reaches 900 cm/s and does not pass it

#### Scenario: A dunk
- **WHEN** the bike holds full gas in the water
- **THEN** it reaches 90 cm/s and does not pass it

#### Scenario: A car
- **WHEN** the ride is a car or a pedalo
- **THEN** it is not a bike

### Requirement: The stand is in the dry park
The bike SHALL wait at (34800, -4000), with a fallback height of 102 cm and a heading of 90 degrees.

#### Scenario: The stand
- **WHEN** the stand is read
- **THEN** it is that point
