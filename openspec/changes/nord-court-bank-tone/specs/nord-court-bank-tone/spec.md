## ADDED Requirements

### Requirement: A clear bank whistles
When the bank shot moves the court from the return gate to the clamp, the local player SHALL hear the bank whistle. That whistle SHALL NOT be the pond tick or the theatre page. The step change SHALL NOT write the save.

#### Scenario: Clear bank
- **WHEN** the ball is on the middle panel, the ink is clear, and the player banks into the return gate
- **THEN** the step becomes the clamp pull
- **AND** the bank whistle is the cue for that change
- **AND** CompletedMissions is unchanged

### Requirement: Ink on the line rasps
When the player banks during the ink, or while the ball is not on the middle panel, the step SHALL stay on the return gate and the session miss count SHALL rise. The local player SHALL hear the rasp for that rise. The miss count SHALL NOT be written to the v1 save.

#### Scenario: Spoiled bank
- **WHEN** the player banks while the sweep is dangerous
- **THEN** the step stays on the redirect
- **AND** the miss count increases by one

#### Scenario: Reload
- **WHEN** a boundary-2 save is loaded
- **THEN** the miss count is 0
- **AND** CompletedMissions is still at most 2
