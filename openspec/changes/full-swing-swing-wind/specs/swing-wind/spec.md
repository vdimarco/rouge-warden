## ADDED Requirements

### Requirement: A fast swing leaves a trail
With a rope attached, the hero off the ground, and speed above 10 m/s, cream puffs SHALL appear behind the body in the chase view. They SHALL use the existing particle puff. Stopping on the ground with no rope SHALL leave no new trail.

#### Scenario: The bottom of a fast swing
- **WHEN** the hero hangs near under an anchor, moving faster than 10 m/s across the rope, and the chase view has settled
- **THEN** the pose is still swing, and at least three live puffs sit near the body

#### Scenario: A stop on the street
- **WHEN** the hero stands on the street with no rope
- **THEN** the trail spawns nothing further
