## ADDED Requirements

### Requirement: Shared original creature exports
Arcade games SHALL be able to select and draw original generated creatures through modules under `/arcade/creatures/`, with no game-specific imports. The library SHALL retain the upstream notices and pinned source provenance.

#### Scenario: Reproduce an encounter
- **WHEN** two games use the same run seed, encounter key and role
- **THEN** they receive the same creature identifier.

#### Scenario: Inspect animation
- **WHEN** a player opens the field guide and selects Walk or Turn
- **THEN** all 18 exported creatures display the selected motion and direction, using source frame timing and ground pivots.

#### Scenario: Load sprites on demand
- **WHEN** multiple visible actors use one creature identifier
- **THEN** the player shares one asset load and decoded page set, releases inactive completed assets above its cache budget, and exposes asset failures while permitting fallback art.

### Requirement: Random MOBA creatures
The MOBA SHALL use seeded creature identities for its lane waves, siege units, neutral camps and central boss. Heroes SHALL keep their illustrated assets. Camp locations SHALL stay within the arena and pass through its collision resolver.

#### Scenario: Fresh encounter
- **WHEN** a new match or camp respawn starts
- **THEN** species and bounded camp offsets derive from the match seed and encounter key, with four camps available.

#### Scenario: Claim the central beast
- **WHEN** a hero defeats the central boss
- **THEN** the recruited Wild Hunt retains that boss's creature identity.

### Requirement: Neutral retaliation
Camp creatures SHALL remain neutral until damaged. They SHALL retaliate against the attacker, return home when pulled beyond 390 units or left without a hit for six seconds, and heal without taking damage while returning.

#### Scenario: Walk past a camp
- **WHEN** the player enters attack range without selecting the camp or damaging it
- **THEN** automatic attacks leave the camp alone and it leaves the player alone.

#### Scenario: Start and leave a camp fight
- **WHEN** the player taps a guardian or hits it with a skill, then leads it beyond its leash
- **THEN** it fights back, stops its attack, returns home and resets to full health.

#### Scenario: Clear and revisit a camp
- **WHEN** a player kills a camp creature
- **THEN** its existing healing, haste and currency reward occurs once, and a new seeded encounter appears after 32 seconds.

### Requirement: Preserve supported controls and layouts
The creature change SHALL preserve MOBA movement, skills, pause and resume on portrait, landscape and desktop layouts. All metadata and page requests SHALL succeed in browser checks, with no page errors. The preview SHALL show four clips in eight directions for all 18 creatures.

#### Scenario: Move with creatures on screen
- **WHEN** a player starts a match and moves at 390×844, 844×390 or 1440×900
- **THEN** generated sprites appear and movement, pause and resume respond.
