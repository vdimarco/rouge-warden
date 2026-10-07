## ADDED Requirements

### Requirement: Ranged basic attack reach
A ranged hero's basic attack SHALL reach clearly farther than a melee hero's, and SHALL look like a shot that travels from the hero. Wards and the core SHALL keep a longer reach than any hero's basic attack against them.

#### Scenario: Attack from range
- **WHEN** a ranged hero orders an attack on an enemy at 90% of its reach
- **THEN** the hero attacks without moving
- **AND** a bolt travels from the hero to the target and lands as the hit resolves

#### Scenario: Melee reach is unchanged
- **WHEN** a melee hero attacks
- **THEN** its reach is still 140 to 160 units, and no bolt is drawn

#### Scenario: Wards out-range heroes
- **WHEN** a ranged hero attacks a ward or the core
- **THEN** the hero must stand inside the structure's own reach to hit it
