## ADDED Requirements

### Requirement: A machine for every game
The Cottage Arcade homepage SHALL have a machine for every playable game page under `public/`. A page that has no machine SHALL be named in the list of exceptions in `qa/arcade/machines.mjs`, with a reason.

#### Scenario: A new game page is added
- **WHEN** a folder with an `index.html` is added under `public/` and has no machine
- **THEN** `qa/arcade/machines.mjs` fails and names the folder

#### Scenario: Start any machine
- **WHEN** the player drops a token and presses START on any machine, on a phone or on a computer
- **THEN** the browser goes to the address in that machine's `data-url`, and that address is the game the marquee names

#### Scenario: The Lab and its games
- **WHEN** the player looks through the machines
- **THEN** the player finds The Lab, Small Worlds, Take the Plunge, Up the Creek, Full Tilt, House Rules, Neon Ronin, Loon Echo and Tell Me

### Requirement: Every machine can be reached
Every machine SHALL be reachable with the arrows, a swipe, the keyboard and the machine list, and SHALL show whole (not clipped, not under the sign or the tray, no page scroll) at the sizes 360x740, 375x667, 390x844, 430x932, 768x1024, 1280x720 and 1920x1080.

#### Scenario: Last machine on a phone
- **WHEN** the player goes to the last machine on a 360 by 740 screen
- **THEN** the machine is inside the window and nothing overlaps it

### Requirement: High-score lines never fail
Each machine SHALL show a line from its game's own save, or a plain line when the game has none. A saved value that is junk SHALL leave the plain line and SHALL NOT raise an error, for the older machines as well as the new ones. A game's save SHALL change only that game's line.

#### Scenario: Junk save
- **WHEN** a game's save holds text that is not a score
- **THEN** the machine shows its plain line and the page has no error

### Requirement: The switcher lists every game
The game switcher SHALL list every game that has a machine, with the same id and the same name as the machine. It SHALL mark the current game by the longest matching address. Its exit buttons SHALL stay in the window however many games it lists.

#### Scenario: Inside the Lab
- **WHEN** the player opens the switcher on `/lab/worlds/`
- **THEN** the tile for Small Worlds is marked as the game being played, and the tile for The Lab is not

### Requirement: Crimson Rogue's end card fits the window
The end card of Crimson Rogue SHALL show its heading, its play-again button and its arcade link inside the window at the end of the credits, at any window size. The list of games SHALL scroll inside the card when it is too long for the window.

#### Scenario: Phone, end of credits
- **WHEN** the credits reach their end on a 360 by 740 screen
- **THEN** both buttons are inside the window, and the list of games can be scrolled by touch

### Requirement: A way back to the arcade
Tell Me and BREAKTHROUGH SHALL show a link to the arcade, and a finger SHALL be able to hit it while the start card or the end card is on the screen.

#### Scenario: Home-screen app
- **WHEN** the player opens Tell Me from the home screen of a phone, with no browser back button, and the start card is on the screen
- **THEN** a link to the arcade is on the screen, and a tap on it opens the arcade

#### Scenario: Ending card
- **WHEN** the ending card of BREAKTHROUGH is on the screen
- **THEN** the link to the arcade is on the card and a tap on it opens the arcade

### Requirement: Keyboard focus follows the chosen machine
When the player tabs to a control on a machine, that machine SHALL become the chosen one, and the control SHALL be inside the window.

#### Scenario: Tab through the machines
- **WHEN** the player presses Tab 70 times on a 390 by 844 screen
- **THEN** after each press the focused control is inside the window and belongs to the chosen machine

### Requirement: Lab pages stay out of search
Every page under `public/lab/` SHALL carry `<meta name="robots" content="noindex">`.

#### Scenario: Small Worlds
- **WHEN** a search engine reads `/lab/worlds/`
- **THEN** it finds the noindex tag
