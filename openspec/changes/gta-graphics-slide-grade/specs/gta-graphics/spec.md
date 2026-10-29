# gta-graphics

## MODIFIED Requirements

### Requirement: A held handbrake slide earns one banner

A player car that is already up to speed, then holds the handbrake through a turn, gets one banner when the slide ends. The shove has to stay past 180 cm/s sideways, at 450 cm/s or faster, for at least 0.35 s. The banner grades the slide by its peak sideways speed: SLIDE under 550 cm/s, BIG SLIDE from 550 cm/s, HUGE SLIDE from 700 cm/s. Its detail line says how long the slide held. A slide that lasts 2.5 s gets its banner then. A straight run, a short tap, a turn without the handbrake and a failsafe stop get none. A later slide can earn another. A second shove inside 1.5 s does not.

#### Scenario: Gas, then a held slide

- **WHEN** the player holds gas for 3 seconds, then holds the handbrake and turns fully
- **THEN** one BIG SLIDE banner fires as the slide ends, while the car still moves, and says "Held for 0.4 s"

#### Scenario: A gentle slide

- **WHEN** the player holds gas for 3 seconds, then holds the handbrake and turns halfway
- **THEN** one plain SLIDE banner fires as the slide ends

#### Scenario: A slide at top speed

- **WHEN** the player holds gas for 6 seconds, then holds the handbrake and turns fully
- **THEN** one HUGE SLIDE banner fires as the slide ends

#### Scenario: A tap is not a slide

- **WHEN** the player releases the handbrake before the shove has held for 0.35 s
- **THEN** no banner fires

#### Scenario: Grip is not a slide

- **WHEN** the player turns at speed without the handbrake
- **THEN** the sideways shove stays under 180 cm/s and no banner fires

#### Scenario: A second slide can pay

- **WHEN** the player gets back up to speed and holds another slide
- **THEN** a second banner fires, and a shove that starts again inside 1.5 s does not
