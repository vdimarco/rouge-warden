## ADDED Requirements

### Requirement: Playable Toronto district
The game SHALL support the surveyed College/Bathurst district as a separate playable location with district-correct identity, recovery, driving and navigation, while retaining Montréal behavior and save data.

#### Scenario: Create a new district safely
- **WHEN** required geometry, materials or native classes are missing, or an existing Toronto map would be overwritten
- **THEN** authoring rejects the request before map/asset mutation
- **AND** a valid fresh offline run creates only the new district packages and preserves every protected Montréal identity.

#### Scenario: Explore College Street
- **WHEN** a player starts College/Bathurst
- **THEN** they spawn on the surveyed Sneaky Dee’s sidewalk and can walk west through Euclid to Grace Street and enter/drive/exit the starter car
- **AND** the HUD/radar identify Toronto and its own mapped streets and attribution at 1280×720 and 1920×1080
- **AND** falling or vehicle recovery returns to the Toronto district instead of Montréal coordinates.

#### Scenario: Preserve Montréal progression
- **WHEN** a player explores Toronto or returns to Montréal
- **THEN** Toronto free roam does not start Montréal missions or read/write its campaign slot
- **AND** Montréal keeps its existing objectives, controls, selection, private F2, driving, saves and co-op behavior.

#### Scenario: Recognize the landmark
- **WHEN** the College/Bathurst corner is viewed in the native game
- **THEN** sourced Sneaky Dee’s frontage/signage and the College/Bathurst streets form a readable landmark without blocking the surveyed sidewalk, spawn, car or streetcar clearance
- **AND** surveyed facts, artistic estimates and source licences are recorded separately from final likeness acceptance.

#### Scenario: Deliver an explicit location build
- **WHEN** a tested multi-map build or location launcher is produced
- **THEN** both required maps/dependencies load through explicit supported routes with current native correctness/rendered checks
- **AND** existing live package/saves/tunnels remain preserved unless a separately tested update is published, and editor/stream measurements do not substitute for packaged or physical-device acceptance.

### Requirement: Bounded Montréal expansion
The game SHALL open the retained 200-metre eastern surveyed context as an additive extension while preserving existing Montréal gameplay and authored geography.

#### Scenario: Cross the former district edge
- **WHEN** a player walks or drives along a mapped street through the former eastern boundary
- **THEN** the former invisible wall and decorative closure no longer interrupt travel, collision ground supports the extension and the radar includes its surveyed streets
- **AND** the outer perimeter contains the player, existing mission/crew/spawn/resident locations and save behavior remain intact, and original map recovery is retained.
