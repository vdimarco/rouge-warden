## ADDED Requirements

### Requirement: The postcard is a hold
On the tag step, E on the beam that never blinks SHALL start a four-second hold. The clock SHALL run only while a player stands in that beam. One second outside SHALL pause it. More than one second outside SHALL drop it and allow another try. E on a blinking beam SHALL break the chain and SHALL NOT finish the hold. The banked step SHALL stay 6.

#### Scenario: Stay
- **WHEN** someone stands in the postcard for four seconds
- **THEN** the tag step advances

#### Scenario: Step out
- **WHEN** the player leaves for one second and comes back
- **THEN** the hold is still going and the outside clock has cleared

#### Scenario: Drop
- **WHEN** the player stays outside for more than one second
- **THEN** the hold drops and the time already held does not finish it

#### Scenario: Wrong beam
- **WHEN** the player tags a beam that blinks
- **THEN** the chain breaks and the hold does not finish

#### Scenario: The step
- **WHEN** the hold is added
- **THEN** the banked picnic is still step 6
