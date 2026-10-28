## ADDED Requirements

### Requirement: A dent makes a thud
A hit that adds body damage SHALL ask for a thud. A wall at 600 cm/s SHALL NOT. A wall faster than that SHALL. Another car at 500 cm/s SHALL NOT. A car faster than that SHALL. A scrape and a separating hit SHALL NOT. A second dent from the same car inside 0.35 seconds SHALL NOT ask again. A dent after that gap SHALL.

#### Scenario: The wall
- **WHEN** a wall is hit at 600 cm/s and then at 601 cm/s
- **THEN** only the faster hit asks for a thud

#### Scenario: The other car
- **WHEN** another car is hit at 500 cm/s and then at 501 cm/s
- **THEN** only the faster hit asks for a thud

#### Scenario: The gap
- **WHEN** a dent has just asked for a thud
- **THEN** another dent inside the gap stays quiet, and a dent after 0.35 seconds asks again

### Requirement: The thud is not an existing cue
The thud wave SHALL stay off the rank pitches, the lock chirp, the pond tick, the court whistle, the court rasp and the theatre page.

#### Scenario: The other cues
- **WHEN** the thud wave is compared with those cues
- **THEN** the loudest sample gap is greater than 0.05
