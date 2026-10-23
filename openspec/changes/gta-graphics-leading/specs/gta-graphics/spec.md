## ADDED Requirements

### Requirement: The opening walk look aims down the nearest avenue
When a player starts on foot near an avenue, the control yaw SHALL aim at a point 18 m down that avenue. An avenue is a road segment at least 9 m wide within 25 m. The direction nearer the authored yaw SHALL win. The pitch SHALL stay −16, inside the −25 to −5 clamp. The walking socket SHALL stay at Y 70 and Z 110. A respawn on foot SHALL use the same aim. Getting out of a car SHALL keep the car's yaw. No avenue in reach SHALL keep the authored yaw.

#### Scenario: Spawn turns toward the lane
- **WHEN** the player starts on foot at the Parc La Fontaine sidewalk spawn
- **THEN** the control yaw aims about 110° rather than along the avenue at about 77.5°, and the figure stays in frame

#### Scenario: A side street does not steal the aim
- **WHEN** a road narrower than 9 m is closer than the avenue
- **THEN** the aim still follows the avenue

#### Scenario: The socket, the pitch, and the car look stay
- **WHEN** the opening walk yaw is set
- **THEN** the walking socket, the −16 pitch, the pitch clamps, the car possess pitch, and the drive look target are unchanged
