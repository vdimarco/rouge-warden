## ADDED Requirements

### Requirement: Quiet local instrumental music
Each local player SHALL hear a quiet neighborhood loop during ordinary play and a race loop while the shared campaign is racing, using cooked audio assets generated offline from the recorded instrumental briefs.

#### Scenario: Start and explore
- **WHEN** a local player starts or joins NORD
- **THEN** neighborhood music plays quietly without restarting on every tick
- **AND** existing ambience, one-shot feedback and desktop/touch controls remain available.

#### Scenario: Enter and leave the street race
- **WHEN** the replicated campaign enters or leaves its racing phase
- **THEN** the local track changes to the corresponding race or neighborhood loop
- **AND** a remote server-side controller does not create duplicate playback.

#### Scenario: End local play
- **WHEN** the local controller ends play or disconnects
- **THEN** its music stops and no detached loop remains.
