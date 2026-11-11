# ember-drift Specification

## Purpose
Ember Drift is an Action game in the Cottage Arcade: an ember that always loses fuel lights stars to stay alive, builds chains and shapes, and plays either an endless flight with comets, flares, beacons and hunting clouds, or 16 hand-made puzzle stages with fuel budgets and par times.

## Requirements

### Requirement: Steering and boost
The ember SHALL always move forward and turn toward the pointer or finger, or turn with the arrow keys or A and D. Holding the mouse button, Space or the Boost button SHALL raise its speed and burn extra fuel.

#### Scenario: Steer with a finger
- **WHEN** a player on a 390 px wide phone holds a finger to the right of the ember
- **THEN** the ember turns right and keeps turning until it faces the finger

#### Scenario: Boost
- **WHEN** the player holds the Boost button during a run
- **THEN** the ember speeds up, the Boost button shows as pressed, and the fuel bar falls faster

### Requirement: Stars, chains and shapes
Flying within reach of a star SHALL light it, give points and fuel, and add it to the chain. A chain SHALL break when no new star is lit before the chain bar empties. A chain of 8 or more SHALL score double. Flying back to a star at least two links back SHALL close a shape for a bonus, and in endless flight a shape of 5 or more stars SHALL fill the fuel.

#### Scenario: Blaze
- **WHEN** the eighth star of one chain is lit
- **THEN** the game shows "Blaze! Double points", the chain label reads Blaze x2, and each later star in that chain scores double

#### Scenario: Perfect shape
- **WHEN** an endless chain returns to its first star after 5 stars
- **THEN** a shape fills in, the game shows "Perfect shape" with its points, and the fuel bar is full

### Requirement: Endless hazards and goals
Endless flight SHALL burn fuel faster with time and depth, and SHALL end when fuel reaches zero. Comets SHALL cross the ember's path with an edge arrow before they arrive; a hit SHALL cost 25 fuel and break the chain, and a near miss SHALL give points. A beacon SHALL mark a far star with a countdown and SHALL give a bonus and 30 fuel when that star is lit in time.

#### Scenario: Comet hit
- **WHEN** a comet touches the ember
- **THEN** the screen flashes red, the fuel falls by 25, and the chain is gone

#### Scenario: Run ends
- **WHEN** the fuel reaches zero in endless flight
- **THEN** the end screen shows score, best, distance, region, stars lit, shapes, longest chain, beacons, close calls, comet hits and the top five runs

### Requirement: Puzzle stages
The game SHALL offer 16 stages, each with a goal, a fuel budget, a par time and a ring. Stage 1 SHALL be open, and each later stage SHALL open when the one before it is cleared. Staying outside the ring for 1.2 seconds SHALL end the attempt. A clear SHALL give 3 sparks at or under par, 2 up to 1.35 times par, and 1 otherwise.

#### Scenario: Wrong order
- **WHEN** in a numbered stage the ember lights a star that is not the next number
- **THEN** every lit star goes out and the count starts again at 1

#### Scenario: Clear a stage
- **WHEN** the stage goal is met
- **THEN** the clear screen shows the time, par, best time and sparks, and Next stage opens the following stage

### Requirement: Arcade fit
The page SHALL make no sound before the player's first input, SHALL offer Switch game in the top bar and in every menu, and SHALL pause a run when the switcher opens. The Action row SHALL end with the Ember Drift cabinet, whose START opens `/ember-drift/`, and whose marquee shows EMBER DRIFT at 390, 320 and 1280 px wide.

#### Scenario: Open from the arcade
- **WHEN** a player drops a token into the Ember Drift cabinet and presses START
- **THEN** the browser goes to `/ember-drift/` and the title screen offers Endless flight, Puzzle stages and Switch game
