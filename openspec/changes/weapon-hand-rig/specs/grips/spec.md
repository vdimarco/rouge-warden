## ADDED Requirements
### Requirement: Attached aiming grip
Ranged weapons SHALL retain a fixed hand-local grip while the character's arms aim them toward the camera direction.
#### Scenario: Aim up and down
- **WHEN** a standing or moving character aims a ranged weapon
- **THEN** the wrist and weapon rotate together without changing arm lengths
- **AND** the support hand follows the rifle fore-end or pistol grip

### Requirement: Smooth aim and physical muzzle
Visual aiming SHALL converge smoothly across frame rates, and shot effects SHALL originate at the weapon's muzzle.
#### Scenario: Camera movement and firing
- **WHEN** the camera direction changes
- **THEN** the arm pose smoothly approaches that direction
- **WHEN** the player fires
- **THEN** the weapon aligns to the shot and its muzzle emits the tracer
#### Scenario: Muzzle through cover
- **WHEN** a wall separates the character's chest from its muzzle
- **THEN** the shot cannot damage targets beyond the wall
