## ADDED Requirements

### Requirement: Avenues read wider on the radar
The radar SHALL draw a road at least 9 m wide as a dark casing with a lighter center, after the side streets. A narrower road SHALL keep the grey stroke of thickness 1.5 scale units. A segment outside the disc SHALL still be clipped.

#### Scenario: An avenue is cased
- **WHEN** the radar draws a road whose width is at least 900 cm
- **THEN** that road is an ink stroke 5.2 scale units wide with a paper center 2.6 scale units wide, drawn after the side streets

#### Scenario: A side street stays grey
- **WHEN** the radar draws a road under 900 cm
- **THEN** the stroke is the grey line of thickness 1.5 scale units

#### Scenario: The rim stays empty
- **WHEN** a road segment lies outside the radar disc
- **THEN** the clip rejects it and it does not become a road along the rim
