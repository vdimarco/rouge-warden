## ADDED Requirements

### Requirement: The parcel step is version 20

The campaign slot writes version 20. A version-19 slot loads and starts the parcel over. Version 2 stays unread and is not overwritten. The parcel step is the only new field. The clock and where the street cars are stay in the session.

#### Scenario: A version-19 slot loads

- **WHEN** a version-19 slot with a banked ditch is loaded
- **THEN** the ditch stays banked and the parcel starts over

#### Scenario: A version-20 slot loads

- **WHEN** a version-20 slot with the parcel in hand is loaded
- **THEN** the parcel step is restored and the clock starts again
