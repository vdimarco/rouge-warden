# Reusable car selection records

## Purpose
Reuse visual car selection entries while preserving selection and releasing stale street candidates.

## Requirements

### Requirement: Reusable visual car selection entries
Car selection SHALL reuse candidate records after its candidate-count high-water mark without changing nearest selection, driving priority, stable ties or street promotion.

#### Scenario: Candidate updates
- **WHEN** repeated updates shrink and grow candidate lists within the warmed count
- **THEN** no new candidate records are created and selection matches the previous behavior

#### Scenario: Candidate type changes
- **WHEN** a pooled record changes between job car and street index
- **THEN** stale car/index fields do not alter selection

#### Scenario: Camera removed
- **WHEN** a camera-guided update is followed by an update without a camera
- **THEN** prior street candidates clear, promotions release and no null traffic data is accessed
