## ADDED Requirements

### Requirement: The yard step is version 22

The campaign slot writes version 22. A version-21 slot loads and starts the yard over. Version 2 stays unread and is not overwritten. The yard step is the only new field. Where the watcher is looking, and whether the crossing is armed, stay in the session.

#### Scenario: A version-21 slot loads

- **WHEN** a version-21 slot with a banked bolt is loaded
- **THEN** the bolt stays banked and the yard starts over

#### Scenario: A version-22 slot loads

- **WHEN** a version-22 slot with the yard in progress is loaded
- **THEN** the yard step is restored and the look starts again
