# gta-graphics

## ADDED Requirements

### Requirement: A held handbrake slide earns one banner

A player car that is already up to speed, then holds the handbrake through a turn, gets one SLIDE banner. The shove has to stay past 180 cm/s sideways, at 450 cm/s or faster, for 0.35 s. A straight run, a short tap, and a turn without the handbrake get none. A later slide can earn another. A second shove inside 1.5 s does not.

#### Scenario: Gas, then a held slide

- **WHEN** the player holds gas for 3 seconds, then holds the handbrake and steers
- **THEN** one SLIDE banner fires while the car is still moving

#### Scenario: A tap is not a slide

- **WHEN** the player releases the handbrake before the shove has held for 0.35 s
- **THEN** no banner fires

#### Scenario: Grip is not a slide

- **WHEN** the player turns at speed without the handbrake
- **THEN** the sideways shove stays under 180 cm/s and no banner fires

#### Scenario: A second slide can pay

- **WHEN** the player gets back up to speed and holds another slide
- **THEN** a second banner fires, and a shove that starts again inside 1.5 s does not
