# pinball-rallies

## Purpose
Full Tilt makes each flip count: the ball comes back for a timed flip, the flip gets a grade, and asteroids and the multiplier reward a clean rally.

## Requirements

### Requirement: Repeated player shots
Full Tilt SHALL bring each shot back to a flipper after a short orbit, with continuous physical motion and a cue that comes in time for the flip.

#### Scenario: An unattended flight
- **WHEN** a live shot has flown for 2.5 s without another real flipper strike
- **THEN** a bounded return current drops the ball onto the middle of a flipper blade
- **AND** a missed shot can drain, while the reverse scoop stays available

#### Scenario: A hit ends the orbit
- **WHEN** the ball lights a beacon or smashes an asteroid
- **THEN** the return starts at once

#### Scenario: A fresh shot
- **WHEN** the moving flipper strikes the ball upward
- **THEN** the next free-flight window begins and the ball gets asteroid-breaking power for a short time
- **AND** holding a blade or pressing it away from the ball gives no power or score

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
Pulse SHALL bend the current velocity through a bounded impulse. Each powered flip SHALL get a grade, and clean flips in a row SHALL raise a rally multiplier that has no top.

#### Scenario: Pulse is a correction
- **WHEN** the player presses Pulse
- **THEN** the ball keeps its incoming momentum plus a bounded correction
- **AND** the return clock does not reset

#### Scenario: A graded flip
- **WHEN** a powered flip meets the ball
- **THEN** the flip is Perfect, Good or Late, from where the ball meets the blade and how fast the blade moves, and a press after the ball lands is Late
- **AND** a Perfect shot leaves at full speed and can bend up to 14° toward a dark beacon or the open gate, a Good shot can bend up to 6°, and a Late shot is weak

#### Scenario: The rally row
- **WHEN** the player makes Good or Perfect flips in a row
- **THEN** every two of them add one to the multiplier, with no top
- **AND** a Late flip ends the row and keeps the multiplier, and a lost heart sets the multiplier back to 1

#### Scenario: Lifecycle and controls
- **WHEN** the player pauses, opens the map, aims a field, changes sectors, loses a ball or restarts
- **THEN** timers freeze or reset consistently and no stale hazard collision or powered reward carries into a new ball
- **AND** Z/X and touch controls expose the same mechanics in portrait and landscape

### Requirement: Readable celestial action
The HUD and playfield SHALL show the coming flip, powered shots, return approaches and asteroid reentry in sight and in sound, without covering essential controls.

#### Scenario: The approach cue
- **WHEN** the ball comes toward a flipper
- **THEN** up to 0.9 s before the ideal press, a ring shows where the ball will meet the blade and shrinks to the ideal press, and a rising tone, panned to that side, ends at the same moment
- **AND** the pad says INCOMING, then FLIP NOW, and the ring turns gold for the last 0.2 s

#### Scenario: A Perfect flip
- **WHEN** a flip is Perfect
- **THEN** the action stops for 50 ms and a higher strike plays, and the camera kicks unless reduced motion is on

#### Scenario: The return and reentry make a sound
- **WHEN** the return starts, or an asteroid is about to come back
- **THEN** a sound plays

#### Scenario: Reduced motion
- **WHEN** reduced motion is enabled
- **THEN** collision geometry and gameplay remain the same while decorative particles and motion trails are suppressed
