# swing-real-anchor-restore

## Requirements
### Requirement: Player auto anchors are real buildings
#### Scenario: Empty sky
- WHEN no real building is reachable
- THEN no invisible sky attachment is created.
#### Scenario: Above rooftop
- WHEN a real building is reachable below an airborne player
- THEN it can attach using ordinary rope physics when assisted clearance is unsuitable.
