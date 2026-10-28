# Shared goon pose tick

## Requirements
### Requirement: Share the current goon pose tick
#### Scenario: Multiple goons
- WHEN a street frame prepares active goon figures
- THEN pose tick computation is shared and every goon retains prior stepped pose and continuous position behavior.
#### Scenario: State or mode changes
- WHEN pose, combat state or Verse mode changes
- THEN pose invalidation and diagnostic views reflect current state without stale frame caching.
