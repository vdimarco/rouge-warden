## ADDED Requirements

### Requirement: A clear start for every trial
While no trial runs, each trial's first ring SHALL show as a green, breathing START ring with the trial's label over it ("Fly through the green ring"). Flying through a START ring SHALL start that trial and count the ring as its first. Standing on a trial pad for 1 s SHALL still start it.

#### Scenario: Fly through a START ring
- **WHEN** the player flies through a trial's green START ring
- **THEN** the trial starts with one ring passed, and the START rings hide until the trial ends

#### Scenario: A teleport is not a flight
- **WHEN** a respawn or a map trip moves the player across a START ring
- **THEN** no trial starts

### Requirement: Always know the next ring
During a trial the next ring SHALL be the bright, pulsing one. The compass SHALL point to it, and the flat HUD SHALL show the count and the time ("3/12 · 14.2").

#### Scenario: In a trial
- **WHEN** a trial is running
- **THEN** the compass points to the next ring and the HUD shows rings passed out of the total, and the time

### Requirement: Every pass and the finish are felt
A ring the player flies through SHALL give a sound, a haptic pulse, the ring's own flash, a comic WHOOSH past the ring, a green glow at the screen edges in flat play, and a line "Ring n of total". The last ring SHALL give a bigger word, a gold glow, a fanfare and a line with the time and any new best.

#### Scenario: Pass a ring
- **WHEN** the player flies through the next ring
- **THEN** the count goes up, the edges glow green, and the line says "Ring n of total"

#### Scenario: Finish
- **WHEN** the player flies through the last ring
- **THEN** the trial ends, the best time is saved, and the line says the trial is done with the time
