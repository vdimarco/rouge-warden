## ADDED Requirements

### Requirement: Masonry faces are mottled
The facade shader SHALL vary the colour inside each brick and stone unit, beyond the single per-unit tint. Some brick units SHALL show a darker chipped corner. Some stone units SHALL show a darker pit. Mortar joints, the lamp apron, and the window trough SHALL keep their colours.

#### Scenario: A brick row beside a stone row
- **WHEN** the facade shader shades a brick building and a stone building in one elevation
- **THEN** the brick field and the stone field are mottled, chips appear on some bricks, pits appear on some stones, and the joints and troughs stay even
