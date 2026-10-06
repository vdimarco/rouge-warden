## ADDED Requirements

### Requirement: Procedural downhill whitewater course
The primary view SHALL use a run-seeded continuous river profile with bends, varying width, quiet pools and downhill chutes. The channel SHALL be wider than the previous 19-unit strip and the chase framing SHALL make the raft smaller relative to the environment. Elevation ahead SHALL descend along the course. Terrain, water, hazards and decorative objects SHALL follow the same profile. Near scenery SHALL approach coherently in the downstream chase view with irregular spacing and asymmetry.
#### Scenario: Ride through pools and chutes
- **WHEN** the player rides through successive generated sections on phone, desktop or landscape
- **THEN** water width, bends, drop grade and bank composition visibly change, the raft points downstream and upcoming hazards remain legible across the three lanes
#### Scenario: Cross procedural boundaries
- **WHEN** the course advances through a chute or terrain segment boundary
- **THEN** elevation and channel edges remain continuous, hazards remain on the river and the raft does not teleport or change logical lanes

### Requirement: Reactive whitewater presentation
Water SHALL show animated downstream currents, broken crests, eddies, shoal foam and wakes. Rapids SHALL increase local wave energy and spray, and buoyancy SHALL pitch the raft with the shared downhill surface. Presentation SHALL preserve accepted speed, immediate inputs, collision windows, continuous skeletal paddling and independent near-prone duck.
#### Scenario: Paddle and steer in rapids
- **WHEN** the player paddles, reverses lanes, jumps or ducks through a steep section
- **THEN** the raft heaves and pitches with the surface, foam and spray indicate rough water, and controls remain responsive without involuntary lane shifts
#### Scenario: Pause, accessibility and rendering bounds
- **WHEN** the player pauses, enables reduced motion or an asset/context becomes unavailable
- **THEN** pause freezes canvas pixels, reduced motion suppresses turbulence/spray/camera bob, fallbacks remain playable and measured scenes remain below 300000 triangles and 65 calls on full rendering or 125000 triangles and 65 calls on software
