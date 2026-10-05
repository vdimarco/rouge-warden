# fish-menus-access Specification

## Purpose
The menus put play first, the guide and help teach the moves in the same words, and the controls fit, read and reach on every supported screen.

## Requirements

### Requirement: First play first
The title's main button SHALL be "Go fishing" (free fishing). "Derby: 10 casts" SHALL be the next button. The art style picker SHALL be in Settings only.

#### Scenario: Fresh save
- **WHEN** a new player taps the red button on the title
- **THEN** free fishing starts.

### Requirement: Painted style name
The art style that was called "Ghibli" SHALL be "Painted" on screen, in its stored value, and in its file names. A save that holds the old value SHALL load as "Painted". No file in the app bundle SHALL contain the word "ghibli".

#### Scenario: Old save
- **WHEN** a save with the old style value loads
- **THEN** Settings shows "Painted" as the chosen style and the painted look shows.

### Requirement: Guide for new players
The animated guide SHALL show on the first cast screen for a player who has not landed a fish, unless the player turned it off. After the first catch it SHALL hide unless the player turned it on. The guide button SHALL say what it does.

#### Scenario: Fresh save
- **WHEN** a new player reaches the first cast screen in motion or touch mode
- **THEN** the guide shows its first step.

#### Scenario: Fresh save on a computer
- **WHEN** a new player reaches the first cast screen on a computer
- **THEN** the guide shows its first step as a still picture, and it plays no touch clip.

### Requirement: Short help
How to play SHALL open on the tab for the player's input. Each tab SHALL fit without a scroll at 390x844, and SHALL teach the rising rings. Fish moves SHALL sit behind a "Fish moves" row.

#### Scenario: Desktop help
- **WHEN** a desktop player opens How to play
- **THEN** the "Touch and mouse" tab shows first.

#### Scenario: Help in the app
- **WHEN** a player opens How to play in the store build or on a phone
- **THEN** the tabs are "Motion" and "Touch", with no word of a mouse.

### Requirement: One word for each move
The prompt, the guide caption, and the rod cue SHALL use the same words for the same move and input. On a computer the input SHALL be the one the player used last, the mouse or the keys, and the guide SHALL label it MOUSE or KEYS.

#### Scenario: Pump in motion mode
- **WHEN** a fish holds on the bottom in motion mode
- **THEN** the prompt sub, the guide caption, and the rod cue all say "Tip back as you reel."

#### Scenario: Mouse hold cast
- **WHEN** a player on a computer holds the mouse button to cast
- **THEN** the prompt, the guide caption, and the rod cue say "Keep holding" while the rod tips back, then "Let go in the green", and the guide labels the move MOUSE.

#### Scenario: Mouse player at the strike
- **WHEN** a fish strikes and the player used the mouse last
- **THEN** the prompt says "DRAG THE ROD UP FAST! Set the hook!", and the guide caption and the rod cue say "Drag the rod up fast!".

#### Scenario: Keys player in a fight
- **WHEN** a fish jumps and the player used the keys last
- **THEN** the prompt sub, the guide caption, and the rod cue say "Hold S.", and the guide labels the move KEYS. The other moves name W, A, D, R, and Space.

#### Scenario: Flight on a computer
- **WHEN** the lure flies in a game on a computer
- **THEN** the rod cue says "Click to slow", and the tip says "To stop the lure short, click the lake."

### Requirement: Layouts that fit
Every screen SHALL fit at 390x844, 360x640, 430x932, 844x390, 820x1180, and 1280x800 with no clipped text, no overlap, and its Close or Done button in view or in a scroll that shows it. The HUD chip SHALL show the full derby weight at 360 px.

#### Scenario: Cast report with Larger text
- **WHEN** a cast lands in the water at 360x640 with Larger text on, and the prompt sub takes two lines
- **THEN** the cast report stands under the prompt and does not overlap it.

#### Scenario: Small Android phone
- **WHEN** the derby HUD shows 12.4 kg at 360x640
- **THEN** the chip shows the whole weight.

### Requirement: Reachable and readable controls
Tap targets SHALL be at least 44 px. The drag buttons SHALL sit near the reel thumb. "Reel side: Left" SHALL mirror the reel controls, not only the crank. Text over the sky or water SHALL have a backing or a shadow that gives a 4.5:1 contrast.

#### Scenario: Touch play
- **WHEN** the player plays with touch
- **THEN** the crank is on the left, so the left thumb reels and the right thumb works the rod, and the Reel side note says it applies to motion play.

#### Scenario: Left-handed player
- **WHEN** the player sets "Reel side: Left" at 390x844
- **THEN** the crank, the drag buttons, and the gauge move to mirror places, and none of them overlap.

### Requirement: Access settings
Settings SHALL offer "Larger text" and "Calm effects". Larger text SHALL scale the prompts, toasts, cards, and gauge labels. Calm effects and the system reduced-motion setting SHALL stop flashes, pulses, pops, shakes, and camera punches. Prompts and toasts SHALL reach screen readers through a live region, and each screen SHALL be a labelled dialog.

#### Scenario: Calm effects
- **WHEN** Calm effects is on and a fish strikes
- **THEN** no red flash shows and the prompt does not pulse, and the sound and the words still show.

#### Scenario: Larger text
- **WHEN** Larger text is on at 360x640
- **THEN** the prompt is at least 20 px and every screen still fits.

### Requirement: About row
Settings SHALL have an About row that shows the version and a link to the privacy policy.

#### Scenario: Open About
- **WHEN** the player taps About
- **THEN** the game shows the version, a short credit line, and the privacy policy, with no network needed.
