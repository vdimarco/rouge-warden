# battle-tanks Specification

## Purpose
A real 3D tactical tank campaign with independent hull and turret controls, physical cover, bounded weapon ranges, smoke and artillery. Players flank three guarded relays and reach extraction across three sectors, with safe progress separate from Afterlight.

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
