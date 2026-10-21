## ADDED Requirements

### Requirement: Night paints a moon and a spill
The comic post process SHALL, when NightFactor is above 0, move a sky pixel toward the moon colour along the moon direction and add a spill around a warm bright window. A dark brick pixel SHALL keep its colour. When NightFactor is 0 the comic colour SHALL be unchanged.

#### Scenario: Clear day stays the afternoon frame
- **WHEN** NightFactor is 0
- **THEN** the comic colour matches the frame before the night grade

#### Scenario: Midnight sky and a lit window
- **WHEN** NightFactor is 1
- **THEN** a sky pixel toward the moon disc moves toward the moon colour, a warm bright window gains a spill, and a dark brick pixel stays
