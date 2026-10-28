## ADDED Requirements

### Requirement: A walk's dust uses the existing puff rule

Five puffs. Each lives 0.7 seconds. A puff at birth sits at the shoe. A puff at 0.52 seconds has risen and grown. A puff at the end of its life has no radius. The walk speed that starts a scuff stays 80.

#### Scenario: A mid-life puff has risen

- **GIVEN** a puff is 0.52 seconds old in an odd slot
- **WHEN** its place is measured
- **THEN** it is farther back than birth
- **AND** it is higher than birth
- **AND** its radius is larger than birth

### Requirement: The play shell can show the dust with no host

The play page has a dust canvas. A page script can fill it from five ages without a running game. Ages outside the life draw nothing.

#### Scenario: An offline frame shows the trail

- **GIVEN** the play page is open and the host is offline
- **WHEN** the page is given five ages inside the puff life
- **THEN** the dust canvas is visible
- **AND** it paints a puff for each age
