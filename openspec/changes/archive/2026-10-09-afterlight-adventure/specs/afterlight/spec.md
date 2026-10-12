## Purpose
A connected exploration adventure whose six original ASCII landscapes evolve through shared tools, resources and restoration choices.

## ADDED Requirements
### Requirement: Connected exploration campaign
Afterlight SHALL provide a single campaign connecting forest, city, coast, fjord, desert and moon scenes with shared inventory, health, tools and restoration state. Restoring places SHALL open routes or grant tools needed in other places. Players SHALL be able to revisit unlocked places with their state retained.
#### Scenario: Travel with consequences
- **WHEN** a player restores a location and travels to another unlocked place
- **THEN** inventory and damage carry across, the new route/tool is available, and returning preserves restoration
#### Scenario: Complete the network
- **WHEN** the player satisfies the restoration objectives across the six worlds
- **THEN** the adventure ends with a visibly restored world and options to explore the restored network or begin a new journey

### Requirement: Decisions and progression
Exploration SHALL include resource costs, hazards, optional rewards/upgrades and tool interactions. Players SHALL choose when to spend resources, recover, explore or travel. Safe recovery SHALL prevent resource exhaustion from permanently blocking progression.
#### Scenario: Resource tradeoff
- **WHEN** a player chooses an upgrade, restorative action or optional cache
- **THEN** the choice changes usable inventory or abilities and affects later play
#### Scenario: Failure and recovery
- **WHEN** hazards exhaust the player’s health or expedition resources
- **THEN** a clear recovery option restores play from a safe checkpoint with already-restored locations retained

#### Scenario: Choose the first route
- **WHEN** the forest beacon is restored
- **THEN** both city and coast routes open, while later harbor restoration requires the sonar earned in the city
#### Scenario: Nurture instead of harvest
- **WHEN** a player nurtures an awakened grove instead of gathering it
- **THEN** they gain one carried seed and permanent energy capacity instead of two seeds, and a persistent bloom appears in the scene

### Requirement: Evolving scenery
The original ASCII landscapes SHALL respond visibly and structurally to campaign actions. Forest paths/vegetation, city lights, harbor activity, fjord ice/aurora, desert oasis and lunar gardens SHALL evolve beyond static backdrops. Scene-grounded gameplay objects SHALL match the source dot grid and palette. Reduced motion SHALL suppress decorative motion without hiding restoration changes.
#### Scenario: Restore and revisit
- **WHEN** a player restores a beacon or plants a garden
- **THEN** visible scene cells/structures change, the change persists on revisit, and it remains visible with reduced motion enabled

### Requirement: Playable accessible lifecycle
The adventure SHALL support deliberate start, keyboard and touch movement/action/tool controls, travel and journal interfaces, pause/resume, safe persistence and a new journey. Page hiding or game switching SHALL pause gameplay. Desktop and both phone orientations SHALL preserve readable scenes and reachable controls without horizontal overflow.
#### Scenario: Save and resume
- **WHEN** a player reloads with a valid journey save
- **THEN** they can deliberately resume their campaign; malformed or blocked storage remains playable
#### Scenario: Phone and pause
- **WHEN** playing at 390×844 or 844×390 and opening travel/journal/switch menus
- **THEN** controls remain usable and expedition time freezes until deliberate resume
