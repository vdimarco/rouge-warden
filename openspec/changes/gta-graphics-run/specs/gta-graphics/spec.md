## ADDED Requirements

### Requirement: The hoodie fallback can play its own run
The hoodie fallback SHALL load `A_MenHoodie_Run` when that sequence exists, and SHALL keep the walk when it does not. The run SHALL be the CC0 clip already in the hoodie glTF, not a resample of the walk. The opening pitch of −16 and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: The run is a different cycle
- **WHEN** the hoodie run and the hoodie walk are sampled across their cycles
- **THEN** the run is shorter than one second and its lower leg turns further than the walk's

#### Scenario: A missing import still walks
- **WHEN** the run sequence is not imported
- **THEN** the fallback still has the idle and the walk, and the run reference is empty
