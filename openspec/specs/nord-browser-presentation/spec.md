# NORD browser presentation

## Requirements
### Requirement: Consistent comic entry pages
The browser home screen and GTA arcade landing page SHALL use the approved collage badge, cream text panels, cyan halftone backgrounds, black ink borders and yellow primary actions.

#### Scenario: Badge-matched browser chrome
- **WHEN** the browser entry screen is visible
- **THEN** its header and footer use cream lettering on ink, its background uses angled cyan, yellow and hot-pink comic panels, and its trailer and status controls repeat the badge’s bold display lettering
- **AND** the large badge remains the primary action without changing the gameplay controls

#### Scenario: Desktop entry
- **WHEN** a player opens either entry page at 1280px width
- **THEN** the badge, readable primary actions and existing status or installation information are visible in a coherent comic layout

#### Scenario: Narrow entry
- **WHEN** either page opens at 390px or 320px width
- **THEN** content stacks without horizontal overflow and all actions remain reachable with at least 44px touch targets

#### Scenario: Existing flows
- **WHEN** the player activates Start, Menu or Watch the trailer
- **THEN** the existing story, menu or dismissible trailer opens and gameplay controls remain unchanged

#### Scenario: Play from the badge
- **WHEN** either entry page is opened
- **THEN** the dominant circular badge is the browser Play button, with a gently pulsing PLAY word over its lower third and no animation under reduced-motion preferences; the arcade Play link remains beneath its badge

#### Scenario: Single-viewport entry
- **WHEN** either entry page opens at 320×568, 390×844, 844×390 or 1280×720
- **THEN** its primary action stays on or below the badge and the entry page has no horizontal or vertical overflow
- **AND** compact layouts omit repeated branding and keyboard legends while keeping trailer, host status and installation access available

### Requirement: GTA landing page explains how to join
The GTA arcade landing page SHALL use the name GTA: NORTH, show the join conditions next to Play, list the join and install steps, and keep Play on the first screen at every supported layout.

#### Scenario: Desktop landing
- **WHEN** a player opens `/gta/` at 1280×800 or 1280×720
- **THEN** the badge, Play, the "2 player slots · host PC must be online" status, three numbered steps, the trailer and the keyboard controls as key caps show without scrolling

#### Scenario: Phone landing
- **WHEN** a player opens `/gta/` at 390×844
- **THEN** the page fits the screen without scrolling, the keyboard controls are hidden and the touch-controls note shows

#### Scenario: Small phone landing
- **WHEN** a player opens `/gta/` at 320×568
- **THEN** the badge, Play, the status and the story show on the first screen, the page has no horizontal overflow and every link is at least 44px on its shorter side

#### Scenario: Phone turned sideways
- **WHEN** a player opens `/gta/` at 844×390
- **THEN** the page fits the screen without scrolling and the step numbers do not overlap

#### Scenario: Shared link
- **WHEN** someone shares `https://arcade.uptick.systems/gta/`
- **THEN** the preview shows the GTA: NORTH title, the one-line story and the comic badge

### Requirement: Play page title screen shows the loop and one panel
The browser title screen SHALL show the title loop behind the badge, and SHALL group the game title, connection status, Connect and Watch trailer in one cream comic panel.

#### Scenario: Desktop title screen
- **WHEN** a player opens the play page at 1280×800 or 1280×720 with the host offline or idle
- **THEN** the loop or its poster is visible behind a light halftone, the badge carries a yellow PLAY stamp in its lower third, and one panel shows the title, a status chip with a state dot, and Connect and Watch trailer side by side

#### Scenario: Phone title screen
- **WHEN** a player opens the play page at 390×844, 360×640 or 320×568
- **THEN** the badge, status and both buttons fit without page or panel scrolling, body text is at least 15px, and both buttons are at least 46px high

#### Scenario: Trailer
- **WHEN** the player selects Watch trailer
- **THEN** the full trailer opens in the dialog and the title loop unloads, as before

### Requirement: Play page buttons have a clear order
The title screen SHALL show one yellow main action (Connect, Reconnect or Play with sound) with an arrow, and SHALL show Watch trailer and Sound on as smaller paper buttons in their own row under it. Menu SHALL use the same paper button style.

#### Scenario: Host offline
- **WHEN** the host is offline
- **THEN** Connect shows with a dashed border, no shadow and the words "Waiting for host", and it cannot be pressed

#### Scenario: Host idle
- **WHEN** the host is idle
- **THEN** Connect is the only yellow button on the title screen, it is at least 46px high, and it moves into its shadow when pressed

#### Scenario: Sound on
- **WHEN** the title loop plays muted
- **THEN** Sound on shows next to Watch trailer inside the panel, outside the status live region, and it does not cover the badge or ☰ Menu
