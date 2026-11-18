## ADDED Requirements

### Requirement: A held rope waits for the player
A rope the player is holding SHALL stay attached until the finger lifts or the button is released. It SHALL NOT let go because a timer elapsed or because the body touched a wall.

#### Scenario: Five seconds on a building
- **WHEN** the player holds a rope on a building for 5 seconds with the button still down
- **THEN** the rope is still attached

### Requirement: The gold ring is its own tower
While the gold-ring lesson is the target and the ring is in reach, the rope SHALL attach to the face the ring is painted on.

#### Scenario: Thirty shots
- **WHEN** the player fires 30 ropes at the gold-ring lesson from the start roof
- **THEN** all 30 attach to that tower

### Requirement: Sky stays inside 16 body-heights
With no mission or ring inside 16 body-heights and no building inside 6, the rope SHALL take a sky point 10 body-heights ahead along the velocity and 12 up, pulled in so it is at most 16 body-heights from the chest.

#### Scenario: Open water
- **WHEN** the player fires over open water
- **THEN** the sky anchor is at most 28.8 metres from the chest
