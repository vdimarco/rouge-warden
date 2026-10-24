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

### Requirement: Play leaves traces
Hard driving and crashes SHALL leave marks that stay for a while.

#### Scenario: Handbrake turn
- **WHEN** a driver skids or brakes hard
- **THEN** dark tyre marks appear under the rear wheels and stay for about 90 s

#### Scenario: Hit a cone
- **WHEN** a car drives through cones or bins
- **THEN** they tumble and stay where they fall, and they return to their places after about two minutes
