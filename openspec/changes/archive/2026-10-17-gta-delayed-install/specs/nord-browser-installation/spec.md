# GTA delayed installation reminder

## ADDED Requirements

### Requirement: Reminder after visible gameplay
The player SHALL show a compact non-modal installation reminder after two cumulative minutes of visible gameplay, excluding other menus and overlays. It SHALL preserve gameplay focus, provide Install and Not now controls, and suppress the reminder for seven days after display. Installed apps SHALL not show the reminder. Storage failures SHALL leave gameplay and dismissal usable and limit display to once in the current page session.

#### Scenario: Play before being asked
- **WHEN** a player accumulates two visible minutes in the playing state
- **THEN** the reminder appears without moving focus or automatically opening native installation

#### Scenario: Wait or leave the game
- **WHEN** the player is on the title/story/connection screen, in another overlay, disconnected or in a hidden tab
- **THEN** that time does not advance the reminder and no reminder covers those screens

#### Scenario: Dismiss and return
- **WHEN** the reminder is dismissed or the player returns within seven days after it appeared
- **THEN** it stays hidden while menu installation remains available

#### Scenario: Choose installation
- **WHEN** a player activates the reminder installation action
- **THEN** the existing native prompt opens from that click, or browser instructions appear; installation success hides both install surfaces and dismissal leaves gameplay usable

#### Scenario: Use keyboard and touch
- **WHEN** the reminder appears on desktop or a phone-sized viewport
- **THEN** text and controls fit, controls are at least 44 pixels high, Escape dismisses it, and focused controls return to a visible game/menu target only when needed
