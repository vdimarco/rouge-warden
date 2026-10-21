## ADDED Requirements

### Requirement: Chez Lise sells one thing for session cash
A walking player at the Sherbrooke stall SHALL buy a kit for 80 when hurt, a vest for 120 when healthy and unarmoured, or one wanted star for 200 when both bars are full. A short purse SHALL leave cash and vitals unchanged. A driver and a downed player SHALL buy nothing. While Cinq étoiles is running, a star SHALL NOT be for sale, and a kit SHALL still be. The goon pay SHALL stay 300.

#### Scenario: Kit first
- **WHEN** a hurt player with 80 stands at the stall and presses E
- **THEN** health rises by 50 up to 100, cash falls by 80, and the stars stay

#### Scenario: Short
- **WHEN** a hurt player with 79 presses E
- **THEN** cash and health stay as they were

#### Scenario: Then a vest, then a star
- **WHEN** a healthy, unarmoured player presses E, and a full player presses E
- **THEN** the first buys a vest and the second buys one star off

#### Scenario: Cinq étoiles
- **WHEN** Cinq étoiles is running and the buyer is full, with stars
- **THEN** the stars and the cash stay
- **AND** a hurt buyer still gets a kit

#### Scenario: The spot
- **WHEN** the stall is placed
- **THEN** it sits on the Sherbrooke sidewalk south of the spawn, clear of the job points and the QA anchors
