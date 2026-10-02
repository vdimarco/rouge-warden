## ADDED Requirements

### Requirement: Expanded two-stage arena
The arena SHALL be 6400 units square. Each lane SHALL have an outer and inner tower for each team. The inner tower SHALL remain protected until its lane's outer tower falls, and the core SHALL unlock only after one lane loses both towers. World paths, river, terrain, camps, portals, scenery and maps SHALL use the same dimensions.

#### Scenario: Break a lane
- **WHEN** a player attacks the inner tower before its outer tower falls
- **THEN** it takes no damage, targeting excludes it, and the HUD explains the outer objective.
- **WHEN** the outer tower and then its inner tower fall
- **THEN** the next stage becomes vulnerable and the HUD directs the player to it.

### Requirement: Clear match flow
Players SHALL begin behind their allied outer towers and receive a clear next objective. Map destinations SHALL issue actual movement or attack orders after the map closes. The camera SHALL keep the player and forward action visible while following movement smoothly.

#### Scenario: Enter the arena
- **WHEN** the player starts a match
- **THEN** the hero begins in a supported lane position, can learn a skill, and can follow a map route to the next vulnerable enemy tower.

#### Scenario: Follow a map route
- **WHEN** the player selects a destination on the tactical map
- **THEN** the map closes and the hero moves to it or pursues the selected vulnerable tower, while manual movement can cancel the route.
