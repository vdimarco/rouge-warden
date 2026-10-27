## ADDED Requirements

### Requirement: A fast rope leaves room ahead

On a rope, off the ground, and faster than a run, the chase arm SHALL sit farther back than it does at a stand, so the body takes less of the frame. At a stand the arm SHALL stay 4.5 m and the pitch SHALL stay the chase default.

#### Scenario: Mid-swing down the avenue

- **GIVEN** a rope attached and the body low in the arc, between 18 and 25 m/s
- **WHEN** the chase view is drawn
- **THEN** the arm is longer than 6 m, the body covers less of the frame than it does on the ordinary arm, and street shows under the feet

#### Scenario: A stand on the street

- **GIVEN** the hero standing, with no rope
- **WHEN** the chase view settles
- **THEN** the arm is 4.5 m and the pitch is −20°
