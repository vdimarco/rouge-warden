## ADDED Requirements

### Requirement: A fast swing leaves room ahead
With a rope attached, the hero off the ground, and speed above 14 m/s, the chase camera SHALL sit higher than the standing chase, and the reported arm pitch and distance SHALL stay the standing chase. Stopping on the ground SHALL drop that extra height.

#### Scenario: The bottom of a fast swing
- **WHEN** the hero hangs near under an anchor, moving faster than 14 m/s across the rope, and the chase view has settled
- **THEN** the reported pitch is about −0.349, the reported distance is 4.5 m, and the head sits lower on the screen than the standing chase

#### Scenario: A stop on the street
- **WHEN** the hero stands on the street with no rope
- **THEN** the extra rise is gone and the head sits at the standing chase height
