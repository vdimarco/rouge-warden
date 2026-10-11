# battle-tanks Specification

## Purpose
A luminous dot/pixel 3D tactical tank campaign with independent hull and turret controls, physical cover, bounded weapon ranges, smoke and artillery. Players flank three guarded relays and reach extraction across three sectors, with safe progress separate from Afterlight.

## Requirements

### Requirement: Tactical tank variant
Battle Tanks SHALL be separately playable from Afterlight with real 3D terrain and cover, vehicle acceleration/hull steering, independent turret aiming, shell impacts and enemy tanks/emplacements. Players SHALL disable visible command relays and reach an extraction zone to complete a mission. Cover SHALL affect movement and firing instead of serving only as decoration.
#### Scenario: Fight from cover
- **WHEN** the player drives behind cover and aims the turret at an enemy
- **THEN** the hull and turret behave independently, cover blocks vehicles or shells as appropriate, and warned enemy fire permits a tactical response
#### Scenario: Complete a mission
- **WHEN** all required relays are disabled and the tank enters extraction
- **THEN** the mission completes and the next mission or final win is offered

### Requirement: Tank lifecycle and inputs
The variant SHALL support keyboard/pointer and reachable touch controls, deliberate start, pause/hide/switch, retry and safe separate progress saves. Both games SHALL fit desktop and portrait/landscape phones, link to one another, and retain accessible Classic.
#### Scenario: Pause and retry
- **WHEN** the tank mission is paused, hidden or lost
- **THEN** simulation freezes or a safe retry is available without corrupting other game saves

### Requirement: Movement is necessary for combat
Shell range SHALL be bounded to 70 world units and artillery range to 55. Out-of-range artillery SHALL show a clear cue without consuming its cooldown. Stationary bombardment from the starting position SHALL NOT clear every relay.
#### Scenario: Approach a distant relay
- **WHEN** the player targets a distant relay from the starting position
- **THEN** artillery is rejected until the player drives closer or flanks cover, while hull and turret remain independently controllable

### Requirement: Luminous dot battlefield
Battle Tanks SHALL preserve real perspective while presenting terrain, vegetation, vehicles, cover and effects as crisp luminous dots or pixel marks rather than solid low-poly slabs. Region silhouettes and warm/cool lighting SHALL provide layered depth and keep the player, warnings and targets recognizable. Afterlight SHALL retain its independent presentation.
#### Scenario: View and traverse the battlefield
- **WHEN** the player starts a mission and drives or turns the hull
- **THEN** dotted vehicles and layered scenery remain readable, nearby objects grow with perspective, turret aiming remains independent and the scene changes with traversal
#### Scenario: Use supported layouts
- **WHEN** playing at desktop, portrait phone or landscape phone dimensions
- **THEN** the picture fills the viewport with crisp point treatment, usable controls and no document overflow

### Requirement: Combat changes the battlefield
Movement and combat SHALL offer meaningful tactical advantages beyond stationary firing. Destroyed positions SHALL visibly transform into wrecks or restoration, with encounter consequences and readable rewards. Warnings SHALL communicate impending attacks. Existing bounded range, physical cover, extraction gates and safe saves SHALL remain.
#### Scenario: Fight and move
- **WHEN** the player moves between positions, engages enemies and disables a relay
- **THEN** movement provides an observable combat advantage and disabling the relay changes the visible world and encounter state without bypassing extraction

### Requirement: Movement-powered cannon and relay rewards
Actual traveled distance SHALL charge the next cannon shot, which deals double damage and can pierce one target while physical cover still stops it. Scouts, scatter tanks and bruisers SHALL have distinguishable warned attack patterns. Destroying a relay SHALL grant a short rapid-fire boost, clear nearby hostile shells, drop a repair collectible and leave a visible restored position. Existing saves SHALL restore with safe defaults for the added fields.
#### Scenario: Earn and spend a charged shot
- **WHEN** the player drives enough distance and fires
- **THEN** charge is consumed by a double-damage piercing shot, while turning in place or throttling against a wall cannot charge it
#### Scenario: Disable a relay
- **WHEN** a relay is destroyed once
- **THEN** its position changes visibly, its single repair drop can be collected, rapid fire lasts five seconds and repeated hits do not duplicate rewards
