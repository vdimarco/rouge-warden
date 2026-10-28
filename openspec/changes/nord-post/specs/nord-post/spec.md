## ADDED Requirements

### Requirement: Standing the post

After the lift is banked, the post is open. Walking inside the mark fills a six-second count. Filling it banks the beat and pays 700 once. Standing still, a sprint, or a step out starts the count again and pays nothing. A car does not stand it.

#### Scenario: A walk inside the mark

- **WHEN** the lift is banked and the player keeps walking inside the mark
- **THEN** the count fills, the beat banks, and it pays 700 once

#### Scenario: A sprint or a step out

- **WHEN** the count has started and the player sprints or leaves the mark
- **THEN** the count starts again, the beat stays open, and it pays nothing

#### Scenario: Standing still

- **WHEN** the player stands still inside the mark
- **THEN** the count does not move and the beat pays nothing

#### Scenario: Recover during the post

- **WHEN** the player recovers while the post is open
- **THEN** they return to the mark and the step stays
