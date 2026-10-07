## ADDED Requirements
### Requirement: Continuous forward world motion
The runner SHALL present continuously approaching whitewater and bank scenery in the same perspective and world-distance coordinate system as hazards. Decorative scenery SHALL remain outside playable lanes, fade into the distant scene, pass beyond the viewport and remain bounded independently of run length. Reduced motion SHALL omit this decorative movement.
#### Scenario: Ride without steering
- **WHEN** a normal-motion player rides forward on phone, desktop or landscape
- **THEN** foreground scenery grows and passes beside the raft, whitewater approaches continuously and forward movement remains visible between obstacle rows
#### Scenario: Pause or reduce motion
- **WHEN** the player pauses or enables reduced motion
- **THEN** pause freezes all scenery and pixels, and reduced motion suppresses decorative flow while preserving course movement
### Requirement: Continuous steering and character geometry
Visual steering SHALL preserve position and velocity through repeated lane inputs, settle a single-lane step to 95% within 90 ms and retain immediate logical lane selection. Jump and duck SHALL use the current approved rider appearance, continuous lift or body compression, and registered raft geometry rather than swapping the full character image.
#### Scenario: Reverse a dodge and jump
- **WHEN** the player changes lanes, immediately reverses and jumps or ducks
- **THEN** steering follows a short continuous trajectory, the face and raft remain consistent and controls are available throughout the action

## MODIFIED Requirements
### Requirement: Snappy runner response
The runner SHALL start at 42 m/s and escalate to a bounded 72 m/s, use .66-second jumps and .60-second ducks, and settle visual lane changes to 95% within 90 ms at normal frame rates. Actions SHALL cancel or chain without animation locks. A launch-frame jump SHALL clear a log and its raised coin before the visible arc reaches full height. Touch drags SHALL support successive lane changes at an initial 26-pixel segment and subsequent 56-pixel segments.
#### Scenario: Chain a dodge and action
- **WHEN** a player rapidly changes lanes, jumps and ducks
- **THEN** each input takes effect on the next simulation update, each action silhouette appears immediately and movement settles without long trailing interpolation
#### Scenario: Late launch
- **WHEN** a player taps jump just before a log reaches the raft
- **THEN** the launch frame clears the log and its raised coin without consuming protection
#### Scenario: Continuous touch drag
- **WHEN** a player drags across an initial lane-change segment and a deliberate longer additional segment
- **THEN** two lane changes occur without lifting the finger, and a cancelled pointer produces no further action


### Requirement: Bounded frame rendering
The renderer SHALL composite native decoded video directly behind the gameplay canvas, cap total backing-buffer pixels and avoid full-frame video copies or repeatedly drawing inactive runs. Rendering SHALL preserve exact paused pixels and late-decode freeze, and remain playable through unavailable video/GPU and live motion/data preferences.
#### Scenario: Warm active rendering
- **WHEN** a normal-motion run is sampled with 60fps river media
- **THEN** there are zero full-frame video-to-canvas copies during active native playback, and warmed active frame cost is measured against the prior build
#### Scenario: Inactive run
- **WHEN** a run is paused or completed
- **THEN** simulation and captured pixels remain unchanged and the renderer stops repeating full scene work

### Requirement: Coherent fluid motion
Projected foam SHALL travel toward the raft at course speed. Character animation SHALL retain registered raft centers, base width and waterline across paddle frames and actions, with a registered paddle cycle and continuous ride/action transforms, without crossfading different rider images. River playback SHALL respond to normal speed escalation and Rush.
#### Scenario: Accelerate and dodge
- **WHEN** a run accelerates and the player dodges
- **THEN** water cues and upcoming objects approach together, the raft moves continuously and its animation does not jump between anchors

