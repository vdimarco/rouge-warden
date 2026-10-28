## ADDED Requirements

### Requirement: Dark tower glass mirrors more at a glance
On a glassy tower, dark glass SHALL mix in more of this game's sky where the view skims the pane than where the pane faces the camera. A lit room SHALL stay the lamp colour. The low path SHALL leave the sky mix off.

#### Scenario: Street shot
- **WHEN** the named `street` camera draws one frame with the comic art loaded
- **THEN** a near brick, stone, concrete, or loft wall shows masonry courses, glassy towers keep a sky mix, and the frame is not a flat wash

### Requirement: Near masonry shows courses
A brick, stone, concrete, or loft wall close to the camera SHALL show darkened joints. A glass tower SHALL stay a plain wall between its windows. A course smaller than a pixel SHALL fade out.

#### Scenario: A near wall
- **WHEN** the named `street` camera frames a near non-glass wall
- **THEN** that wall has horizontal courses the same wall did not have when the joint weight is zero

### Requirement: Other cel meshes stay on the stock bands
The stock `toonify` colour SHALL stay as it was.

#### Scenario: The lit sphere is unchanged
- **WHEN** the city render check shades its lit sphere
- **THEN** that sphere still matches the stock cel colours
