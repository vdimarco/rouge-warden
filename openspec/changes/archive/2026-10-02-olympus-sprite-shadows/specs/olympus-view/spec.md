## ADDED Requirements

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
