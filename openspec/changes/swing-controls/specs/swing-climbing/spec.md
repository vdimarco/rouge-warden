## MODIFIED Requirements

### Requirement: Hold on to walls in flat play
In flat play (mouse, pad or phone), the player SHALL hold on to a wall when the chest touches it in the air, or when the player walks into it. Holding a wall SHALL let go of the ropes and stop the body. Headset play SHALL NOT climb. The first time a player holds a wall, a line SHALL tell how to climb and how to jump off, in the words of the device in use.

#### Scenario: Fly into a wall
- **WHEN** a mouse player flies into a wall
- **THEN** the player holds on in the air with no gravity, and the first time a line says "On the wall. W and S climb, A and D go along it. Space jumps off."

#### Scenario: Fly into a wall with a pad
- **WHEN** a pad player flies into a wall for the first time
- **THEN** the line says "On the wall. Push the left stick to climb. Press the bottom button to jump off."
- **AND** the line names no key and no mouse button

#### Scenario: Fly into a wall on a phone
- **WHEN** a phone player flies into a wall
- **THEN** the climb pad shows, and the hint line of the phone panel tells how to climb

#### Scenario: Walk into a wall
- **WHEN** the player walks into a wall from a roof or the street
- **THEN** the player holds on to it

#### Scenario: Headset
- **WHEN** a headset player flies into a wall
- **THEN** the player does not hold on
