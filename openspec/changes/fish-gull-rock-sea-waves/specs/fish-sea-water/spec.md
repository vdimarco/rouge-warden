## ADDED Requirements

### Requirement: Wind-wave shapes at every place
The water SHALL show irregular wind waves that move toward the angler, with sharper crests and wider troughs, and the pattern SHALL NOT show a visible repeat or a jump when its loop restarts. Gull Rock SHALL have the open sea's long, steep waves. Loon Lake and Stump Bay SHALL have shorter, lower waves that keep the mirrored shore readable. On Cedar River the waves SHALL drift downstream with the current.

#### Scenario: Look out to sea from the wall
- **WHEN** the player stands on the breakwater at Gull Rock in daylight, in Painted or Original style, on low or high quality
- **THEN** the water shows crossing wave shapes of mixed size, the sun reflection breaks up along them, and no grid of identical tiles is visible.

#### Scenario: Watch the loop
- **WHEN** the player watches the water for longer than one loop (8 s)
- **THEN** the waves keep moving with no visible jump.

#### Scenario: Calmer inland water
- **WHEN** the player fishes at Loon Lake, Stump Bay or Cedar River
- **THEN** small wind waves cross the water, the far shore still shows in the reflection, and there is less foam than at Gull Rock.

#### Scenario: River current
- **WHEN** the player watches Cedar River
- **THEN** the waves and their foam drift downstream with the current.

### Requirement: Crest foam that fades and drifts
Foam SHALL appear where wave crests break, SHALL fade over a few seconds into thinner streaks, and SHALL drift with the wind. In the Painted style the foam SHALL read as brush dabs.

#### Scenario: Foam life
- **WHEN** a crest breaks in front of the wall
- **THEN** a patch of bright foam appears there, then thins and fades over about two to four seconds while it drifts toward the shore.

#### Scenario: Gameplay marks stay clear
- **WHEN** the player aims, casts, or a fish rises at any place
- **THEN** the aim dots, the landing ring, splash ripples, lure wake and rising-fish rings stay readable above the foam.

### Requirement: Phone cost
The wind waves SHALL add no draw call, mesh, render pass or downloaded file. The tile SHALL bake off the main thread, in less than 250 ms on a desktop CPU, and the water SHALL show the plain swell until the bake is done, then fade the waves in over one second.

#### Scenario: First place of a session
- **WHEN** the game opens at any place, the first time in a session
- **THEN** travel takes no longer than before, and the waves fade in within about a second.

#### Scenario: Phone budget
- **WHEN** `node qa/fish/world.render.mjs` runs
- **THEN** the low-quality draw-call and triangle budgets pass at every place and the travel loop leaks no texture.
