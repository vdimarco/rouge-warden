## ADDED Requirements

### Requirement: The Corridor is the default view
`/corridor/` SHALL serve the Corridor, a walk-through hall with one cabinet per game, and each cabinet SHALL lead to that game's route on the same site. A visitor who opens `/` with no stored choice, no hash and a browser that supports WebGL SHALL arrive at `/corridor/`, and Back SHALL NOT return to `/`. `/#<group>` SHALL keep opening the hall on that group. A browser without WebGL SHALL stay on `/`.

#### Scenario: First visit
- **WHEN** a visitor opens `/` for the first time in a browser with WebGL
- **THEN** the address becomes `/corridor/` and the Corridor is drawn

#### Scenario: Group link
- **WHEN** a visitor opens `/#strategy`
- **THEN** the hall opens on Strategy and the address does not change

#### Scenario: A cabinet opens its game here
- **WHEN** a visitor opens a cabinet in the Corridor on any deployment and chooses to play
- **THEN** the game loads from that same deployment

### Requirement: Switching views is remembered
The Corridor SHALL offer an All games control that opens `/` on All Games. That choice SHALL be stored under `arcade.view` and `/` SHALL open All Games on later visits. All Games SHALL offer a Corridor control that opens `/corridor/` and clears the stored choice. Both controls SHALL be on screen at widths 1280, 390 and 320 without sideways scroll, and the All Games bar's controls SHALL NOT cover its title.

#### Scenario: Choosing the list
- **WHEN** a visitor selects All games in the Corridor and later opens `/`
- **THEN** All Games opens both times

#### Scenario: Returning to the walk
- **WHEN** that visitor selects the Corridor control on All Games and later opens `/`
- **THEN** the Corridor opens both times

#### Scenario: Phone width
- **WHEN** the Corridor is open at 390×844 or 320×640
- **THEN** All games is the last pill of the category strip, on screen, and the page does not scroll sideways

#### Scenario: Narrow list
- **WHEN** All Games is open at 320×640
- **THEN** the Corridor control is in Menu and the bar's links do not overlap the title

### Requirement: The Corridor can be walked without a wheel
The Corridor SHALL show a step bar with Previous cabinet and Next cabinet buttons, each at least 44px, and a progress line between them. A cue SHALL read Scroll on pointer devices and Swipe up on touch devices, and SHALL fade once the visitor has moved. A click or tap on the hall that hits no cabinet SHALL walk one cabinet forward. Opening a cabinet SHALL show its key art leaving that cabinet's monitor. At 760px and narrower the Play control SHALL stay on screen while the details scroll.

#### Scenario: Stepping
- **WHEN** a visitor selects Next cabinet twice and Previous cabinet once
- **THEN** the walk rests on the second cabinet

#### Scenario: Phone
- **WHEN** a cabinet is open at 320×640
- **THEN** Insert coin · Play is on screen without scrolling
