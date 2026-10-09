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
- **AND** documentation states that façades, heights, widths, terrain, and distant tree appearance are simplified
- **AND** it makes no claim of Street View-identical fidelity or built interiors

### Requirement: Repository hygiene
The import SHALL exclude local credentials, packaged builds, engine caches, recovery data, and regenerated geographic OBJ files.

#### Scenario: Inspect the commit
- **WHEN** the import is staged
- **THEN** only the project, source assets, documentation, and focused specification files are included
- **AND** the existing browser arcade is unchanged
