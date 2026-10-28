## ADDED Requirements

### Requirement: Controller reconnect starts fresh button edges
Flat Full Swing SHALL treat a standard controller appearing after a disconnected poll as fresh input, without retaining stale action-button edges.

#### Scenario: Reconnect with an action button pressed
- **GIVEN** a standard controller button was pressed before disconnecting
- **WHEN** at least one poll has no connected controller and a controller reconnects with that button pressed
- **THEN** the first connected poll emits its action once
- **AND** further held polls do not repeat the action

#### Scenario: Disconnected controller
- **WHEN** no standard controller is connected
- **THEN** no controller action is emitted
- **AND** keyboard and mouse input retain their existing behavior
