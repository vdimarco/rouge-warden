## ADDED Requirements

### Requirement: A release boost
With a mouse or a pad, a real let-go of a rope while that rope's GO cue shows (in the air, 25 to 60 degrees past the bottom of the
arc, rising) SHALL add 4 m/s along the flight and 3.5 m/s up, widen the view by 7 degrees and flip the hero once over 0.55 s. It
SHALL not boost while the other rope still holds, on the ground, on a wall, or within 0.6 s of the last boost. A let-go outside
the cue SHALL not boost. Phone play keeps its own fling, and a headset has no boost.

#### Scenario: Let go on GO
- **WHEN** the player swings from a tower and lets go of the mouse button while the cue shows
- **THEN** the speed along the ground rises by at least 3 m/s, the speed up rises by at least 3 m/s, and the pose is "flip"

#### Scenario: Let go early
- **WHEN** the player lets go 0.15 s after the rope catches, before the cue
- **THEN** there is no boost
