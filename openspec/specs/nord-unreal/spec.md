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
The LaFontaine map SHALL start in the realistic render. Each player SHALL be able to enable an animated comic-book style with F2, with ink outlines, flat colour bands, halftone dots, hatching in deep shadow and offset print plates, without using characters, suits or logos from any film.

#### Scenario: Start in standard view
- **WHEN** a player joins the LaFontaine map
- **THEN** their comic filter is disabled and character animation updates at full rate
- **AND** another player's look setting remains independent

#### Scenario: See the comic look on foot
- **WHEN** a player enables comic view near 1334 Rue Sherbrooke Est in a 1280 by 720 or larger desktop window
- **THEN** building and tree silhouettes have dark ink outlines
- **AND** shaded areas show a regular halftone dot pattern
- **AND** distant objects show red and blue plates offset from each other

#### Scenario: Switch the look
- **WHEN** the player presses F2 from standard view
- **THEN** the comic look is enabled for that player only
- **AND** pressing F2 again restores the realistic render

#### Scenario: Drive with the look
- **WHEN** the player enters the car
- **THEN** the car camera keeps the player's current look setting

### Requirement: Smooth character animation
Playable crew and visible ambient residents SHALL update their poses with their active animation updates in both standard and comic views, without deliberate 12 Hz holds or animation-clock quantization. Movement and camera SHALL remain continuous; enabling the comic filter SHALL NOT impose a lower pose cadence. This requirement does not promise a fixed render or stream frame rate.

#### Scenario: Watch the character run
- **WHEN** the player runs or observes a moving resident in either render mode
- **THEN** the animation clock advances without deliberate held steps while ground movement remains continuous
- **AND** pressing F2 changes the local look without reducing the character's pose-update cadence or another player's rendering

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
- **WHEN** a viewport-shaped mobile game stream is displayed in 360×800 portrait, 800×360 landscape or 800×360 / 667×375 landscape fullscreen with touch controls
- **THEN** decoded video retains the objective, contextual feedback, speed and geographic attribution without cropping or collision with touch controls in the reviewed layouts
- **AND** mobile fullscreen fills the viewport with the complete native frame at the play-area aspect ratio, without stretching or cropping; orientation transitions may briefly letterbox the previous frame
- **AND** fullscreen touch targets remain clear of native HUD regions and one another with minimum dimension 44 px while portrait/non-fullscreen layouts, desktop presentation and input behavior remain usable
- **AND** recorded results distinguish browser emulation from physical-phone and off-LAN testing.

### Requirement: QA-gated trailer and title page
The release SHALL publish a responsive title page and a new trailer captured from the integrated game after its automated release checks pass.

#### Scenario: Watch actual integrated gameplay
- **WHEN** release checks have passed and a player opens the title page
- **THEN** Play opens the existing player and Watch Trailer plays reviewed integrated-game footage
- **AND** the page works at desktop and phone sizes, identifies PC-host availability, and preserves the existing Arcade and API routes.

### Requirement: Retained Montréal environment appearance polish
The integrated game SHALL improve mapped tree and supported street/perimeter building appearance while preserving its comic direction, geographic source data, current gameplay and saved progress. Visual acceptance SHALL use fresh native and packaged evidence rather than asset assignments alone.

#### Scenario: Read the spawn street
- **WHEN** a player looks along Sherbrooke and toward the park at 1280×720 or 1920×1080
- **THEN** foliage retains readable colour and crown layers instead of becoming a dense black stippled screen
- **AND** brick scale, doors, cream trim, exterior stairs, pavement and road markings remain readable without missing materials or depth flicker.

#### Scenario: Inspect retained trees near and far
- **WHEN** the same mapped trees are inspected close, at middle distance, far away and against the light in comic and F2 views
- **THEN** cutout leaves, branch attachment and crown coverage remain coherent without opaque cards, checkerboard fallback, disappearing crowns or new ink halos
- **AND** the 4,571 mapped tree transforms, count, source geometry and component collision remain unchanged
- **AND** the report identifies retained crown/species repetition and distinguishes static-image acceptance from observed temporal stability.

