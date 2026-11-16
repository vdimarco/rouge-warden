## ADDED Requirements

### Requirement: One hall with a cluster of machines for each collection
Riftwalk SHALL show one dark neon arcade hall at eye height, as a Gaussian splat world. Arcade machines SHALL stand in clusters against the walls. Each collection of the homepage (Cottage, Action, ASCII Scenes, Strategy, GTA, Lab) SHALL be a zone with its own cluster or clusters. Each machine's screen SHALL show a portal to one game of its zone, with the game's key art inside a moving bright edge, and every zone SHALL be lit at once. The name of a game SHALL show over the machine in the middle of the view only. The picture under the mouse pointer SHALL flow, and SHALL be still again when the pointer leaves it. A machine with no game SHALL idle dimly in its zone's colour and SHALL NOT launch. A zone with more games than machines SHALL offer a More control that shows its other games. Opening a portal SHALL load that game's route. Riftwalk SHALL NOT show a portal to itself.

#### Scenario: Enter the hall
- **WHEN** the visitor enters the hall
- **THEN** machines in all six zones show games, no game is on two machines, and the button of the zone the visitor stands in is on

#### Scenario: Hover
- **WHEN** the mouse pointer rests on a lit screen
- **THEN** that picture flows, and no other picture flows

#### Scenario: See the rest of a large zone
- **WHEN** the visitor is in the Lab zone and presses More
- **THEN** the Lab machines show Lab games that were not on the first page, and the button reads "More 2/2"

#### Scenario: Launch a game
- **WHEN** the visitor taps or clicks a lit screen
- **THEN** the view moves to the screen, fills with its light, and the game's page loads

### Requirement: Move between zones
A button for each zone, the up and down arrow keys and the keys 1 to 6 SHALL glide the visitor across the hall to that zone's station and turn them to its machines. The zone the visitor is in SHALL be the zone whose station is nearest, and its name SHALL show large for a moment when the visitor enters it.

#### Scenario: Use a key
- **WHEN** the visitor presses 6
- **THEN** the visitor glides to the Lab cluster

### Requirement: A room behind each rift ring
A rift ring SHALL hang on the wall above each zone, inside a neon ring of the hall, with the zone's name and a view into the zone's room. A tap or a click on a ring, Enter with the ring in the middle of the view, the Room button and the R key SHALL take the visitor into that zone's own room: a smaller world with machines around the visitor. The room's machines SHALL show the zone's games, with the first game in front. The room SHALL have a ring that leads back to the hall, and the Hall button, Esc and Backspace SHALL do the same. The visitor SHALL come back at the cluster of that zone. A zone button in a room SHALL go to that zone's room.

#### Scenario: Go into a room
- **WHEN** the visitor looks up at the GTA ring and clicks it
- **THEN** the name card first reads "GTA", the view fills with light, and the visitor stands in the GTA room with GTA Montréal on a machine

#### Scenario: Come back
- **WHEN** the visitor in a room presses Esc, or clicks the room's ring
- **THEN** the visitor stands in the hall at that zone's cluster

### Requirement: Controls for mouse, keys and touch
The visitor SHALL look by dragging the view, and a drag SHALL NOT launch a game. The lit machine or ring in the middle of the view SHALL be named in a card, and Enter, Space and the Play or Go button SHALL use it. The left and right arrow keys and the ◀ and ▶ buttons SHALL turn the view to the next lit machine, and in a room also to the ring back. W A S D SHALL walk the visitor on the open floor of the hall and SHALL NOT take them through a wall or a machine. Every on-screen button SHALL be at least 44 px on its shorter side.

#### Scenario: Use the buttons alone on a phone
- **WHEN** a visitor on a 390 by 844 touch screen taps Lab, then ▶, then the screen in front
- **THEN** the visitor glides to the Lab cluster and the game on that machine launches, with no drag

#### Scenario: Phone layout
- **WHEN** the hall shows at 390 by 844
- **THEN** the zone buttons are over the screen in front, the screen is over the name card, the name card is over the buttons, and all of them fit the width

### Requirement: Loading
The hall SHALL load its world file with a line that shows the progress, and SHALL enable the start control when the world is ready.

#### Scenario: Load
- **WHEN** the page opens
- **THEN** the line shows the progress in percent, and then the start control reads "Enter the hall"

### Requirement: Magic in the air
Each zone SHALL show small motes of light in its colour near its station, and sparks that circle its rift ring. The light on the way into a game SHALL bloom from the middle of the view. With reduced motion, the motes and sparks SHALL NOT show.

#### Scenario: Motes in the hall
- **WHEN** the visitor stands in the hall
- **THEN** motes drift in the zones, and sparks circle the rings

### Requirement: Fallback and motion states
Every game SHALL also be a plain link on the page, grouped by collection, for assistive technology. When WebGL2 is missing or the world does not load, that list SHALL show to everyone with a line that says why. With reduced motion, the visitor SHALL move to a zone at once and a launch SHALL have no glide. The hall SHALL hold while the arcade's Games menu is open or the tab is hidden.

#### Scenario: Reduced motion
- **WHEN** a visitor who asks for reduced motion presses a zone button and then Play
- **THEN** the visitor is at that zone at once and the game's page loads with no glide

### Requirement: Arcade cabinet
Riftwalk SHALL keep its cabinet at the end of the Lab row on the homepage, its entry in the game switcher, its piece in the Corridor after the last Lab cabinet, and its card on the Lab page. Its id SHALL be `riftwalk`, its title "Riftwalk" and its route `/lab/riftwalk/`.

#### Scenario: Open from the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Riftwalk cabinet
- **THEN** the marquee shows the whole title, and the hall's page loads
