# Reusable street hazard samples

## Purpose
Reuse recurring hazard storage without changing fresh results or pedestrian avoidance.

## Requirements

### Requirement: Caller-owned car hazard samples
The recurring street frame SHALL reuse hazard storage while preserving current hazard geometry and pedestrian avoidance. Calls without output storage SHALL retain fresh independent results.

#### Scenario: Stable and changing counts
- **WHEN** moving car counts remain stable, shrink, become empty or grow
- **THEN** existing populated records are reused and stale hazards are removed

#### Scenario: Fresh results and avoidance
- **WHEN** default callers request hazards or cars reverse direction
- **THEN** fresh results stay independent and hazard positions/radii/velocities match prior behavior
