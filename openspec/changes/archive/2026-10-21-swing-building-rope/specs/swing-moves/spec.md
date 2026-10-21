## ADDED Requirements

### Requirement: The first web hangs from a building
In flat play with a mouse or a pad, the first easy web SHALL attach to a building the hero can hang under when one is ahead, including a building farther than 16 body-heights. The rope length SHALL be the distance to that building, and the bottom of the arc SHALL stay at least 1.5 body-heights above the ground. The swing SHALL NOT fly the hero into the wall. With no such building ahead, the web SHALL attach to the sky, and a sky rope SHALL stay at most 16 body-heights. Over open water the web SHALL stay in the sky.

#### Scenario: A building ahead
- **WHEN** the player holds the swing button in the air with a building ahead that the arc can clear
- **THEN** the web attaches to that building, the rope is about as long as the distance to it, and the hero does not hit the wall

#### Scenario: Open water
- **WHEN** the player holds the swing button over open water
- **THEN** the web attaches to the sky
