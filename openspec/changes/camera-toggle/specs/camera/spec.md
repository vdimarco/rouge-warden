## ADDED Requirements
### Requirement: Stable camera toggle
V SHALL open the viewfinder and leave it open until a separate closing action.
#### Scenario: Hold V
- **WHEN** V is pressed and held from free roam
- **THEN** the viewfinder stays visible, including during keyboard auto-repeat
- **WHEN** V is released and pressed again
- **THEN** the viewfinder closes
#### Scenario: Photograph
- **WHEN** Space is pressed in the viewfinder
- **THEN** a photograph is added to the gallery
