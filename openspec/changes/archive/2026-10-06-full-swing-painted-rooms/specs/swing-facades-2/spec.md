## ADDED Requirements

### Requirement: Windows show painted rooms
When the painted room atlas has loaded, each window of the procedural families SHALL show one of 32 painted room
interiors in the key art's comic style, picked by the window's hash and sometimes mirrored. The painting SHALL sit behind
the glass and shift against the frame as the view moves. Frames, bars, curtains, shades, the glass tint and sky
reflections SHALL draw over it. A dark room SHALL show its painting dimmed under the glass.

#### Scenario: A row of windows up close
- **WHEN** the player swings past a building 10 to 30 m away
- **THEN** neighbouring windows show different painted rooms, such as a kitchen, a bar or a party, inside their frames

#### Scenario: The view moves
- **WHEN** the player moves sideways in front of a window
- **THEN** the painted room shifts a little against the window frame

### Requirement: The procedural rooms are the fallback
If the room atlas fails to load or has not arrived yet, the windows SHALL draw the procedural rooms, and nothing else in
the city SHALL change.

#### Scenario: No room art
- **WHEN** `art/rooms.webp` fails to load
- **THEN** the windows show the procedural rooms, and there are no shader errors
