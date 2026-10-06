## ADDED Requirements

### Requirement: Near-prone duck silhouette
Ducking SHALL use an independent near-prone rear-facing rider asset, with head and shoulders close to the deck and a low horizontal paddle. Its visible silhouette SHALL be at most 45% of the jumping pose height at the same art scale. Jump SHALL retain its raised-leg and lifted-paddle appearance. Both poses SHALL preserve the approved identity, hair, modest loincloth, downstream orientation and raft registration without vertical image compression or gameplay changes.
#### Scenario: Chain a jump into a duck
- **WHEN** the player jumps and immediately ducks using keyboard or touch
- **THEN** the raised jump pose changes immediately into a visibly low near-prone brace in both WebGL and fallback, with the same collision windows and raft anchor

### Requirement: Detailed river surface materials
The river SHALL use locally hosted detailed rock, wood, shoreline and water surface textures with bounded map resolution, shared material instances and existing scenery instance counts. Water detail SHALL flow downstream with the course while preserving the shared displacement/buoyancy field. Hardware and software renderers SHALL retain readable hazards, reduced motion and exact paused pixels.
#### Scenario: Inspect and pause textured play
- **WHEN** the player rides, jumps, ducks and pauses on phone, desktop or landscape
- **THEN** surface detail remains visible, pose silhouettes remain clear and paused pixels remain stable, without changing speed or controls

## MODIFIED Requirements

### Requirement: Snappy runner response
The runner SHALL start at 42 m/s and escalate to a bounded 72 m/s, use .66-second jumps and .60-second ducks, and settle visual lane changes to 95% within 150 ms at normal frame rates. Actions SHALL cancel or chain without animation locks. A launch-frame jump SHALL clear a log and its raised coin before the visible arc reaches full height. Touch drags SHALL support successive lane changes at an initial 26-pixel segment and subsequent 56-pixel segments.
#### Scenario: Chain a dodge and action
- **WHEN** a player rapidly changes lanes, jumps and ducks
- **THEN** each input takes effect on the next simulation update, each action silhouette appears immediately and movement settles without long trailing interpolation
#### Scenario: Late launch
- **WHEN** a player taps jump just before a log reaches the raft
- **THEN** the launch frame clears the log and its raised coin without consuming protection
#### Scenario: Continuous touch drag
- **WHEN** a player drags across an initial lane-change segment and a deliberate longer additional segment
- **THEN** two lane changes occur without lifting the finger, and a cancelled pointer produces no further action

### Requirement: Continuous steering and character geometry
Visual steering SHALL move through a continuous carving glide and preserve position and velocity through repeated lane inputs, settle a single-lane step to 95% within 150 ms and retain immediate logical lane selection. Jump and duck SHALL retain the approved rider identity, with continuous raft lift and distinct registered rider poses. Duck SHALL use a near-prone anatomical brace with no vertical image compression. Rider art SHALL remain independent of the registered raft geometry.
#### Scenario: Reverse a dodge and jump
- **WHEN** the player changes lanes, immediately reverses and jumps or ducks
- **THEN** steering follows a short continuous trajectory, the rider identity and raft remain consistent, distinct jump/duck silhouettes remain registered and controls are available throughout the action


### Requirement: Runner character animation
The approved character SHALL use rear-facing generated paddling frames, a distinct raised-knee jump pose and an independent near-prone brace for ducking. His long hair, body, modest loincloth and identity SHALL remain consistent. The chase view SHALL show him facing downstream toward upcoming hazards, with the wake behind the raft and approaching scenery moving toward the camera. Rider feet and raft anchors SHALL remain registered. Visual animation SHALL NOT change action windows, speed, collision outcomes or scores.
#### Scenario: Paddle and chain actions
- **WHEN** the player rides, changes lanes, jumps and ducks
- **THEN** paddling faces downstream, the raft banks, jump and duck use visibly different silhouettes and a landing splash marks a completed jump
#### Scenario: Direction and fallback
- **WHEN** the player rides in the primary 3D view or 2D fallback
- **THEN** the rider faces the upcoming course, the wake trails behind and scenery approaches the camera coherently
