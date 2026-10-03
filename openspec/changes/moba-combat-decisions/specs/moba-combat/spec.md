## ADDED Requirements

### Requirement: Independent control effects
Roots SHALL prevent voluntary movement and movement spells while preserving non-movement spells and basic attacks. Stun SHALL block actions, silence SHALL block spells and disarm SHALL block basic attacks. Control descriptions and rendered labels SHALL match the rules.

#### Scenario: Answer while rooted
- **WHEN** a rooted hero attempts to move, blink, attack and cast a non-movement ability
- **THEN** movement and blink fail without spending resources, while legal attacks and spells work.

### Requirement: Committed major attacks
Selected high-impact gameplay casts SHALL show a warning before resolution and a brief commitment. Directional attacks SHALL lock their geometry; entity-targeted attacks SHALL retain their selected creature and show its marker. Interrupting an unresolved cast SHALL spend no mana or cooldown. Quick defensive spells SHALL remain responsive. Basic attack rhythms SHALL vary by hero while preserving average damage and attack rates.

#### Scenario: Dodge and punish a major cast
- **WHEN** a hero starts a committed directional attack and its opponent leaves the shown shape
- **THEN** the attack follows the original aim, the opponent avoids it, and the attacker has a brief recovery window.

#### Scenario: Interrupt before contact
- **WHEN** an unresolved cast is interrupted by death, stun, fear, silence or forced displacement
- **THEN** its warning clears, the spell does not resolve, and its mana and cooldown remain unspent.

#### Scenario: Retain a spell target
- **WHEN** another creature crosses the aimed point during an Omen or Soul thread commitment
- **THEN** the spell remains assigned to its originally selected creature, and fails without resource spend if that creature leaves range or sight before impact.

### Requirement: Varied readable encounters
Neutral special attacks SHALL show their actual affected shape, lock aim and provide recovery after impact. Bots SHALL have bounded reaction delay and use opportunities to cooperate around objectives while retaining defensive responses.

#### Scenario: Evade a neutral attack
- **WHEN** a guardian warns a special attack and the player leaves its shape
- **THEN** the special misses that player and the guardian enters a visible recovery period.

#### Scenario: React and cooperate
- **WHEN** a bot sees a new warning or a contestable objective with allied support
- **THEN** its warning response begins after a bounded delay, and its team can approach the shared objective without overriding a needed retreat.
