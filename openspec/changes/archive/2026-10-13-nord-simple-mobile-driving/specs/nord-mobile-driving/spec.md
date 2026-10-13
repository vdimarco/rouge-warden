# ADDED Requirements

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
