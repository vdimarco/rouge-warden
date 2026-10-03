## ADDED Requirements

### Requirement: Aim the launch
Full Tilt SHALL let the player set the launch power with a hold, and show the real shot before the player lets go.

#### Scenario: Charge and aim
- **WHEN** the player holds anywhere on the screen, the Launch button or Space at the dock
- **THEN** the power rises from 0.35 for a tap to 1 after 1.1 s, and a dotted arc from the same physics as the launch shows the shot up to the first thing the ball meets

#### Scenario: A skill shot
- **WHEN** the arc meets the beacon with the gold ring
- **THEN** the beacon says LET GO NOW, and a launch that lights it first pays double
- **AND** the chance ends at the first hit, at a flip or when the return starts

#### Scenario: A touch launch does not pulse
- **WHEN** the player launches with a touch
- **THEN** Pulse ignores taps for 400 ms, so the tap that launches does not also fire a Pulse
