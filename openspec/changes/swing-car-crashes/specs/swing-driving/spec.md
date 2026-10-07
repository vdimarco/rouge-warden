## ADDED Requirements

### Requirement: Cars collide
Cars SHALL never pass through each other. A driven car that meets a parked car, a job car or another car SHALL push it: the two
SHALL separate, never into a wall, and trade their speed along the hit, so the car that was hit rolls away and coasts to a stop. A
hit faster than 2 m/s SHALL make the bump sound.

#### Scenario: Ram a parked car
- **WHEN** the player drives at a parked car from 14 m away at full throttle
- **THEN** the car bumps, the parked car is pushed along the street, and the two never overlap

### Requirement: Street cars take a hit
A street car in front of the driven car SHALL become a real car where it was, at its lane speed, and SHALL take the hit like any
other car.

#### Scenario: Ram the traffic
- **WHEN** the player drives into a street car
- **THEN** that street car becomes a real car, and the two cars bump and do not overlap

### Requirement: Clean car models
Every parked car and job car drawn SHALL show a car model, as SHALL the 12 nearest street cars within 60 m of the camera. Each
model SHALL have round wheels and smooth panels, at about 5,000 triangles. Far street cars MAY keep the simple body. The frame SHALL
stay within the triangle budget.

#### Scenario: A street with traffic
- **WHEN** the hero stands on a street with parked cars and traffic nearby
- **THEN** the parked cars and the near street cars show their models, and a street car shown as a model can still be stolen
