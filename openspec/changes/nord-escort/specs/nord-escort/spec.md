## ADDED Requirements

### Requirement: Mission 11 walks with someone who can stop
After the home beat is banked, the card SHALL ask the player to walk up to Grey Coat on the east lawn, then walk them to the east door. Grey Coat SHALL follow on foot and SHALL stop when the player rides, swims, or gets too far. Grey Coat SHALL walk again when the player returns on foot inside the follow distance. The purse SHALL be 480 session cash, paid once when both people reach the door on foot and Grey Coat is not stopped. A rider, a swimmer, or a stopped coat at the door SHALL NOT finish the walk. The seven story banks SHALL stay seven.

#### Scenario: The meeting
- **WHEN** a dry walker reaches Grey Coat at the meet
- **THEN** the walk opens and does not pay

#### Scenario: Riding off
- **WHEN** the player is in a vehicle or farther than the stop distance
- **THEN** Grey Coat stays where they are until the player comes back on foot

#### Scenario: The door
- **WHEN** the player and Grey Coat are both on foot inside the east door and Grey Coat is walking
- **THEN** the walk is banked and the purse is 480 once

### Requirement: Recover stands south of Grey Coat
Recover SHALL place the player south of Grey Coat, outside the door. A race replay SHALL NOT rewind the walk.

#### Scenario: The gap
- **WHEN** the meet, the door, and the south recover points are measured
- **THEN** each recover point is outside its door, and the meet is more than 50 m from the door

### Requirement: The walk is stored on version 4
The slot SHALL keep completed missions at 0–2. Version 4 SHALL store the escort step only after the home beat is banked. Version 3 SHALL still load and SHALL start the escort at the meet. Version 1 SHALL still load and SHALL start the pond over. Version 2 SHALL stay rejected and SHALL NOT be overwritten. Grey Coat's place on the lawn SHALL stay in the session.

#### Scenario: A walk in progress
- **WHEN** version 4 is read with the home beat banked and the escort on the walk
- **THEN** the walk resumes and Grey Coat starts at the meet

#### Scenario: An older story slot
- **WHEN** version 3 is read
- **THEN** the earlier beats resume and the escort starts at the meet
