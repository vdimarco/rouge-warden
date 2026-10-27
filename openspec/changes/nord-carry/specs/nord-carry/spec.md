## ADDED Requirements

### Requirement: The carry is three verbs

After the tab is banked, the player picks up a case on foot, walks it to a stoop, and rolls a car across a line. A car does not pick up the case. A sprint or a creep does not deliver it. A stop or a bolt does not cross the line. The purse is 740, once, when the line is crossed.

#### Scenario: The case

- **WHEN** the player is on foot inside the case
- **THEN** the stoop opens and the case stays banked

#### Scenario: A car at the case

- **WHEN** a car is at the case
- **THEN** the stoop stays closed

#### Scenario: The stoop

- **WHEN** the player walks into the stoop
- **THEN** the line opens

#### Scenario: A bad stoop

- **WHEN** the player sprints, creeps, or drives into the stoop
- **THEN** the stoop stays open and the case stays banked

#### Scenario: The line

- **WHEN** a car rolls across the line slower than a walk and faster than a crawl
- **THEN** the carry closes and pays 740 once

#### Scenario: A bad line

- **WHEN** the car is stopped or too fast
- **THEN** the line stays open and the stoop stays banked

### Requirement: An older slot starts the carry over

A version-25 slot loads the tab and starts the carry at the case. A version-26 slot keeps a carry that is already open.

#### Scenario: Version 25

- **WHEN** a version-25 slot loads
- **THEN** the carry step is the case

#### Scenario: Version 26

- **WHEN** a version-26 slot has the stoop open
- **THEN** the stoop is still open after the load
