## ADDED Requirements

### Requirement: A fast let-go carries the swing
In flat play with a mouse or a pad, letting go of a building rope while the hero is in the air and moving at least 8 m/s across the ground SHALL add speed along that flight and a little upward speed, including when the GO cue is not showing. That let-go SHALL NOT flip the hero and SHALL NOT cancel a fall. A let-go while the GO cue shows SHALL keep the larger boost and the flip. A let-go under 8 m/s SHALL NOT add that carry. A phone's own let-go is unchanged.

#### Scenario: Early, and already fast
- **WHEN** the player lets go of a rope while falling and moving faster than 8 m/s across the ground, outside the GO cue
- **THEN** the flight speeds up, the fall continues, and the hero does not flip

#### Scenario: A slow drop
- **WHEN** the player lets go of a rope while nearly still
- **THEN** no carry is added
