## ADDED Requirements

### Requirement: Fal cinematic opening artwork
The opening screen SHALL use a Fal-generated cinematic folklore environment while preserving native controls.

#### Scenario: Use generated art
- **WHEN** approved Fal artwork is integrated
- **THEN** the moonlit hero stage remains readable with all selection and Start controls reachable at supported viewports.

#### Scenario: Load without artwork
- **WHEN** the generated background is unavailable
- **THEN** the native hero preview, roster and Start controls remain readable and usable on the dark fallback.

#### Scenario: Enter and return
- **WHEN** a player selects a hero, previews a spell, starts and returns to selection
- **THEN** the cinematic stage preserves the existing selection, learning and game controls.
