## ADDED Requirements
### Requirement: Move from anywhere on foot
On foot, the first finger that lands on the game image SHALL place the move stick under that finger and move the character in the direction dragged from the landing point. A second finger dragging on the game image SHALL turn the camera.

#### Scenario: One thumb walks from anywhere
- **WHEN** a walking player touches anywhere on the game image away from the buttons, in portrait or landscape, and drags
- **THEN** the move stick appears under the thumb, the character walks in the dragged direction, and releasing stops the walk and returns the stick to its corner

#### Scenario: Second finger looks
- **WHEN** one finger is moving and a second finger drags on the game image
- **THEN** the camera turns with the second finger while the first keeps walking

#### Scenario: Double tap sprints
- **WHEN** a walking player taps quickly on the game image and then holds and drags
- **THEN** the second hold walks at sprint, and releasing ends the sprint

#### Scenario: In a car
- **WHEN** the player is driving
- **THEN** no move stick appears, the wheel steers, and one finger dragging on the game image turns the camera
