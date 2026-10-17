## ADDED Requirements

### Requirement: Hidden residents retain simulation without invisible pose work
Crew-duplicate residents hidden by the existing visibility rules SHALL retain authoritative route/reaction state while skipping local visual pose evaluation, and SHALL resume the current animation pose when visible again.

#### Scenario: Hide and show a moving crew resident
- **WHEN** a player wears a moving resident's crew style and later switches away
- **THEN** the hidden resident continues its authoritative route while its pose remains unevaluated
- **AND** the first visible tick updates its pose to the current route clock
- **AND** visible residents retain their existing animation cadence and interaction behavior.
