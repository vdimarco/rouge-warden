## ADDED Requirements

### Requirement: Training checklist on a first run
On a first run in flat play a training card SHALL list the moves to learn, each with the keys of the input in use: mouse and keys, a game pad, or touch. The next row SHALL be lit and its line said. Rows SHALL tick in any order when the player does the move. A headset SHALL keep the spoken tutorial.

#### Scenario: Desktop card
- **WHEN** a new player starts play with a mouse and keys
- **THEN** the card shows eight rows: swing at the gold ring (HOLD W + LEFT MOUSE), let go, swing again, reel in (HOLD SHIFT), yank (F), look around, climb a wall (W A S D), and plunge a clog (F three times)
- **AND** the first row is lit and its line is said

#### Scenario: A row ticks
- **WHEN** the player ropes the gold ring
- **THEN** that row shows a tick and the next row not done is lit and said

#### Scenario: Phone
- **WHEN** a new player starts play on a phone
- **THEN** a chip in the score row shows a box and the rows done ("0/7"), the score row stays one row, and the page does not scroll sideways
- **AND** the phone tutorial line is said, and it names the next row

### Requirement: Training ends with a clog
The last row SHALL be to plunge a clog. The first flush SHALL end the training, as it ends the spoken tutorial, whatever rows are still open: the card SHALL say so, a toast SHALL cheer, the save SHALL mark the tutorial done, and the card SHALL fold away.

#### Scenario: Training complete
- **WHEN** the player flushes the first clog, with or without the other rows done
- **THEN** a toast says "Training complete! Now flush the clogs." and the card folds away
- **AND** the next run shows no card

### Requirement: Pump sticker
While a rope holds a clog or one of the King's pipes, a sticker by the crosshair SHALL show the pump key and "PUMP" with one dot for each press needed. Each press SHALL fill a dot. The sticker SHALL hide when the clog flushes or the rope lets go.

#### Scenario: Pump a clog with F
- **WHEN** the player ropes a clog on desktop
- **THEN** the sticker shows "F", "PUMP" and three empty dots
- **AND** each F press fills one dot and the third press flushes the clog and hides the sticker
