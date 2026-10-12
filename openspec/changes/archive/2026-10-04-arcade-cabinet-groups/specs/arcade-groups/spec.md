## ADDED Requirements

### Requirement: Group cabinets in the arcade hall
The arcade SHALL open on one group cabinet per group instead of every game machine. Each group cabinet SHALL show the group's name, how many games it holds, the names of those games, and art from them. It SHALL take no token. A machine that no group names SHALL get a group of its own (More), so no machine is out of reach.

#### Scenario: Opening the arcade
- **WHEN** a player opens the arcade at `/` with no group in the address
- **THEN** the row shows exactly four group cabinets (Cottage, Action, Strategy, Lab), the first is selected, and no game machine is visible

#### Scenario: Choosing a group cabinet
- **WHEN** the player clicks a group cabinet, presses its Start, presses 1 or Enter with it selected, or presses 5 with it selected
- **THEN** the arcade shows that group's games, the first game is selected, and the player's token count does not change

#### Scenario: Collection buttons on the sign
- **WHEN** the player presses COTTAGE, ACTION or STRATEGY under the sign
- **THEN** that group opens, and its button is lit while the group is open; LAB ↗ still opens the Lab page

#### Scenario: Browsing groups
- **WHEN** the player uses the ◀ ▶ arrows, arrow keys, swipe, mouse drag, Tab, or scroll wheel in the hall
- **THEN** the selection moves between group cabinets the same way it moves between game machines

### Requirement: Inside a group
Inside a group, the row SHALL show only that group's game machines, and those machines SHALL behave as before: tokens, credits, free play, drag-to-slot, attract screens, high scores, and the power-on.

#### Scenario: Playing a game from a group
- **WHEN** the player is inside Strategy and plays Follow Suit
- **THEN** a token goes in if needed and the game powers on and loads `/follow-suit/`, exactly as from the old single row

#### Scenario: Seeing where you are
- **WHEN** the player is inside a group
- **THEN** a back control labelled for the arcade is visible in the tray beside the machine picker, the count beside the picker gives the position in the group, and wherever the sign shows its subtitle (not on short landscape screens), the subtitle names the group

#### Scenario: Supported layouts
- **WHEN** the hall or a group is open at desktop, portrait phone (390×844), or landscape phone (844×390) size
- **THEN** its cabinets either fit side by side or slide one at a time with the selected one centered, and neither the back control nor the rest of the tray covers the selected cabinet

### Requirement: Leaving a group
The player SHALL be able to return from a group to the hall, and the arcade SHALL remember which group they were in across navigation.

#### Scenario: Back control and keys
- **WHEN** the player is inside a group and presses the back control, Escape, or Backspace
- **THEN** the hall returns with that group's cabinet selected

#### Scenario: Browser back
- **WHEN** the player opened a group from the hall and then uses the browser's back button
- **THEN** the hall returns instead of leaving the arcade

#### Scenario: Returning from a game
- **WHEN** the player launches a game from a group and then comes back to the arcade
- **THEN** the arcade shows that same group with the game they launched selected

#### Scenario: Group link
- **WHEN** the player opens `/#strategy` (or another group's id)
- **THEN** the arcade opens inside that group

### Requirement: Machine picker covers every game
The machine picker SHALL list every game once, under its group, after an entry for the hall. Choosing a game SHALL open its group and select it; choosing the hall entry SHALL return to the hall.

#### Scenario: Jumping with the picker
- **WHEN** the player is in the hall and picks Moonwell from the picker
- **THEN** the Action group opens with Moonwell selected
