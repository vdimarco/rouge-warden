## ADDED Requirements

### Requirement: Rain streaks read as drops
The rain material SHALL keep the existing streak displacement and visibility mask, and SHALL shade each quad with a brighter core than its skirt and a brighter knot at the leading end.

#### Scenario: Read a streak against the dusk sky
- **WHEN** a visible rain quad is shaded from its leading end to its tail
- **THEN** the centre is brighter than the skirt, the leading end carries a knot, and a hidden instance stays invisible
