## ADDED Requirements
### Requirement: Stable registered goon rope records
Main SHALL reuse each registered goon's complete rope target record while updating its chest position each frame.
#### Scenario: Moving guard
- **WHEN** a registered guard moves repeatedly
- **THEN** the record and position identities stay stable, with x/z following the guard and y at guard height plus1.1
#### Scenario: Guard leaves and returns
- **WHEN** a guard loses eligibility or action is disabled and later returns
- **THEN** its target is removed, cached record released and a fresh record registered on return
