## ADDED Requirements

### Requirement: A neon alley whose storefronts are portals
Riftwalk SHALL open in a neon alley at night, at a crossroads, as a Gaussian splat world seen at eye height. Each collection of the homepage (Cottage, Action, ASCII Scenes, Strategy, GTA, Lab) SHALL be a zone with one storefront of the alley. A door-sized portal SHALL stand on the front of each storefront, on the ground, with the zone's name over it and a view into the zone's world. The portal SHALL be an upright oval with a soft edge: its picture SHALL fade into the street through a ragged mist in the zone's colour, with no hard line, and the edge SHALL ripple like water. When the mouse pointer touches the edge of a door, the opening SHALL reach out round the pointer and show more of the world's picture, and SHALL close again when the pointer leaves the edge. On a touch screen the door in the middle of the view SHALL open this way by itself, at a place that goes slowly round its edge. The zone's name SHALL show on a shop sign over the door: a dark board with a neon border and the name in lit capital letters. With reduced motion the edge SHALL hold still. All six doors SHALL be lit at once. The alley SHALL have no arcade machines. The picture under the mouse pointer SHALL flow, and SHALL be still again when the pointer leaves it. Riftwalk SHALL NOT show a portal to itself.

#### Scenario: Enter the alley
- **WHEN** the visitor enters the alley
- **THEN** six doors show on the shop fronts, each with a picture of its world, and the button of the nearest storefront is on

#### Scenario: Touch the edge of a rift
- **WHEN** the mouse pointer rests on the edge of the Cottage door
- **THEN** the door opens wider round the pointer and shows more of the meadow, and no other door moves

#### Scenario: Hover
- **WHEN** the mouse pointer rests on a door or a frame
- **THEN** that picture flows, and no other picture flows

### Requirement: Move between storefronts
A button for each zone, the up and down arrow keys and the keys 1 to 6 SHALL glide the visitor along the streets to the place in front of that zone's storefront and turn them to its door. The zone the visitor is in SHALL be the zone whose station is nearest, and its name SHALL show large for a moment when the visitor enters it.

#### Scenario: Use a key
- **WHEN** the visitor presses 6
- **THEN** the visitor glides to the Lab storefront and its door is in the middle of the view

### Requirement: A world behind each door, with the games in floating frames
A tap or a click on a door, Enter with the door in the middle of the view, the Enter button of the zone and the R key SHALL take the visitor into that zone's world. The world SHALL show its games as upright portal frames that float at eye height in an arc in front of the visitor. Each frame SHALL show one game's key art inside the live edge, with the game's name over it, and SHALL move slowly up and down. The games SHALL be in the homepage's order: the first game straight ahead and the next games to the right. A world SHALL show at most 8 frames on one page, and a More control SHALL show the others. A tap or a click on a frame, or Enter or the Play button with the frame in the middle of the view, SHALL load that game's route. The world SHALL show a small world file first and then its full-resolution file on a desktop, or a 500,000-splat file on a touch device. A round portal behind the arriving visitor SHALL lead back to the alley, and the Alley button, Esc and Backspace SHALL do the same. Inside a world, the top-left link SHALL read ◀ Alley and SHALL lead back to the alley; in the alley it SHALL read ◀ Lab and lead to the Lab page. The visitor SHALL come back in front of that zone's storefront. A zone button in a world SHALL go to that zone's world.

#### Scenario: Go into a world
- **WHEN** the visitor stands at the Action storefront and clicks its door
- **THEN** the view fills with light, and the visitor stands in the temple with Olympus in a frame straight ahead and Crimson Rogue in the next frame to the right

#### Scenario: See the rest of a large zone
- **WHEN** the visitor is in the Lab world and presses More
- **THEN** the frames show the next eight Lab games, and the button reads "More 2/3"

#### Scenario: A small zone
- **WHEN** the visitor goes into the GTA world
- **THEN** the visitor stands in the diner, one frame straight ahead shows GTA Montréal, and no More control shows

#### Scenario: Launch a game
- **WHEN** the visitor taps or clicks a lit frame
- **THEN** the view moves to the frame, fills with its light, and the game's page loads

#### Scenario: Come back
- **WHEN** the visitor in a world presses Esc, or clicks the portal behind them
- **THEN** the visitor stands in the alley in front of that zone's storefront

#### Scenario: The top-left link inside a world
- **WHEN** the visitor is in the Cottage world and presses the top-left link
- **THEN** the link reads ◀ Alley, the visitor comes back to the alley in front of the Cottage storefront, and the link reads ◀ Lab again

### Requirement: Controls for mouse, keys and touch
The visitor SHALL look by dragging the view, and a drag SHALL NOT open a door or launch a game. The lit door or frame in the middle of the view SHALL be named in a card, and Enter, Space and the Go or Play button SHALL use it. The left and right arrow keys and the ◀ and ▶ buttons SHALL turn the view to the next door in the alley, or to the next frame or the way back in a world. A door that the visitor sees from behind SHALL NOT be a stop and SHALL NOT be named. A tap or a click on the ground SHALL walk the visitor to that spot, with a ring of light on the spot, and SHALL NOT open a door. W A S D SHALL walk the visitor along the two streets of the alley and SHALL NOT take them through a building. Every on-screen button SHALL be at least 44 px on its shorter side.

