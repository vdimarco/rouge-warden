# NORD camera and phone actions

## Purpose
Keep the third-person camera above character backs and make phone actions easy to use alongside image drag and gyro.

## Requirements

### Requirement: Camera stays above the character back
The game SHALL limit upward pitch to 30 degrees and keep walking and driving cameras at or above their neutral back-height socket, including when the camera retracts against an obstacle.

#### Scenario: Extreme upward look
- **WHEN** the player repeatedly looks upward using mouse, image drag or gyro
- **THEN** the camera stops at 30 degrees without showing underneath the character

#### Scenario: Entering a car
- **WHEN** the player changes between walking and driving
- **THEN** both cameras retain the same safe orbit behavior

### Requirement: Playable phone action buttons
The browser SHALL present Sprint, Jump/brake, Use/car and Menu in two bottom-right rows with targets at least 76 by 56 CSS pixels. It SHALL remove the look joystick and retain drag-anywhere, gyro and simultaneous movement/action input.

#### Scenario: Phone orientation changes
- **WHEN** the player uses portrait, landscape or narrow landscape
- **THEN** the buttons fit, remain visually distinct, and leave native mission, prompt, radar and speed text clear

#### Scenario: Multiple fingers
- **WHEN** one finger moves and another drags the image while a third presses Jump
- **THEN** all three inputs work and release cleanly
