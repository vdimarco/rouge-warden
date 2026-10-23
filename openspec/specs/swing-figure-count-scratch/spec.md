## Requirements
### Requirement: Reuse private figure count storage
Figure preparation SHALL reuse private tag counts without changing public info snapshots.
#### Scenario: Repeated frames and dynamic tags
- **WHEN** frames contain different tags, culled figures or no figures
- **THEN** counts include only accepted figures in that frame, and previous info snapshots stay unchanged
