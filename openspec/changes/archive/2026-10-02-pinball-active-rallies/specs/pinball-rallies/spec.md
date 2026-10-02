## ADDED Requirements

### Requirement: Repeated player shots
Full Tilt SHALL bring long orbital flights back toward the active flippers with continuous physical motion and provide a readable return cue.

#### Scenario: An unattended flight
- **WHEN** a live shot has flown for the free-flight window without another real flipper strike
- **THEN** a bounded return current guides it toward the dock and the player is cued to prepare a flip
- **AND** a missed shot can drain, while the existing reverse scoop remains available

#### Scenario: A fresh shot
- **WHEN** the moving flipper strikes the ball upward
- **THEN** the next free-flight window begins and the ball temporarily gains asteroid-breaking power
- **AND** holding a blade or pressing it away from the ball grants no power or score

### Requirement: Dynamic asteroid encounters
Asteroids SHALL move on seeded bounded paths, deflect ordinary shots and break under a powered shot.

#### Scenario: Smash and reentry
- **WHEN** a powered ball collides with a live asteroid
- **THEN** that asteroid disappears, emits one destruction reward and shows fragments
- **AND** its return is warned in advance and delayed while its spawn would overlap the ball

#### Scenario: Fair moving collisions
- **WHEN** an ordinary ball hits a moving asteroid
- **THEN** its bounce accounts for the rock's velocity without a bumper kick
- **AND** inactive sectors, destroyed rocks and warning-only rocks do not collide

### Requirement: Skillful momentum
Pulse SHALL bend the current velocity through a bounded impulse, while timed physical flipper hits earn a capped rally multiplier.

#### Scenario: Pulse is a correction
- **WHEN** the player presses Pulse
- **THEN** the ball retains its incoming momentum plus a bounded correction
- **AND** the return clock is not reset

#### Scenario: Lifecycle and controls
- **WHEN** the player pauses, opens the map, aims a field, changes sectors, loses a ball or restarts
- **THEN** timers freeze or reset consistently and no stale hazard collision or powered reward carries into a new ball
- **AND** Z/X and touch controls expose the same mechanics in portrait and landscape

### Requirement: Readable celestial action
The HUD and playfield SHALL communicate powered shots, return approaches and asteroid reentry without covering essential controls.

#### Scenario: Reduced motion
- **WHEN** reduced motion is enabled
- **THEN** collision geometry and gameplay remain the same while decorative particles and motion trails are suppressed
