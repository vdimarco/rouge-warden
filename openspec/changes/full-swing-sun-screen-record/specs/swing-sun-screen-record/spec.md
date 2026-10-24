## ADDED Requirements
### Requirement: Reuse current sun screen coordinates
#### Scenario: Visible sun
- WHEN the camera moves or rotates with sun shafts eligible
- THEN bloom receives the same current screen coordinates using one private result record.
#### Scenario: Behind-camera transition
- WHEN the sun moves behind the camera and back
- THEN null rejection and resumed current coordinates match previous behavior.
