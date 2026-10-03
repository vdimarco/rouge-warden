## ADDED Requirements

### Requirement: Phone portrait first
The game SHALL fit a 390 by 844 portrait screen with no horizontal scroll, and every tap target SHALL be at least 44 px in both directions. A full run SHALL be playable with one thumb.

#### Scenario: Measured layout
- **WHEN** a Playwright check opens the table screen at 390 by 844 with touch
- **THEN** every button and hand card measures at least 44 by 44 px, the action bar sits in the lower third of the screen, and the page is no wider than the screen

### Requirement: Table screen
The top of the table screen SHALL show the stop and table number, the target, the table total, the money, the chains left and the redraws left. Host tables SHALL show the host rule under the top bar. The seed SHALL show during the run.

#### Scenario: Start of a table
- **WHEN** the first table of a run starts
- **THEN** the top bar shows stop 1, table 1, target 150, total 0, $4, 3 chains and 2 redraws

### Requirement: Charm board
The table screen SHALL show the 4 suit slots and the table slot. Tapping a charm SHALL show its effect.

#### Scenario: Read a charm
- **WHEN** the player taps the Lantern in the hearts slot
- **THEN** the game shows that each hearts card adds 4 Value

### Requirement: Chain area
The chain area SHALL show the chain in progress with live Value and Mult from the base rules and a ring marker. Charm effects SHALL stay hidden until the play animation.

#### Scenario: Ring marker
- **WHEN** the chain closes into a ring
- **THEN** the ring marker lights up

#### Scenario: Charms stay hidden
- **WHEN** Lantern is in the hearts slot and the player builds 5♥ 9♥
- **THEN** the chain area shows Value 14, and the Lantern bonus shows only when the chain is played

### Requirement: Hand and buttons
The hand SHALL sit at the bottom, with every legal card raised and the rest dimmed. The buttons SHALL be Undo, Play chain and Redraw. Redraw SHALL open a select mode with Confirm and Cancel. Adding an 8 SHALL show 4 suit buttons.

#### Scenario: Empty chain
- **WHEN** the chain is empty
- **THEN** every card rises, and Undo and Play chain are disabled

#### Scenario: Redraw mode
- **WHEN** the player taps Redraw
- **THEN** tapping cards selects them, and Confirm and Cancel replace the buttons

### Requirement: Score reveal
When the player taps Play chain, the game SHALL score the cards one at a time, about 180 ms each, and show the points each card adds above it. Each switch SHALL bump the Mult counter and play a note. Each chain SHALL start at the root of a major scale and move one step up for each switch. A ring SHALL move the chain cards into a circle and flash the Mult change. The table total SHALL count up to its new value. A clear with a power-of-ten bonus SHALL play one coin sound for each bonus dollar.

#### Scenario: Reveal order
- **WHEN** the player plays 7♠ K♠ K♥ 4♥ 4♣ 7♣
- **THEN** the points 7, 10, 10, 4, 4 and 7 appear above the cards in order, Mult bumps twice with rising notes, the cards form a circle, Mult flashes from 3 to 6, and the total counts up by 252

### Requirement: Sound and motion settings
The game SHALL have a mute toggle. If the device asks for reduced motion, the ring SHALL fade instead of moving the cards into a circle.

#### Scenario: Mute
- **WHEN** the player turns on mute and plays a chain with switches
- **THEN** no sound plays

#### Scenario: Reduced motion
- **WHEN** prefers-reduced-motion is on and a ring is played
- **THEN** the cards stay in place and the ring shows with a fade

### Requirement: Calm look with no files
The game SHALL use a calm, readable look that suits a solitaire pace. Cards SHALL be drawn with CSS and sounds SHALL come from the Web Audio API. The game SHALL not copy the reference game's look, names or text.

#### Scenario: No media files
- **WHEN** the production build is listed
- **THEN** it holds no image or audio files
