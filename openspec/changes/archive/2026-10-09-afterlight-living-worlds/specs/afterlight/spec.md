## ADDED Requirements

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
