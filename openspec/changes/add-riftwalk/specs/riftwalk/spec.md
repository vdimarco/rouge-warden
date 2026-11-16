## ADDED Requirements

### Requirement: A hall of portals to every game
Riftwalk SHALL show a Gaussian splat arcade hall at eye height with a ring of portals around the visitor. The first ring SHALL hold one portal for each collection of the homepage (Cottage, Action, ASCII Scenes, Strategy, GTA, Lab), with the collection's name, its count of games and a picture. Opening a collection SHALL replace the ring with one portal for each game of that collection, in the homepage's order, each with the game's name and key art, and one portal that leads back. Opening a game's portal SHALL load that game's route. Riftwalk SHALL NOT show a portal to itself.

#### Scenario: Open a collection
- **WHEN** the visitor enters the hall and opens the Action portal
- **THEN** the ring shows the Action games with the first game in front, the place label reads "Neon hall · Action", and a Back control shows

#### Scenario: Launch a game
- **WHEN** the visitor opens a game's portal
- **THEN** the view moves to the portal, fills with its light, and the game's page loads

#### Scenario: Go back
- **WHEN** the visitor uses the back portal, the Back button, or Esc inside a collection
- **THEN** the six collection portals return

### Requirement: Controls for mouse, keys and touch
The visitor SHALL look by dragging the view, and a drag SHALL NOT open a portal. A tap or a click on a portal SHALL open it. The portal in the middle of the view SHALL be named in a card, and Enter, Space and the Open or Play button SHALL open that portal. The left and right arrow keys and the ◀ and ▶ buttons SHALL turn the view to the next portal and SHALL wrap around the ring. W A S D SHALL walk the visitor inside a circle of 1.2 m. Every on-screen button SHALL be at least 44 px on its shorter side.

#### Scenario: Use the buttons alone on a phone
- **WHEN** a visitor on a 390 by 844 touch screen presses ▶ and then Open, and then Play
- **THEN** a collection opens and its first game launches, with no drag

#### Scenario: Use the keyboard alone
- **WHEN** a visitor presses the right arrow, Enter, and Enter again
- **THEN** the view turns to the next collection, the collection opens, and its first game launches

#### Scenario: Phone layout
- **WHEN** the hall shows at 390 by 844
- **THEN** the portal in front is over the name card, the name card is over the buttons, and all of them fit the width

### Requirement: Fidelity and loading
The hall SHALL load a small world file first and enable the start control when it is ready, with a line that shows the progress. It SHALL then replace the world with a 500,000-splat file on touch devices and the full-resolution file on others. It SHALL NOT thin or widen the splats of the world.

#### Scenario: Sharpen after start
- **WHEN** the small file has loaded on a desktop
- **THEN** the visitor can enter the hall at once, and the full file replaces the small one when it has loaded

### Requirement: Fallback and motion states
Every game SHALL also be a plain link on the page, grouped by collection, for assistive technology. When WebGL2 is missing or the hall does not load, that list SHALL show to everyone with a line that says why. With reduced motion, rings SHALL change at once and a launch SHALL have no glide. The hall SHALL hold while the arcade's Games menu is open or the tab is hidden.

#### Scenario: Reduced motion
- **WHEN** a visitor who asks for reduced motion opens a collection and then a game
- **THEN** the ring changes at once and the game's page loads with no glide

### Requirement: Arcade cabinet
Riftwalk SHALL keep its cabinet at the end of the Lab row on the homepage, its entry in the game switcher, its piece in the Corridor after the last Lab cabinet, and its card on the Lab page. Its id SHALL be `riftwalk`, its title "Riftwalk" and its route `/lab/riftwalk/`.

#### Scenario: Open from the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Riftwalk cabinet
- **THEN** the marquee shows the whole title, and the hall's page loads
