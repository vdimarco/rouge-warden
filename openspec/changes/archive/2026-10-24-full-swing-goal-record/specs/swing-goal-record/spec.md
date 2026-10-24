## ADDED Requirements
### Requirement: Reuse current goal placement records
#### Scenario: Active goal
- WHEN the goal sticker updates across desktop or phone layouts
- THEN placement, direction, distance, label and trend match previous behavior using private reusable output.
#### Scenario: Default and state transitions
- WHEN callers omit output or a goal is hidden or replaced
- THEN defaults remain fresh and the next visible goal has only current fields.
