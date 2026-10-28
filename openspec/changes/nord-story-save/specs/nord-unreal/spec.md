## MODIFIED Requirements

### Requirement: Shared session lap results
Race completion SHALL show the last elapsed result and the session's best clean lap on both peers. Recovery-assisted runs SHALL be labelled and excluded from the clean best. Results SHALL survive T replay during that session. T replay SHALL NOT rewrite the campaign slot. The slot SHALL keep completed missions at 0–2. Version 1 SHALL still load as a race boundary with the later story at its start. Version 3 SHALL store that mission count plus the story steps. Version 2 SHALL stay rejected.

#### Scenario: Compare completed laps
- **WHEN** a clean lap finishes and a faster clean replay finishes
- **THEN** both peers show the new last time and improved session best
- **WHEN** a slower or recovery-assisted replay finishes
- **THEN** the session best remains intact
- **AND** no time is fabricated after a fresh join to a saved completed campaign

#### Scenario: Read supported layouts
- **WHEN** the result or a resident caption appears at 1280×720, 1920×1080 or a supported tall phone frame
- **THEN** the existing wrapping and caption layout keep objectives, radar and touch controls readable
