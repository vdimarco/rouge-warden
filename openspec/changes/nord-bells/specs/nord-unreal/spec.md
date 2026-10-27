## MODIFIED Requirements

### Requirement: Session lap results
The story slot SHALL be version 12. Version 11 SHALL load and start the bells over. Version 1 SHALL load and start the pond over. Version 2 SHALL stay unread and SHALL NOT be overwritten. Which bell is next SHALL be the only new field. How far the cart has rolled SHALL stay in the session.

#### Scenario: A version-11 slot starts the bells over
- **WHEN** a version-11 slot loads with the cart banked
- **THEN** the bells start at the north one and the cart step stays banked
