## ADDED Requirements
### Requirement: HUD shares the current threatening goon
#### Scenario: Threat in view
- WHEN a goon threatens the hero
- THEN the existing dodge prompt and projected warning refer to the current threat using one selection per HUD invocation.
#### Scenario: No threat or offscreen
- WHEN threat eligibility or projection changes
- THEN the next update hides or moves the warning according to existing rules without stale results.
#### Scenario: Driving and phone
- WHEN input layout or driving state changes
- THEN prompt priority and warning behavior remain unchanged.
