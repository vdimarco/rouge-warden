## ADDED Requirements

### Requirement: Arrow keys move like WASD
Up and Down SHALL move forward and back at the same scale as W and S. Left and Right SHALL strafe at the same scale as D and A. An arrow key SHALL NOT also be an action. The graded steering keys SHALL stay on MoveRight at a third and two thirds of full lock.

#### Scenario: Forward
- **WHEN** the player presses Up
- **THEN** it maps to MoveForward at scale 1, the same as W

#### Scenario: Strafe
- **WHEN** the player presses Left
- **THEN** it maps to MoveRight at scale -1, the same as A

#### Scenario: Not an action
- **WHEN** the input file is read
- **THEN** no arrow key is an action mapping

#### Scenario: Graded wheel
- **WHEN** the input file is read
- **THEN** NumPad 1, 2, 4 and 5 still steer at -0.33, -0.66, 0.33 and 0.66
