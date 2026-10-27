# gta-graphics

## ADDED Requirements

### Requirement: The opening is a night hour

The spawn clock starts at 22:00. Street lamps and headlights follow that hour. The weather default stays clear. The opening camera stays at pitch −16 with the socket at (0, 70, 110).

#### Scenario: A new session opens at night

- **WHEN** the player starts without an hour override
- **THEN** the clock is 22:00 and the weather fallback is still clear

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16 and the socket is (0, 70, 110)

### Requirement: Neon blades sit in the Sherbrooke opening

Three coloured lights stand on the near sidewalk and turn on with the street lamps. Each one falls inside the opening view at a readable size.

#### Scenario: The blades are in the opening view

- **WHEN** the opening camera frames Rue Sherbrooke
- **THEN** each neon blade is inside the frame and wider than a speck
