# shore-3d-play Specification

## Purpose
Keep Shore exclusively in 3D with visible terrain beside travel routes, stable surface interactions and clear graphics recovery.

## Requirements

### Requirement: Visible hills alongside playable routes
Shore SHALL display clearly raised, lit hills alongside ordinary travel routes in both realms while keeping rolling road cores, level structure foundations and bridge approaches stable. Terrain, units, camera, picking and spell warnings SHALL agree on the same sampled surface. Team symmetry and planar combat rules SHALL remain unchanged.

#### Scenario: Follow a road past a hillside
- **WHEN** a player travels a side lane on desktop or a phone viewport
- **THEN** nearby hills have visible slopes and rock faces at the normal gameplay camera, with dry side lanes spanning at least 300 units of elevation and whole-map land relief exceeding 900 units
- **AND** desktop and phone screenshots show the hillside beside the traversable road without covering controls

#### Scenario: Aim on raised land
- **WHEN** a player clicks or aims a skill on raised land in either realm
- **THEN** the projected marker, hero feet and ground warnings agree with the mesh surface

### Requirement: Exclusive 3D battlefield
Shore SHALL always use the 3D battlefield on WebGL2 browsers, including software renderers. Saved 2D preferences and old renderer URLs SHALL NOT select 2D. Settings and pause SHALL NOT offer a 2D mode. The live page SHALL NOT import the legacy battlefield renderer or load its unused scenery sprites.

#### Scenario: Return with an old preference
- **WHEN** a player opens Shore with a saved 2D preference or renderer=2d URL
- **THEN** hero selection and the match render in 3D and the old preference is removed

#### Scenario: Graphics cannot start
- **WHEN** WebGL2 is unavailable or the 3D module or required models cannot load
- **THEN** Play stays disabled and the page explains how to retry or enable graphics acceleration without starting a 2D battlefield

#### Scenario: Graphics context is lost
- **WHEN** the WebGL context is lost during play
- **THEN** the simulation pauses, inputs clear and a visible recovery message offers reload
- **AND** after graphics restore the player can explicitly resume in 3D without losing the match
