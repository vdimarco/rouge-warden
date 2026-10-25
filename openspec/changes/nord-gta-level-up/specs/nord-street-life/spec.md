## ADDED Requirements

### Requirement: Residents with companions
Some runtime walkers SHALL walk dogs, push strollers or carry groceries, without changing the resident count.

#### Scenario: Watch a dog walker
- **WHEN** a player watches a dog walker on a sidewalk
- **THEN** the dog trots beside its owner on a visible leash, stops to sniff near a tree or hydrant when the owner pauses, and sits while the owner stands
- **AND** after the Plateau replica import the dog still finds the street and park trees on their species meshes to sniff

#### Scenario: Watch a stroller
- **WHEN** a player watches a parent with a stroller
- **THEN** the stroller moves ahead of the parent at hand height, and the parent walks slower than other walkers

#### Scenario: Population checks
- **WHEN** the host runs the population checks
- **THEN** there are still exactly 14 authored and 96 runtime residents, and Toronto still has no crowd

### Requirement: Traffic that behaves like Plateau traffic
Traffic cars SHALL stop at stop signs, wait for people who cross and sometimes stop at the curb.

#### Scenario: Four-way stop
- **WHEN** a traffic car reaches a junction that OSM maps with a stop sign
- **THEN** it stops fully before the stop bar, then proceeds when the junction is clear

#### Scenario: Person on the crossing
- **WHEN** a resident, pedestrian or player is in the lane ahead within 8 m
- **THEN** the traffic car slows and stops until the lane is clear

#### Scenario: Curb stop
- **WHEN** a traffic car makes one of its occasional curb stops
- **THEN** it pulls to the curb on a straight stretch, blinks its hazard lights for 15–40 s and rejoins traffic, and it never stops inside a junction
- **AND** no traffic car makes a curb stop in the first two minutes of a session
- **AND** on the replica streets the curb finder takes the 11 cm curb (any rise of 10 cm or more, checked against the Streets OBJs in `test_plateau_parking.py`)
- **AND** a curb stop never pulls in over the parked row, so on the replica streets it happens only where the parked cars leave 20 m of curb free, such as a bus stop's zone or a no-stopping span; this is accepted as Montréal's own habit of stopping briefly with the hazard lights on wherever the curb is clear

### Requirement: Parked cars at the curbs
The Montréal map SHALL park a car in every legal curb space of the replica streets, and any of them SHALL become a real car when a player takes it, hits it or shoots it.

#### Scenario: Walk a plex street
- **WHEN** a player walks avenue de Mentana or rue Fabre, or any replica street that OSM maps with parking
- **THEN** cars of the game's three bodies and four paints, each with one licence plate at the rear, stand along both parking curbs, 5 to 34 cm off the curb (mostly 12 to 30 cm, nearer on a narrow street) and about 6 to 6.5 m apart, facing the way the street's traffic runs, with a few free spaces
- **AND** no car stands within 5 m of a corner, within 5 m of a painted crosswalk (measured to its paint, where the replica draws it), within 3 m of a hydrant, across a lane mouth or a driveway, in a bus stop's zone, on a curb extension, by a BIXI dock or in a chantier, and none stands in a reserved bus lane in its hours, a painted bike lane along the curb or a cycle track
- **AND** no car stands on a painted stop bar: each keeps 50 cm or more from the bar's outline and its paint, since the Code de la sécurité routière sets no distance from a stop line (`check_stop_bars` in `test_plateau_parking.py`)
- **AND** the curbs follow the city's parking signs at midday on a weekday in late October: no car stands where a sign bans parking or stopping then (no AD-TT or SD-TT sign's arrow covers a car within 4 m of its pole), and a curb the city signs for parking holds cars wherever the replica has room for them (Rue Rachel's park side, the curbs of Rue Cartier and Rue Rivard, and Avenue Papineau's peak-hour bus lane at midday)
- **AND** a curb along a cycle track that OSM tags or two poles sign for parking holds cars on the street side of a 70 cm concrete separator, each car 165 cm or more from the track with a 3 m lane across the street (Rue de Brébeuf, Rue De La Roche); where a car there would breach the 300 cm traffic band, or the replica's curb runs along the track, the side stays clear (Avenue du Parc-La Fontaine, Rue Cherrier, and Rue Rachel's north side, which holds one car where the track swings in behind the sidewalk); every such side holds cars or is measured metre by metre as having no room (`test_plateau_parking.py`)
- **AND** no car stands within 150 cm of a side job's marker, door, start, drop or keep-clear point, so no job goal stands on a car

#### Scenario: Take a parked car
- **WHEN** a player presses E at the door of a parked car, with no real car, mission marker, job marker or nearer resident claiming E
- **THEN** the player drives off in a car of the same body and paint, and the other player sees the same car leave its space
- **AND** when two spaces are promoted within a second, the other player's view keeps each car drawn until its own real car arrives or its own wait runs out, so neither space blinks empty (checked by the engine-free rules test)

#### Scenario: Hit a parked car
- **WHEN** a car hits a parked car at 11 km/h or more, a person is thrown into one at 9 m/s or more, or a shot's line passes through one
- **THEN** that car is shoved, dented or both like any car, and its space stays empty while a player is near
- **AND** a person thrown at a parked car promotes it from the speed it had before it slid along the car (checked by `Quebec.Parked.ThrownPerson`)
- **AND** a resident or a pedestrian thrown at a parked car stops 75 cm short of its side, and a throw at 9 m/s or more first turns it into a real car and shoves it (the engine-free rules in `parked_rules_test.cpp`; `Quebec.Parked.ThrownResident` on the host)
- **AND** a cone knocked toward a parked car stops short of its side, as at a wall (checked by `Quebec.Parked.FillAndPromote` on the host)

#### Scenario: Get out beside the parked row
- **WHEN** a player stops beside parked cars and gets out, or an officer, a rescue or a job moves a car or a person to a point over the parked row
- **THEN** the floor probe lands on the road or the sidewalk, never on a parked car's roof: the parked cars' boxes block cars, players and officers but not the Visibility channel, and they are not WorldStatic, so ground queries by object type (a job's goal, a car's wheels, a knocked cone's rest, a person's floor) pass them too
- **AND** a cone or a barricade standing in a space keeps the space empty

#### Scenario: Frame time
- **WHEN** the host profiles a plex street on the phone-stream profile
- **THEN** the parked cars draw from one instanced component per 190 m tile, part mesh and paint, culled at 90 m (tyres at 60 m, rims at 35 m), so a promoted car rebuilds only its own tile's components and none spans more than 200 m; no more than 160 cars lie within 90 m of any space, their triangles within the cull distances stay under 2.2 million before frustum culling, and one view draws at most 500 of their mesh sections, at most 480 of them in the shadow pass (checked in `test_plateau_parking.py` from every space), while the tyres and rims add nothing to the distance-field lighting; `-NordNoParkedFill` gives the comparison without them

### Requirement: Play leaves traces
Hard driving and crashes SHALL leave marks that stay for a while.

#### Scenario: Handbrake turn
- **WHEN** a driver skids or brakes hard
- **THEN** dark tyre marks appear under the rear wheels and stay for about 90 s

#### Scenario: Hit a cone
- **WHEN** a car drives through cones or bins
- **THEN** they tumble and stay where they fall, and they return to their places after about two minutes
