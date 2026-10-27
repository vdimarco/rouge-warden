## ADDED Requirements

### Requirement: The lift step is version 23

The campaign slot writes version 23. A version-22 slot loads and starts the lift over. Version 2 stays unread and is not overwritten. The lift step is the only new field. Where they are on the walk stays in the session.

#### Scenario: A version-22 slot loads

- **WHEN** a version-22 slot with a banked yard is loaded
- **THEN** the yard stays banked and the lift starts over

#### Scenario: A version-23 slot loads

- **WHEN** a version-23 slot with the lift in progress is loaded
- **THEN** the lift step is restored and they start at the door again
