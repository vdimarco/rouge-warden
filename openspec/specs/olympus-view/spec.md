# Olympus arena view

## Purpose
The Olympus arena opens in an isometric view. The player can switch to a top-down view on the title or pause screen, and the game remembers that choice. In both views, the hero moves at the same pace in every direction, and each sprite casts a floor shadow in its own shape.

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
The renderer SHALL project the ground, keep sprites upright, depth-sort scenery and actors, and preserve screen-aligned controls with equal visible movement speed in all directions.

#### Scenario: Directional movement
- **WHEN** the player drags or presses direction keys horizontally, vertically or diagonally in either view
- **THEN** movement follows that screen direction at the same visible speed for equal input strength, without a keyboard diagonal speed boost

#### Scenario: Analog movement and upgrades
- **WHEN** the player changes joystick strength or gains Hermes speed upgrades
- **THEN** visible travel speed and walking intensity scale consistently across directions, while isometric horizontal pace and top-down pace remain unchanged

#### Scenario: Combat readability
- **WHEN** enemies attack among scenery in either view
- **THEN** charge lanes and strike circles use the same ground projection as collision positions, and scenery covering the player fades

#### Scenario: Responsive arena
- **WHEN** the arena renders at portrait, landscape or desktop dimensions
- **THEN** terrain fills the viewport, the hero remains centered, and the toggle is accessible without obscuring movement controls

### Requirement: Sprite-shaped floor shadows
Olympus SHALL derive floor shadows and contact footprints from each loaded sprite's alpha shape, use the current pose and facing, and cast along a consistent world light direction.

#### Scenario: Animated actor
- **WHEN** a character walks, attacks, faces the other direction or falls
- **THEN** its floor shadow uses the displayed frame and follows the sprite's pose and facing

#### Scenario: Scenery and floating actors
- **WHEN** scenery, a serpent, a guardian or a floating shade appears
- **THEN** its silhouette and contact footprint match its artwork, with height and opacity appropriate to that object

#### Scenario: Camera and warnings
- **WHEN** the player switches between isometric and top-down at portrait, landscape or desktop dimensions
- **THEN** shadow direction follows the projected light, stays on the floor and leaves attack warnings readable

#### Scenario: Repeated rendering and loading
- **WHEN** the same loaded frame renders repeatedly or an image is still loading
- **THEN** its shadow reuses cached masks, and an unloaded image produces no invalid shadow
