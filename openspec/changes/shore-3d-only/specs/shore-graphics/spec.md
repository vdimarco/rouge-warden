## ADDED Requirements

### Requirement: One 3D battlefield
Shore SHALL use the 3D battlefield for every match. It SHALL ignore old 2D URLs and stored renderer choices, and SHALL provide no 2D mode control or automatic 2D fallback. Tactical maps and HUD overlays SHALL remain available.

#### Scenario: Existing player
- **WHEN** a player opens the game with a saved 2D choice or `?renderer=2d`
- **THEN** the game starts in 3D and exposes no mode switch.

#### Scenario: Graphics unavailable
- **WHEN** WebGL2 is unavailable or a required world model fails to load
- **THEN** Play remains disabled and a visible explanation offers reload.

#### Scenario: Context interrupted
- **WHEN** the 3D context is lost during play
- **THEN** gameplay pauses and a visible message remains until the view is restored, with no renderer change.

### Requirement: Visible rolling terrain
Dry lane ground SHALL follow rolling elevations outside structure pads and bridge approaches. All actors, scenery, pointer hits and spell warnings SHALL use the shared sampled surface. Elevations SHALL mirror between teams, and existing planar combat rules SHALL remain unchanged.

#### Scenario: Travel along a lane
- **WHEN** a player follows a lane in a new match
- **THEN** side-lane elevation varies by at least 80 world units, and the middle lane also follows raised ground and nearby hills are visible from the gameplay camera.

#### Scenario: Defenses and river
- **WHEN** a match builds the terrain
- **THEN** structure footprints stay level and bridge approaches meet their decks, with the bed below water.
