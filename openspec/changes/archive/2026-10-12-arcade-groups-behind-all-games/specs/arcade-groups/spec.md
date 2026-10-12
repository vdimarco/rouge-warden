## MODIFIED Requirements

### Requirement: Group cabinets in the arcade hall
The arcade's machines SHALL open on one group cabinet per group instead of every game machine. Each group cabinet SHALL show the group's name, how many games it holds, the names of those games, and art from them. It SHALL take no token. A machine that no group names SHALL get a group of its own (More), so no machine is out of reach.

#### Scenario: Opening the arcade
- **WHEN** a player opens the arcade at `/` with no group in the address and selects Old arcade in All Games
- **THEN** All Games closes and the row shows exactly five group cabinets (Cottage, Action, ASCII Scenes, Strategy, Lab), the first is selected, and no game machine is visible

#### Scenario: Choosing a group cabinet
- **WHEN** the player clicks a group cabinet, presses its Start, presses 1 or Enter with it selected, or presses 5 with it selected
- **THEN** the arcade shows that group's games, the first game is selected, and the player's token count does not change

#### Scenario: Collection buttons on the sign
- **WHEN** the player presses COTTAGE, ACTION or STRATEGY under the sign
- **THEN** that group opens, and its button is lit while the group is open; LAB ↗ still opens the Lab page

#### Scenario: Browsing groups
- **WHEN** the player uses the ◀ ▶ arrows, arrow keys, swipe, mouse drag, Tab, or scroll wheel in the hall
- **THEN** the selection moves between group cabinets the same way it moves between game machines

### Requirement: Leaving a group
The player SHALL be able to return from a group to the hall, and the arcade SHALL remember which group they were in across navigation.

#### Scenario: Back control and keys
- **WHEN** the player is inside a group and presses the back control, Escape, or Backspace
- **THEN** the hall returns with that group's cabinet selected

#### Scenario: Browser back
- **WHEN** the player opened a group from the hall and then uses the browser's back button
- **THEN** the hall returns instead of leaving the arcade

#### Scenario: Returning from a game
- **WHEN** the player launches a game from a group and then comes back to the arcade with the browser's back button
- **THEN** the arcade shows that same group with the game they launched selected, and All Games does not open over it

#### Scenario: Group link
- **WHEN** the player opens `/#strategy` (or another group's id)
- **THEN** the arcade opens inside that group, and All Games does not open over it
