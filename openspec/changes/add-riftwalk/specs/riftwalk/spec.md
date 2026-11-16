## ADDED Requirements

### Requirement: A hall of zones with machines whose screens are portals
Riftwalk SHALL show a dark neon arcade hall at eye height. The hall SHALL have one zone for each collection of the homepage, with the collection's name and in the homepage's order: Cottage, Action, ASCII Scenes, Strategy, GTA and Lab. Each zone SHALL be a Gaussian splat world with arcade machines around the visitor. The visitor SHALL start in the Action zone. Each machine's screen SHALL show a portal to one game of the zone, in the homepage's order, with the game's key art inside a moving bright edge. The name of a game SHALL show over the machine in the middle of the view only. Each zone SHALL have its own screen style and letters, and SHALL show its name large for a moment when the visitor arrives. The first game SHALL be on the machine in front. A machine with no game SHALL idle dimly in its zone's colour and SHALL NOT launch. A zone with more games than machines SHALL offer a More control that shows its other games. Opening a portal SHALL load that game's route. Riftwalk SHALL NOT show a portal to itself.

#### Scenario: Enter the hall
- **WHEN** the visitor enters the hall
- **THEN** the Action button is on, each machine shows an Action game, and the name card reads the first game, on the machine in front

#### Scenario: See the rest of a large zone
- **WHEN** the visitor is in the Lab zone and presses More
- **THEN** the machines show Lab games that were not on the first page, and the button reads "More 2/2"

#### Scenario: Launch a game
- **WHEN** the visitor taps or clicks a lit screen
- **THEN** the view moves to the screen, fills with its light, and the game's page loads

### Requirement: Move between zones
Each zone SHALL have two rift doors between its machines. A door SHALL be an arch that shows a view of the zone it leads to, inside a moving bright edge, with that zone's name over it. The left door SHALL lead to the zone before and the right door to the zone after, and the last zone SHALL lead on to the first. A tap or a click on a door, or Enter with the door in the middle of the view, SHALL take the visitor to that zone: the view moves to the door, fills with light, and clears on the new zone, with the visitor in its middle and its first game in front. A button for each zone, the up and down arrow keys and the keys 1 to 6 SHALL also change the zone. A zone's world SHALL load when the visitor first goes there.

#### Scenario: Go through a door
- **WHEN** the visitor in the Action zone turns to the right door and clicks it
- **THEN** the name card first reads "ASCII Scenes", and after the click the visitor stands in the ASCII Scenes zone, its button is on, and its first game is in front

#### Scenario: Come back
- **WHEN** the visitor in the ASCII Scenes zone turns to the left door and presses Enter
- **THEN** the visitor stands in the Action zone again

#### Scenario: Use a zone button
- **WHEN** the visitor presses the Strategy button
- **THEN** three machines show the Strategy games, the other machines idle, and no More control shows

### Requirement: Controls for mouse, keys and touch
The visitor SHALL look by dragging the view, and a drag SHALL NOT launch a game. The lit machine in the middle of the view SHALL be named in a card, and Enter, Space and the Play button SHALL launch its game. The left and right arrow keys and the ◀ and ▶ buttons SHALL turn the view to the next lit machine or door and SHALL go round the circle. W A S D SHALL walk the visitor inside a circle of 1 m. Every on-screen button SHALL be at least 44 px on its shorter side.

#### Scenario: Use the buttons alone on a phone
- **WHEN** a visitor on a 390 by 844 touch screen taps Lab, then ▶, then the screen in front
- **THEN** the Lab games show and the game on that machine launches, with no drag

#### Scenario: Use the keyboard alone
- **WHEN** a visitor presses the right arrow and then Enter
- **THEN** the view turns to the next machine and its game launches

#### Scenario: Phone layout
- **WHEN** the hall shows at 390 by 844
- **THEN** the zone buttons are over the screen in front, the screen is over the name card, the name card is over the buttons, and all of them fit the width

### Requirement: Fidelity and loading
The hall SHALL load the first zone's small world file first and enable the start control when it is ready, with a line that shows the progress. In each zone it SHALL then replace the world with a 500,000-splat file on touch devices and the full-resolution file on others. When a zone is sharp, the worlds of the two zones behind its doors SHALL load in the background at that same quality, so a way through a door arrives in a sharp zone. The page SHALL keep the worlds of the current zone and those two zones only. It SHALL NOT thin or widen the splats of the world.

#### Scenario: Arrive sharp
- **WHEN** the visitor has stood in a sharp zone until its neighbours have loaded, and then goes through a door
- **THEN** the new zone shows at its best quality at once

#### Scenario: Sharpen after start
- **WHEN** the small file has loaded on a desktop
- **THEN** the visitor can enter the hall at once, and the larger file replaces the small one when it has loaded

### Requirement: Magic in the air
Each zone SHALL show small motes of light in its colour that drift and twinkle in the room, and sparks that circle each rift door. The light on the way into a game or a zone SHALL bloom from the middle of the view and SHALL close to a point on arrival. With reduced motion, the motes and sparks SHALL NOT show.

#### Scenario: Motes in a zone
- **WHEN** the visitor stands in a zone
- **THEN** motes of the zone's colour drift in the room, and sparks of the next zones' colours circle the two doors

### Requirement: Fallback and motion states
Every game SHALL also be a plain link on the page, grouped by collection, for assistive technology. When WebGL2 is missing or the world does not load, that list SHALL show to everyone with a line that says why. With reduced motion, the zone SHALL change at once and a launch SHALL have no glide. The hall SHALL hold while the arcade's Games menu is open or the tab is hidden.

#### Scenario: Reduced motion
- **WHEN** a visitor who asks for reduced motion presses a zone button and then Play
- **THEN** the zone changes at once and the game's page loads with no glide

### Requirement: Arcade cabinet
Riftwalk SHALL keep its cabinet at the end of the Lab row on the homepage, its entry in the game switcher, its piece in the Corridor after the last Lab cabinet, and its card on the Lab page. Its id SHALL be `riftwalk`, its title "Riftwalk" and its route `/lab/riftwalk/`.

#### Scenario: Open from the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Riftwalk cabinet
- **THEN** the marquee shows the whole title, and the hall's page loads
