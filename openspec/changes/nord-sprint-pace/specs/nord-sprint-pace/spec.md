## ADDED Requirements

### Requirement: A long leg names its sprint
A leg SHALL keep its walk time. It SHALL also have a sprint time at the player's sprint speed. Four seconds of walking SHALL be two seconds of sprinting. A one-second walk SHALL stay one second at a sprint. The pond's opening leg SHALL name a sprint shorter than its walk.

#### Scenario: Long leg
- **WHEN** the next leg is 1800 centimetres
- **THEN** the walk is four seconds and the sprint is two

#### Scenario: Short leg
- **WHEN** the next leg is one second of walking
- **THEN** the sprint is also one second

#### Scenario: Pond opening
- **WHEN** the picnic opens on its first stop
- **THEN** the sprint is shorter than the walk
