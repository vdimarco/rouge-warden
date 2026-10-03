## ADDED Requirements

### Requirement: Twelve playable heroes
The game SHALL offer twelve named heroes with distinct art, statistics, basic attacks and four learned spells. Bots SHALL select from the full roster.
#### Scenario: Choose a new hero
- **WHEN** a player chooses any roster entry
- **THEN** the portrait, role, combat statistics and move preview update, and the match uses that hero and its kit.
#### Scenario: Filter roles
- **WHEN** the player selects a role filter
- **THEN** only matching heroes are shown, while the selected hero remains visible in the preview.
#### Scenario: Play every hero
- **WHEN** every hero plays a seeded match
- **THEN** the game finishes, entities stay finite, and learned spells follow the same level gates.
