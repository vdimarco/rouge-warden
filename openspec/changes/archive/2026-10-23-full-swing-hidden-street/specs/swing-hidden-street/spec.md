## ADDED Requirements

### Requirement: Invisible street view skips visual preparation
The street view SHALL defer instance-list and time-uniform updates while invisible, without changing street simulation or visible behavior.

#### Scenario: Hide and move
- **WHEN** the street view is hidden and the camera moves across sign regions
- **THEN** no sign attributes are dirtied and no people are submitted

#### Scenario: Show again
- **WHEN** the street view is shown at the new camera position
- **THEN** current signs, time and people are prepared on its next update
