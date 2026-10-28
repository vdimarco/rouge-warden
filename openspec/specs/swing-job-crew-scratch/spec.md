## Requirements
### Requirement: Reusable mission crew lists
combat.group SHALL support optional output storage while default calls return fresh arrays of the same on/group members in order.
#### Scenario: Crew changes
- **WHEN** members become inactive, change group or new members spawn
- **THEN** the reused list matches default membership without stale entries and preserves goon references
#### Scenario: Active mission frames
- **WHEN** job updates query crew repeatedly
- **THEN** one private array is reused without changing counts, goals or completion rules
