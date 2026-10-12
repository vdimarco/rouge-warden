## ADDED Requirements

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
