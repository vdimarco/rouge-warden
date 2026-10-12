## ADDED Requirements

### Requirement: Melee heroes close the gap
A hero's attack type SHALL follow its reach: a hero with a listed reach above 250 is ranged, and every other hero is melee. When a ranged hero's basic attack hits a melee hero, the melee hero SHALL take 25% less damage from that hit and SHALL move 15% faster for 1.5 seconds. The rule SHALL apply in the same way to the player and to bots on both teams. Spells, item effects, wisps, wards, neutral creatures and melee basic attacks SHALL NOT trigger it. The simulation SHALL stay deterministic.

#### Scenario: A melee hero walks into a ranged hero's shots
- **GIVEN** a melee hero with no shield and no other damage reduction
- **WHEN** a ranged hero's basic attack hits it
- **THEN** the melee hero loses 75% of the health that the same shot takes from a ranged hero with equal armor
- **AND** the melee hero moves 15% faster for 1.5 seconds
- **AND** the damage number shows the reduced amount

#### Scenario: Speed ends after the shots stop
- **GIVEN** a melee hero that a ranged hero's basic attack hit
- **WHEN** 1.5 seconds pass with no other ranged hero basic attack on it
- **THEN** the melee hero moves at its normal speed again

#### Scenario: Other damage is unchanged
- **WHEN** a ranged hero's spell, a caster wisp, a ward or a melee hero hits a melee hero
- **THEN** the hit deals its normal damage and gives no extra speed

#### Scenario: Ranged heroes do not get the rule
- **WHEN** a ranged hero's basic attack hits another ranged hero
- **THEN** the hit deals its normal damage and gives no extra speed

#### Scenario: Same rule for the player and the bots
- **GIVEN** a match with the player and five bots
- **WHEN** any ranged hero shoots any melee hero, on either team
- **THEN** the melee hero gets the same damage reduction and speed, whether a person or a bot controls it

#### Scenario: Measured balance
- **WHEN** `qa/tidebreak/kit-strength.mjs` runs 480 Veteran matches on seeds 1 to 480
- **THEN** the average win rate of the melee kits is within 3 points of the average win rate of the ranged kits
