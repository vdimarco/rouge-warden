# neon-stack-every-view

## ADDED Requirements

### Requirement: Neon Stack has a machine in every view

Neon Stack SHALL have a cabinet in the Corridor, an entry in All Games, and dates for the New and Updated orders.

#### Scenario: The Corridor

- **GIVEN** the Corridor in its arcade order
- **WHEN** the player walks to the end of THE LAB
- **THEN** cabinet 47 is Neon Stack, after Gloam Downs, and opening it loads `/neon-stack/`

#### Scenario: All Games

- **GIVEN** the homepage All Games list
- **WHEN** the player searches "neon stack"
- **THEN** the Neon Stack tile is listed

### Requirement: The runner stands on the street

The stacked runner SHALL cast a contact shadow on the street and SHALL be darker at the feet than at the hood. The scene SHALL stay at three draws.

#### Scenario: Idle at 390

- **GIVEN** seed 7 at 390 px width, tilt 55, the runner idle
- **WHEN** a frame is drawn
- **THEN** a dark footprint shows on the street beside the runner's feet, away from the sun

### Requirement: No WebGL2 is said in words

#### Scenario: A browser without WebGL2

- **GIVEN** a browser that cannot make a WebGL2 context
- **WHEN** the page loads
- **THEN** the page says that Neon Stack needs WebGL2
