## ADDED Requirements

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
