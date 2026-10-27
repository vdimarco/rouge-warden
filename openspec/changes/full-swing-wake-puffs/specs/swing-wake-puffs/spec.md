## ADDED Requirements

### Requirement: A fast rope leaves a streak

On a rope, off the ground, and faster than 10 m/s, the air behind the body SHALL show a short streak of cream puffs, born about every 0.08 s along the wake. A stand and a quiet hang SHALL spawn none. The puffs SHALL be the ones the city already draws.

#### Scenario: Mid-swing

- **GIVEN** flat play and a rope swing faster than 10 m/s
- **WHEN** the chase view looks at the body
- **THEN** several cream puffs sit in a short line behind the body

#### Scenario: Standing still

- **GIVEN** the hero standing on the ground
- **WHEN** a moment passes
- **THEN** no wake puffs are born
