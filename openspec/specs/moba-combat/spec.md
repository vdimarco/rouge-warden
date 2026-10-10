# Monster Mash bases and basic attacks

## Purpose
In Shore of the Ancients, two teams of three heroes fight across a large arena to destroy the enemy core. A click on an enemy sends the player's hero to chase it and hit it with a repeating chain of three attacks. Both towers in one lane must fall before the core takes damage.

## Requirements

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

### Requirement: Expanded two-stage arena
The arena SHALL be 6400 units square. Each lane SHALL have an outer and inner tower for each team. The inner tower SHALL remain protected until its lane's outer tower falls, and the core SHALL unlock only after one lane loses both towers. World paths, river, terrain, camps, portals, scenery and maps SHALL use the same dimensions.

#### Scenario: Break a lane
- **WHEN** a player attacks the inner tower before its outer tower falls
- **THEN** it takes no damage, targeting excludes it, and the HUD explains the outer objective.
- **WHEN** the outer tower and then its inner tower fall
- **THEN** the next stage becomes vulnerable and the HUD directs the player to it.

### Requirement: Clear match flow
Players SHALL begin behind their allied outer towers and receive a clear next objective. Map destinations SHALL issue actual movement or attack orders after the map closes. The camera SHALL keep the player and forward action visible while following movement smoothly.

#### Scenario: Enter the arena
- **WHEN** the player starts a match
- **THEN** the hero begins in a supported lane position, can learn a skill, and can follow a map route to the next vulnerable enemy tower.

#### Scenario: Follow a map route
- **WHEN** the player selects a destination on the tactical map
- **THEN** the map closes and the hero moves to it or pursues the selected vulnerable tower, while manual movement can cancel the route.

### Requirement: Tactical combat decisions
Bots SHALL use hero-specific combinations, keep suitable attack distance, evade hostile damaging fields and use defensive spells when threatened. Offensive bot casts SHALL show a fixed warning before impact and SHALL be interrupted by death, stun, fear or silence.

#### Scenario: Evade or interrupt a cast
- **WHEN** an enemy prepares a warned spell
- **THEN** its area or direction is visible, moving outside it avoids the hit, and disabling the caster cancels the pending spell.

### Requirement: Spell resources
Every hero SHALL have mana, distinct spell costs and regeneration. A failed cast SHALL spend neither mana nor cooldown. Respawn and the home court SHALL restore mana.

#### Scenario: Plan a combination
- **WHEN** a trained hero casts skills in sequence
- **THEN** each successful cast spends its shown cost; insufficient mana blocks casting while basic attacks and training remain available.

### Requirement: Lane and tower pressure
Wisp experience SHALL go to living nearby allied heroes. A hero who lands the finishing hit SHALL earn extra embers. Consecutive tower attacks on one hero SHALL grow stronger and reset after the hero disengages.

#### Scenario: Farm and disengage
- **WHEN** a hero finishes a lane wisp and stays under hostile tower fire
- **THEN** finishing gold is visible, nearby allies gain experience, distant heroes gain none, and repeated tower hits punish staying in range.

### Requirement: Stable selected target
Manual selection SHALL persist while the player moves directly. Movement SHALL end pursuit, and SHALL NOT silently replace a selected wisp with an enemy hero. Selected targets SHALL clear on explicit stop, Recall, death or lost sight.

#### Scenario: Move while attacking a wisp
- **WHEN** a player selects a visible wisp near an enemy hero and then moves with keys, the pad or a battlefield drag
- **THEN** pursuit ends, the selected wisp remains selected, attacks in range use it and releasing movement does not restart pursuit.

#### Scenario: Lose or cancel a target
- **WHEN** the target dies, leaves team sight or the player explicitly stops or Recalls
- **THEN** selection clears and normal automatic targeting can resume without revealing hidden units.
