## ADDED Requirements

### Requirement: Teammates answer fights and calls
A healthy bot with no target in sight SHALL move toward a nearby ally hero who is fighting an enemy hero. A rally call SHALL draw healthy bots of that team to the call point for 12 seconds. Danger and retreat SHALL take priority. Both teams SHALL use the same rules.

#### Scenario: Rotate to a fight
- **WHEN** the player fights an enemy hero and a healthy teammate is idle within range
- **THEN** the teammate moves toward the player and posts an on-my-way ping.

#### Scenario: Call the team
- **WHEN** the player presses G or Rally
- **THEN** a rally ping appears and healthy teammates move to that point until it expires.

### Requirement: Kill records
The match SHALL record each hero kill with killer, victim, first blood, multi-kill count within 12 seconds, kill streak and shutdown.

#### Scenario: Score a double kill
- **WHEN** one hero kills two enemy heroes within 12 seconds
- **THEN** the second record has a multi-kill count of two.
