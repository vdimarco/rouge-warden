## ADDED Requirements

### Requirement: Losing them on foot

After the stall is banked, the slip is open on the lawn. Stepping outside starts a pursuer who closes at 640 cm/s. A sprint to the gate banks the beat and pays 500 once. A walk is caught, the door is the door again, and the beat pays nothing. A car does not start the run and does not clear the gate.

#### Scenario: A sprint reaches the gate

- **WHEN** the stall is banked and the player steps outside, then sprints to the gate
- **THEN** the beat banks and pays 500 once

#### Scenario: A walk is caught

- **WHEN** the player steps outside and walks toward the gate
- **THEN** the pursuer catches them before the gate, the step returns to the door, and the beat pays nothing

#### Scenario: A car at the door

- **WHEN** a car is at the door or at the gate during the run
- **THEN** the run does not start and the gate does not bank

#### Scenario: Recover during the slip

- **WHEN** the player recovers while the slip is open
- **THEN** they return north of the door and the step stays
