## ADDED Requirements

### Requirement: Verified desktop release quality
The existing Linux game SHALL retain a requirement-to-evidence audit covering controls, car interactions, shared missions, residents, local comic rendering, saved map assets and packaged multiplayer lifecycle.

#### Scenario: Reject invalid interactions
- **WHEN** players attempt to enter an occupied car, interact through a wall, or exit into blocked space
- **THEN** occupancy and mission progress remain valid, and a blocked exit retains the driver safely
- **AND** the blocked driver sees a private on-screen explanation that clears after successful entry or exit
- **AND** a subsequent valid interaction succeeds

#### Scenario: Follow contextual interaction hints
- **WHEN** a nearby car takes priority over an objective or resident
- **THEN** the HUD offers the car interaction and does not offer conflicting dialogue or objective completion
- **AND** moving away restores the appropriate objective or resident hint

#### Scenario: Join an ongoing session
- **WHEN** a player joins after shared progress has advanced, leaves while driving, then reconnects
- **THEN** the joining player receives the current mission and resident state
- **AND** the abandoned car remains usable and the hidden walking pawn is cleaned up

#### Scenario: Inspect the desktop release
- **WHEN** the current package is reviewed at 1280 by 720 and 1920 by 1080
- **THEN** mission text, controls, dialogue, map attribution and driving speed remain readable
- **AND** projected world-objective markers do not cover the mission caption
- **AND** recorded frame-time measurements identify the tested hardware and scene
- **AND** with no competing game or editor render process, the three warmed reference scenes at Epic quality and 100% screen percentage have a 95th-percentile frame time below 16.67 ms on the tested RTX 4090 machine at both sizes

#### Scenario: Interrupted driving input
- **WHEN** a remote driver stops sending packets while accelerating
- **THEN** the server clears stale throttle and steering after half a second without a valid drive update
- **AND** the car coasts to a stop and accepts control again when packets resume
