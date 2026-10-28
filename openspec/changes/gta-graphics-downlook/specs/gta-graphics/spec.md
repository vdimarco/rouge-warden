## ADDED Requirements

### Requirement: The opening walk look tips down the street
When a player starts on foot, the control pitch SHALL be −16 degrees. That pitch SHALL stay inside the −25 to −5 clamp. The walking socket SHALL stay at Y 70 and Z 110. Getting out of a car, respawning on foot, and recovering a side job on foot SHALL use the same pitch. A car's opening pitch SHALL stay −12.

#### Scenario: Spawn looks down the street
- **WHEN** the player starts on foot in a 16:9 frame with a 90° horizontal field of view
- **THEN** the horizon sits in the top quarter of the frame, lower than the horizon at the −5 upward stop, and the figure stays in frame

#### Scenario: The socket and the car look stay
- **WHEN** the opening walk pitch is set
- **THEN** the walking socket, the pitch clamps, the car possess pitch, and the drive look target are unchanged
