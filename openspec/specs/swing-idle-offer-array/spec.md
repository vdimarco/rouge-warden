## Requirements
### Requirement: Idle offers preserve membership without replacement
#### Scenario: No expired crime
- WHEN idle offers update before or exactly at expiry
- THEN membership, order and references remain unchanged and no crimeover event is emitted.
#### Scenario: Expired crimes
- WHEN idle offers update after expiry
- THEN expired crimes emit one crimeover each in order and are removed; survivors keep order and references, and a previously retained array remains unchanged.
#### Scenario: Busy hero
- WHEN hero is busy
- THEN existing expiration deferral remains unchanged.
