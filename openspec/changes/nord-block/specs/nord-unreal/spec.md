## MODIFIED Requirements

### Requirement: Session lap results
The story slot SHALL be version 13. Version 12 SHALL load and start the block over. Version 1 SHALL load and start the pond over. Version 2 SHALL stay unread and SHALL NOT be overwritten. The block step SHALL be the only new field. How far the courier has driven SHALL stay in the session.

#### Scenario: A version-12 slot starts the block over
- **WHEN** a version-12 slot loads with the bells banked
- **THEN** the block starts at the side street and the bell step stays banked
