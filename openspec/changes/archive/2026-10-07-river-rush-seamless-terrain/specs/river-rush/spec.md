## ADDED Requirements

### Requirement: Seamless varied terrain with bounded forward chunks
Riverbanks SHALL use deterministic seamlessly periodic two-dimensional noise with bounded layered relief. Canopy SHALL have rounded hills, Redstone SHALL have eroded terraced rock formations, and Moonlit SHALL have broken stepped ridges. CPU scenery placement and GPU bank geometry SHALL use matching terrain heights, with additional relief fading to zero at the navigable channel.

Terrain SHALL reuse a fixed pool of six 64 m chunks per bank, retain contiguous visible coverage, schedule terrain ahead of travel, and recycle only chunks no longer needed behind the camera. Forward movement SHALL use the prepared shader; terrain instance matrices SHALL update only when chunk identities change. Resources and active counts SHALL remain bounded independent of distance and stage transitions.

#### Scenario: Cross a terrain chunk or noise period
- **WHEN** the raft passes a chunk boundary or the procedural noise wraps
- **THEN** terrain height and surface slope remain continuous with no crack, popping bank edge or displaced scenery foot

#### Scenario: Compare three river environments
- **WHEN** a player rides opening and late portions of all maps on supported layouts
- **THEN** seeded bank shapes visibly vary across the course, each map has its stated terrain character, and playable lanes and upcoming hazards remain clear

#### Scenario: Recycle the visible corridor
- **WHEN** the raft advances, changes maps or restarts a river
- **THEN** six prepared slots per bank cover the visible corridor and enough upcoming terrain, old slots recycle without memory growth, and no play-time terrain texture or shader work occurs

#### Scenario: Keep controls and stopped frames
- **WHEN** the player steers, jumps, ducks, pauses or enables reduced motion
- **THEN** accepted speed and action rules remain, scenery stays registered to the shared terrain, and stopped frames remain unchanged
