# gta-graphics

## ADDED Requirements

### Requirement: A close, fast, clean pass earns NEAR MISS

When the player drives past another car at 54 km/h or more, with the two centres no more than 3.3 m apart side to side, and the player's car has touched nothing in the last second, the banner reads NEAR MISS and the detail gives the speed in km/h.

#### Scenario: Oncoming traffic

- **WHEN** the player drives at 65 km/h past an oncoming car 3 m to the side
- **THEN** NEAR MISS shows as the cars meet, with "Past at 65 km/h"

#### Scenario: Too wide or too slow

- **WHEN** the side gap is 5 m, or the player drives at 43 km/h
- **THEN** no banner shows

#### Scenario: A scrape is not a near miss

- **WHEN** the player's car touches anything less than 1 s before the pass
- **THEN** no banner shows

#### Scenario: Being overtaken

- **WHEN** a faster car passes the player
- **THEN** no banner shows

#### Scenario: A line of cars

- **WHEN** the player passes two close cars 0.5 s apart
- **THEN** one banner shows
