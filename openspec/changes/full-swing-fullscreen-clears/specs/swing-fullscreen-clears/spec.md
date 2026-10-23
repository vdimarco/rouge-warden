## ADDED Requirements

### Requirement: Skip redundant clears without changing output
Opaque full-screen bloom passes SHALL avoid redundant automatic clears and SHALL restore the caller autoClear state even if rendering fails. Scene clears, resolution, effects, controls and XR bypass SHALL remain unchanged.

#### Scenario: Complete overwrite
- **WHEN** supported desktop/phone layouts render active/inactive sun and comic effects
- **THEN** same-frameRGBA matches the original clear-enabled pipeline

#### Scenario: Caller state
- **WHEN** autoClear starts true or false, including an injected full-screen rendering failure
- **THEN** the original value is restored

#### Scenario: Release evidence
- **WHEN** proposed for release
- **THEN** focused correctness tests, review, CI and deployed-preview checks pass
- **AND** available measurements disclose targets and limits without requiring an FPS gain to merge incremental progress
