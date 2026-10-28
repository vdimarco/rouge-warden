## ADDED Requirements

### Requirement: Asphalt colour breaks the 2 m repeat
The asphalt colour SHALL sample the same photo twice, at world scales 0.005 and 0.013, and mix them. A slower patch SHALL move that colour between 0.78 and 1. Normals and roughness SHALL stay on the 0.005 grid.

#### Scenario: The colour is two scales
- **WHEN** the asphalt material is built
- **THEN** two colour samples share the photo, one at scale 0.005 and one at scale 0.013 shifted by 0.37

#### Scenario: The normal stays on the fine grid
- **WHEN** the asphalt material is built
- **THEN** the normal sample still reads the 0.005 coordinates

#### Scenario: The road picture loses the ruled crack
- **WHEN** the walking camera looks along the road
- **THEN** the repeated crack is broken by the second scale and the patch
