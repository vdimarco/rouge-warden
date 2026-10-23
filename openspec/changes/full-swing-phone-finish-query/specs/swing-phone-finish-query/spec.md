## ADDED Requirements
### Requirement: Desktop-only finish prompt avoids a phone query
#### Scenario: Phone with full focus
- WHEN phone HUD updates with full focus
- THEN it skips the desktop finish reach query while preserving existing later punch fallback and action buttons.
#### Scenario: Desktop with full focus
- WHEN desktop hero can finish a goon
- THEN FINISH retains its existing priority and reach test.
