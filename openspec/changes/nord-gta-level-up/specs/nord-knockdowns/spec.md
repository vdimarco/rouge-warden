## ADDED Requirements

### Requirement: Cars knock people down
A car that strikes a person at speed SHALL knock them down in a non-graphic comic tumble that every peer sees the same way.

#### Scenario: Drive into a resident
- **WHEN** a player drives into a resident or pedestrian at more than 450 cm/s
- **THEN** the person flies along the car's path, lands, lies dazed with circling stars, stands up after a few seconds and runs away
- **AND** both peers see the same arc within one network update, and no blood or injury detail appears

#### Scenario: Slow contact
- **WHEN** a car touches a person below 450 cm/s
- **THEN** the person steps out of the car's path, nobody falls, and no crime is reported

#### Scenario: Car hits a walking player
- **WHEN** a car strikes the other player while that player is on foot
- **THEN** that player tumbles, loses health, cannot move until standing, and then gets control back

#### Scenario: Resident routes recover
- **WHEN** a knocked resident stands up
- **THEN** after a short flight the resident returns to its route, and the 14 + 96 count is unchanged

### Requirement: People react to danger
Civilians SHALL run from gunfire and speeding cars.

#### Scenario: Shots fired
- **WHEN** a player fires a gun near civilians
- **THEN** civilians within about 25 m run away from the shooter for a few seconds, then walk back to their routes

#### Scenario: Car aimed at a person
- **WHEN** a player drives at 1000–2000 cm/s straight at a person who stands in the car's path
- **THEN** the person freezes facing the car and is knocked down when the car arrives

#### Scenario: Car passing close by
- **WHEN** a fast car will pass between about 1.5 m and 2.6 m from a person
- **THEN** the person dives away from the car and stays on their feet
