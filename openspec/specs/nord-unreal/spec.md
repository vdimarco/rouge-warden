# NORD Unreal project

## Purpose
Preserve the standalone Montréal Unreal game in Warden with reproducible sources, verified controls, and explicit fidelity limits.

## Requirements

### Requirement: Standalone Unreal project
Warden SHALL preserve NORD under `games/nord-unreal/` with its source, saved maps, required assets, provenance, and build/launch instructions.

#### Scenario: Open and build
- **WHEN** a developer builds the imported project with Unreal Engine 5.8.3 on the supported Linux machine
- **THEN** the editor module builds and the LaFontaine saved map loads
- **AND** the project documentation identifies Vulkan SM6 as required

### Requirement: Preserve verified play
The imported project SHALL retain walking, driving, shared park objectives, and direct-IP multiplayer behavior.

#### Scenario: Use desktop controls
- **WHEN** a player plays the LaFontaine map in a 1280 by 720 desktop window
- **THEN** WASD moves, mouse looks, Shift sprints, Space jumps on foot or brakes the car, and E enters/exits a nearby available car
- **AND** the HUD shows mission progress, the road map, and contextual controls

#### Scenario: Drive over small obstacles
- **WHEN** the car drives across decorative road markings and the tested 18 cm curb
- **THEN** it traverses them while a tall wall still blocks it

#### Scenario: Share progress
- **WHEN** two players connect to a listen server and complete objectives in order
- **THEN** car occupancy, movement, and shared objective progress replicate

### Requirement: Honest geographic and visual scope
The project SHALL identify its OpenStreetMap and CC0 art sources and its current reconstruction limits.

#### Scenario: Inspect fidelity
- **WHEN** the map is inspected at its saved spawn near 1334 Rue Sherbrooke Est
- **THEN** the imported map orientation, district scale, ground collision, and address building collision pass validation
- **AND** documentation identifies the municipal survey coverage and states which façades, heights, widths, terrain, and distant tree appearance remain simplified
- **AND** it makes no claim of Street View-identical fidelity or built interiors

### Requirement: Comic-book look
The LaFontaine map SHALL render in an animated comic-book style by default, with ink outlines, flat colour bands, halftone dots, hatching in deep shadow and offset print plates, without using characters, suits or logos from any film.

#### Scenario: See the comic look on foot
- **WHEN** a player spawns near 1334 Rue Sherbrooke Est in a 1280 by 720 or larger desktop window
- **THEN** building and tree silhouettes have dark ink outlines
- **AND** shaded areas show a regular halftone dot pattern
- **AND** distant objects show red and blue plates offset from each other

#### Scenario: Switch the look
- **WHEN** the player presses F2
- **THEN** the view returns to the realistic render for that player only
- **AND** pressing F2 again restores the comic look

#### Scenario: Drive with the look
- **WHEN** the player enters the car
- **THEN** the car camera keeps the player's current look setting

### Requirement: Animation on twos
The walking character SHALL update its pose 12 times a second while its movement and the camera update every frame.

#### Scenario: Watch the character run
- **WHEN** the comic look is on and the character runs
- **THEN** the body pose changes in held steps while the character glides smoothly across the ground
- **AND** turning the look off with F2 restores full-rate animation

### Requirement: Comic HUD
The HUD SHALL use an original compact GTA-inspired presentation that keeps mission, road map and contextual control information readable while leaving ordinary movement and driving visible. It SHALL show brief sound-word bursts for local jump, hard acceleration and handbrake actions only while the local comic view is enabled.

#### Scenario: Read the HUD
- **WHEN** the player is on foot or in the car at 1280×720 or 1920×1080
- **THEN** the objective, status, road map with attribution and contextual controls remain readable without overlapping one another
- **AND** permanent title, briefing and keyboard-legend panels do not dominate the picture.

#### Scenario: Pull the handbrake in comic view
- **WHEN** the driver holds Space while moving with comic view enabled
- **THEN** a sound-word burst appears briefly without obscuring the objective or contextual action
- **AND** the speed and handbrake feedback remain readable.

#### Scenario: Switch the local look
- **WHEN** a player disables comic view with F2 and jumps, accelerates or handbrakes
- **THEN** comic sound-word bursts remain hidden for that player
- **AND** movement, mission feedback and another player's look setting remain unchanged
- **AND** restoring comic view does not emit a stale action burst.

