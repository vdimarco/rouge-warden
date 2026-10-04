## MODIFIED Requirements

### Requirement: A tap aims through the pixel the player sees
A tap on a building SHALL fire the right rope through the tapped pixel. The tap ray SHALL start at the camera and use the camera's own position, direction, field of view and aspect. A point can hold a swing when it is 9 to 88 m from the head, is not a roof or a floor, and is more than 3 m above the chest. When the ray hits such a point, the rope SHALL aim from the hero's head to that point. Otherwise the rope SHALL go to the auto target, with the bearing of the tap as the preferred bearing. When no auto target exists, a hit in reach SHALL still catch. The tap ray SHALL last for the one frame in which the tap fires.

#### Scenario: Tap off the middle in third person, 844x390
- **WHEN** the player taps a building at least 0.4 of the half-screen away from the screen centre
- **THEN** the rope attaches to that building, within 8 m of the tapped point
- **AND** the rope does not go to the building at the screen centre

#### Scenario: Tap another building
- **WHEN** the player taps a second building off the screen centre after the first swing
- **THEN** the rope catches on that building
- **WHEN** a rope holds and the tapped place is not a valid target and no auto target exists
- **THEN** the old rope stays

#### Scenario: Tap in first person
- **WHEN** the player is in first person and taps a building off the screen centre
- **THEN** the rope attaches to that building

#### Scenario: Tap the gold ring, 390x844
- **WHEN** the player looks up at the gold ring on a phone held upright and taps its pixel
- **THEN** the rope attaches within 6 m of the ring

#### Scenario: One frame only
- **WHEN** the player taps a building and the next frame has no tap
- **THEN** the next shot aims at the auto target again

#### Scenario: Tap at the sky
- **WHEN** the player taps where no building is in reach
- **THEN** the rope attaches to the auto target, a building ahead of and above the player

### Requirement: Ground in view aims up and ahead
In third person, the rope SHALL NOT attach to a roof, the street or the water at the hero's feet. A tap on the hero or on the floor, and the SWING button (which has no tapped pixel), SHALL fire at the auto target. A clog on a lower roof or on the hero's own roof SHALL stay a target when the view points at it, within 60 m and 22 degrees of the camera forward.

#### Scenario: Tap the hero
- **WHEN** the player taps the hero or the roof at the hero's feet
- **THEN** the rope attaches to a building more than 5 m above the roof

#### Scenario: Press SWING from the chase view
- **WHEN** the camera looks down at the hero and the player presses SWING
- **THEN** the rope attaches to a building up and ahead, and not to the roof

#### Scenario: Aim low at a clog on the same roof
- **WHEN** the hero stands on a roof 14 to 24 m from a clog on the same roof, and the view points at the clog
- **THEN** the target is that clog

#### Scenario: Point at a clog on a lower roof
- **WHEN** the hero stands on a roof and the view points at the roof beside a clog 14 to 60 m away and lower down
- **THEN** the target is that clog
