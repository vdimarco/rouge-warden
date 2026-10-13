## MODIFIED Requirements

### Requirement: Camera stays above the character back
The game SHALL keep its camera orbit centered on the controlled character and bound the rendered camera pitch to -25 through -5 degrees, without a raised target that loses the character. Worklight aim SHALL remain usable independently.

#### Scenario: Extreme orbit in wide and tall screens
- **WHEN** the player repeatedly drags or tilts beyond either vertical limit in an unobstructed scene
- **THEN** the character head and feet remain within the rendered frame and reversing the gesture immediately returns the view

#### Scenario: Worklight and driving
- **WHEN** the player aims the worklight or enters/exits a car
- **THEN** the camera retains its bounded orbit and the worklight can still align

## ADDED Requirements

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
