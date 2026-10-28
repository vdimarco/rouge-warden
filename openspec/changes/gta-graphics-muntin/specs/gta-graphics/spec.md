## ADDED Requirements

### Requirement: A dusk pane is split by a bar
The bar SHALL be thinner than the glass. A wall under five metres SHALL stay blank when the lamps are on, and every wall SHALL stay blank when the lamps are off. The opening pitch of −16 and the walking socket at Y 70 and Z 110 SHALL stay.

#### Scenario: The bar is thinner than the glass
- **WHEN** the bar is measured
- **THEN** its height is less than the glass

#### Scenario: A short wall stays blank
- **WHEN** a wall of 402.7 cm is measured with the lamps on
- **THEN** it has no panes

#### Scenario: The opening camera stays
- **WHEN** the avenue is framed
- **THEN** the look stays at pitch −16 and the socket stays at Y 70 and Z 110
