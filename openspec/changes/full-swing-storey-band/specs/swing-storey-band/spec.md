## ADDED Requirements

### Requirement: A shop's floors are separate storeys

On a building with a shop, each floor above the street SHALL show a stone course at the floor line. The floor directly above the shop SHALL show a deeper course, a sill, and a shorter window than the floors above it. The course SHALL fade out before it shimmers, and it SHALL stay off glass towers.

#### Scenario: Street looking up at a shop

- **GIVEN** the city at the painted sunset
- **WHEN** the player looks down the street at a shop
- **THEN** a limestone band sits on the wall above the shop cloth, and the window above that band is shorter than the windows on the floors higher up

#### Scenario: The ink stays lines

- **GIVEN** the canyon view
- **WHEN** the facades are drawn
- **THEN** the stone course does not flood the picture with ink
