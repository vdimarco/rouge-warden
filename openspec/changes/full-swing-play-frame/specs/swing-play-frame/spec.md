## ADDED Requirements

### Requirement: The chase view leaves the avenue the middle of the frame
In third-person flat play, with the chase camera settled, the hero SHALL sit left of the centre of the frame and the street ahead SHALL occupy the middle. The arm length and the pitch SHALL stay the chase values.

#### Scenario: Standing on the avenue
- **WHEN** flat play stands the hero in the middle of an avenue, facing along it, and the chase camera settles
- **THEN** the hero is left of centre, the avenue is visible past the hero, and the reported pitch and distance are still the chase defaults

### Requirement: First person and walls stay clear
The slide SHALL ease out as the view blends to the eyes. The slide SHALL stop short of a wall.

#### Scenario: The eyes
- **WHEN** the chase view blends fully to first person
- **THEN** the camera is at the eyes, with no shoulder offset
