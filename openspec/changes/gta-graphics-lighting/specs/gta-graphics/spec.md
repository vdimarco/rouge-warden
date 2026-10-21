## ADDED Requirements

### Requirement: Comic shadows are sky-coloured
The comic post process SHALL lift dark surfaces with a cool sky wash, and SHALL leave the sky and a lit surface without that wash.

#### Scenario: Read a shaded wall beside a lit wall
- **WHEN** the comic shadow wash is applied to a dark wall and a lit wall under a clear sky
- **THEN** the dark wall is cooler than the violet wash, the lit wall keeps its colour, and the sky is not washed
