# pinball-controls

## Purpose
Full Tilt gives the player direct control of the ball: the flippers, the rescue below them, and the aimed launch.

## Requirements

### Requirement: Recover a ball below the flippers
Full Tilt SHALL let players rescue a nearby ball below an active dock flipper with a fresh press of that flipper's normal control.

#### Scenario: Reverse scoop
- **WHEN** a player presses the matching flipper while a live ball is within its underside recovery area
- **THEN** the ball gains upward motion and the flipper shows a visible reverse-scoop effect

#### Scenario: Recovery has limits
- **WHEN** the ball is outside the recovery area or a player keeps a flipper held
- **THEN** the game does not apply repeated recovery impulses and missed balls can still drain

#### Scenario: Desktop and mobile input
- **WHEN** a player uses Z/X or the corresponding touch button in portrait or landscape
- **THEN** the same rescue behavior is available without an additional button

#### Scenario: Preserve other play states
- **WHEN** a player pauses, restarts, changes sectors, or flips with the ball above the dock
- **THEN** pause blocks gameplay input, reset clears rescue state, and normal flipper shots continue to work

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
