## ADDED Requirements

### Requirement: The player blends the walk into the run
A speed of 450 cm/s SHALL be the walk, and 800 cm/s SHALL be the run. Halfway, the graph SHALL blend the two clips. A body with no run clip SHALL still cut above 520 cm/s. The opening pitch of −16 and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: Half speed blends the two clips
- **WHEN** the hoodie graph is evaluated at 625 cm/s
- **THEN** the run's share is one half

#### Scenario: A body with no run clip still cuts
- **WHEN** a body has a walk and no run
- **THEN** the single-node cut above 520 cm/s remains

#### Scenario: The opening camera stays
- **WHEN** the avenue is framed
- **THEN** the look stays at pitch −16 and the socket stays at Y 70 and Z 110
