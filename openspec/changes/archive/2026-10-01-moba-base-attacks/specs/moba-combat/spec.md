## ADDED Requirements

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
