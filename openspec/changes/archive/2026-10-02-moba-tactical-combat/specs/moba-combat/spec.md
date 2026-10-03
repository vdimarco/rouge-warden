## ADDED Requirements

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
