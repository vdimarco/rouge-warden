## Requirements
### Requirement: Ink rope endpoints remain current
#### Scenario: Attached building ink rope
- WHEN an attached ink rope is updated with a moving hero hand
- THEN reported hand and anchor endpoints reflect that update even though the mesh rope is suppressed.
#### Scenario: Release and inputs
- WHEN mouse or keyboard rope input releases
- THEN existing detach/alternatehand behavior remains unchanged.
