## ADDED Requirements
### Requirement: Snappy runner response
The runner SHALL start at 30 m/s and escalate to a bounded 50 m/s, use .66-second jumps and .60-second ducks, and settle visual lane changes to 95% within 90 ms at normal frame rates. Actions SHALL cancel or chain without animation locks. A launch-frame jump SHALL clear a log and its raised coin before the visible arc reaches full height. Touch drags SHALL support successive lane changes at an initial 26-pixel segment and subsequent 56-pixel segments.
#### Scenario: Chain a dodge and action
- **WHEN** a player rapidly changes lanes, jumps and ducks
- **THEN** each input takes effect on the next simulation update, each action silhouette appears immediately and movement settles without long trailing interpolation
#### Scenario: Late launch
- **WHEN** a player taps jump just before a log reaches the raft
- **THEN** the launch frame clears the log and its raised coin without consuming protection
#### Scenario: Continuous touch drag
- **WHEN** a player drags across an initial lane-change segment and a deliberate longer additional segment
- **THEN** two lane changes occur without lifting the finger, and a cancelled pointer produces no further action
### Requirement: Coherent fluid motion
Projected foam SHALL travel toward the raft at course speed. Character animation SHALL retain registered raft centers, base width and waterline across paddle frames and actions, with interpolated paddle movement and no ghosted jump/duck transition. River playback SHALL respond to normal speed escalation and Rush.
#### Scenario: Accelerate and dodge
- **WHEN** a run accelerates and the player dodges
- **THEN** water cues and upcoming objects approach together, the raft moves continuously and its animation does not jump between anchors
### Requirement: Bounded frame rendering
The renderer SHALL cache video by decoded frames, cap total backing-buffer pixels and avoid copying unchanged video frames or repeatedly drawing inactive runs. Rendering SHALL preserve exact paused pixels and late-decode freeze, and remain playable through unavailable video/GPU and live motion/data preferences.
#### Scenario: Warm active rendering
- **WHEN** a normal-motion run is sampled with 24fps river media
- **THEN** video cache writes track decoded frames rather than every animation tick, and warmed active frame cost is measured against the prior build
#### Scenario: Inactive run
- **WHEN** a run is paused or completed
- **THEN** simulation and captured pixels remain unchanged and the renderer stops repeating full scene work
