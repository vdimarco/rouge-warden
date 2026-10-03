## ADDED Requirements

### Requirement: A voyage of the day
Full Tilt SHALL fly the same voyage for all players on the same day, and every world in a voyage SHALL be one that a player can clear.

#### Scenario: Start voyage
- **WHEN** the player presses Start voyage
- **THEN** the seed comes from the local date, Lunar Harbor opens the voyage and the Star Engine ends it
- **AND** the seed sets the order of the four worlds between them, one of three tested beacon layouts for each world, and the upgrades that each gate offers

#### Scenario: Random voyage
- **WHEN** the player presses Random voyage
- **THEN** the voyage uses a new seed, and Fly again repeats that voyage

#### Scenario: Every layout can be cleared
- **WHEN** a bot that flips on the cue plays a tested layout
- **THEN** it lights the beacons and reaches the gate, and some launch power makes the skill shot

### Requirement: An end card that shows how close you came
Full Tilt SHALL end each voyage with a card that compares the run with the best and gives a line to share.

#### Scenario: The end card
- **WHEN** a voyage ends
- **THEN** the card shows the six worlds, the score, "New best" or the gap to the best, such as "1,250 short of best", the Perfect count and the best rally

#### Scenario: Share a result
- **WHEN** the player presses Copy result
- **THEN** the game copies a line such as "Full Tilt 10-03 · 4/6 · 31,100", and a random voyage shows its seed code in place of the day

#### Scenario: A short landscape screen
- **WHEN** the card shows on a phone in landscape
- **THEN** the result sits beside the buttons, and the card fits without a scroll
