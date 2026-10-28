## ADDED Requirements

### Requirement: Preserve sun-shaft output while avoiding zero work
Flat sun-shaft rendering SHALL skip its radial gather only when the existing final contribution weight is exactly zero, preserving partially occluded edges and the image.

#### Scenario: Fully sky pixel
- **WHEN** the depth-derived sky factor is exactly1
- **THEN** the16sample gather is skipped and output matches the unguarded shader

#### Scenario: City and partial sky edge
- **WHEN** the sky factor is less than1
- **THEN** all16samples and existing weights remain unchanged

#### Scenario: Layouts and effect modes
- **WHEN** desktop/phone layouts render with comic effects enabled or disabled
- **THEN** same-frame RGBA output matches the unguarded shader in active and inactive sun views
- **AND** native UI, controls and XR bypass remain unchanged

#### Scenario: Release measurements
- **WHEN** proposed for release
- **THEN** matched hardware measurements establish GPU benefit without repeatable FPS/frame-time/input-delay regressions
- **AND** remaining targets and affected-browser limitations are disclosed
