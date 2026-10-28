## MODIFIED Requirements

### Requirement: The King stomps the deck
While every pipe is still on, the King SHALL only throw. After a pipe is off, and before the finale, his attacks SHALL cycle a throw, then a stomp, then a pull, then a belch, then a sweep, then a grab, and then a throw again. During a stomp's wind-up the mission card SHALL say he is stomping and to get off the deck. A stomp SHALL take a heart when the hero is on the ground within 28 m of him. A stomp SHALL NOT take a heart when the hero is in the air.

#### Scenario: A throw, then a stomp
- **WHEN** one pipe is off and the King finishes a throw
- **THEN** his next attack is a stomp and the card says to get off the deck

#### Scenario: The deck and the air
- **WHEN** that stomp lands
- **THEN** a hero on the deck loses a heart, and a hero in the air does not

## ADDED Requirements

### Requirement: The King grabs up close
After a pipe is off, the attack after a sweep SHALL be a grab. During that wind-up the mission card SHALL say he is grabbing and to get back. A hero within 8 m of him when the grab lands SHALL lose a heart, on the ground or in the air, and a rope SHALL NOT stop it. The grab SHALL NOT move the hero. A hero farther than 8 m SHALL NOT lose a heart.

#### Scenario: A sweep, then a grab
- **WHEN** one pipe is off and the King finishes a sweep
- **THEN** his next attack is a grab and the card says to get back

#### Scenario: Up close
- **WHEN** that grab lands on a hero standing within 8 m
- **THEN** the hero loses a heart and stays put

#### Scenario: Farther out
- **WHEN** that grab lands on a hero on the ground farther than 8 m
- **THEN** the hero does not lose a heart

#### Scenario: A jump
- **WHEN** that grab lands on a hero in the air within 8 m
- **THEN** the hero loses a heart

#### Scenario: A web
- **WHEN** that grab lands on a hero within 8 m with a rope attached
- **THEN** the hero loses a heart and stays put
