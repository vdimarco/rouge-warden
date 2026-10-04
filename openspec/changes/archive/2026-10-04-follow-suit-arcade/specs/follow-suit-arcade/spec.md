## ADDED Requirements

### Requirement: A Follow Suit machine
The Cottage Arcade SHALL have a Follow Suit machine that opens `/follow-suit/`. The machine SHALL be in the Strategy group. The game switcher SHALL list Follow Suit with the same id and the same name as the machine.

#### Scenario: Start the machine
- **WHEN** the player drops a token into the Follow Suit machine and presses START
- **THEN** the browser goes to `/follow-suit/`

#### Scenario: Machine list
- **WHEN** the player opens the machine list under the machines
- **THEN** Follow Suit is in the Strategy group

#### Scenario: Switcher
- **WHEN** the player opens the game switcher in any game
- **THEN** it shows a Follow Suit tile that opens `/follow-suit/`

### Requirement: Best chain on the machine
After each chain, Follow Suit SHALL save the best chain score of all runs in this browser. The machine SHALL show that score after the words BEST CHAIN. With no save, or with a save that is not a positive finite number, the machine SHALL show its plain line, and the arcade page SHALL have no error.

#### Scenario: A saved best chain
- **WHEN** the save holds 5432
- **THEN** the machine shows BEST CHAIN 5,432

#### Scenario: A better chain
- **WHEN** the save holds 300 and the player plays a chain that scores 360
- **THEN** the save holds 360

#### Scenario: A weaker chain
- **WHEN** the save holds 360 and the player plays a chain that scores 90
- **THEN** the save still holds 360

#### Scenario: Junk save
- **WHEN** the save holds text that is not a score
- **THEN** the machine shows 8 STOPS · 5 HOSTS, and the arcade page has no error

### Requirement: The arcade copy
The game at `/follow-suit/` SHALL play the same as the standalone build. It SHALL load `/arcade/quiet.js` as its first script, so that its sound stops while the page is hidden. Its start screen and its run end screen SHALL show a Switch game button, which opens the game switcher, and an Arcade link, which opens the arcade. The standalone build SHALL NOT show them.

#### Scenario: Sound while hidden
- **WHEN** a chain has started the sound and the page is then hidden
- **THEN** the sound stops, and it starts again when the page is visible

#### Scenario: Switch game
- **WHEN** the player taps Switch game on the start screen
- **THEN** the switcher opens, with Follow Suit marked as the game being played

#### Scenario: Back to the arcade
- **WHEN** the run ends and the player taps Arcade
- **THEN** the arcade opens

#### Scenario: Phone layout
- **WHEN** the start screen or the run end screen of the arcade copy is on a 360 by 740, 375 by 667, 390 by 844 or 430 by 932 screen
- **THEN** every button is at least 44 by 44 px, and the page does not scroll

#### Scenario: Standalone build
- **WHEN** the player opens the standalone build
- **THEN** the start screen and the run end screen show no Switch game button and no Arcade link
