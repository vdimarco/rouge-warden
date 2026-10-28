## ADDED Requirements

### Requirement: Rain draws a splash where it meets the ground
Wet ground SHALL show an expanding ring while rain is falling. The ring SHALL be absent when rain intensity is zero. The streak's world-position offset SHALL stay the existing wrap.

#### Scenario: A wet street in the rain
- **WHEN** wet ground is shaded in the rain from the walking camera
- **THEN** the street shows bright rings, larger nearby and smaller farther off, and the same street with rain off is bare
