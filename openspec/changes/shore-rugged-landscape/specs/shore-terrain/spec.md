## ADDED Requirements

### Requirement: Coherent variable terrain
The 3D Shore battlefield SHALL show continuous hills, hollows, rocky rises and a lowered river bed instead of a flat floor. Landforms SHALL use a fixed map seed, riverbed carving SHALL follow the match's seeded banks, and each match's terrain SHALL remain stable across realms. Elevations SHALL mirror between the teams. Open traversable terrain SHALL remain readable and SHALL NOT imply additional collision barriers.

#### Scenario: Explore the jungle
- **WHEN** the player follows a lane into the jungle in 3D
- **THEN** broad hills and smaller uneven landforms change the ground silhouette and lighting, with a measured elevation range of at least 250 world units outside the river.

#### Scenario: Grounded world
- **WHEN** a hero moves across a hill or the realm shifts
- **THEN** the hero, scenery, shadows and ground warnings follow the same rendered surface without sinking into it or visibly hovering above it.

#### Scenario: Stable crossings and defenses
- **WHEN** a match builds the bridges, bases and towers
- **THEN** bridge approaches meet the deck, the river remains below its water surface, and structure pads remain level.

### Requirement: Input follows the surface
Pointer movement, skill aim and camera following SHALL use the rendered terrain height while preserving existing controls and planar gameplay rules.

#### Scenario: Move and aim on uneven ground
- **WHEN** the player clicks raised ground or aims a skill there on desktop or a phone viewport
- **THEN** the movement or aim marker appears at the selected surface point and combat warnings remain visible on the terrain.

#### Scenario: Shared tactical map
- **WHEN** the player opens the tactical map during a 3D match
- **THEN** it shows the same winding roads and live match state.
