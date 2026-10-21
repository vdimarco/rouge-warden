## ADDED Requirements

### Requirement: Rough night ground carries the lights above it
The comic post process SHALL, when NightFactor is above 0, mix a warm or white sample from above a rough upward surface onto that surface. A wall, a glossy body panel, a sky pixel, and a pixel above the horizon SHALL keep their colour. When NightFactor is 0 the comic colour SHALL be unchanged.

#### Scenario: Clear day stays the afternoon frame
- **WHEN** NightFactor is 0
- **THEN** the comic colour matches the frame before the street sheen

#### Scenario: A window above the road
- **WHEN** NightFactor is 1 and a rough upward pixel has a warm window between it and the horizon
- **THEN** that pixel moves toward the window colour, and a wall pixel in the same column stays
