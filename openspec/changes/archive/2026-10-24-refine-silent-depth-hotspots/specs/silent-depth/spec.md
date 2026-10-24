## MODIFIED Requirements

### Requirement: Commander control room and separate stations
Patrols SHALL begin in a central control-room hub with accessible navigation to the chart table, periscope, torpedo-control, hydrophone and helm. Station changes SHALL preserve the boat's movement and orders. The player SHALL be able to raise/lower the scope and select an individual ready bow tube.

#### Scenario: Give orders from the control room
- **WHEN** the commander orders a course, speed or depth, visits the chart and returns to the control room
- **THEN** the boat continues obeying those orders and all instruments report its current state

#### Scenario: Choose equipment in the room
- **WHEN** the commander views the room on desktop or a phone
- **THEN** subtle equipment-shaped highlights identify all five usable stations; labels appear on hover or keyboard focus, and each native control works by pointer, keyboard and touch without covering the room with persistent cards

#### Scenario: Lower the periscope
- **WHEN** the scope is lowered or the boat is deep
- **THEN** the periscope cannot observe contacts or build a visual firing solution; raising it at scope depth restores observation

#### Scenario: Manage a torpedo tube
- **WHEN** the commander selects a ready tube and fires from Torpedo Control
- **THEN** that tube launches, ammunition decreases once, its reload timer begins, and another ready tube can be selected
