## ADDED Requirements

### Requirement: Detailed animated playable crew
The supplied playable characters SHALL retain readable facial details and distinct locomotion in the comic view.

#### Scenario: Inspect and move each character
- **WHEN** a player cycles all eight bodies, walks, sprints, jumps and lands
- **THEN** all bodies use their matching idle, walking, running and jump/landing clips
- **AND** running has a distinct leg/arm stride and airborne poses reflect ascent/descent followed by landing recovery
- **AND** character texture details remain visible without halftone or normal-edge ink obscuring eyes and mouths
- **AND** movement and appearance remain replicated and supported HUD layouts remain readable

### Requirement: Relaxed default crew expressions
The eight supplied crew designs SHALL have relaxed static default expressions while preserving recognizable identities, outfits and the established comic direction.

#### Scenario: Inspect a resting character
- **WHEN** a player views any crew member at conversation distance in the ordinary comic view at 1280×720 or 1920×1080
- **THEN** the face has resting brows/lids and a comfortably closed or softly parted mouth, without an exaggerated fixed toothy grin, grimace or startled stare
- **AND** individual facial proportions, skin tone, hair/facial hair, eyewear/headwear, outfit and accessories remain recognizable from the retained supplied design
- **AND** original source data remains immutable, original Unreal assets remain recoverable and the replacement's reference, generation and import provenance are retained

#### Scenario: Accept a relaxed-expression replacement
- **WHEN** the neutral-reference skull-shirt pilot is captured as the actual possessed pawn in unobstructed front and three-quarter views at both supported sizes
- **THEN** native rendered identity and relaxed expression pass visual review before the remaining crew is regenerated
- **AND** idle, walk, run, airborne and landing use intact matching body poses without movement/root regressions
- **AND** each subsequent replacement receives native face review at both sizes before the complete crew is accepted

### Requirement: Populated mapped district
The neighborhood SHALL contain additional parked cars, moving traffic and pedestrians distributed through the district.

#### Scenario: Explore the streets and park
- **WHEN** the map starts and a player explores the mapped roads and paths
- **THEN** at least 32 additional parked cars, 16 moving traffic cars and 96 additional walkers populate valid ground routes
- **AND** traffic follows connected roads, yields to obstructions and becomes player-controlled only at a safe speed
- **AND** peers observe the same population and original controls/objectives remain usable

### Requirement: Recognizable park district appearance
Environment improvements SHALL preserve municipal building massing and mapped park geometry while improving its comic rendition.

#### Scenario: Inspect reference views
- **WHEN** the Sherbrooke streets, ponds, chalet and theatre are rendered at 1280×720 and 1920×1080
- **THEN** mature irregular canopy replaces repeated balloon crowns and masonry has subdued varied brick/stone detail
- **AND** two-pond/path arrangement, survey roofs/footprints and tree XY positions remain preserved
- **AND** primary reference sources and estimated facade/landmark details are documented without claiming identical Street View geometry

## MODIFIED Requirements

### Requirement: Textured cottage crew
The eight supplied cottage characters SHALL use complete textured skeletal models with recognizable face, hair, clothing and accessories and relaxed default expressions, in the established comic art direction.

#### Scenario: Inspect the crew
- **WHEN** the eight residents are viewed at conversation distance and in the 1600 by 900 lineup
- **THEN** all eight render with textured complete bodies and distinct reference outfits, correctly grounded and without missing materials
- **AND** original source models and generation provenance remain retained alongside versioned replacements

#### Scenario: Walk and talk online
- **WHEN** a client joins a host and approaches a crew member with E
- **THEN** the resident walks using the imported animation, movement replicates and only the interacting player sees the existing caption
- **AND** existing car controls and mission state are preserved

#### Scenario: Revised skull-shirt likeness
- **WHEN** the skull-shirt resident is viewed in the saved face close-up
- **THEN** his short tousled hair, short beard/moustache and facial proportions remain recognizable from the supplied face illustration, with a relaxed resting mouth and brows
- **AND** his black graphic shirt, teal palm shorts and bare feet remain recognizable

### Requirement: Interchangeable playable crew
Each player SHALL be able to play as any of the eight supplied cottage crew designs using versioned textured skeletal models with matching body animation clips.

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
