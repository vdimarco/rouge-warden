## ADDED Requirements
### Requirement: Attributes and role filters
Every hero SHALL have Strength, Agility or Intelligence as its primary attribute. Ranged SHALL filter attack type and Support SHALL filter team role. Existing role filters SHALL remain available through horizontal travel.
#### Scenario: Choose a class
- **WHEN** a player selects Strength, Agility, Intelligence, Ranged or Support
- **THEN** the roster shows matching heroes and their preview displays the attribute, attack type and four skills without vertical page scrolling.
### Requirement: Attribute growth
Class growth SHALL change derived combat stats on each level and SHALL not compound when equipment is recalculated.
#### Scenario: Gain a level
- **WHEN** a hero gains a level
- **THEN** Strength gains extra health and regeneration, Agility gains attack speed and armor, or Intelligence gains spell power and mana; item effects and learned ranks remain valid.
