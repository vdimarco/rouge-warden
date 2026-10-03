# pinball-controls

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
