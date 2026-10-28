# gta-graphics

## ADDED Requirements

### Requirement: Gas reaches full power in 50 ms

A held gas pedal reaches full power within 50 ms at 60 Hz, and not on the first frame. The old five-per-second pedal waited about 200 ms. After a quarter of a second the car is faster and has covered more ground. After a second and a half it is still inside the city-speed window. Steering rates stay as they are.

#### Scenario: A fresh press is full by 50 ms

- **WHEN** the player holds gas from a stop
- **THEN** the pedal is full within 50 ms and the first frame is not already full

#### Scenario: The first quarter second moves farther

- **WHEN** gas has been held for a quarter of a second
- **THEN** speed and distance are both ahead of the old five-per-second pedal

#### Scenario: City speed stays city speed

- **WHEN** gas has been held for a second and a half
- **THEN** speed is still between 1100 and 1400 cm/s and the car has not launched
