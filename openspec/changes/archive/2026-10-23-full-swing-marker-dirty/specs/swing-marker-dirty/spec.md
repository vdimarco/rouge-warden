## ADDED Requirements

### Requirement: Unchanged marker buffers remain clean
Unchanged mission marker positions and colors SHALL not rewrite or schedule buffer transfers; shader time SHALL continue to animate.

#### Scenario: Static offers
- **WHEN** callbacks advance time with unchanged offers
- **THEN** marker buffer versions remain unchanged and the time uniform advances

#### Scenario: Mutable goals and counts
- **WHEN** a goal moves in place, offer colors change, counts shrink/grow or markers hide/show
- **THEN** the next update displays the current transforms and colors, including changes before an intervening draw
