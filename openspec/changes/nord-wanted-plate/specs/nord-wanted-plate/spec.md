## ADDED Requirements

### Requirement: A star rise and a down use English chrome

The silent star plate says WANTED and a star count in English. One star says 1 star. More say stars. A down says ARRESTED and To Poste de quartier 38, or KNOCKED OUT and To Hôpital Notre-Dame. The police notices for a new star, an arrest, losing the police, and the garage use the same English words. Heat and the respawn places do not change.

#### Scenario: Two stars

- **GIVEN** a silent rise to two stars
- **WHEN** the star plate is shown
- **THEN** the head is WANTED
- **AND** the line is 2 stars

#### Scenario: An arrest names the station

- **GIVEN** the player is arrested
- **WHEN** the down plate is shown
- **THEN** the head is ARRESTED
- **AND** the line is To Poste de quartier 38

### Requirement: The play shell can show the plate with no host

The play page has a heat plate. A page script can fill it without a running game. A down hides the star line. An empty state hides the plate.

#### Scenario: An offline frame shows two stars

- **GIVEN** the play page is open and the host is offline
- **WHEN** the page is given two stars and no down
- **THEN** the plate shows WANTED and 2 stars

#### Scenario: A down replaces the stars

- **GIVEN** the page is given stars and an arrest
- **WHEN** the plate is drawn
- **THEN** the head is ARRESTED
- **AND** the star line is not shown
