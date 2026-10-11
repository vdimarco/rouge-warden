## ADDED Requirements
### Requirement: Real spatial action depth
Afterlight action SHALL use real perspective 3D geometry with terrain, depth occlusion, camera tracking and layered cinematic lighting. Pointer aiming SHALL map through a ground-plane raycast. The full-screen scene SHALL retain golden/cyan/emerald/violet direction and readable character/threat silhouettes. Unsupported WebGL SHALL show a recoverable startup message.
#### Scenario: Traverse depth
- **WHEN** the courier walks toward and away from the camera through scenery
- **THEN** projection, parallax, occlusion and apparent size change according to 3D positions rather than a flat background
### Requirement: Tactical rescue combat
Players SHALL break visible survivor tethers before escorting those survivors, manage weapon heat, and use an interrupting pulse with a cooldown. Threats SHALL communicate attack timing and provide reasons to move, target and time actions. Existing saves SHALL reconstruct safely without losing restored worlds.
#### Scenario: Free a survivor
- **WHEN** the player destroys a tether and approaches its survivor
- **THEN** that survivor can follow to safety and rescue progress increases only after delivery
#### Scenario: Pace and interrupt
- **WHEN** sustained fire overheats the weapon or the player triggers a pulse near a warned attack
- **THEN** firing pauses for recovery or the attack is interrupted with readable feedback and a cooldown

## MODIFIED Requirements

### Requirement: Game engine runtime
Afterlight SHALL use a locally served Three.js perspective renderer for the default action adventure and retain the locally served Phaser engine for Classic, without a runtime CDN dependency.
#### Scenario: Load the adventure
- **WHEN** the player opens Afterlight
- **THEN** a real perspective scene starts with working movement, raycast aiming and clear controls, while Classic remains independently playable

### Requirement: Bounded cinematic rendering
The action renderer SHALL bound GPU render resolution and reuse scene geometry while animating gameplay objects independently. Resizing SHALL preserve a full-viewport picture and consistent raycast aiming coordinates.
#### Scenario: Change render resolution
- **WHEN** the viewport or bounded render target changes size
- **THEN** the world covers the viewport, projected objects align with raycast aiming, and the HUD remains readable
