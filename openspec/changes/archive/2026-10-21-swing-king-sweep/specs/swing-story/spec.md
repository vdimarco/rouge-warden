## MODIFIED Requirements

### Requirement: The King stomps the deck
While every pipe is still on, the King SHALL only throw. After a pipe is off, and before the finale, his attacks SHALL cycle a throw, then a stomp, then a pull, then a belch, then a sweep, and then a throw again. During a stomp's wind-up the mission card SHALL say he is stomping and to get off the deck. A stomp SHALL take a heart when the hero is on the ground within 28 m of him. A stomp SHALL NOT take a heart when the hero is in the air.

#### Scenario: A throw, then a stomp
- **WHEN** one pipe is off and the King finishes a throw
- **THEN** his next attack is a stomp and the card says to get off the deck

#### Scenario: The deck and the air
- **WHEN** that stomp lands
- **THEN** a hero on the deck loses a heart, and a hero in the air does not

## ADDED Requirements

### Requirement: The King sweeps a lane
After a pipe is off, the attack after a belch SHALL be a sweep. During that wind-up the mission card SHALL say he is sweeping and to step aside. The lane SHALL be the heading from him to the hero when the wind-up begins, and it SHALL NOT follow the hero. A hero still within 36 m of him and within 0.45 radians of that heading when the sweep lands SHALL lose a heart, on the ground or in the air. A hero on the ground outside that heading SHALL NOT lose a heart. A hero farther than 36 m along that heading SHALL NOT lose a heart.

#### Scenario: A belch, then a sweep
- **WHEN** one pipe is off and the King finishes a belch
- **THEN** his next attack is a sweep and the card says to step aside

#### Scenario: Still in the lane
- **WHEN** that sweep lands on a hero standing in the marked lane, within 36 m
- **THEN** the hero loses a heart

#### Scenario: Out of the lane
- **WHEN** that sweep lands on a hero on the ground, within 36 m, and more than 0.45 radians off the marked heading
- **THEN** the hero does not lose a heart

#### Scenario: Past his reach
- **WHEN** that sweep lands on a hero farther than 36 m along the marked heading
- **THEN** the hero does not lose a heart

#### Scenario: A jump in the lane
- **WHEN** that sweep lands on a hero in the air, still in the marked lane and within 36 m
- **THEN** the hero loses a heart
