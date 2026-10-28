## ADDED Requirements

### Requirement: The ditch step is version 19

The campaign slot writes version 19. A version-18 slot loads and starts the ditch over. Version 2 stays unread and is not overwritten. The ditch step is the only new field. How far the chase car has driven stays in the session.

#### Scenario: A version-18 slot loads

- **WHEN** a version-18 slot with a banked march is loaded
- **THEN** the march stays banked and the ditch starts over

#### Scenario: A version-19 slot loads

- **WHEN** a version-19 slot with the ditch in progress is loaded
- **THEN** the ditch step is restored and the chase car starts at the near end