### Requirement: Repository hygiene
The import SHALL exclude local credentials, packaged builds, engine caches, recovery data, trailer binaries and regenerated base OSM geographic OBJ files. Processed municipal mesh inputs, roof atlases and authored comic meshes SHALL be retained as reproducible source assets.

#### Scenario: Inspect the commit
- **WHEN** the integrated release is staged
- **THEN** only the project, source assets, documentation, focused QA/specification files and authorized GTA Arcade entry/title-page changes are included
- **AND** unrelated Arcade games and API sources remain preserved
- **AND** deployed trailer/poster hashes and provenance are recorded without committing media binaries.

### Requirement: Surveyed starting-block buildings
The game SHALL use attributed municipal textured LOD2 models near 1334 Sherbrooke Est, preserving surveyed roof shapes and roof photo UVs, with illustrated façade patterns explicitly identified as estimated: flat brick colour bands, dark window outlines, cream trim and blue glass.

#### Scenario: Explore the starting block
- **WHEN** a player walks around the starting block in a 1280 by 720 or larger desktop window
- **THEN** municipal building geometry replaces overlapping procedural blocks and have working exterior collision
- **AND** F2 continues to switch the global comic post-process independently of geometry, while the illustrated façade artwork remains
- **AND** map provenance identifies the survey year and simplified terrain

#### Scenario: Read the illustrated street
- **WHEN** the comic filter is enabled in a 1280 by 720 or larger desktop view
- **THEN** road surfaces and façades remain visible rather than filling with solid ink
- **AND** dark window borders, cream trim and blue glass remain readable against terracotta brick bands

#### Scenario: Preserve driving
- **WHEN** a player drives from the starting road over a decorative marking or the tested curb
- **THEN** existing entry, exit and obstacle traversal still work

### Requirement: Comic park district
The game SHALL render mapped Parc La Fontaine paths, ponds, sports areas and landmarks with attributed geographic sources, varied trees and clearly identified estimated model details.

#### Scenario: Explore the park
- **WHEN** a player walks through the park at 1280×720 or larger
- **THEN** the pond edges, theatre, chalet and sports courts are distinguishable in rendered reference views
- **AND** surrounding surveyed buildings and tree locations follow the available source data
- **AND** F2 switches the global comic filter while illustrated assets remain

### Requirement: Original park residents
The game SHALL include goofy original park residents with readable silhouettes and short original dialogue, including the eight user-supplied cottage crew designs with temporary descriptive names and complete textured skeletal bodies.

#### Scenario: Meet a resident
- **WHEN** a walking player approaches a resident and presses E
- **THEN** the player receives the resident's dialogue
- **AND** two connected players see the same resident placement and movement
- **AND** only the interacting player receives the dialogue, without changing completed mission progress

### Requirement: Illustrated cars
The game SHALL give its existing fleet original 1970s-inspired coupe, sedan and station-wagon bodies, distinct windows, aligned wheel arches, round headlamps, grilles and chrome trim in the comic art direction while preserving the existing collision box and driving controls.

#### Scenario: Drive the upgraded car
- **WHEN** a player enters with E and drives with W/S and A/D
- **THEN** the selected period body and paint follow the vehicle and its wheels animate
- **AND** street marking and tested curb traversal, handbraking and exit still pass the driving checks

### Requirement: Textured cottage crew
The eight supplied cottage characters SHALL use complete textured skeletal models with recognizable face, hair, clothing and accessories, in the established comic art direction.

#### Scenario: Inspect the crew
- **WHEN** the eight residents are viewed at conversation distance and in the 1600 by 900 lineup
- **THEN** all eight render with textured complete bodies and distinct reference outfits, correctly grounded and without missing materials
- **AND** source models and generation provenance are retained

#### Scenario: Walk and talk online
- **WHEN** a client joins a host and approaches a crew member with E
- **THEN** the resident walks using the imported animation, movement replicates and only the interacting player sees the existing caption
- **AND** existing car controls and mission state are preserved

#### Scenario: Revised skull-shirt likeness
- **WHEN** the skull-shirt resident is viewed in the saved face close-up
- **THEN** his short tousled hair, short beard and moustache, broad smile and facial proportions follow the newly supplied face illustration
- **AND** his black graphic shirt, teal palm shorts and bare feet remain recognizable

