## ADDED Requirements

### Requirement: ASCII sketches stand in the Lab
The small ASCII scene games (Afterlight, Last Light, Lighthouse Keeper, Echoes Under Ice, Last Train Home, Firefly Courier, Mirage Runner and Orbital Gardener) SHALL stand in the Lab group. ASCII Scenes SHALL hold ASCII Front and Battle Tanks. The Lab page SHALL list them in an ASCII sketches section. All Games SHALL leave them out, and Loon Echo, Take the Plunge and Up the Creek too.

#### Scenario: Lab group
- **WHEN** the player opens `/#lab`
- **THEN** the row shows 17 machines: the nine Lab toys, then the eight ASCII sketches

#### Scenario: ASCII Scenes group
- **WHEN** the player opens `/#ascii`
- **THEN** the row shows ASCII Front and Battle Tanks, with ASCII Front selected

#### Scenario: All Games
- **WHEN** a player opens `/` at desktop or phone size
- **THEN** All Games shows no ASCII sketch tile and no tile for Loon Echo, Take the Plunge or Up the Creek, and The Lab tile is there

#### Scenario: Lab page
- **WHEN** a player opens `/lab/` at desktop or phone size
- **THEN** an ASCII sketches section links to each of the eight games, with its scene picture, and the page does not scroll sideways
