## ADDED Requirements

### Requirement: The hair trails a look
While the chase camera turns, the hair and the collar SHALL lag the head, and they SHALL sit on the head again once the look has settled. The crew mesh triangle count and the hero's draw count SHALL stay as they are.

#### Scenario: The view yaws
- **WHEN** flat play settles the hero facing the chase camera and the view then yaws
- **THEN** a few frames into that yaw the hair is behind the head, and the reported crew triangle count is still between 10000 and 14000
