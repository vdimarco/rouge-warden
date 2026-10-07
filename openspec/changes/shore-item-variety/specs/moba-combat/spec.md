## ADDED Requirements

### Requirement: Varied item powers
The Night Market SHALL offer completed items and relics whose powers differ in kind: they SHALL NOT only add stats.
Each new item SHALL have one power that a player can see in the market text and feel in a fight.

#### Scenario: Snowball with the doubloon
- **WHEN** a player who holds the Drowned doubloon banishes an enemy hero
- **THEN** the player gains a stack of +4 attack and +8 power, up to 10 stacks
- **AND** when that player is banished, half the stacks are lost

#### Scenario: Keep the hoard
- **WHEN** a player forges Kraken's hoard from the doubloon and Duelist's glass
- **THEN** the stack limit becomes 20
- **AND** the player keeps every stack when banished

#### Scenario: A risky edge
- **WHEN** a player holds Duelist's glass and is above 70% health
- **THEN** the player deals 15% more damage to heroes
- **AND** at any health, the player takes 10% more damage

#### Scenario: Break a ward
- **WHEN** a player holds the Wardbreaker maul and hits a ward or rift with basic attacks
- **THEN** each attack deals 40% more damage (70% with the Siegebreaker titan)
- **AND** wards and rifts deal 30% less damage to that player (50% less with the titan)

#### Scenario: Mark a target
- **WHEN** a player who holds Seer's eye hits an enemy hero with a skill
- **THEN** that hero stays revealed for 5 seconds
- **AND** that hero takes 10% more damage from the player's whole team

#### Scenario: Shrug off control
- **WHEN** a player who holds the Moonstone charm is stunned, feared or slowed
- **THEN** the effect ends 40% sooner

#### Scenario: Cast and run
- **WHEN** a player who holds Riptide sandals casts a skill
- **THEN** the player moves 30% faster for 2 seconds

#### Scenario: Rally the team
- **WHEN** a player who holds the Rallying conch casts the ultimate
- **THEN** the player and every ally within 500 deal 20% more damage and move 20% faster for 4 seconds
- **AND** with Tidecaller's warhorn, every skill rallies the team for 3 seconds (12% damage, 8 second cooldown), and the ultimate rally is 25% for 5 seconds

#### Scenario: Choose a new build
- **WHEN** the player opens the Night Market
- **THEN** the Plunder, Siege and Vanguard builds appear with the other builds
- **AND** each new item shows its own icon, its stats and its power text
