## ADDED Requirements

### Requirement: Painted art for every large switcher tile
The SWITCH GAME list SHALL show painted key art for Down the Drain, Olympus, Moonwell, Primordia, Breakthrough, Follow Suit, River Rush and The Lab. Each picture SHALL be a WebP under 100 KB in `public/arcade/key/`, listed in `higgsfield/arcade-key-art.json`.

#### Scenario: Open the switcher
- **WHEN** the player opens SWITCH GAME from any game, on a phone or on a computer
- **THEN** the tiles for those eight games show painted art with no text in the picture, and every picture loads

#### Scenario: A still machine screen
- **WHEN** the player moves to the Moonwell, Primordia, The Lab, Follow Suit or River Rush machine on the arcade page
- **THEN** the machine screen shows the same painted art as its switcher tile

#### Scenario: A live attract screen
- **WHEN** the player moves to the Down the Drain or Breakthrough machine
- **THEN** the machine still shows its live attract screen

### Requirement: The grid on the arcade page
The arcade page SHALL have an ALL GAMES button that opens the grid of every game. On the arcade page the grid SHALL NOT say that a run ends, and SHALL NOT mark a game as being played. The arcade keys SHALL NOT move the machines while the grid is open.

#### Scenario: Open ALL GAMES on a phone
- **WHEN** the player taps ALL GAMES on a 390 by 844 screen
- **THEN** the grid shows all games in one column with their pictures, and the button back to the machines stays in the window

#### Scenario: Keys while the grid is open
- **WHEN** the grid is open and the player presses an arrow key, then Escape
- **THEN** the chosen machine does not change, and Escape closes the grid

### Requirement: An arcade look for the grid
Each tile SHALL look like a lit arcade screen in the game's color, with scanlines. Hover or keyboard focus SHALL light the tile and show PRESS START. With reduced motion, the tiles SHALL NOT move or blink.

#### Scenario: Focus a tile with the keyboard
- **WHEN** the player moves focus to a tile with Tab
- **THEN** the tile glows in its game's color and shows PRESS START
