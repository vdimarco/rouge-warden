## ADDED Requirements

### Requirement: Drag steering wheel
The browser SHALL display a single wheel-shaped horizontal steering surface with adjacent left and right targets in portrait and landscape. Gas and Brake SHALL remain adjacent. Dragging across the wheel SHALL switch steering direction without lifting, its center SHALL stop steering, and releasing or interrupting the gesture SHALL clear steering. Walking controls and keyboard activation SHALL remain available.

#### Scenario: Drag while accelerating
- **WHEN** a driver holds Gas and drags across the wheel from left through center to right
- **THEN** left steering releases at center, right steering activates on the right, and Gas remains held

#### Scenario: Interrupted steering
- **WHEN** a steering touch ends, is cancelled, or the player changes mode, rotates, opens the menu or disconnects
- **THEN** steering releases and the wheel recenters

#### Scenario: Phone layouts
- **WHEN** driving controls are shown at 320px or 390px portrait or landscape
- **THEN** the wheel and adjacent pedals fit without overlap and each steering button is at least 44px
