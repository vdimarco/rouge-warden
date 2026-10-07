## ADDED Requirements

### Requirement: A fall is a head-first dive
In flat play, a fall with no rope and no wall, faster than 8 m/s and with more than 1.3 s to the ground, SHALL be a dive: the body
pitches head first along the flight, the arms sweep back (wide at first, tucked at speed), the legs stay together with the toes
pointed, and the head looks along the dive. It holds until a quarter second before the ground. A headset shows no hero.

#### Scenario: A drop off a tall roof
- **WHEN** the hero steps off a 100 m roof and falls with no rope
- **THEN** after 1 s the pose is "dive", the body's up axis points within 50 degrees of the flight direction, and both hands are lower on the body than the shoulders

#### Scenario: Near the ground
- **WHEN** a diving hero comes within a quarter second of the ground below
- **THEN** the hero tucks out of the dive and lands in the forward roll of change full-swing-city-action

#### Scenario: A rope catches mid dive
- **WHEN** a rope catches while the hero dives
- **THEN** the hero leaves the dive and takes the swing pose within 0.4 s
