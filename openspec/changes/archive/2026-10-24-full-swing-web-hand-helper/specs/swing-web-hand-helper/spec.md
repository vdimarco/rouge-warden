## ADDED Requirements
### Requirement: Share current web endpoint selector
#### Scenario: Active and fading ropes
- WHEN rope lines update across frames
- THEN the shared selector reads current hand tips without changing rendered endpoints.
#### Scenario: Missing tip
- WHEN a tip is unavailable and player position changes
- THEN the selector returns the same current chest fallback as before.
