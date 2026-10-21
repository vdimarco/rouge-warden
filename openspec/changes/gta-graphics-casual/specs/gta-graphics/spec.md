## ADDED Requirements

### Requirement: A missing crew rig draws the clothed idle
When the player crew skeletal mesh is missing and the baked casual stand mesh is present, the player SHALL draw that stand mesh and SHALL hide the skeletal mesh. The mannequin SHALL remain only when the stand mesh is also missing. When the crew skeletal mesh loads, the stand SHALL be hidden and the skeletal path SHALL be unchanged. The stand mesh SHALL be a standing clothed figure facing forward, with its feet on the origin.

#### Scenario: The casual idle replaces the mannequin
- **WHEN** the crew rig is missing and the casual stand mesh is available
- **THEN** the figure is the clothed idle, and the skeletal mesh is hidden

#### Scenario: Both meshes missing
- **WHEN** the crew rig and the casual stand mesh are both missing
- **THEN** the mannequin skeletal mesh stays visible

#### Scenario: The crew rig loads
- **WHEN** the crew skeletal mesh is present
- **THEN** the casual stand is hidden and the skeletal mesh is shown
