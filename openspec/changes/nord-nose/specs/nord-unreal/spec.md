## ADDED Requirements

### Requirement: The stall step is version 16

The campaign slot writes version 16. A version-15 slot loads and starts the stall over. Version 2 stays unread and is not overwritten. The stall step is the only new field.

#### Scenario: A version-15 slot loads

- **WHEN** a version-15 slot with a banked pursuit is loaded
- **THEN** the pursuit stays banked and the stall starts over

#### Scenario: A version-16 slot loads

- **WHEN** a version-16 slot with the stall in progress is loaded
- **THEN** the stall step is restored
