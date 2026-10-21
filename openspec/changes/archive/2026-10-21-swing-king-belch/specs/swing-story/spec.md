## MODIFIED Requirements

### Requirement: The King stomps the deck
While every pipe is still on, the King SHALL only throw. After a pipe is off, and before the finale, his attacks SHALL cycle a throw, then a stomp, then a pull, then a belch, and then a throw again. During a stomp's wind-up the mission card SHALL say he is stomping and to get off the deck. A stomp SHALL take a heart when the hero is on the ground within 28 m of him. A stomp SHALL NOT take a heart when the hero is in the air.

#### Scenario: A throw, then a stomp
- **WHEN** one pipe is off and the King finishes a throw
- **THEN** his next attack is a stomp and the card says to get off the deck

#### Scenario: The deck and the air
- **WHEN** that stomp lands
- **THEN** a hero on the deck loses a heart, and a hero in the air does not

## ADDED Requirements

### Requirement: The King belches on a spot
After a pipe is off, the attack after a pull SHALL be a belch. During that wind-up the mission card SHALL say he is belching and to leave the spot. The spot SHALL be the hero's place when the wind-up begins, and it SHALL NOT follow the hero. A hero still on the ground within 8 m of that spot when the belch lands SHALL lose a heart. A hero on the ground farther than 8 m SHALL NOT lose a heart. A hero in the air SHALL NOT lose a heart.

#### Scenario: A pull, then a belch
- **WHEN** one pipe is off and the King finishes a pull
- **THEN** his next attack is a belch and the card says to leave the spot

#### Scenario: Still on the spot
- **WHEN** that belch lands on a hero standing on the marked spot
- **THEN** the hero loses a heart

#### Scenario: Off the spot
- **WHEN** that belch lands on a hero on the ground more than 8 m from the marked spot
- **THEN** the hero does not lose a heart

#### Scenario: In the air
- **WHEN** that belch lands on a hero in the air over the marked spot
- **THEN** the hero does not lose a heart
