## MODIFIED Requirements

### Requirement: Training checklist on a first run
On a first run in flat play a training card SHALL list the moves to learn, each with the keys of the input in use: mouse and keys, a game pad, or touch. The next row SHALL be lit and its line said. Rows SHALL tick in any order when the player does the move. A headset SHALL keep the spoken tutorial.

#### Scenario: Desktop card
- **WHEN** a new player starts play with a mouse and keys
- **THEN** the card shows eight rows: swing at the gold ring (LEFT MOUSE or E), let go, swing again, reel in (HOLD SHIFT), yank (F), look around, climb a wall (W A S D), and plunge a clog (F three times)
- **AND** the first row is lit and its line is said

#### Scenario: A row ticks
- **WHEN** the player ropes the gold ring
- **THEN** that row shows a tick and the next row not done is lit and said

#### Scenario: Phone
- **WHEN** a new player starts play on a phone
- **THEN** a chip in the score row shows a box and the rows done ("0/7"), the score row stays one row, and the page does not scroll sideways
- **AND** the phone tutorial line is said, and it names the next row
