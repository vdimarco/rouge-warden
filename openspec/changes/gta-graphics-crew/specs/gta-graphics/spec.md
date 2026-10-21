## ADDED Requirements

### Requirement: Crew have a lit side
The comic post process SHALL shade crew pixels with a half-lambert key, and SHALL leave a non-crew pixel unchanged by that key.

#### Scenario: Read a figure against a wall
- **WHEN** the crew key is applied to a figure in front of a flat wall
- **THEN** the figure has a brighter side toward the afternoon sun and a cooler shade, and the wall keeps its colour
