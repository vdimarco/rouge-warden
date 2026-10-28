## ADDED Requirements

### Requirement: A missing officer rig draws the clothed idle
When the officer skeletal mesh is missing and the baked stand mesh is present, the officer SHALL draw that stand mesh. The cylinder torso SHALL be used only when the stand mesh is also missing. The stand mesh SHALL be a standing clothed figure facing forward.

#### Scenario: The suit idle replaces the cylinder
- **WHEN** the police rig is missing and the suit stand mesh is available
- **THEN** the figure is the clothed idle, and the cylinder torso is not added

#### Scenario: Both meshes missing
- **WHEN** the police rig and the suit stand mesh are both missing
- **THEN** the cylinder torso, the head and the cap are still built
