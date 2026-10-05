## ADDED Requirements

### Requirement: A fall is a head-first dive
In flat play, when the hero has no rope attached, is not on a wall, falls faster than 8 m/s and has more than 1 s to the
ground below, the hero SHALL dive: the body SHALL pitch head first along the flight, the arms SHALL sweep back along the
body (spread wide at the start of the dive, tucked in at speed), the legs SHALL stay straight and together with the toes
pointed, and the head SHALL look along the dive. A headset shows no hero and does not change.

#### Scenario: A drop off a tall roof
- **WHEN** the hero steps off a 100 m roof and falls with no rope
- **THEN** after 1 s the pose is "dive", the body's up axis points within 50 degrees of the flight direction, and both hands are lower on the body than the shoulders

#### Scenario: Near the ground
- **WHEN** a diving hero comes within 1 s of the ground below
- **THEN** the hero flips back upright before the landing, and the landing crouch plays as before

#### Scenario: A rope catches mid dive
- **WHEN** a rope catches while the hero dives
- **THEN** the hero leaves the dive and takes the swing pose within 0.4 s
