## ADDED Requirements

### Requirement: Winning heroes dance
When a team wins a Shore match, the living heroes of that team that are in view SHALL turn to the camera and play a looping dance. Dead heroes and the other team SHALL NOT dance. The result sheet SHALL open 3.5 seconds after the win, with its usual title, score and buttons. A draw SHALL open the result at once. With reduced motion, no hero SHALL dance and the result SHALL open at once. The dance SHALL add no control and SHALL NOT change the simulation.

#### Scenario: The player's team wins
- **WHEN** the enemy rift breaks on desktop or a phone viewport
- **THEN** the player's hero and its living teammates in view dance facing the camera, a dead teammate stays down, and no enemy hero dances
- **AND** the result sheet titled "Legends never die" opens about 3.5 seconds later

#### Scenario: The enemy team wins
- **WHEN** the player's rift breaks
- **THEN** the enemy heroes in view dance, the player's team does not
- **AND** the result sheet titled "Lost to the veil" opens about 3.5 seconds later

#### Scenario: Reduced motion
- **WHEN** a player who asks for reduced motion wins a match
- **THEN** no hero dances and the result sheet opens at once

#### Scenario: A draw
- **WHEN** the match ends even
- **THEN** no hero dances and the result sheet titled "The veil holds" opens at once
