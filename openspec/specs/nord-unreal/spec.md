# NORD Unreal project

## Purpose
Preserve the standalone Montréal Unreal game in Warden with reproducible sources, verified controls, and explicit fidelity limits.

## Requirements

### Requirement: Standalone Unreal project
Warden SHALL preserve NORD under `games/nord-unreal/` with its source, saved maps, required assets, provenance, and build/launch instructions.

#### Scenario: Open and build
- **WHEN** a developer builds the imported project with Unreal Engine 5.8.3 on the supported Linux machine
- **THEN** the editor module builds and the LaFontaine saved map loads
- **AND** the project documentation identifies Vulkan SM6 as required

### Requirement: Preserve verified play
The imported project SHALL retain walking, driving, shared park objectives, and direct-IP multiplayer behavior.

#### Scenario: Use desktop controls
- **WHEN** a player plays the LaFontaine map in a 1280 by 720 desktop window
- **THEN** WASD moves, mouse looks, Shift sprints, Space jumps on foot or brakes the car, and E enters/exits a nearby available car
- **AND** the HUD shows mission progress, the road map, and contextual controls

#### Scenario: Drive over small obstacles
- **WHEN** the car drives across decorative road markings and the tested 18 cm curb
- **THEN** it traverses them while a tall wall still blocks it

#### Scenario: Share progress
- **WHEN** two players connect to a listen server and complete objectives in order
- **THEN** car occupancy, movement, and shared objective progress replicate

### Requirement: Honest geographic and visual scope
The project SHALL identify its OpenStreetMap and CC0 art sources and its current reconstruction limits.

#### Scenario: Inspect fidelity
- **WHEN** the map is inspected at its saved spawn near 1334 Rue Sherbrooke Est
- **THEN** the imported map orientation, district scale, ground collision, and address building collision pass validation
- **AND** documentation identifies the municipal survey coverage and states which façades, heights, widths, terrain, and distant tree appearance remain simplified
- **AND** it makes no claim of Street View-identical fidelity or built interiors

### Requirement: Comic-book look
The LaFontaine map SHALL render in an animated comic-book style by default, with ink outlines, flat colour bands, halftone dots, hatching in deep shadow and offset print plates, without using characters, suits or logos from any film.

#### Scenario: See the comic look on foot
- **WHEN** a player spawns near 1334 Rue Sherbrooke Est in a 1280 by 720 or larger desktop window
- **THEN** building and tree silhouettes have dark ink outlines
- **AND** shaded areas show a regular halftone dot pattern
- **AND** distant objects show red and blue plates offset from each other

#### Scenario: Switch the look
- **WHEN** the player presses F2
- **THEN** the view returns to the realistic render for that player only
- **AND** pressing F2 again restores the comic look

#### Scenario: Drive with the look
- **WHEN** the player enters the car
- **THEN** the car camera keeps the player's current look setting

### Requirement: Animation on twos
The walking character SHALL update its pose 12 times a second while its movement and the camera update every frame.

#### Scenario: Watch the character run
- **WHEN** the comic look is on and the character runs
- **THEN** the body pose changes in held steps while the character glides smoothly across the ground
- **AND** turning the look off with F2 restores full-rate animation

### Requirement: Comic HUD
The HUD SHALL use comic caption boxes and show brief sound-word bursts for local jump, hard acceleration and handbrake actions, while keeping mission, map and control information.

#### Scenario: Read the HUD
- **WHEN** the player is on foot or in the car
- **THEN** the mission, the road map with attribution and the control hints remain readable in caption boxes

#### Scenario: Pull the handbrake
- **WHEN** the driver holds Space while moving
- **THEN** a sound-word burst appears briefly near the car

### Requirement: Repository hygiene
The import SHALL exclude local credentials, packaged builds, engine caches, recovery data, and regenerated base OSM geographic OBJ files. Processed municipal mesh inputs, roof atlases and authored comic meshes SHALL be retained as reproducible source assets.

#### Scenario: Inspect the commit
- **WHEN** the import is staged
- **THEN** only the project, source assets, documentation, and focused specification files are included
- **AND** the existing browser arcade is unchanged


### Requirement: Surveyed starting-block buildings
The game SHALL use attributed municipal textured LOD2 models near 1334 Sherbrooke Est, preserving surveyed roof shapes and roof photo UVs, with illustrated façade patterns explicitly identified as estimated: flat brick colour bands, dark window outlines, cream trim and blue glass.

#### Scenario: Explore the starting block
- **WHEN** a player walks around the starting block in a 1280 by 720 or larger desktop window
- **THEN** municipal building geometry replaces overlapping procedural blocks and have working exterior collision
- **AND** F2 continues to switch the global comic post-process independently of geometry, while the illustrated façade artwork remains
- **AND** map provenance identifies the survey year and simplified terrain

#### Scenario: Read the illustrated street
- **WHEN** the comic filter is enabled in a 1280 by 720 or larger desktop view
- **THEN** road surfaces and façades remain visible rather than filling with solid ink
- **AND** dark window borders, cream trim and blue glass remain readable against terracotta brick bands

#### Scenario: Preserve driving
- **WHEN** a player drives from the starting road over a decorative marking or the tested curb
- **THEN** existing entry, exit and obstacle traversal still work

### Requirement: Comic park district
The game SHALL render mapped Parc La Fontaine paths, ponds, sports areas and landmarks with attributed geographic sources, varied trees and clearly identified estimated model details.

#### Scenario: Explore the park
- **WHEN** a player walks through the park at 1280×720 or larger
- **THEN** the pond edges, theatre, chalet and sports courts are distinguishable in rendered reference views
- **AND** surrounding surveyed buildings and tree locations follow the available source data
- **AND** F2 switches the global comic filter while illustrated assets remain

### Requirement: Original park residents
The game SHALL include goofy original park residents with readable silhouettes and short original dialogue, including the eight user-supplied cottage crew designs with temporary descriptive names and illustrated face atlases.

#### Scenario: Meet a resident
- **WHEN** a walking player approaches a resident and presses E
- **THEN** the player receives the resident's dialogue
- **AND** two connected players see the same resident placement and movement
- **AND** only the interacting player receives the dialogue, without changing completed mission progress

### Requirement: Illustrated cars
The game SHALL give cars a shaped comic hatchback body, distinct windows, wheel arches, lights and trim while preserving the existing collision box and driving controls.

#### Scenario: Drive the upgraded car
- **WHEN** a player enters with E and drives with W/S and A/D
- **THEN** the new car art follows the vehicle and its wheels animate
- **AND** street marking and tested curb traversal, handbraking and exit still pass the driving checks
