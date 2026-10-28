## ADDED Requirements

### Requirement: Locking the wheels plays a chirp
When the handbrake engages above 300 cm/s, the player SHALL hear a short chirp. A lock at 300 cm/s or slower SHALL stay quiet. A lock that is already held SHALL NOT chirp again. Releasing the lock SHALL stay quiet. The chirp SHALL differ from each rank pitch and from the pond tick, the court whistle, the court rasp, and the theatre page.

#### Scenario: Catch
- **WHEN** the lock engages above 300 cm/s
- **THEN** the chirp plays

#### Scenario: Walk
- **WHEN** the lock engages at 300 cm/s or slower
- **THEN** the chirp stays quiet

#### Scenario: Hold
- **WHEN** the lock is already held
- **THEN** the chirp does not play again

#### Scenario: Release
- **WHEN** the lock is released
- **THEN** the chirp stays quiet

#### Scenario: Other tones
- **WHEN** the chirp is compared with a rank pitch or a tone the city already plays
- **THEN** the waves differ
