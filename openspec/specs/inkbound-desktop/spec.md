# inkbound-desktop Specification

## Purpose
Preserve the playable Inkbound desktop prototype and its runtime assets in a checkout that opens with Godot 4.6.

## Requirements

### Requirement: Local Godot launch

Inkbound SHALL launch as a self-contained Godot 4.6 desktop project from `games/inkbound/` using the checked-in runtime assets.

#### Scenario: Open a clean checkout

- **WHEN** a developer opens `games/inkbound/project.godot` and runs the project
- **THEN** the Drowned Reliquary loads with its baked scenery, the Ashwarden model, and the HUD
- **AND** the developer can run the project without regenerating assets or connecting to a service

### Requirement: Preserve the playable prototype

The desktop project SHALL retain the camera-relative controls, Ashwarden animation and combat, and progression through the three rooms.

#### Scenario: Use the movement and combat controls

- **WHEN** a player uses WASD, the orbit controls, Space, Shift and J
- **THEN** the player can run relative to the camera, jump and air jump, dash, and chain sword strikes
- **AND** a buffered dash starts when its cooldown expires and a jump can cancel dash recovery

#### Scenario: Complete the course

- **WHEN** the player crosses each room, claims its sigil, and reaches its arch
- **THEN** the first two arches advance to the next checkpoint and the final arch displays the victory message
