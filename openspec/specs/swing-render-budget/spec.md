# Full Swing flat render budget

## Requirements

### Requirement: Bounded flat drawing buffer
Flat Full Swing SHALL bound its 3D drawing buffer to 3840×2160 total pixels while keeping the camera and DOM interface fitted to the full viewport.

#### Scenario: Ultrawide fullscreen
- **WHEN** a 3840×1080 CSS viewport uses device-pixel ratio 2
- **THEN** the 3D buffer stays within 3840×2160 total pixels
- **AND** the canvas fills the viewport without changing HUD text or hit-target sizing

#### Scenario: Return to a smaller window
- **WHEN** the viewport shrinks below the budget
- **THEN** normal device-pixel ratio, capped at the existing 2, is restored
- **AND** camera aspect follows the new viewport

#### Scenario: XR resize
- **WHEN** an XR session is presenting
- **THEN** the flat-window resize handler leaves the XR framebuffer sizing alone

#### Scenario: Performance evidence
- **WHEN** the cap is proposed for release
- **THEN** matched hardware measurements and visual evidence justify the selected budget
- **AND** remaining target failures and lower 3D sampling are disclosed
