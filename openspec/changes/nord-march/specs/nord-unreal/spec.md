## ADDED Requirements

### Requirement: The march step is version 18

The campaign slot writes version 18. A version-17 slot loads and starts the march over. Version 2 stays unread and is not overwritten. The march step is the only new field. Where the march has walked stays in the session.

#### Scenario: A version-17 slot loads

- **WHEN** a version-17 slot with a banked slip is loaded
- **THEN** the slip stays banked and the march starts over

#### Scenario: A version-18 slot loads

- **WHEN** a version-18 slot with the march in progress is loaded
- **THEN** the march step is restored and the march starts at the join
