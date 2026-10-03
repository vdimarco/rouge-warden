# Shore of the Ancients hero roster

### Requirement: Twelve combat archetypes
The game SHALL preserve twelve tested combat archetypes with distinct statistics, basic attacks and four learned spells. Bots SHALL use the full set of archetypes. Display identities SHALL not change spell dispatch, mana, cooldowns, rank gates or combat randomness.

#### Scenario: Play every combat archetype
- **WHEN** every archetype plays a seeded match
- **THEN** the match finishes, entities stay finite and learned spells follow the existing level gates.

#### Scenario: Assign a visual identity
- **WHEN** an identity is assigned to a player or bot
- **THEN** the numeric combat archetype remains unchanged and bot appearance comes from identities that use that archetype.

### Requirement: Sixteen reference hero identities
The selection SHALL offer Tidewarden, Embersong, Voidcaller, Stoneheart, Skyreaver, Irontide, Moonweaver, Dredge, Glasshand, Salt Priestess, Riftblade, Coral Sage, Nightcurrent, The Marrow, Bloodwake and Zephyrs. Each identity SHALL resolve to a tested combat archetype and have source-matched selection artwork. Skill names SHALL follow the identity while descriptions explain its actual assigned mechanics.

#### Scenario: Start with a selected identity
- **WHEN** a player selects a reference hero and starts a match
- **THEN** the battle, HUD and spellbook retain that identity while spells use its assigned archetype.

#### Scenario: Return to selection
- **WHEN** a player ends or leaves a match
- **THEN** the selected reference identity remains selected and can be changed.

#### Scenario: Load without a new battle sprite
- **WHEN** an identity's battle sprite cannot load
- **THEN** the original archetype sprite is used and combat remains available.

### Requirement: Attributes and role filters
Every combat archetype SHALL have Strength, Agility or Intelligence as its primary attribute. The reference selection SHALL filter identities by All, Carry, Bruiser, Mage, Support or Initiator. The selected identity SHALL remain in the preview when a filter excludes its card.

#### Scenario: Filter reference roles
- **WHEN** a player selects any reference role filter
- **THEN** only matching identities are shown, all matching cards remain reachable and the selected hero's preview remains available.

#### Scenario: Inspect the assigned archetype
- **WHEN** a player previews any identity
- **THEN** its four skills and accessible attribute, attack type and health details come from its assigned combat archetype.

### Requirement: Attribute growth
Class growth SHALL change derived combat stats on each level and SHALL not compound when equipment is recalculated.
#### Scenario: Gain a level
- **WHEN** a hero gains a level
- **THEN** Strength gains extra health and regeneration, Agility gains attack speed and armor, or Intelligence gains spell power and mana; item effects and learned ranks remain valid.
