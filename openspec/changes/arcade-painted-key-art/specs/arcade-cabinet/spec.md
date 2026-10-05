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
