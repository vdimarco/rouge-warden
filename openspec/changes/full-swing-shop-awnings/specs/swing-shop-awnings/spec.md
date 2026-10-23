## ADDED Requirements

### Requirement: Shop floors show a cloth band above the glass
A building with shops SHALL show a coloured band on the street floor above the shop windows, while the painted window tile is on. The lit shop glass SHALL stay. A floor that is only a few pixels tall SHALL let the band fade rather than shimmer.

#### Scenario: The street camera looks up the avenue
- **WHEN** the street camera frames a shop front
- **THEN** a red or teal band sits above the lit shop glass, and the glass itself is still the shop window

### Requirement: The chase frame keeps its framing
The awning SHALL NOT move the chase camera.

#### Scenario: Play starts on the avenue
- **WHEN** play starts and the hero stands on the north-south avenue
- **THEN** the chase distance stays 4.5 m and the pitch stays about −0.35
