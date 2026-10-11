## MODIFIED Requirements

### Requirement: GTA Montréal entry and readable HUD
The Cottage Arcade SHALL offer a GTA machine that opens the Montréal title page, with a Play link to the existing browser player. The native HUD SHALL provide an original compact NORD/Montréal identity, selected crew and online count, concise mission information, a player-centered road radar, speed and contextual controls without dropping existing gameplay feedback or displaying unimplemented game statistics.

#### Scenario: Launch from the arcade
- **WHEN** a player activates the GTA machine by the existing click or keyboard interaction
- **THEN** the Montréal title page opens with a working Play link to the NORD Montréal browser player.

#### Scenario: Read play information
- **WHEN** a player walks, talks, drives or advances the existing campaign at 1280×720 or 1920×1080
- **THEN** the current objective, status, interaction hint, crew identity, online count, speed when driving and contextual controls remain readable without covering one another
- **AND** world objective markers avoid occupied HUD regions
- **AND** the HUD does not invent health, armour, currency or wanted-level state.

#### Scenario: Follow the local radar
- **WHEN** the player moves through the mapped district
- **THEN** the compact radar remains centered on the player's current location and displays the real road geometry, facing, current objective and eligible nearby cars
- **AND** road segments are clipped to the radar bounds without fabricated border roads
- **AND** OpenStreetMap contributors/ODbL, its copyright URL and Ville de Montréal/CC BY 4.0 remain readable.

#### Scenario: Read a changing briefing
- **WHEN** the campaign is first presented or its phase changes
- **THEN** the appropriate story briefing appears temporarily with sufficient reading time and then clears
- **AND** the current objective and relevant status remain available after it clears.

#### Scenario: Preserve private explanations and save warnings
- **WHEN** a player talks to a resident, receives a blocked-exit or interaction explanation, or the campaign reports a save warning
- **THEN** that feedback remains readable for its intended lifetime and is not hidden by the timed briefing
- **AND** private controller feedback remains private to the receiving player
- **AND** during an unfinished campaign the existing R recovery hint remains discoverable even when a save warning or alignment feedback occupies the objective status row.

#### Scenario: Preserve contextual priority and completion
- **WHEN** an available nearby car takes interaction priority over an objective or resident
- **THEN** the HUD offers the car action without conflicting completion or dialogue prompts
- **AND** moving away restores the applicable objective or resident hint.
- **WHEN** the players complete a supported campaign or legacy mission together
- **THEN** both peers see a brief centered gold completion banner with the correct mode-specific completed count
- **AND** the existing recovery, replay and subsequent-objective information remains available.

#### Scenario: Review the streamed HUD on phone layouts
- **WHEN** the existing 1280×720 game stream is displayed in 360×800 portrait, 800×360 landscape or 800×360 / 667×375 landscape fullscreen with touch controls
- **THEN** decoded video retains the objective, contextual feedback, speed and geographic attribution without cropping or collision with touch controls in the reviewed layouts
- **AND** mobile landscape fullscreen fills all four viewport edges without reserved black borders, using the complete stream with aspect-ratio stretching where necessary
- **AND** fullscreen touch targets remain clear of native HUD regions and one another with minimum dimension 44 px while portrait/non-fullscreen layouts, desktop presentation and input behavior remain usable
- **AND** recorded results distinguish browser emulation from physical-phone and off-LAN testing.
