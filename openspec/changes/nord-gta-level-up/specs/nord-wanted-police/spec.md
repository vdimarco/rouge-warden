## ADDED Requirements

### Requirement: Wanted stars
Crimes that police or civilians see SHALL give the offender wanted stars, from one to five.

#### Scenario: Hit a pedestrian in view of a police car
- **WHEN** a player knocks down a pedestrian while a police car is within 70 m and facing the player
- **THEN** the player gets at least one star, and the HUD shows it at once

#### Scenario: Crime nobody sees
- **WHEN** a player commits a minor crime with no officer in view and fewer than two civilians within 25 m
- **THEN** no star is added

#### Scenario: Shooting back
- **WHEN** a player shoots at an ink goon, or at police who already chase that player, and no civilian is hit
- **THEN** the shots add no gunfire heat; a civilian who is hit still counts as a crime

#### Scenario: Escalation
- **WHEN** a wanted player rams police cars and attacks officers
- **THEN** heat rises through the thresholds 10, 45, 100, 180 and 300 to five stars

#### Scenario: Losing the police
- **WHEN** no officer or police car sees a wanted player
- **THEN** the stars blink, and after 15 s plus 10 s per star one star drops and the search continues; if police see the player again the stars stop blinking

### Requirement: Police respond
Police cars and officers SHALL pursue wanted players in proportion to the star level.

#### Scenario: Pursuit
- **WHEN** a player has stars
- **THEN** police cars appear 120–200 m away out of every player's view, drive along the streets toward the player with lights and siren, and ram the player's car when close
- **AND** at 3 stars and above officers leave their cars and shoot at the player, with at most four cars and four officers in the world

#### Scenario: Arrest
- **WHEN** an officer stays within 1.5 m of a player who is on foot and moving slowly for 2 s
- **THEN** the HUD shows ARRÊTÉ!, and after 4 s the player stands at Poste de quartier 38 on Rachel with full health, no stars and only fists

#### Scenario: Garage
- **WHEN** a wanted player drives into the garage while no unit sees them
- **THEN** the stars clear and a banner says so

#### Scenario: Police cars look like police
- **WHEN** a player sees a police car
- **THEN** it is white with a blue band and the word POLICE, without the logo of a real force, and its light bar flashes red and blue while the siren sounds

#### Scenario: Legacy and Toronto modes
- **WHEN** the game runs with `-NordNoCampaign`, `-NordNoPolice` or on the Toronto map
- **THEN** no police spawn
