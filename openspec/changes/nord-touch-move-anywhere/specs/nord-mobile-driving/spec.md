## MODIFIED Requirements
### Requirement: Drag steering wheel
The browser SHALL display a single wheel that works as a stick in portrait and landscape: left and right steer, up accelerates, and down brakes and then reverses. In a car, the first finger that lands anywhere on the game image SHALL place the wheel under that finger and drive from the landing point. Gas and Brake SHALL remain as buttons. Dragging across the wheel SHALL switch steering direction without lifting, its center SHALL stop steering and pedals, and releasing or interrupting the gesture SHALL clear all wheel input. Walking controls and keyboard activation SHALL remain available.

#### Scenario: Drag while accelerating
- **WHEN** a driver holds Gas and drags across the wheel from left through center to right
- **THEN** left steering releases at center, right steering activates on the right, and Gas remains held

#### Scenario: Wheel as a stick
- **WHEN** a driver drags the wheel up, up-left, or down
- **THEN** up accelerates, up-left accelerates and steers left, and down brakes and then reverses; Gas lights while the wheel accelerates

#### Scenario: Drive from anywhere
- **WHEN** a driver touches anywhere on the game image away from the buttons and drags
- **THEN** the wheel appears under the thumb and drives in the dragged direction, a second finger dragging turns the camera, and release returns the wheel to its corner

#### Scenario: Interrupted steering
- **WHEN** a steering touch ends, is cancelled, or the player changes mode, rotates, opens the menu or disconnects
- **THEN** steering and wheel pedals release and the wheel recenters

#### Scenario: Phone layouts
- **WHEN** driving controls are shown at 320px or 390px portrait or landscape
- **THEN** the wheel and adjacent pedals fit without overlap and each steering button is at least 44px

#### Scenario: Readable controls and Menu in the action group
- **WHEN** touch controls render in driving, walking or swimming mode at 320px portrait or wider supported layouts
- **THEN** labels fit inside their buttons without overflow or wheel artwork covering the text, and Menu fills the bottom-right corner of the action group, beside Use (or Exit) and under Jump (or Brake)
