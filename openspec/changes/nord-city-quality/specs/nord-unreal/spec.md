## ADDED Requirements

### Requirement: Detailed animated playable crew
The supplied playable characters SHALL retain readable facial details and distinct locomotion in the comic view.

#### Scenario: Inspect and move each character
- **WHEN** a player cycles all eight bodies, walks, sprints, jumps and lands
- **THEN** all bodies use their matching idle, walking, running and jump/landing clips
- **AND** running has a distinct leg/arm stride and airborne poses reflect ascent/descent followed by landing recovery
- **AND** character texture details remain visible without halftone or normal-edge ink obscuring eyes and mouths
- **AND** movement and appearance remain replicated and supported HUD layouts remain readable

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
