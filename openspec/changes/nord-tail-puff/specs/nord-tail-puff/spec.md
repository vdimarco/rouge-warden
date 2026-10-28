## ADDED Requirements

### Requirement: A running car's tail uses the existing puff rule

Six puffs. Each lives 1.1 seconds. A puff at birth sits at the tail. A puff at 0.55 seconds has risen and grown. A puff at the end of its life has no swell. The interval stays 0.16 seconds.

#### Scenario: A mid-life puff has risen

- **GIVEN** a puff is 0.55 seconds old in slot 0
- **WHEN** its place is measured
- **THEN** it is farther back than birth
- **AND** it is higher than birth
- **AND** its swell is larger than birth

### Requirement: The play shell can show the tail with no host

The play page has a tail canvas. A page script can fill it from six ages without a running game. Ages outside the life draw nothing.

#### Scenario: An offline frame shows the column

- **GIVEN** the play page is open and the host is offline
- **WHEN** the page is given six ages inside the puff life
- **THEN** the tail canvas is visible
- **AND** it paints a puff for each age
