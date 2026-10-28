## ADDED Requirements

### Requirement: The atelier bills body damage
The atelier SHALL clear the body damage on a nearby car when the player is on foot and can pay. A wreck SHALL cost 400. Half the body SHALL cost 220. A wreck SHALL cost more than a scratch. A short purse SHALL leave the cash and the damage unchanged. A police car SHALL be refused. A driver, a downed player, and a player with no hurt car in reach SHALL be refused. The bill SHALL NOT change wanted stars. The goon pay SHALL stay 300 and SHALL NOT cover a wreck.

#### Scenario: A wreck
- **WHEN** the player has 400 and a wrecked car is in reach
- **THEN** the cash is 0 and the damage is 0

#### Scenario: Short
- **WHEN** the player has 399 and a wrecked car is in reach
- **THEN** the cash stays 399 and the damage stays 100

#### Scenario: Police
- **WHEN** the only hurt car is a police car
- **THEN** the cash and the damage stay as they were
