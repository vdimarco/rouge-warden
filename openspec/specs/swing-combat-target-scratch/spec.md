## Requirements
### Requirement: Reusable combat target lists
combat.targets SHALL accept optional output storage while preserving default fresh array behavior and existing live goon references.
#### Scenario: Eligibility and counts change
- **WHEN** goons move across the radius, become inactive or change fighting/perch eligibility
- **THEN** output contains the same eligible goons in order, with no stale tail entries
#### Scenario: Real action frames
- **WHEN** the action frame reconciles combat targets repeatedly
- **THEN** it reuses one list, preserving rope target lifecycle and positions