#### Scenario: Use the buttons alone on a phone
- **WHEN** a visitor on a 390 by 844 touch screen taps Lab, then the door, then a frame
- **THEN** the visitor glides to the Lab storefront, goes into the space station, and the game in that frame launches, with no drag

#### Scenario: Phone layout
- **WHEN** the alley shows at 390 by 844
- **THEN** the zone buttons are at the top, the name card is over the buttons at the bottom, and all of them fit the width

### Requirement: Resolution
On a desktop the view SHALL draw at two device pixels for each CSS pixel. On a touch device it SHALL draw at the display's pixel ratio, at most 2. When frames stay slower than 34 ms, the view SHALL lower its pixel ratio in steps, to no less than the display's own pixels, and SHALL keep every control in place. A door SHALL show a picture of its world as the page draws that world from its largest file, 1280 by 1664 px. A touch device SHALL load a copy of the alley with half the splats.

#### Scenario: A slow graphics card
- **WHEN** most frames take more than 34 ms for a second and a half in the alley
- **THEN** the view draws at a lower pixel ratio, and the doors, the name card and the buttons stay where they were

### Requirement: Loading
The page SHALL show a loading screen that covers the view, with the title, a progress bar and the percent, while the alley's first, small file loads. The top bar SHALL stay usable over the loading screen. When the alley is drawn the loading screen SHALL fade and the start control SHALL show. The whole alley SHALL then load behind the visitor and take the small one's place, with a line that shows its progress.

#### Scenario: Load
- **WHEN** the page opens
- **THEN** the loading screen shows the bar and the percent, and then the start control reads "Enter the alley" over the alley

#### Scenario: The alley sharpens
- **WHEN** the visitor has entered and the whole alley has loaded
- **THEN** the alley shows all 2,000,000 splats on a desktop, and the visitor's place and view do not change

### Requirement: Walk through a portal
A visitor who walks at a door in the alley, inside its width, SHALL go into that door's world. A visitor in a world who walks to the edge of the floor toward the portal behind them SHALL come back to the alley at that storefront. A walk along a wall past a door SHALL NOT open the door.

#### Scenario: Walk in and out
- **WHEN** the visitor at the Cottage storefront holds W, and then in the meadow holds S
- **THEN** the visitor goes into the meadow, and then comes back to the Cottage storefront

### Requirement: Sound
The page SHALL make sound after the visitor presses the start control: quiet lofi music that loops with no gap, a hum in the alley, a tone from the door in view, a sound of its own in each world, and a whoosh on the way through a portal. A Sound button SHALL turn the sound off and on, and the choice SHALL be kept. The page SHALL be silent while it is hidden.

#### Scenario: Sound off
- **WHEN** the visitor presses Sound
- **THEN** the page is silent, the button shows as off, and the page is silent on the next visit

### Requirement: Live windows and game previews
On a desktop, the door in the middle of the view, from 7 m or nearer, SHALL show its world in three dimensions, and the view through it SHALL shift when the visitor moves. On a touch device, and when frames are slow, the door SHALL show its still picture. In a world, the frame in the middle of the view SHALL play its game's short clip when the game has one, and SHALL show the picture again when the view moves on. With reduced motion a frame SHALL keep its picture.

#### Scenario: A clip in a frame
- **WHEN** the visitor in the Cottage world looks at the Get Plunger'd frame
- **THEN** the frame plays the game's clip, and shows the picture again when the visitor turns to the next frame

### Requirement: Magic in the air
Each zone SHALL show small motes of light in its colour near its station, and sparks at its door. The light on the way through a door or into a game SHALL bloom from the middle of the view. With reduced motion, the motes and sparks SHALL NOT show.

#### Scenario: Motes in the alley
- **WHEN** the visitor stands in the alley
- **THEN** motes drift in front of the storefronts

### Requirement: Fallback and motion states
Every game SHALL also be a plain link on the page, grouped by collection, for assistive technology. When WebGL2 is missing or the world does not load, that list SHALL show to everyone with a line that says why. With reduced motion, the visitor SHALL move to a storefront at once, a frame SHALL hold still, and a launch SHALL have no glide. The page SHALL hold while the arcade's Games menu is open or the tab is hidden.

#### Scenario: Reduced motion
- **WHEN** a visitor who asks for reduced motion presses a zone button and then goes in and presses Play
- **THEN** the visitor is at that storefront at once, and the game's page loads with no glide

### Requirement: Arcade cabinet
Riftwalk SHALL keep its cabinet at the end of the Lab row on the homepage, its entry in the game switcher, its piece in the Corridor after the last Lab cabinet, and its card on the Lab page. Its id SHALL be `riftwalk`, its title "Riftwalk" and its route `/lab/riftwalk/`.

#### Scenario: Open from the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Riftwalk cabinet
- **THEN** the marquee shows the whole title, and the alley's page loads
