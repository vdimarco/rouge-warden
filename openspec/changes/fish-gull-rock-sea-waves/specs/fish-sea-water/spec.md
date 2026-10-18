## ADDED Requirements

### Requirement: Wind-sea wave shapes at Gull Rock
At Gull Rock the water SHALL show irregular wind waves that move toward the breakwater, with sharper crests and wider troughs, and the pattern SHALL NOT show a visible repeat or a jump when its loop restarts. The other places SHALL look as they did before this change.

#### Scenario: Look out to sea from the wall
- **WHEN** the player stands on the breakwater at Gull Rock in daylight, in Painted or Original style, on low or high quality
- **THEN** the water shows crossing wave shapes of mixed size, the sun reflection breaks up along them, and no grid of identical tiles is visible.

#### Scenario: Watch the loop
- **WHEN** the player watches the water for longer than one loop (8 s)
- **THEN** the waves keep moving with no visible jump.

#### Scenario: Other places unchanged
- **WHEN** the player fishes at Loon Lake, Stump Bay or Cedar River
- **THEN** the water looks and moves as before.

### Requirement: Crest foam that fades and drifts
At Gull Rock, foam SHALL appear where wave crests break, SHALL fade over a few seconds into thinner streaks, and SHALL drift with the wind. In the Painted style the foam SHALL read as brush dabs.

#### Scenario: Foam life
- **WHEN** a crest breaks in front of the wall
- **THEN** a patch of bright foam appears there, then thins and fades over about two to four seconds while it drifts toward the shore.

#### Scenario: Gameplay marks stay clear
- **WHEN** the player aims, casts, or a fish rises at Gull Rock
- **THEN** the aim dots, the landing ring, splash ripples, lure wake and rising-fish rings stay readable above the foam.

### Requirement: Phone cost
The Gull Rock waves SHALL add no draw call, mesh, render pass or downloaded file. The tile SHALL bake off the main thread, in less than 250 ms on a desktop CPU, and the water SHALL show the plain swell until the bake is done, then fade the waves in over one second.

#### Scenario: Travel to Gull Rock
- **WHEN** the player travels to Gull Rock for the first time in a session
- **THEN** travel takes no longer than before, and the waves fade in within about a second.

#### Scenario: Phone budget
- **WHEN** `node qa/fish/world.render.mjs` runs with `WORLD_PLACES=sea`
- **THEN** the low-quality draw-call and triangle budgets pass and the travel loop leaks no texture.
