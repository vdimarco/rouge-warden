## ADDED Requirements

### Requirement: A street car shown as a model can be stolen
A street car drawn as a model near the camera SHALL be found by car theft and by the driven car's crashes, as when it is drawn by
the traffic shader.

#### Scenario: Steal a near street car
- **WHEN** a street car within 40 m is drawn as a model, and the player presses R beside it
- **THEN** the hero steals it, as before
