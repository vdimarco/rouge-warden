## ADDED Requirements

### Requirement: Watercolour paint by default
Breath of the Lake SHALL draw the world as a watercolour on cream paper by default, after the Susurrus reference: wobbling strokes, darker wet edges at colour changes, paper granulation, sepia shadows, and a ragged border of bare paper.

#### Scenario: First visit by day
- **WHEN** a player with no saved Paint choice starts a game and stands by the cottage by day
- **THEN** a cream paper border with a ragged edge frames the screen, colours are softer and warmer than the Bright look, and shapes keep darker rims where their colour changes.

#### Scenario: Night
- **WHEN** the clock reaches night
- **THEN** the paper border dims with the scene and does not glow against the dark sky.

#### Scenario: Phone portrait
- **WHEN** the game runs at 390 by 844 on the Low setting
- **THEN** the paper border stays thin and does not cover the pause button or the HUD.

### Requirement: Grass stays clean
The wet-edge stage SHALL leave grass blades out, as the ink lines do.

#### Scenario: Meadow
- **WHEN** the player looks across the meadow
- **THEN** the grass shows no dark rims between blades.

### Requirement: Paint choice
The pause menu SHALL have a Paint button that switches between Watercolor and Bright. The game SHALL save the choice. The address option `?paint=bright` or `?paint=watercolor` SHALL choose for one visit.

#### Scenario: Switch to Bright
- **WHEN** the player opens the pause menu and presses Paint: Watercolor
- **THEN** the button reads Paint: Bright, the picture returns to the older bright look, and the choice is still in effect after a reload.

### Requirement: No new draw cost
The watercolour SHALL add no draw calls, triangles or render targets.

#### Scenario: Phone profile
- **WHEN** `PERF_PHONE=1 node perf.mjs low` runs with `?paint=bright` and with `?paint=watercolor`
- **THEN** both runs report the same draw calls and triangles at each place.
