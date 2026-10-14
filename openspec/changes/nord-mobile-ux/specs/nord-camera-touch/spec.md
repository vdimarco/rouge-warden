## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Compact circular minimap
The minimap SHALL use a smaller circular footprint and show a 500-metre diameter around the controlled character, preserving heading, nearby parked cars, home, mission direction and attribution.

#### Scenario: Wide and upright play
- **WHEN** a player walks or drives in landscape or portrait
- **THEN** the map circle is 160 logical pixels across in landscape or 28% of portrait width, remains clear of mission/touch controls, and shows surrounding streets beyond the old map extent.

#### Scenario: Roads and distant targets
- **WHEN** roads cross the map rim or an objective lies outside its range
- **THEN** road lines end at their actual circle intersections, no border roads are fabricated, and the target remains inside the rim in its true direction.
