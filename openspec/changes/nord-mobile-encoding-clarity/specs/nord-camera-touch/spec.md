## MODIFIED Requirements

### Requirement: Mobile streaming prioritizes smooth playback
The mobile player SHALL balance readable imagery and smooth playback with four recoverable profiles, retaining native scene graphics, controls and the 30 FPS cap.

#### Scenario: Phone stream negotiation
- **WHEN** a touch player connects
- **THEN** it starts with a 960×540 pixel budget shaped to the play area and a 2 Mbps ceiling, rising to a 1280×720 pixel budget/6 Mbps after sustained healthy playback; desktop stays 1280×720 at its existing ceiling.

#### Scenario: Startup hiccup
- **WHEN** playback starts, a profile changes, or a single freeze occurs
- **THEN** the first five seconds do not trigger adaptation, and one freeze alone cannot permanently lower quality.

#### Scenario: Slow receiver and recovery
- **WHEN** after the grace period five consecutive samples report below 24 FPS, over 120 ms buffer delay or a new freeze, or two consecutive samples report below 12 FPS
- **THEN** the phone steps down one profile, using 960×540 pixels/2 Mbps, 800×450 pixels/1.5 Mbps and finally 640×360 pixels/1 Mbps, all shaped to the play area, only for continued severe pressure.
- **WHEN** after the next grace period fifteen consecutive samples report at least 28 FPS without excessive buffer delay or new freezes
- **THEN** the phone restores one clearer profile; reconnect and slot selection reset the balanced profile. Rotation preserves the selected profile and restarts the settling period.

#### Scenario: Real-media verification
- **WHEN** the candidate is tested in both phone orientations and a 60-second camera sweep
- **THEN** actual video matches negotiated dimensions, input remains functional, decoded pacing/drops/freezes are recorded and screenshots are inspected; physical-phone and carrier limits are reported.

