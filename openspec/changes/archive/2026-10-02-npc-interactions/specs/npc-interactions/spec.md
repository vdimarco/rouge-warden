## ADDED Requirements

### Requirement: Collectible police sidearms
Defeated police and sheriff deputies SHALL drop their held pistol once. The pistol SHALL visibly fall onto the local ground and offer the existing interaction control to collect and equip it with ammunition. Drops SHALL survive the officer being despawned and clean up on session exit.

#### Scenario: Defeat and loot
- **WHEN** melee or a takedown defeats an armed officer
- **THEN** the hand becomes empty and one pistol lands nearby
- **WHEN** the player interacts with the landed pistol
- **THEN** it disappears, the pistol is equipped and ammunition is available without duplicate collection

### Requirement: Visible carjacking
Driver entry into an occupied slow or stopped car SHALL open the door, animate the player reaching in and pulling the driver out, throw the driver onto clear ground, then seat the player and close the door. Empty vehicles SHALL open their doors for normal entry. Passenger rides SHALL preserve their driver. Driving SHALL remain disabled until entry completes.

#### Scenario: Pull a driver out
- **WHEN** the driver-door interaction is used on occupied traffic, police or a scripted car
- **THEN** the driver is visible moving from the seat through the open doorway and landing outside
- **AND** the vehicle controller stops and the player receives control after the sequence

#### Scenario: Interrupt and reset
- **WHEN** the vehicle is removed or the session ends during entry
- **THEN** no temporary actor, open-door animation or control lock leaks into the next session

### Requirement: Improved animated NPC models
Police, sheriffs and both civilian archetypes SHALL use locally stored fal-generated textured humanoids with the existing skeletal animation and prop system. Missing assets SHALL retain procedural fallback. Each local model SHALL remain below 1.4 MB and 9,000 triangles, use at most a 1024px diffuse map, and retain its silhouette at low quality. The new anatomies SHALL be checked against their own bind poses, with finite animation tracks and no root drift; existing original-body proportional checks SHALL remain intact. Models SHALL render with finite poses during walking, fighting, sitting and falling on desktop and landscape touch layouts.

#### Scenario: Model verification
- **WHEN** the four archetypes are loaded
- **THEN** each has a valid skinned skeleton, visible textured geometry, working animation and a documented generation source
- **AND** screenshots at desktop and phone sizes show the intended uniforms, faces and clothing
