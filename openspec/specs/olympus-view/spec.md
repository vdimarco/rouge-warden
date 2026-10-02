# Olympus arena view

## Requirements

### Requirement: Saved camera choice
Olympus SHALL default to isometric and offer a saved top-down alternative on title and pause screens.

#### Scenario: New player
- **WHEN** a player opens Olympus without a camera preference
- **THEN** the arena uses isometric projection and the title identifies that view

#### Scenario: Switch during a run
- **WHEN** the player pauses and changes view
- **THEN** the camera changes without changing health, enemies, timer or progression, and resumes with cleared movement input

#### Scenario: Reload and restricted storage
- **WHEN** the player reloads after choosing a view
- **THEN** the chosen view is restored if storage is available, and unavailable storage does not prevent play

### Requirement: Grounded depth and screen controls
The renderer SHALL project the ground, keep sprites upright, depth-sort scenery and actors, and preserve screen-aligned controls.

#### Scenario: Isometric movement
- **WHEN** the player drags right, down, left or up, or presses the matching direction key
- **THEN** movement follows that screen direction and diagonal input does not exceed the normal world movement speed

#### Scenario: Combat readability
- **WHEN** enemies attack among scenery in either view
- **THEN** charge lanes and strike circles use the same ground projection as collision positions, and scenery covering the player fades

#### Scenario: Responsive arena
- **WHEN** the arena renders at portrait, landscape or desktop dimensions
- **THEN** terrain fills the viewport, the hero remains centered, and the toggle is accessible without obscuring movement controls
