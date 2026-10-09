# Shore playtest telemetry

## Purpose
Capture anonymous gameplay transitions so playtests can identify control and match-flow problems.

## Requirements

### Requirement: Meaningful anonymous playtest events
Shore SHALL record match start/end, tutorial progress, selected-target changes, cast outcomes, Recall transitions, death, objective changes and realm changes with anonymous match context on approved production hosts. Preview and automated tests SHALL NOT send production telemetry by default. Capture failure SHALL NOT affect play.

#### Scenario: Follow a match
- **WHEN** a player starts a match and takes these actions
- **THEN** events share a match identifier, actual difficulty, selected hero and input/viewport context; held movement and idle frames do not flood events.

#### Scenario: Block analytics
- **WHEN** capture is unavailable or network requests fail
- **THEN** controls, match flow and results continue normally.
