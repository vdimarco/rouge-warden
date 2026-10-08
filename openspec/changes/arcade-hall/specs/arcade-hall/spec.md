## ADDED Requirements
### Requirement: Ranked default catalog
The home page SHALL open All Games, with launch counts labelled as on this device. Games SHALL sort by descending launch count, with stable catalog order for ties. Search SHALL filter games. Players SHALL be able to open the original machines and the 3D room.
#### Scenario: Return after playing
- **WHEN** a player launches a game and returns home
- **THEN** its count increases and its rank updates
#### Scenario: No saved activity
- **WHEN** a new player opens home
- **THEN** counts show zero without fabricated popularity
### Requirement: Walkable neon room
The room SHALL show lit cabinets with game artwork, neon signs and a cinematic entrance. Desktop and touch controls SHALL move and turn the player, with collision boundaries and a selected-game launch control.
#### Scenario: Walk to a cabinet
- **WHEN** the player moves near a cabinet and points at it
- **THEN** its name appears and the play control opens its game
#### Scenario: Phone layout
- **WHEN** the room opens at 390 by 844
- **THEN** the move pad and play control remain usable without horizontal overflow
#### Scenario: Rendering unavailable
- **WHEN** WebGL cannot initialize
- **THEN** an error and a link to All Games remain visible
### Requirement: Visual checks
Desktop and phone-sized browser checks SHALL verify page identity, meaningful content, console health, filtering, ranking persistence, rendering, movement and navigation. Rendered screenshots SHALL be reviewed for clipping and artwork.
