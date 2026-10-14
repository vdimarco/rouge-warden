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
On foot, the browser SHALL present Sprint, Jump, Use/car and Menu in two bottom-right rows with round targets at least 72 by 72 CSS pixels, growing to 88 by 88 on full-height portrait phones, action icons, 12-pixel gaps and visible pressed feedback. It SHALL remove the look joystick and retain drag-anywhere, gyro and simultaneous movement/action input.

#### Scenario: Phone orientation changes
- **WHEN** the player uses portrait, landscape or narrow landscape
- **THEN** the buttons fit, remain visually distinct, and leave native mission, prompt, radar and speed text clear

#### Scenario: Multiple fingers
- **WHEN** one finger moves and another drags the image while a third presses Jump
- **THEN** all three inputs work and release cleanly

### Requirement: Mobile streaming prioritizes smooth playback
The mobile player SHALL balance readable imagery and smooth playback with four recoverable profiles, retaining native scene graphics, controls and the 30 FPS cap.

#### Scenario: Phone stream negotiation
- **WHEN** a touch player connects
- **THEN** it starts at 960×540 landscape or an equivalent tall frame with a 2 Mbps ceiling, rising to 1280 pixels/4 Mbps after sustained healthy playback; desktop stays 1280×720 at its existing ceiling.

#### Scenario: Startup hiccup
- **WHEN** playback starts, a profile changes, or a single freeze occurs
- **THEN** the first five seconds do not trigger adaptation, and one freeze alone cannot permanently lower quality.

#### Scenario: Slow receiver and recovery
- **WHEN** after the grace period five consecutive samples report below 24 FPS, over 120 ms buffer delay or a new freeze, or two consecutive samples report below 12 FPS
- **THEN** the phone steps down one profile, using 960 pixels/2 Mbps, 800 pixels/1.5 Mbps and finally 640 pixels/1 Mbps only for continued severe pressure.
- **WHEN** after the next grace period fifteen consecutive samples report at least 28 FPS without excessive buffer delay or new freezes
- **THEN** the phone restores one clearer profile; reconnect and slot selection reset the balanced profile. Rotation preserves the selected profile and restarts the settling period.

#### Scenario: Real-media verification
- **WHEN** the candidate is tested in both phone orientations and a 60-second camera sweep
- **THEN** actual video matches negotiated dimensions, input remains functional, decoded pacing/drops/freezes are recorded and screenshots are inspected; physical-phone and carrier limits are reported.

### Requirement: Compact circular minimap
The minimap SHALL use a smaller circular footprint and show a 500-metre diameter around the controlled character, preserving heading, nearby parked cars, home, mission direction and attribution.

#### Scenario: Wide and upright play
- **WHEN** a player walks or drives in landscape or portrait
- **THEN** the map circle is 160 logical pixels across in landscape or 28% of portrait width, remains clear of mission/touch controls, and shows surrounding streets beyond the old map extent.

#### Scenario: Roads and distant targets
- **WHEN** roads cross the map rim or an objective lies outside its range
- **THEN** road lines end at their actual circle intersections, no border roads are fabricated, and the target remains inside the rim in its true direction.
