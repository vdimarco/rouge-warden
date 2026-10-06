## ADDED Requirements

### Requirement: Shore kit mechanics
The four shore kits SHALL each add mechanics that no other kit has, and their spell text SHALL describe them.

#### Scenario: Irontide guards
- **WHEN** Irontide throws the anchor along a line with an enemy in it
- **THEN** the first enemy in the line is dragged next to Irontide and stunned
- **AND** Iron oath makes Irontide take 40% of the damage the linked ally takes
- **AND** Challenge makes nearby enemy heroes and wisps attack Irontide and prevents their spells, while Irontide takes 30% less damage
- **AND** after its warning, Anchorfall keeps each enemy it strikes within a leash of the anchor for four seconds

#### Scenario: Bloodwake duels
- **WHEN** an enemy hero that Crimson lunge cut is banished within three seconds
- **THEN** Crimson lunge is ready again
- **AND** Blood price costs 10% of current health and adds attack speed and extra damage of 5% of the target's maximum health, up to 120
- **AND** Red parry blocks the next hit from an enemy hero once and stuns that hero
- **AND** Red horizon strikes up to three enemies in turn, heroes first

#### Scenario: Zephyrs bends the wind
- **WHEN** Zephyrs casts Cyclone
- **THEN** the cyclone travels forward and damages and lifts each enemy it reaches once
- **AND** Gust dash throws the enemies it passes to the side
- **AND** Wind wall destroys enemy spell missiles that touch it
- **AND** Eye of the storm pushes enemies out and makes allied heroes inside move faster

#### Scenario: Coral Sage mends
- **WHEN** Coral Sage aims Tide swap at a hero
- **THEN** the two trade places
- **AND** Polyp swarm damages enemies and heals wounded allies as it hops
- **AND** Coral armor reduces damage by 25% and turns the shield left at its end into healing
- **AND** Spring tide cleanses, heals and shields every allied hero on the map

#### Scenario: Read the new spells
- **WHEN** a player aims one of the sixteen new spells
- **THEN** the preview shows the real shape: a line, a cone, a band, a circle at the aim point or a circle around the hero
- **AND** the wind wall draws as a band in the 2D and 3D views
