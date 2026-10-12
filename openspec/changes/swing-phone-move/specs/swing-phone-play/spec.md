## ADDED Requirements

### Requirement: A move stick
On a phone, a move stick SHALL show at the bottom left, except while driving or on a wall (where the climb pad shows). Dragging its knob SHALL walk the hero on a roof or a
street, push to the rim SHALL sprint, and in the air it SHALL steer. A touch on the stick SHALL never
throw a plunger. Letting go SHALL stop the walk.

#### Scenario: Walk and run
- **WHEN** the player drags the stick part way up, then to the rim
- **THEN** the hero walks, then sprints; letting go stops the hero, and no plunger flies

### Requirement: The view stays where it is dragged
On a phone, a drag on the city SHALL turn the view. In the air, the camera SHALL wait 2.5 s after the last drag or tilt before it
turns toward the flight.

#### Scenario: Look around in flight
- **WHEN** the player drags the view 1 rad to the side while flying at 14 m/s
- **THEN** the view stays within 0.1 rad of where the drag left it for 1.5 s
