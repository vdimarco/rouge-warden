## ADDED Requirements

### Requirement: A miss has its own sting
A failed job SHALL play a short low falling sting, and SHALL NOT play the win fanfare. The sting SHALL be lower in pitch than the win.

#### Scenario: The purse snatcher gets away
- **WHEN** the purse snatcher gets away
- **THEN** a low falling sting plays
- **AND** the win fanfare does not

## MODIFIED Requirements

### Requirement: A chase has a clock in the music
While a chase is running (the Sludge Run before the crew, Stop Thief, the getaway car, or the balloon), the music SHALL add a ticking clock with a wood-block body under the click. Falling behind SHALL make that tick faster and louder than keeping pace. While the purse snatcher or the Sludge Run runner is pulling away, that faster tick SHALL stay even when the distance is holding. Closing SHALL take the tick away. While the Sludge Run is waiting out the first lesson, the tick SHALL stay quiet. A fight SHALL keep its own pulse instead of the clock.

#### Scenario: Falling behind
- **WHEN** the hero falls behind the runner on Mission 1
- **THEN** the chase music is at full tick, louder than the same chase while keeping pace

#### Scenario: A steady gap, already pulling away
- **WHEN** the purse snatcher is pulling away and the gap stays wide
- **THEN** the chase music stays at the full tick

#### Scenario: Closing
- **WHEN** the hero is closing on the runner
- **THEN** the tick is quiet

#### Scenario: The first lesson
- **WHEN** Mission 1 is waiting for the first swing
- **THEN** the tick stays quiet
