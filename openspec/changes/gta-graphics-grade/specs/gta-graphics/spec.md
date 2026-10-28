# gta-graphics

## ADDED Requirements

### Requirement: The view uses a filmic grade

The tone-curve amount is 1. Gain is (1.06, 1.02, 0.94) and offset is (0.012, 0.008, 0.004). The opening camera stays at pitch −16 with the socket at (0, 70, 110).

#### Scenario: Highlights shoulder and the dusk lifts

- **WHEN** a bright pixel and a dark pixel go through the grade
- **THEN** the bright pixel stays under full white and the dark pixel lifts warmer than it started

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16 and the socket is (0, 70, 110)
