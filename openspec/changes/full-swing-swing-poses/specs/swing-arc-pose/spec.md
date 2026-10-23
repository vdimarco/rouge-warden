## ADDED Requirements

### Requirement: A swing is a trail or a tuck
With one rope attached and the hero off the ground, the chase pose SHALL be a swing. At the bottom of the arc the feet SHALL sit behind the facing. On the way up the knees SHALL come forward of that trail. The rope hand SHALL stay on the line to the anchor. Stopping on the ground SHALL return the idle, and a run SHALL keep the captured run loop.

#### Scenario: The bottom of a swing
- **WHEN** the hero hangs near under an anchor, moving fast across the rope, and the chase view has settled
- **THEN** the pose is swing, the swing weight is above 0.6, and both feet are behind the facing

#### Scenario: A run on the street
- **WHEN** the hero runs along the street in the chase view
- **THEN** the pose is run, the run clip weight is above 0.9, and one foot is clearly off the other

#### Scenario: A stop
- **WHEN** the hero stands on the street with no rope
- **THEN** the pose is idle and the run weight is near 0
