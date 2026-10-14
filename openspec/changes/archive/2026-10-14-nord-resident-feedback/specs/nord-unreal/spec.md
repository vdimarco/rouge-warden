## ADDED Requirements

### Requirement: Reactive neighborhood residents
Visible residents SHALL acknowledge nearby calm players and warn drivers of fast approaching occupied cars, with original Québec French captions and bounded cooldowns. Reactions SHALL pause and face the player without leaving the authored route or jumping along it on resume. Ambient captions SHALL preserve private dialogue and briefing reading time.

#### Scenario: Greet and talk
- **WHEN** a slow walking player approaches an unobstructed visible resident after the greeting cooldown
- **THEN** a brief private greeting may appear when no private caption or campaign briefing is active
- **WHEN** the player presses E to talk
- **THEN** the resident faces the player briefly and the existing private dialogue takes priority
- **AND** the route resumes continuously and the other player's caption remains unchanged

#### Scenario: Warn an approaching car
- **WHEN** an occupied fast car approaches a visible resident within the warning distance
- **THEN** the resident pauses, faces the driver and issues a cooldown-limited private warning
- **AND** parked, driverless, departing, distant and slow cars do not cause warnings
- **AND** reaction placement and animation state agree on both peers

### Requirement: Semantic activity feedback
Successful native campaign steps and ordered race checkpoints SHALL play short original progress cues on connected peers; successful finishes SHALL play a distinct completion cue. Rejected actions, retries, late joins and save reloads SHALL NOT replay historical success sounds. All essential feedback SHALL remain visible without audio.

#### Scenario: Progress and replay
- **WHEN** a valid step or ordered checkpoint advances authority state
- **THEN** connected players receive one corresponding progress/completion sound without parsing HUD text
- **AND** attempts to skip a gate do not produce a success cue
- **WHEN** T starts a replay and the race is completed again
- **THEN** completion feedback occurs again while both completed story scenes remain saved

### Requirement: Shared session lap results
Race completion SHALL show the last elapsed result and the session's best clean lap on both peers. Recovery-assisted runs SHALL be labelled and excluded from the clean best. Results SHALL survive T replay during that session without changing the version-1 mission-boundary save format.

#### Scenario: Compare completed laps
- **WHEN** a clean lap finishes and a faster clean replay finishes
- **THEN** both peers show the new last time and improved session best
- **WHEN** a slower or recovery-assisted replay finishes
- **THEN** the session best remains intact
- **AND** no time is fabricated after a fresh join to a saved completed campaign

#### Scenario: Read supported layouts
- **WHEN** the result or a resident caption appears at 1280×720, 1920×1080 or a supported tall phone frame
- **THEN** the existing wrapping and caption layout keep objectives, radar and touch controls readable
