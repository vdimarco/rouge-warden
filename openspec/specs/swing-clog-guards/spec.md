## Requirements
### Requirement: Guard selection avoids target snapshots
Nearby unfinished clogs SHALL receive the existing two guards once per page session without constructing game.targets snapshots.
#### Scenario: Near, far and completed clogs
- **WHEN** the hero approaches within 140 horizontal metres of an unfinished clog after the sludge job
- **THEN** the same two guards spawn at the existing offsets and group, once, while completed or more distant clogs do not spawn guards
#### Scenario: Completion and reload
- **WHEN** a clog is cleared or a saved game reloads
- **THEN** completed IDs remain excluded and unfinished clogs may receive guards in the new session
