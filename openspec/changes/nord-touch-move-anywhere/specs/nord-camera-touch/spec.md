## MODIFIED Requirements
### Requirement: Playable phone action buttons
On foot, the browser SHALL present Sprint, Jump, Use/car and Menu in two bottom-right rows with round targets at least 72 by 72 CSS pixels, growing to 88 by 88 on full-height portrait phones, action icons, 12-pixel gaps and visible pressed feedback. It SHALL remove the look joystick and retain second-finger drag look, gyro and simultaneous movement/action input.

#### Scenario: Phone orientation changes
- **WHEN** the player uses portrait, landscape or narrow landscape
- **THEN** the buttons fit, remain visually distinct, and leave native mission, prompt, radar and speed text clear

#### Scenario: Multiple fingers
- **WHEN** one finger moves and another drags the image while a third presses Jump
- **THEN** all three inputs work and release cleanly
