# NORD car contact and curb parking

## Purpose
Keep street parking aligned with actual curbs and make vehicle contact fit the visible fleet.

## Requirements

### Requirement: Curb-relative street parking
Parked cars SHALL face along their curb, remain on asphalt, leave bumper gaps and preserve at least five metres between the nearest bumper and mapped intersection ends.

#### Scenario: Mixed road widths
- **WHEN** the city starts on streets of different surveyed widths
- **THEN** parked cars form parallel curb rows with a small consistent curb gap, clear of driving lanes, mapped cycle lanes and sidewalks.
- **AND** unsupported spaces stay empty; the existing 32-car target is a maximum, with 19–20 qualified added spaces on the current map.
- **AND** original static street-car art, all original map assets, sixteen traffic cars and 96 pedestrians are retained.

### Requirement: Fitted car and curb contact
Cars SHALL use fitted simple chassis/cabin collision and ground support at their wheels. A car that strikes another car SHALL push it, trading momentum like two equal-mass bodies, instead of stopping as at a wall.

#### Scenario: Ordinary curb
- **WHEN** a driver crosses an ordinary 18 cm curb at low speed
- **THEN** wheel support follows its height and the car does not teleport its entire box up 30 cm.

#### Scenario: Tall and glancing obstacles
- **WHEN** a car hits a wall
- **THEN** its fitted body stops penetration, while glancing wall contact preserves tangential travel.

#### Scenario: Ramming a parked car
- **WHEN** a driver drives into a parked car at speed
- **THEN** the parked car is shoved forward and slides to a stop, the driver loses about the speed the parked car gains, and neither car overlaps the other or leaves its wheels

#### Scenario: Corner and side hits
- **WHEN** a car strikes another car off-centre, such as on a rear corner or along its side
- **THEN** the struck car spins and slides away, the striking car turns the other way, and a glancing scrape slows the slide without reversing it

#### Scenario: Pushing and recovery
- **WHEN** a driver keeps pushing a car, or a struck traffic car comes to rest
- **THEN** the pushing car follows behind the pushed car without passing through it, and a traffic car steers back to its lane while a parked car stays where it stopped

#### Scenario: Gentle contact
- **WHEN** cars touch at under 60 cm/s closing speed
- **THEN** nothing is shoved; the contact only blocks

#### Scenario: Existing browser game
- **WHEN** a phone-layout player enters, drives and exits a car
- **THEN** the existing touch controls, camera limits, daytime and advancing video remain functional.
