# gta-graphics

## ADDED Requirements

### Requirement: Dusk windows vary by room

A dusk wall that is long enough for panes draws each pane from `pane_light`. Some panes are dark. Lit panes are not one colour. A wall shorter than five metres stays blank. The opening camera stays at pitch −16 with the socket at (0, 70, 110).

#### Scenario: Two panes on one wall are not the same lamp

- **WHEN** the corner is drawn at dusk
- **THEN** at least one pane is dark and two lit panes differ in colour

#### Scenario: A short wall stays blank

- **WHEN** a wall is shorter than five metres
- **THEN** it draws no panes

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16 and the socket is (0, 70, 110)
