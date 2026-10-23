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
- **THEN** matchedFPS/tails/longframes/input-to-CPU-submit/GPU measurements disclose targets and reject repeatable regressions
