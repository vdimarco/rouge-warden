## ADDED Requirements

### Requirement: The post step is version 24

The campaign slot writes version 24. A version-23 slot loads and starts the post over. Version 2 stays unread and is not overwritten. The post step is the only new field. How long they have stood stays in the session.

#### Scenario: A version-23 slot loads

- **WHEN** a version-23 slot with a banked lift is loaded
- **THEN** the lift stays banked and the post starts over

#### Scenario: A version-24 slot loads

- **WHEN** a version-24 slot with the post in progress is loaded
- **THEN** the post step is restored and the count starts again
