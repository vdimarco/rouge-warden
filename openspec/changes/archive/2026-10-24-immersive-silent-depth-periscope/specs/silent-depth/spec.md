## ADDED Requirements

### Requirement: Optical periscope station
The raised periscope SHALL present a circular optical field inside a dark physical eyepiece, etched reticle and bearing graduations, subtle lens falloff and reflection, and 1.5×/6× power with respective 32°/8° fields. Rendering, panning and visual observation SHALL share the optical field. Contacts outside the lens SHALL not be selectable through its housing. Portrait controls SHALL leave the glass unobstructed. Paused/reduced-motion and graphics fallback behavior SHALL remain usable.

#### Scenario: Observe and change power
- **WHEN** a commander raises the scope, pans, changes between low/high power and selects a visible contact on desktop or phone
- **THEN** ships and angular marks scale consistently, the selected contact is reported in the panel, and the circular housing remains opaque

#### Scenario: Trace equipment rather than touch padding
- **WHEN** a commander views or highlights room equipment at desktop or phone resolution
- **THEN** contours closely follow its image silhouette while native invisible touch targets remain at least 44px; smaller contours do not stretch to fill that padding
