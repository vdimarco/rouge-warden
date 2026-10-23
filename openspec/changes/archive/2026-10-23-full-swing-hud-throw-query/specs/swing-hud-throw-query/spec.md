## ADDED Requirements
### Requirement: HUD throw availability is evaluated once per update
#### Scenario: Throw prompt and button
- WHEN a fighting hero faces an eligible target without a higher-priority prompt
- THEN desktop shows THROW and phone exposes the existing throw button, using at most one target query per HUD invocation.
#### Scenario: Higher-priority prompts
- WHEN driving, threatened, finishing, near a car or aiming a takedown
- THEN prompt priority and throwable availability remain unchanged.
#### Scenario: Next update
- WHEN target eligibility or hero orientation changes
- THEN the next HUD update uses current state rather than a persistent cached result.
