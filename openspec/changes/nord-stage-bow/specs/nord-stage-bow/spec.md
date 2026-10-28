## ADDED Requirements

### Requirement: The stage bow is a held light
After the goon fight is won, a walking player in the stage light SHALL start a twelve-second bow with E. The clock SHALL run only while someone stands in the light. More than two seconds outside SHALL drop the bow and allow another try. Holding it SHALL pay 150 once. The goon pay SHALL stay 300. A story beat, a running job, a driver, and a downed player SHALL NOT start it.

#### Scenario: Hold
- **WHEN** someone stands in the light for twelve seconds
- **THEN** the bow is done

#### Scenario: Step out
- **WHEN** the player leaves the light for one second and comes back
- **THEN** the bow is still going and the outside clock has cleared

#### Scenario: Drop
- **WHEN** the player stays outside for more than two seconds
- **THEN** the bow drops and the time already held does not finish it

#### Scenario: Closed
- **WHEN** the fight is not won, a job is running, or a story beat is open
- **THEN** the bow does not start

#### Scenario: The spot
- **WHEN** the light is placed
- **THEN** it sits on the theatre lawn, clear of the goon marker, the stall, and the QA anchors
