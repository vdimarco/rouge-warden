## MODIFIED Requirements

### Requirement: A chase has a clock in the music
While a chase is running (the Sludge Run before the crew, Stop Thief, the getaway car, or the balloon), the music SHALL add a ticking clock with a wood-block body under the click. Falling behind SHALL make that tick faster and louder than keeping pace. Closing SHALL take the tick away. While the Sludge Run is waiting out the first lesson, the tick SHALL stay quiet. A fight SHALL keep its own pulse instead of the clock.

#### Scenario: Falling behind
- **WHEN** the hero falls behind the runner on Mission 1
- **THEN** the chase music is at full tick, louder than the same chase while keeping pace

#### Scenario: Closing
- **WHEN** the hero is closing on the runner
- **THEN** the tick is quiet

#### Scenario: The first lesson
- **WHEN** Mission 1 is waiting for the first swing
- **THEN** the tick stays quiet
