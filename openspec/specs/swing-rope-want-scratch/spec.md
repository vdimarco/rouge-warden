## Requirements
### Requirement: Reuse desired rope target storage
The action frame SHALL reuse its private reconciliation Map while preserving target behavior.
#### Scenario: Moving and disappearing targets
- **WHEN** combat or job targets move, disappear or return
- **THEN** the same target IDs, chest positions, additions and removals occur as before
#### Scenario: Disabled action state
- **WHEN** action is disabled, play is paused or the hero drives
- **THEN** desired storage is cleared and stale targets are removed
