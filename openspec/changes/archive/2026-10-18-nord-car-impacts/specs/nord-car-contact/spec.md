## MODIFIED Requirements
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
