# Silent Depth

## Purpose
An original hosted Pacific submarine patrol with a commander control room, persistent helm orders, dedicated stations and an animated ocean, playable on desktop and touch devices.

## Requirements

### Requirement: Commander control room and separate stations
Patrols SHALL begin in a central control-room hub with accessible navigation to the chart table, periscope, torpedo-control, hydrophone and helm. Station changes SHALL preserve the boat's movement and orders. The player SHALL be able to raise/lower the scope and select an individual ready bow tube.

#### Scenario: Give orders from the control room
- **WHEN** the commander orders a course, speed or depth, visits the chart and returns to the control room
- **THEN** the boat continues obeying those orders and all instruments report its current state

#### Scenario: Choose equipment in the room
- **WHEN** the commander views the room on desktop or a phone
- **THEN** subtle equipment-shaped highlights identify all five usable stations; labels appear on hover or keyboard focus, and each native control works by pointer, keyboard and touch without covering the room with persistent cards

#### Scenario: Lower the periscope
- **WHEN** the scope is lowered or the boat is deep
- **THEN** the periscope cannot observe contacts or build a visual firing solution; raising it at scope depth restores observation

#### Scenario: Manage a torpedo tube
- **WHEN** the commander selects a ready tube and fires from Torpedo Control
- **THEN** that tube launches, ammunition decreases once, its reload timer begins, and another ready tube can be selected

### Requirement: Hosted submarine patrol
The arcade SHALL serve Silent Depth at `/silent-depth/` with periscope, chart, hydrophone, torpedoes, escort pursuit, depth charges, victory/loss and replay. Mouse, keyboard and touch controls SHALL operate the same simulation.

#### Scenario: Attack and escape
- **WHEN** a player tracks and torpedoes two merchants, then dives deep and runs silent until contact is broken
- **THEN** the patrol reports victory, tonnage and remaining hull, and replay begins a fresh playable patrol

### Requirement: Complete arcade registration
Silent Depth SHALL have a complete cabinet after Follow Suit at the end of Strategy, a matching GAMES entry, a 480px WebP screen under 60KB, and a game-page control opening the shared switcher.

#### Scenario: Find and play on a phone
- **WHEN** a player opens All Games and searches Silent Depth or opens Strategy at 320px, 390px or 1280px width
- **THEN** the complete title and usable cabinet controls are visible and playing opens `/silent-depth/`

#### Scenario: Leave the game
- **WHEN** a player opens Other games while on patrol
- **THEN** the shared switcher opens with Silent Depth identified and the patrol pauses

### Requirement: Believable moving ocean
The periscope SHALL show traveling swells/ripples with evolving reflection detail below a stable horizon. Waves SHALL keep real-time speed when patrol time acceleration changes, stop while paused, and remain fixed under reduced motion. Graphics failure SHALL preserve a playable static scene.

#### Scenario: Observe the waves
- **WHEN** the same scene is observed two seconds apart at desktop or phone resolution
- **THEN** the ocean detail changes, while the sky and horizon remain stable and instruments remain crisp

#### Scenario: Pause or graphics loss
- **WHEN** the player pauses, requests reduced motion, or WebGL is unavailable/lost
- **THEN** respectively the wave clock freezes, wave animation is suppressed, or the static ocean renders while the rest of the game works

### Requirement: Hidden-page silence
The page SHALL load quiet.js before other scripts and suspend its enabled audio when hidden.

#### Scenario: Leave a sounding patrol
- **WHEN** a player enables sound and hides the page
- **THEN** its sound context stops until the page becomes visible again
