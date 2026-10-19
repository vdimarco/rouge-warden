# Table Tennis phone travel

## ADDED Requirements

### Requirement: Phone movement drives the racket
Motion mode SHALL move the racket in both directions from gravity-free acceleration and relative wrist heading, with bounded travel and contact at the visible position.

#### Scenario: Push and pull
- **WHEN** a player moves the phone toward or away from the table
- **THEN** racket depth moves in the corresponding direction without requiring a tilt

#### Scenario: Side sweep
- **WHEN** a player turns the wrist left or right from the calibrated heading
- **THEN** the racket moves sideways even when roll stays level

#### Scenario: Screen orientation
- **WHEN** the phone is held in either landscape orientation or portrait
- **THEN** equivalent screen-relative movement has equivalent control direction

#### Scenario: Rest and reset
- **WHEN** sensor data stops, the phone rests, the screen rotates, or the player recentres
- **THEN** transient motion settles without runaway movement and reset clears old motion

#### Scenario: Existing controls
- **WHEN** a player uses mouse or swipe controls
- **THEN** the existing control path stays available
