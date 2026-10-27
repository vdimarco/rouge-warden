## ADDED Requirements

### Requirement: The tab is three verbs

After the post is banked, the player walks to a counter, drives a car through a lane inside a speed band, and stands still for a receipt. A car does not open the counter. A bike does not take the lane. The purse is 760, once, when the receipt fills.

#### Scenario: The counter

- **WHEN** the player is on foot inside the counter
- **THEN** the lane opens and the counter stays banked

#### Scenario: A car at the counter

- **WHEN** a car is at the counter
- **THEN** the lane stays closed

#### Scenario: The lane

- **WHEN** a car crosses the lane inside the band, nose down the road
- **THEN** the receipt opens

#### Scenario: A bad lane

- **WHEN** the car is too fast, too slow, or pointed the wrong way
- **THEN** the lane stays open and the counter stays banked

#### Scenario: The receipt

- **WHEN** the player stands still on foot inside the receipt until the count fills
- **THEN** the tab closes and pays 760 once

#### Scenario: A broken count

- **WHEN** the player moves after the receipt count has started
- **THEN** the count starts again and the step does not save

### Requirement: An older slot starts the tab over

A version-24 slot loads the post and starts the tab at the counter. A version-25 slot keeps a tab that is already open.

#### Scenario: Version 24

- **WHEN** a version-24 slot loads
- **THEN** the tab step is the counter

#### Scenario: Version 25

- **WHEN** a version-25 slot has the lane open
- **THEN** the lane is still open after the load
