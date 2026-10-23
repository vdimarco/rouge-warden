## ADDED Requirements

### Requirement: The opening shot draws the seventies coupe
The opening shade SHALL draw body profile 0 of the seventies car (body, cabin, roof, four tires, and four rims) at the surveyed car spawn, in the default teal paint. It SHALL NOT draw the constructor box in that place. The opening pitch of −16, the avenue aim, and the walking socket at Y 70 and Z 110 SHALL stay. The pawn SHALL stay where it is.

#### Scenario: The coupe sits where the box was
- **WHEN** the opening walk camera looks down the avenue from the spawn
- **THEN** the car on the right of the frame is the fastback coupe, with a wheel, glass, and a lamp, and the red constructor box is absent

#### Scenario: The camera and the spawn stay
- **WHEN** that coupe is drawn
- **THEN** the pitch, the aim, the socket, the pawn, and the car's surveyed spawn and yaw are unchanged
