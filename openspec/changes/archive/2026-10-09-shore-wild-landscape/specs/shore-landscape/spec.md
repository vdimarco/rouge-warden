## ADDED Requirements

### Requirement: Major highland relief
The 3D arena SHALL show broad hills with at least 900 world units of off-lane elevation range. Dry side lanes SHALL climb at least 300 world units between defenses. Landforms SHALL mirror across the team axis, while river beds, bridge approaches and defense footprints retain their required surfaces.

#### Scenario: Leave the base
- **WHEN** a player travels along either side lane
- **THEN** the road visibly climbs into high ground and descends toward the river, with level defenses and open crossings.

#### Scenario: Stand beneath a hill
- **WHEN** a nearby crest would hide the camera's ground target
- **THEN** the follow camera lifts enough to keep its target selectable, while flat ground retains the normal lens.

### Requirement: Rock bluffs and cave mouths
Existing cover islands SHALL show tall rock faces with stepped strata, hollow cave entrances, shaded interiors and floors grounded to the sampled terrain. Rock geometry SHALL fit existing collision cover in both realms and SHALL use the hero visibility shader.

#### Scenario: Approach a cave
- **WHEN** a player approaches a rock cover island
- **THEN** a recessed cave mouth appears in natural rock with visible depth and a dark rear, decorative crowns leave its approach clear, and the shared obstacle still defines the approach limit.

#### Scenario: Fight beside a cliff
- **WHEN** a rock face stands between the camera and a visible hero
- **THEN** the visibility cutout exposes the hero and the combat controls keep their current behavior.

### Requirement: Mature clustered forest
Groves SHALL contain larger, denser groups of varied tree crowns with clear routes and camp pads. Tree placement SHALL be deterministic for a match seed and instance counts SHALL remain bounded.

#### Scenario: Enter the woods on a phone
- **WHEN** the player enters a grove in a portrait viewport
- **THEN** mature tree groups frame the hills, the player remains readable through crowns, and movement and skill aim follow the rendered ground.
