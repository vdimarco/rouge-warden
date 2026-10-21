## ADDED Requirements

### Requirement: Flat map travel buttons show distance
Every travel destination in the flat map SHALL show its name and whole-metre horizontal distance from the player. The map SHALL identify this as map distance. Labels SHALL refresh when the map reopens after movement. Existing destination actions, order, Tab and Escape shortcuts, and headset map SHALL remain unchanged.

#### Scenario: Open the map at the start roof
- **WHEN** the player opens the flat map at the start roof
- **THEN** the start roof reads 0 m and the other destinations show their horizontal distance

#### Scenario: Reopen elsewhere
- **WHEN** the player moves to another position and reopens the map
- **THEN** the distances reflect the new position and selecting the start roof still travels there

#### Scenario: Portrait map
- **WHEN** the map is opened at a 390-pixel portrait width
- **THEN** names and distances fit without horizontal scrolling