#### Scenario: Read park and pond context
- **WHEN** matched walking-height views show the south pond, north pond and chalet/theatre surroundings at both supported desktop sizes
- **THEN** affected tree and building surfaces retain distinguishable colour, depth and silhouettes in the reviewed comic/F2 states
- **AND** sky/clouds and smooth pond reflections retain continuous light gradients while rough ground, vertical glass, foliage and crew preserve their intended comic treatment
- **AND** pond, path, court and landmark placement, geographic attribution and known flat-terrain limits remain preserved and honestly described.

#### Scenario: Inspect illustrated building surfaces
- **WHEN** a player approaches existing residential/shop fronts, exterior stairs and affected perimeter shells
- **THEN** supported masonry, openings and trim read clearly without floating or duplicated art, planes crossing shell gaps, stair intersections or z-fighting
- **AND** raw source footprints, roof geometry and height data are preserved, with the separately specified Le Neuville and École Le Plateau visual corrections using their retained municipal surveys
- **AND** duplicate fallback shells/window cards for only OSM `27395533` and `355385456` are removed from the visible layer through filtered owned copies, preserving all unaffected faces and hiding only exact recorded original NoCollision rendering components
- **AND** only those seven sources receive the manifest's hidden-in-game, shadow and indirect/distance-field lighting render-state changes; every other recorded original actor field and gameplay collider remains unchanged
- **AND** the 65 cornice closures and side skins remain nonblocking and attached; side coverage is confined to OSM `356350796` edges 1/2, `345835052` edge 4 and `356350765` edge 2
- **AND** estimated decorative detail is identified as artwork rather than surveyed façade reconstruction.

#### Scenario: Correct Le Neuville's fallback visual massing
- **WHEN** Rachel skyline and walking-height modern-façade views show Le Neuville at 1101 Rachel Est in comic and F2 at both supported sizes
- **THEN** OSM building `355385456` uses the retained municipal `2317003` survey-derived exterior with its measured 57.44 m vertical extent instead of the old 9.6 m fallback visual massing
- **AND** its old low-rise visual shell and generic three-storey façade do not remain as duplicate rendered layers
- **AND** raw OSM/municipal inputs, the original gameplay collider and other buildings' geometry remain preserved
- **AND** source-match evidence is recorded without claiming exact Street View artwork, playable upper floors or interiors.

#### Scenario: Correct École Le Plateau's fallback visual massing
- **WHEN** fresh exterior views show École Le Plateau in comic and F2 at both supported sizes
- **THEN** OSM building `27395533` uses the retained municipal `2316935` survey-derived exterior, including its approximately 20.88 m main walls, lower wing and 24.02 m maximum roof extent, instead of the old 9.6 m fallback visual massing
- **AND** its U-shaped plan, roof and estimated classroom glazing/masonry remain coherent without missing materials or a duplicate generic low-rise front
- **AND** raw OSM/municipal inputs, original municipal assets and the original gameplay collider remain preserved
- **AND** the report distinguishes survey massing from estimated façade artwork and provides no upper-floor or interior-access claim.

#### Scenario: Preserve district boundaries and movement
- **WHEN** the player approaches the Panet or Visitation closure or travels the existing walking/driving routes
- **THEN** closures and gameplay bounds remain readable and unchanged
- **AND** added cosmetic detail remains nonblocking and existing ground, gallery, body-clearance, marking and curb checks pass.

#### Scenario: Preserve integrated gameplay and saves
- **WHEN** the refreshed environment is loaded for native mission and interaction regression
- **THEN** existing crew, cars, road graph, population, HUD, private/shared feedback and supported mission progression retain their intended behavior
- **AND** isolated QA saves/settings are restored and protected production progress/source files retain their recorded identity.

