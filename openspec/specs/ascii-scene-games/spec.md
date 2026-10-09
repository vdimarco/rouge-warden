# ascii-scene-games Specification

## Purpose
Six independent arcade games whose mechanics and halftone visuals grow from their original ASCII landscape scenes.

## Requirements

### Requirement: Six scene-native games
The arcade SHALL provide six independent playable games with local ASCII scenes: Lighthouse Keeper beam-guided boats; Echoes Under Ice sonar and bell recovery; Last Train Home timed route finding; Firefly Courier light release and recall; Mirage Runner wind and mirages; Orbital Gardener seed collection and gravity-altering plants.
#### Scenario: Lighthouse shift
- **WHEN** a player sweeps their beam and guides boats
- **THEN** visibility reveals vessels, guidance changes their course, safe arrivals score and dangerous encounters threaten the shift
#### Scenario: Bell recovery
- **WHEN** a player sends sonar through the fjord
- **THEN** hidden bells and hazards are temporarily revealed and the player can recover bells to complete a dive
#### Scenario: Final train
- **WHEN** a player follows clues through rainy streets before departure
- **THEN** collected route markers enable reaching the train while a missed deadline ends the run
#### Scenario: Firefly delivery
- **WHEN** a player releases and recalls their fireflies
- **THEN** released light reveals the path and resource management affects reaching the delivery goal
#### Scenario: Desert crossing
- **WHEN** a player steers a skiff through the dunes
- **THEN** wind changes its course, false landmarks dissolve on approach and true checkpoints advance the journey
#### Scenario: Orbital planting
- **WHEN** a player collects seeds and plants them
- **THEN** planting creates visible growth and changes subsequent orbital motion until the garden goal is reached

### Requirement: Complete round lifecycle
Every game SHALL provide a deliberate start, responsive controls, measurable progress, finite success/failure conditions, pause/resume and a fresh retry. Scores SHALL tolerate blocked or malformed local storage.
#### Scenario: Pause and retry
- **WHEN** a player pauses or hides a playing game, then resumes or retries
- **THEN** simulation time stops while paused, resumes deliberately and retry resets the round state

### Requirement: Cohesive ASCII presentation
Games SHALL use bundled MIT-attributed scenes, fine halftone grid-aligned gameplay objects and restrained monospace controls. Objects on water or sand SHALL respect scene depth where relevant. Reduced motion SHALL stop decorative motion while keeping gameplay usable.
#### Scenario: Desktop and phone
- **WHEN** a game is viewed at 1440×900, 390×844 or 844×390
- **THEN** its scene and primary actions remain readable, controls are reachable and the page has no horizontal overflow

### Requirement: Arcade discovery
All six games SHALL be reachable through their own routes, arcade cabinets and the shared game switcher.
#### Scenario: Launch and switch
- **WHEN** a player launches a new game from the arcade or switches away during a round
- **THEN** the correct route loads its local assets and opening the switcher pauses the current simulation
