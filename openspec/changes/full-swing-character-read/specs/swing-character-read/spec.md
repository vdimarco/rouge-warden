## ADDED Requirements

### Requirement: A street figure reads as a person
A drawn crowd figure SHALL show a head with hair above it, shoulders wider than the waist, a neck, and two legs. The waist SHALL take the trouser colour. The figure SHALL stay on the existing instanced mesh, so the people still draw in two calls.

#### Scenario: Chase view
- **WHEN** flat play draws the hero and the people near the start with the comic art loaded
- **THEN** a nearby person has a hair mass above the head and shoulders wider than the hips, and the frame is not a shader error

### Requirement: The hero and the crowd take a rim
On a flat view, the hero's body and a crowd body SHALL add a warm rim where the normal faces the sun and the view glances off, and a smaller cool rim in shade. The ink hull SHALL stay a flat ink colour. The stock `toonify` colour for other meshes SHALL stay as it was.

#### Scenario: The hero is not a flat cutout
- **WHEN** the chase camera draws the loaded hero
- **THEN** the hero's edge is lighter than the middle of the same cel band

#### Scenario: Other cel meshes stay on the stock bands
- **WHEN** the city render check shades its lit sphere
- **THEN** that sphere still matches the stock cel colours
