# NORD camera and phone actions

## Purpose
Keep the third-person camera framed on the character, make touch actions playable, and adapt mobile streaming to receiver pressure.

## Requirements

### Requirement: Camera stays above the character back
The game SHALL keep its camera orbit centered on the controlled character and bound the rendered camera pitch to -25 through -5 degrees, without a raised target that loses the character. Worklight aim SHALL remain usable independently.

#### Scenario: Extreme orbit in wide and tall screens
- **WHEN** the player repeatedly drags or tilts beyond either vertical limit in an unobstructed scene
- **THEN** the character head and feet remain within the rendered frame and reversing the gesture immediately returns the view

#### Scenario: Worklight and driving
- **WHEN** the player aims the worklight or enters/exits a car
- **THEN** the camera retains its bounded orbit and the worklight can still align

### Requirement: Playable phone action buttons
The browser SHALL present Sprint, Jump/brake, Use/car and Menu in two bottom-right rows with targets at least 76 by 56 CSS pixels. It SHALL remove the look joystick and retain drag-anywhere, gyro and simultaneous movement/action input.

#### Scenario: Phone orientation changes
- **WHEN** the player uses portrait, landscape or narrow landscape
- **THEN** the buttons fit, remain visually distinct, and leave native mission, prompt, radar and speed text clear

#### Scenario: Multiple fingers
- **WHEN** one finger moves and another drags the image while a third presses Jump
- **THEN** all three inputs work and release cleanly

### Requirement: Mobile streaming prioritizes smooth playback
The mobile player SHALL request a lighter frame and lower bandwidth than desktop, retain native scene graphics and controls, and reduce its frame/bandwidth budget further after sustained low receiver FPS.

#### Scenario: Phone stream negotiation
- **WHEN** a touch player connects or rotates
- **THEN** it negotiates at most 800×450 landscape or an equivalent portrait budget and retains clear HUD/actions

#### Scenario: Relay verification
- **WHEN** the performance candidate is measured through the relay
- **THEN** its decoded frame pacing, freezes, bitrate and delay are compared with the baseline and physical-device limits are reported

#### Scenario: Slow receiver
- **WHEN** a phone reports fewer than 24 decoded FPS or over 120 ms video-buffer delay for five samples, or reports a freeze
- **THEN** it requests a 640-pixel long edge and 1 Mbps ceiling until reconnect
