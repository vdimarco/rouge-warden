## ADDED Requirements

### Requirement: Getting out of a moving car keeps its pace
Getting out of a car moving faster than a walk SHALL keep that planar pace, capped at 900 cm/s. Getting out at a walk or slower SHALL plant the player. The kept pace SHALL ease off.

#### Scenario: A walk
- **WHEN** the car is moving at 450 cm/s or slower, with no sideways slip
- **THEN** the player is planted

#### Scenario: A run
- **WHEN** the car is moving faster than a walk and at most 900 cm/s
- **THEN** the player keeps that pace

#### Scenario: A highway
- **WHEN** the car is moving faster than 900 cm/s
- **THEN** the player keeps 900 cm/s

#### Scenario: The ease
- **WHEN** a kept pace eases for a fraction of a second
- **THEN** it is slower, and it reaches a stop
