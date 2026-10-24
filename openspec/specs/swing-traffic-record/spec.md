## Requirements
### Requirement: Reuse live traffic wrappers
#### Scenario: Runtime frames
- WHEN street models or car simulation query traffic
- THEN reusable wrapper fields match current traffic arrays and count.
#### Scenario: Default and unavailable data
- WHEN callers omit output or traffic is not built
- THEN default records remain fresh and unavailable traffic remains null.
