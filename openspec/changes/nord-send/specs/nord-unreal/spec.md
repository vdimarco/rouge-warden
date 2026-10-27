## MODIFIED Requirements

### Requirement: Session lap results
The story slot SHALL be version 14. Version 13 SHALL load and start the send-off over. Version 1 SHALL load and start the pond over. Version 2 SHALL stay unread and SHALL NOT be overwritten. The send-off stage SHALL be the only new field. How far the drive got SHALL stay in the session.

#### Scenario: A version-13 slot starts the send-off over
- **WHEN** a version-13 slot loads with the block banked
- **THEN** the send-off starts at the door and the block step stays banked
