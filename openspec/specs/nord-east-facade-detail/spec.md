# Visitation façade detail

## Requirements

### Requirement: Bounded decorative Visitation windows
The Montréal east extension SHALL show estimated decorative window/frame cards only on the three source-pinned Visitation shells. The added layer SHALL preserve existing shell geometry, collision, roads, boundaries and every retained actor state. Its exact three material groups SHALL remain nonblocking and cast no decorative shadows.

#### Scenario: Readable street façade
- **WHEN** a player looks along Visitation or back through the former edge at1920×1080 in Standard or Comic mode
- **THEN** the existing plain shells gain coherent glass/frame detail without missing façades, mirrored surfaces or obvious new detached shadows.
- **AND** the HUD, radar and attribution remain visible, while window rhythm/heights remain explicitly estimated.

#### Scenario: Existing traversal
- **WHEN** native players walk or drive the existing extension streets and jump at the checked outer boundary
- **THEN** the decorative layer does not block movement, change existing containment or alter Montréal campaign/population behavior.

#### Scenario: Saved package and preservation
- **WHEN** a fresh process reloads or launches the rebuilt Montréal package
- **THEN** all three exact decorative assets appear with their declared transforms/materials and all retained Content/actor states match the protected checkpoint.
- **AND** Toronto retains its separate free-roam route and current native checks.
