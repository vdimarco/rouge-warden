## ADDED Requirements

### Requirement: Mission 12 crosses the lawn out of the lamps
After the walk is banked, the card SHALL ask the player to step into the north dark pocket, then reach the south dark without standing in a lamp. A lamp SHALL burn the attempt, on foot or in a vehicle. Another person in a lamp SHALL burn it too. The north pocket SHALL clear a burn when the player is on foot there and nobody is in a lamp. The purse SHALL be 520 session cash, paid once when a dry walker reaches the south dark on a clean attempt. A rider SHALL NOT start or finish the crossing. The seven story banks SHALL stay seven.

#### Scenario: The pocket
- **WHEN** a dry walker steps into the north dark
- **THEN** the crossing opens and does not pay

#### Scenario: The straight line
- **WHEN** the player walks the straight line between the pockets
- **THEN** a lamp burns the attempt and the south dark does not pay

#### Scenario: The west side
- **WHEN** the player walks the west dark and then steps into the south dark
- **THEN** the crossing is banked and the purse is 520 once

### Requirement: Recover stands north of the pocket
Recover SHALL place the player north of the pocket, outside the pocket and outside the lamps, and SHALL clear the burn. A race replay SHALL NOT rewind the crossing.

#### Scenario: The gaps
- **WHEN** the pockets, the lamps, the west dark, and the north recover are measured
- **THEN** the recover is outside the pocket, the straight line is inside a lamp, and the west dark is outside both lamps

### Requirement: The crossing is stored on version 5
The slot SHALL keep completed missions at 0–2. Version 5 SHALL store the crossing only after the walk is banked. Version 4 SHALL still load and SHALL start the crossing over. Version 1 SHALL still load and SHALL start the pond over. Version 2 SHALL stay rejected and SHALL NOT be overwritten. The burn SHALL stay in the session.

#### Scenario: A crossing in progress
- **WHEN** version 5 is read with the walk banked and the crossing open
- **THEN** the crossing resumes and the burn is clear

#### Scenario: An older escort slot
- **WHEN** version 4 is read
- **THEN** the walk resumes and the crossing starts over
