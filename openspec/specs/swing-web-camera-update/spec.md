# Shared web camera preparation

## Requirements
### Requirement: Share web camera preparation
#### Scenario: Two ropes
- WHEN one or two flat web ropes project in the same draw
- THEN at most one explicit camera world-matrix preparation occurs and rendered geometry matches prior behavior.
#### Scenario: Transitions
- WHEN ropes fade, disappear or resume
- THEN the current camera transform is used with unchanged visibility and fade.
