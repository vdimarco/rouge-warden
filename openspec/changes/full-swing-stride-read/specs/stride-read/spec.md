## ADDED Requirements

### Requirement: The chase shows a stride and a trail
A run in the chase view SHALL show one foot ahead of the facing and one foot behind it. At the bottom of a swing the pose SHALL be swing and both feet SHALL sit behind the facing, with the rope hand on the line to the anchor. A stand with no rope SHALL stay the idle. The pose rate SHALL stay on twos.

#### Scenario: A run on the street
- **WHEN** the hero runs along the street in the settled chase view
- **THEN** the pose is run, the run clip weight is above 0.9, one foot is ahead of the facing, and the other foot is behind it

#### Scenario: The bottom of a swing
- **WHEN** the hero is off the ground on one rope, moving fast across it, and the chase view has settled
- **THEN** the pose is swing, the swing weight is above 0.6, both feet are behind the facing, and the rope hand lies along the line to the anchor

#### Scenario: A stop
- **WHEN** the hero stands on the street with no rope
- **THEN** the pose is idle and the run weight is near 0
