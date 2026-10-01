## ADDED Requirements

### Requirement: Dedicated keyboard sprint
Either Shift key SHALL sprint immediately while moving on foot, subject to existing stamina and crouch rules. F and right mouse SHALL retain guard/aim. Space and existing touch/gamepad dodge-hold sprint SHALL remain available.

#### Scenario: Hold and release Shift
- **WHEN** the player holds W and either Shift key
- **THEN** movement is faster without entering guard or rolling
- **WHEN** Shift is released
- **THEN** normal movement resumes

### Requirement: Clearer daytime hills
Daytime fog SHALL preserve mid-range terrain color longer on every quality tier without extending draw distance or changing night/interior fog.

#### Scenario: Mid-range landscape
- **WHEN** a daytime hill is halfway to the quality tier's draw limit
- **THEN** it is not washed out by distance fog
- **AND** distant geometry still fades before the existing culling limit
