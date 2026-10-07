## MODIFIED Requirements

### Requirement: Each building varies its window details
Each building SHALL vary, by its seed: the window width and height in the bay, the number of panes, the frame colour
(ink, white, cream, green, oxblood, bronze, teal or navy), the dark glass in close tones of one muted blue-grey, and
the pattern of lit rooms (scattered, whole floors, vertical stacks or blocks of rooms). Homes SHALL sometimes show
arched heads, stone sills and lintels, and shutters beside the windows.

#### Scenario: Frames and glass at mid distance
- **WHEN** the player swings past a row of buildings 30 to 80 m away
- **THEN** frames of different colours are visible on different buildings, and the dark glass reads as one muted tone

#### Scenario: Lights at dusk
- **WHEN** the player looks at several towers
- **THEN** some show lit rooms scattered, others whole lit and dark floors or lit columns

### Requirement: Rooms have contents and light
Each room SHALL show, from its hash: a picture, a bookshelf or a door on the back wall; a sofa, a table or a cabinet
against it; sometimes a pot plant; and curtains or a valance on about half of them. No room SHALL show a person who
stands still. A lit room SHALL take a warm lamp light (warm, a warmer orange or a soft white), with a brighter pool
under the lamp; no lit room SHALL be blue, pink or flicker. A dark room SHALL mostly show the glass and the sky in it.

#### Scenario: Lit and dark rooms
- **WHEN** the player looks at a building with some rooms lit
- **THEN** lit rooms glow warm with furniture and curtains visible, and dark rooms read as dark glass

### Requirement: Windows show painted rooms
When the painted room atlas has loaded, each window of the procedural families SHALL show one of the painted room
interiors with nobody in them, in the key art's comic style, picked by the window's hash and sometimes mirrored. The
painting SHALL sit behind the glass and shift against the frame as the view moves. Frames, bars, curtains, shades, the
glass and sky reflections SHALL draw over it. A dark room SHALL show its painting dimmed under the glass.

#### Scenario: A row of windows up close
- **WHEN** the player swings past a building 10 to 30 m away
- **THEN** neighbouring windows show different painted rooms, such as a kitchen, a bar or a study, inside their frames

#### Scenario: The view moves
- **WHEN** the player moves sideways in front of a window
- **THEN** the painted room shifts a little against the window frame

## ADDED Requirements

### Requirement: People in the windows move
About one lit room in eight SHALL have someone walking across it: a backlit silhouette that walks from one side to the
other, stands a moment, walks back and stands again, on a loop of 9 to 16 s of its own, with swinging legs and arms.

#### Scenario: Watching a lit window
- **WHEN** the player watches a building with lit rooms for a few seconds
- **THEN** in some rooms a figure walks across and back, and no figure stands frozen in a window
