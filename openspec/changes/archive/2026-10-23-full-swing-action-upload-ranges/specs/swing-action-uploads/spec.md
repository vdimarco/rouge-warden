## ADDED Requirements

### Requirement: Populated action instance transfers
Car and marker matrix/color updates SHALL transfer only populated entries after initial allocation while preserving instance counts, bounds and appearance.

#### Scenario: Instance count changes
- **WHEN** populated counts shrink, become empty and grow
- **THEN** update ranges match current populated component counts and empty batches request no upload

#### Scenario: Appearance
- **WHEN** cars and mission markers are displayed
- **THEN** their transforms, colors and visible result remain unchanged
