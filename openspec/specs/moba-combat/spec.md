# Monster Mash bases and basic attacks

### Requirement: Larger distinct bases
Each team SHALL have a paved court larger than the old base ring and a core building distinct from lane towers and the opposing base. The visible inner court SHALL match the healing area.

#### Scenario: View and heal at home
- **WHEN** a damaged allied creature stands inside the inner court
- **THEN** the creature receives base healing and the core, health bar and attack target remain visible.

#### Scenario: View on supported layouts
- **WHEN** either base is rendered at 390x844, 844x390 or 1440x900
- **THEN** its central building fits the map edge and its team has a distinct silhouette.

### Requirement: Three basic attacks
Each creature SHALL have three named automatic attacks with different motion and impact effects. Three landed attacks SHALL retain the prior average damage and apply existing item hit effects.

#### Scenario: Continue a duel
- **WHEN** a creature lands successive attacks on one target
- **THEN** its attack variants cycle one, two, three, one and each strike shows damage at its contact pose.

#### Scenario: Break the sequence
- **WHEN** an attack misses, the creature dies, it changes target or it waits longer than two seconds
- **THEN** its next basic attack starts with the first variant.

#### Scenario: Use existing controls
- **WHEN** a player moves with the touch pad or keyboard and casts an existing skill
- **THEN** movement and casting remain available during the automatic attack sequence.

### Requirement: Mouse attack orders
Clicking a visible hostile creature SHALL select it, move the player into attack range through passable terrain, and attack it using the existing cooldown and combo rules. The selected target SHALL show a ring and its name in the HUD while approached.

#### Scenario: Attack from outside range
- **WHEN** the player clicks a visible enemy beyond basic attack range
- **THEN** the hero approaches, stops within range and attacks the selected enemy.

#### Scenario: Cancel or replace a chase
- **WHEN** the player moves with keys or the pad, presses Space, clicks open ground, recalls, pauses, dies or loses sight of the enemy
- **THEN** the attack chase ends and the next command takes priority.

#### Scenario: Respect cover and neutral camps
- **WHEN** terrain blocks the direct route or a resting camp is selected
- **THEN** pursuit routes around the terrain and only the selected resting camp is attacked.

### Requirement: Imported neutral artwork
Available free MagicPixel sprites SHALL be stored locally with source metadata and displayed as neutral guardians with health bars and target hitboxes. Existing procedural creatures SHALL remain the fallback for unavailable sprites.

#### Scenario: View and select an imported guardian
- **WHEN** a guardian with imported artwork appears
- **THEN** its sprite, health bar and click target align and its existing camp rules apply.