#### Scenario: Verify current cooked materials and budget
- **WHEN** the refreshed Linux packages are rebuilt and tested
- **THEN** all non-save local/browser package files match and the existing separate-process dependency/render checks pass
- **AND** all six existing Sherbrooke/Pond/NorthPark Epic/100% measurements at 720p and 1080p retain p95 frame times below 16.67 ms using the unchanged warmed CSV method
- **AND** a failing result remains recorded until its cause is fixed without reducing production quality or weakening the gate.

#### Scenario: Restore the existing browser service
- **WHEN** the owned graphics/editor/package jobs finish and the unchanged 12,000 MiB free-VRAM preflight passes
- **THEN** the normal browser host is restored through its existing lifecycle with QuickTunnel/TURN and unrelated applications preserved
- **AND** fresh real two-player media/input and mobile-emulated checks pass with current decoded graphics and HUD inspected
- **AND** results distinguish these checks from physical-phone, off-LAN, acoustic and subjective gameplay acceptance.

### Requirement: Reactive neighborhood residents
Visible residents SHALL acknowledge nearby calm players and warn drivers of fast approaching occupied cars, with original Québec French captions and bounded cooldowns. Reactions SHALL pause and face the player without leaving the authored route or jumping along it on resume. Ambient captions SHALL preserve private dialogue and briefing reading time.

#### Scenario: Greet and talk
- **WHEN** a slow walking player approaches an unobstructed visible resident after the greeting cooldown
- **THEN** a brief private greeting may appear when no private caption or campaign briefing is active
- **WHEN** the player presses E to talk
- **THEN** the resident faces the player briefly and the existing private dialogue takes priority
- **AND** the route resumes continuously and the other player's caption remains unchanged

#### Scenario: Warn an approaching car
- **WHEN** an occupied fast car approaches a visible resident within the warning distance
- **THEN** the resident pauses, faces the driver and issues a cooldown-limited private warning
- **AND** parked, driverless, departing, distant and slow cars do not cause warnings
- **AND** reaction placement and animation state agree on both peers

### Requirement: Semantic activity feedback
Successful native campaign steps and ordered race checkpoints SHALL play short original progress cues on connected peers; successful finishes SHALL play a distinct completion cue. Rejected actions, retries, late joins and save reloads SHALL NOT replay historical success sounds. All essential feedback SHALL remain visible without audio.

#### Scenario: Progress and replay
- **WHEN** a valid step or ordered checkpoint advances authority state
- **THEN** connected players receive one corresponding progress/completion sound without parsing HUD text
- **AND** attempts to skip a gate do not produce a success cue
- **WHEN** T starts a replay and the race is completed again
- **THEN** completion feedback occurs again while both completed story scenes remain saved

### Requirement: Shared session lap results
Race completion SHALL show the last elapsed result and the session's best clean lap on both peers. Recovery-assisted runs SHALL be labelled and excluded from the clean best. Results SHALL survive T replay during that session without changing the version-1 mission-boundary save format.

#### Scenario: Compare completed laps
- **WHEN** a clean lap finishes and a faster clean replay finishes
- **THEN** both peers show the new last time and improved session best
- **WHEN** a slower or recovery-assisted replay finishes
- **THEN** the session best remains intact
- **AND** no time is fabricated after a fresh join to a saved completed campaign

#### Scenario: Read supported layouts
- **WHEN** the result or a resident caption appears at 1280×720, 1920×1080 or a supported tall phone frame
- **THEN** the existing wrapping and caption layout keep objectives, radar and touch controls readable

### Requirement: Hidden residents retain simulation without invisible pose work
Crew-duplicate residents hidden by the existing visibility rules SHALL retain authoritative route/reaction state while skipping local visual pose evaluation, and SHALL resume the current animation pose when visible again.

#### Scenario: Hide and show a moving crew resident
- **WHEN** a player wears a moving resident's crew style and later switches away
- **THEN** the hidden resident continues its authoritative route while its pose remains unevaluated
- **AND** the first visible tick updates its pose to the current route clock
- **AND** visible residents retain their existing animation cadence and interaction behavior.
