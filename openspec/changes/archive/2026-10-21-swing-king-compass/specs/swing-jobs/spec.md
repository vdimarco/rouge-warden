## ADDED Requirements

### Requirement: The King compass names a pipe
While the card says FLUSH THE KING, the compass SHALL point at the nearest pipe that is still on him, and its title SHALL name that pipe. The card SHALL give the distance to that pipe in metres, and that distance SHALL drop on the next frames when the hero moves toward it. A clog that is still in the city SHALL NOT take the compass while the King is awake.

#### Scenario: The King is awake
- **WHEN** the King is awake and a pipe is still on him
- **THEN** the card says FLUSH THE KING and names the distance to a pipe
- **AND** the compass title names the King's pipe and points at that pipe

#### Scenario: A step toward the pipe
- **WHEN** the card names that pipe and the hero moves toward it
- **THEN** the distance on the card is shorter within the next few frames
- **AND** the compass still names the King's pipe
