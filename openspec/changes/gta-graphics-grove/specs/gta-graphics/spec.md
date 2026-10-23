## ADDED Requirements

### Requirement: The opening shot includes the nearby surveyed trees
The opening shade SHALL draw the park-inventory trees whose trunks are within 50 m of the spawn. That set SHALL include a foreground trunk near the middle of the frame and crowns on both sides of the avenue. The opening pitch of −16, the avenue aim, and the walking socket at Y 70 and Z 110 SHALL stay. The pawn SHALL stay where it is.

#### Scenario: A foreground trunk frames the avenue
- **WHEN** the opening walk camera looks down the avenue from the spawn
- **THEN** a surveyed tree taller than 14 m stands in the middle of the frame, and other crowns sit to the left and the right

#### Scenario: The camera stays
- **WHEN** those trees are drawn
- **THEN** the pitch, the aim, the socket, and the pawn location are unchanged
