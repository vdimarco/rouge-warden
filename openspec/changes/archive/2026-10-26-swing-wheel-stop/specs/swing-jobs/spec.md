## ADDED Requirements

### Requirement: A loose wheel
An odd job SHALL start a wheel rolling along the street. The card SHALL name the wheel and how far it is. Standing on the ground within 4.5 m of it SHALL stop it and bump the hero along its roll. Being in the air, even that close, SHALL NOT stop it. The clock SHALL be 18 s, and running it out SHALL miss as rolled off. The wheel SHALL NOT replace a flush.

#### Scenario: The wheel is loose
- **WHEN** the player takes the loose wheel
- **THEN** the card says to get in front of it, and the wheel is rolling

#### Scenario: In the air
- **WHEN** the hero is in the air within 4.5 m of the wheel
- **THEN** the card says to land in front of it, and the job is still on

#### Scenario: On the ground
- **WHEN** the hero stands on the ground within 4.5 m of the wheel
- **THEN** the wheel stops and the hero is bumped along its roll

#### Scenario: It rolls off
- **WHEN** the 18 s clock runs out first
- **THEN** the lesson card says the wheel rolled off
