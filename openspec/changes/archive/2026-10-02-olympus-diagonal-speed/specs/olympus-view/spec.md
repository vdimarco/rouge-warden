## MODIFIED Requirements

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
