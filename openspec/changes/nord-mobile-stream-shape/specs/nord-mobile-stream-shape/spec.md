## ADDED Requirements

### Requirement: Shape-matched mobile video
Phones SHALL request native frames shaped like the current play area in both orientations, preserving the complete picture without CSS stretching. At each adaptive level, total pixels SHALL stay at or below edge²×9/16 with even encoder dimensions. Upright layouts SHALL retain at least 99% of that budget for typical phone aspect ratios. Desktop and portrait-disabled legacy builds SHALL retain their existing frame sizes.

#### Scenario: Upright, sideways and fullscreen
- **WHEN** a touch player starts, rotates or enters/leaves fullscreen
- **THEN** decoded native video converges to the play-area aspect ratio within 1%, all four frame edges remain visible, and controls remain playable and clear of the native HUD.
- **AND** while the new frame arrives the old frame is contained without stretching or cropping.

#### Scenario: Adaptive clarity and recovery
- **WHEN** sustained receiver pressure lowers the mobile profile and healthy playback restores it
- **THEN** every requested size retains the current play-area aspect ratio, stays within the corresponding pixel budget and keeps the existing bandwidth caps and input release/recovery behavior.

#### Scenario: Legacy and desktop
- **WHEN** a desktop connects or a build disables portrait streaming
- **THEN** desktop requests 1280×720, and the legacy touch build retains its current adaptive 16:9 sizes.
