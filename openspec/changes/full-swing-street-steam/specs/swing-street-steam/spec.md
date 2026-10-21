## ADDED Requirements

### Requirement: Sidewalk grates put up steam
The city SHALL draw comic steam rising from grates on the sidewalks. A still of the street SHALL show at least one puff, because the puffs on a grate are staggered through the loop.

#### Scenario: The avenue
- **WHEN** the street camera looks north along the avenue
- **THEN** cream puffs with an ink edge rise from the sidewalks ahead, and the near kerb is not covered by a puff

### Requirement: Steam stays in the city draw
The steam SHALL be a mesh in the city. It SHALL fade into the existing height haze. It SHALL NOT add a full-screen pass.

#### Scenario: Flat play
- **WHEN** flat play stands in the avenue
- **THEN** the steam is in the world, ahead of the hero, and the city render check still passes
