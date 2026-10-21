# swing-map Specification

## Purpose
In Full Swing flat play, the city map: what it shows, how it reads, and travel from it.

## Requirements

### Requirement: A readable map in flat play
In flat play (mouse or phone), the map SHALL be a plan of the city that fills the screen. It SHALL show the buildings shaded by height, the lake, the Needle, the Dome, a pin for every clog (green drop, or blue tick once clean), the King, each trial (with a green ring), the start roof, and the player as an arrow pointing the way the player looks. A list of places and a key SHALL sit beside the plan (under it in portrait). The headset SHALL keep the table model.

#### Scenario: Open the map on a desktop
- **WHEN** the player presses Tab in flat play
- **THEN** the plan fills most of the screen, the table model is hidden, and the list shows at least the start roof and the three trials

#### Scenario: Open the map on a phone in portrait
- **WHEN** a phone player opens the map
- **THEN** the plan sits on top, the key and the list sit under it, and nothing scrolls sideways

#### Scenario: Travel from the plan
- **WHEN** the player clicks or taps a pin that has a place to travel to
- **THEN** the map closes and the player is moved to that place

#### Scenario: Hover a pin
- **WHEN** the pointer rests on a pin
- **THEN** the pin grows and its name shows beside it


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
