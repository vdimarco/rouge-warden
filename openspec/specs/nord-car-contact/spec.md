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
Cars SHALL use fitted simple chassis/cabin collision and ground support at their wheels.

#### Scenario: Ordinary curb
- **WHEN** a driver crosses an ordinary 18 cm curb at low speed
- **THEN** wheel support follows its height and the car does not teleport its entire box up 30 cm.

#### Scenario: Tall and glancing obstacles
- **WHEN** a car hits a wall or another car
- **THEN** its fitted body stops penetration, while glancing wall contact preserves tangential travel.

#### Scenario: Existing browser game
- **WHEN** a phone-layout player enters, drives and exits a car
- **THEN** the existing touch controls, camera limits, daytime and advancing video remain functional.
