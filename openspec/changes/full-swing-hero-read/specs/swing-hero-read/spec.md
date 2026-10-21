## ADDED Requirements

### Requirement: The chase view keeps a readable hero
In third-person flat play, the hero SHALL show a dark hair mass and a light collar that follow the head, and the colour map SHALL keep a share of its painted albedo inside the cel bands. The stock cel shader used by other meshes SHALL stay unchanged.

#### Scenario: Standing in the avenue
- **WHEN** flat play stands the hero in the avenue and the chase camera settles
- **THEN** the head carries a dark hair mass and a light collar, and a close view of the face still shows the painted features in cel bands

### Requirement: The crew model stays the same mesh
The crew mesh triangle count SHALL stay inside the existing load check, and the hero SHALL stay within four draw calls.

#### Scenario: The model loads
- **WHEN** the crew model loads in flat play
- **THEN** the reported triangle count is still between 10000 and 14000, and the hero adds at most four draws
