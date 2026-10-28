## ADDED Requirements

### Requirement: The slip step is version 17

The campaign slot writes version 17. A version-16 slot loads and starts the slip over. Version 2 stays unread and is not overwritten. The slip step is the only new field. The pursuer's place stays in the session.

#### Scenario: A version-16 slot loads

- **WHEN** a version-16 slot with a banked stall is loaded
- **THEN** the stall stays banked and the slip starts over

#### Scenario: A version-17 slot loads

- **WHEN** a version-17 slot with the slip in progress is loaded
- **THEN** the slip step is restored and the pursuer starts behind the door
