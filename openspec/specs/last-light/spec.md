# last-light Specification

## Purpose
A finite ASCII sailing adventure through sunset, night coast and aurora fjord.

## Requirements

### Requirement: Three playable crossings
The game SHALL let players steer a sailboat through three 35-second crossings, collect lights, dodge rocks, and reach home after surviving all crossings. Hull SHALL start at three, hits SHALL remove one hull with brief invulnerability, and zero hull SHALL end the voyage.
#### Scenario: Finish the voyage
- **WHEN** a player survives all three crossings
- **THEN** a victory state shows their score and offers a new voyage
#### Scenario: Wreck
- **WHEN** a vulnerable boat hits a third hazard
- **THEN** the simulation stops and retry is available

### Requirement: Keyboard and touch controls
The game SHALL support arrows and WASD steering, Space dash, P/Escape pause, and visible touch steering/dash controls. Dash SHALL have a cooldown and prevent damage while active.
#### Scenario: Dash and cooldown
- **WHEN** the player activates an available dash
- **THEN** the boat accelerates, becomes briefly safe, and cannot dash again until the cooldown ends
#### Scenario: Touch steering
- **WHEN** a player holds a touch steering control and releases or cancels it
- **THEN** the boat moves while held and the input clears on release or cancellation

### Requirement: Pause and lifecycle
The simulation SHALL freeze on pause, page hiding, and completion. Reduced motion SHALL keep decorative scene time fixed while gameplay remains responsive.
#### Scenario: Hide during a voyage
- **WHEN** the playing page is hidden
- **THEN** gameplay pauses and requires a deliberate resume
#### Scenario: Pause
- **WHEN** the player pauses
- **THEN** time, collisions, entities and dash cooldown freeze until resumed

### Requirement: ASCII art and responsive layouts
The game SHALL retain dense coloured halftone characters, violet/gold sunset, blue night coast and green aurora scenes, monospace UI, and boat/collectible/hazard art drawn with the same dot glyphs, cell spacing and scene palettes. Scenes SHALL be bundled locally with MIT attribution. The intended deviation from raster game assets is required by the user's ASCII reference.
#### Scenario: Desktop and phone layouts
- **WHEN** viewed at 1440×900, 390×844, or 844×390
- **THEN** the game, primary actions and touch controls remain readable, reachable and free from horizontal overflow
#### Scenario: Motion preference
- **WHEN** reduced motion is enabled
- **THEN** clouds, waves and cosmetic flashing stop while steering and gameplay work

### Requirement: Safe records and arcade access
The game SHALL retain valid finite nonnegative best scores and tolerate unavailable or malformed storage. The arcade SHALL expose the game through a cabinet and shared switcher.
#### Scenario: Retry
- **WHEN** a completed run has a new best and the player retries
- **THEN** best persists while hull, score and progress reset
#### Scenario: Invalid storage
- **WHEN** saved data is malformed or storage throws
- **THEN** a new voyage remains playable with a safe default best

#### Scenario: Cohesive moving objects
- **WHEN** the boat, lights and rocks are rendered over a crossing
- **THEN** their dots align to the scene grid, use the crossing palette, and avoid oversized line-character overlays

### Requirement: Water perspective
Objects SHALL enter on each crossing’s water horizon and approach along diverging water lanes, growing and accelerating toward the foreground. Rendering and collisions SHALL share projected positions. The boat SHALL scale with its position on the water, and objects SHALL have subtle water contact marks in the scene dot grid.
#### Scenario: Approach from the horizon
- **WHEN** a light or rock enters a crossing
- **THEN** it starts small at that scene’s water horizon, moves down and outward along its lane, and grows toward the player
#### Scenario: Depth and collision agree
- **WHEN** an approaching object reaches the boat
- **THEN** collection or damage uses its visible projected position and depth-scaled bounds
#### Scenario: Water contact
- **WHEN** viewed at desktop or phone sizes
- **THEN** boat and object silhouettes, wakes and reflections remain aligned to the scene’s dot grid without covering the horizon with large sprites
