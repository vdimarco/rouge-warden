## ADDED Requirements

### Requirement: A missing crew rig rocks the body on foot
When the player is on foot, not swimming, not knocked down, not falling, and the crew anim instance is absent, the body SHALL lean with time and planar speed. A walk SHALL lean further than an idle. The feet SHALL not take a step. The crew anim instance, a swim, a knockdown, and a fall SHALL keep the mesh. The opening pitch SHALL stay −16 and the walking socket SHALL stay at Y 70 and Z 110.

#### Scenario: A walk peak leans the body
- **WHEN** planar speed is 180 cm/s and the phase is at the side peak
- **THEN** the roll is 12° and the lateral shift is 4 cm, and the bob and the pitch are 0

#### Scenario: Starting to walk does not snap the pose
- **WHEN** the phase is held and the speed moves across 5 cm/s with no elapsed time
- **THEN** the phase stays put, and the lean just above 5 cm/s stays near the idle lean

#### Scenario: An idle peak is the smaller rock
- **WHEN** planar speed is at most 5 cm/s and the idle phase is at the side peak
- **THEN** the roll is 0.34 of the walk roll

#### Scenario: The rest pose is still
- **WHEN** the sway time is 0
- **THEN** bob, side, roll, and pitch are 0

#### Scenario: The camera stays
- **WHEN** the sway is applied
- **THEN** the walking socket and the −16 opening pitch are unchanged
