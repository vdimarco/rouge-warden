# GTA: NORTH browser installation

## Requirements

### Requirement: Distinct GTA app identity
The GTA: NORTH player SHALL provide a game-specific favicon, home-screen artwork and a manifest with a stable same-origin identity, launch URL, scope and standalone display. The arcade landing page SHALL use matching artwork and link to the installable player.

#### Scenario: Open the app from the launcher
- **WHEN** a supporting browser installs the player
- **THEN** its launcher uses the NORTH artwork and opens the existing player at its root in standalone mode

#### Scenario: Visit from the arcade
- **WHEN** a player opens the GTA arcade landing page
- **THEN** its favicon matches the player and its installation link leads to the playable app origin

### Requirement: Accessible installation flow
The player SHALL expose installation in the existing menu without changing game controls or connection settings. Installation SHALL remain dependent on browser support and shall not imply offline gameplay.

#### Scenario: Use a native installation prompt
- **WHEN** the browser offers an install prompt and the player activates Install
- **THEN** the native prompt opens once from that gesture, dismissal leaves the action usable and successful installation hides it

#### Scenario: Install with browser controls
- **WHEN** no native prompt is available and the player activates Install
- **THEN** the menu shows browser and iPhone/iPad home-screen instructions and states that internet and the game host are required

#### Scenario: Open an installed app with keyboard or touch
- **WHEN** the app runs standalone or installation completes
- **THEN** the install action is hidden, focused installation controls return focus to Close, and the existing menu and game controls remain usable at desktop and phone widths