### Requirement: Verified desktop release quality
The existing Linux game SHALL retain a requirement-to-evidence audit covering controls, car interactions, shared missions, residents, local comic rendering, saved map assets and packaged multiplayer lifecycle.

#### Scenario: Reject invalid interactions
- **WHEN** players attempt to enter an occupied car, interact through a wall, or exit into blocked space
- **THEN** occupancy and mission progress remain valid, and a blocked exit retains the driver safely
- **AND** the blocked driver sees a private on-screen explanation that clears after successful entry or exit
- **AND** a subsequent valid interaction succeeds

#### Scenario: Follow contextual interaction hints
- **WHEN** a nearby car takes priority over an objective or resident
- **THEN** the HUD offers the car interaction and does not offer conflicting dialogue or objective completion
- **AND** moving away restores the appropriate objective or resident hint

#### Scenario: Join an ongoing session
- **WHEN** a player joins after shared progress has advanced, leaves while driving, then reconnects
- **THEN** the joining player receives the current mission and resident state
- **AND** the abandoned car remains usable and the hidden walking pawn is cleaned up

#### Scenario: Inspect the desktop release
- **WHEN** the current package is reviewed at 1280 by 720 and 1920 by 1080
- **THEN** mission text, controls, dialogue, map attribution and driving speed remain readable
- **AND** projected world-objective markers do not cover the mission caption
- **AND** recorded frame-time measurements identify the tested hardware and scene
- **AND** with no competing game or editor render process, the three warmed reference scenes at Epic quality and 100% screen percentage have a 95th-percentile frame time below 16.67 ms on the tested RTX 4090 machine at both sizes

#### Scenario: Interrupted driving input
- **WHEN** a remote driver stops sending packets while accelerating
- **THEN** the server clears stale throttle and steering after half a second without a valid drive update
- **AND** the car coasts to a stop and accepts control again when packets resume

### Requirement: Interchangeable playable crew
Each player SHALL be able to play as any of the eight supplied cottage crew designs using the existing textured skeletal models.

#### Scenario: Choose a character
- **WHEN** a player starts the map and presses C repeatedly
- **THEN** the revised skull-shirt body is the default and C cycles through all eight supplied designs, wrapping to the first
- **AND** the HUD identifies the current choice at 1280×720 and 1920×1080
- **AND** walking, sprinting, jumping, camera and shared progress remain usable

#### Scenario: Share and retain the appearance
- **WHEN** a client switches character on foot or while driving
- **THEN** all connected peers see the new choice for that player without changing another player's selection
- **AND** car occupancy stays valid and exiting restores the selected visible body
- **AND** an ongoing-session join receives the current appearance

### Requirement: Unified latest environment and gameplay
The local and streamed Linux game SHALL contain the imported Plateau environment together with Warden's current crew, 1970s fleet, campaign and driving behavior.

#### Scenario: Explore and play the merged release
- **WHEN** a player launches the local Linux package or the temporary browser player
- **THEN** the LaFontaine map includes the attributed Plateau park, surrounding street facades and landmarks
- **AND** authored Warden resident routes, interchangeable crew, traffic and car interactions remain usable
- **AND** the existing rescue and ordered race missions retain progress and isolated QA save/reload behavior.

#### Scenario: Preserve source and saves
- **WHEN** the environment is integrated and the packages are updated
- **THEN** the separate source project's files remain unchanged
- **AND** existing production save files remain byte-identical unless changed by actual player activity
- **AND** the native and browser packages use the same cooked content and executable.

#### Scenario: Review delivery quality
- **WHEN** the merged map is reloaded and rendered at supported desktop sizes
- **THEN** missing native classes, duplicate environment layers, collision failures and new rendered/performance failures are reported and fixed within scope
- **AND** recorded checks distinguish automated browser emulation from physical mobile and off-LAN testing.

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

### Requirement: QA-gated trailer and title page
The release SHALL publish a responsive title page and a new trailer captured from the integrated game after its automated release checks pass.

#### Scenario: Watch actual integrated gameplay
- **WHEN** release checks have passed and a player opens the title page
- **THEN** Play opens the existing player and Watch Trailer plays reviewed integrated-game footage
- **AND** the page works at desktop and phone sizes, identifies PC-host availability, and preserves the existing Arcade and API routes.
