## RENAMED Requirements
- FROM: `### Requirement: Twelve combat archetypes`
- TO: `### Requirement: Sixteen combat archetypes`

## MODIFIED Requirements

### Requirement: Sixteen combat archetypes
The game SHALL provide sixteen tested combat archetypes with distinct statistics, basic attacks and four learned spells. Each of the sixteen hero identities SHALL use its own archetype, so no two heroes play the same spells. Bots SHALL use the full set of archetypes. Display identities SHALL not change spell dispatch, mana, cooldowns, rank gates or combat randomness.

#### Scenario: Play every combat archetype
- **WHEN** every archetype plays a seeded match
- **THEN** the match finishes, entities stay finite and learned spells follow the existing level gates.

#### Scenario: Assign a visual identity
- **WHEN** an identity is assigned to a player or bot
- **THEN** the numeric combat archetype remains unchanged and bot appearance comes from the identity that uses that archetype.

#### Scenario: No shared kits
- **WHEN** the roster is listed
- **THEN** Irontide, Bloodwake, Zephyrs and Coral Sage use kits 12, 13, 14 and 15, and every identity's kit differs from every other identity's kit.
