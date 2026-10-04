## ADDED Requirements

### Requirement: Battle announcer
The game SHALL announce first blood, double, triple and team-wipe kills, kill streaks, shutdowns, allied structures under attack, wards falling, the Wild Hunt, realm shifts, victory and defeat. Each call SHALL have a distinct stinger and a banner. A spoken line SHALL play when the device has an English voice and the voice setting is on.

#### Scenario: Hear a multi-kill
- **WHEN** the player kills two enemy heroes within 12 seconds
- **THEN** a "Double kill" banner and stinger play.

#### Scenario: Defend a tower
- **WHEN** an enemy damages an allied ward
- **THEN** an alarm plays naming the lane, at most once per ward every 14 seconds, and the ward pulses on the minimap.

### Requirement: Spatial battle sound
Hits, casts, deaths and tower shots SHALL play from their world positions, panned by screen direction and quieter with distance. Distant team fights SHALL be audible as faint clashes from their direction.

#### Scenario: Fight off screen
- **WHEN** a teammate fights on the left side beyond the camera
- **THEN** quiet clashes come from the left.

### Requirement: Draft sound
The draft SHALL play a soft tick while a bot considers and a lock-in hit when a pick locks, and a horn when the match starts.

#### Scenario: Lock a pick
- **WHEN** a bot locks a hero
- **THEN** a lock-in sound plays and the card shows the locked hero.

### Requirement: Scene music
The menu, draft, match, victory and defeat SHALL each have an orchestral track. In a match, a battle track SHALL rise while heroes fight near the player and hold for several seconds after the last clash, then return to the calm track. Music SHALL pause while the tab is hidden and SHALL have its own on/off setting.

#### Scenario: Enter a fight
- **WHEN** an enemy hero comes close to the player during a match
- **THEN** the battle track fades in over the calm track and fades out about seven seconds after the fighting stops.

#### Scenario: Finish a match
- **WHEN** the match ends
- **THEN** the match tracks stop and the victory or defeat track plays once.
