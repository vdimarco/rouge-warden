# Delta: building-supported automatic swings

## Requirement: Real surface attachment
Flat automatic swings SHALL attach only to a reachable building surface.

### Scenario: Open water
- WHEN the player presses swing with no reachable building
- THEN no rope attaches to an invisible sky point and existing no-building feedback is used.

### Scenario: Building nearby
- WHEN a suitable building surface is reachable
- THEN the rope endpoint is that surface.

### Scenario: Release momentum
- WHEN the player releases a real building rope
- THEN existing momentum continues, including travel above rooftops.

### Scenario: Above a reachable rooftop
- WHEN the player is above a rooftop but a real building surface remains reachable
- THEN attachment is allowed without an artificial height ceiling.
