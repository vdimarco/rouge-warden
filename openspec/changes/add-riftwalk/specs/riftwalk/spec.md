## ADDED Requirements

### Requirement: A hall of machines whose screens are portals
Riftwalk SHALL show a dark neon Gaussian splat arcade at eye height, with arcade machines in a circle around the visitor. One collection of the homepage (Cottage, Action, ASCII Scenes, Strategy, GTA, Lab) SHALL be on at a time, and Action SHALL be on at the start. Each machine's screen SHALL show a portal to one game of that collection, in the homepage's order, with the game's key art inside a moving bright edge and the game's name over the screen. The first game SHALL be on the machine in front. A machine with no game SHALL stay dark and SHALL NOT launch. A collection with more games than machines SHALL offer a More control that shows its other games. Opening a portal SHALL load that game's route. Riftwalk SHALL NOT show a portal to itself.

#### Scenario: Enter the hall
- **WHEN** the visitor enters the hall
- **THEN** the Action button is on, each machine shows an Action game, and the name card reads the first game, on the machine in front

#### Scenario: Change the collection
- **WHEN** the visitor presses the GTA button
- **THEN** the view turns to the front machine, that machine shows GTA Montréal, and the other machines go dark

#### Scenario: See the rest of a large collection
- **WHEN** the visitor picks Lab and presses More
- **THEN** the machines show Lab games that were not on the first page, and the button reads "More 2/2"

#### Scenario: Launch a game
- **WHEN** the visitor taps or clicks a lit screen
- **THEN** the view moves to the screen, fills with its light, and the game's page loads

### Requirement: Controls for mouse, keys and touch
The visitor SHALL look by dragging the view, and a drag SHALL NOT launch a game. The lit machine in the middle of the view SHALL be named in a card, and Enter, Space and the Play button SHALL launch its game. The left and right arrow keys and the ◀ and ▶ buttons SHALL turn the view to the next lit machine and SHALL go round the circle. The up and down arrow keys and the keys 1 to 6 SHALL change the collection. W A S D SHALL walk the visitor inside a circle of 1 m. Every on-screen button SHALL be at least 44 px on its shorter side.

#### Scenario: Use the buttons alone on a phone
- **WHEN** a visitor on a 390 by 844 touch screen taps Lab, then ▶, then the screen in front
- **THEN** the Lab games show and the game on that machine launches, with no drag

#### Scenario: Use the keyboard alone
- **WHEN** a visitor presses the right arrow and then Enter
- **THEN** the view turns to the next machine and its game launches

#### Scenario: Phone layout
- **WHEN** the hall shows at 390 by 844
- **THEN** the collection buttons are over the screen in front, the screen is over the name card, the name card is over the buttons, and all of them fit the width

### Requirement: Fidelity and loading
The hall SHALL load a small world file first and enable the start control when it is ready, with a line that shows the progress. It SHALL then replace the world with a 500,000-splat file on touch devices and the full-resolution file on others. It SHALL NOT thin or widen the splats of the world.

#### Scenario: Sharpen after start
- **WHEN** the small file has loaded on a desktop
- **THEN** the visitor can enter the hall at once, and the full file replaces the small one when it has loaded

### Requirement: Fallback and motion states
Every game SHALL also be a plain link on the page, grouped by collection, for assistive technology. When WebGL2 is missing or the world does not load, that list SHALL show to everyone with a line that says why. With reduced motion, the machines SHALL change at once and a launch SHALL have no glide. The hall SHALL hold while the arcade's Games menu is open or the tab is hidden.

#### Scenario: Reduced motion
- **WHEN** a visitor who asks for reduced motion picks a collection and presses Play
- **THEN** the machines change at once and the game's page loads with no glide

### Requirement: Arcade cabinet
Riftwalk SHALL keep its cabinet at the end of the Lab row on the homepage, its entry in the game switcher, its piece in the Corridor after the last Lab cabinet, and its card on the Lab page. Its id SHALL be `riftwalk`, its title "Riftwalk" and its route `/lab/riftwalk/`.

#### Scenario: Open from the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Riftwalk cabinet
- **THEN** the marquee shows the whole title, and the hall's page loads
