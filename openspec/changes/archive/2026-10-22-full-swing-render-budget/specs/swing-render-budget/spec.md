## ADDED Requirements

### Requirement: Bounded flat drawing buffer
Flat Full Swing SHALL bound its3D drawing buffer to the validated pixel budget while keeping the camera and DOM interface fitted to the full viewport.

#### Scenario: Ultrawide fullscreen
- **WHEN** a3840×1080 CSS viewport uses device-pixel ratio2
- **THEN** the3D buffer stays within the validated pixel budget
- **AND** the canvas fills the viewport without changing HUD text or hit-target sizing

#### Scenario: Return to a smaller window
- **WHEN** the viewport shrinks below the budget
- **THEN** normal device-pixel ratio, capped at the existing2, is restored
- **AND** camera aspect follows the new viewport

#### Scenario: XR resize
- **WHEN** an XR session is presenting
- **THEN** the flat-window resize handler leaves the XR framebuffer sizing alone

#### Scenario: Performance evidence
- **WHEN** the cap is proposed for release
- **THEN** matched hardware measurements and visual evidence justify the selected budget
- **AND** remaining target failures and lower3D sampling are disclosed
