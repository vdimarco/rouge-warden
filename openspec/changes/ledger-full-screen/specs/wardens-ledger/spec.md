# Warden's Ledger

## MODIFIED Requirements

### Requirement: Layouts and controls
The page SHALL fit at 1280, 390 and 320 pixels wide with no horizontal scroll, every control SHALL be at least 44 pixels on its shorter side, and the menu SHALL have a Switch game button. The page SHALL work with mouse, touch and keyboard (Tab and Enter). In a window at least 900 pixels wide and 560 pixels tall, the ledger SHALL fill the window from edge to edge, the page SHALL NOT scroll, and the board, the receipts and the agents SHALL each scroll by themselves.

#### Scenario: Phone
- **WHEN** the page is 390 or 320 pixels wide
- **THEN** Board, Receipts and Agents show one at a time behind tabs and nothing scrolls sideways

#### Scenario: Wide window
- **WHEN** the window is 1280 by 800 or 1920 by 1080
- **THEN** the header is at the top, the three panes reach the window's left, right and bottom edges within a 16 pixel margin, the page does not scroll, and Next delivery and Close the day are in view
- **AND** the day's tasks sit in two columns at 1280 and in three columns at 1920

#### Scenario: A delivery on a scrolled board
- **GIVEN** a wide window with the board scrolled down
- **WHEN** the player presses Next delivery
- **THEN** the board goes back to its top, where the delivery and its check show

#### Scenario: Short window
- **WHEN** the window is 1280 wide and under 560 pixels tall
- **THEN** the page scrolls as one document

## ADDED Requirements

### Requirement: Full screen
The game SHALL use the browser's full screen mode where the browser has one for pages. The two Start buttons SHALL enter it. A Full screen button in the header SHALL turn it on and off, and the game SHALL keep that choice for the next visit. Where the browser has no full screen mode for pages, the button SHALL NOT show.

#### Scenario: Start goes full screen
- **GIVEN** a player who has not turned full screen off
- **WHEN** the player presses Start the season or Watch the Warden play
- **THEN** the browser's bars hide, the ledger fills the screen, and the Full screen button shows as pressed

#### Scenario: Turning it off
- **GIVEN** the game is full screen
- **WHEN** the player presses the Full screen button
- **THEN** the game goes back into its window, and on the next visit Start stays in the window

#### Scenario: Leaving with Esc
- **GIVEN** the game is full screen
- **WHEN** the player presses Esc
- **THEN** the game goes back into its window and the Full screen button shows as not pressed

#### Scenario: A browser with no full screen for pages
- **WHEN** the page opens in Safari on an iPhone
- **THEN** the header has no Full screen button and the game plays in the browser's window

### Requirement: The summary always leads to the next day
A closed day's summary SHALL lead to the next day, or to a new season after the last day, when the player presses its button or closes it with Esc.

#### Scenario: Esc on the summary
- **GIVEN** the day's summary is open
- **WHEN** the player presses Esc
- **THEN** the summary closes and the next day starts
