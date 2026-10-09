# afterlight Specification

## Purpose
A connected exploration adventure whose six original ASCII landscapes evolve through shared tools, resources and restoration choices.

## Requirements

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

### Requirement: Game engine runtime
Afterlight SHALL use a locally served Phaser game engine for scene lifecycle, rendering composition and input without a runtime CDN dependency.
#### Scenario: Load the adventure
- **WHEN** the player opens Afterlight
- **THEN** a Phaser scene starts and renders the original ASCII landscape with working controls

### Requirement: Living maps
Each region SHALL simulate changing weather, spatial terrain effects and moving actors. Restoration SHALL visibly unfold and alter traversal or local activity. Simulation SHALL freeze while paused and reconstruct safely from existing saves.
#### Scenario: Traverse a changing region
- **WHEN** a player travels through a region over time
- **THEN** environmental state changes and terrain or currents affect movement with visible cues

### Requirement: Spatial multi-step operations
Restoration actions SHALL require distinct region-specific multi-step operations with clear goals, immediate feedback and forgiving retry/cancel behavior. Resources SHALL be charged once on successful completion, and cancellation SHALL preserve resources.
#### Scenario: Operate a landmark
- **WHEN** a player approaches a landmark and begins an operation
- **THEN** they use readable tool decisions or spatial escorting to complete it and see the landscape respond
#### Scenario: Accessible operation controls
- **WHEN** using keyboard, pointer or touch with reduced motion enabled
- **THEN** operations remain completable and controls remain reachable at desktop, portrait and landscape phone sizes

### Requirement: Accurate efficient scene composition
The ASCII compositor SHALL avoid repainting unchanged cells while preserving exact full-redraw pixels. Travel and resize SHALL invalidate scene caches. Phaser's offscreen master SHALL remain 1200 by 600 pixels on high-density phones instead of multiplying the master by device pixel ratio.
#### Scenario: Compare animation and travel frames
- **WHEN** ordered frames across all regions, motion settings, travel and resize are rendered incrementally and with a full-redraw reference
- **THEN** their pixels match exactly and unchanged-cell repainting is skipped
#### Scenario: High-density display
- **WHEN** the game loads on a device with pixel ratio two
- **THEN** its offscreen ASCII master remains 1200 by 600 pixels and the visible scene scales to fit

### Requirement: Concrete rescue purpose
The opening SHALL identify the player as a courier, explain the three stranded crews and six-beacon rescue route, and give the first destination and action. Persistent mission guidance SHALL name a reachable next landmark and explain its outcome. The scene SHALL identify the player and important landmarks without obscuring the ASCII landscape.
#### Scenario: First minute
- **WHEN** a new player begins
- **THEN** the rescue purpose and first task are readable and they can follow a named destination to an actionable supply pack

### Requirement: Spatial collecting and dodge
Forest grove work SHALL involve catching moving fireflies with a lantern in the scene and returning the catch to the grove. Directional dodge SHALL provide a brief protected movement burst with cooldown, keyboard and touch controls, and visible feedback. Neither action SHALL bypass resource costs or completed-task rewards.
#### Scenario: Catch and deliver
- **WHEN** a player starts a grove task and sweeps their lantern near moving fireflies
- **THEN** caught fireflies accumulate visibly and delivery at the grove completes the task once
#### Scenario: Dodge a hazard
- **WHEN** a player dodges while moving
- **THEN** they burst in that direction, avoid hazard damage briefly and must recover before another dodge

### Requirement: Clear restoration payoff
Activating a final beacon after its local prerequisites SHALL be a direct reward rather than another repeated operation. Feedback SHALL explain which people, supplies or routes the action helped. Existing valid saves SHALL preserve completed work and support the new tasks on remaining locations.
#### Scenario: Restore a beacon
- **WHEN** the player has completed its local tasks and pays its displayed cost
- **THEN** the beacon activates directly and the next route or tool is clearly announced
