# NORD seventies car art

## Purpose
Give the existing NORD fleet recognizable original 1970s-inspired exteriors while preserving its comic finish, tested gameplay and bounded verification evidence.

## Requirements

### Requirement: Recognizable seventies fleet
NORD SHALL render its existing starter, parked and circulating cars as original 1970s-inspired coupe, sedan and station-wagon designs in the established comic art direction.

#### Scenario: Read the three body profiles
- **WHEN** a player views the existing three fleet profiles from the front, rear and side/three-quarter at ordinary gameplay distance
- **THEN** the coupe shows a lower two-door cabin and separate hood/rear deck, the sedan shows an upright four-door cabin and trunk, and the wagon shows an extended roof, cargo glazing and tailgate
- **AND** body, window, roof and pillar geometry form a coherent distinct design for each profile, rather than only stretching the current hatchback cabin
- **AND** period-style chrome bumpers/trim, recessed grilles, round headlamps, distinct rear lamps, door details, rubber tires and steel-wheel/hubcap treatment remain readable
- **AND** the fleet retains restrained paint choices, dark glazing and its illustrated finish without changing global quality defaults

### Requirement: Cosmetic replacement preserves playable cars
The new car artwork SHALL use the existing vehicle/profile system while preserving its original artwork, campaign saves and multiplayer/browser controls. Current fitted collision and qualified curb parking follow the nord-car-contact capability.

#### Scenario: Enter and drive a period car
- **WHEN** a player approaches an available car, presses E, drives with W/S/A/D, uses Space and exits with E
- **THEN** the selected body and paint follow the vehicle while its wheels spin and steer correctly within aligned wheel arches
- **AND** the fitted chassis/cabin collision, original wheel centers, safe entry/exit, tested street-marking/curb traversal, wall blocking, handling and recovery behavior remain intact
- **AND** visual parts do not add blocking collision, detached pieces, tire intersections or unintended geometry obscuring the dark illustrated window panels

#### Scenario: Observe and share the existing fleet
- **WHEN** two players observe parked/traffic cars, take control of an eligible car, switch crew with C or disconnect
- **THEN** they share the same car profile, paint, movement and occupancy through the existing replication path
- **AND** existing traffic routes/yielding, traffic and pedestrian counts, saved map placements, held-input cleanup and campaign progress remain unchanged; runtime parked placements follow actual curbs
- **AND** the separate Plateau map/assets and production save files remain untouched

### Requirement: Verified rendered and packaged delivery
The car art pass SHALL have recorded source/native validation and reviewed rendered evidence before visual or browser delivery is accepted.

#### Scenario: Review and deliver the fleet
- **WHEN** the new native artwork is integrated and packaged
- **THEN** finite valid source geometry, profile bounds/materials and original wheel transforms and current fitted collision pass focused checks
- **AND** actual lit comic front, rear and side/three-quarter views of each profile at 1280×720 and 1920×1080 receive separate capture-completion and visual-quality verdicts, including on-street and driving context
- **AND** focused native component/handling checks, ordinary fixture-assisted entry/exit and package/browser media/input/reconnect checks pass with maps and save-file sets/hashes preserved
- **AND** current collision, traffic, replication and campaign behavior remains protected, while evidence distinguishes those preserved paths from a fresh full collision/occupancy/campaign suite or manual driving review
- **AND** rendered jobs use coordinated GPU ownership and the existing 12,000 MiB browser-host guard without weaker checks or changed quality defaults
- **AND** incomplete or unavailable checks remain explicitly pending rather than implied by a successful build
