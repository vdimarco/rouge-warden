# NORD mobile driving

## Purpose
Make driving use separate steering and pedals on phones and keep the browser demo in daylight.

## Requirements

### Requirement: Separate mobile steering and pedals
The browser SHALL use actual native pawn possession to show left/right steering and Gas, Brake/Reverse, Exit and Menu in a car, retaining walking controls on foot. Changing mode, opening the menu, cancellation and disconnect SHALL release held input.

#### Scenario: Enter and exit a car
- **WHEN** a phone player successfully enters or exits a vehicle
- **THEN** controls switch automatically within the next state update; a failed interaction leaves the current mode intact

#### Scenario: Two-thumb driving
- **WHEN** the player holds Gas and steers left or right
- **THEN** acceleration continues independently of steering; releasing either control releases only its native input
- **WHEN** the player holds Brake/Reverse
- **THEN** the existing service brake stops forward motion before reverse engages

#### Scenario: Phone layouts and interrupted input
- **WHEN** the player rotates, opens the menu, cancels touches or disconnects
- **THEN** held driving keys release, controls fit portrait and both landscape layouts, and mission/radar/speed/prompt text stays clear

### Requirement: Browser demo stays in daylight
The browser launcher SHALL default to a frozen 15:00 clock while preserving explicit sky overrides and the native weather system.

#### Scenario: Shared daytime
- **WHEN** either player connects or reconnects to the default live demo
- **THEN** both peers render the host's daytime clock without changing campaign saves or authored map assets

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

#### Scenario: Readable controls and separate menu
- **WHEN** touch controls render in driving, walking or swimming mode at 320px portrait or wider supported layouts
- **THEN** labels fit inside their buttons without overflow or wheel artwork covering the text, and Menu appears at the safe-area-aware top left of the play area
