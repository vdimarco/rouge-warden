# swing-hidden-render Specification

## Purpose
Incremental Full Swing rendering work reduction, with no FPS-benefit merge gate.

## Requirements

### Requirement: Hidden flat pages do not draw the scene
A hidden flat page SHALL skip city/postprocessing draws, resume when visible and leave the XR rendering path unchanged.

#### Scenario: Hidden callbacks
- **WHEN** sixty render callbacks run while a flat page is hidden
- **THEN** no flat render pipeline call is submitted

#### Scenario: Resume and XR
- **WHEN** visibility returns
- **THEN** flat rendering resumes
- **AND** XR rendering remains independent of this flat-page guard
