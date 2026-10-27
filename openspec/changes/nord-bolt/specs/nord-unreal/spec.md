## ADDED Requirements

### Requirement: The bolt step is version 21

The campaign slot writes version 21. A version-20 slot loads and starts the bolt over. Version 2 stays unread and is not overwritten. The bolt step is the only new field. Where the seeker is, and the escape clock, stay in the session.

#### Scenario: A version-20 slot loads

- **WHEN** a version-20 slot with a banked parcel is loaded
- **THEN** the parcel stays banked and the bolt starts over

#### Scenario: A version-21 slot loads

- **WHEN** a version-21 slot with the chase in progress is loaded
- **THEN** the bolt step is restored and the seeker starts behind the end
