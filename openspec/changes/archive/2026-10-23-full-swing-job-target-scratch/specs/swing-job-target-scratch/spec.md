## ADDED Requirements
### Requirement: Reusable job rope target lists
jobs.ropeTargets SHALL accept optional output array storage without changing default fresh membership/records or live position references.
#### Scenario: Job target eligibility changes
- **WHEN** a person is caught, balloon held, getaway stopped, tanker sealed or job ends
- **THEN** the reused array drops stale targets and subsequent eligible jobs preserve IDs, tags and radii
#### Scenario: Real action frames
- **WHEN** main reconciles job targets repeatedly
- **THEN** one private output array is reused and rope target lifecycle remains unchanged
