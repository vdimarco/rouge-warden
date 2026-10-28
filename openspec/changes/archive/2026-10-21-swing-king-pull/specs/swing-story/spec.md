## MODIFIED Requirements

### Requirement: The King stomps the deck
While every pipe is still on, the King SHALL only throw. After a pipe is off, and before the finale, his attacks SHALL cycle a throw, then a stomp, then a pull, and then a throw again. During a stomp's wind-up the mission card SHALL say he is stomping and to get off the deck. A stomp SHALL take a heart when the hero is on the ground within 28 m of him. A stomp SHALL NOT take a heart when the hero is in the air.

#### Scenario: A throw, then a stomp
- **WHEN** one pipe is off and the King finishes a throw
- **THEN** his next attack is a stomp and the card says to get off the deck

#### Scenario: The deck and the air
- **WHEN** that stomp lands
- **THEN** a hero on the deck loses a heart, and a hero in the air does not

## ADDED Requirements

### Requirement: The King pulls you in
After a pipe is off, the attack after a stomp SHALL be a pull. During that wind-up the mission card SHALL say he is pulling and to shoot a web. A hero in the air with no rope attached SHALL be dragged 14 m toward him. That drag SHALL take a heart when it leaves the hero within 16 m, and SHALL NOT take a heart when the hero is still farther than 16 m. A hero on the ground SHALL NOT be pulled and SHALL NOT lose a heart. A hero in the air with a rope attached SHALL NOT be pulled and SHALL NOT lose a heart.

#### Scenario: A stomp, then a pull
- **WHEN** one pipe is off and the King finishes a stomp
- **THEN** his next attack is a pull and the card says to shoot a web

#### Scenario: In the air with no web
- **WHEN** that pull lands on a hero in the air with no rope, 20 m away
- **THEN** the hero is dragged toward him and loses a heart

#### Scenario: Too far to hurt
- **WHEN** that pull lands on a hero in the air with no rope, 40 m away
- **THEN** the hero is dragged toward him and does not lose a heart

#### Scenario: On the ground
- **WHEN** that pull lands on a hero on the ground
- **THEN** the hero stays put and does not lose a heart

#### Scenario: A web holds
- **WHEN** that pull lands on a hero in the air with a rope attached
- **THEN** the hero stays put and does not lose a heart
