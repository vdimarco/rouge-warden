## MODIFIED Requirements

### Requirement: Session lap results
The story slot SHALL be version 15. Version 14 SHALL load and start the pursuit over. Version 1 SHALL load and start the pond over. Version 2 SHALL stay unread and SHALL NOT be overwritten. The pursuit step SHALL be the only new field. How far the traffic car has driven SHALL stay in the session.

#### Scenario: A version-14 slot starts the pursuit over
- **WHEN** a version-14 slot loads with the send-off banked
- **THEN** the pursuit starts with the traffic car ahead and the send-off stage stays banked
