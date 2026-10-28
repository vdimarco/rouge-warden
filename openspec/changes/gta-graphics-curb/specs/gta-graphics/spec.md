# gta-graphics

## ADDED Requirements

### Requirement: The corner curb shows its surveyed row

The corner draws the nearest parked slot on Rue Marie-Anne Est and the next two slots on that same curb. Each car uses that slot's body and paint. The opening camera stays at pitch −16 with the socket at (0, 70, 110).

#### Scenario: Three cars share the curb

- **WHEN** the corner is drawn
- **THEN** the cars are slots 1023, 1024 and 1025, and they are not all one paint

#### Scenario: The nearest car stays at the same height

- **WHEN** slot 1023 is placed
- **THEN** its pivot is 108 cm over the slot's road height

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16 and the socket is (0, 70, 110)
