## ADDED Requirements

### Requirement: A split facade counts as one wall
Consecutive footprint edges that face the same way SHALL be one wall for the dusk panes. A single edge under five metres SHALL stay dark. The opening pitch of −16 and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: The face nearest the corner camera takes panes
- **WHEN** building 1885349 is measured
- **THEN** its collinear edges join into a wall longer than eight metres, and that wall takes panes when the street lamps are on

#### Scenario: A short edge stays dark
- **WHEN** one edge is 4.03 metres
- **THEN** it takes no panes on its own

#### Scenario: The opening camera stays
- **WHEN** the avenue is framed
- **THEN** the look stays at pitch −16 and the socket stays at Y 70 and Z 110
