## ADDED Requirements

### Requirement: Letting them in

After the yard is banked, the lift is open. A real car held still at the stop lets a person walk a fixed line to the car. Reaching the car while it stays stopped banks the beat and pays 680 once. Rolling the car sends them back and pays nothing. A bike does not start them.

#### Scenario: A car held still

- **WHEN** the yard is banked and a real car stays stopped at the stop
- **THEN** they walk to the car, the beat banks, and it pays 680 once

#### Scenario: The car rolls

- **WHEN** they have started toward the car and the car rolls
- **THEN** they walk back, the beat stays open, and it pays nothing

#### Scenario: A bike at the stop

- **WHEN** a bike waits at the stop
- **THEN** they stay where they are and the beat pays nothing

#### Scenario: Recover during the lift

- **WHEN** the player recovers while the lift is open
- **THEN** they return to the stop and the step stays
