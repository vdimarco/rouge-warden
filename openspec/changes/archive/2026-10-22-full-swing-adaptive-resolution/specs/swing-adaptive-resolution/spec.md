## ADDED Requirements

### Requirement: Responsive flat rendering under sustained load
Active flat gameplay SHALL trial a smaller3D buffer after sustained mean frame intervals over25ms, retain it only with at least10% improvement, and never go below half its original linear resolution.

#### Scenario: Sustained GPU load
- **WHEN** three seconds of active gameplay average over25ms per frame with a majority of intervals over25ms
- **THEN** the drawing ratio falls15%, bounded at half its starting ratio
- **AND** camera aspect and native DOM interface remain unchanged

#### Scenario: CPU or presentation limit
- **WHEN** the next comparable window fails to improve mean frame intervals by10%
- **THEN** the prior ratio is restored and no more trials occur until resize/reload

#### Scenario: Inactive and XR gameplay
- **WHEN** gameplay is hidden, held, paused or XR-presenting
- **THEN** it cannot trigger a flat resolution change and breaks timing continuity

#### Scenario: Window resize
- **WHEN** the flat viewport changes dimensions
- **THEN** the original bounded device ratio is restored and sampling restarts

#### Scenario: Release evidence
- **WHEN** proposed for release
- **THEN** matched hardware FPS, frame-time tails, long frames and input-to-submit measurements, visual evidence and current review/checks justify release
- **AND** remaining failures and affected-browser limits remain disclosed
