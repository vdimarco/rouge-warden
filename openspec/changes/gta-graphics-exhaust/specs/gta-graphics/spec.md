## ADDED Requirements

### Requirement: A running car leaves exhaust at the tail
A car that is not a wreck, and is either faster than 80 cm/s or holding throttle, SHALL spawn a short column of puffs at the tail. A stopped car with no throttle SHALL spawn none. A wreck SHALL keep the bonnet smoke and SHALL NOT add this column.

#### Scenario: The column leaves the tail
- **WHEN** a running car faces away down the street
- **THEN** pale puffs sit behind the body, rising and drifting back, and the car without them does not

#### Scenario: A parked car stays clear
- **WHEN** the speed is under 80 cm/s and the throttle is at rest
- **THEN** no exhaust puff is spawned

#### Scenario: A wreck keeps the bonnet smoke
- **WHEN** the car is wrecked
- **THEN** the tail column does not run and the bonnet smoke path is unchanged
