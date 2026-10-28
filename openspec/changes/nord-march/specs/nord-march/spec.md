## ADDED Requirements

### Requirement: Staying inside the march

After the slip is banked, the march is open on the lawn. Stepping in starts a group that walks south at a walk. Staying inside until the end, then stepping out, banks the beat and pays 580 once. A sprint or a stop leaves the circle, the march returns to the start, and the beat pays nothing. A car does not join and does not finish it.

#### Scenario: A walk stays inside and steps out

- **WHEN** the slip is banked and the player steps in, walks inside the march to the end, then steps out
- **THEN** the beat banks and pays 580 once

#### Scenario: A sprint leaves the front

- **WHEN** the player steps in and sprints ahead of the march
- **THEN** the march returns to the start, the step returns to the join, and the beat pays nothing

#### Scenario: A car at the join

- **WHEN** a car is at the join or at the step-out
- **THEN** the march does not start and the step-out does not bank

#### Scenario: Recover during the march

- **WHEN** the player recovers while the march is open
- **THEN** they return north of the join and the step stays
